import json
import pytest
from datetime import datetime, timedelta
from app.models import CheckoutSession, Customer, RecoveryCase, Transaction, AuditLog
from app.services.abandonment_service import abandonment_service

def test_create_checkout_session_started(client, db_session):
    payload = {
        "customer_name": "Kavita Rao",
        "customer_email": "kavita.rao@example.com",
        "customer_phone": "+919812345678",
        "customer_tier": "GROWTH",
        "cart_amount": 4200.0,
        "selected_method": "UPI",
        "is_demo_simulation": True
    }
    res = client.post("/api/checkout/sessions", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "STARTED"
    assert data["cart_amount"] == 4200.0
    assert data["payment_attempted"] is False
    assert data["is_demo_simulation"] is True
    assert data["id"].startswith("chk_")

def test_checkout_session_lifecycle_transitions(client, db_session):
    # 1. Start session
    create_res = client.post("/api/checkout/sessions", json={
        "customer_name": "Arjun Mehta",
        "customer_email": "arjun.m@example.com",
        "cart_amount": 2800.0
    })
    session_id = create_res.json()["id"]

    # 2. Transition: CUSTOMER_IDENTIFIED
    t1 = client.post(f"/api/checkout/sessions/{session_id}/transition", json={
        "new_status": "CUSTOMER_IDENTIFIED"
    })
    assert t1.status_code == 200
    assert t1.json()["status"] == "CUSTOMER_IDENTIFIED"

    # 3. Transition: PAYMENT_METHOD_VIEWED
    t2 = client.post(f"/api/checkout/sessions/{session_id}/transition", json={
        "new_status": "PAYMENT_METHOD_VIEWED",
        "selected_method": "UPI"
    })
    assert t2.status_code == 200
    assert t2.json()["status"] == "PAYMENT_METHOD_VIEWED"
    assert t2.json()["selected_method"] == "UPI"

    # 4. Transition: PAYMENT_INITIATED
    t3 = client.post(f"/api/checkout/sessions/{session_id}/transition", json={
        "new_status": "PAYMENT_INITIATED"
    })
    assert t3.status_code == 200
    assert t3.json()["status"] == "PAYMENT_INITIATED"
    assert t3.json()["payment_attempted"] is True

    # 5. Transition: COMPLETED
    t4 = client.post(f"/api/checkout/sessions/{session_id}/transition", json={
        "new_status": "COMPLETED"
    })
    assert t4.status_code == 200
    assert t4.json()["status"] == "COMPLETED"
    assert t4.json()["completed_at"] is not None

def test_abandonment_detection_timeout(client, db_session):
    # Create an inactive session 45 seconds old
    cust = Customer(id="cust_abn_timeout", name="Timeout Tester", email="timeout@example.com", tier="STANDARD")
    old_time = datetime.utcnow() - timedelta(seconds=45)
    session = CheckoutSession(
        id="chk_timeout_test",
        customer_id=cust.id,
        order_id="order_timeout_test",
        cart_amount=3500.0,
        status="PAYMENT_METHOD_VIEWED",
        selected_method="CARD",
        started_at=old_time,
        last_activity_at=old_time,
        is_demo_simulation=True
    )
    db_session.add_all([cust, session])
    db_session.commit()

    # Call scanner with timeout_seconds=15
    res = client.post("/api/checkout/check-abandoned?timeout_seconds=15")
    assert res.status_code == 200
    data = res.json()
    assert data["abandoned_count"] >= 1
    assert "chk_timeout_test" in data["processed_sessions"]

    # Verify session status is ABANDONED and recovery case created
    db_session.refresh(session)
    assert session.status == "ABANDONED"
    assert session.abandoned_at is not None
    assert session.recovery_case_id is not None

    case = db_session.query(RecoveryCase).filter(RecoveryCase.id == session.recovery_case_id).first()
    assert case is not None
    assert case.failure_category == "ABANDONMENT"
    assert case.risk_amount == 3500.0
    assert case.expected_recovery_value > 0.0

def test_abandonment_strategy_selection(client, db_session):
    # Test A: High Value Cart (₹15,000) -> HUMAN_ESCALATION
    cust_vip = Customer(id="cust_vip_abn", name="VIP Client", email="vip@example.com", tier="VIP", ltv=50000.0)
    sess_hv = CheckoutSession(
        id="chk_hv_test",
        customer_id=cust_vip.id,
        order_id="ord_hv",
        cart_amount=15000.0,
        status="CUSTOMER_IDENTIFIED",
        started_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow()
    )
    db_session.add_all([cust_vip, sess_hv])
    db_session.commit()

    metrics_hv = abandonment_service.calculate_abandonment_erv(sess_hv, cust_vip)
    assert metrics_hv["selected_strategy"] == "HUMAN_ESCALATION"
    assert metrics_hv["channel"] == "EMAIL_SIMULATION"

    # Test B: High Intent (PAYMENT_METHOD_VIEWED) -> PAYMENT_LINK
    cust_std = Customer(id="cust_std_abn", name="Standard Shopper", email="std@example.com", tier="STANDARD", ltv=1000.0)
    sess_hi = CheckoutSession(
        id="chk_hi_test",
        customer_id=cust_std.id,
        order_id="ord_hi",
        cart_amount=1800.0,
        status="PAYMENT_METHOD_VIEWED",
        payment_attempted=True,
        started_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow()
    )
    db_session.add_all([cust_std, sess_hi])
    db_session.commit()

    metrics_hi = abandonment_service.calculate_abandonment_erv(sess_hi, cust_std)
    assert metrics_hi["selected_strategy"] == "PAYMENT_LINK"
    assert metrics_hi["channel"] == "SMS_SIMULATION"

def test_abandonment_funnel_metrics(client, db_session):
    res = client.get("/api/checkout/funnel")
    assert res.status_code == 200
    data = res.json()
    assert "total_sessions" in data
    assert "checkout_started" in data
    assert "payment_attempted" in data
    assert "abandoned" in data
    assert "recovery_initiated" in data
    assert "recovered" in data
    assert "stages" in data
    assert len(data["stages"]) == 5
    stage_names = [s["stage_name"] for s in data["stages"]]
    assert stage_names == [
        "Checkout Started",
        "Payment Attempted",
        "Abandoned",
        "Recovery Initiated",
        "Recovered"
    ]

def test_abandonment_cases_list_api(client, db_session):
    res = client.get("/api/checkout/cases")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first = data[0]
        assert "case_id" in first
        assert "cart_amount" in first
        assert "selected_strategy" in first
        assert "is_demo_simulation" in first
