import React from 'react'
import { RecoveryStatus } from '../../types'
import { CheckCircle2, Clock, AlertCircle, RefreshCw, XCircle, PauseCircle } from 'lucide-react'

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
  const configMap: Record<RecoveryStatus, { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
    RECOVERED: {
      label: 'Recovered',
      bg: 'bg-moss-green-light',
      text: 'text-moss-green-dark',
      border: 'border-moss-green/30',
      icon: CheckCircle2
    },
    IN_PROGRESS: {
      label: 'In Progress',
      bg: 'bg-burnt-orange-light',
      text: 'text-burnt-orange-dark',
      border: 'border-burnt-orange/30',
      icon: RefreshCw
    },
    PENDING_APPROVAL: {
      label: 'Needs Approval',
      bg: 'bg-muted-amber-light',
      text: 'text-muted-amber-dark',
      border: 'border-muted-amber/30',
      icon: AlertCircle
    },
    ATTEMPTING: {
      label: 'Attempting',
      bg: 'bg-burnt-orange-subtle',
      text: 'text-burnt-orange',
      border: 'border-burnt-orange/20',
      icon: Clock
    },
    COOLING_DOWN: {
      label: 'Cooling Down',
      bg: 'bg-warm-gray-200',
      text: 'text-warm-gray-700',
      border: 'border-warm-gray-300',
      icon: PauseCircle
    },
    FAILED: {
      label: 'Recovery Lost',
      bg: 'bg-brick-red-light',
      text: 'text-brick-red-dark',
      border: 'border-brick-red/30',
      icon: XCircle
    }
  }

  const config = configMap[status] || configMap.IN_PROGRESS
  const Icon = config.icon

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs font-medium' 
    : 'px-2.5 py-1 text-xs font-medium'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border ${config.bg} ${config.text} ${config.border} ${sizeClasses} tracking-tight`}
    >
      {showIcon && <Icon className={`w-3 h-3 ${status === 'IN_PROGRESS' || status === 'ATTEMPTING' ? 'animate-spin' : ''}`} />}
      <span>{config.label}</span>
    </span>
  )
}
