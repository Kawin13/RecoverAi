/**
 * RecoverAI - Integrations Page
 * Razorpay Test Mode and Resend Transactional Email management:
 * Status, configuration, test dispatch, auto-routing, and delivery logs.
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Mail,
  Send,
  ToggleLeft,
  ToggleRight,
  Inbox
} from 'lucide-react'
import { workspaceApi, RazorpayIntegrationStatus } from '../services/workspaceApi'
import {
  emailManagementApi,
  EmailStatusData,
  EmailMessageItem
} from '../services/emailManagementApi'
import { useWorkspace } from '../context/WorkspaceContext'
import { SkeletonLoader } from '../components/common/SkeletonLoader'
import { formatTimeAgo } from '../lib/utils'

export const Integrations: React.FC = () => {
  const { activeWorkspace } = useWorkspace()
  
  // Razorpay state
  const [status, setStatus] = useState<RazorpayIntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConnectForm, setShowConnectForm] = useState(false)
  const [keyId, setKeyId] = useState('')
  const [keySecret, setKeySecret] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)

  // Resend Email Management state
  const [emailStatus, setEmailStatus] = useState<EmailStatusData | null>(null)
  const [emailLoading, setEmailLoading] = useState(true)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [togglingEmail, setTogglingEmail] = useState(false)

  // Test Email Modal state
  const [showTestModal, setShowTestModal] = useState(false)
  const [testRecipient, setTestRecipient] = useState('')
  const [testCustomerName, setTestCustomerName] = useState('Aditya Sharma')
  const [testAmount, setTestAmount] = useState(4999)
  const [testTemplate, setTestTemplate] = useState('PAYMENT_LINK')
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; providerId?: string } | null>(null)

  // Email Delivery History state
  const [historyItems, setHistoryItems] = useState<EmailMessageItem[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('ALL')

  // Fetch Razorpay Status
  const fetchRazorpayStatus = useCallback(async () => {
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

  // Fetch Email Status
  const fetchEmailStatus = useCallback(async () => {
    setEmailLoading(true)
    setEmailError(null)
    try {
      const s = await emailManagementApi.getStatus()
      setEmailStatus(s)
      if (s.primary_test_recipient && !testRecipient) {
        setTestRecipient(s.primary_test_recipient)
      }
    } catch (err: any) {
      setEmailError(err.message || 'Failed to load email service status')
    } finally {
      setEmailLoading(false)
    }
  }, [testRecipient])

  // Fetch Email History
  const fetchEmailHistory = useCallback(async (filter = historyFilter) => {
    setHistoryLoading(true)
    try {
      const res = await emailManagementApi.getHistory(20, 0, filter)
      setHistoryItems(res.items || [])
      setHistoryTotal(res.total || 0)
    } catch (err: any) {
      console.error('Failed to load email history', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [historyFilter])

  useEffect(() => {
    fetchRazorpayStatus()
    fetchEmailStatus()
    fetchEmailHistory()
  }, [fetchRazorpayStatus, fetchEmailStatus, fetchEmailHistory])

  // Razorpay connect handler
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

  // Toggle email recovery
  const handleToggleEmailEnabled = async () => {
    if (!emailStatus) return
    const newState = !emailStatus.workspace_email_enabled
    setTogglingEmail(true)
    try {
      await emailManagementApi.updateSettings({ email_enabled: newState })
      setEmailStatus({ ...emailStatus, workspace_email_enabled: newState, effective_email_enabled: newState })
    } catch (err: any) {
      alert('Failed to update email setting: ' + err.message)
    } finally {
      setTogglingEmail(false)
    }
  }

  // Send test email
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setSendingTest(true)
    setTestResult(null)
    try {
      const res = await emailManagementApi.sendTestEmail({
        recipient: testRecipient.trim(),
        customer_name: testCustomerName.trim(),
        amount: Number(testAmount),
        template_type: testTemplate
      })

      setTestResult({
        success: res.success,
        message: res.success
          ? `Dispatched successfully! Provider ID: ${res.provider_message_id || 'N/A'}`
          : `Delivery blocked or failed: ${res.error_message || res.error_code || 'Unknown notice'}`,
        providerId: res.provider_message_id || undefined
      })

      fetchEmailStatus()
      fetchEmailHistory()
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to send test email'
      })
    } finally {
      setSendingTest(false)
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
    if (s === 'CONNECTED' || s === 'SENT' || s === 'DELIVERED') return 'text-moss-green-dark'
    if (s === 'ERROR' || s === 'FAILED' || s === 'BOUNCED') return 'text-brick-red'
    return 'text-amber-700'
  }

  const statusBg = (s?: string) => {
    if (!s) return 'bg-slate-50 border-slate-200'
    if (s === 'CONNECTED' || s === 'SENT' || s === 'DELIVERED') return 'bg-moss-green-light border-moss-green/30'
    if (s === 'ERROR' || s === 'FAILED' || s === 'BOUNCED') return 'bg-brick-red-light border-brick-red/20'
    return 'bg-amber-50 border-amber-200'
  }

  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        No active workspace selected.
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl pb-16">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy tracking-tight font-display">Workspace Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage payment gateway configurations, email channels, and integration credentials for your workspace.
        </p>
      </div>

      {/* 1. Resend Transactional Email Card */}
      <div className="bg-surface rounded-2xl border border-border shadow-fintech-card overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-r from-surface to-surface-blue/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-fintech-purple">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-navy font-display">Resend Email Delivery</h2>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  emailStatus?.configured ? 'bg-moss-green-light text-moss-green-dark border-moss-green/30' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${emailStatus?.configured ? 'bg-moss-green' : 'bg-amber-500'}`} />
                  {emailStatus?.configured ? 'Active (Resend REST API)' : 'Not Configured'}
                </span>
                {emailStatus?.test_mode && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    Test Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Transactional recovery dunning with 1-click links and guardrail policy enforcement.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { fetchEmailStatus(); fetchEmailHistory(); }}
              className="p-2 rounded-xl text-slate-400 hover:text-navy hover:bg-slate-100 transition-all"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${emailLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowTestModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Send Test Email
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-6">
          {emailLoading ? (
            <div className="space-y-3">
              <SkeletonLoader variant="row" count={2} />
            </div>
          ) : emailError ? (
            <p className="text-xs text-brick-red bg-brick-red-light p-3 rounded-xl border border-brick-red/20">{emailError}</p>
          ) : emailStatus ? (
            <>
              {/* Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border bg-slate-50/70 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Verified Sender</span>
                  <p className="text-xs font-mono font-bold text-navy truncate">{emailStatus.from_address}</p>
                  <p className="text-[11px] text-slate-500">Default onboarding domain via Resend</p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-slate-50/70 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">API Authentication</span>
                  <p className="text-xs font-mono font-bold text-navy">{emailStatus.masked_api_key || 'Configured via Environment'}</p>
                  <p className="text-[11px] text-moss-green-dark flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Encrypted & Hidden
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-slate-50/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Allowed Test Recipient</span>
                    {emailStatus.auto_redirect_demo && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        Auto-Redirect Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono font-bold text-navy truncate">
                    {emailStatus.primary_test_recipient || 'None configured'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Demo personas in checkout will automatically route to this verified inbox.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-slate-50/70 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Policy Guardrails</span>
                  <p className="text-xs font-semibold text-navy">
                    Quiet Hours: {emailStatus.quiet_hours_enabled ? emailStatus.quiet_hours_window : 'Disabled'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Cooldown: {emailStatus.cooldown_minutes}m • Max attempts: {emailStatus.max_emails_per_recovery}
                  </p>
                </div>
              </div>

              {/* Master Email Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5">
                <div>
                  <h4 className="text-xs font-bold text-navy">Autonomous Email Recovery Interventions</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    When active, RecoverAI dispatches recovery emails automatically when payments fail or carts abandon.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={togglingEmail}
                  onClick={handleToggleEmailEnabled}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-80 transition-all disabled:opacity-50"
                >
                  {togglingEmail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : emailStatus.workspace_email_enabled ? (
                    <ToggleRight className="w-7 h-7 text-primary" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-slate-300" />
                  )}
                  <span>{emailStatus.workspace_email_enabled ? 'Enabled' : 'Paused'}</span>
                </button>
              </div>

              {/* 24-hr Stats Banner */}
              <div className="grid grid-cols-4 gap-2 pt-1 border-t border-border/60">
                <div className="text-center p-2 rounded-lg bg-slate-50">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total (24h)</span>
                  <p className="text-base font-bold text-navy">{emailStatus.stats_24h.total}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-moss-green-light/40">
                  <span className="text-[10px] text-moss-green-dark uppercase font-semibold">Sent</span>
                  <p className="text-base font-bold text-moss-green-dark">{emailStatus.stats_24h.sent}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-emerald-50">
                  <span className="text-[10px] text-emerald-700 uppercase font-semibold">Delivered</span>
                  <p className="text-base font-bold text-emerald-700">{emailStatus.stats_24h.delivered}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-amber-50">
                  <span className="text-[10px] text-amber-700 uppercase font-semibold">Blocked</span>
                  <p className="text-base font-bold text-amber-700">{emailStatus.stats_24h.blocked}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Recent Message History Table */}
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-6 py-3 bg-slate-50/80 border-b border-border">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">Email Delivery Activity</h3>
              <span className="text-[11px] text-slate-400">({historyTotal} total)</span>
            </div>
            {/* Filter Chips */}
            <div className="flex items-center gap-1">
              {['ALL', 'SENT', 'DELIVERED', 'BLOCKED', 'BOUNCED'].map(f => (
                <button
                  key={f}
                  onClick={() => { setHistoryFilter(f); fetchEmailHistory(f); }}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all ${
                    historyFilter === f ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-200/60'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-border/60 max-h-72 overflow-y-auto">
            {historyLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading activity…</div>
            ) : historyItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No email records found.</div>
            ) : (
              historyItems.map(item => (
                <div key={item.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50/60 transition-all text-xs">
                  <div className="space-y-0.5 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy truncate max-w-[220px]">{item.recipient}</span>
                      {item.metadata?.was_redirected && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded font-mono">
                          → {item.metadata.actual_dispatch_to}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400">[{item.template_type || 'RECOVERY'}]</span>
                    </div>
                    <p className="text-slate-500 truncate max-w-sm text-[11px]">{item.subject}</p>
                    {item.error_message && (
                      <p className="text-[10px] text-brick-red truncate">{item.error_message}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBg(item.status)} ${statusColor(item.status)}`}>
                      {item.status}
                    </span>
                    <p className="text-[10px] text-slate-400">{formatTimeAgo(item.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 2. Razorpay Card */}
      <div className="bg-surface rounded-2xl border border-border shadow-fintech-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-fintech-purple">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-navy font-display">Razorpay Gateway</h2>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBg(status?.status)} ${statusColor(status?.status)}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {status?.status || 'Loading…'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Test Mode Only
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Primary payment gateway for payment intent & webhook handling.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchRazorpayStatus}
            className="p-2 rounded-xl text-slate-400 hover:text-navy hover:bg-slate-100 transition-all"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="space-y-3">
              <SkeletonLoader variant="row" count={2} />
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-brick-red-light border border-brick-red/20 text-brick-red text-xs">{error}</div>
          ) : status ? (
            <>
              {/* Credentials overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border bg-slate-50/60 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Key ID</span>
                  <p className="text-xs font-mono font-bold text-navy">{status.public_key_id_masked || 'Not configured'}</p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-slate-50/60 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Webhook Signature</span>
                  <p className="text-xs font-semibold text-navy flex items-center gap-1.5">
                    {status.webhook_configured ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-moss-green-dark" /> Secret Configured</>
                    ) : (
                      <><AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Not Configured</>
                    )}
                  </p>
                </div>
              </div>

              {/* Webhook URL copy box */}
              {status.webhook_url && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-navy">Webhook Endpoint URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={status.webhook_url}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-slate-50 text-xs font-mono text-slate-600 select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={copyWebhookUrl}
                      className="px-3.5 py-2.5 rounded-xl border border-border bg-surface hover:bg-slate-50 text-xs font-semibold text-navy flex items-center gap-1.5 transition-all shrink-0"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5 text-moss-green-dark" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedUrl ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Connect / Update Keys Toggle Form */}
              <div className="pt-2">
                {!showConnectForm ? (
                  <button
                    type="button"
                    onClick={() => setShowConnectForm(true)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-navy rounded-xl text-xs font-bold transition-all"
                  >
                    {status.configured ? 'Update Test Keys' : 'Connect Razorpay Test Mode'}
                  </button>
                ) : (
                  <form onSubmit={handleConnect} className="space-y-4 pt-3 border-t border-border">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-navy mb-1">Key ID (rzp_test_...)</label>
                        <input
                          type="text"
                          required
                          value={keyId}
                          onChange={e => setKeyId(e.target.value)}
                          placeholder="rzp_test_..."
                          className="w-full px-4 py-2 rounded-xl border border-border bg-slate-50 text-xs font-mono text-navy focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-navy mb-1">Key Secret</label>
                        <div className="relative">
                          <input
                            type={showSecret ? 'text' : 'password'}
                            required
                            value={keySecret}
                            onChange={e => setKeySecret(e.target.value)}
                            className="w-full px-4 py-2 pr-10 rounded-xl border border-border bg-slate-50 text-xs font-mono text-navy focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                            {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-navy mb-1">Webhook Secret (Optional)</label>
                        <div className="relative">
                          <input
                            type={showWebhookSecret ? 'text' : 'password'}
                            value={webhookSecret}
                            onChange={e => setWebhookSecret(e.target.value)}
                            className="w-full px-4 py-2 pr-10 rounded-xl border border-border bg-slate-50 text-xs font-mono text-navy focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <button type="button" onClick={() => setShowWebhookSecret(!showWebhookSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                            {showWebhookSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    {connectError && (
                      <p className="text-xs text-brick-red bg-brick-red-light p-2.5 rounded-xl border border-brick-red/20">{connectError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowConnectForm(false)}
                        className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={connecting || !keyId || !keySecret}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      >
                        {connecting ? 'Connecting…' : 'Save & Verify'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy font-display">Send Diagnostic Test Email</h3>
                  <p className="text-[11px] text-slate-400">Triggers live recovery template via Resend API</p>
                </div>
              </div>
              <button
                onClick={() => { setShowTestModal(false); setTestResult(null); }}
                className="text-slate-400 hover:text-navy text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Destination Recipient</label>
                <input
                  type="email"
                  required
                  value={testRecipient}
                  onChange={e => setTestRecipient(e.target.value)}
                  placeholder="e.g. kawindharma@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 text-xs font-mono text-navy focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-slate-400 mt-1">Must be in EMAIL_TEST_RECIPIENTS allowlist while in test mode.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={testCustomerName}
                    onChange={e => setTestCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-slate-50 text-xs text-navy focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy mb-1">Amount (INR)</label>
                  <input
                    type="number"
                    value={testAmount}
                    onChange={e => setTestAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-slate-50 text-xs text-navy focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy mb-1">Recovery Template</label>
                <select
                  value={testTemplate}
                  onChange={e => setTestTemplate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-slate-50 text-xs text-navy focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="PAYMENT_LINK">Payment Link (Immediate Retry)</option>
                  <option value="CART_ABANDONMENT">Cart Abandonment (Recover Reserved Items)</option>
                  <option value="PERSONALIZED_REMINDER">Personalized Reminder (Friendly Dunning)</option>
                </select>
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl border text-xs ${
                  testResult.success
                    ? 'bg-moss-green-light border-moss-green/30 text-moss-green-dark'
                    : 'bg-brick-red-light border-brick-red/20 text-brick-red'
                }`}>
                  <p className="font-semibold">{testResult.message}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowTestModal(false); setTestResult(null); }}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={sendingTest || !testRecipient}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple flex items-center gap-1.5 disabled:opacity-50"
                >
                  {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sendingTest ? 'Dispatching…' : 'Send Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Integrations
