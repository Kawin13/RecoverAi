from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class StrategyComparisonItem(BaseModel):
    action: str
    probability: float
    expected_recovery_value: float
    erv_paise: int
    cost: float
    friction_penalty: float
    risk_penalty: float
    allowed: bool
    guardrail_reason: Optional[str] = None
    rank: int

class DiagnosisInfo(BaseModel):
    failure_reason: str
    taxonomy: str
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
