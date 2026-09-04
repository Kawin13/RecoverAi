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
    const unsubscribe = subscribe('*', () => {
      loadData(true)
    })
    return unsubscribe
  }, [timeRange, subscribe])

  // Warm Fintech Tooltip Formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-surface text-surface p-3 rounded-sm border border-warm-gray-700 shadow-fintech-modal text-xs font-mono">
          <p className="font-semibold text-warm-gray-300 mb-1.5 font-display">{label}</p>
          <div className="space-y-1">
            <p className="text-burnt-orange-light flex items-center justify-between gap-4">
              <span>At Risk:</span>
              <span>₹{payload[0]?.value?.toLocaleString('en-IN')}</span>
            </p>
            <p className="text-moss-green-light flex items-center justify-between gap-4">
              <span>Recovered:</span>
              <span className="font-bold">₹{payload[1]?.value?.toLocaleString('en-IN')}</span>
            </p>
          </div>
        </div>
      )
    }
    return null
  }

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
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-graphite tracking-tight font-display">
              Autonomous Revenue Recovery
            </h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold uppercase border tracking-wider shadow-xs ${
              data.dataMode === 'SIMULATED DATA'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : (ENV.DEMO_MODE || data.dataMode === 'Demo Dataset')
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                data.dataMode === 'SIMULATED DATA'
                  ? 'bg-purple-500'
                  : (ENV.DEMO_MODE || data.dataMode === 'Demo Dataset')
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`} />
              {ENV.DEMO_MODE ? 'Demo Data' : (data.dataMode || 'LIVE TEST DATA')}
            </span>
          </div>
          <p className="text-xs text-warm-gray-600 mt-1">
            Real-time failed payment diagnosis, recovery likelihood scoring, and ERV-optimized intervention workflows.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-surface border border-border rounded-sm p-0.5 text-xs">
            {['24h', '7d', '30d'].map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-graphite text-surface shadow-xs'
                    : 'text-warm-gray-600 hover:text-graphite'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>

          <Link
            to="/simulation"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-sm text-xs font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Simulate Failure</span>
          </Link>
        </div>
      </div>

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          highlightColor="burnt-orange"
        />

        <MetricCard
          title="Revenue Recovered"
          value={<MoneyValue amount={data.metrics.revenueRecovered} />}
          delta={{
            value: data.metrics.recoveredDeltaPercent,
            label: 'vs last period'
          }}
          subtitle="Net Attributed"
          icon={CheckCircle2}
          highlightColor="moss-green"
        />

        <MetricCard
          title="Recovery Rate"
          value={`${data.metrics.recoveryRate}%`}
          delta={{
            value: data.metrics.recoveryRateDeltaPercent,
            label: 'percentage points'
          }}
          subtitle="Target 50%+"
          icon={Percent}
          highlightColor="moss-green"
        />

        <MetricCard
          title="Active Recoveries"
          value={data.metrics.activeRecoveries.toString()}
          delta={{
            value: data.metrics.activeDeltaCount,
            label: 'in progress'
          }}
          subtitle="Live Cases"
          icon={Zap}
          highlightColor="muted-amber"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recovery Velocity Chart (2 cols) */}
        <div className="lg:col-span-2 bg-surface rounded-md border border-border p-5 shadow-fintech-card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div>
              <h3 className="text-sm font-bold text-graphite font-display">
                Revenue Recovery Velocity
              </h3>
              <p className="text-xs text-warm-gray-500">
                At-risk revenue vs successfully recovered revenue over time
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-brick-red" />
                <span className="text-warm-gray-600 font-medium">At-Risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-moss-green" />
                <span className="text-warm-gray-600 font-medium">Recovered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 border-t-2 border-dashed border-warm-gray-400" />
                <span className="text-warm-gray-600">Benchmark</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="recoveredGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3F725B" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3F725B" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="atRiskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A6423A" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#A6423A" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#DDD8CE" vertical={false} />
                <XAxis dataKey="date" stroke="#77736B" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#77736B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="atRisk"
                  stroke="#A6423A"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#atRiskGradient)"
                  name="At Risk"
                />
                <Area
                  type="monotone"
                  dataKey="recovered"
                  stroke="#3F725B"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#recoveredGradient)"
                  name="Recovered"
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#77736B"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                  name="Benchmark"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Strategy Performance Summary (1 col) */}
        <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <h3 className="text-sm font-bold text-graphite font-display">
                Strategy Performance
              </h3>
              <span className="text-[11px] font-mono text-warm-gray-500">ERV Ranked</span>
            </div>

            <div className="space-y-3.5">
              {data.strategyPerformance.map((strat) => (
                <div key={strat.strategyKey} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-graphite truncate max-w-[170px]" title={strat.strategy}>
                      {strat.strategy}
                    </span>
                    <span className="font-bold text-moss-green-dark">{strat.recoveryRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-warm-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-moss-green rounded-full transition-all duration-500"
                      style={{ width: `${strat.recoveryRate}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-warm-gray-500">
                    <span>{strat.successCount} of {strat.attempts} recovered</span>
                    <span>₹{(strat.recoveredAmount / 1000).toFixed(0)}k volume</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-border mt-3 text-center">
            <Link
              to="/agent"
              className="text-xs font-semibold text-burnt-orange hover:text-burnt-orange-dark inline-flex items-center gap-1"
            >
              <span>View Recovery Strategies</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Table: At-Risk Transactions */}
      <div className="space-y-3">
        <SectionHeader
          title="At-Risk Transactions & Interventions"
          subtitle="Real-time queue of payment drop-offs scored by recovery likelihood"
          actions={
            <Link
              to="/transactions"
              className="text-xs font-medium text-graphite hover:text-burnt-orange inline-flex items-center gap-1"
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
        <div className="lg:col-span-2 bg-surface rounded-md border border-border p-5 shadow-fintech-card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div>
              <h3 className="text-sm font-bold text-graphite font-display">
                Recent Agent Activity & Decisions
              </h3>
              <p className="text-xs text-warm-gray-500">
                Autonomous diagnostics, expected recovery calculations, and dispatched actions
              </p>
            </div>
            <span className="px-2 py-0.5 bg-moss-green-light text-moss-green-dark text-[11px] font-medium rounded-sm border border-moss-green/30">
              Live Updates
            </span>
          </div>

          <DecisionTimeline activities={data.recentActivities} />
        </div>

        {/* Breakdowns Column (1 col) */}
        <div className="space-y-6">
          {/* Payment Method Breakdown */}
          <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card">
            <h3 className="text-sm font-bold text-graphite font-display mb-1">
              Payment Method Recovery Rate
            </h3>
            <p className="text-xs text-warm-gray-500 mb-3">
              Performance by payment rail
            </p>

            <div className="space-y-2.5">
              {data.paymentBreakdown.map((item) => (
                <div key={item.method} className="flex items-center justify-between text-xs p-2 rounded-sm bg-warm-gray-50 border border-border">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-warm-gray-500" />
                    <span className="font-medium text-graphite">{item.method}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-right">
                    <span className="text-warm-gray-500 text-[11px]">
                      <MoneyValue amount={item.recoveredAmount} compact />
                    </span>
                    <span className="font-semibold text-moss-green tabular-nums">
                      {item.recoveryRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Failure Reasons Breakdown */}
          <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card">
            <h3 className="text-sm font-bold text-graphite font-display mb-1">
              Failure Root Causes
            </h3>
            <p className="text-xs text-warm-gray-500 mb-3">
              Top drop-off triggers & recovery efficiency
            </p>

            <div className="space-y-2.5">
              {data.failureReasons.map((reason) => (
                <div key={reason.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-graphite truncate max-w-[170px]" title={reason.label}>
                      {reason.label}
                    </span>
                    <span className="text-moss-green font-mono font-semibold text-[11px]">
                      {reason.recoveryRate}% Rec
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-warm-gray-200 rounded-xs overflow-hidden">
                    <div
                      className="h-full bg-burnt-orange transition-all duration-300"
                      style={{ width: `${reason.recoveryRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
