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
        return { label: 'Dynamic 1-Click Paylink', icon: Zap, color: 'text-burnt-orange', bg: 'bg-burnt-orange-light' }
      case 'UPI_INTENT_FALLBACK':
        return { label: 'UPI Intent Fallback', icon: ArrowRightLeft, color: 'text-moss-green', bg: 'bg-moss-green-light' }
      case 'TIMED_SMART_RETRY':
        return { label: 'Timed Smart Retry', icon: Clock, color: 'text-muted-amber', bg: 'bg-muted-amber-light' }
      case 'INCENTIVIZED_DUNNING':
        return { label: 'AI Dunning Email', icon: Mail, color: 'text-warm-gray-700', bg: 'bg-warm-gray-200' }
      case 'WHATSAPP_CONCIERGE':
        return { label: 'WhatsApp Concierge', icon: MessageSquare, color: 'text-moss-green-dark', bg: 'bg-moss-green-subtle' }
      default:
        return { label: action, icon: Zap, color: 'text-warm-gray-700', bg: 'bg-warm-gray-100' }
    }
  }

  const getStatusIcon = (status: AgentActivity['status']) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle2 className="w-3.5 h-3.5 text-moss-green" />
      case 'BLOCKED':
        return <ShieldAlert className="w-3.5 h-3.5 text-brick-red" />
      case 'WAITING':
        return <Timer className="w-3.5 h-3.5 text-muted-amber animate-pulse" />
      case 'EXECUTED':
      default:
        return <div className="w-2 h-2 rounded-full bg-burnt-orange" />
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {activities.map((item, idx) => {
        const actionCfg = getActionConfig(item.action)
        const ActionIcon = actionCfg.icon
        const isLast = idx === activities.length - 1

        return (
          <div key={item.id} className="relative flex items-start gap-3 text-xs group">
            {/* Timeline track line */}
            {!isLast && (
              <div className="absolute left-4 top-8 -bottom-4 w-[1px] bg-border group-hover:bg-warm-gray-400 transition-colors" />
            )}

            {/* Action Icon Pill */}
            <div className={`w-8 h-8 rounded-sm ${actionCfg.bg} border border-border flex items-center justify-center flex-shrink-0 z-10 shadow-sm`}>
              <ActionIcon className={`w-4 h-4 ${actionCfg.color}`} />
            </div>

            {/* Content Container */}
            <div className="flex-1 bg-surface border border-border/80 rounded-sm p-3.5 shadow-fintech-subtle hover:border-warm-gray-400 transition-all">
              <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-graphite text-xs font-display">
                    {item.customerName}
                  </span>
                  <span className="text-warm-gray-400">•</span>
                  <span className="font-mono text-[11px] text-warm-gray-600">
                    <MoneyValue amount={item.amount} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-warm-gray-600">
                    {getStatusIcon(item.status)}
                    <span className="capitalize">{item.status.toLowerCase()}</span>
                  </div>
                  <span className="text-warm-gray-400 text-[10px] tabular-nums font-mono">
                    {formatTimeAgo(item.timestamp)}
                  </span>
                </div>
              </div>

              {/* Action Name & ERV */}
              <div className="flex items-center justify-between gap-2 py-1 mb-1.5 border-y border-border/40">
                <span className="font-medium text-warm-gray-800 text-[11px] flex items-center gap-1">
                  <span className="text-warm-gray-500 font-normal">Strategy:</span> {actionCfg.label}
                </span>
                <span className="text-[11px] font-mono text-moss-green-dark">
                  <span className="text-warm-gray-500 font-sans font-normal">ERV: </span>
                  <MoneyValue amount={item.erv} />
                </span>
              </div>

              {/* Agent Explanation */}
              <p className="text-warm-gray-600 text-[11px] leading-relaxed">
                {item.explanation}
              </p>

              {/* Action Button if actionable */}
              {item.status === 'BLOCKED' && onActionClick && (
                <div className="mt-2.5 pt-2 border-t border-border/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onActionClick(item)}
                    className="px-2.5 py-1 bg-brick-red text-white hover:bg-brick-red-hover rounded-sm text-[11px] font-medium transition-colors"
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
