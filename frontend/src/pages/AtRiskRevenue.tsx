import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Transaction } from '../types'
import { mockTransactions, mockMetrics } from '../data/mockData'
import { MetricCard } from '../components/common/MetricCard'
import { MoneyValue } from '../components/common/MoneyValue'
import { SectionHeader } from '../components/common/SectionHeader'
import { TransactionTable } from '../components/common/TransactionTable'
import { AlertOctagon, Zap, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react'
import { useRealtime } from '../lib/useRealtime'

export const AtRiskRevenue: React.FC = () => {
  const [selectedQueue, setSelectedQueue] = useState<'ALL' | 'CRITICAL' | 'VIP' | 'TIMEOUTS'>('ALL')
  const [isExecutingBatch, setIsExecutingBatch] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions)
  const { subscribe } = useRealtime()

  const loadTxs = async () => {
    try {
      const res = await api.getTransactions({ limit: 100 })
      if (res.items && res.items.length > 0) {
        // Filter transactions needing attention (not yet RECOVERED)
        const atRisk = res.items.filter(t => t.status !== 'RECOVERED')
        setTransactions(atRisk.length > 0 ? atRisk : res.items)
      }
    } catch {
      // Fallback gracefully
    }
  }

  useEffect(() => {
    loadTxs()
    const unsubscribe = subscribe('*', () => {
      loadTxs()
    })
    return unsubscribe
  }, [subscribe])

  const criticalTxs = transactions.filter(t => t.riskLevel === 'HIGH' || t.amount > 50000)
  const vipTxs = transactions.filter(t => t.customer.tier === 'VIP' || t.customer.tier === 'ENTERPRISE')
  const timeoutTxs = transactions.filter(t => t.failureCategory === 'BANK_TIMEOUT' || t.failureCategory === 'AUTHENTICATION_FAILED')

  const getActiveList = () => {
    switch (selectedQueue) {
      case 'CRITICAL': return criticalTxs
      case 'VIP': return vipTxs
      case 'TIMEOUTS': return timeoutTxs
      default: return transactions
    }
  }

  const handleBatchExecute = () => {
    setIsExecutingBatch(true)
    setTimeout(() => {
      setIsExecutingBatch(false)
      alert(`Successfully dispatched autonomous recovery interventions for ${getActiveList().length} at-risk transactions!`)
    }, 800)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="At-Risk Revenue Operations"
        subtitle="Prioritized queues of failed payments and abandoned carts pending autonomous or manual intervention"
        actions={
          <button
            type="button"
            onClick={handleBatchExecute}
            disabled={isExecutingBatch}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-sm text-xs font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange disabled:opacity-50"
          >
            {isExecutingBatch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span>Batch Dispatch Best Interventions ({getActiveList().length})</span>
          </button>
        }
      />

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Pipeline At Risk"
          value={<MoneyValue amount={mockMetrics.revenueAtRisk} />}
          subtitle="8 critical cases require priority routing"
          highlightColor="burnt-orange"
          icon={AlertOctagon}
        />
        <MetricCard
          title="Estimated ERV Realizable"
          value={<MoneyValue amount={498200} />}
          subtitle="73.1% potential recovery yield"
          highlightColor="moss-green"
          icon={Sparkles}
        />
        <MetricCard
          title="Average Inactivity Window"
          value="18.4 mins"
          subtitle="Median response time: 2.3 mins"
          highlightColor="muted-amber"
          icon={ShieldAlert}
        />
      </div>

      {/* Queue Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
        <span className="text-warm-gray-500 font-medium mr-2">Queue:</span>
        {[
          { key: 'ALL', label: 'All At-Risk', count: mockTransactions.length },
          { key: 'CRITICAL', label: 'High Value / Urgent', count: criticalTxs.length },
          { key: 'VIP', label: 'VIP & Enterprise', count: vipTxs.length },
          { key: 'TIMEOUTS', label: 'Gateway & Bank Outages', count: timeoutTxs.length },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedQueue(tab.key as any)}
            className={`px-3 py-1.5 rounded-sm font-medium transition-colors flex items-center gap-1.5 ${
              selectedQueue === tab.key
                ? 'bg-graphite text-surface font-semibold shadow-xs'
                : 'bg-surface text-warm-gray-600 hover:text-graphite border border-border'
            }`}
          >
            <span>{tab.label}</span>
            <span className="px-1.5 py-0.2 bg-warm-gray-700/20 rounded-xs text-[10px] font-mono">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table view */}
      <TransactionTable transactions={getActiveList()} showFilters />
    </div>
  )
}
