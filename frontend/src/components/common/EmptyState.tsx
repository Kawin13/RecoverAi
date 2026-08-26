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
    <div className={`flex flex-col items-center justify-center p-12 text-center bg-surface rounded-md border border-dashed border-border ${className}`}>
      <div className="w-12 h-12 rounded-md bg-warm-gray-100 border border-border flex items-center justify-center text-warm-gray-500 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-graphite font-display">
        {title}
      </h3>
      <p className="mt-1 text-xs text-warm-gray-600 max-w-sm">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 px-3.5 py-1.5 bg-graphite text-surface hover:bg-dark-surface rounded-sm text-xs font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
