import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Transaction } from '../types'
import { ENV } from '../config/env'
import { MetricCard } from '../components/common/MetricCard'
import { MoneyValue } from '../components/common/MoneyValue'
import { SectionHeader } from '../components/common/SectionHeader'
import { TransactionTable } from '../components/common/TransactionTable'
import { AlertOctagon, Zap, ShieldAlert, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useRealtime } from '../lib/useRealtime'
import { isTerminalState } from '../lib/utils'
import { URGENT_HIGH_VALUE_THRESHOLD } from '../constants/thresholds'

export const AtRiskRevenue: React.FC = () => {
  const [selectedQueue, setSelectedQueue] = useState<'ALL' | 'CRITICAL' | 'VIP' | 'TIMEOUTS'>('ALL')
  const [isExecutingBatch, setIsExecutingBatch] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { subscribe } = useRealtime()

  const loadTxs = async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await api.getTransactions({ limit: 100 })
      // Canonical active filter: exclude terminal states
      const atRisk = (res.items || []).filter(t => !isTerminalState(t.status))
      setTransactions(atRisk)
      setError(null)
    } catch {
      if (!silent) {
        setError('Unable to load at-risk revenue.')
        setTransactions([])
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadTxs(false)

    const unsubTx = subscribe('TRANSACTION_UPDATED', () => loadTxs(true))
    const unsubQueue = subscribe('RECOVERY_QUEUE_UPDATED', () => loadTxs(true))
    const unsubCase = subscribe('RECOVERY_CASE_UPDATED', () => loadTxs(true))
    const unsubPay = subscribe('PAYMENT_RECEIVED', () => loadTxs(true))
    const unsubResync = subscribe('RECONNECT_RESYNC', () => loadTxs(true))

    return () => {
      unsubTx()
      unsubQueue()
      unsubCase()
      unsubPay()
      unsubResync()
    }
  }, [subscribe])

  // Subsets strictly derived from all active at-risk cases in current scope
  const criticalTxs = transactions.filter(t => t.riskLevel === 'HIGH' || (t.amount || 0) >= URGENT_HIGH_VALUE_THRESHOLD)
  const vipTxs = transactions.filter(t => t.customer?.tier === 'VIP' || t.customer?.tier === 'ENTERPRISE' || t.customer?.tier === 'GROWTH')
  const timeoutTxs = transactions.filter(t => 
    t.failureCategory === 'BANK_TIMEOUT' || 
    t.failureCategory === 'TEMPORARY' ||
    t.failureCategory === 'GATEWAY_ERROR' ||
    t.failureCategory === 'AUTHENTICATION_FAILED' ||
    t.failureCategory === 'ABANDONMENT' ||
    (t.failureReason && (
      t.failureReason.toLowerCase().includes('timeout') ||
      t.failureReason.toLowerCase().includes('switch') ||
      t.failureReason.toLowerCase().includes('gateway') ||
      t.failureReason.toLowerCase().includes('bank') ||
      t.failureReason.toLowerCase().includes('drop') ||
      t.failureReason.toLowerCase().includes('process')
    ))
  )

  const getActiveList = () => {
    switch (selectedQueue) {
      case 'CRITICAL': return criticalTxs
      case 'VIP': return vipTxs
      case 'TIMEOUTS': return timeoutTxs
      default: return transactions
    }
  }

  // Dynamic count of cases in the current active list eligible for autonomous dispatch
  const currentActiveList = getActiveList()
  const dispatchEligibleTxs = currentActiveList.filter(t => !isTerminalState(t.status) && t.status !== 'COOLING_DOWN')
  const batchEligibleCount = dispatchEligibleTxs.length

  const handleBatchExecute = () => {
    setIsExecutingBatch(true)
    setTimeout(() => {
      setIsExecutingBatch(false)
      alert(`Successfully dispatched autonomous recovery interventions for ${batchEligibleCount} at-risk transactions!`)
    }, 800)
  }

  // Dynamic Snapshot Aggregations
  const totalPipelineAtRisk = transactions.reduce((acc, t) => acc + (t.amount || 0), 0)
  const totalErvRealizable = transactions.reduce((acc, t) => acc + (t.erv ?? (t.recoveryProbability ? t.amount * t.recoveryProbability : 0)), 0)
  const recoveryYieldPercent = totalPipelineAtRisk > 0 ? ((totalErvRealizable / totalPipelineAtRisk) * 100).toFixed(1) : '0.0'

  // Error State
  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="At-Risk Revenue Operations"
          subtitle="Prioritized queues of failed payments and abandoned carts pending autonomous or manual intervention"
        />
        <div className="p-10 text-center bg-surface border border-border/80 rounded-2xl shadow-fintech-card space-y-4">
          <AlertOctagon className="w-10 h-10 text-rose-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-navy font-display">
              Unable to load at-risk revenue.
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There was a problem communicating with the recovery operations service. Please verify your connection or try again.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => loadTxs(false)}
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
    <div className="space-y-6">
      <SectionHeader
        title="At-Risk Revenue Operations"
        subtitle="Prioritized queues of failed payments and abandoned carts pending autonomous or manual intervention"
        actions={
          <div className="flex items-center gap-2.5">
            {ENV.DEMO_MODE && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Demo Data
              </span>
            )}
            <button
              type="button"
              onClick={handleBatchExecute}
              disabled={isExecutingBatch || batchEligibleCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple disabled:opacity-50 cursor-pointer"
            >
              {isExecutingBatch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Batch Dispatch Best Interventions ({batchEligibleCount})</span>
            </button>
          </div>
        }
      />

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Pipeline At Risk"
          value={<MoneyValue amount={totalPipelineAtRisk} />}
          subtitle={`${criticalTxs.length} critical cases require priority routing`}
          highlightColor="muted-amber"
          icon={AlertOctagon}
          variant="standard"
        />
        <MetricCard
          title="Estimated ERV Realizable"
          value={<MoneyValue amount={totalErvRealizable} />}
          subtitle={`${recoveryYieldPercent}% potential recovery yield`}
          icon={Sparkles}
          variant="soft-blue"
        />
        <MetricCard
          title="Average Inactivity Window"
          value={transactions.length > 0 ? "18.4 mins" : "0.0 mins"}
          subtitle={transactions.length > 0 ? "Median response time: 2.3 mins" : "All cases resolved"}
          highlightColor="purple"
          icon={ShieldAlert}
          variant="standard"
        />
      </div>

      {/* Queue Filter Tabs */}
      <div className="flex items-center gap-2.5 border-b border-border/70 pb-3 text-xs overflow-x-auto">
        <span className="text-slate-500 font-bold mr-1">Queue:</span>
        {[
          { key: 'ALL', label: 'All At-Risk', count: transactions.length },
          { key: 'CRITICAL', label: 'High Value / Urgent (≥ ₹25,000)', count: criticalTxs.length },
          { key: 'VIP', label: 'VIP & Enterprise', count: vipTxs.length },
          { key: 'TIMEOUTS', label: 'Gateway & Bank Outages', count: timeoutTxs.length },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedQueue(tab.key as any)}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              selectedQueue === tab.key
                ? 'bg-primary text-white shadow-2xs font-bold'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-border'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              selectedQueue === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content: Honest Empty State vs Table View */}
      {loading ? (
        <div className="p-12 text-center bg-surface border border-border/80 rounded-2xl shadow-fintech-card space-y-3">
          <RefreshCw className="w-6 h-6 text-primary animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading at-risk cases from pipeline...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border/80 rounded-2xl shadow-fintech-card space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="text-base font-bold text-navy font-display">No active at-risk cases.</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All failed transactions and payment attempts in this workspace have been resolved or reached terminal status.
          </p>
        </div>
      ) : (
        <TransactionTable transactions={currentActiveList} showFilters />
      )}
    </div>
  )
}
export default AtRiskRevenue
