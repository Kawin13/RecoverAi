import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShoppingBag,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Lock,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Cpu,
  UserCheck
} from 'lucide-react'
import { SectionHeader } from '../components/common/SectionHeader'
import {
  api,
  PaymentConfig,
  CreateOrderResponse,
  VerifyPaymentResponse
} from '../services/api'

// Declare global Razorpay on window
declare global {
  interface Window {
    Razorpay: any
  }
}

interface ProductItem {
  id: string
  name: string
  category: string
  price: number
  badge: string
  period?: string
  description: string
  features: string[]
}

const PRODUCTS: ProductItem[] = [
  {
    id: 'saas_premium',
    name: 'Premium SaaS Subscription',
    category: 'Subscription Software',
    price: 4999.0,
    period: '/ month',
    badge: 'Most Popular',
    description: 'Autonomous AI revenue recovery platform for mid-market payment operations.',
    features: [
      'Real-Time Recovery Likelihood Engine',
      'Multi-Rail Smart Payment Fallbacks',
      'AI-Personalized Multi-Lingual Paylinks',
      'Continuous Audit & Safety Guardrails'
    ]
  },
  {
    id: 'ecommerce_order',
    name: 'Ergonomic Mechanical Keyboard',
    category: 'Hardware & Devices',
    price: 1499.0,
    badge: 'Express Delivery',
    description: 'Custom mechanical keyboard with optical switches and noise-dampening foam.',
    features: [
      'Ultra-low 1ms latency response',
      'Cart drop-off intent protection',
      'Instant 1-click UPI recovery link',
      'Free nationwide priority courier'
    ]
  },
  {
    id: 'membership_annual',
    name: 'Annual Enterprise Membership',
    category: 'Corporate VIP Suite',
    price: 12499.0,
    period: '/ year',
    badge: 'Enterprise Tier',
    description: 'Full-spectrum enterprise payments infrastructure with dedicated model fine-tuning.',
    features: [
      'Bespoke Risk & Cost Curve tuning',
      'Dedicated 99.99% Recovery SLA',
      'Unlimited payment gateway webhooks',
      'SOC2 / ISO27001 verifiable audit log'
    ]
  }
]

export const DemoCheckout: React.FC = () => {
  const navigate = useNavigate()
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductItem>(PRODUCTS[0])
  const [customerName, setCustomerName] = useState('Aditya Sharma')
  const [customerEmail, setCustomerEmail] = useState('aditya.sharma@techcorp.in')
  const [customerPhone, setCustomerPhone] = useState('+91 98450 12345')

  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [checkoutResult, setCheckoutResult] = useState<VerifyPaymentResponse | null>(null)
  const [failureResult, setFailureResult] = useState<{
    transaction_id: string
    order_id: string
    error_code?: string
    error_description?: string
    recovery_case_id?: string
  } | null>(null)

  const [showHelper, setShowHelper] = useState(true)
  const [sdkReady, setSdkReady] = useState(false)
  const activeSessionId: string | null = null


  // 1. Fetch payment configuration & load Razorpay checkout.js SDK
  useEffect(() => {
    let mounted = true

    // Fetch payment config non-blockingly
    api.getPaymentConfig()
      .then((conf) => {
        if (mounted) setConfig(conf)
      })
      .catch((err) => {
        console.warn('Could not fetch payment config:', err)
      })

    // If Razorpay SDK already present on window, activate immediately
    if (window.Razorpay) {
      setSdkReady(true)
      return
    }

    // Safety timeout: Ensure button is never permanently stuck in 'Loading Gateway...'
    const timer = setTimeout(() => {
      if (mounted) setSdkReady(true)
    }, 1500)

    const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => { if (mounted) setSdkReady(true) })
      existingScript.addEventListener('error', () => { if (mounted) setSdkReady(true) })
    } else {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = () => { if (mounted) setSdkReady(true) }
      script.onerror = () => {
        console.warn('Could not load Razorpay SDK dynamically. Fallback enabled.')
        if (mounted) setSdkReady(true)
      }
      document.body.appendChild(script)
    }

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [])

  const handleSelectPersona = (name: string, email: string, phone: string) => {
    setCustomerName(name)
    setCustomerEmail(email)
    setCustomerPhone(phone)
  }

  // 2. Main Razorpay Standard Checkout Flow
  const handleLaunchCheckout = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    setCheckoutResult(null)
    setFailureResult(null)

    try {
      // Step A: Create order on backend (receives Razorpay order_id and key_id)
      const orderData: CreateOrderResponse = await api.createPaymentOrder({
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        amount: selectedProduct.price,
        currency: 'INR',
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone
      })

      // Step B: Configure Razorpay Checkout.js
      if (window.Razorpay) {
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'RecoverAI Demo Store',
          description: selectedProduct.name,
          order_id: orderData.order_id,
          handler: async (response: any) => {
            // Step C: Server-side cryptographic HMAC-SHA256 signature verification
            try {
              setIsLoading(true)
              const verifyRes = await api.verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                transaction_id: orderData.transaction_id
              })
              setCheckoutResult(verifyRes)
              if (activeSessionId) {
                api.transitionCheckoutSession(activeSessionId, { new_status: 'COMPLETED' }).catch(() => { })
              }
            } catch (vErr: any) {
              setErrorMsg(`Verification Failed: ${vErr.message || 'Signature mismatch'}`)
            } finally {
              setIsLoading(false)
            }
          },
          prefill: {
            name: customerName,
            email: customerEmail,
            contact: customerPhone
          },
          theme: {
            color: '#6C00FF' // RecoverAI Vivid Purple
          },
          modal: {
            ondismiss: async () => {
              // User closed the modal without completing payment
              try {
                if (activeSessionId) {
                  api.transitionCheckoutSession(activeSessionId, { new_status: 'ABANDONED' }).catch(() => { })
                }
                await api.recordPaymentFailure({
                  transaction_id: orderData.transaction_id,
                  order_id: orderData.order_id,
                  error_code: 'CHECKOUT_DISMISSED',
                  error_description: 'Customer closed Razorpay checkout modal before completing transaction.',
                  error_category: 'ABANDONMENT'
                })
                setFailureResult({
                  transaction_id: orderData.transaction_id,
                  order_id: orderData.order_id,
                  error_code: 'CHECKOUT_DISMISSED',
                  error_description: 'Checkout modal was dismissed by customer. Escalated to RecoverAI for cart recovery.'
                })
              } catch (e) {
                console.error('Error logging dismissal:', e)
              }
              setIsLoading(false)
            }
          }
        }

        const rzp = new window.Razorpay(options)

        rzp.on('payment.failed', async (response: any) => {
          // Razorpay gateway test failure simulation event
          const err = response.error || {}
          try {
            const failRes = await api.recordPaymentFailure({
              transaction_id: orderData.transaction_id,
              order_id: orderData.order_id,
              payment_id: err.metadata?.payment_id,
              error_code: err.code || 'BAD_REQUEST_ERROR',
              error_description: err.description || 'Payment rejected by bank gateway.',
              error_category: 'GATEWAY_ERROR'
            })
            setFailureResult({
              transaction_id: orderData.transaction_id,
              order_id: orderData.order_id,
              error_code: err.code || 'BAD_REQUEST_ERROR',
              error_description: err.description || 'Payment declined by test gateway.',
              recovery_case_id: failRes?.recovery_case_id
            })
          } catch (e) {
            console.error('Error registering failure:', e)
          }
          setIsLoading(false)
        })

        rzp.open()
      } else {
        // Fallback simulation if checkout.js is blocked by ad-blocker
        setErrorMsg('Razorpay Checkout SDK is still loading or blocked. Please refresh or disable ad-blockers.')
        setIsLoading(false)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initiate checkout session')
      setIsLoading(false)
    }
  }

  // 3. Direct Synthetic Failure Injection (Test RecoverAI Recovery Pipeline)
  const handleSimulateFailure = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    setCheckoutResult(null)
    setFailureResult(null)

    try {
      // Create initial order
      const orderData = await api.createPaymentOrder({
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        amount: selectedProduct.price,
        currency: 'INR',
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone
      })

      // Simulate instantaneous bank switch timeout or card decline
      const failRes = await api.recordPaymentFailure({
        transaction_id: orderData.transaction_id,
        order_id: orderData.order_id,
        payment_id: `pay_sim_failed_${Math.floor(Math.random() * 89999 + 10000)}`,
        error_code: 'GATEWAY_TIMEOUT',
        error_description: 'Issuer bank did not respond within 8,000ms. Transaction aborted.',
        error_category: 'TECHNICAL_TIMEOUT'
      })

      setFailureResult({
        transaction_id: orderData.transaction_id,
        order_id: orderData.order_id,
        error_code: 'GATEWAY_TIMEOUT',
        error_description: 'Issuer bank timeout (8,250ms latency). RecoverAI agent triggered automatically.',
        recovery_case_id: failRes?.recovery_case_id
      })
    } catch (err: any) {
      setErrorMsg(err.message || 'Simulation failed')
    } finally {
      setIsLoading(false)
    }
  }

  const resetStore = () => {
    setCheckoutResult(null)
    setFailureResult(null)
    setErrorMsg(null)
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <SectionHeader
        title="RecoverAI Demo Store"
        subtitle="Experience standard Razorpay Test Mode checkout with server-side HMAC signature verification & AI recovery handoff"
        actions={
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-primary-light text-primary border border-primary-border shadow-xs">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>Razorpay Test Sandbox</span>
            </span>
            <Link
              to="/transactions"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-surface hover:bg-slate-50 text-navy rounded-xl text-xs font-semibold transition-all border border-border shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5 text-primary" />
              <span>View Ledger</span>
            </Link>
          </div>
        }
      />

      {/* Gateway Credential Alert if not configured */}
      {config && !config.is_configured && (
        <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs text-amber-950 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-950 flex items-center gap-2">
              <span>Razorpay Test Mode Sandbox Active (Local Mock Mode)</span>
              <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-full text-[10px] font-mono font-bold">
                Key ID: {config.key_id}
              </span>
            </div>
            <p className="text-amber-800 leading-relaxed font-sans">
              To connect your real Razorpay Test Account, configure your test keys in{' '}
              <code className="px-1.5 py-0.5 bg-white/80 rounded-md text-amber-950 font-mono font-bold">backend/.env</code>{' '}
              (<code className="font-mono">RAZORPAY_KEY_ID=rzp_test_...</code> and{' '}
              <code className="font-mono">API_GATEWAY_SECRET=...</code>). The checkout will automatically switch to live Razorpay servers.
            </p>
          </div>
        </div>
      )}

      {/* SUCCESS RESULT SCREEN */}
      {checkoutResult && (
        <div className="bg-surface rounded-2xl border border-emerald-300 p-8 shadow-fintech-card space-y-6 transition-all duration-normal animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-300 shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-navy font-display">
                    Payment Verified Successfully
                  </h2>
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold rounded-full flex items-center gap-1 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    HMAC Validated
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transaction recorded and confirmed server-side without relying solely on client callbacks.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetStore}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl font-semibold transition-colors border border-border cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Make Another Payment</span>
            </button>
          </div>

          {/* Receipt Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-border space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                Amount Captured
              </span>
              <div className="text-xl font-bold text-navy font-mono">
                ₹{checkoutResult.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Captured in Test Mode
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-border space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                Payment Method
              </span>
              <div className="text-sm font-bold text-navy font-display flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-primary" />
                {checkoutResult.method}
              </div>
              <span className="text-[11px] text-slate-400">Gateway: Razorpay</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-border space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                Razorpay Payment ID
              </span>
              <div className="text-xs font-mono font-semibold text-navy truncate" title={checkoutResult.razorpay_payment_id}>
                {checkoutResult.razorpay_payment_id}
              </div>
              <span className="text-[11px] text-slate-400 font-mono truncate block" title={checkoutResult.razorpay_order_id}>
                Order: {checkoutResult.razorpay_order_id}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-border space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                RecoverAI Internal ID
              </span>
              <div className="text-xs font-mono font-semibold text-navy truncate">
                {checkoutResult.transaction_id}
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {new Date(checkoutResult.verified_at).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Quick links to RecoverAI views */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/transactions"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-all shadow-fintech-purple"
            >
              <span>View in Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/audit"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors border border-border shadow-xs"
            >
              <span>View HMAC Audit Record</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </Link>
          </div>
        </div>
      )}

      {/* FAILURE / ESCALATION SCREEN */}
      {failureResult && (
        <div className="bg-surface rounded-2xl border border-rose-300 p-8 shadow-fintech-card space-y-6 transition-all duration-normal animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 border border-rose-300 shadow-xs">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-navy font-display">
                    Payment Failed & Escalated to RecoverAI
                  </h2>
                  <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold rounded-full font-mono">
                    {failureResult.error_code || 'GATEWAY_ERROR'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transaction marked as failed. RecoverAI Autonomous Agent has synthesized failure diagnosis & recovery strategy.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetStore}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl font-semibold transition-colors border border-border cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Checkout</span>
            </button>
          </div>

          <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl text-xs space-y-2">
            <div className="font-bold text-navy flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Reason: {failureResult.error_description || 'Payment rejected by bank or gateway'}</span>
            </div>
            <div className="flex flex-wrap gap-4 text-slate-600 font-mono text-[11px]">
              <span>Transaction ID: {failureResult.transaction_id}</span>
              <span>Order ID: {failureResult.order_id}</span>
              {failureResult.recovery_case_id && (
                <span className="text-primary font-bold">
                  Recovery Case: {failureResult.recovery_case_id}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/agent')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-all shadow-fintech-purple cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Autonomous Recovery Agent</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <Link
              to="/at-risk"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors border border-border shadow-xs"
            >
              <span>View in At-Risk Revenue</span>
            </Link>
          </div>
        </div>
      )}

      {/* MAIN CHECKOUT FORM & PRODUCT SELECTOR */}
      {!checkoutResult && !failureResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Product Selection & Customer Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Select Product */}
            <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/70">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-bold text-navy font-display">
                    1. Select Demo Product
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  Select a realistic business tier
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {PRODUCTS.map((prod) => {
                  const isSelected = selectedProduct.id === prod.id
                  return (
                    <div
                      key={prod.id}
                      onClick={() => setSelectedProduct(prod)}
                      className={`cursor-pointer rounded-2xl p-4 border transition-all relative flex flex-col justify-between ${isSelected
                          ? 'border-primary bg-surface-blue/50 ring-2 ring-primary/20 shadow-fintech-card'
                          : 'border-border/80 bg-surface hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">
                            {prod.category}
                          </span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${isSelected
                                ? 'bg-primary text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600'
                              }`}
                          >
                            {prod.badge}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-navy font-display mb-1">
                          {prod.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 mb-3 leading-snug line-clamp-2">
                          {prod.description}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t border-border/60">
                        <div className="text-base font-bold text-navy font-mono">
                          ₹{prod.price.toLocaleString('en-IN')}
                          {prod.period && (
                            <span className="text-[10px] font-normal text-slate-500 ml-1 font-sans">
                              {prod.period}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Selected product feature list */}
              <div className="bg-surface-blue/50 rounded-xl p-4 border border-surface-blue-border text-xs space-y-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-primary font-display">
                  Included Features:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                  {selectedProduct.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[11px] text-navy font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2: Customer Contact & Prefill Personas */}
            <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/70">
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-bold text-navy font-display">
                    2. Customer Information
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-medium">Quick Personas:</span>
                  <button
                    type="button"
                    onClick={() => handleSelectPersona('Aditya Sharma', 'aditya.sharma@techcorp.in', '+91 98450 12345')}
                    className="px-2.5 py-1 bg-surface-blue hover:bg-primary-light text-[10px] font-bold text-primary rounded-full border border-surface-blue-border transition-colors cursor-pointer"
                  >
                    Aditya (VIP)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPersona('Priyanka Iyer', 'priyanka.i@zenithai.com', '+91 98112 34567')}
                    className="px-2.5 py-1 bg-surface-blue hover:bg-primary-light text-[10px] font-bold text-primary rounded-full border border-surface-blue-border transition-colors cursor-pointer"
                  >
                    Priyanka (Growth)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Customer Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-surface text-navy placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 text-xs shadow-2xs font-medium"
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Email Address</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-surface text-navy placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 text-xs shadow-2xs font-mono"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Phone Number</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-surface text-navy placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 text-xs shadow-2xs font-mono"
                    placeholder="+91 99999 99999"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Razorpay Test Mode Helper Accordion */}
            <div className="bg-surface rounded-2xl border border-border/80 p-5 shadow-fintech-card space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowHelper(!showHelper)}
              >
                <div className="flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-navy font-display">
                    Test Payment Options & Helper Badges
                  </span>
                </div>
                {showHelper ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>

              {showHelper && (
                <div className="pt-3 border-t border-border/70 text-xs space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-2">
                      <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Simulating Test Success:
                      </span>
                      <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc pl-4">
                        <li>
                          <strong>Card:</strong> <code className="font-mono bg-white px-2 py-0.5 rounded-full border border-slate-200 text-primary font-bold">4111 1111 1111 1111</code> (any future MM/YY, CVV 123). Click &ldquo;Success&rdquo; on test OTP.
                        </li>
                        <li>
                          <strong>UPI:</strong> Enter <code className="font-mono bg-white px-2 py-0.5 rounded-full border border-slate-200 text-primary font-bold">success@razorpay</code> or select &ldquo;Success&rdquo; in modal.
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 bg-rose-50/60 border border-rose-200/80 rounded-2xl space-y-2">
                      <span className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        Simulating Test Failure:
                      </span>
                      <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc pl-4">
                        <li>
                          <strong>Card:</strong> Select &ldquo;Failure&rdquo; on the Razorpay test OTP screen.
                        </li>
                        <li>
                          <strong>Dismiss:</strong> Close or dismiss the payment popup to trigger cart recovery.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary & Checkout Trigger */}
          <div className="space-y-6">
            <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card space-y-5 sticky top-20">
              <div className="pb-3 border-b border-border/70">
                <h3 className="text-base font-bold text-navy font-display">
                  Order Summary
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  Merchant: RecoverAI Demo Store
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Product</span>
                  <span className="font-semibold text-navy">{selectedProduct.name}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Billing Tier</span>
                  <span className="font-mono text-slate-800 font-medium">{selectedProduct.category}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{selectedProduct.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>GST / Tax</span>
                  <span className="text-emerald-600 font-semibold">Included (₹0.00)</span>
                </div>

                <div className="pt-3.5 border-t border-border/70 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-navy font-display">Total Payable</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-navy font-mono">
                      ₹{selectedProduct.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">INR (Test Mode)</span>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Buttons: Bold purple primary pay button */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleLaunchCheckout}
                  disabled={isLoading || !sdkReady}
                  className="w-full py-3 px-5 bg-primary hover:bg-primary-hover disabled:bg-slate-200 text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Lock className="w-4 h-4" />
                  {isLoading ? 'Preparing Order...' : !sdkReady ? 'Loading Gateway...' : 'Pay with Razorpay Test Checkout'}
                </button>

                <button
                  type="button"
                  onClick={handleSimulateFailure}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-surface-blue hover:bg-surface-blue-hover text-navy rounded-xl text-xs font-bold transition-colors border border-surface-blue-border flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  title="Directly trigger RecoverAI agent failure handling"
                >
                  <Cpu className="w-3.5 h-3.5 text-rose-600" />
                  <span>Simulate Payment Failure</span>
                </button>
              </div>

              <div className="pt-3.5 border-t border-border/70 text-[10px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Securely Verified & Recorded</span>
                </div>
                <p className="leading-snug">
                  Payments are verified securely before persisting. Failure cases automatically trigger RecoverAI&rsquo;s ERV recovery workflow.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DemoCheckout
