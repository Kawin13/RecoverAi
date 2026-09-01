from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime

class AnalyticsFilters(BaseModel):
    time_range: str = Field("7d", description="Time window: today, 7d, 30d, custom")
    start_date: Optional[str] = Field(None, description="ISO format start date for custom range")
    end_date: Optional[str] = Field(None, description="ISO format end date for custom range")
    payment_method: Optional[str] = Field(None, description="Payment rail: ALL, UPI, Card, NetBanking, Wallet, EMI")
    failure_reason: Optional[str] = Field(None, description="Failure reason code or taxonomy")
    strategy: Optional[str] = Field(None, description="Recovery strategy name")
    status: Optional[str] = Field(None, description="Recovery status: ALL, RECOVERED, FAILED, IN_PROGRESS, STOPPED, ESCALATED")

class FinancialSummaryKPIs(BaseModel):
    revenue_at_risk: float
    revenue_recovered: float
    recovery_rate: float
    net_recovery_value: float
    active_recoveries: int
    avg_recovery_time_minutes: float
    avg_attempts_before_recovery: float
    at_risk_delta_percent: float
    recovered_delta_percent: float
    recovery_rate_delta_percent: float

class StrategyBreakdownItem(BaseModel):
    strategy_key: str
    strategy_name: str
    attempts: int
    success_count: int
    recovery_rate: float
    recovered_amount: float
    channel_cost: float
    net_erv: float
    avg_time_minutes: float

class FailureReasonBreakdownItem(BaseModel):
    failure_reason: str
    taxonomy_category: str
    total_count: int
    recovered_count: int
    recovery_rate: float
    at_risk_amount: float
    recovered_amount: float

class PaymentMethodBreakdownItem(BaseModel):
    method: str
    total_volume: int
    recovered_count: int
    at_risk_amount: float
    recovered_amount: float
    loss_amount: float
    recovery_rate: float

class MerchantCategoryBreakdownItem(BaseModel):
    category: str
    total_count: int
    at_risk_amount: float
    recovered_amount: float
    recovery_rate: float

class CustomerSegmentBreakdownItem(BaseModel):
    tier: str
    account_count: int
    at_risk_amount: float
    recovered_amount: float
    recovery_rate: float
    net_erv: float

class TimelineTrendPoint(BaseModel):
    label: str
    at_risk: float
    recovered: float
    target: float

class FilterOptions(BaseModel):
    payment_methods: List[str]
    failure_reasons: List[str]
    strategies: List[str]
    statuses: List[str]

class AnalyticsResponse(BaseModel):
    kpis: FinancialSummaryKPIs
    recovery_by_strategy: List[StrategyBreakdownItem]
    recovery_by_failure_reason: List[FailureReasonBreakdownItem]
    recovery_by_payment_method: List[PaymentMethodBreakdownItem]
    recovery_by_merchant_category: List[MerchantCategoryBreakdownItem]
    recovery_by_customer_segment: List[CustomerSegmentBreakdownItem]
    timeline_trend: List[TimelineTrendPoint]
    filter_options: FilterOptions
    applied_filters: AnalyticsFilters
    evaluated_at: str
