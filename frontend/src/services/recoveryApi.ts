import { API_BASE_URL, authFetch } from './client'

export interface StrategyComparisonItem {
  action: string
  action_code?: string
  display_name?: string
  customer_cta?: string
  probability: number
  expected_recovery_value: number
  erv_paise: number
  cost: number
  friction_penalty: number
  risk_penalty: number
  allowed: boolean
  guardrail_reason?: string
  rank: number
}

export interface RecoveryAnalysisResponse {
  transaction_id: string
  selected_action: string
  action_code?: string
  display_name?: string
  customer_cta?: string
  canonical_action?: {
    action_code: string
    display_name: string
    customer_cta: string
    execution_handler: string
  }
  recovery_probability: number
  expected_recovery_value: number
  erv_paise: number
  cost: number
  friction_penalty: number
  diagnosis: {
    failure_reason_code?: string
    failure_reason: string
    failure_category?: string
    taxonomy: string
    failure_source?: string
    human_readable_reason?: string
    confidence?: number
    raw_gateway_code?: string | null
    is_transient: boolean
    is_retryable_same_instrument: boolean
    requires_customer_switch: boolean
    is_risk_blocked: boolean
    attempt_number: number
    description: string
  }
  strategies_comparison: StrategyComparisonItem[]
  evidence: string[]
  decision_metadata: {
    engine_version: string
    rules_evaluated: number
    model: string
  }
}

export interface AIExplanationData {
  recovery_id: string
  headline: string
  summary?: string
  primary_factor: string
  recommended_strategy: string
  success_probability: number
  rationale_bullet_points: string[]
  mitigation_risk: string
  counterfactual: string
  generated_at: string
}

export interface AIMessageData {
  recovery_id: string
  language: string
  channel: string
  customer_name: string
  urgency_tone: string
  subject: string
  body: string
  headline?: string
  message_body?: string
  call_to_action?: string
  channel_recommended?: string
  preview_text: string
  cta_text: string
  generated_at: string
}

export interface PaymentLinkItem {
  id: string
  payment_link_id: string
  short_url: string
  amount: number
  status: string
  is_live_demo: boolean
  created_at: string
}

export interface WorkflowCase {
  id: string
  transaction_id: string
  order_id?: string
  customer_name?: string
  customer_tier?: string
  customer_phone?: string
  risk_amount: number
  failure_category: string
  selected_strategy: string
  current_step: string
  status: string
  attempt_count: number
  max_attempts: number
  channel: string
  expected_recovery_value: number
  recovery_probability: number
  scheduled_at?: string
  executed_at?: string
  completed_at?: string
  updated_at?: string
  payment_link_id?: string
  payment_link_url?: string
  payment_link_status?: string
  payment_links?: any[]
  audit_trail: any[]
}

export interface WorkflowListResponse {
  items: WorkflowCase[]
  workflows: WorkflowCase[]
  total: number
}

export const recoveryApi = {
  async analyzeRecovery(transactionId: string): Promise<RecoveryAnalysisResponse> {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/recovery/analyze/${transactionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn(`API analyzeRecovery(${transactionId}) error:`, e)
    }

    throw new Error('Recovery recommendation temporarily unavailable.')
  },

  async fetchAIExplanation(recoveryId: string): Promise<AIExplanationData> {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/ai/explain/${recoveryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn(`API fetchAIExplanation(${recoveryId}) error:`, e)
    }

    throw new Error('AI explanation temporarily unavailable.')
  },

  async fetchAIMessage(recoveryId: string, language: string = 'EN'): Promise<AIMessageData> {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/ai/message/${recoveryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language })
      })
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn(`API fetchAIMessage(${recoveryId}, ${language}) error:`, e)
    }

    throw new Error('AI message temporarily unavailable.')
  },

  async getWorkflows(limit: number = 50): Promise<WorkflowListResponse> {
    const res = await authFetch(`${API_BASE_URL}/api/recovery/workflows?limit=${limit}`)
    if (!res.ok) {
      throw new Error('Failed to fetch recovery workflows')
    }
    const data = await res.json()
    const list = data.workflows || data.items || []
    return {
      items: list,
      workflows: list,
      total: data.total ?? list.length
    }
  },

  async getWorkflow(caseId: string): Promise<WorkflowCase> {
    const res = await authFetch(`${API_BASE_URL}/api/recovery/workflows/${caseId}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch workflow ${caseId}`)
    }
    return await res.json()
  },

  async advanceWorkflowStep(caseId: string, isLiveDemo: boolean = true): Promise<{ status: string; case: WorkflowCase; step_result: any }> {
    const res = await authFetch(`${API_BASE_URL}/api/recovery/workflows/${caseId}/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_live_demo: isLiveDemo })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to advance workflow step')
    }
    return await res.json()
  },

  async executeWorkflow(caseId: string, isLiveDemo: boolean = true): Promise<{ status: string; case: WorkflowCase; steps_taken: any[] }> {
    const res = await authFetch(`${API_BASE_URL}/api/recovery/workflows/${caseId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_live_demo: isLiveDemo })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to execute workflow pipeline')
    }
    return await res.json()
  },

  async generatePaymentLink(caseId: string, isLiveDemo: boolean = true): Promise<PaymentLinkItem> {
    const res = await authFetch(`${API_BASE_URL}/api/recovery/workflows/${caseId}/payment-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_live_demo: isLiveDemo })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to generate test payment link')
    }
    return await res.json()
  },

  async simulateWorkflowOutcome(caseId: string, outcome: 'RECOVERED' | 'FAILED'): Promise<{ status: string; case: WorkflowCase }> {
    const res = await authFetch(`${API_BASE_URL}/api/recovery/workflows/${caseId}/simulate-outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to simulate workflow outcome')
    }
    return await res.json()
  },

  async syncCasePayment(caseId: string): Promise<{ status: string; recovered: boolean; case: WorkflowCase }> {
    const res = await authFetch(`${API_BASE_URL}/api/recovery/workflows/${caseId}/sync-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to sync payment status with gateway')
    }
    return await res.json()
  },

  async verifyPaymentLink(paymentLinkId: string): Promise<{ status: string; paid: boolean; payment_link_id: string; payment_link_status: string; case_status?: string }> {
    const res = await authFetch(`${API_BASE_URL}/api/recovery/payment-links/${paymentLinkId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to verify payment link')
    }
    return await res.json()
  }
}
