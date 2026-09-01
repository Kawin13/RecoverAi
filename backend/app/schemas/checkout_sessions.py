from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class CheckoutSessionCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = "Demo Customer"
    customer_email: Optional[str] = "shopper@example.com"
    customer_phone: Optional[str] = "+919876543210"
    customer_tier: Optional[str] = "STANDARD"
    cart_amount: float = Field(..., gt=0, description="Total monetary cart value in INR")
    selected_method: Optional[str] = "UPI"
    order_id: Optional[str] = None
    is_demo_simulation: bool = Field(True, description="Marks whether this is an interactive demo checkout or real transaction")

class CheckoutSessionTransition(BaseModel):
    new_status: str = Field(..., description="Target lifecycle state: 'CUSTOMER_IDENTIFIED', 'PAYMENT_METHOD_VIEWED', 'PAYMENT_INITIATED', 'COMPLETED', 'ABANDONED'")
    selected_method: Optional[str] = None
    payment_attempted: Optional[bool] = None
    customer_id: Optional[str] = None

class CheckoutSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    order_id: str
    cart_amount: float
    status: str
    selected_method: Optional[str] = None
    payment_attempted: bool
    started_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    abandoned_at: Optional[datetime] = None
    is_demo_simulation: bool
    recovery_case_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_tier: Optional[str] = None

class AbandonmentCaseDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: str
    order_id: str
    customer_id: str
    customer_name: str
    customer_email: str
    customer_phone: Optional[str] = None
    customer_tier: str
    customer_ltv: float
    cart_amount: float
    currency: str = "INR"
    dropped_at_step: str
    recency_minutes: float
    historical_conversion: float
    preferred_payment_method: str
    recovery_probability: float
    expected_recovery_value: float
    selected_strategy: str  # PERSONALIZED_REMINDER, PAYMENT_LINK, NO_ACTION, HUMAN_ESCALATION
    channel: str
    recovery_message: Dict[str, Any]
    recovery_case_id: Optional[str] = None
    is_demo_simulation: bool
    started_at: Optional[datetime] = None
    abandoned_at: Optional[datetime] = None

class FunnelStageItem(BaseModel):
    stage_key: str
    stage_name: str
    count: int
    conversion_rate: float
    drop_off_count: int

class AbandonmentFunnelResponse(BaseModel):
    total_sessions: int
    checkout_started: int
    payment_attempted: int
    abandoned: int
    recovery_initiated: int
    recovered: int
    abandonment_rate: float
    recovery_rate: float
    at_risk_abandoned_inr: float
    recovered_abandoned_inr: float
    stages: List[FunnelStageItem]
