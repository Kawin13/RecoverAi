import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Transaction } from '../types'
import { SectionHeader } from '../components/common/SectionHeader'
import { TransactionTable } from '../components/common/TransactionTable'
import { SkeletonLoader } from '../components/common/SkeletonLoader'
import { ErrorState } from '../components/common/ErrorState'
import { Download, RefreshCw } from 'lucide-react'
import { useRealtime } from '../lib/useRealtime'

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { subscribe } = useRealtime()

  const fetchTransactions = async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await api.getTransactions({ limit: 50 })
      setTransactions(res.items)
    } catch (e: any) {
      if (!silent) setError(e.message || 'Failed to fetch transactions from backend')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
    const unsubscribe = subscribe('*', () => {
      fetchTransactions(true)
    })
    return unsubscribe
  }, [subscribe])

  const handleExportCSV = () => {
    const headers = ['ID', 'OrderID', 'Customer', 'Amount', 'Method', 'FailureReason', 'RecoveryProbability', 'Status', 'CreatedAt']
    const rows = transactions.map(t => [
      t.id,
      t.orderId,
      `"${t.customer.name}"`,
      t.amount,
      t.method,
      `"${t.failureReason}"`,
      t.recoveryProbability,
      t.status,
      t.createdAt
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `recoverai_transactions_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Transaction & Recovery Ledger"
        subtitle="Complete chronological record of all processed payment attempts, drop-offs, and recovery outcomes"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchTransactions(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-warm-gray-100 border border-border text-graphite rounded-sm text-xs font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-warm-gray-100 border border-border text-graphite rounded-sm text-xs font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="bg-surface p-6 rounded-md border border-border">
          <SkeletonLoader variant="row" count={8} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTransactions} />
      ) : (
        <TransactionTable transactions={transactions} showFilters />
      )}
    </div>
  )
}
