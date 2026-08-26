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
  ChevronRight
} from 'lucide-react'

export const Abandonment: React.FC = () => {
  const { status: _status } = useRealtime()

  // Funnel & Session Data
  const [funnel, setFunnel] = useState<AbandonmentFunnelResponse | null>(null)
  const [sessions, setSessions] = useState<CheckoutSessionItem[]>([])
  const [abandonmentCases, setAbandonmentCases] = useState<AbandonmentCaseItem[]>([])
  const [selectedCase, setSelectedCase] = useState<AbandonmentCaseItem | null>(null)
  const [loading, setLoading] = useState(true)

  // Interactive Checkout Simulator State
  const [simCustomerName, setSimCustomerName] = useState('Pooja Sharma')
  const [simCustomerEmail, setSimCustomerEmail] = useState('pooja.s@example.com')
  const [simCustomerTier, setSimCustomerTier] = useState('VIP')
  const [simCartAmount, setSimCartAmount] = useState(3800)
  const [simSelectedMethod, setSimSelectedMethod] = useState('UPI')
  const [activeSimSession, setActiveSimSession] = useState<CheckoutSessionItem | null>(null)
  const [simStep, setSimStep] = useState<number>(0) // 0: Idle, 1: Started, 2: Identified, 3: Method Viewed, 4: Initiated, 5: Abandoned
  const [countdownSeconds, setCountdownSeconds] = useState<number>(15)
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false)
  const [scannerRunning, setScannerRunning] = useState(false)
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null)

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
      alert(`Failed to start simulated checkout: ${err.message}`)
    }
  }

  const handleSimIdentifyCustomer = async () => {
    if (!activeSimSession) return
    try {
      const updated = await api.transitionCheckoutSession(activeSimSession.id, {
        new_status: 'CUSTOMER_IDENTIFIED'
      })
      setActiveSimSession(updated)
      setSimStep(2)
      setCountdownSeconds(15)
      await loadData()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleSimViewPaymentMethod = async () => {
    if (!activeSimSession) return
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
      alert(`Error: ${err.message}`)
    }
  }

  const handleSimInitiatePayment = async () => {
    if (!activeSimSession) return
    try {
      const updated = await api.transitionCheckoutSession(activeSimSession.id, {
        new_status: 'PAYMENT_INITIATED',
        payment_attempted: true
      })
      setActiveSimSession(updated)
      setSimStep(4)
      setCountdownSeconds(15)
      await loadData()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleSimulateAbandon = async () => {
    if (!activeSimSession) return
    try {
      setIsTimerRunning(false)
      await api.abandonCheckoutSession(activeSimSession.id)
      setSimStep(5)
      setFeedbackBanner(`Session ${activeSimSession.id} abandoned! RecoverAI immediately computed ERV and scheduled recovery.`)
      await loadData()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const handleRunTimeoutScanner = async () => {
    try {
      setScannerRunning(true)
      const res = await api.checkTimedOutSessions(15)
      setFeedbackBanner(`Scanned active sessions: ${res.abandoned_count} timed-out session(s) transitioned to ABANDONED.`)
      setTimeout(() => setFeedbackBanner(null), 5000)
      await loadData()
    } catch (err: any) {
      alert(`Scanner error: ${err.message}`)
    } finally {
      setScannerRunning(false)
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <SectionHeader
        title="Pre-Payment Cart & Checkout Abandonment Engine"
        subtitle="Detect pre-payment intent drop-offs, estimate recovery propensity & ERV, and trigger multi-channel dunning before total revenue loss"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={handleRunTimeoutScanner}
              disabled={scannerRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-sm text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <Clock className={`w-3.5 h-3.5 ${scannerRunning ? 'animate-spin' : ''}`} />
              <span>Scan Timeout (15s Window)</span>
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-warm-gray-50 border border-border text-graphite rounded-sm text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Funnel</span>
            </button>
          </div>
        }
      />

      {/* Banner message */}
      {feedbackBanner && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-md p-3.5 flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button onClick={() => setFeedbackBanner(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* 5-STAGE ABANDONMENT FUNNEL */}
      <div className="bg-surface rounded-md border border-border p-6 shadow-fintech-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-graphite font-display flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-burnt-orange" />
              <span>Pre-Payment Abandonment & Conversion Funnel</span>
            </h3>
            <p className="text-xs text-warm-gray-600 mt-0.5">
              Tracks the entire buyer progression from initial cart inception to AI-driven recovery intervention.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-warm-gray-500">At-Risk Cart: </span>
              <span className="font-bold text-brick-red">{formatINR(funnel?.at_risk_abandoned_inr ?? 0)}</span>
            </div>
            <div>
              <span className="text-warm-gray-500">Recovered: </span>
              <span className="font-bold text-emerald-700">{formatINR(funnel?.recovered_abandoned_inr ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Visual 5-Stage Stepper Funnel */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {funnel?.stages?.map((st, idx) => {
            const colors = [
              'border-warm-gray-300 bg-warm-gray-50/60',
              'border-warm-gray-400 bg-white',
              'border-brick-red/30 bg-brick-red-subtle/50',
              'border-burnt-orange/30 bg-burnt-orange-subtle/60',
              'border-emerald-300 bg-emerald-50/70'
            ]
            const textColors = [
              'text-graphite',
              'text-graphite',
              'text-brick-red-dark',
              'text-burnt-orange',
              'text-emerald-700'
            ]

            return (
              <div
                key={st.stage_key}
                className={`p-4 rounded-md border ${colors[idx % colors.length]} relative flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-warm-gray-500">
                    <span>Stage 0{idx + 1}</span>
                    <span className="font-mono font-bold">{st.conversion_rate * 100}% conv</span>
                  </div>
                  <div className={`text-sm font-bold font-display mt-1 ${textColors[idx % textColors.length]}`}>
                    {st.stage_name}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-graphite">{st.count}</span>
                  {st.drop_off_count > 0 && idx < 4 && (
                    <span className="text-[10px] text-brick-red font-mono flex items-center gap-0.5">
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
        <div className="lg:col-span-2 bg-surface rounded-md border border-border p-6 shadow-fintech-card space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-graphite font-display">
                  Interactive Checkout Session Simulator
                </h3>
                <span className="px-2 py-0.5 bg-warm-gray-100 text-warm-gray-700 text-[10px] font-mono rounded-xs border border-border">
                  SIMULATED DEMO EVENT ({sessions.length} ACTIVE SESSIONS)
                </span>
              </div>
              <p className="text-xs text-warm-gray-600 mt-0.5">
                Step through a simulated customer cart journey. Observe the 15-second inactivity timeout trigger pre-payment recovery.
              </p>
            </div>

            {/* Countdown Badge */}
            {isTimerRunning && (
              <div className="flex items-center gap-2 bg-burnt-orange-subtle border border-burnt-orange/30 px-3 py-1.5 rounded-sm">
                <Clock className="w-4 h-4 text-burnt-orange animate-spin" />
                <span className="text-xs font-mono font-bold text-burnt-orange">
                  Timeout in {countdownSeconds}s
                </span>
              </div>
            )}
          </div>

          {/* Session Progress Stepper */}
          <div className="flex items-center justify-between px-2 py-3 bg-warm-gray-50 rounded-sm border border-border text-xs">
            <div className={`flex items-center gap-1.5 ${simStep >= 1 ? 'text-forest-green font-bold' : 'text-warm-gray-400'}`}>
              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono">1</span>
              <span>Started</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-warm-gray-300" />
            <div className={`flex items-center gap-1.5 ${simStep >= 2 ? 'text-forest-green font-bold' : 'text-warm-gray-400'}`}>
              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono">2</span>
              <span>Identified</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-warm-gray-300" />
            <div className={`flex items-center gap-1.5 ${simStep >= 3 ? 'text-forest-green font-bold' : 'text-warm-gray-400'}`}>
              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono">3</span>
              <span>Method Viewed</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-warm-gray-300" />
            <div className={`flex items-center gap-1.5 ${simStep >= 4 ? 'text-forest-green font-bold' : 'text-warm-gray-400'}`}>
              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono">4</span>
              <span>Payment Initiated</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-warm-gray-300" />
            <div className={`flex items-center gap-1.5 ${simStep === 5 ? 'text-brick-red font-bold' : 'text-warm-gray-400'}`}>
              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono">5</span>
              <span>Abandoned</span>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-warm-gray-500 font-medium">Customer Name</label>
              <input
                type="text"
                value={simCustomerName}
                onChange={(e) => setSimCustomerName(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-border rounded-sm bg-white font-mono text-graphite"
              />
            </div>
            <div>
              <label className="text-[11px] text-warm-gray-500 font-medium">Customer Email</label>
              <input
                type="email"
                value={simCustomerEmail}
                onChange={(e) => setSimCustomerEmail(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-border rounded-sm bg-white font-mono text-graphite"
              />
            </div>
            <div>
              <label className="text-[11px] text-warm-gray-500 font-medium">Customer Tier</label>
              <select
                value={simCustomerTier}
                onChange={(e) => setSimCustomerTier(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-border rounded-sm bg-white font-mono text-graphite"
              >
                <option value="STANDARD">STANDARD</option>
                <option value="GROWTH">GROWTH</option>
                <option value="VIP">VIP</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-warm-gray-500 font-medium">Cart Amount (INR)</label>
              <input
                type="number"
                value={simCartAmount}
                onChange={(e) => setSimCartAmount(Number(e.target.value))}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-border rounded-sm bg-white font-mono text-graphite"
              />
            </div>
            <div>
              <label className="text-[11px] text-warm-gray-500 font-medium">Preferred Method</label>
              <select
                value={simSelectedMethod}
                onChange={(e) => setSimSelectedMethod(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-border rounded-sm bg-white font-mono text-graphite"
              >
                <option value="UPI">UPI (QR / Intent)</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="NETBANKING">NetBanking</option>
              </select>
            </div>
          </div>

          {/* Action Step Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            <button
              onClick={handleSimStartCheckout}
              disabled={simStep !== 0 && simStep !== 5}
              className="px-3 py-1.5 bg-graphite hover:bg-graphite/90 text-white rounded-sm text-xs font-semibold shadow-sm transition-colors disabled:opacity-40"
            >
              1. Start Checkout
            </button>

            <button
              onClick={handleSimIdentifyCustomer}
              disabled={simStep !== 1}
              className="px-3 py-1.5 bg-surface hover:bg-warm-gray-50 border border-border text-graphite rounded-sm text-xs font-medium transition-colors disabled:opacity-40"
            >
              2. Enter Contact Info
            </button>

            <button
              onClick={handleSimViewPaymentMethod}
              disabled={simStep !== 2}
              className="px-3 py-1.5 bg-surface hover:bg-warm-gray-50 border border-border text-graphite rounded-sm text-xs font-medium transition-colors disabled:opacity-40"
            >
              3. View Payment Instrument
            </button>

            <button
              onClick={handleSimInitiatePayment}
              disabled={simStep !== 3}
              className="px-3 py-1.5 bg-surface hover:bg-warm-gray-50 border border-border text-graphite rounded-sm text-xs font-medium transition-colors disabled:opacity-40"
            >
              4. Initiate Payment Switch
            </button>

            <button
              onClick={handleSimulateAbandon}
              disabled={simStep === 0 || simStep === 5}
              className="px-3 py-1.5 bg-brick-red hover:bg-brick-red-dark text-white rounded-sm text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 ml-auto"
            >
              Trigger Abandonment Now
            </button>
          </div>
        </div>

        {/* Attribution & Protocol Information */}
        <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Shield className="w-4 h-4 text-burnt-orange" />
            <h4 className="font-bold text-graphite font-display">Event Attribution Guard</h4>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-sm">
              <div className="flex items-center gap-1.5 text-blue-900 font-bold text-[11px] uppercase">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <span>Simulated Demo Checkout Event</span>
              </div>
              <p className="text-blue-800 mt-1 leading-relaxed text-[11px]">
                Pre-payment browser sessions, synthetic customer drop-offs, and cart abandonment telemetry. Processed safely without touching Razorpay live balances.
              </p>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-sm">
              <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-[11px] uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>Real Razorpay Test Transaction</span>
              </div>
              <p className="text-emerald-800 mt-1 leading-relaxed text-[11px]">
                Genuine Razorpay Test Mode orders (`order_...`), genuine signatures (`X-Razorpay-Signature`), and official webhook callbacks.
              </p>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-warm-gray-500 border-t border-border flex items-center justify-between">
            <span>Configured Demo Inactivity Window:</span>
            <span className="font-bold font-mono text-graphite">15 Seconds</span>
          </div>
        </div>
      </div>

      {/* DETAILED ABANDONMENT CASES TABLE & DETAIL DRAWER */}
      <div className="bg-surface rounded-md border border-border shadow-fintech-card overflow-hidden">
        <div className="p-4 border-b border-border bg-warm-gray-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-graphite font-display">Pre-Payment Abandoned Cases</h3>
              <span className="px-2 py-0.5 bg-brick-red/10 text-brick-red border border-brick-red/30 text-[10px] font-mono font-bold rounded-xs">
                {abandonmentCases.length} DETECTED
              </span>
            </div>
            <p className="text-xs text-warm-gray-600 mt-0.5">
              Sessions that dropped off during checkout and triggered automated ERV valuation and recovery strategy dispatch.
            </p>
          </div>
        </div>

        {abandonmentCases.length === 0 ? (
          <div className="p-8 text-center text-xs text-warm-gray-500">
            <ShoppingCart className="w-8 h-8 text-warm-gray-400 mx-auto mb-2 opacity-60" />
            <p className="font-medium text-graphite">No Abandonment Cases Detected</p>
            <p className="text-warm-gray-500 mt-1">
              Use the Interactive Checkout Session Simulator above to trigger an abandoned cart event.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-warm-gray-50/60 text-warm-gray-600 border-b border-border">
                <tr>
                  <th className="p-3 font-semibold">Case / Session</th>
                  <th className="p-3 font-semibold">Customer</th>
                  <th className="p-3 font-semibold">Cart Amount</th>
                  <th className="p-3 font-semibold">AI Strategy Selected</th>
                  <th className="p-3 font-semibold">ERV (INR)</th>
                  <th className="p-3 font-semibold">Channel</th>
                  <th className="p-3 font-semibold">Event Type</th>
                  <th className="p-3 font-semibold">Detected</th>
                  <th className="p-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {abandonmentCases.map((c) => (
                  <tr
                    key={c.case_id}
                    className={`hover:bg-warm-gray-50/50 transition-colors ${
                      selectedCase?.case_id === c.case_id ? 'bg-warm-gray-50' : ''
                    }`}
                  >
                    <td className="p-3 font-mono font-bold text-graphite">
                      {c.case_id}
                      <div className="text-[10px] text-warm-gray-400 font-mono">
                        {c.session_id || c.order_id}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-graphite">{c.customer_name}</div>
                      <div className="text-[11px] text-warm-gray-500">Tier: {c.customer_tier}</div>
                    </td>
                    <td className="p-3 font-mono font-bold text-graphite">
                      {formatINR(c.cart_amount)}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-burnt-orange/10 text-burnt-orange border border-burnt-orange/30 text-[10px] font-mono font-bold rounded-xs">
                        {c.selected_strategy}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-forest-green">
                      {formatINR(c.expected_recovery_value)}
                      <div className="text-[10px] text-warm-gray-400 font-mono">
                        {(c.recovery_probability * 100).toFixed(0)}% propensity
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-warm-gray-700">
                      {c.channel}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-mono rounded-xs">
                        DEMO CHECKOUT
                      </span>
                    </td>
                    <td className="p-3 text-warm-gray-500 font-mono text-[11px]">
                      {formatTimeAgo(c.created_at)}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedCase(c)}
                        className="px-2.5 py-1 bg-surface hover:bg-warm-gray-100 border border-border rounded-sm text-xs font-medium text-graphite inline-flex items-center gap-1"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3 h-3" />
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
        <div className="bg-surface rounded-md border border-border p-6 shadow-fintech-card space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-burnt-orange" />
              <h4 className="text-sm font-bold text-graphite font-display">
                Abandonment Case Diagnostics: {selectedCase.case_id}
              </h4>
            </div>
            <span className="text-xs font-mono text-warm-gray-500">
              Session Ref: {selectedCase.session_id}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-warm-gray-50 rounded-sm border border-border">
              <span className="text-[11px] text-warm-gray-500">Customer Profile</span>
              <div className="font-bold text-graphite mt-1">{selectedCase.customer_name}</div>
              <div className="text-[11px] text-warm-gray-600">{selectedCase.customer_email}</div>
            </div>

            <div className="p-3 bg-warm-gray-50 rounded-sm border border-border">
              <span className="text-[11px] text-warm-gray-500">Cart Revenue at Risk</span>
              <div className="font-bold font-mono text-base text-brick-red-dark mt-1">
                {formatINR(selectedCase.cart_amount)}
              </div>
              <div className="text-[10px] text-warm-gray-500">Pre-payment abandonment</div>
            </div>

            <div className="p-3 bg-warm-gray-50 rounded-sm border border-border">
              <span className="text-[11px] text-warm-gray-500">Expected Recovery Value</span>
              <div className="font-bold font-mono text-base text-forest-green mt-1">
                {formatINR(selectedCase.expected_recovery_value)}
              </div>
              <div className="text-[10px] text-warm-gray-500">
                P = {(selectedCase.recovery_probability * 100).toFixed(0)}% statistical likelihood
              </div>
            </div>

            <div className="p-3 bg-warm-gray-50 rounded-sm border border-border">
              <span className="text-[11px] text-warm-gray-500">Intervention Channel</span>
              <div className="font-bold text-graphite mt-1">{selectedCase.channel}</div>
              <div className="text-[10px] text-emerald-700 font-mono">DEMO DELIVERY TAGGED</div>
            </div>
          </div>

          <div className="p-3.5 bg-warm-gray-50 rounded-sm border border-border space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-graphite">
              <MessageSquare className="w-3.5 h-3.5 text-burnt-orange" />
              <span>Multi-Lingual Cart Recovery Message Dispatch</span>
            </div>
            <p className="text-warm-gray-700 leading-relaxed pt-1">
              "Hi {selectedCase.customer_name}! Your cart items worth {formatINR(selectedCase.cart_amount)} are safely reserved. Complete your order in 1 click using your preferred payment method: http://localhost:3000/demo-checkout?recover=true"
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
