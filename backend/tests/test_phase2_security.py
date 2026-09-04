import uuid
import time
import hmac
import hashlib
from typing import Dict, Any
import pytest
from app.models import RecoveryCase, Transaction, Customer, PaymentAttempt, Profile
from app.core.config import settings

def test_unauthenticated_workflow_execute_rejected_401(client):
    """Direct unauthenticated call to workflow execute must return 401."""
    res = client.post("/api/recovery/workflows/case_unauth_test/execute", json={"is_live_demo": True})
    assert res.status_code == 401
    assert "WWW-Authenticate" in res.headers

def test_unauthenticated_workflow_payment_link_rejected_401(client):
    """Direct unauthenticated call to workflow payment-link must return 401."""
    res = client.post("/api/recovery/workflows/case_unauth_test/payment-link", json={"is_live_demo": True})
    assert res.status_code == 401
    assert "WWW-Authenticate" in res.headers

def test_unauthenticated_workflow_simulate_outcome_rejected_401(client):
    """Direct unauthenticated call to simulate outcome must return 401."""
    res = client.post("/api/recovery/workflows/case_unauth_test/simulate-outcome", json={"outcome": "RECOVERED"})
    assert res.status_code == 401
    assert "WWW-Authenticate" in res.headers

def test_unauthenticated_audit_trail_rejected_401(client):
    """Direct unauthenticated calls to audit records must return 401."""
    res_list = client.get("/api/audit")
    assert res_list.status_code == 401

    res_cases = client.get("/api/audit/cases")
    assert res_cases.status_code == 401

    res_tx = client.get("/api/audit/tx_some_id")
    assert res_tx.status_code == 401

def test_unauthenticated_analytics_rejected_401(client):
    """Direct unauthenticated calls to analytics must return 401."""
    res = client.get("/api/analytics")
    assert res.status_code == 401

    res_v1 = client.get("/api/v1/analytics")
    assert res_v1.status_code == 401

def test_unauthenticated_sse_stream_rejected_401(client):
    """Direct unauthenticated call to SSE stream must be rejected with 401."""
    res = client.get("/api/events/stream")
    assert res.status_code == 401
    assert "WWW-Authenticate" in res.headers

def test_unauthenticated_simulation_run_rejected_401(client):
    """Direct unauthenticated call to simulation run must return 401."""
    controls = {
        "num_transactions": 10,
        "failure_rate": 0.2,
        "abandonment_rate": 0.25,
        "average_order_value": 2500.0
    }
    res = client.post("/api/v1/simulation/run", json=controls)
    assert res.status_code == 401

def test_unauthenticated_checkout_admin_rejected_401(client):
    """Direct unauthenticated calls to merchant checkout admin endpoints must return 401."""
    res_sess = client.get("/api/v1/checkout/sessions")
    assert res_sess.status_code == 401

    res_scan = client.post("/api/v1/checkout/check-abandoned")
    assert res_scan.status_code == 401

    res_funnel = client.get("/api/v1/checkout/funnel")
    assert res_funnel.status_code == 401

    res_cases = client.get("/api/v1/checkout/cases")
    assert res_cases.status_code == 401

def test_operator_forbidden_from_admin_actions_403(operator_client, db_session):
    """Authenticated operator role attempting admin-only actions must receive 403 Forbidden."""
    # 1. Create a pending approval case
    cust = Customer(id="cust_op_block", name="Op Block Cust", email="opblock@example.com", tier="VIP")
    tx = Transaction(id="tx_op_block", order_id="ord_op_block", customer_id=cust.id, amount=15000.0, status="FAILED")
    case = RecoveryCase(
        id="case_op_block",
        transaction_id=tx.id,
        risk_amount=15000.0,
        failure_category="TECHNICAL_TIMEOUT",
        status="PENDING_APPROVAL"
    )
    db_session.add_all([cust, tx, case])
    db_session.commit()

    # Operator attempting human supervisor approval -> 403 Forbidden
    dec_res = operator_client.post(
        f"/api/guardrails/approval-queue/{case.id}/decision",
        json={"decision": "APPROVE", "operator_name": "Junior Operator"}
    )
    assert dec_res.status_code == 403
    assert "Administrator privileges required" in dec_res.json()["detail"]

    # Operator attempting to view admin users -> 403 Forbidden
    users_res = operator_client.get("/api/v1/admin/users")
    assert users_res.status_code == 403

def test_admin_allowed_for_admin_actions(client, monkeypatch, db_session):
    """Authenticated admin role is permitted to execute admin actions."""
    admin_uuid = "597289a7-e26e-415d-ab4d-fa587e32899a"
    admin_email = "admin.ops@recoverai.io"

    # Ensure profile has role='admin' in DB
    prof = db_session.query(Profile).filter(Profile.id == admin_uuid).first()
    if not prof:
        prof = Profile(id=admin_uuid, email=admin_email, role="admin", full_name="Master Admin")
        db_session.add(prof)
        db_session.commit()
    else:
        prof.role = "admin"
        db_session.commit()

    # Mock verify_supabase_jwt to return admin identity
    from app.core import auth as core_auth
    mock_verify = lambda token: {"id": admin_uuid, "email": admin_email}
    monkeypatch.setattr(core_auth, "verify_supabase_jwt", mock_verify)

    headers = {"Authorization": "Bearer valid_admin_token"}

    # 1. Setup pending approval case
    cust = Customer(id="cust_admin_ok", name="Admin OK Cust", email="adminok@example.com", tier="VIP")
    tx = Transaction(id="tx_admin_ok", order_id="ord_admin_ok", customer_id=cust.id, amount=12000.0, status="FAILED")
    case = RecoveryCase(
        id="case_admin_ok",
        transaction_id=tx.id,
        risk_amount=12000.0,
        failure_category="TECHNICAL_TIMEOUT",
        status="PENDING_APPROVAL"
    )
    db_session.add_all([cust, tx, case])
    db_session.commit()

    # Admin decision -> 200 OK
    dec_res = client.post(
        f"/api/guardrails/approval-queue/{case.id}/decision",
        json={"decision": "APPROVE", "operator_name": "Master Admin"},
        headers=headers
    )
    assert dec_res.status_code == 200
    assert dec_res.json()["status"] == "success"

    # Admin user list -> 200 OK
    users_res = client.get("/api/v1/admin/users", headers=headers)
    assert users_res.status_code == 200

def test_public_customer_routes_remain_accessible_without_jwt(client):
    """Public customer routes must not require JWT and remain open for shoppers."""
    # 1. Health check
    h_res = client.get("/health")
    assert h_res.status_code == 200
    assert h_res.json()["status"] == "healthy"

    # 2. Public payment config
    cfg_res = client.get("/api/payments/config")
    assert cfg_res.status_code == 200
    assert "key_id" in cfg_res.json()

    # 3. Shopper order creation
    ord_res = client.post("/api/payments/order", json={
        "product_id": "shopper_item",
        "product_name": "Demo T-Shirt",
        "amount": 999.0,
        "customer_name": "Public Shopper",
        "customer_email": "shopper@public.com"
    })
    assert ord_res.status_code == 200
    assert "order_id" in ord_res.json()

    # 4. Shopper checkout session creation
    sess_res = client.post("/api/checkout/sessions", json={
        "customer_name": "Cart Shopper",
        "customer_email": "cart@shopper.com",
        "cart_amount": 1500.0
    })
    assert sess_res.status_code == 200
    assert sess_res.json()["status"] == "STARTED"

def test_razorpay_webhook_preserved_with_hmac_signature(client):
    """Razorpay webhook uses HMAC SHA-256 signature verification rather than Supabase login."""
    secret = settings.RAZORPAY_WEBHOOK_SECRET or "whsec_sample"
    body = b'{"event":"payment.failed","payload":{"payment":{"entity":{"id":"pay_demo_fail","amount":250000,"status":"failed"}}}}'
    sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    # 1. Valid signature -> 200 OK (no Bearer token provided)
    res = client.post(
        "/webhooks/razorpay",
        content=body,
        headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ignored" or res.json()["status"] == "processed"

    # 2. Invalid signature -> 400 Bad Request (not 401 Unauthorized)
    bad_res = client.post(
        "/webhooks/razorpay",
        content=body,
        headers={"X-Razorpay-Signature": "bad_sig_1234", "Content-Type": "application/json"}
    )
    assert bad_res.status_code == 400
    assert "Invalid X-Razorpay-Signature" in bad_res.json()["detail"]

def test_sse_stream_authenticated_short_lived_ticket_flow(auth_client, client):
    """Verifies that SSE stream requires auth, can issue short-lived ticket, and ticket permits stream access."""
    # 1. Unauthenticated ticket request -> 401
    unauth_ticket = client.post("/api/events/stream-ticket")
    assert unauth_ticket.status_code == 401

    # 2. Authenticated ticket request -> returns ticket with 60s expiry
    auth_ticket = auth_client.post("/api/events/stream-ticket")
    assert auth_ticket.status_code == 200
    ticket_data = auth_ticket.json()
    assert "ticket" in ticket_data
    assert ticket_data["expires_in"] == 60
    ticket = ticket_data["ticket"]

    # 3. Connect to stream with valid ticket -> 200 streaming
    with client.stream("GET", f"/api/events/stream?ticket={ticket}") as stream_res:
        assert stream_res.status_code == 200
        assert "text/event-stream" in stream_res.headers.get("content-type", "")

    # 4. Ticket is single-use: subsequent reuse is rejected with 401
    reuse_res = client.get(f"/api/events/stream?ticket={ticket}")
    assert reuse_res.status_code == 401

def test_sse_stream_authenticated_bearer_header(auth_client):
    """Verifies that SSE stream accepts standard Authorization: Bearer <token> header."""
    with auth_client.stream("GET", "/api/events/stream") as res:
        assert res.status_code == 200
    assert "text/event-stream" in res.headers.get("content-type", "")
