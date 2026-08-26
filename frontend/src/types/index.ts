export type PaymentMethod = 'UPI' | 'Card' | 'NetBanking' | 'Wallet' | 'EMI'

export type FailureCategory = 
  | 'INSUFFICIENT_FUNDS' 
  | 'AUTHENTICATION_FAILED' 
  | 'BANK_TIMEOUT' 
  | 'CARD_EXPIRED' 
  | 'LIMIT_EXCEEDED' 
  | 'CHECKOUT_ABANDONED'
  | 'GATEWAY_ERROR'

export type RecoveryStatus = 
  | 'RECOVERED' 
  | 'IN_PROGRESS' 
  | 'PENDING_APPROVAL' 
  | 'ATTEMPTING' 
  | 'FAILED' 
  | 'COOLING_DOWN'

export type RecoveryStrategy = 
  | 'SMART_PAYLINK_1CLICK'
  | 'UPI_INTENT_FALLBACK'
  | 'TIMED_SMART_RETRY'
  | 'INCENTIVIZED_DUNNING'
  | 'WHATSAPP_CONCIERGE'
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

export interface Transaction {
  id: string
  orderId: string
  customer: Customer
  amount: number
  currency: string
  method: PaymentMethod
  failureCategory: FailureCategory
  failureReason: string
  recoveryProbability: number // 0.0 to 1.0
  recommendedAction: RecoveryStrategy
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
