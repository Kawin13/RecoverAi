import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Menu,
  Bell,
  Building,
  LogOut,
  CheckCircle2,
  ChevronDown,
  Loader2,
  User
} from 'lucide-react'
import { useRealtime } from '../../lib/useRealtime'
import { useAuth } from '../../context/AuthContext'

interface TopNavigationProps {
  onToggleSidebar: () => void
}

export const TopNavigation: React.FC<TopNavigationProps> = ({ onToggleSidebar }) => {
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  
  const { status } = useRealtime()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  
  const activeMerchant = 'Zenith Commerce India'

  const userDisplayName = user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Revenue Operations User')
  const userEmail = user?.email || ''
  const avatarUrl = user?.user_metadata?.avatar_url
  const userInitials = (userDisplayName || 'RA')
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'RA'

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      setShowUserMenu(false)
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Sign out error:', err)
      setShowUserMenu(false)
      navigate('/login', { replace: true })
    } finally {
      setIsSigningOut(false)
    }
  }

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

      {/* Right: Realtime Status, Agent Status, Notifications, Profile Menu */}
      <div className="flex items-center gap-3">
        {/* Real-time Connection Status Indicator */}
        <div
          title={`Live Updates: ${status === 'LIVE' ? 'Connected' : status}`}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-warm-gray-50 border border-border text-[11px] font-mono select-none"
        >
          {status === 'LIVE' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-moss-green animate-pulse" />
              <span className="text-moss-green-dark font-medium">Live Updates</span>
            </>
          )}
          {status === 'RECONNECTING' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              <span className="text-amber-700 font-medium">Reconnecting</span>
            </>
          )}
          {status === 'OFFLINE' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-warm-gray-400" />
              <span className="text-warm-gray-500 font-medium">Offline</span>
            </>
          )}
        </div>

        {/* Recovery Mode Status Pill */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-sm bg-moss-green-subtle border border-moss-green/30 text-xs">
          <span className="w-2 h-2 rounded-full bg-moss-green animate-pulse" />
          <span className="text-moss-green-dark font-medium font-display">
            Autonomous Recovery: <strong className="font-semibold">67.48%</strong>
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

        {/* User Profile Menu & Logout */}
        <div className="relative pl-2 border-l border-border" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User account menu"
            className="flex items-center gap-2 p-1 rounded-sm hover:bg-warm-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-burnt-orange"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userDisplayName} className="w-7 h-7 rounded-sm object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-sm bg-dark-surface text-surface flex items-center justify-center font-bold text-xs font-display">
                {userInitials}
              </div>
            )}
            <div className="hidden lg:block text-left text-xs">
              <span className="font-semibold text-graphite block leading-tight truncate max-w-[130px]">
                {userDisplayName}
              </span>
              <span className="text-[10px] text-warm-gray-500 block truncate max-w-[130px]">
                {userEmail}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-warm-gray-400 hidden sm:block" />
          </button>

          {/* User Account Dropdown Modal */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-surface border border-border shadow-fintech-modal rounded-sm p-3 z-50 animate-in fade-in">
              <div className="pb-3 border-b border-border">
                <div className="flex items-center gap-2 mb-1">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={userDisplayName} className="w-8 h-8 rounded-sm object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-sm bg-burnt-orange text-white flex items-center justify-center font-bold text-xs font-display">
                      {userInitials}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-graphite truncate font-display">
                      {userDisplayName}
                    </p>
                    <p className="text-[10px] text-warm-gray-500 truncate font-mono">
                      {userEmail}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-moss-green-dark bg-moss-green-subtle px-2 py-0.5 rounded-sm border border-moss-green/20">
                  <CheckCircle2 className="w-3 h-3 text-moss-green" />
                  <span>Authenticated Workspace Session</span>
                </div>
              </div>

              {/* Menu Links */}
              <div className="py-1.5 space-y-0.5 text-xs">
                <Link
                  to="/account"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-graphite hover:bg-warm-gray-50 transition-colors font-medium"
                >
                  <User className="w-3.5 h-3.5 text-warm-gray-500" />
                  <span>Account</span>
                </Link>
              </div>

              {/* Sign Out Action */}
              <div className="pt-1.5 border-t border-border">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-xs font-medium text-brick-red hover:bg-brick-red-light transition-colors disabled:opacity-60 text-left"
                >
                  {isSigningOut ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-brick-red" />
                      <span>Signing Out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-3.5 h-3.5 text-brick-red" />
                      <span>Sign Out</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
