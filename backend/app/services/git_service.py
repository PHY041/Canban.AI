"""
Git Service - Worktree management and diff operations.

Inspired by vibe-kanban's Rust git service, adapted for Python.
Uses Git CLI commands for reliability with worktrees.
"""
import asyncio
import subprocess
import os
import shutil
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class GitError(Exception):
    """Git operation error."""
    pass


@dataclass
class FileDiff:
    """Represents a file diff."""
    path: str
    old_path: Optional[str] = None  # For renames
    status: str = "modified"  # added, deleted, modified, renamed
    additions: int = 0
    deletions: int = 0
    patch: str = ""
    is_binary: bool = False


@dataclass
class DiffResult:
    """Result of a diff operation."""
    files: list[FileDiff] = field(default_factory=list)
    total_additions: int = 0
    total_deletions: int = 0
    base_commit: Optional[str] = None
    head_commit: Optional[str] = None


@dataclass
class WorktreeInfo:
    """Information about a worktree."""
    path: Path
    branch: str
    head_commit: str
    is_bare: bool = False
    is_detached: bool = False


class GitService:
    """Service for git operations including worktree management."""

    def __init__(self, repo_path: str):
        """
        Initialize git service.

        Args:
            repo_path: Path to the main git repository
        """
        self.repo_path = Path(repo_path).resolve()
        self._validate_repo()

    def _validate_repo(self) -> None:
        """Validate that repo_path is a git repository."""
        git_dir = self.repo_path / ".git"
        if not git_dir.exists():
            raise GitError(f"Not a git repository: {self.repo_path}")

    def _run_git(
        self,
        args: list[str],
        cwd: Optional[Path] = None,
        check: bool = True,
    ) -> subprocess.CompletedProcess:
        """
        Run a git command.

        Args:
            args: Git command arguments (without 'git')
            cwd: Working directory (defaults to repo_path)
            check: Raise on non-zero exit

        Returns:
            CompletedProcess result
        """
        cmd = ["git"] + args
        result = subprocess.run(
            cmd,
            cwd=cwd or self.repo_path,
            capture_output=True,
            text=True,
        )
        if check and result.returncode != 0:
            raise GitError(f"Git command failed: {' '.join(cmd)}\n{result.stderr}")
        return result

    async def _run_git_async(
        self,
        args: list[str],
        cwd: Optional[Path] = None,
    ) -> tuple[int, str, str]:
        """Run git command asynchronously."""
        cmd = ["git"] + args
        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd or self.repo_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        return process.returncode, stdout.decode(), stderr.decode()

    # ==================== Branch Operations ====================

    def get_current_branch(self, worktree_path: Optional[Path] = None) -> str:
        """Get the current branch name."""
        result = self._run_git(
            ["rev-parse", "--abbrev-ref", "HEAD"],
            cwd=worktree_path,
        )
        return result.stdout.strip()

    def get_default_branch(self) -> str:
        """Get the default branch (main/master)."""
        # Try to get from remote
        result = self._run_git(
            ["symbolic-ref", "refs/remotes/origin/HEAD"],
            check=False,
        )
        if result.returncode == 0:
            # refs/remotes/origin/main -> main
            return result.stdout.strip().split("/")[-1]

        # Fallback: check if main or master exists
        for branch in ["main", "master"]:
            result = self._run_git(
                ["show-ref", "--verify", f"refs/heads/{branch}"],
                check=False,
            )
            if result.returncode == 0:
                return branch

        return "main"  # Default assumption

    def create_branch(
        self,
        branch_name: str,
        base_branch: Optional[str] = None,
        worktree_path: Optional[Path] = None,
    ) -> str:
        """
        Create a new branch from base.

        Returns:
            The commit SHA of the new branch head
        """
        base = base_branch or self.get_default_branch()
        self._run_git(
            ["branch", branch_name, base],
            cwd=worktree_path,
        )
        result = self._run_git(
            ["rev-parse", branch_name],
            cwd=worktree_path,
        )
        return result.stdout.strip()

    def delete_branch(self, branch_name: str, force: bool = False) -> None:
        """Delete a local branch."""
        flag = "-D" if force else "-d"
        self._run_git([flag, branch_name])

    # ==================== Worktree Operations ====================

    def get_worktrees_dir(self) -> Path:
        """Get the directory where worktrees are stored."""
        return self.repo_path / ".worktrees"

    def get_worktree_path(self, card_id: str) -> Path:
        """Get the path for a card's worktree."""
        return self.get_worktrees_dir() / f"task-{card_id}"

    def get_worktree_branch(self, card_id: str) -> str:
        """Get the branch name for a card's worktree."""
        return f"task/{card_id}"

    def list_worktrees(self) -> list[WorktreeInfo]:
        """List all worktrees."""
        result = self._run_git(["worktree", "list", "--porcelain"])
        worktrees = []
        current: dict = {}

        for line in result.stdout.strip().split("\n"):
            if not line:
                if current:
                    worktrees.append(WorktreeInfo(
                        path=Path(current.get("worktree", "")),
                        branch=current.get("branch", "").replace("refs/heads/", ""),
                        head_commit=current.get("HEAD", ""),
                        is_bare=current.get("bare", False),
                        is_detached=current.get("detached", False),
                    ))
                current = {}
            elif line.startswith("worktree "):
                current["worktree"] = line[9:]
            elif line.startswith("HEAD "):
                current["HEAD"] = line[5:]
            elif line.startswith("branch "):
                current["branch"] = line[7:]
            elif line == "bare":
                current["bare"] = True
            elif line == "detached":
                current["detached"] = True

        return worktrees

    def create_worktree(
        self,
        card_id: str,
        base_branch: Optional[str] = None,
    ) -> Path:
        """
        Create a worktree for a card/task.

        This creates an isolated working directory with its own branch.

        Args:
            card_id: The card ID to create worktree for
            base_branch: Branch to base the worktree on (defaults to main/master)

        Returns:
            Path to the created worktree
        """
        worktree_path = self.get_worktree_path(card_id)
        branch_name = self.get_worktree_branch(card_id)
        base = base_branch or self.get_default_branch()

        # Ensure worktrees directory exists
        self.get_worktrees_dir().mkdir(parents=True, exist_ok=True)

        # Check if worktree already exists
        if worktree_path.exists():
            # Verify it's a valid worktree
            if self._is_valid_worktree(worktree_path):
                return worktree_path
            # Clean up invalid worktree
            self.remove_worktree(card_id, force=True)

        # Check if branch exists
        result = self._run_git(
            ["show-ref", "--verify", f"refs/heads/{branch_name}"],
            check=False,
        )
        branch_exists = result.returncode == 0

        if branch_exists:
            # Use existing branch
            self._run_git([
                "worktree", "add",
                str(worktree_path),
                branch_name,
            ])
        else:
            # Create new branch from base
            self._run_git([
                "worktree", "add",
                "-b", branch_name,
                str(worktree_path),
                base,
            ])

        return worktree_path

    def _is_valid_worktree(self, worktree_path: Path) -> bool:
        """Check if a worktree is valid."""
        if not worktree_path.exists():
            return False
        git_file = worktree_path / ".git"
        if not git_file.exists():
            return False
        # Check if it's registered
        result = self._run_git(
            ["worktree", "list", "--porcelain"],
            check=False,
        )
        return str(worktree_path) in result.stdout

    def remove_worktree(self, card_id: str, force: bool = False) -> None:
        """
        Remove a worktree for a card.

        Args:
            card_id: The card ID
            force: Force removal even with uncommitted changes
        """
        worktree_path = self.get_worktree_path(card_id)

        # Remove worktree registration
        args = ["worktree", "remove"]
        if force:
            args.append("--force")
        args.append(str(worktree_path))

        try:
            self._run_git(args)
        except GitError:
            # Fallback: manual cleanup
            if worktree_path.exists():
                shutil.rmtree(worktree_path, ignore_errors=True)
            # Prune worktree list
            self._run_git(["worktree", "prune"], check=False)

    def prune_worktrees(self) -> None:
        """Prune stale worktree admin files."""
        self._run_git(["worktree", "prune"])

    # ==================== Diff Operations ====================

    def get_diff(
        self,
        card_id: Optional[str] = None,
        base_branch: Optional[str] = None,
        worktree_path: Optional[Path] = None,
    ) -> DiffResult:
        """
        Get diff for a worktree against its base branch.

        Args:
            card_id: Card ID (to find worktree)
            base_branch: Branch to compare against
            worktree_path: Direct path to worktree

        Returns:
            DiffResult with file changes
        """
        if card_id:
            worktree_path = self.get_worktree_path(card_id)
        if not worktree_path:
            worktree_path = self.repo_path

        base = base_branch or self.get_default_branch()

        # Get the merge base
        result = self._run_git(
            ["merge-base", base, "HEAD"],
            cwd=worktree_path,
            check=False,
        )
        base_commit = result.stdout.strip() if result.returncode == 0 else base

        # Get current HEAD
        result = self._run_git(
            ["rev-parse", "HEAD"],
            cwd=worktree_path,
        )
        head_commit = result.stdout.strip()

        # Get diff with stats
        result = self._run_git(
            ["diff", "--numstat", f"{base_commit}...HEAD"],
            cwd=worktree_path,
        )

        files = []
        total_add = 0
        total_del = 0

        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 3:
                add = int(parts[0]) if parts[0] != "-" else 0
                del_ = int(parts[1]) if parts[1] != "-" else 0
                path = parts[2]

                # Get the patch for this file
                patch_result = self._run_git(
                    ["diff", f"{base_commit}...HEAD", "--", path],
                    cwd=worktree_path,
                    check=False,
                )

                files.append(FileDiff(
                    path=path,
                    additions=add,
                    deletions=del_,
                    patch=patch_result.stdout if patch_result.returncode == 0 else "",
                    is_binary=parts[0] == "-",
                ))
                total_add += add
                total_del += del_

        # Also check for uncommitted changes
        result = self._run_git(
            ["diff", "--numstat"],
            cwd=worktree_path,
            check=False,
        )
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 3:
                path = parts[2]
                # Check if already in list
                existing = next((f for f in files if f.path == path), None)
                if not existing:
                    add = int(parts[0]) if parts[0] != "-" else 0
                    del_ = int(parts[1]) if parts[1] != "-" else 0
                    files.append(FileDiff(
                        path=path,
                        status="modified (uncommitted)",
                        additions=add,
                        deletions=del_,
                    ))
                    total_add += add
                    total_del += del_

        return DiffResult(
            files=files,
            total_additions=total_add,
            total_deletions=total_del,
            base_commit=base_commit,
            head_commit=head_commit,
        )

    def get_uncommitted_changes(self, worktree_path: Path) -> DiffResult:
        """Get uncommitted changes in a worktree."""
        result = self._run_git(
            ["diff", "--numstat"],
            cwd=worktree_path,
        )

        files = []
        total_add = 0
        total_del = 0

        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 3:
                add = int(parts[0]) if parts[0] != "-" else 0
                del_ = int(parts[1]) if parts[1] != "-" else 0
                path = parts[2]
                files.append(FileDiff(
                    path=path,
                    additions=add,
                    deletions=del_,
                ))
                total_add += add
                total_del += del_

        return DiffResult(
            files=files,
            total_additions=total_add,
            total_deletions=total_del,
        )

    # ==================== Merge Operations ====================

    def merge_task_branch(
        self,
        card_id: str,
        target_branch: Optional[str] = None,
        squash: bool = True,
        commit_message: Optional[str] = None,
    ) -> str:
        """
        Merge a task branch into target branch.

        Args:
            card_id: Card ID whose branch to merge
            target_branch: Branch to merge into (default: main)
            squash: Use squash merge (recommended)
            commit_message: Custom commit message

        Returns:
            The resulting commit SHA
        """
        task_branch = self.get_worktree_branch(card_id)
        target = target_branch or self.get_default_branch()

        # Checkout target branch in main repo
        self._run_git(["checkout", target])

        # Pull latest
        self._run_git(["pull", "--rebase"], check=False)

        if squash:
            # Squash merge
            self._run_git(["merge", "--squash", task_branch])

            # Commit with message
            msg = commit_message or f"Merge task {card_id}"
            self._run_git(["commit", "-m", msg])
        else:
            # Regular merge
            args = ["merge", task_branch]
            if commit_message:
                args.extend(["-m", commit_message])
            self._run_git(args)

        # Get the resulting commit
        result = self._run_git(["rev-parse", "HEAD"])
        return result.stdout.strip()

    def rebase_task_branch(
        self,
        card_id: str,
        onto_branch: Optional[str] = None,
    ) -> None:
        """
        Rebase a task branch onto the latest target branch.

        Args:
            card_id: Card ID whose branch to rebase
            onto_branch: Branch to rebase onto (default: main)
        """
        worktree_path = self.get_worktree_path(card_id)
        onto = onto_branch or self.get_default_branch()

        # Fetch latest
        self._run_git(["fetch", "origin"], check=False)

        # Rebase
        self._run_git(
            ["rebase", f"origin/{onto}"],
            cwd=worktree_path,
        )

    def abort_rebase(self, card_id: str) -> None:
        """Abort an in-progress rebase."""
        worktree_path = self.get_worktree_path(card_id)
        self._run_git(["rebase", "--abort"], cwd=worktree_path)

    # ==================== Commit Operations ====================

    def commit_all(
        self,
        worktree_path: Path,
        message: str,
    ) -> Optional[str]:
        """
        Stage and commit all changes.

        Returns:
            Commit SHA or None if nothing to commit
        """
        # Stage all changes
        self._run_git(["add", "-A"], cwd=worktree_path)

        # Check if there's anything to commit
        result = self._run_git(
            ["status", "--porcelain"],
            cwd=worktree_path,
        )
        if not result.stdout.strip():
            return None

        # Commit
        self._run_git(
            ["commit", "-m", message],
            cwd=worktree_path,
        )

        # Return commit SHA
        result = self._run_git(
            ["rev-parse", "HEAD"],
            cwd=worktree_path,
        )
        return result.stdout.strip()

    def push_branch(
        self,
        card_id: str,
        force: bool = False,
    ) -> None:
        """Push a task branch to remote."""
        worktree_path = self.get_worktree_path(card_id)
        branch = self.get_worktree_branch(card_id)

        args = ["push", "-u", "origin", branch]
        if force:
            args.insert(1, "--force")

        self._run_git(args, cwd=worktree_path)


# ==================== Helper Functions ====================

def get_git_service(repo_path: str) -> GitService:
    """Factory function to create GitService."""
    return GitService(repo_path)
