"""
RecoverAI Startup Configuration Validator
Enforces fail-safe production rules, prevents silent SQLite fallbacks,
validates required secrets at startup, and ensures zero secrets are leaked in logs.
"""
import os
import re
from typing import List, Tuple
from app.core.logging import logger


def mask_secret(value: str, prefix_len: int = 0, suffix_len: int = 0) -> str:
    """Safely masks sensitive credentials for audit logging without exposing secrets."""
    if not value:
        return "[NOT CONFIGURED]"
    if prefix_len == 0 and suffix_len == 0:
        return "[CONFIGURED - HIDDEN]"
    if len(value) <= prefix_len + suffix_len:
        return "[CONFIGURED - HIDDEN]"
    return f"{value[:prefix_len]}****{value[-suffix_len:]}"


def mask_db_url(url: str) -> str:
    """Masks database password in connection strings for safe logging."""
    if not url:
        return "[NOT CONFIGURED]"
    if url.startswith("sqlite"):
        return url
    # postgresql://user:password@host:port/db -> postgresql://user:****@host:port/db
    return re.sub(r":([^@/]+)@", ":****@", url)


def validate_startup_config(settings) -> Tuple[bool, List[str]]:
    """
    Validates backend configuration against fail-safe production criteria.
    In ENVIRONMENT=production, raises RuntimeError on any failure.
    In ENVIRONMENT=development, logs warnings for missing optional keys.
    """
    errors: List[str] = []
    is_prod = str(settings.ENVIRONMENT).lower() == "production"
    skip_validation = os.environ.get("TESTING") == "true" or os.environ.get("SKIP_CONFIG_VALIDATION") == "true"

    if skip_validation:
        return True, []

    # 1. DATABASE_URL Validation
    db_url = settings.DATABASE_URL or ""
    if is_prod:
        if not db_url:
            errors.append("DATABASE_URL is missing. Production database connection string is required.")
        elif db_url.startswith("sqlite"):
            errors.append(
                "DATABASE_URL is configured as SQLite ('sqlite:...'). SQLite is strictly forbidden in production."
            )
        elif "[YOUR-PASSWORD]" in db_url or "password_here" in db_url:
            errors.append("DATABASE_URL contains placeholder password. A valid PostgreSQL password is required.")
        elif not (db_url.startswith("postgresql://") or db_url.startswith("postgres://")):
            errors.append("DATABASE_URL must be a PostgreSQL connection string (postgresql://...).")
    else:
        if not db_url:
            errors.append("DATABASE_URL is not set.")

    # 2. SUPABASE_URL Validation
    supabase_url = settings.SUPABASE_URL or ""
    if is_prod and not supabase_url:
        errors.append("SUPABASE_URL is missing. Production Supabase project URL is required.")
    elif supabase_url and not (supabase_url.startswith("http://") or supabase_url.startswith("https://")):
        errors.append(f"SUPABASE_URL is invalid: '{supabase_url}'. Must be a valid HTTP/HTTPS URL.")

    # 3. SUPABASE_SECRET_KEY or SERVICE_ROLE_KEY Validation
    supabase_secret = settings.SUPABASE_SECRET_KEY or settings.SUPABASE_SERVICE_ROLE_KEY or ""
    if is_prod and not supabase_secret:
        errors.append("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing.")

    # 4. RAZORPAY_KEY_ID Validation (Must be Test Mode key rzp_test_ for Hackathon)
    rzp_key_id = settings.RAZORPAY_KEY_ID or ""
    if is_prod and not rzp_key_id:
        errors.append("RAZORPAY_KEY_ID is missing.")
    elif rzp_key_id and not rzp_key_id.startswith("rzp_test_"):
        errors.append(
            f"RAZORPAY_KEY_ID '{rzp_key_id}' is invalid. Only Razorpay Test Mode keys (rzp_test_...) are permitted for this hackathon."
        )

    # 5. RAZORPAY_KEY_SECRET Validation
    rzp_secret = settings.RAZORPAY_KEY_SECRET or ""
    if is_prod and not rzp_secret:
        errors.append("RAZORPAY_KEY_SECRET is missing.")
    elif is_prod and "placeholder" in rzp_secret.lower():
        errors.append("RAZORPAY_KEY_SECRET contains placeholder value.")

    # 6. RAZORPAY_WEBHOOK_SECRET Validation
    rzp_webhook = settings.RAZORPAY_WEBHOOK_SECRET or ""
    if is_prod and not rzp_webhook:
        errors.append("RAZORPAY_WEBHOOK_SECRET is missing.")

    # 7. GEMINI_API_KEY Validation
    gemini_key = settings.GEMINI_API_KEY or ""
    if is_prod and not gemini_key:
        errors.append("GEMINI_API_KEY is missing. Gemini LLM engine requires an authentic API key.")

    # Safe Masked Diagnostic Logging (Zero secrets exposed)
    logger.info("=== RECOVERAI CONFIGURATION DIAGNOSTICS ===")
    logger.info(f"ENVIRONMENT:             {settings.ENVIRONMENT}")
    logger.info(f"DEBUG:                   {settings.DEBUG}")
    logger.info(f"DATABASE_URL:            {mask_db_url(db_url)}")
    logger.info(f"SUPABASE_URL:            {supabase_url or '[NOT CONFIGURED]'}")
    logger.info(f"SUPABASE_SECRET_KEY:     {mask_secret(supabase_secret)}")
    logger.info(f"RAZORPAY_KEY_ID:         {mask_secret(rzp_key_id, prefix_len=9, suffix_len=4) if rzp_key_id.startswith('rzp_test_') else mask_secret(rzp_key_id)}")
    logger.info(f"RAZORPAY_KEY_SECRET:     {mask_secret(rzp_secret)}")
    logger.info(f"RAZORPAY_WEBHOOK_SECRET: {mask_secret(rzp_webhook)}")
    logger.info(f"GEMINI_API_KEY:          {mask_secret(gemini_key)}")
    logger.info("============================================")

    if errors:
        for err in errors:
            logger.error(f"[CONFIG ERROR] {err}")
        if is_prod:
            error_details = "\n".join(f"- {e}" for e in errors)
            raise RuntimeError(
                f"FATAL: RecoverAI production configuration validation failed:\n{error_details}\n"
                f"Startup aborted to prevent unsafe production operation."
            )
        return False, errors

    logger.info("RecoverAI configuration validation: PASSED")
    return True, []
