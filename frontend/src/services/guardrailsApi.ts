import { API_BASE_URL, authFetch } from './client'

export interface GuardrailPolicyRuleItem {
  id: string
  name: string
  category: string
  threshold_display: string
  description: string
  action_on_breach: string
  enabled: boolean
}

export interface GuardrailPoliciesResponse {
  policy_version: string
  summary: {
    policy_version: string
    max_automatic_retries: number
    max_recovery_attempts: number
    max_messages_per_day: number
    high_value_threshold_inr: number
    min_recovery_probability: number
    total_rules: number
    enabled_rules: number
  }
  rules: GuardrailPolicyRuleItem[]
}

export interface HumanApprovalQueueItem {
  case_id: string
  transaction_id: string
  order_id?: string
  customer_name: string
  customer_tier: string
  customer_phone?: string
  amount: number
  currency: string
  failure_category: string
  selected_strategy: string
  channel: string
  expected_recovery_value: number
  recovery_probability: number
  reason_code: string
  human_readable_reason: string
  created_at: string
  updated_at: string
}

export interface WhyStoppedForensicResponse {
  case_id: string
  transaction_id: string
  status: string
  current_step: string
  reason_code: string
  human_readable_reason: string
  policy_version: string
  attempt_count: number
  max_attempts: number
  customer_opted_out: boolean
  fraud_flag_detected: boolean
  failure_category: string
  risk_amount: number
  rule_breached: string
  suggested_action: string
  evaluated_at: string
  audit_events: Array<{
    id: string
    actor: string
    action_type: string
    details: string
    timestamp: string
  }>
}

export interface GuardrailEventItem {
  id: string
  recovery_case_id: string
  rule_name: string
  threshold_breached: string
  action_taken: string
  details: string
  triggered_at: string
}

export const guardrailsApi = {
  async getGuardrailPolicies(): Promise<GuardrailPoliciesResponse> {
    const res = await authFetch(`${API_BASE_URL}/api/guardrails/policies`)
    if (!res.ok) {
      throw new Error('Failed to fetch central guardrail policies')
    }
    return await res.json()
  },

  async getApprovalQueue(): Promise<HumanApprovalQueueItem[]> {
    const res = await authFetch(`${API_BASE_URL}/api/guardrails/approval-queue`)
    if (!res.ok) {
      throw new Error('Failed to fetch human approval queue')
    }
    return await res.json()
  },

  async submitApprovalDecision(
    caseId: string,
    payload: { decision: string; operator_name: string; operator_notes?: string }
  ): Promise<any> {
    const res = await authFetch(`${API_BASE_URL}/api/guardrails/approval-queue/${caseId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to submit approval decision')
    }
    return await res.json()
  },

  async getWhyStoppedForensics(caseId: string): Promise<WhyStoppedForensicResponse> {
    const res = await authFetch(`${API_BASE_URL}/api/guardrails/forensics/${caseId}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch forensic diagnosis for case ${caseId}`)
    }
    return await res.json()
  },

  async getGuardrailEvents(limit: number = 50): Promise<GuardrailEventItem[]> {
    const res = await authFetch(`${API_BASE_URL}/api/guardrails/events?limit=${limit}`)
    if (!res.ok) {
      return []
    }
    return await res.json()
  }
}
