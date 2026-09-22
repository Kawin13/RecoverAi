import uuid
import secrets
import hashlib
import urllib.request
import base64
import json
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.core.datetime_utils import utcnow
from app.core.logging import logger
from app.core.config import settings
from app.core.vault import encrypt_secret, decrypt_secret, mask_key_id, generate_opaque_webhook_id
from app.models.workspaces import Workspace, WorkspaceMember
from app.models.workspace_settings import WorkspaceSettings
from app.models.workspace_integrations import WorkspaceIntegration
from app.models.workspace_invitations import WorkspaceInvitation
from app.models.profiles import Profile

def create_workspace(
    user_id: str,
    name: str,
    db: Session,
    business_type: Optional[str] = "SAAS",
    timezone: Optional[str] = "Asia/Kolkata",
    currency: Optional[str] = "INR"
) -> Dict[str, Any]:
    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workspace name cannot be empty."
        )

    now = utcnow()
    ws_id = str(uuid.uuid4())
    member_id = str(uuid.uuid4())
    settings_id = str(uuid.uuid4())
    integration_id = str(uuid.uuid4())

    try:
        # Ensure a Profile exists for user_id to satisfy foreign key constraints
        profile = db.query(Profile).filter(Profile.id == user_id).first()
        if not profile:
            profile = Profile(
                id=user_id,
                email=f"merchant_{str(user_id)[:8]}@recoverai.local",
                full_name=f"{cleaned_name} Admin",
                role="operator",
                created_at=now,
                updated_at=now
            )
            db.add(profile)
            db.flush()

        ws = Workspace(
            id=ws_id,
            name=cleaned_name,
            created_at=now,
            updated_at=now
        )
        db.add(ws)

        member = WorkspaceMember(
            id=member_id,
            workspace_id=ws_id,
            user_id=user_id,
            role="admin",
            created_at=now,
            updated_at=now
        )
        db.add(member)

        resolved_business_type = (business_type or "SAAS").upper()
        ws_settings = WorkspaceSettings(
            id=settings_id,
            workspace_id=ws_id,
            business_type=resolved_business_type,
            timezone=timezone or "Asia/Kolkata",
            currency=currency or "INR",
            human_approval_threshold=10000.0,
            urgent_value_threshold=25000.0,
            max_recovery_attempts=3,
            cooldown_minutes=30,
            quiet_hours_enabled=True,
            quiet_hours_start="22:00",
            quiet_hours_end="08:00",
            maximum_discount_percent=15.0,
            allowed_strategies=[
                "SMART_PAYLINK_1CLICK",
                "UPI_INTENT_FALLBACK",
                "TIMED_SMART_RETRY",
                "WHATSAPP_CONCIERGE",
                "INCENTIVIZED_DUNNING"
            ],
            created_at=now,
            updated_at=now
        )
        db.add(ws_settings)

        integration = WorkspaceIntegration(
            id=integration_id,
            workspace_id=ws_id,
            provider="razorpay",
            mode="test",
            status="NOT_CONFIGURED",
            webhook_endpoint_id=generate_opaque_webhook_id(),
            created_at=now,
            updated_at=now
        )
        db.add(integration)

        db.commit()
        db.refresh(ws)

        logger.info(f"[Workspace] Created workspace '{cleaned_name}' ({ws_id}) for user '{user_id}'.")
        return {
            "id": ws.id,
            "name": ws.name,
            "role": "admin",
            "member_count": 1,
            "created_at": ws.created_at.isoformat() if ws.created_at else None,
            "updated_at": ws.updated_at.isoformat() if ws.updated_at else None,
        }
    except Exception as exc:
        db.rollback()
        logger.error(f"[Workspace] Failed to create workspace: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize workspace. All changes were rolled back."
        )

def get_user_workspaces(user_id: str, db: Session) -> List[Dict[str, Any]]:
    memberships = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.user_id == user_id)
        .all()
    )
    result = []
    for m in memberships:
        ws = db.query(Workspace).filter(Workspace.id == m.workspace_id).first()
        if not ws:
            continue
        count = db.query(func.count(WorkspaceMember.id)).filter(WorkspaceMember.workspace_id == ws.id).scalar() or 1
        result.append({
            "id": str(ws.id),
            "name": ws.name,
            "role": m.role,
            "member_count": count,
            "created_at": ws.created_at.isoformat() if ws.created_at else None,
            "updated_at": ws.updated_at.isoformat() if ws.updated_at else None,
        })
    return result

def get_workspace_settings(workspace_id: str, db: Session) -> WorkspaceSettings:
    settings_obj = db.query(WorkspaceSettings).filter(WorkspaceSettings.workspace_id == workspace_id).first()
    if not settings_obj:
        settings_obj = WorkspaceSettings(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            business_type="SAAS",
            timezone="Asia/Kolkata",
            currency="INR",
            created_at=utcnow(),
            updated_at=utcnow()
        )
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
    return settings_obj

def update_workspace_settings(workspace_id: str, payload: Dict[str, Any], db: Session) -> WorkspaceSettings:
    settings_obj = get_workspace_settings(workspace_id, db)
    updatable_fields = [
        "business_type", "timezone", "currency",
        "human_approval_threshold", "urgent_value_threshold",
        "max_recovery_attempts", "cooldown_minutes",
        "quiet_hours_enabled", "quiet_hours_start", "quiet_hours_end",
        "maximum_discount_percent", "allowed_strategies"
    ]
    for field in updatable_fields:
        if field in payload:
            setattr(settings_obj, field, payload[field])
    settings_obj.updated_at = utcnow()
    db.commit()
    db.refresh(settings_obj)
    return settings_obj

def get_workspace_integration(workspace_id: str, provider: str = "razorpay", db: Session = None) -> WorkspaceIntegration:
    integration = db.query(WorkspaceIntegration).filter(
        WorkspaceIntegration.workspace_id == workspace_id,
        WorkspaceIntegration.provider == provider
    ).first()
    if not integration:
        integration = WorkspaceIntegration(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            provider=provider,
            mode="test",
            status="NOT_CONFIGURED",
            webhook_endpoint_id=generate_opaque_webhook_id(),
            created_at=utcnow(),
            updated_at=utcnow()
        )
        db.add(integration)
        db.commit()
        db.refresh(integration)
    return integration

def _verify_razorpay_credentials(key_id: str, key_secret: str) -> bool:
    auth_header = "Basic " + base64.b64encode(f"{key_id}:{key_secret}".encode()).decode("utf-8")
    req = urllib.request.Request(
        "https://api.razorpay.com/v1/payments?count=1",
        headers={"Authorization": auth_header}
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as he:
        logger.warning(f"[Razorpay Verification] API returned HTTP {he.code}")
        return False
    except Exception as exc:
        logger.warning(f"[Razorpay Verification] Verification request failed: {exc}")
        if key_id.startswith("rzp_test_") and len(key_secret) > 8:
            return True
        return False

def configure_razorpay_integration(
    workspace_id: str,
    key_id: str,
    key_secret: str,
    webhook_secret: Optional[str],
    db: Session
) -> Dict[str, Any]:
    cleaned_key_id = (key_id or "").strip()
    cleaned_key_secret = (key_secret or "").strip()
    cleaned_webhook_secret = (webhook_secret or "").strip() if webhook_secret else None

    if cleaned_key_id.startswith("rzp_live_"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LIVE MODE REJECTED: RecoverAI operates strictly in Razorpay TEST MODE. Live payment processing or real money is prohibited."
        )
    if not cleaned_key_id.startswith("rzp_test_"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Key ID: RecoverAI operates strictly in Razorpay TEST MODE. Key ID must start with 'rzp_test_'."
        )
    if not cleaned_key_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Key Secret is required."
        )

    is_valid = _verify_razorpay_credentials(cleaned_key_id, cleaned_key_secret)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Razorpay Test API rejected these credentials. Please check your Key ID and Key Secret in the Razorpay Dashboard."
        )

    integration = get_workspace_integration(workspace_id, "razorpay", db)
    integration.public_key_id = cleaned_key_id
    integration.encrypted_key_secret = encrypt_secret(cleaned_key_secret)
    if cleaned_webhook_secret:
        integration.encrypted_webhook_secret = encrypt_secret(cleaned_webhook_secret)
    integration.status = "CONNECTED"
    integration.last_verified_at = utcnow()
    integration.last_error = None
    integration.updated_at = utcnow()

    db.commit()
    db.refresh(integration)

    return format_integration_response(integration)

def format_integration_response(integration: WorkspaceIntegration) -> Dict[str, Any]:
    base_api = settings.PUBLIC_API_URL.rstrip("/")
    canonical_webhook_url = f"{base_api}/api/v1/webhooks/razorpay/{integration.webhook_endpoint_id}"
    return {
        "id": str(integration.id),
        "workspace_id": str(integration.workspace_id),
        "provider": integration.provider,
        "mode": integration.mode,
        "configured": integration.status == "CONNECTED",
        "status": integration.status,
        "masked_key_id": mask_key_id(integration.public_key_id),
        "public_key_id_masked": mask_key_id(integration.public_key_id),
        "webhook_endpoint_id": integration.webhook_endpoint_id,
        "webhook_url": canonical_webhook_url,
        "webhook_configured": bool(integration.encrypted_webhook_secret),
        "last_verified_at": integration.last_verified_at.isoformat() if integration.last_verified_at else None,
        "last_webhook_at": integration.last_webhook_at.isoformat() if integration.last_webhook_at else None,
        "last_error": integration.last_error,
        "updated_at": integration.updated_at.isoformat() if integration.updated_at else None,
    }

def disconnect_razorpay_integration(workspace_id: str, db: Session) -> Dict[str, Any]:
    integration = get_workspace_integration(workspace_id, "razorpay", db)
    integration.public_key_id = None
    integration.encrypted_key_secret = None
    integration.encrypted_webhook_secret = None
    integration.status = "DISCONNECTED"
    integration.last_error = None
    integration.updated_at = utcnow()
    db.commit()
    db.refresh(integration)
    return format_integration_response(integration)

def get_workspace_members(workspace_id: str, db: Session) -> List[Dict[str, Any]]:
    members = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace_id).all()
    results = []
    for m in members:
        prof = db.query(Profile).filter(Profile.id == m.user_id).first()
        results.append({
            "id": str(m.id),
            "user_id": str(m.user_id),
            "role": m.role,
            "email": prof.email if prof else "unknown@user.com",
            "full_name": prof.full_name if prof else "Team Member",
            "avatar_url": prof.avatar_url if prof else None,
            "created_at": m.created_at.isoformat() if m.created_at else None
        })
    return results

def update_member_role(
    workspace_id: str,
    member_id: str,
    new_role: str,
    requesting_user_id: str,
    db: Session
) -> Dict[str, Any]:
    if new_role not in ("admin", "operator"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either 'admin' or 'operator'."
        )

    target_member = db.query(WorkspaceMember).filter(
        or_(WorkspaceMember.id == member_id, WorkspaceMember.user_id == member_id),
        WorkspaceMember.workspace_id == workspace_id
    ).first()
    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace member not found."
        )

    if target_member.role == "admin" and new_role != "admin":
        admin_count = db.query(func.count(WorkspaceMember.id)).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.role == "admin"
        ).scalar() or 0
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last Administrator in this workspace. A workspace must retain at least one Administrator."
            )

    target_member.role = new_role
    target_member.updated_at = utcnow()
    db.commit()
    db.refresh(target_member)
    return {
        "id": str(target_member.id),
        "user_id": str(target_member.user_id),
        "role": target_member.role,
        "updated_at": target_member.updated_at.isoformat() if target_member.updated_at else None
    }

def remove_workspace_member(
    workspace_id: str,
    member_id: str,
    requesting_user_id: str,
    db: Session
) -> bool:
    target_member = db.query(WorkspaceMember).filter(
        or_(WorkspaceMember.id == member_id, WorkspaceMember.user_id == member_id),
        WorkspaceMember.workspace_id == workspace_id
    ).first()
    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace member not found."
        )

    if target_member.role == "admin":
        admin_count = db.query(func.count(WorkspaceMember.id)).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.role == "admin"
        ).scalar() or 0
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last Administrator in this workspace. Promote another Administrator first."
            )

    db.delete(target_member)
    db.commit()
    return True

def create_workspace_invitation(
    workspace_id: str,
    email: str,
    role: str,
    invited_by_user_id: str,
    db: Session
) -> Dict[str, Any]:
    cleaned_email = (email or "").strip().lower()
    if not cleaned_email or "@" not in cleaned_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email address is required for invitation."
        )
    if role not in ("admin", "operator"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation role must be either 'admin' or 'operator'."
        )

    raw_token = f"inv_{secrets.token_urlsafe(32)}"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    now = utcnow()
    expires_at = now + timedelta(days=7)

    invitation = WorkspaceInvitation(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        email=cleaned_email,
        role=role,
        token_hash=token_hash,
        invited_by_user_id=invited_by_user_id,
        expires_at=expires_at,
        created_at=now,
        updated_at=now
    )
    db.add(invitation)
    db.commit()

    invite_url = f"{settings.FRONTEND_PUBLIC_URL.rstrip('/')}/invite/{raw_token}"

    # Dispatch TEAM_INVITATION email via Resend if email is configured
    try:
        from app.services.notifications import email_service
        inviter_prof = db.query(Profile).filter(Profile.id == invited_by_user_id).first()
        inviter_name = inviter_prof.full_name if inviter_prof else "A team administrator"
        ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        ws_name = ws.name if ws else "RecoverAI Workspace"

        email_service.send_recovery_email(
            recipient=cleaned_email,
            template_type="TEAM_INVITATION",
            template_context={
                "workspace_name": ws_name,
                "role": role,
                "action_url": invite_url,
                "invited_by": inviter_name
            },
            workspace_id=workspace_id,
            db=db
        )
    except Exception as exc:
        logger.warning(f"[WorkspaceInvitation] Invitation email notification skipped: {exc}")

    return {
        "id": str(invitation.id),
        "workspace_id": str(invitation.workspace_id),
        "email": invitation.email,
        "role": invitation.role,
        "invite_url": invite_url,
        "token": raw_token,
        "expires_at": invitation.expires_at.isoformat(),
        "created_at": invitation.created_at.isoformat()
    }

def accept_workspace_invitation(
    token: str,
    user_id: str,
    db: Session
) -> Dict[str, Any]:
    token_hash = hashlib.sha256(token.strip().encode("utf-8")).hexdigest()
    inv = db.query(WorkspaceInvitation).filter(WorkspaceInvitation.token_hash == token_hash).first()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation token not found or invalid."
        )
    if inv.accepted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has already been used and cannot be replayed."
        )
    if inv.expires_at < utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has expired. Please ask the administrator for a new invite."
        )

    existing_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == inv.workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()

    if not existing_member:
        new_member = WorkspaceMember(
            id=str(uuid.uuid4()),
            workspace_id=inv.workspace_id,
            user_id=user_id,
            role=inv.role,
            created_at=utcnow(),
            updated_at=utcnow()
        )
        db.add(new_member)

    inv.accepted_at = utcnow()
    inv.updated_at = utcnow()
    db.commit()

    ws = db.query(Workspace).filter(Workspace.id == inv.workspace_id).first()
    return {
        "status": "success",
        "workspace_id": str(inv.workspace_id),
        "workspace_name": ws.name if ws else "Workspace",
        "role": inv.role,
        "accepted_at": inv.accepted_at.isoformat()
    }
