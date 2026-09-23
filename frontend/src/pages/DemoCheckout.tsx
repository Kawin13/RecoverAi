import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  UserCheck,
  Smartphone,
  Building2,
  Wallet,
  X,
  QrCode,
  Search,
  Eye,
  EyeOff,
  Check,
  Clock
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

export interface PaymentOptionItem {
  id: 'UPI' | 'Card' | 'NetBanking' | 'Wallet'
  name: string
  subtitle: string
  badge: string
  popular?: boolean
  description: string
  icon: React.ComponentType<{ className?: string }>
}

export const PAYMENT_OPTIONS: PaymentOptionItem[] = [
  {
    id: 'UPI',
    name: 'UPI Instant',
    subtitle: 'Google Pay, PhonePe, Paytm, QR',
    badge: 'Fastest (0% Drop)',
    popular: true,
    description: 'Direct bank debit via dynamic UPI intent, VPA, or QR code.',
    icon: Smartphone
  },
  {
    id: 'Card',
    name: 'Credit / Debit Card',
    subtitle: 'Visa, Mastercard, RuPay with 3DS OTP',
    badge: '3D Secure',
    description: 'Domestic & international card rails with OTP authorization.',
    icon: CreditCard
  },
  {
    id: 'NetBanking',
    name: 'Net Banking',
    subtitle: 'HDFC, SBI, ICICI, Axis, Kotak',
    badge: '50+ Banks',
    description: 'Direct corporate & retail online banking authentication.',
    icon: Building2
  },
  {
    id: 'Wallet',
    name: 'Wallets & PayLater',
    subtitle: 'Paytm, Mobikwik, Amazon Pay',
    badge: '1-Tap Pay',
    description: 'Pre-paid balances and digital credit lines.',
    icon: Wallet
  }
]

export interface BankItem {
  code: string
  name: string
  popular?: boolean
  badgeColor?: string
}

export const POPULAR_BANKS: BankItem[] = [
  { code: 'HDFC', name: 'HDFC Bank', popular: true, badgeColor: 'bg-blue-600 text-white' },
  { code: 'SBIN', name: 'State Bank of India', popular: true, badgeColor: 'bg-sky-600 text-white' },
  { code: 'ICIC', name: 'ICICI Bank', popular: true, badgeColor: 'bg-amber-600 text-white' },
  { code: 'UTIB', name: 'Axis Bank', popular: true, badgeColor: 'bg-rose-700 text-white' },
  { code: 'KKBK', name: 'Kotak Mahindra Bank', popular: true, badgeColor: 'bg-red-600 text-white' },
  { code: 'PUNB', name: 'Punjab National Bank', popular: true, badgeColor: 'bg-yellow-600 text-white' }
]

export const ALL_BANKS: BankItem[] = [
  ...POPULAR_BANKS,
  { code: 'BARB', name: 'Bank of Baroda' },
  { code: 'CNRB', name: 'Canara Bank' },
  { code: 'UBIN', name: 'Union Bank of India' },
  { code: 'INDB', name: 'IndusInd Bank' },
  { code: 'YESB', name: 'Yes Bank' },
  { code: 'IDFB', name: 'IDFC First Bank' },
  { code: 'FDRL', name: 'Federal Bank' },
  { code: 'IDIB', name: 'Indian Bank' },
  { code: 'CBIN', name: 'Central Bank of India' },
  { code: 'BKID', name: 'Bank of India' },
  { code: 'RATN', name: 'RBL Bank' },
  { code: 'SIBL', name: 'South Indian Bank' },
  { code: 'KVBL', name: 'Karur Vysya Bank' },
  { code: 'SCBL', name: 'Standard Chartered Bank' },
  { code: 'CITI', name: 'Citibank India' },
  { code: 'HSBC', name: 'HSBC India' },
  { code: 'DEUT', name: 'Deutsche Bank' }
]

export const WALLET_PROVIDERS = [
  { id: 'PAYTM', name: 'Paytm Wallet', subtitle: 'Linked: +91 98450 12345', balance: 3450.0, badge: 'Pre-paid' },
  { id: 'PHONEPE', name: 'PhonePe Wallet', subtitle: 'Linked: +91 98450 12345', balance: 1820.0, badge: 'Instant' },
  { id: 'AMAZONPAY', name: 'Amazon Pay', subtitle: 'Gift Card + Balance', balance: 5200.0, badge: 'Verified' },
  { id: 'MOBIKWIK', name: 'MobiKwik', subtitle: 'ZIP & SuperCash', balance: 920.0, badge: 'Active' }
]

export const BNPL_PROVIDERS = [
  { id: 'SIMPL', name: 'Simpl PayLater', subtitle: 'Pay in 3 or next cycle', creditLimit: 15000.0, badge: '3-in-1' },
  { id: 'LAZYPAY', name: 'LazyPay', subtitle: '1-tap instant credit line', creditLimit: 10000.0, badge: 'Zero Interest' },
  { id: 'ICICI_PL', name: 'ICICI PayLater', subtitle: 'Direct bank credit line', creditLimit: 25000.0, badge: 'Pre-approved' }
]

export const UPI_APPS = [
  { id: 'GPay', name: 'Google Pay', subtitle: 'Instant UPI Intent', iconColor: 'text-blue-600 bg-blue-50' },
  { id: 'PhonePe', name: 'PhonePe', subtitle: 'Direct bank debit', iconColor: 'text-purple-600 bg-purple-50' },
  { id: 'Paytm', name: 'Paytm UPI', subtitle: 'Fastest response rail', iconColor: 'text-sky-600 bg-sky-50' },
  { id: 'BHIM', name: 'BHIM UPI', subtitle: 'NPCI National Switch', iconColor: 'text-emerald-600 bg-emerald-50' },
  { id: 'CRED', name: 'CRED UPI', subtitle: 'Premium rewards rail', iconColor: 'text-slate-900 bg-slate-100' }
]

export const METHOD_FAILURE_REASONS: Record<string, Array<{ code: string; label: string; category: string }>> = {
  UPI: [
    { code: 'UPI_TIMEOUT', label: 'UPI Switch Timeout (PSP Timeout > 8,000ms)', category: 'TECHNICAL_TIMEOUT' },
    { code: 'UPI_INCORRECT_MPIN', label: 'Invalid UPI MPIN (Customer Auth Failure)', category: 'AUTHENTICATION_ERROR' },
    { code: 'BANK_DOWNTIME', label: 'Beneficiary Bank UPI Node Offline', category: 'TECHNICAL_TIMEOUT' },
    { code: 'INSUFFICIENT_FUNDS', label: 'Insufficient Bank Account Balance', category: 'INSUFFICIENT_FUNDS' }
  ],
  Card: [
    { code: 'EXPIRED_CARD', label: 'Card Expired / Bad CVV Validation Failed', category: 'INVALID_INSTRUMENT' },
    { code: '3DS_OTP_TIMEOUT', label: '3DS OTP Verification Timed Out (Customer Drop-off)', category: 'AUTHENTICATION_ERROR' },
    { code: 'INSUFFICIENT_FUNDS', label: 'Exceeded Credit / Daily Debit Limit', category: 'INSUFFICIENT_FUNDS' },
    { code: 'CARD_DECLINED_BY_ISSUER', label: 'Card Issuer Do Not Honor (Security Restriction)', category: 'GATEWAY_ERROR' }
  ],
  NetBanking: [
    { code: 'BANK_DOWNTIME', label: 'Core Banking System (CBS) Downtime', category: 'TECHNICAL_TIMEOUT' },
    { code: 'NETBANKING_AUTH_TIMEOUT', label: 'Internet Banking Login Session Expired', category: 'TECHNICAL_TIMEOUT' },
    { code: 'ACCOUNT_LIMIT_EXCEEDED', label: 'Corporate Daily RTGS/NEFT Transaction Limit Exceeded', category: 'INSUFFICIENT_FUNDS' }
  ],
  Wallet: [
    { code: 'WALLET_INSUFFICIENT_BALANCE', label: 'Wallet Balance Below Order Amount', category: 'INSUFFICIENT_FUNDS' },
    { code: 'WALLET_OTP_EXPIRED', label: 'Wallet Debit OTP Expired', category: 'AUTHENTICATION_ERROR' },
    { code: 'KYC_LIMIT_EXCEEDED', label: 'PPI Monthly Wallet Transaction Cap Reached', category: 'INVALID_INSTRUMENT' }
  ]
}

export const FAILURE_REASONS = [
  { code: 'UPI_TIMEOUT', label: 'UPI Switch Timeout (Technical Timeout)', category: 'TECHNICAL_TIMEOUT' },
  { code: 'INSUFFICIENT_FUNDS', label: 'Insufficient Funds (Customer Financial)', category: 'INSUFFICIENT_FUNDS' },
  { code: 'EXPIRED_CARD', label: 'Expired Card / Bad CVV (Invalid Instrument)', category: 'INVALID_INSTRUMENT' },
  { code: 'BANK_DOWNTIME', label: 'Issuer Bank Network Outage (External Rail)', category: 'TECHNICAL_TIMEOUT' },
  { code: 'CHECKOUT_DISMISSED', label: 'Cart Abandoned at Payment Step (Drop-off)', category: 'ABANDONMENT' }
]

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

function getCardBrand(num: string): 'visa' | 'mastercard' | 'rupay' | 'amex' | 'generic' {
  const clean = num.replace(/\s+/g, '')
  if (/^4/.test(clean)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard'
  if (/^(60|65|81|82)/.test(clean)) return 'rupay'
  if (/^3[47]/.test(clean)) return 'amex'
  return 'generic'
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }
  return digits
}

export const DemoCheckout: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderIdParam = searchParams.get('order_id')
  const recoveryCaseParam = searchParams.get('recovery_case')
  const amountParam = searchParams.get('amount')
  const methodParam = searchParams.get('method')
  const recommendationParam = searchParams.get('recommendation')
  const autoOpenParam = searchParams.get('auto_open')
  const paymentLinkIdParam = searchParams.get('payment_link_id')

  const isRecoveryMode = Boolean(orderIdParam || recoveryCaseParam || paymentLinkIdParam)
  const [showFullCatalog, setShowFullCatalog] = useState(false)
  const autoOpenAttemptedRef = useRef(false)

  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductItem>(PRODUCTS[0])
  const [selectedMethod, setSelectedMethod] = useState<'UPI' | 'Card' | 'NetBanking' | 'Wallet'>('UPI')
  const [customerName, setCustomerName] = useState('Aditya Sharma')
  const [customerEmail, setCustomerEmail] = useState('aditya.sharma@techcorp.in')
  const [customerPhone, setCustomerPhone] = useState('+91 98450 12345')

  // Payment Instrument Form State
  // 1. UPI State
  const [upiMode, setUpiMode] = useState<'VPA' | 'QR' | 'APPS'>('VPA')
  const [upiVpa, setUpiVpa] = useState('aditya@okhdfcbank')
  const [upiSelectedApp, setUpiSelectedApp] = useState('GPay')
  const [qrCountdown, setQrCountdown] = useState(300)

  // 2. Card State
  const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111')
  const [cardExpiry, setCardExpiry] = useState('12/28')
  const [cardCvv, setCardCvv] = useState('123')
  const [cardHolder, setCardHolder] = useState('Aditya Sharma')
  const [showCvv, setShowCvv] = useState(false)
  const [saveCard, setSaveCard] = useState(true)

  // 3. Net Banking State
  const [selectedBank, setSelectedBank] = useState('HDFC')
  const [accountType, setAccountType] = useState<'RETAIL' | 'CORPORATE'>('RETAIL')
  const [bankSearch, setBankSearch] = useState('')

  // 4. Wallet State
  const [walletCategory, setWalletCategory] = useState<'WALLET' | 'BNPL'>('WALLET')
  const [selectedWallet, setSelectedWallet] = useState('PAYTM')

  // Operational State
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
  const [showSimModal, setShowSimModal] = useState(false)
  const [simModalData, setSimModalData] = useState<{
    orderId: string
    transactionId: string
    amount: number
    currency: string
    productName: string
    method: string
  } | null>(null)
  const [selectedFailureReason, setSelectedFailureReason] = useState('UPI_TIMEOUT')
  const [isSimulatingOutcome, setIsSimulatingOutcome] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [executionMode, setExecutionMode] = useState<'LIVE' | 'SANDBOX'>('LIVE')

  // 1. Fetch payment configuration & load Razorpay checkout.js SDK
  useEffect(() => {
    let mounted = true

    api.getPaymentConfig()
      .then((conf) => {
        if (mounted) setConfig(conf)
      })
      .catch((err) => {
        console.warn('Could not fetch payment config:', err)
      })

    if (window.Razorpay) {
      setSdkReady(true)
      return
    }

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

  // 2. Initialize Checkout Session for cart funnel tracking
  useEffect(() => {
    let cancelled = false
    api.createCheckoutSession({
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      cart_amount: selectedProduct.price,
      selected_method: selectedMethod,
      is_demo_simulation: true
    })
      .then((sess) => {
        if (!cancelled && sess?.id) {
          setActiveSessionId(sess.id)
        }
      })
      .catch((err) => {
        console.warn('Could not initialize checkout session tracking:', err)
      })

    return () => {
      cancelled = true
    }
  }, [customerName, customerEmail, customerPhone, selectedProduct.id])

  // 3. Dynamic QR Timer Countdown
  useEffect(() => {
    if (selectedMethod !== 'UPI' || upiMode !== 'QR') return
    const interval = setInterval(() => {
      setQrCountdown((prev) => (prev > 1 ? prev - 1 : 300))
    }, 1000)
    return () => clearInterval(interval)
  }, [selectedMethod, upiMode])

  // 4. Auto-configure recovery product and rail when navigating from email link
  useEffect(() => {
    if (amountParam) {
      const parsedAmt = parseFloat(amountParam)
      if (!isNaN(parsedAmt) && parsedAmt > 0) {
        const found = PRODUCTS.find((p) => Math.abs(p.price - parsedAmt) < 1)
        if (found) {
          setSelectedProduct(found)
        } else {
          setSelectedProduct({
            id: 'recovery_item',
            name: 'Recovered Order Item',
            category: 'Order Recovery',
            price: parsedAmt,
            badge: '1-Click Recovery',
            description: `Direct payment recovery for Order #${orderIdParam || 'Pending'}.`,
            features: [
              'Direct Razorpay Test Gateway',
              'HMAC-SHA256 signature verification',
              'Autonomous Revenue Recovery ledger update'
            ]
          })
        }
      }
    }
    if (methodParam) {
      if (['UPI', 'Card', 'NetBanking', 'Wallet'].includes(methodParam)) {
        setSelectedMethod(methodParam as any)
      }
    }
  }, [amountParam, methodParam, orderIdParam])

  // 5. Auto-launch Razorpay Checkout Modal when in recovery mode
  useEffect(() => {
    if (!sdkReady || autoOpenAttemptedRef.current || checkoutResult || isLoading) return
    if (isRecoveryMode && (autoOpenParam === 'true' || autoOpenParam === null)) {
      autoOpenAttemptedRef.current = true
      const timer = setTimeout(() => {
        handleLaunchRazorpayGateway()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [sdkReady, isRecoveryMode, autoOpenParam, checkoutResult, isLoading])

  // Quick 1-Click Sandbox Recovery Authorization
  const handleDirectQuickRecoverySuccess = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const instrumentDetails = getInstrumentDetails()
      const orderData = await api.createPaymentOrder({
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        amount: selectedProduct.price,
        currency: 'INR',
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        method: selectedMethod,
        payment_instrument_details: instrumentDetails,
        session_id: activeSessionId || undefined
      })

      const simRes = await api.simulatePayment({
        transaction_id: orderData.transaction_id,
        order_id: orderData.order_id,
        action: 'SUCCESS',
        method: selectedMethod,
        payment_instrument_details: instrumentDetails
      })

      if (activeSessionId) {
        api.transitionCheckoutSession(activeSessionId, { new_status: 'COMPLETED' }).catch(() => {})
      }

      setCheckoutResult({
        success: true,
        signature_valid: true,
        transaction_id: simRes.transaction_id,
        razorpay_order_id: simRes.order_id,
        razorpay_payment_id: simRes.payment_id,
        amount: simRes.amount,
        method: selectedMethod,
        status: 'SUCCESS',
        verified_at: new Date().toISOString(),
        message: '1-Click recovery payment successfully authorized and verified in Razorpay sandbox.'
      })
    } catch (err: any) {
      setErrorMsg(err.message || 'Quick recovery failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectPersona = (name: string, email: string, phone: string) => {
    setCustomerName(name)
    setCustomerEmail(email)
    setCustomerPhone(phone)
    setCardHolder(name)
  }

  const handleSelectPaymentMethod = (method: 'UPI' | 'Card' | 'NetBanking' | 'Wallet') => {
    setSelectedMethod(method)
    setErrorMsg(null)
    const availableReasons = METHOD_FAILURE_REASONS[method] || FAILURE_REASONS
    setSelectedFailureReason(availableReasons[0].code)

    if (activeSessionId) {
      api.transitionCheckoutSession(activeSessionId, {
        new_status: 'PAYMENT_METHOD_VIEWED',
        selected_method: method
      }).catch(() => {})
    }
  }

  // Build structured instrument details for server record & verification
  const getInstrumentDetails = () => {
    switch (selectedMethod) {
      case 'UPI':
        return {
          mode: upiMode,
          vpa: upiMode === 'VPA' ? upiVpa.trim() : `${upiSelectedApp.toLowerCase()}@upi`,
          app: upiMode === 'APPS' ? upiSelectedApp : undefined
        }
      case 'Card':
        return {
          brand: getCardBrand(cardNumber),
          last4: cardNumber.replace(/\s/g, '').slice(-4) || '1111',
          expiry: cardExpiry,
          cardholder: cardHolder || customerName
        }
      case 'NetBanking': {
        const b = ALL_BANKS.find((item) => item.code === selectedBank)
        return {
          bank_code: selectedBank,
          bank_name: b?.name || selectedBank,
          account_type: accountType
        }
      }
      case 'Wallet': {
        const w =
          walletCategory === 'WALLET'
            ? WALLET_PROVIDERS.find((p) => p.id === selectedWallet)
            : BNPL_PROVIDERS.find((p) => p.id === selectedWallet)
        return {
          wallet_category: walletCategory,
          wallet_id: selectedWallet,
          provider_name: w?.name || selectedWallet
        }
      }
    }
  }

  // Validate instrument input fields
  const validateSelectedInstrument = (): string | null => {
    if (selectedMethod === 'UPI') {
      if (upiMode === 'VPA') {
        const cleanVpa = upiVpa.trim()
        if (!cleanVpa || !cleanVpa.includes('@')) {
          return 'Please enter a valid UPI ID (e.g. aditya@okhdfcbank or success@razorpay).'
        }
      }
    } else if (selectedMethod === 'Card') {
      const cleanNum = cardNumber.replace(/\s/g, '')
      if (cleanNum.length !== 16) {
        return 'Please enter a valid 16-digit credit or debit card number.'
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        return 'Please enter a valid card expiry date in MM/YY format.'
      }
      const [m] = cardExpiry.split('/').map(Number)
      if (m < 1 || m > 12) {
        return 'Card expiry month must be between 01 and 12.'
      }
      if (cardCvv.length < 3) {
        return 'Please enter a valid 3 or 4 digit CVV security code.'
      }
    } else if (selectedMethod === 'NetBanking') {
      if (!selectedBank) {
        return 'Please select your online banking financial institution.'
      }
    } else if (selectedMethod === 'Wallet') {
      if (!selectedWallet) {
        return 'Please select a digital wallet or PayLater provider.'
      }
    }
    return null
  }

  // Main Direct Rail Payment Execution (In-App Sandbox Authorization)
  const handleLaunchCheckout = async () => {
    const valErr = validateSelectedInstrument()
    if (valErr) {
      setErrorMsg(valErr)
      return
    }

    setIsLoading(true)
    setErrorMsg(null)
    setCheckoutResult(null)
    setFailureResult(null)

    try {
      if (activeSessionId) {
        api.transitionCheckoutSession(activeSessionId, {
          new_status: 'PAYMENT_INITIATED',
          selected_method: selectedMethod,
          payment_attempted: true
        }).catch(() => {})
      }

      const instrumentDetails = getInstrumentDetails()

      const orderData: CreateOrderResponse = await api.createPaymentOrder({
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        amount: selectedProduct.price,
        currency: 'INR',
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        method: selectedMethod,
        payment_instrument_details: instrumentDetails,
        session_id: activeSessionId || undefined
      })

      if (orderData.session_id) {
        setActiveSessionId(orderData.session_id)
      }

      setSimModalData({
        orderId: orderData.order_id,
        transactionId: orderData.transaction_id,
        amount: orderData.amount_in_rupees,
        currency: orderData.currency,
        productName: selectedProduct.name,
        method: selectedMethod
      })
      setShowSimModal(true)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initiate checkout session')
    } finally {
      setIsLoading(false)
    }
  }

  // Secondary Option: Open Razorpay Gateway Popup
  const handleLaunchRazorpayGateway = async () => {
    const valErr = validateSelectedInstrument()
    if (valErr) {
      setErrorMsg(valErr)
      return
    }

    setIsLoading(true)
    setErrorMsg(null)

    try {
      if (activeSessionId) {
        api.transitionCheckoutSession(activeSessionId, {
          new_status: 'PAYMENT_INITIATED',
          selected_method: selectedMethod,
          payment_attempted: true
        }).catch(() => {})
      }

      const instrumentDetails = getInstrumentDetails()
      const orderData = await api.createPaymentOrder({
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        amount: selectedProduct.price,
        currency: 'INR',
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        method: selectedMethod,
        payment_instrument_details: instrumentDetails,
        session_id: activeSessionId || undefined
      })

      if (window.Razorpay) {
        const options: any = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'RecoverAI Demo Store',
          description: selectedProduct.name,
          order_id: orderData.order_id,
          handler: async (response: any) => {
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
            contact: customerPhone,
            method: selectedMethod.toLowerCase(),
            ...(selectedMethod === 'UPI' && upiMode === 'VPA' ? { vpa: upiVpa.trim() } : {}),
            ...(selectedMethod === 'NetBanking' ? { bank: selectedBank } : {}),
            ...(selectedMethod === 'Wallet' ? { wallet: selectedWallet.toLowerCase() } : {})
          },
          theme: {
            color: '#6C00FF'
          },
          modal: {
            ondismiss: async () => {
              if (activeSessionId) {
                api.transitionCheckoutSession(activeSessionId, { new_status: 'ABANDONED' }).catch(() => {})
              }
              await api.recordPaymentFailure({
                transaction_id: orderData.transaction_id,
                order_id: orderData.order_id,
                error_code: 'CHECKOUT_DISMISSED',
                error_description: 'Customer closed Razorpay checkout modal before completing transaction.',
                error_category: 'ABANDONMENT'
              }).catch(() => {})
              setFailureResult({
                transaction_id: orderData.transaction_id,
                order_id: orderData.order_id,
                error_code: 'CHECKOUT_DISMISSED',
                error_description: 'Checkout modal was dismissed by customer. Escalated to RecoverAI for cart recovery.'
              })
              setIsLoading(false)
            }
          }
        }
        const rzp = new window.Razorpay(options)
        rzp.open()
      } else {
        setSimModalData({
          orderId: orderData.order_id,
          transactionId: orderData.transaction_id,
          amount: orderData.amount_in_rupees,
          currency: orderData.currency,
          productName: selectedProduct.name,
          method: selectedMethod
        })
        setShowSimModal(true)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to open Razorpay gateway')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle in-app Rail Outcome (Success or Failure)
  const handleExecuteSimulatedOutcome = async (action: 'SUCCESS' | 'FAILED') => {
    if (!simModalData) return
    setIsSimulatingOutcome(true)
    setErrorMsg(null)

    const instrumentDetails = getInstrumentDetails()

    try {
      if (action === 'SUCCESS') {
        const res = await api.simulatePayment({
          transaction_id: simModalData.transactionId,
          order_id: simModalData.orderId,
          action: 'SUCCESS',
          method: simModalData.method,
          payment_instrument_details: instrumentDetails
        })
        setShowSimModal(false)
        if (activeSessionId) {
          api.transitionCheckoutSession(activeSessionId, { new_status: 'COMPLETED' }).catch(() => {})
        }
        setCheckoutResult({
          success: true,
          signature_valid: true,
          transaction_id: res.transaction_id,
          razorpay_order_id: res.order_id,
          razorpay_payment_id: res.payment_id,
          amount: res.amount,
          method: res.method || simModalData.method,
          status: 'SUCCESS',
          verified_at: new Date().toISOString(),
          message: `${simModalData.method} test payment authorized and cryptographically verified in sandbox.`
        })
      } else {
        const availableReasons = METHOD_FAILURE_REASONS[simModalData.method] || FAILURE_REASONS
        const reasonObj = availableReasons.find((r) => r.code === selectedFailureReason) || availableReasons[0]

        const res = await api.simulatePayment({
          transaction_id: simModalData.transactionId,
          order_id: simModalData.orderId,
          action: 'FAILED',
          method: simModalData.method,
          payment_instrument_details: instrumentDetails,
          error_code: reasonObj.code,
          error_description: `${reasonObj.label} encountered on ${simModalData.method} rail.`,
          error_category: reasonObj.category
        })
        setShowSimModal(false)
        if (activeSessionId) {
          api.transitionCheckoutSession(activeSessionId, { new_status: 'ABANDONED' }).catch(() => {})
        }
        setFailureResult({
          transaction_id: simModalData.transactionId,
          order_id: simModalData.orderId,
          error_code: reasonObj.code,
          error_description: `${reasonObj.label}. RecoverAI autonomous recovery agent triggered immediately.`,
          recovery_case_id: res.recovery_case_id
        })
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Simulation execution failed')
    } finally {
      setIsSimulatingOutcome(false)
    }
  }

  // Direct Synthetic Failure Injection
  const handleSimulateFailure = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    setCheckoutResult(null)
    setFailureResult(null)

    try {
      const orderData = await api.createPaymentOrder({
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        amount: selectedProduct.price,
        currency: 'INR',
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        method: selectedMethod,
        session_id: activeSessionId || undefined
      })

      const availableReasons = METHOD_FAILURE_REASONS[selectedMethod] || FAILURE_REASONS
      const primaryFail = availableReasons[0]

      const failRes = await api.recordPaymentFailure({
        transaction_id: orderData.transaction_id,
        order_id: orderData.order_id,
        payment_id: `pay_sim_failed_${Math.floor(Math.random() * 89999 + 10000)}`,
        error_code: primaryFail.code,
        error_description: `${primaryFail.label} on ${selectedMethod} rail. Transaction aborted.`,
        error_category: primaryFail.category
      })

      if (activeSessionId) {
        api.transitionCheckoutSession(activeSessionId, { new_status: 'ABANDONED' }).catch(() => {})
      }

      setFailureResult({
        transaction_id: orderData.transaction_id,
        order_id: orderData.order_id,
        error_code: primaryFail.code,
        error_description: `${primaryFail.label}. RecoverAI agent triggered automatically.`,
        recovery_case_id: failRes?.recovery_case_id
      })
    } catch (err: any) {
      setErrorMsg(err.message || 'Simulation failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Smart Rail Switching Fallback Trigger
  const handleSwitchRailAndRetry = (newRail: 'UPI' | 'Card' | 'NetBanking' | 'Wallet') => {
    setFailureResult(null)
    setCheckoutResult(null)
    setErrorMsg(null)
    setSelectedMethod(newRail)
    const availableReasons = METHOD_FAILURE_REASONS[newRail] || FAILURE_REASONS
    setSelectedFailureReason(availableReasons[0].code)

    if (activeSessionId) {
      api.transitionCheckoutSession(activeSessionId, {
        new_status: 'PAYMENT_METHOD_VIEWED',
        selected_method: newRail
      }).catch(() => {})
    }
  }

  const resetStore = () => {
    setCheckoutResult(null)
    setFailureResult(null)
    setErrorMsg(null)
  }

  const cardBrand = getCardBrand(cardNumber)
  const isVpaValid = Boolean(upiVpa && /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiVpa.trim()))
  const filteredBanks = ALL_BANKS.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase()) || b.code.toLowerCase().includes(bankSearch.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <SectionHeader
        title="RecoverAI Demo Store"
        subtitle="Experience multi-rail payment options with dedicated instrument logic, HMAC validation & smart recovery routing"
        actions={
          <div className="flex items-center gap-2.5">
            {activeSessionId && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono bg-slate-100 text-slate-700 border border-border shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Session ID: {activeSessionId.slice(0, 8)}...</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Server Connected</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-primary-light text-primary border border-primary-border shadow-xs">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>Multi-Rail Gateway Active</span>
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
                  Transaction recorded and confirmed server-side via {checkoutResult.method} rail.
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
                <CheckCircle2 className="w-3.5 h-3.5" /> Captured in Sandbox
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
              <span className="text-[11px] text-slate-400">Rail Verified & Settled</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-border space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                Payment Identifier
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

      {/* FAILURE / ESCALATION SCREEN WITH SMART RECOVERY SWITCHER */}
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
                  Failure on {selectedMethod} rail logged. RecoverAI Autonomous Agent has synthesized failure diagnosis & recovery strategy.
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

          {/* RecoverAI Smart Alternate Rail Fallback */}
          <div className="p-5 bg-gradient-to-r from-surface-blue to-purple-50/40 border border-primary/20 rounded-2xl text-xs space-y-3">
            <div className="flex items-center gap-2 text-primary font-bold font-display">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>RecoverAI Smart Alternate Rail Recommendation</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {selectedMethod === 'UPI' &&
                'UPI network switch is experiencing elevated drop-offs. RecoverAI propensity engine recommends switching to Credit/Debit Card or Net Banking for immediate recovery.'}
              {selectedMethod === 'Card' &&
                'Card transaction was declined by the issuer network. RecoverAI suggests switching to UPI Instant (0% drop-off) or Net Banking.'}
              {selectedMethod === 'NetBanking' &&
                'Core banking gateway latency detected. RecoverAI recommends routing payment through UPI Instant or Credit Card.'}
              {selectedMethod === 'Wallet' &&
                'Wallet balance or transaction limit exceeded. RecoverAI suggests switching to UPI Instant or Credit Card.'}
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {selectedMethod !== 'Card' && (
                <button
                  type="button"
                  onClick={() => handleSwitchRailAndRetry('Card')}
                  className="px-4 py-2 bg-primary text-white font-bold rounded-xl text-xs hover:bg-primary-hover transition-all flex items-center gap-2 cursor-pointer shadow-fintech-purple"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Switch to Credit / Debit Card & Retry</span>
                </button>
              )}
              {selectedMethod !== 'UPI' && (
                <button
                  type="button"
                  onClick={() => handleSwitchRailAndRetry('UPI')}
                  className="px-4 py-2 bg-primary text-white font-bold rounded-xl text-xs hover:bg-primary-hover transition-all flex items-center gap-2 cursor-pointer shadow-fintech-purple"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Switch to UPI Instant & Retry</span>
                </button>
              )}
              {selectedMethod !== 'NetBanking' && (
                <button
                  type="button"
                  onClick={() => handleSwitchRailAndRetry('NetBanking')}
                  className="px-4 py-2 bg-surface text-navy font-bold rounded-xl text-xs hover:bg-slate-100 transition-colors border border-border flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span>Switch to Net Banking</span>
                </button>
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

      {/* 1-CLICK DEDICATED RECOVERY VIEW */}
      {isRecoveryMode && !showFullCatalog && !checkoutResult && !failureResult && (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
          {/* Recovery Banner */}
          <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white shadow-xl border border-indigo-700/50">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Verified 1-Click Recovery Link</span>
                  {recoveryCaseParam && (
                    <span className="font-mono text-[10px] text-indigo-200">
                      Case: {recoveryCaseParam.slice(0, 12)}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold font-display text-white">
                  Complete Your Payment
                </h2>
                <p className="text-sm text-indigo-200/90 mt-1 max-w-xl">
                  {recommendationParam === 'upi_switch' || selectedMethod === 'UPI'
                    ? 'Issuing bank network switch is clear. RecoverAI has synthesized a 1-click test checkout rail for your order.'
                    : 'Your cart recovery link is active and cryptographically verified. Complete transaction seamlessly.'}
                </p>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 text-right">
                <span className="text-xs text-indigo-300">Total Payable</span>
                <span className="text-3xl font-extrabold text-white font-display">
                  ₹{selectedProduct.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-emerald-400 font-medium">Razorpay Test Gateway</span>
              </div>
            </div>
          </div>

          {/* Recovery Order Summary Card */}
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-fintech-card space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center text-primary border border-primary-border shadow-xs">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-navy text-base font-display">
                    {selectedProduct.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedProduct.description}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {selectedProduct.badge || '1-Click Recovery'}
              </span>
            </div>

            {/* Customer & Transaction Reference Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50/80 border border-border/80 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5 font-medium">Customer</span>
                <span className="font-semibold text-navy block">{customerName}</span>
                <span className="text-slate-500 text-[11px] block">{customerEmail}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5 font-medium">Order Reference</span>
                <span className="font-mono text-navy font-semibold block truncate">
                  {orderIdParam || 'Generated upon checkout'}
                </span>
                <span className="text-slate-500 text-[11px] block">Razorpay Test Rail</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5 font-medium">Recommended Rail</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {selectedMethod} Direct Instant
                </span>
                <span className="text-slate-500 text-[11px] block">0% Drop Probability</span>
              </div>
            </div>

            {/* Quick Payment Rail Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Choose Payment Method for Recovery:
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'UPI', label: 'UPI Instant', icon: Smartphone, desc: 'GPay, PhonePe, QR' },
                  { id: 'Card', label: 'Card (3DS)', icon: CreditCard, desc: 'Visa, Master, RuPay' },
                  { id: 'NetBanking', label: 'Net Banking', icon: Building2, desc: 'HDFC, SBI, ICICI' }
                ].map((rail) => {
                  const Icon = rail.icon
                  const active = selectedMethod === rail.id
                  return (
                    <button
                      key={rail.id}
                      type="button"
                      onClick={() => setSelectedMethod(rail.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        active
                          ? 'border-primary bg-primary/5 shadow-xs text-navy'
                          : 'border-border bg-surface hover:bg-slate-50/60 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-slate-400'}`} />
                        {active && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <div className="font-semibold text-xs text-navy">{rail.label}</div>
                      <div className="text-[10px] text-slate-400">{rail.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Error Message Notice if any */}
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleLaunchRazorpayGateway}
                disabled={isLoading}
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-primary-hover text-white font-bold text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Launching Razorpay Test Gateway...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 text-amber-300" />
                    <span>Complete Payment Now (₹{selectedProduct.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDirectQuickRecoverySuccess}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Instant 1-Click Test Authorization (Fast-Track Sandbox)</span>
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 px-1">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Razorpay Verified Test Mode Gateway
                </span>
                <button
                  type="button"
                  onClick={() => setShowFullCatalog(true)}
                  className="text-primary hover:underline font-medium cursor-pointer"
                >
                  Browse full demo store catalog →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CHECKOUT FORM & PRODUCT SELECTOR */}
      {(!isRecoveryMode || showFullCatalog) && !checkoutResult && !failureResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recovery return chip if browsing catalog while in recovery mode */}
          {isRecoveryMode && showFullCatalog && (
            <div className="lg:col-span-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Recovery order active for <strong>Order #{orderIdParam}</strong> (₹{selectedProduct.price.toLocaleString('en-IN')}).</span>
              </span>
              <button
                type="button"
                onClick={() => setShowFullCatalog(false)}
                className="text-primary font-bold hover:underline cursor-pointer"
              >
                ← Return to 1-Click Recovery View
              </button>
            </div>
          )}
          {/* Left Column: Product Selection, Customer Info & Payment Options */}
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
                      className={`cursor-pointer rounded-2xl p-4 border transition-all relative flex flex-col justify-between ${
                        isSelected
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
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              isSelected
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
                  <button
                    type="button"
                    onClick={() => handleSelectPersona('Kawin Dharma', 'kawindharma@gmail.com', '+91 98450 99999')}
                    className="px-2.5 py-1 bg-moss-green-light hover:bg-moss-green/20 text-[10px] font-bold text-moss-green-dark rounded-full border border-moss-green/30 transition-colors cursor-pointer"
                  >
                    Kawin (Verified Test)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Customer Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value)
                      setCardHolder(e.target.value)
                    }}
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

            {/* Step 3: Select Payment Option & Rail */}
            <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border/70">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-bold text-navy font-display">
                    3. Select Payment Option & Rail
                  </h3>
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Interactive Rails Active
                </span>
              </div>

              {/* 4 Main Payment Option Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {PAYMENT_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = selectedMethod === opt.id
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => handleSelectPaymentMethod(opt.id)}
                      className={`text-left p-4 rounded-2xl border transition-all relative flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-surface-blue/60 ring-2 ring-primary/25 shadow-fintech-card'
                          : 'border-border/80 bg-surface hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-primary text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-navy font-display">
                              {opt.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {opt.subtitle}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                            isSelected
                              ? 'bg-primary text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                        {opt.description}
                      </p>
                      {isSelected && (
                        <div className="mt-2.5 pt-2 border-t border-primary/20 flex items-center gap-1.5 text-[10px] text-primary font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active Selected Rail</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* DEDICATED PAYMENT OPTION CONFIGURATION PANELS */}

              {/* A. UPI Instant Panel */}
              {selectedMethod === 'UPI' && (
                <div className="p-5 bg-surface-blue/40 border border-primary/20 rounded-2xl space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-primary/15">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-navy font-display">
                        UPI Payment Method Configuration
                      </span>
                    </div>
                    {/* Sub-mode selector */}
                    <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border text-xs">
                      <button
                        type="button"
                        onClick={() => setUpiMode('VPA')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          upiMode === 'VPA'
                            ? 'bg-primary text-white shadow-2xs'
                            : 'text-slate-600 hover:text-navy'
                        }`}
                      >
                        UPI ID / VPA
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpiMode('QR')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                          upiMode === 'QR'
                            ? 'bg-primary text-white shadow-2xs'
                            : 'text-slate-600 hover:text-navy'
                        }`}
                      >
                        <QrCode className="w-3 h-3" />
                        <span>Dynamic QR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpiMode('APPS')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          upiMode === 'APPS'
                            ? 'bg-primary text-white shadow-2xs'
                            : 'text-slate-600 hover:text-navy'
                        }`}
                      >
                        UPI Apps
                      </button>
                    </div>
                  </div>

                  {/* Mode 1: UPI ID / VPA */}
                  {upiMode === 'VPA' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Virtual Payment Address (VPA / UPI ID)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={upiVpa}
                            onChange={(e) => setUpiVpa(e.target.value)}
                            placeholder="username@okhdfcbank"
                            className="w-full px-3.5 py-2.5 bg-surface text-navy font-mono text-xs border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs pr-24"
                          />
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {isVpaValid ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                Valid
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium">
                                e.g. @upi
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick preset chips */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Test Handles:
                        </span>
                        <button
                          type="button"
                          onClick={() => setUpiVpa('aditya@okhdfcbank')}
                          className="px-2.5 py-1 bg-surface hover:bg-slate-50 text-navy font-mono text-[11px] rounded-lg border border-border shadow-2xs transition-colors cursor-pointer"
                        >
                          aditya@okhdfcbank
                        </button>
                        <button
                          type="button"
                          onClick={() => setUpiVpa('success@razorpay')}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-mono text-[11px] font-semibold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                        >
                          success@razorpay (Success)
                        </button>
                        <button
                          type="button"
                          onClick={() => setUpiVpa('failure@razorpay')}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 font-mono text-[11px] font-semibold rounded-lg border border-rose-200 transition-colors cursor-pointer"
                        >
                          failure@razorpay (Timeout)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mode 2: Dynamic UPI QR Code */}
                  {upiMode === 'QR' && (
                    <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-surface rounded-2xl border border-border">
                      {/* Styled QR Code Box */}
                      <div className="relative p-3 bg-white rounded-2xl border-2 border-slate-900 shadow-md flex flex-col items-center justify-center shrink-0">
                        <svg className="w-32 h-32 text-slate-900" viewBox="0 0 100 100" fill="currentColor">
                          <rect x="5" y="5" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="5" />
                          <rect x="11" y="11" width="14" height="14" fill="currentColor" />
                          <rect x="69" y="5" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="5" />
                          <rect x="75" y="11" width="14" height="14" fill="currentColor" />
                          <rect x="5" y="69" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="5" />
                          <rect x="11" y="75" width="14" height="14" fill="currentColor" />
                          <rect x="37" y="10" width="6" height="6" />
                          <rect x="47" y="15" width="6" height="6" />
                          <rect x="57" y="10" width="6" height="6" />
                          <rect x="10" y="37" width="6" height="6" />
                          <rect x="25" y="45" width="6" height="6" />
                          <rect x="37" y="37" width="26" height="26" rx="4" fill="#6C00FF" />
                          <circle cx="50" cy="50" r="8" fill="white" />
                          <rect x="69" y="37" width="6" height="6" />
                          <rect x="85" y="47" width="6" height="6" />
                          <rect x="37" y="69" width="6" height="6" />
                          <rect x="47" y="79" width="6" height="6" />
                          <rect x="57" y="85" width="6" height="6" />
                          <rect x="69" y="69" width="6" height="6" />
                          <rect x="85" y="75" width="6" height="6" />
                          <rect x="75" y="85" width="6" height="6" />
                        </svg>
                        <span className="text-[9px] font-mono font-bold text-slate-600 mt-1 uppercase">
                          NPCI / UPI 2.0
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold font-mono">
                            ₹{selectedProduct.price.toLocaleString('en-IN')}
                          </span>
                          <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            Expires in {Math.floor(qrCountdown / 60)}:{(qrCountdown % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          Scan using Google Pay, PhonePe, Paytm, BHIM, or any banking UPI app. Instant payment notification enabled.
                        </p>
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleLaunchCheckout}
                            className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white text-[11px] font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Simulate QR Scan & Pay</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode 3: UPI Apps Intent */}
                  {upiMode === 'APPS' && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {UPI_APPS.map((app) => {
                        const isAppSelected = upiSelectedApp === app.id
                        return (
                          <button
                            type="button"
                            key={app.id}
                            onClick={() => setUpiSelectedApp(app.id)}
                            className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                              isAppSelected
                                ? 'border-primary bg-surface ring-2 ring-primary/25 shadow-fintech-card'
                                : 'border-border bg-surface hover:bg-slate-50'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${app.iconColor}`}>
                              {app.id.slice(0, 2)}
                            </div>
                            <span className="text-[11px] font-bold text-navy">{app.name}</span>
                            <span className="text-[9px] text-slate-400">1-Tap Intent</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* B. Credit / Debit Card Panel */}
              {selectedMethod === 'Card' && (
                <div className="p-5 bg-surface-blue/40 border border-primary/20 rounded-2xl space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-primary/15">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-navy font-display">
                        Card Instrument Configuration & 3DS
                      </span>
                    </div>
                    {/* Quick test card buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Test Cards:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCardNumber('4111 1111 1111 1111')
                          setCardExpiry('12/28')
                          setCardCvv('123')
                        }}
                        className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-semibold border border-emerald-200 transition-colors cursor-pointer"
                      >
                        Visa (Success)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCardNumber('6073 1111 2222 3333')
                          setCardExpiry('09/29')
                          setCardCvv('456')
                        }}
                        className="px-2 py-0.5 rounded-lg bg-surface hover:bg-slate-100 text-navy text-[10px] font-semibold border border-border transition-colors cursor-pointer"
                      >
                        RuPay
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCardNumber('4000 0000 0000 0002')
                          setCardExpiry('05/26')
                          setCardCvv('000')
                        }}
                        className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-[10px] font-semibold border border-rose-200 transition-colors cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Card Number */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Card Number
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={cardNumber}
                          maxLength={19}
                          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                          placeholder="4111 1111 1111 1111"
                          className="w-full px-3.5 py-2.5 bg-surface text-navy font-mono text-xs border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs pr-20"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono ${
                              cardBrand === 'visa'
                                ? 'bg-blue-100 text-blue-800'
                                : cardBrand === 'mastercard'
                                ? 'bg-orange-100 text-orange-800'
                                : cardBrand === 'rupay'
                                ? 'bg-emerald-100 text-emerald-800'
                                : cardBrand === 'amex'
                                ? 'bg-cyan-100 text-cyan-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {cardBrand}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Cardholder Name
                        </label>
                        <input
                          type="text"
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                          placeholder="Name as on card"
                          className="w-full px-3.5 py-2.5 bg-surface text-navy text-xs border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs font-medium"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          Expiry Date (MM/YY)
                        </label>
                        <input
                          type="text"
                          value={cardExpiry}
                          maxLength={5}
                          onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                          placeholder="MM/YY"
                          className="w-full px-3.5 py-2.5 bg-surface text-navy font-mono text-xs border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                          CVV / CVC
                        </label>
                        <div className="relative">
                          <input
                            type={showCvv ? 'text' : 'password'}
                            value={cardCvv}
                            maxLength={4}
                            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                            placeholder="•••"
                            className="w-full px-3.5 py-2.5 bg-surface text-navy font-mono text-xs border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs pr-9"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCvv(!showCvv)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showCvv ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveCard}
                          onChange={(e) => setSaveCard(e.target.checked)}
                          className="rounded text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                        />
                        <span className="text-[11px] text-slate-600">
                          Save card securely for future purchases (RBI Tokenized)
                        </span>
                      </label>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        256-Bit SSL Encrypted
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* C. Net Banking Panel */}
              {selectedMethod === 'NetBanking' && (
                <div className="p-5 bg-surface-blue/40 border border-primary/20 rounded-2xl space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-primary/15">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-navy font-display">
                        Select Financial Institution
                      </span>
                    </div>
                    {/* Account Type Toggle */}
                    <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border text-xs">
                      <button
                        type="button"
                        onClick={() => setAccountType('RETAIL')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          accountType === 'RETAIL'
                            ? 'bg-primary text-white shadow-2xs'
                            : 'text-slate-600 hover:text-navy'
                        }`}
                      >
                        Retail Banking
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountType('CORPORATE')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          accountType === 'CORPORATE'
                            ? 'bg-primary text-white shadow-2xs'
                            : 'text-slate-600 hover:text-navy'
                        }`}
                      >
                        Corporate Banking
                      </button>
                    </div>
                  </div>

                  {/* Top 6 Indian Banks Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {POPULAR_BANKS.map((bank) => {
                      const isBankSelected = selectedBank === bank.code
                      return (
                        <button
                          type="button"
                          key={bank.code}
                          onClick={() => setSelectedBank(bank.code)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                            isBankSelected
                              ? 'border-primary bg-surface ring-2 ring-primary/25 shadow-fintech-card'
                              : 'border-border bg-surface hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] font-mono shrink-0 ${bank.badgeColor}`}>
                            {bank.code}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-navy truncate font-display">
                              {bank.name}
                            </div>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Fast Gateway
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Searchable 50+ Scheduled Banks Dropdown */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      Or Select from All 50+ Scheduled Banks:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                          placeholder="Search bank name (e.g. Canara, Baroda)..."
                          className="w-full pl-8 pr-3 py-2 bg-surface text-navy text-xs border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs"
                        />
                      </div>
                      <select
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                        className="w-full px-3 py-2 bg-surface text-navy text-xs border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs font-medium"
                      >
                        {filteredBanks.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* D. Wallets & PayLater Panel */}
              {selectedMethod === 'Wallet' && (
                <div className="p-5 bg-surface-blue/40 border border-primary/20 rounded-2xl space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-primary/15">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-navy font-display">
                        Digital Wallet & PayLater Line
                      </span>
                    </div>
                    {/* Category Selector */}
                    <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setWalletCategory('WALLET')
                          setSelectedWallet('PAYTM')
                        }}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          walletCategory === 'WALLET'
                            ? 'bg-primary text-white shadow-2xs'
                            : 'text-slate-600 hover:text-navy'
                        }`}
                      >
                        Pre-Paid Wallets
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWalletCategory('BNPL')
                          setSelectedWallet('SIMPL')
                        }}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          walletCategory === 'BNPL'
                            ? 'bg-primary text-white shadow-2xs'
                            : 'text-slate-600 hover:text-navy'
                        }`}
                      >
                        PayLater / BNPL
                      </button>
                    </div>
                  </div>

                  {/* Provider List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {walletCategory === 'WALLET'
                      ? WALLET_PROVIDERS.map((w) => {
                          const isWSelected = selectedWallet === w.id
                          return (
                            <button
                              type="button"
                              key={w.id}
                              onClick={() => setSelectedWallet(w.id)}
                              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                isWSelected
                                  ? 'border-primary bg-surface ring-2 ring-primary/25 shadow-fintech-card'
                                  : 'border-border bg-surface hover:bg-slate-50'
                              }`}
                            >
                              <div>
                                <div className="text-xs font-bold text-navy font-display">{w.name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{w.subtitle}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-mono font-bold text-emerald-600">
                                  ₹{w.balance.toLocaleString('en-IN')}
                                </div>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold uppercase">
                                  {w.badge}
                                </span>
                              </div>
                            </button>
                          )
                        })
                      : BNPL_PROVIDERS.map((b) => {
                          const isBSelected = selectedWallet === b.id
                          return (
                            <button
                              type="button"
                              key={b.id}
                              onClick={() => setSelectedWallet(b.id)}
                              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                isBSelected
                                  ? 'border-primary bg-surface ring-2 ring-primary/25 shadow-fintech-card'
                                  : 'border-border bg-surface hover:bg-slate-50'
                              }`}
                            >
                              <div>
                                <div className="text-xs font-bold text-navy font-display">{b.name}</div>
                                <div className="text-[10px] text-slate-500 font-sans">{b.subtitle}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-mono font-bold text-primary">
                                  ₹{b.creditLimit.toLocaleString('en-IN')}
                                </div>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary-light text-primary font-bold uppercase">
                                  {b.badge}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1 text-slate-600 font-medium">
                      <UserCheck className="w-3.5 h-3.5 text-primary" />
                      Linked Mobile: <code className="font-mono text-navy font-bold">{customerPhone}</code>
                    </span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 1-Tap Auth Ready
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Razorpay Test Mode Helper Accordion */}
            <div className="bg-surface rounded-2xl border border-border/80 p-5 shadow-fintech-card space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowHelper(!showHelper)}
              >
                <div className="flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-navy font-display">
                    Razorpay Test Sandbox Credentials & Guidelines
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
                          <strong>Card:</strong> <code className="font-mono bg-white px-2 py-0.5 rounded-full border border-slate-200 text-primary font-bold">4111 1111 1111 1111</code> (any future MM/YY, CVV 123).
                        </li>
                        <li>
                          <strong>UPI:</strong> Enter <code className="font-mono bg-white px-2 py-0.5 rounded-full border border-slate-200 text-primary font-bold">success@razorpay</code> or authorize via modal.
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
                          <strong>Rail Failure:</strong> Select trigger decline in the modal to test RecoverAI ERV agent.
                        </li>
                        <li>
                          <strong>Dismiss:</strong> Close checkout modal to test cart recovery triggers.
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
                  <span>Active Rail</span>
                  <span className="font-bold text-primary font-mono">{selectedMethod}</span>
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
                    <span className="text-[10px] text-slate-400 font-mono">INR (Test Sandbox)</span>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              {/* Gateway Execution Mode Selector */}
              <div className="bg-slate-100/90 p-1 rounded-xl border border-border/80 flex items-center gap-1 text-[11px] font-semibold mb-3">
                <button
                  type="button"
                  onClick={() => setExecutionMode('LIVE')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    executionMode === 'LIVE'
                      ? 'bg-primary text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-navy hover:bg-white/80'
                  }`}
                  title="Connect directly with live Razorpay Gateway server"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Live Server Gateway</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExecutionMode('SANDBOX')}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    executionMode === 'SANDBOX'
                      ? 'bg-primary text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-navy hover:bg-white/80'
                  }`}
                  title="Run in-app direct rail authorization simulation"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Sandbox Simulation</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-1">
                {executionMode === 'LIVE' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleLaunchRazorpayGateway}
                      disabled={isLoading || !sdkReady}
                      className="w-full py-3.5 px-5 bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
                      title="Connects with live Razorpay server and opens live payment frame"
                    >
                      <Zap className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
                      {isLoading
                        ? 'Connecting Live Server...'
                        : !sdkReady
                        ? 'Connecting Gateway...'
                        : `Pay ₹${selectedProduct.price.toLocaleString('en-IN')} via Live Razorpay Server`}
                    </button>

                    <button
                      type="button"
                      onClick={handleLaunchCheckout}
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 bg-surface hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-border flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                      title="Open in-app Direct Rail Simulation modal"
                    >
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      <span>Open In-App Sandbox Simulation</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleLaunchCheckout}
                      disabled={isLoading || !sdkReady}
                      className="w-full py-3.5 px-5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      title="Simulates 3DS OTP or MPIN approval in-app"
                    >
                      <Lock className="w-4 h-4" />
                      {isLoading
                        ? 'Preparing Sandbox Order...'
                        : `Pay ₹${selectedProduct.price.toLocaleString('en-IN')} with ${selectedMethod} (Sandbox)`}
                    </button>

                    <button
                      type="button"
                      onClick={handleLaunchRazorpayGateway}
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 bg-surface hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-border flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                      title="Connect directly with live Razorpay Gateway server"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      <span>Connect with Live Razorpay Server</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleSimulateFailure}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl text-xs font-bold transition-colors border border-rose-200 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  title="Directly trigger RecoverAI agent failure handling"
                >
                  <Cpu className="w-3.5 h-3.5 text-rose-600" />
                  <span>Simulate {selectedMethod} Gateway Failure</span>
                </button>
              </div>

              <div className="pt-3.5 border-t border-border/70 text-[10px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cryptographically Verified & Logged</span>
                </div>
                <p className="leading-snug">
                  Payments are verified server-side before persisting. Failure cases automatically trigger RecoverAI&rsquo;s ERV recovery workflow.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIRECT RAIL AUTHORIZATION & SANDBOX OUTCOME MODAL */}
      {showSimModal && simModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl border border-border/80 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-surface to-slate-50 border-b border-border/70 flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white font-mono uppercase tracking-wider">
                    {simModalData.method} Rail
                  </span>
                  <span className="text-xs text-slate-400 font-mono font-medium">
                    Test Mode Gateway Simulation
                  </span>
                </div>
                <h3 className="text-lg font-bold text-navy font-display">
                  Authorize or Decline Transaction
                </h3>
                <p className="text-xs text-slate-500">
                  {simModalData.method === 'UPI' && 'Simulate customer MPIN authorization or PSP switch timeout.'}
                  {simModalData.method === 'Card' && 'Simulate 3DS OTP verification or issuer decline.'}
                  {simModalData.method === 'NetBanking' && 'Simulate Core Banking System login authentication.'}
                  {simModalData.method === 'Wallet' && 'Simulate pre-paid wallet balance debit or limits.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Order Meta Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-border/70 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Product:</span>
                  <span className="font-bold text-navy">{simModalData.productName}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Selected Rail:</span>
                  <span className="font-bold text-primary font-mono">{simModalData.method}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Amount:</span>
                  <span className="font-bold text-navy font-mono text-sm">
                    ₹{simModalData.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 text-[11px] pt-1 border-t border-border/50 font-mono">
                  <span>Order ID:</span>
                  <span className="text-slate-500">{simModalData.orderId}</span>
                </div>
              </div>

              {/* Action 1: Authorize Success */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Option A: Authorize Payment (Simulate Success)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Mocks successful customer authorization ({simModalData.method === 'UPI' ? 'MPIN' : simModalData.method === 'Card' ? '3DS OTP' : 'Gateway Auth'}). Validates cryptographic signature and marks order as paid.
                </p>
                <button
                  type="button"
                  onClick={() => handleExecuteSimulatedOutcome('SUCCESS')}
                  disabled={isSimulatingOutcome}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSimulatingOutcome ? 'Processing...' : `Authorize ₹${simModalData.amount.toLocaleString('en-IN')} via ${simModalData.method}`}</span>
                </button>
              </div>

              {/* Action 2: Trigger Failure */}
              <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Option B: Trigger Rail Gateway Failure & Handoff</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Simulates declines, network timeouts, or drop-offs. Immediately escalates to RecoverAI Autonomous Agent.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 block">
                    Select Test Failure Reason:
                  </label>
                  <select
                    value={selectedFailureReason}
                    onChange={(e) => setSelectedFailureReason(e.target.value)}
                    className="w-full px-3 py-2 bg-surface text-navy border border-rose-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-400 focus:border-rose-400 shadow-2xs"
                  >
                    {(METHOD_FAILURE_REASONS[simModalData.method] || FAILURE_REASONS).map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleExecuteSimulatedOutcome('FAILED')}
                  disabled={isSimulatingOutcome}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{isSimulatingOutcome ? 'Simulating...' : 'Trigger Gateway Rail Failure (Simulate Error)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DemoCheckout
