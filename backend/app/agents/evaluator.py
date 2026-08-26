"""
RecoverAI - Strategy Evaluator & ERV Engine
Computes Expected Recovery Value (ERV), evaluates guardrail constraints,
and produces ranked candidate action evaluation comparisons.
"""

from typing import Dict, Any, List, Optional
from app.core.decision_config import decision_config, PAISE_PER_INR
from app.agents.diagnosis import FailureTaxonomy
from app.ml.inference import inference_engine

class StrategyEvaluator:
    def __init__(self):
        self.config = decision_config

    def evaluate_strategies(
        self,
        transaction_data: Dict[str, Any],
        diagnosis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Evaluates all candidate actions for a diagnosed transaction, computes
        ERV in minor units (paise) & INR, evaluates guardrails, and returns a sorted ranking.
        """
        amount_inr = float(transaction_data.get("amount", 2500.0))
        amount_paise = int(amount_inr * PAISE_PER_INR)
        attempt_count = int(transaction_data.get("attempt_count", 1))
        customer_tier = str(transaction_data.get("customer_value") or transaction_data.get("customer_value_segment") or "STANDARD").upper()
        failure_reason = str(diagnosis.get("failure_reason", "UPI_TIMEOUT")).upper()
        taxonomy = str(diagnosis.get("taxonomy", "TEMPORARY")).upper()

        # Get ML predicted probabilities for all candidate actions
        ml_prediction = inference_engine.predict(transaction_data)
        action_probs = ml_prediction.get("action_probabilities", {})

        evaluations = []

        for action, prob in action_probs.items():
            cost_inr = self.config.INTERVENTION_COSTS_INR.get(action, 5.0)
            cost_paise = int(cost_inr * PAISE_PER_INR)

            # Customer friction calculation
            friction_inr = self._compute_friction_penalty(action, attempt_count, customer_tier)
            friction_paise = int(friction_inr * PAISE_PER_INR)

            # Risk penalty calculation
            risk_inr = self._compute_risk_penalty(action, amount_inr, taxonomy)
            risk_paise = int(risk_inr * PAISE_PER_INR)

            # ERV Minor Unit Calculation: ERV_paise = (P * Amount_paise) - Cost_paise - Friction_paise - Risk_paise
            expected_return_paise = int(prob * amount_paise)
            erv_paise = expected_return_paise - cost_paise - friction_paise - risk_paise
            erv_inr = round(max(0.0, erv_paise / float(PAISE_PER_INR)), 2)

            # Guardrail checks
            allowed, guardrail_reason = self._evaluate_guardrail(
                action=action,
                attempt_count=attempt_count,
                failure_reason=failure_reason,
                taxonomy=taxonomy,
                amount_inr=amount_inr,
                customer_tier=customer_tier,
                erv_inr=erv_inr
            )

            evaluations.append({
                "action": action,
                "probability": round(float(prob), 4),
                "expected_recovery_value": erv_inr,
                "erv_paise": max(0, erv_paise),
                "cost": cost_inr,
                "friction_penalty": friction_inr,
                "risk_penalty": risk_inr,
                "allowed": allowed,
                "guardrail_reason": guardrail_reason
            })

        # Rank candidate actions: Permitted actions with highest ERV first, then by probability
        def sorting_key(item):
            # Allowed actions prioritized, then ERV, then probability
            return (1 if item["allowed"] else 0, item["expected_recovery_value"], item["probability"])

        evaluations.sort(key=sorting_key, reverse=True)

        # Assign ordinal rank
        for idx, item in enumerate(evaluations, start=1):
            item["rank"] = idx

        return evaluations

    def _compute_friction_penalty(self, action: str, attempts: int, tier: str) -> float:
        base = self.config.BASE_FRICTION_PENALTIES_INR.get(action, 2.0)
        
        # Subsequent attempts increase friction penalty (customer annoyance)
        attempt_multiplier = 1.0 + (0.35 * max(0, attempts - 1))
        
        # VIP customers have lower tolerance for generic dunning, higher tolerance for concierge
        if tier in ["VIP", "ENTERPRISE"]:
            if action in ["PERSONALIZED_REMINDER", "PAYMENT_LINK"]:
                tier_multiplier = 1.3
            elif action == "HUMAN_ESCALATION":
                tier_multiplier = 0.5  # High-touch concierge is welcomed by VIPs
            else:
                tier_multiplier = 1.0
        else:
            tier_multiplier = 1.0

        return round(base * attempt_multiplier * tier_multiplier, 2)

    def _compute_risk_penalty(self, action: str, amount: float, taxonomy: str) -> float:
        if taxonomy == "RISK_BLOCKED":
            return round(amount * 0.90, 2)
        
        if amount > self.config.HIGH_VALUE_THRESHOLD_INR:
            # High amount has slightly higher risk penalty for automated instant retry
            if action == "RETRY_NOW":
                return 15.0
            elif action == "HUMAN_ESCALATION":
                return 0.0  # Human supervision minimizes risk for high-ticket
        return 0.0

    def _evaluate_guardrail(
        self,
        action: str,
        attempt_count: int,
        failure_reason: str,
        taxonomy: str,
        amount_inr: float,
        customer_tier: str,
        erv_inr: float
    ) -> (bool, Optional[str]):
        # Rule 1: Risk blocked or Permanent failure allows ONLY NO_ACTION
        if taxonomy in ["RISK_BLOCKED", "PERMANENT"]:
            if action != "NO_ACTION":
                return False, f"Guardrail: All interventions suppressed due to {taxonomy} status."
            return True, None

        # Rule 2: Expired or Invalid instrument suppresses direct retries
        if failure_reason in ["EXPIRED_CARD", "INVALID_CARD", "MANDATE_CANCELLED"]:
            if action in ["RETRY_NOW", "RETRY_LATER"]:
                return False, f"Guardrail: Direct retry suppressed on invalid/expired instrument ({failure_reason})."

        # Rule 3: Attempt count limits
        if attempt_count >= self.config.MAX_ATTEMPTS_BEFORE_SUPPRESSION:
            if action in ["RETRY_NOW", "RETRY_LATER"]:
                return False, f"Guardrail: Maximum attempt limit ({self.config.MAX_ATTEMPTS_BEFORE_SUPPRESSION}) reached. Direct retries blocked."

        # Rule 4: Human escalation cost economics
        if action == "HUMAN_ESCALATION":
            if customer_tier == "STANDARD" and amount_inr < 500.0:
                return False, "Guardrail: Human escalation cost (₹45) exceeds standard unit economics for ticket < ₹500."

        # Rule 5: NO_ACTION is always permitted
        if action == "NO_ACTION":
            return True, None

        return True, None

strategy_evaluator = StrategyEvaluator()
