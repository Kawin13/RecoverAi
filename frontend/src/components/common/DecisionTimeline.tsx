import React from 'react'
import { AgentActivity } from '../../types'
import { MoneyValue } from './MoneyValue'
import { formatTimeAgo } from '../../lib/utils'
import { 
  Zap, 
  ArrowRightLeft, 
  Clock, 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  ShieldAlert, 
  Timer
} from 'lucide-react'

interface DecisionTimelineProps {
  activities: AgentActivity[]
  className?: string
  onActionClick?: (activity: AgentActivity) => void
}

export const DecisionTimeline: React.FC<DecisionTimelineProps> = ({
  activities,
  className = '',
  onActionClick
}) => {
  const getActionConfig = (action: string) => {
    switch (action) {
      case 'SMART_PAYLINK_1CLICK':
        return { label: 'Dynamic 1-Click Paylink', icon: Zap, color: 'text-primary', bg: 'bg-primary-light border-primary-border' }
      case 'UPI_INTENT_FALLBACK':
        return { label: 'UPI Intent Fallback', icon: ArrowRightLeft, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' }
      case 'TIMED_SMART_RETRY':
        return { label: 'Timed Smart Retry', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' }
      case 'INCENTIVIZED_DUNNING':
        return { label: 'AI Dunning Email', icon: Mail, color: 'text-primary', bg: 'bg-surface-blue border-surface-blue-border' }
      case 'WHATSAPP_CONCIERGE':
        return { label: 'WhatsApp Concierge', icon: MessageSquare, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' }
      default:
        return { label: action, icon: Zap, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' }
    }
  }

  const getStatusIcon = (status: AgentActivity['status']) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
      case 'BLOCKED':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
      case 'WAITING':
        return <Timer className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
      case 'EXECUTED':
      default:
        return <div className="w-2 h-2 rounded-full bg-primary" />
    }
  }

  if (activities.length === 0) {
    return (
      <div className={`p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-border/80 ${className}`}>
        <p className="text-xs font-semibold text-navy">No recent agent activity</p>
        <p className="text-[11px] text-slate-500 mt-1">Autonomous decisions and actions will appear here in real-time as transactions are processed.</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {activities.map((item, idx) => {
        const actionCfg = getActionConfig(item.action)
        const ActionIcon = actionCfg.icon
        const isLast = idx === activities.length - 1

        return (
          <div key={item.id} className="relative flex items-start gap-3.5 text-xs group">
            {/* Timeline track line */}
            {!isLast && (
              <div className="absolute left-4.5 top-9 -bottom-4 w-[2px] bg-slate-200 group-hover:bg-primary/30 transition-colors" />
            )}

            {/* Action Icon Pill */}
            <div className={`w-9 h-9 rounded-xl ${actionCfg.bg} border flex items-center justify-center flex-shrink-0 z-10 shadow-xs`}>
              <ActionIcon className={`w-4 h-4 ${actionCfg.color}`} />
            </div>

            {/* Content Container */}
            <div className="flex-1 bg-surface border border-border/80 rounded-2xl p-4 shadow-fintech-card hover:shadow-fintech-elevated hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-navy text-xs font-display">
                    {item.customerName}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-mono text-[11px] font-semibold text-slate-600">
                    <MoneyValue amount={item.amount} />
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    {getStatusIcon(item.status)}
                    <span className="capitalize">{item.status.toLowerCase()}</span>
                  </div>
                  <span className="text-slate-400 text-[10px] tabular-nums font-mono">
                    {formatTimeAgo(item.timestamp)}
                  </span>
                </div>
              </div>

              {/* Action Name & ERV */}
              <div className="flex items-center justify-between gap-2 py-1.5 mb-2 border-y border-border/50">
                <span className="font-semibold text-navy text-[11px] flex items-center gap-1.5">
                  <span className="text-slate-400 font-normal">Strategy:</span> {actionCfg.label}
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-600">
                  <span className="text-slate-400 font-sans font-normal">ERV: </span>
                  <MoneyValue amount={item.erv} />
                </span>
              </div>

              {/* Agent Explanation */}
              <p className="text-slate-600 text-[11px] leading-relaxed">
                {item.explanation}
              </p>

              {/* Action Button if actionable */}
              {item.status === 'BLOCKED' && onActionClick && (
                <div className="mt-3 pt-2.5 border-t border-border/60 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onActionClick(item)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    Review Guardrail Override
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
