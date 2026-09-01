import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; session: Session | null }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null; user: User | null; session: Session | null }>
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    // Initialize session from client local storage
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (isMounted) {
        if (error) {
          console.error('[RecoverAI Auth] Error fetching active session:', error.message)
        }
        setSession(session)
        setUser(session?.user ?? null)
        if (session) {
          localStorage.setItem('recoverai_authenticated', 'true')
        } else {
          localStorage.removeItem('recoverai_authenticated')
        }
        setLoading(false)
      }
    })

    // Listen for auth state changes (sign in, token refresh, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (isMounted) {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        if (currentSession) {
          localStorage.setItem('recoverai_authenticated', 'true')
        } else {
          localStorage.removeItem('recoverai_authenticated')
        }
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

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
      localStorage.removeItem('recoverai_authenticated')
      return { error }
    } catch (err: any) {
      setSession(null)
      setUser(null)
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
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
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
