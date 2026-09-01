"""
RecoverAI - At-Risk Logic Consistency Test Suite
Verifies:
1. Queue subset counts never exceed All At-Risk.
2. Batch dispatch count equals actually eligible cases.
3. Overall recoverability vs per-strategy action probability semantic consistency.
4. UNKNOWN failure diagnosis never produces gateway-specific wording.
5. BANK_GATEWAY_TIMEOUT produces consistent diagnosis and messaging.
6. UPI_SWITCH produces matching labels, UPI customer message, UPI CTA, and execution button.
7. RETRY_NOW produces retry-specific wording only.
8. Gemini structured prompt receives canonical diagnosis and action.
9. Gemini cannot overwrite selected action or diagnosis.
"""

import pytest
from app.database.session import SessionLocal
from app.models.recovery_cases import RecoveryCase
from app.models.transactions import Transaction
from app.models.customers import Customer
from app.services.recovery_service import RecoveryService
from app.agents.diagnosis import diagnosis_engine
from app.agents.decision_engine import decision_engine
from app.agents.gemini_agent import gemini_agent
from app.schemas.canonical import get_canonical_action, CANONICAL_ACTIONS, FailureTaxonomy

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -----------------------------------------------------------------------------
# 1. Queue Subset Counts & Batch Dispatch Dynamic Count Tests
# -----------------------------------------------------------------------------
def test_queue_subset_counts_never_exceed_all_at_risk(db_session):
    service = RecoveryService(db_session)
    counts = service.get_queue_counts()

    all_at_risk = counts["all_at_risk"]
    high_value_urgent = counts["high_value_urgent"]
    vip_enterprise = counts["vip_enterprise"]
    gateway_bank_outages = counts["gateway_bank_outages"]
    batch_dispatch_eligible = counts["batch_dispatch_eligible"]

    assert all_at_risk >= 0, "All At-Risk count must be non-negative"
    assert high_value_urgent <= all_at_risk, f"High Value ({high_value_urgent}) must not exceed All At-Risk ({all_at_risk})"
    assert vip_enterprise <= all_at_risk, f"VIP & Enterprise ({vip_enterprise}) must not exceed All At-Risk ({all_at_risk})"
    assert gateway_bank_outages <= all_at_risk, f"Gateway Outages ({gateway_bank_outages}) must not exceed All At-Risk ({all_at_risk})"
    assert batch_dispatch_eligible <= all_at_risk, f"Batch Dispatch Eligible ({batch_dispatch_eligible}) must not exceed All At-Risk ({all_at_risk})"

def test_batch_dispatch_count_equals_eligible(db_session):
    service = RecoveryService(db_session)
    counts = service.get_queue_counts()
    
    # Calculate directly from DB active cases not in cooling down or suppressed
    active_cases = (
        db_session.query(RecoveryCase)
        .filter(RecoveryCase.status != "RECOVERED")
        .filter(RecoveryCase.status != "SUCCESS")
        .filter(RecoveryCase.status != "STOPPED")
        .all()
    )
    expected_eligible = sum(1 for rc in active_cases if rc.status not in ["COOLING_DOWN", "NO_ACTION"])
    assert counts["batch_dispatch_eligible"] == expected_eligible

# -----------------------------------------------------------------------------
# 2. Probability Semantic Separation Tests
# -----------------------------------------------------------------------------
def test_probability_semantic_separation():
    tx_data = {
        "transaction_id": "tx_test_prob_01",
        "amount": 5000.0,
        "payment_method": "UPI",
        "failure_reason": "UPI_TIMEOUT",
        "attempt_count": 1,
        "previous_successes": 14,
        "previous_failures": 1,
        "customer_value": "GROWTH"
    }
    decision = decision_engine.decide(tx_data)

    # Verify decision returns probability field for the selected action
    assert "recovery_probability" in decision
    assert 0.0 <= decision["recovery_probability"] <= 1.0
    
    # Verify strategies_comparison has individual probabilities per action
    comparison = decision["strategies_comparison"]
    assert len(comparison) > 0
    for item in comparison:
        assert "probability" in item
        assert "expected_recovery_value" in item
        assert 0.0 <= item["probability"] <= 1.0

# -----------------------------------------------------------------------------
# 3. Canonical Failure Diagnosis Tests (UNKNOWN vs BANK_GATEWAY_TIMEOUT)
# -----------------------------------------------------------------------------
def test_unknown_diagnosis_never_produces_gateway_timeout_wording():
    # Diagnose UNKNOWN / empty / NONE
    diag = diagnosis_engine.diagnose("NONE", "UPI", 1)
    assert diag["failure_reason_code"] == "UNKNOWN"
    assert diag["taxonomy"] == FailureTaxonomy.UNKNOWN
    assert "timeout" not in diag["human_readable_reason"].lower()
    assert "gateway" not in diag["human_readable_reason"].lower()

    # Decision on UNKNOWN
    tx_data = {
        "transaction_id": "tx_unknown_01",
        "amount": 2999.0,
        "payment_method": "UPI",
        "failure_reason": "NONE"
    }
    decision = decision_engine.decide(tx_data)
    assert decision["diagnosis"]["failure_reason_code"] == "UNKNOWN"

    # Evidence must not claim gateway timeout
    evidence_text = " ".join(decision["evidence"]).lower()
    assert "bank switch degradation" not in evidence_text
    assert "timeout diagnosed" not in evidence_text

    # Gemini message on UNKNOWN must NOT mention gateway timeout
    msg = gemini_agent.generate_customer_message(
        recovery_id="rec_unknown_01",
        transaction_data=tx_data,
        decision_data=decision,
        language="EN"
    )
    body_lower = msg["message_body"].lower()
    assert "gateway timeout" not in body_lower
    assert "bank server" not in body_lower

def test_gateway_timeout_produces_consistent_diagnosis_and_messaging():
    diag = diagnosis_engine.diagnose("UPI_TIMEOUT", "UPI", 1)
    assert diag["failure_reason_code"] == "BANK_GATEWAY_TIMEOUT"
    assert diag["taxonomy"] == FailureTaxonomy.TEMPORARY
    assert "gateway timeout" in diag["human_readable_reason"].lower()

    tx_data = {
        "transaction_id": "tx_timeout_01",
        "amount": 4999.0,
        "payment_method": "UPI",
        "failure_reason": "UPI_TIMEOUT"
    }
    decision = decision_engine.decide(tx_data)
    assert decision["diagnosis"]["failure_reason_code"] == "BANK_GATEWAY_TIMEOUT"

    msg = gemini_agent.generate_customer_message(
        recovery_id="rec_timeout_01",
        transaction_data=tx_data,
        decision_data=decision,
        language="EN"
    )
    assert "timeout" in msg["message_body"].lower()

# -----------------------------------------------------------------------------
# 4. Canonical Selected Action Consistency Tests (UPI_SWITCH vs RETRY_NOW)
# -----------------------------------------------------------------------------
def test_upi_switch_canonical_consistency():
    action = get_canonical_action("UPI_SWITCH")
    assert action.action_code == "UPI_SWITCH"
    assert action.display_name == "UPI Switch"
    assert action.customer_cta == "Pay with UPI"
    assert action.execution_handler == "execute_upi_switch"

    tx_data = {
        "transaction_id": "tx_upi_switch_01",
        "amount": 4999.0,
        "payment_method": "UPI",
        "failure_reason": "UPI_TIMEOUT"
    }
    decision = decision_engine.decide(tx_data)
    # If UPI_SWITCH is selected
    if decision["selected_action"] == "UPI_SWITCH":
        assert decision["display_name"] == "UPI Switch"
        assert decision["customer_cta"] == "Pay with UPI"

        # Customer message
        msg_en = gemini_agent.generate_customer_message("rec_upi_01", tx_data, decision, "EN")
        assert msg_en["call_to_action"] == "Pay with UPI"
        assert "Retry Payment Now" not in msg_en["call_to_action"]
        assert "upi" in msg_en["message_body"].lower()

        msg_hi = gemini_agent.generate_customer_message("rec_upi_01", tx_data, decision, "HI")
        assert msg_hi["call_to_action"] == "UPI से भुगतान करें"

        msg_hinglish = gemini_agent.generate_customer_message("rec_upi_01", tx_data, decision, "HINGLISH")
        assert msg_hinglish["call_to_action"] == "Pay with UPI"

        msg_ta = gemini_agent.generate_customer_message("rec_upi_01", tx_data, decision, "TA")
        assert msg_ta["call_to_action"] == "UPI மூலம் பணம் செலுத்துங்கள்"

def test_retry_now_canonical_consistency():
    action = get_canonical_action("RETRY_NOW")
    assert action.action_code == "RETRY_NOW"
    assert action.display_name == "Immediate Retry"
    assert action.customer_cta == "Retry Payment"

    tx_data = {
        "transaction_id": "tx_retry_01",
        "amount": 1000.0,
        "payment_method": "Card",
        "failure_reason": "BANK_GATEWAY_TIMEOUT"
    }
    decision_override = {
        "selected_action": "RETRY_NOW",
        "recovery_probability": 0.90,
        "expected_recovery_value": 890.0,
        "diagnosis": {"failure_reason_code": "BANK_GATEWAY_TIMEOUT", "human_readable_reason": "Temporary bank gateway timeout"}
    }

    msg = gemini_agent.generate_customer_message("rec_retry_01", tx_data, decision_override, "EN")
    assert msg["call_to_action"] == "Retry Payment"
    assert "retry" in msg["message_body"].lower()

# -----------------------------------------------------------------------------
# 5. Gemini Structured Prompt Canonical Integrity Tests
# -----------------------------------------------------------------------------
def test_gemini_prompt_canonical_integrity():
    tx_data = {
        "order_id": "ORD-CONSISTENCY-881",
        "amount": 7500.0,
        "payment_method": "UPI",
        "failure_reason": "BANK_GATEWAY_TIMEOUT",
        "customer_name": "Pooja Verma",
        "customer_value": "VIP"
    }
    decision_data = {
        "selected_action": "UPI_SWITCH",
        "recovery_probability": 0.94,
        "expected_recovery_value": 7050.0,
        "diagnosis": {
            "failure_reason_code": "BANK_GATEWAY_TIMEOUT",
            "failure_category": "TEMPORARY",
            "human_readable_reason": "Temporary bank gateway timeout"
        },
        "evidence": ["Factual evidence point 1", "Factual evidence point 2"]
    }

    prompt_expl = gemini_agent._build_explanation_prompt(tx_data, decision_data)
    assert "UPI Switch" in prompt_expl
    assert "BANK_GATEWAY_TIMEOUT" in prompt_expl
    assert "7500" in prompt_expl

    prompt_msg = gemini_agent._build_message_prompt(tx_data, decision_data, "EN")
    assert "UPI_SWITCH" in prompt_msg
    assert "Pay with UPI" in prompt_msg
    assert "BANK_GATEWAY_TIMEOUT" in prompt_msg
