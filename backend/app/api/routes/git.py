"""
Git API Routes - View diffs, merge, and manage worktrees.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from pathlib import Path

from app.services.git_service import GitService, GitError, DiffResult, FileDiff
from app.services.agent_executor import get_session, get_session_by_card
from app.db.database import get_supabase

router = APIRouter(prefix="/git", tags=["git"])


class FileDiffResponse(BaseModel):
    path: str
    old_path: Optional[str] = None
    status: str
    additions: int
    deletions: int
    patch: str
    is_binary: bool


class DiffResponse(BaseModel):
    files: list[FileDiffResponse]
    total_additions: int
    total_deletions: int
    base_commit: Optional[str] = None
    head_commit: Optional[str] = None
    branch: Optional[str] = None
    worktree_path: Optional[str] = None


class MergeRequest(BaseModel):
    card_id: str
    squash: bool = True
    commit_message: Optional[str] = None
    delete_branch: bool = True


class MergeResponse(BaseModel):
    success: bool
    commit_sha: Optional[str] = None
    message: str


class RebaseRequest(BaseModel):
    card_id: str


class WorktreeResponse(BaseModel):
    path: str
    branch: str
    card_id: str
    exists: bool


def _get_repo_path_for_card(card_id: str) -> str:
    """Get the repo path for a card."""
    supabase = get_supabase()

    # Get card
    response = supabase.table("cards").select("*, boards(repo_path)").eq("id", card_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Card not found")

    card = response.data[0]

    # Card repo_path takes priority
    if card.get("repo_path"):
        return card["repo_path"]

    # Fall back to board repo_path
    if card.get("boards") and card["boards"].get("repo_path"):
        return card["boards"]["repo_path"]

    raise HTTPException(status_code=400, detail="No repository path configured")


@router.get("/diff/{card_id}", response_model=DiffResponse)
async def get_card_diff(card_id: str):
    """
    Get the diff for a card's worktree.

    Shows all changes made by the agent compared to the base branch.
    """
    repo_path = _get_repo_path_for_card(card_id)

    try:
        git_service = GitService(repo_path)
        worktree_path = git_service.get_worktree_path(card_id)

        if not worktree_path.exists():
            raise HTTPException(
                status_code=404,
                detail="No worktree found for this card. Agent may not have run yet."
            )

        diff_result = git_service.get_diff(card_id=card_id)
        branch = git_service.get_worktree_branch(card_id)

        return DiffResponse(
            files=[
                FileDiffResponse(
                    path=f.path,
                    old_path=f.old_path,
                    status=f.status,
                    additions=f.additions,
                    deletions=f.deletions,
                    patch=f.patch,
                    is_binary=f.is_binary,
                )
                for f in diff_result.files
            ],
            total_additions=diff_result.total_additions,
            total_deletions=diff_result.total_deletions,
            base_commit=diff_result.base_commit,
            head_commit=diff_result.head_commit,
            branch=branch,
            worktree_path=str(worktree_path),
        )

    except GitError as e:
        raise HTTPException(status_code=500, detail=f"Git error: {e}")


@router.get("/worktree/{card_id}", response_model=WorktreeResponse)
async def get_worktree_status(card_id: str):
    """Get the worktree status for a card."""
    repo_path = _get_repo_path_for_card(card_id)

    try:
        git_service = GitService(repo_path)
        worktree_path = git_service.get_worktree_path(card_id)
        branch = git_service.get_worktree_branch(card_id)

        return WorktreeResponse(
            path=str(worktree_path),
            branch=branch,
            card_id=card_id,
            exists=worktree_path.exists(),
        )

    except GitError as e:
        raise HTTPException(status_code=500, detail=f"Git error: {e}")


@router.post("/merge", response_model=MergeResponse)
async def merge_card_changes(request: MergeRequest):
    """
    Merge a card's changes back into the main branch.

    This squash-merges the task branch and optionally deletes it.
    """
    repo_path = _get_repo_path_for_card(request.card_id)

    try:
        git_service = GitService(repo_path)
        worktree_path = git_service.get_worktree_path(request.card_id)

        if not worktree_path.exists():
            raise HTTPException(
                status_code=404,
                detail="No worktree found for this card"
            )

        # Commit any uncommitted changes first
        git_service.commit_all(
            worktree_path,
            message=f"Auto-commit before merge for card {request.card_id}",
        )

        # Perform the merge
        commit_sha = git_service.merge_task_branch(
            card_id=request.card_id,
            squash=request.squash,
            commit_message=request.commit_message,
        )

        # Clean up worktree and branch if requested
        if request.delete_branch:
            git_service.remove_worktree(request.card_id, force=True)
            branch = git_service.get_worktree_branch(request.card_id)
            try:
                git_service.delete_branch(branch, force=True)
            except GitError:
                pass  # Branch may already be deleted

        return MergeResponse(
            success=True,
            commit_sha=commit_sha,
            message=f"Successfully merged changes. Commit: {commit_sha[:8]}",
        )

    except GitError as e:
        raise HTTPException(status_code=500, detail=f"Merge failed: {e}")


@router.post("/rebase/{card_id}", response_model=MergeResponse)
async def rebase_card_branch(card_id: str):
    """
    Rebase a card's branch onto the latest main branch.

    Use this to update the task branch with the latest changes from main.
    """
    repo_path = _get_repo_path_for_card(card_id)

    try:
        git_service = GitService(repo_path)
        worktree_path = git_service.get_worktree_path(card_id)

        if not worktree_path.exists():
            raise HTTPException(
                status_code=404,
                detail="No worktree found for this card"
            )

        # Commit any uncommitted changes first
        git_service.commit_all(
            worktree_path,
            message=f"Auto-commit before rebase for card {card_id}",
        )

        # Perform rebase
        git_service.rebase_task_branch(card_id)

        return MergeResponse(
            success=True,
            message="Successfully rebased onto latest main branch",
        )

    except GitError as e:
        if "conflict" in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail=f"Rebase conflict: {e}. Manual resolution needed."
            )
        raise HTTPException(status_code=500, detail=f"Rebase failed: {e}")


@router.post("/rebase/{card_id}/abort", response_model=MergeResponse)
async def abort_rebase(card_id: str):
    """Abort an in-progress rebase."""
    repo_path = _get_repo_path_for_card(card_id)

    try:
        git_service = GitService(repo_path)
        git_service.abort_rebase(card_id)

        return MergeResponse(
            success=True,
            message="Rebase aborted",
        )

    except GitError as e:
        raise HTTPException(status_code=500, detail=f"Failed to abort rebase: {e}")


@router.delete("/worktree/{card_id}")
async def delete_worktree(card_id: str, force: bool = False):
    """
    Delete a card's worktree.

    Use force=true to delete even with uncommitted changes.
    """
    repo_path = _get_repo_path_for_card(card_id)

    try:
        git_service = GitService(repo_path)
        git_service.remove_worktree(card_id, force=force)

        return {"message": "Worktree deleted", "card_id": card_id}

    except GitError as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete worktree: {e}")


@router.post("/prune")
async def prune_worktrees(repo_path: str):
    """
    Prune stale worktrees from a repository.

    This removes worktree admin files for worktrees that no longer exist.
    """
    try:
        git_service = GitService(repo_path)
        git_service.prune_worktrees()

        return {"message": "Pruned stale worktrees", "repo_path": repo_path}

    except GitError as e:
        raise HTTPException(status_code=500, detail=f"Failed to prune worktrees: {e}")


@router.get("/branches/{card_id}")
async def get_branch_info(card_id: str):
    """Get branch information for a card."""
    repo_path = _get_repo_path_for_card(card_id)

    try:
        git_service = GitService(repo_path)
        worktree_path = git_service.get_worktree_path(card_id)
        task_branch = git_service.get_worktree_branch(card_id)
        default_branch = git_service.get_default_branch()

        # Check if task branch exists
        from subprocess import run
        result = run(
            ["git", "show-ref", "--verify", f"refs/heads/{task_branch}"],
            cwd=repo_path,
            capture_output=True,
        )
        branch_exists = result.returncode == 0

        # Get current branch in worktree if it exists
        current_branch = None
        if worktree_path.exists():
            current_branch = git_service.get_current_branch(worktree_path)

        return {
            "card_id": card_id,
            "task_branch": task_branch,
            "branch_exists": branch_exists,
            "default_branch": default_branch,
            "current_branch": current_branch,
            "worktree_exists": worktree_path.exists(),
        }

    except GitError as e:
        raise HTTPException(status_code=500, detail=f"Git error: {e}")
