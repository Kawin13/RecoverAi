import {
  Transaction,
  MetricSummary,
  StrategyPerformance,
  AgentActivity,
  PaymentBreakdownItem,
  FailureReasonItem,
  AuditLogEntry,
  GuardrailRule
} from '../types'

export const mockMetrics: MetricSummary = {
  revenueAtRisk: 0,
  revenueRecovered: 0,
  recoveryRate: 0.0,
  activeRecoveries: 0,
  atRiskDeltaPercent: 0.0,
  recoveredDeltaPercent: 0.0,
  recoveryRateDeltaPercent: 0.0,
  activeDeltaCount: 0
}

export const mockTrendData = [
  { date: 'Aug 19', atRisk: 92400, recovered: 58200, target: 50000 },
  { date: 'Aug 20', atRisk: 104500, recovered: 71300, target: 65000 },
  { date: 'Aug 21', atRisk: 88200, recovered: 62400, target: 55000 },
  { date: 'Aug 22', atRisk: 115000, recovered: 78900, target: 72000 },
  { date: 'Aug 23', atRisk: 96800, recovered: 66140, target: 60000 },
  { date: 'Aug 24', atRisk: 89500, recovered: 61900, target: 58000 },
  { date: 'Aug 25', atRisk: 95000, recovered: 61000, target: 60000 },
]

export const mockStrategyPerformance: StrategyPerformance[] = [
  {
    strategy: 'Dynamic 1-Click Paylink',
    strategyKey: 'SMART_PAYLINK_1CLICK',
    attempts: 342,
    successCount: 268,
    recoveryRate: 78.36,
    recoveredAmount: 214500,
    avgRecoveryTimeMinutes: 4.2
  },
  {
    strategy: 'UPI Intent Instant Fallback',
    strategyKey: 'UPI_INTENT_FALLBACK',
    attempts: 218,
    successCount: 161,
    recoveryRate: 73.85,
    recoveredAmount: 128400,
    avgRecoveryTimeMinutes: 2.1
  },
  {
    strategy: 'Timed Smart Retry (Off-Peak/Salary)',
    strategyKey: 'TIMED_SMART_RETRY',
    attempts: 145,
    successCount: 89,
    recoveryRate: 61.38,
    recoveredAmount: 64200,
    avgRecoveryTimeMinutes: 180.0
  },
  {
    strategy: 'AI Incentivized Dunning Email',
    strategyKey: 'INCENTIVIZED_DUNNING',
    attempts: 98,
    successCount: 47,
    recoveryRate: 47.96,
    recoveredAmount: 34740,
    avgRecoveryTimeMinutes: 72.5
  },
  {
    strategy: 'WhatsApp Payment Concierge',
    strategyKey: 'WHATSAPP_CONCIERGE',
    attempts: 45,
    successCount: 26,
    recoveryRate: 57.78,
    recoveredAmount: 18000,
    avgRecoveryTimeMinutes: 15.0
  }
]

export const mockPaymentBreakdown: PaymentBreakdownItem[] = [
  { method: 'UPI', volume: 540, recoveredAmount: 242000, lossAmount: 68000, recoveryRate: 78.1 },
  { method: 'Card', volume: 320, recoveredAmount: 146840, lossAmount: 89200, recoveryRate: 62.2 },
  { method: 'NetBanking', volume: 110, recoveredAmount: 42000, lossAmount: 34000, recoveryRate: 55.3 },
  { method: 'Wallet', volume: 55, recoveredAmount: 19000, lossAmount: 8400, recoveryRate: 69.3 },
  { method: 'EMI', volume: 35, recoveredAmount: 10000, lossAmount: 22000, recoveryRate: 31.2 },
]

export const mockFailureReasons: FailureReasonItem[] = [
  { category: 'INSUFFICIENT_FUNDS', label: 'Insufficient Funds / Card Limit', count: 182, totalAmount: 248000, recoveredAmount: 161200, recoveryRate: 65.0 },
  { category: 'AUTHENTICATION_FAILED', label: '3DS / OTP Timeout or Dismiss', count: 144, totalAmount: 172400, recoveredAmount: 137920, recoveryRate: 80.0 },
  { category: 'BANK_TIMEOUT', label: 'Issuer Bank Downtime / Timeout', count: 96, totalAmount: 124000, recoveredAmount: 89280, recoveryRate: 72.0 },
  { category: 'CHECKOUT_ABANDONED', label: 'Cart Drop at Final Payment Step', count: 85, totalAmount: 88000, recoveredAmount: 48400, recoveryRate: 55.0 },
  { category: 'CARD_EXPIRED', label: 'Expired / Invalidated Mandate', count: 32, totalAmount: 49000, recoveredAmount: 23040, recoveryRate: 47.0 }
]

export const mockTransactions: Transaction[] = [
  {
    id: 'tx_rec_98214',
    orderId: 'ORD-89421',
    customer: {
      id: 'cust_771',
      name: 'Aditya Sharma',
      email: 'aditya.sharma@techcorp.in',
      phone: '+91 98450 12345',
      tier: 'ENTERPRISE',
      ltv: 185000
    },
    amount: 24999,
    currency: 'INR',
    method: 'Card',
    failureCategory: 'AUTHENTICATION_FAILED',
    failureReason: '3DS OTP expired on HDFC Credit Card during checkout',
    recoveryProbability: 0.88,
    recommendedAction: 'SMART_PAYLINK_1CLICK',
    status: 'IN_PROGRESS',
    riskLevel: 'LOW',
    createdAt: new Date(Date.now() - 4 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60000).toISOString(),
    erv: 21999,
    attemptsCount: 1
  },
  {
    id: 'tx_rec_98215',
    orderId: 'ORD-89422',
    customer: {
      id: 'cust_802',
      name: 'Priyanka Iyer',
      email: 'priyanka.i@zenithai.com',
      phone: '+91 98112 34567',
      tier: 'VIP',
      ltv: 340000
    },
    amount: 48500,
    currency: 'INR',
    method: 'UPI',
    failureCategory: 'BANK_TIMEOUT',
    failureReason: 'NPCI UPI switch latency exceeded 15000ms (SBI Bank)',
    recoveryProbability: 0.94,
    recommendedAction: 'UPI_INTENT_FALLBACK',
    status: 'IN_PROGRESS',
    riskLevel: 'LOW',
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
    erv: 45590,
    attemptsCount: 1
  },
  {
    id: 'tx_rec_98216',
    orderId: 'ORD-89423',
    customer: {
      id: 'cust_419',
      name: 'Rajesh Nair',
      email: 'rajesh.nair@vertexops.io',
      tier: 'GROWTH',
      ltv: 62000
    },
    amount: 14200,
    currency: 'INR',
    method: 'Card',
    failureCategory: 'INSUFFICIENT_FUNDS',
    failureReason: 'Card limit exceeded on ICICI Platinum Corporate',
    recoveryProbability: 0.62,
    recommendedAction: 'TIMED_SMART_RETRY',
    status: 'COOLING_DOWN',
    riskLevel: 'MEDIUM',
    createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60000).toISOString(),
    erv: 8804,
    attemptsCount: 1
  },
  {
    id: 'tx_rec_98217',
    orderId: 'ORD-89424',
    customer: {
      id: 'cust_901',
      name: 'Kavita Menon',
      email: 'kavita@creativelab.co',
      phone: '+91 97234 56789',
      tier: 'STANDARD',
      ltv: 24000
    },
    amount: 7999,
    currency: 'INR',
    method: 'UPI',
    failureCategory: 'CHECKOUT_ABANDONED',
    failureReason: 'Abandoned checkout at final UPI pin entry screen',
    recoveryProbability: 0.76,
    recommendedAction: 'WHATSAPP_CONCIERGE',
    status: 'IN_PROGRESS',
    riskLevel: 'LOW',
    createdAt: new Date(Date.now() - 48 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    erv: 6079,
    attemptsCount: 1
  },
  {
    id: 'tx_rec_98218',
    orderId: 'ORD-89425',
    customer: {
      id: 'cust_112',
      name: 'Vikram Mehta',
      email: 'vikram.mehta@fintechlabs.in',
      tier: 'VIP',
      ltv: 490000
    },
    amount: 89000,
    currency: 'INR',
    method: 'NetBanking',
    failureCategory: 'BANK_TIMEOUT',
    failureReason: 'Corporate NetBanking gateway session expired',
    recoveryProbability: 0.82,
    recommendedAction: 'SMART_PAYLINK_1CLICK',
    status: 'RECOVERED',
    riskLevel: 'LOW',
    createdAt: new Date(Date.now() - 110 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 25 * 60000).toISOString(),
    recoveredAmount: 89000,
    erv: 72980,
    attemptsCount: 1
  },
  {
    id: 'tx_rec_98219',
    orderId: 'ORD-89426',
    customer: {
      id: 'cust_654',
      name: 'Sneha Patel',
      email: 'sneha@cloudscale.net',
      tier: 'STANDARD',
      ltv: 18000
    },
    amount: 5400,
    currency: 'INR',
    method: 'Card',
    failureCategory: 'CARD_EXPIRED',
    failureReason: 'Recurring billing token invalid (Card Expired 07/26)',
    recoveryProbability: 0.44,
    recommendedAction: 'INCENTIVIZED_DUNNING',
    status: 'PENDING_APPROVAL',
    riskLevel: 'HIGH',
    createdAt: new Date(Date.now() - 180 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 40 * 60000).toISOString(),
    erv: 2376,
    attemptsCount: 2
  },
  {
    id: 'tx_rec_98220',
    orderId: 'ORD-89427',
    customer: {
      id: 'cust_339',
      name: 'Arjun Das',
      email: 'arjun.das@innovate.tech',
      tier: 'GROWTH',
      ltv: 95000
    },
    amount: 32500,
    currency: 'INR',
    method: 'Card',
    failureCategory: 'AUTHENTICATION_FAILED',
    failureReason: 'Merchant 3DS redirect refused by browser security extension',
    recoveryProbability: 0.91,
    recommendedAction: 'SMART_PAYLINK_1CLICK',
    status: 'RECOVERED',
    riskLevel: 'LOW',
    createdAt: new Date(Date.now() - 240 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 50 * 60000).toISOString(),
    recoveredAmount: 32500,
    erv: 29575,
    attemptsCount: 1
  },
  {
    id: 'tx_rec_98221',
    orderId: 'ORD-89428',
    customer: {
      id: 'cust_504',
      name: 'Rohan Deshmukh',
      email: 'rohan@deshmukh-enterprises.com',
      tier: 'ENTERPRISE',
      ltv: 520000
    },
    amount: 112000,
    currency: 'INR',
    method: 'Card',
    failureCategory: 'LIMIT_EXCEEDED',
    failureReason: 'International transaction limit exceeded on card',
    recoveryProbability: 0.58,
    recommendedAction: 'SMART_PAYLINK_1CLICK',
    status: 'ATTEMPTING',
    riskLevel: 'MEDIUM',
    createdAt: new Date(Date.now() - 320 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 60 * 60000).toISOString(),
    erv: 64960,
    attemptsCount: 2
  }
]

export const mockAgentActivities: AgentActivity[] = [
  {
    id: 'act_101',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    transactionId: 'tx_rec_98214',
    customerName: 'Aditya Sharma',
    amount: 24999,
    action: 'SMART_PAYLINK_1CLICK',
    status: 'EXECUTED',
    erv: 21999,
    explanation: '3DS OTP timeout diagnosed. Dispatched dynamic pre-filled 1-click Razorpay payment link via SMS with 30-min validity.'
  },
  {
    id: 'act_102',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    transactionId: 'tx_rec_98215',
    customerName: 'Priyanka Iyer',
    amount: 48500,
    action: 'UPI_INTENT_FALLBACK',
    status: 'EXECUTED',
    erv: 45590,
    explanation: 'Detected SBI UPI switch outage. Auto-switched routing to alternate NPCI HDFC handle and triggered seamless UPI intent push.'
  },
  {
    id: 'act_103',
    timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
    transactionId: 'tx_rec_98216',
    customerName: 'Rajesh Nair',
    amount: 14200,
    action: 'TIMED_SMART_RETRY',
    status: 'WAITING',
    erv: 8804,
    explanation: 'Insufficient balance pattern. ERV optimizer scheduled silent smart retry at 06:00 AM IST (optimal post-credit settlement window).'
  },
  {
    id: 'act_104',
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    transactionId: 'tx_rec_98218',
    customerName: 'Vikram Mehta',
    amount: 89000,
    action: 'SMART_PAYLINK_1CLICK',
    status: 'SUCCESS',
    erv: 72980,
    explanation: 'Recovery completed! Customer completed transaction via dynamic link within 8 minutes of dispatch.'
  },
  {
    id: 'act_105',
    timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
    transactionId: 'tx_rec_98219',
    customerName: 'Sneha Patel',
    amount: 5400,
    action: 'INCENTIVIZED_DUNNING',
    status: 'BLOCKED',
    erv: 2376,
    explanation: 'Autonomous 5% recovery discount exceeded merchant auto-threshold (Max ₹250). Flagged for human review.'
  }
]

export const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 'audit_501',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    actor: 'AUTONOMOUS_AGENT',
    actionType: 'DISPATCH_INTERVENTION',
    targetResource: 'tx_rec_98214',
    details: 'Dispatched SMART_PAYLINK_1CLICK with ERV ₹21,999 (P_rec: 88%)',
    metadata: { channel: 'SMS', expires_in_mins: 30 }
  },
  {
    id: 'audit_502',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    actor: 'SYSTEM_GUARDRAIL',
    actionType: 'ROUTE_FALLBACK_APPLIED',
    targetResource: 'tx_rec_98215',
    details: 'Bank switch latency threshold breached (15,200ms > 8,000ms max). Fallback to secondary UPI PSP active.',
  },
  {
    id: 'audit_503',
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    actor: 'WEBHOOK_EVENT',
    actionType: 'PAYMENT_CAPTURED',
    targetResource: 'tx_rec_98218',
    details: 'Razorpay webhook received payment.captured for ₹89,000. Attributed to RecoverAI Paylink #PL_98218.',
  },
  {
    id: 'audit_504',
    timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
    actor: 'SYSTEM_GUARDRAIL',
    actionType: 'INTERVENTION_PAUSED',
    targetResource: 'tx_rec_98219',
    details: 'Discount ₹270 exceeds max autonomous rule limit of ₹250. Pushed to manual review queue.',
  },
  {
    id: 'audit_505',
    timestamp: new Date(Date.now() - 80 * 60000).toISOString(),
    actor: 'MERCHANT_ADMIN',
    actionType: 'UPDATE_GUARDRAIL',
    targetResource: 'rule_cooldown_window',
    details: 'Updated customer touchpoint cooldown from 120 mins to 60 mins.',
  }
]

export const mockGuardrailRules: GuardrailRule[] = [
  {
    id: 'rule_max_discount',
    name: 'Maximum Autonomous Discount',
    description: 'Upper limit on dynamic discounts or fee waivers the agent may offer without manual admin confirmation.',
    category: 'FINANCIAL',
    enabled: true,
    thresholdValue: 500,
    unit: 'INR',
    actionOnBreach: 'REQUIRE_MANUAL_APPROVAL'
  },
  {
    id: 'rule_max_touches',
    name: 'Customer Touchpoint Frequency Cap',
    description: 'Maximum number of recovery communications (SMS/Email/WhatsApp) sent for a single failed transaction.',
    category: 'COMMUNICATION',
    enabled: true,
    thresholdValue: 3,
    unit: 'Messages',
    actionOnBreach: 'BLOCK'
  },
  {
    id: 'rule_cooldown_window',
    name: 'Intervention Cooldown Window',
    description: 'Minimum time elapsed before attempting a secondary recovery intervention on the same user account.',
    category: 'RATE_LIMIT',
    enabled: true,
    thresholdValue: 60,
    unit: 'Minutes',
    actionOnBreach: 'BLOCK'
  },
  {
    id: 'rule_high_value_floor',
    name: 'High-Value Escalation Threshold',
    description: 'Transactions exceeding this value require VIP dunning templates and optional supervisor notification.',
    category: 'FINANCIAL',
    enabled: true,
    thresholdValue: 100000,
    unit: 'INR',
    actionOnBreach: 'REQUIRE_MANUAL_APPROVAL'
  },
  {
    id: 'rule_quiet_hours',
    name: 'Nighttime Quiet Hours',
    description: 'Suppress interactive SMS and WhatsApp alerts between 10:00 PM and 08:00 AM local customer time.',
    category: 'SAFETY',
    enabled: true,
    thresholdValue: '22:00 - 08:00',
    unit: 'IST',
    actionOnBreach: 'BLOCK'
  }
]
