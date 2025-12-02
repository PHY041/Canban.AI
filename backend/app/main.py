from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import boards, cards, ai
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="CanBan.AI",
    description="AI-Powered Kanban System with automatic task prioritization",
    version="1.0.0",
)

# CORS middleware for frontend (includes Electron file:// origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "file://", "app://"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# Include routers
app.include_router(boards.router, prefix="/api")
app.include_router(cards.router, prefix="/api")
app.include_router(ai.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "CanBan.AI API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
