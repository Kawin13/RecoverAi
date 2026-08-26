import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Overview } from './pages/Overview'
import { AtRiskRevenue } from './pages/AtRiskRevenue'
import { Transactions } from './pages/Transactions'
import { RecoveryAgent } from './pages/RecoveryAgent'
import { Simulation } from './pages/Simulation'
import { Analytics } from './pages/Analytics'
import { AuditTrail } from './pages/AuditTrail'
import { Guardrails } from './pages/Guardrails'
import { Settings } from './pages/Settings'
import { DemoCheckout } from './pages/DemoCheckout'
import { RealtimeProvider } from './lib/useRealtime'

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <RealtimeProvider>
        <Routes>
          <Route element={<AppShell />}>
          <Route path="/" element={<Overview />} />
          <Route path="/overview" element={<Navigate to="/" replace />} />
          <Route path="/demo-checkout" element={<DemoCheckout />} />
          <Route path="/demo-store" element={<Navigate to="/demo-checkout" replace />} />
          <Route path="/at-risk" element={<AtRiskRevenue />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/agent" element={<RecoveryAgent />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/guardrails" element={<Guardrails />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  </BrowserRouter>
  )
}

export default App
