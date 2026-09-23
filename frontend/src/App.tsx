import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { PublicOnlyRoute } from './components/auth/PublicOnlyRoute'
import { AppShell } from './components/layout/AppShell'
import { AdminRoute } from './components/auth/AdminRoute'
import { RealtimeProvider } from './lib/useRealtime'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ENV } from './config/env'
import { ConfigurationErrorScreen } from './components/ConfigurationErrorScreen'

// Route-level lazy loading with code-splitting for optimal bundle performance (Phase 36)
const LandingPage = React.lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })))
const Login = React.lazy(() => import('./pages/auth/Login').then(m => ({ default: m.Login })))
const Signup = React.lazy(() => import('./pages/auth/Signup').then(m => ({ default: m.Signup })))
const ForgotPassword = React.lazy(() => import('./pages/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })))
const AuthCallback = React.lazy(() => import('./pages/auth/AuthCallback').then(m => ({ default: m.AuthCallback })))
const InviteAccept = React.lazy(() => import('./pages/auth/InviteAccept').then(m => ({ default: m.InviteAccept })))
const Onboarding = React.lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })))
const Overview = React.lazy(() => import('./pages/Overview').then(m => ({ default: m.Overview })))
const AtRiskRevenue = React.lazy(() => import('./pages/AtRiskRevenue').then(m => ({ default: m.AtRiskRevenue })))
const Transactions = React.lazy(() => import('./pages/Transactions').then(m => ({ default: m.Transactions })))
const RecoveryAgent = React.lazy(() => import('./pages/RecoveryAgent').then(m => ({ default: m.RecoveryAgent })))
const Simulation = React.lazy(() => import('./pages/Simulation').then(m => ({ default: m.Simulation })))
const Analytics = React.lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })))
const AuditTrail = React.lazy(() => import('./pages/AuditTrail').then(m => ({ default: m.AuditTrail })))
const Guardrails = React.lazy(() => import('./pages/Guardrails').then(m => ({ default: m.Guardrails })))
const Account = React.lazy(() => import('./pages/Account').then(m => ({ default: m.Account })))
const Integrations = React.lazy(() => import('./pages/Integrations').then(m => ({ default: m.Integrations })))
const AdminUsers = React.lazy(() => import('./pages/AdminUsers').then(m => ({ default: m.AdminUsers })))
const DemoCheckout = React.lazy(() => import('./pages/DemoCheckout').then(m => ({ default: m.DemoCheckout })))
const Abandonment = React.lazy(() => import('./pages/Abandonment').then(m => ({ default: m.Abandonment })))
const NotFound = React.lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })))

const RouteFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[50vh] p-8">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-slate-500 font-medium tracking-wide">Loading interface...</span>
    </div>
  </div>
)

export const App: React.FC = () => {
  // If production environment variables are missing, fail safely with actionable diagnostic screen
  if (ENV.hasConfigErrors) {
    return <ConfigurationErrorScreen errors={ENV.configErrors} />
  }

  return (
    <ErrorBoundary fallbackTitle="RecoverAI Application Exception Guard">
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public Landing & Homepage Entry */}
              <Route path="/" element={<LandingPage />} />

              {/* OAuth Callback Endpoint */}
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Team Invitation Accept — works signed-in or signed-out */}
              <Route path="/invite/:token" element={<InviteAccept />} />

              {/* Public 1-Click Recovery Checkout Portal (Accessible directly from email links) */}
              <Route path="/pay" element={<DemoCheckout />} />
              <Route path="/recovery-checkout" element={<DemoCheckout />} />

              {/* Public-Only Authentication Entry Routes (Redirects authenticated users to /overview) */}
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
              </Route>

              {/* Protected Operational Application Routes (Requires active Supabase session) */}
              <Route element={<ProtectedRoute />}>
                {/* Standalone Onboarding (outside AppShell — full-screen wizard) */}
                <Route
                  path="/onboarding"
                  element={
                    <WorkspaceProvider>
                      <Onboarding />
                    </WorkspaceProvider>
                  }
                />

                <Route
                  element={
                    <WorkspaceProvider>
                      <RealtimeProvider>
                        <AppShell />
                      </RealtimeProvider>
                    </WorkspaceProvider>
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
                  <Route path="/integrations" element={<Integrations />} />
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
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
