import React, { useState, useEffect, useCallback } from 'react'
import {
  WorkflowCase,
  NotificationReceiptItem,
  api
} from '../services/api'
import { SectionHeader } from '../components/common/SectionHeader'
import { MetricCard } from '../components/common/MetricCard'
import { useRealtime } from '../lib/useRealtime'
import { formatTimeAgo, formatINR, isTerminalState } from '../lib/utils'
import { ENV } from '../config/env'
import {
  Bot,
  Play,
  FastForward,
  CheckCircle2,
  Clock,
  Sparkles,
  Link as LinkIcon,
  MessageSquare,
  Send,
  Smartphone,
  Mail,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Layers,
  AlertOctagon
} from 'lucide-react'

const STATE_STEPS = [
  { id: 'DETECTED', label: '1. Detected', desc: 'Failure ingested' },
  { id: 'ANALYZED', label: '2. Analyzed', desc: 'ML & diagnosis' },
  { id: 'STRATEGY_SELECTED', label: '3. Strategy', desc: 'Optimal ERV' },
  { id: 'GUARDRAIL_CHECKED', label: '4. Guardrails', desc: 'Safety checks' },
  { id: 'ACTION_SCHEDULED', label: '5. Scheduled', desc: 'Channel queued' },
  { id: 'ACTION_EXECUTED', label: '6. Executed', desc: 'Dispatched' },
  { id: 'WAITING_FOR_CUSTOMER', label: '7. Customer Wait', desc: 'Awaiting action' },
  { id: 'RECOVERED', label: '8. Recovered', desc: 'Revenue secured' }
]

const maskRecipient = (val: string): string => {
  if (!val) return ''
  if (val.includes('@')) {
    const [user, domain] = val.split('@')
    if (user.length <= 2) return `${user[0]}***@${domain}`
    return `${user[0]}***${user[user.length - 1]}@${domain}`
  }
  if (val.length > 5) {
    return `${val.slice(0, 3)}****${val.slice(-2)}`
  }
  return val
}

const getBadgeStyle = (status: string, label: string): string => {
  const s = (status || '').toUpperCase()
  const l = (label || '').toUpperCase()
  if (s === 'DELIVERED') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  if (s === 'SENT') {
    return 'bg-blue-50 text-blue-700 border-blue-200'
  }
  if (s === 'BOUNCED' || s === 'FAILED') {
    return 'bg-rose-50 text-rose-700 border-rose-200'
  }
  if (s === 'BLOCKED' || l === 'BLOCKED_TEST_RECIPIENT') {
    return 'bg-amber-50 text-amber-800 border-amber-200'
  }
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

const getBadgeLabel = (status: string, label: string): string => {
  const s = (status || '').toUpperCase()
  const l = (label || '').toUpperCase()
  if (l === 'BLOCKED_TEST_RECIPIENT' || s === 'BLOCKED') {
    return 'RESTRICTED RECIPIENT'
  }
  if (s === 'DELIVERED') {
    return 'DELIVERED (WEBHOOK)'
  }
  if (s === 'SENT') {
    return 'RESEND EMAIL (SENT)'
  }
  if (s === 'BOUNCED') {
    return 'BOUNCED'
  }
  if (s === 'FAILED') {
    return 'FAILED'
  }
  return label || status || 'PROCESSED'
}

export const RecoveryAgent: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowCase[]>([])
  const [notifications, setNotifications] = useState<NotificationReceiptItem[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isActionBusy, setIsActionBusy] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null)
  const { subscribe } = useRealtime()

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const [wfRes, notifRes] = await Promise.all([
        api.getWorkflows(50),
        api.getNotifications(undefined, 20)
      ])
      setWorkflows(wfRes.workflows || [])
      setNotifications(notifRes || [])
      if (!selectedCaseId && wfRes.workflows && wfRes.workflows.length > 0) {
        setSelectedCaseId(wfRes.workflows[0].id)
      }
    } catch (err) {
      console.warn('Failed to load live recovery agent data:', err)
      setError('Recovery agent workflows temporarily unavailable. Please verify the backend service connection.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedCaseId])

  useEffect(() => {
    loadData()

    // Listen to targeted real-time events (no wildcard storms)
    const unsubTransition = subscribe('RECOVERY_AGENT_TRANSITION', () => {
      loadData()
    })
    const unsubNotif = subscribe('NOTIFICATION_DISPATCHED', () => {
      loadData()
    })
    const unsubCase = subscribe('RECOVERY_CASE_UPDATED', () => {
      loadData()
    })
    const unsubQueue = subscribe('RECOVERY_QUEUE_UPDATED', () => {
      loadData()
    })
    const unsubPayment = subscribe('PAYMENT_RECEIVED', () => {
      loadData()
    })
    const unsubEmail = subscribe('EMAIL_STATUS_CHANGED', () => {
      loadData()
    })
    const unsubResync = subscribe('RECONNECT_RESYNC', () => {
      loadData()
    })

    return () => {
      unsubTransition()
      unsubNotif()
      unsubCase()
      unsubQueue()
      unsubPayment()
      unsubEmail()
      unsubResync()
    }
  }, [loadData, subscribe])

  const handleAdvanceStep = async (caseId: string) => {
    setIsActionBusy(caseId)
    try {
      await api.advanceWorkflowStep(caseId, true)
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to advance workflow step')
    } finally {
      setIsActionBusy(null)
    }
  }

  const handleExecuteFull = async (caseId: string) => {
    setIsActionBusy(caseId)
    try {
      await api.executeWorkflow(caseId, true)
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to execute pipeline')
    } finally {
      setIsActionBusy(null)
    }
  }

  const handleOpenPaymentLink = (url?: string) => {
    if (!url) {
      alert('Payment Link creation failed: No link URL provided')
      return
    }
    const isRazorpay = url.startsWith('https://rzp.io/')
    const isLocalDemo = url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:')
    if (!isRazorpay && !isLocalDemo) {
      alert('Payment Link creation failed: Invalid payment link URL format')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleGeneratePaymentLink = async (caseId: string) => {
    setIsActionBusy(caseId)
    try {
      const link = await api.generatePaymentLink(caseId, true)
      await loadData()
      if (link && link.short_url) {
        handleOpenPaymentLink(link.short_url)
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create payment link')
    } finally {
      setIsActionBusy(null)
    }
  }

  const handleSyncPayment = async (caseId: string) => {
    setIsSyncing(true)
    try {
      const res = await api.syncCasePayment(caseId)
      await loadData()
      if (res.recovered) {
        setSyncSuccessMsg(`Payment Confirmed! ₹${formatINR(res.case.risk_amount)} recovered via Razorpay.`)
        setTimeout(() => setSyncSuccessMsg(null), 7000)
      } else {
        alert('Payment link has not been paid yet.')
      }
    } catch (err: any) {
      alert(err.message || 'Could not verify payment link')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSimulateOutcome = async (caseId: string, outcome: 'RECOVERED' | 'FAILED') => {
    setIsActionBusy(caseId)
    try {
      await api.simulateWorkflowOutcome(caseId, outcome)
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to simulate outcome')
    } finally {
      setIsActionBusy(null)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedLink(text)
    setTimeout(() => setCopiedLink(null), 2500)
  }

  // Auto sync on tab focus
  useEffect(() => {
    const onFocus = () => {
      if (selectedCaseId) {
        api.syncCasePayment(selectedCaseId)
          .then(res => {
            if (res.recovered) {
              loadData()
              setSyncSuccessMsg(`Payment Confirmed! ₹${formatINR(res.case.risk_amount)} recovered via Razorpay.`)
              setTimeout(() => setSyncSuccessMsg(null), 7000)
            }
          })
          .catch(() => {})
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [selectedCaseId, loadData])

  // Periodic polling if selected case has an open unpaid Razorpay payment link
  useEffect(() => {
    const curCase = workflows.find(w => w.id === selectedCaseId)
    if (!curCase || curCase.status === 'RECOVERED') return

    const hasUnpaidLink = curCase.payment_links?.some(
      pl => pl.status !== 'paid' && pl.payment_link_id?.startsWith('plink_')
    )
    if (!hasUnpaidLink) return

    const interval = setInterval(() => {
      api.syncCasePayment(curCase.id)
        .then(res => {
          if (res.recovered) {
            loadData()
            setSyncSuccessMsg(`Payment Confirmed! ₹${formatINR(res.case.risk_amount)} recovered via Razorpay.`)
            setTimeout(() => setSyncSuccessMsg(null), 7000)
          }
        })
        .catch(() => {})
    }, 5000)

    return () => clearInterval(interval)
  }, [selectedCaseId, workflows, loadData])

  const activeWorkflows = workflows.filter(w => !isTerminalState(w.status))
  const recoveredCount = workflows.filter(w => w.status === 'RECOVERED').length
  const totalErv = workflows.reduce((acc, w) => acc + (w.expected_recovery_value || 0), 0)
  const totalPaymentLinks = workflows.reduce((acc, w) => acc + (w.payment_links?.length || 0), 0)

  const filteredWorkflows = workflows.filter(w => {
    if (statusFilter === 'ALL') return true
    if (statusFilter === 'ACTIVE') return !isTerminalState(w.status)
    if (statusFilter === 'WAITING') return w.current_step === 'WAITING_FOR_CUSTOMER'
    if (statusFilter === 'RECOVERED') return w.status === 'RECOVERED'
    if (statusFilter === 'ESCALATED') return w.status === 'ESCALATED' || w.status === 'STOPPED'
    return true
  })

  const selectedCase = workflows.find(w => w.id === selectedCaseId) || workflows[0]

  const getStepIndex = (step: string) => {
    const idx = STATE_STEPS.findIndex(s => s.id === step)
    return idx !== -1 ? idx : 0
  }

  const getStrategyBadge = (strat: string) => {
    switch (strat) {
      case 'UPI_SWITCH':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">⚡ UPI Switch</span>
      case 'PAYMENT_LINK':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-surface-blue text-primary border border-surface-blue-border">🔗 1-Click Link</span>
      case 'RETRY_LATER':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">⏰ Smart Retry</span>
      case 'PERSONALIZED_REMINDER':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-light text-primary border border-primary-border">💬 AI Reminder</span>
      case 'HUMAN_ESCALATION':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">👤 Concierge</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{strat}</span>
    }
  }

  const getChannelIcon = (chan: string) => {
    switch (chan) {
      case 'WHATSAPP_SIMULATION':
        return <span className="text-emerald-700 text-xs font-mono font-bold">WhatsApp</span>
      case 'SMS_SIMULATION':
        return <span className="text-primary text-xs font-mono font-bold">SMS</span>
      case 'EMAIL_SIMULATION':
        return <span className="text-primary text-xs font-mono font-bold">Email</span>
      default:
        return <span className="text-amber-700 text-xs font-mono font-bold">In-App</span>
    }
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <SectionHeader
          title="Recovery Agent Operations Center"
          subtitle="Autonomous 10-Stage Recovery • Maximum 3 Attempts Protection • Razorpay Test Mode Payment Links"
        />
        <div className="p-10 text-center bg-surface border border-border/80 rounded-2xl shadow-fintech-card space-y-4">
          <AlertOctagon className="w-10 h-10 text-rose-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-navy font-display">
              Recovery recommendation temporarily unavailable.
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {error}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try again</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <SectionHeader
        title="Recovery Agent Operations Center"
        subtitle="Autonomous 10-Stage Recovery • Maximum 3 Attempts Protection • Razorpay Test Mode Payment Links"
        actions={
          <div className="flex items-center gap-2.5">
            {ENV.DEMO_MODE && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Demo Data
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs text-emerald-800 font-mono font-bold" title="Background workers process state transitions 24/7 server-side without requiring open browsers">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              24/7 SERVER WORKER ACTIVE
            </span>
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-fintech-purple transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Workflows</span>
            </button>
          </div>
        }
      />

      {/* High-level KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Active Autonomous Workflows"
          value={`${activeWorkflows.length} Active`}
          subtitle="Governed state transitions"
          highlightColor="purple"
          variant="standard"
        />
        <MetricCard
          title="Maximum Recovery Attempts"
          value="3 Attempts Max"
          subtitle="Enforces strict retry limits"
          highlightColor="purple"
          variant="standard"
        />
        <MetricCard
          title="Expected Recovery Value"
          value={formatINR(totalErv)}
          subtitle={`${recoveredCount} cases recovered so far`}
          variant="soft-blue"
        />
        <MetricCard
          title="Payment Links Created"
          value={`${totalPaymentLinks} Generated`}
          subtitle="Razorpay Test Mode Links"
          highlightColor="purple"
          variant="standard"
        />
      </div>

      {/* Selected Case State Machine Stepper Visualizer */}
      {selectedCase && (
        <div className="bg-surface border border-border/80 rounded-2xl p-6 shadow-fintech-card space-y-5">
          {syncSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{syncSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncSuccessMsg(null)}
                className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/70">
            <div>
              <div className="flex items-center gap-2.5">
                <Bot className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-navy font-display">
                  Active Workflow: <span className="font-mono text-primary">{selectedCase.id}</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">({selectedCase.order_id || selectedCase.transaction_id})</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Customer: <strong className="text-navy">{selectedCase.customer_name}</strong> ({selectedCase.customer_tier}) • Risk Amount: <strong className="text-navy">{formatINR(selectedCase.risk_amount)}</strong> • ERV: <strong className="text-emerald-600">{formatINR(selectedCase.expected_recovery_value)}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-xs font-mono text-slate-700 border border-border">
                Attempt: <strong className="text-primary font-bold">{selectedCase.attempt_count} / {selectedCase.max_attempts}</strong>
              </span>
              {getStrategyBadge(selectedCase.selected_strategy)}
            </div>
          </div>

          {/* Stepper Stages Bar: Modern Rounded Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {STATE_STEPS.map((step, idx) => {
              const currentIdx = getStepIndex(selectedCase.current_step)
              const isPast = idx < currentIdx || selectedCase.status === 'RECOVERED'
              const isCurrent = step.id === selectedCase.current_step && selectedCase.status !== 'RECOVERED'

              let borderStyle = 'border-border/80 bg-slate-50 text-slate-400'
              let dotStyle = 'bg-slate-200 text-slate-500'

              if (isPast) {
                borderStyle = 'border-primary-border/60 bg-primary-subtle/50 text-primary'
                dotStyle = 'bg-primary text-white font-bold shadow-xs'
              } else if (isCurrent) {
                borderStyle = 'border-primary bg-surface-blue/50 text-navy ring-2 ring-primary/20 shadow-2xs'
                dotStyle = 'bg-primary text-white font-bold animate-pulse shadow-fintech-purple'
              }

              return (
                <div key={step.id} className={`p-3 rounded-2xl border transition-all ${borderStyle}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${dotStyle}`}>
                      {isPast ? <Check className="w-3 h-3" /> : idx + 1}
                    </span>
                    <span className="text-xs font-bold truncate text-navy">{step.label.replace(/^\d+\.\s*/, '')}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 truncate font-medium">{step.desc}</p>
                </div>
              )
            })}
          </div>

          {/* Interactive Agent Controls for Selected Case */}
          <div className="bg-surface-blue/40 p-4 rounded-2xl border border-surface-blue-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-navy font-bold">Sandbox Simulator & Intervention Controls:</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-slate-500 border border-border font-medium">Server worker operates 24/7 autonomously</span>
                </div>
                <p className="text-[11px] text-slate-500">Autonomous server worker executes state transitions in the background. Use simulator buttons for manual testing.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Advance 1 Step */}
              <button
                type="button"
                onClick={() => handleAdvanceStep(selectedCase.id)}
                disabled={isActionBusy === selectedCase.id || selectedCase.status === 'RECOVERED'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-slate-50 text-navy rounded-xl text-xs font-semibold border border-border disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
                title="Force-advances 1 step in simulator without waiting for scheduled background worker"
              >
                <Play className={`w-3.5 h-3.5 text-primary ${isActionBusy === selectedCase.id ? 'animate-spin' : ''}`} />
                <span>Simulate: Advance Step</span>
              </button>

              {/* Execute Full Pipeline: Primary purple button */}
              <button
                type="button"
                onClick={() => handleExecuteFull(selectedCase.id)}
                disabled={isActionBusy === selectedCase.id || selectedCase.status === 'RECOVERED'}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-fintech-purple disabled:opacity-50 transition-all cursor-pointer"
                title="Force-runs complete recovery workflow in simulator"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Simulate: Run Recovery</span>
              </button>

              {/* Generate Genuine Razorpay Test Payment Link */}
              <button
                type="button"
                onClick={() => handleGeneratePaymentLink(selectedCase.id)}
                disabled={isActionBusy === selectedCase.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-blue hover:bg-surface-blue-hover text-primary border border-surface-blue-border rounded-xl text-xs font-bold disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
              >
                <LinkIcon className="w-3.5 h-3.5 text-primary" />
                <span>Create Payment Link</span>
              </button>

              {/* Real-Time Verify / Sync Gateway Status */}
              <button
                type="button"
                onClick={() => handleSyncPayment(selectedCase.id)}
                disabled={isSyncing || selectedCase.status === 'RECOVERED'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-slate-50 text-navy border border-border rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
                title="Directly query Razorpay API for live payment status"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Verifying Gateway...' : 'Verify Link Payment'}</span>
              </button>

              {/* Simulate Customer Payment (RECOVERED) */}
              <button
                type="button"
                onClick={() => handleSimulateOutcome(selectedCase.id, 'RECOVERED')}
                disabled={isActionBusy === selectedCase.id || selectedCase.status === 'RECOVERED'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Simulate Successful Payment</span>
              </button>

              {/* Simulate Customer Timeout */}
              <button
                type="button"
                onClick={() => handleSimulateOutcome(selectedCase.id, 'FAILED')}
                disabled={isActionBusy === selectedCase.id || selectedCase.status === 'RECOVERED'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
              >
                <Clock className="w-3.5 h-3.5 text-rose-600" />
                <span>Simulate No Response</span>
              </button>
            </div>
          </div>

          {/* Genuine Razorpay Payment Links Display */}
          {selectedCase.payment_links && selectedCase.payment_links.length > 0 && (
            <div className="bg-surface-blue/50 border border-surface-blue-border rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-navy font-display">Payment Recovery Links (Active)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary text-white">Active</span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Razorpay Test Mode</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedCase.payment_links.map(pl => {
                  const isReal = pl.is_live_demo || (pl.short_url && pl.short_url.startsWith('https://rzp.io/'))
                  return (
                    <div key={pl.id} className="p-3 rounded-xl bg-surface border border-surface-blue-border flex items-center justify-between gap-3 shadow-2xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-navy font-bold">{pl.payment_link_id}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${pl.status === 'paid' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-700'}`}>
                            {pl.status === 'paid' ? 'PAID & RECOVERED' : pl.status}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${isReal ? 'bg-primary-light text-primary border border-primary-border' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                            {isReal ? 'RAZORPAY TEST LINK' : 'DEMO LINK'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenPaymentLink(pl.short_url)}
                          className="text-xs text-primary hover:underline truncate block mt-1.5 text-left font-mono max-w-full font-semibold"
                          title="Click to open link in new tab"
                        >
                          {pl.short_url}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {pl.status !== 'paid' && isReal && (
                          <button
                            type="button"
                            onClick={() => handleSyncPayment(selectedCase.id)}
                            disabled={isSyncing}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            title="Verify payment with Razorpay"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Verify</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopy(pl.short_url)}
                          className="p-2 text-slate-500 hover:text-navy bg-slate-100 hover:bg-slate-200 rounded-xl text-xs transition-colors cursor-pointer"
                          title="Copy payment link"
                        >
                          {copiedLink === pl.short_url ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenPaymentLink(pl.short_url)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-white bg-primary hover:bg-primary-hover rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-fintech-purple"
                          title="Open Razorpay Hosted Checkout"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Open Link</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Layout: Active Workflows Table + Honest Notification Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Workflows List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-navy font-display">Active Recovery Pipelines</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary-light text-primary border border-primary-border">
                {filteredWorkflows.length}
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-border text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === 'ALL' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:text-navy'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === 'ACTIVE' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:text-navy'}`}
              >
                In Progression
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('WAITING')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === 'WAITING' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:text-navy'}`}
              >
                Waiting Customer
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('RECOVERED')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === 'RECOVERED' ? 'bg-primary text-white shadow-2xs' : 'text-slate-600 hover:text-navy'}`}
              >
                Recovered
              </button>
            </div>
          </div>

          {/* Workflow Cards */}
          <div className="space-y-3">
            {filteredWorkflows.length === 0 ? (
              <div className="p-10 text-center bg-surface border border-border/80 rounded-2xl shadow-fintech-card space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h3 className="text-base font-bold text-navy font-display">No active recovery workflows.</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">All cases in this queue have completed recovery or reached terminal resolution.</p>
              </div>
            ) : (
              filteredWorkflows.map(wf => {
                const isSelected = selectedCaseId === wf.id
                return (
                  <div
                    key={wf.id}
                    onClick={() => setSelectedCaseId(wf.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-surface-blue/30 ring-2 ring-primary/20 shadow-fintech-card'
                        : 'border-border/80 bg-surface hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${wf.status === 'RECOVERED' ? 'bg-emerald-500' : 'bg-primary animate-pulse'}`} />
                        <span className="font-mono text-xs font-bold text-navy">{wf.id}</span>
                        <span className="text-xs text-slate-400 font-mono">({wf.order_id || wf.transaction_id})</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {wf.customer_tier}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Attempt:</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-primary-light text-primary border border-primary-border">
                          {wf.attempt_count} / {wf.max_attempts}
                        </span>
                        {getStrategyBadge(wf.selected_strategy)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3.5 pt-3.5 border-t border-border/60 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px] font-semibold">Customer</span>
                        <span className="text-navy font-bold truncate block">{wf.customer_name || 'Customer'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px] font-semibold">Risk Amount</span>
                        <span className="text-navy font-bold font-mono">{formatINR(wf.risk_amount)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px] font-semibold">Current Stage</span>
                        <span className="text-primary font-mono font-bold">{wf.current_step}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px] font-semibold">Channel Dispatch</span>
                        {getChannelIcon(wf.channel)}
                      </div>
                    </div>

                    {/* Actions Bar for Card */}
                    <div className="mt-3.5 pt-3 flex items-center justify-between border-t border-border/60">
                      <span className="text-[11px] text-slate-400 font-mono">
                        Updated {formatTimeAgo(wf.updated_at || wf.scheduled_at || new Date())}
                      </span>

                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleAdvanceStep(wf.id)}
                          disabled={isActionBusy === wf.id || wf.status === 'RECOVERED'}
                          className="px-3 py-1.5 bg-surface hover:bg-slate-100 text-navy rounded-xl text-[11px] font-semibold border border-border shadow-2xs cursor-pointer"
                        >
                          Step +1
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExecuteFull(wf.id)}
                          disabled={isActionBusy === wf.id || wf.status === 'RECOVERED'}
                          className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-[11px] font-bold shadow-fintech-purple cursor-pointer"
                        >
                          Run Recovery
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Col: Honest Notification Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-navy font-display">Customer Communications</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
              DEMO DELIVERY
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            RecoverAI delivers honestly. When external SMS/WhatsApp accounts are unconfigured, delivery is faithfully simulated without spoofing real carriers.
          </p>

          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-border rounded-2xl bg-surface text-xs shadow-2xs">
                No notifications dispatched yet. Execute a workflow step to trigger multi-channel recovery communications.
              </div>
            ) : (
              notifications.map(notif => {
                const isBlocked = notif.delivery_label === 'BLOCKED_TEST_RECIPIENT' || notif.status === 'BLOCKED'
                return (
                  <div key={notif.notification_id} className="p-4 rounded-2xl border border-border/80 bg-surface space-y-2.5 shadow-fintech-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {notif.channel === 'WHATSAPP_SIMULATION' && <Smartphone className="w-3.5 h-3.5 text-emerald-600" />}
                        {notif.channel === 'SMS_SIMULATION' && <MessageSquare className="w-3.5 h-3.5 text-primary" />}
                        {(notif.channel === 'EMAIL_SIMULATION' || notif.channel === 'EMAIL' || notif.channel === 'resend') && (
                          <Mail className="w-3.5 h-3.5 text-primary" />
                        )}
                        {notif.channel === 'IN_APP' && <Sparkles className="w-3.5 h-3.5 text-amber-600" />}
                        <span className="text-xs font-bold text-navy">{notif.title}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${getBadgeStyle(notif.status, notif.delivery_label)}`}>
                        {getBadgeLabel(notif.status, notif.delivery_label)}
                      </span>
                    </div>

                    {isBlocked && (
                      <div className="flex items-center gap-1.5 p-2 bg-amber-50/80 border border-amber-200/80 rounded-lg text-[11px] text-amber-800 font-medium">
                        <AlertOctagon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Email delivery restricted to configured test recipients.</span>
                      </div>
                    )}

                    <p className="text-xs text-slate-600 leading-relaxed font-sans bg-slate-50 p-3 rounded-xl border border-border">
                      {notif.body}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                      <span>{maskRecipient(notif.recipient)}</span>
                      <span>{formatTimeAgo(notif.dispatched_at)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecoveryAgent
