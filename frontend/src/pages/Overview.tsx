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
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts'
import { Link } from 'react-router-dom'
import { useRealtime } from '../lib/useRealtime'

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
      const [dash, txRes] = await Promise.all([
        api.getDashboard(),
        api.getTransactions({ limit: 10 })
      ])
      setData(dash)
      setTransactions(txRes.items)
    } catch (e: any) {
      if (!silent) setError(e.message || 'Failed to connect to RecoverAI API')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // Live update when payment or recovery webhook event is broadcast
    const unsubscribe = subscribe('*', () => {
      loadData(true)
    })
    return unsubscribe
  }, [subscribe])

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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <SkeletonLoader variant="card" count={4} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonLoader variant="chart" count={1} className="lg:col-span-2" />
          <SkeletonLoader variant="card" count={1} />
        </div>
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
          <h1 className="text-2xl font-bold text-graphite tracking-tight font-display">
            Autonomous Revenue Recovery
          </h1>
          <p className="text-xs text-warm-gray-600 mt-1">
            Real-time failed payment diagnosis, propensity scoring, and ERV-optimized intervention workflows.
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
          subtitle="Across active failed events"
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
          subtitle="Net attributable recovered"
          icon={CheckCircle2}
          highlightColor="moss-green"
        />

        <MetricCard
          title="Recovery Rate"
          value={`${data.metrics.recoveryRate}%`}
          delta={{
            value: data.metrics.recoveryRateDeltaPercent,
            label: 'conversion lift'
          }}
          subtitle="Industry benchmark: 18.2%"
          icon={Percent}
          highlightColor="moss-green"
        />

        <MetricCard
          title="Active Recoveries"
          value={data.metrics.activeRecoveries.toString()}
          delta={{
            value: data.metrics.activeDeltaCount,
            label: 'active loops'
          }}
          subtitle="Real-time agent pipelines"
          icon={Zap}
          highlightColor="muted-amber"
        />
      </div>

      {/* Charts Row: Recovery Trend & Strategy Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart (2 cols) */}
        <div className="lg:col-span-2 bg-surface rounded-md border border-border p-5 shadow-fintech-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-graphite font-display">
                Revenue Recovery Velocity & Trajectory
              </h3>
              <p className="text-xs text-warm-gray-500">
                At-risk volume vs. agent-recovered revenue over time
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-burnt-orange" />
                <span className="text-warm-gray-600">At Risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-moss-green" />
                <span className="text-warm-gray-600">Recovered</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAtRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D95D39" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#D95D39" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorRecovered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3F725B" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#3F725B" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DDD8CE" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#77736B' }} tickLine={false} axisLine={{ stroke: '#DDD8CE' }} />
                <YAxis tick={{ fontSize: 11, fill: '#77736B' }} tickLine={false} axisLine={{ stroke: '#DDD8CE' }} tickFormatter={(val) => `₹${val / 1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="atRisk" stroke="#D95D39" strokeWidth={2} fillOpacity={1} fill="url(#colorAtRisk)" />
                <Area type="monotone" dataKey="recovered" stroke="#3F725B" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRecovered)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Strategy Performance Breakdown (1 col) */}
        <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card flex flex-col justify-between">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-graphite font-display">
              Recovery Strategy Performance
            </h3>
            <p className="text-xs text-warm-gray-500">
              Conversion rate by autonomous action
            </p>
          </div>

          <div className="space-y-3.5">
            {data.strategyPerformance.map((strat) => (
              <div key={strat.strategyKey} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-graphite truncate max-w-[160px]">
                    {strat.strategy}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-moss-green font-bold tabular-nums">
                      {strat.recoveryRate.toFixed(1)}%
                    </span>
                    <span className="text-warm-gray-400 text-[11px]">
                      (<MoneyValue amount={strat.recoveredAmount} compact />)
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-warm-gray-200 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-moss-green transition-all duration-300"
                    style={{ width: `${strat.recoveryRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border mt-3 text-center">
            <Link
              to="/agent"
              className="text-xs font-semibold text-burnt-orange hover:text-burnt-orange-dark inline-flex items-center gap-1"
            >
              <span>Inspect Agent Policy Weights</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Table: At-Risk Transactions */}
      <div className="space-y-3">
        <SectionHeader
          title="At-Risk Transactions & Interventions"
          subtitle="Real-time live queue of payment drop-offs scored by recovery propensity"
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
                Autonomous diagnostics, ERV score calculations, and dispatched actions
              </p>
            </div>
            <span className="px-2 py-0.5 bg-moss-green-light text-moss-green-dark text-[11px] font-medium rounded-sm border border-moss-green/30">
              Live Stream
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
