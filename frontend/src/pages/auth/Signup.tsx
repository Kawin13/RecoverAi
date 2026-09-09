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
        navigate('/overview', { replace: true })
      } else if (user) {
        setConfirmationSent(true)
      }
    } catch {
      setErrorMessage('A network error occurred while connecting to authentication service.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-navy antialiased font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-6 group">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white font-bold font-display shadow-fintech-purple group-hover:scale-105 transition-all">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-navy text-2xl tracking-tight font-display">
            Recover<span className="text-primary">AI</span>
          </span>
        </Link>

        <div className="bg-surface py-8 px-6 sm:px-8 border border-border/80 rounded-2xl shadow-fintech-card space-y-6">
          {confirmationSent ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto shadow-2xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold font-display text-navy">
                  Confirmation Link Dispatched
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We've transmitted a verification link to <strong className="font-mono text-navy">{email}</strong>.
                  Please confirm your email address to access your recovery workspace.
                </p>
              </div>

              <div className="pt-3">
                <Link
                  to="/login"
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-fintech-purple transition-all"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold font-display text-navy tracking-tight">
                  Create Your Merchant Workspace
                </h2>
                <p className="text-xs text-slate-500">
                  Deploy autonomous payment recovery and prevent customer drop-off
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* OAuth Providers */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting || isGoogleLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-surface hover:bg-slate-50 border border-border rounded-xl text-xs font-semibold text-navy transition-all shadow-2xs disabled:opacity-60 cursor-pointer"
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
                <div className="border-t border-border/80 w-full" />
                <span className="bg-surface px-3 text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">
                  or workspace email
                </span>
              </div>

              {/* Email / Password Sign Up Form */}
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-navy focus:outline-none focus:border-primary disabled:opacity-60 shadow-2xs font-medium"
                      placeholder="e.g. Monish B"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5">
                    Business Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-navy focus:outline-none focus:border-primary font-mono disabled:opacity-60 shadow-2xs"
                      placeholder="operator@company.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5">
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
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-navy focus:outline-none focus:border-primary font-mono pr-10 disabled:opacity-60 shadow-2xs"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-navy cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5">
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
                      className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-navy focus:outline-none focus:border-primary font-mono pr-10 disabled:opacity-60 shadow-2xs"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-navy cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 leading-normal">
                  By registering, you agree to payment recovery safety guardrails and Razorpay test-mode guidelines.
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-fintech-purple transition-all disabled:opacity-60 cursor-pointer"
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

              <div className="pt-2 text-center text-xs text-slate-500">
                <span>Already have a merchant workspace? </span>
                <Link to="/login" className="text-primary font-bold hover:underline">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-navy font-medium transition-colors"
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
