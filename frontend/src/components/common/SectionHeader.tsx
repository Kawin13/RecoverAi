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
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border ${className}`}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold text-graphite tracking-tight font-display">
            {title}
          </h2>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-warm-gray-600">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  )
}
