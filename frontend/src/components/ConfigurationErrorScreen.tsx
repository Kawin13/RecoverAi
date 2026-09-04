import React from 'react'
import { AlertTriangle, ShieldAlert, Terminal } from 'lucide-react'

interface ConfigurationErrorScreenProps {
  errors: string[]
}

export const ConfigurationErrorScreen: React.FC<ConfigurationErrorScreenProps> = ({ errors }) => {
  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-6 select-none font-sans">
      <div className="max-w-2xl w-full bg-stone-950/80 border border-red-900/40 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        <div className="flex items-center space-x-4 mb-6 pb-6 border-b border-stone-800/80">
          <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-600/40 flex items-center justify-center text-red-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-100 tracking-tight">
              RecoverAI Production Configuration Error
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              Production deployment failed safely. Required environment variables are missing or misconfigured.
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-red-400/90 flex items-center space-x-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>Missing / Invalid Production Settings:</span>
          </div>

          <ul className="space-y-2.5">
            {errors.map((err, idx) => (
              <li
                key={idx}
                className="bg-red-950/20 border border-red-900/30 rounded-lg p-3 text-xs text-red-200 font-mono leading-relaxed"
              >
                {err}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-4 text-xs text-stone-300 space-y-2 mb-6">
          <div className="flex items-center space-x-2 text-stone-200 font-medium">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>How to resolve in Vercel or Production:</span>
          </div>
          <p className="text-stone-400 leading-relaxed">
            Go to your project settings in the Vercel or hosting dashboard, navigate to{' '}
            <strong className="text-stone-200">Environment Variables</strong>, and ensure the following keys are provided:
          </p>
          <div className="bg-black/50 rounded-lg p-3 font-mono text-[11px] text-stone-300 space-y-1 select-text">
            <div>VITE_API_BASE_URL=https://your-backend.onrender.com</div>
            <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
            <div>VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...</div>
            <div>VITE_RAZORPAY_KEY_ID=rzp_test_...</div>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-stone-500 pt-4 border-t border-stone-800/80">
          <span>RecoverAI v1.0.0 • Fail-Safe Protection Active</span>
          <span className="text-stone-400 font-mono">ENVIRONMENT: production</span>
        </div>
      </div>
    </div>
  )
}

export default ConfigurationErrorScreen
