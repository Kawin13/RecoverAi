import React, { useState, useEffect } from 'react'
import { SectionHeader } from '../components/common/SectionHeader'
import { MetricCard } from '../components/common/MetricCard'
import { api, GuardrailPolicyRuleItem, HumanApprovalQueueItem, WhyStoppedForensicResponse, WorkflowCase } from '../services/api'
import { HUMAN_APPROVAL_THRESHOLD } from '../constants/thresholds'
import { useRealtime } from '../lib/useRealtime'
import { useAuth } from '../context/AuthContext'
import { formatINR, formatTimeAgo } from '../lib/utils'

import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  UserCheck,
  XCircle,
  AlertTriangle,
  AlertOctagon,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react'

export const Guardrails: React.FC = () => {
  const { status } = useRealtime()
  const { role, user, profile } = useAuth()
  const isConnected = status === 'LIVE'

  // State
  const [policies, setPolicies] = useState<GuardrailPolicyRuleItem[]>([])
  const [policySummary, setPolicySummary] = useState<any>(null)
  const [approvalQueue, setApprovalQueue] = useState<HumanApprovalQueueItem[]>([])
  const [recentCases, setRecentCases] = useState<WorkflowCase[]>([])
  const [selectedForensicCaseId, setSelectedForensicCaseId] = useState<string>('')
  const [forensics, setForensics] = useState<WhyStoppedForensicResponse | null>(null)
  
  // Operator Input
  const [operatorName, setOperatorName] = useState(profile?.full_name || user?.user_metadata?.full_name || 'Administrator')
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Section Header */}
      <SectionHeader
        title="Fintech Safety Guardrails & Human Governance"
        subtitle="Enforce strict rate limits, fraud safety controls, customer DND protection, and pre-execution human supervisor approvals"
        actions={
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface border border-border rounded-full text-xs font-mono font-semibold text-navy shadow-2xs">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {policySummary?.policy_version || '2026.08-fintech-v1'}
            </span>
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface hover:bg-slate-50 border border-border text-navy rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Policy State</span>
            </button>
          </div>
        }
      />

      {/* Temporary Success Banner */}
      {bannerMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 flex items-center justify-between text-xs animate-in fade-in duration-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{bannerMessage}</span>
          </div>
          <button onClick={() => setBannerMessage(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Governance Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Safety Controls"
          value={`${policySummary?.enabled_rules ?? 8}/${policySummary?.total_rules ?? 8}`}
          subtitle="Pre-execution safety gates active (100% Enforced)"
          highlightColor="purple"
          icon={ShieldCheck}
          variant="standard"
        />
        <MetricCard
          title="Human Approval Queue"
          value={approvalQueue.length}
          subtitle={`Human Threshold (≥ ₹${HUMAN_APPROVAL_THRESHOLD.toLocaleString('en-IN')})`}
          highlightColor="purple"
          icon={UserCheck}
          variant="standard"
        />
        <MetricCard
          title="Customer DND Rate Limit"
          value="Max 3 / 24h"
          subtitle="Prevents customer message spam"
          highlightColor="purple"
          icon={Lock}
          variant="standard"
        />
        <MetricCard
          title="Payment Protection"
          value="Zero Tamper"
          subtitle="Exact original amount enforced"
          icon={AlertOctagon}
          variant="soft-blue"
        />
      </div>

      {/* SECTION 1: Human Approval Queue */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-fintech-card overflow-hidden">
        <div className="p-5 border-b border-border/80 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-navy font-display">Supervisor Sign-Off Queue</h3>
              <span className="px-2.5 py-0.5 bg-primary-light text-primary border border-primary-border text-[10px] font-mono font-bold rounded-full">
                {approvalQueue.length} PENDING
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Transactions meeting or exceeding the Human Approval Threshold (≥ ₹{HUMAN_APPROVAL_THRESHOLD.toLocaleString('en-IN')}) or requiring explicit supervisor guardrails are held for review before dispatch.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-semibold">Acting Operator:</label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Operator Badge/Name"
              className="px-3 py-1.5 text-xs border border-border rounded-xl bg-white font-mono text-navy focus:outline-none focus:border-primary shadow-2xs"
            />
          </div>
        </div>

        {approvalQueue.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            <ShieldCheck className="w-9 h-9 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-bold text-navy text-sm">Approval Queue is Clear</p>
            <p className="text-slate-500 mt-1 max-w-md mx-auto">
              No transactions currently require human supervisor sign-off. Orders below ₹{HUMAN_APPROVAL_THRESHOLD.toLocaleString('en-IN')} proceed autonomously unless an explicit guardrail requires manual approval.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {approvalQueue.map((item) => (
              <div key={item.case_id} className="p-5 hover:bg-slate-50/50 transition-colors space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-navy">{item.case_id}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs font-bold text-navy">{item.customer_name}</span>
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-border rounded-full text-slate-700">
                        {item.customer_tier}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">({item.customer_phone})</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>Failure: <strong className="text-rose-600">{item.failure_category}</strong></span>
                      <span>·</span>
                      <span>AI Recommendation: <strong className="text-primary">{item.selected_strategy}</strong> via {item.channel}</span>
                      <span>·</span>
                      <span>ERV: <strong className="text-navy">{formatINR(item.expected_recovery_value)}</strong> ({(item.recovery_probability * 100).toFixed(0)}% likelihood)</span>
                    </div>

                    <div className="text-[11px] text-amber-700 flex items-center gap-1.5 pt-0.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                      <span>{item.human_readable_reason}</span>
                    </div>
                  </div>

                  {/* Monetary Amount - Strictly Read-Only */}
                  <div className="flex flex-col md:items-end flex-shrink-0 bg-surface-blue/50 p-3 rounded-xl border border-surface-blue-border">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                      <Lock className="w-3 h-3 text-primary" />
                      <span>Payment Amount (Protected & Locked)</span>
                    </div>
                    <div className="text-base font-bold font-mono text-navy mt-0.5">
                      {formatINR(item.amount)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Ref: {item.order_id || item.transaction_id}
                    </div>
                  </div>
                </div>

                {/* Operator Actions Bar */}
                {role === 'admin' ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/60">
                    <input
                      type="text"
                      placeholder="Optional supervisor notes / rationale..."
                      value={operatorNotes}
                      onChange={(e) => setOperatorNotes(e.target.value)}
                      className="flex-1 max-w-md px-3 py-1.5 text-xs border border-border rounded-xl bg-white text-navy focus:outline-none focus:border-primary shadow-2xs"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDecision(item.case_id, 'APPROVE')}
                        disabled={actionInProgress !== null}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-fintech-purple transition-all disabled:opacity-50 cursor-pointer"
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
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {actionInProgress === `${item.case_id}_REJECT` ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        <span>Reject</span>
                      </button>

                      <button
                        onClick={() => handleDecision(item.case_id, 'NO_ACTION')}
                        disabled={actionInProgress !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <span>No Action</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/60">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Supervisory review is required before recovering this transaction.</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-border text-slate-700 rounded-xl text-xs font-semibold select-none">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Awaiting Administrator Approval</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: "Why Was This Stopped?" Forensic Inspector */}
      <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-navy font-display">
                "Why Was This Stopped?" Forensic Inspection
              </h3>
              <span className="px-2.5 py-0.5 bg-primary-light text-primary text-[10px] font-mono font-bold rounded-full border border-primary-border">
                Explainability
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
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
              className="px-3 py-2 text-xs border border-border rounded-xl bg-white font-mono text-navy focus:outline-none focus:border-primary shadow-2xs font-semibold"
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
              className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-fintech-purple transition-all cursor-pointer disabled:opacity-50"
            >
              {forensicsLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Inspect</span>
            </button>
          </div>
        </div>

        {forensics ? (
          <div className="space-y-4 pt-1">
            {/* Verdict Card */}
            <div className={`p-5 rounded-2xl border ${
              forensics.status === 'STOPPED' 
                ? 'bg-rose-50/80 border-rose-200' 
                : forensics.status === 'PENDING_APPROVAL' 
                ? 'bg-amber-50/80 border-amber-200' 
                : 'bg-emerald-50/80 border-emerald-200'
            }`}>
              <div className="flex items-start gap-3.5">
                <ShieldAlert className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  forensics.status === 'STOPPED' ? 'text-rose-600' : 'text-amber-600'
                }`} />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm font-display text-navy">
                      Decision Outcome: {forensics.status}
                    </span>
                    <span className="font-mono text-xs px-2.5 py-0.5 bg-white rounded-full border border-border font-bold text-navy shadow-2xs">
                      Rule: {forensics.rule_breached}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    {forensics.human_readable_reason}
                  </p>
                </div>
              </div>
            </div>

            {/* Forensic Attribute Matrix */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-border">
                <span className="text-[11px] text-slate-500 font-semibold">Customer DND Opt-Out</span>
                <div className="mt-1 font-bold font-mono flex items-center gap-1.5">
                  {forensics.customer_opted_out ? (
                    <span className="text-rose-600 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> DND REGISTERED
                    </span>
                  ) : (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Opted-In (Clean)
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-border">
                <span className="text-[11px] text-slate-500 font-semibold">Fraud & Risk Marker</span>
                <div className="mt-1 font-bold font-mono flex items-center gap-1.5">
                  {forensics.fraud_flag_detected ? (
                    <span className="text-rose-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> FRAUD DETECTED
                    </span>
                  ) : (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Normal Risk Profile
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-border">
                <span className="text-[11px] text-slate-500 font-semibold">Attempts vs Ceiling</span>
                <div className="mt-1 font-bold font-mono text-navy">
                  {forensics.attempt_count} of {forensics.max_attempts} attempts used
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-border">
                <span className="text-[11px] text-slate-500 font-semibold">Policy Framework</span>
                <div className="mt-1 font-bold font-mono text-navy">
                  {forensics.policy_version}
                </div>
              </div>
            </div>

            {/* Audit Trail Timeline */}
            {forensics.audit_events && forensics.audit_events.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-2 font-display">
                  Pre-Stop Audit History
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {forensics.audit_events.map((evt) => (
                    <div key={evt.id} className="text-xs p-3 bg-slate-50 rounded-xl border border-border flex items-start gap-2.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="font-mono font-bold text-navy">{evt.actor}</span>
                        <span className="text-slate-300 mx-1.5">·</span>
                        <span className="text-slate-600">{evt.details}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                        {formatTimeAgo(evt.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400">
            Select any case above to view its forensic policy verification log.
          </div>
        )}
      </div>

      {/* SECTION 3: Central Policy Configuration Registry */}
      <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <h3 className="text-base font-bold text-navy font-display">
              Central Guardrail Policies & Active Thresholds
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Default fintech guardrails protecting merchants against infinite retry penalties, compliance breaches, and customer dunning fatigue.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((rule) => (
            <div
              key={rule.id}
              className="p-5 rounded-2xl border border-border/80 bg-surface shadow-2xs space-y-3 flex flex-col justify-between hover:border-primary/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-navy font-display">{rule.name}</h4>
                  <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase bg-primary-light text-primary rounded-full border border-primary-border">
                    {rule.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{rule.description}</p>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[11px] text-slate-400">Threshold: </span>
                  <span className="font-bold font-mono text-navy">{rule.threshold_display}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400">Action: </span>
                  <strong className="text-rose-600 font-mono text-[11px]">
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

export default Guardrails
