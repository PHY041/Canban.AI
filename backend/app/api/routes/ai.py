from fastapi import APIRouter, HTTPException
from app.db.models import (
    AIPrioritizeRequest,
    AIPrioritizeResponse,
    AISuggestRequest,
    AISuggestResponse,
    DailyBriefing,
    ExtractTasksRequest,
    ExtractTasksResponse,
    CreateExtractedTasksRequest,
    CreateExtractedTasksResponse,
)
from app.services.ai_priority import (
    prioritize_cards,
    get_card_suggestions,
    generate_daily_briefing,
    extract_tasks_from_text,
    create_extracted_tasks,
)
from app.db.database import get_supabase

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/prioritize", response_model=AIPrioritizeResponse)
async def trigger_prioritization(request: AIPrioritizeRequest):
    """Trigger AI prioritization for cards."""
    try:
        result = await prioritize_cards(request.board_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suggest", response_model=AISuggestResponse)
async def get_suggestions(request: AISuggestRequest):
    """Get AI suggestions for a specific card."""
    try:
        result = await get_card_suggestions(request.card_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/daily-briefing", response_model=DailyBriefing)
async def get_daily_briefing():
    """Generate AI-powered daily briefing."""
    try:
        result = await generate_daily_briefing()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-tasks", response_model=ExtractTasksResponse)
async def extract_tasks(request: ExtractTasksRequest):
    """Extract tasks from pasted text using AI."""
    try:
        supabase = get_supabase()
        board = supabase.table("boards").select("name").eq("id", request.board_id).execute()
        board_name = board.data[0]["name"] if board.data else "Unknown"
        result = await extract_tasks_from_text(request.text, request.board_id, board_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-extracted-tasks", response_model=CreateExtractedTasksResponse)
async def create_tasks_from_extraction(request: CreateExtractedTasksRequest):
    """Create cards from extracted tasks."""
    try:
        result = await create_extracted_tasks([t.model_dump() for t in request.tasks])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
