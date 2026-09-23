import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AuthLoadingScreen } from './AuthLoadingScreen'

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <AuthLoadingScreen />
  }

  if (!session) {
    if (
      location.pathname === '/demo-checkout' ||
      location.pathname === '/pay' ||
      location.pathname === '/recovery-checkout'
    ) {
      return children ? <>{children}</> : <Outlet />
    }
    // Preserve intended target URL in navigation state
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children ? <>{children}</> : <Outlet />
}

export default ProtectedRoute
