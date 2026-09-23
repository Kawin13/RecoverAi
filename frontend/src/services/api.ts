/**
 * RecoverAI API Services Barrel
 * Consolidates modular domain API services while preserving backwards compatibility.
 */

import { dashboardApi } from './dashboardApi'
import { transactionApi } from './transactionApi'
import { recoveryApi } from './recoveryApi'
import { paymentApi } from './paymentApi'
import { guardrailsApi } from './guardrailsApi'
import { checkoutApi } from './checkoutApi'
import { simulationApi } from './simulationApi'
import { analyticsApi } from './analyticsApi'
import { auditApi } from './auditApi'
import { notificationApi } from './notificationApi'

// Export client core
export { API_BASE_URL, getAuthHeaders, authFetch } from './client'

// Export domain types
export type { DashboardData } from './dashboardApi'
export type { TransactionListResponse } from './transactionApi'
export type {
  StrategyComparisonItem,
  RecoveryAnalysisResponse,
  AIExplanationData,
  AIMessageData,
  PaymentLinkItem,
  WorkflowCase,
  WorkflowListResponse
} from './recoveryApi'
export type {
  PaymentConfig,
  CreateOrderRequest,
  CreateOrderResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  PaymentFailureRequest
} from './paymentApi'
export type {
  GuardrailPolicyRuleItem,
  GuardrailPoliciesResponse,
  HumanApprovalQueueItem,
  WhyStoppedForensicResponse,
  GuardrailEventItem
} from './guardrailsApi'
export type {
  CreateCheckoutSessionPayload,
  TransitionCheckoutSessionPayload,
  CheckoutSessionItem,
  FunnelStageItem,
  AbandonmentFunnelResponse,
  AbandonmentCaseItem,
  PaymentMethodDistribution
} from './checkoutApi'
export type {
  SimulationControls,
  SimulationPreset,
  MethodologyDoc,
  InterventionPerformance,
  CategoryRecoveryStat,
  PaymentMethodRecoveryStat,
  TimelinePoint,
  WaterfallItem,
  SimulatedTransactionItem,
  GuardrailBreachSummary,
  BatchSimulationResponse
} from './simulationApi'
export type {
  AnalyticsFilters,
  FinancialSummaryKPIs,
  StrategyBreakdownItem,
  FailureReasonBreakdownItem,
  PaymentMethodBreakdownItem,
  MerchantCategoryBreakdownItem,
  CustomerSegmentBreakdownItem,
  TimelineTrendPoint,
  FilterOptions,
  AnalyticsResponse
} from './analyticsApi'
export type {
  AuditChronologyItem,
  CaseAuditTimelineResponse,
  CaseAuditSummaryItem,
  CaseAuditListResponse
} from './auditApi'
export type { NotificationReceiptItem } from './notificationApi'
export type { AdminUser, ProfileData } from './authApi'
export type {
  WorkspaceData,
  CreateWorkspacePayload,
  WorkspaceSettingsData,
  RazorpayConnectPayload,
  RazorpayIntegrationStatus,
  InvitationData
} from './workspaceApi'

// Export domain API objects
export { dashboardApi } from './dashboardApi'
export { transactionApi } from './transactionApi'
export { recoveryApi } from './recoveryApi'
export { paymentApi } from './paymentApi'
export { guardrailsApi } from './guardrailsApi'
export { checkoutApi } from './checkoutApi'
export { simulationApi } from './simulationApi'
export { analyticsApi } from './analyticsApi'
export { auditApi } from './auditApi'
export { notificationApi } from './notificationApi'
export { adminApi, profileApi } from './authApi'
export { workspaceApi } from './workspaceApi'

/**
 * Unified RecoverAI API client aggregating all domain endpoints.
 */
export const api = {
  // Health & Dashboard
  getHealth: dashboardApi.getHealth.bind(dashboardApi),
  getQueueCounts: dashboardApi.getQueueCounts.bind(dashboardApi),
  getAtRiskCount: dashboardApi.getAtRiskCount.bind(dashboardApi),
  getDashboard: dashboardApi.getDashboard.bind(dashboardApi),

  // Transactions
  getTransactions: transactionApi.getTransactions.bind(transactionApi),
  getTransaction: transactionApi.getTransaction.bind(transactionApi),

  // Recovery & AI Reasoning
  analyzeRecovery: recoveryApi.analyzeRecovery.bind(recoveryApi),
  fetchAIExplanation: recoveryApi.fetchAIExplanation.bind(recoveryApi),
  fetchAIMessage: recoveryApi.fetchAIMessage.bind(recoveryApi),
  getWorkflows: recoveryApi.getWorkflows.bind(recoveryApi),
  getWorkflow: recoveryApi.getWorkflow.bind(recoveryApi),
  advanceWorkflowStep: recoveryApi.advanceWorkflowStep.bind(recoveryApi),
  executeWorkflow: recoveryApi.executeWorkflow.bind(recoveryApi),
  generatePaymentLink: recoveryApi.generatePaymentLink.bind(recoveryApi),
  simulateWorkflowOutcome: recoveryApi.simulateWorkflowOutcome.bind(recoveryApi),
  syncCasePayment: recoveryApi.syncCasePayment.bind(recoveryApi),
  verifyPaymentLink: recoveryApi.verifyPaymentLink.bind(recoveryApi),

  // Payment Gateway
  getPaymentConfig: paymentApi.getPaymentConfig.bind(paymentApi),
  createPaymentOrder: paymentApi.createPaymentOrder.bind(paymentApi),
  verifyPayment: paymentApi.verifyPayment.bind(paymentApi),
  recordPaymentFailure: paymentApi.recordPaymentFailure.bind(paymentApi),
  simulatePayment: paymentApi.simulatePayment.bind(paymentApi),

  // Guardrails & Governance
  getGuardrailPolicies: guardrailsApi.getGuardrailPolicies.bind(guardrailsApi),
  getApprovalQueue: guardrailsApi.getApprovalQueue.bind(guardrailsApi),
  submitApprovalDecision: guardrailsApi.submitApprovalDecision.bind(guardrailsApi),
  getWhyStoppedForensics: guardrailsApi.getWhyStoppedForensics.bind(guardrailsApi),
  getGuardrailEvents: guardrailsApi.getGuardrailEvents.bind(guardrailsApi),

  // Checkout & Abandonment
  createCheckoutSession: checkoutApi.createCheckoutSession.bind(checkoutApi),
  getCheckoutSessions: checkoutApi.getCheckoutSessions.bind(checkoutApi),
  transitionCheckoutSession: checkoutApi.transitionCheckoutSession.bind(checkoutApi),
  abandonCheckoutSession: checkoutApi.abandonCheckoutSession.bind(checkoutApi),
  checkTimedOutSessions: checkoutApi.checkTimedOutSessions.bind(checkoutApi),
  getAbandonmentFunnel: checkoutApi.getAbandonmentFunnel.bind(checkoutApi),
  getAbandonmentCases: checkoutApi.getAbandonmentCases.bind(checkoutApi),
  getOrderInfo: checkoutApi.getOrderInfo.bind(checkoutApi),

  // Batch Simulation
  runBatchSimulation: simulationApi.runBatchSimulation.bind(simulationApi),
  getSimulationPresets: simulationApi.getSimulationPresets.bind(simulationApi),
  getSimulationMethodology: simulationApi.getSimulationMethodology.bind(simulationApi),

  // Analytics
  getAnalytics: analyticsApi.getAnalytics.bind(analyticsApi),

  // Audit
  getAuditTrail: auditApi.getAuditTrail.bind(auditApi),
  getAuditableCases: auditApi.getAuditableCases.bind(auditApi),
  getCaseChronology: auditApi.getCaseChronology.bind(auditApi),

  // Notifications
  getNotifications: notificationApi.getNotifications.bind(notificationApi)
}

export default api
