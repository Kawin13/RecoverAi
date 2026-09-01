import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, ArrowRight, ArrowLeft, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export const Signup: React.FC = () => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const { signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

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

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.')
      return
    }

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid work email address.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error, user, session } = await signUp(email, password, fullName)

      if (error) {
        const msg = error.message?.toLowerCase() || ''
        if (msg.includes('already registered') || msg.includes('already exists')) {
          setErrorMessage('An account with this email address already exists. Please sign in.')
        } else if (msg.includes('rate limit') || msg.includes('security purposes') || (error as any).code === 'over_email_send_rate_limit') {
          setErrorMessage('Email dispatch rate limit reached. For security, please wait 60 seconds or sign in directly.')
        } else {
          setErrorMessage(error.message || 'Unable to complete registration. Please try again.')
        }
        return
      }

      if (session) {
        // Auto-confirmed workspace session
        navigate('/overview', { replace: true })
      } else if (user) {
        // Confirmation email dispatched
        setConfirmationSent(true)
      }
    } catch {
      setErrorMessage('A network error occurred while connecting to authentication service.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-sm bg-burnt-orange flex items-center justify-center shadow-fintech-subtle">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-graphite text-2xl tracking-tight font-display">
            Recover<span className="text-burnt-orange">AI</span>
          </span>
        </Link>

        <div className="bg-surface py-8 px-6 sm:px-8 border border-border rounded-md shadow-fintech-card space-y-6">
          {confirmationSent ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-moss-green-light border border-moss-green/30 flex items-center justify-center text-moss-green mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold font-display text-graphite">
                  Confirmation Link Dispatched
                </h3>
                <p className="text-xs text-warm-gray-600 leading-relaxed">
                  We've transmitted a verification link to <strong className="font-mono text-graphite">{email}</strong>.
                  Please confirm your email address to access your recovery workspace.
                </p>
              </div>

              <div className="pt-3">
                <Link
                  to="/login"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white text-xs font-medium rounded-sm shadow-sm transition-colors"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="p-3.5 bg-brick-red-light border border-brick-red/30 rounded-sm text-xs text-brick-red-dark flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-brick-red flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* OAuth Providers */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting || isGoogleLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-surface hover:bg-warm-gray-50 border border-border rounded-sm text-xs font-medium text-graphite transition-colors shadow-2xs disabled:opacity-60"
                >
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
                  <span>Sign up with Google</span>
                </button>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-border w-full" />
                <span className="bg-surface px-3 text-[11px] text-warm-gray-400 uppercase font-mono">
                  or workspace email
                </span>
              </div>

              {/* Email / Password Sign Up Form */}
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-medium text-graphite mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-sm text-xs text-graphite focus:outline-none focus:border-burnt-orange disabled:opacity-60"
                      placeholder="e.g. Monish B"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-graphite mb-1">
                    Business Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-sm text-xs text-graphite focus:outline-none focus:border-burnt-orange font-mono disabled:opacity-60"
                      placeholder="operator@company.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-graphite mb-1">
                    Password (min 8 characters)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-sm text-xs text-graphite focus:outline-none focus:border-burnt-orange font-mono pr-9 disabled:opacity-60"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-warm-gray-400 hover:text-graphite"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-graphite mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 bg-bg border border-border rounded-sm text-xs text-graphite focus:outline-none focus:border-burnt-orange font-mono pr-9 disabled:opacity-60"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-2.5 text-warm-gray-400 hover:text-graphite"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-warm-gray-500 leading-normal">
                  By registering, you agree to payment recovery safety guardrails and Razorpay test-mode guidelines.
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white text-xs font-medium rounded-sm shadow-sm transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisioning Workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Merchant Account</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center text-xs text-warm-gray-600">
                <span>Already have a merchant workspace? </span>
                <Link to="/login" className="text-burnt-orange font-medium hover:underline">
                  Sign in
                </Link>
              </div>
            </>
          )}
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

export default Signup
