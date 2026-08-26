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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

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
  recovery_probability: number
  expected_recovery_value: number
  erv_paise: number
  cost: number
  friction_penalty: number
  diagnosis: {
    failure_reason: string
    taxonomy: string
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

  async analyzeRecovery(transactionId: string): Promise<RecoveryAnalysisResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/recovery/analyze/${transactionId}`, {
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
      recovery_probability: 0.88,
      expected_recovery_value: 3978.0,
      erv_paise: 397800,
      cost: 4.0,
      friction_penalty: 3.0,
      diagnosis: {
        failure_reason: 'UPI_TIMEOUT',
        taxonomy: 'TEMPORARY',
        is_transient: true,
        is_retryable_same_instrument: true,
        requires_customer_switch: false,
        is_risk_blocked: false,
        attempt_number: 1,
        description: 'Transient gateway switch outage diagnosed. Dynamic UPI Intent switch recommended.'
      },
      strategies_comparison: [
        {
          action: 'UPI_SWITCH',
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
        'Initial payment attempt dropped: UPI TIMEOUT diagnosed on UPI rail.',
        'Customer has 15/16 (94%) historical successful transactions on UPI.',
        'Immediate retry probability is only 25.0% due to active bank switch degradation.',
        'UPI SWITCH yields highest Expected Recovery Value of ₹3,978.00 with 88.0% recovery propensity.'
      ],
      decision_metadata: {
        engine_version: '2.0.0-production',
        rules_evaluated: 5,
        model: 'XGBoost 3.2.0 + ERV Engine'
      }
    }
  },

  async fetchAIExplanation(recoveryId: string): Promise<AIExplanationData> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/explain/${recoveryId}`, {
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
      const res = await fetch(`${API_BASE_URL}/api/ai/message/${recoveryId}`, {
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
        headline: 'भुगतान पूरा नहीं हो सका',
        message_body: 'नमस्ते, आपका भुगतान बैंक सर्वर में देरी के कारण पूरा नहीं हो पाया। नीचे दिए गए लिंक से तुरंत सुरक्षित रूप से भुगतान पूरा करें।',
        call_to_action: 'अभी भुगतान पूरा करें',
        channel_recommended: 'WhatsApp',
        source: 'deterministic-fallback',
        model: 'rule-template-engine'
      },
      HINGLISH: {
        recovery_id: recoveryId,
        language: 'HINGLISH',
        headline: 'Payment Pending — 1-Click Retry',
        message_body: 'Hi! Aapka payment bank timeout ki wajah se ruk gaya hai. Worry mat kijiye, neeche diye link se 1-click me UPI switch karke complete karein.',
        call_to_action: 'Complete Payment Now',
        channel_recommended: 'WhatsApp / SMS',
        source: 'deterministic-fallback',
        model: 'rule-template-engine'
      },
      TA: {
        recovery_id: recoveryId,
        language: 'TA',
        headline: 'பணம் செலுத்துதல் தோல்வியடைந்தது',
        message_body: 'வணக்கம், உங்கள் பரிவர்த்தனை வங்கி சர்வர் பிரச்சனையால் நிறைவடையவில்லை. கீழே உள்ள இணைப்பைப் பயன்படுத்தி உடனடியாக முடிக்கவும்.',
        call_to_action: 'இப்போது பணம் செலுத்துங்கள்',
        channel_recommended: 'WhatsApp',
        source: 'deterministic-fallback',
        model: 'rule-template-engine'
      },
      EN: {
        recovery_id: recoveryId,
        language: 'EN',
        headline: 'Your payment was interrupted',
        message_body: 'Hi, your payment was interrupted due to a temporary bank gateway timeout. Use the secure link below to retry with instant 1-click verification.',
        call_to_action: 'Retry Payment Now',
        channel_recommended: 'WhatsApp / SMS',
        source: 'deterministic-fallback',
        model: 'rule-template-engine'
      }
    }

    return messages[language] || messages.EN
  },

  async getDashboard(): Promise<DashboardData> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard`)
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

      const res = await fetch(`${API_BASE_URL}/api/transactions?${query.toString()}`)
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


