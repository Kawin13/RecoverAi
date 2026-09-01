import React from 'react'
import { Link } from 'react-router-dom'
import { Shield, ArrowRight, Home, LayoutDashboard, HelpCircle } from 'lucide-react'

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between text-graphite antialiased font-sans">
      {/* Top Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-xs py-4 px-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-sm bg-burnt-orange flex items-center justify-center text-white shadow-fintech-subtle group-hover:bg-burnt-orange-hover transition-colors">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-bold text-graphite text-lg tracking-tight font-display">
              Recover<span className="text-burnt-orange">AI</span>
            </span>
          </Link>

          <Link
            to="/overview"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-surface hover:bg-graphite text-surface rounded-sm text-xs font-medium transition-colors shadow-2xs"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Open Cockpit</span>
          </Link>
        </div>
      </header>

      {/* Main 404 Hero */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-burnt-orange-subtle border border-burnt-orange/30 text-burnt-orange rounded-sm text-xs font-mono font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-burnt-orange animate-pulse" />
            <span>ERROR 404 • ROUTE UNRESOLVED</span>
          </div>

          {/* Headline */}
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-bold font-display text-graphite tracking-tight">
              Page Not Found
            </h1>
            <p className="text-xs sm:text-sm text-warm-gray-600 leading-relaxed max-w-sm mx-auto">
              The requested recovery page or resource does not exist, has been moved, or requires different permissions.
            </p>
          </div>

          {/* Action Cards / Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/overview"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white text-xs font-medium rounded-sm shadow-sm transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Go to Overview Cockpit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface hover:bg-warm-gray-100 text-graphite border border-border text-xs font-medium rounded-sm transition-colors shadow-2xs"
            >
              <Home className="w-3.5 h-3.5 text-warm-gray-500" />
              <span>Homepage</span>
            </Link>
          </div>

          {/* Help note */}
          <div className="pt-6 border-t border-border flex items-center justify-center gap-1.5 text-warm-gray-500 text-[11px]">
            <HelpCircle className="w-3.5 h-3.5 text-warm-gray-400" />
            <span>Looking for transaction records? Check the <Link to="/transactions" className="text-burnt-orange font-medium hover:underline">Transactions Ledger</Link>.</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-6 text-center text-xs text-warm-gray-500 bg-surface/50 font-mono">
        RecoverAI Autonomous Revenue Operations Engine
      </footer>
    </div>
  )
}
