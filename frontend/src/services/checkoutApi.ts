import { API_BASE_URL, authFetch } from './client'

export interface CreateCheckoutSessionPayload {
  customer_id?: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  customer_tier?: string
  cart_amount: number
  selected_method?: string
  order_id?: string
  is_demo_simulation?: boolean
}

export interface TransitionCheckoutSessionPayload {
  new_status: string
  selected_method?: string
  payment_attempted?: boolean
  customer_id?: string
}

export interface CheckoutSessionItem {
  id: string
  customer_id: string
  order_id: string
  cart_amount: number
  status: 'STARTED' | 'CUSTOMER_IDENTIFIED' | 'PAYMENT_METHOD_VIEWED' | 'PAYMENT_INITIATED' | 'COMPLETED' | 'ABANDONED'
  selected_method?: string
  payment_attempted: boolean
  started_at: string
  last_activity_at: string
  completed_at?: string
  abandoned_at?: string
  is_demo_simulation: boolean
  recovery_case_id?: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  customer_tier?: string
}

export interface PaymentMethodDistribution {
  UPI: number
  CARD: number
  NET_BANKING: number
  WALLET: number
}

export interface FunnelStageItem {
  stage_key: string
  stage_name: string
  count: number
  conversion_rate: number
  drop_off_count: number
}

export interface AbandonmentFunnelResponse {
  total_sessions: number
  checkout_started: number
  payment_attempted: number
  abandoned: number
  recovery_initiated: number
  recovered: number
  abandonment_rate: number
  recovery_rate: number
  at_risk_abandoned_inr: number
  recovered_abandoned_inr: number
  stages: Array<{
    stage_key: string
    stage_name: string
    count: number
    conversion_rate: number
    drop_off_count: number
  }>
}

export interface AbandonmentCaseItem {
  case_id: string
  session_id?: string
  order_id?: string
  customer_name: string
  customer_email: string
  customer_tier: string
  cart_amount: number
  recovery_probability: number
  selected_strategy: string
  expected_recovery_value: number
  status: string
  channel: string
  is_demo_simulation: boolean
  created_at: string
}

export const checkoutApi = {
  async createCheckoutSession(data: CreateCheckoutSessionPayload): Promise<CheckoutSessionItem> {
    const res = await fetch(`${API_BASE_URL}/api/v1/checkout/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to create checkout session')
    }
    return await res.json()
  },

  async getCheckoutSessions(status?: string, limit: number = 50): Promise<CheckoutSessionItem[]> {
    const url = status && status !== 'ALL'
      ? `${API_BASE_URL}/api/v1/checkout/sessions?status=${status}&limit=${limit}`
      : `${API_BASE_URL}/api/v1/checkout/sessions?limit=${limit}`
    const res = await authFetch(url)
    if (!res.ok) return []
    return await res.json()
  },

  async transitionCheckoutSession(sessionId: string, payload: TransitionCheckoutSessionPayload): Promise<CheckoutSessionItem> {
    const res = await fetch(`${API_BASE_URL}/api/v1/checkout/sessions/${sessionId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to transition checkout session')
    }
    return await res.json()
  },

  async abandonCheckoutSession(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/v1/checkout/sessions/${sessionId}/abandon`, {
      method: 'POST'
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to abandon checkout session')
    }
    return await res.json()
  },

  async checkTimedOutSessions(timeoutSeconds: number = 15): Promise<any> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/checkout/check-abandoned?timeout_seconds=${timeoutSeconds}`, {
      method: 'POST'
    })
    if (!res.ok) return { abandoned_count: 0 }
    return await res.json()
  },

  async getAbandonmentFunnel(): Promise<AbandonmentFunnelResponse> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/checkout/funnel`)
    if (!res.ok) {
      throw new Error('Failed to fetch abandonment funnel metrics')
    }
    return await res.json()
  },

  async getAbandonmentCases(limit: number = 50): Promise<AbandonmentCaseItem[]> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/checkout/cases?limit=${limit}`)
    if (!res.ok) return []
    return await res.json()
  }
}
