import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load data',
  message,
  onRetry,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-brick-red-subtle rounded-md border border-brick-red/20 ${className}`}>
      <div className="w-10 h-10 rounded-full bg-brick-red-light flex items-center justify-center text-brick-red mb-3">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-brick-red-dark">
        {title}
      </h3>
      <p className="mt-1 text-xs text-warm-gray-700 max-w-md">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface text-graphite hover:bg-warm-gray-100 border border-border rounded-sm text-xs font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Operation</span>
        </button>
      )}
    </div>
  )
}
