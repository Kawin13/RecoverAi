import React, { useState, useEffect, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertOctagon,
  Receipt,
  Bot,
  PlayCircle,
  BarChart3,
  ScrollText,
  ShieldCheck,
  User,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Users,
  Zap,
  Settings
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useRealtime } from '../../lib/useRealtime'
import { api } from '../../services/api'

interface SidebarProps {
  isOpen: boolean
  onCloseMobile?: () => void
}

interface NavSection {
  label: string
  items: NavItem[]
}

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
  badge?: string
  adminOnly?: boolean
}

const NavItemRow: React.FC<{ item: NavItem; onClose?: () => void }> = ({ item, onClose }) => {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all duration-normal group ${
          isActive
            ? 'bg-[#F1EAFE] text-primary font-bold shadow-2xs'
            : 'text-slate-600 hover:text-primary hover:bg-[#F7F3FF] font-medium'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className="flex items-center gap-3">
            <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${
              isActive ? 'text-primary' : 'text-slate-500 group-hover:text-primary'
            }`} />
            <span className="tracking-normal">{item.label}</span>
          </div>
          {item.badge && (
            <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-semibold ${
              item.badge === 'Live'
                ? 'bg-moss-green-light text-moss-green-dark border border-moss-green/30 animate-pulse'
                : item.badge === 'Admin'
                ? 'bg-primary-light text-primary border border-primary-border'
                : isActive
                ? 'bg-primary text-white font-bold'
                : 'bg-surface-blue text-primary border border-surface-blue-border'
            }`}>
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onCloseMobile }) => {
  const { role } = useAuth()
  const { subscribe } = useRealtime()
  const [atRiskCount, setAtRiskCount] = useState<number | null>(null)

  const loadAtRiskCount = useCallback(async () => {
    try {
      const count = await api.getAtRiskCount()
      setAtRiskCount(count)
    } catch (err) {
      console.warn('[Sidebar] Failed to retrieve dynamic at-risk revenue count:', err)
    }
  }, [])

  useEffect(() => {
    loadAtRiskCount()
    const unsubTx = subscribe('TRANSACTION_UPDATED', () => loadAtRiskCount())
    const unsubQueue = subscribe('RECOVERY_QUEUE_UPDATED', () => loadAtRiskCount())
    const unsubCase = subscribe('RECOVERY_CASE_UPDATED', () => loadAtRiskCount())
    const unsubPay = subscribe('PAYMENT_RECEIVED', () => loadAtRiskCount())
    const unsubRecovered = subscribe('transaction_recovered', () => loadAtRiskCount())
    const unsubResync = subscribe('RECONNECT_RESYNC', () => loadAtRiskCount())
    const interval = setInterval(loadAtRiskCount, 30000)
    return () => {
      unsubTx(); unsubQueue(); unsubCase(); unsubPay(); unsubRecovered(); unsubResync()
      clearInterval(interval)
    }
  }, [loadAtRiskCount, subscribe])

  const atRiskBadge = atRiskCount !== null
    ? (atRiskCount > 999 ? '999+' : atRiskCount > 0 ? String(atRiskCount) : undefined)
    : undefined

  const sections: NavSection[] = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', path: '/overview', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Revenue',
      items: [
        { label: 'Demo Store', path: '/demo-checkout', icon: ShoppingBag, badge: 'Sandbox' },
        { label: 'Cart Recovery', path: '/abandonment', icon: ShoppingCart, badge: 'Pre-Pay' },
        { label: 'At-Risk Revenue', path: '/at-risk', icon: AlertOctagon, badge: atRiskBadge },
        { label: 'Transactions', path: '/transactions', icon: Receipt },
      ],
    },
    {
      label: 'Recovery',
      items: [
        { label: 'Recovery Agent', path: '/agent', icon: Bot, badge: 'Live' },
        { label: 'Simulation', path: '/simulation', icon: PlayCircle },
      ],
    },
    {
      label: 'Insights',
      items: [
        { label: 'Analytics', path: '/analytics', icon: BarChart3 },
        { label: 'Audit Trail', path: '/audit', icon: ScrollText },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Guardrails', path: '/guardrails', icon: ShieldCheck },
        ...(role === 'admin'
          ? [{ label: 'User Management', path: '/admin/users', icon: Users, badge: 'Admin' }]
          : []),
      ],
    },
    {
      label: 'Workspace',
      items: [
        { label: 'Integrations', path: '/integrations', icon: Zap },
        { label: 'Account', path: '/account', icon: User },
        ...(role === 'admin'
          ? [{ label: 'Settings', path: '/guardrails', icon: Settings }]
          : []),
      ],
    },
  ]

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-surface text-navy border-r border-border flex flex-col transition-transform duration-normal ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-18 px-5 flex items-center justify-between border-b border-border/80 bg-surface">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-bold font-display shadow-fintech-purple">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center">
                <span className="font-bold text-navy text-lg tracking-tight font-display">
                  Recover<span className="text-primary font-extrabold">AI</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block tracking-wider uppercase font-mono font-medium">
                Autonomous Revenue Ops
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 py-4 px-3.5 overflow-y-auto space-y-4">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-display">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItemRow key={item.path} item={item} onClose={onCloseMobile} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}
