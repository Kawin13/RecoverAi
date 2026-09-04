/**
 * RecoverAI Frontend Environment Configuration
 * Centralizes environment variables, validates required production keys,
 * and eliminates silent localhost or hardcoded production fallbacks.
 */

const isProd = import.meta.env.PROD
const isDev = import.meta.env.DEV

// 1. API Base URL (Strictly standardized on VITE_API_BASE_URL)
const rawApiUrl = (import.meta.env.VITE_API_BASE_URL || '').trim()
const apiBaseUrl = rawApiUrl || (isDev ? 'http://localhost:8000' : '')

// 2. Supabase Credentials
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()

// 3. Razorpay Key ID (Test Mode required)
const razorpayKeyId = (import.meta.env.VITE_RAZORPAY_KEY_ID || '').trim()

// Configuration Error Collection
const errors: string[] = []

if (isProd) {
  if (!rawApiUrl) {
    errors.push(
      'Missing required environment variable: VITE_API_BASE_URL. In production, API requests cannot fall back to localhost or current-host.'
    )
  }
  if (!supabaseUrl) {
    errors.push(
      'Missing required environment variable: VITE_SUPABASE_URL. Please set your project URL in Vercel/Production settings.'
    )
  }
  if (!supabasePublishableKey) {
    errors.push(
      'Missing required environment variable: VITE_SUPABASE_PUBLISHABLE_KEY. Please set your publishable/anon key in Vercel/Production settings.'
    )
  }
}

if (razorpayKeyId && !razorpayKeyId.startsWith('rzp_test_')) {
  errors.push(
    `Invalid VITE_RAZORPAY_KEY_ID: '${razorpayKeyId}'. Only Razorpay Test Mode keys (starting with 'rzp_test_') are permitted for this deployment.`
  )
}

// 4. Explicit Demo Mode (Never enabled silently in production)
const rawDemoMode = (import.meta.env.VITE_DEMO_MODE || import.meta.env.DEMO_MODE || '').trim().toLowerCase()
const isDemoMode = rawDemoMode === 'true'

export const ENV = {
  isProd,
  isDev,
  API_BASE_URL: apiBaseUrl,
  SUPABASE_URL: supabaseUrl,
  SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
  RAZORPAY_KEY_ID: razorpayKeyId,
  isRazorpayConfigured: Boolean(razorpayKeyId && razorpayKeyId.startsWith('rzp_test_')),
  DEMO_MODE: isDemoMode,
  configErrors: errors,
  hasConfigErrors: errors.length > 0
}

export default ENV
