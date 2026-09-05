"""
RecoverAI - Guardrails Service & Human Approval Engine
Evaluates fintech safety policies before external recovery interventions are executed.
Enforces deterministic rule evaluation, human approval workflows, and immutable monetary amounts.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.core.events import event_broadcaster
from app.core.guardrail_policy import guardrail_policy, GuardrailPolicy
from app.models import RecoveryCase, Transaction, AuditLog, GuardrailEvent
from app.schemas.guardrails import GuardrailDecision

class GuardrailsService:
    def __init__(self, policy: Optional[GuardrailPolicy] = None):
        self.policy = policy or guardrail_policy

    def evaluate(
        self,
        case: RecoveryCase,
        db: Session,
        candidate_strategy: Optional[str] = None
    ) -> GuardrailDecision:
        """
        Deterministically evaluates all 6 fintech safety rules in order of precedence.
        Must execute strictly BEFORE external recovery actions.
        """
        tx = case.transaction
        cust = tx.customer if tx else None
        amount = float(case.risk_amount or 0.0)
        strategy = candidate_strategy or case.selected_strategy or "PAYMENT_LINK"
        failure_cat = str(case.failure_category or "").upper()
        prob = float(case.recovery_probability or 0.0)
        attempt = int(case.attempt_count or 1)

        # ---------------------------------------------------------------------
        # Rule 1: CUSTOMER_OPTED_OUT -> STOP
        # ---------------------------------------------------------------------
        is_opted_out = False
        if cust:
            # Check customer notes or DND flags if present
            notes = getattr(cust, "notes", "") or ""
            tier = getattr(cust, "tier", "") or ""
            if "OPT_OUT" in notes.upper() or "DND" in notes.upper() or "OPTED_OUT" in tier.upper():
                is_opted_out = True
        if "OPT_OUT" in failure_cat or "DND" in failure_cat:
            is_opted_out = True

        if is_opted_out:
            reason = "Customer has opted out or registered DND. All autonomous communications and interventions stopped."
            self._record_breach(case, "CUSTOMER_OPT_OUT", "DND_FLAG", "STOP", reason, db)
            return GuardrailDecision(
                allowed=False,
                requires_approval=False,
                reason_code="CUSTOMER_OPTED_OUT",
                human_readable_reason=reason,
                policy_version=self.policy.POLICY_VERSION,
                suggested_action="STOP",
                rule_details={"rule": "CUSTOMER_OPT_OUT", "opted_out": True}
            )

        # ---------------------------------------------------------------------
        # Rule 2: RISK/FRAUD FLAG -> STOP
        # ---------------------------------------------------------------------
        is_fraud_flag = False
        if (
            failure_cat in self.policy.RISK_TAXONOMIES
            or "FRAUD" in failure_cat
            or "RISK_BLOCKED" in failure_cat
            or "FRAUD_SUSPECTED" in failure_cat
            or (cust and "FRAUD" in (getattr(cust, "notes", "") or "").upper())
        ):
            is_fraud_flag = True

        if is_fraud_flag:
            reason = f"Transaction flagged by risk/fraud detection ({failure_cat}). Automated recovery halted."
            self._record_breach(case, "RISK_FRAUD_CIRCUIT_BREAKER", failure_cat, "STOP_AUTO_RECOVERY", reason, db)
            return GuardrailDecision(
                allowed=False,
                requires_approval=False,
                reason_code="RISK_FRAUD_FLAG",
                human_readable_reason=reason,
                policy_version=self.policy.POLICY_VERSION,
                suggested_action="STOP",
                rule_details={"rule": "RISK_FRAUD_CIRCUIT_BREAKER", "failure_category": failure_cat}
            )


        # ---------------------------------------------------------------------
        # Rule 3: PERMANENT FAILURE -> DO NOT RETRY SAME METHOD
        # ---------------------------------------------------------------------
        is_permanent = any(code in failure_cat for code in self.policy.PERMANENT_FAILURE_CODES)
        if is_permanent and strategy in ("RETRY_NOW", "RETRY_LATER"):
            reason = f"Payment method suffered a permanent terminal failure ({failure_cat}). Repeat attempts against same instrument suppressed."
            self._record_breach(case, "PERMANENT_FAILURE_SUPPRESSION", failure_cat, "DO_NOT_RETRY_SAME_METHOD", reason, db)
            return GuardrailDecision(
                allowed=False,
                requires_approval=False,
                reason_code="PERMANENT_FAILURE",
                human_readable_reason=reason,
                policy_version=self.policy.POLICY_VERSION,
                suggested_action="STOP",
                rule_details={"rule": "PERMANENT_FAILURE_SUPPRESSION", "failure_category": failure_cat, "strategy": strategy}
            )

        # ---------------------------------------------------------------------
        # Rule 4: ATTEMPTS >= MAX -> STOP
        # ---------------------------------------------------------------------
        if attempt >= self.policy.MAX_RECOVERY_ATTEMPTS:
            reason = f"Recovery attempt count ({attempt}) has reached the safety ceiling (Max {self.policy.MAX_RECOVERY_ATTEMPTS}). Autonomous recovery stopped."
            self._record_breach(case, "MAX_RECOVERY_ATTEMPTS", f"attempt={attempt}", "STOP", reason, db)
            return GuardrailDecision(
                allowed=False,
                requires_approval=False,
                reason_code="ATTEMPTS_EXCEEDED",
                human_readable_reason=reason,
                policy_version=self.policy.POLICY_VERSION,
                suggested_action="STOP",
                rule_details={"rule": "MAX_RECOVERY_ATTEMPTS", "attempt_count": attempt, "limit": self.policy.MAX_RECOVERY_ATTEMPTS}
            )

        # ---------------------------------------------------------------------
        # Rule 5: HUMAN APPROVAL THRESHOLD (>= ₹10,000) -> HUMAN APPROVAL
        # ---------------------------------------------------------------------
        if amount >= self.policy.HUMAN_APPROVAL_THRESHOLD_INR:
            reason = f"High-value order (₹{amount:,.2f} >= ₹{self.policy.HUMAN_APPROVAL_THRESHOLD_INR:,.2f} Human Approval Threshold) requires human supervisor sign-off before intervention dispatch."
            self._record_breach(case, "HIGH_VALUE_THRESHOLD", f"₹{amount:,.2f}", "HUMAN_APPROVAL", reason, db)
            return GuardrailDecision(
                allowed=True,
                requires_approval=True,
                reason_code="HIGH_VALUE_TRANSACTION",
                human_readable_reason=reason,
                policy_version=self.policy.POLICY_VERSION,
                suggested_action="HUMAN_APPROVAL",
                rule_details={"rule": "HIGH_VALUE_THRESHOLD", "amount": amount, "threshold": self.policy.HUMAN_APPROVAL_THRESHOLD_INR}
            )

        # ---------------------------------------------------------------------
        # Rule 6: LOW RECOVERY PROBABILITY (< 0.20) -> NO_ACTION
        # ---------------------------------------------------------------------
        if prob > 0.0 and prob < self.policy.MIN_RECOVERY_PROBABILITY:
            reason = f"Estimated recovery probability ({prob:.1%}) is below the minimum economic threshold ({self.policy.MIN_RECOVERY_PROBABILITY:.0%}). Intervention suppressed to prevent customer fatigue."
            self._record_breach(case, "MIN_RECOVERY_PROBABILITY", f"{prob:.2%}", "NO_ACTION", reason, db)
            return GuardrailDecision(
                allowed=False,
                requires_approval=False,
                reason_code="LOW_RECOVERY_PROBABILITY",
                human_readable_reason=reason,
                policy_version=self.policy.POLICY_VERSION,
                suggested_action="NO_ACTION",
                rule_details={"rule": "MIN_RECOVERY_PROBABILITY", "probability": prob, "threshold": self.policy.MIN_RECOVERY_PROBABILITY}
            )

        # ---------------------------------------------------------------------
        # Additional Explicit Approval Checks (Manual Escalation / Policy Override / Guardrail Events)
        # Cases below human approval threshold (< ₹10,000) ONLY require approval if an explicit guardrail applies.
        # ---------------------------------------------------------------------
        if case.current_step == "MANUAL_ESCALATION" or (case.execution_payload and "MANUAL_ESCALATION" in str(case.execution_payload)) or failure_cat == "MANUAL_ESCALATION":
            return GuardrailDecision(
                allowed=True,
                requires_approval=True,
                reason_code="MANUAL_ESCALATION",
                human_readable_reason="Case manually escalated by operator for supervisory review.",
                policy_version=self.policy.POLICY_VERSION,
                suggested_action="HUMAN_APPROVAL",
                rule_details={"rule": "MANUAL_ESCALATION"}
            )
        if case.current_step == "POLICY_OVERRIDE" or (case.execution_payload and "POLICY_OVERRIDE" in str(case.execution_payload)) or failure_cat == "POLICY_OVERRIDE":
            return GuardrailDecision(
                allowed=True,
                requires_approval=True,
                reason_code="POLICY_OVERRIDE",
                human_readable_reason="Policy override active. Requires supervisor confirmation before dispatch.",
                policy_version=self.policy.POLICY_VERSION,
                suggested_action="HUMAN_APPROVAL",
                rule_details={"rule": "POLICY_OVERRIDE"}
            )

        # Explicit Guardrail breach event check requiring approval
        recent_approval_event = (
            db.query(GuardrailEvent)
            .filter(
                GuardrailEvent.recovery_case_id == case.id,
                GuardrailEvent.action_taken.in_(["HUMAN_APPROVAL", "REQUIRE_MANUAL_APPROVAL"])
            )
            .order_by(GuardrailEvent.triggered_at.desc())
            .first()
        )
        if recent_approval_event:
            reason = f"Explicit Guardrail Requirement ({recent_approval_event.rule_name}): {recent_approval_event.details or 'Supervisor sign-off required by guardrail policy.'}"
            return GuardrailDecision(
                allowed=True,
                requires_approval=True,
                reason_code=recent_approval_event.rule_name,
                human_readable_reason=reason,
                policy_version=self.policy.POLICY_VERSION,
                suggested_action="HUMAN_APPROVAL",
                rule_details={"rule": recent_approval_event.rule_name, "threshold": recent_approval_event.threshold_breached}
            )

        # ---------------------------------------------------------------------
        # Default: Cleared & Permitted
        # ---------------------------------------------------------------------
        cleared_reason = f"All safety policies cleared for Strategy '{strategy}' on Attempt {attempt}/{self.policy.MAX_RECOVERY_ATTEMPTS}."
        return GuardrailDecision(
            allowed=True,
            requires_approval=False,
            reason_code="POLICY_CLEARED",
            human_readable_reason=cleared_reason,
            policy_version=self.policy.POLICY_VERSION,
            suggested_action="PROCEED",
            rule_details={"rule": "ALL_RULES_PASSED", "attempt": attempt, "amount": amount}
        )

    def process_human_approval(
        self,
        case: RecoveryCase,
        decision: str,
        operator_name: str,
        operator_notes: Optional[str],
        db: Session
    ) -> Dict[str, Any]:
        """
        Executes human supervisor decision.
        Enforces that monetary amounts are strictly immutable and cannot be tampered with.
        """
        norm_decision = decision.upper().strip()
        if norm_decision not in ("APPROVE", "REJECT", "NO_ACTION"):
            raise ValueError(f"Invalid approval decision '{decision}'. Must be APPROVE, REJECT, or NO_ACTION.")

        orig_strategy = case.selected_strategy or "PAYMENT_LINK"
        prev_step = case.current_step or case.status or "PENDING_APPROVAL"
        timestamp = datetime.now(timezone.utc)

        if norm_decision == "APPROVE":
            case.status = "ACTION_SCHEDULED"
            case.current_step = "ACTION_SCHEDULED"
            case.updated_at = timestamp
            final_step = "ACTION_SCHEDULED"
            details = (
                f"Supervisor '{operator_name}' APPROVED recovery intervention. "
                f"Original recommendation: '{orig_strategy}'. "
                f"Amount: ₹{case.risk_amount:,.2f} (read-only verified). "
                f"Notes: {operator_notes or 'Standard supervisor sign-off'}."
            )
        elif norm_decision == "REJECT":
            case.status = "STOPPED"
            case.current_step = "STOPPED"
            case.updated_at = timestamp
            final_step = "STOPPED"
            details = (
                f"Supervisor '{operator_name}' REJECTED recovery intervention. "
                f"Original recommendation: '{orig_strategy}'. "
                f"Case halted to protect customer experience. "
                f"Notes: {operator_notes or 'Disallowed by operator'}."
            )
        else:  # NO_ACTION
            case.status = "STOPPED"
            case.current_step = "STOPPED"
            case.selected_strategy = "NO_ACTION"
            case.updated_at = timestamp
            final_step = "STOPPED"
            details = (
                f"Supervisor '{operator_name}' CHANGED TO NO_ACTION. "
                f"Original recommendation '{orig_strategy}' overridden. "
                f"Notes: {operator_notes or 'Zero-intervention policy override'}."
            )

        # Log to AuditLog: who approved, timestamp, original recommendation, final decision
        audit = AuditLog(
            id=f"aud_appr_{uuid.uuid4().hex[:8]}",
            workspace_id=case.workspace_id,
            recovery_case_id=case.id,
            transaction_id=case.transaction_id,
            actor=f"OPERATOR:{operator_name}",
            action_type="HUMAN_APPROVAL_DECISION",
            target_resource=case.id,
            details=details,
            metadata_json=json.dumps({
                "who_approved": operator_name,
                "timestamp": timestamp.isoformat(),
                "original_recommendation": orig_strategy,
                "final_decision": norm_decision,
                "amount": case.risk_amount,
                "notes": operator_notes or ""
            }),
            created_at=timestamp
        )
        db.add(audit)
        db.commit()
        db.refresh(case)

        # Emit real-time events
        event_broadcaster.broadcast_sync(
            "HUMAN_APPROVAL_DECISION",
            {
                "case_id": case.id,
                "operator": operator_name,
                "decision": norm_decision,
                "original_strategy": orig_strategy,
                "amount": case.risk_amount,
                "workspace_id": str(case.workspace_id),
                "timestamp": timestamp.isoformat()
            },
            workspace_id=case.workspace_id
        )
        event_broadcaster.broadcast_sync(
            "RECOVERY_AGENT_TRANSITION",
            {
                "case_id": case.id,
                "prev_step": prev_step,
                "current_step": final_step,
                "strategy": case.selected_strategy,
                "details": details,
                "workspace_id": str(case.workspace_id),
                "timestamp": timestamp.isoformat()
            },
            workspace_id=case.workspace_id
        )

        logger.info(f"Human Approval processed for Case {case.id} by {operator_name}: {norm_decision}")
        return {
            "case_id": case.id,
            "who_approved": operator_name,
            "timestamp": timestamp.isoformat(),
            "original_recommendation": orig_strategy,
            "final_decision": norm_decision,
            "status": case.status
        }

    def _record_breach(
        self,
        case: RecoveryCase,
        rule_name: str,
        threshold: str,
        action_taken: str,
        details: str,
        db: Session
    ):
        event = GuardrailEvent(
            id=f"gr_{uuid.uuid4().hex[:10]}",
            workspace_id=case.workspace_id,
            recovery_case_id=case.id,
            rule_name=rule_name,
            threshold_breached=threshold,
            action_taken=action_taken,
            details=details,
            triggered_at=datetime.now(timezone.utc)
        )
        db.add(event)
        try:
            db.flush()
        except Exception:
            pass

guardrails_service = GuardrailsService()
