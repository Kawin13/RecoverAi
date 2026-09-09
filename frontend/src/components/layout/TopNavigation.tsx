import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Menu,
  Bell,
  Building,
  LogOut,
  ChevronDown,
  Loader2,
  User,
  Zap
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
  const { user, profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  
  const activeMerchant = 'Zenith Commerce India'

  const userDisplayName = profile?.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Revenue Operations User')
  const userEmail = profile?.email || user?.email || ''
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url
  const roleDisplay = role === 'admin' ? 'Administrator' : 'Revenue Operator'
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
    <header className="h-18 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-fintech-subtle">
      {/* Left: Mobile Menu & Workspace Selector */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="p-2 rounded-xl text-slate-500 hover:text-navy hover:bg-slate-100 lg:hidden focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Merchant Selector */}
        <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 bg-surface-blue/70 border border-surface-blue-border rounded-xl text-xs shadow-2xs">
          <Building className="w-4 h-4 text-primary" />
          <span className="font-semibold text-navy font-display">{activeMerchant}</span>
          <span className="text-[10px] px-2 py-0.5 bg-moss-green-light text-moss-green-dark border border-moss-green/30 rounded-full font-mono font-semibold">
            LIVE OPS
          </span>
        </div>
      </div>

      {/* Right: Realtime Status, Agent Status, Notifications, Profile Menu */}
      <div className="flex items-center gap-3.5">
        {/* Real-time Connection Status Indicator */}
        <div
          title={`Live Updates: ${status === 'LIVE' ? 'Connected' : status}`}
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-border text-[11px] font-mono select-none"
        >
          {status === 'LIVE' && (
            <>
              <span className="w-2 h-2 rounded-full bg-moss-green animate-pulse" />
              <span className="text-moss-green-dark font-medium">Live Updates</span>
            </>
          )}
          {status === 'RECONNECTING' && (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span className="text-amber-700 font-medium">Reconnecting</span>
            </>
          )}
          {status === 'OFFLINE' && (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-slate-500 font-medium">Offline</span>
            </>
          )}
        </div>

        {/* Recovery Mode Status Pill */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-subtle border border-primary-border text-xs">
          <Zap className="w-3.5 h-3.5 text-primary fill-primary/20" />
          <span className="text-primary font-medium font-display">
            Autonomous Recovery: <strong className="font-bold text-primary">67.48%</strong>
          </span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="View system notifications"
            className="p-2 rounded-xl text-slate-500 hover:text-navy hover:bg-slate-100 relative focus-visible:ring-2 focus-visible:ring-primary transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-surface shadow-xs" />
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-surface border border-border shadow-fintech-modal rounded-2xl p-4 z-50 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-xs font-bold text-navy font-display">Agent Notifications</span>
                <span className="text-[10px] text-primary bg-primary-light px-2 py-0.5 rounded-full font-mono font-semibold">3 Unread</span>
              </div>
              <div className="py-3 space-y-2.5 text-xs">
                <div className="p-3 bg-moss-green-light border border-moss-green/20 rounded-xl">
                  <p className="font-semibold text-moss-green-dark">₹89,000 Payment Recovered</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Order #ORD-89425 completed via dynamic paylink.</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl">
                  <p className="font-semibold text-amber-800">Manual Approval Required</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Order #ORD-89426 discount rule threshold check.</p>
                </div>
              </div>
              <div className="pt-2 border-t border-border text-center">
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] text-primary font-semibold hover:underline"
                >
                  Close notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu & Logout */}
        <div className="relative pl-2.5 border-l border-border" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User account menu"
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userDisplayName} className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center font-bold text-xs font-display shadow-fintech-subtle">
                {userInitials}
              </div>
            )}
            <div className="hidden lg:block text-left text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-navy block leading-tight truncate max-w-[130px]">
                  {userDisplayName}
                </span>
                <span className={`px-2 py-0.5 text-[9px] font-semibold rounded-full border ${
                  role === 'admin'
                    ? 'bg-primary-light text-primary border-primary-border'
                    : 'bg-surface-blue text-slate-700 border-surface-blue-border'
                }`}>
                  {roleDisplay}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block truncate max-w-[150px]">
                {userEmail}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* User Account Dropdown Modal */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-70 bg-surface border border-border shadow-fintech-modal rounded-2xl p-4 z-50 animate-in fade-in">
              <div className="pb-3 border-b border-border">
                <div className="flex items-center gap-3 mb-2">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={userDisplayName} className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm font-display shadow-fintech-purple">
                      {userInitials}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-navy truncate font-display">
                      {userDisplayName}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate font-mono">
                      {userEmail}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-1.5 text-[11px] bg-slate-50 px-3 py-1.5 rounded-xl border border-border">
                  <span className="text-slate-500 font-medium">Role:</span>
                  <span className={`px-2 py-0.5 rounded-full font-semibold border text-[10px] ${
                    role === 'admin'
                      ? 'bg-primary-light text-primary border-primary-border'
                      : 'bg-surface-blue text-slate-700 border-surface-blue-border'
                  }`}>
                    {roleDisplay}
                  </span>
                </div>
              </div>

              {/* Menu Links */}
              <div className="py-2 space-y-1 text-xs">
                {role === 'admin' && (
                  <Link
                    to="/admin/users"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-navy hover:bg-slate-50 transition-colors font-medium"
                  >
                    <Building className="w-4 h-4 text-primary" />
                    <span>User Management</span>
                  </Link>
                )}
                <Link
                  to="/account"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-navy hover:bg-slate-50 transition-colors font-medium"
                >
                  <User className="w-4 h-4 text-slate-500" />
                  <span>Account Settings</span>
                </Link>
              </div>

              {/* Sign Out Action */}
              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-brick-red hover:bg-brick-red-light transition-colors disabled:opacity-60 text-left cursor-pointer"
                >
                  {isSigningOut ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-brick-red" />
                      <span>Signing Out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4 text-brick-red" />
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
