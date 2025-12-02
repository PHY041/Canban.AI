from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path
import os

def get_env_file(): # Find .env in order: local, home dir, or none
    candidates = [Path(".env"), Path.home() / ".canban-ai" / ".env"]
    for p in candidates:
        if p.exists(): return str(p)
    return None

class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    openai_api_key: str = ""
    debug: bool = True
    app_name: str = "CanBan.AI"
    class Config:
        env_file = get_env_file()
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings() -> Settings: return Settings()
