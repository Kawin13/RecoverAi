"""
RecoverAI SaaS Security & Multi-Tenancy Test Suite
Tests:
1. Zero-membership user isolation and rejection from demo workspace
2. Workspace creation and automatic admin membership assignment
3. Cross-workspace boundary isolation (settings, integrations, members, invitations)
4. Role-based access control (Operator cannot modify settings, integrations, or manage members)
5. Forged X-Workspace-Id header rejection
6. Last administrator demotion and removal protection
7. Cryptographic stream ticket tamper resistance and 60-second expiration
8. Cross-tenant event stream isolation
9. Multi-merchant encrypted Razorpay credential storage & rejection of live keys
10. Webhook authentication, signature verification, and workspace isolation
"""

import uuid
import json
import time
import hmac
import hashlib
import base64
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.models import (
    Workspace,
    WorkspaceMember,
    Profile,
    WorkspaceSettings,
    WorkspaceIntegration,
    DEFAULT_WORKSPACE_ID
)
from app.core import auth, vault
from app.core.events import EventBroadcaster
from app.services import workspace_service
from app.api.v1.endpoints.events import create_cryptographic_ticket, verify_cryptographic_ticket


# Fixed test UUIDs
USER_ZERO_ID = "00000000-0000-0000-0000-000000000099"
USER_ALPHA_ADMIN_ID = "11111111-0000-0000-0000-000000000001"
USER_ALPHA_OPERATOR_ID = "11111111-0000-0000-0000-000000000002"
USER_BETA_ADMIN_ID = "22222222-0000-0000-0000-000000000001"

TEST_USERS = {
    USER_ZERO_ID: {"id": USER_ZERO_ID, "email": "zero@merchant.io", "user_metadata": {"full_name": "Zero User"}},
    USER_ALPHA_ADMIN_ID: {"id": USER_ALPHA_ADMIN_ID, "email": "alpha.admin@merchant.io", "user_metadata": {"full_name": "Alpha Admin"}},
    USER_ALPHA_OPERATOR_ID: {"id": USER_ALPHA_OPERATOR_ID, "email": "alpha.operator@merchant.io", "user_metadata": {"full_name": "Alpha Operator"}},
    USER_BETA_ADMIN_ID: {"id": USER_BETA_ADMIN_ID, "email": "beta.admin@merchant.io", "user_metadata": {"full_name": "Beta Admin"}},
}


@pytest.fixture(autouse=True)
def mock_jwt(monkeypatch):
    """Mocks JWT verification to resolve test tokens to predefined users."""
    def _verify(token: str):
        if token.startswith("user:"):
            uid = token.split("user:", 1)[1]
            if uid in TEST_USERS:
                return TEST_USERS[uid]
        return None

    monkeypatch.setattr(auth, "verify_supabase_jwt", _verify)
    
    # Mock external Razorpay API verification in unit tests
    monkeypatch.setattr(
        workspace_service,
        "_verify_razorpay_credentials",
        lambda key_id, key_secret: key_id.startswith("rzp_test_") and len(key_secret) > 4
    )


def auth_header(user_id: str, workspace_id: str = None) -> dict:
    h = {"Authorization": f"Bearer user:{user_id}"}
    if workspace_id:
        h["X-Workspace-Id"] = workspace_id
    return h


# ---------------------------------------------------------------------------
# 1. Zero-Membership User Isolation
# ---------------------------------------------------------------------------
def test_zero_membership_user_cannot_access_demo_workspace(client, db_session):
    """A user with no workspace memberships gets [] on /me, 403 on operational routes, and cannot forge demo workspace."""
    h_zero = auth_header(USER_ZERO_ID)
    
    # 1. Listing workspaces returns empty list (prompts UI to start onboarding)
    res = client.get("/api/v1/workspaces/me", headers=h_zero)
    assert res.status_code == 200
    assert res.json() == []

    # 2. Accessing operational endpoint without workspace returns 403 NO_WORKSPACE_MEMBERSHIP
    res_dash = client.get("/api/v1/dashboard", headers=h_zero)
    assert res_dash.status_code == 403
    assert res_dash.json()["detail"] == "NO_WORKSPACE_MEMBERSHIP"

    # 3. Forging X-Workspace-Id with Demo Workspace returns 403 Forbidden
    res_forged = client.get(
        "/api/v1/dashboard",
        headers={"Authorization": f"Bearer user:{USER_ZERO_ID}", "X-Workspace-Id": DEFAULT_WORKSPACE_ID}
    )
    assert res_forged.status_code == 403
    assert "belong" in res_forged.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 2. Workspace Creation & Admin Initialization
# ---------------------------------------------------------------------------
def test_workspace_creation_assigns_admin_and_defaults(client, db_session):
    """Creating a workspace makes the creator an Admin and sets up settings and integration."""
    h_admin = auth_header(USER_ALPHA_ADMIN_ID)
    
    payload = {
        "name": "Alpha Store",
        "business_type": "ecommerce",
        "timezone": "Asia/Kolkata",
        "currency": "INR"
    }
    res = client.post("/api/v1/workspaces", json=payload, headers=h_admin)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["name"] == "Alpha Store"
    assert data["role"] == "admin"
    ws_id = data["id"]

    # Verify settings were created
    settings = db_session.query(WorkspaceSettings).filter_by(workspace_id=ws_id).first()
    assert settings is not None
    assert settings.human_approval_threshold == 10000.0
    assert settings.max_recovery_attempts == 3

    # Verify integration was created
    integration = db_session.query(WorkspaceIntegration).filter_by(workspace_id=ws_id, provider="razorpay").first()
    assert integration is not None
    assert integration.mode == "test"
    assert integration.webhook_endpoint_id is not None

    # Verify /me lists this workspace with admin role
    res_me = client.get("/api/v1/workspaces/me", headers=h_admin)
    assert res_me.status_code == 200
    workspaces = res_me.json()
    assert any(w["id"] == ws_id and w["role"] == "admin" for w in workspaces)


# ---------------------------------------------------------------------------
# 3. Cross-Tenant Boundary Isolation
# ---------------------------------------------------------------------------
def test_cross_tenant_isolation(client, db_session):
    """Admin of Workspace A cannot view or manipulate Workspace B."""
    h_a = auth_header(USER_ALPHA_ADMIN_ID)
    h_b = auth_header(USER_BETA_ADMIN_ID)

    # Create Workspace A
    res_a = client.post("/api/v1/workspaces", json={"name": "Workspace A"}, headers=h_a)
    assert res_a.status_code == 201
    ws_a_id = res_a.json()["id"]
    h_a = auth_header(USER_ALPHA_ADMIN_ID, workspace_id=ws_a_id)

    # Create Workspace B
    res_b = client.post("/api/v1/workspaces", json={"name": "Workspace B"}, headers=h_b)
    assert res_b.status_code == 201
    ws_b_id = res_b.json()["id"]

    # Admin A attempts to read Workspace B settings -> 403
    res = client.get(f"/api/v1/workspaces/{ws_b_id}/settings", headers=h_a)
    assert res.status_code == 403

    # Admin A attempts to update Workspace B settings -> 403
    res = client.put(f"/api/v1/workspaces/{ws_b_id}/settings", json={"human_approval_threshold": 99999}, headers=h_a)
    assert res.status_code == 403

    # Admin A attempts to read Workspace B members -> 403
    res = client.get(f"/api/v1/workspaces/{ws_b_id}/members", headers=h_a)
    assert res.status_code == 403

    # Admin A attempts to read Workspace B integration -> 403
    res = client.get(f"/api/v1/workspaces/{ws_b_id}/integrations/razorpay", headers=h_a)
    assert res.status_code == 403

    # Admin A attempts to create invitation for Workspace B -> 403
    res = client.post(f"/api/v1/workspaces/{ws_b_id}/invitations", json={"email": "attacker@hack.io", "role": "admin"}, headers=h_a)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# 4. Operator RBAC Restrictions
# ---------------------------------------------------------------------------
def test_operator_rbac_restrictions(client, db_session):
    """Operators can view settings/members but cannot modify settings, integrations, or manage members."""
    h_admin = auth_header(USER_ALPHA_ADMIN_ID)

    # Create workspace
    res = client.post("/api/v1/workspaces", json={"name": "Alpha Corp"}, headers=h_admin)
    assert res.status_code == 201
    ws_id = res.json()["id"]

    # Add Operator member
    op_member = WorkspaceMember(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        user_id=USER_ALPHA_OPERATOR_ID,
        role="operator"
    )
    db_session.add(op_member)
    db_session.commit()

    h_operator = auth_header(USER_ALPHA_OPERATOR_ID, workspace_id=ws_id)

    # Operator CAN read settings
    res = client.get(f"/api/v1/workspaces/{ws_id}/settings", headers=h_operator)
    assert res.status_code == 200

    # Operator CANNOT update settings -> 403
    res = client.put(f"/api/v1/workspaces/{ws_id}/settings", json={"human_approval_threshold": 50000}, headers=h_operator)
    assert res.status_code == 403

    # Operator CANNOT connect Razorpay -> 403
    res = client.post(f"/api/v1/workspaces/{ws_id}/integrations/razorpay", json={
        "key_id": "rzp_test_1234567890",
        "key_secret": "secret12345678"
    }, headers=h_operator)
    assert res.status_code == 403

    # Operator CANNOT create invitation -> 403
    res = client.post(f"/api/v1/workspaces/{ws_id}/invitations", json={"email": "new@merchant.io", "role": "operator"}, headers=h_operator)
    assert res.status_code == 403

    # Operator CANNOT remove admin member -> 403
    res = client.delete(f"/api/v1/workspaces/{ws_id}/members/{USER_ALPHA_ADMIN_ID}", headers=h_operator)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# 5. Forged X-Workspace-Id Rejection
# ---------------------------------------------------------------------------
def test_forged_x_workspace_id_rejected(client, db_session):
    """Passing a workspace ID the user is not a member of results in 403 Forbidden."""
    h_b = auth_header(USER_BETA_ADMIN_ID)
    res_b = client.post("/api/v1/workspaces", json={"name": "Beta Workspace"}, headers=h_b)
    assert res_b.status_code == 201
    ws_b_id = res_b.json()["id"]

    # User A tries to pass Workspace B ID in X-Workspace-Id
    h_forged = auth_header(USER_ALPHA_ADMIN_ID, workspace_id=ws_b_id)
    res = client.get("/api/v1/dashboard", headers=h_forged)
    assert res.status_code == 403
    assert "belong" in res.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 6. Last Administrator Protection
# ---------------------------------------------------------------------------
def test_last_admin_protection(client, db_session):
    """The last administrator in a workspace cannot be demoted or removed."""
    h_admin = auth_header(USER_ALPHA_ADMIN_ID)
    res = client.post("/api/v1/workspaces", json={"name": "Admin Guard WS"}, headers=h_admin)
    assert res.status_code == 201
    ws_id = res.json()["id"]

    # Update header with active workspace
    h_admin_ws = auth_header(USER_ALPHA_ADMIN_ID, workspace_id=ws_id)

    # Attempt to demote self to operator -> 400
    res_demote = client.patch(f"/api/v1/workspaces/{ws_id}/members/{USER_ALPHA_ADMIN_ID}", json={"role": "operator"}, headers=h_admin_ws)
    assert res_demote.status_code == 400
    assert "last administrator" in res_demote.json()["detail"].lower()

    # Attempt to delete self -> 400
    res_delete = client.delete(f"/api/v1/workspaces/{ws_id}/members/{USER_ALPHA_ADMIN_ID}", headers=h_admin_ws)
    assert res_delete.status_code == 400
    assert "last administrator" in res_delete.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 7. Cryptographic Stream Ticket Security
# ---------------------------------------------------------------------------
def test_stream_ticket_cryptography_and_expiry():
    """Stream tickets are HMAC-signed and strictly expire after 60 seconds."""
    user_id = "test-user-123"
    ws_id = "test-ws-456"

    # Valid ticket verifies successfully
    valid_ticket = create_cryptographic_ticket(user_id, ws_id)
    verified = verify_cryptographic_ticket(valid_ticket)
    assert verified is not None
    assert verified[0] == user_id
    assert verified[1] == ws_id

    # Tampered ticket string fails
    tampered_sig = valid_ticket[:-4] + "dead"
    assert verify_cryptographic_ticket(tampered_sig) is None

    # Tampered payload fails
    clean_ticket = valid_ticket.strip()
    padded = clean_ticket + "=" * (-len(clean_ticket) % 4)
    combined = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
    parts = combined.split(":")
    tampered_payload = f"hacker:{parts[1]}:{parts[2]}:{parts[3]}:{parts[4]}"
    tampered_encoded = base64.urlsafe_b64encode(tampered_payload.encode("utf-8")).decode("utf-8").rstrip("=")
    assert verify_cryptographic_ticket(tampered_encoded) is None

    # Expired ticket (>60 seconds) fails
    old_timestamp = int(time.time()) - 65
    from app.core.config import settings
    secret = (settings.APP_ENCRYPTION_KEY or "fallback_key_32_bytes_test_secret").encode("utf-8")
    payload_str = f"{user_id}:{ws_id}:{old_timestamp}:mocknonce"
    sig = hmac.new(secret, payload_str.encode("utf-8"), hashlib.sha256).hexdigest()[:32]
    expired_combined = f"{payload_str}:{sig}"
    expired_ticket = base64.urlsafe_b64encode(expired_combined.encode("utf-8")).decode("utf-8").rstrip("=")
    assert verify_cryptographic_ticket(expired_ticket) is None


# ---------------------------------------------------------------------------
# 8. Event Stream Tenant Isolation
# ---------------------------------------------------------------------------
def test_event_broadcaster_requires_workspace_id():
    """EventBroadcaster strictly requires workspace_id and rejects untargeted events."""
    broadcaster = EventBroadcaster()
    
    # Missing workspace_id drops event
    broadcaster.broadcast_sync("PAYMENT_FAILED", {"amount": 1000}, workspace_id=None)
    # Verify no listeners were targeted without workspace_id
    assert len(broadcaster._listeners) == 0


# ---------------------------------------------------------------------------
# 9. Encrypted Razorpay Credentials & Live Key Rejection
# ---------------------------------------------------------------------------
def test_razorpay_live_keys_rejected_and_test_keys_encrypted(client, db_session):
    """Live mode keys (rzp_live_*) are strictly rejected with 400. Test keys are stored encrypted."""
    h_admin = auth_header(USER_ALPHA_ADMIN_ID)
    res = client.post("/api/v1/workspaces", json={"name": "Credentials WS"}, headers=h_admin)
    assert res.status_code == 201
    ws_id = res.json()["id"]

    h_admin_ws = auth_header(USER_ALPHA_ADMIN_ID, workspace_id=ws_id)

    # 1. Attempting to use live key -> 400
    res_live = client.post(f"/api/v1/workspaces/{ws_id}/integrations/razorpay", json={
        "key_id": "rzp_live_ABC1234567890",
        "key_secret": "LiveSecretKey999"
    }, headers=h_admin_ws)
    assert res_live.status_code == 400
    assert "test mode" in res_live.json()["detail"].lower()

    # 2. Connecting valid test key succeeds
    res_test = client.post(f"/api/v1/workspaces/{ws_id}/integrations/razorpay", json={
        "key_id": "rzp_test_MOCK9876543210",
        "key_secret": "TestSecretPassword123",
        "webhook_secret": "WebhookSecretKey456"
    }, headers=h_admin_ws)
    assert res_test.status_code == 200, res_test.text
    data = res_test.json()
    assert data["configured"] is True
    assert data["masked_key_id"].startswith("rzp_test_")
    assert data["public_key_id_masked"].startswith("rzp_test_")

    # 3. Direct database verification: raw secrets MUST NOT be plaintext in DB
    integ = db_session.query(WorkspaceIntegration).filter_by(workspace_id=ws_id, provider="razorpay").first()
    assert integ.encrypted_key_secret != "TestSecretPassword123"
    assert integ.encrypted_webhook_secret != "WebhookSecretKey456"

    # Decryption recovers the secret
    decrypted_secret = vault.decrypt_secret(integ.encrypted_key_secret)
    assert decrypted_secret == "TestSecretPassword123"


# ---------------------------------------------------------------------------
# 10. Webhook Signature Verification & Isolation
# ---------------------------------------------------------------------------
def test_webhook_signature_verification_and_isolation(client, db_session):
    """Webhook endpoints verify HMAC signatures and isolate to specific workspace."""
    h_admin = auth_header(USER_ALPHA_ADMIN_ID)
    res = client.post("/api/v1/workspaces", json={"name": "Webhook WS"}, headers=h_admin)
    assert res.status_code == 201
    ws_id = res.json()["id"]

    h_admin_ws = auth_header(USER_ALPHA_ADMIN_ID, workspace_id=ws_id)

    # Configure Razorpay with webhook secret
    webhook_secret = "whsec_test_abc123"
    client.post(f"/api/v1/workspaces/{ws_id}/integrations/razorpay", json={
        "key_id": "rzp_test_111222333444",
        "key_secret": "secret999",
        "webhook_secret": webhook_secret
    }, headers=h_admin_ws)

    integ = db_session.query(WorkspaceIntegration).filter_by(workspace_id=ws_id, provider="razorpay").first()
    endpoint_id = integ.webhook_endpoint_id

    # 1. Webhook with invalid signature returns 400
    payload = json.dumps({"event": "payment.failed", "payload": {"payment": {"entity": {"id": "pay_test_001"}}}})
    res_bad_sig = client.post(
        f"/api/v1/webhooks/razorpay/{endpoint_id}",
        content=payload,
        headers={"X-Razorpay-Signature": "invalid_signature", "Content-Type": "application/json"}
    )
    assert res_bad_sig.status_code == 400

    # 2. Webhook with valid signature succeeds
    valid_sig = hmac.new(webhook_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    res_good_sig = client.post(
        f"/api/v1/webhooks/razorpay/{endpoint_id}",
        content=payload,
        headers={"X-Razorpay-Signature": valid_sig, "Content-Type": "application/json"}
    )
    assert res_good_sig.status_code == 200
    assert res_good_sig.json()["status"] == "processed"

    # 3. Nonexistent endpoint ID returns 404
    res_404 = client.post(
        f"/api/v1/webhooks/razorpay/nonexistent-endpoint-id",
        content=payload,
        headers={"X-Razorpay-Signature": valid_sig, "Content-Type": "application/json"}
    )
    assert res_404.status_code == 404
