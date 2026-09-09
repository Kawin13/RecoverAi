import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, ArrowLeft, Mail, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await resetPassword(email)
      if (error) {
        const msg = error.message?.toLowerCase() || ''
        if (msg.includes('rate limit') || msg.includes('security purposes') || (error as any).code === 'over_email_send_rate_limit') {
          setErrorMessage('Reset request throttled for security. Please wait 60 seconds before trying again.')
        } else {
          setErrorMessage(error.message || 'Unable to process reset request. Please try again.')
        }
      } else {
        setSuccessMessage('Password reset instructions have been sent to your email address if an account exists.')
      }
    } catch {
      setErrorMessage('A network error occurred. Please check your connection.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-navy antialiased font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        {/* Brand Header */}
        <Link to="/" className="flex items-center justify-center gap-2.5 group mb-6">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white font-bold font-display shadow-fintech-purple group-hover:scale-105 transition-all">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-navy text-2xl tracking-tight font-display">
            Recover<span className="text-primary">AI</span>
          </span>
        </Link>

        <h2 className="text-center text-2xl font-bold font-display text-navy tracking-tight">
          Reset Your Password
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Enter your registered work email to receive password recovery instructions
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-surface py-8 px-6 sm:px-8 border border-border/80 rounded-2xl shadow-fintech-card space-y-6">
          {successMessage ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2 shadow-2xs">
                <div className="flex items-center gap-2 font-bold font-display">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Reset Link Dispatched</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-800/90">
                  {successMessage}
                </p>
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
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">
                  Registered Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-navy focus:outline-none focus:border-primary font-mono shadow-2xs"
                    placeholder="name@company.com"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-fintech-purple transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Transmitting Reset Token...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Instructions</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                <Link to="/login" className="text-primary font-bold hover:underline inline-flex items-center gap-1">
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
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

export default ForgotPassword
