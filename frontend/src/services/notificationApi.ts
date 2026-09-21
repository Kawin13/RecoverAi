import { API_BASE_URL, authFetch } from './client'

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

export const notificationApi = {
  async getNotifications(caseId?: string, limit: number = 20): Promise<NotificationReceiptItem[]> {
    const url = caseId
      ? `${API_BASE_URL}/api/recovery/notifications?case_id=${caseId}&limit=${limit}`
      : `${API_BASE_URL}/api/recovery/notifications?limit=${limit}`
    const res = await authFetch(url)
    if (!res.ok) {
      return []
    }
    return await res.json()
  }
}
