import { API_BASE_URL, authFetch } from './client'

export interface AdminUser {
  id: string
  full_name?: string
  email?: string
  avatar_url?: string
  provider: string
  role: 'admin' | 'operator'
  created_at?: string
  last_sign_in_at?: string | null
  status?: string | null
}

export const adminApi = {
  async getUsers(): Promise<AdminUser[]> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/admin/users`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to fetch administrator user list')
    }
    return await res.json()
  },

  async updateUserRole(userId: string, role: 'admin' | 'operator'): Promise<AdminUser> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to update user role')
    }
    return await res.json()
  }
}

export interface ProfileData {
  id: string
  full_name?: string
  email?: string
  avatar_url?: string | null
  role: 'admin' | 'operator'
  created_at?: string | null
  updated_at?: string | null
}

export const profileApi = {
  async getProfile(): Promise<ProfileData> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/profile/me`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to retrieve operator profile')
    }
    return await res.json()
  },

  async updateProfile(updates: { full_name?: string; avatar_url?: string | null }): Promise<ProfileData> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/profile/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to update operator profile')
    }
    return await res.json()
  }
}
