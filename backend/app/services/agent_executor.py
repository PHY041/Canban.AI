"""
Agent Executor Service - Spawns Claude Code CLI for task execution.

Based on vibe-kanban's executor pattern, adapted for Python/FastAPI.
Supports git worktrees for isolated task execution.
Now supports interactive mode with multi-round communication via --resume.
"""
import asyncio
import subprocess
import json
import uuid
import re
import shutil
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional, AsyncIterator, Callable, Tuple
from enum import Enum

from app.services.git_service import GitService, GitError


class ClaudeCodeError(Exception):
    """Raised when Claude Code CLI is not available or not authenticated."""
    pass


async def check_claude_code_available() -> Tuple[bool, str]:
    """
    Check if Claude Code CLI is installed and accessible.

    Returns:
        Tuple of (is_available, message)
    """
    # Check if npx is available
    if not shutil.which("npx"):
        return False, "npx not found. Please install Node.js 18+ from https://nodejs.org"

    try:
        # Try running claude --version to check if it's installed
        process = await asyncio.create_subprocess_exec(
            "npx", "-y", "@anthropic-ai/claude-code@latest", "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30.0)

        if process.returncode == 0:
            version = stdout.decode().strip()
            return True, f"Claude Code CLI available: {version}"
        else:
            error = stderr.decode().strip()
            if "ANTHROPIC_API_KEY" in error or "authentication" in error.lower():
                return False, "Claude Code not authenticated. Run 'npx @anthropic-ai/claude-code' and login first."
            return False, f"Claude Code error: {error}"

    except asyncio.TimeoutError:
        return False, "Claude Code check timed out. Try running 'npx @anthropic-ai/claude-code --version' manually."
    except Exception as e:
        return False, f"Failed to check Claude Code: {e}"


class AgentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    WAITING_FOR_INPUT = "waiting_for_input"  # Agent asked a question
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class AgentSession:
    """Tracks a running agent session."""
    id: str
    card_id: str
    process: Optional[asyncio.subprocess.Process] = None
    status: AgentStatus = AgentStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    output_lines: list[str] = field(default_factory=list)
    error: Optional[str] = None
    # Git worktree info
    worktree_path: Optional[Path] = None
    worktree_branch: Optional[str] = None
    base_branch: Optional[str] = None
    # Interactive mode
    waiting_for_input: bool = False
    last_question: Optional[str] = None
    message_count: int = 0  # Number of messages exchanged
    # Claude Code session ID for resumption
    claude_session_id: Optional[str] = None
    working_dir: Optional[str] = None  # Remember working dir for follow-ups


# Global registry of active sessions
_active_sessions: dict[str, AgentSession] = {}


def get_active_sessions() -> dict[str, AgentSession]:
    """Get all active agent sessions."""
    return _active_sessions


def get_session(session_id: str) -> Optional[AgentSession]:
    """Get a specific session by ID."""
    return _active_sessions.get(session_id)


def get_session_by_card(card_id: str) -> Optional[AgentSession]:
    """Get active session for a card."""
    for session in _active_sessions.values():
        if session.card_id == card_id and session.status == AgentStatus.RUNNING:
            return session
    return None


async def spawn_claude_code(
    card_id: str,
    prompt: str,
    working_dir: str = ".",
    on_output: Optional[Callable[[str], None]] = None,
    use_worktree: bool = True,
) -> AgentSession:
    """
    Spawn Claude Code CLI to work on a task.

    Args:
        card_id: The card ID this agent is working on
        prompt: The task prompt/instructions
        working_dir: Directory to run Claude Code in (the main repo)
        on_output: Optional callback for each output line
        use_worktree: Create an isolated git worktree for the task

    Returns:
        AgentSession with process handle
    """
    session_id = str(uuid.uuid4())
    session = AgentSession(
        id=session_id,
        card_id=card_id,
        status=AgentStatus.PENDING,
    )
    _active_sessions[session_id] = session

    # Determine actual working directory
    actual_working_dir = working_dir
    git_service = None

    if use_worktree:
        try:
            git_service = GitService(working_dir)
            session.base_branch = git_service.get_default_branch()

            # Create worktree for isolated execution
            worktree_path = git_service.create_worktree(
                card_id=card_id,
                base_branch=session.base_branch,
            )
            session.worktree_path = worktree_path
            session.worktree_branch = git_service.get_worktree_branch(card_id)
            actual_working_dir = str(worktree_path)

            # Add worktree info to output
            session.output_lines.append(
                f"[kanban] Created worktree at {worktree_path}"
            )
            session.output_lines.append(
                f"[kanban] Working on branch: {session.worktree_branch}"
            )
        except GitError as e:
            # Fallback to direct execution if worktree fails
            session.output_lines.append(
                f"[kanban] Warning: Could not create worktree: {e}"
            )
            session.output_lines.append(
                f"[kanban] Running directly in {working_dir}"
            )

    # Build the Claude Code command
    # Use -p (print) mode with stream-json output
    # For multi-turn, we'll use --resume with the Claude session_id
    cmd = [
        "npx", "-y", "@anthropic-ai/claude-code@latest",
        "-p", prompt,
        "--output-format", "stream-json",
        "--verbose",
    ]

    # Store working dir for potential follow-ups
    session.working_dir = actual_working_dir

    try:
        session.status = AgentStatus.RUNNING
        session.started_at = datetime.now(timezone.utc)

        # Spawn the process
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=actual_working_dir,
        )
        session.process = process

        # Start background task to read output
        asyncio.create_task(_read_process_output(session, on_output))

        # Log that agent is starting
        session.output_lines.append(f"[kanban] Starting agent with task...")

        return session

    except Exception as e:
        session.status = AgentStatus.FAILED
        session.error = str(e)
        session.completed_at = datetime.now(timezone.utc)
        raise


async def send_user_message(session_id: str, message: str) -> bool:
    """
    Send a user message to continue a conversation.

    Uses Claude's --resume flag to continue the session.
    This spawns a new process that resumes the previous conversation.

    Args:
        session_id: The kanban session ID
        message: User's message/response

    Returns:
        True if message was sent successfully
    """
    session = _active_sessions.get(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")

    if not session.claude_session_id:
        raise ValueError("No Claude session ID available for resumption")

    if session.status not in (AgentStatus.COMPLETED, AgentStatus.WAITING_FOR_INPUT):
        raise ValueError(f"Cannot resume session with status: {session.status}")

    # Log the user message
    session.output_lines.append(f"[user] {message}")

    # Build command with --resume
    cmd = [
        "npx", "-y", "@anthropic-ai/claude-code@latest",
        "--resume", session.claude_session_id,
        "-p", message,
        "--output-format", "stream-json",
        "--verbose",
    ]

    working_dir = session.working_dir or "."

    try:
        # Update session status
        session.status = AgentStatus.RUNNING
        session.waiting_for_input = False
        session.message_count += 1

        # Spawn resumed process
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=working_dir,
        )
        session.process = process

        # Start background task to read output
        asyncio.create_task(_read_process_output(session, None))

        session.output_lines.append(f"[kanban] Resuming conversation...")

        return True

    except Exception as e:
        session.error = f"Failed to resume session: {e}"
        session.status = AgentStatus.FAILED
        return False


def _is_question(text: str) -> bool:
    """
    Detect if text contains a question that needs user input.

    Looks for common question patterns in Claude's output.
    """
    if not text:
        return False

    # Direct question markers
    question_patterns = [
        r'\?$',  # Ends with question mark
        r'\?\s*$',  # Question mark with trailing space
        r'would you like',
        r'should i',
        r'do you want',
        r'can you (tell|clarify|specify|provide)',
        r'could you (tell|clarify|specify|provide)',
        r'please (specify|clarify|confirm|let me know)',
        r'which (one|option|approach)',
        r'what (would|should|do) you',
        r'is that (correct|right|ok|okay)',
        r'does that (work|sound|look)',
        r'let me know if',
        r'before i (proceed|continue|start)',
    ]

    text_lower = text.lower()
    for pattern in question_patterns:
        if re.search(pattern, text_lower):
            return True

    return False


def _extract_question(text: str) -> Optional[str]:
    """Extract the question text from assistant output."""
    # Find sentences ending with ?
    sentences = re.split(r'(?<=[.!?])\s+', text)
    questions = [s for s in sentences if s.strip().endswith('?')]
    if questions:
        return questions[-1].strip()
    return text.strip() if _is_question(text) else None


async def _read_process_output(
    session: AgentSession,
    on_output: Optional[Callable[[str], None]] = None,
) -> None:
    """Background task to read process output and detect questions."""
    if not session.process or not session.process.stdout:
        return

    accumulated_text = ""

    try:
        async for line in session.process.stdout:
            decoded = line.decode("utf-8").strip()
            if decoded:
                session.output_lines.append(decoded)
                if on_output:
                    on_output(decoded)

                # Try to parse as JSON to extract session_id and assistant text
                try:
                    data = json.loads(decoded)

                    # Extract Claude session_id from init message for --resume
                    if data.get("type") == "system" and data.get("subtype") == "init":
                        claude_sid = data.get("session_id")
                        if claude_sid:
                            session.claude_session_id = claude_sid
                            session.output_lines.append(
                                f"[kanban] Claude session: {claude_sid[:8]}..."
                            )

                    elif data.get("type") == "assistant":
                        content = data.get("message", {}).get("content", [])
                        for item in content:
                            if item.get("type") == "text":
                                text = item.get("text", "")
                                accumulated_text += " " + text

                                # Check if agent is asking a question
                                if _is_question(text):
                                    session.waiting_for_input = True
                                    session.status = AgentStatus.WAITING_FOR_INPUT
                                    session.last_question = _extract_question(text)

                    # Reset waiting state when agent uses a tool (it's working)
                    elif data.get("type") == "tool_use" or data.get("tool"):
                        session.waiting_for_input = False
                        session.status = AgentStatus.RUNNING

                    # Check for result/completion
                    elif data.get("type") == "result":
                        session.waiting_for_input = False

                except json.JSONDecodeError:
                    pass  # Not JSON, just raw text

        # Wait for process to complete
        await session.process.wait()

        if session.process.returncode == 0:
            session.status = AgentStatus.COMPLETED
        else:
            session.status = AgentStatus.FAILED
            # Read stderr for error info
            if session.process.stderr:
                stderr = await session.process.stderr.read()
                session.error = stderr.decode("utf-8")

    except Exception as e:
        session.status = AgentStatus.FAILED
        session.error = str(e)
    finally:
        session.completed_at = datetime.now(timezone.utc)


async def cancel_session(session_id: str, cleanup_worktree: bool = False) -> bool:
    """
    Cancel a running agent session.

    Args:
        session_id: The session ID to cancel
        cleanup_worktree: If True, also remove the worktree
    """
    session = _active_sessions.get(session_id)
    if not session or session.status != AgentStatus.RUNNING:
        return False

    if session.process:
        session.process.terminate()
        try:
            await asyncio.wait_for(session.process.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            session.process.kill()

    session.status = AgentStatus.CANCELLED
    session.completed_at = datetime.now(timezone.utc)

    # Optionally clean up the worktree
    if cleanup_worktree and session.worktree_path:
        try:
            git_service = GitService(str(session.worktree_path.parent.parent))
            git_service.remove_worktree(session.card_id, force=True)
        except Exception:
            pass  # Best effort cleanup

    return True


def cleanup_old_sessions(max_age_hours: int = 24) -> int:
    """
    Remove completed sessions older than max_age from registry.

    Returns:
        Number of sessions cleaned up
    """
    now = datetime.now(timezone.utc)
    to_remove = []

    for session_id, session in _active_sessions.items():
        if session.status in (AgentStatus.COMPLETED, AgentStatus.FAILED, AgentStatus.CANCELLED):
            if session.completed_at:
                age = now - session.completed_at
                if age.total_seconds() > max_age_hours * 3600:
                    to_remove.append(session_id)

    for session_id in to_remove:
        del _active_sessions[session_id]

    return len(to_remove)


async def stream_session_output(session_id: str) -> AsyncIterator[str]:
    """Stream output from an agent session."""
    session = _active_sessions.get(session_id)
    if not session:
        return

    last_index = 0
    while session.status == AgentStatus.RUNNING:
        # Yield any new output lines
        while last_index < len(session.output_lines):
            yield session.output_lines[last_index]
            last_index += 1
        await asyncio.sleep(0.1)

    # Yield remaining lines after completion
    while last_index < len(session.output_lines):
        yield session.output_lines[last_index]
        last_index += 1


async def send_followup(
    session_id: str,
    message: str,
    working_dir: str = ".",
) -> AgentSession:
    """
    Send a follow-up message to a completed session.

    This spawns a new Claude Code process with context about the previous task.
    """
    old_session = _active_sessions.get(session_id)
    if not old_session:
        raise ValueError(f"Session {session_id} not found")

    if old_session.status != AgentStatus.COMPLETED:
        raise ValueError(f"Session must be completed to send follow-up")

    # Build follow-up prompt with context
    context_lines = old_session.output_lines[-50:]  # Last 50 lines for context
    context = "\n".join(context_lines)

    followup_prompt = f"""This is a follow-up to a previous task.

## Previous Context (last output):
{context}

## Follow-up Request:
{message}

Continue working on the task based on the above context."""

    # Spawn new session
    new_session = await spawn_claude_code(
        card_id=old_session.card_id,
        prompt=followup_prompt,
        working_dir=working_dir,
    )

    return new_session


def build_task_prompt(card: dict) -> str:
    """
    Build a prompt for Claude Code from a card.

    Args:
        card: Card data from database

    Returns:
        Formatted prompt string
    """
    parts = [f"# Task: {card.get('title', 'Untitled Task')}"]

    if card.get("description"):
        parts.append(f"\n## Description\n{card['description']}")

    if card.get("tags"):
        parts.append(f"\n## Tags\n{', '.join(card['tags'])}")

    if card.get("deadline"):
        parts.append(f"\n## Deadline\n{card['deadline']}")

    parts.append("\n## Instructions")
    parts.append("Complete this task according to the description above.")
    parts.append("Focus on clean, maintainable code and follow best practices.")

    return "\n".join(parts)
