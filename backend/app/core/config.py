import os
import json
from typing import List, Optional, Set, Union
from pydantic import field_validator
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
        "https://recover-ai-rho-steel.vercel.app",
    ]
    CORS_ORIGIN_REGEX: str = r"^https:\/\/.*\.vercel\.app$"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    return json.loads(v_stripped)
                except Exception:
                    pass
            return [x.strip() for x in v_stripped.split(",") if x.strip()]
        return v

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

    # Encryption & Webhook Configuration (Product V1)
    APP_ENCRYPTION_KEY: str = "jkDMwKjKhGqBIzlMuaA7x93oX_Wp8q02athk0R-Sivk="
    PUBLIC_API_URL: str = "http://localhost:8000"
    RUN_BACKGROUND_WORKER: bool = True

    # Email Notification Provider (Resend - Product V1)
    RESEND_API_KEY: str = ""
    RESEND_WEBHOOK_SECRET: str = ""
    EMAIL_ENABLED: bool = True
    EMAIL_FROM_ADDRESS: str = "RecoverAI <onboarding@resend.dev>"
    EMAIL_TEST_MODE: bool = False
    EMAIL_TEST_RECIPIENTS: str = ""
    EMAIL_AUTO_REDIRECT_DEMO: bool = False

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

    def get_allowed_test_recipients(self) -> set:
        """Returns normalized set of lowercased email addresses permitted in EMAIL_TEST_MODE."""
        if not self.EMAIL_TEST_RECIPIENTS:
            return set()
        return {
            email.strip().lower()
            for email in self.EMAIL_TEST_RECIPIENTS.split(",")
            if email.strip()
        }

    def get_primary_test_recipient(self) -> Optional[str]:
        """Returns the first verified test recipient email, or None if unconfigured."""
        allowed = self.get_allowed_test_recipients()
        if allowed:
            return sorted(list(allowed))[0]
        return None

settings = Settings()
