import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

backend_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))

class Settings(BaseSettings):
    PROJECT_NAME: str = "RecoverAI API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Explicit local development / test flag
    USE_SQLITE: bool = False

    # CORS Config
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
    ]
    # Frontend Public URL (Used for generating recovery links, abandonment links, checkout redirects)
    FRONTEND_PUBLIC_URL: str = "http://localhost:3000"

    # Database
    DATABASE_URL: str = ""
    SQLITE_FALLBACK_URL: str = "sqlite:///./recoverai.db"

    # Supabase Credentials
    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWKS_URL: str = ""

    # Payment Gateway (Razorpay Test Mode)
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
        Returns the appropriate database URL based on environment.
        In production: strictly enforces PostgreSQL; raises RuntimeError if missing, placeholder, or SQLite.
        In development/testing: permits SQLite only when explicitly requested via USE_SQLITE or sqlite URL.
        """
        is_prod = str(self.ENVIRONMENT).lower() == "production"
        url = self.DATABASE_URL or ""

        if is_prod:
            if not url or url.startswith("sqlite"):
                raise RuntimeError(
                    "Production configuration error: DATABASE_URL must be a valid PostgreSQL connection string. "
                    "Silent SQLite fallback is strictly prohibited in production."
                )
            if "[YOUR-PASSWORD]" in url or "password_here" in url:
                raise RuntimeError(
                    "Production configuration error: DATABASE_URL contains placeholder password. "
                    "A valid PostgreSQL connection string is required."
                )
            return url

        # Development / Testing
        if self.USE_SQLITE or not url or "[YOUR-PASSWORD]" in url or "password_here" in url:
            return self.SQLITE_FALLBACK_URL
        return url

settings = Settings()
