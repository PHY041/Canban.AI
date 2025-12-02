from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
import os

router = APIRouter(prefix="/settings", tags=["settings"])
CONFIG_DIR = Path.home() / ".canban-ai"
CONFIG_FILE = CONFIG_DIR / ".env"

class SettingsRequest(BaseModel): # API keys from frontend
    supabase_url: str = ""
    supabase_key: str = ""
    openai_api_key: str = ""

class SettingsResponse(BaseModel):
    supabase_url: str = ""
    supabase_key: str = ""
    openai_api_key: str = ""
    saved: bool = False

@router.get("", response_model=SettingsResponse)
async def get_settings():
    """Load settings from ~/.canban-ai/.env"""
    settings = {"supabase_url": "", "supabase_key": "", "openai_api_key": "", "saved": False}
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        key, val = line.split("=", 1)
                        key = key.strip().lower()
                        val = val.strip().strip('"').strip("'")
                        if key == "supabase_url": settings["supabase_url"] = val
                        elif key == "supabase_key": settings["supabase_key"] = val
                        elif key == "openai_api_key": settings["openai_api_key"] = val
            settings["saved"] = True
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read config: {e}")
    return settings

@router.post("", response_model=SettingsResponse)
async def save_settings(request: SettingsRequest):
    """Save settings to ~/.canban-ai/.env"""
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        env_content = f"""# CanBan.AI Configuration
SUPABASE_URL={request.supabase_url}
SUPABASE_KEY={request.supabase_key}
OPENAI_API_KEY={request.openai_api_key}
"""
        with open(CONFIG_FILE, "w") as f:
            f.write(env_content)
        return SettingsResponse(supabase_url=request.supabase_url, supabase_key=request.supabase_key, openai_api_key=request.openai_api_key, saved=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save config: {e}")

