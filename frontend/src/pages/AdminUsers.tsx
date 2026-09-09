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
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <SectionHeader
        title="User Management"
        subtitle="Manage workspace members, administrative governance, and operator role permissions."
      />

      {/* Success Notification Banner */}
      {successToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorToast && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{errorToast}</span>
          </div>
          <button
            onClick={() => setErrorToast(null)}
            className="text-rose-700 hover:text-rose-900 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Members */}
        <div className="bg-surface border border-border/80 rounded-2xl p-5 shadow-fintech-card flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-display">
              Total Workspace Users
            </span>
            <div className="text-3xl font-bold font-mono text-navy tracking-tight">
              {loading ? '...' : counts.total}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Active system accounts
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Administrators */}
        <div className="bg-surface border border-primary-border/60 rounded-2xl p-5 shadow-fintech-card flex items-center justify-between bg-primary-light/20">
          <div>
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider block mb-1 font-display">
              Administrators
            </span>
            <div className="text-3xl font-bold font-mono text-primary tracking-tight">
              {loading ? '...' : counts.admins}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Full governance & approval access
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary-light border border-primary-border flex items-center justify-center text-primary shadow-xs">
            <Shield className="w-6 h-6" />
          </div>
        </div>

        {/* Revenue Operators */}
        <div className="bg-surface border border-border/80 rounded-2xl p-5 shadow-fintech-card flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-display">
              Revenue Operators
            </span>
            <div className="text-3xl font-bold font-mono text-navy tracking-tight">
              {loading ? '...' : counts.operators}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Operational & execution access
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Users Table Section */}
      <div className="bg-surface rounded-2xl border border-border/80 shadow-fintech-card overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-4 border-b border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-surface border border-border rounded-xl text-navy focus:outline-none focus:border-primary shadow-2xs font-medium"
            />
          </div>

          {/* Role Filter & Refresh Button */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-border bg-surface p-1 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => setRoleFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  roleFilter === 'ALL'
                    ? 'bg-slate-100 text-navy'
                    : 'text-slate-500 hover:text-navy'
                }`}
              >
                All ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('admin')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  roleFilter === 'admin'
                    ? 'bg-primary-light text-primary border border-primary-border'
                    : 'text-slate-500 hover:text-navy'
                }`}
              >
                Admins ({counts.admins})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('operator')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  roleFilter === 'operator'
                    ? 'bg-slate-100 text-navy'
                    : 'text-slate-500 hover:text-navy'
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
              className="p-2 rounded-xl border border-border hover:bg-slate-100 text-slate-600 hover:text-navy transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* User Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-border text-[10px] font-bold text-slate-500 uppercase tracking-wider font-display">
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
            <tbody className="divide-y divide-border/60">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={hasStatusColumn ? 7 : 6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    <span className="font-medium">Loading workspace user directory...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={hasStatusColumn ? 7 : 6} className="py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                    <p className="font-bold text-navy">No users found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
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
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Name and Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {item.avatar_url ? (
                            <img
                              src={item.avatar_url}
                              alt={item.full_name || 'User'}
                              className="w-8 h-8 rounded-xl object-cover border border-border"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-xs font-display flex-shrink-0 shadow-2xs">
                              {initials}
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-navy block truncate">
                                {item.full_name || item.email?.split('@')[0] || 'RecoverAI User'}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[9px] font-mono font-bold rounded-full">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono block truncate">
                              {item.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Authentication Provider */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 border border-border rounded-full text-[11px] font-semibold text-slate-700">
                          {item.provider === 'Google' ? (
                            <span className="font-bold text-primary">Google OAuth</span>
                          ) : item.provider === 'Email' ? (
                            <span className="font-mono text-slate-600">Email & Password</span>
                          ) : (
                            <span className="font-semibold text-slate-700">{item.provider}</span>
                          )}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                            isItemAdmin
                              ? 'bg-primary-light text-primary border-primary-border'
                              : 'bg-slate-100 text-slate-700 border-border'
                          }`}
                        >
                          {isItemAdmin ? (
                            <Shield className="w-3 h-3 text-primary" />
                          ) : (
                            <ShieldCheck className="w-3 h-3 text-slate-500" />
                          )}
                          <span>{isItemAdmin ? 'Administrator' : 'Revenue Operator'}</span>
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {formatDate(item.created_at)}
                      </td>

                      {/* Last Sign In */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {item.last_sign_in_at ? formatDate(item.last_sign_in_at) : 'Never'}
                      </td>

                      {/* Status */}
                      {hasStatusColumn && (
                        <td className="py-3.5 px-4">
                          {item.status === 'Active' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : item.status === 'Suspended' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Suspended
                            </span>
                          ) : item.status === 'Unconfirmed' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Unconfirmed
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>
                      )}

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isItemAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRoleModal(item, 'operator')}
                            disabled={actionInProgressId === item.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-border hover:border-rose-200 rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
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
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl transition-all shadow-fintech-purple disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface border border-border/80 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center text-primary shadow-xs">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-display text-navy">
                    Confirm Role Assignment
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Workspace Governance & Access Control
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForRoleChange(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-navy hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Are you sure you want to change the role for{' '}
                <strong className="text-navy font-bold">
                  {selectedUserForRoleChange.full_name || selectedUserForRoleChange.email}
                </strong>
                ?
              </p>

              <div className="p-3.5 bg-slate-50 border border-border rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono font-bold">Current Role</span>
                  <span className="font-bold text-navy">
                    {selectedUserForRoleChange.role === 'admin' ? 'Administrator' : 'Revenue Operator'}
                  </span>
                </div>
                <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-[10px] text-primary block uppercase font-mono font-bold">New Role</span>
                  <span className="font-bold text-primary">
                    {targetRole === 'admin' ? 'Administrator' : 'Revenue Operator'}
                  </span>
                </div>
              </div>

              {selectedUserForRoleChange.role === 'admin' && targetRole === 'operator' && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    Demoting an Administrator removes their access to the User Management console and high-ticket guardrail approvals.
                  </span>
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                This modification will be immediately enforced and logged in the immutable Audit Trail.
              </p>
            </div>

            <div className="pt-3 border-t border-border/70 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedUserForRoleChange(null)}
                disabled={actionInProgressId !== null}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-navy hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRoleChange}
                disabled={actionInProgressId !== null}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-fintech-purple transition-colors disabled:opacity-50 cursor-pointer"
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
