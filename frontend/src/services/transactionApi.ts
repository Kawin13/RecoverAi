import { Transaction } from '../types'
import { mockTransactions } from '../data/mockData'
import { ENV } from '../config/env'
import { API_BASE_URL, authFetch } from './client'

export interface TransactionListResponse {
  items: Transaction[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export function mapRawTransaction(t: any): Transaction {
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
    failureCategory: t.recovery_case?.failure_category || (t.payment_attempts?.[0]?.error_category || 'UNKNOWN'),
    failureReason: t.payment_attempts?.[0]?.error_description || (t.recovery_case?.failure_category ? t.recovery_case.failure_category.replace(/_/g, ' ') : (t.error_description || 'Payment dropped during processing')),
    recoveryProbability: t.recovery_case?.recovery_probability !== undefined && t.recovery_case?.recovery_probability !== null
      ? t.recovery_case.recovery_probability
      : (t.recovery_probability !== undefined && t.recovery_probability !== null ? t.recovery_probability : null),
    recommendedAction: t.recovery_case?.selected_strategy || t.selected_strategy || null,
    status: t.recovery_case?.status || t.status,
    riskLevel: (t.customer?.tier === 'VIP' || t.customer?.tier === 'ENTERPRISE' || t.amount >= 25000) ? 'HIGH' : t.amount >= 10000 ? 'MEDIUM' : 'LOW',
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    erv: t.recovery_case?.expected_recovery_value !== undefined && t.recovery_case?.expected_recovery_value !== null
      ? t.recovery_case.expected_recovery_value
      : (t.expected_recovery_value !== undefined && t.expected_recovery_value !== null
        ? t.expected_recovery_value
        : (t.recovery_case?.recovery_probability ? t.amount * t.recovery_case.recovery_probability : null)),
    attemptsCount: t.payment_attempts?.length || 1
  }
}

export const transactionApi = {
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
        const items: Transaction[] = (raw.items || []).map(mapRawTransaction)

        return {
          items,
          total: raw.total ?? items.length,
          page: raw.page || 1,
          limit: raw.limit || 20,
          totalPages: raw.total_pages ?? Math.ceil(items.length / 20)
        }
      }
    } catch (e) {
      console.warn('API getTransactions error:', e)
    }

    if (ENV.DEMO_MODE) {
      return {
        items: mockTransactions,
        total: mockTransactions.length,
        page: 1,
        limit: 20,
        totalPages: 1
      }
    }

    throw new Error('Unable to load transactions. Please check your connection and try again.')
  },

  async getTransaction(id: string): Promise<Transaction | null> {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/transactions/${id}`)
      if (res.ok) {
        const t = await res.json()
        return mapRawTransaction(t)
      }
      if (res.status === 404) {
        return null
      }
    } catch (e) {
      console.warn(`API getTransaction(${id}) error:`, e)
    }

    if (ENV.DEMO_MODE) {
      return mockTransactions.find(t => t.id === id || t.orderId === id) || null
    }

    return null
  }
}
