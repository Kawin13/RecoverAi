import { API_BASE_URL, authFetch } from './client'

export interface AnalyticsFilters {
  time_range?: string
  start_date?: string
  end_date?: string
  payment_method?: string
  failure_reason?: string
  strategy?: string
  status?: string
}

export interface FinancialSummaryKPIs {
  revenue_at_risk: number
  revenue_recovered: number
  recovery_rate: number
  net_recovery_value: number
  active_recoveries: number
  avg_recovery_time_minutes: number
  avg_attempts_before_recovery: number
  at_risk_delta_percent: number
  recovered_delta_percent: number
  recovery_rate_delta_percent: number
}

export interface StrategyBreakdownItem {
  strategy_key: string
  strategy_name: string
  attempts: number
  success_count: number
  recovery_rate: number
  recovered_amount: number
  channel_cost: number
  net_erv: number
  avg_time_minutes: number
}

export interface FailureReasonBreakdownItem {
  failure_reason: string
  taxonomy_category: string
  total_count: number
  recovered_count: number
  recovery_rate: number
  at_risk_amount: number
  recovered_amount: number
}

export interface PaymentMethodBreakdownItem {
  method: string
  total_volume: number
  recovered_count: number
  at_risk_amount: number
  recovered_amount: number
  loss_amount: number
  recovery_rate: number
}

export interface MerchantCategoryBreakdownItem {
  category: string
  total_count: number
  at_risk_amount: number
  recovered_amount: number
  recovery_rate: number
}

export interface CustomerSegmentBreakdownItem {
  tier: string
  account_count: number
  at_risk_amount: number
  recovered_amount: number
  recovery_rate: number
  net_erv: number
}

export interface TimelineTrendPoint {
  label: string
  at_risk: number
  recovered: number
  target: number
}

export interface FilterOptions {
  payment_methods: string[]
  failure_reasons: string[]
  strategies: string[]
  statuses: string[]
}

export interface AnalyticsResponse {
  kpis: FinancialSummaryKPIs
  recovery_by_strategy: StrategyBreakdownItem[]
  recovery_by_failure_reason: FailureReasonBreakdownItem[]
  recovery_by_payment_method: PaymentMethodBreakdownItem[]
  recovery_by_merchant_category: MerchantCategoryBreakdownItem[]
  recovery_by_customer_segment: CustomerSegmentBreakdownItem[]
  timeline_trend: TimelineTrendPoint[]
  filter_options: FilterOptions
  applied_filters: AnalyticsFilters
  evaluated_at: string
  data_mode?: string
  workspace_id?: string
}

export const analyticsApi = {
  async getAnalytics(filters: AnalyticsFilters = {}): Promise<AnalyticsResponse> {
    const params = new URLSearchParams()
    if (filters.time_range) params.append('time_range', filters.time_range)
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)
    if (filters.payment_method && filters.payment_method !== 'ALL') params.append('payment_method', filters.payment_method)
    if (filters.failure_reason && filters.failure_reason !== 'ALL') params.append('failure_reason', filters.failure_reason)
    if (filters.strategy && filters.strategy !== 'ALL') params.append('strategy', filters.strategy)
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status)

    const res = await authFetch(`${API_BASE_URL}/api/v1/analytics?${params.toString()}`)
    if (!res.ok) {
      throw new Error('Failed to fetch financial analytics')
    }
    return await res.json()
  }
}
