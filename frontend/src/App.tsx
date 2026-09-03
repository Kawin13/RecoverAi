import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { PublicOnlyRoute } from './components/auth/PublicOnlyRoute'
import { AppShell } from './components/layout/AppShell'
import { LandingPage } from './pages/LandingPage'
import { Login } from './pages/auth/Login'
import { Signup } from './pages/auth/Signup'
import { ForgotPassword } from './pages/auth/ForgotPassword'
import { AuthCallback } from './pages/auth/AuthCallback'
import { Overview } from './pages/Overview'
import { AtRiskRevenue } from './pages/AtRiskRevenue'
import { Transactions } from './pages/Transactions'
import { RecoveryAgent } from './pages/RecoveryAgent'
import { Simulation } from './pages/Simulation'
import { Analytics } from './pages/Analytics'
import { AuditTrail } from './pages/AuditTrail'
import { Guardrails } from './pages/Guardrails'
import { Account } from './pages/Account'
import { AdminUsers } from './pages/AdminUsers'
import { AdminRoute } from './components/auth/AdminRoute'
import { DemoCheckout } from './pages/DemoCheckout'
import { Abandonment } from './pages/Abandonment'
import { NotFound } from './pages/NotFound'
import { RealtimeProvider } from './lib/useRealtime'
import { ErrorBoundary } from './components/common/ErrorBoundary'


export const App: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="RecoverAI Application Exception Guard">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Landing & Homepage Entry */}
            <Route path="/" element={<LandingPage />} />

            {/* OAuth Callback Endpoint */}
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Public-Only Authentication Entry Routes (Redirects authenticated users to /overview) */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Route>

            {/* Protected Operational Application Routes (Requires active Supabase session) */}
            <Route element={<ProtectedRoute />}>
              <Route
                element={
                  <RealtimeProvider>
                    <AppShell />
                  </RealtimeProvider>
                }
              >
                <Route path="/overview" element={<Overview />} />
                <Route path="/dashboard" element={<Navigate to="/overview" replace />} />
                <Route path="/checkout" element={<Navigate to="/demo-checkout" replace />} />
                <Route path="/demo-checkout" element={<DemoCheckout />} />
                <Route path="/demo-store" element={<Navigate to="/demo-checkout" replace />} />
                <Route path="/abandonment" element={<Abandonment />} />
                <Route path="/at-risk" element={<AtRiskRevenue />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/agent" element={<RecoveryAgent />} />
                <Route path="/recovery-agent" element={<Navigate to="/agent" replace />} />
                <Route path="/simulation" element={<Simulation />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/audit" element={<AuditTrail />} />
                <Route path="/audit-trail" element={<Navigate to="/audit" replace />} />
                <Route path="/guardrails" element={<Guardrails />} />
                <Route
                  path="/admin/users"
                  element={
                    <AdminRoute>
                      <AdminUsers />
                    </AdminRoute>
                  }
                />
                <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
                <Route path="/settings" element={<Navigate to="/account" replace />} />
                <Route path="/account" element={<Account />} />
              </Route>

            </Route>

            {/* Unknown Route Catch-All (Graceful 404 handler) */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
