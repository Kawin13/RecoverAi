"""
RecoverAI - Admin User Management API Endpoints
Provides secure listing, role promotions/demotions, and last-admin protections.
"""

import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.profiles import Profile
from app.models.audit_logs import AuditLog
from app.core.auth import require_admin
from app.core.events import event_broadcaster
from app.core.logging import logger

router = APIRouter()

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
    status: str = "Active"

@router.get("", response_model=List[SafeUserResponse], summary="List All Users with Roles (Admin Only)")
@router.get("/", response_model=List[SafeUserResponse], include_in_schema=False)
def list_users(
    db: Session = Depends(get_db),
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Returns list of workspace users with authoritative roles.
    Accessible strictly to Administrators. Returns only browser-safe attributes.
    """
    profiles = db.query(Profile).order_by(Profile.created_at.desc()).all()
    
    # If database has no profiles yet, auto-populate the current admin user
    if not profiles and admin_user:
        admin_profile = Profile(
            id=admin_user["id"],
            email=admin_user.get("email"),
            full_name=(admin_user.get("user_metadata") or {}).get("full_name") or "Administrator",
            role="admin",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(admin_profile)
        db.commit()
        db.refresh(admin_profile)
        profiles = [admin_profile]

    response_items = []
    for p in profiles:
        # Determine authentication provider indicator
        provider = "Email"
        if p.email and ("gmail.com" in p.email.lower() or "google" in (p.avatar_url or "").lower()):
            provider = "Google"

        response_items.append(
            SafeUserResponse(
                id=p.id,
                full_name=p.full_name or (p.email.split("@")[0] if p.email else "User"),
                email=p.email,
                avatar_url=p.avatar_url,
                provider=provider,
                role=p.role or "operator",
                created_at=p.created_at.isoformat() if p.created_at else datetime.utcnow().isoformat(),
                last_sign_in_at=p.updated_at.isoformat() if p.updated_at else datetime.utcnow().isoformat(),
                status="Active"
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
    Enforces Last Admin Protection: Rejects demotion if only one administrator remains.
    Logs immutable audit record for compliance.
    """
    new_role = payload.role.strip().lower()
    if new_role not in ("admin", "operator"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Allowed roles are 'admin' and 'operator'."
        )

    target_profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not target_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found."
        )

    previous_role = target_profile.role or "operator"

    # LAST ADMIN PROTECTION:
    # If the target is an admin and is being demoted to operator, verify that another admin exists.
    if previous_role == "admin" and new_role == "operator":
        admin_count = db.query(Profile).filter(Profile.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="RecoverAI must have at least one Administrator."
            )

    # Apply role change
    timestamp = datetime.utcnow()
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

    # Record AuditLog
    audit_log = AuditLog(
        id=f"aud_role_{uuid.uuid4().hex[:8]}",
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
            "timestamp": timestamp.isoformat()
        }),
        created_at=timestamp
    )
    db.add(audit_log)
    db.commit()

    # Emit real-time SSE broadcast
    event_broadcaster.broadcast_sync("USER_ROLE_CHANGED", {
        "actor": admin_actor,
        "target_user_id": user_id,
        "previous_role": previous_role,
        "new_role": new_role,
        "timestamp": timestamp.isoformat()
    })

    logger.info(f"[RBAC] {admin_actor} changed role of {target_name} from {previous_role} to {new_role}")

    provider = "Email"
    if target_profile.email and ("gmail.com" in target_profile.email.lower() or "google" in (target_profile.avatar_url or "").lower()):
        provider = "Google"

    return SafeUserResponse(
        id=target_profile.id,
        full_name=target_profile.full_name or (target_profile.email.split("@")[0] if target_profile.email else "User"),
        email=target_profile.email,
        avatar_url=target_profile.avatar_url,
        provider=provider,
        role=target_profile.role,
        created_at=target_profile.created_at.isoformat() if target_profile.created_at else timestamp.isoformat(),
        last_sign_in_at=target_profile.updated_at.isoformat() if target_profile.updated_at else timestamp.isoformat(),
        status="Active"
    )
