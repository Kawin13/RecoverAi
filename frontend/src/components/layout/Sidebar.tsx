import React from 'react'
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
  Settings,
  Shield,
  CreditCard,
  ShoppingBag,
  ShoppingCart
} from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onCloseMobile?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onCloseMobile }) => {
  const navItems = [
    { label: 'Overview', path: '/', icon: LayoutDashboard },
    { label: 'Demo Store', path: '/demo-checkout', icon: ShoppingBag, badge: 'Sandbox' },
    { label: 'Cart Recovery', path: '/abandonment', icon: ShoppingCart, badge: 'Pre-Pay' },
    { label: 'At-Risk Revenue', path: '/at-risk', icon: AlertOctagon, badge: '8' },
    { label: 'Transactions', path: '/transactions', icon: Receipt },
    { label: 'Recovery Agent', path: '/agent', icon: Bot, badge: 'Live' },
    { label: 'Simulation', path: '/simulation', icon: PlayCircle },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Audit Trail', path: '/audit', icon: ScrollText },
    { label: 'Guardrails', path: '/guardrails', icon: ShieldCheck },
    { label: 'Settings', path: '/settings', icon: Settings },
  ]

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-graphite/50 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-dark-surface text-warm-gray-300 border-r border-warm-gray-800 flex flex-col transition-transform duration-normal ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-warm-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-burnt-orange flex items-center justify-center text-surface font-bold font-display shadow-sm">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-surface text-base tracking-tight font-display">
                  Recover<span className="text-burnt-orange">AI</span>
                </span>
                <span className="px-1.5 py-0.2 bg-warm-gray-800 text-[10px] font-mono text-warm-gray-400 border border-warm-gray-700 rounded-sm">
                  v1.0
                </span>
              </div>
              <span className="text-[10px] text-warm-gray-400 block tracking-tight">
                Autonomous Revenue Ops
              </span>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-warm-gray-500 font-display">
            Operations
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-sm text-xs font-medium transition-all duration-fast ${
                    isActive
                      ? 'bg-burnt-orange/15 text-surface border-l-2 border-burnt-orange font-semibold'
                      : 'text-warm-gray-400 hover:text-surface hover:bg-warm-gray-800/60'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-mono rounded-sm ${
                      item.badge === 'Live'
                        ? 'bg-moss-green/20 text-moss-green-light border border-moss-green/30 animate-pulse'
                        : 'bg-burnt-orange/20 text-burnt-orange-light border border-burnt-orange/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* Footer Gateway Status */}
        <div className="p-3.5 border-t border-warm-gray-800 bg-warm-gray-900/40">
          <div className="p-2.5 rounded-sm bg-warm-gray-800/70 border border-warm-gray-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-moss-green animate-pulse" />
              <div>
                <span className="text-[11px] font-medium text-surface block">Razorpay Test Mode</span>
                <span className="text-[10px] text-warm-gray-400 font-mono">Gateway Sync: Active</span>
              </div>
            </div>
            <CreditCard className="w-4 h-4 text-warm-gray-400" />
          </div>
        </div>
      </aside>
    </>
  )
}
