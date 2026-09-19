import { API_BASE_URL, authFetch } from './api'

export interface WorkspaceData {
  id: string
  name: string
  role: 'admin' | 'operator'
  member_count: number
  created_at?: string | null
  updated_at?: string | null
}

export interface CreateWorkspacePayload {
  name: string
  business_type?: string
  timezone?: string
  currency?: string
}

export interface WorkspaceSettingsData {
  human_approval_threshold: number
  urgent_value_threshold: number
  max_recovery_attempts: number
  cooldown_minutes: number
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
  maximum_discount_percent: number
  allowed_strategies: string[]
}

export interface RazorpayConnectPayload {
  key_id: string
  key_secret: string
  webhook_secret?: string
}

export interface RazorpayIntegrationStatus {
  configured: boolean
  provider: string
  mode: string
  public_key_id_masked: string
  webhook_configured: boolean
  webhook_url: string
  status: string
  last_verified_at?: string | null
  last_error?: string | null
}

export interface InvitationData {
  id: string
  workspace_id: string
  workspace_name: string
  email?: string | null
  role: string
  token: string
  invite_url: string
  expires_at: string
  created_at: string
}

export const workspaceApi = {
  async listMyWorkspaces(): Promise<WorkspaceData[]> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/workspaces/me`)
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Failed to list workspaces') }
    return await res.json()
  },
  async createWorkspace(payload: CreateWorkspacePayload): Promise<WorkspaceData> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/workspaces`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Failed to create workspace') }
    return await res.json()
  },
  async getSettings(workspaceId: string): Promise<WorkspaceSettingsData> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}/settings`)
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Failed to get settings') }
    return await res.json()
  },
  async updateSettings(workspaceId: string, payload: Partial<WorkspaceSettingsData>): Promise<WorkspaceSettingsData> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Failed to update settings') }
    return await res.json()
  },
  async getRazorpayStatus(workspaceId: string): Promise<RazorpayIntegrationStatus> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}/integrations/razorpay`)
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Failed to get Razorpay status') }
    return await res.json()
  },
  async connectRazorpay(workspaceId: string, payload: RazorpayConnectPayload): Promise<RazorpayIntegrationStatus> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}/integrations/razorpay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Failed to connect Razorpay') }
    return await res.json()
  },
  async createInvitation(workspaceId: string, payload: { email?: string; role: string }): Promise<InvitationData> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}/invitations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Failed to create invitation') }
    return await res.json()
  },
  async acceptInvitation(token: string): Promise<{ success: boolean; workspace_id: string; workspace_name: string; role: string }> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/workspaces/invitations/${token}/accept`, { method: 'POST' })
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Failed to accept invitation') }
    return await res.json()
  }
}
