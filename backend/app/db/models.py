from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class CardStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


# Board Models
class BoardBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#6366f1"  # Default indigo
    position: Optional[int] = 0
    repo_path: Optional[str] = None  # Git repository path for agent context


class BoardCreate(BoardBase):
    pass


class BoardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    position: Optional[int] = None
    repo_path: Optional[str] = None


class Board(BoardBase):
    id: str
    created_at: datetime
    updated_at: datetime
    is_active: Optional[bool] = True

    class Config:
        from_attributes = True


# Card Models
class CardBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: CardStatus = CardStatus.TODO
    priority: Optional[int] = Field(default=3, ge=1, le=5)
    priority_reason: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    deadline: Optional[datetime] = None
    position: Optional[int] = 0
    tags: Optional[list[str]] = []
    metadata: Optional[dict] = {}
    repo_path: Optional[str] = None  # Override board's repo_path for this specific task


class CardCreate(CardBase):
    board_id: str


class CardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CardStatus] = None
    priority: Optional[int] = Field(default=None, ge=1, le=5)
    priority_reason: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    deadline: Optional[datetime] = None
    position: Optional[int] = None
    tags: Optional[list[str]] = None
    metadata: Optional[dict] = None
    board_id: Optional[str] = None
    repo_path: Optional[str] = None


class Card(CardBase):
    id: str
    board_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CardMove(BaseModel):
    status: Optional[CardStatus] = None
    position: Optional[int] = None
    board_id: Optional[str] = None


# Activity Log Models
class ActivityType(str, Enum):
    SCREEN_TIME = "screen_time"
    STATUS_CHANGE = "status_change"
    EDIT = "edit"
    PRIORITY_CHANGE = "priority_change"


class ActivityLogCreate(BaseModel):
    card_id: str
    activity_type: ActivityType
    duration_minutes: Optional[int] = None
    context: Optional[str] = None


class ActivityLog(ActivityLogCreate):
    id: str
    timestamp: datetime

    class Config:
        from_attributes = True


# Priority History Models
class PriorityHistory(BaseModel):
    id: str
    card_id: str
    old_priority: Optional[int]
    new_priority: int
    reasoning: str
    model_used: str
    timestamp: datetime

    class Config:
        from_attributes = True


# AI Models
class AIPrioritizeRequest(BaseModel):
    board_id: Optional[str] = None  # If None, prioritize all boards


class AIPrioritizeResponse(BaseModel):
    cards_updated: int
    priorities: list[dict]


class AISuggestRequest(BaseModel):
    card_id: str


class AISuggestResponse(BaseModel):
    suggestions: list[str]
    reasoning: str


class ExtractedTask(BaseModel):  # Single extracted task from AI
    title: str
    description: Optional[str] = None
    deadline: Optional[str] = None
    priority: int = 3
    estimated_hours: Optional[float] = None
    tags: list[str] = []
    board_id: Optional[str] = None
    suggested_board_name: Optional[str] = None  # For NEW_BOARD tasks
    status: str = "todo"
    position: int = 0


class BoardInfo(BaseModel):  # Board info for smart extraction
    id: str
    name: str
    description: Optional[str] = None


class ExtractTasksRequest(BaseModel):  # Request to extract tasks from text (board-agnostic)
    text: str
    boards: list[BoardInfo]  # All available boards for AI to choose from


class SuggestedBoard(BaseModel):  # Suggested new board from AI
    name: str
    reason: str
    task_indices: list[int]  # Which tasks should go to this board


class ExtractTasksResponse(BaseModel):  # Response with extracted tasks
    tasks: list[ExtractedTask]
    summary: str
    suggested_new_boards: list[SuggestedBoard] = []  # AI-suggested new boards


class CreateExtractedTasksRequest(BaseModel): # Request to create extracted tasks
    tasks: list[ExtractedTask]


class CreateExtractedTasksResponse(BaseModel): # Response after creating tasks
    created_count: int
    cards: list[dict]


class DailyBriefing(BaseModel):
    date: str
    high_priority_tasks: list[dict]
    overdue_tasks: list[dict]
    suggestions: list[str]
    summary: str
