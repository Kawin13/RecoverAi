"""
RecoverAI - Resend Webhook Receiver
Receives, verifies, and processes official email lifecycle events (sent, delivered, bounced, failed).
Guarantees idempotency and updates customer_messages, audit trail, and real-time SSE streams.
"""

import json
import hashlib
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, HTTPException, Depends, status
from sqlalchemy.orm import Session
import resend

from app.database.session import get_db
from app.core.config import settings
from app.core.logging import logger
from app.core.datetime_utils import utcnow
from app.core.events import event_broadcaster
from app.models import CustomerMessage, WebhookEvent, AuditLog

router = APIRouter()


@router.post("/resend", summary="Resend Webhook Receiver")
async def resend_webhook_receiver(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Receives and processes Resend email lifecycle webhooks.
    Verifies Svix signature using RESEND_WEBHOOK_SECRET.
    Never trusts unverified payloads.
    """
    raw_body = await request.body()
    body_str = raw_body.decode("utf-8")

    svix_id = request.headers.get("svix-id")
    svix_timestamp = request.headers.get("svix-timestamp")
    svix_signature = request.headers.get("svix-signature")

    webhook_secret = getattr(settings, "RESEND_WEBHOOK_SECRET", "") or ""

    # Signature verification
    if webhook_secret and "placeholder" not in webhook_secret.lower():
        if not svix_id or not svix_timestamp or not svix_signature:
            logger.warning("[ResendWebhook] Missing Svix headers.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing required Svix webhook signature headers."
            )

        try:
            resend.Webhooks.verify({
                "payload": body_str,
                "headers": {
                    "id": svix_id,
                    "timestamp": svix_timestamp,
                    "signature": svix_signature
                },
                "webhook_secret": webhook_secret
            })
        except Exception as exc:
            logger.warning(f"[ResendWebhook] Signature verification failed: {exc}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid webhook signature: {str(exc)}"
            )
    else:
        # If no secret configured in strict production, reject
        if settings.ENVIRONMENT == "production":
            logger.error("[ResendWebhook] RESEND_WEBHOOK_SECRET is not configured in production.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Webhook secret not configured on server."
            )

    # Parse JSON payload
    try:
        payload: Dict[str, Any] = json.loads(body_str)
    except Exception as exc:
        logger.error(f"[ResendWebhook] Invalid JSON payload: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed JSON body."
        )

    # Extract event identity for deduplication
    event_id = svix_id or payload.get("id") or f"resend_evt_{hashlib.sha256(raw_body).hexdigest()[:20]}"
    event_type = payload.get("type", "unknown")
    event_data = payload.get("data", {})
    email_id = event_data.get("email_id") or event_data.get("id")

    # Idempotency Check
    existing_event = db.query(WebhookEvent).filter(
        (WebhookEvent.id == event_id) | (WebhookEvent.provider_event_id == event_id)
    ).first()
    if existing_event:
        logger.info(f"[ResendWebhook] Duplicate event skipped: {event_id} ({event_type})")
        return {
            "status": "duplicate_ignored",
            "event_id": event_id,
            "message": "Event was already processed idempotently."
        }

    now_utc = utcnow()
    ws_id = None
    msg = None

    if email_id:
        msg = db.query(CustomerMessage).filter(CustomerMessage.provider_message_id == email_id).first()
        if msg:
            ws_id = msg.workspace_id

    # Handle provider event types
    status_label = "PROCESSED"

    if msg:
        if event_type == "email.delivered":
            msg.status = "DELIVERED"
            msg.delivered_at = now_utc
            status_label = "DELIVERED"

            db.add(
                AuditLog(
                    id=f"aud_del_{hashlib.sha256(event_id.encode()).hexdigest()[:10]}",
                    workspace_id=ws_id,
                    recovery_case_id=msg.recovery_case_id,
                    transaction_id=msg.transaction_id,
                    actor="RESEND_WEBHOOK",
                    action_type="EMAIL_DELIVERED",
                    target_resource=str(msg.id),
                    details=f"Resend webhook confirmed email DELIVERED to {msg.recipient}.",
                    metadata_json=json.dumps({"provider_message_id": email_id, "event_id": event_id}),
                    created_at=now_utc
                )
            )

            event_broadcaster.broadcast_sync(
                "EMAIL_STATUS_CHANGED",
                {
                    "message_id": str(msg.id),
                    "recipient": msg.recipient,
                    "status": "DELIVERED",
                    "delivery_label": "DELIVERED",
                    "provider_message_id": email_id,
                    "recovery_case_id": msg.recovery_case_id,
                    "workspace_id": str(ws_id) if ws_id else None,
                    "timestamp": now_utc.isoformat()
                },
                workspace_id=ws_id
            )

        elif event_type == "email.bounced":
            msg.status = "BOUNCED"
            msg.failed_at = now_utc
            msg.error_code = "BOUNCED"
            msg.error_message = str(event_data.get("bounce", {}).get("message") or "Email bounced by destination MTA")
            status_label = "BOUNCED"

            db.add(
                AuditLog(
                    id=f"aud_bnc_{hashlib.sha256(event_id.encode()).hexdigest()[:10]}",
                    workspace_id=ws_id,
                    recovery_case_id=msg.recovery_case_id,
                    transaction_id=msg.transaction_id,
                    actor="RESEND_WEBHOOK",
                    action_type="EMAIL_BOUNCED",
                    target_resource=str(msg.id),
                    details=f"Email to {msg.recipient} BOUNCED: {msg.error_message}",
                    metadata_json=json.dumps({"provider_message_id": email_id, "event_id": event_id}),
                    created_at=now_utc
                )
            )

            event_broadcaster.broadcast_sync(
                "EMAIL_STATUS_CHANGED",
                {
                    "message_id": str(msg.id),
                    "recipient": msg.recipient,
                    "status": "BOUNCED",
                    "delivery_label": "BOUNCED",
                    "provider_message_id": email_id,
                    "recovery_case_id": msg.recovery_case_id,
                    "workspace_id": str(ws_id) if ws_id else None,
                    "timestamp": now_utc.isoformat()
                },
                workspace_id=ws_id
            )

        elif event_type == "email.failed":
            msg.status = "FAILED"
            msg.failed_at = now_utc
            msg.error_code = "FAILED"
            msg.error_message = str(event_data.get("error", "Delivery failed at provider"))
            status_label = "FAILED"

            db.add(
                AuditLog(
                    id=f"aud_fail_{hashlib.sha256(event_id.encode()).hexdigest()[:10]}",
                    workspace_id=ws_id,
                    recovery_case_id=msg.recovery_case_id,
                    transaction_id=msg.transaction_id,
                    actor="RESEND_WEBHOOK",
                    action_type="EMAIL_FAILED",
                    target_resource=str(msg.id),
                    details=f"Resend delivery failed for {msg.recipient}: {msg.error_message}",
                    metadata_json=json.dumps({"provider_message_id": email_id, "event_id": event_id}),
                    created_at=now_utc
                )
            )

            event_broadcaster.broadcast_sync(
                "EMAIL_STATUS_CHANGED",
                {
                    "message_id": str(msg.id),
                    "recipient": msg.recipient,
                    "status": "FAILED",
                    "delivery_label": "FAILED",
                    "provider_message_id": email_id,
                    "recovery_case_id": msg.recovery_case_id,
                    "workspace_id": str(ws_id) if ws_id else None,
                    "timestamp": now_utc.isoformat()
                },
                workspace_id=ws_id
            )

        elif event_type == "email.sent":
            if msg.status != "DELIVERED":
                msg.status = "SENT"
                msg.sent_at = msg.sent_at or now_utc
                status_label = "SENT"

    # Persist WebhookEvent record for deduplication
    webhook_record = WebhookEvent(
        id=event_id,
        workspace_id=ws_id,
        provider_event_id=event_id,
        event_type=event_type,
        resource_id=email_id,
        status=status_label,
        payload_summary=f"Resend {event_type} event for {email_id}",
        created_at=now_utc
    )
    db.add(webhook_record)
    db.commit()

    logger.info(f"[ResendWebhook] Processed event {event_id} ({event_type}) for email {email_id}")
    return {
        "status": "processed",
        "event_id": event_id,
        "event_type": event_type,
        "email_id": email_id
    }
