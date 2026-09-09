import React from 'react'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
  className = ''
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border/80 ${className}`}>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-navy tracking-tight font-display">
            {title}
          </h2>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 font-normal">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  )
}
