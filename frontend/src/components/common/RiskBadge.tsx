import React from 'react'
import { RiskLevel } from '../../types'

interface RiskBadgeProps {
  risk: RiskLevel
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk }) => {
  const styles: Record<RiskLevel, { bg: string; text: string; dot: string; border: string; label: string }> = {
    LOW: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      dot: 'bg-emerald-500',
      border: 'border-emerald-200/80',
      label: 'Low Risk'
    },
    MEDIUM: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      dot: 'bg-amber-500',
      border: 'border-amber-200/80',
      label: 'Med Risk'
    },
    HIGH: {
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      dot: 'bg-rose-500',
      border: 'border-rose-200/80',
      label: 'High Risk'
    },
    CRITICAL: {
      bg: 'bg-rose-100',
      text: 'text-rose-900',
      dot: 'bg-rose-600',
      border: 'border-rose-300',
      label: 'Critical'
    }
  }

  const s = styles[risk] || styles.LOW

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border} shadow-2xs`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span>{s.label}</span>
    </span>
  )
}
