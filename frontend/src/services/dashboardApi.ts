import { MetricSummary, StrategyPerformance, AgentActivity, PaymentBreakdownItem, FailureReasonItem } from '../types'
import {
  mockMetrics,
  mockTrendData,
  mockStrategyPerformance,
  mockAgentActivities,
  mockPaymentBreakdown,
  mockFailureReasons,
  mockTransactions
} from '../data/mockData'
import { ENV } from '../config/env'
import { isTerminalState } from '../lib/utils'
import { API_BASE_URL, authFetch } from './client'

export interface DashboardData {
  metrics: MetricSummary
  trendData: typeof mockTrendData
  strategyPerformance: StrategyPerformance[]
  paymentBreakdown: PaymentBreakdownItem[]
  failureReasons: FailureReasonItem[]
  recentActivities: AgentActivity[]
  dataMode?: string
  workspaceId?: string
}

export const dashboardApi = {
  async getHealth(): Promise<{ status: string; service: string }> {
    const res = await authFetch(`${API_BASE_URL}/health`)
    if (!res.ok) {
      throw new Error(`Health check failed with status ${res.status}`)
    }
    return await res.json()
  },

  async getQueueCounts(): Promise<{
    all_at_risk: number
    high_value_urgent: number
    vip_enterprise: number
    gateway_bank_outages: number
    batch_dispatch_eligible: number
  }> {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/queue/counts`)
      if (res.ok) {
        return await res.json()
      }
      const fallbackRes = await authFetch(`${API_BASE_URL}/api/recovery-cases/queue-counts`)
      if (fallbackRes.ok) {
        return await fallbackRes.json()
      }
    } catch (e) {
      console.warn('API getQueueCounts unreachable:', e)
    }

    if (ENV.DEMO_MODE) {
      const activeMock = mockTransactions.filter(t => !isTerminalState(t.status))
      return {
        all_at_risk: activeMock.length,
        high_value_urgent: activeMock.filter(t => t.riskLevel === 'HIGH' || (t.amount || 0) >= 25000).length,
        vip_enterprise: activeMock.filter(t => t.customer?.tier === 'VIP' || t.customer?.tier === 'ENTERPRISE').length,
        gateway_bank_outages: activeMock.filter(t => t.failureCategory === 'BANK_TIMEOUT').length,
        batch_dispatch_eligible: activeMock.length
      }
    }

    return {
      all_at_risk: 0,
      high_value_urgent: 0,
      vip_enterprise: 0,
      gateway_bank_outages: 0,
      batch_dispatch_eligible: 0
    }
  },

  async getAtRiskCount(): Promise<number> {
    try {
      const counts = await this.getQueueCounts()
      if (counts && typeof counts.all_at_risk === 'number') {
        return counts.all_at_risk
      }
    } catch (e) {
      console.warn('[API] getAtRiskCount queue counts error:', e)
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/api/transactions?limit=100`)
      if (res.ok) {
        const raw = await res.json()
        const items = raw.items || []
        const active = items.filter((t: any) => !isTerminalState(t.status || t.recovery_case?.status))
        return active.length
      }
    } catch {
      // Fall through
    }
    return 0
  },

  async getDashboard(timeRange = '7d'): Promise<DashboardData> {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/dashboard?time_range=${timeRange}`)
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
          trendData: raw.trend_data || (ENV.DEMO_MODE ? mockTrendData : []),
          strategyPerformance: raw.strategy_performance?.map((s: any) => ({
            strategy: s.strategy,
            strategyKey: s.strategy_key,
            attempts: s.attempts,
            successCount: s.success_count,
            recoveryRate: s.recovery_rate,
            recoveredAmount: s.recovered_amount,
            avgRecoveryTimeMinutes: s.avg_recovery_time_minutes
          })) || (ENV.DEMO_MODE ? mockStrategyPerformance : []),
          paymentBreakdown: raw.payment_breakdown?.map((p: any) => ({
            method: p.method,
            volume: p.volume,
            recoveredAmount: p.recovered_amount,
            lossAmount: p.loss_amount,
            recoveryRate: p.recovery_rate
          })) || (ENV.DEMO_MODE ? mockPaymentBreakdown : []),
          failureReasons: raw.failure_reasons?.map((f: any) => ({
            category: f.category,
            label: f.label,
            count: f.count,
            totalAmount: f.total_amount,
            recoveredAmount: f.recovered_amount,
            recoveryRate: f.recovery_rate
          })) || (ENV.DEMO_MODE ? mockFailureReasons : []),
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
          })) || (ENV.DEMO_MODE ? mockAgentActivities : []),
          dataMode: raw.data_mode || (ENV.DEMO_MODE ? 'Demo Dataset' : 'LIVE DATA'),
          workspaceId: raw.workspace_id
        }
      }
    } catch (e) {
      console.warn('API getDashboard error:', e)
    }

    if (ENV.DEMO_MODE) {
      return {
        metrics: mockMetrics,
        trendData: mockTrendData,
        strategyPerformance: mockStrategyPerformance,
        paymentBreakdown: mockPaymentBreakdown,
        failureReasons: mockFailureReasons,
        recentActivities: mockAgentActivities,
        dataMode: 'Demo Dataset'
      }
    }

    throw new Error('Unable to load dashboard data. Please check your connection and try again.')
  }
}
