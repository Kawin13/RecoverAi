import { ENV } from '../config/env'
import { API_BASE_URL, authFetch } from './client'

export interface PaymentConfig {
  key_id: string
  is_test_mode: boolean
  is_configured: boolean
  merchant_name: string
}

export interface CreateOrderRequest {
  product_id: string
  product_name: string
  amount: number
  currency?: string
  customer_name: string
  customer_email: string
  customer_phone?: string
  method?: string
  payment_instrument_details?: Record<string, any>
  session_id?: string
  recovery_case_id?: string
  original_order_id?: string
}

export interface CreateOrderResponse {
  order_id: string
  transaction_id: string
  session_id?: string
  amount: number
  amount_in_rupees: number
  currency: string
  key_id: string
  product_name: string
  method?: string
  customer: {
    name: string
    email: string
    phone?: string
  }
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
  transaction_id: string
  recovery_case_id?: string
}

export interface VerifyPaymentResponse {
  success: boolean
  signature_valid: boolean
  transaction_id: string
  razorpay_order_id: string
  razorpay_payment_id: string
  amount: number
  method: string
  status: string
  verified_at: string
  message: string
}

export interface PaymentFailureRequest {
  transaction_id: string
  order_id: string
  payment_id?: string
  error_code?: string
  error_description?: string
  error_category?: string
}

export const paymentApi = {
  async getPaymentConfig(): Promise<PaymentConfig> {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/payments/config`)
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn('API getPaymentConfig failed, returning fallback:', e)
    }
    return {
      key_id: ENV.RAZORPAY_KEY_ID || '',
      is_test_mode: true,
      is_configured: ENV.isRazorpayConfigured,
      merchant_name: 'RecoverAI Demo Store'
    }
  },

  async createPaymentOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
    const res = await authFetch(`${API_BASE_URL}/api/payments/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || err.message || 'Failed to create payment order')
    }
    return await res.json()
  },

  async verifyPayment(data: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || err.message || 'Signature verification failed')
    }
    return await res.json()
  },

  async recordPaymentFailure(data: PaymentFailureRequest): Promise<any> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/payments/fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || err.message || 'Failed to record payment failure')
    }
    return await res.json()
  },

  async simulatePayment(data: {
    transaction_id: string
    order_id: string
    action: 'SUCCESS' | 'FAILED'
    method?: string
    payment_instrument_details?: Record<string, any>
    error_code?: string
    error_description?: string
    error_category?: string
  }): Promise<any> {
    const res = await authFetch(`${API_BASE_URL}/api/v1/payments/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || err.message || 'Simulation failed')
    }
    return await res.json()
  }
}
