import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { profileApi } from '../services/api'

const PROFILE_CACHE_PREFIX = 'recoverai_profile_cache_'

function buildOptimisticProfile(userId: string, userEmail?: string, metadata?: any): UserProfile {
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.id === userId) {
        return {
          ...parsed,
          email: parsed.email || userEmail || '',
          role: parsed.role === 'admin' ? 'admin' : 'operator'
        }
      }
    }
  } catch {
    // Ignore cache read failures
  }
  return {
    id: userId,
    email: userEmail || '',
    full_name: metadata?.full_name || metadata?.name || userEmail?.split('@')[0] || 'User',
    avatar_url: metadata?.avatar_url || metadata?.picture || '',
    role: 'operator'
  }
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  role: 'admin' | 'operator'
  created_at?: string
  updated_at?: string
}

export interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  role: 'admin' | 'operator'
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; session: Session | null }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null; user: User | null; session: Session | null }>
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  refreshProfile: () => Promise<UserProfile | null>
  updateProfile: (updates: { full_name?: string; avatar_url?: string | null }) => Promise<{ error: any; profile: UserProfile | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [role, setRole] = useState<'admin' | 'operator'>('operator')
  const [loading, setLoading] = useState(true)
  const inflightProfileRef = useRef<{ userId: string; promise: Promise<UserProfile | null> } | null>(null)
  const lastProfileFetchAtRef = useRef<Record<string, number>>({})

  const fetchProfile = useCallback(async (userId: string, userEmail?: string, metadata?: any, force = false): Promise<UserProfile | null> => {
    const now = Date.now()
    if (!force && inflightProfileRef.current?.userId === userId) {
      return inflightProfileRef.current.promise
    }
    if (!force && lastProfileFetchAtRef.current[userId] && now - lastProfileFetchAtRef.current[userId] < 15000) {
      return buildOptimisticProfile(userId, userEmail, metadata)
    }

    const promise = (async (): Promise<UserProfile | null> => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id,email,full_name,avatar_url,role,created_at,updated_at')
          .eq('id', userId)
          .abortSignal(controller.signal)
          .maybeSingle()

        if (error) {
          console.warn('[RecoverAI Auth] Profiles query notice:', error.message)
        }

        lastProfileFetchAtRef.current[userId] = Date.now()

        if (data) {
          const userProf: UserProfile = {
            id: data.id,
            email: data.email || userEmail || '',
            full_name: data.full_name || metadata?.full_name || metadata?.name || '',
            avatar_url: data.avatar_url || metadata?.avatar_url || metadata?.picture || '',
            role: (data.role === 'admin' ? 'admin' : 'operator'),
            created_at: data.created_at,
            updated_at: data.updated_at
          }
          try {
            localStorage.setItem(`${PROFILE_CACHE_PREFIX}${userId}`, JSON.stringify(userProf))
          } catch {
            // Ignore storage quota issues
          }
          setProfile(userProf)
          setRole(userProf.role)
          return userProf
        } else {
          const fallbackProf = buildOptimisticProfile(userId, userEmail, metadata)
          setProfile(fallbackProf)
          setRole(fallbackProf.role)
          return fallbackProf
        }
      } catch (err: any) {
        console.warn('[RecoverAI Auth] Error retrieving profile:', err)
        const fallbackProf = buildOptimisticProfile(userId, userEmail, metadata)
        setProfile(fallbackProf)
        setRole(fallbackProf.role)
        return fallbackProf
      } finally {
        clearTimeout(timeoutId)
        if (inflightProfileRef.current?.userId === userId) {
          inflightProfileRef.current = null
        }
      }
    })()

    inflightProfileRef.current = { userId, promise }
    return promise
  }, [])

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user) return null
    return fetchProfile(user.id, user.email, user.user_metadata, true)
  }, [user, fetchProfile])

  useEffect(() => {
    let isMounted = true

    const applySessionImmediate = (activeSession: Session | null) => {
      if (!isMounted) return
      setSession(activeSession)
      setUser(activeSession?.user ?? null)
      if (activeSession?.user) {
        localStorage.setItem('recoverai_authenticated', 'true')
        const optimistic = buildOptimisticProfile(
          activeSession.user.id,
          activeSession.user.email,
          activeSession.user.user_metadata
        )
        setProfile(optimistic)
        setRole(optimistic.role)
        setLoading(false)
        // Hydrate authoritative profile asynchronously without blocking initial UI render
        void fetchProfile(
          activeSession.user.id,
          activeSession.user.email,
          activeSession.user.user_metadata
        )
      } else {
        localStorage.removeItem('recoverai_authenticated')
        setProfile(null)
        setRole('operator')
        setLoading(false)
      }
    }

    // Initialize session from client local storage without blocking on network profile fetch
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[RecoverAI Auth] Error fetching active session:', error.message)
      }
      applySessionImmediate(session)
    })

    // Listen for auth state changes (sign in, token refresh, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      applySessionImmediate(currentSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (!error && data.session) {
        setSession(data.session)
        setUser(data.user)
        localStorage.setItem('recoverai_authenticated', 'true')
        if (data.user) {
          const optimistic = buildOptimisticProfile(data.user.id, data.user.email, data.user.user_metadata)
          setProfile(optimistic)
          setRole(optimistic.role)
          void fetchProfile(data.user.id, data.user.email, data.user.user_metadata, true)
        }
      }

      return { error, session: data.session }
    } catch (err: any) {
      return { error: err as AuthError, session: null }
    }
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName?.trim() || '',
          },
        },
      })

      if (!error && data.session) {
        setSession(data.session)
        setUser(data.user)
        localStorage.setItem('recoverai_authenticated', 'true')
        if (data.user) {
          await fetchProfile(data.user.id, data.user.email, data.user.user_metadata)
        }
      }

      return { error, user: data.user, session: data.session }
    } catch (err: any) {
      return { error: err as AuthError, user: null, session: null }
    }
  }

  const signInWithGoogle = async (customRedirect?: string) => {
    try {
      const redirectUrl = customRedirect || (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      return { error }
    } catch (err: any) {
      return { error: err as AuthError }
    }
  }

  const signOut = async () => {
    const uid = user?.id
    const clearClientCaches = () => {
      localStorage.removeItem('recoverai_authenticated')
      if (uid) {
        localStorage.removeItem(`${PROFILE_CACHE_PREFIX}${uid}`)
        localStorage.removeItem(`recoverai_workspaces_cache_${uid}`)
      }
    }
    try {
      const { error } = await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      setProfile(null)
      setRole('operator')
      clearClientCaches()
      return { error }
    } catch (err: any) {
      setSession(null)
      setUser(null)
      setProfile(null)
      setRole('operator')
      clearClientCaches()
      return { error: err as AuthError }
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/login`
        : undefined

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      })
      return { error }
    } catch (err: any) {
      return { error: err as AuthError }
    }
  }

  const updateProfile = async (updates: { full_name?: string; avatar_url?: string | null }) => {
    try {
      if (!user) {
        return { error: new Error('Operator is not authenticated.'), profile: null }
      }

      const cleanName = updates.full_name !== undefined ? updates.full_name.trim() : undefined
      const cleanAvatar = updates.avatar_url !== undefined ? (updates.avatar_url ? updates.avatar_url.trim() : null) : undefined

      // 1. Direct Supabase auth user metadata update
      const metaUpdates: Record<string, any> = {}
      if (cleanName !== undefined) {
        metaUpdates.full_name = cleanName
        metaUpdates.name = cleanName
      }
      if (cleanAvatar !== undefined) {
        metaUpdates.avatar_url = cleanAvatar
        metaUpdates.picture = cleanAvatar
      }

      if (Object.keys(metaUpdates).length > 0) {
        const { error: authErr } = await supabase.auth.updateUser({
          data: metaUpdates
        })
        if (authErr) {
          console.warn('[RecoverAI Auth] Supabase auth metadata update notice:', authErr.message)
        }
      }

      // 2. Direct Supabase public.profiles table update
      const profileUpdates: Record<string, any> = {
        updated_at: new Date().toISOString()
      }
      if (cleanName !== undefined) profileUpdates.full_name = cleanName
      if (cleanAvatar !== undefined) profileUpdates.avatar_url = cleanAvatar

      const { error: dbErr } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id)

      if (dbErr) {
        console.warn('[RecoverAI Auth] Supabase profiles table update notice:', dbErr.message)
      }

      // 3. Backend API authoritative database update (bypasses RLS limits if any)
      try {
        await profileApi.updateProfile({
          ...(cleanName !== undefined ? { full_name: cleanName } : {}),
          ...(cleanAvatar !== undefined ? { avatar_url: cleanAvatar } : {})
        })
      } catch (apiErr) {
        console.warn('[RecoverAI Auth] Backend profile API sync notice:', apiErr)
      }

      // 4. Update React state immediately so UI updates instantly across layout
      const updatedProf: UserProfile = {
        ...(profile || {
          id: user.id,
          email: user.email || '',
          role: role
        }),
        ...(cleanName !== undefined ? { full_name: cleanName } : {}),
        ...(cleanAvatar !== undefined ? { avatar_url: cleanAvatar || undefined } : {}),
        role: profile?.role || role,
        updated_at: new Date().toISOString()
      }
      setProfile(updatedProf)

      // 5. Re-fetch profile to ensure persistence verification
      const refreshed = await fetchProfile(user.id, user.email, {
        ...(user.user_metadata || {}),
        ...metaUpdates
      })

      return { error: null, profile: refreshed || updatedProf }
    } catch (err: any) {
      console.error('[RecoverAI Auth] Failed to update profile:', err)
      return { error: err, profile: null }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext

