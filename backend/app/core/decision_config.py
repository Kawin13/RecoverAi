"""
RecoverAI - Decision Intelligence & ERV Configuration
Defines intervention costs, customer friction weights, risk penalty multipliers,
and guardrail operational thresholds.
"""

from typing import Dict, Any

# Minor currency unit conversion factor (1 INR = 100 paise)
PAISE_PER_INR = 100

class DecisionConfig:
    # -------------------------------------------------------------------------
    # Base Direct Intervention Costs (in INR)
    # -------------------------------------------------------------------------
    INTERVENTION_COSTS_INR: Dict[str, float] = {
        "RETRY_NOW": 2.0,           # Gateway API query + processing cost
        "RETRY_LATER": 2.5,         # Scheduler job + gateway queueing
        "UPI_SWITCH": 4.0,          # PSP dynamic deep-link intent routing
        "PAYMENT_LINK": 5.0,        # SMS / WhatsApp transactional notification gateway
        "PERSONALIZED_REMINDER": 8.0,# Push notification / dunning cadence
        "HUMAN_ESCALATION": 45.0,   # Human concierge operator time cost
        "NO_ACTION": 0.0            # No financial cost
    }

    # -------------------------------------------------------------------------
    # Customer Friction Baseline Penalties (in INR equivalent)
    # -------------------------------------------------------------------------
    BASE_FRICTION_PENALTIES_INR: Dict[str, float] = {
        "RETRY_NOW": 1.0,           # Silent background retry, minimal user friction
        "RETRY_LATER": 2.0,         # Slight delay before resolution
        "UPI_SWITCH": 3.0,          # User must approve prompt in UPI app
        "PAYMENT_LINK": 6.0,        # User receives link notification
        "PERSONALIZED_REMINDER": 12.0, # Dunning ping; potential customer fatigue
        "HUMAN_ESCALATION": 25.0,   # Invasive outreach; appropriate only for high-value/VIP
        "NO_ACTION": 0.0
    }

    # -------------------------------------------------------------------------
    # Guardrail & Operational Thresholds
    # -------------------------------------------------------------------------
    MAX_ATTEMPTS_BEFORE_SUPPRESSION: int = 4
    COOLING_DOWN_PERIOD_MINUTES: int = 15
    MIN_PROBABILITY_THRESHOLD: float = 0.08
    URGENT_HIGH_VALUE_THRESHOLD_INR: float = 25000.0  # Critical risk tiering & urgent operations
    HUMAN_APPROVAL_THRESHOLD_INR: float = 10000.0     # Guardrail requiring human supervisor sign-off
    HIGH_VALUE_THRESHOLD_INR: float = 25000.0         # Backward compatibility alias (Urgent threshold)
    MAX_CUSTOMER_DUNNING_FREQUENCY_HOURS: int = 24

    @classmethod
    def get_cost_paise(cls, action: str) -> int:
        return int(cls.INTERVENTION_COSTS_INR.get(action, 5.0) * PAISE_PER_INR)

    @classmethod
    def get_cost_inr(cls, action: str) -> float:
        return cls.INTERVENTION_COSTS_INR.get(action, 5.0)

decision_config = DecisionConfig()
