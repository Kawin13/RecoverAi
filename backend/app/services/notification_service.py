"""
RecoverAI - Notification Service & Honest Channel Abstraction
Implements multi-channel notification simulation and delivery tracking.
Labels all mock/unconfigured sends honestly as DEMO DELIVERY without spoofing real SMS/WhatsApp gateways.
"""

import uuid
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

from app.core.logging import logger
from app.core.events import event_broadcaster

class NotificationChannel(str, Enum):
    IN_APP = "IN_APP"
    EMAIL_SIMULATION = "EMAIL_SIMULATION"
    SMS_SIMULATION = "SMS_SIMULATION"
    WHATSAPP_SIMULATION = "WHATSAPP_SIMULATION"

class NotificationReceipt(BaseModel):
    notification_id: str
    channel: str
    recipient: str
    delivery_label: str = "DEMO DELIVERY"
    is_simulated: bool = True
    status: str = "SENT"
    title: str
    body: str
    action_url: Optional[str] = None
    language: str = "en"
    recovery_case_id: Optional[str] = None
    provider_message_id: Optional[str] = None
    latency_ms: int = 120
    dispatched_at: datetime = Field(default_factory=datetime.utcnow)

class EmailAdapter:
    """Authentic email adapter dispatching recovery emails through Resend REST API."""
    @staticmethod
    def send(to_email: str, subject: str, body_text: str, action_url: Optional[str] = None) -> tuple[bool, Optional[str], Optional[str]]:
        from app.core.config import settings
        import json
        import urllib.request
        import urllib.error

        api_key = getattr(settings, "RESEND_API_KEY", "")
        from_address = getattr(settings, "EMAIL_FROM_ADDRESS", "recovery@recoverai.io")

        if not api_key or "placeholder" in api_key.lower():
            logger.info(f"[EmailAdapter] Resend API key not configured. Honest sandbox dispatch to {to_email}.")
            return True, f"resend_mock_{uuid.uuid4().hex[:10]}", None

        url = "https://api.resend.com/emails"
        html_content = f"<div style='font-family: sans-serif; line-height: 1.6; color: #1e1b4b;'>"
        html_content += f"<p>{body_text}</p>"
        if action_url:
            html_content += f"<p style='margin-top: 24px;'><a href='{action_url}' style='background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;'>Complete Payment</a></p>"
        html_content += f"<p style='font-size: 12px; color: #64748b; margin-top: 32px;'>Secured by RecoverAI Autonomous Revenue Engine</p></div>"

        payload = {
            "from": from_address,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
            "text": f"{body_text}\n\n{action_url if action_url else ''}"
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "RecoverAI-V1/1.0"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 201):
                    res_data = json.loads(resp.read().decode("utf-8"))
                    provider_msg_id = res_data.get("id")
                    logger.info(f"[EmailAdapter] Real email sent via Resend to {to_email} (ID: {provider_msg_id})")
                    return True, provider_msg_id, None
                return False, None, f"Resend API returned status {resp.status}"
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8") if he.fp else str(he)
            logger.error(f"[EmailAdapter] Resend HTTP Error {he.code}: {err_body}")
            return False, None, f"Resend error: {he.code} - {err_body}"
        except Exception as exc:
            logger.error(f"[EmailAdapter] Resend request failed: {exc}")
            return False, None, str(exc)

class NotificationService:
    def __init__(self):
        # In-memory circular buffer for live agent activity feed
        self._history: List[NotificationReceipt] = []
        self._max_history = 100

    def send_recovery_notification(
        self,
        recipient: str,
        channel: str,
        strategy: str,
        customer_name: str,
        amount: float,
        action_url: Optional[str] = None,
        language: str = "en",
        recovery_case_id: Optional[str] = None,
        custom_message: Optional[str] = None,
        workspace_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        attempt_number: int = 1,
        max_attempts: int = 3,
        order_id: Optional[str] = None,
        failure_reason: Optional[str] = None,
        recovery_action_id: Optional[str] = None,
        is_demo: bool = True,
        template_type: Optional[str] = None,
        db: Optional[Any] = None
    ) -> NotificationReceipt:
        """
        Dispatches real email (via Resend if configured) or honestly labels unconfigured sends.
        Persists message record into customer_messages table. Never falsely claims DELIVERED.
        """
        from app.core.config import settings
        from app.models.workspaces import DEFAULT_WORKSPACE_ID
        norm_channel = channel.upper()
        if norm_channel not in [c.value for c in NotificationChannel]:
            norm_channel = NotificationChannel.IN_APP.value

        # Build strategy-specific honest copy
        title, body = self._render_template(
            strategy=strategy,
            customer_name=customer_name,
            amount=amount,
            action_url=action_url,
            language=language,
            channel=norm_channel,
            custom_message=custom_message
        )

        is_email_channel = norm_channel in ("EMAIL", "EMAIL_SIMULATION")
        provider_msg_id = None
        delivery_status = "SENT"
        delivery_label = "DEMO DELIVERY"
        delivery_err = None
        is_real_send = False

        if is_email_channel:
            from app.services.notifications import email_service
            from app.database.session import SessionLocal

            session_db = db
            close_db = False
            if session_db is None:
                session_db = SessionLocal()
                close_db = True

            try:
                resolved_template = template_type
                if not resolved_template:
                    if strategy == "PAYMENT_FAILED":
                        resolved_template = "PAYMENT_FAILED"
                    elif strategy in ("PAYMENT_LINK", "SMART_PAYLINK_1CLICK", "1-CLICK PAYLINK"):
                        resolved_template = "PAYMENT_LINK"
                    elif "ABANDON" in strategy:
                        resolved_template = "CART_ABANDONMENT"
                    else:
                        resolved_template = "PERSONALIZED_REMINDER"

                context = {
                    "customer_name": customer_name,
                    "amount": amount,
                    "merchant_name": "RecoverAI",
                    "action_url": action_url,
                    "custom_message": custom_message,
                    "strategy": strategy,
                    "order_id": order_id,
                    "failure_reason": failure_reason,
                    "attempt_number": attempt_number,
                    "max_attempts": max_attempts,
                    "is_demo": is_demo
                }
                res = email_service.send_recovery_email(
                    recipient=recipient,
                    template_type=resolved_template,
                    template_context=context,
                    workspace_id=workspace_id or DEFAULT_WORKSPACE_ID,
                    db=session_db,
                    recovery_case_id=recovery_case_id,
                    customer_id=customer_id,
                    recovery_action_id=recovery_action_id,
                    attempt_number=attempt_number
                )
                delivery_status = res.status
                provider_msg_id = res.provider_message_id
                delivery_label = res.delivery_label
                delivery_err = res.error_message
                is_real_send = res.success
            except Exception as e:
                logger.error(f"[NotificationService] email_service failed: {e}")
                delivery_status = "FAILED"
                delivery_label = "EMAIL ERROR"
                delivery_err = str(e)
            finally:
                if close_db:
                    session_db.close()
        else:
            delivery_status = "SENT"
            delivery_label = "DEMO DELIVERY"

        receipt = NotificationReceipt(
            notification_id=f"notif_{uuid.uuid4().hex[:12]}",
            channel=norm_channel,
            recipient=recipient,
            delivery_label=delivery_label,
            is_simulated=not is_real_send,
            status=delivery_status,
            title=title,
            body=body,
            action_url=action_url,
            language=language,
            recovery_case_id=recovery_case_id,
            provider_message_id=provider_msg_id,
            latency_ms=145,
            dispatched_at=datetime.now(timezone.utc)
        )

        # Store in recent history
        self._history.insert(0, receipt)
        if len(self._history) > self._max_history:
            self._history.pop()

        logger.info(
            f"[{delivery_label}] Dispatched {norm_channel} to {recipient} "
            f"for Case {recovery_case_id} [Status: {delivery_status}]: {title}"
        )

        # Emit real-time SSE event for dashboard and agent workflow feed
        event_broadcaster.broadcast_sync("NOTIFICATION_DISPATCHED", {
            "notification_id": receipt.notification_id,
            "channel": receipt.channel,
            "recipient": receipt.recipient,
            "delivery_label": receipt.delivery_label,
            "status": receipt.status,
            "title": receipt.title,
            "body": receipt.body,
            "action_url": receipt.action_url,
            "recovery_case_id": receipt.recovery_case_id,
            "dispatched_at": receipt.dispatched_at.isoformat()
        }, workspace_id=workspace_id)

        return receipt

    def get_recent_notifications(
        self,
        case_id: Optional[str] = None,
        limit: int = 20
    ) -> List[NotificationReceipt]:
        """Returns recent notification receipts for the live workflow feed."""
        # Check DB for durable customer_messages records
        from app.database.session import SessionLocal
        from app.models.customer_messages import CustomerMessage

        db = SessionLocal()
        try:
            query = db.query(CustomerMessage)
            if case_id:
                query = query.filter(CustomerMessage.recovery_case_id == case_id)
            db_messages = query.order_by(CustomerMessage.created_at.desc()).limit(limit).all()

            if db_messages:
                db_receipts = [
                    NotificationReceipt(
                        notification_id=str(m.id),
                        channel=m.channel or "EMAIL",
                        recipient=m.recipient,
                        delivery_label="BLOCKED_TEST_RECIPIENT" if m.error_code == "BLOCKED_TEST_RECIPIENT" else ("RESEND EMAIL" if m.status == "SENT" else (m.status or "RESEND EMAIL")),
                        is_simulated=m.status != "SENT" and m.status != "DELIVERED",
                        status=m.status,
                        title=m.subject,
                        body=m.message_text or m.body_text or "",
                        language="en",
                        recovery_case_id=m.recovery_case_id,
                        provider_message_id=m.provider_message_id,
                        latency_ms=120,
                        dispatched_at=m.created_at
                    )
                    for m in db_messages
                ]
                return db_receipts
        except Exception as e:
            logger.debug(f"[NotificationService] DB fetch fallback to in-memory: {e}")
        finally:
            db.close()

        if case_id:
            return [n for n in self._history if n.recovery_case_id == case_id][:limit]
        return self._history[:limit]

    def _render_template(
        self,
        strategy: str,
        customer_name: str,
        amount: float,
        action_url: Optional[str],
        language: str,
        channel: str,
        custom_message: Optional[str] = None
    ) -> tuple[str, str]:
        if custom_message:
            return "Payment Update", custom_message

        url_str = f" Link: {action_url}" if action_url else ""

        if strategy == "UPI_SWITCH":
            if language == "hi":
                title = "UPI se turant payment karein"
                body = f"Namaste {customer_name}, aapka ₹{amount:,.2f} ka payment atak gaya tha. Bina OTP ke instant UPI se pura karein:{url_str}"
            elif language == "hinglish":
                title = "1-Click UPI Quick Pay"
                body = f"Hi {customer_name}, aapka ₹{amount:,.2f} payment fail ho gaya tha. Seamless UPI apps (GPay/PhonePe) se 1-click me complete karein:{url_str}"
            elif language == "ta":
                title = "UPI மூலம் எளிதாக பணம் செலுத்துங்கள்"
                body = f"வணக்கம் {customer_name}, உங்கள் ₹{amount:,.2f} பரிவர்த்தனை தோல்வியடைந்தது. உடனடியாக UPI மூலம் முடிக்கவும்:{url_str}"
            else:
                title = "Switch to Fast 1-Click UPI"
                body = f"Hi {customer_name}, your ₹{amount:,.2f} payment experienced a card/bank timeout. Switch to instant UPI (GPay/PhonePe/Paytm) without re-entering details:{url_str}"

        elif strategy == "PAYMENT_LINK":
            title = "Secure 1-Click Payment Link"
            body = f"Hello {customer_name}, here is your instant secure Razorpay checkout link for ₹{amount:,.2f}:{url_str} Valid for 24 hours."

        elif strategy == "RETRY_LATER":
            title = "Smart Payment Retry Scheduled"
            body = f"Hi {customer_name}, we detected high bank network latency. RecoverAI has scheduled an automated retry during optimal clearing window in 30 mins."

        elif strategy == "HUMAN_ESCALATION":
            title = "VIP Priority Concierge Assigned"
            body = f"Dear {customer_name}, our senior account concierge is reviewing your ₹{amount:,.2f} transaction to ensure seamless resolution. We will contact you shortly."

        else:
            title = "Payment Assistance"
            body = f"Hi {customer_name}, we noticed an issue with your recent transaction of ₹{amount:,.2f}. Need help? Complete your order securely here:{url_str}"

        return title, body

notification_service = NotificationService()
