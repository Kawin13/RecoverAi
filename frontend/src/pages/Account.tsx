import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail,
  Shield,
  Clock,
  Calendar,
  CheckCircle2,
  Edit2,
  Check,
  X,
  AlertCircle,
  Loader2,
  LogOut,
  KeyRound,
  ShieldCheck,
  User as UserIcon
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export const Account: React.FC = () => {
  const { user, profile, role, signOut } = useAuth()
  const navigate = useNavigate()

  const [isEditingName, setIsEditingName] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || user?.user_metadata?.full_name || '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Password Change Modal / Form state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [isSigningOut, setIsSigningOut] = useState(false)

  // Sync state when user/profile changes
  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name)
    } else if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name)
    } else if (user?.email) {
      setFullName(user.email.split('@')[0])
    }
  }, [user, profile])

  const email = profile?.email || user?.email || ''
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url
  const roleDisplay = role === 'admin' ? 'Administrator' : 'Revenue Operator'
  const roleTag = role === 'admin' ? 'ADMINISTRATOR' : 'REVENUE OPERATOR'

  const authProvider = (() => {
    if (user?.app_metadata?.provider) {
      const p = user.app_metadata.provider
      if (p.toLowerCase() === 'google') return 'Google'
      if (p.toLowerCase() === 'email') return 'Email'
      return p.charAt(0).toUpperCase() + p.slice(1)
    }
    if (user?.app_metadata?.providers && user.app_metadata.providers.length > 0) {
      const p = user.app_metadata.providers[0]
      return p.charAt(0).toUpperCase() + p.slice(1)
    }
    return 'Email'
  })()

  const userInitials = (fullName || email || 'RA')
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'RA'

  const createdAtFormatted = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Active'

  const lastSignInFormatted = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Active Session'

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setErrorMessage('Full name cannot be empty.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    setSaveSuccess(false)

    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      })

      if (error) {
        setErrorMessage(error.message || 'Unable to update profile name.')
      } else {
        setSaveSuccess(true)
        setIsEditingName(false)
        setTimeout(() => setSaveSuccess(false), 3500)
      }
    } catch {
      setErrorMessage('Network error while updating operator profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setIsUpdatingPassword(true)
    setPasswordError(null)
    setPasswordSuccess(false)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        setPasswordError(error.message || 'Unable to update password.')
      } else {
        setPasswordSuccess(true)
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => {
          setPasswordSuccess(false)
          setShowPasswordModal(false)
        }, 2000)
      }
    } catch {
      setPasswordError('Network error while updating password.')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Sign out error:', err)
      navigate('/login', { replace: true })
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="space-y-6 antialiased text-navy font-sans max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold font-display text-navy tracking-tight">
              Account & Operator Profile
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              AUTHENTICATED
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage your RecoverAI workspace profile identity, credentials, and session governance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-navy rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {isSigningOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
            ) : (
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
            )}
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-2.5 animate-in fade-in duration-200 shadow-2xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Profile display name updated successfully across RecoverAI.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2.5 animate-in fade-in duration-200 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Profile & Security Details */}
      <div className="max-w-4xl space-y-6">
        {/* Main Account Profile Card */}
        <div className="bg-surface border border-border/80 rounded-2xl p-6 shadow-fintech-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/70">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-14 h-14 rounded-2xl object-cover border border-border shadow-xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-xl font-display shadow-fintech-purple ring-4 ring-primary-light">
                  {userInitials}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold font-display text-navy tracking-tight">
                    {fullName || 'Authenticated User'}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    role === 'admin'
                      ? 'bg-primary-light text-primary border-primary-border'
                      : 'bg-slate-100 text-slate-700 border-border'
                  }`}>
                    {roleTag}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {email}
                </p>
              </div>
            </div>

            {!isEditingName && (
              <button
                type="button"
                onClick={() => {
                  setIsEditingName(true)
                  setErrorMessage(null)
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-surface hover:bg-slate-50 border border-border rounded-xl text-xs font-semibold text-navy transition-all shadow-2xs self-start sm:self-auto cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-primary" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          {/* Editable Name Form */}
          {isEditingName && (
            <form onSubmit={handleSaveName} className="p-4 bg-slate-50 border border-border rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-navy">
                  Edit Full Name
                </label>
                <span className="text-[11px] text-slate-500">
                  Updates your operator name across RecoverAI
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isSaving}
                  className="flex-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs text-navy focus:outline-none focus:border-primary shadow-2xs font-semibold"
                  placeholder="e.g. Monish B"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple disabled:opacity-60 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(false)
                    setFullName(user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : ''))
                    setErrorMessage(null)
                  }}
                  className="p-2 text-slate-400 hover:text-navy transition-colors rounded-xl hover:bg-slate-200 cursor-pointer"
                  aria-label="Cancel editing"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* Account Details Structured Key-Value Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Full Name */}
            <div className="p-4 bg-slate-50 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] mb-1 font-semibold">
                <UserIcon className="w-3.5 h-3.5 text-primary" />
                <span>Full Name</span>
              </div>
              <p className="text-xs font-bold text-navy truncate">
                {fullName || 'Not specified'}
              </p>
              <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                Workspace profile identity
              </span>
            </div>

            {/* Email Address */}
            <div className="p-4 bg-slate-50 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] mb-1 font-semibold">
                <Mail className="w-3.5 h-3.5 text-primary" />
                <span>Email Address</span>
              </div>
              <p className="text-xs font-bold font-mono text-navy truncate">
                {email || 'None'}
              </p>
              <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                Primary workspace identity
              </span>
            </div>

            {/* Role */}
            <div className="p-4 bg-slate-50 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] mb-1 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span>Role</span>
              </div>
              <p className="text-xs font-bold text-navy">
                {roleDisplay}
              </p>
              <span className="text-[10px] text-emerald-700 mt-1 block font-bold">
                {role === 'admin' ? '• Full System & Governance Access' : '• Operational Workflow Access'}
              </span>
            </div>

            {/* Authentication Provider */}
            <div className="p-4 bg-slate-50 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] mb-1 font-semibold">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <span>Authentication</span>
              </div>
              <p className="text-xs font-bold font-mono text-navy">
                {authProvider}
              </p>
              <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                Verified Workspace Session
              </span>
            </div>

            {/* Account Created */}
            <div className="p-4 bg-slate-50 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] mb-1 font-semibold">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Account Created</span>
              </div>
              <p className="text-xs font-bold text-navy">
                {createdAtFormatted}
              </p>
              <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                Workspace provisioning date
              </span>
            </div>

            {/* Last Sign In */}
            <div className="p-4 bg-slate-50 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] mb-1 font-semibold">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Last Sign In</span>
              </div>
              <p className="text-xs font-bold text-navy">
                {lastSignInFormatted}
              </p>
              <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                Most recent session activity
              </span>
            </div>
          </div>
        </div>

        {/* Account Security Card */}
        <div className="bg-surface border border-border/80 rounded-2xl p-6 shadow-fintech-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-base font-bold font-display text-navy">
                Account Security & Credentials
              </h3>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              PROTECTED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-border rounded-xl">
              <span className="text-slate-400 block text-[11px] mb-1 font-medium">Auth Provider</span>
              <span className="font-bold text-navy">{authProvider}</span>
            </div>
            <div className="p-3.5 bg-slate-50 border border-border rounded-xl">
              <span className="text-slate-400 block text-[11px] mb-1 font-medium">Session Status</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
            <div className="p-3.5 bg-slate-50 border border-border rounded-xl">
              <span className="text-slate-400 block text-[11px] mb-1 font-medium">Last Sign-In</span>
              <span className="font-bold text-navy truncate block">{lastSignInFormatted}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {authProvider.toLowerCase().includes('email') && (
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface hover:bg-slate-50 border border-border rounded-xl text-xs font-semibold text-navy transition-all shadow-2xs cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-primary" />
                <span>Change Password</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs disabled:opacity-60 cursor-pointer"
            >
              {isSigningOut ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
              ) : (
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
              )}
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface border border-border/80 shadow-2xl rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                <h3 className="text-base font-bold font-display text-navy">
                  Change Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordError(null)
                  setPasswordSuccess(false)
                  setNewPassword('')
                  setConfirmPassword('')
                }}
                className="text-slate-400 hover:text-navy transition-colors p-1 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {passwordSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Password updated successfully!</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={isUpdatingPassword}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs text-navy focus:outline-none focus:border-primary font-mono shadow-2xs"
                  placeholder="••••••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={isUpdatingPassword}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs text-navy focus:outline-none focus:border-primary font-mono shadow-2xs"
                  placeholder="••••••••••••"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/70">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={isUpdatingPassword}
                  className="px-4 py-2 bg-surface hover:bg-slate-50 border border-border rounded-xl text-xs font-semibold text-navy transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple disabled:opacity-60 cursor-pointer"
                >
                  {isUpdatingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Account
