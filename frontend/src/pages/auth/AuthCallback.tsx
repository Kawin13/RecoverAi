import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Shield, AlertCircle, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export const AuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let isMounted = true

    const processOAuthCallback = async () => {
      try {
        // Check for error parameters in URL query or hash
        const urlParams = new URLSearchParams(location.search)
        const hashParams = new URLSearchParams(location.hash.startsWith('#') ? location.hash.substring(1) : location.hash)
        
        const error = urlParams.get('error') || hashParams.get('error')
        const errorDesc = urlParams.get('error_description') || hashParams.get('error_description')

        if (error) {
          if (isMounted) {
            setStatus('error')
            setErrorMessage(errorDesc || error || 'Google Authentication was cancelled or failed.')
          }
          return
        }

        // Retrieve the authenticated session from Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          if (isMounted) {
            setStatus('error')
            setErrorMessage(sessionError.message || 'Unable to establish authenticated session.')
          }
          return
        }

        if (session) {
          localStorage.setItem('recoverai_authenticated', 'true')
          if (isMounted) {
            setStatus('success')
            setTimeout(() => {
              navigate('/overview', { replace: true })
            }, 800)
          }
          return
        }

        // If session not yet populated in storage, listen for auth state change
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (event === 'SIGNED_IN' && newSession) {
            localStorage.setItem('recoverai_authenticated', 'true')
            if (isMounted) {
              setStatus('success')
              setTimeout(() => {
                navigate('/overview', { replace: true })
              }, 800)
            }
          }
        })

        // Timeout fallback if no session received within 6 seconds
        const timeout = setTimeout(() => {
          if (isMounted && status === 'loading') {
            setStatus('error')
            setErrorMessage('Authentication session confirmation timed out. Please try signing in again.')
          }
        }, 6000)

        return () => {
          subscription.unsubscribe()
          clearTimeout(timeout)
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error')
          setErrorMessage(err.message || 'An unexpected error occurred during OAuth processing.')
        }
      }
    }

    processOAuthCallback()

    return () => {
      isMounted = false
    }
  }, [location, navigate])

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-navy antialiased font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white font-bold font-display shadow-fintech-purple">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-navy text-2xl tracking-tight font-display">
            Recover<span className="text-primary">AI</span>
          </span>
        </div>

        <div className="bg-surface py-8 px-6 sm:px-8 border border-border/80 rounded-2xl shadow-fintech-card text-center space-y-4">
          {status === 'loading' && (
            <div className="space-y-4 py-4">
              <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center text-primary mx-auto shadow-2xs">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-navy">
                  Synchronizing Google Session
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Validating OAuth identity and establishing secure workspace tokens...
                </p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4 py-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto shadow-2xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-navy">
                  Authentication Successful
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Redirecting to your RecoverAI revenue operations cockpit...
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4 py-2">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 text-left shadow-2xs">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{errorMessage || 'Google Authentication failed.'}</span>
              </div>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-fintech-purple transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthCallback
