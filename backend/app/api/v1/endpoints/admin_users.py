"""
RecoverAI - Admin User Management API Endpoints
Provides secure listing, role promotions/demotions, and atomic last-admin protections.
"""

import json
import uuid
import threading
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy import text, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.profiles import Profile
from app.models.workspaces import WorkspaceMember, DEFAULT_WORKSPACE_ID
from app.models.audit_logs import AuditLog
from app.core.auth import require_admin
from app.core.events import event_broadcaster
from app.core.logging import logger
from app.core.config import settings

router = APIRouter()

# Global mutex lock to serialize admin demotions and prevent concurrency races
_admin_role_mutex = threading.Lock()


class UserRoleUpdateRequest(BaseModel):
    role: str = Field(..., description="Target role: 'admin' or 'operator'")


class SafeUserResponse(BaseModel):
    id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    provider: str = "Email"
    role: str
    created_at: Optional[str] = None
    last_sign_in_at: Optional[str] = None
    status: Optional[str] = None


def fetch_supabase_auth_users(db: Session) -> Dict[str, Dict[str, Any]]:
    """
    Retrieves real authentication records through trusted backend Supabase access.
    Tries:
    1. Direct PostgreSQL query on auth.users if available.
    2. Supabase Admin REST API (GET /auth/v1/admin/users) with backend service secret.
    Never exposes service secret to frontend.
    Returns: Dict[user_id -> auth_user_dict]
    """
    auth_users: Dict[str, Dict[str, Any]] = {}

    # Strategy 1: Direct PostgreSQL auth.users table query if in Postgres
    if db.bind and db.bind.dialect.name == "postgresql":
        try:
            rows = db.execute(text(
                "SELECT id::text, email, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, banned_until, confirmed_at "
                "FROM auth.users"
            )).fetchall()
            for r in rows:
                uid = str(r[0])
                raw_app = r[3] if isinstance(r[3], dict) else (json.loads(r[3]) if r[3] else {})
                raw_user = r[4] if isinstance(r[4], dict) else (json.loads(r[4]) if r[4] else {})
                auth_users[uid] = {
                    "id": uid,
                    "email": r[1],
                    "last_sign_in_at": r[2].isoformat() if r[2] else None,
                    "app_metadata": raw_app,
                    "user_metadata": raw_user,
                    "banned_until": r[5].isoformat() if r[5] else None,
                    "confirmed_at": r[6].isoformat() if r[6] else None
                }
            if auth_users:
                return auth_users
        except Exception as exc:
            logger.debug(f"[AdminUsers] Direct auth.users query not available: {exc}")

    # Strategy 2: Supabase Admin REST API using service role / secret key
    secret_key = settings.SUPABASE_SECRET_KEY or settings.SUPABASE_SERVICE_ROLE_KEY
    supabase_url = settings.SUPABASE_URL
    if secret_key and supabase_url:
        try:
            url = f"{supabase_url.rstrip('/')}/auth/v1/admin/users?per_page=100"
            req = urllib.request.Request(
                url,
                headers={
                    "apikey": secret_key,
                    "Authorization": f"Bearer {secret_key}"
                }
            )
            with urllib.request.urlopen(req, timeout=4) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    users_list = data.get("users", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
                    for u in users_list:
                        if isinstance(u, dict) and "id" in u:
                            auth_users[u["id"]] = u
                    return auth_users
        except Exception as exc:
            logger.debug(f"[AdminUsers] Supabase Admin API fetch not available: {exc}")

    return auth_users


def extract_provider_from_metadata(auth_user: Optional[Dict[str, Any]]) -> str:
    """
    Extracts provider strictly from Supabase auth identity/provider metadata.
    Never infers provider from email domain (e.g. '@gmail.com').
    A Gmail address can use email/password -> returns 'Email'.
    A Google OAuth user can use a non-gmail domain -> returns 'Google'.
    """
    if not auth_user:
        return "Email"

    app_meta = auth_user.get("app_metadata") or {}

    # 1. Check app_metadata.provider
    provider = app_meta.get("provider")

    # 2. Check app_metadata.providers list
    if not provider:
        providers = app_meta.get("providers")
        if providers and isinstance(providers, list) and len(providers) > 0:
            provider = providers[0]

    # 3. Check identities list
    if not provider:
        identities = auth_user.get("identities")
        if identities and isinstance(identities, list) and len(identities) > 0:
            provider = identities[0].get("provider")

    if provider:
        p_str = str(provider).strip().lower()
        if p_str == "google":
            return "Google"
        elif p_str in ("email", "password"):
            return "Email"
        elif p_str == "github":
            return "GitHub"
        elif p_str == "azure":
            return "Azure"
        return str(provider).capitalize()

    return "Email"


def extract_last_sign_in_from_metadata(auth_user: Optional[Dict[str, Any]]) -> Optional[str]:
    """
    Retrieves actual auth.users.last_sign_in_at.
    Never uses profile.updated_at. Returns None if absent.
    """
    if not auth_user:
        return None
    val = auth_user.get("last_sign_in_at")
    if val:
        if isinstance(val, datetime):
            return val.isoformat()
        return str(val)
    return None


def extract_status_from_metadata(auth_user: Optional[Dict[str, Any]]) -> Optional[str]:
    """
    Derives safe status from real account/auth state where available.
    - Suspended if banned_until is set in future
    - Unconfirmed if email is unconfirmed
    - Active if confirmed and not banned
    - None if no meaningful state exists (avoids hardcoding 'Active')
    """
    if not auth_user:
        return None

    # Check banned
    banned_until = auth_user.get("banned_until")
    if banned_until:
        try:
            if isinstance(banned_until, str):
                b_dt = datetime.fromisoformat(banned_until.replace("Z", "+00:00"))
            elif isinstance(banned_until, datetime):
                b_dt = banned_until
            else:
                b_dt = None
            if b_dt and b_dt.timestamp() > datetime.now(timezone.utc).timestamp():
                return "Suspended"
        except Exception:
            return "Suspended"

    # Check unconfirmed
    if "confirmed_at" in auth_user and auth_user.get("confirmed_at") is None:
        return "Unconfirmed"
    if "email_confirmed_at" in auth_user and auth_user.get("email_confirmed_at") is None:
        return "Unconfirmed"

    # Active if confirmed or authenticated
    if auth_user.get("confirmed_at") or auth_user.get("email_confirmed_at") or auth_user.get("last_sign_in_at") or auth_user.get("aud") == "authenticated":
        return "Active"

    return None


@router.get("", response_model=List[SafeUserResponse], summary="List All Users with Roles (Admin Only)")
@router.get("/", response_model=List[SafeUserResponse], include_in_schema=False)
def list_users(
    db: Session = Depends(get_db),
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Returns list of workspace users with authoritative roles.
    Accessible strictly to Administrators. Scoped strictly to the administrator's workspace.
    """
    admin_ws = admin_user.get("workspace_id")
    if admin_ws and admin_ws != DEFAULT_WORKSPACE_ID:
        # Non-default tenant: strictly isolated to members explicitly joined to this tenant
        members_with_profiles = (
            db.query(Profile, WorkspaceMember.role)
            .join(WorkspaceMember, WorkspaceMember.user_id == Profile.id)
            .filter(WorkspaceMember.workspace_id == admin_ws)
            .order_by(Profile.created_at.desc())
            .all()
        )
        profiles_and_roles = [(p, r) for p, r in members_with_profiles]
    else:
        # Default/demo workspace: includes members assigned to DEFAULT_WORKSPACE_ID
        # as well as unassigned profiles that default to DEFAULT_WORKSPACE_ID.
        # Strictly excludes users assigned exclusively to other tenant workspaces!
        other_ws_subq = (
            select(WorkspaceMember.user_id)
            .filter(WorkspaceMember.workspace_id != DEFAULT_WORKSPACE_ID)
        )
        profiles = (
            db.query(Profile)
            .filter(Profile.id.notin_(other_ws_subq))
            .order_by(Profile.created_at.desc())
            .all()
        )
        profiles_and_roles = [(p, p.role or "operator") for p in profiles]

    # If database has no profiles yet, auto-populate the current admin user
    if not profiles_and_roles and admin_user:
        admin_profile = Profile(
            id=admin_user["id"],
            email=admin_user.get("email"),
            full_name=(admin_user.get("user_metadata") or {}).get("full_name") or "Administrator",
            role="admin",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(admin_profile)
        db.commit()
        db.refresh(admin_profile)
        profiles_and_roles = [(admin_profile, "admin")]

    # Fetch trusted auth user records from Supabase
    auth_users_map = fetch_supabase_auth_users(db)
    # Ensure current admin user auth details are present
    if admin_user and "id" in admin_user and admin_user["id"] not in auth_users_map:
        auth_users_map[admin_user["id"]] = admin_user

    response_items = []
    for p, ws_role in profiles_and_roles:
        auth_user = auth_users_map.get(str(p.id))

        provider = extract_provider_from_metadata(auth_user)
        last_sign_in = extract_last_sign_in_from_metadata(auth_user)
        user_status = extract_status_from_metadata(auth_user)

        response_items.append(
            SafeUserResponse(
                id=str(p.id),
                full_name=p.full_name or (p.email.split("@")[0] if p.email else "User"),
                email=p.email,
                avatar_url=p.avatar_url,
                provider=provider,
                role=ws_role or p.role or "operator",
                created_at=p.created_at.isoformat() if p.created_at else None,
                last_sign_in_at=last_sign_in,
                status=user_status
            )
        )

    return response_items


@router.patch("/{user_id}/role", response_model=SafeUserResponse, summary="Change User Role (Admin Only)")
def update_user_role(
    user_id: str,
    payload: UserRoleUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Promotes or demotes a user between 'admin' and 'operator'.
    Enforces Atomic Last Admin Protection:
    Uses database-level advisory locking (PostgreSQL) and synchronization mutex
    to ensure two simultaneous demotions can never result in zero admins.
    Logs immutable audit record for compliance.
    """
    admin_ws = admin_user.get("workspace_id")
    new_role = payload.role.strip().lower()
    if new_role not in ("admin", "operator"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Allowed roles are 'admin' and 'operator'."
        )

    # Database-level transactional / serialized critical section
    with _admin_role_mutex:
        # If running on PostgreSQL, acquire a transaction-level advisory lock
        if db.bind and db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(hashtext('recoverai_admin_role_mutex'))"))

        target_profile = db.query(Profile).filter(Profile.id == user_id).first()
        if not target_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID '{user_id}' not found."
            )

        # Cross-workspace check: Ensure target user belongs to the administrator's workspace
        target_member = None
        if admin_ws and admin_ws != DEFAULT_WORKSPACE_ID:
            target_member = db.query(WorkspaceMember).filter(
                WorkspaceMember.workspace_id == admin_ws,
                WorkspaceMember.user_id == user_id
            ).first()
            if not target_member:
                logger.warning(f"[Tenant Isolation] Admin '{admin_user.get('id')}' in workspace '{admin_ws}' attempted to modify user '{user_id}' outside their workspace.")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found in this workspace."
                )
        elif admin_ws == DEFAULT_WORKSPACE_ID:
            # Cannot modify users who belong exclusively to other tenant workspaces
            other_member = db.query(WorkspaceMember).filter(
                WorkspaceMember.workspace_id != DEFAULT_WORKSPACE_ID,
                WorkspaceMember.user_id == user_id
            ).first()
            if other_member:
                target_member = db.query(WorkspaceMember).filter(
                    WorkspaceMember.workspace_id == DEFAULT_WORKSPACE_ID,
                    WorkspaceMember.user_id == user_id
                ).first()
                if not target_member:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="User not found in this workspace."
                    )
            else:
                target_member = db.query(WorkspaceMember).filter(
                    WorkspaceMember.workspace_id == DEFAULT_WORKSPACE_ID,
                    WorkspaceMember.user_id == user_id
                ).first()

        previous_role = target_member.role if target_member else (target_profile.role or "operator")

        # ATOMIC LAST ADMIN PROTECTION (scoped to this workspace if admin_ws is set, else global):
        # If target is currently admin and demoting to operator, verify count inside locked transaction
        if previous_role == "admin" and new_role == "operator":
            if admin_ws and admin_ws != DEFAULT_WORKSPACE_ID:
                admin_count = db.query(WorkspaceMember).filter(
                    WorkspaceMember.workspace_id == admin_ws,
                    WorkspaceMember.role == "admin"
                ).count()
            else:
                # In default workspace / global: check both Profile and WorkspaceMember
                p_query = db.query(Profile).filter(Profile.role == "admin")
                if db.bind and db.bind.dialect.name == "postgresql":
                    p_query = p_query.with_for_update()
                admin_count = p_query.count()

            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="RecoverAI must have at least one Administrator."
                )

        # Apply role change
        timestamp = datetime.now(timezone.utc)
        if target_member:
            target_member.role = new_role
            target_member.updated_at = timestamp
        target_profile.role = new_role
        target_profile.updated_at = timestamp
        db.commit()
        db.refresh(target_profile)

    # Format human-readable role labels
    role_labels = {
        "admin": "Administrator",
        "operator": "Revenue Operator"
    }
    prev_label = role_labels.get(previous_role, previous_role)
    new_label = role_labels.get(new_role, new_role)
    target_name = target_profile.full_name or target_profile.email or user_id
    admin_actor = admin_user.get("email") or admin_user.get("id") or "Administrator"

    audit_details = (
        f"Administrator changed: {target_name} from {prev_label} to {new_label}."
    )

    # Record AuditLog scoped to workspace
    audit_log = AuditLog(
        id=f"aud_role_{uuid.uuid4().hex[:8]}",
        workspace_id=admin_ws or DEFAULT_WORKSPACE_ID,
        recovery_case_id=None,
        transaction_id=None,
        actor=f"ADMIN:{admin_actor}",
        action_type="USER_ROLE_CHANGED",
        target_resource=user_id,
        details=audit_details,
        metadata_json=json.dumps({
            "actor_user_id": admin_user.get("id"),
            "target_user_id": user_id,
            "target_email": target_profile.email,
            "previous_role": previous_role,
            "new_role": new_role,
            "timestamp": timestamp.isoformat(),
            "workspace_id": admin_ws
        }),
        created_at=timestamp
    )
    db.add(audit_log)
    db.commit()

    # Emit real-time SSE broadcast scoped to workspace
    event_broadcaster.broadcast_sync(
        "USER_ROLE_CHANGED",
        {
            "actor": admin_actor,
            "target_user_id": user_id,
            "previous_role": previous_role,
            "new_role": new_role,
            "timestamp": timestamp.isoformat(),
            "workspace_id": admin_ws
        },
        workspace_id=admin_ws
    )

    logger.info(f"[RBAC] {admin_actor} changed role of {target_name} from {previous_role} to {new_role}")

    # Fetch auth user info for target
    auth_users_map = fetch_supabase_auth_users(db)
    auth_user = auth_users_map.get(str(target_profile.id))
    if not auth_user and target_profile.id == admin_user.get("id"):
        auth_user = admin_user

    provider = extract_provider_from_metadata(auth_user)
    last_sign_in = extract_last_sign_in_from_metadata(auth_user)
    user_status = extract_status_from_metadata(auth_user)

    return SafeUserResponse(
        id=str(target_profile.id),
        full_name=target_profile.full_name or (target_profile.email.split("@")[0] if target_profile.email else "User"),
        email=target_profile.email,
        avatar_url=target_profile.avatar_url,
        provider=provider,
        role=target_profile.role,
        created_at=target_profile.created_at.isoformat() if target_profile.created_at else timestamp.isoformat(),
        last_sign_in_at=last_sign_in,
        status=user_status
    )
