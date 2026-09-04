import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { SectionHeader } from '../components/common/SectionHeader'
import { adminApi, AdminUser } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../lib/useRealtime'
import {
  Users,
  Shield,
  ShieldCheck,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  X
} from 'lucide-react'


export const AdminUsers: React.FC = () => {
  const { user: currentAuthUser, refreshProfile } = useAuth()
  const { lastEvent } = useRealtime()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'admin' | 'operator'>('ALL')
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null)
  
  // Role change confirmation modal state
  const [selectedUserForRoleChange, setSelectedUserForRoleChange] = useState<AdminUser | null>(null)
  const [targetRole, setTargetRole] = useState<'admin' | 'operator'>('operator')
  
  // Notification toasts
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await adminApi.getUsers()
      setUsers(data)
    } catch (err: any) {
      setErrorToast(err.message || 'Failed to fetch user directory.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Listen for real-time SSE role change broadcasts
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'USER_ROLE_CHANGED') {
      fetchUsers()
      refreshProfile()
    }
  }, [lastEvent, fetchUsers, refreshProfile])

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchQuery ||
        (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())

      const matchesRole =
        roleFilter === 'ALL' || u.role === roleFilter

      return matchesSearch && matchesRole
    })
  }, [users, searchQuery, roleFilter])

  const counts = useMemo(() => {
    const total = users.length
    const admins = users.filter((u) => u.role === 'admin').length
    const operators = users.filter((u) => u.role === 'operator').length
    return { total, admins, operators }
  }, [users])

  const hasStatusColumn = useMemo(() => users.some((u) => !!u.status), [users])

  const handleOpenRoleModal = (targetUser: AdminUser, newRole: 'admin' | 'operator') => {
    setSelectedUserForRoleChange(targetUser)
    setTargetRole(newRole)
    setErrorToast(null)
  }

  const handleConfirmRoleChange = async () => {
    if (!selectedUserForRoleChange) return
    const targetUserId = selectedUserForRoleChange.id
    const targetUserName = selectedUserForRoleChange.full_name || selectedUserForRoleChange.email || 'User'
    const newRoleLabel = targetRole === 'admin' ? 'Administrator' : 'Revenue Operator'

    setActionInProgressId(targetUserId)
    setErrorToast(null)
    setSuccessToast(null)

    try {
      await adminApi.updateUserRole(targetUserId, targetRole)
      setSuccessToast(`Role updated: ${targetUserName} is now a ${newRoleLabel}.`)
      setSelectedUserForRoleChange(null)
      await fetchUsers()
      await refreshProfile()
      setTimeout(() => setSuccessToast(null), 4000)
    } catch (err: any) {
      console.error('[AdminUsers] Role update error:', err)
      setErrorToast(err.message || 'Failed to update user role.')
    } finally {
      setActionInProgressId(null)
    }
  }

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—'
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return isoString
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <SectionHeader
        title="User Management"
        subtitle="Manage workspace members, administrative governance, and operator role permissions."
      />


      {/* Success Notification Banner */}
      {successToast && (
        <div className="p-4 bg-moss-green-light border border-moss-green/30 rounded-md text-xs text-moss-green-dark flex items-center justify-between shadow-fintech-subtle animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-moss-green flex-shrink-0" />
            <span className="font-medium">{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-moss-green hover:text-moss-green-dark p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorToast && (
        <div className="p-4 bg-brick-red-light border border-brick-red/30 rounded-md text-xs text-brick-red-dark flex items-center justify-between shadow-fintech-subtle animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-brick-red flex-shrink-0" />
            <span className="font-medium">{errorToast}</span>
          </div>
          <button
            onClick={() => setErrorToast(null)}
            className="text-brick-red hover:text-brick-red-dark p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Members */}
        <div className="bg-surface border border-border rounded-md p-4 shadow-fintech-card flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-warm-gray-500 uppercase tracking-wider block mb-1 font-display">
              Total Workspace Users
            </span>
            <div className="text-2xl font-bold font-mono text-graphite">
              {loading ? '...' : counts.total}
            </div>
            <span className="text-[10px] text-warm-gray-400 mt-0.5 block">
              Active system accounts
            </span>
          </div>
          <div className="w-10 h-10 rounded-sm bg-warm-gray-100 flex items-center justify-center text-warm-gray-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Administrators */}
        <div className="bg-surface border border-border rounded-md p-4 shadow-fintech-card flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-warm-gray-500 uppercase tracking-wider block mb-1 font-display">
              Administrators
            </span>
            <div className="text-2xl font-bold font-mono text-burnt-orange">
              {loading ? '...' : counts.admins}
            </div>
            <span className="text-[10px] text-warm-gray-400 mt-0.5 block">
              Full governance & approval access
            </span>
          </div>
          <div className="w-10 h-10 rounded-sm bg-burnt-orange/10 border border-burnt-orange/20 flex items-center justify-center text-burnt-orange">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        {/* Revenue Operators */}
        <div className="bg-surface border border-border rounded-md p-4 shadow-fintech-card flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-warm-gray-500 uppercase tracking-wider block mb-1 font-display">
              Revenue Operators
            </span>
            <div className="text-2xl font-bold font-mono text-moss-green-dark">
              {loading ? '...' : counts.operators}
            </div>
            <span className="text-[10px] text-warm-gray-400 mt-0.5 block">
              Operational & execution access
            </span>
          </div>
          <div className="w-10 h-10 rounded-sm bg-moss-green-subtle border border-moss-green/20 flex items-center justify-center text-moss-green-dark">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Users Table Section */}
      <div className="bg-surface rounded-md border border-border shadow-fintech-card overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-warm-gray-50/50">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-warm-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface border border-border rounded-sm text-graphite focus:outline-none focus:border-burnt-orange"
            />
          </div>

          {/* Role Filter & Refresh Button */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-sm border border-border bg-surface p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRoleFilter('ALL')}
                className={`px-2.5 py-1 rounded-xs font-medium transition-colors ${
                  roleFilter === 'ALL'
                    ? 'bg-warm-gray-200 text-graphite font-semibold'
                    : 'text-warm-gray-500 hover:text-graphite'
                }`}
              >
                All ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('admin')}
                className={`px-2.5 py-1 rounded-xs font-medium transition-colors ${
                  roleFilter === 'admin'
                    ? 'bg-burnt-orange/15 text-burnt-orange font-semibold'
                    : 'text-warm-gray-500 hover:text-graphite'
                }`}
              >
                Admins ({counts.admins})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('operator')}
                className={`px-2.5 py-1 rounded-xs font-medium transition-colors ${
                  roleFilter === 'operator'
                    ? 'bg-warm-gray-200 text-graphite font-semibold'
                    : 'text-warm-gray-500 hover:text-graphite'
                }`}
              >
                Operators ({counts.operators})
              </button>
            </div>

            <button
              type="button"
              onClick={fetchUsers}
              disabled={loading}
              title="Refresh User Directory"
              className="p-1.5 rounded-sm border border-border hover:bg-warm-gray-100 text-warm-gray-600 hover:text-graphite transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* User Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-warm-gray-50 border-b border-border text-[11px] font-semibold text-warm-gray-500 uppercase tracking-wider font-display">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Authentication</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Last Sign In</th>
                {hasStatusColumn && <th className="py-3 px-4">Status</th>}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={hasStatusColumn ? 7 : 6} className="py-12 text-center text-warm-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-burnt-orange mb-2" />
                    <span>Loading workspace user directory...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={hasStatusColumn ? 7 : 6} className="py-10 text-center text-warm-gray-500">
                    <Users className="w-8 h-8 text-warm-gray-400 mx-auto mb-2 opacity-60" />
                    <p className="font-semibold text-graphite">No users found</p>
                    <p className="text-xs text-warm-gray-400 mt-0.5">
                      No accounts matched your search or role filter criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => {
                  const isCurrent = item.id === currentAuthUser?.id
                  const isItemAdmin = item.role === 'admin'
                  const initials = (item.full_name || item.email || 'U')
                    .split(' ')
                    .filter(Boolean)
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'U'

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-warm-gray-50/70 transition-colors"
                    >
                      {/* Name and Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {item.avatar_url ? (
                            <img
                              src={item.avatar_url}
                              alt={item.full_name || 'User'}
                              className="w-8 h-8 rounded-sm object-cover border border-border"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-sm bg-burnt-orange text-white flex items-center justify-center font-bold text-xs font-display flex-shrink-0">
                              {initials}
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-graphite block truncate">
                                {item.full_name || item.email?.split('@')[0] || 'RecoverAI User'}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 bg-warm-gray-200 text-warm-gray-700 text-[9px] font-mono rounded-xs">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-warm-gray-500 font-mono block truncate">
                              {item.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Authentication Provider */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warm-gray-100 border border-border rounded-sm text-[11px] font-medium text-warm-gray-700">
                          {item.provider === 'Google' ? (
                            <span className="font-semibold text-burnt-orange">Google OAuth</span>
                          ) : item.provider === 'Email' ? (
                            <span className="font-mono text-warm-gray-600">Email & Password</span>
                          ) : (
                            <span className="font-medium text-warm-gray-700">{item.provider}</span>
                          )}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-semibold border ${
                            isItemAdmin
                              ? 'bg-burnt-orange/15 text-burnt-orange border-burnt-orange/30'
                              : 'bg-warm-gray-100 text-warm-gray-700 border-warm-gray-200'
                          }`}
                        >
                          {isItemAdmin ? (
                            <Shield className="w-3 h-3 text-burnt-orange" />
                          ) : (
                            <ShieldCheck className="w-3 h-3 text-warm-gray-500" />
                          )}
                          <span>{isItemAdmin ? 'Administrator' : 'Revenue Operator'}</span>
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 font-mono text-[11px] text-warm-gray-600">
                        {formatDate(item.created_at)}
                      </td>

                      {/* Last Sign In */}
                      <td className="py-3 px-4 font-mono text-[11px] text-warm-gray-600">
                        {item.last_sign_in_at ? formatDate(item.last_sign_in_at) : 'Never'}
                      </td>

                      {/* Status (rendered conditionally only when real status exists) */}
                      {hasStatusColumn && (
                        <td className="py-3 px-4">
                          {item.status === 'Active' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-moss-green-light text-moss-green-dark border border-moss-green/20 text-[10px] font-semibold font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-moss-green animate-pulse" />
                              Active
                            </span>
                          ) : item.status === 'Suspended' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-brick-red-light text-brick-red-dark border border-brick-red/20 text-[10px] font-semibold font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-brick-red" />
                              Suspended
                            </span>
                          ) : item.status === 'Unconfirmed' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Unconfirmed
                            </span>
                          ) : (
                            <span className="text-warm-gray-400 font-mono text-[11px]">—</span>
                          )}
                        </td>
                      )}

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {isItemAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRoleModal(item, 'operator')}
                            disabled={actionInProgressId === item.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-warm-gray-600 hover:text-brick-red hover:bg-brick-red-light/60 border border-border hover:border-brick-red/30 rounded-sm transition-colors disabled:opacity-50"
                          >
                            {actionInProgressId === item.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <ArrowRightLeft className="w-3 h-3" />
                            )}
                            <span>Demote to Operator</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenRoleModal(item, 'admin')}
                            disabled={actionInProgressId === item.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-burnt-orange bg-burnt-orange/10 hover:bg-burnt-orange/20 border border-burnt-orange/30 rounded-sm transition-colors disabled:opacity-50"
                          >
                            {actionInProgressId === item.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Shield className="w-3 h-3" />
                            )}
                            <span>Promote to Admin</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {selectedUserForRoleChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-graphite/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-md shadow-fintech-modal w-full max-w-md p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-sm bg-burnt-orange/10 border border-burnt-orange/30 flex items-center justify-center text-burnt-orange">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-graphite">
                    Confirm Role Assignment
                  </h3>
                  <span className="text-[11px] text-warm-gray-500">
                    Workspace Governance & Access Control
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForRoleChange(null)}
                className="p-1 rounded-sm text-warm-gray-400 hover:text-graphite hover:bg-warm-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-warm-gray-700 leading-relaxed">
                Are you sure you want to change the role for{' '}
                <strong className="text-graphite font-semibold">
                  {selectedUserForRoleChange.full_name || selectedUserForRoleChange.email}
                </strong>
                ?
              </p>

              <div className="p-3 bg-warm-gray-50 border border-border rounded-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-warm-gray-500 block uppercase font-mono">Current Role</span>
                  <span className="font-semibold text-graphite">
                    {selectedUserForRoleChange.role === 'admin' ? 'Administrator' : 'Revenue Operator'}
                  </span>
                </div>
                <ArrowRightLeft className="w-4 h-4 text-warm-gray-400" />
                <div>
                  <span className="text-[10px] text-burnt-orange block uppercase font-mono">New Role</span>
                  <span className="font-bold text-burnt-orange">
                    {targetRole === 'admin' ? 'Administrator' : 'Revenue Operator'}
                  </span>
                </div>
              </div>

              {selectedUserForRoleChange.role === 'admin' && targetRole === 'operator' && (
                <div className="p-3 bg-muted-amber-subtle border border-muted-amber/30 rounded-sm text-[11px] text-muted-amber-dark flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Demoting an Administrator removes their access to the User Management console and high-ticket guardrail approvals.
                  </span>
                </div>
              )}

              <p className="text-[11px] text-warm-gray-500">
                This modification will be immediately enforced and logged in the immutable Audit Trail.
              </p>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedUserForRoleChange(null)}
                disabled={actionInProgressId !== null}
                className="px-3.5 py-1.5 rounded-sm border border-border text-xs font-medium text-warm-gray-700 hover:bg-warm-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRoleChange}
                disabled={actionInProgressId !== null}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-sm bg-burnt-orange hover:bg-burnt-orange-hover text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {actionInProgressId !== null ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm Role Change</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUsers
