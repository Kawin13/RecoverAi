"""
RecoverAI - Autonomous Decision Engine & Evidence Generator
Synthesizes failure diagnostics, customer telemetry, and strategy evaluations
to select the optimal permitted intervention and produce deterministic factual evidence.
"""

from typing import Dict, Any, List
from app.agents.diagnosis import diagnosis_engine
from app.agents.evaluator import strategy_evaluator
from app.ml.inference import inference_engine

class DecisionEngine:
    def __init__(self):
        self.diagnosis_engine = diagnosis_engine
        self.evaluator = strategy_evaluator
        self.inference_engine = inference_engine

    def decide(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes the full 7-step autonomous decision pipeline:
        1. Failure diagnosis & taxonomy classification
        2. Customer historical context extraction
        3. Recovery propensity & action conditional prediction
        4. Expected Recovery Value (ERV) minor unit math
        5. Guardrail policy evaluation
        6. Selection of highest-ERV permitted action (including NO_ACTION)
        7. Deterministic factual evidence object synthesis
        """
        # Step 1: Diagnosis
        failure_reason = str(transaction_data.get("failure_reason", "UPI_TIMEOUT")).upper()
        payment_method = str(transaction_data.get("payment_method", "UPI")).upper()
        attempt_count = int(transaction_data.get("attempt_count", 1))
        diagnosis = self.diagnosis_engine.diagnose(failure_reason, payment_method, attempt_count)

        # Step 2 & 3 & 4 & 5: Strategy Evaluation & ERV & Guardrails
        evaluations = self.evaluator.evaluate_strategies(transaction_data, diagnosis)

        # Step 6: Select best permitted action
        permitted_evals = [e for e in evaluations if e["allowed"]]
        
        if not permitted_evals:
            selected_eval = next((e for e in evaluations if e["action"] == "NO_ACTION"), evaluations[0])
        else:
            # Pick highest ERV permitted action
            selected_eval = permitted_evals[0]
            # If highest ERV is 0 and action is not NO_ACTION, check if NO_ACTION is better
            if selected_eval["expected_recovery_value"] <= 0 and selected_eval["action"] != "NO_ACTION":
                no_action_eval = next((e for e in evaluations if e["action"] == "NO_ACTION"), None)
                if no_action_eval:
                    selected_eval = no_action_eval

        # Step 7: Deterministic Factual Evidence Generation
        evidence = self._generate_factual_evidence(
            transaction_data=transaction_data,
            diagnosis=diagnosis,
            selected_eval=selected_eval,
            all_evaluations=evaluations
        )

        return {
            "selected_action": selected_eval["action"],
            "recovery_probability": selected_eval["probability"],
            "expected_recovery_value": selected_eval["expected_recovery_value"],
            "erv_paise": selected_eval["erv_paise"],
            "cost": selected_eval["cost"],
            "friction_penalty": selected_eval["friction_penalty"],
            "diagnosis": diagnosis,
            "strategies_comparison": evaluations,
            "evidence": evidence,
            "decision_metadata": {
                "engine_version": "2.0.0-deterministic",
                "rules_evaluated": 5,
                "model": "XGBoost 3.2.0 + ERV Engine"
            }
        }

    def _generate_factual_evidence(
        self,
        transaction_data: Dict[str, Any],
        diagnosis: Dict[str, Any],
        selected_eval: Dict[str, Any],
        all_evaluations: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Synthesizes precise, factual telemetry bullet points explaining why the action was selected.
        """
        evidence_points = []
        method = str(transaction_data.get("payment_method", "UPI")).upper()
        reason = str(diagnosis.get("failure_reason", "UNKNOWN"))
        attempts = int(transaction_data.get("attempt_count", 1))
        prev_success = int(transaction_data.get("previous_successes", transaction_data.get("previous_success_count", 0)))
        prev_fail = int(transaction_data.get("previous_failures", transaction_data.get("previous_failure_count", 0)))
        pref_method = str(transaction_data.get("preferred_method", transaction_data.get("preferred_payment_method", method))).upper()
        amount = float(transaction_data.get("amount", 0.0))
        selected_action = selected_eval["action"]
        selected_erv = selected_eval["expected_recovery_value"]

        # Point 1: Observed Failure & Attempt Telemetry
        if attempts > 1:
            evidence_points.append(f"{method} attempt #{attempts} failed due to {reason.replace('_', ' ')}.")
        else:
            evidence_points.append(f"Initial payment attempt dropped: {reason.replace('_', ' ')} diagnosed on {method}.")

        # Point 2: Historical Customer Affinity
        total_prev = prev_success + prev_fail
        if total_prev > 0:
            success_rate = (prev_success / total_prev) * 100
            evidence_points.append(f"Customer has {prev_success}/{total_prev} ({success_rate:.0f}%) historical successful transactions (Preferred rail: {pref_method}).")
        
        # Point 3: Action Comparative Advantage & Same-Instrument Comparison
        retry_eval = next((e for e in all_evaluations if e["action"] == "RETRY_NOW"), None)
        if retry_eval and selected_action != "RETRY_NOW":
            evidence_points.append(f"Immediate retry probability is only {retry_eval['probability'] * 100:.1f}% due to switch downtime / card decline physics.")

        # Point 4: ERV Optimization
        if selected_action != "NO_ACTION":
            evidence_points.append(f"{selected_action.replace('_', ' ')} yields highest Expected Recovery Value of ₹{selected_erv:,.2f} with {selected_eval['probability'] * 100:.1f}% recovery probability.")
        else:
            evidence_points.append("NO_ACTION selected as recovery interventions are suppressed by safety guardrails or produce negative ERV.")

        return evidence_points

decision_engine = DecisionEngine()
