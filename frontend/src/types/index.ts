export type PaymentMethod = 'UPI' | 'Card' | 'NetBanking' | 'Wallet' | 'EMI'

export type FailureCategory = 
  | 'INSUFFICIENT_FUNDS' 
  | 'AUTHENTICATION_FAILED' 
  | 'BANK_TIMEOUT' 
  | 'CARD_EXPIRED' 
  | 'LIMIT_EXCEEDED' 
  | 'CHECKOUT_ABANDONED'
  | 'GATEWAY_ERROR'
  | 'TEMPORARY'
  | 'PAYMENT_METHOD_SPECIFIC'
  | 'CUSTOMER_ACTION_REQUIRED'
  | 'PERMANENT'
  | 'ABANDONMENT'
  | 'RISK_BLOCKED'
  | 'UNKNOWN'

export type RecoveryStatus = 
  | 'RECOVERED' 
  | 'IN_PROGRESS' 
  | 'PENDING_APPROVAL' 
  | 'ATTEMPTING' 
  | 'FAILED' 
  | 'COOLING_DOWN'
  | 'ACTION_SCHEDULED'
  | 'ACTION_EXECUTED'
  | 'DETECTED'
  | 'ANALYZED'
  | 'STRATEGY_SELECTED'
  | 'WAITING_FOR_CUSTOMER'

export type RecoveryStrategy = 
  | 'SMART_PAYLINK_1CLICK'
  | 'PAYMENT_LINK'
  | 'UPI_INTENT_FALLBACK'
  | 'UPI_SWITCH'
  | 'TIMED_SMART_RETRY'
  | 'RETRY_LATER'
  | 'RETRY_NOW'
  | 'INCENTIVIZED_DUNNING'
  | 'PERSONALIZED_REMINDER'
  | 'WHATSAPP_CONCIERGE'
  | 'HUMAN_ESCALATION'
  | 'NO_ACTION'
  | 'CARD_UPDATE_PROMPT'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  tier?: 'ENTERPRISE' | 'GROWTH' | 'STANDARD' | 'VIP'
  ltv: number
}

export interface FailureDiagnosis {
  failure_reason_code: string
  failure_reason?: string
  failure_category: string
  taxonomy?: string
  failure_source?: string
  human_readable_reason: string
  confidence?: number
  raw_gateway_code?: string | null
  is_transient?: boolean
  is_retryable_same_instrument?: boolean
  requires_customer_switch?: boolean
  is_risk_blocked?: boolean
  attempt_number?: number
  description: string
}

export interface SelectedAction {
  action_code: string
  display_name: string
  customer_cta: string
  execution_handler: string
}

export interface QueueCounts {
  all_at_risk: number
  high_value_urgent: number
  vip_enterprise: number
  gateway_bank_outages: number
  batch_dispatch_eligible: number
}

export interface Transaction {
  id: string
  orderId: string
  customer: Customer
  amount: number
  currency: string
  method: PaymentMethod
  failureCategory: FailureCategory
  failureReason: string
  failureDiagnosis?: FailureDiagnosis
  recoveryProbability: number // 0.0 to 1.0 (Overall Recoverability)
  recommendedAction: RecoveryStrategy
  selectedAction?: SelectedAction
  status: RecoveryStatus
  riskLevel: RiskLevel
  createdAt: string
  updatedAt: string
  recoveredAmount?: number
  erv: number // Expected Recovery Value
  attemptsCount: number
}

export interface AgentActivity {
  id: string
  timestamp: string
  transactionId: string
  customerName: string
  amount: number
  action: RecoveryStrategy
  status: 'EXECUTED' | 'WAITING' | 'SUCCESS' | 'BLOCKED'
  erv: number
  explanation: string
}

export interface MetricSummary {
  revenueAtRisk: number
  revenueRecovered: number
  recoveryRate: number
  activeRecoveries: number
  atRiskDeltaPercent: number
  recoveredDeltaPercent: number
  recoveryRateDeltaPercent: number
  activeDeltaCount: number
}

export interface StrategyPerformance {
  strategy: string
  strategyKey: RecoveryStrategy
  attempts: number
  successCount: number
  recoveryRate: number
  recoveredAmount: number
  avgRecoveryTimeMinutes: number
}

export interface PaymentBreakdownItem {
  method: PaymentMethod
  volume: number
  recoveredAmount: number
  lossAmount: number
  recoveryRate: number
}

export interface FailureReasonItem {
  category: FailureCategory
  label: string
  count: number
  totalAmount: number
  recoveredAmount: number
  recoveryRate: number
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  actor: 'AUTONOMOUS_AGENT' | 'MERCHANT_ADMIN' | 'SYSTEM_GUARDRAIL' | 'WEBHOOK_EVENT'
  actionType: string
  targetResource: string
  details: string
  metadata?: Record<string, any>
  ipAddress?: string
}

export interface GuardrailRule {
  id: string
  name: string
  description: string
  category: 'FINANCIAL' | 'COMMUNICATION' | 'RATE_LIMIT' | 'SAFETY'
  enabled: boolean
  thresholdValue: string | number
  unit: string
  actionOnBreach: 'BLOCK' | 'REQUIRE_MANUAL_APPROVAL' | 'NOTIFY_ONLY'
}
