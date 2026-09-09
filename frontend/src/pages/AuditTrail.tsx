import React, { useState, useEffect } from 'react'
import {
  api,
  CaseAuditSummaryItem,
  CaseAuditTimelineResponse
} from '../services/api'
import { AuditLogEntry } from '../types'
import { SectionHeader } from '../components/common/SectionHeader'
import { SkeletonLoader } from '../components/common/SkeletonLoader'
import { ErrorState } from '../components/common/ErrorState'
import { formatTimeAgo } from '../../src/lib/utils'
import {
  Shield,
  User,
  Bot,
  Webhook,
  Filter,
  RefreshCw,
  Search,
  Copy,
  Check,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Lock,
  ChevronRight,
  ChevronDown,
  Cpu,
  Calculator,
  Sliders,
  Sparkles,
  Send,
  Smartphone,
  CreditCard,
  ShieldCheck,
  Activity
} from 'lucide-react'
import { useRealtime } from '../lib/useRealtime'

export const AuditTrail: React.FC = () => {
  // Navigation Tabs: 'CASES' or 'GLOBAL_LOGS'
  const [activeTab, setActiveTab] = useState<'CASES' | 'GLOBAL_LOGS'>('CASES')

  // Case Browser State
  const [cases, setCases] = useState<CaseAuditSummaryItem[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [caseTimeline, setCaseTimeline] = useState<CaseAuditTimelineResponse | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [caseSearch, setCaseSearch] = useState('')
  const [caseStatusFilter, setCaseStatusFilter] = useState('ALL')

  // Global Logs State
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [filterActor, setFilterActor] = useState<string>('ALL')
  const [logSearch, setLogSearch] = useState('')

  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedTxId, setCopiedTxId] = useState(false)
  const [expandedPayloads, setExpandedPayloads] = useState<Record<number, boolean>>({})

  const { subscribe } = useRealtime()

  // Fetch Case List
  const fetchCases = async (silent = false) => {
    try {
      const res = await api.getAuditableCases({
        search: caseSearch || undefined,
        status: caseStatusFilter !== 'ALL' ? caseStatusFilter : undefined,
        limit: 50
      })
      setCases(res.items)
      if (!selectedCaseId && res.items.length > 0) {
        setSelectedCaseId(res.items[0].case_id)
      }
    } catch (err: any) {
      if (!silent) setError(err.message || 'Failed to load auditable cases')
    }
  }

  // Fetch Case Chronology
  const fetchChronology = async (id: string) => {
    setTimelineLoading(true)
    try {
      const res = await api.getCaseChronology(id)
      setCaseTimeline(res)
    } catch (err: any) {
      console.error('Failed to load case chronology', err)
    } finally {
      setTimelineLoading(false)
    }
  }

  // Fetch Global Audit Logs
  const fetchAuditLogs = async (silent = false) => {
    try {
      const data = await api.getAuditTrail()
      setLogs(data)
    } catch (e: any) {
      if (!silent) setError(e.message || 'Failed to load audit logs')
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchCases(true), fetchAuditLogs(true)])
      setLoading(false)
    }
    init()

    const onAuditRefresh = () => {
      fetchCases(true)
      fetchAuditLogs(true)
    }

    const unsubAudit = subscribe('AUDIT_LOG_CREATED', onAuditRefresh)
    const unsubTransition = subscribe('RECOVERY_AGENT_TRANSITION', onAuditRefresh)
    const unsubCase = subscribe('RECOVERY_CASE_UPDATED', onAuditRefresh)
    const unsubGuardrail = subscribe('GUARDRAIL_TRIGGERED', onAuditRefresh)
    const unsubPay = subscribe('PAYMENT_RECEIVED', () => {
      onAuditRefresh()
      if (selectedCaseId) fetchChronology(selectedCaseId)
    })
    const unsubResync = subscribe('RECONNECT_RESYNC', onAuditRefresh)

    return () => {
      unsubAudit()
      unsubTransition()
      unsubCase()
      unsubGuardrail()
      unsubPay()
      unsubResync()
    }
  }, [subscribe, selectedCaseId])

  useEffect(() => {
    if (selectedCaseId) {
      fetchChronology(selectedCaseId)
    }
  }, [selectedCaseId])

  // Handle Copy Transaction ID
  const handleCopyTxId = (txId: string) => {
    navigator.clipboard.writeText(txId)
    setCopiedTxId(true)
    setTimeout(() => setCopiedTxId(false), 2000)
  }

  // Handle Export Audit JSON
  const handleExportJSON = () => {
    if (!caseTimeline) return
    const blob = new Blob([caseTimeline.exportable_json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recoverai_audit_${caseTimeline.case_id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const togglePayload = (step: number) => {
    setExpandedPayloads(prev => ({ ...prev, [step]: !prev[step] }))
  }

  const getActorBadge = (actor: string) => {
    switch (actor) {
      case 'AUTONOMOUS_AGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary-light text-primary border border-primary-border">
            <Bot className="w-3 h-3 text-primary" /> Autonomous Agent
          </span>
        )
      case 'SYSTEM_GUARDRAIL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Shield className="w-3 h-3 text-amber-600" /> System Guardrail
          </span>
        )
      case 'MERCHANT_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <User className="w-3 h-3 text-emerald-600" /> Customer / Admin
          </span>
        )
      case 'WEBHOOK_EVENT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-border">
            <Webhook className="w-3 h-3 text-slate-500" /> Gateway Webhook
          </span>
        )
    }
  }

  const getStepIcon = (stepKey: string) => {
    switch (stepKey) {
      case 'PAYMENT_EVENT_RECEIVED':
        return <AlertCircle className="w-4 h-4 text-primary" />
      case 'FAILURE_DIAGNOSED':
        return <Activity className="w-4 h-4 text-primary" />
      case 'FEATURES_CALCULATED':
        return <Sliders className="w-4 h-4 text-navy" />
      case 'MODEL_VERSION':
        return <Cpu className="w-4 h-4 text-primary" />
      case 'PROBABILITIES_GENERATED':
        return <Calculator className="w-4 h-4 text-navy" />
      case 'ERV_VALUES':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      case 'STRATEGY_SELECTED':
        return <CheckCircle2 className="w-4 h-4 text-primary" />
      case 'GUARDRAIL_RESULT':
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />
      case 'LLM_EXPLANATION':
        return <Sparkles className="w-4 h-4 text-primary" />
      case 'ACTION_EXECUTED':
        return <Send className="w-4 h-4 text-navy" />
      case 'CUSTOMER_INTERACTION':
        return <Smartphone className="w-4 h-4 text-primary" />
      case 'PAYMENT_RESULT':
        return <CreditCard className="w-4 h-4 text-emerald-600" />
      case 'CASE_CLOSED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      default:
        return <Clock className="w-4 h-4 text-slate-400" />
    }
  }

  const filteredLogs = logs.filter(log => {
    if (filterActor !== 'ALL' && log.actor !== filterActor) return false
    if (logSearch) {
      const q = logSearch.toLowerCase()
      return (
        log.details.toLowerCase().includes(q) ||
        log.targetResource.toLowerCase().includes(q) ||
        log.actionType.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Tabs */}
      <SectionHeader
        title="Audit Trail & Decision Traceability Console"
        subtitle="Chronological, second-by-second forensic record of autonomous decisions, guardrails, and financial settlements"
        actions={
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('CASES')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'CASES'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-slate-600 hover:text-navy'
                }`}
              >
                Case Forensics Timeline (13 Stages)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('GLOBAL_LOGS')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'GLOBAL_LOGS'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-slate-600 hover:text-navy'
                }`}
              >
                Global System Event Ledger
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                fetchCases(false)
                fetchAuditLogs(false)
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface hover:bg-slate-50 border border-border text-navy rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-primary" />
              <span>Sync</span>
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="bg-surface p-6 rounded-2xl border border-border/80 shadow-fintech-card">
          <SkeletonLoader variant="row" count={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchCases(false)} />
      ) : activeTab === 'CASES' ? (
        /* Master-Detail Split Screen Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Case Browser (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            {/* Search & Filter Bar */}
            <div className="bg-surface p-4 rounded-2xl border border-border/80 shadow-fintech-card space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Tx ID, Customer, Order..."
                  value={caseSearch}
                  onChange={(e) => setCaseSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchCases(false)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-surface border border-border rounded-xl text-navy focus:outline-none focus:border-primary shadow-2xs font-medium"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <select
                  value={caseStatusFilter}
                  onChange={(e) => setCaseStatusFilter(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-xl text-navy focus:outline-none focus:border-primary shadow-2xs font-semibold"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="RECOVERED">Recovered</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="FAILED">Failed</option>
                  <option value="STOPPED">Stopped</option>
                  <option value="ESCALATED">Escalated</option>
                </select>

                <button
                  type="button"
                  onClick={() => fetchCases(false)}
                  className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-fintech-purple transition-all cursor-pointer"
                >
                  Filter
                </button>
              </div>
            </div>

            {/* Cases List */}
            <div className="bg-surface rounded-2xl border border-border/80 shadow-fintech-card p-2 space-y-1.5 max-h-[700px] overflow-y-auto">
              {cases.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No recovery cases match the search criteria.
                </div>
              ) : (
                cases.map((c) => {
                  const isSelected = selectedCaseId === c.case_id
                  return (
                    <div
                      key={c.case_id}
                      onClick={() => setSelectedCaseId(c.case_id)}
                      className={`p-3.5 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-surface-blue/40 border-primary ring-2 ring-primary/20 shadow-2xs'
                          : 'border border-border/40 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-navy font-display">
                          {c.customer_name}
                        </span>
                        <span className="font-mono text-xs font-bold text-navy">
                          ₹{c.amount.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                        <span className="font-mono">{c.order_id}</span>
                        <span className="px-2 py-0.5 bg-slate-100 border border-border text-[10px] rounded-full font-mono font-bold text-slate-600">
                          {c.payment_method}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 text-slate-600">
                          {c.failure_reason}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'RECOVERED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : c.status === 'IN_PROGRESS'
                              ? 'bg-primary-light text-primary border border-primary-border'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: 13-Stage Chronological Decision Trail (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {timelineLoading ? (
              <div className="bg-surface p-6 rounded-2xl border border-border/80 shadow-fintech-card">
                <SkeletonLoader variant="card" count={3} />
              </div>
            ) : caseTimeline ? (
              <>
                {/* Case Header Card */}
                <div className="bg-surface p-6 rounded-2xl border border-border/80 shadow-fintech-card space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-navy font-display">
                          {caseTimeline.customer_name}
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-light text-primary border border-primary-border">
                          {caseTimeline.customer_tier}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            caseTimeline.status === 'RECOVERED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-primary-light text-primary border border-primary-border'
                          }`}
                        >
                          {caseTimeline.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        Case ID: {caseTimeline.case_id} • Order: {caseTimeline.order_id}
                      </p>
                    </div>

                    {/* Actions: Copy Tx ID & Export JSON */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyTxId(caseTimeline.transaction_id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface hover:bg-slate-50 border border-border rounded-xl text-xs font-semibold text-navy transition-colors shadow-2xs cursor-pointer"
                      >
                        {copiedTxId ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy Tx ID</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleExportJSON}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Audit (JSON)</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-border">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">At-Risk Amount</span>
                      <span className="font-mono font-bold text-navy text-sm mt-0.5 block">
                        ₹{caseTimeline.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-border">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Recovery Likelihood</span>
                      <span className="font-mono font-bold text-primary text-sm mt-0.5 block">
                        {Math.round(caseTimeline.recovery_probability * 100)}%
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-border">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Expected Net ERV</span>
                      <span className="font-mono font-bold text-emerald-600 text-sm mt-0.5 block">
                        ₹{caseTimeline.expected_recovery_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-border">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Selected Strategy</span>
                      <span className="font-bold text-navy truncate block mt-0.5">
                        {caseTimeline.selected_strategy.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Security Redaction Guarantee Banner */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
                  <Lock className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                  <div className="text-xs text-emerald-900 leading-relaxed">
                    <span className="font-bold">PCI-DSS & RBI Digital Governance Compliance: </span>
                    All raw payment credentials, CVVs, and gateway API keys are strictly redacted.
                    Card instruments are masked (<code className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">**** 4242</code>). Every autonomous decision is fully reproducible and traceable.
                  </div>
                </div>

                {/* The 13 Chronological Audit Stages Timeline */}
                <div className="bg-surface p-6 rounded-2xl border border-border/80 shadow-fintech-card space-y-5">
                  <div className="flex items-center justify-between border-b border-border/70 pb-3">
                    <h3 className="text-base font-bold text-navy font-display">
                      Chronological Decision Chain (13 Traceable Events)
                    </h3>
                    <span className="text-xs font-mono text-slate-500 font-medium">
                      Precision Second-by-Second Logging
                    </span>
                  </div>

                  <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 pt-2 pb-2">
                    {caseTimeline.chronological_entries.map((entry) => {
                      const isExpanded = expandedPayloads[entry.step] || false
                      return (
                        <div key={entry.step} className="relative pl-6">
                          {/* Dot / Icon */}
                          <div className="absolute -left-[17px] top-0.5 bg-surface border-2 border-primary/40 rounded-full p-1 shadow-2xs">
                            {getStepIcon(entry.step_key)}
                          </div>

                          {/* Stage Content */}
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-primary">
                                  {entry.timestamp}
                                </span>
                                <span className="font-bold text-xs text-navy font-display">
                                  {entry.title}
                                </span>
                              </div>
                              {getActorBadge(entry.actor)}
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed">
                              {entry.summary}
                            </p>

                            {/* Payload Accordion */}
                            {entry.details && Object.keys(entry.details).length > 0 && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() => togglePayload(entry.step)}
                                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-hover font-bold transition-colors cursor-pointer"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                  <span>{isExpanded ? 'Hide Details' : 'View Details & Evidence'}</span>
                                </button>

                                {isExpanded && (
                                  <div className="mt-2 bg-navy text-slate-200 p-4 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800 shadow-md">
                                    <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-surface p-12 text-center rounded-2xl border border-border/80 text-slate-400 text-xs shadow-fintech-card">
                Select a recovery case on the left to inspect its complete 13-stage decision trail.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Global System Audit Log Ledger */
        <div className="space-y-4">
          <div className="bg-surface p-4 rounded-2xl border border-border/80 shadow-fintech-card flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search details, target resources, action types..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-xl text-navy focus:outline-none focus:border-primary shadow-2xs font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={filterActor}
                onChange={(e) => setFilterActor(e.target.value)}
                className="text-xs px-3 py-2 bg-surface border border-border rounded-xl text-navy focus:outline-none focus:border-primary shadow-2xs font-semibold"
              >
                <option value="ALL">All Actors</option>
                <option value="AUTONOMOUS_AGENT">Autonomous Agent</option>
                <option value="SYSTEM_GUARDRAIL">System Guardrails</option>
                <option value="MERCHANT_ADMIN">Merchant Admin</option>
                <option value="WEBHOOK_EVENT">Gateway Webhooks</option>
              </select>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-border/80 overflow-hidden shadow-fintech-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-border text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Actor</th>
                    <th className="py-3.5 px-4">Action Type</th>
                    <th className="py-3.5 px-4">Target Resource</th>
                    <th className="py-3.5 px-4">Event Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        No audit logs match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {formatTimeAgo(log.timestamp)}
                        </td>
                        <td className="py-3.5 px-4">
                          {getActorBadge(log.actor)}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-navy text-[11px]">
                          {log.actionType}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">
                          {log.targetResource}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 leading-relaxed font-medium">
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuditTrail
