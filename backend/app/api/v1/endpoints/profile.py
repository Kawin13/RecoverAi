"""
RecoverAI - User Profile API Endpoints
Provides authenticated profile retrieval and updating for the active operator.
"""

import json
import urllib.request
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.profiles import Profile
from app.models.audit_logs import AuditLog
from app.core.auth import get_current_user
from app.core.logging import logger
from app.core.config import settings

router = APIRouter()


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255, description="Operator's display name")
    avatar_url: Optional[str] = Field(None, max_length=2048, description="Operator's profile image URL")


class SafeProfileResponse(BaseModel):
    id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _sync_supabase_auth_metadata(user_id: str, full_name: Optional[str], avatar_url: Optional[str]) -> None:
    """
    Syncs metadata back to Supabase auth.users using service role key if configured.
    Fail-safe: logs warnings if unreachable without breaking database persistence.
    """
    secret_key = settings.SUPABASE_SECRET_KEY or settings.SUPABASE_SERVICE_ROLE_KEY
    supabase_url = settings.SUPABASE_URL
    if not secret_key or not supabase_url:
        return

    try:
        url = f"{supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}"
        meta_updates: Dict[str, Any] = {}
        if full_name is not None:
            meta_updates["full_name"] = full_name
            meta_updates["name"] = full_name
        if avatar_url is not None:
            meta_updates["avatar_url"] = avatar_url
            meta_updates["picture"] = avatar_url

        payload = json.dumps({"user_metadata": meta_updates}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            method="PUT",
            headers={
                "apikey": secret_key,
                "Authorization": f"Bearer {secret_key}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status in (200, 204):
                logger.info(f"[Profile] Synchronized Supabase auth metadata for user {user_id}")
    except Exception as exc:
        logger.warning(f"[Profile] Notice: Supabase auth metadata sync skipped or failed: {exc}")


@router.get("/me", response_model=SafeProfileResponse, summary="Get Current Operator Profile")
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves the authoritative profile record for the authenticated user.
    """
    user_id = current_user.get("id")
    profile = db.query(Profile).filter(Profile.id == user_id).first()

    if not profile:
        email = current_user.get("email") or ""
        meta = current_user.get("user_metadata") or {}
        return SafeProfileResponse(
            id=str(user_id),
            full_name=meta.get("full_name") or (email.split("@")[0] if email else "User"),
            email=email,
            avatar_url=meta.get("avatar_url"),
            role=current_user.get("role", "operator"),
            created_at=None,
            updated_at=None
        )

    return SafeProfileResponse(
        id=str(profile.id),
        full_name=profile.full_name,
        email=profile.email,
        avatar_url=profile.avatar_url,
        role=profile.role,
        created_at=profile.created_at.isoformat() if profile.created_at else None,
        updated_at=profile.updated_at.isoformat() if profile.updated_at else None
    )


@router.patch("/me", response_model=SafeProfileResponse, summary="Update Current Operator Profile")
def update_my_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Updates the authenticated operator's display name and/or avatar URL.
    Persists atomically to PostgreSQL public.profiles and syncs auth metadata.
    """
    user_id = current_user.get("id")
    profile = db.query(Profile).filter(Profile.id == user_id).first()

    now = datetime.now(timezone.utc)

    if not profile:
        email = current_user.get("email") or ""
        profile = Profile(
            id=user_id,
            email=email,
            full_name=payload.full_name.strip() if payload.full_name else (email.split("@")[0] if email else "User"),
            avatar_url=payload.avatar_url.strip() if payload.avatar_url else None,
            role=current_user.get("role", "operator"),
            created_at=now,
            updated_at=now
        )
        db.add(profile)
    else:
        if payload.full_name is not None:
            clean_name = payload.full_name.strip()
            if not clean_name:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Full name cannot be empty.")
            profile.full_name = clean_name
        
        if payload.avatar_url is not None:
            clean_avatar = payload.avatar_url.strip()
            profile.avatar_url = clean_avatar if clean_avatar else None

        profile.updated_at = now

    try:
        db.commit()
        db.refresh(profile)
    except Exception as exc:
        db.rollback()
        logger.error(f"[Profile] Failed to persist profile update: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist profile changes to database."
        )

    # Sync metadata to Supabase Auth asynchronously / safely
    _sync_supabase_auth_metadata(str(user_id), profile.full_name, profile.avatar_url)

    # Audit Trail Entry
    try:
        audit = AuditLog(
            action="USER_PROFILE_UPDATED",
            entity_type="profile",
            entity_id=str(profile.id),
            actor_id=str(user_id),
            details={
                "full_name": profile.full_name,
                "avatar_url": profile.avatar_url,
                "role": profile.role,
                "workspace_id": current_user.get("workspace_id")
            }
        )
        db.add(audit)
        db.commit()
    except Exception as audit_err:
        logger.warning(f"[Profile] Audit log recording notice: {audit_err}")

    return SafeProfileResponse(
        id=str(profile.id),
        full_name=profile.full_name,
        email=profile.email,
        avatar_url=profile.avatar_url,
        role=profile.role,
        created_at=profile.created_at.isoformat() if profile.created_at else None,
        updated_at=profile.updated_at.isoformat() if profile.updated_at else None
    )
