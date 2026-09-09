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
  User,
  Shield,
  CreditCard,
  ShoppingBag,
  ShoppingCart,
  Users
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface SidebarProps {
  isOpen: boolean
  onCloseMobile?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onCloseMobile }) => {
  const { role } = useAuth()

  const navItems = [
    { label: 'Overview', path: '/overview', icon: LayoutDashboard },
    { label: 'Demo Store', path: '/demo-checkout', icon: ShoppingBag, badge: 'Sandbox' },
    { label: 'Cart Recovery', path: '/abandonment', icon: ShoppingCart, badge: 'Pre-Pay' },
    { label: 'At-Risk Revenue', path: '/at-risk', icon: AlertOctagon, badge: '8' },
    { label: 'Transactions', path: '/transactions', icon: Receipt },
    { label: 'Recovery Agent', path: '/agent', icon: Bot, badge: 'Live' },
    { label: 'Simulation', path: '/simulation', icon: PlayCircle },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Audit Trail', path: '/audit', icon: ScrollText },
    { label: 'Guardrails', path: '/guardrails', icon: ShieldCheck },
    ...(role === 'admin'
      ? [{ label: 'User Management', path: '/admin/users', icon: Users, badge: 'Admin' }]
      : []),
    { label: 'Account', path: '/account', icon: User },
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

        {/* Navigation List */}
        <div className="flex-1 py-5 px-3.5 overflow-y-auto space-y-1">
          <div className="px-3 pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-display">
            Platform Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
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
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 transition-colors ${
                          isActive ? 'text-primary' : 'text-slate-500 group-hover:text-primary'
                        }`}
                      />
                      <span className="tracking-normal">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-semibold ${
                          item.badge === 'Live'
                            ? 'bg-moss-green-light text-moss-green-dark border border-moss-green/30 animate-pulse'
                            : isActive
                            ? 'bg-primary text-white font-bold'
                            : 'bg-surface-blue text-primary border border-surface-blue-border'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* Footer Gateway Status */}
        <div className="p-4 border-t border-border/80 bg-surface">
          <div className="p-3.5 rounded-xl bg-surface-blue border border-surface-blue-border flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20" />
              <div>
                <span className="text-[11px] font-bold text-navy block font-display">Razorpay Test Mode</span>
                <span className="text-[10px] text-slate-500 font-mono font-medium">Gateway Sync: Active</span>
              </div>
            </div>
            <CreditCard className="w-4 h-4 text-primary" />
          </div>
        </div>
      </aside>
    </>
  )
}
