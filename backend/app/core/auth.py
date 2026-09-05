import time
import json
import uuid
import urllib.request
from typing import Optional, Dict, Any
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
            return str(member.workspace_id), member.role

        # Query all workspace memberships for user
        members = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user_id).all()
        if not members:
            # Safely place into strictly bounded default workspace (Option B architectural decision)
            default_ws = db.query(Workspace).filter(Workspace.id == DEFAULT_WORKSPACE_ID).first()
            if not default_ws:
                default_ws = Workspace(
                    id=DEFAULT_WORKSPACE_ID,
                    name="RecoverAI Demo Workspace",
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc)
                )
                db.add(default_ws)
                db.commit()

            profile = db.query(Profile).filter(Profile.id == user_id).first()
            user_role = profile.role if profile and profile.role in ("admin", "operator") else "operator"

            member = WorkspaceMember(
                id=str(uuid.uuid4()),
                workspace_id=DEFAULT_WORKSPACE_ID,
                user_id=user_id,
                role=user_role,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(member)
            db.commit()
            db.refresh(member)
            members = [member]

        if len(members) == 1:
            return str(members[0].workspace_id), members[0].role

        # User belongs to multiple workspaces but did not specify which one
        logger.info(f"[Tenant Isolation] User '{user_id}' belongs to {len(members)} workspaces. Explicit selection required.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Multiple workspace memberships found. Please specify target workspace via 'X-Workspace-Id' header."
        )
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
    Validates Supabase session token, loads authoritative role from public.profiles,
    and enforces verified workspace isolation membership.
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
            requested_ws = request.headers.get("x-workspace-id") or request.query_params.get("workspace_id")
            workspace_id, ws_role = resolve_user_workspace(
                user_id=user_id,
                requested_workspace_id=requested_ws,
                db=db
            )
            user["role"] = role
            user["profile"] = profile_data
            user["workspace_id"] = workspace_id
            user["workspace_role"] = ws_role
            return user

        # If token was explicitly provided but invalid/expired, reject with 401
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
    return str(current_user.get("workspace_id", DEFAULT_WORKSPACE_ID))

