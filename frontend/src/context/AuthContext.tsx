import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [role, setRole] = useState<'admin' | 'operator'>('operator')
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string, userEmail?: string, metadata?: any): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.warn('[RecoverAI Auth] Profiles query notice:', error.message)
      }

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
        setProfile(userProf)
        setRole(userProf.role)
        return userProf
      } else {
        // Fallback default operator profile
        const fallbackProf: UserProfile = {
          id: userId,
          email: userEmail || '',
          full_name: metadata?.full_name || metadata?.name || userEmail?.split('@')[0] || 'User',
          avatar_url: metadata?.avatar_url || metadata?.picture || '',
          role: 'operator'
        }
        setProfile(fallbackProf)
        setRole('operator')
        return fallbackProf
      }
    } catch (err: any) {
      console.warn('[RecoverAI Auth] Error retrieving profile:', err)
      const fallbackProf: UserProfile = {
        id: userId,
        email: userEmail || '',
        full_name: metadata?.full_name || metadata?.name || userEmail?.split('@')[0] || 'User',
        role: 'operator'
      }
      setProfile(fallbackProf)
      setRole('operator')
      return fallbackProf
    }
  }, [])

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user) return null
    return fetchProfile(user.id, user.email, user.user_metadata)
  }, [user, fetchProfile])

  useEffect(() => {
    let isMounted = true

    // Initialize session from client local storage
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (isMounted) {
        if (error) {
          console.error('[RecoverAI Auth] Error fetching active session:', error.message)
        }
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          localStorage.setItem('recoverai_authenticated', 'true')
          await fetchProfile(session.user.id, session.user.email, session.user.user_metadata)
        } else {
          localStorage.removeItem('recoverai_authenticated')
          setProfile(null)
          setRole('operator')
        }
        setLoading(false)
      }
    })

    // Listen for auth state changes (sign in, token refresh, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (isMounted) {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        if (currentSession?.user) {
          localStorage.setItem('recoverai_authenticated', 'true')
          await fetchProfile(currentSession.user.id, currentSession.user.email, currentSession.user.user_metadata)
        } else {
          localStorage.removeItem('recoverai_authenticated')
          setProfile(null)
          setRole('operator')
        }
        setLoading(false)
      }
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
          await fetchProfile(data.user.id, data.user.email, data.user.user_metadata)
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
    try {
      const { error } = await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      setProfile(null)
      setRole('operator')
      localStorage.removeItem('recoverai_authenticated')
      return { error }
    } catch (err: any) {
      setSession(null)
      setUser(null)
      setProfile(null)
      setRole('operator')
      localStorage.removeItem('recoverai_authenticated')
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

