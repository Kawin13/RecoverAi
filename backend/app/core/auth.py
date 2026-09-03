import time
import json
import urllib.request
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.logging import logger
from app.database.session import SessionLocal, get_db
from app.models.profiles import Profile


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

def resolve_authoritative_role(
    user_id: str,
    email: str,
    full_name: Optional[str] = None,
    avatar_url: Optional[str] = None,
    db: Optional[Session] = None
) -> tuple[str, Dict[str, Any]]:
    """
    Retrieves the authoritative role strictly from public.profiles in PostgreSQL / database.
    If the profile does not exist yet, creates an 'operator' profile automatically.
    """
    owns_db = False
    if db is None:
        db = SessionLocal()
        owns_db = True

    try:
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        if not profile:
            # Designated initial system admin for demo / test environment
            role_to_assign = "admin" if (user_id == "597289a7-e26e-415d-ab4d-fa587e32899a" or email == "test.ops@recoverai.io") else "operator"
            profile = Profile(
                id=user_id,
                email=email,
                full_name=full_name or (email.split("@")[0] if email else "RecoverAI User"),
                avatar_url=avatar_url,
                role=role_to_assign,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)

        
        return profile.role, {
            "id": profile.id,
            "email": profile.email,
            "full_name": profile.full_name,
            "avatar_url": profile.avatar_url,
            "role": profile.role,
            "created_at": profile.created_at.isoformat() if profile.created_at else None,
            "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
        }
    except Exception as exc:
        logger.error(f"[Auth] Error resolving authoritative profile role: {exc}")
        if owns_db:
            db.rollback()
        return "operator", {
            "id": user_id,
            "email": email,
            "full_name": full_name or (email.split("@")[0] if email else "RecoverAI User"),
            "avatar_url": avatar_url,
            "role": "operator"
        }
    finally:
        if owns_db:
            db.close()

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    FastAPI dependency for authenticating user-facing API endpoints.
    Validates Supabase session token and loads authoritative role from public.profiles.
    """
    token = credentials.credentials if credentials else None
    
    if token:
        user = verify_supabase_jwt(token)
        if user:
            user_id = user.get("id")
            email = user.get("email") or ""
            metadata = user.get("user_metadata") or {}
            full_name = metadata.get("full_name") or metadata.get("name")
            avatar_url = metadata.get("avatar_url") or metadata.get("picture")

            role, profile_data = resolve_authoritative_role(
                user_id=user_id,
                email=email,
                full_name=full_name,
                avatar_url=avatar_url,
                db=db
            )
            user["role"] = role
            user["profile"] = profile_data
            return user

        # If token was explicitly provided but invalid/expired, reject with 401
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Sandbox / Demo fallback for local development & headless tests
    if settings.DEBUG or settings.ENVIRONMENT == "development":
        demo_header = request.headers.get("X-RecoverAI-Demo")
        client_host = request.client.host if request.client else "127.0.0.1"
        if demo_header == "active" or client_host in ("127.0.0.1", "localhost", "testclient"):
            demo_user_id = "597289a7-e26e-415d-ab4d-fa587e32899a"
            demo_email = "test.ops@recoverai.io"
            role, profile_data = resolve_authoritative_role(
                user_id=demo_user_id,
                email=demo_email,
                full_name="Revenue Ops Admin",
                avatar_url=None,
                db=db
            )
            return {
                "id": demo_user_id,
                "email": demo_email,
                "role": role,
                "profile": profile_data,
                "user_metadata": {"full_name": "Revenue Ops Admin"}
            }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please provide a valid Supabase bearer token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def require_admin(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Enforces that the authenticated user possesses the authoritative 'admin' role in public.profiles.
    Returns 403 Forbidden otherwise.
    """
    user_role = current_user.get("role")
    if user_role != "admin":
        logger.warning(f"[RBAC] Access denied: User '{current_user.get('email')}' has role '{user_role}', requires 'admin'.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required. Permission denied."
        )
    return current_user

async def require_operator_or_admin(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Enforces that the authenticated user has either 'admin' or 'operator' role.
    """
    user_role = current_user.get("role")
    if user_role not in ("admin", "operator"):
        logger.warning(f"[RBAC] Access denied: User '{current_user.get('email')}' has unauthorized role '{user_role}'.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operational access required. Permission denied."
        )
    return current_user

async def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> Optional[Dict[str, Any]]:
    """
    Optional authentication for endpoints that provide richer context when logged in.
    """
    if credentials and credentials.credentials:
        user = verify_supabase_jwt(credentials.credentials)
        if user:
            role, profile_data = resolve_authoritative_role(
                user_id=user.get("id"),
                email=user.get("email") or "",
                full_name=(user.get("user_metadata") or {}).get("full_name"),
                avatar_url=(user.get("user_metadata") or {}).get("avatar_url")
            )
            user["role"] = role
            user["profile"] = profile_data
            return user
    return None

