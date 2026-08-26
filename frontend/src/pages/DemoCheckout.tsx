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
      'Real-time ML Propensity Engine',
      'Multi-PSP Dynamic Smart Fallbacks',
      'Gemini-powered Multi-lingual Paylinks',
      'Continuous Audit & Guardrail Enforcement'
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
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  // Track session on product selection
  useEffect(() => {
    api.createCheckoutSession({
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      cart_amount: selectedProduct.price,
      selected_method: 'UPI',
      is_demo_simulation: true
    }).then(sess => {
      setActiveSessionId(sess.id)
    }).catch(err => console.warn('Could not init checkout session:', err))
  }, [selectedProduct.id])

  // 1. Fetch payment configuration & load Razorpay checkout.js SDK
  useEffect(() => {
    const init = async () => {
      try {
        const conf = await api.getPaymentConfig()
        setConfig(conf)
      } catch (err) {
        console.warn('Could not fetch payment config:', err)
      }

      // Dynamically load Razorpay checkout.js script
      if (!window.Razorpay) {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.async = true
        script.onload = () => {
          setSdkReady(true)
        }
        script.onerror = () => {
          console.error('Failed to load Razorpay checkout.js SDK')
        }
        document.body.appendChild(script)
      } else {
        setSdkReady(true)
      }
    }

    init()
  }, [])

  // Quick Persona selector
  const handleSelectPersona = (name: string, email: string, phone: string) => {
    setCustomerName(name)
    setCustomerEmail(email)
    setCustomerPhone(phone)
  }

  // 2. Launch Genuine Razorpay Test Mode Checkout
  const handleLaunchCheckout = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    setCheckoutResult(null)
    setFailureResult(null)

    try {
      // Step A: Request server to create authentic Razorpay order
      const orderPayload = {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        amount: selectedProduct.price,
        currency: 'INR',
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone
      }

      const orderData: CreateOrderResponse = await api.createPaymentOrder(orderPayload)

      // Track session transition to PAYMENT_METHOD_VIEWED and PAYMENT_INITIATED
      if (activeSessionId) {
        api.transitionCheckoutSession(activeSessionId, { new_status: 'PAYMENT_METHOD_VIEWED' }).catch(() => {})
        api.transitionCheckoutSession(activeSessionId, { new_status: 'PAYMENT_INITIATED', payment_attempted: true }).catch(() => {})
      }

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
                api.transitionCheckoutSession(activeSessionId, { new_status: 'COMPLETED' }).catch(() => {})
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
            color: '#D95D39' // RecoverAI Signature Burnt Orange
          },
          modal: {
            ondismiss: async () => {
              // User closed the modal without completing payment
              try {
                if (activeSessionId) {
                  api.transitionCheckoutSession(activeSessionId, { new_status: 'ABANDONED' }).catch(() => {})
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
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <Zap className="w-3 h-3 text-amber-600" />
              <span>Razorpay Test Sandbox</span>
            </span>
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-warm-gray-100 hover:bg-warm-gray-200 text-warm-gray-800 rounded-sm text-xs font-medium transition-colors border border-border"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>View All Transactions</span>
            </Link>
          </div>
        }
      />

      {/* Gateway Credential Alert if not configured */}
      {config && !config.is_configured && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-md text-xs text-amber-900 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-950 flex items-center gap-2">
              <span>Razorpay Test Mode Sandbox Active (Local Mock Mode)</span>
              <span className="px-1.5 py-0.5 bg-amber-200/70 text-amber-900 rounded-xs text-[10px] font-mono">
                Key ID: {config.key_id}
              </span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              To connect your real Razorpay Test Account, put your test keys in{' '}
              <code className="px-1 py-0.5 bg-amber-100 rounded text-amber-950 font-mono">backend/.env</code>{' '}
              (<code className="font-mono">RAZORPAY_KEY_ID=rzp_test_...</code> and{' '}
              <code className="font-mono">RAZORPAY_KEY_SECRET=...</code>). The checkout will automatically switch to live Razorpay servers.
            </p>
          </div>
        </div>
      )}

      {/* SUCCESS RESULT SCREEN */}
      {checkoutResult && (
        <div className="bg-surface rounded-lg border border-moss-green/40 p-8 shadow-fintech-card space-y-6 transition-all duration-normal animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-moss-green-light flex items-center justify-center text-moss-green border border-moss-green/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-graphite font-display">
                    Payment Verified Successfully
                  </h2>
                  <span className="px-2 py-0.5 bg-moss-green-light text-moss-green-dark border border-moss-green/30 text-[10px] font-semibold rounded-full flex items-center gap-1 font-mono">
                    <ShieldCheck className="w-3 h-3 text-moss-green" />
                    HMAC-SHA256 Validated
                  </span>
                </div>
                <p className="text-xs text-warm-gray-500">
                  Transaction recorded and confirmed server-side without relying solely on client callbacks.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetStore}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-warm-gray-100 hover:bg-warm-gray-200 text-warm-gray-700 text-xs rounded-sm font-medium transition-colors border border-border"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Make Another Payment</span>
            </button>
          </div>

          {/* Receipt Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 bg-warm-gray-50 rounded border border-border space-y-1">
              <span className="text-[10px] text-warm-gray-500 uppercase tracking-wider block font-medium">
                Amount Captured
              </span>
              <div className="text-lg font-bold text-graphite font-display">
                ₹{checkoutResult.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-moss-green flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Captured in Test Mode
              </span>
            </div>

            <div className="p-3.5 bg-warm-gray-50 rounded border border-border space-y-1">
              <span className="text-[10px] text-warm-gray-500 uppercase tracking-wider block font-medium">
                Payment Method
              </span>
              <div className="text-sm font-semibold text-graphite font-display flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-burnt-orange" />
                {checkoutResult.method}
              </div>
              <span className="text-[11px] text-warm-gray-400">Gateway: Razorpay</span>
            </div>

            <div className="p-3.5 bg-warm-gray-50 rounded border border-border space-y-1">
              <span className="text-[10px] text-warm-gray-500 uppercase tracking-wider block font-medium">
                Razorpay Payment ID
              </span>
              <div className="text-xs font-mono font-medium text-graphite truncate" title={checkoutResult.razorpay_payment_id}>
                {checkoutResult.razorpay_payment_id}
              </div>
              <span className="text-[11px] text-warm-gray-400 font-mono truncate block" title={checkoutResult.razorpay_order_id}>
                Order: {checkoutResult.razorpay_order_id}
              </span>
            </div>

            <div className="p-3.5 bg-warm-gray-50 rounded border border-border space-y-1">
              <span className="text-[10px] text-warm-gray-500 uppercase tracking-wider block font-medium">
                RecoverAI Internal ID
              </span>
              <div className="text-xs font-mono font-medium text-graphite truncate">
                {checkoutResult.transaction_id}
              </div>
              <span className="text-[11px] text-warm-gray-400">
                {new Date(checkoutResult.verified_at).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Quick links to RecoverAI views */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-graphite hover:bg-dark-surface text-white text-xs font-medium rounded-sm transition-colors shadow-xs"
            >
              <span>View in Transactions Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/audit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface hover:bg-warm-gray-50 text-warm-gray-700 text-xs font-medium rounded-sm transition-colors border border-border shadow-xs"
            >
              <span>View HMAC Audit Record</span>
              <ExternalLink className="w-3.5 h-3.5 text-warm-gray-400" />
            </Link>
          </div>
        </div>
      )}

      {/* FAILURE / ESCALATION SCREEN */}
      {failureResult && (
        <div className="bg-surface rounded-lg border border-burnt-orange/30 p-8 shadow-fintech-card space-y-6 transition-all duration-normal animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-crimson-red-light flex items-center justify-center text-crimson-red border border-crimson-red/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-graphite font-display">
                    Payment Failed & Escalated to RecoverAI
                  </h2>
                  <span className="px-2 py-0.5 bg-crimson-red-light text-crimson-red border border-crimson-red/30 text-[10px] font-semibold rounded-full font-mono">
                    {failureResult.error_code || 'GATEWAY_ERROR'}
                  </span>
                </div>
                <p className="text-xs text-warm-gray-500">
                  Transaction marked as failed. RecoverAI Autonomous Agent has synthesized failure diagnosis & recovery strategy.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetStore}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-warm-gray-100 hover:bg-warm-gray-200 text-warm-gray-700 text-xs rounded-sm font-medium transition-colors border border-border"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Checkout</span>
            </button>
          </div>

          <div className="p-4 bg-crimson-red-light/30 border border-crimson-red/20 rounded-md text-xs space-y-2">
            <div className="font-semibold text-graphite flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-crimson-red" />
              <span>Reason: {failureResult.error_description || 'Payment rejected by bank or gateway'}</span>
            </div>
            <div className="flex flex-wrap gap-4 text-warm-gray-600 font-mono text-[11px]">
              <span>Transaction ID: {failureResult.transaction_id}</span>
              <span>Order ID: {failureResult.order_id}</span>
              {failureResult.recovery_case_id && (
                <span className="text-burnt-orange font-semibold">
                  Recovery Case: {failureResult.recovery_case_id}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/agent')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white text-xs font-semibold rounded-sm transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Autonomous Recovery Agent</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <Link
              to="/at-risk"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-surface hover:bg-warm-gray-50 text-warm-gray-700 text-xs font-medium rounded-sm transition-colors border border-border shadow-xs"
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
            <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-burnt-orange" />
                  <h3 className="text-sm font-bold text-graphite font-display">
                    1. Select Demo Product
                  </h3>
                </div>
                <span className="text-[11px] text-warm-gray-400">
                  Select a realistic business tier
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PRODUCTS.map((prod) => {
                  const isSelected = selectedProduct.id === prod.id
                  return (
                    <div
                      key={prod.id}
                      onClick={() => setSelectedProduct(prod)}
                      className={`cursor-pointer rounded-md p-4 border transition-all duration-fast relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-burnt-orange bg-burnt-orange/5 ring-1 ring-burnt-orange shadow-xs'
                          : 'border-border bg-surface hover:border-warm-gray-300 hover:bg-warm-gray-50/50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] uppercase font-semibold text-warm-gray-500 font-mono">
                            {prod.category}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              isSelected
                                ? 'bg-burnt-orange text-white'
                                : 'bg-warm-gray-100 text-warm-gray-600'
                            }`}
                          >
                            {prod.badge}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-graphite font-display mb-1">
                          {prod.name}
                        </h4>
                        <p className="text-[11px] text-warm-gray-500 mb-3 leading-snug line-clamp-2">
                          {prod.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border/60">
                        <div className="text-base font-bold text-graphite font-display">
                          ₹{prod.price.toLocaleString('en-IN')}
                          {prod.period && (
                            <span className="text-[10px] font-normal text-warm-gray-500 ml-1">
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
              <div className="bg-warm-gray-50/70 rounded p-3 border border-border/80 text-xs space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-warm-gray-500 font-display">
                  Included Features:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {selectedProduct.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[11px] text-warm-gray-700">
                      <CheckCircle2 className="w-3 h-3 text-moss-green shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2: Customer Contact & Prefill Personas */}
            <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-burnt-orange" />
                  <h3 className="text-sm font-bold text-graphite font-display">
                    2. Customer Information
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-warm-gray-400">Quick Personas:</span>
                  <button
                    type="button"
                    onClick={() => handleSelectPersona('Aditya Sharma', 'aditya.sharma@techcorp.in', '+91 98450 12345')}
                    className="px-2 py-0.5 bg-warm-gray-100 hover:bg-warm-gray-200 text-[10px] font-medium text-warm-gray-700 rounded-xs border border-border transition-colors"
                  >
                    Aditya (VIP)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPersona('Priyanka Iyer', 'priyanka.i@zenithai.com', '+91 98112 34567')}
                    className="px-2 py-0.5 bg-warm-gray-100 hover:bg-warm-gray-200 text-[10px] font-medium text-warm-gray-700 rounded-xs border border-border transition-colors"
                  >
                    Priyanka (Growth)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-warm-gray-600 block mb-1 font-medium">Customer Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-sm border border-border bg-warm-gray-50 focus:bg-white text-graphite focus:outline-none focus:ring-1 focus:ring-burnt-orange text-xs"
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label className="text-warm-gray-600 block mb-1 font-medium">Email Address</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-sm border border-border bg-warm-gray-50 focus:bg-white text-graphite focus:outline-none focus:ring-1 focus:ring-burnt-orange text-xs font-mono"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="text-warm-gray-600 block mb-1 font-medium">Phone Number</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-sm border border-border bg-warm-gray-50 focus:bg-white text-graphite focus:outline-none focus:ring-1 focus:ring-burnt-orange text-xs font-mono"
                    placeholder="+91 99999 99999"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Razorpay Test Mode Helper Accordion */}
            <div className="bg-surface rounded-md border border-border p-4 shadow-fintech-card space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowHelper(!showHelper)}
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-warm-gray-600" />
                  <span className="text-xs font-bold text-graphite font-display">
                    Razorpay Test Credentials & Supported Test Methods
                  </span>
                </div>
                {showHelper ? (
                  <ChevronUp className="w-4 h-4 text-warm-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-warm-gray-400" />
                )}
              </div>

              {showHelper && (
                <div className="pt-2 border-t border-border text-xs space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-moss-green-light/40 border border-moss-green/30 rounded space-y-1.5">
                      <span className="text-[11px] font-semibold text-moss-green-dark flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-moss-green" />
                        Simulating Test Success:
                      </span>
                      <ul className="text-[11px] text-warm-gray-600 space-y-1 list-disc pl-4">
                        <li>
                          <strong>Card:</strong> <code className="font-mono bg-white px-1 py-0.5 rounded border border-border">4111 1111 1111 1111</code> (any future MM/YY, CVV 123). Click &ldquo;Success&rdquo; on test OTP.
                        </li>
                        <li>
                          <strong>UPI:</strong> Enter <code className="font-mono bg-white px-1 py-0.5 rounded border border-border">success@razorpay</code> or select &ldquo;Success&rdquo; in modal.
                        </li>
                      </ul>
                    </div>

                    <div className="p-3 bg-crimson-red-light/30 border border-crimson-red/20 rounded space-y-1.5">
                      <span className="text-[11px] font-semibold text-crimson-red flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-crimson-red" />
                        Simulating Test Failure:
                      </span>
                      <ul className="text-[11px] text-warm-gray-600 space-y-1 list-disc pl-4">
                        <li>
                          <strong>Card:</strong> <code className="font-mono bg-white px-1 py-0.5 rounded border border-border">4000 0000 0000 0002</code> or click &ldquo;Failure&rdquo; on test OTP screen.
                        </li>
                        <li>
                          <strong>UPI:</strong> Enter <code className="font-mono bg-white px-1 py-0.5 rounded border border-border">failure@razorpay</code>.
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
            <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-5 sticky top-20">
              <div className="pb-3 border-b border-border">
                <h3 className="text-sm font-bold text-graphite font-display">
                  Order Summary
                </h3>
                <span className="text-[11px] text-warm-gray-400">
                  Merchant: RecoverAI Demo Store
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-warm-gray-600">
                  <span>Product</span>
                  <span className="font-medium text-graphite">{selectedProduct.name}</span>
                </div>
                <div className="flex justify-between items-center text-warm-gray-600">
                  <span>Billing Tier</span>
                  <span className="font-mono text-warm-gray-800">{selectedProduct.category}</span>
                </div>
                <div className="flex justify-between items-center text-warm-gray-600">
                  <span>Subtotal</span>
                  <span>₹{selectedProduct.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-warm-gray-600">
                  <span>GST / Tax</span>
                  <span className="text-moss-green font-medium">Included (₹0.00)</span>
                </div>

                <div className="pt-3 border-t border-border flex justify-between items-baseline">
                  <span className="text-xs font-bold text-graphite font-display">Total Payable</span>
                  <div className="text-right">
                    <div className="text-xl font-bold text-burnt-orange font-display">
                      ₹{selectedProduct.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-warm-gray-400 font-mono">INR (Test Mode)</span>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-crimson-red-light border border-crimson-red/30 text-crimson-red text-xs rounded-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleLaunchCheckout}
                  disabled={isLoading || !sdkReady}
                  className="w-full py-2.5 px-4 bg-burnt-orange hover:bg-burnt-orange-hover disabled:bg-warm-gray-300 text-white rounded-sm text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isLoading ? 'Preparing Order...' : !sdkReady ? 'Loading Gateway...' : 'Pay with Razorpay Test Checkout'}
                </button>

                <button
                  type="button"
                  onClick={handleSimulateFailure}
                  disabled={isLoading}
                  className="w-full py-2 px-3 bg-warm-gray-100 hover:bg-warm-gray-200 text-warm-gray-700 rounded-sm text-xs font-medium transition-colors border border-border flex items-center justify-center gap-1.5"
                  title="Directly trigger RecoverAI agent failure handling"
                >
                  <Cpu className="w-3.5 h-3.5 text-crimson-red" />
                  <span>Simulate Instant Bank Failure</span>
                </button>
              </div>

              <div className="pt-3 border-t border-border/80 text-[10px] text-warm-gray-400 space-y-1">
                <div className="flex items-center gap-1.5 text-warm-gray-500">
                  <ShieldCheck className="w-3 h-3 text-moss-green" />
                  <span>Server-Side HMAC SHA-256 Verified</span>
                </div>
                <p className="leading-snug">
                  Payments are cryptographically verified before persisting. Failure cases automatically trigger RecoverAI&rsquo;s ERV decision matrix.
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
