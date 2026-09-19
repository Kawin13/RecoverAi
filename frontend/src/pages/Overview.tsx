import React, { useState, useEffect } from 'react'
import { api, DashboardData } from '../services/api'
import { Transaction } from '../types'
import { MetricCard } from '../components/common/MetricCard'
import { MoneyValue } from '../components/common/MoneyValue'
import { SectionHeader } from '../components/common/SectionHeader'
import { TransactionTable } from '../components/common/TransactionTable'
import { DecisionTimeline } from '../components/common/DecisionTimeline'
import { SkeletonLoader } from '../components/common/SkeletonLoader'
import { ErrorState } from '../components/common/ErrorState'
import {
  AlertOctagon,
  CheckCircle2,
  Percent,
  Zap,
  ArrowUpRight,
  CreditCard,
  Play
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts'
import { Link } from 'react-router-dom'
import { useRealtime } from '../lib/useRealtime'
import { ENV } from '../config/env'

export const Overview: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d')
  const [data, setData] = useState<DashboardData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { subscribe } = useRealtime()

  const loadData = async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [dashRes, txRes] = await Promise.all([
        api.getDashboard(timeRange),
        api.getTransactions({ limit: 5 })
      ])
      setData(dashRes)
      setTransactions(txRes.items)
    } catch (e: any) {
      if (!silent) setError(e.message || 'Failed to load dashboard data')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Targeted event subscriptions
    const unsubDashboard = subscribe('DASHBOARD_REFRESH', () => loadData(true))
    const unsubTx = subscribe('TRANSACTION_UPDATED', () => loadData(true))
    const unsubCase = subscribe('RECOVERY_CASE_UPDATED', () => loadData(true))
    const unsubQueue = subscribe('RECOVERY_QUEUE_UPDATED', () => loadData(true))
    const unsubPay = subscribe('PAYMENT_RECEIVED', () => loadData(true))
    const unsubRecovered = subscribe('transaction_recovered', () => loadData(true))
    const unsubResync = subscribe('RECONNECT_RESYNC', () => loadData(true))

    return () => {
      unsubDashboard()
      unsubTx()
      unsubCase()
      unsubQueue()
      unsubPay()
      unsubRecovered()
      unsubResync()
    }
  }, [timeRange, subscribe])

  // Modern Fintech Tooltip Formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const atRiskItem = payload.find((p: any) => p.dataKey === 'atRisk' || p.dataKey === 'at_risk') || payload[0]
      const recItem = payload.find((p: any) => p.dataKey === 'recovered') || payload[1]
      const atRiskVal = Number(atRiskItem?.value ?? 0)
      const recVal = Number(recItem?.value ?? 0)
      return (
        <div className="bg-navy text-white p-3.5 rounded-xl border border-navy-light/60 shadow-fintech-modal text-xs font-mono">
          <p className="font-bold text-slate-300 mb-2 font-display">{label}</p>
          <div className="space-y-1.5">
            <p className="text-rose-300 flex items-center justify-between gap-4">
              <span>At Risk:</span>
              <span>₹{atRiskVal.toLocaleString('en-IN')}</span>
            </p>
            <p className="text-primary-light flex items-center justify-between gap-4">
              <span>Recovered:</span>
              <span className="font-bold text-white">₹{recVal.toLocaleString('en-IN')}</span>
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  // Normalize trend points to guarantee both camelCase and snake_case properties
  const formattedTrendData = React.useMemo(() => {
    if (!data?.trendData || data.trendData.length === 0) return []
    return data.trendData.map((pt: any) => ({
      ...pt,
      date: pt.date,
      atRisk: pt.atRisk !== undefined ? pt.atRisk : (pt.at_risk ?? 0),
      at_risk: pt.at_risk !== undefined ? pt.at_risk : (pt.atRisk ?? 0),
      recovered: pt.recovered ?? 0,
      target: pt.target ?? 0
    }))
  }, [data?.trendData])


  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="card" count={4} />
        <SkeletonLoader variant="chart" count={1} />
        <SkeletonLoader variant="row" count={5} />
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Top Banner / Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy tracking-tight font-display">
              Autonomous Revenue Recovery
            </h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase border tracking-wider shadow-xs ${
              data.dataMode === 'SIMULATED DATA'
                ? 'bg-primary-light text-primary border-primary-border'
                : (ENV.DEMO_MODE || data.dataMode === 'Demo Dataset')
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                data.dataMode === 'SIMULATED DATA'
                  ? 'bg-primary'
                  : (ENV.DEMO_MODE || data.dataMode === 'Demo Dataset')
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`} />
              {ENV.DEMO_MODE ? 'Demo Data' : (data.dataMode || 'LIVE TEST DATA')}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-normal">
            Real-time failed payment diagnosis, recovery likelihood scoring, and ERV-optimized intervention workflows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 border border-border rounded-xl p-1 text-xs">
            {['24h', '7d', '30d'].map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  timeRange === range
                    ? 'bg-white text-navy shadow-xs font-bold'
                    : 'text-slate-500 hover:text-navy'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>

          <Link
            to="/simulation"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-fintech-purple focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Simulate Failure</span>
          </Link>
        </div>
      </div>

      {/* 4 Primary Metric Cards: Plum-inspired Hero card for Total Recovered */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Large Purple Hero Card */}
        <MetricCard
          title="Revenue Recovered"
          value={<MoneyValue amount={data.metrics.revenueRecovered} />}
          delta={{
            value: data.metrics.recoveredDeltaPercent,
            label: 'vs last period'
          }}
          subtitle="Net Attributed"
          icon={CheckCircle2}
          variant="hero-purple"
        />

        {/* Card 2: Active At-Risk Revenue */}
        <MetricCard
          title="Revenue At Risk"
          value={<MoneyValue amount={data.metrics.revenueAtRisk} />}
          delta={{
            value: data.metrics.atRiskDeltaPercent,
            label: 'vs last period',
            isInverse: true
          }}
          subtitle="Past 24 Hours"
          icon={AlertOctagon}
          highlightColor="muted-amber"
          variant="standard"
        />

        {/* Card 3: Autonomous Recovery Rate in Soft Blue */}
        <MetricCard
          title="Recovery Rate"
          value={`${data.metrics.recoveryRate}%`}
          delta={{
            value: data.metrics.recoveryRateDeltaPercent,
            label: 'percentage points'
          }}
          subtitle="Target 50%+"
          icon={Percent}
          variant="soft-blue"
        />

        {/* Card 4: Active Recoveries */}
        <MetricCard
          title="Active Recoveries"
          value={data.metrics.activeRecoveries.toString()}
          delta={{
            value: data.metrics.activeDeltaCount,
            label: 'in progress'
          }}
          subtitle="Live Cases"
          icon={Zap}
          highlightColor="purple"
          variant="standard"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recovery Velocity Chart (2 cols) */}
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/70">
            <div>
              <h3 className="text-base font-bold text-navy font-display">
                Revenue Recovery Velocity
              </h3>
              <p className="text-xs text-slate-500">
                At-risk revenue vs successfully recovered revenue over time
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-600 font-medium">At-Risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-navy font-bold">Recovered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 border-t-2 border-dashed border-slate-400" />
                <span className="text-slate-500">Benchmark</span>
              </div>
            </div>
          </div>

          <div className="h-72 w-full min-h-[280px]">
            {formattedTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                No trend data available for this time window.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                <AreaChart data={formattedTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="recoveredGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6C00FF" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6C00FF" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="atRiskGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="atRisk"
                    stroke="#EF4444"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#atRiskGradient)"
                    name="At Risk"
                  />
                  <Area
                    type="monotone"
                    dataKey="recovered"
                    stroke="#6C00FF"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#recoveredGradient)"
                    name="Recovered"
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#94A3B8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    name="Benchmark"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Strategy Performance Summary (1 col) */}
        <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/70">
              <h3 className="text-base font-bold text-navy font-display">
                Strategy Performance
              </h3>
              <span className="text-[11px] font-mono text-primary font-bold bg-primary-light px-2 py-0.5 rounded-full">
                ERV Ranked
              </span>
            </div>

            <div className="space-y-4">
              {data.strategyPerformance.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <p className="font-semibold text-navy">No strategy metrics yet</p>
                  <p className="text-[11px] text-slate-400 mt-1">Autonomous workflows will rank strategies as live recoveries occur.</p>
                </div>
              ) : (
                data.strategyPerformance.map((strat) => (
                  <div key={strat.strategyKey} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-navy truncate max-w-[170px]" title={strat.strategy}>
                        {strat.strategy}
                      </span>
                      <span className="font-bold text-primary">{strat.recoveryRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${strat.recoveryRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>{strat.successCount} of {strat.attempts} recovered</span>
                      <span>₹{(strat.recoveredAmount / 1000).toFixed(0)}k volume</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border/70 mt-4 text-center">
            <Link
              to="/agent"
              className="text-xs font-bold text-primary hover:text-primary-hover inline-flex items-center gap-1"
            >
              <span>View Recovery Strategies</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Table: At-Risk Transactions */}
      <div className="space-y-3.5">
        <SectionHeader
          title="At-Risk Transactions & Interventions"
          subtitle="Real-time queue of payment drop-offs scored by recovery likelihood"
          actions={
            <Link
              to="/transactions"
              className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5"
            >
              <span>View All Transactions</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
        <TransactionTable transactions={transactions} />
      </div>

      {/* Two Column Layout: Recent Agent Activity & Channel/Failure Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Agent Activity Timeline (2 cols) */}
        <div className="lg:col-span-2 bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/70">
            <div>
              <h3 className="text-base font-bold text-navy font-display">
                Recent Agent Activity & Decisions
              </h3>
              <p className="text-xs text-slate-500">
                Autonomous diagnostics, expected recovery calculations, and dispatched actions
              </p>
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-200">
              Live Feed
            </span>
          </div>

          <DecisionTimeline activities={data.recentActivities} />
        </div>

        {/* Breakdowns Column (1 col) */}
        <div className="space-y-6">
          {/* Payment Method Breakdown */}
          <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card">
            <h3 className="text-base font-bold text-navy font-display mb-1">
              Payment Rail Recovery
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Performance by payment method
            </p>

            <div className="space-y-3">
              {data.paymentBreakdown.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <p className="font-medium text-navy">No payment rail data</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Payment methods will appear once transactions are initiated.</p>
                </div>
              ) : (
                data.paymentBreakdown.map((item) => (
                  <div key={item.method} className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 border border-border/70">
                    <div className="flex items-center gap-2.5">
                      <CreditCard className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-navy">{item.method}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-right">
                      <span className="text-slate-500 text-[11px]">
                        <MoneyValue amount={item.recoveredAmount} compact />
                      </span>
                      <span className="font-bold text-emerald-600 tabular-nums">
                        {item.recoveryRate}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Failure Reasons Breakdown */}
          <div className="bg-surface rounded-2xl border border-border/80 p-6 shadow-fintech-card">
            <h3 className="text-base font-bold text-navy font-display mb-1">
              Failure Root Causes
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Top drop-off triggers & recovery efficiency
            </p>

            <div className="space-y-3.5">
              {data.failureReasons.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <p className="font-medium text-navy">No failure drop-offs</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Pipeline is currently clear of failed checkouts.</p>
                </div>
              ) : (
                data.failureReasons.map((reason) => (
                  <div key={reason.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-navy truncate max-w-[170px]" title={reason.label}>
                        {reason.label}
                      </span>
                      <span className="text-primary font-mono font-bold text-[11px]">
                        {reason.recoveryRate}% Rec
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${reason.recoveryRate}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
