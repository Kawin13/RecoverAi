import React, { useState, useEffect, useCallback } from 'react'
import { api, AnalyticsFilters, AnalyticsResponse } from '../services/api'
import { SectionHeader } from '../components/common/SectionHeader'
import { MetricCard } from '../components/common/MetricCard'
import { MoneyValue } from '../components/common/MoneyValue'
import { SkeletonLoader } from '../components/common/SkeletonLoader'
import { ErrorState } from '../components/common/ErrorState'
import { useRealtime } from '../lib/useRealtime'
import {
  TrendingUp,
  DollarSign,
  Clock,
  Filter,
  RefreshCw,
  Building2,
  Users,
  AlertTriangle,
  RotateCcw,
  Zap
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend
} from 'recharts'

export const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters State
  const [timeRange, setTimeRange] = useState<string>('7d')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<string>('ALL')
  const [failureReason, setFailureReason] = useState<string>('ALL')
  const [strategy, setStrategy] = useState<string>('ALL')
  const [status, setStatus] = useState<string>('ALL')

  const { subscribe } = useRealtime()

  const fetchAnalytics = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const filters: AnalyticsFilters = {
        time_range: timeRange,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        payment_method: paymentMethod !== 'ALL' ? paymentMethod : undefined,
        failure_reason: failureReason !== 'ALL' ? failureReason : undefined,
        strategy: strategy !== 'ALL' ? strategy : undefined,
        status: status !== 'ALL' ? status : undefined
      }
      const res = await api.getAnalytics(filters)
      setData(res)
    } catch (err: any) {
      if (!silent) setError(err.message || 'Failed to load financial operations analytics')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [timeRange, startDate, endDate, paymentMethod, failureReason, strategy, status])

  useEffect(() => {
    fetchAnalytics()
    const unsubRecovered = subscribe('transaction_recovered', () => fetchAnalytics(true))
    const unsubDashboard = subscribe('DASHBOARD_REFRESH', () => fetchAnalytics(true))
    const unsubResync = subscribe('RECONNECT_RESYNC', () => fetchAnalytics(true))

    return () => {
      unsubRecovered()
      unsubDashboard()
      unsubResync()
    }
  }, [fetchAnalytics, subscribe])

  const handleResetFilters = () => {
    setTimeRange('7d')
    setStartDate('')
    setEndDate('')
    setPaymentMethod('ALL')
    setFailureReason('ALL')
    setStrategy('ALL')
    setStatus('ALL')
  }

  const isFiltered =
    timeRange !== '7d' ||
    startDate !== '' ||
    endDate !== '' ||
    paymentMethod !== 'ALL' ||
    failureReason !== 'ALL' ||
    strategy !== 'ALL' ||
    status !== 'ALL'

  const formatCurrencyAxis = (val: number) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`
    return `₹${val}`
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <SectionHeader
        title="Financial Operations & Revenue Analytics Console"
        subtitle="Real-time recovery metrics, operational velocity, and cohort attribution across payment rails and strategies"
        actions={
          <div className="flex items-center gap-2.5 text-xs">
            {data?.data_mode && (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase border shadow-2xs ${
                data.data_mode === 'SIMULATED DATA'
                  ? 'bg-primary-light text-primary border-primary-border'
                  : data.data_mode === 'Demo Dataset'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  data.data_mode === 'SIMULATED DATA'
                    ? 'bg-primary'
                    : data.data_mode === 'Demo Dataset'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`} />
                {data.data_mode}
              </span>
            )}
            <button
              type="button"
              onClick={() => fetchAnalytics(false)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface hover:bg-slate-50 border border-border text-navy rounded-xl font-semibold transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-primary" />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Global Filter Bar */}
      <div className="bg-surface p-5 rounded-2xl border border-border/80 shadow-fintech-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold font-display uppercase tracking-wider text-navy">
              Operations Filter Console
            </span>
          </div>

          {/* Time Presets */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-border/70">
            <button
              type="button"
              onClick={() => setTimeRange('24h')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                timeRange === '24h' || timeRange === 'today'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-slate-600 hover:text-navy'
              }`}
            >
              24H
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                timeRange === '7d'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-slate-600 hover:text-navy'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                timeRange === '30d'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-slate-600 hover:text-navy'
              }`}
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('custom')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                timeRange === 'custom'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'text-slate-600 hover:text-navy'
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Dynamic Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5 pt-1">
          {/* Custom Date Inputs if 'custom' selected */}
          {timeRange === 'custom' && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-xl text-navy focus:outline-none focus:border-primary shadow-2xs"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-xl text-navy focus:outline-none focus:border-primary shadow-2xs"
                />
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Payment Rail
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-xl text-navy focus:outline-none focus:border-primary shadow-2xs font-medium"
            >
              <option value="ALL">All Payment Rails</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="NetBanking">NetBanking</option>
              <option value="Wallet">Wallet</option>
              <option value="EMI">EMI</option>
            </select>
          </div>

          {/* Failure Reason */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Failure Root Cause
            </label>
            <select
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-xl text-navy focus:outline-none focus:border-primary shadow-2xs font-medium"
            >
              <option value="ALL">All Root Causes</option>
              <option value="UPI_TIMEOUT">UPI Timeout</option>
              <option value="AUTHENTICATION_FAILED">Authentication Failed</option>
              <option value="CARD_DECLINED">Card Declined</option>
              <option value="BANK_SERVER_DOWN">Bank Server Down</option>
              <option value="INSUFFICIENT_FUNDS">Insufficient Funds</option>
              <option value="TRANSACTION_LIMIT">Transaction Limit</option>
              <option value="CHECKOUT_ABANDONED">Cart Abandonment</option>
            </select>
          </div>

          {/* Strategy */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Intervention Strategy
            </label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-xl text-navy focus:outline-none focus:border-primary shadow-2xs font-medium"
            >
              <option value="ALL">All Strategies</option>
              <option value="SMART_PAYLINK_1CLICK">Dynamic 1-Click Paylink</option>
              <option value="UPI_INTENT_FALLBACK">UPI Intent Instant Fallback</option>
              <option value="TIMED_SMART_RETRY">Timed Smart Retry</option>
              <option value="INCENTIVIZED_DUNNING">AI Dunning Email</option>
              <option value="WHATSAPP_CONCIERGE">WhatsApp Concierge</option>
              <option value="RETRY_NOW">Direct Instant Retry</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Recovery Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-xl text-navy focus:outline-none focus:border-primary shadow-2xs font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="RECOVERED">Recovered</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="FAILED">Permanently Failed</option>
              <option value="ESCALATED">Human Escalated</option>
              <option value="STOPPED">Guardrail Stopped</option>
            </select>
          </div>

          {/* Reset Action */}
          {isFiltered && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-primary bg-primary-light hover:bg-primary-subtle border border-primary-border rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <SkeletonLoader variant="card" count={4} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonLoader variant="card" count={2} />
          </div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchAnalytics(false)} />
      ) : data ? (
        <>
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Revenue at Risk"
              value={<MoneyValue amount={data.kpis.revenue_at_risk} />}
              subtitle={`${data.kpis.active_recoveries} active cases undergoing recovery`}
              delta={{ value: data.kpis.at_risk_delta_percent, label: 'vs last cycle' }}
              highlightColor="muted-amber"
              icon={AlertTriangle}
              variant="standard"
            />
            <MetricCard
              title="Revenue Recovered"
              value={<MoneyValue amount={data.kpis.revenue_recovered} />}
              subtitle={`${data.kpis.recovery_rate}% overall recovery rate`}
              delta={{ value: data.kpis.recovered_delta_percent, label: 'recovery volume lift' }}
              highlightColor="purple"
              icon={TrendingUp}
              variant="standard"
            />
            <MetricCard
              title="Net Recovery Value"
              value={<MoneyValue amount={data.kpis.net_recovery_value} />}
              subtitle="Net retained after gateway & message costs"
              delta={{ value: data.kpis.recovery_rate_delta_percent, label: 'efficiency delta' }}
              icon={DollarSign}
              variant="soft-blue"
            />
            <MetricCard
              title="Operational Velocity"
              value={`${data.kpis.avg_recovery_time_minutes} mins`}
              subtitle={`Avg ${data.kpis.avg_attempts_before_recovery} attempts before resolution`}
              highlightColor="purple"
              icon={Clock}
              variant="standard"
            />
          </div>

          {/* Row 1: Timeline Recovery Trend & Strategy Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Recovery Timeline */}
            <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/70">
                <div>
                  <h3 className="text-base font-bold text-navy font-display">
                    Revenue Recovery Timeline & Attrition
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gross at-risk revenue vs recovered collections over {timeRange} window
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-primary-light text-primary border border-primary-border shadow-2xs">
                  <Zap className="w-3.5 h-3.5 text-primary" /> Live Attribution
                </span>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.timeline_trend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#94A3B8" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6C00FF" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6C00FF" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tickFormatter={formatCurrencyAxis} tick={{ fontSize: 11, fill: '#64748B' }} width={60} />
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                      contentStyle={{ backgroundColor: '#0B1528', borderColor: '#1E293B', borderRadius: '12px', color: '#F8FAFC', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="at_risk" stroke="#94A3B8" fillOpacity={1} fill="url(#colorRisk)" name="Revenue at Risk" strokeWidth={2} />
                    <Area type="monotone" dataKey="recovered" stroke="#6C00FF" fillOpacity={1} fill="url(#colorRec)" name="Recovered Revenue" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recovery Rate & Revenue by Strategy */}
            <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card">
              <div className="mb-3 pb-3 border-b border-border/70">
                <h3 className="text-base font-bold text-navy font-display">
                  Recovery by Strategy Channel
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gross recovered revenue and conversion win rate across autonomous strategies
                </p>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.recovery_by_strategy}
                    layout="vertical"
                    margin={{ top: 5, right: 25, left: 30, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" tickFormatter={formatCurrencyAxis} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      type="category"
                      dataKey="strategy_name"
                      tick={{ fontSize: 10, fill: '#0B1528' }}
                      width={130}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        name === 'recovered_amount' ? `₹${Number(val).toLocaleString('en-IN')}` : `${val}%`,
                        name === 'recovered_amount' ? 'Recovered Revenue' : 'Recovery Rate'
                      ]}
                      contentStyle={{ backgroundColor: '#0B1528', borderColor: '#1E293B', borderRadius: '12px', color: '#F8FAFC', fontSize: '12px' }}
                    />
                    <Bar dataKey="recovered_amount" fill="#6C00FF" radius={[0, 6, 6, 0]} name="Recovered Revenue">
                      {data.recovery_by_strategy.map((_, index) => (
                        <Cell key={`strat-cell-${index}`} fill={index % 2 === 0 ? '#6C00FF' : '#8B5CF6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Root Cause Diagnostics & Payment Method Rails */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Failure Root Cause Comparison */}
            <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card">
              <div className="mb-3 pb-3 border-b border-border/70">
                <h3 className="text-base font-bold text-navy font-display">
                  Recovery by Failure Root Cause
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Performance across error codes and failure taxonomies
                </p>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.recovery_by_failure_reason.slice(0, 6)}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="failure_reason" tick={{ fontSize: 10, fill: '#64748B' }} interval={0} angle={-15} textAnchor="end" height={45} />
                    <YAxis tickFormatter={formatCurrencyAxis} tick={{ fontSize: 11, fill: '#64748B' }} width={55} />
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                      contentStyle={{ backgroundColor: '#0B1528', borderColor: '#1E293B', borderRadius: '12px', color: '#F8FAFC', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="at_risk_amount" fill="#CBD5E1" name="At-Risk" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="recovered_amount" fill="#6C00FF" name="Recovered" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Method Distribution */}
            <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card">
              <div className="mb-3 pb-3 border-b border-border/70">
                <h3 className="text-base font-bold text-navy font-display">
                  Recovery by Payment Method Rail
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Instrument volume and conversion across UPI, Cards, NetBanking, and Wallets
                </p>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.recovery_by_payment_method}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="method" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tickFormatter={formatCurrencyAxis} tick={{ fontSize: 11, fill: '#64748B' }} width={55} />
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                      contentStyle={{ backgroundColor: '#0B1528', borderColor: '#1E293B', borderRadius: '12px', color: '#F8FAFC', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="at_risk_amount" fill="#CBD5E1" name="At-Risk Volume" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="recovered_amount" fill="#38BDF8" name="Recovered Revenue" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Merchant Category & Customer Segment Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Merchant Vertical Category */}
            <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/70">
                <Building2 className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold text-navy font-display">
                    Recovery by Merchant Vertical
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cross-industry revenue resilience and recovery yields
                  </p>
                </div>
              </div>

              <div className="h-60 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.recovery_by_merchant_category}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" tickFormatter={formatCurrencyAxis} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tick={{ fontSize: 10, fill: '#0B1528' }}
                      width={130}
                    />
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Recovered']}
                      contentStyle={{ backgroundColor: '#0B1528', borderColor: '#1E293B', borderRadius: '12px', color: '#F8FAFC', fontSize: '12px' }}
                    />
                    <Bar dataKey="recovered_amount" fill="#6C00FF" radius={[0, 6, 6, 0]} name="Recovered" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Customer Value Segment */}
            <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/70">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold text-navy font-display">
                    Recovery by Customer Value Segment
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    High-LTV accounts (Enterprise / VIP) vs Growth & Standard tiers
                  </p>
                </div>
              </div>

              <div className="h-60 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.recovery_by_customer_segment}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="tier" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tickFormatter={formatCurrencyAxis} tick={{ fontSize: 11, fill: '#64748B' }} width={55} />
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                      contentStyle={{ backgroundColor: '#0B1528', borderColor: '#1E293B', borderRadius: '12px', color: '#F8FAFC', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="at_risk_amount" fill="#CBD5E1" name="At-Risk" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="recovered_amount" fill="#10B981" name="Recovered" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Strategy Economics & Performance Matrix */}
          <div className="bg-surface rounded-2xl border border-border/80 overflow-hidden shadow-fintech-card">
            <div className="p-5 border-b border-border/80 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-base font-bold text-navy font-display">
                  Strategy Channel Economics & ROI Matrix
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Granular financial attribution: attempts, success conversion, channel costs, and net ERV
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono font-medium">
                {data.recovery_by_strategy.length} Autonomous Channels Evaluated
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-border text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Recovery Strategy</th>
                    <th className="py-3.5 px-4 text-right">Attempts</th>
                    <th className="py-3.5 px-4 text-right">Successes</th>
                    <th className="py-3.5 px-4 text-right">Win Rate</th>
                    <th className="py-3.5 px-4 text-right">Gross Recovered</th>
                    <th className="py-3.5 px-4 text-right">Channel Cost</th>
                    <th className="py-3.5 px-4 text-right font-bold text-emerald-600">Net Recovery Value</th>
                    <th className="py-3.5 px-4 text-right">Avg Speed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.recovery_by_strategy.map((row) => (
                    <tr key={row.strategy_key} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-navy">
                        {row.strategy_name}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        {row.attempts.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        {row.success_count.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {row.recovery_rate}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-navy">
                        ₹{row.recovered_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        ₹{row.channel_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                        ₹{row.net_erv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        {row.avg_time_minutes}m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
export default Analytics
