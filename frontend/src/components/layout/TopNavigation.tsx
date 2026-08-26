import React, { useState } from 'react'
import {
  Menu,
  Bell,
  Building
} from 'lucide-react'

interface TopNavigationProps {
  onToggleSidebar: () => void
}

export const TopNavigation: React.FC<TopNavigationProps> = ({ onToggleSidebar }) => {
  const [showNotifications, setShowNotifications] = useState(false)
  const activeMerchant = 'Zenith Commerce India'

  return (
    <header className="h-16 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-fintech-subtle">
      {/* Left: Mobile Menu & Breadcrumb / Search */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="p-1.5 rounded-sm text-warm-gray-600 hover:text-graphite hover:bg-warm-gray-100 lg:hidden focus-visible:ring-2 focus-visible:ring-burnt-orange"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Merchant Selector */}
        <div className="hidden sm:flex items-center gap-2 pl-1 pr-3 py-1 bg-warm-gray-50 border border-border rounded-sm text-xs">
          <Building className="w-3.5 h-3.5 text-warm-gray-500" />
          <span className="font-medium text-graphite">{activeMerchant}</span>
          <span className="text-[10px] px-1 py-0.2 bg-moss-green-light text-moss-green-dark rounded-sm font-mono font-medium">
            LIVE
          </span>
        </div>
      </div>

      {/* Right: Agent Status, Search, Notifications, Profile */}
      <div className="flex items-center gap-3">
        {/* Agent Operational Status Pill */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-sm bg-moss-green-subtle border border-moss-green/30 text-xs">
          <span className="w-2 h-2 rounded-full bg-moss-green animate-pulse" />
          <span className="text-moss-green-dark font-medium font-display">
            Agent Autonomous: <strong className="font-semibold">Optimal (67.48% Rec)</strong>
          </span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="View system notifications"
            className="p-2 rounded-sm text-warm-gray-600 hover:text-graphite hover:bg-warm-gray-100 relative focus-visible:ring-2 focus-visible:ring-burnt-orange"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-burnt-orange ring-2 ring-surface" />
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-surface border border-border shadow-fintech-modal rounded-sm p-3 z-50 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-semibold text-graphite font-display">Agent Notifications</span>
                <span className="text-[10px] text-warm-gray-500 font-mono">3 Unread</span>
              </div>
              <div className="py-2 space-y-2 text-xs">
                <div className="p-2 bg-moss-green-subtle border border-moss-green/20 rounded-sm">
                  <p className="font-medium text-moss-green-dark">₹89,000 Payment Recovered</p>
                  <p className="text-[11px] text-warm-gray-600 mt-0.5">Order #ORD-89425 completed via dynamic paylink.</p>
                </div>
                <div className="p-2 bg-muted-amber-subtle border border-muted-amber/20 rounded-sm">
                  <p className="font-medium text-muted-amber-dark">Manual Approval Required</p>
                  <p className="text-[11px] text-warm-gray-600 mt-0.5">Order #ORD-89426 discount rule threshold check.</p>
                </div>
              </div>
              <div className="pt-2 border-t border-border text-center">
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] text-burnt-orange font-medium hover:underline"
                >
                  Close notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="w-7 h-7 rounded-sm bg-dark-surface text-surface flex items-center justify-center font-bold text-xs font-display">
            RA
          </div>
          <div className="hidden lg:block text-left text-xs">
            <span className="font-semibold text-graphite block leading-tight">Revenue Ops Admin</span>
            <span className="text-[10px] text-warm-gray-500 block">ops@recoverai.io</span>
          </div>
        </div>
      </div>
    </header>
  )
}
