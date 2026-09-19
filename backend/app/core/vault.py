import base64
import hashlib
import secrets
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings
from app.core.logging import logger

def _get_fernet() -> Fernet:
    raw_key = settings.APP_ENCRYPTION_KEY or ""
    # Ensure key is valid 32 url-safe base64 bytes
    try:
        # If raw_key is already a valid Fernet key
        return Fernet(raw_key.encode("utf-8"))
    except Exception:
        # Derive a 32-byte key deterministically using SHA-256 if arbitrary string was provided
        derived = base64.urlsafe_b64encode(hashlib.sha256(raw_key.encode("utf-8")).digest())
        return Fernet(derived)

def encrypt_secret(plaintext: Optional[str]) -> Optional[str]:
    """Encrypts a sensitive merchant credential (e.g. key_secret, webhook_secret)."""
    if not plaintext:
        return None
    try:
        f = _get_fernet()
        encrypted = f.encrypt(plaintext.encode("utf-8"))
        return encrypted.decode("utf-8")
    except Exception as exc:
        logger.error("[Vault] Encryption failed for secret payload.")
        raise RuntimeError("Secret encryption failed.") from None

def decrypt_secret(ciphertext: Optional[str]) -> Optional[str]:
    """Decrypts a sensitive merchant credential. Never log or return the decrypted value."""
    if not ciphertext:
        return None
    try:
        f = _get_fernet()
        decrypted = f.decrypt(ciphertext.encode("utf-8"))
        return decrypted.decode("utf-8")
    except InvalidToken:
        logger.error("[Vault] Decryption failed: invalid encryption token or mismatched key.")
        raise RuntimeError("Secret decryption failed: invalid token.") from None
    except Exception as exc:
        logger.error("[Vault] Decryption error occurred.")
        raise RuntimeError("Secret decryption failed.") from None

def mask_key_id(key_id: Optional[str]) -> str:
    """Masks a public key ID for safe UI display (e.g., rzp_test_••••••••1234)."""
    if not key_id:
        return ""
    prefix = "rzp_test_" if key_id.startswith("rzp_test_") else key_id[:8]
    if len(key_id) <= 12:
        return f"{prefix}••••"
    return f"{prefix}••••••••{key_id[-4:]}"

def generate_opaque_webhook_id() -> str:
    """Generates an unguessable opaque webhook identifier for per-merchant endpoints."""
    return f"wh_{secrets.token_urlsafe(18)}"
