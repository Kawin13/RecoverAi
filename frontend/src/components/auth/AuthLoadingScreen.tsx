import React from 'react'
import { Shield } from 'lucide-react'

export const AuthLoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 text-graphite antialiased font-sans">
      <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
        <div className="w-12 h-12 rounded-sm bg-burnt-orange flex items-center justify-center text-white font-bold font-display shadow-fintech-card animate-pulse">
          <Shield className="w-6 h-6 text-white" />
        </div>
        
        <div className="space-y-1">
          <h3 className="text-base font-bold font-display text-graphite">
            Recover<span className="text-burnt-orange">AI</span>
          </h3>
          <p className="text-xs text-warm-gray-600 font-medium">
            Verifying workspace credentials...
          </p>
        </div>

        <div className="w-48 bg-warm-gray-200 h-1.5 rounded-sm overflow-hidden mt-2">
          <div className="bg-burnt-orange h-full rounded-sm animate-[shimmer_1.5s_infinite] w-full" />
        </div>

        <span className="text-[10px] font-mono text-warm-gray-500 uppercase tracking-wider">
          Secure Session Validation
        </span>
      </div>
    </div>
  )
}

export default AuthLoadingScreen
