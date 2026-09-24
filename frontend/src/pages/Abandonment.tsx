import React, { useState, useEffect } from 'react'
import { SectionHeader } from '../components/common/SectionHeader'
import {
  api,
  AbandonmentFunnelResponse,
  AbandonmentCaseItem,
  CheckoutSessionItem
} from '../services/api'
import { useRealtime } from '../lib/useRealtime'
import { formatINR, formatTimeAgo } from '../lib/utils'
import {
  ShoppingCart,
  ArrowRight,
  TrendingDown,
  CheckCircle2,
  RefreshCw,
  Clock,
  Sparkles,
  MessageSquare,
  Shield,
  ChevronRight,
  AlertTriangle,
  X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export const Abandonment: React.FC = () => {
  const { status: _status } = useRealtime()

  // Funnel & Session Data
  const [funnel, setFunnel] = useState<AbandonmentFunnelResponse | null>(null)
  const [sessions, setSessions] = useState<CheckoutSessionItem[]>([])
  const [abandonmentCases, setAbandonmentCases] = useState<AbandonmentCaseItem[]>([])
  const [selectedCase, setSelectedCase] = useState<AbandonmentCaseItem | null>(null)
  const [loading, setLoading] = useState(true)

  const { user } = useAuth()

  // Interactive Checkout Simulator State
  const [simCustomerName, setSimCustomerName] = useState(user?.user_metadata?.full_name || 'Pooja Sharma')
  const [simCustomerEmail, setSimCustomerEmail] = useState(user?.email || 'pooja.s@example.com')
  const [simCustomerTier, setSimCustomerTier] = useState('VIP')
  const [simCartAmount, setSimCartAmount] = useState(3800)
  const [simSelectedMethod, setSimSelectedMethod] = useState('UPI')
  const [activeSimSession, setActiveSimSession] = useState<CheckoutSessionItem | null>(null)
  const [simStep, setSimStep] = useState<number>(0) // 0: Idle, 1: Started, 2: Identified, 3: Method Viewed, 4: Initiated, 5: Abandoned
  const [countdownSeconds, setCountdownSeconds] = useState<number>(15)
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false)
  const [scannerRunning, setScannerRunning] = useState(false)
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [funnelRes, sessionsRes, casesRes] = await Promise.all([
        api.getAbandonmentFunnel().catch(() => null),
        api.getCheckoutSessions('ALL', 20).catch(() => []),
        api.getAbandonmentCases(50).catch(() => [])
      ])

      if (funnelRes) setFunnel(funnelRes)
      setSessions(sessionsRes || [])
      setAbandonmentCases(casesRes || [])

      if (!selectedCase && casesRes?.length > 0) {
        setSelectedCase(casesRes[0])
      }
    } catch (err) {
      console.error('Failed to load abandonment data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 8000)
    return () => clearInterval(interval)
  }, [])

  // Timer countdown effect for active simulated checkout
  useEffect(() => {
    let timer: any = null
    if (isTimerRunning && countdownSeconds > 0) {
      timer = setInterval(() => {
        setCountdownSeconds((prev) => prev - 1)
      }, 1000)
    } else if (isTimerRunning && countdownSeconds === 0) {
      setIsTimerRunning(false)
      // Auto-trigger abandonment
      if (activeSimSession && activeSimSession.status !== 'ABANDONED' && activeSimSession.status !== 'COMPLETED') {
        handleSimulateAbandon()
      }
    }
    return () => clearInterval(timer)
  }, [isTimerRunning, countdownSeconds, activeSimSession])

  // Simulator Actions
  const handleSimStartCheckout = async () => {
    setErrorMessage(null)
    try {
      const sess = await api.createCheckoutSession({
        customer_name: simCustomerName,
        customer_email: simCustomerEmail,
        customer_tier: simCustomerTier,
        cart_amount: simCartAmount,
        selected_method: simSelectedMethod,
        is_demo_simulation: true
      })
      setActiveSimSession(sess)
      setSimStep(1)
      setCountdownSeconds(15)
      setIsTimerRunning(true)
      setFeedbackBanner(`Checkout session ${sess.id} started. 15s abandonment countdown active!`)
      await loadData()
    } catch (err: any) {
      setErrorMessage(`Failed to start simulated checkout: ${err?.message || 'Server connection error'}`)
    }
  }

  const handleSimIdentifyCustomer = async () => {
    if (!activeSimSession) return
    setErrorMessage(null)
    try {
      const updated = await api.transitionCheckoutSession(activeSimSession.id, {
        new_status: 'CUSTOMER_IDENTIFIED'
      })
      setActiveSimSession(updated)
      setSimStep(2)
      setCountdownSeconds(15)
      await loadData()
    } catch (err: any) {
      setErrorMessage(`Transition error: ${err?.message || 'Failed to update contact info'}`)
    }
  }

  const handleSimViewPaymentMethod = async () => {
    if (!activeSimSession) return
    setErrorMessage(null)
    try {
      const updated = await api.transitionCheckoutSession(activeSimSession.id, {
        new_status: 'PAYMENT_METHOD_VIEWED',
        selected_method: simSelectedMethod
      })
      setActiveSimSession(updated)
      setSimStep(3)
      setCountdownSeconds(15)
      await loadData()
    } catch (err: any) {
      setErrorMessage(`Transition error: ${err?.message || 'Failed to view payment method'}`)
    }
  }

  const handleSimInitiatePayment = async () => {
    if (!activeSimSession) return
    setErrorMessage(null)
    try {
      const updated = await api.transitionCheckoutSession(activeSimSession.id, {
        new_status: 'PAYMENT_INITIATED'
      })
      setActiveSimSession(updated)
      setSimStep(4)
      setCountdownSeconds(15)
      await loadData()
    } catch (err: any) {
      setErrorMessage(`Payment switch error: ${err?.message || 'Failed to initiate payment rail'}`)
    }
  }

  const handleSimulateAbandon = async () => {
    if (!activeSimSession) return
    setErrorMessage(null)
    try {
      setIsTimerRunning(false)
      const res = await api.abandonCheckoutSession(activeSimSession.id)
      setSimStep(5)
      const caseDisplay = res?.case_id || res?.recovery_case_id || activeSimSession.recovery_case_id || activeSimSession.id
      const ervDisplay = res?.expected_recovery_value ?? 0
      setFeedbackBanner(`Cart marked Abandoned! RecoverAI Case #${caseDisplay} synthesized with ERV: ${formatINR(ervDisplay)}`)
      await loadData()
    } catch (err: any) {
      setErrorMessage(`Abandonment trigger notice: ${err?.message || 'Could not complete abandonment trigger'}`)
    }
  }

  const handleRunScanner = async () => {
    setErrorMessage(null)
    try {
      setScannerRunning(true)
      const res = await api.checkTimedOutSessions(15)
      setFeedbackBanner(`Abandonment Scanner evaluated active sessions. Dispatched ${res?.abandoned_count ?? 0} new recovery actions.`)
      await loadData()
    } catch (err: any) {
      setErrorMessage(`Scanner error: ${err?.message || 'Failed to scan timed out sessions'}`)
    } finally {
      setScannerRunning(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <SectionHeader
        title="Pre-Payment Cart Abandonment & Conversion Recovery"
        subtitle="Detect buyer drop-off pre-payment, execute 15-second inactivity timeout triggers, and dispatch 1-click recovery paylinks"
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRunScanner}
              disabled={scannerRunning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-fintech-purple transition-all cursor-pointer disabled:opacity-50"
            >
              <Clock className={`w-3.5 h-3.5 ${scannerRunning ? 'animate-spin' : ''}`} />
              <span>Detect Abandonment (15s Window)</span>
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface hover:bg-slate-50 border border-border text-navy rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Funnel</span>
            </button>
          </div>
        }
      />

      {/* Banner message */}
      {feedbackBanner && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl p-4 flex items-center justify-between text-xs animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{feedbackBanner}</span>
          </div>
          <button onClick={() => setFeedbackBanner(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-2xl p-4 flex items-center justify-between text-xs animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-900 text-xs font-bold cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5-STAGE ABANDONMENT FUNNEL */}
      <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div>
            <h3 className="text-base font-bold text-navy font-display flex items-center gap-2.5">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <span>Pre-Payment Abandonment & Conversion Funnel</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks the entire buyer progression from initial cart inception to AI-driven recovery intervention.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-rose-50 px-3 py-1 rounded-xl border border-rose-200">
              <span className="text-rose-700 font-sans font-medium text-[11px]">At-Risk Cart: </span>
              <span className="font-bold text-rose-800">{formatINR(funnel?.at_risk_abandoned_inr ?? 0)}</span>
            </div>
            <div className="bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
              <span className="text-emerald-700 font-sans font-medium text-[11px]">Recovered: </span>
              <span className="font-bold text-emerald-800">{formatINR(funnel?.recovered_abandoned_inr ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Visual 5-Stage Stepper Funnel */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {funnel?.stages?.map((st, idx) => {
            const colors = [
              'border-border/80 bg-slate-50/70',
              'border-surface-blue-border bg-surface-blue/40',
              'border-primary-border/60 bg-primary-light/40',
              'border-amber-200 bg-amber-50/60',
              'border-emerald-200 bg-emerald-50/70'
            ]
            const textColors = [
              'text-navy',
              'text-navy',
              'text-primary font-bold',
              'text-amber-900 font-bold',
              'text-emerald-800 font-bold'
            ]

            return (
              <div
                key={st.stage_key}
                className={`p-4 rounded-2xl border ${colors[idx % colors.length]} relative flex flex-col justify-between shadow-2xs`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span className="text-primary font-mono font-bold">Stage 0{idx + 1}</span>
                    <span className="font-mono font-bold text-navy">{st.conversion_rate * 100}% conv</span>
                  </div>
                  <div className={`text-sm font-bold font-display mt-1.5 ${textColors[idx % textColors.length]}`}>
                    {st.stage_name}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-navy">{st.count}</span>
                  {st.drop_off_count > 0 && idx < 4 && (
                    <span className="text-[10px] text-rose-600 font-mono font-bold flex items-center gap-0.5">
                      <TrendingDown className="w-3 h-3" />
                      -{st.drop_off_count} drop
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* INTERACTIVE CHECKOUT SIMULATOR & TIMEOUT CONTROLLER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-border/80 p-4 sm:p-6 shadow-fintech-card space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-navy font-display">
                  Interactive Checkout Session Simulator
                </h3>
                <span className="px-2.5 py-0.5 bg-surface-blue text-primary border border-surface-blue-border text-[10px] font-mono font-bold rounded-full whitespace-nowrap">
                  SIMULATED DEMO EVENT ({sessions.length} ACTIVE)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Step through a simulated customer cart journey. Observe the 15-second inactivity timeout trigger pre-payment recovery.
              </p>
            </div>

            {/* Countdown Badge */}
            {isTimerRunning && (
              <div className="flex items-center gap-2 bg-primary-light border border-primary-border px-3.5 py-1.5 rounded-full shadow-xs shrink-0 self-start sm:self-auto">
                <Clock className="w-4 h-4 text-primary animate-spin" />
                <span className="text-xs font-mono font-bold text-primary whitespace-nowrap">
                  Timeout in {countdownSeconds}s
                </span>
              </div>
            )}
          </div>

          {/* Session Progress Stepper */}
          <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <div className="flex items-center gap-2 min-w-max md:min-w-0 md:justify-between px-3.5 py-3 bg-slate-50 rounded-2xl border border-border text-xs">
              <div className={`flex items-center gap-1.5 shrink-0 ${simStep >= 1 ? 'text-primary font-bold' : 'text-slate-400 font-medium'}`}>
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono ${simStep >= 1 ? 'bg-primary text-white border-primary' : 'border-slate-300'}`}>1</span>
                <span className="whitespace-nowrap">Started</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <div className={`flex items-center gap-1.5 shrink-0 ${simStep >= 2 ? 'text-primary font-bold' : 'text-slate-400 font-medium'}`}>
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono ${simStep >= 2 ? 'bg-primary text-white border-primary' : 'border-slate-300'}`}>2</span>
                <span className="whitespace-nowrap">Identified</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <div className={`flex items-center gap-1.5 shrink-0 ${simStep >= 3 ? 'text-primary font-bold' : 'text-slate-400 font-medium'}`}>
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono ${simStep >= 3 ? 'bg-primary text-white border-primary' : 'border-slate-300'}`}>3</span>
                <span className="whitespace-nowrap">Method Viewed</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <div className={`flex items-center gap-1.5 shrink-0 ${simStep >= 4 ? 'text-primary font-bold' : 'text-slate-400 font-medium'}`}>
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono ${simStep >= 4 ? 'bg-primary text-white border-primary' : 'border-slate-300'}`}>4</span>
                <span className="whitespace-nowrap">Payment Initiated</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <div className={`flex items-center gap-1.5 shrink-0 ${simStep === 5 ? 'text-rose-600 font-bold' : 'text-slate-400 font-medium'}`}>
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono ${simStep === 5 ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-300'}`}>5</span>
                <span className="whitespace-nowrap">Abandoned</span>
              </div>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-500 font-semibold">Customer Name</label>
              <input
                type="text"
                value={simCustomerName}
                onChange={(e) => setSimCustomerName(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs border border-border rounded-xl bg-surface font-mono text-navy font-medium focus:border-primary focus:outline-none shadow-2xs truncate"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-semibold">Customer Email</label>
              <input
                type="email"
                value={simCustomerEmail}
                onChange={(e) => setSimCustomerEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs border border-border rounded-xl bg-surface font-mono text-navy font-medium focus:border-primary focus:outline-none shadow-2xs truncate"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-semibold">Customer Tier</label>
              <select
                value={simCustomerTier}
                onChange={(e) => setSimCustomerTier(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs border border-border rounded-xl bg-surface font-mono text-navy font-medium focus:border-primary focus:outline-none shadow-2xs"
              >
                <option value="STANDARD">STANDARD</option>
                <option value="GROWTH">GROWTH</option>
                <option value="VIP">VIP</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-semibold">Cart Amount (INR)</label>
              <input
                type="number"
                value={simCartAmount}
                onChange={(e) => setSimCartAmount(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 text-xs border border-border rounded-xl bg-surface font-mono text-navy font-medium focus:border-primary focus:outline-none shadow-2xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-semibold">Preferred Method</label>
              <select
                value={simSelectedMethod}
                onChange={(e) => setSimSelectedMethod(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-xs border border-border rounded-xl bg-surface font-mono text-navy font-medium focus:border-primary focus:outline-none shadow-2xs"
              >
                <option value="UPI">UPI (QR / Intent)</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="NETBANKING">NetBanking</option>
              </select>
            </div>
          </div>

          {/* Action Step Buttons */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 pt-3 border-t border-border/70">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 flex-1">
              <button
                onClick={handleSimStartCheckout}
                disabled={simStep !== 0 && simStep !== 5}
                className="px-3.5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-fintech-purple transition-all disabled:opacity-40 cursor-pointer text-center"
              >
                1. Start Checkout
              </button>

              <button
                onClick={handleSimIdentifyCustomer}
                disabled={simStep !== 1}
                className="px-3.5 py-2.5 bg-surface hover:bg-slate-50 border border-border text-navy rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 shadow-xs cursor-pointer text-center"
              >
                2. Enter Contact Info
              </button>

              <button
                onClick={handleSimViewPaymentMethod}
                disabled={simStep !== 2}
                className="px-3.5 py-2.5 bg-surface hover:bg-slate-50 border border-border text-navy rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 shadow-xs cursor-pointer text-center"
              >
                3. View Instrument
              </button>

              <button
                onClick={handleSimInitiatePayment}
                disabled={simStep !== 3}
                className="px-3.5 py-2.5 bg-surface hover:bg-slate-50 border border-border text-navy rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 shadow-xs cursor-pointer text-center"
              >
                4. Initiate Payment
              </button>
            </div>

            <button
              onClick={handleSimulateAbandon}
              disabled={simStep === 0 || simStep === 5}
              className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-40 cursor-pointer text-center"
            >
              Trigger Abandonment Now
            </button>
          </div>
        </div>

        {/* Attribution & Protocol Information */}
        <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-border/70 pb-3">
            <Shield className="w-4 h-4 text-primary" />
            <h4 className="font-bold text-navy font-display">Transaction Source & Mode</h4>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 bg-surface-blue/50 border border-surface-blue-border rounded-xl">
              <div className="flex items-center gap-1.5 text-navy font-bold text-[11px] uppercase">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span>Simulated Demo Checkout Event</span>
              </div>
              <p className="text-slate-600 mt-1 leading-relaxed text-[11px]">
                Pre-payment browser checkouts and cart drop-off sessions. Simulated safely for testing without live charges.
              </p>
            </div>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-[11px] uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>Real Razorpay Test Transaction</span>
              </div>
              <p className="text-emerald-800 mt-1 leading-relaxed text-[11px]">
                Official Razorpay Test Mode transactions, test orders, and verified payment updates.
              </p>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 border-t border-border/70 flex items-center justify-between">
            <span>Demo Inactivity Window:</span>
            <span className="font-bold font-mono text-primary">15 Seconds</span>
          </div>
        </div>
      </div>

      {/* DETAILED ABANDONMENT CASES TABLE & DETAIL DRAWER */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-fintech-card overflow-hidden">
        <div className="p-5 border-b border-border bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-navy font-display">Pre-Payment Abandoned Cases</h3>
              <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-mono font-bold rounded-full">
                {abandonmentCases.length} DETECTED
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Sessions that dropped off during checkout and triggered automated ERV valuation and recovery strategy dispatch.
            </p>
          </div>
        </div>

        {abandonmentCases.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-navy text-sm">No Abandonment Cases Detected</p>
            <p className="text-slate-500 mt-1">
              Use the Interactive Checkout Session Simulator above to trigger an abandoned cart event.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-border text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 font-semibold">Case / Session</th>
                  <th className="p-3.5 font-semibold">Customer</th>
                  <th className="p-3.5 font-semibold">Cart Amount</th>
                  <th className="p-3.5 font-semibold">AI Strategy Selected</th>
                  <th className="p-3.5 font-semibold">ERV (INR)</th>
                  <th className="p-3.5 font-semibold">Channel</th>
                  <th className="p-3.5 font-semibold">Event Type</th>
                  <th className="p-3.5 font-semibold">Detected</th>
                  <th className="p-3.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {abandonmentCases.map((c) => (
                  <tr
                    key={c.case_id}
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                      selectedCase?.case_id === c.case_id ? 'bg-primary-subtle/50' : ''
                    }`}
                  >
                    <td className="p-3.5 font-mono font-bold text-navy">
                      <span className="group-hover:text-primary transition-colors">{c.case_id}</span>
                      <div className="text-[10px] text-slate-400 font-mono font-normal">
                        {c.session_id || c.order_id}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-navy">{c.customer_name}</div>
                      <div className="text-[11px] text-slate-500">Tier: {c.customer_tier}</div>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-navy">
                      {formatINR(c.cart_amount)}
                    </td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-primary-subtle text-primary border border-primary/40 shadow-2xs">
                        <Sparkles className="w-3 h-3 text-primary" />
                        {c.selected_strategy.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-600">
                      {formatINR(c.expected_recovery_value)}
                      <div className="text-[10px] text-slate-400 font-mono font-normal">
                        {(c.recovery_probability * 100).toFixed(0)}% likelihood
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-600">
                      {c.channel}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 bg-surface-blue text-primary border border-surface-blue-border text-[10px] font-mono rounded-full font-bold">
                        DEMO CHECKOUT
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                      {formatTimeAgo(c.created_at)}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setSelectedCase(c)}
                        className="px-3 py-1.5 bg-surface hover:bg-slate-100 border border-border rounded-xl text-xs font-semibold text-navy inline-flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5 text-primary" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SELECTED CASE FORENSIC DRAWER */}
      {selectedCase && (
        <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-primary" />
              <h4 className="text-base font-bold text-navy font-display">
                Abandonment Case Diagnostics: {selectedCase.case_id}
              </h4>
            </div>
            <span className="text-xs font-mono text-slate-400 font-medium">
              Session Ref: {selectedCase.session_id}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-border">
              <span className="text-[11px] text-slate-500 font-semibold">Customer Profile</span>
              <div className="font-bold text-navy mt-1 text-sm">{selectedCase.customer_name}</div>
              <div className="text-[11px] text-slate-500">{selectedCase.customer_email}</div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-border">
              <span className="text-[11px] text-slate-500 font-semibold">Cart Revenue at Risk</span>
              <div className="font-bold font-mono text-lg text-rose-600 mt-1">
                {formatINR(selectedCase.cart_amount)}
              </div>
              <div className="text-[10px] text-slate-400">Pre-payment abandonment</div>
            </div>

            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200">
              <span className="text-[11px] text-emerald-800 font-semibold">Expected Recovery Value</span>
              <div className="font-bold font-mono text-lg text-emerald-600 mt-1">
                {formatINR(selectedCase.expected_recovery_value)}
              </div>
              <div className="text-[10px] text-emerald-700/80 font-mono">
                P = {(selectedCase.recovery_probability * 100).toFixed(0)}% statistical likelihood
              </div>
            </div>

            <div className="p-4 bg-surface-blue rounded-2xl border border-surface-blue-border">
              <span className="text-[11px] text-slate-600 font-semibold">Intervention Channel</span>
              <div className="font-bold text-navy mt-1 text-sm">{selectedCase.channel}</div>
              <div className="text-[10px] text-primary font-mono font-bold">DEMO DELIVERY TAGGED</div>
            </div>
          </div>

          <div className="p-4 bg-surface-blue/40 rounded-2xl border border-surface-blue-border space-y-1.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-navy">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span>Multi-Lingual Cart Recovery Message Dispatch</span>
            </div>
            <p className="text-slate-700 leading-relaxed pt-1 font-sans text-xs">
              &ldquo;Hi {selectedCase.customer_name}! Your cart items worth {formatINR(selectedCase.cart_amount)} are safely reserved. Complete your order in 1 click using your preferred payment method: http://localhost:3000/demo-checkout?recover=true&rdquo;
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
