from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class StrategyComparisonItem(BaseModel):
    action: str
    action_code: Optional[str] = None
    display_name: Optional[str] = None
    customer_cta: Optional[str] = None
    probability: float
    expected_recovery_value: float
    erv_paise: int
    cost: float
    friction_penalty: float
    risk_penalty: float = 0.0
    allowed: bool
    guardrail_reason: Optional[str] = None
    rank: int

class DiagnosisInfo(BaseModel):
    failure_reason_code: Optional[str] = None
    failure_reason: str
    failure_category: Optional[str] = None
    taxonomy: str
    failure_source: Optional[str] = "ISSUER_BANK"
    human_readable_reason: Optional[str] = None
    confidence: Optional[float] = 0.95
    raw_gateway_code: Optional[str] = None
    is_transient: bool
    is_retryable_same_instrument: bool
    requires_customer_switch: bool
    is_risk_blocked: bool
    attempt_number: int
    description: str

class DecisionMetadata(BaseModel):
    engine_version: str
    rules_evaluated: int
    model: str

class RecoveryAnalysisResponse(BaseModel):
    transaction_id: str
    selected_action: str
    action_code: Optional[str] = None
    display_name: Optional[str] = None
    customer_cta: Optional[str] = None
    canonical_action: Optional[Dict[str, str]] = None
    recovery_probability: float
    expected_recovery_value: float
    erv_paise: int
    cost: float
    friction_penalty: float
    diagnosis: DiagnosisInfo
    strategies_comparison: List[StrategyComparisonItem]
    evidence: List[str]
    decision_metadata: DecisionMetadata

class RecoveryAnalysisOverride(BaseModel):
    amount: Optional[float] = None
    payment_method: Optional[str] = None
    failure_reason: Optional[str] = None
    attempt_count: Optional[int] = None
