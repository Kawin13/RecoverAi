import {
  Transaction,
  MetricSummary,
  StrategyPerformance,
  AgentActivity,
  PaymentBreakdownItem,
  FailureReasonItem,
  AuditLogEntry
} from '../types'
import {
  mockMetrics,
  mockTrendData,
  mockStrategyPerformance,
  mockTransactions,
  mockAgentActivities,
  mockPaymentBreakdown,
  mockFailureReasons,
  mockAuditLogs
} from '../data/mockData'
import { supabase } from '../lib/supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000` : 'http://127.0.0.1:8000')

export async function getAuthHeaders(contentType: string = 'application/json'): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'X-RecoverAI-Demo': 'active'
  }
  if (contentType) {
    headers['Content-Type'] = contentType
  }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  } catch (err) {
    console.warn('[API] Could not retrieve session for auth header:', err)
  }
  return headers
}

export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const authHeaders = await getAuthHeaders((init?.headers as any)?.['Content-Type'] || (init?.method && init.method !== 'GET' ? 'application/json' : ''))
  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...((init?.headers as Record<string, string>) || {})
  }

  let res = await fetch(url, {
    ...init,
    headers: mergedHeaders
  })

  if (res.status === 401) {
    try {
      const { data: { session } } = await supabase.auth.refreshSession()
      if (session?.access_token) {
        mergedHeaders['Authorization'] = `Bearer ${session.access_token}`
        res = await fetch(url, {
          ...init,
          headers: mergedHeaders
        })
      }
    } catch (err) {
      console.warn('[API] Session refresh on 401 failed:', err)
    }
  }

  return res
}

export interface DashboardData {
  metrics: MetricSummary
  trendData: typeof mockTrendData
  strategyPerformance: StrategyPerformance[]
  paymentBreakdown: PaymentBreakdownItem[]
  failureReasons: FailureReasonItem[]
  recentActivities: AgentActivity[]
}

export interface TransactionListResponse {
  items: Transaction[]
  total: number
  page: number
  limit: number
  totalPages: number
}

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
  selected_action: string
  display_name?: string
  summary: string
  operator_notes: string[]
  customer_risk_profile?: string
  source: string
  model: string
  generated_at: string
}

export interface AIMessageData {
  recovery_id: string
  language: string
  headline: string
  message_body: string
  call_to_action: string
  channel_recommended: string
  source: string
  model: string
}

export const api = {
  async getHealth(): Promise<{ status: string; service: string }> {
    const res = await fetch(`${API_BASE_URL}/health`)
    if (!res.ok) throw new Error('Health check failed')
    return res.json()
  },

  async getQueueCounts(): Promise<{
    all_at_risk: number
    high_value_urgent: number
    vip_enterprise: number
    gateway_bank_outages: number
    batch_dispatch_eligible: number
  }> {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/recovery-cases/queue-counts`)
      if (res.ok) {
        return res.json()
      }
    } catch (e) {
      console.warn('API getQueueCounts unreachable:', e)
    }
    return {
      all_at_risk: 0,
      high_value_urgent: 0,
      vip_enterprise: 0,
      gateway_bank_outages: 0,
      batch_dispatch_eligible: 0
    }
  },

  async analyzeRecovery(transactionId: string): Promise<RecoveryAnalysisResponse> {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/recovery/analyze/${transactionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      if (res.ok) {
        return res.json()
      }
    } catch (e) {
      console.warn(`API analyzeRecovery(${transactionId}) unreachable:`, e)
    }

    // Calibrated deterministic client fallback
    return {
      transaction_id: transactionId,
      selected_action: 'UPI_SWITCH',
      action_code: 'UPI_SWITCH',
      display_name: 'UPI Switch',
      customer_cta: 'Pay with UPI',
      canonical_action: {
        action_code: 'UPI_SWITCH',
        display_name: 'UPI Switch',
        customer_cta: 'Pay with UPI',
        execution_handler: 'execute_upi_switch'
      },
      recovery_probability: 0.88,
      expected_recovery_value: 3978.0,
      erv_paise: 397800,
      cost: 4.0,
      friction_penalty: 3.0,
      diagnosis: {
        failure_reason_code: 'BANK_GATEWAY_TIMEOUT',
        failure_reason: 'BANK_GATEWAY_TIMEOUT',
        failure_category: 'TEMPORARY',
        taxonomy: 'TEMPORARY',
        failure_source: 'GATEWAY',
        human_readable_reason: 'Temporary bank gateway timeout',
        confidence: 0.98,
        raw_gateway_code: 'UPI_TIMEOUT',
        is_transient: true,
        is_retryable_same_instrument: true,
        requires_customer_switch: false,
        is_risk_blocked: false,
        attempt_number: 1,
        description: 'Transient bank switch or gateway timeout detected. Dynamic UPI switch recommended.'
      },
      strategies_comparison: [
        {
          action: 'UPI_SWITCH',
          action_code: 'UPI_SWITCH',
          display_name: 'UPI Switch',
          customer_cta: 'Pay with UPI',
          probability: 0.88,
          expected_recovery_value: 3978.0,
          erv_paise: 397800,
          cost: 4.0,
          friction_penalty: 3.0,
          risk_penalty: 0.0,
          allowed: true,
          rank: 1
        },
        {
          action: 'PAYMENT_LINK',
          action_code: 'PAYMENT_LINK',
          display_name: '1-Click Paylink',
          customer_cta: 'Open Payment Link',
          probability: 0.82,
          expected_recovery_value: 3680.0,
          erv_paise: 368000,
          cost: 5.0,
          friction_penalty: 6.0,
          risk_penalty: 0.0,
          allowed: true,
          rank: 2
        },
        {
          action: 'RETRY_LATER',
          action_code: 'RETRY_LATER',
          display_name: 'Timed Retry',
          customer_cta: 'Retry Later',
          probability: 0.74,
          expected_recovery_value: 3315.0,
          erv_paise: 331500,
          cost: 2.5,
          friction_penalty: 2.0,
          risk_penalty: 0.0,
          allowed: true,
          rank: 3
        },
        {
          action: 'PERSONALIZED_REMINDER',
          action_code: 'PERSONALIZED_REMINDER',
          display_name: 'Personalized Reminder',
          customer_cta: 'Complete Payment',
          probability: 0.70,
          expected_recovery_value: 3120.0,
          erv_paise: 312000,
          cost: 8.0,
          friction_penalty: 12.0,
          risk_penalty: 0.0,
          allowed: true,
          rank: 4
        },
        {
          action: 'HUMAN_ESCALATION',
          action_code: 'HUMAN_ESCALATION',
          display_name: 'Concierge Escalation',
          customer_cta: 'Support Will Contact You',
          probability: 0.75,
          expected_recovery_value: 3300.0,
          erv_paise: 330000,
          cost: 45.0,
          friction_penalty: 25.0,
          risk_penalty: 0.0,
          allowed: true,
          rank: 5
        },
        {
          action: 'RETRY_NOW',
          action_code: 'RETRY_NOW',
          display_name: 'Immediate Retry',
          customer_cta: 'Retry Payment',
          probability: 0.25,
          expected_recovery_value: 1120.0,
          erv_paise: 112000,
          cost: 2.0,
          friction_penalty: 1.0,
          risk_penalty: 0.0,
          allowed: true,
          rank: 6
        },
        {
          action: 'NO_ACTION',
          action_code: 'NO_ACTION',
          display_name: 'No Action',
          customer_cta: 'none',
          probability: 0.0,
          expected_recovery_value: 0.0,
          erv_paise: 0,
          cost: 0.0,
          friction_penalty: 0.0,
          risk_penalty: 0.0,
          allowed: true,
          rank: 7
        }
      ],
      evidence: [
        'Initial payment attempt dropped on UPI rail.',
        'Customer has 15/16 (94%) historical successful transactions (Preferred rail: UPI).',
        'Immediate retry probability is only 25.0% due to switch downtime / instrument decline physics.',
        'UPI Switch yields highest Expected Recovery Value of ₹3,978.00 with 88.0% recovery probability.'
      ],
      decision_metadata: {
        engine_version: '2.0.0-production',
        rules_evaluated: 5,
        model: 'Likelihood Scoring + ERV Engine'
      }
    }
  },

  async fetchAIExplanation(recoveryId: string): Promise<AIExplanationData> {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/ai/explain/${recoveryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (res.ok) {
        return res.json()
      }
    } catch (e) {
      console.warn(`API fetchAIExplanation(${recoveryId}) unreachable:`, e)
    }

    return {
      recovery_id: recoveryId,
      selected_action: 'UPI_SWITCH',
      display_name: 'UPI Switch',
      summary: 'The engine selected UPI Switch due to high historical customer affinity (94%) and degraded primary bank switches.',
      operator_notes: [
        'Immediate same-rail retry would encounter active gateway switch timeout.',
        'Dynamic UPI deep link will route transaction to customer secondary app.',
        'ERV is maximized with minimal customer friction penalty.'
      ],
      customer_risk_profile: 'Low',
      source: 'deterministic-fallback',
      model: 'rule-template-engine',
      generated_at: new Date().toISOString()
    }
  },

  async fetchAIMessage(recoveryId: string, language: string = 'EN'): Promise<AIMessageData> {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/ai/message/${recoveryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language })
      })
      if (res.ok) {
        return res.json()
      }
    } catch (e) {
      console.warn(`API fetchAIMessage(${recoveryId}, ${language}) unreachable:`, e)
    }

    const messages: Record<string, AIMessageData> = {
      HI: {
        recovery_id: recoveryId,
        language: 'HI',
        headline: 'UPI से भुगतान पूरा करें',
        message_body: 'नमस्ते, आपका भुगतान पूरा नहीं हो सका। नीचे दिए गए सुरक्षित लिंक से UPI द्वारा तुरंत भुगतान पूरा करें।',
        call_to_action: 'UPI से भुगतान करें',
        channel_recommended: 'WhatsApp',
        source: 'deterministic-fallback',
        model: 'rule-template-engine'
      },
      HINGLISH: {
        recovery_id: recoveryId,
        language: 'HINGLISH',
        headline: 'Complete Payment via UPI',
        message_body: 'Hi! Aapka payment complete nahi ho paya. Worry mat kijiye, neeche diye link se 1-click me UPI switch karke complete karein.',
        call_to_action: 'Pay with UPI',
        channel_recommended: 'WhatsApp / SMS',
        source: 'deterministic-fallback',
        model: 'rule-template-engine'
      },
      TA: {
        recovery_id: recoveryId,
        language: 'TA',
        headline: 'UPI மூலம் பணம் செலுத்துங்கள்',
        message_body: 'வணக்கம், உங்கள் பரிவர்த்தனை நிறைவடையவில்லை. கீழே உள்ள இணைப்பைப் பயன்படுத்தி UPI மூலம் உடனடியாக முடிக்கவும்.',
        call_to_action: 'UPI மூலம் பணம் செலுத்துங்கள்',
        channel_recommended: 'WhatsApp',
        source: 'deterministic-fallback',
        model: 'rule-template-engine'
      },
      EN: {
        recovery_id: recoveryId,
        language: 'EN',
        headline: 'Continue your payment via UPI',
        message_body: 'Hi, your payment could not be completed. You can securely continue using UPI through the recovery link below.',
        call_to_action: 'Pay with UPI',
        channel_recommended: 'WhatsApp / SMS',
        source: 'deterministic-fallback',
        model: 'rule-template-engine'
      }
    }

    return messages[language] || messages.EN
  },

  async getDashboard(): Promise<DashboardData> {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/dashboard`)
      if (res.ok) {
        const raw = await res.json()
        return {
          metrics: {
            revenueAtRisk: raw.metrics.revenue_at_risk,
            revenueRecovered: raw.metrics.revenue_recovered,
            recoveryRate: raw.metrics.recovery_rate,
            activeRecoveries: raw.metrics.active_recoveries,
            atRiskDeltaPercent: raw.metrics.at_risk_delta_percent,
            recoveredDeltaPercent: raw.metrics.recovered_delta_percent,
            recoveryRateDeltaPercent: raw.metrics.recovery_rate_delta_percent,
            activeDeltaCount: raw.metrics.active_delta_count,
          },
          trendData: raw.trend_data || mockTrendData,
          strategyPerformance: raw.strategy_performance?.map((s: any) => ({
            strategy: s.strategy,
            strategyKey: s.strategy_key,
            attempts: s.attempts,
            successCount: s.success_count,
            recoveryRate: s.recovery_rate,
            recoveredAmount: s.recovered_amount,
            avgRecoveryTimeMinutes: s.avg_recovery_time_minutes
          })) || mockStrategyPerformance,
          paymentBreakdown: raw.payment_breakdown?.map((p: any) => ({
            method: p.method,
            volume: p.volume,
            recoveredAmount: p.recovered_amount,
            lossAmount: p.loss_amount,
            recoveryRate: p.recovery_rate
          })) || mockPaymentBreakdown,
          failureReasons: raw.failure_reasons?.map((f: any) => ({
            category: f.category,
            label: f.label,
            count: f.count,
            totalAmount: f.total_amount,
            recoveredAmount: f.recovered_amount,
            recoveryRate: f.recovery_rate
          })) || mockFailureReasons,
          recentActivities: raw.recent_activities?.map((a: any) => ({
            id: a.id,
            timestamp: a.timestamp,
            transactionId: a.transaction_id,
            customerName: a.customer_name,
            amount: a.amount,
            action: a.action,
            status: a.status,
            erv: a.erv,
            explanation: a.explanation
          })) || mockAgentActivities
        }
      }
    } catch (e) {
      console.warn('API getDashboard unreachable, falling back to local dataset:', e)
    }

    return {
      metrics: mockMetrics,
      trendData: mockTrendData,
      strategyPerformance: mockStrategyPerformance,
      paymentBreakdown: mockPaymentBreakdown,
      failureReasons: mockFailureReasons,
      recentActivities: mockAgentActivities
    }
  },

  async getTransactions(params: {
    page?: number
    limit?: number
    method?: string
    status?: string
    search?: string
  } = {}): Promise<TransactionListResponse> {
    try {
      const query = new URLSearchParams()
      if (params.page) query.append('page', params.page.toString())
      if (params.limit) query.append('limit', params.limit.toString())
      if (params.method && params.method !== 'ALL') query.append('method', params.method)
      if (params.status && params.status !== 'ALL') query.append('status', params.status)
      if (params.search) query.append('search', params.search)

      const res = await authFetch(`${API_BASE_URL}/api/transactions?${query.toString()}`)
      if (res.ok) {
        const raw = await res.json()
        const items: Transaction[] = raw.items.map((t: any) => ({
          id: t.id,
          orderId: t.order_id,
          customer: {
            id: t.customer?.id || t.customer_id,
            name: t.customer?.name || 'Customer',
            email: t.customer?.email || '',
            phone: t.customer?.phone,
            tier: t.customer?.tier || 'STANDARD',
            ltv: t.customer?.ltv || 0
          },
          amount: t.amount,
          currency: t.currency,
          method: t.method,
          failureCategory: t.recovery_case?.failure_category || (t.payment_attempts?.[0]?.error_category || 'AUTHENTICATION_FAILED'),
          failureReason: t.payment_attempts?.[0]?.error_description || (t.recovery_case?.failure_category ? t.recovery_case.failure_category.replace(/_/g, ' ') : 'Payment dropped during processing'),
          recoveryProbability: t.recovery_case?.recovery_probability || 0.75,
          recommendedAction: t.recovery_case?.selected_strategy || 'UPI_SWITCH',
          status: t.recovery_case?.status || t.status,
          riskLevel: (t.customer?.tier === 'VIP' || t.customer?.tier === 'ENTERPRISE' || t.amount >= 25000) ? 'HIGH' : t.amount >= 10000 ? 'MEDIUM' : 'LOW',
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          erv: t.recovery_case?.expected_recovery_value || t.amount * 0.75,
          attemptsCount: t.payment_attempts?.length || 1
        }))

        return {
          items,
          total: raw.total,
          page: raw.page,
          limit: raw.limit,
          totalPages: raw.total_pages
        }
      }
    } catch (e) {
      console.warn('API getTransactions unreachable, falling back to local dataset:', e)
    }

    return {
      items: mockTransactions,
      total: mockTransactions.length,
      page: 1,
      limit: 20,
      totalPages: 1
    }
  },

  async getTransaction(id: string): Promise<Transaction | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/transactions/${id}`)
      if (res.ok) {
        const t = await res.json()
        return {
          id: t.id,
          orderId: t.order_id,
          customer: {
            id: t.customer?.id || t.customer_id,
            name: t.customer?.name || 'Customer',
            email: t.customer?.email || '',
            phone: t.customer?.phone,
            tier: t.customer?.tier || 'STANDARD',
            ltv: t.customer?.ltv || 0
          },
          amount: t.amount,
          currency: t.currency,
          method: t.method,
          failureCategory: t.recovery_case?.failure_category || 'AUTHENTICATION_FAILED',
          failureReason: t.payment_attempts?.[0]?.error_description || 'Payment dropped during processing',
          recoveryProbability: t.recovery_case?.recovery_probability || 0.75,
          recommendedAction: t.recovery_case?.selected_strategy || 'SMART_PAYLINK_1CLICK',
          status: t.status,
          riskLevel: t.amount > 50000 ? 'HIGH' : t.amount > 20000 ? 'MEDIUM' : 'LOW',
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          erv: t.recovery_case?.expected_recovery_value || t.amount * 0.8,
          attemptsCount: t.payment_attempts?.length || 1
        }
      }
    } catch (e) {
      console.warn(`API getTransaction(${id}) unreachable, looking in local fallback:`, e)
    }
    return mockTransactions.find(t => t.id === id || t.orderId === id) || null
  },

  async getAuditTrail(transactionId?: string): Promise<AuditLogEntry[]> {
    try {
      const url = transactionId
        ? `${API_BASE_URL}/api/audit/${transactionId}`
        : `${API_BASE_URL}/api/audit`
      const res = await fetch(url)
      if (res.ok) {
        const raw = await res.json()
        const items = Array.isArray(raw) ? raw : (raw.items || [])
        return items.map((a: any) => ({
          id: a.id,
          timestamp: a.created_at,
          actor: a.actor,
          actionType: a.action_type,
          targetResource: a.target_resource,
          details: a.details,
          metadata: a.metadata_json ? JSON.parse(a.metadata_json) : undefined
        }))
      }
    } catch (e) {
      console.warn('API getAuditTrail unreachable, falling back to local dataset:', e)
    }
    return mockAuditLogs
  },

  // ============================================================================
  // Razorpay Gateway & Demo Store Integration
  // ============================================================================
  async getPaymentConfig(): Promise<PaymentConfig> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/config`)
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn('API getPaymentConfig failed, returning fallback:', e)
    }
    return {
      key_id: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_recoverai998',
      is_test_mode: true,
      is_configured: false,
      merchant_name: 'RecoverAI Demo Store'
    }
  },

  async createPaymentOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
    const res = await fetch(`${API_BASE_URL}/api/payments/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || err.message || 'Failed to create payment order')
    }
    return await res.json()
  },

  async verifyPayment(data: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    const res = await fetch(`${API_BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || err.message || 'Signature verification failed')
    }
    return await res.json()
  },

  async recordPaymentFailure(data: PaymentFailureRequest): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/payments/fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || err.message || 'Failed to record payment failure')
    }
    return await res.json()
  },

  // ============================================================================
  // Phase 9: Recovery Executor & State Machine Workflows
  // ============================================================================
  async getWorkflows(limit: number = 50): Promise<WorkflowListResponse> {
    const res = await fetch(`${API_BASE_URL}/api/recovery/workflows?limit=${limit}`)
    if (!res.ok) {
      throw new Error('Failed to fetch recovery workflows')
    }
    return await res.json()
  },

  async getWorkflow(caseId: string): Promise<WorkflowCase> {
    const res = await fetch(`${API_BASE_URL}/api/recovery/workflows/${caseId}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch workflow ${caseId}`)
    }
    return await res.json()
  },

  async advanceWorkflowStep(caseId: string, isLiveDemo: boolean = true): Promise<{ status: string; case: WorkflowCase; step_result: any }> {
    const res = await fetch(`${API_BASE_URL}/api/recovery/workflows/${caseId}/step`, {
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
    const res = await fetch(`${API_BASE_URL}/api/recovery/workflows/${caseId}/execute`, {
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
    const res = await fetch(`${API_BASE_URL}/api/recovery/workflows/${caseId}/payment-link`, {
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
    const res = await fetch(`${API_BASE_URL}/api/recovery/workflows/${caseId}/simulate-outcome`, {
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

  async getNotifications(caseId?: string, limit: number = 20): Promise<NotificationReceiptItem[]> {
    const url = caseId 
      ? `${API_BASE_URL}/api/recovery/notifications?case_id=${caseId}&limit=${limit}`
      : `${API_BASE_URL}/api/recovery/notifications?limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) {
      return []
    }
    return await res.json()
  },

  // ============================================================================
  // Phase 10: Fintech Guardrails & Human Approval Governance
  // ============================================================================
  async getGuardrailPolicies(): Promise<GuardrailPoliciesResponse> {
    const res = await fetch(`${API_BASE_URL}/api/guardrails/policies`)
    if (!res.ok) {
      throw new Error('Failed to fetch central guardrail policies')
    }
    return await res.json()
  },

  async getApprovalQueue(): Promise<HumanApprovalQueueItem[]> {
    const res = await fetch(`${API_BASE_URL}/api/guardrails/approval-queue`)
    if (!res.ok) {
      throw new Error('Failed to fetch human approval queue')
    }
    return await res.json()
  },

  async submitApprovalDecision(
    caseId: string,
    payload: { decision: string; operator_name: string; operator_notes?: string }
  ): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/guardrails/approval-queue/${caseId}/decision`, {
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
    const res = await fetch(`${API_BASE_URL}/api/guardrails/forensics/${caseId}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch forensic diagnosis for case ${caseId}`)
    }
    return await res.json()
  },

  async getGuardrailEvents(limit: number = 50): Promise<GuardrailEventItem[]> {
    const res = await fetch(`${API_BASE_URL}/api/guardrails/events?limit=${limit}`)
    if (!res.ok) {
      return []
    }
    return await res.json()
  },

  // ============================================================================
  // Phase 11: Pre-Payment Cart & Checkout Abandonment Recovery
  // ============================================================================
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
    const res = await fetch(url)
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
    const res = await fetch(`${API_BASE_URL}/api/v1/checkout/check-abandoned?timeout_seconds=${timeoutSeconds}`, {
      method: 'POST'
    })
    if (!res.ok) return { abandoned_count: 0 }
    return await res.json()
  },

  async getAbandonmentFunnel(): Promise<AbandonmentFunnelResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/checkout/funnel`)
    if (!res.ok) {
      throw new Error('Failed to fetch abandonment funnel metrics')
    }
    return await res.json()
  },

  async getAbandonmentCases(limit: number = 50): Promise<AbandonmentCaseItem[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/checkout/cases?limit=${limit}`)
    if (!res.ok) return []
    return await res.json()
  },

  async runBatchSimulation(controls: SimulationControls): Promise<BatchSimulationResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/simulation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(controls)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to execute batch simulation')
    }
    return await res.json()
  },

  async getSimulationPresets(): Promise<SimulationPreset[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/simulation/presets`)
    if (!res.ok) {
      throw new Error('Failed to fetch simulation presets')
    }
    return await res.json()
  },

  async getSimulationMethodology(): Promise<MethodologyDoc> {
    const res = await fetch(`${API_BASE_URL}/api/v1/simulation/methodology`)
    if (!res.ok) {
      throw new Error('Failed to fetch simulation methodology')
    }
    return await res.json()
  },

  async getAnalytics(filters: AnalyticsFilters = {}): Promise<AnalyticsResponse> {
    const params = new URLSearchParams()
    if (filters.time_range) params.append('time_range', filters.time_range)
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)
    if (filters.payment_method && filters.payment_method !== 'ALL') params.append('payment_method', filters.payment_method)
    if (filters.failure_reason && filters.failure_reason !== 'ALL') params.append('failure_reason', filters.failure_reason)
    if (filters.strategy && filters.strategy !== 'ALL') params.append('strategy', filters.strategy)
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status)

    const res = await fetch(`${API_BASE_URL}/api/v1/analytics?${params.toString()}`)
    if (!res.ok) {
      throw new Error('Failed to fetch financial analytics')
    }
    return await res.json()
  },

  async getAuditableCases(params: { search?: string; status?: string; strategy?: string; limit?: number } = {}): Promise<CaseAuditListResponse> {
    const q = new URLSearchParams()
    if (params.search) q.append('search', params.search)
    if (params.status && params.status !== 'ALL') q.append('status', params.status)
    if (params.strategy && params.strategy !== 'ALL') q.append('strategy', params.strategy)
    if (params.limit) q.append('limit', params.limit.toString())

    const res = await fetch(`${API_BASE_URL}/api/v1/audit/cases?${q.toString()}`)
    if (!res.ok) {
      throw new Error('Failed to fetch auditable cases')
    }
    return await res.json()
  },

  async getCaseChronology(id: string): Promise<CaseAuditTimelineResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/audit/case/${id}/chronology`)
    if (!res.ok) {
      throw new Error('Failed to fetch case audit chronology')
    }
    return await res.json()
  }
}

export interface PaymentConfig {
  key_id: string
  is_test_mode: boolean
  is_configured: boolean
  merchant_name: string
}

export interface CreateOrderRequest {
  product_id: string
  product_name: string
  amount: number
  currency?: string
  customer_name: string
  customer_email: string
  customer_phone?: string
}

export interface CreateOrderResponse {
  order_id: string
  transaction_id: string
  amount: number
  amount_in_rupees: number
  currency: string
  key_id: string
  product_name: string
  customer: {
    name: string
    email: string
    phone?: string
  }
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
  transaction_id: string
}

export interface VerifyPaymentResponse {
  success: boolean
  signature_valid: boolean
  transaction_id: string
  razorpay_order_id: string
  razorpay_payment_id: string
  amount: number
  method: string
  status: string
  verified_at: string
  message: string
}

export interface PaymentFailureRequest {
  transaction_id: string
  order_id: string
  payment_id?: string
  error_code?: string
  error_description?: string
  error_category?: string
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
  execution_payload?: string
  payment_links: PaymentLinkItem[]
  created_at: string
  updated_at: string
}

export interface WorkflowListResponse {
  total_cases: number
  active_cases: number
  workflows: WorkflowCase[]
}

export interface NotificationReceiptItem {
  notification_id: string
  channel: string
  recipient: string
  delivery_label: string
  is_simulated: boolean
  status: string
  title: string
  body: string
  action_url?: string
  language: string
  recovery_case_id?: string
  latency_ms: number
  dispatched_at: string
}

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

// -------------------------------------------------------------
// BATCH RECOVERY SIMULATOR TYPES (Phase 12)
// -------------------------------------------------------------

export interface PaymentMethodDistribution {
  UPI: number
  CARD: number
  NET_BANKING: number
  WALLET: number
}

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

// ==========================================
// PHASE 13: FINANCIAL OPERATIONS & AUDIT TYPES
// ==========================================

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
}

export interface AuditChronologyItem {
  step: number
  step_key: string
  timestamp: string
  iso_timestamp: string
  title: string
  actor: string
  summary: string
  details: Record<string, any>
}

export interface CaseAuditTimelineResponse {
  case_id: string
  transaction_id: string
  order_id: string
  customer_name: string
  customer_tier: string
  amount: number
  currency: string
  payment_method: string
  status: string
  failure_reason: string
  failure_category: string
  recovery_probability: number
  expected_recovery_value: number
  selected_strategy: string
  attempt_count: number
  created_at: string
  updated_at: string
  recovered_at?: string
  chronological_entries: AuditChronologyItem[]
  redaction_verified: boolean
  exportable_json: string
}

export interface CaseAuditSummaryItem {
  case_id: string
  transaction_id: string
  order_id: string
  customer_name: string
  customer_tier: string
  amount: number
  payment_method: string
  failure_reason: string
  status: string
  selected_strategy: string
  created_at: string
  latest_activity: string
}

export interface CaseAuditListResponse {
  items: CaseAuditSummaryItem[]
  total: number
}



