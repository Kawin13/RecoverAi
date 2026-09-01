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
          Reset Your Password
        </h2>
        <p className="mt-1 text-center text-xs text-warm-gray-600">
          Enter your registered work email to receive password recovery instructions
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-surface py-8 px-6 sm:px-8 border border-border rounded-md shadow-fintech-card space-y-6">
          {successMessage ? (
            <div className="space-y-4">
              <div className="p-4 bg-moss-green-light border border-moss-green/30 rounded-sm text-xs text-moss-green-dark space-y-2">
                <div className="flex items-center gap-2 font-semibold font-display">
                  <CheckCircle2 className="w-4 h-4 text-moss-green flex-shrink-0" />
                  <span>Reset Link Dispatched</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {successMessage}
                </p>
              </div>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white text-xs font-medium rounded-sm shadow-sm transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-brick-red-light border border-brick-red/30 rounded-sm text-xs text-brick-red-dark flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-brick-red flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-warm-gray-700 mb-1">
                  Registered Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-sm text-xs text-graphite focus:outline-none focus:border-burnt-orange font-mono"
                    placeholder="name@company.com"
                  />
                  <Mail className="w-4 h-4 text-warm-gray-400 absolute right-3 top-2.5" />
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
                    <span>Transmitting Reset Token...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Instructions</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-warm-gray-600">
                <Link to="/login" className="text-burnt-orange font-medium hover:underline inline-flex items-center gap-1">
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

export default ForgotPassword
