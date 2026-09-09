import React from 'react'

interface SkeletonLoaderProps {
  variant?: 'card' | 'row' | 'chart' | 'text'
  count?: number
  className?: string
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'row',
  count = 1,
  className = ''
}) => {
  const renderItem = (index: number) => {
    switch (variant) {
      case 'card':
        return (
          <div key={index} className={`bg-surface rounded-2xl border border-border/80 p-6 space-y-3.5 animate-pulse shadow-fintech-card ${className}`}>
            <div className="h-3.5 bg-slate-100 rounded-lg w-1/3" />
            <div className="h-8 bg-slate-200 rounded-xl w-1/2" />
            <div className="h-3 bg-slate-100 rounded-lg w-2/3" />
          </div>
        )
      case 'chart':
        return (
          <div key={index} className={`bg-surface rounded-2xl border border-border/80 p-6 space-y-4 animate-pulse shadow-fintech-card ${className}`}>
            <div className="h-4 bg-slate-200 rounded-lg w-1/4" />
            <div className="h-48 bg-slate-50 rounded-xl w-full flex items-end gap-3 p-4">
              <div className="w-1/6 h-24 bg-slate-200 rounded-xl" />
              <div className="w-1/6 h-36 bg-slate-200 rounded-xl" />
              <div className="w-1/6 h-28 bg-slate-200 rounded-xl" />
              <div className="w-1/6 h-40 bg-slate-200 rounded-xl" />
              <div className="w-1/6 h-32 bg-slate-200 rounded-xl" />
              <div className="w-1/6 h-44 bg-slate-200 rounded-xl" />
            </div>
          </div>
        )
      case 'text':
        return (
          <div key={index} className={`space-y-2 animate-pulse ${className}`}>
            <div className="h-3.5 bg-slate-200 rounded-lg w-full" />
            <div className="h-3 bg-slate-100 rounded-lg w-4/5" />
          </div>
        )
      case 'row':
      default:
        return (
          <div key={index} className={`flex items-center gap-4 p-4 border-b border-border/60 animate-pulse bg-surface ${className}`}>
            <div className="w-9 h-9 bg-slate-100 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 bg-slate-200 rounded-lg w-1/4" />
              <div className="h-3 bg-slate-100 rounded-lg w-1/3" />
            </div>
            <div className="h-4 bg-slate-200 rounded-lg w-16" />
            <div className="h-5 bg-slate-100 rounded-full w-20" />
          </div>
        )
    }
  }

  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => renderItem(i))}
    </div>
  )
}
