import React from 'react'
import { Inbox, LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description: string
  icon?: LucideIcon
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center bg-surface rounded-2xl border border-dashed border-border ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-surface-blue border border-surface-blue-border flex items-center justify-center text-primary mb-4 shadow-xs">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-navy font-display">
        {title}
      </h3>
      <p className="mt-1.5 text-xs text-slate-500 max-w-sm">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 px-4 py-2 bg-primary text-white hover:bg-primary-hover rounded-xl text-xs font-semibold transition-all shadow-fintech-purple focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
