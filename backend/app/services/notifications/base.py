"""
RecoverAI - Notification & Email Base Contracts
Defines normalized result contracts, provider lifecycle statuses, and template types.
"""

from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class NotificationStatus(str, Enum):
    QUEUED = "QUEUED"
    SENDING = "SENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    BOUNCED = "BOUNCED"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"
    CANCELLED = "CANCELLED"


class NotificationChannel(str, Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"
    WHATSAPP = "WHATSAPP"
    IN_APP = "IN_APP"
    EMAIL_SIMULATION = "EMAIL_SIMULATION"
    SMS_SIMULATION = "SMS_SIMULATION"
    WHATSAPP_SIMULATION = "WHATSAPP_SIMULATION"


class TemplateType(str, Enum):
    PAYMENT_FAILED = "PAYMENT_FAILED"
    PAYMENT_LINK = "PAYMENT_LINK"
    CART_ABANDONMENT = "CART_ABANDONMENT"
    ADMIN_APPROVAL = "ADMIN_APPROVAL"
    TEAM_INVITATION = "TEAM_INVITATION"
    RECOVERY_SUCCESS = "RECOVERY_SUCCESS"
    PERSONALIZED_REMINDER = "PERSONALIZED_REMINDER"


class NotificationResult(BaseModel):
    success: bool
    provider: str = "resend"
    provider_message_id: Optional[str] = None
    status: str = NotificationStatus.QUEUED.value
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    idempotency_key: Optional[str] = None
    delivery_label: str = "RESEND EMAIL"
    details: Dict[str, Any] = Field(default_factory=dict)
