from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List

class PredictionRequest(BaseModel):
    amount: float = Field(..., description="Transaction amount in INR", ge=1.0)
    payment_method: str = Field(..., description="Payment method: UPI, CARD, NET_BANKING, WALLET, MANDATE")
    failure_reason: str = Field(..., description="Specific failure reason code (e.g. UPI_TIMEOUT, OTP_FAILED, EXPIRED_CARD)")
    failure_category: Optional[str] = Field("TECHNICAL_TIMEOUT", description="Failure category")
    attempt_count: int = Field(1, description="Current payment attempt number", ge=1)
    previous_successes: int = Field(10, description="Customer previous successful transactions count", ge=0)
    previous_failures: int = Field(1, description="Customer previous failed transactions count", ge=0)
    preferred_method: Optional[str] = Field("UPI", description="Customer preferred payment method")
    customer_value: Optional[str] = Field("GROWTH", description="Customer tier: STANDARD, GROWTH, VIP, ENTERPRISE")
    customer_tenure_days: Optional[int] = Field(120, description="Customer account tenure in days")
    bank: Optional[str] = Field("HDFC Bank", description="Issuing / Acquirer Bank name")
    hour_of_day: Optional[int] = Field(None, description="Hour of transaction failure (0-23)")
    day_of_week: Optional[int] = Field(None, description="Day of week (0=Mon, 6=Sun)")
    merchant_category: Optional[str] = Field("E-Commerce & Retail", description="Merchant business category")
    checkout_abandoned: Optional[int] = Field(0, description="1 if checkout was abandoned before payment attempt")
    checkout_duration_seconds: Optional[int] = Field(60, description="Duration of checkout in seconds")
    device_type: Optional[str] = Field("MOBILE_ANDROID", description="Customer device type")
    historical_avg_order_value: Optional[float] = Field(None, description="Customer average historical order value")

class ConfidenceInterval(BaseModel):
    lower_bound: float
    upper_bound: float
    margin: float

class ModelMetadata(BaseModel):
    version: str
    algorithm: str
    trained_at: Optional[str] = None
    model_name: Optional[str] = None
    loaded: Optional[bool] = None
    artifact_checksum: Optional[str] = None
    scoring_mode: Optional[str] = None
    dataset_type: Optional[str] = None

class PredictionResponse(BaseModel):
    recovery_probability: float = Field(..., description="Overall recovery probability P(recovery)")
    confidence_interval: ConfidenceInterval = Field(..., description="95% probability confidence interval")
    recommended_action: str = Field(..., description="Optimal intervention action maximizing ERV")
    expected_recovery_value: float = Field(..., description="Expected monetary recovery value in INR")
    action_probabilities: Dict[str, float] = Field(..., description="Predicted recovery probability for each candidate action")
    action_ervs: Dict[str, float] = Field(..., description="Expected recovery value in INR for each candidate action")
    model_metadata: ModelMetadata = Field(..., description="Model version and architecture details")
