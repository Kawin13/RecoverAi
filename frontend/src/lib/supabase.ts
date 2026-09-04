import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ENV } from '../config/env'

const supabaseUrl = ENV.SUPABASE_URL
const supabaseAnonKey = ENV.SUPABASE_PUBLISHABLE_KEY

let clientInstance: SupabaseClient

if (supabaseUrl && supabaseAnonKey) {
  clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  })
} else {
  // Safe unconfigured proxy preventing silent connection to hardcoded external projects
  console.error(
    '[RecoverAI Configuration Error] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Supabase client cannot be initialized.'
  )
  clientInstance = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      if (prop === 'auth') {
        return {
          getSession: async () => ({ data: { session: null }, error: new Error('Supabase credentials are not configured.') }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithPassword: async () => ({ data: {}, error: new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.') }),
          signUp: async () => ({ data: {}, error: new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.') }),
          signOut: async () => ({ error: null }),
          refreshSession: async () => ({ data: { session: null }, error: null }),
          updateUser: async () => ({ error: new Error('Supabase credentials are not configured.') }),
          resetPasswordForEmail: async () => ({ error: new Error('Supabase credentials are not configured.') })
        }
      }
      return () => {
        throw new Error(
          'RecoverAI Configuration Error: Supabase client is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
        )
      }
    }
  })
}

export const supabase = clientInstance
export default supabase
