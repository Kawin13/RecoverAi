import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { workspaceApi, WorkspaceData } from '../services/workspaceApi'
import { useAuth } from './AuthContext'

export const ACTIVE_WORKSPACE_KEY = 'recoverai_active_workspace_id'
export const LEGACY_ACTIVE_WORKSPACE_KEY = 'recoverai_active_workspace'
const WORKSPACES_CACHE_PREFIX = 'recoverai_workspaces_cache_'

function readCachedWorkspaces(userId: string): WorkspaceData[] | null {
  try {
    const raw = localStorage.getItem(`${WORKSPACES_CACHE_PREFIX}${userId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

function writeCachedWorkspaces(userId: string, list: WorkspaceData[]) {
  try {
    if (list.length > 0) {
      localStorage.setItem(`${WORKSPACES_CACHE_PREFIX}${userId}`, JSON.stringify(list))
    } else {
      localStorage.removeItem(`${WORKSPACES_CACHE_PREFIX}${userId}`)
    }
  } catch {
    // Ignore storage quota issues
  }
}

export interface WorkspaceContextType {
  activeWorkspace: WorkspaceData | null
  workspaces: WorkspaceData[]
  loading: boolean
  error: string | null
  isOnboarding: boolean
  switchWorkspace: (workspace: WorkspaceData) => void
  createWorkspace: (name: string, businessType?: string) => Promise<WorkspaceData>
  refreshWorkspaces: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth()
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOnboarding, setIsOnboarding] = useState(false)
  const fetchedForUser = useRef<string | null>(null)

  const applyActiveWorkspace = useCallback((ws: WorkspaceData) => {
    setActiveWorkspace(ws)
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, ws.id)
    localStorage.setItem(LEGACY_ACTIVE_WORKSPACE_KEY, ws.id)
  }, [])

  const fetchWorkspaces = useCallback(async (background = false) => {
    if (!user || !session) {
      setLoading(false)
      return
    }
    if (!background) {
      setLoading(true)
    }
    setError(null)
    try {
      const list = await workspaceApi.listMyWorkspaces()
      setWorkspaces(list)
      writeCachedWorkspaces(user.id, list)
      if (list.length === 0) {
        setActiveWorkspace(null)
        localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
        localStorage.removeItem(LEGACY_ACTIVE_WORKSPACE_KEY)
        setIsOnboarding(true)
        return
      }
      setIsOnboarding(false)
      const savedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY) || localStorage.getItem(LEGACY_ACTIVE_WORKSPACE_KEY)
      const preferred = savedId ? list.find((w) => w.id === savedId) : null
      applyActiveWorkspace(preferred ?? list[0])
    } catch (err: any) {
      console.warn('[WorkspaceCtx] Failed to fetch workspaces:', err.message)
      if (!background) {
        setError(err.message || 'Failed to load workspaces')
      }
    } finally {
      setLoading(false)
    }
  }, [user, session, applyActiveWorkspace])

  useEffect(() => {
    if (!user || !session) {
      setWorkspaces([])
      setActiveWorkspace(null)
      setIsOnboarding(false)
      setLoading(false)
      fetchedForUser.current = null
      return
    }
    if (fetchedForUser.current === user.id) return
    fetchedForUser.current = user.id

    // Hydrate cached workspace immediately so dashboard & app routes load in parallel
    // with /api/v1/workspaces/me revalidation instead of blocking on a full-screen spinner.
    const cachedList = readCachedWorkspaces(user.id)
    if (cachedList) {
      setWorkspaces(cachedList)
      const savedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY) || localStorage.getItem(LEGACY_ACTIVE_WORKSPACE_KEY)
      const preferred = savedId ? cachedList.find((w) => w.id === savedId) : null
      applyActiveWorkspace(preferred ?? cachedList[0])
      setIsOnboarding(false)
      setLoading(false)
      void fetchWorkspaces(true)
    } else {
      void fetchWorkspaces(false)
    }
  }, [user, session, fetchWorkspaces, applyActiveWorkspace])

  const switchWorkspace = useCallback((ws: WorkspaceData) => {
    applyActiveWorkspace(ws)
  }, [applyActiveWorkspace])

  const createWorkspace = useCallback(async (name: string, businessType?: string): Promise<WorkspaceData> => {
    setLoading(true)
    setError(null)
    try {
      const newWs = await workspaceApi.createWorkspace({
        name,
        business_type: businessType,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        currency: 'INR'
      })
      setWorkspaces((prev) => {
        const next = [newWs, ...prev]
        if (user?.id) writeCachedWorkspaces(user.id, next)
        return next
      })
      applyActiveWorkspace(newWs)
      setIsOnboarding(false)
      return newWs
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace')
      throw err
    } finally {
      setLoading(false)
    }
  }, [applyActiveWorkspace])

  const refreshWorkspaces = useCallback(async () => {
    fetchedForUser.current = null
    await fetchWorkspaces()
  }, [fetchWorkspaces])

  return (
    <WorkspaceContext.Provider value={{ activeWorkspace, workspaces, loading, error, isOnboarding, switchWorkspace, createWorkspace, refreshWorkspaces }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = (): WorkspaceContextType => {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider')
  return ctx
}

export default WorkspaceContext
