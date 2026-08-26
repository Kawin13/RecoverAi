from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.schemas.customer import CustomerResponse

class PaymentAttemptResponse(BaseModel):
    id: str
    attempt_number: int
    gateway: str
    gateway_payment_id: Optional[str] = None
    error_code: Optional[str] = None
    error_description: Optional[str] = None
    error_category: Optional[str] = None
    latency_ms: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RecoveryCaseSummary(BaseModel):
    id: str
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

    model_config = ConfigDict(from_attributes=True)

class TransactionResponse(BaseModel):
    id: str
    order_id: str
    customer_id: str
    amount: float
    currency: str
    method: str
    status: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Expanded nested relations
    customer: Optional[CustomerResponse] = None
    recovery_case: Optional[RecoveryCaseSummary] = None
    payment_attempts: List[PaymentAttemptResponse] = []

    model_config = ConfigDict(from_attributes=True)

class TransactionListResponse(BaseModel):
    items: List[TransactionResponse]
    total: int
    page: int
    limit: int
    total_pages: int
