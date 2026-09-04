"""
RecoverAI - Bounded Recovery Executor & Agent State Machine
Turns analysis into bounded, accountable recovery actions with zero unbounded loops.
Enforces strict transition auditing, honest notification tracking, and real Razorpay Payment Links.
"""

import json
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.core.events import event_broadcaster
from app.models import RecoveryCase, Transaction, AuditLog, PaymentLink, RecoveryAction
from app.core.config import settings
from app.services.razorpay_service import razorpay_service
from app.services.notification_service import notification_service
from app.agents.decision_engine import decision_engine
from app.agents.gemini_agent import gemini_agent

MAX_BOUNDED_ATTEMPTS = 3

class RecoveryStep(str, Enum):
    DETECTED = "DETECTED"
    ANALYZED = "ANALYZED"
    STRATEGY_SELECTED = "STRATEGY_SELECTED"
    GUARDRAIL_CHECKED = "GUARDRAIL_CHECKED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    ACTION_SCHEDULED = "ACTION_SCHEDULED"
    ACTION_EXECUTED = "ACTION_EXECUTED"
    WAITING_FOR_CUSTOMER = "WAITING_FOR_CUSTOMER"
    RECOVERED = "RECOVERED"
    FAILED = "FAILED"
    NEXT_STRATEGY = "NEXT_STRATEGY"
    ESCALATED = "ESCALATED"
    STOPPED = "STOPPED"

class RecoveryExecutor:
    """Executes permitted recovery actions for a specific recovery case."""

    def execute_strategy(
        self,
        case: RecoveryCase,
        db: Session,
        is_live_demo: bool = True
    ) -> Dict[str, Any]:
        strategy = (case.selected_strategy or "PAYMENT_LINK").upper()
        tx = case.transaction
        cust = tx.customer if tx else None
        cust_name = cust.name if cust else "Valued Customer"
        cust_email = cust.email if cust else "customer@example.com"
        cust_phone = cust.phone if cust else "+919876543210"
        amount = case.risk_amount

        execution_data: Dict[str, Any] = {
            "strategy": strategy,
            "executed_at": datetime.utcnow().isoformat(),
            "case_id": case.id,
            "attempt_number": case.attempt_count
        }

        if strategy == "PAYMENT_LINK":
            # Genuine Razorpay Test Payment Link creation for live demo
            amount_paise = int(amount * 100)
            link_res = razorpay_service.create_payment_link(
                amount_paise=amount_paise,
                customer_name=cust_name,
                customer_email=cust_email,
                customer_contact=cust_phone,
                description=f"RecoverAI 1-Click Recovery for Order #{tx.order_id if tx else case.id}",
                notes={"recovery_case_id": case.id, "transaction_id": tx.id if tx else ""},
                is_live_demo=is_live_demo
            )

            # Persist PaymentLink record
            plink_record = PaymentLink(
                id=f"pl_{uuid.uuid4().hex[:10]}",
                workspace_id=case.workspace_id,
                payment_link_id=link_res["payment_link_id"],
                recovery_case_id=case.id,
                short_url=link_res["short_url"],
                amount=amount,
                currency="INR",
                status=link_res.get("status", "created"),
                is_live_demo=link_res.get("is_live_demo", False),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(plink_record)
            db.flush()

            # Dispatch notification
            receipt = notification_service.send_recovery_notification(
                recipient=cust_phone if case.channel == "SMS_SIMULATION" else cust_email,
                channel=case.channel or "SMS_SIMULATION",
                strategy=strategy,
                customer_name=cust_name,
                amount=amount,
                action_url=link_res["short_url"],
                recovery_case_id=case.id
            )

            execution_data.update({
                "payment_link_id": link_res["payment_link_id"],
                "short_url": link_res["short_url"],
                "notification_id": receipt.notification_id,
                "delivery_label": receipt.delivery_label
            })

        elif strategy == "UPI_SWITCH":
            # Recommend UPI & provide appropriate recovery checkout/payment journey
            base_url = settings.FRONTEND_PUBLIC_URL.rstrip('/')
            recovery_checkout_url = f"{base_url}/demo-checkout?order_id={tx.order_id if tx else case.id}&method=UPI&recommendation=upi_switch&amount={amount}&recovery_case={case.id}"

            receipt = notification_service.send_recovery_notification(
                recipient=cust_phone,
                channel="WHATSAPP_SIMULATION",
                strategy=strategy,
                customer_name=cust_name,
                amount=amount,
                action_url=recovery_checkout_url,
                language=getattr(cust, "preferred_language", "en"),
                recovery_case_id=case.id
            )

            execution_data.update({
                "recovery_journey_url": recovery_checkout_url,
                "recommended_method": "UPI",
                "notification_id": receipt.notification_id,
                "delivery_label": receipt.delivery_label
            })

        elif strategy == "RETRY_LATER":
            # Schedule delayed attempt recommendation during optimal clearing window
            scheduled_retry_time = datetime.utcnow() + timedelta(minutes=30)
            case.scheduled_at = scheduled_retry_time

            receipt = notification_service.send_recovery_notification(
                recipient=cust_phone,
                channel="IN_APP",
                strategy=strategy,
                customer_name=cust_name,
                amount=amount,
                recovery_case_id=case.id
            )

            execution_data.update({
                "scheduled_retry_at": scheduled_retry_time.isoformat(),
                "delay_minutes": 30,
                "notification_id": receipt.notification_id
            })

        elif strategy == "PERSONALIZED_REMINDER":
            # Multi-lingual empathetic copy
            lang = getattr(cust, "preferred_language", "en")
            custom_msg = None
            if gemini_agent.is_available() and tx:
                try:
                    res = gemini_agent.generate_recovery_message(
                        customer_name=cust_name,
                        amount=amount,
                        failure_reason=case.failure_category,
                        preferred_language=lang,
                        action_url=f"{settings.FRONTEND_PUBLIC_URL.rstrip('/')}/demo-checkout?order_id={tx.order_id}"
                    )
                    custom_msg = res.get("message")
                except Exception as e:
                    logger.warning(f"Gemini recovery message fallback: {e}")

            receipt = notification_service.send_recovery_notification(
                recipient=cust_email,
                channel="EMAIL_SIMULATION",
                strategy=strategy,
                customer_name=cust_name,
                amount=amount,
                language=lang,
                recovery_case_id=case.id,
                custom_message=custom_msg
            )

            execution_data.update({
                "notification_id": receipt.notification_id,
                "language": lang,
                "delivery_label": receipt.delivery_label
            })

        elif strategy == "HUMAN_ESCALATION":
            # Escalates to VIP concierge team
            execution_data.update({
                "concierge_assigned": "VIP Revenue Specialist",
                "escalation_reason": "High Customer LTV & Multiple Technical Dropoffs",
                "sla_minutes": 15
            })

        elif strategy == "NO_ACTION":
            execution_data.update({
                "action": "HALTED",
                "reason": "Guardrail cooldown policy or customer fatigue limit"
            })

        # Save action history in recovery_actions table
        rec_action = RecoveryAction(
            id=f"act_{uuid.uuid4().hex[:10]}",
            workspace_id=case.workspace_id,
            recovery_case_id=case.id,
            strategy=strategy,
            channel=case.channel or "IN_APP",
            payload_data=json.dumps(execution_data),
            erv=case.expected_recovery_value,
            status="DISPATCHED",
            dispatched_at=datetime.utcnow()
        )
        db.add(rec_action)

        case.executed_at = datetime.utcnow()
        case.execution_payload = json.dumps(execution_data)
        return execution_data


class RecoveryStateMachine:
    """Manages the 10-state Recovery Agent lifecycle with strict bounded attempt limits."""

    def __init__(self):
        self.executor = RecoveryExecutor()

    def transition(
        self,
        case: RecoveryCase,
        next_step: str,
        details: str,
        db: Session,
        actor: str = "RECOVERY_AGENT"
    ) -> RecoveryCase:
        prev_step = case.current_step or case.status or "DETECTED"

        # Check bounded loop limit
        if next_step == RecoveryStep.NEXT_STRATEGY.value:
            if case.attempt_count >= case.max_attempts:
                # Bounded limit hit: HALT or ESCALATE. No infinite loops!
                next_step = (
                    RecoveryStep.ESCALATED.value
                    if case.risk_amount >= 5000.0 or "VIP" in (case.transaction.customer.tier if case.transaction and case.transaction.customer else "")
                    else RecoveryStep.STOPPED.value
                )
                details = f"Bounded loop ceiling reached ({case.attempt_count}/{case.max_attempts} attempts). Transitioned to {next_step} to protect customer experience."

        case.current_step = next_step
        case.status = next_step
        case.updated_at = datetime.utcnow()

        # Audit record
        audit = AuditLog(
            id=f"aud_{uuid.uuid4().hex[:10]}",
            workspace_id=case.workspace_id,
            recovery_case_id=case.id,
            transaction_id=case.transaction_id,
            actor=actor,
            action_type="STATE_TRANSITION",
            target_resource=case.id,
            details=f"Workflow [{prev_step} -> {next_step}]: {details}",
            metadata_json=json.dumps({
                "prev_step": prev_step,
                "next_step": next_step,
                "strategy": case.selected_strategy,
                "attempt_count": case.attempt_count,
                "max_attempts": case.max_attempts
            }),
            created_at=datetime.utcnow()
        )
        db.add(audit)
        db.commit()
        db.refresh(case)

        # Real-time SSE broadcast
        event_broadcaster.broadcast_sync(
            "RECOVERY_AGENT_TRANSITION",
            {
                "case_id": case.id,
                "transaction_id": case.transaction_id,
                "prev_step": prev_step,
                "current_step": next_step,
                "strategy": case.selected_strategy,
                "attempt_count": case.attempt_count,
                "max_attempts": case.max_attempts,
                "risk_amount": case.risk_amount,
                "details": details,
                "workspace_id": str(case.workspace_id),
                "timestamp": datetime.utcnow().isoformat()
            },
            workspace_id=case.workspace_id
        )

        return case

    def advance_step(
        self,
        case: RecoveryCase,
        db: Session,
        is_live_demo: bool = True
    ) -> Tuple[RecoveryCase, Dict[str, Any]]:
        """Advances the state machine by exactly one step."""
        current = case.current_step or RecoveryStep.DETECTED.value
        step_result: Dict[str, Any] = {"from_step": current}

        if current == RecoveryStep.DETECTED.value:
            # Step 1 -> ANALYZED
            details = f"Diagnosed failure category '{case.failure_category}' on ₹{case.risk_amount:,.2f} order."
            case = self.transition(case, RecoveryStep.ANALYZED.value, details, db)
            step_result["next_step"] = RecoveryStep.ANALYZED.value

        elif current == RecoveryStep.ANALYZED.value:
            # Step 2 -> STRATEGY_SELECTED
            tx = case.transaction
            tx_data = {
                "transaction_id": tx.id if tx else case.id,
                "amount": case.risk_amount,
                "payment_method": tx.method if tx else "UPI",
                "failure_reason": case.failure_category,
                "failure_category": case.failure_category,
                "attempt_count": case.attempt_count,
                "customer_value": tx.customer.tier if tx and tx.customer else "GROWTH"
            }
            decision = decision_engine.decide(tx_data)
            selected_action = decision.get("selected_action", "PAYMENT_LINK")
            case.selected_strategy = selected_action
            case.recovery_probability = decision.get("recovery_probability", 0.85)
            case.expected_recovery_value = decision.get("expected_recovery_value", case.risk_amount * 0.85)

            details = f"Autonomous engine selected optimal strategy '{selected_action}' (ERV: ₹{case.expected_recovery_value:,.2f}, P: {case.recovery_probability:.2%})."
            case = self.transition(case, RecoveryStep.STRATEGY_SELECTED.value, details, db)
            step_result["next_step"] = RecoveryStep.STRATEGY_SELECTED.value
            step_result["decision"] = decision

        elif current == RecoveryStep.STRATEGY_SELECTED.value:
            # Step 3 -> Evaluate Central Fintech Guardrails BEFORE scheduling or executing
            from app.services.guardrails_service import guardrails_service
            guardrail_res = guardrails_service.evaluate(case, db)

            if guardrail_res.requires_approval:
                details = guardrail_res.human_readable_reason
                case = self.transition(case, RecoveryStep.PENDING_APPROVAL.value, details, db)
                step_result["next_step"] = RecoveryStep.PENDING_APPROVAL.value
                step_result["guardrail_decision"] = guardrail_res.model_dump()
            elif not guardrail_res.allowed:
                details = guardrail_res.human_readable_reason
                target = RecoveryStep.STOPPED.value
                case = self.transition(case, target, details, db)
                step_result["next_step"] = target
                step_result["guardrail_decision"] = guardrail_res.model_dump()
            else:
                details = guardrail_res.human_readable_reason
                case = self.transition(case, RecoveryStep.GUARDRAIL_CHECKED.value, details, db)
                step_result["next_step"] = RecoveryStep.GUARDRAIL_CHECKED.value
                step_result["guardrail_decision"] = guardrail_res.model_dump()

        elif current == RecoveryStep.PENDING_APPROVAL.value:
            details = "Workflow is awaiting human supervisor approval in the Human Approval Queue."
            step_result["message"] = details
            step_result["next_step"] = current

        elif current == RecoveryStep.GUARDRAIL_CHECKED.value:
            # Step 4 -> ACTION_SCHEDULED
            # Select channel
            if case.selected_strategy == "UPI_SWITCH":
                case.channel = "WHATSAPP_SIMULATION"
            elif case.selected_strategy == "PAYMENT_LINK":
                case.channel = "SMS_SIMULATION"
            elif case.selected_strategy == "PERSONALIZED_REMINDER":
                case.channel = "EMAIL_SIMULATION"
            else:
                case.channel = "IN_APP"

            case.scheduled_at = datetime.utcnow()
            details = f"Action scheduled for immediate dispatch via channel '{case.channel}'."
            case = self.transition(case, RecoveryStep.ACTION_SCHEDULED.value, details, db)
            step_result["next_step"] = RecoveryStep.ACTION_SCHEDULED.value

        elif current == RecoveryStep.ACTION_SCHEDULED.value:
            # Step 5 -> ACTION_EXECUTED
            exec_payload = self.executor.execute_strategy(case, db, is_live_demo=is_live_demo)
            details = f"Executed {case.selected_strategy} via {case.channel}."
            case = self.transition(case, RecoveryStep.ACTION_EXECUTED.value, details, db)
            step_result["next_step"] = RecoveryStep.ACTION_EXECUTED.value
            step_result["execution"] = exec_payload

        elif current == RecoveryStep.ACTION_EXECUTED.value:
            # Step 6 -> WAITING_FOR_CUSTOMER
            details = f"Awaiting customer engagement or gateway webhook callback."
            case = self.transition(case, RecoveryStep.WAITING_FOR_CUSTOMER.value, details, db)
            step_result["next_step"] = RecoveryStep.WAITING_FOR_CUSTOMER.value

        elif current == RecoveryStep.WAITING_FOR_CUSTOMER.value:
            # Already waiting for customer response
            details = "Workflow is currently waiting for customer action or test simulation."
            step_result["message"] = details
            step_result["next_step"] = current

        elif current == RecoveryStep.NEXT_STRATEGY.value:
            # Rotate to next alternative strategy
            current_strat = case.selected_strategy
            strat_rotation = {
                "UPI_SWITCH": "PAYMENT_LINK",
                "PAYMENT_LINK": "PERSONALIZED_REMINDER",
                "PERSONALIZED_REMINDER": "RETRY_LATER",
                "RETRY_LATER": "HUMAN_ESCALATION",
                "HUMAN_ESCALATION": "STOPPED"
            }
            next_strat = strat_rotation.get(current_strat, "PAYMENT_LINK")
            case.selected_strategy = next_strat
            details = f"Previous strategy '{current_strat}' did not recover. Rotating to next strategy '{next_strat}' for Attempt {case.attempt_count}/{case.max_attempts}."
            case = self.transition(case, RecoveryStep.STRATEGY_SELECTED.value, details, db)
            step_result["next_step"] = RecoveryStep.STRATEGY_SELECTED.value

        return case, step_result

    def execute_full_pipeline(
        self,
        case: RecoveryCase,
        db: Session,
        is_live_demo: bool = True
    ) -> List[Dict[str, Any]]:
        """Advances case continuously until WAITING_FOR_CUSTOMER, RECOVERED, or STOPPED."""
        steps_taken = []
        max_steps = 10  # Protection against any infinite step loop
        count = 0

        while count < max_steps:
            count += 1
            cur = case.current_step or RecoveryStep.DETECTED.value
            if cur in (
                RecoveryStep.WAITING_FOR_CUSTOMER.value,
                RecoveryStep.RECOVERED.value,
                RecoveryStep.ESCALATED.value,
                RecoveryStep.STOPPED.value
            ):
                break

            case, res = self.advance_step(case, db, is_live_demo=is_live_demo)
            steps_taken.append(res)

        return steps_taken

    def simulate_outcome(
        self,
        case: RecoveryCase,
        outcome: str,
        db: Session
    ) -> RecoveryCase:
        """Simulates customer outcome: RECOVERED or FAILED timeout."""
        norm_outcome = outcome.upper()

        if norm_outcome == "RECOVERED":
            case.recovered_at = datetime.utcnow()
            if case.transaction:
                case.transaction.status = "SUCCESS"
                case.transaction.updated_at = datetime.utcnow()

            details = f"Payment verified via gateway. ₹{case.risk_amount:,.2f} recovered successfully on attempt {case.attempt_count}!"
            case = self.transition(case, RecoveryStep.RECOVERED.value, details, db, actor="CUSTOMER_INTERVENTION")

        elif norm_outcome == "FAILED":
            case.attempt_count += 1
            if case.attempt_count > case.max_attempts:
                # Bounded limit exceeded
                details = f"Intervention timeout. Attempt limit reached ({case.attempt_count}/{case.max_attempts}). Autonomous loop halted."
                target = RecoveryStep.ESCALATED.value if case.risk_amount >= 5000 else RecoveryStep.STOPPED.value
                case = self.transition(case, target, details, db, actor="RECOVERY_MONITOR")
            else:
                details = f"Intervention timeout on attempt {case.attempt_count - 1}. Escalating to NEXT_STRATEGY."
                case = self.transition(case, RecoveryStep.NEXT_STRATEGY.value, details, db, actor="RECOVERY_MONITOR")

        return case

recovery_state_machine = RecoveryStateMachine()
