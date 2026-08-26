import React, { useState, useEffect } from 'react'
import { SectionHeader } from '../components/common/SectionHeader'
import { api, GuardrailPolicyRuleItem, HumanApprovalQueueItem, WhyStoppedForensicResponse, WorkflowCase } from '../services/api'
import { useRealtime } from '../lib/useRealtime'
import { formatINR, formatTimeAgo } from '../lib/utils'
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  UserCheck,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2
} from 'lucide-react'

export const Guardrails: React.FC = () => {
  const { status } = useRealtime()
  const isConnected = status === 'LIVE'

  // State
  const [policies, setPolicies] = useState<GuardrailPolicyRuleItem[]>([])
  const [policySummary, setPolicySummary] = useState<any>(null)
  const [approvalQueue, setApprovalQueue] = useState<HumanApprovalQueueItem[]>([])
  const [recentCases, setRecentCases] = useState<WorkflowCase[]>([])
  const [selectedForensicCaseId, setSelectedForensicCaseId] = useState<string>('')
  const [forensics, setForensics] = useState<WhyStoppedForensicResponse | null>(null)
  
  // Operator Input
  const [operatorName, setOperatorName] = useState('Risk Supervisor')
  const [operatorNotes, setOperatorNotes] = useState('')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [forensicsLoading, setForensicsLoading] = useState(false)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true)
      const [policiesRes, queueRes, workflowsRes] = await Promise.all([
        api.getGuardrailPolicies().catch(() => null),
        api.getApprovalQueue().catch(() => []),
        api.getWorkflows(50).catch(() => ({ workflows: [] }))
      ])

      if (policiesRes) {
        setPolicies(policiesRes.rules)
        setPolicySummary(policiesRes.summary)
      }

      setApprovalQueue(queueRes || [])
      setRecentCases(workflowsRes.workflows || [])

      // Auto-select first stopped case or approval case for forensics
      if (!selectedForensicCaseId && workflowsRes.workflows?.length > 0) {
        const stopped = workflowsRes.workflows.find((w: WorkflowCase) => w.status === 'STOPPED' || w.status === 'PENDING_APPROVAL')
        if (stopped) {
          setSelectedForensicCaseId(stopped.id)
          loadForensics(stopped.id)
        }
      }
    } catch (err) {
      console.error('Failed to load guardrail governance data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 8000)
    return () => clearInterval(interval)
  }, [])

  const loadForensics = async (caseId: string) => {
    if (!caseId) return
    try {
      setForensicsLoading(true)
      const data = await api.getWhyStoppedForensics(caseId)
      setForensics(data)
    } catch (err) {
      console.error('Failed to fetch forensics:', err)
      setForensics(null)
    } finally {
      setForensicsLoading(false)
    }
  }

  const handleDecision = async (caseId: string, decision: 'APPROVE' | 'REJECT' | 'NO_ACTION') => {
    try {
      setActionInProgress(`${caseId}_${decision}`)
      await api.submitApprovalDecision(caseId, {
        decision,
        operator_name: operatorName || 'Risk Officer',
        operator_notes: operatorNotes || `Operator ${decision.toLowerCase()} via Guardrail Console`
      })
      setBannerMessage(`Case ${caseId} decision '${decision}' successfully executed and logged to audit trail.`)
      setTimeout(() => setBannerMessage(null), 5000)
      setOperatorNotes('')
      await fetchData()
      if (selectedForensicCaseId === caseId) {
        await loadForensics(caseId)
      }
    } catch (err: any) {
      alert(`Decision submission failed: ${err.message}`)
    } finally {
      setActionInProgress(null)
    }
  }

  // Aggregate stats
  const gatedVolumeINR = approvalQueue.reduce((acc, q) => acc + q.amount, 0)

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Section Header */}
      <SectionHeader
        title="Fintech Safety Guardrails & Human Governance"
        subtitle="Enforce strict rate limits, fraud circuit breakers, customer DND protection, and pre-execution human supervisor approvals"
        actions={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface border border-border rounded-sm text-xs font-mono text-graphite">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-warm-gray-400'}`} />
              {policySummary?.policy_version || '2026.08-fintech-v1'}
            </span>
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-warm-gray-50 border border-border text-graphite rounded-sm text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Policy State</span>
            </button>
          </div>
        }
      />

      {/* Temporary Success Banner */}
      {bannerMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-md p-3.5 flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{bannerMessage}</span>
          </div>
          <button onClick={() => setBannerMessage(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Governance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-md border border-border p-4 shadow-fintech-card">
          <div className="flex items-center justify-between text-xs text-warm-gray-600">
            <span>Circuit Breakers</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-graphite">
              {policySummary?.enabled_rules ?? 8}/{policySummary?.total_rules ?? 8}
            </span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-xs border border-emerald-200">
              100% Enforced
            </span>
          </div>
          <div className="text-[11px] text-warm-gray-500 mt-1">Pre-execution gates active</div>
        </div>

        <div className="bg-surface rounded-md border border-border p-4 shadow-fintech-card">
          <div className="flex items-center justify-between text-xs text-warm-gray-600">
            <span>Human Approval Queue</span>
            <UserCheck className="w-4 h-4 text-burnt-orange" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-graphite">{approvalQueue.length}</span>
            {approvalQueue.length > 0 && (
              <span className="text-[11px] font-semibold text-burnt-orange bg-burnt-orange/10 px-1.5 py-0.5 rounded-xs border border-burnt-orange/30 animate-pulse">
                Action Required
              </span>
            )}
          </div>
          <div className="text-[11px] text-warm-gray-500 mt-1">Gated orders awaiting supervisor sign-off</div>
        </div>

        <div className="bg-surface rounded-md border border-border p-4 shadow-fintech-card">
          <div className="flex items-center justify-between text-xs text-warm-gray-600">
            <span>High-Value Gated Volume</span>
            <AlertTriangle className="w-4 h-4 text-muted-amber" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-graphite">{formatINR(gatedVolumeINR)}</span>
          </div>
          <div className="text-[11px] text-warm-gray-500 mt-1">Orders ≥ ₹10,000 threshold</div>
        </div>

        <div className="bg-surface rounded-md border border-border p-4 shadow-fintech-card">
          <div className="flex items-center justify-between text-xs text-warm-gray-600">
            <span>Amount Immutability</span>
            <Lock className="w-4 h-4 text-warm-gray-700" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm font-bold font-mono text-emerald-700">LOCKED & VERIFIED</span>
          </div>
          <div className="text-[11px] text-warm-gray-500 mt-1">Operators cannot modify monetary values</div>
        </div>
      </div>

      {/* SECTION 1: Human Approval Queue */}
      <div className="bg-surface rounded-md border border-border shadow-fintech-card overflow-hidden">
        <div className="p-4 border-b border-border bg-warm-gray-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-graphite font-display">Human Approval Queue</h3>
              <span className="px-2 py-0.5 bg-burnt-orange/10 text-burnt-orange border border-burnt-orange/30 text-[10px] font-mono font-bold rounded-xs">
                {approvalQueue.length} PENDING
              </span>
            </div>
            <p className="text-xs text-warm-gray-600 mt-0.5">
              High-value transactions (≥ ₹10,000) diverted for supervisor sign-off before any external link or notification is generated.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-warm-gray-600 font-medium">Acting Operator:</label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Operator Badge/Name"
              className="px-2.5 py-1 text-xs border border-border rounded-sm bg-white font-mono text-graphite focus:outline-none focus:ring-1 focus:ring-burnt-orange"
            />
          </div>
        </div>

        {approvalQueue.length === 0 ? (
          <div className="p-8 text-center text-xs text-warm-gray-500">
            <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-medium text-graphite">Approval Queue is Clear</p>
            <p className="text-warm-gray-500 mt-1">
              No high-ticket transactions are currently waiting for human intervention. Bounded autonomous recovery is operating within safe parameters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {approvalQueue.map((item) => (
              <div key={item.case_id} className="p-4 hover:bg-warm-gray-50/50 transition-colors space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-graphite">{item.case_id}</span>
                      <span className="text-warm-gray-400">·</span>
                      <span className="text-xs font-semibold text-graphite">{item.customer_name}</span>
                      <span className="px-1.5 py-0.2 text-[10px] font-mono bg-warm-gray-100 border border-border rounded-xs text-warm-gray-700">
                        {item.customer_tier}
                      </span>
                      <span className="text-[11px] text-warm-gray-500 font-mono">({item.customer_phone})</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-warm-gray-600">
                      <span>Failure: <strong className="text-brick-red-dark">{item.failure_category}</strong></span>
                      <span>·</span>
                      <span>AI Recommendation: <strong className="text-forest-green">{item.selected_strategy}</strong> via {item.channel}</span>
                      <span>·</span>
                      <span>ERV: <strong className="text-graphite">{formatINR(item.expected_recovery_value)}</strong> ({(item.recovery_probability * 100).toFixed(0)}% propensity)</span>
                    </div>

                    <div className="text-[11px] text-muted-amber-dark flex items-center gap-1.5 pt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{item.human_readable_reason}</span>
                    </div>
                  </div>

                  {/* Monetary Amount - Strictly Read-Only */}
                  <div className="flex flex-col md:items-end flex-shrink-0 bg-warm-gray-50 p-2.5 rounded-sm border border-border">
                    <div className="flex items-center gap-1.5 text-[11px] text-warm-gray-500">
                      <Lock className="w-3 h-3 text-warm-gray-700" />
                      <span>Order Value (Immutable)</span>
                    </div>
                    <div className="text-base font-bold font-mono text-graphite mt-0.5">
                      {formatINR(item.amount)}
                    </div>
                    <div className="text-[10px] text-warm-gray-400 font-mono">
                      Ref: {item.order_id || item.transaction_id}
                    </div>
                  </div>
                </div>

                {/* Operator Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/60">
                  <input
                    type="text"
                    placeholder="Optional supervisor notes / rationale..."
                    value={operatorNotes}
                    onChange={(e) => setOperatorNotes(e.target.value)}
                    className="flex-1 max-w-md px-2.5 py-1 text-xs border border-border rounded-sm bg-white text-graphite focus:outline-none focus:ring-1 focus:ring-burnt-orange"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDecision(item.case_id, 'APPROVE')}
                      disabled={actionInProgress !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                    >
                      {actionInProgress === `${item.case_id}_APPROVE` ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Approve & Dispatch</span>
                    </button>

                    <button
                      onClick={() => handleDecision(item.case_id, 'REJECT')}
                      disabled={actionInProgress !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brick-red hover:bg-brick-red-dark text-white rounded-sm text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                    >
                      {actionInProgress === `${item.case_id}_REJECT` ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      <span>Reject Intervention</span>
                    </button>

                    <button
                      onClick={() => handleDecision(item.case_id, 'NO_ACTION')}
                      disabled={actionInProgress !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-warm-gray-200 hover:bg-warm-gray-300 text-graphite rounded-sm text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <span>Change to No Action</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: "Why Was This Stopped?" Forensic Inspector */}
      <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-graphite font-display">
                "Why Was This Stopped?" Forensic Inspection
              </h3>
              <span className="px-2 py-0.5 bg-warm-gray-100 text-warm-gray-700 text-[10px] font-mono rounded-xs border border-border">
                Forensic Explainability
              </span>
            </div>
            <p className="text-xs text-warm-gray-600 mt-0.5">
              Inspect root causes for suppressed, gated, or halted cases. Answers regulatory compliance and customer inquiry audits.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedForensicCaseId}
              onChange={(e) => {
                setSelectedForensicCaseId(e.target.value)
                loadForensics(e.target.value)
              }}
              className="px-2.5 py-1.5 text-xs border border-border rounded-sm bg-white font-mono text-graphite focus:outline-none focus:ring-1 focus:ring-burnt-orange"
            >
              <option value="">Select Case to Inspect...</option>
              {recentCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.status} ({formatINR(c.risk_amount)})
                </option>
              ))}
            </select>

            <button
              onClick={() => loadForensics(selectedForensicCaseId)}
              disabled={!selectedForensicCaseId || forensicsLoading}
              className="px-3 py-1.5 bg-surface hover:bg-warm-gray-100 border border-border text-graphite text-xs font-medium rounded-sm inline-flex items-center gap-1"
            >
              {forensicsLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Inspect</span>
            </button>
          </div>
        </div>

        {forensics ? (
          <div className="space-y-4 pt-1">
            {/* Verdict Card */}
            <div className={`p-4 rounded-md border ${
              forensics.status === 'STOPPED' 
                ? 'bg-brick-red-subtle border-brick-red/30' 
                : forensics.status === 'PENDING_APPROVAL' 
                ? 'bg-muted-amber-subtle border-muted-amber/30' 
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-start gap-3">
                <ShieldAlert className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  forensics.status === 'STOPPED' ? 'text-brick-red' : 'text-muted-amber-dark'
                }`} />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm font-display text-graphite">
                      Decision Outcome: {forensics.status}
                    </span>
                    <span className="font-mono text-xs px-2 py-0.2 bg-white/80 rounded-xs border border-border">
                      Rule: {forensics.rule_breached}
                    </span>
                  </div>
                  <p className="text-xs text-warm-gray-800 font-medium">
                    {forensics.human_readable_reason}
                  </p>
                </div>
              </div>
            </div>

            {/* Forensic Attribute Matrix */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-warm-gray-50 rounded-sm border border-border">
                <span className="text-[11px] text-warm-gray-500">Customer DND Opt-Out</span>
                <div className="mt-1 font-bold font-mono flex items-center gap-1.5">
                  {forensics.customer_opted_out ? (
                    <span className="text-brick-red flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> DND REGISTERED
                    </span>
                  ) : (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Opted-In (Clean)
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-warm-gray-50 rounded-sm border border-border">
                <span className="text-[11px] text-warm-gray-500">Fraud & Risk Marker</span>
                <div className="mt-1 font-bold font-mono flex items-center gap-1.5">
                  {forensics.fraud_flag_detected ? (
                    <span className="text-brick-red flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> FRAUD DETECTED
                    </span>
                  ) : (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Normal Risk Profile
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-warm-gray-50 rounded-sm border border-border">
                <span className="text-[11px] text-warm-gray-500">Attempts vs Ceiling</span>
                <div className="mt-1 font-bold font-mono text-graphite">
                  {forensics.attempt_count} of {forensics.max_attempts} attempts used
                </div>
              </div>

              <div className="p-3 bg-warm-gray-50 rounded-sm border border-border">
                <span className="text-[11px] text-warm-gray-500">Policy Framework</span>
                <div className="mt-1 font-bold font-mono text-graphite">
                  {forensics.policy_version}
                </div>
              </div>
            </div>

            {/* Audit Trail Timeline */}
            {forensics.audit_events && forensics.audit_events.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-bold text-graphite uppercase tracking-wider mb-2">
                  Pre-Stop Audit History
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {forensics.audit_events.map((evt) => (
                    <div key={evt.id} className="text-xs p-2 bg-warm-gray-50 rounded-sm border border-border/80 flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-warm-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="font-mono font-semibold text-graphite">{evt.actor}</span>
                        <span className="text-warm-gray-400 mx-1.5">·</span>
                        <span className="text-warm-gray-700">{evt.details}</span>
                      </div>
                      <span className="text-[10px] text-warm-gray-400 font-mono flex-shrink-0">
                        {formatTimeAgo(evt.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-warm-gray-500">
            Select any case above to view its forensic policy verification log.
          </div>
        )}
      </div>

      {/* SECTION 3: Central Policy Configuration Registry */}
      <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-4">
        <div>
          <h3 className="text-base font-bold text-graphite font-display">
            Central Guardrail Policies & Active Thresholds
          </h3>
          <p className="text-xs text-warm-gray-600 mt-0.5">
            Default fintech guardrails protecting merchants against infinite retry penalties, compliance breaches, and customer dunning fatigue.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((rule) => (
            <div
              key={rule.id}
              className="p-4 rounded-md border border-border bg-white shadow-xs space-y-2 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-graphite font-display">{rule.name}</h4>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-warm-gray-100 text-warm-gray-700 rounded-xs border border-border">
                    {rule.category}
                  </span>
                </div>
                <p className="text-xs text-warm-gray-600 mt-1 leading-relaxed">{rule.description}</p>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                <div>
                  <span className="text-[11px] text-warm-gray-500">Threshold: </span>
                  <span className="font-bold font-mono text-graphite">{rule.threshold_display}</span>
                </div>
                <div>
                  <span className="text-[11px] text-warm-gray-500">Action: </span>
                  <strong className="text-brick-red-dark font-mono text-[11px]">
                    {rule.action_on_breach}
                  </strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
