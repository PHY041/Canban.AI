from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import boards, cards, ai
from app.api.routes import settings as settings_routes
from app.core.config import get_settings

app_settings = get_settings()
PORT = 51723  # Random high port to avoid conflicts

app = FastAPI(title="CanBan.AI", description="AI-Powered Kanban System", version="1.0.0")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for desktop app
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# Include routers
app.include_router(boards.router, prefix="/api")
app.include_router(cards.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(settings_routes.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "CanBan.AI API", "version": "1.0.0", "port": PORT}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":  # Run server when executed directly (PyInstaller)
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=PORT)
