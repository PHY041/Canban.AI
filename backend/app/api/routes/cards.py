from fastapi import APIRouter, HTTPException
from app.db.database import get_supabase
from app.db.models import Card, CardCreate, CardUpdate, CardMove
from datetime import datetime, timezone

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("/board/{board_id}", response_model=list[Card])
async def list_cards_by_board(board_id: str):
    """List all active cards in a specific board."""
    supabase = get_supabase()
    response = (
        supabase.table("cards")
        .select("*")
        .eq("board_id", board_id)
        .eq("is_active", True)
        .order("position")
        .execute()
    )
    return response.data


@router.get("", response_model=list[Card])
async def list_all_cards():
    """List all active cards across all boards."""
    supabase = get_supabase()
    response = supabase.table("cards").select("*").eq("is_active", True).order("priority").execute()
    return response.data


@router.post("", response_model=Card)
async def create_card(card: CardCreate):
    """Create a new card."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Convert tags list and metadata to JSON-compatible format
    card_data = card.model_dump()
    card_data["created_at"] = now
    card_data["updated_at"] = now
    card_data["deadline"] = card_data["deadline"].isoformat() if card_data["deadline"] else None

    response = supabase.table("cards").insert(card_data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create card")
    return response.data[0]


@router.get("/{card_id}", response_model=Card)
async def get_card(card_id: str):
    """Get a specific card by ID."""
    supabase = get_supabase()
    response = supabase.table("cards").select("*").eq("id", card_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Card not found")
    return response.data[0]


@router.put("/{card_id}", response_model=Card)
async def update_card(card_id: str, card: CardUpdate):
    """Update a card."""
    supabase = get_supabase()
    update_data = card.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Handle deadline serialization
    if "deadline" in update_data and update_data["deadline"]:
        update_data["deadline"] = update_data["deadline"].isoformat()

    response = supabase.table("cards").update(update_data).eq("id", card_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Card not found")
    return response.data[0]


@router.delete("/{card_id}")
async def delete_card(card_id: str):
    """Soft delete a card (mark as inactive)."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    response = supabase.table("cards").update({"is_active": False, "updated_at": now}).eq("id", card_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"message": "Card archived successfully"}


@router.post("/{card_id}/move", response_model=Card)
async def move_card(card_id: str, move: CardMove):
    """Move a card to different status/position/board."""
    supabase = get_supabase()
    update_data = move.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    response = supabase.table("cards").update(update_data).eq("id", card_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Card not found")
    return response.data[0]


@router.post("/reorder")
async def reorder_cards(card_positions: list[dict]):
    """
    Bulk update card positions.
    Expects: [{"id": "card-id", "position": 0, "status": "todo"}, ...]
    """
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    for card_pos in card_positions:
        supabase.table("cards").update(
            {
                "position": card_pos["position"],
                "status": card_pos.get("status"),
                "updated_at": now,
            }
        ).eq("id", card_pos["id"]).execute()

    return {"message": "Cards reordered successfully"}
