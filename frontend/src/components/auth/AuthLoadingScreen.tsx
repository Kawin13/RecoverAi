import React from 'react'
import { Shield } from 'lucide-react'

export const AuthLoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 text-navy antialiased font-sans">
      <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-bold font-display shadow-fintech-purple animate-pulse">
          <Shield className="w-6 h-6 text-white" />
        </div>
        
        <div className="space-y-1">
          <h3 className="text-base font-bold font-display text-navy">
            Recover<span className="text-primary">AI</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Verifying workspace credentials...
          </p>
        </div>

        <div className="w-48 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
          <div className="bg-primary h-full rounded-full animate-pulse w-full" />
        </div>

        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
          Secure Session Validation
        </span>
      </div>
    </div>
  )
}

export default AuthLoadingScreen
