import React, { useState, useEffect, useCallback } from 'react'
import {
  WorkflowCase,
  NotificationReceiptItem,
  api
} from '../services/api'
import { SectionHeader } from '../components/common/SectionHeader'
import { MetricCard } from '../components/common/MetricCard'
import { useRealtime } from '../lib/useRealtime'
import { formatTimeAgo, formatINR } from '../lib/utils'
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
  Layers
} from 'lucide-react'

const STATE_STEPS = [
  { id: 'DETECTED', label: '1. Detected', desc: 'Failure ingested' },
  { id: 'ANALYZED', label: '2. Analyzed', desc: 'ML & diagnosis' },
  { id: 'STRATEGY_SELECTED', label: '3. Strategy', desc: 'Optimal ERV' },
  { id: 'GUARDRAIL_CHECKED', label: '4. Guardrails', desc: 'Limits & limits' },
  { id: 'ACTION_SCHEDULED', label: '5. Scheduled', desc: 'Channel queued' },
  { id: 'ACTION_EXECUTED', label: '6. Executed', desc: 'Dispatched' },
  { id: 'WAITING_FOR_CUSTOMER', label: '7. Customer Wait', desc: 'Awaiting action' },
  { id: 'RECOVERED', label: '8. Recovered', desc: 'Revenue secured' }
]

export const RecoveryAgent: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowCase[]>([])
  const [notifications, setNotifications] = useState<NotificationReceiptItem[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isActionBusy, setIsActionBusy] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const { subscribe } = useRealtime()

  const loadData = useCallback(async () => {
    try {
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
    } finally {
      setIsLoading(false)
    }
  }, [selectedCaseId])

  useEffect(() => {
    loadData()

    // Listen to real-time events
    const unsubTransition = subscribe('RECOVERY_AGENT_TRANSITION', () => {
      loadData()
    })
    const unsubNotif = subscribe('NOTIFICATION_DISPATCHED', () => {
      loadData()
    })
    const unsubAll = subscribe('*', () => {
      loadData()
    })

    return () => {
      unsubTransition()
      unsubNotif()
      unsubAll()
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

  const handleGeneratePaymentLink = async (caseId: string) => {
    setIsActionBusy(caseId)
    try {
      const link = await api.generatePaymentLink(caseId, true)
      await loadData()
      alert(`Razorpay Test Payment Link Generated!\nURL: ${link.short_url}`)
    } catch (err: any) {
      alert(err.message || 'Failed to generate payment link')
    } finally {
      setIsActionBusy(null)
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

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedLink(url)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const activeWorkflows = workflows.filter(w => w.status !== 'RECOVERED' && w.status !== 'STOPPED')
  const recoveredCount = workflows.filter(w => w.status === 'RECOVERED').length
  const totalErv = workflows.reduce((acc, w) => acc + (w.expected_recovery_value || 0), 0)
  const totalPaymentLinks = workflows.reduce((acc, w) => acc + (w.payment_links?.length || 0), 0)

  const filteredWorkflows = workflows.filter(w => {
    if (statusFilter === 'ALL') return true
    if (statusFilter === 'ACTIVE') return w.status !== 'RECOVERED' && w.status !== 'STOPPED'
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
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-800/50">⚡ UPI Switch</span>
      case 'PAYMENT_LINK':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-950/40 text-sky-300 border border-sky-800/50">🔗 1-Click Link</span>
      case 'RETRY_LATER':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/40 text-amber-300 border border-amber-800/50">⏰ Smart Retry</span>
      case 'PERSONALIZED_REMINDER':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950/40 text-purple-300 border border-purple-800/50">💬 AI Reminder</span>
      case 'HUMAN_ESCALATION':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950/40 text-rose-300 border border-rose-800/50">👤 Concierge</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-800 text-stone-300 border border-stone-700">{strat}</span>
    }
  }

  const getChannelIcon = (chan: string) => {
    switch (chan) {
      case 'WHATSAPP_SIMULATION':
        return <span className="text-emerald-400 text-xs font-mono">WhatsApp</span>
      case 'SMS_SIMULATION':
        return <span className="text-sky-400 text-xs font-mono">SMS</span>
      case 'EMAIL_SIMULATION':
        return <span className="text-purple-400 text-xs font-mono">Email</span>
      default:
        return <span className="text-amber-400 text-xs font-mono">In-App</span>
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Recovery Agent Operations Center"
        subtitle="Live 10-Stage State Machine • Bounded Loops (Max 3 Attempts) • Genuine Razorpay Test Payment Links"
        actions={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/50 border border-emerald-800/60 rounded text-xs text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              STATE MACHINE LIVE
            </span>
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-sm text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
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
          highlightColor="burnt-orange"
        />
        <MetricCard
          title="Bounded Loop Ceiling"
          value="MAX 3 ATTEMPTS"
          subtitle="Zero unbounded/infinite retry loops"
          highlightColor="moss-green"
        />
        <MetricCard
          title="Expected Recovery Value"
          value={formatINR(totalErv)}
          subtitle={`${recoveredCount} cases recovered so far`}
          highlightColor="muted-amber"
        />
        <MetricCard
          title="Test Payment Links Created"
          value={`${totalPaymentLinks} Generated`}
          subtitle="Razorpay POST /v1/payment_links"
          highlightColor="moss-green"
        />
      </div>

      {/* Selected Case State Machine Stepper Visualizer */}
      {selectedCase && (
        <div className="bg-stone-900/90 border border-stone-800 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-800/80">
            <div>
              <div className="flex items-center gap-2.5">
                <Bot className="w-5 h-5 text-burnt-orange" />
                <h3 className="text-base font-semibold text-stone-100">
                  Active Workflow: <span className="font-mono text-burnt-orange">{selectedCase.id}</span>
                </h3>
                <span className="text-xs text-stone-400 font-mono">({selectedCase.order_id || selectedCase.transaction_id})</span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Customer: <strong className="text-stone-200">{selectedCase.customer_name}</strong> ({selectedCase.customer_tier}) • Risk Amount: <strong className="text-stone-100">{formatINR(selectedCase.risk_amount)}</strong> • ERV: <strong className="text-emerald-400">{formatINR(selectedCase.expected_recovery_value)}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-stone-800 text-xs font-mono text-stone-200 border border-stone-700">
                Loop Attempt: <strong className="text-amber-400">{selectedCase.attempt_count} / {selectedCase.max_attempts}</strong> (Bounded)
              </span>
              {getStrategyBadge(selectedCase.selected_strategy)}
            </div>
          </div>

          {/* Stepper Stages Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {STATE_STEPS.map((step, idx) => {
              const currentIdx = getStepIndex(selectedCase.current_step)
              const isPast = idx < currentIdx || selectedCase.status === 'RECOVERED'
              const isCurrent = step.id === selectedCase.current_step && selectedCase.status !== 'RECOVERED'

              let borderStyle = 'border-stone-800 bg-stone-950/40 text-stone-500'
              let dotStyle = 'bg-stone-700 text-stone-400'

              if (isPast) {
                borderStyle = 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300'
                dotStyle = 'bg-emerald-500 text-stone-950 font-bold'
              } else if (isCurrent) {
                borderStyle = 'border-burnt-orange bg-burnt-orange/10 text-burnt-orange ring-1 ring-burnt-orange/50'
                dotStyle = 'bg-burnt-orange text-white font-bold animate-pulse'
              }

              return (
                <div key={step.id} className={`p-2.5 rounded border transition-all ${borderStyle}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${dotStyle}`}>
                      {isPast ? <Check className="w-3 h-3" /> : idx + 1}
                    </span>
                    <span className="text-xs font-semibold truncate">{step.label.replace(/^\d+\.\s*/, '')}</span>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1 truncate">{step.desc}</p>
                </div>
              )
            })}
          </div>

          {/* Interactive Agent Controls for Selected Case */}
          <div className="bg-stone-950/60 p-3.5 rounded border border-stone-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-burnt-orange" />
              <span className="text-xs text-stone-300 font-medium">Autonomous Execution Controls:</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Advance 1 Step */}
              <button
                type="button"
                onClick={() => handleAdvanceStep(selectedCase.id)}
                disabled={isActionBusy === selectedCase.id || selectedCase.status === 'RECOVERED'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded text-xs font-medium border border-stone-700 disabled:opacity-50 transition-colors"
              >
                <Play className={`w-3.5 h-3.5 text-amber-400 ${isActionBusy === selectedCase.id ? 'animate-spin' : ''}`} />
                <span>Advance 1 Step</span>
              </button>

              {/* Execute Full Pipeline */}
              <button
                type="button"
                onClick={() => handleExecuteFull(selectedCase.id)}
                disabled={isActionBusy === selectedCase.id || selectedCase.status === 'RECOVERED'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded text-xs font-medium shadow-sm disabled:opacity-50 transition-colors"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Execute Pipeline</span>
              </button>

              {/* Generate Genuine Razorpay Test Payment Link */}
              <button
                type="button"
                onClick={() => handleGeneratePaymentLink(selectedCase.id)}
                disabled={isActionBusy === selectedCase.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-950/60 hover:bg-sky-900/80 text-sky-200 border border-sky-800/80 rounded text-xs font-medium disabled:opacity-50 transition-colors"
              >
                <LinkIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>Create Razorpay Link</span>
              </button>

              {/* Simulate Customer Payment (RECOVERED) */}
              <button
                type="button"
                onClick={() => handleSimulateOutcome(selectedCase.id, 'RECOVERED')}
                disabled={isActionBusy === selectedCase.id || selectedCase.status === 'RECOVERED'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-200 border border-emerald-800/80 rounded text-xs font-medium disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Simulate Pay (Recover)</span>
              </button>

              {/* Simulate Customer Timeout (FAILED -> NEXT_STRATEGY or ESCALATE) */}
              <button
                type="button"
                onClick={() => handleSimulateOutcome(selectedCase.id, 'FAILED')}
                disabled={isActionBusy === selectedCase.id || selectedCase.status === 'RECOVERED'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-rose-300 border border-rose-900/50 rounded text-xs font-medium disabled:opacity-50 transition-colors"
              >
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                <span>Simulate Timeout</span>
              </button>
            </div>
          </div>

          {/* Genuine Razorpay Payment Links Display */}
          {selectedCase.payment_links && selectedCase.payment_links.length > 0 && (
            <div className="bg-sky-950/30 border border-sky-900/60 rounded-md p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-semibold text-sky-200">Razorpay Test Payment Links (Active)</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-900 text-sky-300">Live Gateway Endpoint</span>
                </div>
                <span className="text-[11px] text-stone-400">Created via POST /v1/payment_links</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedCase.payment_links.map(pl => (
                  <div key={pl.id} className="p-2.5 rounded bg-stone-950/80 border border-sky-900/40 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-sky-300 font-semibold">{pl.payment_link_id}</span>
                        <span className="text-[10px] px-1 rounded bg-stone-800 text-stone-300">{pl.status}</span>
                      </div>
                      <a
                        href={pl.short_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-sky-400 hover:underline truncate block mt-0.5"
                      >
                        {pl.short_url}
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(pl.short_url)}
                        className="p-1.5 text-stone-400 hover:text-stone-200 bg-stone-800 rounded text-xs"
                        title="Copy payment link"
                      >
                        {copiedLink === pl.short_url ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <a
                        href={pl.short_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-sky-300 hover:text-sky-100 bg-sky-900/60 rounded text-xs"
                        title="Open Test Checkout"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
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
              <Layers className="w-4 h-4 text-burnt-orange" />
              <h3 className="text-sm font-semibold text-stone-200">Active Recovery Pipelines</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-stone-800 text-stone-300">
                {filteredWorkflows.length}
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-sm border border-stone-800 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${statusFilter === 'ALL' ? 'bg-burnt-orange text-white' : 'text-stone-400 hover:text-stone-200'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${statusFilter === 'ACTIVE' ? 'bg-burnt-orange text-white' : 'text-stone-400 hover:text-stone-200'}`}
              >
                In Progression
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('WAITING')}
                className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${statusFilter === 'WAITING' ? 'bg-burnt-orange text-white' : 'text-stone-400 hover:text-stone-200'}`}
              >
                Waiting Customer
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('RECOVERED')}
                className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${statusFilter === 'RECOVERED' ? 'bg-burnt-orange text-white' : 'text-stone-400 hover:text-stone-200'}`}
              >
                Recovered
              </button>
            </div>
          </div>

          {/* Workflow Cards */}
          <div className="space-y-3">
            {filteredWorkflows.map(wf => {
              const isSelected = selectedCaseId === wf.id
              return (
                <div
                  key={wf.id}
                  onClick={() => setSelectedCaseId(wf.id)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-burnt-orange bg-stone-900/95 ring-1 ring-burnt-orange/40 shadow-sm'
                      : 'border-stone-800/80 bg-stone-900/60 hover:border-stone-700 hover:bg-stone-900/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${wf.status === 'RECOVERED' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                      <span className="font-mono text-xs font-bold text-stone-100">{wf.id}</span>
                      <span className="text-xs text-stone-400">({wf.order_id || wf.transaction_id})</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-800 text-stone-300">
                        {wf.customer_tier}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-400">Attempt:</span>
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-stone-800 text-amber-300 border border-stone-700">
                        {wf.attempt_count} / {wf.max_attempts}
                      </span>
                      {getStrategyBadge(wf.selected_strategy)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-stone-800/60 text-xs">
                    <div>
                      <span className="text-stone-400 block text-[11px]">Customer</span>
                      <span className="text-stone-200 font-medium truncate block">{wf.customer_name || 'Customer'}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[11px]">Risk Amount</span>
                      <span className="text-stone-100 font-semibold">{formatINR(wf.risk_amount)}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[11px]">Current Stage</span>
                      <span className="text-burnt-orange font-mono font-medium">{wf.current_step}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[11px]">Channel Dispatch</span>
                      {getChannelIcon(wf.channel)}
                    </div>
                  </div>

                  {/* Actions Bar for Card */}
                  <div className="mt-3 pt-2.5 flex items-center justify-between border-t border-stone-800/40">
                    <span className="text-[11px] text-stone-400 font-mono">
                      Updated {formatTimeAgo(wf.updated_at)}
                    </span>

                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleAdvanceStep(wf.id)}
                        disabled={isActionBusy === wf.id || wf.status === 'RECOVERED'}
                        className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-[11px] font-medium border border-stone-700"
                      >
                        Step +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExecuteFull(wf.id)}
                        disabled={isActionBusy === wf.id || wf.status === 'RECOVERED'}
                        className="px-2 py-1 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded text-[11px] font-medium"
                      >
                        Run Pipeline
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Col: Honest Notification Feed (DEMO DELIVERY) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-stone-200">Simulated Dispatches</h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-800/60">
              DEMO DELIVERY
            </span>
          </div>

          <p className="text-xs text-stone-400">
            RecoverAI delivers honestly. When external SMS/WhatsApp accounts are unconfigured, delivery is faithfully simulated without spoofing real carriers.
          </p>

          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-stone-400 border border-stone-800 rounded bg-stone-900/40 text-xs">
                No notifications dispatched yet. Execute a workflow step to trigger multi-channel recovery communications.
              </div>
            ) : (
              notifications.map(notif => (
                <div key={notif.notification_id} className="p-3.5 rounded-lg border border-stone-800 bg-stone-900/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {notif.channel === 'WHATSAPP_SIMULATION' && <Smartphone className="w-3.5 h-3.5 text-emerald-400" />}
                      {notif.channel === 'SMS_SIMULATION' && <MessageSquare className="w-3.5 h-3.5 text-sky-400" />}
                      {notif.channel === 'EMAIL_SIMULATION' && <Mail className="w-3.5 h-3.5 text-purple-400" />}
                      {notif.channel === 'IN_APP' && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                      <span className="text-xs font-semibold text-stone-200">{notif.title}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-950/80 text-amber-400 border border-amber-900/60">
                      {notif.delivery_label}
                    </span>
                  </div>

                  <p className="text-xs text-stone-300 leading-relaxed font-sans bg-stone-950/50 p-2 rounded border border-stone-800/60">
                    {notif.body}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1">
                    <span className="font-mono">{notif.recipient}</span>
                    <span>{formatTimeAgo(notif.dispatched_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecoveryAgent
