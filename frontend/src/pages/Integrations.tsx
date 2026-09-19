/**
 * RecoverAI - Integrations Page
 * Razorpay Test Mode management: status, connect/disconnect, webhook guidance.
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  ExternalLink,
  Shield,
  Unplug,
  Link2
} from 'lucide-react'
import { workspaceApi, RazorpayIntegrationStatus } from '../services/workspaceApi'
import { useWorkspace } from '../context/WorkspaceContext'
import { SkeletonLoader } from '../components/common/SkeletonLoader'

export const Integrations: React.FC = () => {
  const { activeWorkspace } = useWorkspace()
  const [status, setStatus] = useState<RazorpayIntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Connect form state
  const [showConnectForm, setShowConnectForm] = useState(false)
  const [keyId, setKeyId] = useState('')
  const [keySecret, setKeySecret] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!activeWorkspace) return
    setLoading(true)
    setError(null)
    try {
      const s = await workspaceApi.getRazorpayStatus(activeWorkspace.id)
      setStatus(s)
    } catch (err: any) {
      setError(err.message || 'Failed to load integration status')
    } finally {
      setLoading(false)
    }
  }, [activeWorkspace])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeWorkspace) return
    setConnecting(true)
    setConnectError(null)
    try {
      const s = await workspaceApi.connectRazorpay(activeWorkspace.id, {
        key_id: keyId.trim(),
        key_secret: keySecret.trim(),
        webhook_secret: webhookSecret.trim() || undefined,
      })
      setStatus(s)
      setShowConnectForm(false)
      setKeyId(''); setKeySecret(''); setWebhookSecret('')
    } catch (err: any) {
      setConnectError(err.message || 'Failed to connect Razorpay')
    } finally {
      setConnecting(false)
    }
  }

  const copyWebhookUrl = () => {
    if (!status?.webhook_url) return
    navigator.clipboard.writeText(status.webhook_url).then(() => {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    })
  }

  const statusColor = (s?: string) => {
    if (!s) return 'text-slate-400'
    if (s === 'CONNECTED') return 'text-moss-green-dark'
    if (s === 'ERROR') return 'text-brick-red'
    return 'text-amber-700'
  }

  const statusBg = (s?: string) => {
    if (!s) return 'bg-slate-50 border-slate-200'
    if (s === 'CONNECTED') return 'bg-moss-green-light border-moss-green/30'
    if (s === 'ERROR') return 'bg-brick-red-light border-brick-red/20'
    return 'bg-amber-50 border-amber-200'
  }

  const StatusIcon = status?.status === 'CONNECTED'
    ? CheckCircle2
    : status?.status === 'ERROR'
    ? XCircle
    : AlertCircle

  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        No active workspace selected.
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy tracking-tight font-display">Integrations</h1>
        <p className="text-xs text-slate-500 mt-1">
          Connect your Razorpay Test Mode credentials to enable autonomous payment recovery.
        </p>
      </div>

      {/* Razorpay Card */}
      <div className="bg-surface rounded-2xl border border-border shadow-fintech-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-fintech-purple">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-navy font-display">Razorpay</h2>
              <p className="text-xs text-slate-500">Test Mode — Payment gateway & webhook integration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchStatus}
            className="p-2 rounded-xl text-slate-400 hover:text-navy hover:bg-slate-100 transition-all"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {loading ? (
            <SkeletonLoader variant="row" count={3} />
          ) : error ? (
            <div className="flex items-center gap-2 p-3 bg-brick-red-light border border-brick-red/20 rounded-xl text-xs text-brick-red">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          ) : (
            <>
              {/* Status pill */}
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm ${statusBg(status?.status)}`}>
                <StatusIcon className={`w-4 h-4 ${statusColor(status?.status)}`} />
                <span className={statusColor(status?.status)}>
                  {status?.configured ? `Connected — ${status.status}` : 'Not Connected'}
                </span>
                <span className="ml-2 text-[10px] font-mono px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full">
                  TEST MODE
                </span>
              </div>

              {status?.configured && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-50 rounded-xl p-4 border border-border">
                    <p className="text-slate-500 mb-1">Key ID (masked)</p>
                    <code className="font-mono text-navy font-semibold">{status.public_key_id_masked}</code>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-border">
                    <p className="text-slate-500 mb-1">Webhook</p>
                    <p className={`font-semibold ${status.webhook_configured ? 'text-moss-green-dark' : 'text-amber-700'}`}>
                      {status.webhook_configured ? 'Configured ✓' : 'Not configured'}
                    </p>
                  </div>
                  {status.last_verified_at && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-border">
                      <p className="text-slate-500 mb-1">Last Verified</p>
                      <p className="text-navy font-semibold">
                        {new Date(status.last_verified_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  )}
                  {status.last_error && (
                    <div className="bg-brick-red-light rounded-xl p-4 border border-brick-red/20 col-span-2">
                      <p className="text-slate-500 mb-1">Last Error</p>
                      <p className="text-brick-red text-[11px] font-mono">{status.last_error}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Webhook URL */}
              {status?.webhook_url && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-navy">Webhook URL for Razorpay Dashboard:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] font-mono bg-slate-100 px-3 py-2.5 rounded-xl border border-border text-navy truncate">
                      {status.webhook_url}
                    </code>
                    <button
                      type="button"
                      onClick={copyWebhookUrl}
                      className="p-2.5 rounded-xl bg-white border border-border hover:bg-primary-light text-slate-500 hover:text-primary transition-all"
                      title="Copy"
                    >
                      {copiedUrl ? <Check className="w-4 h-4 text-moss-green-dark" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <a
                    href="https://dashboard.razorpay.com/app/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-primary font-semibold hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open Razorpay Webhook Settings
                  </a>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  id="razorpay-connect-btn"
                  onClick={() => setShowConnectForm(!showConnectForm)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {status?.configured ? 'Update Credentials' : 'Connect Razorpay'}
                </button>
                {status?.configured && (
                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2.5 bg-brick-red-light hover:bg-brick-red/10 text-brick-red border border-brick-red/20 rounded-xl text-xs font-bold transition-all"
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                )}
              </div>
            </>
          )}

          {/* Connect / Update Form */}
          {showConnectForm && (
            <form onSubmit={handleConnect} className="space-y-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2 duration-150">
              <p className="text-xs font-bold text-navy">
                {status?.configured ? 'Update Razorpay Credentials' : 'Connect Razorpay Test Mode'}
              </p>

              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200/60 rounded-xl text-[11px] text-amber-800">
                <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                <span>Only <code className="font-mono">rzp_test_</code> keys are accepted. Live keys are permanently blocked.</span>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5">Test Key ID *</label>
                  <input
                    type="text"
                    value={keyId}
                    onChange={e => setKeyId(e.target.value)}
                    placeholder="rzp_test_xxxxxxxxxxxx"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-xs font-mono text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5">Test Key Secret *</label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={keySecret}
                      onChange={e => setKeySecret(e.target.value)}
                      placeholder="••••••••••••••••••"
                      required
                      className="w-full px-4 py-2.5 pr-10 rounded-xl border border-border bg-slate-50 text-xs font-mono text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                    <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy">
                      {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1.5">Webhook Secret <span className="text-slate-400">(optional)</span></label>
                  <div className="relative">
                    <input
                      type={showWebhookSecret ? 'text' : 'password'}
                      value={webhookSecret}
                      onChange={e => setWebhookSecret(e.target.value)}
                      placeholder="From Razorpay webhook settings"
                      className="w-full px-4 py-2.5 pr-10 rounded-xl border border-border bg-slate-50 text-xs font-mono text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                    <button type="button" onClick={() => setShowWebhookSecret(!showWebhookSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy">
                      {showWebhookSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {connectError && (
                <p className="text-xs text-brick-red bg-brick-red-light px-3 py-2 rounded-xl border border-brick-red/20">{connectError}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowConnectForm(false); setConnectError(null) }}
                  className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connecting || !keyId || !keySecret}
                  id="razorpay-connect-submit"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs transition-all shadow-fintech-purple disabled:opacity-60"
                >
                  {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {connecting ? 'Connecting…' : 'Test & Connect'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Help Card */}
      <div className="bg-surface-blue/60 rounded-2xl border border-surface-blue-border p-6">
        <h3 className="text-sm font-bold text-navy font-display mb-3">Razorpay Test Mode Setup Guide</h3>
        <ol className="space-y-2 text-xs text-slate-600">
          <li className="flex gap-2"><span className="font-bold text-primary shrink-0">1.</span> Go to <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">Razorpay Dashboard → API Keys <ExternalLink className="w-3 h-3" /></a> and switch to <strong>Test Mode</strong></li>
          <li className="flex gap-2"><span className="font-bold text-primary shrink-0">2.</span> Generate a new key pair — copy the Key ID (<code className="font-mono text-[11px] bg-slate-100 px-1 rounded">rzp_test_…</code>) and Key Secret</li>
          <li className="flex gap-2"><span className="font-bold text-primary shrink-0">3.</span> Go to <a href="https://dashboard.razorpay.com/app/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">Webhooks <ExternalLink className="w-3 h-3" /></a>, add the Webhook URL shown above, and copy the Secret</li>
          <li className="flex gap-2"><span className="font-bold text-primary shrink-0">4.</span> Paste both into the form above and click <strong>Test & Connect</strong></li>
        </ol>
      </div>
    </div>
  )
}

export default Integrations
