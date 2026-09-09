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
  highlightColor?: 'default' | 'burnt-orange' | 'purple' | 'moss-green' | 'muted-amber' | 'hero-purple' | 'soft-blue' | 'rose'
  variant?: 'standard' | 'hero-purple' | 'soft-blue'
  className?: string
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  delta,
  subtitle,
  icon: Icon,
  highlightColor = 'default',
  variant = 'standard',
  className = ''
}) => {
  const isHero = variant === 'hero-purple' || highlightColor === 'hero-purple'
  const isSoftBlue = variant === 'soft-blue' || highlightColor === 'soft-blue'

  const getIconStyles = () => {
    if (isHero) return 'bg-white/15 text-white border border-white/20'
    if (isSoftBlue) return 'bg-white text-primary border border-surface-blue-border'
    
    switch (highlightColor) {
      case 'purple':
      case 'burnt-orange':
        return 'bg-primary-light text-primary border border-primary-border'
      case 'moss-green':
        return 'bg-moss-green-light text-moss-green-dark border border-moss-green/20'
      case 'muted-amber':
        return 'bg-amber-50 text-amber-700 border border-amber-200'
      case 'rose':
        return 'bg-rose-50 text-rose-600 border border-rose-200'
      default:
        return 'bg-surface-blue/80 text-navy border border-surface-blue-border'
    }
  }

  const renderDelta = () => {
    if (!delta) return null
    
    const isPositive = delta.value > 0
    const isNeutral = delta.value === 0
    const isGood = delta.isInverse ? !isPositive : isPositive

    let textColor = ''
    if (isHero) {
      textColor = isNeutral ? 'text-purple-200' : isGood ? 'text-emerald-300' : 'text-rose-200'
    } else {
      textColor = isNeutral
        ? 'text-slate-500'
        : isGood
        ? 'text-emerald-600 font-semibold'
        : 'text-rose-600 font-semibold'
    }

    const ArrowIcon = isNeutral ? Minus : isPositive ? ArrowUpRight : ArrowDownRight

    return (
      <div className={`inline-flex items-center gap-1 text-xs font-medium ${textColor}`}>
        <ArrowIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="tabular-nums font-mono">{Math.abs(delta.value)}%</span>
        <span className={`${isHero ? 'text-purple-200' : 'text-slate-500'} font-normal ml-0.5`}>
          {delta.label}
        </span>
      </div>
    )
  }

  if (isHero) {
    return (
      <div
        className={`purple-hero-gradient text-white rounded-2xl p-6 shadow-fintech-purple transition-all duration-normal hover:shadow-fintech-elevated hover:scale-[1.01] relative overflow-hidden ${className}`}
      >
        {/* Subtle decorative background gradient circles */}
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute right-4 bottom-2 w-24 h-24 rounded-full bg-primary-dark/30 blur-lg pointer-events-none" />

        <div className="flex items-start justify-between relative z-10">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-100 font-display">
            {title}
          </span>
          {Icon && (
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-xs ${getIconStyles()}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        <div className="mt-4 text-3xl font-bold tracking-tight text-white font-display relative z-10">
          {value}
        </div>

        {(delta || subtitle) && (
          <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-white/15 text-xs relative z-10">
            {delta && renderDelta()}
            {subtitle && (
              <span className="text-purple-200 truncate text-[11px] font-medium">{subtitle}</span>
            )}
          </div>
        )}
      </div>
    )
  }

  const containerClasses = isSoftBlue
    ? 'bg-surface-blue border border-surface-blue-border rounded-2xl p-6 shadow-fintech-card hover:shadow-fintech-elevated transition-all'
    : 'bg-surface border border-border/80 rounded-2xl p-6 shadow-fintech-card hover:shadow-fintech-elevated hover:border-slate-300 transition-all'

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        {Icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-2xs ${getIconStyles()}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-3.5 text-2xl font-bold tracking-tight text-navy font-display">
        {value}
      </div>

      {(delta || subtitle) && (
        <div className="mt-3.5 flex items-center justify-between gap-2 pt-2.5 border-t border-border/60 text-xs">
          {delta && renderDelta()}
          {subtitle && (
            <span className="text-slate-400 truncate text-[11px] font-medium">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  )
}
