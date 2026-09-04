"""
RecoverAI - Phase 11 Business Logic & UI Consistency Test Suite
Validates:
1. High-value thresholds disambiguation: HUMAN_APPROVAL_THRESHOLD (₹10,000) vs URGENT_HIGH_VALUE_THRESHOLD (₹25,000)
2. Human approval queue gating: cases < ₹10k excluded unless explicit guardrail requires approval
3. Exact approval reasons visible on all queue entries
4. Simulation payment mix totals 100% across UPI, Card, NetBanking, and Wallet
5. Simulation preset schema strictness: num_transactions enforced, unused volume rejected (extra='forbid')
6. Simulation seed reproducibility: identical seeds -> identical outcomes; different seeds -> valid variation
7. Configurable recovery/abandonment links: FRONTEND_PUBLIC_URL dynamically applied (no hardcoded localhost in prod)
"""

import uuid
import pytest
from pydantic import ValidationError

from app.core.config import settings
from app.core.guardrail_policy import guardrail_policy, GuardrailPolicy
from app.core.decision_config import decision_config, DecisionConfig
from app.models import RecoveryCase, Transaction, Customer, GuardrailEvent
from app.services.guardrails_service import guardrails_service
from app.services.simulation_service import simulation_service
from app.services.razorpay_service import razorpay_service
from app.services.abandonment_service import abandonment_service
from app.services.notification_service import notification_service
from app.schemas.simulation import SimulationControls, PaymentMethodDistribution
from app.schemas.checkout_sessions import CheckoutSessionCreate
from app.repositories.recovery_case_repository import RecoveryCaseRepository


# =============================================================================
# 1. HIGH VALUE THRESHOLDS DISAMBIGUATION
# =============================================================================

def test_threshold_semantic_distinction():
    """Verifies that HUMAN_APPROVAL_THRESHOLD and URGENT_HIGH_VALUE_THRESHOLD are distinct."""
    assert guardrail_policy.HUMAN_APPROVAL_THRESHOLD_INR == 10000.0
    assert guardrail_policy.URGENT_HIGH_VALUE_THRESHOLD_INR == 25000.0
    assert decision_config.HUMAN_APPROVAL_THRESHOLD_INR == 10000.0
    assert decision_config.URGENT_HIGH_VALUE_THRESHOLD_INR == 25000.0

    # Rule definition reflects human approval threshold
    rule = next(r for r in guardrail_policy.get_rules() if r.id == "HIGH_VALUE_THRESHOLD")
    assert "₹10,000" in rule.threshold_display
    assert "human approval threshold" in rule.description.lower()

    # Summary reflects distinct thresholds
    summary = guardrail_policy.get_summary()
    assert summary["human_approval_threshold_inr"] == 10000.0
    assert summary["urgent_high_value_threshold_inr"] == 25000.0


def test_urgent_high_value_queue_filtering(db_session):
    """Verifies that the urgent high value queue counts only cases >= ₹25,000 (not ₹10,000)."""
    ws = str(uuid.uuid4())
    cust = Customer(id=f"c_th_{uuid.uuid4().hex[:6]}", workspace_id=ws, name="Threshold Cust", email="t@c.com", tier="STANDARD")
    
    # Case 1: ₹12,000 (Exceeds ₹10k Human Approval, but BELOW ₹25k Urgent threshold)
    tx1 = Transaction(id=f"tx_mid_{uuid.uuid4().hex[:6]}", workspace_id=ws, order_id="ord_mid", customer_id=cust.id, amount=12000.0, status="FAILED")
    case1 = RecoveryCase(id=f"rc_mid_{uuid.uuid4().hex[:6]}", workspace_id=ws, transaction_id=tx1.id, risk_amount=12000.0, failure_category="TIMEOUT", status="DETECTED")
    
    # Case 2: ₹35,000 (Exceeds both ₹10k Human Approval AND ₹25k Urgent threshold)
    tx2 = Transaction(id=f"tx_urg_{uuid.uuid4().hex[:6]}", workspace_id=ws, order_id="ord_urgent", customer_id=cust.id, amount=35000.0, status="FAILED")
    case2 = RecoveryCase(id=f"rc_urg_{uuid.uuid4().hex[:6]}", workspace_id=ws, transaction_id=tx2.id, risk_amount=35000.0, failure_category="TIMEOUT", status="DETECTED")
    
    db_session.add_all([cust, tx1, case1, tx2, case2])
    db_session.commit()

    repo = RecoveryCaseRepository(db_session)
    counts = repo.get_queue_counts(workspace_id=ws)
    
    assert counts["all_at_risk"] == 2
    # Only the ₹35,000 case qualifies for the urgent queue (>= ₹25,000)
    assert counts["high_value_urgent"] == 1


# =============================================================================
# 2. HUMAN APPROVAL QUEUE GATING & EXACT REASONS
# =============================================================================

def test_sub_10k_case_does_not_enter_approval_queue_without_explicit_guardrail(auth_client, db_session):
    """Cases below ₹10,000 must NOT enter Human Approval Queue unless another explicit guardrail requires approval."""
    cust = Customer(id=f"c_sub_{uuid.uuid4().hex[:6]}", name="Sub10 User", email="sub10@test.com", tier="STANDARD")
    tx = Transaction(id=f"tx_sub_{uuid.uuid4().hex[:6]}", order_id="ord_sub10", customer_id=cust.id, amount=5400.0, status="FAILED")
    case = RecoveryCase(
        id=f"rc_sub_{uuid.uuid4().hex[:6]}",
        transaction_id=tx.id,
        risk_amount=5400.0,
        failure_category="CARD_EXPIRED",
        selected_strategy="INCENTIVIZED_DUNNING",
        recovery_probability=0.44,
        status="PENDING_APPROVAL"  # Stale or mistakenly set status
    )
    db_session.add_all([cust, tx, case])
    db_session.commit()

    # Call approval queue endpoint
    res = auth_client.get("/api/guardrails/approval-queue")
    assert res.status_code == 200
    queue = res.json()
    
    # Must NOT be in the approval queue because amount < ₹10k and no explicit guardrail
    assert not any(item["case_id"] == case.id for item in queue)


def test_high_value_case_enters_queue_with_exact_reason(auth_client, db_session):
    """Case >= ₹10,000 enters approval queue with exact reason explaining the ₹10,000 threshold."""
    cust = Customer(id=f"c_hv_{uuid.uuid4().hex[:6]}", name="HV User", email="hv@test.com", tier="STANDARD")
    tx = Transaction(id=f"tx_hv_{uuid.uuid4().hex[:6]}", order_id="ord_hv", customer_id=cust.id, amount=15000.0, status="FAILED")
    case = RecoveryCase(
        id=f"rc_hv_{uuid.uuid4().hex[:6]}",
        transaction_id=tx.id,
        risk_amount=15000.0,
        failure_category="GATEWAY_TIMEOUT",
        selected_strategy="UPI_SWITCH",
        recovery_probability=0.75,
        status="DETECTED"
    )
    db_session.add_all([cust, tx, case])
    db_session.commit()

    res = auth_client.get("/api/guardrails/approval-queue")
    assert res.status_code == 200
    queue = res.json()
    matched = next((item for item in queue if item["case_id"] == case.id), None)
    
    assert matched is not None
    assert matched["amount"] == 15000.0
    assert matched["reason_code"] == "HIGH_VALUE_TRANSACTION"
    assert "₹15,000.00" in matched["human_readable_reason"]
    assert "₹10,000.00" in matched["human_readable_reason"]
    assert "Human Approval Threshold" in matched["human_readable_reason"]


def test_sub_10k_case_with_explicit_guardrail_enters_queue_with_exact_reason(auth_client, db_session):
    """Cases < ₹10,000 with explicit guardrail (e.g. MANUAL_ESCALATION or GuardrailEvent) enter queue with exact reason."""
    cust = Customer(id=f"c_exp_{uuid.uuid4().hex[:6]}", name="Explicit User", email="exp@test.com", tier="STANDARD")
    tx = Transaction(id=f"tx_exp_{uuid.uuid4().hex[:6]}", order_id="ord_exp", customer_id=cust.id, amount=3200.0, status="FAILED")
    case = RecoveryCase(
        id=f"rc_exp_{uuid.uuid4().hex[:6]}",
        transaction_id=tx.id,
        risk_amount=3200.0,
        failure_category="AUTHENTICATION_FAILED",
        current_step="MANUAL_ESCALATION",
        status="MANUAL_ESCALATION"
    )
    db_session.add_all([cust, tx, case])
    db_session.commit()

    res = auth_client.get("/api/guardrails/approval-queue")
    assert res.status_code == 200
    queue = res.json()
    matched = next((item for item in queue if item["case_id"] == case.id), None)
    
    assert matched is not None
    assert matched["amount"] == 3200.0
    assert matched["reason_code"] == "MANUAL_ESCALATION"
    assert "Case manually escalated by operator" in matched["human_readable_reason"]


# =============================================================================
# 3. PAYMENT MIX TOTALS 100%
# =============================================================================

def test_payment_mix_totals_100_percent():
    """Verifies default payment distribution sums to 1.0 (100%) and includes all four rails."""
    dist = PaymentMethodDistribution()
    assert dist.UPI == 0.65
    assert dist.CARD == 0.20
    assert dist.NET_BANKING == 0.10
    assert dist.WALLET == 0.05
    
    total = dist.UPI + dist.CARD + dist.NET_BANKING + dist.WALLET
    assert round(total, 4) == 1.0

    # Test invalid distribution fails validation
    with pytest.raises(ValidationError):
        PaymentMethodDistribution(UPI=0.65, CARD=0.20, NET_BANKING=0.10, WALLET=0.0)  # sums to 0.95 (95%)


def test_presets_payment_mix_all_total_100_percent():
    """All 4 simulator industry presets must have payment method distributions totaling 100%."""
    presets = simulation_service.get_presets()
    assert len(presets) == 4
    for p in presets:
        d = p.controls.payment_methods_dist
        total = d.UPI + d.CARD + d.NET_BANKING + d.WALLET
        assert round(total, 2) == 1.0, f"Preset {p.id} distribution does not sum to 100% (got {total})"


# =============================================================================
# 4. PRESET STRUCTURE & SCHEMA ENFORCEMENT
# =============================================================================

def test_preset_schema_rejects_volume_and_unsupported_fields():
    """SimulationControls must reject unsupported fields like 'volume' under extra='forbid'."""
    # Attempting to pass 'volume' instead of 'num_transactions' must raise ValidationError
    with pytest.raises(ValidationError) as exc:
        SimulationControls(
            volume=500,  # Invalid field
            num_transactions=500
        )
    assert "extra" in str(exc.value).lower() or "volume" in str(exc.value).lower()


def test_preset_schema_accepts_valid_num_transactions():
    """SimulationControls correctly validates valid num_transactions."""
    controls = SimulationControls(num_transactions=400, seed=123)
    assert controls.num_transactions == 400
    assert controls.seed == 123


# =============================================================================
# 5. SIMULATION SEED REPRODUCIBILITY & VARIATION
# =============================================================================

def test_simulation_seed_reproducibility():
    """Same seed + same settings produces identical results."""
    controls = SimulationControls(
        num_transactions=150,
        merchant_category="E-Commerce & Retail",
        payment_methods_dist=PaymentMethodDistribution(UPI=0.65, CARD=0.20, NET_BANKING=0.10, WALLET=0.05),
        failure_rate=0.20,
        abandonment_rate=0.25,
        average_order_value=2500.0,
        seed=4242
    )

    run_a = simulation_service.run_simulation(controls)
    run_b = simulation_service.run_simulation(controls)

    assert run_a.total_gmv == run_b.total_gmv
    assert run_a.revenue_at_risk == run_b.revenue_at_risk
    assert run_a.recoverai_recovered_revenue == run_b.recoverai_recovered_revenue
    assert run_a.baseline_recovered_revenue == run_b.baseline_recovered_revenue
    assert run_a.recoverai_recovery_rate == run_b.recoverai_recovery_rate
    assert [t.id for t in run_a.transactions_sample] == [t.id for t in run_b.transactions_sample]


def test_simulation_different_seeds_produce_variation():
    """Different seeds produce valid statistical variation."""
    controls_a = SimulationControls(num_transactions=100, seed=1111)
    controls_b = SimulationControls(num_transactions=100, seed=9999)

    run_a = simulation_service.run_simulation(controls_a)
    run_b = simulation_service.run_simulation(controls_b)

    assert run_a.total_gmv != run_b.total_gmv


# =============================================================================
# 6. CONFIGURABLE FRONTEND RECOVERY LINKS
# =============================================================================

def test_configurable_frontend_url_in_razorpay_links(monkeypatch):
    """Verifies that generated payment links use FRONTEND_PUBLIC_URL instead of hardcoded localhost."""
    test_url = "https://recoverai.vercel.app"
    monkeypatch.setattr(settings, "FRONTEND_PUBLIC_URL", test_url)

    link = razorpay_service.create_payment_link(
        amount_paise=250000,
        customer_name="Vercel Tester",
        customer_email="vercel@test.com",
        is_live_demo=False
    )
    assert link["short_url"].startswith(test_url)
    assert "localhost:3000" not in link["short_url"]
    assert f"{test_url}/demo-checkout?payment_link_id=" in link["short_url"]


def test_configurable_frontend_url_in_abandonment_service(monkeypatch, db_session):
    """Verifies that abandonment recovery actions use FRONTEND_PUBLIC_URL."""
    test_url = "https://checkout.enterprise-brand.com"
    monkeypatch.setattr(settings, "FRONTEND_PUBLIC_URL", test_url)

    session = abandonment_service.create_session(
        CheckoutSessionCreate(
            cart_amount=4500.0,
            customer_name="Cart Abandoner",
            customer_email="abandon@test.com",
            customer_phone="+919876543210"
        ),
        db_session
    )

    # Create abandonment recovery case and trigger recovery notification
    case = abandonment_service.create_abandonment_recovery_case(session, db_session)
    assert case is not None

    # Check notification delivery action_url
    recent_receipts = [r for r in notification_service._history if r.recovery_case_id == case.id]
    assert len(recent_receipts) > 0
    receipt = recent_receipts[-1]
    assert receipt.action_url is not None
    assert "localhost:3000" not in receipt.action_url
    assert receipt.action_url.startswith(test_url)
