"""
Tests for SMTP Adapter and Resend Sandbox Fallback.
Verifies that when Resend's shared sandbox restricts sending to account owner,
the system uses Gmail SMTP to deliver directly to the customer's intended email address.
"""
import uuid
from unittest.mock import patch

from app.models import (
    Customer,
    DEFAULT_WORKSPACE_ID
)
from app.services.notifications.email_service import email_service
from app.services.notifications.smtp_adapter import SMTPAdapter
from app.services.notifications.base import NotificationResult, NotificationStatus


def test_smtp_adapter_configured():
    adapter = SMTPAdapter()
    assert adapter.is_configured is True
    user, pwd = adapter._get_credentials()
    assert "@gmail.com" in user
    assert len(pwd) > 0


def test_sandbox_failure_triggers_smtp_direct_delivery(db_session):
    """
    When Resend sandbox rejects a recipient with 'only send testing emails to your own email address',
    email_service must automatically deliver directly to the intended customer email via SMTP.
    """
    customer_email = "customer.real@example.com"
    case_id = f"case_{uuid.uuid4().hex[:8]}"

    # Set up customer in DB
    cust = Customer(
        id=f"cust_{uuid.uuid4().hex[:8]}",
        workspace_id=DEFAULT_WORKSPACE_ID,
        email=customer_email,
        name="Real Customer"
    )
    db_session.add(cust)
    db_session.commit()

    # Mock Resend rejecting because recipient is not account owner
    resend_sandbox_error = NotificationResult(
        success=False,
        provider="resend",
        status=NotificationStatus.FAILED.value,
        error_code="VALIDATION_ERROR",
        error_message="You can only send testing emails to your own email address (kawindharma@gmail.com)."
    )

    # Mock SMTP successfully sending directly to customer
    smtp_success = NotificationResult(
        success=True,
        provider="smtp",
        status=NotificationStatus.SENT.value,
        provider_message_id=f"smtp_test_{customer_email}",
        delivery_label="SMTP DELIVERY"
    )

    with patch("app.services.notifications.email_service.resend_adapter.send_sync", return_value=resend_sandbox_error):
        with patch("app.services.notifications.smtp_adapter.smtp_adapter.send_sync", return_value=smtp_success) as mock_smtp:
            result = email_service.send_recovery_email(
                recipient=customer_email,
                template_type="PAYMENT_LINK",
                template_context={"customer_name": "Valued Customer", "amount": 2500, "currency": "INR", "payment_url": "https://pay.recoverai.test"},
                workspace_id=DEFAULT_WORKSPACE_ID,
                recovery_case_id=case_id,
                db=db_session
            )

            # Verification: SMTP was called with the CUSTOMER email, not redirected to account owner!
            assert mock_smtp.called
            call_kwargs = mock_smtp.call_args[1]
            assert call_kwargs["to"] == customer_email

            # Overall result is successful via SMTP
            assert result.success is True
            assert result.provider == "smtp"
            assert result.status == NotificationStatus.SENT.value
