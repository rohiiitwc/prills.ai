import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "PRILLS.AI Algorithmic Signal Terminal"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = Field(default="sqlite+aiosqlite:///./data/signals.db")
    
    # Timezone & Trade Entry Time Conversion
    DISPLAY_TIMEZONE: str = Field(default="Asia/Kolkata")
    
    # Global conversion offset: IST = Trade Time + 8 hours + 30 minutes
    ENTRY_TIME_OFFSET_HOURS: int = Field(default=8)
    ENTRY_TIME_OFFSET_MINUTES: int = Field(default=30)
    
    # Per-source configurable offsets (can be overridden per source if clocks differ)
    SOURCE_1_OFFSET_HOURS: int = Field(default=8)
    SOURCE_1_OFFSET_MINUTES: int = Field(default=30)
    
    SOURCE_2_OFFSET_HOURS: int = Field(default=8)
    SOURCE_2_OFFSET_MINUTES: int = Field(default=30)
    
    # Ingestion Stream API Credentials
    TELEGRAM_API_ID: int = Field(default=0)
    TELEGRAM_API_HASH: str = Field(default="")
    TELEGRAM_PHONE_NUMBER: str = Field(default="")
    TELEGRAM_SESSION_STRING: str = Field(default="")
    
    # Stream Sources
    SOURCE_1_NAME: str = "Global Forex Stream"
    SOURCE_1_LINK: str = ""
    SOURCE_1_USERNAME: str = "quotexofficialvipbot"
    SOURCE_1_CATEGORY: str = "LIVE"
    
    SOURCE_2_NAME: str = "Quotex OTC Engine"
    SOURCE_2_LINK: str = ""
    SOURCE_2_USERNAME: str = "quotex0o"
    SOURCE_2_CATEGORY: str = "OTC"
    
    # Ingestion & Latency settings
    LATENCY_THRESHOLD_SECONDS: int = 10
    LATE_SIGNAL_THRESHOLD_SECONDS: int = 30
    
    # Security
    ADMIN_API_KEY: str = Field(default="prills-admin-secret-2026")
    CORS_ORIGINS: List[str] = ["*"]
    
    # AI Learning Lab Provider Keys (Server-Side Only)
    OPENAI_API_KEY: str = Field(default="")
    GEMINI_API_KEY: str = Field(default="")
    GROQ_API_KEY: str = Field(default="")
    
    # Quotex Secure References (Server-Side Only)
    QUOTEX_LINK: str = Field(default="https://quotex.com/en/trade")
    QUOTEX_EMAIL: str = Field(default="")
    QUOTEX_PASSWORD: str = Field(default="")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
