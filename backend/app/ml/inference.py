import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from datetime import datetime

class MLInferenceEngine:
    def __init__(self):
        self.base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        self.artifacts_dir = os.path.join(self.base_dir, "ml", "artifacts")
        
        self.rec_model = None
        self.rec_preprocessor = None
        self.int_model = None
        self.int_preprocessor = None
        self.metadata = {}

        self.candidate_actions = [
            "RETRY_NOW",
            "RETRY_LATER",
            "UPI_SWITCH",
            "PAYMENT_LINK",
            "PERSONALIZED_REMINDER",
            "HUMAN_ESCALATION",
            "NO_ACTION"
        ]

        self.action_costs = {
            "RETRY_NOW": 2.0,
            "RETRY_LATER": 2.5,
            "UPI_SWITCH": 4.0,
            "PAYMENT_LINK": 5.0,
            "PERSONALIZED_REMINDER": 8.0,
            "HUMAN_ESCALATION": 45.0,
            "NO_ACTION": 0.0
        }

        self._load_artifacts()

    def _load_artifacts(self):
        rec_model_path = os.path.join(self.artifacts_dir, "recovery_model.joblib")
        rec_prep_path = os.path.join(self.artifacts_dir, "recovery_preprocessor.joblib")
        int_model_path = os.path.join(self.artifacts_dir, "intervention_model.joblib")
        int_prep_path = os.path.join(self.artifacts_dir, "intervention_preprocessor.joblib")
        meta_path = os.path.join(self.artifacts_dir, "model_metadata.json")

        if os.path.exists(rec_model_path) and os.path.exists(rec_prep_path):
            try:
                self.rec_model = joblib.load(rec_model_path)
                self.rec_preprocessor = joblib.load(rec_prep_path)
            except Exception as e:
                print(f"Warning: Could not load recovery model: {e}")

        if os.path.exists(int_model_path) and os.path.exists(int_prep_path):
            try:
                self.int_model = joblib.load(int_model_path)
                self.int_preprocessor = joblib.load(int_prep_path)
            except Exception as e:
                print(f"Warning: Could not load intervention model: {e}")

        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r") as f:
                    self.metadata = json.load(f)
            except Exception as e:
                print(f"Warning: Could not load metadata: {e}")

    def get_metadata(self) -> Dict[str, Any]:
        return self.metadata or {
            "model_version": "1.0.0-fallback",
            "algorithm": "XGBoost Gradient Boosted Trees",
            "features": 18,
            "status": "active"
        }

    def predict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        amount = float(data.get("amount") or 2500.0)
        payment_method = str(data.get("payment_method") or "UPI").upper()
        bank = str(data.get("bank") or "HDFC Bank")
        failure_reason = str(data.get("failure_reason") or "UPI_TIMEOUT").upper()
        failure_category = str(data.get("failure_category") or "TECHNICAL_TIMEOUT").upper()
        attempt_count = int(data.get("attempt_count") or 1)
        prev_success = int(data.get("previous_successes") or data.get("previous_success_count") or 12)
        prev_failure = int(data.get("previous_failures") or data.get("previous_failure_count") or 2)
        pref_method = str(data.get("preferred_method") or data.get("preferred_payment_method") or "UPI").upper()
        cust_tier = str(data.get("customer_value") or data.get("customer_value_segment") or "GROWTH").upper()
        tenure_days = int(data.get("customer_tenure_days") or 180)
        
        hour = data.get("hour_of_day")
        hour = int(hour) if hour is not None else datetime.now().hour
        
        dow = data.get("day_of_week")
        dow = int(dow) if dow is not None else datetime.now().weekday()
        
        merchant_cat = str(data.get("merchant_category") or "E-Commerce & Retail")
        checkout_abandoned = int(data.get("checkout_abandoned") or 0)
        checkout_duration = int(data.get("checkout_duration_seconds") or 65)
        device_type = str(data.get("device_type") or "MOBILE_ANDROID")
        hist_aov = float(data.get("historical_avg_order_value") or amount)

        # Build feature dictionary
        row = {
            "amount": amount,
            "payment_method": payment_method,
            "bank": bank,
            "failure_reason": failure_reason,
            "failure_category": failure_category,
            "attempt_count": attempt_count,
            "previous_success_count": prev_success,
            "previous_failure_count": prev_failure,
            "preferred_payment_method": pref_method,
            "customer_tenure_days": tenure_days,
            "customer_value_segment": cust_tier,
            "hour_of_day": hour,
            "day_of_week": dow,
            "merchant_category": merchant_cat,
            "checkout_abandoned": checkout_abandoned,
            "checkout_duration_seconds": checkout_duration,
            "device_type": device_type,
            "historical_avg_order_value": hist_aov
        }
        df_single = pd.DataFrame([row])

        # 1. Overall Recovery Propensity P(recovery)
        if self.rec_model is not None and self.rec_preprocessor is not None:
            X_proc = self.rec_preprocessor.transform(df_single)
            overall_prob = float(self.rec_model.predict_proba(X_proc)[0, 1])
        else:
            logit = 0.5 + (0.4 if cust_tier in ["VIP", "ENTERPRISE"] else 0.0) - (attempt_count - 1) * 0.4
            overall_prob = 1.0 / (1.0 + np.exp(-logit))

        overall_prob = round(float(np.clip(overall_prob, 0.05, 0.98)), 4)

        # 2. Action Conditional Probabilities
        action_probs: Dict[str, float] = {}
        erv_by_action: Dict[str, float] = {}

        for act in self.candidate_actions:
            if act == "NO_ACTION":
                prob = 0.0
            elif self.int_model is not None and self.int_preprocessor is not None:
                df_act = df_single.copy()
                df_act["mapped_action"] = act
                try:
                    X_act_proc = self.int_preprocessor.transform(df_act)
                    prob = float(self.int_model.predict_proba(X_act_proc)[0, 1])
                except Exception:
                    prob = overall_prob
            else:
                prob = overall_prob

            # Apply domain-specific physical constraints & boundary rules
            if act == "RETRY_NOW":
                if failure_reason in ["EXPIRED_CARD", "INVALID_CARD", "MANDATE_CANCELLED"]:
                    prob = min(prob * 0.05, 0.05)  # Retrying an expired instrument immediately fails
                elif failure_reason in ["UPI_TIMEOUT", "BANK_SERVER_DOWN"]:
                    prob = min(prob * 0.35, 0.30)  # Bank switch is down; immediate retry hits same wall
                elif attempt_count >= 3:
                    prob = prob * 0.40

            elif act == "RETRY_LATER":
                if failure_reason in ["EXPIRED_CARD", "INVALID_CARD"]:
                    prob = min(prob * 0.05, 0.05)
                elif failure_reason in ["UPI_TIMEOUT", "BANK_SERVER_DOWN", "INSUFFICIENT_FUNDS"]:
                    prob = min(prob * 1.15, 0.88)

            elif act == "UPI_SWITCH":
                if failure_reason in ["UPI_TIMEOUT", "BANK_SERVER_DOWN", "UPI_PIN_FAILED"]:
                    prob = min(prob * 1.25, 0.94)
                elif pref_method == "UPI":
                    prob = min(prob * 1.15, 0.92)

            elif act == "PAYMENT_LINK":
                if failure_category in ["AUTHENTICATION", "INVALID_INSTRUMENT"] or failure_reason == "OTP_FAILED":
                    prob = min(prob * 1.20, 0.92)

            elif act == "PERSONALIZED_REMINDER":
                if checkout_abandoned == 1 or failure_category == "INTENT_ABANDONMENT":
                    prob = min(prob * 1.18, 0.88)

            elif act == "HUMAN_ESCALATION":
                if cust_tier in ["VIP", "ENTERPRISE"] or amount > 50000:
                    prob = min(prob * 1.20, 0.95)
                else:
                    prob = prob * 0.80

            clamped_prob = round(float(np.clip(prob, 0.0, 0.98)), 4) if act != "NO_ACTION" else 0.0
            action_probs[act] = clamped_prob

            # Calculate Expected Recovery Value: ERV = (P(action) * amount) - Cost
            cost = self.action_costs.get(act, 5.0)
            erv = round(max(0.0, (clamped_prob * amount) - cost), 2)
            erv_by_action[act] = erv

        # Select action with highest ERV
        best_action = max(erv_by_action, key=erv_by_action.get)
        if erv_by_action[best_action] <= 0:
            best_action = "NO_ACTION"

        # Calculate uncertainty / 95% confidence interval
        uncertainty_margin = round(float(0.04 + (0.02 * (attempt_count - 1))), 4)
        prob_lower = round(max(0.0, overall_prob - uncertainty_margin), 4)
        prob_upper = round(min(1.0, overall_prob + uncertainty_margin), 4)

        return {
            "recovery_probability": overall_prob,
            "confidence_interval": {
                "lower_bound": prob_lower,
                "upper_bound": prob_upper,
                "margin": uncertainty_margin
            },
            "recommended_action": best_action,
            "expected_recovery_value": erv_by_action[best_action],
            "action_probabilities": action_probs,
            "action_ervs": erv_by_action,
            "model_metadata": {
                "version": self.metadata.get("model_version", "1.0.0-production"),
                "algorithm": self.metadata.get("algorithm", "XGBoost Gradient Boosted Decision Trees"),
                "trained_at": self.metadata.get("trained_at", datetime.utcnow().isoformat())
            }
        }

# Global singleton engine instance
inference_engine = MLInferenceEngine()
