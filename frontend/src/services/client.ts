import { supabase } from '../lib/supabase'
import { ENV } from '../config/env'

export const API_BASE_URL = ENV.API_BASE_URL

export async function getAuthHeaders(contentType: string = 'application/json'): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  if (contentType) {
    headers['Content-Type'] = contentType
  }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  } catch (err) {
    console.warn('[API] Could not retrieve session for auth header:', err)
  }
  try {
    const activeWs =
      localStorage.getItem('recoverai_active_workspace_id') ||
      localStorage.getItem('recoverai_active_workspace')
    if (activeWs) {
      headers['X-Workspace-Id'] = activeWs
    }
  } catch {
    // Ignore in non-browser environments
  }
  return headers
}

export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const authHeaders = await getAuthHeaders(
    (init?.headers as any)?.['Content-Type'] ||
      (init?.method && init.method !== 'GET' ? 'application/json' : '')
  )
  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...((init?.headers as Record<string, string>) || {})
  }

  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: mergedHeaders
    })
  } catch (err: any) {
    // Retry once after 1.2s to transparently handle Render cold boots or transient connection resets
    console.warn('[API] authFetch encountered network error, retrying once...', err?.message || err)
    await new Promise((r) => setTimeout(r, 1200))
    res = await fetch(url, {
      ...init,
      headers: mergedHeaders
    })
  }

  if (res.status === 401) {
    try {
      const { data: { session } } = await supabase.auth.refreshSession()
      if (session?.access_token) {
        mergedHeaders['Authorization'] = `Bearer ${session.access_token}`
        res = await fetch(url, {
          ...init,
          headers: mergedHeaders
        })
      }
    } catch (err) {
      console.warn('[API] Session refresh on 401 failed:', err)
    }
  }

  return res
}
