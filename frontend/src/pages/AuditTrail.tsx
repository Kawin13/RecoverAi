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

    const unsubscribe = subscribe('*', () => {
      fetchCases(true)
      fetchAuditLogs(true)
    })
    return unsubscribe
  }, [subscribe])

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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-medium bg-burnt-orange-light text-burnt-orange-dark border border-burnt-orange/30">
            <Bot className="w-3 h-3" /> Autonomous Agent
          </span>
        )
      case 'SYSTEM_GUARDRAIL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-medium bg-muted-amber-light text-muted-amber-dark border border-muted-amber/30">
            <Shield className="w-3 h-3" /> System Guardrail
          </span>
        )
      case 'MERCHANT_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-medium bg-moss-green-light text-moss-green-dark border border-moss-green/30">
            <User className="w-3 h-3" /> Customer / Admin
          </span>
        )
      case 'WEBHOOK_EVENT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-medium bg-warm-gray-200 text-warm-gray-800 border border-border">
            <Webhook className="w-3 h-3" /> Gateway Webhook
          </span>
        )
    }
  }

  const getStepIcon = (stepKey: string) => {
    switch (stepKey) {
      case 'PAYMENT_EVENT_RECEIVED':
        return <AlertCircle className="w-4 h-4 text-burnt-orange" />
      case 'FAILURE_DIAGNOSED':
        return <Activity className="w-4 h-4 text-muted-amber" />
      case 'FEATURES_CALCULATED':
        return <Sliders className="w-4 h-4 text-graphite" />
      case 'MODEL_VERSION':
        return <Cpu className="w-4 h-4 text-burnt-orange" />
      case 'PROBABILITIES_GENERATED':
        return <Calculator className="w-4 h-4 text-graphite" />
      case 'ERV_VALUES':
        return <CheckCircle2 className="w-4 h-4 text-moss-green" />
      case 'STRATEGY_SELECTED':
        return <CheckCircle2 className="w-4 h-4 text-burnt-orange" />
      case 'GUARDRAIL_RESULT':
        return <ShieldCheck className="w-4 h-4 text-moss-green" />
      case 'LLM_EXPLANATION':
        return <Sparkles className="w-4 h-4 text-burnt-orange" />
      case 'ACTION_EXECUTED':
        return <Send className="w-4 h-4 text-graphite" />
      case 'CUSTOMER_INTERACTION':
        return <Smartphone className="w-4 h-4 text-muted-amber" />
      case 'PAYMENT_RESULT':
        return <CreditCard className="w-4 h-4 text-moss-green" />
      case 'CASE_CLOSED':
        return <CheckCircle2 className="w-4 h-4 text-moss-green" />
      default:
        return <Clock className="w-4 h-4 text-warm-gray-500" />
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
    <div className="space-y-6">
      {/* Header & Tabs */}
      <SectionHeader
        title="Audit Trail & Decision Traceability Console"
        subtitle="Chronological, second-by-second forensic record of autonomous decisions, guardrails, and financial settlements"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-warm-gray-100 p-1 rounded-sm border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('CASES')}
                className={`px-3 py-1 text-xs font-medium rounded-xs transition-colors ${
                  activeTab === 'CASES'
                    ? 'bg-burnt-orange text-white shadow-xs'
                    : 'text-warm-gray-600 hover:text-graphite'
                }`}
              >
                Case Forensics Timeline (13 Stages)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('GLOBAL_LOGS')}
                className={`px-3 py-1 text-xs font-medium rounded-xs transition-colors ${
                  activeTab === 'GLOBAL_LOGS'
                    ? 'bg-burnt-orange text-white shadow-xs'
                    : 'text-warm-gray-600 hover:text-graphite'
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
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface hover:bg-warm-gray-100 border border-border text-graphite rounded-sm text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="bg-surface p-6 rounded-md border border-border">
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
            <div className="bg-surface p-3 rounded-md border border-border shadow-fintech-card space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-warm-gray-400" />
                <input
                  type="text"
                  placeholder="Search Tx ID, Customer, Order..."
                  value={caseSearch}
                  onChange={(e) => setCaseSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchCases(false)}
                  className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-warm-gray-50 border border-border rounded-sm text-graphite focus:outline-none focus:border-burnt-orange"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <select
                  value={caseStatusFilter}
                  onChange={(e) => setCaseStatusFilter(e.target.value)}
                  className="w-full text-xs px-2 py-1 bg-surface border border-border rounded-sm text-graphite focus:outline-none focus:border-burnt-orange"
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
                  className="px-2.5 py-1 bg-warm-gray-100 hover:bg-warm-gray-200 border border-border text-xs rounded-sm text-graphite"
                >
                  Filter
                </button>
              </div>
            </div>

            {/* Cases List */}
            <div className="bg-surface rounded-md border border-border shadow-fintech-card divide-y divide-border/60 max-h-[700px] overflow-y-auto">
              {cases.length === 0 ? (
                <div className="p-6 text-center text-xs text-warm-gray-500">
                  No recovery cases match the search criteria.
                </div>
              ) : (
                cases.map((c) => {
                  const isSelected = selectedCaseId === c.case_id
                  return (
                    <div
                      key={c.case_id}
                      onClick={() => setSelectedCaseId(c.case_id)}
                      className={`p-3.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-burnt-orange-light/30 border-l-4 border-l-burnt-orange'
                          : 'hover:bg-warm-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-graphite font-display">
                          {c.customer_name}
                        </span>
                        <span className="font-mono text-xs font-bold text-graphite">
                          ₹{c.amount.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-warm-gray-500 mb-1.5">
                        <span className="font-mono">{c.order_id}</span>
                        <span className="px-1.5 py-0.2 bg-warm-gray-100 border border-border text-[10px] rounded-xs font-mono">
                          {c.payment_method}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-xs text-[10px] font-mono bg-warm-gray-100 text-warm-gray-700">
                          {c.failure_reason}
                        </span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-xs text-[10px] font-bold ${
                            c.status === 'RECOVERED'
                              ? 'bg-moss-green-light text-moss-green-dark'
                              : c.status === 'IN_PROGRESS'
                              ? 'bg-muted-amber-light text-muted-amber-dark'
                              : 'bg-warm-gray-200 text-warm-gray-700'
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
              <div className="bg-surface p-6 rounded-md border border-border shadow-fintech-card">
                <SkeletonLoader variant="card" count={3} />
              </div>
            ) : caseTimeline ? (
              <>
                {/* Case Header Card */}
                <div className="bg-surface p-4 rounded-md border border-border shadow-fintech-card space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-graphite font-display">
                          {caseTimeline.customer_name}
                        </h2>
                        <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-bold bg-burnt-orange-light text-burnt-orange-dark border border-burnt-orange/30">
                          {caseTimeline.customer_tier}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-xs text-[11px] font-bold ${
                            caseTimeline.status === 'RECOVERED'
                              ? 'bg-moss-green-light text-moss-green-dark'
                              : 'bg-muted-amber-light text-muted-amber-dark'
                          }`}
                        >
                          {caseTimeline.status}
                        </span>
                      </div>
                      <p className="text-xs text-warm-gray-500 font-mono mt-0.5">
                        Case ID: {caseTimeline.case_id} • Order: {caseTimeline.order_id}
                      </p>
                    </div>

                    {/* Actions: Copy Tx ID & Export JSON */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyTxId(caseTimeline.transaction_id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-surface hover:bg-warm-gray-100 border border-border rounded-sm text-xs font-medium text-graphite transition-colors shadow-xs"
                      >
                        {copiedTxId ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-moss-green" />
                            <span className="text-moss-green font-semibold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-warm-gray-500" />
                            <span>Copy Tx ID</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleExportJSON}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-graphite hover:bg-graphite/90 text-white rounded-sm text-xs font-medium transition-colors shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Audit (JSON)</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-warm-gray-500 block text-[10px] uppercase font-semibold">At-Risk Amount</span>
                      <span className="font-mono font-bold text-graphite">
                        ₹{caseTimeline.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-warm-gray-500 block text-[10px] uppercase font-semibold">Recovery Likelihood</span>
                      <span className="font-mono font-bold text-moss-green-dark">
                        {Math.round(caseTimeline.recovery_probability * 100)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-warm-gray-500 block text-[10px] uppercase font-semibold">Expected Net ERV</span>
                      <span className="font-mono font-bold text-moss-green-dark">
                        ₹{caseTimeline.expected_recovery_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-warm-gray-500 block text-[10px] uppercase font-semibold">Selected Strategy</span>
                      <span className="font-medium text-graphite truncate block">
                        {caseTimeline.selected_strategy.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Security Redaction Guarantee Banner */}
                <div className="bg-moss-green-light/40 border border-moss-green/30 rounded-md p-3 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-moss-green-dark mt-0.5 shrink-0" />
                  <div className="text-xs text-moss-green-dark leading-relaxed">
                    <span className="font-bold">PCI-DSS & RBI Digital Governance Compliance: </span>
                    All raw payment credentials, CVVs, and gateway API keys are strictly redacted.
                    Card instruments are masked (<code className="font-mono">**** 4242</code>). Every autonomous decision is fully reproducible and traceable.
                  </div>
                </div>

                {/* The 13 Chronological Audit Stages Timeline */}
                <div className="bg-surface p-5 rounded-md border border-border shadow-fintech-card space-y-4">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <h3 className="text-sm font-bold text-graphite font-display">
                      Chronological Decision Chain (13 Traceable Events)
                    </h3>
                    <span className="text-xs font-mono text-warm-gray-500">
                      Precision Second-by-Second Logging
                    </span>
                  </div>

                  <div className="relative border-l-2 border-border/80 ml-4 space-y-6 pt-2 pb-2">
                    {caseTimeline.chronological_entries.map((entry) => {
                      const isExpanded = expandedPayloads[entry.step] || false
                      return (
                        <div key={entry.step} className="relative pl-6">
                          {/* Dot / Icon */}
                          <div className="absolute -left-[17px] top-0.5 bg-surface border-2 border-border rounded-full p-1 shadow-xs">
                            {getStepIcon(entry.step_key)}
                          </div>

                          {/* Stage Content */}
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-burnt-orange">
                                  {entry.timestamp}
                                </span>
                                <span className="font-semibold text-xs text-graphite">
                                  {entry.title}
                                </span>
                              </div>
                              {getActorBadge(entry.actor)}
                            </div>

                            <p className="text-xs text-warm-gray-600 leading-relaxed">
                              {entry.summary}
                            </p>

                            {/* Payload Accordion */}
                            {entry.details && Object.keys(entry.details).length > 0 && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() => togglePayload(entry.step)}
                                  className="inline-flex items-center gap-1 text-[11px] text-warm-gray-500 hover:text-graphite transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                  <span>{isExpanded ? 'Hide Details' : 'View Details & Evidence'}</span>
                                </button>

                                {isExpanded && (
                                  <div className="mt-1.5 bg-warm-gray-900 text-warm-gray-200 p-3 rounded-sm font-mono text-[11px] overflow-x-auto border border-warm-gray-800">
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
              <div className="bg-surface p-12 text-center rounded-md border border-border text-warm-gray-500 text-xs">
                Select a recovery case on the left to inspect its complete 13-stage decision trail.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Global System Audit Log Ledger */
        <div className="space-y-4">
          <div className="bg-surface p-4 rounded-md border border-border shadow-fintech-card flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-warm-gray-400" />
              <input
                type="text"
                placeholder="Search details, target resources, action types..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-warm-gray-50 border border-border rounded-sm text-graphite focus:outline-none focus:border-burnt-orange"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-warm-gray-500" />
              <select
                value={filterActor}
                onChange={(e) => setFilterActor(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-surface border border-border rounded-sm text-graphite focus:outline-none focus:border-burnt-orange"
              >
                <option value="ALL">All Actors</option>
                <option value="AUTONOMOUS_AGENT">Autonomous Agent</option>
                <option value="SYSTEM_GUARDRAIL">System Guardrails</option>
                <option value="MERCHANT_ADMIN">Merchant Admin</option>
                <option value="WEBHOOK_EVENT">Gateway Webhooks</option>
              </select>
            </div>
          </div>

          <div className="bg-surface rounded-md border border-border overflow-hidden shadow-fintech-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-warm-gray-100/70 border-b border-border text-warm-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action Type</th>
                    <th className="py-3 px-4">Target Resource</th>
                    <th className="py-3 px-4">Event Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-warm-gray-500">
                        No audit logs match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-warm-gray-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-warm-gray-500 whitespace-nowrap">
                          {formatTimeAgo(log.timestamp)}
                        </td>
                        <td className="py-3 px-4">
                          {getActorBadge(log.actor)}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-graphite text-[11px]">
                          {log.actionType}
                        </td>
                        <td className="py-3 px-4 font-mono text-warm-gray-600 text-[11px]">
                          {log.targetResource}
                        </td>
                        <td className="py-3 px-4 text-warm-gray-700 leading-relaxed">
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
