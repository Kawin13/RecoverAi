import React from 'react'
import { formatINR } from '../../lib/utils'

interface MoneyValueProps {
  amount: number
  compact?: boolean
  showSymbol?: boolean
  className?: string
  numericClassName?: string
  currencyClassName?: string
}

export const MoneyValue: React.FC<MoneyValueProps> = ({
  amount,
  compact = false,
  showSymbol = true,
  className = '',
  numericClassName = '',
  currencyClassName = ''
}) => {
  const formatted = formatINR(amount, { compact, showSymbol: false })

  return (
    <span className={`inline-flex items-baseline tabular-nums font-mono font-semibold ${className}`}>
      {showSymbol && (
        <span className={`mr-0.5 text-[0.85em] font-normal text-warm-gray-500 ${currencyClassName}`}>
          ₹
        </span>
      )}
      <span className={numericClassName}>{formatted}</span>
    </span>
  )
}
