/**
 * RecoverAI - Team Invite Accept Page
 * Landing page for team members accepting a workspace invitation via token link.
 * Route: /invite/:token
 */
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Users, CheckCircle2, Loader2, AlertCircle, LogIn, ArrowRight } from 'lucide-react'
import { workspaceApi } from '../../services/workspaceApi'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'

export const InviteAccept: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { refreshWorkspaces } = useWorkspace()

  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)

  // Auto-accept once user is authenticated
  useEffect(() => {
    if (!token || authLoading || !user || accepted || accepting) return

    const accept = async () => {
      setAccepting(true)
      setError(null)
      try {
        const result = await workspaceApi.acceptInvitation(token)
        setWorkspaceName(result.workspace_name)
        setAccepted(true)
        await refreshWorkspaces()
        setTimeout(() => navigate('/overview', { replace: true }), 2500)
      } catch (err: any) {
        setError(err.message || 'Failed to accept invitation. The link may be expired or already used.')
      } finally {
        setAccepting(false)
      }
    }

    accept()
  }, [token, user, authLoading, accepted, accepting, navigate, refreshWorkspaces])

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 font-sans">
      {/* Brand */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-fintech-purple">
            <Users className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-extrabold text-navy font-display tracking-tight">
            Recover<span className="text-primary">AI</span>
          </span>
        </div>
        <p className="text-sm text-slate-500">Team Workspace Invitation</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-surface rounded-3xl border border-border shadow-fintech-modal p-8 text-center space-y-5">

        {/* Auth loading */}
        {authLoading && (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Verifying your session…</p>
          </>
        )}

        {/* Not logged in */}
        {!authLoading && !user && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto">
              <LogIn className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy font-display">Sign in to Accept</h2>
              <p className="text-xs text-slate-500 mt-1.5">
                You need to be signed in to accept a workspace invitation.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                to={`/login?redirect=/invite/${token}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm transition-all shadow-fintech-purple"
              >
                <LogIn className="w-4 h-4" />
                Sign In to Continue
              </Link>
              <Link
                to={`/signup?redirect=/invite/${token}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-surface-blue border border-surface-blue-border text-primary rounded-xl font-bold text-sm transition-all hover:bg-primary-light"
              >
                Create an Account
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        )}

        {/* Accepting */}
        {!authLoading && user && accepting && (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <div>
              <h2 className="text-lg font-bold text-navy font-display">Accepting Invitation…</h2>
              <p className="text-xs text-slate-500 mt-1">Joining your team workspace.</p>
            </div>
          </>
        )}

        {/* Success */}
        {accepted && workspaceName && (
          <>
            <div className="w-14 h-14 rounded-full bg-moss-green-light flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-moss-green-dark" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy font-display">You're in! 🎉</h2>
              <p className="text-xs text-slate-500 mt-1.5">
                Successfully joined <strong className="text-navy">{workspaceName}</strong>.
                Redirecting to your dashboard…
              </p>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-[width_2.5s_ease-in-out_forwards] w-full" />
            </div>
          </>
        )}

        {/* Error */}
        {!accepting && !accepted && error && (
          <>
            <div className="w-14 h-14 rounded-full bg-brick-red-light flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-brick-red" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy font-display">Invitation Error</h2>
              <p className="text-xs text-brick-red mt-1.5 bg-brick-red-light border border-brick-red/20 rounded-xl px-4 py-3">
                {error}
              </p>
            </div>
            <Link
              to="/overview"
              className="flex items-center justify-center gap-2 w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm transition-all shadow-fintech-purple"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default InviteAccept
