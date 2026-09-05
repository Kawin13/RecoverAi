"""
RecoverAI - Pre-Payment Cart & Checkout Abandonment Recovery Service
Tracks full checkout lifecycle states, identifies drop-offs, calculates ERV,
selects optimal recovery strategies, and aggregates the 5-stage abandonment funnel.
"""

import uuid
import json
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.logging import logger
from app.core.events import event_broadcaster
from app.services.notification_service import notification_service
from app.core.datetime_utils import diff_seconds
from app.models import CheckoutSession, Customer, Transaction, RecoveryCase, AuditLog
from app.schemas.checkout_sessions import (
    CheckoutSessionCreate,
    CheckoutSessionTransition,
    AbandonmentCaseDetail,
    AbandonmentFunnelResponse,
    FunnelStageItem
)

# Demo checkout abandonment timeout (short for live testing)
DEFAULT_DEMO_ABANDONMENT_TIMEOUT_SECONDS = 15

class AbandonmentService:
    def create_session(self, data: CheckoutSessionCreate, db: Session) -> CheckoutSession:
        """Initializes a new checkout session in the STARTED state."""
        # Find or create customer
        customer = None
        if data.customer_id:
            customer = db.query(Customer).filter(Customer.id == data.customer_id).first()

        if not customer:
            customer = db.query(Customer).filter(Customer.email == data.customer_email).first()

        if not customer:
            customer = Customer(
                id=f"cust_{uuid.uuid4().hex[:8]}",
                name=data.customer_name or "Shopper",
                email=data.customer_email or "shopper@example.com",
                phone=data.customer_phone or "+919876543210",
                tier=data.customer_tier or "STANDARD",
                ltv=round(data.cart_amount * 1.5, 2)
            )
            db.add(customer)
            db.flush()

        session_id = f"chk_{uuid.uuid4().hex[:10]}"
        order_id = data.order_id or f"order_chk_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)

        session = CheckoutSession(
            id=session_id,
            customer_id=customer.id,
            order_id=order_id,
            cart_amount=data.cart_amount,
            cart_value=data.cart_amount,
            created_at=now,
            status="STARTED",
            selected_method=data.selected_method or "UPI",
            payment_attempted=False,
            started_at=now,
            last_activity_at=now,
            is_demo_simulation=data.is_demo_simulation
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        # Emit real-time telemetry
        event_broadcaster.broadcast_sync("CHECKOUT_STARTED", {
            "checkout_session_id": session.id,
            "order_id": session.order_id,
            "cart_amount": session.cart_amount,
            "customer_name": customer.name,
            "is_demo_simulation": session.is_demo_simulation,
            "timestamp": now.isoformat()
        })

        logger.info(f"Checkout Session {session.id} started for Customer {customer.name} (₹{session.cart_amount:,.2f})")
        return session

    def transition_session(
        self,
        session_id: str,
        transition: CheckoutSessionTransition,
        db: Session
    ) -> CheckoutSession:
        """Transitions a checkout session along its lifecycle stages."""
        session = db.query(CheckoutSession).filter(CheckoutSession.id == session_id).first()
        if not session:
            raise ValueError(f"Checkout session '{session_id}' not found")

        prev_status = session.status
        new_status = transition.new_status.upper().strip()
        now = datetime.now(timezone.utc)

        session.status = new_status
        session.last_activity_at = now

        if transition.selected_method:
            session.selected_method = transition.selected_method
        if transition.payment_attempted is not None:
            session.payment_attempted = transition.payment_attempted
        elif new_status in ("PAYMENT_INITIATED", "COMPLETED"):
            session.payment_attempted = True

        if new_status == "COMPLETED":
            session.completed_at = now
        elif new_status == "ABANDONED":
            session.abandoned_at = now

        db.commit()
        db.refresh(session)

        event_broadcaster.broadcast_sync("CHECKOUT_TRANSITION", {
            "checkout_session_id": session.id,
            "prev_status": prev_status,
            "new_status": new_status,
            "selected_method": session.selected_method,
            "payment_attempted": session.payment_attempted,
            "is_demo_simulation": session.is_demo_simulation,
            "timestamp": now.isoformat()
        })

        # If transitioning to ABANDONED, automatically create recovery case
        if new_status == "ABANDONED" and not session.recovery_case_id:
            self.create_abandonment_recovery_case(session, db)

        return session

    def check_and_mark_abandoned(
        self,
        db: Session,
        timeout_seconds: int = DEFAULT_DEMO_ABANDONMENT_TIMEOUT_SECONDS
    ) -> List[CheckoutSession]:
        """
        Scans active checkout sessions where inactivity exceeds timeout.
        Marks them ABANDONED and launches bounded recovery cases.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=timeout_seconds)
        active_states = ["STARTED", "CUSTOMER_IDENTIFIED", "PAYMENT_METHOD_VIEWED", "PAYMENT_INITIATED"]

        abandoned_sessions = (
            db.query(CheckoutSession)
            .filter(
                CheckoutSession.status.in_(active_states),
                CheckoutSession.last_activity_at < cutoff
            )
            .all()
        )

        processed = []
        for s in abandoned_sessions:
            s.status = "ABANDONED"
            s.abandoned_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(s)
            self.create_abandonment_recovery_case(s, db)
            processed.append(s)

        return processed

    def calculate_abandonment_erv(
        self,
        session: CheckoutSession,
        customer: Customer
    ) -> Dict[str, Any]:
        """
        Calculates customer value, recency, historical conversion, recovery probability,
        and Expected Recovery Value (ERV) for pre-payment cart drop-offs.
        """
        cart = float(session.cart_amount)
        tier = (customer.tier or "STANDARD").upper()
        ltv = float(customer.ltv or 0.0)

        # 1. Historical conversion propensity by tier
        tier_conversion_map = {
            "ENTERPRISE": 0.75,
            "VIP": 0.65,
            "GROWTH": 0.50,
            "STANDARD": 0.35
        }
        hist_conv = tier_conversion_map.get(tier, 0.35)

        # 2. Recency calculation
        last_active = session.last_activity_at or session.started_at or datetime.now(timezone.utc)
        recency_mins = max(0.1, diff_seconds(datetime.now(timezone.utc), last_active) / 60.0)

        # 3. Intent weight based on drop-off stage
        stage_intent_weights = {
            "PAYMENT_INITIATED": 0.65,    # Customer opened payment switch, highest purchase intent
            "PAYMENT_METHOD_VIEWED": 0.52, # Browsed payment options
            "CUSTOMER_IDENTIFIED": 0.38,   # Filled contact details
            "STARTED": 0.22,               # Just loaded product
            "ABANDONED": 0.45
        }
        stage_weight = stage_intent_weights.get(session.status, 0.40)

        # 4. Statistical recovery probability
        raw_prob = (stage_weight * 0.55) + (hist_conv * 0.35) + min(0.10, ltv / 50000.0)
        # Recency decay (slight reduction over time)
        recency_decay = max(0.70, 1.0 - (recency_mins * 0.005))
        prob = round(min(0.85, max(0.08, raw_prob * recency_decay)), 2)

        # 5. Expected Recovery Value (ERV) in INR
        intervention_cost = 5.0  # WhatsApp/SMS gateway
        friction_penalty = 3.0
        erv = round(max(0.0, (prob * cart) - intervention_cost - friction_penalty), 2)

        # 6. Strategy selection
        if cart >= 10000.0 or tier in ("VIP", "ENTERPRISE"):
            strategy = "HUMAN_ESCALATION"
            channel = "EMAIL_SIMULATION"
        elif session.payment_attempted or session.status in ("PAYMENT_METHOD_VIEWED", "PAYMENT_INITIATED"):
            strategy = "PAYMENT_LINK"
            channel = "SMS_SIMULATION"
        elif prob < 0.20:
            strategy = "NO_ACTION"
            channel = "IN_APP"
        else:
            strategy = "PERSONALIZED_REMINDER"
            channel = "WHATSAPP_SIMULATION"

        return {
            "customer_value": ltv,
            "cart_amount": cart,
            "recency_minutes": round(recency_mins, 1),
            "historical_conversion": hist_conv,
            "preferred_payment_method": session.selected_method or "UPI",
            "recovery_probability": prob,
            "expected_recovery_value": erv,
            "selected_strategy": strategy,
            "channel": channel
        }

    def create_abandonment_recovery_case(
        self,
        session: CheckoutSession,
        db: Session
    ) -> RecoveryCase:
        """
        Creates a bounded RecoveryCase for an abandoned checkout session.
        Preserves complete relational integrity with transactions and audit trails.
        """
        if session.recovery_case_id:
            existing = db.query(RecoveryCase).filter(RecoveryCase.id == session.recovery_case_id).first()
            if existing:
                return existing

        customer = db.query(Customer).filter(Customer.id == session.customer_id).first()
        if not customer:
            customer = Customer(
                id=session.customer_id,
                name="Shopper",
                email="shopper@example.com",
                tier="STANDARD"
            )
            db.add(customer)
            db.flush()

        # Compute ERV and recovery strategy
        metrics = self.calculate_abandonment_erv(session, customer)
        case_id = f"case_abn_{uuid.uuid4().hex[:8]}"

        # Create placeholder transaction to maintain referential integrity
        tx_id = f"tx_chk_{session.id}"
        tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
        if not tx:
            tx = Transaction(
                id=tx_id,
                order_id=session.order_id,
                customer_id=customer.id,
                amount=session.cart_amount,
                currency="INR",
                method=session.selected_method or "UPI",
                status="FAILED"
            )
            db.add(tx)
            db.flush()

        now = datetime.now(timezone.utc)
        case = RecoveryCase(
            id=case_id,
            transaction_id=tx.id,
            risk_amount=session.cart_amount,
            failure_category="ABANDONMENT",
            recovery_probability=metrics["recovery_probability"],
            selected_strategy=metrics["selected_strategy"],
            expected_recovery_value=metrics["expected_recovery_value"],
            status="ACTION_SCHEDULED",
            current_step="ACTION_SCHEDULED",
            max_attempts=3,
            attempt_count=1,
            channel=metrics["channel"],
            scheduled_at=now,
            executed_at=now,
            execution_payload=json.dumps({
                "source": "CHECKOUT_ABANDONMENT",
                "checkout_session_id": session.id,
                "dropped_at_step": session.status,
                "is_demo_simulation": session.is_demo_simulation
            })
        )
        db.add(case)
        session.recovery_case_id = case.id
        db.flush()

        # Generate multi-lingual recovery notification with DEMO DELIVERY labeling
        recipient = customer.phone if metrics["channel"] in ("SMS_SIMULATION", "WHATSAPP_SIMULATION") else customer.email
        notification = notification_service.send_recovery_notification(
            recipient=recipient or "shopper@example.com",
            channel=metrics["channel"],
            strategy=metrics["selected_strategy"],
            customer_name=customer.name,
            amount=session.cart_amount,
            action_url=f"{settings.FRONTEND_PUBLIC_URL.rstrip('/')}/demo-checkout?order_id={session.order_id}&recover=true",
            language="en",
            recovery_case_id=case.id
        )

        # Log into AuditLog
        audit = AuditLog(
            id=f"aud_abn_{uuid.uuid4().hex[:8]}",
            recovery_case_id=case.id,
            transaction_id=tx.id,
            actor="ABANDONMENT_DETECTOR",
            action_type="CHECKOUT_ABANDONED",
            target_resource=session.id,
            details=(
                f"Checkout session {session.id} marked ABANDONED (Cart: ₹{session.cart_amount:,.2f}). "
                f"RecoverAI launched {metrics['selected_strategy']} via {metrics['channel']} "
                f"(ERV: ₹{metrics['expected_recovery_value']:,.2f}, P: {metrics['recovery_probability']:.0%})."
            ),
            metadata_json=json.dumps({
                "checkout_session_id": session.id,
                "order_id": session.order_id,
                "dropped_at_step": session.status,
                "is_demo_simulation": session.is_demo_simulation,
                "metrics": metrics,
                "notification_id": notification.notification_id
            }),
            created_at=now
        )
        db.add(audit)
        db.commit()
        db.refresh(case)

        # Broadcast SSE
        event_broadcaster.broadcast_sync("CHECKOUT_ABANDONED", {
            "checkout_session_id": session.id,
            "recovery_case_id": case.id,
            "cart_amount": session.cart_amount,
            "strategy": metrics["selected_strategy"],
            "erv": metrics["expected_recovery_value"],
            "is_demo_simulation": session.is_demo_simulation,
            "timestamp": now.isoformat()
        })

        logger.info(f"Abandoned session {session.id} converted into RecoveryCase {case.id} (ERV: ₹{metrics['expected_recovery_value']:,.2f})")
        return case

    def get_funnel_metrics(self, db: Session) -> AbandonmentFunnelResponse:
        """Aggregates the 5-stage abandonment funnel metrics."""
        sessions = db.query(CheckoutSession).all()
        total = len(sessions)

        checkout_started = total
        payment_attempted = sum(1 for s in sessions if s.payment_attempted or s.status in ("PAYMENT_INITIATED", "COMPLETED"))
        abandoned = sum(1 for s in sessions if s.status == "ABANDONED")
        recovery_initiated = sum(1 for s in sessions if s.recovery_case_id is not None)
        recovered = sum(1 for s in sessions if s.status == "COMPLETED")

        abandonment_rate = round((abandoned / max(1, checkout_started)), 3)
        recovery_rate = round((recovered / max(1, abandoned)), 3)

        at_risk_inr = sum(s.cart_amount for s in sessions if s.status == "ABANDONED")
        recovered_inr = sum(s.cart_amount for s in sessions if s.status == "COMPLETED")

        # Funnel stage steps
        stages = [
            FunnelStageItem(
                stage_key="STARTED",
                stage_name="Checkout Started",
                count=checkout_started,
                conversion_rate=1.0,
                drop_off_count=max(0, checkout_started - payment_attempted)
            ),
            FunnelStageItem(
                stage_key="PAYMENT_ATTEMPTED",
                stage_name="Payment Attempted",
                count=payment_attempted,
                conversion_rate=round(payment_attempted / max(1, checkout_started), 2),
                drop_off_count=max(0, payment_attempted - (checkout_started - abandoned))
            ),
            FunnelStageItem(
                stage_key="ABANDONED",
                stage_name="Abandoned",
                count=abandoned,
                conversion_rate=round(abandoned / max(1, checkout_started), 2),
                drop_off_count=max(0, abandoned - recovery_initiated)
            ),
            FunnelStageItem(
                stage_key="RECOVERY_INITIATED",
                stage_name="Recovery Initiated",
                count=recovery_initiated,
                conversion_rate=round(recovery_initiated / max(1, abandoned), 2) if abandoned else 1.0,
                drop_off_count=max(0, recovery_initiated - recovered)
            ),
            FunnelStageItem(
                stage_key="RECOVERED",
                stage_name="Recovered",
                count=recovered,
                conversion_rate=round(recovered / max(1, recovery_initiated), 2) if recovery_initiated else 0.0,
                drop_off_count=0
            )
        ]

        return AbandonmentFunnelResponse(
            total_sessions=total,
            checkout_started=checkout_started,
            payment_attempted=payment_attempted,
            abandoned=abandoned,
            recovery_initiated=recovery_initiated,
            recovered=recovered,
            abandonment_rate=abandonment_rate,
            recovery_rate=recovery_rate,
            at_risk_abandoned_inr=round(at_risk_inr, 2),
            recovered_abandoned_inr=round(recovered_inr, 2),
            stages=stages
        )

abandonment_service = AbandonmentService()
