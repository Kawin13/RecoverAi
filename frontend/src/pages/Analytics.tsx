import React from 'react'
import { SectionHeader } from '../components/common/SectionHeader'
import { MetricCard } from '../components/common/MetricCard'
import { MoneyValue } from '../components/common/MoneyValue'
import { mockMetrics, mockStrategyPerformance } from '../data/mockData'
import { TrendingUp, DollarSign, Clock, CheckCircle } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts'

export const Analytics: React.FC = () => {
  const channelData = mockStrategyPerformance.map(s => ({
    name: s.strategy.split('(')[0],
    rate: s.recoveryRate,
    recovered: s.recoveredAmount,
  }))

  const hourlyData = [
    { hour: '00:00', recoveries: 12, rate: 58 },
    { hour: '04:00', recoveries: 8, rate: 64 },
    { hour: '08:00', recoveries: 34, rate: 76 },
    { hour: '12:00', recoveries: 52, rate: 81 },
    { hour: '16:00', recoveries: 48, rate: 74 },
    { hour: '20:00', recoveries: 30, rate: 66 },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Revenue Recovery Performance Analytics"
        subtitle="Cohort analysis, channel conversion efficiency, and financial return on recovery interventions"
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Total Net Recovered"
          value={<MoneyValue amount={mockMetrics.revenueRecovered} />}
          delta={{ value: 18.6, label: 'MoM growth' }}
          highlightColor="moss-green"
          icon={TrendingUp}
        />
        <MetricCard
          title="Average Recovery ROI"
          value="42.8x"
          subtitle="Net recovered vs messaging cost"
          highlightColor="moss-green"
          icon={DollarSign}
        />
        <MetricCard
          title="Median Time-to-Recover"
          value="4.6 mins"
          subtitle="92% recovered under 15m"
          highlightColor="burnt-orange"
          icon={Clock}
        />
        <MetricCard
          title="Total Successful Captures"
          value="586"
          subtitle="Across 868 failed events"
          highlightColor="muted-amber"
          icon={CheckCircle}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strategy Conversion Bar Chart */}
        <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card">
          <h3 className="text-sm font-bold text-graphite font-display mb-1">
            Recovery Rate by Strategy (%)
          </h3>
          <p className="text-xs text-warm-gray-500 mb-4">
            Direct conversion comparison across autonomous channels
          </p>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#DDD8CE" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#77736B' }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#1E1D1A' }} width={120} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Recovery Rate']}
                  contentStyle={{ backgroundColor: '#24231F', borderColor: '#43403B', color: '#FFFDF8', fontSize: '12px' }}
                />
                <Bar dataKey="rate" fill="#3F725B" radius={[0, 3, 3, 0]}>
                  {channelData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#3F725B' : index === 1 ? '#D95D39' : '#C08A3E'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Volume & Recovery Rate */}
        <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card">
          <h3 className="text-sm font-bold text-graphite font-display mb-1">
            Recovery Effectiveness by Time of Day
          </h3>
          <p className="text-xs text-warm-gray-500 mb-4">
            Hourly distribution of successful payment captures
          </p>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DDD8CE" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#77736B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#77736B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#24231F', borderColor: '#43403B', color: '#FFFDF8', fontSize: '12px' }}
                />
                <Bar dataKey="recoveries" fill="#D95D39" radius={[3, 3, 0, 0]} name="Recovered Transactions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
