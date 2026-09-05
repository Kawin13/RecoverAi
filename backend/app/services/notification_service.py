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
    status: str = "DELIVERED"
    title: str
    body: str
    action_url: Optional[str] = None
    language: str = "en"
    recovery_case_id: Optional[str] = None
    latency_ms: int = 120
    dispatched_at: datetime = Field(default_factory=datetime.utcnow)

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
        custom_message: Optional[str] = None
    ) -> NotificationReceipt:
        """
        Dispatches or honestly simulates a notification across specified channel.
        Always tags unconfigured/test sends with DEMO DELIVERY.
        """
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

        receipt = NotificationReceipt(
            notification_id=f"notif_{uuid.uuid4().hex[:12]}",
            channel=norm_channel,
            recipient=recipient,
            delivery_label="DEMO DELIVERY",
            is_simulated=True,
            status="DELIVERED",
            title=title,
            body=body,
            action_url=action_url,
            language=language,
            recovery_case_id=recovery_case_id,
            latency_ms=145,
            dispatched_at=datetime.now(timezone.utc)
        )

        # Store in recent history
        self._history.insert(0, receipt)
        if len(self._history) > self._max_history:
            self._history.pop()

        logger.info(
            f"[DEMO DELIVERY] Dispatched {norm_channel} to {recipient} "
            f"for Case {recovery_case_id} [Strategy: {strategy}]: {title}"
        )

        # Emit real-time SSE event for dashboard and agent workflow feed
        event_broadcaster.broadcast_sync("NOTIFICATION_DISPATCHED", {
            "notification_id": receipt.notification_id,
            "channel": receipt.channel,
            "recipient": receipt.recipient,
            "delivery_label": receipt.delivery_label,
            "title": receipt.title,
            "body": receipt.body,
            "action_url": receipt.action_url,
            "recovery_case_id": receipt.recovery_case_id,
            "dispatched_at": receipt.dispatched_at.isoformat()
        })

        return receipt

    def get_recent_notifications(
        self,
        case_id: Optional[str] = None,
        limit: int = 20
    ) -> List[NotificationReceipt]:
        """Returns recent notification receipts for the live workflow feed."""
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
