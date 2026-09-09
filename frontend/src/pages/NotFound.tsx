import React from 'react'
import { Link } from 'react-router-dom'
import { Shield, ArrowRight, Home, LayoutDashboard, HelpCircle } from 'lucide-react'

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between text-navy antialiased font-sans">
      {/* Top Header */}
      <header className="border-b border-border/80 bg-surface/90 backdrop-blur-xs py-4 px-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-2xl bg-primary flex items-center justify-center text-white shadow-fintech-purple group-hover:scale-105 transition-all">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-navy text-xl tracking-tight font-display">
              Recover<span className="text-primary">AI</span>
            </span>
          </Link>

          <Link
            to="/overview"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple"
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-light border border-primary-border text-primary rounded-full text-xs font-mono font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>ERROR 404 • ROUTE UNRESOLVED</span>
          </div>

          {/* Headline */}
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-bold font-display text-navy tracking-tight">
              Page Not Found
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
              The requested recovery page or resource does not exist, has been moved, or requires different permissions.
            </p>
          </div>

          {/* Action Cards / Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/overview"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-fintech-purple transition-all"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Go to Overview Cockpit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface hover:bg-slate-50 text-navy border border-border text-xs font-semibold rounded-xl transition-all shadow-2xs"
            >
              <Home className="w-3.5 h-3.5 text-slate-400" />
              <span>Homepage</span>
            </Link>
          </div>

          {/* Help note */}
          <div className="pt-6 border-t border-border/70 flex items-center justify-center gap-1.5 text-slate-500 text-[11px]">
            <HelpCircle className="w-3.5 h-3.5 text-primary" />
            <span>Looking for transaction records? Check the <Link to="/transactions" className="text-primary font-bold hover:underline">Transactions Ledger</Link>.</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 py-4 px-6 text-center text-xs text-slate-400 bg-surface/50 font-mono">
        RecoverAI Autonomous Revenue Operations Engine
      </footer>
    </div>
  )
}

export default NotFound
