import React, { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopNavigation } from './TopNavigation'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { useRealtime } from '../../lib/useRealtime'
import { useWorkspace } from '../../context/WorkspaceContext'
import { AlertTriangle, RefreshCw, WifiOff, Loader2 } from 'lucide-react'
import { ENV } from '../../config/env'

export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { status, reconnect } = useRealtime()
  const { isOnboarding, workspaces, loading: wsLoading } = useWorkspace()

  if (wsLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading workspace...</p>
        </div>
      </div>
    )
  }

  if (isOnboarding || workspaces.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="min-h-screen bg-bg flex text-navy antialiased font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <TopNavigation onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        {/* Explicit Demo Mode Banner */}
        {ENV.DEMO_MODE && (
          <div className="bg-amber-500/10 text-amber-900 border-b border-amber-500/20 px-4 py-2 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-200 text-amber-900 border border-amber-300 font-mono">
                Demo Data
              </span>
              <span>
                <strong>Explicit Demo Mode Active:</strong> Operating with demonstration dataset. Real payment gateway and database state are not impacted.
              </span>
            </div>
          </div>
        )}

        {/* Network Disconnect & Fallback Banner */}
        {status === 'OFFLINE' && (
          <div className="bg-rose-50 text-rose-900 px-4 py-2 text-xs flex items-center justify-between border-b border-rose-200">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-rose-600" />
              <span>
                <strong>Live Event Stream Offline:</strong> Operating in local resilient cached mode. Incoming payment failures are preserved.
              </span>
            </div>
            {reconnect && (
              <button
                type="button"
                onClick={reconnect}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reconnect</span>
              </button>
            )}
          </div>
        )}

        {status === 'RECONNECTING' && (
          <div className="bg-amber-500/10 text-amber-900 px-4 py-2 text-xs flex items-center justify-between border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>
                Re-establishing gateway event stream connection...
              </span>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 min-w-0 overflow-x-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
