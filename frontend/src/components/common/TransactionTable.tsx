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
  XCircle, 
  Cpu, 
  ShieldAlert, 
  CheckCircle2, 
  FileText,
  MessageSquare,
  Copy,
  Check,
  Globe
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
  const [aiExplanation, setAiExplanation] = useState<AIExplanationData | null>(null)
  const [aiMessage, setAiMessage] = useState<AIMessageData | null>(null)
  const [selectedLang, setSelectedLang] = useState<string>('EN')
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false)
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false)

  const getMethodIcon = (method: Transaction['method']) => {
    switch (method) {
      case 'UPI': return <Smartphone className="w-3.5 h-3.5 text-moss-green" />
      case 'Card': return <CreditCard className="w-3.5 h-3.5 text-burnt-orange" />
      case 'NetBanking': return <Building2 className="w-3.5 h-3.5 text-muted-amber" />
      case 'Wallet': return <Wallet className="w-3.5 h-3.5 text-warm-gray-600" />
      default: return <CreditCard className="w-3.5 h-3.5 text-warm-gray-600" />
    }
  }

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
      case 'PERSONALIZED_REMINDER': return 'Personalized Dunning'
      case 'WHATSAPP_CONCIERGE':
      case 'HUMAN_ESCALATION': return 'Concierge Escalation'
      case 'NO_ACTION': return 'No Action (Suppress)'
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
    setAiExplanation(null)
    setAiMessage(null)
    setLoadingAnalysis(true)
    setCopiedMessage(false)
    if (onSelectTransaction) onSelectTransaction(tx)

    try {
      const [resAnalysis, resExpl, resMsg] = await Promise.all([
        api.analyzeRecovery(tx.id),
        api.fetchAIExplanation(tx.id),
        api.fetchAIMessage(tx.id, selectedLang)
      ])
      setAnalysis(resAnalysis)
      setAiExplanation(resExpl)
      setAiMessage(resMsg)
    } catch (e) {
      console.error('Failed to load recovery decision analysis:', e)
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

  return (
    <div className="bg-surface rounded-md border border-border overflow-hidden shadow-fintech-card">
      {/* Optional Filters Bar */}
      {showFilters && (
        <div className="p-3.5 bg-warm-gray-50 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search order, customer, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-border rounded-sm text-xs text-graphite placeholder-warm-gray-400 focus:border-burnt-orange focus:outline-none w-full sm:w-64"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-warm-gray-600">
              <Filter className="w-3.5 h-3.5" />
              <span>Method:</span>
            </div>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="px-2.5 py-1.5 bg-surface border border-border rounded-sm text-xs text-graphite focus:outline-none focus:border-burnt-orange"
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
              className="px-2.5 py-1.5 bg-surface border border-border rounded-sm text-xs text-graphite focus:outline-none focus:border-burnt-orange"
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
            <tr className="bg-warm-gray-100/70 border-b border-border text-warm-gray-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Transaction</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4">Failure Diagnostic</th>
              <th className="py-3 px-4">Rec. Prob</th>
              <th className="py-3 px-4">Recommended Action</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Age</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-warm-gray-500">
                  No transactions match the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => handleRowClick(tx)}
                  className="hover:bg-warm-gray-50 transition-colors cursor-pointer group"
                >
                  {/* Transaction ID */}
                  <td className="py-3.5 px-4 font-mono font-medium text-graphite">
                    <div className="flex flex-col">
                      <span className="font-semibold text-graphite group-hover:text-burnt-orange transition-colors">
                        {tx.orderId}
                      </span>
                      <span className="text-[10px] text-warm-gray-400 font-normal">
                        {tx.id}
                      </span>
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-graphite">{tx.customer.name}</span>
                        {tx.customer.tier === 'VIP' && (
                          <span className="px-1 py-0.2 text-[9px] bg-muted-amber-light text-muted-amber-dark font-bold rounded-sm">
                            VIP
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-warm-gray-500 truncate max-w-[140px]">
                        {tx.customer.email}
                      </span>
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="py-3.5 px-4 font-mono">
                    <MoneyValue amount={tx.amount} />
                  </td>

                  {/* Method */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      {getMethodIcon(tx.method)}
                      <span className="font-medium text-warm-gray-700">{tx.method}</span>
                    </div>
                  </td>

                  {/* Failure Diagnostic */}
                  <td className="py-3.5 px-4 max-w-[200px]">
                    <div className="flex flex-col">
                      <span className="text-graphite font-medium truncate text-[11px]" title={tx.failureReason}>
                        {tx.failureReason}
                      </span>
                      <span className="text-[10px] text-warm-gray-500 uppercase tracking-tight">
                        {tx.failureCategory.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>

                  {/* Recovery Probability */}
                  <td className="py-3.5 px-4">
                    <ProbabilityBar value={tx.recoveryProbability} />
                  </td>

                  {/* Recommended Action */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium bg-warm-gray-100 text-warm-gray-800 border border-border">
                      <Sparkles className="w-3 h-3 text-burnt-orange" />
                      {getStrategyLabel(tx.recommendedAction)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <StatusBadge status={tx.status} />
                  </td>

                  {/* Age */}
                  <td className="py-3.5 px-4 text-[11px] text-warm-gray-500 font-mono tabular-nums whitespace-nowrap">
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
                      className="p-1 rounded-sm text-warm-gray-400 hover:text-burnt-orange hover:bg-warm-gray-200 transition-colors inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-burnt-orange"
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
          className="fixed inset-0 z-50 bg-graphite/40 backdrop-blur-sm flex items-center justify-end animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-tx-title"
        >
          <div className="w-full max-w-2xl h-full bg-surface border-l border-border shadow-fintech-modal p-6 overflow-y-auto flex flex-col justify-between">
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="modal-tx-title" className="text-base font-bold text-graphite font-display">
                      {selectedTx.orderId}
                    </h3>
                    <StatusBadge status={selectedTx.status} />
                  </div>
                  <p className="text-xs text-warm-gray-500 font-mono mt-0.5">ID: {selectedTx.id}</p>
                </div>
                <button
                  type="button"
                  aria-label="Close transaction details drawer"
                  onClick={() => setSelectedTx(null)}
                  className="p-1.5 text-warm-gray-400 hover:text-graphite rounded-sm hover:bg-warm-gray-200 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Financial Snapshot & ERV */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-warm-gray-50 p-3.5 rounded-sm border border-border">
                  <span className="text-[11px] text-warm-gray-500 uppercase tracking-wider block">At-Risk Amount</span>
                  <div className="text-lg font-bold text-graphite mt-1 font-mono">
                    <MoneyValue amount={selectedTx.amount} />
                  </div>
                </div>

                <div className="bg-moss-green-subtle p-3.5 rounded-sm border border-moss-green/20">
                  <span className="text-[11px] text-moss-green-dark uppercase tracking-wider block">Expected Recovery Value (ERV)</span>
                  <div className="text-lg font-bold text-moss-green mt-1 font-mono">
                    <MoneyValue amount={analysis ? analysis.expected_recovery_value : selectedTx.erv} />
                  </div>
                </div>

                <div className="bg-warm-gray-50 p-3.5 rounded-sm border border-border">
                  <span className="text-[11px] text-warm-gray-500 uppercase tracking-wider block">Recovery Score</span>
                  <div className="text-lg font-bold text-graphite mt-1 font-mono">
                    {((analysis ? analysis.recovery_probability : selectedTx.recoveryProbability) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Failure Diagnosis Card */}
              {analysis?.diagnosis && (
                <div className="p-3.5 bg-surface border border-border rounded-sm space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-graphite uppercase text-[11px] tracking-wider text-warm-gray-500">
                      Failure Diagnosis
                    </span>
                    <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono font-semibold bg-burnt-orange-light text-burnt-orange-dark border border-burnt-orange/30">
                      {analysis.diagnosis.taxonomy}
                    </span>
                  </div>
                  <p className="text-warm-gray-700 leading-relaxed font-sans">
                    {analysis.diagnosis.description}
                  </p>
                </div>
              )}

              {/* Strategy Comparison Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-graphite text-xs flex items-center gap-1.5 font-display">
                    <Cpu className="w-3.5 h-3.5 text-burnt-orange" />
                    <span>Strategy Comparison & ERV Ranking</span>
                  </h4>
                  <span className="text-[11px] text-warm-gray-500 font-mono">
                    Optimizing: P(a) × Amt − Cost − Friction
                  </span>
                </div>

                {loadingAnalysis ? (
                  <div className="py-6 text-center text-warm-gray-500 font-mono text-xs">
                    Evaluating candidate actions and calculating ERV...
                  </div>
                ) : (
                  <div className="border border-border rounded-sm overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-warm-gray-100/70 border-b border-border text-[11px] text-warm-gray-600 font-semibold uppercase">
                          <th className="py-2.5 px-3">Rank</th>
                          <th className="py-2.5 px-3">Action</th>
                          <th className="py-2.5 px-3">Propensity</th>
                          <th className="py-2.5 px-3">ERV</th>
                          <th className="py-2.5 px-3">Cost / Friction</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {(analysis?.strategies_comparison || []).map((s) => {
                          const isSelected = s.action === analysis?.selected_action
                          return (
                            <tr 
                              key={s.action} 
                              className={`transition-colors ${
                                isSelected ? 'bg-moss-green-subtle/40 font-medium' : 'hover:bg-warm-gray-50'
                              } ${!s.allowed ? 'opacity-60 bg-warm-gray-100/50' : ''}`}
                            >
                              <td className="py-2.5 px-3 font-mono font-bold text-graphite text-[11px]">
                                #{s.rank}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  {isSelected && <Sparkles className="w-3.5 h-3.5 text-burnt-orange shrink-0" />}
                                  <span className={isSelected ? 'font-bold text-moss-green-dark' : 'text-graphite'}>
                                    {getStrategyLabel(s.action)}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                {(s.probability * 100).toFixed(1)}%
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-graphite">
                                ₹{s.expected_recovery_value.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-warm-gray-500 text-[11px]">
                                ₹{s.cost} / ₹{s.friction_penalty}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                                {s.allowed ? (
                                  <span className="inline-flex items-center gap-1 text-moss-green font-medium">
                                    <CheckCircle2 className="w-3 h-3" /> Permitted
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-brick-red" title={s.guardrail_reason}>
                                    <ShieldAlert className="w-3 h-3" /> Blocked
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
                <div className="p-4 bg-warm-gray-50 border border-border rounded-sm space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-graphite font-display text-xs">
                    <FileText className="w-3.5 h-3.5 text-burnt-orange" />
                    <span>Deterministic Factual Evidence</span>
                  </div>
                  <ul className="space-y-1.5 text-warm-gray-700">
                    {analysis.evidence.map((ev, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-burnt-orange mt-1.5 shrink-0" />
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Decision Rationale & Multi-Lingual Communications Card */}
              <div className="p-4 bg-surface border border-border rounded-sm space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-1.5 font-bold text-graphite font-display text-xs">
                    <MessageSquare className="w-3.5 h-3.5 text-moss-green" />
                    <span>Decision Rationale & Customer Communications</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] bg-warm-gray-200 text-warm-gray-800 rounded-xs font-mono">
                    Gemini 2.5 Flash
                  </span>
                </div>

                {/* Operator Executive Summary */}
                {aiExplanation?.summary && (
                  <div className="p-3 bg-warm-gray-50 rounded-sm border border-border text-warm-gray-800 leading-relaxed font-sans">
                    <span className="text-[10px] text-warm-gray-500 uppercase tracking-wider block font-semibold mb-1">
                      Executive Operator Rationale
                    </span>
                    <p>{aiExplanation.summary}</p>
                  </div>
                )}

                {/* Multi-Lingual Customer Message Preview */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-graphite uppercase tracking-wider flex items-center gap-1">
                      <Globe className="w-3 h-3 text-warm-gray-500" />
                      <span>Customer Message Preview</span>
                    </span>

                    {/* Language Selector */}
                    <div className="flex items-center bg-warm-gray-100 p-0.5 rounded-xs border border-border text-[11px]">
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
                          className={`px-2 py-0.5 rounded-xs font-medium transition-colors ${
                            selectedLang === lang.code
                              ? 'bg-graphite text-surface shadow-xs'
                              : 'text-warm-gray-600 hover:text-graphite'
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {aiMessage && (
                    <div className="p-3.5 bg-dark-surface text-surface rounded-sm border border-warm-gray-700 shadow-sm space-y-2 font-mono text-[11px]">
                      <div className="flex items-center justify-between border-b border-warm-gray-700 pb-2">
                        <span className="text-moss-green font-semibold">{aiMessage.headline}</span>
                        <button
                          type="button"
                          onClick={handleCopyMessage}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-warm-gray-800 hover:bg-warm-gray-700 text-warm-gray-300 text-[10px] transition-colors"
                        >
                          {copiedMessage ? (
                            <>
                              <Check className="w-3 h-3 text-moss-green" />
                              <span className="text-moss-green font-bold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Text</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-warm-gray-200 leading-relaxed font-sans text-xs">
                        {aiMessage.message_body}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-warm-gray-800 text-[10px] text-warm-gray-400">
                        <span>Action: {aiMessage.call_to_action}</span>
                        <span className="text-burnt-orange-light">Channel: {aiMessage.channel_recommended}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-4 border-t border-border flex items-center gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-3 py-2 border border-border rounded-sm text-xs font-medium text-warm-gray-700 hover:bg-warm-gray-100 transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  const act = analysis?.selected_action || selectedTx.recommendedAction
                  alert(`Autonomous recovery strategy "${getStrategyLabel(act)}" successfully executed for ${selectedTx.orderId}!`)
                  setSelectedTx(null)
                }}
                className="px-4 py-2 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-sm text-xs font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange"
              >
                Execute {getStrategyLabel(analysis?.selected_action || selectedTx.recommendedAction)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
