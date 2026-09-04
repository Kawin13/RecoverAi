import os
import json
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.core.config import Settings
from app.core.config_validator import validate_startup_config, mask_secret, mask_db_url


def test_production_rejects_sqlite_database_url():
    """1. Enforces that production configuration strictly refuses SQLite."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        DATABASE_URL="sqlite:///./recoverai.db",
        SUPABASE_URL="https://test.supabase.co",
        SUPABASE_SECRET_KEY="test_secret",
        RAZORPAY_KEY_ID="rzp_test_valid123",
        RAZORPAY_KEY_SECRET="rzp_secret_valid123",
        RAZORPAY_WEBHOOK_SECRET="webhook_secret",
        GEMINI_API_KEY="gemini_key_valid"
    )

    # get_effective_database_url must raise RuntimeError
    with pytest.raises(RuntimeError) as exc_info:
        prod_settings.get_effective_database_url()
    assert "strictly prohibited in production" in str(exc_info.value)

    # validate_startup_config must raise RuntimeError
    with pytest.raises(RuntimeError) as exc_info2:
        validate_startup_config(prod_settings)
    assert "SQLite is strictly forbidden in production" in str(exc_info2.value)


def test_production_rejects_missing_database_url():
    """2. Enforces that missing DATABASE_URL halts production startup."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        DATABASE_URL="",
        SUPABASE_URL="https://test.supabase.co",
        SUPABASE_SECRET_KEY="test_secret",
        RAZORPAY_KEY_ID="rzp_test_valid123",
        RAZORPAY_KEY_SECRET="rzp_secret_valid123",
        RAZORPAY_WEBHOOK_SECRET="webhook_secret",
        GEMINI_API_KEY="gemini_key_valid"
    )

    with pytest.raises(RuntimeError) as exc_info:
        validate_startup_config(prod_settings)
    assert "DATABASE_URL is missing" in str(exc_info.value)


def test_production_rejects_missing_required_secrets():
    """3. Enforces that missing credentials fail production startup safely."""
    # Missing Razorpay Secret and Gemini API Key
    prod_settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        DATABASE_URL="postgresql://user:pass@db.example.com:5432/postgres",
        SUPABASE_URL="https://test.supabase.co",
        SUPABASE_SECRET_KEY="test_secret",
        RAZORPAY_KEY_ID="rzp_test_valid123",
        RAZORPAY_KEY_SECRET="",
        RAZORPAY_WEBHOOK_SECRET="webhook_secret",
        GEMINI_API_KEY=""
    )

    with pytest.raises(RuntimeError) as exc_info:
        validate_startup_config(prod_settings)
    err_msg = str(exc_info.value)
    assert "RAZORPAY_KEY_SECRET is missing" in err_msg
    assert "GEMINI_API_KEY is missing" in err_msg


def test_razorpay_test_key_format_enforced():
    """4. Ensures only Test Mode keys (rzp_test_...) are permitted for hackathon."""
    # Attempting to use a live or malformed key
    prod_settings = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        DATABASE_URL="postgresql://user:pass@db.example.com:5432/postgres",
        SUPABASE_URL="https://test.supabase.co",
        SUPABASE_SECRET_KEY="test_secret",
        RAZORPAY_KEY_ID="rzp_live_unauthorized_key",
        RAZORPAY_KEY_SECRET="rzp_secret_valid123",
        RAZORPAY_WEBHOOK_SECRET="webhook_secret",
        GEMINI_API_KEY="gemini_key_valid"
    )

    with pytest.raises(RuntimeError) as exc_info:
        validate_startup_config(prod_settings)
    assert "Only Razorpay Test Mode keys (rzp_test_...) are permitted" in str(exc_info.value)


def test_startup_validation_masks_secret_values():
    """5. Verifies that credentials and database passwords are masked and never logged raw."""
    secret = "SUPER_SECRET_RAZORPAY_KEY_XYZ998"
    masked = mask_secret(secret, prefix_len=0, suffix_len=0)
    assert masked == "[CONFIGURED - HIDDEN]"
    assert "XYZ998" not in masked
    assert "SUPER_SECRET" not in masked

    # Key with prefix
    rzp_key = "rzp_test_ABC123456789"
    masked_rzp = mask_secret(rzp_key, prefix_len=9, suffix_len=4)
    assert masked_rzp == "rzp_test_****6789"
    assert "ABC12345" not in masked_rzp

    # Database URL masking
    raw_db = "postgresql://postgres:MyVerySecretDbPassword123@db.supabase.com:5432/postgres"
    masked_db = mask_db_url(raw_db)
    assert "MyVerySecretDbPassword123" not in masked_db
    assert "postgresql://postgres:****@db.supabase.com:5432/postgres" == masked_db


def test_health_endpoint_reports_safe_config_without_secrets(client):
    """6. Verifies /health reports operational flags but exposes zero secret keys."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()

    # Required operational fields
    assert "status" in data
    assert "service" in data
    assert "version" in data
    assert "environment" in data
    assert "database" in data
    assert "razorpay_configured" in data
    assert "ai_configured" in data
    assert "ml_model_loaded" in data

    # Verify that no credentials, secrets, or raw connection strings are present
    body_text = json.dumps(data)
    assert "password" not in body_text.lower()
    assert "secret" not in body_text.lower()
    assert "token" not in body_text.lower()
    assert "key_secret" not in body_text.lower()


def test_development_allows_sqlite_when_explicitly_configured():
    """7. Verifies development mode permits SQLite when explicitly requested."""
    dev_settings = Settings(
        ENVIRONMENT="development",
        DEBUG=True,
        USE_SQLITE=True,
        DATABASE_URL="sqlite:///./test_dev.db",
        SQLITE_FALLBACK_URL="sqlite:///./test_dev.db"
    )

    url = dev_settings.get_effective_database_url()
    assert url.startswith("sqlite")

    is_valid, errors = validate_startup_config(dev_settings)
    assert is_valid is True
    assert errors == []

    # Verify that in development, missing keys do not raise RuntimeError
    unconfigured_dev = Settings(
        ENVIRONMENT="development",
        DEBUG=True,
        USE_SQLITE=True,
        DATABASE_URL="",
        SUPABASE_URL="",
        RAZORPAY_KEY_ID=""
    )
    is_valid_2, errors_2 = validate_startup_config(unconfigured_dev)
    assert is_valid_2 is False
    assert len(errors_2) > 0  # Missing keys recorded as warnings without crashing
