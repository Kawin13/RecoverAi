import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Shield, ArrowRight, Mail, ArrowLeft, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as any)?.from?.pathname || '/overview'

  const handleGoogleSignIn = async () => {
    setErrorMessage(null)
    setIsGoogleLoading(true)
    try {
      const { error } = await signInWithGoogle()
      if (error) {
        if (error.message?.toLowerCase().includes('provider is not enabled') || error.message?.toLowerCase().includes('unsupported provider')) {
          setErrorMessage('Google Sign-In is not enabled on this Supabase project. Please complete provider setup in Supabase Dashboard.')
        } else {
          setErrorMessage(error.message || 'Unable to initiate Google Sign-In.')
        }
        setIsGoogleLoading(false)
      }
    } catch {
      setErrorMessage('A network error occurred while connecting to Google authentication.')
      setIsGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    if (!password) {
      setErrorMessage('Please enter your workspace password.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error, session } = await signIn(email, password)

      if (error) {
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          setErrorMessage('Please confirm your email address before signing in. Check your inbox for the activation link.')
        } else if (error.message?.toLowerCase().includes('invalid login credentials') || error.message?.toLowerCase().includes('invalid') || error.code === 'invalid_credentials') {
          setErrorMessage('Invalid email or password. Please verify your credentials.')
        } else {
          setErrorMessage(error.message || 'Unable to sign in. Please try again.')
        }
        return
      }

      if (session) {
        navigate(from, { replace: true })
      }
    } catch {
      setErrorMessage('A network error occurred while connecting to authentication service.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-graphite antialiased font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <Link to="/" className="flex items-center justify-center gap-2 group mb-6">
          <div className="w-9 h-9 rounded-sm bg-burnt-orange flex items-center justify-center text-white font-bold font-display shadow-sm group-hover:bg-burnt-orange-hover transition-colors">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-graphite text-2xl tracking-tight font-display">
            Recover<span className="text-burnt-orange">AI</span>
          </span>
        </Link>

        <h2 className="text-center text-2xl font-bold font-display text-graphite">
          Sign In to Your Workspace
        </h2>
        <p className="mt-1 text-center text-xs text-warm-gray-600">
          Autonomous revenue recovery cockpit for digital merchants
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-surface py-8 px-6 sm:px-8 border border-border rounded-md shadow-fintech-card space-y-5">
          {errorMessage && (
            <div className="p-3 bg-brick-red-light border border-brick-red/30 rounded-sm text-xs text-brick-red-dark flex items-start gap-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-brick-red flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting || isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-surface hover:bg-warm-gray-50 text-graphite text-xs font-medium border border-border rounded-sm shadow-fintech-subtle transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-burnt-orange" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-border w-full" />
            <span className="bg-surface px-3 text-[11px] text-warm-gray-400 font-mono uppercase tracking-wider relative">
              or email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-warm-gray-700 mb-1">
                Merchant Work Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-sm text-xs text-graphite focus:outline-none focus:border-burnt-orange font-mono disabled:opacity-60"
                  placeholder="name@merchant.com"
                />
                <Mail className="w-4 h-4 text-warm-gray-400 absolute right-3 top-2.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-warm-gray-700">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] text-burnt-orange hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-sm text-xs text-graphite focus:outline-none focus:border-burnt-orange font-mono pr-9 disabled:opacity-60"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-2.5 text-warm-gray-400 hover:text-graphite focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white text-xs font-medium rounded-sm shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Cockpit</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-1 text-center text-xs text-warm-gray-600">
            <span>Don't have a merchant workspace? </span>
            <Link to="/signup" className="text-burnt-orange font-medium hover:underline">
              Create workspace
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-warm-gray-500 hover:text-graphite transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Public Homepage</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Login
