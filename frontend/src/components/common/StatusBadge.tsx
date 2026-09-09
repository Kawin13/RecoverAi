import React from 'react'
import { RecoveryStatus } from '../../types'
import { CheckCircle2, Clock, AlertCircle, RefreshCw, XCircle, PauseCircle, Sparkles } from 'lucide-react'

interface StatusBadgeProps {
  status: RecoveryStatus
  size?: 'sm' | 'md'
  showIcon?: boolean
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  showIcon = true
}) => {
  const configMap: Partial<Record<RecoveryStatus, { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }>> = {
    RECOVERED: {
      label: 'Recovered',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200/80',
      icon: CheckCircle2
    },
    IN_PROGRESS: {
      label: 'In Progress',
      bg: 'bg-primary-light',
      text: 'text-primary',
      border: 'border-primary-border',
      icon: RefreshCw
    },
    PENDING_APPROVAL: {
      label: 'Needs Approval',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      icon: AlertCircle
    },
    ATTEMPTING: {
      label: 'Attempting',
      bg: 'bg-primary-subtle',
      text: 'text-primary',
      border: 'border-primary-border',
      icon: Clock
    },
    COOLING_DOWN: {
      label: 'Cooling Down',
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-200',
      icon: PauseCircle
    },
    FAILED: {
      label: 'Recovery Lost',
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-200',
      icon: XCircle
    },
    ACTION_SCHEDULED: {
      label: 'Scheduled',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      icon: Clock
    },
    ACTION_EXECUTED: {
      label: 'Dispatched',
      bg: 'bg-primary-light',
      text: 'text-primary',
      border: 'border-primary-border',
      icon: RefreshCw
    },
    DETECTED: {
      label: 'Detected',
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-200',
      icon: Clock
    },
    ANALYZED: {
      label: 'Analyzed',
      bg: 'bg-primary-subtle',
      text: 'text-primary',
      border: 'border-primary-border',
      icon: Sparkles
    },
    STRATEGY_SELECTED: {
      label: 'Strategy Selected',
      bg: 'bg-primary-light',
      text: 'text-primary',
      border: 'border-primary-border',
      icon: Sparkles
    },
    WAITING_FOR_CUSTOMER: {
      label: 'Awaiting Customer',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      icon: Clock
    }
  }

  const fallback = {
    label: String(status || 'Active').replace(/_/g, ' '),
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    icon: RefreshCw
  }

  const config = configMap[status] || fallback
  const Icon = config.icon

  const sizeClasses = size === 'sm' 
    ? 'px-2.5 py-0.5 text-[11px] font-semibold' 
    : 'px-3 py-1 text-xs font-semibold'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border shadow-2xs ${config.bg} ${config.text} ${config.border} ${sizeClasses} tracking-tight font-display`}
    >
      {showIcon && <Icon className={`w-3 h-3 ${status === 'IN_PROGRESS' || status === 'ATTEMPTING' ? 'animate-spin' : ''}`} />}
      <span>{config.label}</span>
    </span>
  )
}
