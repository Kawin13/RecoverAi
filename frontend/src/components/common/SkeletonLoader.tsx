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
          <div key={index} className={`bg-surface rounded-md border border-border p-5 space-y-3 animate-pulse ${className}`}>
            <div className="h-3.5 bg-warm-gray-200 rounded w-1/3" />
            <div className="h-7 bg-warm-gray-300 rounded w-1/2" />
            <div className="h-3 bg-warm-gray-200 rounded w-2/3" />
          </div>
        )
      case 'chart':
        return (
          <div key={index} className={`bg-surface rounded-md border border-border p-5 space-y-4 animate-pulse ${className}`}>
            <div className="h-4 bg-warm-gray-200 rounded w-1/4" />
            <div className="h-48 bg-warm-gray-100 rounded w-full flex items-end gap-2 p-4">
              <div className="w-1/6 h-24 bg-warm-gray-200 rounded-sm" />
              <div className="w-1/6 h-36 bg-warm-gray-200 rounded-sm" />
              <div className="w-1/6 h-28 bg-warm-gray-200 rounded-sm" />
              <div className="w-1/6 h-40 bg-warm-gray-200 rounded-sm" />
              <div className="w-1/6 h-32 bg-warm-gray-200 rounded-sm" />
              <div className="w-1/6 h-44 bg-warm-gray-200 rounded-sm" />
            </div>
          </div>
        )
      case 'text':
        return (
          <div key={index} className={`space-y-2 animate-pulse ${className}`}>
            <div className="h-3.5 bg-warm-gray-200 rounded w-full" />
            <div className="h-3 bg-warm-gray-200 rounded w-4/5" />
          </div>
        )
      case 'row':
      default:
        return (
          <div key={index} className={`flex items-center gap-4 p-4 border-b border-border animate-pulse bg-surface ${className}`}>
            <div className="w-8 h-8 bg-warm-gray-200 rounded-sm flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 bg-warm-gray-200 rounded w-1/4" />
              <div className="h-3 bg-warm-gray-100 rounded w-1/3" />
            </div>
            <div className="h-4 bg-warm-gray-200 rounded w-16" />
            <div className="h-5 bg-warm-gray-200 rounded w-20" />
          </div>
        )
    }
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => renderItem(i))}
    </div>
  )
}
