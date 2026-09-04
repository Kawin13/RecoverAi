import json
import pytest
from app.models import RecoveryCase, Transaction, PaymentLink, AuditLog
from app.services.recovery_executor import recovery_state_machine, RecoveryStep

def test_state_machine_happy_path(auth_client, db_session):
    # 1. Create a failed payment order to spawn a recovery case
    order_res = auth_client.post("/api/payments/order", json={
        "product_id": "pro_suite",
        "product_name": "RecoverAI Enterprise AI Agent",
        "amount": 5499.0,
        "currency": "INR",
        "customer_name": "State Machine Tester",
        "customer_email": "sm.test@example.com"
    })
    order_id = order_res.json()["order_id"]
    tx_id = order_res.json()["transaction_id"]

    # Provision recovery case via payment.failed simulation
    case = RecoveryCase(
        id=f"case_sm_{tx_id[:8]}",
        transaction_id=tx_id,
        risk_amount=5499.0,
        failure_category="TECHNICAL_TIMEOUT",
        status=RecoveryStep.DETECTED.value,
        current_step=RecoveryStep.DETECTED.value,
        attempt_count=1,
        max_attempts=3
    )
    db_session.add(case)
    db_session.commit()
    case_id = case.id

    # 2. Advance Step 1: DETECTED -> ANALYZED
    res1 = auth_client.post(f"/api/recovery/workflows/{case_id}/step", json={"is_live_demo": False})
    assert res1.status_code == 200
    assert res1.json()["case"]["current_step"] == RecoveryStep.ANALYZED.value

    # 3. Advance Step 2: ANALYZED -> STRATEGY_SELECTED
    res2 = auth_client.post(f"/api/recovery/workflows/{case_id}/step", json={"is_live_demo": False})
    assert res2.status_code == 200
    assert res2.json()["case"]["current_step"] == RecoveryStep.STRATEGY_SELECTED.value
    assert res2.json()["case"]["selected_strategy"] is not None

    # 4. Advance Step 3: STRATEGY_SELECTED -> GUARDRAIL_CHECKED
    res3 = auth_client.post(f"/api/recovery/workflows/{case_id}/step", json={"is_live_demo": False})
    assert res3.status_code == 200
    assert res3.json()["case"]["current_step"] == RecoveryStep.GUARDRAIL_CHECKED.value

    # 5. Advance Step 4: GUARDRAIL_CHECKED -> ACTION_SCHEDULED
    res4 = auth_client.post(f"/api/recovery/workflows/{case_id}/step", json={"is_live_demo": False})
    assert res4.status_code == 200
    assert res4.json()["case"]["current_step"] == RecoveryStep.ACTION_SCHEDULED.value

    # 6. Advance Step 5: ACTION_SCHEDULED -> ACTION_EXECUTED
    res5 = auth_client.post(f"/api/recovery/workflows/{case_id}/step", json={"is_live_demo": False})
    assert res5.status_code == 200
    assert res5.json()["case"]["current_step"] == RecoveryStep.ACTION_EXECUTED.value

    # 7. Advance Step 6: ACTION_EXECUTED -> WAITING_FOR_CUSTOMER
    res6 = auth_client.post(f"/api/recovery/workflows/{case_id}/step", json={"is_live_demo": False})
    assert res6.status_code == 200
    assert res6.json()["case"]["current_step"] == RecoveryStep.WAITING_FOR_CUSTOMER.value

    # 8. Customer pays -> Simulate RECOVERED
    res_rec = auth_client.post(f"/api/recovery/workflows/{case_id}/simulate-outcome", json={"outcome": "RECOVERED"})
    assert res_rec.status_code == 200
    assert res_rec.json()["case"]["status"] == RecoveryStep.RECOVERED.value

    # Verify transaction also updated to SUCCESS
    tx = db_session.query(Transaction).filter(Transaction.id == tx_id).first()
    assert tx.status == "SUCCESS"

def test_state_machine_bounded_loop_escalation(auth_client, db_session):
    # Tests that repeated failures do NOT loop infinitely, but stop at MAX_ATTEMPTS
    order_res = auth_client.post("/api/payments/order", json={
        "product_id": "saas_plan",
        "product_name": "High Value SaaS",
        "amount": 8999.0,
        "customer_name": "Bounded Loop Tester",
        "customer_email": "loop.test@example.com"
    })
    tx_id = order_res.json()["transaction_id"]

    case = RecoveryCase(
        id=f"case_loop_{tx_id[:8]}",
        transaction_id=tx_id,
        risk_amount=8999.0,
        failure_category="CARD_DECLINED",
        status=RecoveryStep.WAITING_FOR_CUSTOMER.value,
        current_step=RecoveryStep.WAITING_FOR_CUSTOMER.value,
        attempt_count=1,
        max_attempts=3
    )
    db_session.add(case)
    db_session.commit()
    case_id = case.id

    # Attempt 1 timeout -> FAILED -> NEXT_STRATEGY (attempt becomes 2)
    res_fail1 = auth_client.post(f"/api/recovery/workflows/{case_id}/simulate-outcome", json={"outcome": "FAILED"})
    assert res_fail1.status_code == 200
    assert res_fail1.json()["case"]["current_step"] == RecoveryStep.NEXT_STRATEGY.value
    assert res_fail1.json()["case"]["attempt_count"] == 2

    # Attempt 2 timeout -> FAILED -> NEXT_STRATEGY (attempt becomes 3)
    res_fail2 = auth_client.post(f"/api/recovery/workflows/{case_id}/simulate-outcome", json={"outcome": "FAILED"})
    assert res_fail2.status_code == 200
    assert res_fail2.json()["case"]["attempt_count"] == 3

    # Attempt 3 timeout -> FAILED -> Ceiling exceeded (attempt 4 > 3) -> ESCALATED / STOPPED!
    res_fail3 = auth_client.post(f"/api/recovery/workflows/{case_id}/simulate-outcome", json={"outcome": "FAILED"})
    assert res_fail3.status_code == 200
    final_step = res_fail3.json()["case"]["current_step"]
    # High risk case ($8999) must be escalated to concierge or stopped, NOT looped!
    assert final_step in (RecoveryStep.ESCALATED.value, RecoveryStep.STOPPED.value)

def test_audit_records_per_transition(auth_client, db_session):
    order_res = auth_client.post("/api/payments/order", json={
        "product_id": "audit_check",
        "product_name": "Audit Trail Product",
        "amount": 1999.0,
        "customer_name": "Auditor",
        "customer_email": "auditor@example.com"
    })
    tx_id = order_res.json()["transaction_id"]

    case = RecoveryCase(
        id=f"case_aud_{tx_id[:8]}",
        transaction_id=tx_id,
        risk_amount=1999.0,
        failure_category="UPI_TIMEOUT",
        status=RecoveryStep.DETECTED.value,
        current_step=RecoveryStep.DETECTED.value
    )
    db_session.add(case)
    db_session.commit()
    case_id = case.id

    # Step 1
    auth_client.post(f"/api/recovery/workflows/{case_id}/step", json={"is_live_demo": False})

    # Step 2
    auth_client.post(f"/api/recovery/workflows/{case_id}/step", json={"is_live_demo": False})

    # Check audit logs
    audits = db_session.query(AuditLog).filter(AuditLog.recovery_case_id == case_id).all()
    assert len(audits) >= 2
    for a in audits:
        assert a.action_type == "STATE_TRANSITION"
        assert "Workflow [" in a.details

def test_executor_payment_link_generation(auth_client, db_session):
    order_res = auth_client.post("/api/payments/order", json={
        "product_id": "plink_prod",
        "product_name": "Payment Link Demo",
        "amount": 3499.0,
        "customer_name": "PL Tester",
        "customer_email": "pl.test@example.com"
    })
    tx_id = order_res.json()["transaction_id"]

    case = RecoveryCase(
        id=f"case_pl_{tx_id[:8]}",
        transaction_id=tx_id,
        risk_amount=3499.0,
        failure_category="TECHNICAL_TIMEOUT",
        status=RecoveryStep.ACTION_SCHEDULED.value,
        current_step=RecoveryStep.ACTION_SCHEDULED.value,
        selected_strategy="PAYMENT_LINK"
    )
    db_session.add(case)
    db_session.commit()
    case_id = case.id

    # Generate payment link
    res = auth_client.post(f"/api/recovery/workflows/{case_id}/payment-link", json={"is_live_demo": False})
    assert res.status_code == 200
    data = res.json()
    assert "payment_link_id" in data
    assert "short_url" in data
    assert data["amount"] == 3499.0
    assert data["status"] == "created"

    # Verify DB persistence
    pl_db = db_session.query(PaymentLink).filter(PaymentLink.recovery_case_id == case_id).first()
    assert pl_db is not None
    assert pl_db.short_url == data["short_url"]

def test_notification_demo_delivery_label(auth_client):
    res = auth_client.get("/api/recovery/notifications")
    assert res.status_code == 200
    receipts = res.json()
    # Any simulated notifications in history must have delivery_label == "DEMO DELIVERY"
    for r in receipts:
        assert r["delivery_label"] == "DEMO DELIVERY"
        assert r["is_simulated"] is True

def test_workflows_list_api(auth_client, db_session):
    res = auth_client.get("/api/recovery/workflows")
    assert res.status_code == 200
    data = res.json()
    assert "total_cases" in data
    assert "active_cases" in data
    assert "workflows" in data
    assert isinstance(data["workflows"], list)
