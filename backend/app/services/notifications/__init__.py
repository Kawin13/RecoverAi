"""
RecoverAI - Notifications & Email Module
"""

from app.services.notifications.base import (
    NotificationResult,
    NotificationStatus,
    NotificationChannel,
    TemplateType
)
from app.services.notifications.resend_adapter import resend_adapter, ResendAdapter
from app.services.notifications.templates import render_template
from app.services.notifications.email_service import email_service, EmailService

__all__ = [
    "NotificationResult",
    "NotificationStatus",
    "NotificationChannel",
    "TemplateType",
    "resend_adapter",
    "ResendAdapter",
    "render_template",
    "email_service",
    "EmailService"
]
