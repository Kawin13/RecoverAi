"""
RecoverAI - Email Management Tests
Verifies:
- /api/v1/email-management/status endpoint returns safe config and diagnostics
- /api/v1/email-management/send-test triggers diagnostic delivery
- /api/v1/email-management/history returns paginated customer messages
- /api/v1/email-management/settings updates workspace email policies
- Smart Test-Mode Auto-Routing redirects synthetic demo emails to verified test recipient
"""

import uuid
from unittest.mock import MagicMock
import pytest
from app.core.config import settings
from app.models import CustomerMessage, WorkspaceSettings
from app.services.notifications import email_service
from app.services.notifications.base import NotificationResult, NotificationStatus


DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001"


def test_get_email_status(auth_client, db_session):
    res = auth_client.get("/api/v1/email-management/status")
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "resend"
    assert "configured" in data
    assert "from_address" in data
    assert "test_mode" in data
    assert "test_recipients" in data
    assert "stats_24h" in data
    assert "sent" in data["stats_24h"]
    assert "delivered" in data["stats_24h"]


def test_send_test_email(auth_client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_RECIPIENTS", "kawindharma@gmail.com")

    # Mock resend adapter so network request isn't actually made in mock test
    from app.services.notifications.resend_adapter import resend_adapter
    mock_send = MagicMock(return_value=NotificationResult(
        success=True,
        provider="resend",
        status=NotificationStatus.SENT.value,
        provider_message_id=f"re_mock_{uuid.uuid4().hex[:10]}",
        delivery_label="RESEND EMAIL"
    ))
    monkeypatch.setattr(resend_adapter, "send_sync", mock_send)

    payload = {
        "recipient": "kawindharma@gmail.com",
        "customer_name": "Test Customer",
        "amount": 2500.0,
        "template_type": "PAYMENT_LINK"
    }

    res = auth_client.post("/api/v1/email-management/send-test", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "SENT"
    assert data["recipient"] == "kawindharma@gmail.com"
    assert data["provider_message_id"] is not None


def test_email_history_pagination(auth_client, db_session):
    # Insert a dummy message to guarantee history has at least 1 record
    msg = CustomerMessage(
        id=str(uuid.uuid4()),
        workspace_id=DEFAULT_WORKSPACE_ID,
        channel="EMAIL",
        recipient="history.test@example.com",
        subject="Payment Link Test",
        template_type="PAYMENT_LINK",
        status="SENT",
        provider="resend",
        idempotency_key=f"idem_hist_{uuid.uuid4().hex[:8]}"
    )
    db_session.add(msg)
    db_session.commit()

    res = auth_client.get("/api/v1/email-management/history?limit=10&offset=0")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)
    assert data["total"] >= 1


def test_update_email_policies(auth_client, db_session):
    payload = {
        "email_enabled": True,
        "max_emails_per_recovery": 4,
        "email_cooldown_minutes": 45,
        "email_quiet_hours_enabled": True,
        "email_quiet_hours_start": "23:00",
        "email_quiet_hours_end": "07:00"
    }
    res = auth_client.put("/api/v1/email-management/settings", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "updated"
    assert data["max_emails_per_recovery"] == 4
    assert data["email_cooldown_minutes"] == 45
    assert data["email_quiet_hours_start"] == "23:00"


def test_smart_test_mode_auto_routing(db_session, monkeypatch):
    """
    When EMAIL_AUTO_REDIRECT_DEMO is True:
    Synthetic demo checkout persona (aditya.sharma@techcorp.in)
    is routed to primary test recipient (kawindharma@gmail.com)
    instead of being blocked.
    """
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_MODE", True)
    monkeypatch.setattr(settings, "EMAIL_TEST_RECIPIENTS", "kawindharma@gmail.com")
    monkeypatch.setattr(settings, "EMAIL_AUTO_REDIRECT_DEMO", True)

    from app.services.notifications.resend_adapter import resend_adapter
    dispatched_to = []

    def fake_send_sync(to, subject, html_content, text_content=None, **kwargs):
        dispatched_to.append(to)
        return NotificationResult(
            success=True,
            provider="resend",
            status=NotificationStatus.SENT.value,
            provider_message_id=f"re_routed_{uuid.uuid4().hex[:10]}",
            delivery_label="RESEND EMAIL"
        )

    monkeypatch.setattr(resend_adapter, "send_sync", fake_send_sync)

    case_id = f"case_route_{uuid.uuid4().hex[:8]}"
    result = email_service.send_recovery_email(
        recipient="aditya.sharma@techcorp.in",
        template_type="PAYMENT_LINK",
        template_context={"customer_name": "Aditya Sharma", "amount": 4999.0, "is_demo": True},
        workspace_id=DEFAULT_WORKSPACE_ID,
        recovery_case_id=case_id,
        db=db_session
    )

    assert result.success is True
    assert result.status == "SENT"
    # Resend received the verified test email address
    assert len(dispatched_to) == 1
    assert dispatched_to[0] == "kawindharma@gmail.com"

    # Customer message still records customer's intended persona email for reporting
    msg = db_session.query(CustomerMessage).filter(CustomerMessage.recovery_case_id == case_id).first()
    assert msg is not None
    assert msg.recipient == "aditya.sharma@techcorp.in"
    assert "was_redirected" in msg.metadata_json
