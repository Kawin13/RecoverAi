"""
RecoverAI - Email Management Endpoints
Provides administrative visibility and controls for Resend email recovery:
- Real-time connection & policy status
- On-demand diagnostic test email dispatch
- Customer message delivery logs (SENT, DELIVERED, BOUNCED, BLOCKED)
- Dynamic workspace email policy updates
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.database.session import get_db
from app.core.config import settings
from app.core.logging import logger
from app.core.auth import get_current_user
from app.models import CustomerMessage, WorkspaceSettings, AuditLog
from app.services.notifications import email_service
from app.services.workspace_service import get_workspace_settings, update_workspace_settings

router = APIRouter()

DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001"


# --- Request & Response Models ---

class SendTestEmailRequest(BaseModel):
    recipient: Optional[str] = Field(None, description="Destination email. Defaults to primary test recipient.")
    customer_name: Optional[str] = Field("Aditya Sharma", description="Sample customer name")
    amount: Optional[float] = Field(4999.0, description="Sample payment amount in INR")
    template_type: Optional[str] = Field("PAYMENT_LINK", description="Template: PAYMENT_LINK, CART_ABANDONMENT, PERSONALIZED_REMINDER")
    action_url: Optional[str] = Field(None, description="Custom checkout / payment link url")


class EmailSettingsUpdateRequest(BaseModel):
    email_enabled: Optional[bool] = None
    max_emails_per_recovery: Optional[int] = None
    email_cooldown_minutes: Optional[int] = None
    email_quiet_hours_enabled: Optional[bool] = None
    email_quiet_hours_start: Optional[str] = None
    email_quiet_hours_end: Optional[str] = None
    recovery_success_email_enabled: Optional[bool] = None


# --- Endpoints ---

@router.get("/status", summary="Get Email Delivery & Resend Connection Status")
def get_email_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Returns provider connectivity, policy configurations, test allowlists, and 24h message stats."""
    ws_id = current_user.get("workspace_id") or DEFAULT_WORKSPACE_ID
    ws_settings = get_workspace_settings(ws_id, db)

    raw_key = getattr(settings, "RESEND_API_KEY", "") or ""
    is_configured = bool(raw_key and not raw_key.startswith("your_") and "placeholder" not in raw_key.lower())

    masked_key = None
    if is_configured:
        if len(raw_key) > 8:
            masked_key = f"{raw_key[:7]}...{raw_key[-4:]}"
        else:
            masked_key = "re_****"

    allowed_recipients = list(settings.get_allowed_test_recipients())
    primary_recipient = settings.get_primary_test_recipient()
    auto_redirect = getattr(settings, "EMAIL_AUTO_REDIRECT_DEMO", False)

    # 24-hour message stats
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    q = db.query(CustomerMessage).filter(
        CustomerMessage.workspace_id == ws_id,
        CustomerMessage.channel == "EMAIL",
        CustomerMessage.created_at >= since
    )
    total_24h = q.count()
    sent_24h = q.filter(CustomerMessage.status == "SENT").count()
    delivered_24h = q.filter(CustomerMessage.status == "DELIVERED").count()
    bounced_24h = q.filter(CustomerMessage.status == "BOUNCED").count()
    blocked_24h = q.filter(CustomerMessage.status == "BLOCKED").count()

    return {
        "provider": "resend",
        "configured": is_configured,
        "masked_api_key": masked_key,
        "from_address": getattr(settings, "EMAIL_FROM_ADDRESS", "RecoverAI <onboarding@resend.dev>"),
        "global_email_enabled": getattr(settings, "EMAIL_ENABLED", True),
        "workspace_email_enabled": ws_settings.email_enabled,
        "effective_email_enabled": getattr(settings, "EMAIL_ENABLED", True) and ws_settings.email_enabled,
        "test_mode": getattr(settings, "EMAIL_TEST_MODE", True),
        "test_recipients": allowed_recipients,
        "primary_test_recipient": primary_recipient,
        "auto_redirect_demo": auto_redirect,
        "quiet_hours_enabled": ws_settings.email_quiet_hours_enabled,
        "quiet_hours_window": f"{ws_settings.email_quiet_hours_start} - {ws_settings.email_quiet_hours_end}",
        "cooldown_minutes": ws_settings.email_cooldown_minutes,
        "max_emails_per_recovery": ws_settings.max_emails_per_recovery,
        "stats_24h": {
            "total": total_24h,
            "sent": sent_24h,
            "delivered": delivered_24h,
            "bounced": bounced_24h,
            "blocked": blocked_24h
        }
    }


@router.post("/send-test", summary="Send On-Demand Test Recovery Email")
def send_test_email(
    request: SendTestEmailRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Dispatches an on-demand test email to verify Resend delivery, templates, and redirect policies."""
    ws_id = current_user.get("workspace_id") or DEFAULT_WORKSPACE_ID
    target_recipient = request.recipient or settings.get_primary_test_recipient()

    if not target_recipient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No recipient specified and no EMAIL_TEST_RECIPIENTS configured in settings."
        )

    base_url = settings.FRONTEND_PUBLIC_URL.rstrip('/')
    action_url = request.action_url or f"{base_url}/demo-checkout?test_recovery=true&amount={request.amount}"

    context = {
        "customer_name": request.customer_name,
        "amount": request.amount,
        "payment_url": action_url,
        "action_url": action_url,
        "merchant_name": "RecoverAI Live Test",
        "is_demo": True
    }

    test_case_id = f"case_test_{uuid.uuid4().hex[:8]}"
    test_idemp_key = f"idemp_test_{uuid.uuid4().hex[:12]}"

    try:
        res = email_service.send_recovery_email(
            recipient=target_recipient,
            template_type=request.template_type or "PAYMENT_LINK",
            template_context=context,
            workspace_id=ws_id,
            recovery_case_id=None,
            bypass_quiet_hours=True,
            custom_idempotency_key=test_idemp_key,
            db=db
        )

        return {
            "success": res.success,
            "status": res.status,
            "delivery_label": res.delivery_label,
            "recipient": target_recipient,
            "provider": res.provider,
            "provider_message_id": res.provider_message_id,
            "error_code": res.error_code,
            "error_message": res.error_message,
            "idempotency_key": res.idempotency_key,
            "test_case_id": test_case_id
        }
    except Exception as e:
        logger.error(f"[EmailManagement] Error sending test email: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to dispatch test email: {str(e)}"
        )


@router.get("/history", summary="Get Paginated Email Delivery History")
def get_email_history(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = Query(None, description="Optional status filter: SENT, DELIVERED, BOUNCED, BLOCKED"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Retrieves transactional email message audit records for the current workspace."""
    ws_id = current_user.get("workspace_id") or DEFAULT_WORKSPACE_ID

    query = db.query(CustomerMessage).filter(
        CustomerMessage.workspace_id == ws_id,
        CustomerMessage.channel == "EMAIL"
    )

    if status_filter:
        query = query.filter(CustomerMessage.status == status_filter.upper())

    total = query.count()
    records = query.order_by(desc(CustomerMessage.created_at)).offset(offset).limit(limit).all()

    items = []
    for r in records:
        meta = None
        if r.metadata_json:
            try:
                meta = json.loads(r.metadata_json)
            except Exception:
                meta = {}

        items.append({
            "id": r.id,
            "recipient": r.recipient,
            "subject": r.subject,
            "template_type": r.template_type,
            "status": r.status,
            "provider": r.provider,
            "provider_message_id": r.provider_message_id,
            "error_code": r.error_code,
            "error_message": r.error_message or r.error,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "sent_at": r.sent_at.isoformat() if r.sent_at else None,
            "delivered_at": r.delivered_at.isoformat() if r.delivered_at else None,
            "idempotency_key": r.idempotency_key,
            "recovery_case_id": r.recovery_case_id,
            "transaction_id": r.transaction_id,
            "metadata": meta
        })

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items
    }


@router.put("/settings", summary="Update Workspace Email Policies")
def update_email_policies(
    payload: EmailSettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Updates workspace-level email policies including quiet hours, cooldown, and master toggle."""
    ws_id = current_user.get("workspace_id") or DEFAULT_WORKSPACE_ID
    data = payload.model_dump(exclude_unset=True)
    updated = update_workspace_settings(ws_id, data, db)

    return {
        "status": "updated",
        "workspace_id": ws_id,
        "email_enabled": updated.email_enabled,
        "max_emails_per_recovery": updated.max_emails_per_recovery,
        "email_cooldown_minutes": updated.email_cooldown_minutes,
        "email_quiet_hours_enabled": updated.email_quiet_hours_enabled,
        "email_quiet_hours_start": updated.email_quiet_hours_start,
        "email_quiet_hours_end": updated.email_quiet_hours_end,
        "recovery_success_email_enabled": updated.recovery_success_email_enabled
    }
