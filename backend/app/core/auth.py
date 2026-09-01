import time
import json
import urllib.request
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.core.logging import logger

security_scheme = HTTPBearer(auto_error=False)

# Local memory cache for validated Supabase tokens (token -> (user_data, expiry_timestamp))
_token_cache: Dict[str, tuple[Dict[str, Any], float]] = {}
CACHE_TTL_SECONDS = 60.0

def verify_supabase_jwt(token: str) -> Optional[Dict[str, Any]]:
    """
    Validates a Supabase JWT token against the configured Supabase Auth service.
    Caches verified tokens locally for 60 seconds to optimize latency.
    """
    now = time.time()
    if token in _token_cache:
        cached_user, expiry = _token_cache[token]
        if now < expiry:
            return cached_user
        else:
            del _token_cache[token]

    supabase_url = settings.SUPABASE_URL or "https://ikgsrrmzxmmbumcdgxgq.supabase.co"
    anon_key = settings.SUPABASE_PUBLISHABLE_KEY or "sb_publishable_biwradPEk0HjBOSaHpPXeA_NZ-8Kyhq"

    try:
        req = urllib.request.Request(
            f"{supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": anon_key
            }
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                user_data = json.loads(resp.read().decode("utf-8"))
                _token_cache[token] = (user_data, now + CACHE_TTL_SECONDS)
                return user_data
    except urllib.error.HTTPError as he:
        logger.warning(f"[Auth] Supabase token verification HTTP error: {he.code}")
    except Exception as exc:
        logger.warning(f"[Auth] Supabase token verification failed: {exc}")

    return None

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> Dict[str, Any]:
    """
    FastAPI dependency for authenticating user-facing API endpoints.
    Enforces valid Supabase session tokens while allowing safe fallback for 
    development & sandbox demo operators without breaking public demoability.
    """
    token = credentials.credentials if credentials else None
    
    if token:
        user = verify_supabase_jwt(token)
        if user:
            return user
        # If token was explicitly provided but invalid/expired, reject with 401
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Demo / Sandbox fallback:
    # If in development mode or explicit demo headers present, return safe demo operator identity
    if settings.DEBUG or settings.ENVIRONMENT == "development":
        demo_header = request.headers.get("X-RecoverAI-Demo")
        client_host = request.client.host if request.client else "127.0.0.1"
        if demo_header == "active" or client_host in ("127.0.0.1", "localhost", "testclient"):
            return {
                "id": "597289a7-e26e-415d-ab4d-fa587e32899a",
                "email": "test.ops@recoverai.io",
                "role": "authenticated",
                "user_metadata": {"full_name": "Revenue Ops Admin"}
            }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please provide a valid Supabase bearer token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> Optional[Dict[str, Any]]:
    """
    Optional authentication for endpoints that provide richer context when logged in.
    """
    if credentials and credentials.credentials:
        return verify_supabase_jwt(credentials.credentials)
    return None
