from typing import List, Optional
from pydantic import BaseModel

class DashboardMetrics(BaseModel):
    revenue_at_risk: float
    revenue_recovered: float
    recovery_rate: float
    active_recoveries: int
    at_risk_delta_percent: float
    recovered_delta_percent: float
    recovery_rate_delta_percent: float
    active_delta_count: int

class TrendPoint(BaseModel):
    date: str
    at_risk: float
    recovered: float
    target: float

class StrategyMetric(BaseModel):
    strategy: str
    strategy_key: str
    attempts: int
    success_count: int
    recovery_rate: float
    recovered_amount: float
    avg_recovery_time_minutes: float

class PaymentBreakdown(BaseModel):
    method: str
    volume: int
    recovered_amount: float
    loss_amount: float
    recovery_rate: float

class FailureReasonBreakdown(BaseModel):
    category: str
    label: str
    count: int
    total_amount: float
    recovered_amount: float
    recovery_rate: float

class RecentAgentActivity(BaseModel):
    id: str
    timestamp: str
    transaction_id: str
    customer_name: str
    amount: float
    action: str
    status: str
    erv: float
    explanation: str

class DashboardResponse(BaseModel):
    metrics: DashboardMetrics
    trend_data: List[TrendPoint]
    strategy_performance: List[StrategyMetric]
    payment_breakdown: List[PaymentBreakdown]
    failure_reasons: List[FailureReasonBreakdown]
    recent_activities: List[RecentAgentActivity]
