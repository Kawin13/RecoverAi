import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ikgsrrmzxmmbumcdgxgq.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_biwradPEk0HjBOSaHpPXeA_NZ-8Kyhq'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[RecoverAI Supabase] Missing Supabase environment variables. Falling back to default configuration.')
}

/**
 * Singleton Supabase browser client configured for secure client-side
 * authentication and session management in local storage.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})

export default supabase
