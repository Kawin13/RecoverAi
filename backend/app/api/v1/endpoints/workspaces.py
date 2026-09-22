from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Path
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.auth import (
    get_authenticated_user,
    get_current_user,
    require_admin,
    require_operator_or_admin
)
from app.services import workspace_service
from app.models.workspaces import WorkspaceMember

router = APIRouter()

# --- Request / Response Schemas ---
class WorkspaceCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Name of the new workspace")
    business_type: Optional[str] = Field("SAAS", description="Business vertical (e.g. E-COMMERCE, SAAS)")
    timezone: Optional[str] = Field("Asia/Kolkata", description="Workspace timezone")
    currency: Optional[str] = Field("INR", description="Workspace primary currency")

class WorkspaceSettingsUpdateRequest(BaseModel):
    business_type: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    human_approval_threshold: Optional[float] = None
    urgent_value_threshold: Optional[float] = None
    max_recovery_attempts: Optional[int] = None
    cooldown_minutes: Optional[int] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    maximum_discount_percent: Optional[float] = None
    allowed_strategies: Optional[List[str]] = None
    # Email Recovery Settings
    email_enabled: Optional[bool] = None
    max_emails_per_recovery: Optional[int] = None
    email_cooldown_minutes: Optional[int] = None
    email_quiet_hours_enabled: Optional[bool] = None
    email_quiet_hours_start: Optional[str] = None
    email_quiet_hours_end: Optional[str] = None
    recovery_success_email_enabled: Optional[bool] = None

class RazorpayConnectRequest(BaseModel):
    key_id: str = Field(..., description="Razorpay Test Key ID starting with 'rzp_test_'")
    key_secret: str = Field(..., min_length=8, description="Razorpay Test Key Secret")
    webhook_secret: Optional[str] = Field(None, description="Optional Webhook Secret from Razorpay Dashboard")

class RoleUpdateRequest(BaseModel):
    role: str = Field(..., description="Target role ('admin' or 'operator')")

class InvitationCreateRequest(BaseModel):
    email: str = Field(..., description="Email of team member to invite")
    role: str = Field("operator", description="Role to assign ('admin' or 'operator')")

# --- Endpoints ---

@router.get("/me", summary="List Current User's Workspaces")
def list_my_workspaces(
    current_user: Dict[str, Any] = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """
    Returns all workspaces where the current authenticated user has active membership.
    Safe for users with 0 workspaces (e.g. during initial onboarding).
    """
    return workspace_service.get_user_workspaces(user_id=current_user["id"], db=db)

@router.post("", summary="Create New Isolated Workspace", status_code=status.HTTP_201_CREATED)
def create_new_workspace(
    payload: WorkspaceCreateRequest,
    current_user: Dict[str, Any] = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """
    Creates an isolated workspace and assigns the creator as Workspace Administrator.
    Executes atomically inside one database transaction.
    """
    return workspace_service.create_workspace(
        user_id=current_user["id"],
        name=payload.name,
        db=db,
        business_type=payload.business_type,
        timezone=payload.timezone,
        currency=payload.currency
    )

def _verify_workspace_membership(workspace_id: str, user_id: str, db: Session) -> str:
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not belong to this workspace."
        )
    return member.role

@router.get("/{id}/settings", summary="Get Workspace Settings & Guardrails")
def get_workspace_settings(
    id: str = Path(..., description="Workspace ID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves recovery guardrails and business configuration for the workspace."""
    _verify_workspace_membership(id, current_user["id"], db)
    settings_obj = workspace_service.get_workspace_settings(workspace_id=id, db=db)
    return {
        "id": str(settings_obj.id),
        "workspace_id": str(settings_obj.workspace_id),
        "business_type": settings_obj.business_type,
        "timezone": settings_obj.timezone,
        "currency": settings_obj.currency,
        "human_approval_threshold": settings_obj.human_approval_threshold,
        "urgent_value_threshold": settings_obj.urgent_value_threshold,
        "max_recovery_attempts": settings_obj.max_recovery_attempts,
        "cooldown_minutes": settings_obj.cooldown_minutes,
        "quiet_hours_enabled": settings_obj.quiet_hours_enabled,
        "quiet_hours_start": settings_obj.quiet_hours_start,
        "quiet_hours_end": settings_obj.quiet_hours_end,
        "maximum_discount_percent": settings_obj.maximum_discount_percent,
        "allowed_strategies": settings_obj.allowed_strategies,
        "updated_at": settings_obj.updated_at.isoformat() if settings_obj.updated_at else None
    }

@router.put("/{id}/settings", summary="Update Workspace Settings (Admin Only)")
def update_workspace_settings(
    payload: WorkspaceSettingsUpdateRequest,
    id: str = Path(..., description="Workspace ID"),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Updates guardrail policies and recovery settings. Restricted to Workspace Administrators."""
    _verify_workspace_membership(id, current_user["id"], db)
    settings_obj = workspace_service.update_workspace_settings(
        workspace_id=id,
        payload=payload.model_dump(exclude_unset=True),
        db=db
    )
    return {
        "id": str(settings_obj.id),
        "workspace_id": str(settings_obj.workspace_id),
        "business_type": settings_obj.business_type,
        "timezone": settings_obj.timezone,
        "currency": settings_obj.currency,
        "human_approval_threshold": settings_obj.human_approval_threshold,
        "urgent_value_threshold": settings_obj.urgent_value_threshold,
        "max_recovery_attempts": settings_obj.max_recovery_attempts,
        "cooldown_minutes": settings_obj.cooldown_minutes,
        "quiet_hours_enabled": settings_obj.quiet_hours_enabled,
        "quiet_hours_start": settings_obj.quiet_hours_start,
        "quiet_hours_end": settings_obj.quiet_hours_end,
        "maximum_discount_percent": settings_obj.maximum_discount_percent,
        "allowed_strategies": settings_obj.allowed_strategies,
        "updated_at": settings_obj.updated_at.isoformat() if settings_obj.updated_at else None
    }

@router.get("/{id}/integrations/razorpay", summary="Get Razorpay Test Mode Integration Status")
def get_razorpay_integration(
    id: str = Path(..., description="Workspace ID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns Razorpay Test Mode connection status and canonical webhook URL.
    Never exposes raw secrets.
    """
    _verify_workspace_membership(id, current_user["id"], db)
    integration = workspace_service.get_workspace_integration(workspace_id=id, provider="razorpay", db=db)
    return workspace_service.format_integration_response(integration)

@router.post("/{id}/integrations/razorpay", summary="Connect Razorpay Test Mode Credentials")
def connect_razorpay_integration(
    payload: RazorpayConnectRequest,
    id: str = Path(..., description="Workspace ID"),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Encrypts and validates Razorpay Test credentials against the Razorpay Test API.
    Strictly enforces test mode (rzp_test_). Rejects live keys (rzp_live_).
    """
    _verify_workspace_membership(id, current_user["id"], db)
    return workspace_service.configure_razorpay_integration(
        workspace_id=id,
        key_id=payload.key_id,
        key_secret=payload.key_secret,
        webhook_secret=payload.webhook_secret,
        db=db
    )

@router.post("/{id}/integrations/razorpay/test", summary="Test Razorpay Connection")
def test_razorpay_integration(
    id: str = Path(..., description="Workspace ID"),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Verifies that the workspace's stored credentials can reach the Razorpay Test API."""
    _verify_workspace_membership(id, current_user["id"], db)
    integration = workspace_service.get_workspace_integration(workspace_id=id, provider="razorpay", db=db)
    if not integration.encrypted_key_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Razorpay integration is not configured yet."
        )
    return workspace_service.format_integration_response(integration)

@router.delete("/{id}/integrations/razorpay", summary="Disconnect Razorpay Integration")
def disconnect_razorpay_integration(
    id: str = Path(..., description="Workspace ID"),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Removes stored Razorpay credentials from the workspace."""
    _verify_workspace_membership(id, current_user["id"], db)
    return workspace_service.disconnect_razorpay_integration(workspace_id=id, db=db)

@router.get("/{id}/members", summary="List Workspace Team Members")
def list_workspace_members(
    id: str = Path(..., description="Workspace ID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all team members and their roles within this workspace."""
    _verify_workspace_membership(id, current_user["id"], db)
    return workspace_service.get_workspace_members(workspace_id=id, db=db)

@router.patch("/{id}/members/{member_id}", summary="Update Member Role (Last Admin Protection)")
@router.post("/{id}/members/{member_id}/role", summary="Update Member Role (Last Admin Protection)")
def update_member_role(
    payload: RoleUpdateRequest,
    id: str = Path(..., description="Workspace ID"),
    member_id: str = Path(..., description="Workspace Member ID"),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Updates a team member's role. Prevents demoting the last Administrator."""
    _verify_workspace_membership(id, current_user["id"], db)
    return workspace_service.update_member_role(
        workspace_id=id,
        member_id=member_id,
        new_role=payload.role,
        requesting_user_id=current_user["id"],
        db=db
    )

@router.delete("/{id}/members/{member_id}", summary="Remove Workspace Member (Last Admin Protection)")
def remove_workspace_member(
    id: str = Path(..., description="Workspace ID"),
    member_id: str = Path(..., description="Workspace Member ID"),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Removes a member from the workspace. Prevents removing the last Administrator."""
    _verify_workspace_membership(id, current_user["id"], db)
    success = workspace_service.remove_workspace_member(
        workspace_id=id,
        member_id=member_id,
        requesting_user_id=current_user["id"],
        db=db
    )
    return {"status": "success", "removed": success}

@router.post("/{id}/invitations", summary="Invite Team Member (Admin Only)")
def create_invitation(
    payload: InvitationCreateRequest,
    id: str = Path(..., description="Workspace ID"),
    current_user: Dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Creates a single-use cryptographically secure invitation link."""
    _verify_workspace_membership(id, current_user["id"], db)
    return workspace_service.create_workspace_invitation(
        workspace_id=id,
        email=payload.email,
        role=payload.role,
        invited_by_user_id=current_user["id"],
        db=db
    )

@router.post("/invitations/{token}/accept", summary="Accept Team Invitation")
def accept_invitation(
    token: str = Path(..., description="Invitation token"),
    current_user: Dict[str, Any] = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """Accepts an invitation and grants access to the target workspace."""
    return workspace_service.accept_workspace_invitation(
        token=token,
        user_id=current_user["id"],
        db=db
    )
