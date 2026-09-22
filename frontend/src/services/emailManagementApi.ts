import { API_BASE_URL, authFetch } from './api'

export interface EmailStatusData {
  provider: string
  configured: boolean
  masked_api_key?: string | null
  from_address: string
  global_email_enabled: boolean
  workspace_email_enabled: boolean
  effective_email_enabled: boolean
  test_mode: boolean
  test_recipients: string[]
  primary_test_recipient?: string | null
  auto_redirect_demo: boolean
  quiet_hours_enabled: boolean
  quiet_hours_window: string
  cooldown_minutes: number
  max_emails_per_recovery: number
  stats_24h: {
    total: number
    sent: number
    delivered: number
    bounced: number
    blocked: number
  }
}

export interface SendTestEmailPayload {
  recipient?: string
  customer_name?: string
  amount?: number
  template_type?: string
  action_url?: string
}

export interface SendTestEmailResponse {
  success: boolean
  status: string
  delivery_label: string
  recipient: string
  provider: string
  provider_message_id?: string | null
  error_code?: string | null
  error_message?: string | null
  idempotency_key: string
  test_case_id: string
}

export interface EmailMessageItem {
  id: string
  recipient: string
  subject: string
  template_type?: string | null
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'BLOCKED'
  provider: string
  provider_message_id?: string | null
  error_code?: string | null
  error_message?: string | null
  created_at: string
  sent_at?: string | null
  delivered_at?: string | null
  idempotency_key: string
  recovery_case_id?: string | null
  transaction_id?: string | null
  metadata?: Record<string, any> | null
}

export interface EmailHistoryResponse {
  total: number
  limit: number
  offset: number
  items: EmailMessageItem[]
}

export interface EmailSettingsUpdatePayload {
  email_enabled?: boolean
  max_emails_per_recovery?: number
  email_cooldown_minutes?: number
  email_quiet_hours_enabled?: boolean
  email_quiet_hours_start?: string
  email_quiet_hours_end?: string
  recovery_success_email_enabled?: boolean
}

export const emailManagementApi = {
  async getStatus(): Promise<EmailStatusData> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/email-management/status`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to fetch email service status')
    }
    return await res.json()
  },

  async sendTestEmail(payload: SendTestEmailPayload): Promise<SendTestEmailResponse> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/email-management/send-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to dispatch test email')
    }
    return await res.json()
  },

  async getHistory(limit = 20, offset = 0, statusFilter?: string): Promise<EmailHistoryResponse> {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (statusFilter && statusFilter !== 'ALL') {
      query.append('status_filter', statusFilter)
    }
    const res = await authFetch(`${API_BASE_URL}/api/v1/email-management/history?${query.toString()}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to load email history')
    }
    return await res.json()
  },

  async updateSettings(payload: EmailSettingsUpdatePayload): Promise<any> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/email-management/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to update email settings')
    }
    return await res.json()
  }
}
