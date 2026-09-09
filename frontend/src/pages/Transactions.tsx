import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Transaction } from '../types'
import { SectionHeader } from '../components/common/SectionHeader'
import { TransactionTable } from '../components/common/TransactionTable'
import { SkeletonLoader } from '../components/common/SkeletonLoader'
import { ErrorState } from '../components/common/ErrorState'
import { Download, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useRealtime } from '../lib/useRealtime'
import { ENV } from '../config/env'

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
    } catch {
      if (!silent) setError('Unable to load transactions. Please check your connection and try again.')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()

    const unsubTx = subscribe('TRANSACTION_UPDATED', () => fetchTransactions(true))
    const unsubPay = subscribe('PAYMENT_RECEIVED', () => fetchTransactions(true))
    const unsubCase = subscribe('RECOVERY_CASE_UPDATED', () => fetchTransactions(true))
    const unsubResync = subscribe('RECONNECT_RESYNC', () => fetchTransactions(true))

    return () => {
      unsubTx()
      unsubPay()
      unsubCase()
      unsubResync()
    }
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
          <div className="flex items-center gap-2.5">
            {ENV.DEMO_MODE && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Demo Data
              </span>
            )}
            <button
              type="button"
              onClick={() => fetchTransactions(false)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface hover:bg-slate-50 border border-border text-navy rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-primary" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="bg-surface p-6 rounded-2xl border border-border shadow-fintech-card">
          <SkeletonLoader variant="row" count={8} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTransactions} />
      ) : transactions.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border/80 rounded-2xl shadow-fintech-card space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="text-base font-bold text-navy font-display">No transactions found.</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are no recorded transactions or payment attempts in this workspace yet.
          </p>
        </div>
      ) : (
        <TransactionTable transactions={transactions} showFilters />
      )}
    </div>
  )
}
