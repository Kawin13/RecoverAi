import os
import time
import json
import base64
import threading
import collections
from typing import Optional, Dict, Any
import httpx
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.logging import logger
from app.database.session import SessionLocal, get_db
from app.models.profiles import Profile
from app.models.workspaces import Workspace, WorkspaceMember, DEFAULT_WORKSPACE_ID


security_scheme = HTTPBearer(auto_error=False)

# Persistent keep-alive HTTP client for Supabase Auth verification (eliminates repeated TLS handshakes)
_supabase_http_client = httpx.Client(
    timeout=5.0,
    limits=httpx.Limits(max_connections=64, max_keepalive_connections=20, keepalive_expiry=60.0),
)

# Bounded LRU+TTL caches for validated Supabase tokens and short-lived user context
_cache_lock = threading.Lock()
_token_cache: "collections.OrderedDict[str, tuple[Dict[str, Any], float]]" = collections.OrderedDict()
_inflight_token_locks: Dict[str, threading.Lock] = {}
_profile_cache: "collections.OrderedDict[str, tuple[tuple[str, Dict[str, Any]], float]]" = collections.OrderedDict()
_workspace_cache: "collections.OrderedDict[tuple[str, Optional[str]], tuple[tuple[str, str], float]]" = collections.OrderedDict()

MAX_CACHE_ENTRIES = 2048
CACHE_TTL_SECONDS = 120.0
USER_CONTEXT_TTL_SECONDS = 15.0


def _is_testing() -> bool:
    return bool(os.environ.get("PYTEST_CURRENT_TEST"))


def _lru_get(cache: "collections.OrderedDict", key: Any, now: float):
    with _cache_lock:
        item = cache.get(key)
        if item is None:
            return None
        val, expiry = item
        if now < expiry:
            cache.move_to_end(key)
            return val
        cache.pop(key, None)
        return None


def _lru_set(cache: "collections.OrderedDict", key: Any, val: Any, expiry: float):
    with _cache_lock:
        cache[key] = (val, expiry)
        cache.move_to_end(key)
        while len(cache) > MAX_CACHE_ENTRIES:
            cache.popitem(last=False)


def invalidate_user_auth_cache(user_id: Optional[str] = None) -> None:
    """Clears cached profile/workspace entries for a user (or all users if None) after mutations."""
    with _cache_lock:
        if user_id is None:
            _profile_cache.clear()
            _workspace_cache.clear()
            return
        _profile_cache.pop(str(user_id), None)
        for k in [key for key in _workspace_cache if key[0] == str(user_id)]:
            _workspace_cache.pop(k, None)


def _extract_unverified_jwt_exp(token: str) -> Optional[float]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
        exp = payload.get("exp")
        return float(exp) if exp is not None else None
    except Exception:
        return None


def verify_supabase_jwt(token: str) -> Optional[Dict[str, Any]]:
    """
    Validates a Supabase JWT token against the configured Supabase Auth service.
    Uses keep-alive connection pooling, bounded LRU caching (bounded by JWT exp),
    and per-token single-flight locking to prevent auth stampedes under heavy traffic.
    """
    now = time.time()
    cached = _lru_get(_token_cache, token, now)
    if cached is not None:
        return cached

    with _cache_lock:
        token_lock = _inflight_token_locks.setdefault(token, threading.Lock())

    with token_lock:
        try:
            now = time.time()
            cached = _lru_get(_token_cache, token, now)
            if cached is not None:
                return cached

            supabase_url = settings.SUPABASE_URL or "https://ikgsrrmzxmmbumcdgxgq.supabase.co"
            anon_key = settings.SUPABASE_PUBLISHABLE_KEY or "sb_publishable_biwradPEk0HjBOSaHpPXeA_NZ-8Kyhq"

            resp = _supabase_http_client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": anon_key
                }
            )
            if resp.status_code == 200:
                user_data = resp.json()
                jwt_exp = _extract_unverified_jwt_exp(token)
                ttl = CACHE_TTL_SECONDS
                if jwt_exp is not None:
                    ttl = max(1.0, min(CACHE_TTL_SECONDS, jwt_exp - now))
                _lru_set(_token_cache, token, user_data, now + ttl)
                return user_data
            logger.warning(f"[Auth] Supabase token verification HTTP error: {resp.status_code}")
        except Exception as exc:
            logger.warning(f"[Auth] Supabase token verification failed: {exc}")
        finally:
            with _cache_lock:
                _inflight_token_locks.pop(token, None)

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
    use_cache = not _is_testing()
    if use_cache:
        cached_prof = _lru_get(_profile_cache, str(user_id), time.time())
        if cached_prof is not None:
            return cached_prof

    owns_db = False
    if db is None:
        db = SessionLocal()
        owns_db = True

    try:
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        if not profile:
            # New users default strictly to 'operator'. The authoritative source is public.profiles.role.
            role_to_assign = "operator"
            profile = Profile(
                id=user_id,
                email=email,
                full_name=full_name or (email.split("@")[0] if email else "RecoverAI User"),
                avatar_url=avatar_url,
                role=role_to_assign,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)

        result = (
            profile.role,
            {
                "id": profile.id,
                "email": profile.email,
                "full_name": profile.full_name,
                "avatar_url": profile.avatar_url,
                "role": profile.role,
                "created_at": profile.created_at.isoformat() if profile.created_at else None,
                "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
            },
        )
        if use_cache:
            _lru_set(_profile_cache, str(user_id), result, time.time() + USER_CONTEXT_TTL_SECONDS)
        return result
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

def resolve_user_workspace(
    user_id: str,
    requested_workspace_id: Optional[str] = None,
    db: Optional[Session] = None
) -> tuple[str, str]:
    """
    Resolves authoritative workspace membership for the user.
    If requested_workspace_id is specified: verifies the user belongs to it;
    raises 403 Forbidden if not.
    If requested_workspace_id is None:
        - If user belongs to exactly 1 workspace: returns that workspace and role.
        - If user belongs to 0 workspaces: raises 403 Forbidden (no silent auto-enrollment).
        - If user belongs to >1 workspaces: raises 400 Bad Request requiring explicit X-Workspace-Id.
    Returns: (workspace_id, member_role)
    """
    cache_key = (str(user_id), str(requested_workspace_id) if requested_workspace_id else None)
    use_cache = not _is_testing()
    if use_cache:
        cached_ws = _lru_get(_workspace_cache, cache_key, time.time())
        if cached_ws is not None:
            return cached_ws

    owns_db = False
    if db is None:
        db = SessionLocal()
        owns_db = True

    try:
        if requested_workspace_id:
            member = db.query(WorkspaceMember).filter(
                WorkspaceMember.workspace_id == requested_workspace_id,
                WorkspaceMember.user_id == user_id
            ).first()
            if not member:
                logger.warning(f"[Tenant Isolation] Access denied: User '{user_id}' requested workspace '{requested_workspace_id}' but is not a member.")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not belong to the requested workspace."
                )
            res = (str(member.workspace_id), member.role)
            if use_cache:
                _lru_set(_workspace_cache, cache_key, res, time.time() + USER_CONTEXT_TTL_SECONDS)
            return res

        # Query all workspace memberships for user
        members = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user_id).all()
        if not members:
            logger.info(f"[Tenant Isolation] User '{user_id}' has 0 workspace memberships. Onboarding required.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="NO_WORKSPACE_MEMBERSHIP"
            )

        if len(members) == 1:
            res = (str(members[0].workspace_id), members[0].role)
            if use_cache:
                _lru_set(_workspace_cache, cache_key, res, time.time() + USER_CONTEXT_TTL_SECONDS)
            return res

        if len(members) > 1:
            logger.warning(f"[Tenant Isolation] User '{user_id}' has {len(members)} workspaces. Explicit X-Workspace-Id required.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multiple workspace memberships found. Please specify target workspace via 'X-Workspace-Id' header."
            )
    finally:
        if owns_db:
            db.close()

async def get_authenticated_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Dependency that authenticates the user via Supabase session without requiring
    pre-existing workspace membership. Used for onboarding and workspace creation.
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

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please provide a valid Supabase bearer token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    FastAPI dependency for authenticating user-facing API endpoints.
    Validates Supabase session token, loads profile, and enforces verified
    active workspace membership.
    """
    user = await get_authenticated_user(request=request, credentials=credentials, db=db)
    requested_ws = (
        request.headers.get("x-workspace-id")
        or request.query_params.get("workspace_id")
        or request.path_params.get("workspace_id")
    )
    workspace_id, ws_role = resolve_user_workspace(
        user_id=user["id"],
        requested_workspace_id=requested_ws,
        db=db
    )
    user["workspace_id"] = workspace_id
    user["workspace_role"] = ws_role
    return user


async def require_admin(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Enforces that the authenticated user possesses the 'admin' role
    specifically within the ACTIVE workspace (workspace_members.role).
    Returns 403 Forbidden otherwise.
    """
    ws_role = current_user.get("workspace_role")
    if ws_role != "admin":
        logger.warning(f"[RBAC] Access denied: User '{current_user.get('email')}' has workspace role '{ws_role}', requires 'admin'.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace Administrator privileges required. Permission denied."
        )
    return current_user

async def require_operator_or_admin(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Enforces that the authenticated user has either 'admin' or 'operator' role
    in the ACTIVE workspace.
    """
    ws_role = current_user.get("workspace_role")
    if ws_role not in ("admin", "operator"):
        logger.warning(f"[RBAC] Access denied: User '{current_user.get('email')}' has unauthorized workspace role '{ws_role}'.")
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
            requested_ws = request.headers.get("x-workspace-id") or request.query_params.get("workspace_id")
            try:
                workspace_id, ws_role = resolve_user_workspace(
                    user_id=user.get("id"),
                    requested_workspace_id=requested_ws
                )
                user["workspace_id"] = workspace_id
                user["workspace_role"] = ws_role
            except HTTPException:
                pass
            user["role"] = role
            user["profile"] = profile_data
            return user
    return None

def get_current_workspace_id(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> str:
    """Helper dependency to extract current verified workspace_id."""
    ws_id = current_user.get("workspace_id")
    if not ws_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active workspace required."
        )
    return str(ws_id)

