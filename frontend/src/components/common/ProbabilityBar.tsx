import React from 'react'

interface ProbabilityBarProps {
  value: number // 0.0 to 1.0 or 0 to 100
  showLabel?: boolean
  className?: string
}

export const ProbabilityBar: React.FC<ProbabilityBarProps> = ({
  value,
  showLabel = true,
  className = ''
}) => {
  const percent = value <= 1.0 ? Math.round(value * 100) : Math.round(value)

  const getColorClass = (p: number) => {
    if (p >= 75) return 'bg-moss-green'
    if (p >= 55) return 'bg-muted-amber'
    if (p >= 40) return 'bg-burnt-orange'
    return 'bg-brick-red'
  }

  const getTextColorClass = (p: number) => {
    if (p >= 75) return 'text-moss-green-dark'
    if (p >= 55) return 'text-muted-amber-dark'
    if (p >= 40) return 'text-burnt-orange-dark'
    return 'text-brick-red-dark'
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className="w-16 h-2 bg-warm-gray-200 rounded-sm overflow-hidden flex-shrink-0"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Recovery probability: ${percent}%`}
      >
        <div
          className={`h-full transition-all duration-300 ${getColorClass(percent)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-mono font-semibold tabular-nums ${getTextColorClass(percent)}`}>
          {percent}%
        </span>
      )}
    </div>
  )
}
