import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import { AuditLogEntry } from '../types'
import { SectionHeader } from '../components/common/SectionHeader'
import { SkeletonLoader } from '../components/common/SkeletonLoader'
import { ErrorState } from '../components/common/ErrorState'
import { formatTimeAgo } from '../../src/lib/utils'
import { Shield, User, Bot, Webhook, Filter, RefreshCw } from 'lucide-react'

export const AuditTrail: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [filterActor, setFilterActor] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAuditLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getAuditTrail()
      setLogs(data)
    } catch (e: any) {
      setError(e.message || 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAuditLogs()
  }, [])

  const getActorBadge = (actor: string) => {
    switch (actor) {
      case 'AUTONOMOUS_AGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-medium bg-burnt-orange-light text-burnt-orange-dark border border-burnt-orange/30">
            <Bot className="w-3 h-3" /> Agent
          </span>
        )
      case 'SYSTEM_GUARDRAIL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-medium bg-muted-amber-light text-muted-amber-dark border border-muted-amber/30">
            <Shield className="w-3 h-3" /> Guardrail
          </span>
        )
      case 'MERCHANT_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-medium bg-moss-green-light text-moss-green-dark border border-moss-green/30">
            <User className="w-3 h-3" /> Admin
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

  const filteredLogs = logs.filter(log => {
    if (filterActor !== 'ALL' && log.actor !== filterActor) return false
    return true
  })

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Audit Trail & Operations Ledger"
        subtitle="Chronological audit records of all autonomous actions, guardrail interventions, and policy updates"
        actions={
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={fetchAuditLogs}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface hover:bg-warm-gray-100 border border-border text-graphite rounded-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
            <div className="flex items-center gap-1 pl-2">
              <Filter className="w-3.5 h-3.5 text-warm-gray-500" />
              <select
                value={filterActor}
                onChange={(e) => setFilterActor(e.target.value)}
                className="px-2.5 py-1.5 bg-surface border border-border rounded-sm text-xs text-graphite focus:outline-none focus:border-burnt-orange"
              >
                <option value="ALL">All Actors</option>
                <option value="AUTONOMOUS_AGENT">Autonomous Agent</option>
                <option value="SYSTEM_GUARDRAIL">System Guardrails</option>
                <option value="MERCHANT_ADMIN">Merchant Admin</option>
                <option value="WEBHOOK_EVENT">Gateway Webhooks</option>
              </select>
            </div>
          </div>
        }
      />

      {loading ? (
        <div className="bg-surface p-6 rounded-md border border-border">
          <SkeletonLoader variant="row" count={5} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAuditLogs} />
      ) : (
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
                {filteredLogs.map((log) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
