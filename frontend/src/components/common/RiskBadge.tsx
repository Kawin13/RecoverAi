import React from 'react'
import { RiskLevel } from '../../types'

interface RiskBadgeProps {
  risk: RiskLevel
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk }) => {
  const styles: Record<RiskLevel, { bg: string; text: string; dot: string; label: string }> = {
    LOW: {
      bg: 'bg-moss-green-subtle',
      text: 'text-moss-green-dark',
      dot: 'bg-moss-green',
      label: 'Low Risk'
    },
    MEDIUM: {
      bg: 'bg-muted-amber-subtle',
      text: 'text-muted-amber-dark',
      dot: 'bg-muted-amber',
      label: 'Med Risk'
    },
    HIGH: {
      bg: 'bg-burnt-orange-subtle',
      text: 'text-burnt-orange-dark',
      dot: 'bg-burnt-orange',
      label: 'High Risk'
    },
    CRITICAL: {
      bg: 'bg-brick-red-subtle',
      text: 'text-brick-red-dark',
      dot: 'bg-brick-red',
      label: 'Critical'
    }
  }

  const s = styles[risk] || styles.LOW

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-medium border border-border/60 ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span>{s.label}</span>
    </span>
  )
}
