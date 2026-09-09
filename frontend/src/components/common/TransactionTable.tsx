import React, { useState } from 'react'
import { Transaction } from '../../types'
import { MoneyValue } from './MoneyValue'
import { StatusBadge } from './StatusBadge'
import { ProbabilityBar } from './ProbabilityBar'
import { formatTimeAgo } from '../../lib/utils'
import { 
  api, 
  RecoveryAnalysisResponse, 
  AIExplanationData, 
  AIMessageData 
} from '../../services/api'
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  Wallet, 
  Sparkles, 
  ChevronRight, 
  Filter, 
  X, 
  Cpu, 
  FileText,
  MessageSquare,
  Copy,
  Check,
  Globe,
  Info,
  Loader2,
  AlertCircle
} from 'lucide-react'

interface TransactionTableProps {
  transactions: Transaction[]
  onSelectTransaction?: (tx: Transaction) => void
  showFilters?: boolean
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  onSelectTransaction,
  showFilters = false
}) => {
  const [filterMethod, setFilterMethod] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  
  const [analysis, setAnalysis] = useState<RecoveryAnalysisResponse | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [aiExplanation, setAiExplanation] = useState<AIExplanationData | null>(null)
  const [aiMessage, setAiMessage] = useState<AIMessageData | null>(null)
  const [selectedLang, setSelectedLang] = useState<string>('EN')
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false)
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false)

  const getMethodIcon = (method: Transaction['method']) => {
    switch (method) {
      case 'UPI': return <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
      case 'Card': return <CreditCard className="w-3.5 h-3.5 text-primary" />
      case 'NetBanking': return <Building2 className="w-3.5 h-3.5 text-amber-600" />
      case 'Wallet': return <Wallet className="w-3.5 h-3.5 text-slate-500" />
      default: return <CreditCard className="w-3.5 h-3.5 text-slate-500" />
    }
  }

  // Canonical Strategy Display Mapping
  const getStrategyLabel = (strategy: string) => {
    switch (strategy) {
      case 'SMART_PAYLINK_1CLICK':
      case 'PAYMENT_LINK': return '1-Click Paylink'
      case 'UPI_INTENT_FALLBACK':
      case 'UPI_SWITCH': return 'UPI Switch'
      case 'TIMED_SMART_RETRY':
      case 'RETRY_LATER': return 'Timed Retry'
      case 'RETRY_NOW': return 'Immediate Retry'
      case 'INCENTIVIZED_DUNNING':
      case 'PERSONALIZED_REMINDER': return 'Personalized Reminder'
      case 'WHATSAPP_CONCIERGE':
      case 'HUMAN_ESCALATION': return 'Concierge Escalation'
      case 'NO_ACTION': return 'No Action'
      default: return strategy.replace(/_/g, ' ')
    }
  }

  const filtered = transactions.filter(tx => {
    if (filterMethod !== 'ALL' && tx.method !== filterMethod) return false
    if (filterStatus !== 'ALL' && tx.status !== filterStatus) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchName = tx.customer.name.toLowerCase().includes(q)
      const matchEmail = tx.customer.email.toLowerCase().includes(q)
      const matchOrder = tx.orderId.toLowerCase().includes(q)
      const matchId = tx.id.toLowerCase().includes(q)
      if (!matchName && !matchEmail && !matchOrder && !matchId) return false
    }
    return true
  })

  const handleRowClick = async (tx: Transaction) => {
    setSelectedTx(tx)
    setAnalysis(null)
    setAnalysisError(null)
    setAiExplanation(null)
    setAiMessage(null)
    setLoadingAnalysis(true)
    setCopiedMessage(false)
    if (onSelectTransaction) onSelectTransaction(tx)

    try {
      const [resAnalysis, resExpl, resMsg] = await Promise.allSettled([
        api.analyzeRecovery(tx.id),
        api.fetchAIExplanation(tx.id),
        api.fetchAIMessage(tx.id, selectedLang)
      ])
      if (resAnalysis.status === 'fulfilled') {
        setAnalysis(resAnalysis.value)
      } else {
        setAnalysisError('Recovery recommendation temporarily unavailable.')
      }
      if (resExpl.status === 'fulfilled') {
        setAiExplanation(resExpl.value)
      }
      if (resMsg.status === 'fulfilled') {
        setAiMessage(resMsg.value)
      }
    } catch {
      setAnalysisError('Recovery recommendation temporarily unavailable.')
    } finally {
      setLoadingAnalysis(false)
    }
  }

  const handleLanguageChange = async (lang: string) => {
    setSelectedLang(lang)
    if (selectedTx) {
      try {
        const msg = await api.fetchAIMessage(selectedTx.id, lang)
        setAiMessage(msg)
      } catch (e) {
        console.error('Failed to switch language:', e)
      }
    }
  }

  const handleCopyMessage = () => {
    if (aiMessage) {
      const fullText = `${aiMessage.headline}\n\n${aiMessage.message_body}\n\n[${aiMessage.call_to_action}]`
      navigator.clipboard.writeText(fullText)
      setCopiedMessage(true)
      setTimeout(() => setCopiedMessage(false), 2000)
    }
  }

  const selectedStrategyKey = analysis?.selected_action || (analysisError ? '' : (selectedTx?.recommendedAction || ''))
  const selectedStrategyDisplayName = analysis?.display_name || (selectedStrategyKey ? getStrategyLabel(selectedStrategyKey) : 'Temporarily Unavailable')

  return (
    <div className="bg-surface rounded-2xl border border-border/80 overflow-hidden shadow-fintech-card">
      {/* Optional Filters Bar */}
      {showFilters && (
        <div className="p-4 bg-slate-50/70 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search order, customer, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3.5 py-2 bg-surface border border-border rounded-xl text-xs text-navy placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none w-full sm:w-72 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span>Method:</span>
            </div>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-border rounded-xl text-xs text-navy font-medium focus:outline-none focus:border-primary shadow-2xs"
            >
              <option value="ALL">All Methods</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="NetBanking">NetBanking</option>
              <option value="Wallet">Wallet</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-border rounded-xl text-xs text-navy font-medium focus:outline-none focus:border-primary shadow-2xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RECOVERED">Recovered</option>
              <option value="PENDING_APPROVAL">Needs Approval</option>
              <option value="COOLING_DOWN">Cooling Down</option>
              <option value="ATTEMPTING">Attempting</option>
            </select>
          </div>
        </div>
      )}

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-border text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3.5 px-4 font-display">Transaction</th>
              <th className="py-3.5 px-4 font-display">Customer</th>
              <th className="py-3.5 px-4 font-display">Amount</th>
              <th className="py-3.5 px-4 font-display">Method</th>
              <th className="py-3.5 px-4 font-display">Failure Diagnostic</th>
              <th className="py-3.5 px-4 font-display" title="Overall Probability of recovery given transaction context P(recovery | context)">
                <div className="flex items-center gap-1 cursor-help">
                  <span>Recoverability</span>
                  <Info className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3.5 px-4 font-display">Recommended Action</th>
              <th className="py-3.5 px-4 font-display">Status</th>
              <th className="py-3.5 px-4 font-display">Age</th>
              <th className="py-3.5 px-4 text-right font-display">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                  No transactions match the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => handleRowClick(tx)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  {/* Transaction ID */}
                  <td className="py-3.5 px-4 font-mono font-medium text-navy">
                    <div className="flex flex-col">
                      <span className="font-bold text-navy group-hover:text-primary transition-colors">
                        {tx.orderId}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {tx.id}
                      </span>
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-navy">{tx.customer.name}</span>
                        {tx.customer.tier === 'VIP' && (
                          <span className="px-1.5 py-0.2 text-[9px] bg-amber-100 text-amber-800 font-bold rounded-full">
                            VIP
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                        {tx.customer.email}
                      </span>
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="py-3.5 px-4 font-mono font-bold text-navy">
                    <MoneyValue amount={tx.amount} />
                  </td>

                  {/* Method */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      {getMethodIcon(tx.method)}
                      <span className="font-medium text-slate-700">{tx.method}</span>
                    </div>
                  </td>

                  {/* Failure Diagnostic */}
                  <td className="py-3.5 px-4 max-w-[200px]">
                    <div className="flex flex-col">
                      <span className="text-navy font-semibold truncate text-[11px]" title={tx.failureReason}>
                        {tx.failureReason}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-tight font-mono">
                        {tx.failureCategory.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>

                  {/* Overall Recoverability */}
                  <td className="py-3.5 px-4">
                    <ProbabilityBar value={tx.recoveryProbability} />
                  </td>

                  {/* Recommended Action (Outlined chip with purple border and text) */}
                  <td className="py-3.5 px-4">
                    {tx.recommendedAction ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-primary-subtle text-primary border border-primary/40 shadow-2xs">
                        <Sparkles className="w-3 h-3 text-primary" />
                        {getStrategyLabel(tx.recommendedAction)}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">
                        Pending Analysis
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <StatusBadge status={tx.status} />
                  </td>

                  {/* Age */}
                  <td className="py-3.5 px-4 text-[11px] text-slate-500 font-mono tabular-nums whitespace-nowrap">
                    {formatTimeAgo(tx.createdAt)}
                  </td>

                  {/* Action Link */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      aria-label={`View details for transaction ${tx.orderId}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRowClick(tx)
                      }}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-primary hover:bg-primary-light transition-colors inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Decision Intelligence Drawer */}
      {selectedTx && (
        <div 
          className="fixed inset-0 z-50 bg-navy/50 backdrop-blur-sm flex items-center justify-end animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-tx-title"
        >
          <div className="w-full max-w-2xl h-full bg-surface sm:rounded-l-3xl border-l border-border shadow-fintech-modal p-6 sm:p-8 overflow-y-auto flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 id="modal-tx-title" className="text-lg font-bold text-navy font-display">
                      {selectedTx.orderId}
                    </h3>
                    <StatusBadge status={selectedTx.status} />
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {selectedTx.id}</p>
                </div>
                <button
                  type="button"
                  aria-label="Close transaction details drawer"
                  onClick={() => setSelectedTx(null)}
                  className="p-2 text-slate-400 hover:text-navy rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Financial Snapshot & Distinct Probability Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-slate-50 p-4 rounded-2xl border border-border">
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block">At-Risk Amount</span>
                  <div className="text-xl font-bold text-navy mt-1 font-mono">
                    <MoneyValue amount={selectedTx.amount} />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                    {analysis ? `Recovery Likelihood: ${(analysis.recovery_probability * 100).toFixed(1)}%` : selectedTx.recoveryProbability != null && !analysisError ? `Recovery Likelihood: ${(selectedTx.recoveryProbability * 100).toFixed(1)}%` : 'Recovery Likelihood: Unavailable'}
                  </span>
                </div>

                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200/70">
                  <span className="text-[11px] text-emerald-800 uppercase tracking-wider font-semibold block">Expected Recovery (ERV)</span>
                  <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
                    <MoneyValue amount={analysis ? analysis.expected_recovery_value : (analysisError ? 0 : (selectedTx.erv || 0))} />
                  </div>
                  <span className="text-[10px] text-emerald-700/80 font-mono mt-1 block">
                    Net Yield after cost/friction
                  </span>
                </div>

                <div className="bg-surface-blue p-4 rounded-2xl border border-surface-blue-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-600 uppercase tracking-wider font-semibold block">Strategy Success</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      analysis ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {analysis ? selectedStrategyDisplayName : analysisError ? 'Unavailable' : (selectedStrategyDisplayName || 'Pending')}
                    </span>
                  </div>
                  <div className="text-xl font-bold text-navy mt-1 font-mono">
                    {analysis ? `${(analysis.recovery_probability * 100).toFixed(1)}%` : '—'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    {analysisError ? 'Recommendation unavailable' : analysis ? `Likelihood (${selectedStrategyDisplayName})` : 'Analysis pending'}
                  </span>
                </div>
              </div>

              {/* Canonical Failure Diagnosis Card */}
              {analysisError ? (
                <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-2xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-900 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                      <span>Failure Diagnosis</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono text-rose-700 bg-rose-100 border border-rose-300">
                      {selectedTx.failureCategory && selectedTx.failureCategory !== 'UNKNOWN' ? selectedTx.failureCategory : 'UNAVAILABLE'}
                    </span>
                  </div>
                  <p className="text-rose-700 leading-relaxed font-sans text-xs">
                    Recovery recommendation temporarily unavailable. Detailed failure diagnosis could not be retrieved from the engine.
                  </p>
                </div>
              ) : analysis?.diagnosis ? (
                <div className="p-4 bg-surface border border-border rounded-2xl space-y-2 text-xs shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                      <span>Failure Diagnosis</span>
                      {analysis.diagnosis.human_readable_reason && (
                        <span className="text-slate-600 font-normal text-xs">
                          — {analysis.diagnosis.human_readable_reason}
                        </span>
                      )}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-light text-primary border border-primary-border">
                      {analysis.diagnosis.taxonomy || analysis.diagnosis.failure_category}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed font-sans">
                    {analysis.diagnosis.description || 'Payment processing issue diagnosed.'}
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-surface border border-border rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                      <span>Failure Diagnosis</span>
                      {selectedTx.failureReason && (
                        <span className="text-slate-600 font-normal text-xs">
                          — {selectedTx.failureReason}
                        </span>
                      )}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200">
                      {selectedTx.failureCategory || 'UNKNOWN'}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed font-sans">
                    {selectedTx.failureReason || 'Awaiting recovery engine diagnosis...'}
                  </p>
                </div>
              )}

              {/* Strategy Comparison Table */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-navy text-xs flex items-center gap-2 font-display">
                    <Cpu className="w-4 h-4 text-primary" />
                    <span>Strategy Comparison & ERV Ranking</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Expected Value Optimization
                  </span>
                </div>

                {analysisError ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-border text-center space-y-2">
                    <AlertCircle className="w-5 h-5 text-rose-500 mx-auto" />
                    <p className="text-xs font-bold text-navy">Recovery recommendation temporarily unavailable.</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Could not retrieve algorithmic strategy rankings or ML scoring from the recovery engine.
                    </p>
                  </div>
                ) : loadingAnalysis ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-border text-center space-y-2">
                    <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto" />
                    <p className="text-xs text-slate-600 font-medium">Simulating candidate recovery actions...</p>
                  </div>
                ) : (
                  <div className="border border-border/80 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-border text-slate-500 font-semibold text-[10px] uppercase">
                        <tr>
                          <th className="p-3">Candidate Strategy</th>
                          <th className="p-3">Likelihood</th>
                          <th className="p-3">Cost</th>
                          <th className="p-3">Net ERV</th>
                          <th className="p-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                        {(analysis?.strategies_comparison || []).map((s) => {
                          const isSelected = s.action === analysis?.selected_action || s.action_code === analysis?.selected_action
                          const displayName = s.display_name || s.action.replace(/_/g, ' ')
                          return (
                            <tr
                              key={s.action}
                              className={`transition-colors ${
                                isSelected ? 'bg-primary-subtle/80 font-medium' : 'hover:bg-slate-50/60'
                              } ${!s.allowed ? 'opacity-60 bg-slate-50/40' : ''}`}
                            >
                              <td className="p-3 font-sans">
                                <div className="flex items-center gap-2">
                                  {isSelected && <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />}
                                  <span className={isSelected ? 'font-bold text-primary' : 'text-navy font-medium'}>
                                    {displayName}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 font-bold">
                                {(s.probability * 100).toFixed(1)}%
                              </td>
                              <td className="p-3 text-slate-500">
                                ₹{s.cost.toFixed(2)}
                              </td>
                              <td className="p-3 font-bold text-emerald-600">
                                <MoneyValue amount={s.expected_recovery_value} />
                              </td>
                              <td className="p-3 text-right">
                                {isSelected ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-primary text-white font-sans font-bold shadow-2xs">
                                    #1 Pick
                                  </span>
                                ) : s.allowed ? (
                                  <span className="text-[10px] text-slate-400 font-sans">
                                    Alternative
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-rose-600 font-sans font-medium" title={s.guardrail_reason}>
                                    Gated
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Factual Evidence Object */}
              {analysis?.evidence && analysis.evidence.length > 0 && (
                <div className="p-4 bg-slate-50 border border-border rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-navy font-display text-xs">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>Decision Evidence</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-600">
                    {analysis.evidence.map((ev, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Decision Rationale & Multi-Lingual Communications Card */}
              <div className="p-5 bg-surface border border-border rounded-2xl space-y-3.5 text-xs shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2 font-bold text-navy font-display text-xs">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span>AI Explanation & Customer Communications</span>
                  </div>
                  <span className="px-2.5 py-0.5 text-[10px] bg-primary-light text-primary border border-primary-border rounded-full font-mono font-bold">
                    AI Assistant
                  </span>
                </div>

                {/* Operator Executive Summary */}
                {aiExplanation?.summary && (
                  <div className="p-3.5 bg-surface-blue/50 rounded-xl border border-surface-blue-border text-navy leading-relaxed font-sans">
                    <span className="text-[10px] text-primary uppercase tracking-wider block font-bold mb-1">
                      Operator AI Explanation
                    </span>
                    <p>{aiExplanation.summary}</p>
                  </div>
                )}

                {/* Multi-Lingual Customer Message Preview */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-500" />
                      <span>Customer Message Preview</span>
                    </span>

                    {/* Language Selector */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-border text-[11px]">
                      {[
                        { code: 'EN', label: 'English' },
                        { code: 'HI', label: 'हिन्दी' },
                        { code: 'HINGLISH', label: 'Hinglish' },
                        { code: 'TA', label: 'தமிழ்' }
                      ].map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => handleLanguageChange(lang.code)}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                            selectedLang === lang.code
                              ? 'bg-white text-primary shadow-xs font-bold'
                              : 'text-slate-500 hover:text-navy'
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {aiMessage ? (
                    <div className="p-4 bg-navy text-white rounded-2xl border border-navy-light/60 shadow-fintech-subtle space-y-2.5 font-mono text-[11px]">
                      <div className="flex items-center justify-between border-b border-navy-light/60 pb-2.5">
                        <span className="text-emerald-400 font-bold">{aiMessage.headline}</span>
                        <button
                          type="button"
                          onClick={handleCopyMessage}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-navy-light hover:bg-navy-subtle text-slate-200 text-[10px] transition-colors cursor-pointer"
                        >
                          {copiedMessage ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-bold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Text</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-slate-200 leading-relaxed font-sans text-xs">
                        {aiMessage.message_body}
                      </p>

                      <div className="flex items-center justify-between pt-2.5 border-t border-navy-light/60 text-[10px] text-slate-400">
                        <span>Action CTA: <strong className="text-white font-semibold">{aiMessage.call_to_action}</strong></span>
                        <span className="text-primary-light font-medium">Channel: {aiMessage.channel_recommended}</span>
                      </div>
                    </div>
                  ) : !loadingAnalysis && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-border text-center text-xs text-slate-500">
                      Customer message template temporarily unavailable.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-5 border-t border-border flex items-center gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2.5 border border-border rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  alert(`Autonomous recovery strategy "${selectedStrategyDisplayName}" successfully executed for ${selectedTx.orderId}!`)
                  setSelectedTx(null)
                }}
                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
              >
                Execute {selectedStrategyDisplayName}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
