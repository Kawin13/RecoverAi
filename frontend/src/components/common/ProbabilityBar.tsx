import React from 'react'

interface ProbabilityBarProps {
  value?: number | null // 0.0 to 1.0 or 0 to 100, or null if unanalyzed
  showLabel?: boolean
  className?: string
}

export const ProbabilityBar: React.FC<ProbabilityBarProps> = ({
  value,
  showLabel = true,
  className = ''
}) => {
  if (value == null || isNaN(value)) {
    return <span className={`text-xs font-mono text-slate-400 ${className}`}>—</span>
  }

  const percent = value <= 1.0 ? Math.round(value * 100) : Math.round(value)

  const getColorClass = (p: number) => {
    if (p >= 70) return 'bg-primary'
    if (p >= 50) return 'bg-emerald-500'
    if (p >= 30) return 'bg-amber-500'
    return 'bg-rose-500'
  }

  const getTextColorClass = (p: number) => {
    if (p >= 70) return 'text-primary'
    if (p >= 50) return 'text-emerald-700'
    if (p >= 30) return 'text-amber-700'
    return 'text-rose-700'
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div 
        className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden flex-shrink-0 border border-slate-200/60"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Recovery probability: ${percent}%`}
      >
        <div
          className={`h-full transition-all duration-300 rounded-full ${getColorClass(percent)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs font-mono font-bold tabular-nums ${getTextColorClass(percent)}`}>
          {percent}%
        </span>
      )}
    </div>
  )
}
