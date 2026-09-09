import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Smartphone,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  Lock,
  Menu,
  X,
  FileText,
  Clock,
  ArrowUpRight,
  Ban,
  Sparkles,
  Zap
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | 'security' | null>(null)
  const { session } = useAuth()
  const isAuthenticated = !!session

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="min-h-screen bg-bg text-navy font-sans antialiased selection:bg-primary-light selection:text-primary">
      {/* ==================================================================== */}
      {/* SECTION 1 — NAVBAR                                                  */}
      {/* ==================================================================== */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-border/70 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Left: RecoverAI Wordmark */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group focus:outline-none">
              <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white font-bold font-display shadow-fintech-purple group-hover:bg-primary-hover transition-all group-hover:scale-105">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-navy text-xl tracking-tight font-display">
                  Recover<span className="text-primary">AI</span>
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-500">
            <button
              type="button"
              onClick={() => scrollToSection('product')}
              className="hover:text-primary transition-colors py-1 cursor-pointer"
            >
              Product
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-primary transition-colors py-1 cursor-pointer"
            >
              How it Works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('differentiation')}
              className="hover:text-primary transition-colors py-1 cursor-pointer"
            >
              Beyond Retry
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('safety')}
              className="hover:text-primary transition-colors py-1 cursor-pointer"
            >
              Safety
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('impact')}
              className="hover:text-primary transition-colors py-1 cursor-pointer"
            >
              Impact
            </button>
          </nav>

          {/* Right: Auth / Dashboard CTA */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/overview"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple"
              >
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-navy hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-navy md:hidden focus:outline-none rounded-xl cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-border bg-surface px-4 pt-3 pb-5 space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col space-y-2 text-sm font-semibold text-slate-700">
              <button
                type="button"
                onClick={() => scrollToSection('product')}
                className="text-left px-3 py-2 hover:bg-slate-50 rounded-xl"
              >
                Product
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className="text-left px-3 py-2 hover:bg-slate-50 rounded-xl"
              >
                How it Works
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('differentiation')}
                className="text-left px-3 py-2 hover:bg-slate-50 rounded-xl"
              >
                Beyond Retry
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('safety')}
                className="text-left px-3 py-2 hover:bg-slate-50 rounded-xl"
              >
                Safety
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('impact')}
                className="text-left px-3 py-2 hover:bg-slate-50 rounded-xl"
              >
                Impact
              </button>
            </div>
            <div className="pt-3 border-t border-border flex flex-col gap-2">
              {isAuthenticated ? (
                <Link
                  to="/overview"
                  className="w-full text-center px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-fintech-purple"
                >
                  Open Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="w-full text-center px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="w-full text-center px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-fintech-purple"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ==================================================================== */}
      {/* SECTION 2 — HERO                                                    */}
      {/* ==================================================================== */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden border-b border-border/70">
        {/* Subtle decorative glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            {/* Small Environment Label */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-surface-blue border border-surface-blue-border rounded-full text-xs font-semibold text-primary shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Built for intelligent, autonomous payment recovery</span>
            </div>

            {/* Strong Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display text-navy tracking-tight leading-[1.12]">
              Recover revenue.
              <br />
              <span className="text-primary">Not customer trust.</span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              RecoverAI detects revenue at risk, evaluates the safest recovery strategy, and executes intelligent payment recovery workflows using machine learning, Expected Recovery Value, and transparent financial guardrails.
            </p>

            {/* CTA Group */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => scrollToSection('product')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold rounded-xl shadow-fintech-purple transition-all cursor-pointer hover:scale-[1.02]"
              >
                <span>Explore RecoverAI</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-surface hover:bg-slate-50 text-navy border border-border text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                <span>See How It Works</span>
              </button>
            </div>

            {/* Operational Metrics Strip */}
            <div className="pt-10 grid grid-cols-3 gap-3 sm:gap-6 border-t border-border/70 max-w-xl mx-auto text-center">
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Decision Engine</span>
                <span className="font-bold text-navy text-xs sm:text-sm font-display mt-0.5 block">12-Factor Taxonomy</span>
              </div>
              <div className="border-x border-border/70">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Optimization</span>
                <span className="font-bold text-navy text-xs sm:text-sm font-display mt-0.5 block">Real-Time ERV</span>
              </div>
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Execution</span>
                <span className="font-bold text-navy text-xs sm:text-sm font-display mt-0.5 block">Governed & Automated</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 3 — LIVE PRODUCT PREVIEW                                    */}
      {/* ==================================================================== */}
      <section id="product" className="py-16 md:py-24 bg-surface border-b border-border/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-bold rounded-full">
                  LIVE RECOVERY COCKPIT
                </span>
                <span className="px-2.5 py-1 bg-surface-blue text-primary text-[10px] font-mono font-bold rounded-full border border-surface-blue-border">
                  DEMO DATA
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-navy">
                Real-Time Recovery Intelligence
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Autonomous agent monitoring, strategy evaluation, and governed decision execution.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/overview"
                className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white hover:bg-slate-800 rounded-xl text-xs font-semibold transition-all shadow-2xs"
              >
                <span>Open Full Interactive Cockpit</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Mock Cockpit Window */}
          <div className="bg-bg rounded-2xl border border-border/80 shadow-fintech-card overflow-hidden">
            {/* Header bar */}
            <div className="px-5 py-3 bg-surface border-b border-border/70 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-xs text-navy font-semibold">Gateway Sync: Razorpay Test Mode</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 font-mono text-[11px]">Merchant: Zenith Commerce India</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                  <Zap className="w-3 h-3" /> SSE Stream: LIVE
                </span>
              </div>
            </div>

            {/* Cockpit Content */}
            <div className="p-6 space-y-6">
              {/* Top 3 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface p-5 rounded-2xl border border-border/80 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span className="font-semibold">Revenue At Risk</span>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-2xl font-bold font-display text-navy mt-1.5">
                    ₹6,81,400
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                    8 at-risk cases in active recovery
                  </span>
                </div>

                <div className="bg-surface p-5 rounded-2xl border border-border/80 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span className="font-semibold">Revenue Recovered</span>
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold font-display text-emerald-600 mt-1.5">
                    ₹4,59,840
                  </div>
                  <span className="text-[11px] text-emerald-700 font-mono font-medium mt-0.5 block">
                    +₹1,68,840 over naive baseline
                  </span>
                </div>

                <div className="bg-surface p-5 rounded-2xl border border-border/80 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span className="font-semibold">Recovery Rate</span>
                    <BarChart3 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-2xl font-bold font-display text-navy mt-1.5">
                    67.48%
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                    Autonomous win rate (last 7 days)
                  </span>
                </div>
              </div>

              {/* Miniature Strategy Table */}
              <div className="bg-surface rounded-2xl border border-border/80 overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="text-xs font-bold text-navy font-display uppercase tracking-wider">
                      Dynamic Strategy Comparison Engine (ERV Ranked)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Evaluating candidate actions against payment channel likelihood and friction cost
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-surface text-slate-600 border border-border text-[10px] font-mono font-semibold rounded-full">
                    DEMO DATA
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/70 bg-slate-50/80 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-5 font-semibold">Candidate Action</th>
                        <th className="py-3 px-5 font-semibold">Probability</th>
                        <th className="py-3 px-5 font-semibold">Confidence Bar</th>
                        <th className="py-3 px-5 font-semibold">Friction Cost</th>
                        <th className="py-3 px-5 font-semibold">Policy Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-sans">
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-5 font-medium text-navy flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl bg-primary-light flex items-center justify-center text-primary">
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-navy">UPI Switch</span>
                            <span className="block text-[10px] text-slate-400 font-mono">Dynamic intent link</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 font-mono font-bold text-emerald-600 text-sm">
                          84%
                        </td>
                        <td className="py-3.5 px-5 w-48">
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '84%' }} />
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-[11px] text-slate-600 font-mono">
                          ₹12 (Low friction)
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Optimal Action</span>
                          </span>
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-5 font-medium text-navy flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-navy">Payment Link</span>
                            <span className="block text-[10px] text-slate-400 font-mono">Branded SMS / WhatsApp</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 font-mono font-bold text-navy text-sm">
                          73%
                        </td>
                        <td className="py-3.5 px-5 w-48">
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: '73%' }} />
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-[11px] text-slate-600 font-mono">
                          ₹25 (Medium friction)
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-border text-[10px] font-semibold rounded-full">
                            <span>Secondary</span>
                          </span>
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-5 font-medium text-navy flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                            <RefreshCw className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-navy">Retry Later</span>
                            <span className="block text-[10px] text-slate-400 font-mono">Scheduled 15-min backoff</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 font-mono font-bold text-slate-500 text-sm">
                          49%
                        </td>
                        <td className="py-3.5 px-5 w-48">
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-slate-400 h-full rounded-full" style={{ width: '49%' }} />
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-[11px] text-slate-600 font-mono">
                          ₹0 (Zero friction)
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold rounded-full">
                            <span>Fallback Queue</span>
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 4 — THE PROBLEM                                             */}
      {/* ==================================================================== */}
      <section className="py-16 md:py-24 border-b border-border/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl">
            <span className="text-xs font-mono font-bold uppercase text-primary tracking-wider">
              Diagnostic Precision
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-navy mt-1.5">
              Payment failure is not one problem.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
              Different failures need different recovery actions. Naive retry bots spam customers and trigger gateway bans. RecoverAI matches each failure taxonomy to a safe, mathematically optimized recovery rail.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Scenario 1 */}
            <div className="bg-surface p-6 rounded-2xl border border-border/80 shadow-fintech-card flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-full border border-border">
                    Scenario 01
                  </span>
                  <Clock className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-base font-bold text-navy font-display">
                  UPI Timeout
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The issuing bank's switch experiences temporary network latency. Retrying immediately guarantees another timeout error.
                </p>
              </div>
              <div className="pt-4 border-t border-border/70 flex items-center gap-2 text-xs font-mono text-primary font-bold">
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Action: Retry later</span>
              </div>
            </div>

            {/* Scenario 2 */}
            <div className="bg-surface p-6 rounded-2xl border border-border/80 shadow-fintech-card flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-full border border-border">
                    Scenario 02
                  </span>
                  <Smartphone className="w-4 h-4 text-primary" />
                </div>
                <div className="text-base font-bold text-navy font-display">
                  Card declined twice
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Customer has reached their daily international limit or 3DS verification failed. Repeating card charge triggers fraud flags.
                </p>
              </div>
              <div className="pt-4 border-t border-border/70 flex items-center gap-2 text-xs font-mono text-primary font-bold">
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Action: Switch recovery journey to UPI</span>
              </div>
            </div>

            {/* Scenario 3 */}
            <div className="bg-surface p-6 rounded-2xl border border-border/80 shadow-fintech-card flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-full border border-border">
                    Scenario 03
                  </span>
                  <Ban className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-base font-bold text-navy font-display">
                  Repeated unsuccessful attempts
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Transaction exceeds max velocity policy or instrument is permanently invalid. Continued messaging irritates the user.
                </p>
              </div>
              <div className="pt-4 border-t border-border/70 flex items-center gap-2 text-xs font-mono text-rose-600 font-bold">
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Action: Stop</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 5 — HOW RECOVERAI WORKS                                     */}
      {/* ==================================================================== */}
      <section id="how-it-works" className="py-16 md:py-24 bg-surface border-b border-border/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold uppercase text-primary tracking-wider">
              Autonomous Pipeline
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-navy mt-1.5">
              How RecoverAI Works
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              A 7-stage deterministic pipeline from real-time webhook ingestion to cryptographic ledger reconciliation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {[
              {
                step: '01',
                title: 'Detect',
                desc: 'Ingest real-time failed transaction or checkout drop-off event.'
              },
              {
                step: '02',
                title: 'Diagnose',
                desc: 'Classify root failure taxonomy across gateway, bank, and user factors.'
              },
              {
                step: '03',
                title: 'Predict',
                desc: 'Compute multi-action success probabilities using machine learning.'
              },
              {
                step: '04',
                title: 'Compare',
                desc: 'Calculate Expected Recovery Value (ERV) factoring friction & fee costs.'
              },
              {
                step: '05',
                title: 'Guardrail',
                desc: 'Enforce retry caps, cooldown windows, discount ceilings, and human review.'
              },
              {
                step: '06',
                title: 'Execute',
                desc: 'Dispatch optimal recovery action via payment link, rail switch, or retry.'
              },
              {
                step: '07',
                title: 'Verify',
                desc: 'Reconcile gateway webhook capture and append to immutable audit log.'
              }
            ].map((item) => (
              <div
                key={item.step}
                className="bg-bg p-4 rounded-2xl border border-border/80 flex flex-col justify-between space-y-2 hover:border-primary/50 transition-all shadow-2xs hover:shadow-fintech-card"
              >
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono font-bold text-primary block">
                    {item.step}
                  </span>
                  <h4 className="text-sm font-bold text-navy font-display">
                    {item.title}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 6 — DIFFERENTIATION                                         */}
      {/* ==================================================================== */}
      <section id="differentiation" className="py-16 md:py-24 border-b border-border/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl">
            <span className="text-xs font-mono font-bold uppercase text-primary tracking-wider">
              Architectural Superiority
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-navy mt-1.5">
              Beyond Smart Retry
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Most payment platforms treat recovery as an aggressive spam loop. RecoverAI treats recovery as an Expected Value optimization problem governed by financial safety.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="bg-surface rounded-2xl border border-border/80 overflow-hidden shadow-fintech-card">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/70">
              {/* Conventional Recovery */}
              <div className="p-7 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-border/70">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                      Legacy Systems
                    </span>
                    <h3 className="text-base font-bold text-navy font-display">
                      Conventional Recovery
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono font-semibold rounded-full">
                    Static Rules
                  </span>
                </div>

                <div className="space-y-3.5 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <strong className="text-navy font-semibold">Naive Retry:</strong> Periodic automated retries regardless of decline code or balance status.
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <strong className="text-navy font-semibold">Generic Reminder:</strong> Static dunning email or broadcast SMS notification.
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <strong className="text-navy font-semibold">Payment Link:</strong> Unconditional payment link creation without intent evaluation.
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 text-rose-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <strong>Blind Execution:</strong> Zero friction cost estimation, leading to gateway surcharges and customer churn.
                    </div>
                  </div>
                </div>
              </div>

              {/* RecoverAI */}
              <div className="p-7 space-y-5 bg-surface-blue/40">
                <div className="flex items-center justify-between pb-3 border-b border-surface-blue-border">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-primary font-bold block">
                      Autonomous Intelligence
                    </span>
                    <h3 className="text-base font-bold text-navy font-display">
                      RecoverAI Platform
                    </h3>
                  </div>
                  <span className="px-3 py-1 bg-primary-light text-primary border border-primary-border text-[10px] font-mono font-bold rounded-full">
                    Autonomous ERV Engine
                  </span>
                </div>

                <div className="space-y-3.5 text-xs text-navy">
                  {[
                    { label: 'Failure diagnosis', detail: '12-factor taxonomy identifying exact root cause' },
                    { label: 'Per-action recovery likelihood', detail: 'Calibrated recovery likelihood models' },
                    { label: 'Expected Recovery Value', detail: 'Net mathematical ERV optimization (Value - Friction)' },
                    { label: 'Guardrails', detail: 'Configurable retry caps, cooldown timers, and discount limits' },
                    { label: 'Human escalation', detail: 'Mandatory ops sign-off on transactions over ₹50,000' },
                    { label: 'Audit trail', detail: 'Tamper-evident step logging with complete decision rationale' },
                    { label: 'Outcome tracking', detail: 'Deterministic closed-loop gateway reconciliation' }
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-bold text-navy">{item.label}:</span>{' '}
                        <span className="text-slate-600">{item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 7 — SAFETY                                                  */}
      {/* ==================================================================== */}
      <section id="safety" className="py-16 md:py-24 bg-surface border-b border-border/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl">
            <span className="text-xs font-mono font-bold uppercase text-primary tracking-wider">
              Fintech Governance
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display text-navy mt-1.5">
              Bounded Autonomy
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Financial operations require zero tolerance for hallucinations. RecoverAI implements strict mathematical boundaries, operational circuits, and immutable audit trails.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Retry Limits',
                desc: 'Strict maximum of 3 recovery attempts per customer order. Intelligent exponential backoff prevents gateway rate-limiting.',
                icon: RefreshCw
              },
              {
                title: 'High-Value Approvals',
                desc: 'High-ticket orders automatically pause execution and route to human ops reviewers before executing financial actions.',
                icon: ShieldCheck
              },
              {
                title: 'Customer Opt-Outs',
                desc: 'Immediate, zero-delay suppression upon opt-out or quiet hours. Protects merchant brand equity and trust.',
                icon: Ban
              },
              {
                title: 'Fraud & Risk Blocking',
                desc: 'Instant circuit-breaker blocks recovery if an instrument is reported stolen or card velocity anomalies occur.',
                icon: Lock
              },
              {
                title: 'Full Decision Audit Trail',
                desc: 'Every ML prediction, probability distribution, and action execution is permanently recorded with full transparency.',
                icon: FileText
              },
              {
                title: 'No Uncontrolled LLM Actions',
                desc: 'Gemini models only draft customer-facing explanations; money movement and state transitions are 100% deterministic code.',
                icon: Shield
              }
            ].map((safety) => {
              const Icon = safety.icon
              return (
                <div
                  key={safety.title}
                  className="bg-bg p-6 rounded-2xl border border-border/80 shadow-2xs space-y-3 hover:border-slate-300 transition-all hover:shadow-fintech-card"
                >
                  <div className="w-9 h-9 rounded-2xl bg-surface-blue text-primary border border-surface-blue-border flex items-center justify-center shadow-2xs">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-navy font-display">
                    {safety.title}
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {safety.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 8 — IMPACT                                                  */}
      {/* ==================================================================== */}
      <section id="impact" className="py-16 md:py-24 border-b border-border/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono font-bold rounded-full">
                  PORTFOLIO IMPACT
                </span>
                <span className="px-2.5 py-1 bg-surface-blue text-primary text-[10px] font-mono font-bold rounded-full border border-surface-blue-border">
                  SIMULATED EXAMPLE
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold font-display text-navy">
                Quantifiable Financial Lift
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                Comparing conventional naive retries against RecoverAI's multi-action propensity recovery across simulated transaction batches.
              </p>
            </div>
          </div>

          {/* Impact Comparison Grid */}
          <div className="bg-surface rounded-2xl border border-border/80 p-6 sm:p-8 shadow-fintech-card space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-bg rounded-2xl border border-border/80">
                <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold block">
                  Revenue At Risk
                </span>
                <span className="text-2xl sm:text-3xl font-bold font-display text-navy block mt-1">
                  ₹6.81L
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  100% Failed Volume
                </span>
              </div>

              <div className="p-5 bg-bg rounded-2xl border border-border/80">
                <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold block">
                  Baseline Recovery
                </span>
                <span className="text-2xl sm:text-3xl font-bold font-display text-slate-600 block mt-1">
                  ₹2.91L
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  42.7% via Naive Retry
                </span>
              </div>

              <div className="p-5 bg-emerald-50/70 rounded-2xl border border-emerald-200">
                <span className="text-[11px] font-mono text-emerald-800 uppercase block font-bold">
                  RecoverAI Recovery
                </span>
                <span className="text-2xl sm:text-3xl font-bold font-display text-emerald-800 block mt-1">
                  ₹4.59L
                </span>
                <span className="text-[10px] text-emerald-700 font-mono font-medium">
                  67.5% Closed Capture
                </span>
              </div>

              <div className="p-5 bg-primary-light/40 rounded-2xl border border-primary-border">
                <span className="text-[11px] font-mono text-primary uppercase block font-bold">
                  Additional Recovery
                </span>
                <span className="text-2xl sm:text-3xl font-bold font-display text-primary block mt-1">
                  +₹1.68L
                </span>
                <span className="text-[10px] text-primary font-mono font-medium">
                  +57.7% Lift Over Baseline
                </span>
              </div>
            </div>

            {/* Visual Stacked Bar Illustration */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-slate-600 font-medium">
                <span>Recovery Allocation Waterfall</span>
                <span>₹4.59L / ₹6.81L Total Volume</span>
              </div>
              <div className="w-full bg-slate-100 h-8 rounded-xl overflow-hidden flex text-[10px] font-mono text-white font-bold shadow-2xs">
                <div
                  className="bg-emerald-600 flex items-center justify-center px-2"
                  style={{ width: '42.7%' }}
                  title="Baseline Recovery: ₹2.91L (42.7%)"
                >
                  Baseline: ₹2.91L
                </div>
                <div
                  className="bg-primary flex items-center justify-center px-2"
                  style={{ width: '24.8%' }}
                  title="RecoverAI Additional Lift: +₹1.68L (+24.8%)"
                >
                  +₹1.68L Lift
                </div>
                <div
                  className="bg-slate-300 text-slate-600 flex items-center justify-center px-2"
                  style={{ width: '32.5%' }}
                  title="Unrecoverable / Hard Decline: ₹2.22L (32.5%)"
                >
                  Hard Decline
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                <span>Label: SIMULATED EXAMPLE — Batch of 1,000 synthetic transaction records</span>
                <Link to="/simulation" className="text-primary font-bold hover:underline flex items-center gap-1">
                  <span>Run Custom Batch Simulation</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 9 — FINAL CTA                                               */}
      {/* ==================================================================== */}
      <section className="py-20 purple-hero-gradient text-white relative overflow-hidden shadow-fintech-purple">
        {/* Decorative background glow circles */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute left-8 bottom-0 w-64 h-64 rounded-full bg-primary-dark/30 blur-2xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white mx-auto shadow-2xs backdrop-blur-xs">
            <Shield className="w-6 h-6" />
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display text-white max-w-2xl mx-auto tracking-tight leading-tight">
            See every recovery decision.
            <br />
            <span className="text-purple-200">Understand every recovered rupee.</span>
          </h2>

          <p className="text-purple-100 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Deploy bounded, intelligent recovery workflows that protect transaction revenue without compromising customer relationships.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              to="/signup"
              className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-slate-50 text-primary text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md hover:scale-105"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs sm:text-sm font-semibold rounded-xl transition-all backdrop-blur-xs"
            >
              Sign In
            </Link>
            <Link
              to="/demo-checkout"
              className="w-full sm:w-auto px-7 py-3.5 bg-transparent hover:bg-white/10 text-purple-200 hover:text-white text-xs sm:text-sm font-semibold rounded-xl transition-all"
            >
              Try Sandbox Store
            </Link>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* FOOTER                                                               */}
      {/* ==================================================================== */}
      <footer className="bg-surface border-t border-border/70 pt-14 pb-10 text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Main Grid: Desktop 5-Col, Tablet 2-Col, Mobile 1-Col */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-8 xl:gap-10 items-start">
            {/* Left: Brand & Product Summary */}
            <div className="col-span-1 md:col-span-2 lg:col-span-1 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white font-bold font-display shadow-fintech-purple">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-navy font-display text-lg tracking-tight">
                  Recover<span className="text-primary">AI</span>
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                RecoverAI helps digital commerce businesses recover lost revenue from failed payments and abandoned checkouts. It detects recovery opportunities, recommends the best next action, and supports safe execution with approval controls and full audit visibility.
              </p>

              {/* Clean Status & Trust Card */}
              <div className="p-3.5 bg-slate-50 border border-border/80 rounded-2xl space-y-1 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-semibold text-navy">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span>Recovery Engine Active</span>
                </div>
                <p className="text-[11px] text-slate-500 pl-4 leading-normal">
                  Real-time monitoring, prioritization, and recovery workflows
                </p>
              </div>

              {/* Three Trust Badges */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5 text-xs text-slate-500">
                <div className="flex items-center gap-1.5 whitespace-nowrap" title="Secure Payment Flows">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Secure Payment Flows</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap" title="Human Approval Controls">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>Human Approval Controls</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap" title="Audit Ready">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Audit Ready</span>
                </div>
              </div>
            </div>

            {/* Col 1: Core Capabilities */}
            <div className="col-span-1 md:col-span-1 lg:col-span-1 space-y-4">
              <div className="h-7 flex items-center">
                <h4 className="text-sm font-bold text-navy font-display">
                  Core Capabilities
                </h4>
              </div>
              <ul className="space-y-2.5 text-xs font-normal">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('product')}
                    className="text-left w-full text-slate-500 hover:text-primary transition-colors cursor-pointer"
                  >
                    Failed Payment Detection
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('product')}
                    className="text-left w-full text-slate-500 hover:text-primary transition-colors cursor-pointer"
                  >
                    Recovery Scoring
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('product')}
                    className="text-left w-full text-slate-500 hover:text-primary transition-colors cursor-pointer"
                  >
                    Expected Recovery Value (ERV)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('how-it-works')}
                    className="text-left w-full text-slate-500 hover:text-primary transition-colors cursor-pointer"
                  >
                    Smart Payment Links
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('how-it-works')}
                    className="text-left w-full text-slate-500 hover:text-primary transition-colors cursor-pointer"
                  >
                    Customer Recovery Messaging
                  </button>
                </li>
                <li>
                  <Link
                    to="/abandonment"
                    className="text-left w-full block text-slate-500 hover:text-primary transition-colors"
                  >
                    Cart Recovery Flows
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 2: Safety & Governance */}
            <div className="col-span-1 md:col-span-1 lg:col-span-1 space-y-4">
              <div className="h-7 flex items-center">
                <h4 className="text-sm font-bold text-navy font-display">
                  Safety &amp; Governance
                </h4>
              </div>
              <ul className="space-y-2.5 text-xs font-normal">
                <li>
                  <Link
                    to="/guardrails"
                    className="text-left w-full block text-slate-500 hover:text-primary transition-colors"
                  >
                    Policy Rules &amp; Limits
                  </Link>
                </li>
                <li>
                  <Link
                    to="/guardrails"
                    className="text-left w-full block text-slate-500 hover:text-primary transition-colors"
                  >
                    Human Approval Queue
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('safety')}
                    className="text-left w-full text-slate-500 hover:text-primary transition-colors cursor-pointer"
                  >
                    Frequency Caps &amp; Quiet Hours
                  </button>
                </li>
                <li>
                  <Link
                    to="/audit"
                    className="text-left w-full block text-slate-500 hover:text-primary transition-colors"
                  >
                    Full Audit Trail
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/users"
                    className="text-left w-full block text-slate-500 hover:text-primary transition-colors"
                  >
                    Role-Based Access Control
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('safety')}
                    className="text-left w-full text-slate-500 hover:text-primary transition-colors cursor-pointer"
                  >
                    Duplicate &amp; Replay Protection
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Operations Workspace */}
            <div className="col-span-1 md:col-span-1 lg:col-span-1 space-y-4">
              <div className="h-7 flex items-center">
                <h4 className="text-sm font-bold text-navy font-display">
                  Operations Workspace
                </h4>
              </div>
              <ul className="space-y-2.5 text-xs font-normal">
                <li>
                  <Link
                    to="/overview"
                    className="text-left w-full block text-slate-500 hover:text-primary transition-colors"
                  >
                    Executive Overview
                  </Link>
                </li>
                <li>
                  <Link
                    to="/at-risk"
                    className="text-left w-full block text-slate-500 hover:text-primary transition-colors"
                  >
                    At-Risk Revenue Queue
                  </Link>
                </li>
                <li>
                  <Link
                    to="/agent"
                    className="text-left w-full block text-slate-500 hover:text-primary transition-colors"
                  >
                    Recovery Agent Console
                  </Link>
                </li>
                <li>
                  <Link
                    to="/demo-checkout"
                    className="text-left w-full block text-slate-500 hover:text-primary transition-colors"
                  >
                    Demo Store Checkout
                  </Link>
                </li>
                <li>
                  <Link
                    to="/analytics"
                    className="text-left w-full block text-slate-500 hover:text-primary transition-colors"
                  >
                    Recovery Analytics
                  </Link>
                </li>
                <li>
                  <Link
                    to="/simulation"
                    className="text-left w-full block text-slate-500 hover:text-primary transition-colors"
                  >
                    Simulation &amp; Forecasting
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Integrations */}
            <div className="col-span-1 md:col-span-1 lg:col-span-1 space-y-4">
              <div className="h-7 flex items-center">
                <h4 className="text-sm font-bold text-navy font-display">
                  Integrations
                </h4>
              </div>
              <ul className="space-y-2.5 text-xs font-normal">
                <li className="flex items-center gap-2 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span>Razorpay</span>
                </li>
                <li className="flex items-center gap-2 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span>UPI</span>
                </li>
                <li className="flex items-center gap-2 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                  <span>Cards &amp; NetBanking</span>
                </li>
                <li className="flex items-center gap-2 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span>Supabase</span>
                </li>
                <li className="flex items-center gap-2 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>Gemini AI</span>
                </li>
                <li className="flex items-center gap-2 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span>API-Ready Architecture</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Sub-Footer / Legal & Copyright Row */}
          <div className="pt-6 border-t border-border/70 flex flex-col lg:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            {/* Left side: Copyright */}
            <div className="text-center lg:text-left font-mono text-[11px] sm:text-xs">
              <span>&copy; {new Date().getFullYear()} RecoverAI Technologies</span>
            </div>

            {/* Center: Tagline */}
            <div className="text-center text-[11px] text-slate-400 font-sans">
              <span>Autonomous Revenue Recovery for Digital Commerce</span>
            </div>

            {/* Right side: Policy & Status Links */}
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-5 text-[11px]">
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className="hover:text-navy transition-colors underline-offset-4 hover:underline cursor-pointer"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className="hover:text-navy transition-colors underline-offset-4 hover:underline cursor-pointer"
              >
                Terms of Service
              </button>
              <button
                type="button"
                onClick={() => setLegalModal('security')}
                className="hover:text-navy transition-colors underline-offset-4 hover:underline cursor-pointer"
              >
                Security & Compliance
              </button>
              <a
                href="http://localhost:8000/health"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-navy transition-colors inline-flex items-center gap-1"
              >
                <span>System Status</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Legal & Compliance Dialog Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface border border-border/80 rounded-2xl shadow-fintech-modal max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border/70 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-navy font-display text-sm">
                  {legalModal === 'privacy' && 'Enterprise Privacy Policy'}
                  {legalModal === 'terms' && 'Merchant Terms of Service'}
                  {legalModal === 'security' && 'Security & Regulatory Governance'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                aria-label="Close dialog"
                className="p-1.5 rounded-xl text-slate-400 hover:text-navy hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600 leading-relaxed font-sans">
              {legalModal === 'privacy' && (
                <>
                  <p className="font-semibold text-navy">Last Updated: September 2026</p>
                  <p>
                    RecoverAI is engineered with strict privacy-by-design principles. We enforce deterministic data minimization, processing only the telemetry attributes strictly necessary to compute payment recovery propensity scores and route fallback payment rails.
                  </p>
                  <h4 className="font-bold text-navy font-display text-xs uppercase tracking-wider pt-2">1. Data Ingestion & Sanitization</h4>
                  <p>
                    Webhook payloads ingested from payment gateways (e.g. Razorpay) are sanitized at the gateway boundary. Plaintext primary account numbers (PAN) and CVVs are strictly prohibited from touching RecoverAI application memory or database storage.
                  </p>
                  <h4 className="font-bold text-navy font-display text-xs uppercase tracking-wider pt-2">2. Multi-Tenant Isolation</h4>
                  <p>
                    All customer records, transaction logs, and recovery cases are segmented using PostgreSQL Row-Level Security (RLS) policies. No merchant data is shared, blended, or utilized across cross-merchant models without explicit enterprise consensus.
                  </p>
                  <h4 className="font-bold text-navy font-display text-xs uppercase tracking-wider pt-2">3. Regulatory Compliance</h4>
                  <p>
                    Our data processing pipelines adhere to RBI digital payment processing guidelines, GDPR customer deletion mandates (Right to be Forgotten), and the Digital Personal Data Protection (DPDP) Act.
                  </p>
                </>
              )}

              {legalModal === 'terms' && (
                <>
                  <p className="font-semibold text-navy">Effective Date: September 2026</p>
                  <p>
                    By connecting merchant stores, gateway API keys, or webhooks to the RecoverAI platform, you agree to these standard operating terms and fintech governance conditions.
                  </p>
                  <h4 className="font-bold text-navy font-display text-xs uppercase tracking-wider pt-2">1. Autonomous Intervention Scope</h4>
                  <p>
                    RecoverAI operates as an authorized autonomous financial agent executing customer interventions (1-click paylinks, retry scheduling, SMS/WhatsApp recovery prompts). All interventions operate under the strict governance of the merchant's configured Fintech Guardrails.
                  </p>
                  <h4 className="font-bold text-navy font-display text-xs uppercase tracking-wider pt-2">2. Fail-Safe Guardrails</h4>
                  <p>
                    The platform enforces frequency capping (maximum 3 touchpoints per transaction), quiet hours (overnight suppression), and discount ceiling policies. High-value transactions exceeding policy thresholds automatically pause into the Human Approval Queue.
                  </p>
                  <h4 className="font-bold text-navy font-display text-xs uppercase tracking-wider pt-2">3. Service Availability SLA</h4>
                  <p>
                    RecoverAI targets a 99.9% uptime SLA for webhook ingestion and live event bus delivery. Diagnostic processing operates asynchronously with a target sub-200ms latency.
                  </p>
                </>
              )}

              {legalModal === 'security' && (
                <>
                  <p className="font-semibold text-navy">Fintech Security & Operational Resilience</p>
                  <p>
                    Security is central to our financial recovery architecture. We employ defense-in-depth methodologies across all network, application, and database tiers.
                  </p>
                  <h4 className="font-bold text-navy font-display text-xs uppercase tracking-wider pt-2">1. Cryptographic Verification</h4>
                  <p>
                    All incoming gateway notifications must pass cryptographic HMAC-SHA256 signature verification before ingestion into the event ledger. Forged or mismatched payloads are rejected immediately.
                  </p>
                  <h4 className="font-bold text-navy font-display text-xs uppercase tracking-wider pt-2">2. Idempotency & Replay Shield</h4>
                  <p>
                    Every recovery intervention generates a unique cryptographic hash (<code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded-md text-primary font-bold">hash(order_id + event + attempt)</code>). Replay attempts, duplicate webhooks, or race conditions are safely neutralized without duplicate billing or outreach.
                  </p>
                  <h4 className="font-bold text-navy font-display text-xs uppercase tracking-wider pt-2">3. Immutable Audit Trail</h4>
                  <p>
                    Every automated decision, propensity evaluation, ML model inference, and human operator approval is committed to an immutable append-only audit trail with UTC timestamps, user agent signatures, and forensic diff logs.
                  </p>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-border/70 bg-slate-50/50 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 font-medium">
                RecoverAI Governance Standard &bull; 2026
              </span>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-all shadow-fintech-purple cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LandingPage
