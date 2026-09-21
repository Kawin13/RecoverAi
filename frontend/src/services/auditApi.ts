import { AuditLogEntry } from '../types'
import { mockAuditLogs } from '../data/mockData'
import { ENV } from '../config/env'
import { API_BASE_URL, authFetch } from './client'

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

export const auditApi = {
  async getAuditTrail(transactionId?: string): Promise<AuditLogEntry[]> {
    try {
      const url = transactionId
        ? `${API_BASE_URL}/api/audit/${transactionId}`
        : `${API_BASE_URL}/api/audit`
      const res = await authFetch(url)
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
      console.warn('API getAuditTrail error:', e)
    }

    if (ENV.DEMO_MODE) {
      return mockAuditLogs
    }

    throw new Error('Unable to load audit logs. Please check your connection and try again.')
  },

  async getAuditableCases(params: { search?: string; status?: string; strategy?: string; limit?: number } = {}): Promise<CaseAuditListResponse> {
    const q = new URLSearchParams()
    if (params.search) q.append('search', params.search)
    if (params.status && params.status !== 'ALL') q.append('status', params.status)
    if (params.strategy && params.strategy !== 'ALL') q.append('strategy', params.strategy)
    if (params.limit) q.append('limit', params.limit.toString())

    const res = await authFetch(`${API_BASE_URL}/api/v1/audit/cases?${q.toString()}`)
    if (!res.ok) {
      throw new Error('Failed to fetch auditable cases')
    }
    return await res.json()
  },

  async getCaseChronology(id: string): Promise<CaseAuditTimelineResponse> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/audit/case/${id}/chronology`)
    if (!res.ok) {
      throw new Error('Failed to fetch case audit chronology')
    }
    return await res.json()
  }
}
