import json
import pytest
from app.models import RecoveryCase, Transaction, Customer, PaymentLink, AuditLog, GuardrailEvent
from app.services.guardrails_service import guardrails_service
from app.core.guardrail_policy import guardrail_policy
from app.services.recovery_executor import recovery_state_machine, RecoveryStep

def _setup_case(
    db_session,
    suffix: str,
    amount: float = 2500.0,
    failure_category: str = "TECHNICAL_TIMEOUT",
    status: str = "DETECTED",
    attempt_count: int = 1,
    recovery_probability: float = 0.85,
    cust_tier: str = "GROWTH",
    strategy: str = "PAYMENT_LINK"
) -> RecoveryCase:
    cust = Customer(
        id=f"c_{suffix}",
        name=f"User {suffix}",
        email=f"{suffix}@example.com",
        phone="+919876543210",
        tier=cust_tier
    )
    tx = Transaction(
        id=f"tx_{suffix}",
        order_id=f"ord_{suffix}",
        customer_id=cust.id,
        amount=amount,
        currency="INR",
        method="UPI",
        status="FAILED"
    )
    case = RecoveryCase(
        id=f"case_{suffix}",
        transaction_id=tx.id,
        risk_amount=amount,
        failure_category=failure_category,
        selected_strategy=strategy,
        recovery_probability=recovery_probability,
        status=status,
        current_step=status,
        attempt_count=attempt_count,
        max_attempts=3
    )
    db_session.add_all([cust, tx, case])
    db_session.commit()
    return case

def test_rule_customer_opted_out_stops_recovery(client, db_session):
    case = _setup_case(
        db_session,
        suffix="optout",
        cust_tier="OPTED_OUT_DND",
        failure_category="OPT_OUT_REQUESTED"
    )
    decision = guardrails_service.evaluate(case, db_session)
    assert decision.allowed is False
    assert decision.requires_approval is False
    assert decision.reason_code == "CUSTOMER_OPTED_OUT"
    assert decision.suggested_action == "STOP"

def test_rule_risk_fraud_flag_stops_recovery(client, db_session):
    case = _setup_case(
        db_session,
        suffix="fraud",
        failure_category="FRAUD_SUSPECTED"
    )
    decision = guardrails_service.evaluate(case, db_session)
    assert decision.allowed is False
    assert decision.reason_code == "RISK_FRAUD_FLAG"
    assert decision.suggested_action == "STOP"

def test_rule_permanent_failure_prevents_same_method_retry(client, db_session):
    case = _setup_case(
        db_session,
        suffix="perm",
        failure_category="CARD_BLOCKED",
        strategy="RETRY_NOW"
    )
    decision = guardrails_service.evaluate(case, db_session, candidate_strategy="RETRY_NOW")
    assert decision.allowed is False
    assert decision.reason_code == "PERMANENT_FAILURE"

def test_rule_attempts_exceeded_stops_recovery(client, db_session):
    case = _setup_case(
        db_session,
        suffix="att",
        attempt_count=3,
        status="STRATEGY_SELECTED"
    )
    decision = guardrails_service.evaluate(case, db_session)
    assert decision.allowed is False
    assert decision.reason_code == "ATTEMPTS_EXCEEDED"
    assert decision.suggested_action == "STOP"

def test_rule_high_value_requires_human_approval(client, db_session):
    case = _setup_case(
        db_session,
        suffix="hv",
        amount=15000.0,  # >= HIGH_VALUE_THRESHOLD_INR (10,000 INR)
        status="STRATEGY_SELECTED"
    )
    decision = guardrails_service.evaluate(case, db_session)
    assert decision.allowed is True
    assert decision.requires_approval is True
    assert decision.reason_code == "HIGH_VALUE_TRANSACTION"
    assert "₹10,000" in decision.human_readable_reason

    # Test state machine gate: advancing step moves to PENDING_APPROVAL
    updated_case, step_info = recovery_state_machine.advance_step(case, db_session)
    assert updated_case.status == "PENDING_APPROVAL"
    assert updated_case.current_step == "PENDING_APPROVAL"

def test_rule_low_probability_triggers_no_action(client, db_session):
    case = _setup_case(
        db_session,
        suffix="lowprob",
        recovery_probability=0.10,  # < MIN_RECOVERY_PROBABILITY (0.20)
        status="STRATEGY_SELECTED"
    )
    decision = guardrails_service.evaluate(case, db_session)
    assert decision.allowed is False
    assert decision.reason_code == "LOW_RECOVERY_PROBABILITY"
    assert decision.suggested_action == "NO_ACTION"

def test_human_approval_queue_and_decisions(auth_client, db_session):
    case = _setup_case(
        db_session,
        suffix="appr_flow",
        amount=18500.0,
        status="PENDING_APPROVAL",
        cust_tier="VIP"
    )

    # 1. Verify case appears in approval queue API
    q_res = auth_client.get("/api/guardrails/approval-queue")
    assert q_res.status_code == 200
    q_items = q_res.json()
    matched = next((i for i in q_items if i["case_id"] == case.id), None)
    assert matched is not None
    assert matched["amount"] == 18500.0
    assert matched["reason_code"] == "HIGH_VALUE_TRANSACTION"

    # 2. Operator approves case
    decision_payload = {
        "decision": "APPROVE",
        "operator_name": "Supervisor Sarah",
        "operator_notes": "Verified VIP account relationship. High-ticket recovery permitted."
    }
    dec_res = auth_client.post(f"/api/guardrails/approval-queue/{case.id}/decision", json=decision_payload)
    assert dec_res.status_code == 200
    assert dec_res.json()["approval_record"]["final_decision"] == "APPROVE"

    # 3. Verify case transitioned to ACTION_SCHEDULED
    db_session.refresh(case)
    assert case.status == "ACTION_SCHEDULED"

    # 4. Verify immutable AuditLog entry
    audit = db_session.query(AuditLog).filter(
        AuditLog.recovery_case_id == case.id,
        AuditLog.action_type == "HUMAN_APPROVAL_DECISION"
    ).first()
    assert audit is not None
    assert "Supervisor Sarah" in audit.actor
    meta = json.loads(audit.metadata_json)
    assert meta["who_approved"] == "Supervisor Sarah"
    assert meta["final_decision"] == "APPROVE"
    assert meta["amount"] == 18500.0

def test_operator_reject_flow(auth_client, db_session):
    case = _setup_case(
        db_session,
        suffix="rej",
        amount=12000.0,
        status="PENDING_APPROVAL"
    )
    res = auth_client.post(f"/api/guardrails/approval-queue/{case.id}/decision", json={
        "decision": "REJECT",
        "operator_name": "Risk Officer Mark",
        "operator_notes": "Suspicious transaction frequency"
    })
    assert res.status_code == 200
    db_session.refresh(case)
    assert case.status == "STOPPED"

def test_guardrails_execute_before_external_actions(client, db_session):
    # High-value transaction must be stopped at PENDING_APPROVAL and NOT create a payment link
    case = _setup_case(
        db_session,
        suffix="gate",
        amount=25000.0,
        status="STRATEGY_SELECTED",
        strategy="PAYMENT_LINK"
    )

    # Step: STRATEGY_SELECTED -> evaluates guardrails
    updated_case, step_info = recovery_state_machine.advance_step(case, db_session)
    assert updated_case.status == "PENDING_APPROVAL"

    # Assert no PaymentLink was created
    pl = db_session.query(PaymentLink).filter(PaymentLink.recovery_case_id == case.id).first()
    assert pl is None

def test_why_stopped_forensic_endpoint(auth_client, db_session):
    case = _setup_case(
        db_session,
        suffix="forensic",
        amount=5000.0,
        failure_category="FRAUD_SUSPECTED",
        status="STOPPED"
    )

    res = auth_client.get(f"/api/guardrails/forensics/{case.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["case_id"] == case.id
    assert data["fraud_flag_detected"] is True
    assert data["reason_code"] == "RISK_FRAUD_FLAG"
    assert data["policy_version"] == guardrail_policy.POLICY_VERSION

def test_central_policies_endpoint(auth_client):
    res = auth_client.get("/api/guardrails/policies")
    assert res.status_code == 200
    data = res.json()
    assert "policy_version" in data
    assert "summary" in data
    assert "rules" in data
    assert len(data["rules"]) >= 6
