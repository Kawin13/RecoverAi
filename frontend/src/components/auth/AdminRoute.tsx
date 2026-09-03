import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ShieldAlert } from 'lucide-react'


interface AdminRouteProps {
  children: React.ReactNode
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-8 h-8 border-2 border-[#ff5e3a] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-[#8f96a3]">Verifying administrator credentials...</p>
      </div>
    )
  }

  // Not signed in -> redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Signed in but role is operator (or non-admin) -> Deny access and redirect to dashboard
  if (role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-[#14171f] border border-[#ff4d4d]/30 rounded-2xl shadow-xl text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-[#ff4d4d]/10 border border-[#ff4d4d]/20 flex items-center justify-center text-[#ff4d4d]">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-[#f5f6f8]">Administrator Access Required</h2>
        <p className="text-sm text-[#8f96a3] leading-relaxed">
          You are currently signed in as a <span className="text-[#f5f6f8] font-semibold">Revenue Operator</span>. 
          The requested console is restricted strictly to workspace Administrators.
        </p>
        <div className="pt-2">
          <Navigate to="/" replace />
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default AdminRoute
