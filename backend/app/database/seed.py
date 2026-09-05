from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.database.session import SessionLocal, engine
from app.database.base import Base
from app.models import (
    Customer,
    Transaction,
    PaymentAttempt,
    CheckoutSession,
    RecoveryCase,
    RecoveryAction,
    AgentDecision,
    AuditLog,
    GuardrailEvent,
    RecoveryOutcome,
    Profile,
    Workspace,
    WorkspaceMember,
    DEFAULT_WORKSPACE_ID
)
from app.core.logging import logger

def seed_database(db: Session):
    now = datetime.now(timezone.utc)

    # Ensure default Workspace exists
    default_ws = db.query(Workspace).filter(Workspace.id == DEFAULT_WORKSPACE_ID).first()
    if not default_ws:
        db.add(Workspace(
            id=DEFAULT_WORKSPACE_ID,
            name="RecoverAI Demo Workspace",
            created_at=now,
            updated_at=now
        ))
        db.commit()

    # Ensure default Admin Profile exists
    admin_prof = db.query(Profile).filter(Profile.id == "597289a7-e26e-415d-ab4d-fa587e32899a").first()
    if not admin_prof:
        db.add(Profile(
            id="597289a7-e26e-415d-ab4d-fa587e32899a",
            email="test.ops@recoverai.io",
            full_name="Revenue Ops Admin",
            role="admin",
            created_at=now,
            updated_at=now
        ))
        db.commit()

    admin_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == DEFAULT_WORKSPACE_ID,
        WorkspaceMember.user_id == "597289a7-e26e-415d-ab4d-fa587e32899a"
    ).first()
    if not admin_member:
        db.add(WorkspaceMember(
            id="00000000-0000-0000-0000-000000000010",
            workspace_id=DEFAULT_WORKSPACE_ID,
            user_id="597289a7-e26e-415d-ab4d-fa587e32899a",
            role="admin",
            created_at=now,
            updated_at=now
        ))
        db.commit()

    # Ensure test Operator Profile and Membership exist
    op_prof = db.query(Profile).filter(Profile.id == "00000000-0000-0000-0000-000000000002").first()
    if not op_prof:
        db.add(Profile(
            id="00000000-0000-0000-0000-000000000002",
            email="operator.user@recoverai.io",
            full_name="Operator User",
            role="operator",
            created_at=now,
            updated_at=now
        ))
        db.commit()

    op_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == DEFAULT_WORKSPACE_ID,
        WorkspaceMember.user_id == "00000000-0000-0000-0000-000000000002"
    ).first()
    if not op_member:
        db.add(WorkspaceMember(
            id="00000000-0000-0000-0000-000000000020",
            workspace_id=DEFAULT_WORKSPACE_ID,
            user_id="00000000-0000-0000-0000-000000000002",
            role="operator",
            created_at=now,
            updated_at=now
        ))
        db.commit()

    # Check if database already has records
    if db.query(Customer).count() > 0:
        logger.info("Database already seeded. Skipping initial customer/tx seeding.")
        return

    logger.info("Seeding minimal realistic sample records into RecoverAI database...")


    now = datetime.now(timezone.utc)

    # 1. Customers
    customers = [
        Customer(
            id="cust_771",
            name="Aditya Sharma",
            email="aditya.sharma@techcorp.in",
            phone="+91 98450 12345",
            tier="ENTERPRISE",
            ltv=185000.0,
            created_at=now - timedelta(days=90)
        ),
        Customer(
            id="cust_802",
            name="Priyanka Iyer",
            email="priyanka.i@zenithai.com",
            phone="+91 98112 34567",
            tier="VIP",
            ltv=340000.0,
            created_at=now - timedelta(days=120)
        ),
        Customer(
            id="cust_419",
            name="Rajesh Nair",
            email="rajesh.nair@vertexops.io",
            phone="+91 97000 54321",
            tier="GROWTH",
            ltv=62000.0,
            created_at=now - timedelta(days=45)
        ),
        Customer(
            id="cust_901",
            name="Kavita Menon",
            email="kavita@creativelab.co",
            phone="+91 97234 56789",
            tier="STANDARD",
            ltv=24000.0,
            created_at=now - timedelta(days=20)
        ),
        Customer(
            id="cust_112",
            name="Vikram Mehta",
            email="vikram.mehta@fintechlabs.in",
            phone="+91 99887 65432",
            tier="VIP",
            ltv=490000.0,
            created_at=now - timedelta(days=180)
        ),
        Customer(
            id="cust_654",
            name="Sneha Patel",
            email="sneha@cloudscale.net",
            phone="+91 99112 23344",
            tier="STANDARD",
            ltv=18000.0,
            created_at=now - timedelta(days=10)
        )
    ]
    db.add_all(customers)
    db.flush()

    # 2. Transactions
    transactions = [
        Transaction(
            id="tx_rec_98214",
            order_id="ORD-89421",
            customer_id="cust_771",
            amount=24999.0,
            currency="INR",
            method="Card",
            status="IN_PROGRESS",
            created_at=now - timedelta(minutes=4)
        ),
        Transaction(
            id="tx_rec_98215",
            order_id="ORD-89422",
            customer_id="cust_802",
            amount=48500.0,
            currency="INR",
            method="UPI",
            status="IN_PROGRESS",
            created_at=now - timedelta(minutes=12)
        ),
        Transaction(
            id="tx_rec_98216",
            order_id="ORD-89423",
            customer_id="cust_419",
            amount=14200.0,
            currency="INR",
            method="Card",
            status="COOLING_DOWN",
            created_at=now - timedelta(minutes=35)
        ),
        Transaction(
            id="tx_rec_98217",
            order_id="ORD-89424",
            customer_id="cust_901",
            amount=7999.0,
            currency="INR",
            method="UPI",
            status="IN_PROGRESS",
            created_at=now - timedelta(minutes=48)
        ),
        Transaction(
            id="tx_rec_98218",
            order_id="ORD-89425",
            customer_id="cust_112",
            amount=89000.0,
            currency="INR",
            method="NetBanking",
            status="RECOVERED",
            created_at=now - timedelta(minutes=110)
        ),
        Transaction(
            id="tx_rec_98219",
            order_id="ORD-89426",
            customer_id="cust_654",
            amount=5400.0,
            currency="INR",
            method="Card",
            status="PENDING_APPROVAL",
            created_at=now - timedelta(minutes=180)
        )
    ]
    db.add_all(transactions)
    db.flush()

    # 3. Payment Attempts
    attempts = [
        PaymentAttempt(
            id="att_1",
            transaction_id="tx_rec_98214",
            attempt_number=1,
            gateway="Razorpay",
            error_code="BAD_REQUEST_ERROR",
            error_description="3DS OTP verification expired on HDFC Credit Card",
            error_category="AUTHENTICATION_FAILED",
            latency_ms=1850,
            status="FAILED",
            created_at=now - timedelta(minutes=4)
        ),
        PaymentAttempt(
            id="att_2",
            transaction_id="tx_rec_98215",
            attempt_number=1,
            gateway="Razorpay",
            error_code="GATEWAY_TIMEOUT",
            error_description="NPCI UPI switch latency exceeded 15000ms (SBI Bank)",
            error_category="BANK_TIMEOUT",
            latency_ms=15200,
            status="FAILED",
            created_at=now - timedelta(minutes=12)
        ),
        PaymentAttempt(
            id="att_3",
            transaction_id="tx_rec_98216",
            attempt_number=1,
            gateway="Razorpay",
            error_code="INSUFFICIENT_FUNDS",
            error_description="Card limit exceeded on ICICI Platinum Corporate",
            error_category="INSUFFICIENT_FUNDS",
            latency_ms=920,
            status="FAILED",
            created_at=now - timedelta(minutes=35)
        ),
        PaymentAttempt(
            id="att_4",
            transaction_id="tx_rec_98218",
            attempt_number=1,
            gateway="Razorpay",
            error_code="GATEWAY_SESSION_EXPIRED",
            error_description="Corporate NetBanking session timeout",
            error_category="BANK_TIMEOUT",
            latency_ms=4200,
            status="FAILED",
            created_at=now - timedelta(minutes=110)
        ),
        PaymentAttempt(
            id="att_5",
            transaction_id="tx_rec_98218",
            attempt_number=2,
            gateway="Razorpay",
            error_code=None,
            error_description=None,
            error_category=None,
            latency_ms=1100,
            status="SUCCESS",
            created_at=now - timedelta(minutes=25)
        )
    ]
    db.add_all(attempts)
    db.flush()

    # 4. Recovery Cases
    cases = [
        RecoveryCase(
            id="rc_98214",
            transaction_id="tx_rec_98214",
            risk_amount=24999.0,
            failure_category="AUTHENTICATION_FAILED",
            recovery_probability=0.88,
            selected_strategy="SMART_PAYLINK_1CLICK",
            expected_recovery_value=21999.0,
            status="IN_PROGRESS",
            attempt_count=1,
            created_at=now - timedelta(minutes=4)
        ),
        RecoveryCase(
            id="rc_98215",
            transaction_id="tx_rec_98215",
            risk_amount=48500.0,
            failure_category="BANK_TIMEOUT",
            recovery_probability=0.94,
            selected_strategy="UPI_INTENT_FALLBACK",
            expected_recovery_value=45590.0,
            status="IN_PROGRESS",
            attempt_count=1,
            created_at=now - timedelta(minutes=12)
        ),
        RecoveryCase(
            id="rc_98216",
            transaction_id="tx_rec_98216",
            risk_amount=14200.0,
            failure_category="INSUFFICIENT_FUNDS",
            recovery_probability=0.62,
            selected_strategy="TIMED_SMART_RETRY",
            expected_recovery_value=8804.0,
            status="COOLING_DOWN",
            attempt_count=1,
            created_at=now - timedelta(minutes=35)
        ),
        RecoveryCase(
            id="rc_98217",
            transaction_id="tx_rec_98217",
            risk_amount=7999.0,
            failure_category="CHECKOUT_ABANDONED",
            recovery_probability=0.76,
            selected_strategy="WHATSAPP_CONCIERGE",
            expected_recovery_value=6079.0,
            status="IN_PROGRESS",
            attempt_count=1,
            created_at=now - timedelta(minutes=48)
        ),
        RecoveryCase(
            id="rc_98218",
            transaction_id="tx_rec_98218",
            risk_amount=89000.0,
            failure_category="BANK_TIMEOUT",
            recovery_probability=0.82,
            selected_strategy="SMART_PAYLINK_1CLICK",
            expected_recovery_value=72980.0,
            status="RECOVERED",
            attempt_count=1,
            created_at=now - timedelta(minutes=110),
            recovered_at=now - timedelta(minutes=25)
        ),
        RecoveryCase(
            id="rc_98219",
            transaction_id="tx_rec_98219",
            risk_amount=5400.0,
            failure_category="CARD_EXPIRED",
            recovery_probability=0.44,
            selected_strategy="INCENTIVIZED_DUNNING",
            expected_recovery_value=2376.0,
            status="PENDING_APPROVAL",
            attempt_count=2,
            created_at=now - timedelta(minutes=180)
        )
    ]
    db.add_all(cases)
    db.flush()

    # 5. Recovery Actions
    actions = [
        RecoveryAction(
            id="act_1",
            recovery_case_id="rc_98214",
            strategy="SMART_PAYLINK_1CLICK",
            channel="SMS",
            payload_data='{"link": "https://pay.recov.ai/pl_98214", "expires_in": 1800}',
            erv=21999.0,
            status="DISPATCHED",
            dispatched_at=now - timedelta(minutes=2)
        ),
        RecoveryAction(
            id="act_2",
            recovery_case_id="rc_98215",
            strategy="UPI_INTENT_FALLBACK",
            channel="IN_APP",
            payload_data='{"vpa": "zenith@hdfcbank", "mode": "intent"}',
            erv=45590.0,
            status="DISPATCHED",
            dispatched_at=now - timedelta(minutes=5)
        ),
        RecoveryAction(
            id="act_3",
            recovery_case_id="rc_98218",
            strategy="SMART_PAYLINK_1CLICK",
            channel="SMS",
            payload_data='{"link": "https://pay.recov.ai/pl_98218"}',
            erv=72980.0,
            status="COMPLETED",
            dispatched_at=now - timedelta(minutes=100)
        )
    ]
    db.add_all(actions)
    db.flush()

    # 6. Agent Decisions
    decisions = [
        AgentDecision(
            id="dec_1",
            recovery_case_id="rc_98214",
            model_name="XGBoost+Gemini-2.5-Flash",
            input_features='{"amount": 24999, "ltv": 185000, "error_type": "3DS_TIMEOUT"}',
            propensity_scores='{"SMART_PAYLINK_1CLICK": 0.88, "TIMED_SMART_RETRY": 0.32}',
            selected_action="SMART_PAYLINK_1CLICK",
            reasoning_summary="High customer LTV with transient OTP drop-off. 1-click SMS link provides highest ERV yield.",
            decided_at=now - timedelta(minutes=3)
        ),
        AgentDecision(
            id="dec_2",
            recovery_case_id="rc_98215",
            model_name="XGBoost+Gemini-2.5-Flash",
            input_features='{"amount": 48500, "ltv": 340000, "error_type": "SBI_TIMEOUT"}',
            propensity_scores='{"UPI_INTENT_FALLBACK": 0.94, "SMART_PAYLINK_1CLICK": 0.68}',
            selected_action="UPI_INTENT_FALLBACK",
            reasoning_summary="Bank switch latency detected on SBI. Auto-routing to secondary PSP produces 94% recovery probability.",
            decided_at=now - timedelta(minutes=10)
        )
    ]
    db.add_all(decisions)
    db.flush()

    # 7. Recovery Outcome for Recovered transaction
    outcomes = [
        RecoveryOutcome(
            id="out_1",
            recovery_case_id="rc_98218",
            recovered_amount=89000.0,
            payment_method_used="UPI",
            time_to_recover_seconds=5100,
            settled_at=now - timedelta(minutes=25)
        )
    ]
    db.add_all(outcomes)
    db.flush()

    # 8. Audit Logs
    audit_logs = [
        AuditLog(
            id="aud_1",
            recovery_case_id="rc_98214",
            transaction_id="tx_rec_98214",
            actor="AUTONOMOUS_AGENT",
            action_type="DISPATCH_INTERVENTION",
            target_resource="tx_rec_98214",
            details="Dispatched SMART_PAYLINK_1CLICK with ERV ₹21,999 (P_rec: 88%)",
            metadata_json='{"channel": "SMS", "expires_in_mins": 30}',
            created_at=now - timedelta(minutes=2)
        ),
        AuditLog(
            id="aud_2",
            recovery_case_id="rc_98215",
            transaction_id="tx_rec_98215",
            actor="SYSTEM_GUARDRAIL",
            action_type="ROUTE_FALLBACK_APPLIED",
            target_resource="tx_rec_98215",
            details="Bank switch latency threshold breached (15,200ms > 8,000ms max). Fallback to secondary UPI PSP active.",
            created_at=now - timedelta(minutes=5)
        ),
        AuditLog(
            id="aud_3",
            recovery_case_id="rc_98218",
            transaction_id="tx_rec_98218",
            actor="WEBHOOK_EVENT",
            action_type="PAYMENT_CAPTURED",
            target_resource="tx_rec_98218",
            details="Razorpay webhook received payment.captured for ₹89,000. Attributed to RecoverAI Paylink #PL_98218.",
            created_at=now - timedelta(minutes=25)
        ),
        AuditLog(
            id="aud_4",
            recovery_case_id="rc_98219",
            transaction_id="tx_rec_98219",
            actor="SYSTEM_GUARDRAIL",
            action_type="INTERVENTION_PAUSED",
            target_resource="tx_rec_98219",
            details="Discount ₹270 exceeds max autonomous rule limit of ₹250. Pushed to manual review queue.",
            created_at=now - timedelta(minutes=40)
        )
    ]
    db.add_all(audit_logs)

    db.commit()
    logger.info("Successfully seeded RecoverAI database with initial records!")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
