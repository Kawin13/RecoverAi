import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopNavigation } from './TopNavigation'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { useRealtime } from '../../lib/useRealtime'
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react'
import { ENV } from '../../config/env'

export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { status, reconnect } = useRealtime()

  return (
    <div className="min-h-screen bg-bg flex text-graphite antialiased font-sans">
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
          <div className="bg-amber-500/10 text-amber-900 border-b border-amber-500/20 px-4 py-1.5 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900 border border-amber-300 font-mono">
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
          <div className="bg-warm-gray-900 text-warm-gray-200 px-4 py-2 text-xs flex items-center justify-between border-b border-warm-gray-800">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-burnt-orange" />
              <span>
                <strong>Live Event Stream Offline:</strong> Operating in local resilient cached mode. Incoming payment failures are preserved.
              </span>
            </div>
            {reconnect && (
              <button
                type="button"
                onClick={reconnect}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-burnt-orange hover:bg-burnt-orange-dark text-white rounded-xs text-[11px] font-medium transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reconnect</span>
              </button>
            )}
          </div>
        )}

        {status === 'RECONNECTING' && (
          <div className="bg-amber-500/10 text-amber-900 px-4 py-1.5 text-xs flex items-center justify-between border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>
                Re-establishing gateway event stream connection...
              </span>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
