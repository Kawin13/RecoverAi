import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

backend_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))

class Settings(BaseSettings):
    PROJECT_NAME: str = "RecoverAI API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # CORS Config
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    # Database
    DATABASE_URL: str = "sqlite:///./recoverai.db"
    SQLITE_FALLBACK_URL: str = "sqlite:///./recoverai.db"

    # Supabase Credentials
    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWKS_URL: str = ""

    # Payment Gateway
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    model_config = SettingsConfigDict(
        env_file=[backend_env, root_env, ".env"],
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    def get_effective_database_url(self) -> str:
        """
        Returns a valid database URL. If Postgres password placeholder is present or invalid,
        returns sqlite fallback for reliable local development and testing.
        """
        url = self.DATABASE_URL
        if not url or "[YOUR-PASSWORD]" in url or "password_here" in url:
            return self.SQLITE_FALLBACK_URL
        return url

settings = Settings()
