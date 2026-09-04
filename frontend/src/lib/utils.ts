import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format amounts in INR with Indian Lakh / Crore notation or standard comma groups.
 */
export function formatINR(amount: number, options: { compact?: boolean; showSymbol?: boolean } = {}): string {
  const { compact = false, showSymbol = true } = options
  const symbol = showSymbol ? '₹' : ''

  if (compact) {
    if (Math.abs(amount) >= 10000000) {
      return `${symbol}${(amount / 10000000).toFixed(2)} Cr`
    }
    if (Math.abs(amount) >= 100000) {
      return `${symbol}${(amount / 100000).toFixed(2)} L`
    }
    if (Math.abs(amount) >= 1000) {
      return `${symbol}${(amount / 1000).toFixed(1)}k`
    }
  }

  // Standard Indian Numbering formatting
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount)

  return `${symbol}${formatted}`
}

/**
 * Format percentages with standard precision
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Calculate relative age / time elapsed
 */
export function formatTimeAgo(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return `${Math.max(1, seconds)}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * Canonical terminal states that must be excluded from active at-risk operations.
 * Matches backend: SUCCESS, CAPTURED, RECOVERED, CLOSED, CANCELLED, STOPPED, FAILED_TERMINAL.
 */
export const TERMINAL_STATES = new Set<string>([
  'SUCCESS',
  'CAPTURED',
  'RECOVERED',
  'CLOSED',
  'CANCELLED',
  'STOPPED',
  'FAILED_TERMINAL'
])

export function isTerminalState(status?: string | null): boolean {
  if (!status) return false
  return TERMINAL_STATES.has(status.toUpperCase())
}

export function isActiveCase(status?: string | null): boolean {
  return !isTerminalState(status)
}
