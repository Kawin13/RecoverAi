import { API_BASE_URL, authFetch } from './client'
import { PaymentMethodDistribution } from './checkoutApi'

export interface SimulationControls {
  num_transactions: number
  merchant_category: string
  payment_methods_dist: PaymentMethodDistribution
  failure_rate: number
  abandonment_rate: number
  average_order_value: number
  seed: number
  preset_name?: string
}

export interface SimulationPreset {
  id: string
  name: string
  description: string
  badge: string
  controls: SimulationControls
}

export interface MethodologyDoc {
  title: string
  version: string
  summary: string
  baseline_rules: Array<{
    name: string
    trigger: string
    action: string
    cost: string
    success_probability: string
    drawback: string
  }>
  recoverai_pipeline: Array<{
    step: string
    description: string
  }>
  erv_formula: string
  guardrail_policies: Array<{
    rule: string
    policy: string
  }>
  disclaimer: string
}

export interface InterventionPerformance {
  strategy: string
  attempts: number
  recovered_count: number
  recovered_amount: number
  win_rate: number
  total_cost: number
  net_erv: number
  roi_multiplier: number
}

export interface CategoryRecoveryStat {
  category: string
  at_risk_amount: number
  recoverai_recovered: number
  recoverai_rate: number
  baseline_recovered: number
  baseline_rate: number
  lift_percent: number
}

export interface PaymentMethodRecoveryStat {
  method: string
  at_risk_amount: number
  recoverai_recovered: number
  recoverai_rate: number
  baseline_recovered: number
  baseline_rate: number
  lift_percent: number
}

export interface TimelinePoint {
  step: number
  hour_label: string
  recoverai_cumulative_recovered: number
  baseline_cumulative_recovered: number
  at_risk_cumulative: number
}

export interface WaterfallItem {
  stage: string
  amount: number
  color: string
  description: string
}

export interface SimulatedTransactionItem {
  id: string
  customer_name: string
  customer_tier: string
  amount: number
  payment_method: string
  bank: string
  is_abandoned: boolean
  failure_reason?: string
  failure_category?: string
  is_at_risk: boolean
  baseline_attempted: boolean
  baseline_action: string
  baseline_recovered: boolean
  baseline_recovered_amount: number
  baseline_cost: number
  baseline_net_value: number
  recoverai_attempted: boolean
  recoverai_action: string
  recoverai_probability: number
  recoverai_erv: number
  recoverai_guardrail_status: string
  recoverai_guardrail_reason?: string
  recoverai_recovered: boolean
  recoverai_recovered_amount: number
  recoverai_cost: number
  recoverai_net_value: number
  is_human_escalation: boolean
}

export interface GuardrailBreachSummary {
  rule: string
  count: number
  impacted_amount: number
  action_taken: string
}

export interface BatchSimulationResponse {
  is_simulated: boolean
  simulation_id: string
  seed: number
  preset_name?: string
  controls: SimulationControls
  executed_at: string
  model_version: string
  total_gmv: number
  clean_success_gmv: number
  revenue_at_risk: number
  revenue_attempted_recoverai: number
  revenue_attempted_baseline: number
  recoverai_recovered_revenue: number
  recoverai_recovery_rate: number
  recoverai_net_recovery_value: number
  recoverai_permanent_loss: number
  recoverai_total_cost: number
  recoverai_avg_intervention_count: number
  recoverai_stopped_cases: number
  recoverai_human_escalations: number
  baseline_recovered_revenue: number
  baseline_recovery_rate: number
  baseline_net_recovery_value: number
  baseline_permanent_loss: number
  baseline_total_cost: number
  baseline_wasted_retries_cost: number
  incremental_revenue_recovered: number
  relative_improvement_percent: number
  net_value_lift_amount: number
  net_value_lift_percent: number
  roi_multiple_recoverai: number
  roi_multiple_baseline: number
  waterfall: WaterfallItem[]
  strategy_breakdown: InterventionPerformance[]
  timeline_recovery: TimelinePoint[]
  category_recovery: CategoryRecoveryStat[]
  method_recovery: PaymentMethodRecoveryStat[]
  guardrail_breaches: GuardrailBreachSummary[]
  transactions_sample: SimulatedTransactionItem[]
  total_transactions_count: number
}

export const simulationApi = {
  async runBatchSimulation(controls: SimulationControls): Promise<BatchSimulationResponse> {
    const payload = {
      num_transactions: controls.num_transactions,
      merchant_category: controls.merchant_category,
      payment_methods_dist: {
        UPI: controls.payment_methods_dist.UPI,
        CARD: controls.payment_methods_dist.CARD,
        NET_BANKING: controls.payment_methods_dist.NET_BANKING,
        WALLET: controls.payment_methods_dist.WALLET ?? 0.05
      },
      failure_rate: controls.failure_rate,
      abandonment_rate: controls.abandonment_rate,
      average_order_value: controls.average_order_value,
      seed: controls.seed,
      ...(controls.preset_name ? { preset_name: controls.preset_name } : {})
    }
    const res = await authFetch(`${API_BASE_URL}/api/v1/simulation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to execute batch simulation')
    }
    return await res.json()
  },

  async getSimulationPresets(): Promise<SimulationPreset[]> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/simulation/presets`)
    if (!res.ok) {
      throw new Error('Failed to fetch simulation presets')
    }
    return await res.json()
  },

  async getSimulationMethodology(): Promise<MethodologyDoc> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/simulation/methodology`)
    if (!res.ok) {
      throw new Error('Failed to fetch simulation methodology')
    }
    return await res.json()
  }
}
