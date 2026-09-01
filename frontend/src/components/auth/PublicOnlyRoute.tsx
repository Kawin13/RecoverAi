import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AuthLoadingScreen } from './AuthLoadingScreen'

export const PublicOnlyRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <AuthLoadingScreen />
  }

  if (session) {
    // Redirect authenticated users away from public auth pages to dashboard or intended route
    const fromPath = (location.state as any)?.from?.pathname || '/overview'
    return <Navigate to={fromPath} replace />
  }

  return children ? <>{children}</> : <Outlet />
}

export default PublicOnlyRoute
