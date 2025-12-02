from fastapi import APIRouter, HTTPException
from app.db.database import get_supabase
from app.db.models import Board, BoardCreate, BoardUpdate
from datetime import datetime, timezone

router = APIRouter(prefix="/boards", tags=["boards"])


@router.get("", response_model=list[Board])
async def list_boards():
    """List all active boards ordered by position."""
    supabase = get_supabase()
    response = supabase.table("boards").select("*").eq("is_active", True).order("position").execute()
    return response.data


@router.get("/archived", response_model=list[Board])
async def list_archived_boards():
    """List all archived (soft-deleted) boards."""
    supabase = get_supabase()
    response = supabase.table("boards").select("*").eq("is_active", False).order("position").execute()
    return response.data


@router.post("", response_model=Board)
async def create_board(board: BoardCreate):
    """Create a new board."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    data = {
        **board.model_dump(),
        "created_at": now,
        "updated_at": now,
    }
    response = supabase.table("boards").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create board")
    return response.data[0]


@router.get("/{board_id}", response_model=Board)
async def get_board(board_id: str):
    """Get a specific board by ID."""
    supabase = get_supabase()
    response = supabase.table("boards").select("*").eq("id", board_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Board not found")
    return response.data[0]


@router.put("/{board_id}", response_model=Board)
async def update_board(board_id: str, board: BoardUpdate):
    """Update a board."""
    supabase = get_supabase()
    update_data = board.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    response = (
        supabase.table("boards").update(update_data).eq("id", board_id).execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Board not found")
    return response.data[0]


@router.delete("/{board_id}")
async def delete_board(board_id: str):
    """Soft delete a board and all its cards (mark as inactive)."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("cards").update({"is_active": False, "updated_at": now}).eq("board_id", board_id).execute()
    response = supabase.table("boards").update({"is_active": False, "updated_at": now}).eq("id", board_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Board not found")
    return {"message": "Board archived successfully"}


@router.post("/{board_id}/restore", response_model=Board)
async def restore_board(board_id: str):
    """Restore a soft-deleted board and all its cards."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("cards").update({"is_active": True, "updated_at": now}).eq("board_id", board_id).execute()
    response = supabase.table("boards").update({"is_active": True, "updated_at": now}).eq("id", board_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Board not found")
    return response.data[0]
