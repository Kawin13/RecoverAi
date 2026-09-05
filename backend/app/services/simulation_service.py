"""
RecoverAI - Batch Recovery Simulation Service
Executes deterministic batch simulation using real trained XGBoost models,
failure diagnosis, ERV minor unit optimization, and safety guardrails.
Benchmarks RecoverAI against industry baseline dunning.
"""

import uuid
import random
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from app.schemas.simulation import (
    SimulationControls,
    SimulationPreset,
    MethodologyDoc,
    BatchSimulationResponse,
    SimulatedTransactionItem,
    InterventionPerformance,
    CategoryRecoveryStat,
    PaymentMethodRecoveryStat,
    TimelinePoint,
    WaterfallItem,
    GuardrailBreachSummary,
    PaymentMethodDistribution
)
from app.ml.inference import inference_engine
from app.agents.diagnosis import diagnosis_engine
from app.agents.evaluator import strategy_evaluator
from app.core.decision_config import decision_config, PAISE_PER_INR

INDIAN_FIRST_NAMES = [
    "Aarav", "Aditi", "Rohan", "Priya", "Vikram", "Sneha", "Kunal", "Ananya",
    "Rahul", "Divya", "Arjun", "Pooja", "Siddharth", "Neha", "Amit", "Kavya",
    "Gaurav", "Meera", "Varun", "Rhea", "Manish", "Ishaan", "Tanvi", "Nikhil",
    "Shreya", "Deepak", "Aakash", "Sanya", "Harsh", "Priyanka"
]

INDIAN_LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Nair", "Reddy", "Mehta", "Iyer", "Kapoor",
    "Chopra", "Deshmukh", "Bhatia", "Joshi", "Singhania", "Mukherjee", "Gupta",
    "Bansal", "Malhotra", "Kulkarni", "Choudhury", "Saxena"
]

BANKS = [
    "HDFC Bank", "State Bank of India", "ICICI Bank", "Axis Bank",
    "Kotak Mahindra Bank", "Bank of Baroda", "Federal Bank", "Punjab National Bank", "Yes Bank"
]

class SimulationService:
    def __init__(self):
        self.presets = self._init_presets()

    def _init_presets(self) -> Dict[str, SimulationPreset]:
        return {
            "ecommerce_sale": SimulationPreset(
                id="ecommerce_sale",
                name="E-commerce Sale Day",
                description="High-volume festive shopping traffic with high UPI volume, cart drop-offs, and switch latency spikes.",
                badge="High Volume",
                controls=SimulationControls(
                    num_transactions=500,
                    merchant_category="E-Commerce & Retail",
                    payment_methods_dist=PaymentMethodDistribution(UPI=0.65, CARD=0.20, NET_BANKING=0.10, WALLET=0.05),
                    failure_rate=0.22,
                    abandonment_rate=0.30,
                    average_order_value=2400.0,
                    seed=42,
                    preset_name="E-commerce Sale Day"
                )
            ),
            "saas_recurring": SimulationPreset(
                id="saas_recurring",
                name="SaaS Subscription Cycle",
                description="Monthly subscription billing run with high card usage, card limit breaches, 3DS timeouts, and expired cards.",
                badge="High AOV",
                controls=SimulationControls(
                    num_transactions=300,
                    merchant_category="SaaS & Cloud Services",
                    payment_methods_dist=PaymentMethodDistribution(UPI=0.20, CARD=0.70, NET_BANKING=0.10, WALLET=0.00),
                    failure_rate=0.18,
                    abandonment_rate=0.08,
                    average_order_value=8500.0,
                    seed=101,
                    preset_name="SaaS Subscription Cycle"
                )
            ),
            "food_delivery_peak": SimulationPreset(
                id="food_delivery_peak",
                name="Food Delivery Peak Hour",
                description="Dinner rush with rapid checkout velocity, 85% UPI share, high sensitivity to bank switch timeouts.",
                badge="Fast Pace",
                controls=SimulationControls(
                    num_transactions=750,
                    merchant_category="Quick Commerce & Food",
                    payment_methods_dist=PaymentMethodDistribution(UPI=0.85, CARD=0.08, NET_BANKING=0.04, WALLET=0.03),
                    failure_rate=0.14,
                    abandonment_rate=0.18,
                    average_order_value=480.0,
                    seed=777,
                    preset_name="Food Delivery Peak Hour"
                )
            ),
            "travel_spike": SimulationPreset(
                id="travel_spike",
                name="Travel Booking Spike",
                description="Holiday flight and hotel booking peak with high basket sizes, OTP authentication timeouts, and bank limits.",
                badge="Enterprise",
                controls=SimulationControls(
                    num_transactions=200,
                    merchant_category="Travel & Hospitality",
                    payment_methods_dist=PaymentMethodDistribution(UPI=0.25, CARD=0.45, NET_BANKING=0.30, WALLET=0.00),
                    failure_rate=0.26,
                    abandonment_rate=0.35,
                    average_order_value=18500.0,
                    seed=999,
                    preset_name="Travel Booking Spike"
                )
            )
        }

    def get_presets(self) -> List[SimulationPreset]:
        return list(self.presets.values())

    def get_methodology(self) -> MethodologyDoc:
        return MethodologyDoc(
            title="RecoverAI Batch Simulation Methodology & Empirical Assumptions",
            version="2.0.0-production",
            summary=(
                "The RecoverAI Simulation Sandbox generates realistic synthetic payment transactions and evaluates them "
                "through both traditional baseline dunning rules and the complete RecoverAI autonomous intelligence pipeline. "
                "All recovery predictions utilize the genuine trained XGBoost model (18 features) and calculate Expected Recovery Value (ERV) "
                "in minor currency units (paise) with strict fintech safety guardrails."
            ),
            baseline_rules=[
                {
                    "name": "Generic Technical Retry",
                    "trigger": "Temporary switch or network timeouts (UPI_TIMEOUT, BANK_SERVER_DOWN)",
                    "action": "Immediate RETRY_NOW against the exact same instrument",
                    "cost": "₹2.00 gateway processing fee",
                    "success_probability": "16% empirical benchmark (switch often remains down)",
                    "drawback": "Blindly fires against expired cards and blacklisted fraud accounts, losing 100% of retry costs."
                },
                {
                    "name": "Generic Delayed Dunning Email/SMS",
                    "trigger": "Customer drop-off or authentication failure (OTP_FAILED, CARD_DECLINED)",
                    "action": "Standard static template sent 4 to 24 hours later",
                    "cost": "₹2.50 messaging and notification overhead",
                    "success_probability": "12% empirical benchmark (intent has turned cold)",
                    "drawback": "No dynamic 1-click payment link, no alternative payment method suggestion, zero customer context."
                },
                {
                    "name": "Generic Cart Recovery Email",
                    "trigger": "Checkout abandonment before payment attempt",
                    "action": "Generic cart reminder email after 4 hours",
                    "cost": "₹2.00 marketing email automation cost",
                    "success_probability": "11% conversion benchmark",
                    "drawback": "Lacks real-time intent capture, instant payment options, or personalized incentives."
                }
            ],
            recoverai_pipeline=[
                {
                    "step": "1. Failure Root Cause Diagnosis",
                    "description": "Deterministically classifies failure into 6 root causes (TEMPORARY, PAYMENT_METHOD_SPECIFIC, CUSTOMER_ACTION_REQUIRED, ABANDONMENT, RISK_BLOCKED, UNKNOWN)."
                },
                {
                    "step": "2. ML Propensity Scoring",
                    "description": "Vectorized XGBoost inference calculates overall P(recovery) and action-conditioned recovery probability for 7 candidate actions based on 18 telemetry features."
                },
                {
                    "step": "3. Expected Recovery Value (ERV) Optimization",
                    "description": "Calculates ERV_paise = (P * Amount_paise) - Cost_paise - Friction_paise - Risk_paise, selecting the strategy maximizing net monetary yield."
                },
                {
                    "step": "4. Fintech Safety Guardrails",
                    "description": "Enforces 6 hard constraints: DND opt-out stop, fraud circuit breaker, invalid instrument suppression, 3-attempt ceiling, and human supervisor routing for orders >= ₹10,000 or VIP accounts."
                },
                {
                    "step": "5. Deterministic Calibrated Simulation",
                    "description": "Evaluates outcome via seeded pseudo-random uniform draw against model-calibrated conditional success probabilities."
                }
            ],
            erv_formula="ERV = (P_recovery * Amount) - InterventionCost - CustomerFrictionPenalty - RiskPenalty",
            guardrail_policies=[
                {"rule": "CUSTOMER_OPT_OUT", "policy": "Suppress all automated outbound messages if customer opted out or marked DND."},
                {"rule": "RISK_FRAUD_CIRCUIT_BREAKER", "policy": "Immediate halt and zero retry on fraud alerts, blacklisted IPs, or velocity breaches."},
                {"rule": "PERMANENT_FAILURE_SUPPRESSION", "policy": "Suppress same-instrument retries on expired or cancelled cards; route to smart payment link."},
                {"rule": "MAX_ATTEMPT_CEILING", "policy": "Strict hard cap of 3 recovery attempts per order to prevent brand damage."},
                {"rule": "HIGH_VALUE_SUPERVISOR_ROUTING", "policy": "Orders >= ₹10,000 or VIP tiers require human concierge escalation if unit economics justify cost."},
                {"rule": "MIN_PROBABILITY_ECONOMIC_FLOOR", "policy": "Suppress interventions if P_recovery < 0.20 to avoid customer annoyance on lost causes."}
            ],
            disclaimer="SIMULATED TEST DATA: ALL OUTCOMES DISPLAYED ARE SYNTHETIC SIMULATIONS PRODUCED BY THE RECOVERAI SIMULATION ENGINE FOR BUSINESS VALUE BENCHMARKING. NO LIVE PAYMENT LINKS OR REAL FINANCIAL TRANSACTIONS ARE PROCESSED."
        )

    def run_simulation(self, controls: SimulationControls) -> BatchSimulationResponse:
        """
        Executes complete batch simulation:
        1. Generates batch of transactions deterministically from seed.
        2. Segregates clean initial revenue from at-risk revenue (failed + abandoned).
        3. Executes Baseline recovery model.
        4. Executes RecoverAI autonomous intelligence pipeline.
        5. Computes comparative benchmarks, ROI, incremental lift, and chart breakdowns.
        """
        sim_id = f"sim_{controls.seed}_{int(datetime.now(timezone.utc).timestamp())}"
        executed_at = datetime.now(timezone.utc).isoformat()
        
        # Initialize deterministic PRNGs
        rng = np.random.RandomState(controls.seed)
        py_rand = random.Random(controls.seed)
        
        n_tx = controls.num_transactions
        dist = controls.payment_methods_dist
        
        # Normalize payment distribution
        total_weight = dist.UPI + dist.CARD + dist.NET_BANKING + dist.WALLET
        if total_weight <= 0:
            p_upi, p_card, p_nb, p_wal = 0.60, 0.25, 0.10, 0.05
        else:
            p_upi = dist.UPI / total_weight
            p_card = dist.CARD / total_weight
            p_nb = dist.NET_BANKING / total_weight
            p_wal = dist.WALLET / total_weight
        
        methods = ["UPI", "CARD", "NET_BANKING", "WALLET"]
        method_probs = [p_upi, p_card, p_nb, p_wal]
        
        tier_choices = ["STANDARD", "GROWTH", "VIP", "ENTERPRISE"]
        tier_probs = [0.60, 0.25, 0.10, 0.05]

        # Generate Transactions
        raw_transactions = []
        for i in range(n_tx):
            tx_id = f"tx_sim_{controls.seed}_{i+1:04d}"
            fname = py_rand.choice(INDIAN_FIRST_NAMES)
            lname = py_rand.choice(INDIAN_LAST_NAMES)
            cust_name = f"{fname} {lname}"
            cust_tier = py_rand.choices(tier_choices, weights=tier_probs, k=1)[0]
            
            # Amount generated lognormally around AOV
            log_mean = np.log(max(100.0, controls.average_order_value)) - 0.15
            raw_amt = float(rng.lognormal(mean=log_mean, sigma=0.50))
            amount = round(max(99.0, min(raw_amt, controls.average_order_value * 6.0)), 2)
            
            method = py_rand.choices(methods, weights=method_probs, k=1)[0]
            bank = py_rand.choice(BANKS)
            
            # Historical telemetry
            prev_success = max(1, int(rng.poisson(lam=14 if cust_tier in ["VIP", "ENTERPRISE"] else 6)))
            prev_failure = int(rng.poisson(lam=1))
            tenure_days = int(rng.uniform(15, 720))
            checkout_sec = int(rng.normal(loc=75, scale=25))
            checkout_sec = max(15, min(checkout_sec, 300))
            
            # Determine health: Clean success vs Abandonment vs Payment failure
            dice = rng.uniform(0.0, 1.0)
            
            is_abandoned = False
            is_failed = False
            failure_reason = None
            failure_category = None
            
            if dice < controls.abandonment_rate:
                # Cart abandonment before payment attempt
                is_abandoned = True
                failure_reason = "CHECKOUT_ABANDONED"
                failure_category = "ABANDONMENT"
            elif dice < (controls.abandonment_rate + controls.failure_rate):
                # Payment rail failure
                is_failed = True
                if method == "UPI":
                    reasons = ["UPI_TIMEOUT", "UPI_PIN_FAILED", "BANK_SERVER_DOWN", "TRANSACTION_LIMIT", "FRAUD_ALERT"]
                    weights = [0.45, 0.20, 0.20, 0.10, 0.05]
                elif method == "CARD":
                    reasons = ["AUTHENTICATION_FAILED", "INSUFFICIENT_FUNDS", "EXPIRED_CARD", "CARD_DECLINED", "FRAUD_ALERT", "CARD_LOST"]
                    weights = [0.35, 0.25, 0.15, 0.15, 0.05, 0.05]
                elif method == "NET_BANKING":
                    reasons = ["BANK_TIMEOUT", "BANK_SERVER_DOWN", "AUTHENTICATION_FAILED", "TRANSACTION_LIMIT"]
                    weights = [0.40, 0.35, 0.15, 0.10]
                else: # WALLET
                    reasons = ["INSUFFICIENT_FUNDS", "NETWORK_ERROR", "OTP_FAILED"]
                    weights = [0.50, 0.30, 0.20]
                
                failure_reason = py_rand.choices(reasons, weights=weights, k=1)[0]
                diag = diagnosis_engine.diagnose(failure_reason, method, 1)
                failure_category = diag["taxonomy"]
            else:
                # Clean transaction initial success
                pass

            is_at_risk = is_abandoned or is_failed
            
            raw_transactions.append({
                "id": tx_id,
                "customer_name": cust_name,
                "customer_tier": cust_tier,
                "amount": amount,
                "payment_method": method,
                "bank": bank,
                "is_abandoned": is_abandoned,
                "is_failed": is_failed,
                "failure_reason": failure_reason,
                "failure_category": failure_category,
                "is_at_risk": is_at_risk,
                "previous_success_count": prev_success,
                "previous_failure_count": prev_failure,
                "customer_tenure_days": tenure_days,
                "checkout_duration_seconds": checkout_sec,
                "hour_of_day": int(rng.uniform(8, 23)),
                "day_of_week": int(rng.uniform(0, 6)),
                "merchant_category": controls.merchant_category,
                "device_type": py_rand.choice(["MOBILE_ANDROID", "MOBILE_IOS", "DESKTOP"]),
                "historical_avg_order_value": amount
            })

        # Segregate transactions
        clean_txs = [t for t in raw_transactions if not t["is_at_risk"]]
        at_risk_txs = [t for t in raw_transactions if t["is_at_risk"]]
        
        total_gmv = round(sum(t["amount"] for t in raw_transactions), 2)
        clean_gmv = round(sum(t["amount"] for t in clean_txs), 2)
        at_risk_gmv = round(sum(t["amount"] for t in at_risk_txs), 2)
        
        # -------------------------------------------------------------
        # 1. BASELINE RECOVERY EXECUTION
        # -------------------------------------------------------------
        # Documented simple rules:
        # Technical error -> 1 generic RETRY_NOW (p ~ 0.16, cost ₹2.0)
        # Invalid instrument / Fraud -> 1 generic RETRY_NOW (p = 0.0, cost ₹2.0, wasted!)
        # Customer action required -> 1 generic reminder (p ~ 0.12, cost ₹2.5)
        # Abandonment -> 1 generic reminder (p ~ 0.11, cost ₹2.0)
        baseline_results = []
        for t in at_risk_txs:
            reason = t["failure_reason"] or "CHECKOUT_ABANDONED"
            category = t["failure_category"] or "ABANDONMENT"
            amt = t["amount"]
            
            # PRNG for baseline outcome
            u_base = rng.uniform(0.0, 1.0)
            
            if category == "TEMPORARY":
                action = "GENERIC_RETRY_NOW"
                cost = 2.0
                p_base = 0.16
                recovered = (u_base < p_base)
            elif category == "PAYMENT_METHOD_SPECIFIC":
                # Blind retry on invalid instrument
                action = "GENERIC_RETRY_NOW"
                cost = 2.0
                p_base = 0.00
                recovered = False
            elif category == "RISK_BLOCKED":
                # Blind retry on fraud
                action = "GENERIC_RETRY_NOW"
                cost = 2.0
                p_base = 0.00
                recovered = False
            elif category == "CUSTOMER_ACTION_REQUIRED":
                action = "GENERIC_REMINDER_EMAIL"
                cost = 2.5
                p_base = 0.12
                recovered = (u_base < p_base)
            else: # ABANDONMENT
                action = "GENERIC_CART_EMAIL"
                cost = 2.0
                p_base = 0.11
                recovered = (u_base < p_base)
            
            rec_amt = amt if recovered else 0.0
            net_val = rec_amt - cost
            
            baseline_results.append({
                "tx_id": t["id"],
                "action": action,
                "cost": cost,
                "probability": p_base,
                "recovered": recovered,
                "recovered_amount": rec_amt,
                "net_val": net_val,
                "is_wasted_retry": (category in ["PAYMENT_METHOD_SPECIFIC", "RISK_BLOCKED"])
            })

        # -------------------------------------------------------------
        # 2. RECOVERAI AUTONOMOUS PIPELINE EXECUTION
        # -------------------------------------------------------------
        # Vectorized ML Inference using real XGBoost model artifacts
        ml_records = []
        for t in at_risk_txs:
            ml_records.append({
                "amount": t["amount"],
                "payment_method": t["payment_method"],
                "bank": t["bank"],
                "failure_reason": t["failure_reason"] or "CHECKOUT_ABANDONED",
                "failure_category": t["failure_category"] or "ABANDONMENT",
                "attempt_count": 1,
                "previous_successes": t["previous_success_count"],
                "previous_failures": t["previous_failure_count"],
                "preferred_method": t["payment_method"],
                "customer_tenure_days": t["customer_tenure_days"],
                "customer_value": t["customer_tier"],
                "hour_of_day": t["hour_of_day"],
                "day_of_week": t["day_of_week"],
                "merchant_category": t["merchant_category"],
                "checkout_abandoned": 1 if t["is_abandoned"] else 0,
                "checkout_duration_seconds": t["checkout_duration_seconds"],
                "device_type": t["device_type"],
                "historical_avg_order_value": t["amount"]
            })

        # Batch predict with model
        ml_predictions = inference_engine.predict_batch(ml_records) if ml_records else []

        recoverai_results = []
        guardrail_counts = {
            "RISK_FRAUD_CIRCUIT_BREAKER": {"count": 0, "amount": 0.0, "action": "STOP_AUTO_RECOVERY"},
            "PERMANENT_FAILURE_SUPPRESSION": {"count": 0, "amount": 0.0, "action": "SWITCH_TO_PAYLINK"},
            "HIGH_VALUE_SUPERVISOR_ROUTING": {"count": 0, "amount": 0.0, "action": "HUMAN_ESCALATION"},
            "LOW_PROBABILITY_SUPPRESSION": {"count": 0, "amount": 0.0, "action": "NO_ACTION"},
            "CUSTOMER_OPT_OUT": {"count": 0, "amount": 0.0, "action": "STOP"}
        }

        stopped_cases_count = 0
        human_escalation_count = 0

        for idx, t in enumerate(at_risk_txs):
            amt = t["amount"]
            amt_paise = int(amt * PAISE_PER_INR)
            reason = t["failure_reason"] or "CHECKOUT_ABANDONED"
            category = t["failure_category"] or "ABANDONMENT"
            tier = t["customer_tier"]
            pred = ml_predictions[idx] if idx < len(ml_predictions) else {}
            
            action_probs = pred.get("action_probabilities", {})
            overall_prob = pred.get("recovery_probability", 0.50)

            # Evaluate each candidate action with ERV & Guardrails
            action_candidates = []
            for act, p in action_probs.items():
                cost_inr = decision_config.INTERVENTION_COSTS_INR.get(act, 5.0)
                cost_paise = int(cost_inr * PAISE_PER_INR)
                
                # Friction & Risk
                friction_inr = strategy_evaluator._compute_friction_penalty(act, 1, tier)
                friction_paise = int(friction_inr * PAISE_PER_INR)
                
                risk_inr = strategy_evaluator._compute_risk_penalty(act, amt, category)
                risk_paise = int(risk_inr * PAISE_PER_INR)
                
                expected_return_paise = int(p * amt_paise)
                erv_paise = expected_return_paise - cost_paise - friction_paise - risk_paise
                erv_inr = round(max(0.0, erv_paise / float(PAISE_PER_INR)), 2)

                # Check Guardrails
                allowed, g_reason = strategy_evaluator._evaluate_guardrail(
                    action=act,
                    attempt_count=1,
                    failure_reason=reason,
                    taxonomy=category,
                    amount_inr=amt,
                    customer_tier=tier,
                    erv_inr=erv_inr
                )

                action_candidates.append({
                    "action": act,
                    "probability": p,
                    "expected_recovery_value": erv_inr,
                    "cost": cost_inr,
                    "allowed": allowed,
                    "guardrail_reason": g_reason
                })

            # High value / VIP supervisor escalation guardrail check
            is_high_ticket = (amt >= 10000.0) or (tier in ["VIP", "ENTERPRISE"] and amt >= 5000.0)
            
            # Select best permitted action
            permitted = [c for c in action_candidates if c["allowed"]]
            if not permitted:
                selected_candidate = next((c for c in action_candidates if c["action"] == "NO_ACTION"), action_candidates[0])
            else:
                permitted.sort(key=lambda x: (x["expected_recovery_value"], x["probability"]), reverse=True)
                selected_candidate = permitted[0]
                
                # If high value and human escalation is allowed, route to human concierge
                if is_high_ticket and category not in ["RISK_BLOCKED", "PERMANENT"]:
                    human_cand = next((c for c in action_candidates if c["action"] == "HUMAN_ESCALATION" and c["allowed"]), None)
                    if human_cand:
                        selected_candidate = human_cand

            selected_action = selected_candidate["action"]
            chosen_prob = selected_candidate["probability"]
            chosen_cost = selected_candidate["cost"]
            chosen_erv = selected_candidate["expected_recovery_value"]

            # Guardrail breaches tracking
            g_status = "POLICY_CLEARED"
            g_desc = None
            is_human = False

            if category == "RISK_BLOCKED":
                g_status = "RISK_FRAUD_STOP"
                g_desc = f"Risk alert ({reason}) triggered circuit breaker. Interventions stopped."
                guardrail_counts["RISK_FRAUD_CIRCUIT_BREAKER"]["count"] += 1
                guardrail_counts["RISK_FRAUD_CIRCUIT_BREAKER"]["amount"] += amt
                stopped_cases_count += 1
                selected_action = "NO_ACTION"
                chosen_cost = 0.0
                chosen_prob = 0.0
            elif category == "PAYMENT_METHOD_SPECIFIC" and reason in ["EXPIRED_CARD", "INVALID_CARD"]:
                g_status = "PERMANENT_DEFECT_DIVERT"
                g_desc = f"Expired/defective instrument ({reason}). Direct retries blocked; 1-click Paylink routed."
                guardrail_counts["PERMANENT_FAILURE_SUPPRESSION"]["count"] += 1
                guardrail_counts["PERMANENT_FAILURE_SUPPRESSION"]["amount"] += amt
            elif is_high_ticket and selected_action == "HUMAN_ESCALATION":
                g_status = "HIGH_VALUE_ESCALATED"
                g_desc = f"Order value ₹{amt:,.2f} routed to human supervisor concierge."
                guardrail_counts["HIGH_VALUE_SUPERVISOR_ROUTING"]["count"] += 1
                guardrail_counts["HIGH_VALUE_SUPERVISOR_ROUTING"]["amount"] += amt
                human_escalation_count += 1
                is_human = True
            elif chosen_prob < 0.20 and selected_action != "NO_ACTION":
                g_status = "LOW_PROBABILITY_SUPPRESSED"
                g_desc = f"P(recovery)={chosen_prob:.1%} below economic threshold. Suppressed."
                guardrail_counts["LOW_PROBABILITY_SUPPRESSION"]["count"] += 1
                guardrail_counts["LOW_PROBABILITY_SUPPRESSION"]["amount"] += amt
                stopped_cases_count += 1
                selected_action = "NO_ACTION"
                chosen_cost = 0.0
                chosen_prob = 0.0

            # Deterministic outcome draw
            u_recai = rng.uniform(0.0, 1.0)
            if selected_action == "NO_ACTION":
                recovered = False
            else:
                recovered = (u_recai < chosen_prob)

            rec_amt = amt if recovered else 0.0
            net_val = rec_amt - chosen_cost

            recoverai_results.append({
                "tx_id": t["id"],
                "action": selected_action,
                "probability": chosen_prob,
                "cost": chosen_cost,
                "erv": chosen_erv,
                "recovered": recovered,
                "recovered_amount": rec_amt,
                "net_val": net_val,
                "guardrail_status": g_status,
                "guardrail_desc": g_desc,
                "is_human_escalation": is_human
            })

        # -------------------------------------------------------------
        # 3. AGGREGATE RESULTS & BENCHMARKS
        # -------------------------------------------------------------
        recai_recovered_rev = round(sum(r["recovered_amount"] for r in recoverai_results), 2)
        base_recovered_rev = round(sum(b["recovered_amount"] for b in baseline_results), 2)
        
        recai_total_cost = round(sum(r["cost"] for r in recoverai_results), 2)
        base_total_cost = round(sum(b["cost"] for b in baseline_results), 2)
        
        base_wasted_retries_cost = round(sum(b["cost"] for b in baseline_results if b["is_wasted_retry"]), 2)
        
        recai_net_val = round(recai_recovered_rev - recai_total_cost, 2)
        base_net_val = round(base_recovered_rev - base_total_cost, 2)
        
        recai_recovery_rate = round((recai_recovered_rev / at_risk_gmv * 100) if at_risk_gmv > 0 else 0.0, 2)
        base_recovery_rate = round((base_recovered_rev / at_risk_gmv * 100) if at_risk_gmv > 0 else 0.0, 2)
        
        recai_permanent_loss = round(max(0.0, at_risk_gmv - recai_recovered_rev), 2)
        base_permanent_loss = round(max(0.0, at_risk_gmv - base_recovered_rev), 2)
        
        incremental_recovered = round(recai_recovered_rev - base_recovered_rev, 2)
        rel_improvement_pct = round(((recai_recovered_rev - base_recovered_rev) / base_recovered_rev * 100) if base_recovered_rev > 0 else 0.0, 1)
        
        net_lift_amt = round(recai_net_val - base_net_val, 2)
        net_lift_pct = round(((recai_net_val - base_net_val) / abs(base_net_val) * 100) if base_net_val != 0 else 0.0, 1)
        
        recai_attempted = sum(1 for r in recoverai_results if r["action"] != "NO_ACTION")
        base_attempted = len(baseline_results)
        
        avg_interventions = round(recai_attempted / len(at_risk_txs), 2) if at_risk_txs else 1.0
        
        roi_recai = round((recai_recovered_rev / recai_total_cost) if recai_total_cost > 0 else 0.0, 1)
        roi_base = round((base_recovered_rev / base_total_cost) if base_total_cost > 0 else 0.0, 1)

        # -------------------------------------------------------------
        # 4. CHART DATA GENERATION
        # -------------------------------------------------------------
        # Revenue Waterfall
        waterfall = [
            WaterfallItem(stage="Total Volume (GMV)", amount=total_gmv, color="#43403B", description="Gross simulation batch transaction volume"),
            WaterfallItem(stage="Initial Success", amount=clean_gmv, color="#3F725B", description="Transactions cleanly authorized without friction"),
            WaterfallItem(stage="Revenue At Risk", amount=at_risk_gmv, color="#D95D39", description="Failed payment attempts + cart drop-offs"),
            WaterfallItem(stage="Baseline Recovered", amount=base_recovered_rev, color="#C08A3E", description="Standard 1-retry + reminder benchmark"),
            WaterfallItem(stage="Incremental Recovered", amount=max(0.0, incremental_recovered), color="#3F725B", description="Additional recovered revenue driven by RecoverAI"),
            WaterfallItem(stage="RecoverAI Recovered", amount=recai_recovered_rev, color="#2D5A43", description="Total net revenue captured autonomously by RecoverAI"),
            WaterfallItem(stage="Permanent Loss", amount=recai_permanent_loss, color="#8B2616", description="Unrecoverable fraud alerts or permanent declines")
        ]

        # Strategy Performance Breakdown
        strategy_stats = {}
        for r in recoverai_results:
            act = r["action"]
            if act not in strategy_stats:
                strategy_stats[act] = {"attempts": 0, "recovered_count": 0, "recovered_amt": 0.0, "cost": 0.0, "erv": 0.0}
            strategy_stats[act]["attempts"] += 1
            if r["recovered"]:
                strategy_stats[act]["recovered_count"] += 1
                strategy_stats[act]["recovered_amt"] += r["recovered_amount"]
            strategy_stats[act]["cost"] += r["cost"]
            strategy_stats[act]["erv"] += r["erv"]

        strategy_breakdown = []
        for act, data in strategy_stats.items():
            att = data["attempts"]
            rec_c = data["recovered_count"]
            rec_a = round(data["recovered_amt"], 2)
            cst = round(data["cost"], 2)
            win_rate = round((rec_c / att * 100) if att > 0 else 0.0, 1)
            net_erv = round(data["erv"], 2)
            roi_mult = round((rec_a / cst) if cst > 0 else 0.0, 1)
            
            strategy_breakdown.append(InterventionPerformance(
                strategy=act,
                attempts=att,
                recovered_count=rec_c,
                recovered_amount=rec_a,
                win_rate=win_rate,
                total_cost=cst,
                net_erv=net_erv,
                roi_multiplier=roi_mult
            ))
        strategy_breakdown.sort(key=lambda s: s.recovered_amount, reverse=True)

        # Timeline Cumulative Recovery (12 steps)
        steps_count = 12
        chunk_size = max(1, len(at_risk_txs) // steps_count)
        timeline = []
        cum_recai = 0.0
        cum_base = 0.0
        cum_risk = 0.0

        for step in range(1, steps_count + 1):
            idx_end = step * chunk_size if step < steps_count else len(at_risk_txs)
            idx_start = (step - 1) * chunk_size
            
            chunk_risk = sum(at_risk_txs[k]["amount"] for k in range(idx_start, idx_end))
            chunk_recai = sum(recoverai_results[k]["recovered_amount"] for k in range(idx_start, idx_end))
            chunk_base = sum(baseline_results[k]["recovered_amount"] for k in range(idx_start, idx_end))
            
            cum_risk += chunk_risk
            cum_recai += chunk_recai
            cum_base += chunk_base
            
            hour = 8 + int((step / steps_count) * 14)
            timeline.append(TimelinePoint(
                step=step,
                hour_label=f"{hour:02d}:00",
                recoverai_cumulative_recovered=round(cum_recai, 2),
                baseline_cumulative_recovered=round(cum_base, 2),
                at_risk_cumulative=round(cum_risk, 2)
            ))

        # Failure Category Recovery
        cat_stats = {}
        for idx, t in enumerate(at_risk_txs):
            cat = t["failure_category"] or "ABANDONMENT"
            amt = t["amount"]
            rec_recai = recoverai_results[idx]["recovered_amount"]
            rec_base = baseline_results[idx]["recovered_amount"]
            
            if cat not in cat_stats:
                cat_stats[cat] = {"risk": 0.0, "recai": 0.0, "base": 0.0}
            cat_stats[cat]["risk"] += amt
            cat_stats[cat]["recai"] += rec_recai
            cat_stats[cat]["base"] += rec_base

        category_recovery = []
        for cat, val in cat_stats.items():
            r_amt = round(val["risk"], 2)
            recai_a = round(val["recai"], 2)
            base_a = round(val["base"], 2)
            recai_r = round((recai_a / r_amt * 100) if r_amt > 0 else 0.0, 1)
            base_r = round((base_a / r_amt * 100) if r_amt > 0 else 0.0, 1)
            lift = round(recai_r - base_r, 1)
            category_recovery.append(CategoryRecoveryStat(
                category=cat,
                at_risk_amount=r_amt,
                recoverai_recovered=recai_a,
                recoverai_rate=recai_r,
                baseline_recovered=base_a,
                baseline_rate=base_r,
                lift_percent=lift
            ))
        category_recovery.sort(key=lambda c: c.at_risk_amount, reverse=True)

        # Payment Method Recovery
        method_stats = {}
        for idx, t in enumerate(at_risk_txs):
            m = t["payment_method"]
            amt = t["amount"]
            rec_recai = recoverai_results[idx]["recovered_amount"]
            rec_base = baseline_results[idx]["recovered_amount"]
            
            if m not in method_stats:
                method_stats[m] = {"risk": 0.0, "recai": 0.0, "base": 0.0}
            method_stats[m]["risk"] += amt
            method_stats[m]["recai"] += rec_recai
            method_stats[m]["base"] += rec_base

        method_recovery = []
        for m, val in method_stats.items():
            r_amt = round(val["risk"], 2)
            recai_a = round(val["recai"], 2)
            base_a = round(val["base"], 2)
            recai_r = round((recai_a / r_amt * 100) if r_amt > 0 else 0.0, 1)
            base_r = round((base_a / r_amt * 100) if r_amt > 0 else 0.0, 1)
            lift = round(recai_r - base_r, 1)
            method_recovery.append(PaymentMethodRecoveryStat(
                method=m,
                at_risk_amount=r_amt,
                recoverai_recovered=recai_a,
                recoverai_rate=recai_r,
                baseline_recovered=base_a,
                baseline_rate=base_r,
                lift_percent=lift
            ))
        method_recovery.sort(key=lambda m: m.at_risk_amount, reverse=True)

        # Guardrail Breaches Summary List
        guardrail_breaches = []
        for rule_name, g_info in guardrail_counts.items():
            if g_info["count"] > 0:
                guardrail_breaches.append(GuardrailBreachSummary(
                    rule=rule_name,
                    count=g_info["count"],
                    impacted_amount=round(g_info["amount"], 2),
                    action_taken=g_info["action"]
                ))

        # Simulated Transactions Sample (up to 50 items for table display)
        sample_size = min(50, len(at_risk_txs))
        transactions_sample = []
        for k in range(sample_size):
            t = at_risk_txs[k]
            b = baseline_results[k]
            r = recoverai_results[k]
            
            transactions_sample.append(SimulatedTransactionItem(
                id=t["id"],
                customer_name=t["customer_name"],
                customer_tier=t["customer_tier"],
                amount=t["amount"],
                payment_method=t["payment_method"],
                bank=t["bank"],
                is_abandoned=t["is_abandoned"],
                failure_reason=t["failure_reason"],
                failure_category=t["failure_category"],
                is_at_risk=True,
                baseline_attempted=True,
                baseline_action=b["action"],
                baseline_recovered=b["recovered"],
                baseline_recovered_amount=b["recovered_amount"],
                baseline_cost=b["cost"],
                baseline_net_value=b["net_val"],
                recoverai_attempted=(r["action"] != "NO_ACTION"),
                recoverai_action=r["action"],
                recoverai_probability=r["probability"],
                recoverai_erv=r["erv"],
                recoverai_guardrail_status=r["guardrail_status"],
                recoverai_guardrail_reason=r["guardrail_desc"],
                recoverai_recovered=r["recovered"],
                recoverai_recovered_amount=r["recovered_amount"],
                recoverai_cost=r["cost"],
                recoverai_net_value=r["net_val"],
                is_human_escalation=r["is_human_escalation"]
            ))

        return BatchSimulationResponse(
            is_simulated=True,
            simulation_id=sim_id,
            seed=controls.seed,
            preset_name=controls.preset_name,
            controls=controls,
            executed_at=executed_at,
            model_version=inference_engine.get_metadata().get("model_version", "1.0.0-production"),
            total_gmv=total_gmv,
            clean_success_gmv=clean_gmv,
            revenue_at_risk=at_risk_gmv,
            revenue_attempted_recoverai=round(sum(t["amount"] for idx, t in enumerate(at_risk_txs) if recoverai_results[idx]["action"] != "NO_ACTION"), 2),
            revenue_attempted_baseline=at_risk_gmv,
            recoverai_recovered_revenue=recai_recovered_rev,
            recoverai_recovery_rate=recai_recovery_rate,
            recoverai_net_recovery_value=recai_net_val,
            recoverai_permanent_loss=recai_permanent_loss,
            recoverai_total_cost=recai_total_cost,
            recoverai_avg_intervention_count=avg_interventions,
            recoverai_stopped_cases=stopped_cases_count,
            recoverai_human_escalations=human_escalation_count,
            baseline_recovered_revenue=base_recovered_rev,
            baseline_recovery_rate=base_recovery_rate,
            baseline_net_recovery_value=base_net_val,
            baseline_permanent_loss=base_permanent_loss,
            baseline_total_cost=base_total_cost,
            baseline_wasted_retries_cost=base_wasted_retries_cost,
            incremental_revenue_recovered=incremental_recovered,
            relative_improvement_percent=rel_improvement_pct,
            net_value_lift_amount=net_lift_amt,
            net_value_lift_percent=net_lift_pct,
            roi_multiple_recoverai=roi_recai,
            roi_multiple_baseline=roi_base,
            waterfall=waterfall,
            strategy_breakdown=strategy_breakdown,
            timeline_recovery=timeline,
            category_recovery=category_recovery,
            method_recovery=method_recovery,
            guardrail_breaches=guardrail_breaches,
            transactions_sample=transactions_sample,
            total_transactions_count=n_tx
        )

simulation_service = SimulationService()
