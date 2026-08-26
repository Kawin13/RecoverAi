from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.schemas.customer import CustomerResponse

class RecoveryActionResponse(BaseModel):
    id: str
    strategy: str
    channel: str
    payload_data: Optional[str] = None
    erv: float
    status: str
    dispatched_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AgentDecisionResponse(BaseModel):
    id: str
    model_name: str
    input_features: Optional[str] = None
    propensity_scores: Optional[str] = None
    selected_action: str
    reasoning_summary: str
    decided_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RecoveryOutcomeResponse(BaseModel):
    id: str
    recovered_amount: float
    payment_method_used: str
    time_to_recover_seconds: int
    settled_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TransactionSummary(BaseModel):
    id: str
    order_id: str
    amount: float
    currency: str
    method: str
    customer: Optional[CustomerResponse] = None

    model_config = ConfigDict(from_attributes=True)

class RecoveryCaseDetailResponse(BaseModel):
    id: str
    transaction_id: str
    risk_amount: float
    failure_category: str
    recovery_probability: float
    selected_strategy: str
    expected_recovery_value: float
    status: str
    attempt_count: int
    created_at: datetime
    updated_at: datetime
    recovered_at: Optional[datetime] = None

    # Nested Relations
    transaction: Optional[TransactionSummary] = None
    recovery_actions: List[RecoveryActionResponse] = []
    agent_decisions: List[AgentDecisionResponse] = []
    recovery_outcome: Optional[RecoveryOutcomeResponse] = None

    model_config = ConfigDict(from_attributes=True)

class RecoveryCaseListResponse(BaseModel):
    items: List[RecoveryCaseDetailResponse]
    total: int
    page: int
    limit: int
    total_pages: int
