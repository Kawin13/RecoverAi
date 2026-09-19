/**
 * RecoverAI - Multi-Step Merchant Onboarding
 * Step 1: Workspace name & business info
 * Step 2: Razorpay Test Mode credentials
 * Step 3: Recovery guardrail thresholds
 * On completion → navigates to /overview
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Zap,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react'
import { useWorkspace } from '../context/WorkspaceContext'
import { workspaceApi } from '../services/workspaceApi'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Step1Data {
  workspaceName: string
  businessType: string
  timezone: string
}

interface Step2Data {
  keyId: string
  keySecret: string
  webhookSecret: string
}

interface Step3Data {
  humanApprovalThreshold: number
  urgentValueThreshold: number
  maxRecoveryAttempts: number
  cooldownMinutes: number
  maximumDiscountPercent: number
  allowedStrategies: string[]
}

const BUSINESS_TYPES = [
  { value: 'ecommerce', label: 'E-Commerce', icon: '🛒' },
  { value: 'saas', label: 'SaaS', icon: '💻' },
  { value: 'd2c', label: 'D2C Brand', icon: '🏷️' },
  { value: 'marketplace', label: 'Marketplace', icon: '🏪' },
  { value: 'fintech', label: 'Fintech', icon: '💳' },
  { value: 'other', label: 'Other', icon: '🏢' },
]

const ALL_STRATEGIES = [
  { key: 'SMART_PAYLINK_1CLICK', label: 'Smart Paylink (1-Click)' },
  { key: 'UPI_SWITCH', label: 'UPI Method Switch' },
  { key: 'TIMED_SMART_RETRY', label: 'Timed Smart Retry' },
  { key: 'PERSONALIZED_REMINDER', label: 'Personalized Reminder' },
  { key: 'WHATSAPP_CONCIERGE', label: 'WhatsApp Concierge' },
]

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Workspace', icon: Building2 },
  { label: 'Razorpay', icon: Zap },
  { label: 'Guardrails', icon: ShieldCheck },
]

// ─── Component ────────────────────────────────────────────────────────────────

export const Onboarding: React.FC = () => {
  const navigate = useNavigate()
  const { createWorkspace, refreshWorkspaces } = useWorkspace()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(null)
  const [testingRazorpay, setTestingRazorpay] = useState(false)
  const [razorpayTestResult, setRazorpayTestResult] = useState<'success' | 'error' | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState(false)
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false)

  const [step1, setStep1] = useState<Step1Data>({
    workspaceName: '',
    businessType: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  })

  const [step2, setStep2] = useState<Step2Data>({
    keyId: '',
    keySecret: '',
    webhookSecret: '',
  })

  const [step3, setStep3] = useState<Step3Data>({
    humanApprovalThreshold: 25000,
    urgentValueThreshold: 15000,
    maxRecoveryAttempts: 3,
    cooldownMinutes: 30,
    maximumDiscountPercent: 10,
    allowedStrategies: ALL_STRATEGIES.map(s => s.key),
  })

  // Derived webhook URL (shown after workspace creation in step 2)
  const webhookUrl = createdWorkspaceId
    ? `${window.location.origin.replace('3000', '8000')}/api/v1/webhooks/razorpay/${createdWorkspaceId}`
    : ''

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopiedWebhookUrl(true)
      setTimeout(() => setCopiedWebhookUrl(false), 2000)
    })
  }

  // ─── Step 1 Submit: Create Workspace ─────────────────────────────────────────
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!step1.workspaceName.trim()) return
    setSubmitting(true)
    setGlobalError(null)
    try {
      const ws = await createWorkspace(step1.workspaceName.trim(), step1.businessType || undefined)
      setCreatedWorkspaceId(ws.id)
      setStep(1)
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to create workspace')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Step 2: Test Razorpay credentials ───────────────────────────────────────
  const handleTestRazorpay = async () => {
    if (!createdWorkspaceId || !step2.keyId || !step2.keySecret) return
    setTestingRazorpay(true)
    setRazorpayTestResult(null)
    try {
      await workspaceApi.connectRazorpay(createdWorkspaceId, {
        key_id: step2.keyId.trim(),
        key_secret: step2.keySecret.trim(),
        webhook_secret: step2.webhookSecret.trim() || undefined,
      })
      setRazorpayTestResult('success')
    } catch (err: any) {
      setRazorpayTestResult('error')
      setGlobalError(err.message || 'Connection test failed')
    } finally {
      setTestingRazorpay(false)
    }
  }

  const handleStep2Next = () => {
    setGlobalError(null)
    setStep(2)
  }

  // ─── Step 3 Submit: Save guardrails + complete ────────────────────────────────
  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createdWorkspaceId) return
    setSubmitting(true)
    setGlobalError(null)
    try {
      await workspaceApi.updateSettings(createdWorkspaceId, {
        human_approval_threshold: step3.humanApprovalThreshold,
        urgent_value_threshold: step3.urgentValueThreshold,
        max_recovery_attempts: step3.maxRecoveryAttempts,
        cooldown_minutes: step3.cooldownMinutes,
        maximum_discount_percent: step3.maximumDiscountPercent,
        allowed_strategies: step3.allowedStrategies,
        quiet_hours_enabled: true,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
      })
      await refreshWorkspaces()
      navigate('/overview', { replace: true })
    } catch (err: any) {
      // Guardrails save failed — still let them through to overview
      console.warn('[Onboarding] Guardrails save failed (non-fatal):', err)
      await refreshWorkspaces()
      navigate('/overview', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStrategy = (key: string) => {
    setStep3(prev => ({
      ...prev,
      allowedStrategies: prev.allowedStrategies.includes(key)
        ? prev.allowedStrategies.filter(k => k !== key)
        : [...prev.allowedStrategies, key],
    }))
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 font-sans">
      {/* Brand */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-fintech-purple">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-extrabold text-navy font-display tracking-tight">
            Recover<span className="text-primary">AI</span>
          </span>
        </div>
        <p className="text-sm text-slate-500">Set up your merchant workspace in 3 quick steps</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isActive = i === step
          const isDone = i < step
          return (
            <React.Fragment key={s.label}>
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isDone
                    ? 'bg-moss-green text-white'
                    : isActive
                    ? 'bg-primary text-white shadow-fintech-purple'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                  isActive ? 'text-primary' : isDone ? 'text-moss-green-dark' : 'text-slate-400'
                }`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-16 h-0.5 mb-5 mx-1 transition-all ${i < step ? 'bg-moss-green' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-surface rounded-3xl border border-border shadow-fintech-modal">

        {/* ── STEP 1: Workspace Info ─────────────────────────────── */}
        {step === 0 && (
          <form onSubmit={handleStep1Submit} className="p-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-navy font-display">Create Your Workspace</h2>
              <p className="text-xs text-slate-500 mt-1">Your workspace is your isolated merchant environment.</p>
            </div>

            <div>
              <label htmlFor="ws-name" className="block text-xs font-semibold text-navy mb-1.5">
                Workspace Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="ws-name"
                type="text"
                value={step1.workspaceName}
                onChange={e => setStep1(p => ({ ...p, workspaceName: e.target.value }))}
                placeholder="e.g. Zenith Commerce India"
                maxLength={100}
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-border bg-slate-50 text-sm text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1">Usually your brand or company name</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-2">Business Type</label>
              <div className="grid grid-cols-3 gap-2">
                {BUSINESS_TYPES.map(bt => (
                  <button
                    key={bt.value}
                    type="button"
                    onClick={() => setStep1(p => ({ ...p, businessType: bt.value === p.businessType ? '' : bt.value }))}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center text-[11px] font-medium transition-all ${
                      step1.businessType === bt.value
                        ? 'bg-primary text-white border-primary shadow-fintech-purple'
                        : 'bg-slate-50 text-slate-600 border-border hover:border-primary/40 hover:bg-primary-light'
                    }`}
                  >
                    <span className="text-base">{bt.icon}</span>
                    <span>{bt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {globalError && (
              <p className="text-xs text-brick-red bg-brick-red-light px-3 py-2 rounded-xl border border-brick-red/20">{globalError}</p>
            )}

            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200/60 rounded-xl text-[11px] text-amber-800">
              <Zap className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
              <span>RecoverAI runs exclusively in <strong>Razorpay Test Mode</strong>. You'll connect sandbox credentials in the next step.</span>
            </div>

            <button
              type="submit"
              disabled={submitting || !step1.workspaceName.trim()}
              id="onboarding-step1-submit"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm transition-all shadow-fintech-purple disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? 'Creating…' : 'Create Workspace & Continue'}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        {/* ── STEP 2: Razorpay Test Mode ────────────────────────── */}
        {step === 1 && (
          <div className="p-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-navy font-display">Connect Razorpay Test Mode</h2>
              <p className="text-xs text-slate-500 mt-1">
                Use your Razorpay Test API credentials. Live mode keys are permanently blocked.
              </p>
            </div>

            {/* Key ID */}
            <div>
              <label htmlFor="rzp-key-id" className="block text-xs font-semibold text-navy mb-1.5">
                Test Key ID <span className="text-rose-500">*</span>
              </label>
              <input
                id="rzp-key-id"
                type="text"
                value={step2.keyId}
                onChange={e => { setStep2(p => ({ ...p, keyId: e.target.value })); setRazorpayTestResult(null) }}
                placeholder="rzp_test_xxxxxxxxxxxx"
                className="w-full px-4 py-3 rounded-xl border border-border bg-slate-50 text-sm font-mono text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>

            {/* Key Secret */}
            <div>
              <label htmlFor="rzp-key-secret" className="block text-xs font-semibold text-navy mb-1.5">
                Test Key Secret <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="rzp-key-secret"
                  type={showSecret ? 'text' : 'password'}
                  value={step2.keySecret}
                  onChange={e => { setStep2(p => ({ ...p, keySecret: e.target.value })); setRazorpayTestResult(null) }}
                  placeholder="••••••••••••••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-border bg-slate-50 text-sm font-mono text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy transition-colors"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Webhook URL + Secret */}
            {createdWorkspaceId && (
              <div className="space-y-3 p-4 bg-surface-blue/60 border border-surface-blue-border rounded-xl">
                <p className="text-[11px] font-bold text-navy uppercase tracking-wide">Webhook Configuration</p>
                <div>
                  <p className="text-[11px] text-slate-500 mb-1.5">Add this URL in your Razorpay Dashboard → Webhooks:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] font-mono bg-slate-100 px-3 py-2 rounded-xl text-navy border border-border truncate">
                      {webhookUrl}
                    </code>
                    <button
                      type="button"
                      onClick={copyWebhookUrl}
                      className="p-2 rounded-xl bg-white border border-border hover:bg-primary-light text-slate-500 hover:text-primary transition-all"
                      title="Copy webhook URL"
                    >
                      {copiedWebhookUrl ? <Check className="w-3.5 h-3.5 text-moss-green-dark" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="rzp-webhook-secret" className="block text-[11px] font-semibold text-navy mb-1.5">
                    Webhook Secret <span className="text-slate-400">(recommended)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="rzp-webhook-secret"
                      type={showWebhookSecret ? 'text' : 'password'}
                      value={step2.webhookSecret}
                      onChange={e => setStep2(p => ({ ...p, webhookSecret: e.target.value }))}
                      placeholder="From Razorpay Webhook settings"
                      className="w-full px-4 py-2.5 pr-11 rounded-xl border border-border bg-white text-xs font-mono text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                    <button type="button" onClick={() => setShowWebhookSecret(!showWebhookSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy transition-colors">
                      {showWebhookSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <a
                  href="https://dashboard.razorpay.com/app/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] text-primary font-semibold hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open Razorpay Webhooks Dashboard
                </a>
              </div>
            )}

            {/* Test result feedback */}
            {razorpayTestResult === 'success' && (
              <div className="flex items-center gap-2 p-3 bg-moss-green-light border border-moss-green/30 rounded-xl text-xs text-moss-green-dark font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Razorpay Test Mode connected successfully!
              </div>
            )}
            {razorpayTestResult === 'error' && globalError && (
              <p className="text-xs text-brick-red bg-brick-red-light px-3 py-2 rounded-xl border border-brick-red/20">{globalError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="px-4 py-3 rounded-xl border border-border text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              <button
                type="button"
                id="razorpay-test-connection"
                onClick={handleTestRazorpay}
                disabled={testingRazorpay || !step2.keyId || !step2.keySecret || !createdWorkspaceId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-surface-blue border border-surface-blue-border text-primary rounded-xl font-bold text-xs transition-all hover:bg-primary-light disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {testingRazorpay ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {testingRazorpay ? 'Testing…' : 'Test Connection'}
              </button>

              <button
                type="button"
                id="onboarding-step2-next"
                onClick={handleStep2Next}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs transition-all shadow-fintech-purple"
              >
                {razorpayTestResult === 'success' ? 'Continue' : 'Skip for Now'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Guardrails ────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleStep3Submit} className="p-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-navy font-display">Recovery Guardrails</h2>
              <p className="text-xs text-slate-500 mt-1">Control when the AI autonomously acts vs. when it asks for human approval.</p>
            </div>

            {/* Thresholds */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">Human Approval Threshold (₹)</label>
                <input
                  type="number"
                  value={step3.humanApprovalThreshold}
                  onChange={e => setStep3(p => ({ ...p, humanApprovalThreshold: Number(e.target.value) }))}
                  min={0}
                  step={1000}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-slate-50 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
                <p className="text-[10px] text-slate-400 mt-1">Amounts above this need your approval</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">Urgent Value Threshold (₹)</label>
                <input
                  type="number"
                  value={step3.urgentValueThreshold}
                  onChange={e => setStep3(p => ({ ...p, urgentValueThreshold: Number(e.target.value) }))}
                  min={0}
                  step={1000}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-slate-50 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
                <p className="text-[10px] text-slate-400 mt-1">Triggers high-priority escalation</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">Max Recovery Attempts</label>
                <input
                  type="number"
                  value={step3.maxRecoveryAttempts}
                  onChange={e => setStep3(p => ({ ...p, maxRecoveryAttempts: Number(e.target.value) }))}
                  min={1} max={10}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-slate-50 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-1.5">Max Discount Allowed (%)</label>
                <input
                  type="number"
                  value={step3.maximumDiscountPercent}
                  onChange={e => setStep3(p => ({ ...p, maximumDiscountPercent: Number(e.target.value) }))}
                  min={0} max={50}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-slate-50 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Strategies */}
            <div>
              <label className="block text-xs font-semibold text-navy mb-2">Allowed Recovery Strategies</label>
              <div className="space-y-2">
                {ALL_STRATEGIES.map(s => (
                  <label key={s.key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    step3.allowedStrategies.includes(s.key)
                      ? 'bg-primary-light border-primary-border text-primary'
                      : 'bg-slate-50 border-border text-slate-600 hover:border-primary/30'
                  }`}>
                    <input
                      type="checkbox"
                      checked={step3.allowedStrategies.includes(s.key)}
                      onChange={() => toggleStrategy(s.key)}
                      className="accent-primary w-3.5 h-3.5"
                    />
                    <span className="text-xs font-medium">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {globalError && (
              <p className="text-xs text-brick-red bg-brick-red-light px-3 py-2 rounded-xl border border-brick-red/20">{globalError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 rounded-xl border border-border text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                id="onboarding-step3-submit"
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm transition-all shadow-fintech-purple disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {submitting ? 'Finalising…' : 'Launch Dashboard'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer */}
      <p className="mt-6 text-[11px] text-slate-400 text-center">
        You can update all these settings later from <strong>Workspace → Integrations & Guardrails</strong>.
      </p>
    </div>
  )
}

export default Onboarding
