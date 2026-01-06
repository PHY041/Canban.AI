"""
Agent API Routes - Start, monitor, and control Claude Code agents for cards.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.services.agent_executor import (
    spawn_claude_code,
    get_session,
    get_session_by_card,
    get_active_sessions,
    cancel_session,
    stream_session_output,
    build_task_prompt,
    send_followup,
    send_user_message,
    cleanup_old_sessions,
    check_claude_code_available,
    AgentStatus,
)
from app.db.database import get_supabase

router = APIRouter(prefix="/agents", tags=["agents"])


class StartAgentRequest(BaseModel):
    card_id: str
    working_dir: Optional[str] = "."
    custom_prompt: Optional[str] = None


class FollowUpRequest(BaseModel):
    session_id: str
    message: str


class SendMessageRequest(BaseModel):
    session_id: str
    message: str


class AgentSessionResponse(BaseModel):
    id: str
    card_id: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    output_lines: list[str] = []
    error: Optional[str] = None
    # Git worktree info
    worktree_path: Optional[str] = None
    worktree_branch: Optional[str] = None
    base_branch: Optional[str] = None
    # Interactive mode info
    waiting_for_input: bool = False
    last_question: Optional[str] = None
    message_count: int = 0
    # Claude session ID for resumption
    claude_session_id: Optional[str] = None


def _session_to_response(session) -> AgentSessionResponse:
    """Convert an AgentSession to response model."""
    return AgentSessionResponse(
        id=session.id,
        card_id=session.card_id,
        status=session.status.value,
        started_at=session.started_at,
        completed_at=session.completed_at,
        output_lines=session.output_lines,
        error=session.error,
        worktree_path=str(session.worktree_path) if session.worktree_path else None,
        worktree_branch=session.worktree_branch,
        base_branch=session.base_branch,
        waiting_for_input=session.waiting_for_input,
        last_question=session.last_question,
        message_count=session.message_count,
        claude_session_id=session.claude_session_id,
    )


@router.post("/start", response_model=AgentSessionResponse)
async def start_agent(request: StartAgentRequest):
    """
    Start a Claude Code agent to work on a card's task.
    """
    # Check if card already has an active agent
    existing = get_session_by_card(request.card_id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Card already has active agent session: {existing.id}"
        )

    # Fetch the card from database
    supabase = get_supabase()
    response = supabase.table("cards").select("*").eq("id", request.card_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Card not found")

    card = response.data[0]

    # Get the board to find repo_path
    board_response = supabase.table("boards").select("*").eq("id", card["board_id"]).execute()
    board = board_response.data[0] if board_response.data else None

    # Determine working directory: request override > card repo_path > board repo_path
    # Note: request.working_dir defaults to "." so we need to check for that
    req_working_dir = request.working_dir if request.working_dir and request.working_dir != "." else None
    working_dir = (
        req_working_dir
        or card.get("repo_path")
        or (board.get("repo_path") if board else None)
    )

    if not working_dir:
        raise HTTPException(
            status_code=400,
            detail="No repository path configured. Set repo path on the card or board."
        )

    # Build prompt from card or use custom
    prompt = request.custom_prompt or build_task_prompt(card)

    try:
        session = await spawn_claude_code(
            card_id=request.card_id,
            prompt=prompt,
            working_dir=working_dir,
        )

        return _session_to_response(session)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start agent: {e}")


@router.get("/session/{session_id}", response_model=AgentSessionResponse)
async def get_agent_session(session_id: str):
    """Get status and output of an agent session."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return _session_to_response(session)


@router.get("/card/{card_id}", response_model=Optional[AgentSessionResponse])
async def get_agent_for_card(card_id: str):
    """Get active agent session for a card, if any."""
    session = get_session_by_card(card_id)
    if not session:
        return None

    return _session_to_response(session)


@router.get("/active", response_model=list[AgentSessionResponse])
async def list_active_agents():
    """List all active agent sessions."""
    sessions = get_active_sessions()
    return [
        _session_to_response(s)
        for s in sessions.values()
        if s.status == AgentStatus.RUNNING
    ]


@router.post("/cancel/{session_id}")
async def cancel_agent(session_id: str, cleanup_worktree: bool = False):
    """
    Cancel a running agent session.

    Args:
        session_id: The session to cancel
        cleanup_worktree: If true, also delete the worktree
    """
    success = await cancel_session(session_id, cleanup_worktree=cleanup_worktree)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Session not found or not running"
        )
    return {"message": "Agent cancelled", "session_id": session_id}


@router.get("/stream/{session_id}")
async def stream_agent_output(session_id: str):
    """
    Stream agent output via Server-Sent Events (SSE).
    Connect to this endpoint to receive real-time output.
    """
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    async def event_generator():
        async for line in stream_session_output(session_id):
            yield f"data: {line}\n\n"
        yield "event: done\ndata: completed\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.post("/message", response_model=AgentSessionResponse)
async def send_message(request: SendMessageRequest):
    """
    Send a message to continue a conversation with the agent.

    Use this when the agent has completed or is waiting for input.
    This uses --resume to continue the Claude session with the new message.
    """
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status.value not in ('completed', 'waiting_for_input'):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resume session with status: {session.status.value}. Wait for completion."
        )

    if not session.claude_session_id:
        raise HTTPException(
            status_code=400,
            detail="Session has no Claude session ID for resumption"
        )

    try:
        success = await send_user_message(request.session_id, request.message)
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to send message to agent"
            )

        return _session_to_response(session)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send message: {e}")


@router.post("/followup", response_model=AgentSessionResponse)
async def followup_agent(request: FollowUpRequest):
    """
    Send a follow-up message to a completed agent session.
    This creates a new session with context from the previous one.
    """
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get card and board for working directory
    supabase = get_supabase()
    card_response = supabase.table("cards").select("*").eq("id", session.card_id).execute()
    if not card_response.data:
        raise HTTPException(status_code=404, detail="Card not found")

    card = card_response.data[0]
    board_response = supabase.table("boards").select("*").eq("id", card["board_id"]).execute()
    board = board_response.data[0] if board_response.data else None
    working_dir = board.get("repo_path") if board else "."

    if not working_dir or working_dir == ".":
        raise HTTPException(status_code=400, detail="No repo path configured for board")

    try:
        new_session = await send_followup(
            session_id=request.session_id,
            message=request.message,
            working_dir=working_dir,
        )

        return _session_to_response(new_session)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send follow-up: {e}")


@router.get("/status")
async def check_status():
    """
    Check if Claude Code CLI is available and authenticated.

    Returns status info useful for displaying to users before they try to start an agent.
    """
    available, message = await check_claude_code_available()
    return {
        "available": available,
        "message": message,
    }


@router.post("/cleanup")
async def cleanup_sessions(max_age_hours: int = 24):
    """
    Clean up old completed/failed/cancelled sessions from memory.

    Args:
        max_age_hours: Remove sessions older than this (default 24 hours)
    """
    count = cleanup_old_sessions(max_age_hours)
    return {"message": f"Cleaned up {count} old sessions", "removed": count}
