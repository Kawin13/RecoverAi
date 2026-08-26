import React from 'react'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: React.ReactNode
  delta?: {
    value: number
    label: string
    isInverse?: boolean // If true, negative is good (e.g. at-risk reduction)
  }
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
  highlightColor?: 'default' | 'burnt-orange' | 'moss-green' | 'muted-amber'
  className?: string
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  delta,
  subtitle,
  icon: Icon,
  highlightColor = 'default',
  className = ''
}) => {
  const getBorderColor = () => {
    switch (highlightColor) {
      case 'burnt-orange': return 'border-t-2 border-t-burnt-orange'
      case 'moss-green': return 'border-t-2 border-t-moss-green'
      case 'muted-amber': return 'border-t-2 border-t-muted-amber'
      default: return 'border-t-2 border-t-transparent'
    }
  }

  const renderDelta = () => {
    if (!delta) return null
    
    const isPositive = delta.value > 0
    const isNeutral = delta.value === 0
    const isGood = delta.isInverse ? !isPositive : isPositive

    const textColor = isNeutral
      ? 'text-warm-gray-500'
      : isGood
      ? 'text-moss-green'
      : 'text-brick-red'

    const ArrowIcon = isNeutral ? Minus : isPositive ? ArrowUpRight : ArrowDownRight

    return (
      <div className={`inline-flex items-center gap-0.5 text-xs font-medium ${textColor}`}>
        <ArrowIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="tabular-nums font-mono">{Math.abs(delta.value)}%</span>
        <span className="text-warm-gray-500 font-normal ml-1">{delta.label}</span>
      </div>
    )
  }

  return (
    <div
      className={`bg-surface rounded-md border border-border p-5 shadow-fintech-card transition-all duration-normal hover:border-warm-gray-400 ${getBorderColor()} ${className}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-warm-gray-500">
          {title}
        </span>
        {Icon && (
          <div className="w-7 h-7 rounded-sm bg-warm-gray-100 border border-border flex items-center justify-center text-warm-gray-600">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-3 text-2xl font-bold tracking-tight text-graphite font-display">
        {value}
      </div>

      {(delta || subtitle) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
          {delta && renderDelta()}
          {subtitle && (
            <span className="text-warm-gray-500 truncate text-[11px]">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  )
}
