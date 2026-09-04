from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Dict, Any, List, Optional

class PaymentMethodDistribution(BaseModel):
    model_config = ConfigDict(extra="forbid")

    UPI: float = Field(0.65, ge=0.0, le=1.0, description="UPI payment rail share")
    CARD: float = Field(0.20, ge=0.0, le=1.0, description="Credit/Debit card payment rail share")
    NET_BANKING: float = Field(0.10, ge=0.0, le=1.0, description="NetBanking payment rail share")
    WALLET: float = Field(0.05, ge=0.0, le=1.0, description="Digital wallet payment rail share")

    @model_validator(mode="after")
    def validate_total_distribution(self):
        total = self.UPI + self.CARD + self.NET_BANKING + self.WALLET
        if not (0.99 <= total <= 1.01):
            raise ValueError(f"Payment method distribution percentages must total 100% (got {round(total * 100, 1)}%)")
        return self

class SimulationControls(BaseModel):
    model_config = ConfigDict(extra="forbid")

    num_transactions: int = Field(250, ge=20, le=2000, description="Total number of transactions in simulation batch")
    merchant_category: str = Field("E-Commerce & Retail", description="Industry merchant vertical")
    payment_methods_dist: PaymentMethodDistribution = Field(default_factory=PaymentMethodDistribution)
    failure_rate: float = Field(0.20, ge=0.02, le=0.60, description="Rate of technical/payment instrument failures")
    abandonment_rate: float = Field(0.25, ge=0.02, le=0.70, description="Rate of checkout intent drop-off before payment")
    average_order_value: float = Field(2500.0, ge=100.0, le=200000.0, description="Average Order Value in INR")
    seed: int = Field(42, description="Deterministic integer seed for reproducibility")
    preset_name: Optional[str] = Field(None, description="Preset scenario name if selected")

class SimulationPreset(BaseModel):
    id: str
    name: str
    description: str
    badge: str
    controls: SimulationControls

class MethodologyDoc(BaseModel):
    title: str
    version: str
    summary: str
    baseline_rules: List[Dict[str, Any]]
    recoverai_pipeline: List[Dict[str, Any]]
    erv_formula: str
    guardrail_policies: List[Dict[str, Any]]
    disclaimer: str

class InterventionPerformance(BaseModel):
    strategy: str
    attempts: int
    recovered_count: int
    recovered_amount: float
    win_rate: float
    total_cost: float
    net_erv: float
    roi_multiplier: float

class CategoryRecoveryStat(BaseModel):
    category: str
    at_risk_amount: float
    recoverai_recovered: float
    recoverai_rate: float
    baseline_recovered: float
    baseline_rate: float
    lift_percent: float

class PaymentMethodRecoveryStat(BaseModel):
    method: str
    at_risk_amount: float
    recoverai_recovered: float
    recoverai_rate: float
    baseline_recovered: float
    baseline_rate: float
    lift_percent: float

class TimelinePoint(BaseModel):
    step: int
    hour_label: str
    recoverai_cumulative_recovered: float
    baseline_cumulative_recovered: float
    at_risk_cumulative: float

class WaterfallItem(BaseModel):
    stage: str
    amount: float
    color: str
    description: str

class SimulatedTransactionItem(BaseModel):
    id: str
    customer_name: str
    customer_tier: str
    amount: float
    payment_method: str
    bank: str
    is_abandoned: bool
    failure_reason: Optional[str] = None
    failure_category: Optional[str] = None
    is_at_risk: bool
    
    # Baseline outcomes
    baseline_attempted: bool
    baseline_action: str
    baseline_recovered: bool
    baseline_recovered_amount: float
    baseline_cost: float
    baseline_net_value: float
    
    # RecoverAI outcomes
    recoverai_attempted: bool
    recoverai_action: str
    recoverai_probability: float
    recoverai_erv: float
    recoverai_guardrail_status: str
    recoverai_guardrail_reason: Optional[str] = None
    recoverai_recovered: bool
    recoverai_recovered_amount: float
    recoverai_cost: float
    recoverai_net_value: float
    is_human_escalation: bool

class GuardrailBreachSummary(BaseModel):
    rule: str
    count: int
    impacted_amount: float
    action_taken: str

class BatchSimulationResponse(BaseModel):
    is_simulated: bool = Field(True, description="Strict synthetic data indicator")
    simulation_id: str
    seed: int
    preset_name: Optional[str] = None
    controls: SimulationControls
    executed_at: str
    model_version: str
    
    # Summary Metrics: Overall
    total_gmv: float
    clean_success_gmv: float
    revenue_at_risk: float
    revenue_attempted_recoverai: float
    revenue_attempted_baseline: float
    
    # RecoverAI Key Results
    recoverai_recovered_revenue: float
    recoverai_recovery_rate: float
    recoverai_net_recovery_value: float
    recoverai_permanent_loss: float
    recoverai_total_cost: float
    recoverai_avg_intervention_count: float
    recoverai_stopped_cases: int
    recoverai_human_escalations: int
    
    # Baseline Key Results
    baseline_recovered_revenue: float
    baseline_recovery_rate: float
    baseline_net_recovery_value: float
    baseline_permanent_loss: float
    baseline_total_cost: float
    baseline_wasted_retries_cost: float
    
    # Comparative Benchmarks
    incremental_revenue_recovered: float
    relative_improvement_percent: float
    net_value_lift_amount: float
    net_value_lift_percent: float
    roi_multiple_recoverai: float
    roi_multiple_baseline: float
    
    # Visual Analytics Data
    waterfall: List[WaterfallItem]
    strategy_breakdown: List[InterventionPerformance]
    timeline_recovery: List[TimelinePoint]
    category_recovery: List[CategoryRecoveryStat]
    method_recovery: List[PaymentMethodRecoveryStat]
    guardrail_breaches: List[GuardrailBreachSummary]
    
    # Detailed Simulated Transactions
    transactions_sample: List[SimulatedTransactionItem]
    total_transactions_count: int
