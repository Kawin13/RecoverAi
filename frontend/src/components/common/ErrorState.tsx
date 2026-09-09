import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to load information',
  message,
  onRetry,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-rose-50/50 rounded-2xl border border-rose-200/80 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 mb-3 shadow-xs">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-rose-900 font-display">
        {title}
      </h3>
      <p className="mt-1.5 text-xs text-slate-600 max-w-md">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-surface text-navy hover:bg-slate-50 border border-border rounded-xl text-xs font-semibold transition-all shadow-xs focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-primary" />
          <span>Try Again</span>
        </button>
      )}
    </div>
  )
}
