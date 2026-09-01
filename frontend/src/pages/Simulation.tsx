import React, { useState, useEffect, useMemo } from 'react'
import { SectionHeader } from '../components/common/SectionHeader'
import { MoneyValue } from '../components/common/MoneyValue'
import { MetricCard } from '../components/common/MetricCard'
import { MethodologyModal } from '../components/simulation/MethodologyModal'
import {
  api,
  SimulationControls,
  SimulationPreset,
  BatchSimulationResponse,
  MethodologyDoc
} from '../services/api'
import {
  Play,
  RefreshCw,
  HelpCircle,
  AlertTriangle,
  XCircle,
  UserCheck,
  Scale,
  Search,
  ArrowUpRight,
  Sparkles,
  Sliders,
  FileSpreadsheet,
  FileCode
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts'

export const Simulation: React.FC = () => {
  // Presets & Methodology state
  const [presets, setPresets] = useState<SimulationPreset[]>([])
  const [methodology, setMethodology] = useState<MethodologyDoc | null>(null)
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false)
  const [activePresetId, setActivePresetId] = useState<string>('ecommerce_sale')

  // Simulation Controls state
  const [controls, setControls] = useState<SimulationControls>({
    num_transactions: 250,
    merchant_category: 'E-Commerce & Retail',
    payment_methods_dist: {
      UPI: 0.65,
      CARD: 0.20,
      NET_BANKING: 0.10,
      WALLET: 0.05
    },
    failure_rate: 0.22,
    abandonment_rate: 0.28,
    average_order_value: 2400.0,
    seed: 42,
    preset_name: 'E-commerce Sale Day'
  })

  // Execution & Results state
  const [isRunning, setIsRunning] = useState(false)
  const [simulationData, setSimulationData] = useState<BatchSimulationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null)

  // Transactions Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'RECOVERED' | 'FAILED' | 'ESCALATED'>('ALL')

  // Load presets & methodology on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [presetsData, methData] = await Promise.all([
          api.getSimulationPresets().catch(() => []),
          api.getSimulationMethodology().catch(() => null)
        ])
        if (presetsData.length > 0) {
          setPresets(presetsData)
          const def = presetsData.find(p => p.id === 'ecommerce_sale') || presetsData[0]
          setActivePresetId(def.id)
          setControls(def.controls)
        }
        if (methData) {
          setMethodology(methData)
        }
      } catch (err) {
        console.warn('Initial presets load warning:', err)
      }
    }
    loadInitialData()
  }, [])

  // Auto-run default simulation once controls are initialized
  useEffect(() => {
    if (presets.length > 0 && !simulationData && !isRunning) {
      handleRunSimulation(controls)
    }
  }, [presets])

  // Select Preset Handler
  const handleSelectPreset = (preset: SimulationPreset) => {
    setActivePresetId(preset.id)
    setControls({
      ...preset.controls,
      preset_name: preset.name
    })
  }

  // Run Simulation Handler
  const handleRunSimulation = async (simControls: SimulationControls) => {
    setIsRunning(true)
    setError(null)
    const startTime = performance.now()
    try {
      const response = await api.runBatchSimulation(simControls)
      setSimulationData(response)
      setExecutionTimeMs(Math.round(performance.now() - startTime))
    } catch (err: any) {
      console.error('Simulation execution failed:', err)
      setError(err.message || 'Simulation execution failed. Ensure backend service is active.')
    } finally {
      setIsRunning(false)
    }
  }

  // Randomize Seed Handler
  const handleRandomizeSeed = () => {
    const newSeed = Math.floor(Math.random() * 90000) + 1000
    setControls(prev => ({ ...prev, seed: newSeed }))
  }

  // CSV Report Generator
  const downloadCSVReport = () => {
    if (!simulationData) return

    const summaryHeaders = [
      'SIMULATION SUMMARY',
      'SIMULATED TEST DATA ONLY',
      `ID: ${simulationData.simulation_id}`,
      `Seed: ${simulationData.seed}`,
      `Executed: ${simulationData.executed_at}`,
      `Transactions: ${simulationData.total_transactions_count}`,
      `Total GMV: INR ${simulationData.total_gmv}`,
      `Revenue At Risk: INR ${simulationData.revenue_at_risk}`,
      `RecoverAI Recovered: INR ${simulationData.recoverai_recovered_revenue}`,
      `RecoverAI Rate: ${simulationData.recoverai_recovery_rate}%`,
      `Baseline Recovered: INR ${simulationData.baseline_recovered_revenue}`,
      `Baseline Rate: ${simulationData.baseline_recovery_rate}%`,
      `Incremental Recovered: INR ${simulationData.incremental_revenue_recovered}`,
      `Relative Improvement: ${simulationData.relative_improvement_percent}%`
    ]

    const txHeaders = [
      'Transaction ID',
      'Customer Name',
      'Tier',
      'Amount (INR)',
      'Method',
      'Bank',
      'Failure Reason',
      'Failure Category',
      'RecoverAI Action',
      'RecoverAI ERV',
      'RecoverAI Probability',
      'RecoverAI Recovered',
      'RecoverAI Net Value',
      'Baseline Action',
      'Baseline Recovered',
      'Guardrail Status'
    ]

    const rows = simulationData.transactions_sample.map(tx => [
      tx.id,
      `"${tx.customer_name}"`,
      tx.customer_tier,
      tx.amount,
      tx.payment_method,
      `"${tx.bank}"`,
      tx.failure_reason || 'N/A',
      tx.failure_category || 'N/A',
      tx.recoverai_action,
      tx.recoverai_erv,
      tx.recoverai_probability,
      tx.recoverai_recovered ? 'YES' : 'NO',
      tx.recoverai_net_value,
      tx.baseline_action,
      tx.baseline_recovered ? 'YES' : 'NO',
      tx.recoverai_guardrail_status
    ])

    const csvContent = [
      summaryHeaders.join('\n'),
      '\n--- SIMULATED TRANSACTIONS SAMPLE ---',
      txHeaders.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `recoverai_simulation_${simulationData.seed}_report.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // JSON Report Generator
  const downloadJSONReport = () => {
    if (!simulationData) return
    const blob = new Blob([JSON.stringify(simulationData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `recoverai_simulation_${simulationData.seed}_report.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtered transactions for explorer table
  const filteredTransactions = useMemo(() => {
    if (!simulationData) return []
    return simulationData.transactions_sample.filter(tx => {
      const matchesSearch =
        tx.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.failure_reason && tx.failure_reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
        tx.recoverai_action.toLowerCase().includes(searchTerm.toLowerCase())

      if (!matchesSearch) return false

      if (outcomeFilter === 'RECOVERED') return tx.recoverai_recovered
      if (outcomeFilter === 'FAILED') return !tx.recoverai_recovered
      if (outcomeFilter === 'ESCALATED') return tx.is_human_escalation
      return true
    })
  }, [simulationData, searchTerm, outcomeFilter])

  return (
    <div className="space-y-6">
      {/* Prominent Simulated Test Data Warning Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs font-mono uppercase tracking-wider text-amber-800 dark:text-amber-200">
                SIMULATED TEST DATA ONLY
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-mono bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xs">
                Zero Razorpay Production Impact
              </span>
            </div>
            <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80">
              Synthetic transactions evaluated through recovery likelihood models, ERV valuation, and safety controls to measure business value.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsMethodologyOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-warm-gray-100 border border-border text-graphite rounded-sm text-xs font-medium transition-colors shadow-2xs"
        >
          <HelpCircle className="w-3.5 h-3.5 text-burnt-orange" />
          <span>Methodology & Assumptions</span>
        </button>
      </div>

      {/* Section Header with Actions */}
      <SectionHeader
        title="Batch Recovery Simulator & Value Prover"
        subtitle="Benchmark RecoverAI's autonomous intelligence against traditional baseline dunning on large synthetic transaction cohorts"
        actions={
          <div className="flex items-center gap-2">
            {simulationData && (
              <>
                <button
                  type="button"
                  onClick={downloadJSONReport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-warm-gray-100 border border-border text-graphite rounded-sm text-xs font-medium transition-colors shadow-2xs"
                  title="Download full simulation report in JSON format"
                >
                  <FileCode className="w-3.5 h-3.5 text-warm-gray-500" />
                  <span>Report (JSON)</span>
                </button>
                <button
                  type="button"
                  onClick={downloadCSVReport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-warm-gray-100 border border-border text-graphite rounded-sm text-xs font-medium transition-colors shadow-2xs"
                  title="Download line-item transaction audit in CSV format"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-moss-green" />
                  <span>Report (CSV)</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => handleRunSimulation(controls)}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-sm text-xs font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange disabled:opacity-50"
            >
              {isRunning ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{isRunning ? 'Simulating Batch...' : 'Run Simulation'}</span>
            </button>
          </div>
        }
      />

      {/* Preset Scenarios Selector Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-warm-gray-500 font-medium">
          <span className="uppercase tracking-wider font-display text-[10px] font-bold">
            Industry Scenario Presets
          </span>
          {executionTimeMs !== null && (
            <span className="font-mono text-[10px] text-warm-gray-400">
              Evaluated in {executionTimeMs}ms via batch recovery simulation
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(presets.length > 0 ? presets : [
            {
              id: 'ecommerce_sale',
              name: 'E-commerce Sale Day',
              description: 'Festive shopping traffic with heavy UPI, cart drop-offs, switch latency.',
              badge: 'High Volume',
              controls: {
                ...controls,
                payment_methods_dist: { UPI: 0.2, CARD: 0.65, NET_BANKING: 0.15 }
              }
            },
            {
              id: 'saas_recurring',
              name: 'SaaS Subscription Cycle',
              description: 'Recurring renewals with high card share, limits, and 3DS timeouts.',
              badge: 'High AOV',
              controls: {
                ...controls,
                payment_methods_dist: { UPI: 0.2, CARD: 0.65, NET_BANKING: 0.15 }
              }
            },
            {
              id: 'flash_sale_spike',
              name: 'Flash Drop Outage',
              description: 'High concurrency timeout scenario with gateway switch failover.',
              badge: 'Stress Test',
              controls: {
                ...controls,
                volume: 500,
                failure_distribution: {
                  AUTHENTICATION_FAILED: 0.15,
                  INSUFFICIENT_FUNDS: 0.10,
                  BANK_TIMEOUT: 0.45,
                  GATEWAY_ERROR: 0.20,
                  FRAUD_BLOCKED: 0.05,
                  CARD_EXPIRED: 0.05
                }
              }
            },
            {
              id: 'upi_heavy_retail',
              name: 'UPI Quick Commerce',
              description: 'Micro-transactions with 80% UPI share and high customer sensitivity to app drop-offs.',
              badge: 'Fast Intent',
              controls: {
                ...controls,
                payment_methods_dist: { UPI: 0.8, CARD: 0.1, NET_BANKING: 0.1 }
              }
            }
          ]).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset as SimulationPreset)}
              className={`p-3.5 rounded-md border text-left transition-all ${
                activePresetId === preset.id
                  ? 'border-burnt-orange bg-burnt-orange-subtle/40 shadow-xs'
                  : 'border-border bg-surface hover:bg-warm-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-semibold text-xs text-graphite font-display">
                  {preset.name}
                </span>
                <span className="px-1.5 py-0.2 rounded-xs text-[10px] font-mono bg-warm-gray-200 text-warm-gray-800">
                  {preset.badge}
                </span>
              </div>
              <p className="text-[11px] text-warm-gray-500 line-clamp-2">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Simulator Controls Drawer / Accordion */}
      <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-burnt-orange" />
            <h3 className="text-xs font-bold text-graphite font-display uppercase tracking-wider">
              Simulation Parameters & Cohort Generation
            </h3>
          </div>
          <button
            type="button"
            onClick={handleRandomizeSeed}
            className="text-[11px] text-burnt-orange hover:text-burnt-orange-dark font-medium flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Randomize Seed</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Number of Transactions */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-warm-gray-600">Transaction Volume</label>
              <span className="font-mono font-bold text-graphite">{controls.num_transactions} txs</span>
            </div>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={controls.num_transactions}
              onChange={(e) => setControls(prev => ({ ...prev, num_transactions: parseInt(e.target.value) }))}
              className="w-full accent-burnt-orange cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-warm-gray-400 font-mono">
              <span>50</span>
              <span>500</span>
              <span>1000</span>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-warm-gray-600">Average Order Value (AOV)</label>
              <span className="font-mono font-bold text-graphite"><MoneyValue amount={controls.average_order_value} /></span>
            </div>
            <input
              type="range"
              min="200"
              max="30000"
              step="200"
              value={controls.average_order_value}
              onChange={(e) => setControls(prev => ({ ...prev, average_order_value: parseFloat(e.target.value) }))}
              className="w-full accent-burnt-orange cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-warm-gray-400 font-mono">
              <span>₹200</span>
              <span>₹15,000</span>
              <span>₹30,000</span>
            </div>
          </div>

          {/* Payment Failure Rate */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-warm-gray-600">Payment Failure Rate</label>
              <span className="font-mono font-bold text-burnt-orange">{Math.round(controls.failure_rate * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.45"
              step="0.01"
              value={controls.failure_rate}
              onChange={(e) => setControls(prev => ({ ...prev, failure_rate: parseFloat(e.target.value) }))}
              className="w-full accent-burnt-orange cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-warm-gray-400 font-mono">
              <span>5%</span>
              <span>25%</span>
              <span>45%</span>
            </div>
          </div>

          {/* Cart Abandonment Rate */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-warm-gray-600">Cart Abandonment Rate</label>
              <span className="font-mono font-bold text-muted-amber">{Math.round(controls.abandonment_rate * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.55"
              step="0.01"
              value={controls.abandonment_rate}
              onChange={(e) => setControls(prev => ({ ...prev, abandonment_rate: parseFloat(e.target.value) }))}
              className="w-full accent-burnt-orange cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-warm-gray-400 font-mono">
              <span>5%</span>
              <span>30%</span>
              <span>55%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/60 text-xs">
          {/* Merchant Category */}
          <div className="space-y-1">
            <label className="font-medium text-warm-gray-600">Merchant Category</label>
            <select
              value={controls.merchant_category}
              onChange={(e) => setControls(prev => ({ ...prev, merchant_category: e.target.value }))}
              className="w-full px-3 py-1.5 bg-surface border border-border rounded-sm text-graphite font-medium focus:ring-1 focus:ring-burnt-orange focus:outline-none"
            >
              <option value="E-Commerce & Retail">E-Commerce & Retail</option>
              <option value="SaaS & Cloud Services">SaaS & Cloud Services</option>
              <option value="Quick Commerce & Food">Quick Commerce & Food</option>
              <option value="Travel & Hospitality">Travel & Hospitality</option>
              <option value="EdTech & Learning">EdTech & Learning</option>
              <option value="Utilities & Telecom">Utilities & Telecom</option>
            </select>
          </div>

          {/* Payment Method Distribution */}
          <div className="space-y-1">
            <label className="font-medium text-warm-gray-600">Payment Rails Mix (UPI / Card / NetBanking)</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-warm-gray-50 border border-border rounded-sm px-2 py-1 flex items-center justify-between text-[11px] font-mono">
                <span className="text-warm-gray-500">UPI:</span>
                <span className="font-bold">{Math.round(controls.payment_methods_dist.UPI * 100)}%</span>
              </div>
              <div className="flex-1 bg-warm-gray-50 border border-border rounded-sm px-2 py-1 flex items-center justify-between text-[11px] font-mono">
                <span className="text-warm-gray-500">Card:</span>
                <span className="font-bold">{Math.round(controls.payment_methods_dist.CARD * 100)}%</span>
              </div>
              <div className="flex-1 bg-warm-gray-50 border border-border rounded-sm px-2 py-1 flex items-center justify-between text-[11px] font-mono">
                <span className="text-warm-gray-500">NB:</span>
                <span className="font-bold">{Math.round(controls.payment_methods_dist.NET_BANKING * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Seed Input */}
          <div className="space-y-1">
            <label className="font-medium text-warm-gray-600">Simulation Seed (Deterministic Reproducibility)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={controls.seed}
                onChange={(e) => setControls(prev => ({ ...prev, seed: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-1.5 bg-surface border border-border rounded-sm font-mono text-graphite focus:ring-1 focus:ring-burnt-orange focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleRunSimulation(controls)}
                disabled={isRunning}
                className="px-3 py-1.5 bg-dark-surface hover:bg-graphite text-surface rounded-sm font-medium whitespace-nowrap text-xs transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error state if any */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* PRIMARY BENCHMARK HERO CARD: BASELINE vs RECOVERAI */}
      {simulationData && (
        <div className="bg-surface rounded-md border border-border overflow-hidden shadow-fintech-card">
          <div className="p-4 bg-dark-surface text-surface flex flex-wrap items-center justify-between border-b border-warm-gray-800 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-sm bg-burnt-orange flex items-center justify-center text-white">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs uppercase tracking-wider font-display text-white">
                  Executive Benchmark: Baseline Dunning vs RecoverAI Autonomous Engine
                </span>
                <span className="text-[11px] text-warm-gray-400 block">
                  Same transactions, same seed ({simulationData.seed}) &mdash; completely differentiated intelligence
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-moss-green/20 border border-moss-green/40 text-moss-green-light rounded-sm font-mono text-xs font-bold flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{simulationData.relative_improvement_percent}% Recovery Uplift</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Left: Baseline Column */}
            <div className="p-5 bg-warm-gray-50/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-warm-gray-500 font-display">
                    TRADITIONAL BASELINE RECOVERY
                  </span>
                  <p className="text-[11px] text-warm-gray-500">1 generic retry + 1 generic reminder email/SMS</p>
                </div>
                <span className="px-2 py-0.5 bg-warm-gray-200 text-warm-gray-700 rounded-xs text-[10px] font-mono">
                  Static Sequence
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] text-warm-gray-500 block">Recovered Revenue</span>
                  <span className="text-xl font-bold font-mono text-graphite">
                    <MoneyValue amount={simulationData.baseline_recovered_revenue} />
                  </span>
                  <span className="text-[10px] text-warm-gray-500 block mt-0.5">
                    {simulationData.baseline_recovery_rate}% capture rate
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-warm-gray-500 block">Net Recovery Value</span>
                  <span className="text-xl font-bold font-mono text-warm-gray-700">
                    <MoneyValue amount={simulationData.baseline_net_recovery_value} />
                  </span>
                  <span className="text-[10px] text-warm-gray-500 block mt-0.5">
                    After ₹{simulationData.baseline_total_cost} messaging costs
                  </span>
                </div>
              </div>

              <div className="p-3 bg-warm-gray-100/80 rounded-sm border border-warm-gray-200 text-[11px] space-y-1 text-warm-gray-600">
                <div className="flex justify-between font-medium">
                  <span>Wasted Blind Retries (Cost):</span>
                  <span className="font-mono text-red-700 font-bold">₹{simulationData.baseline_wasted_retries_cost}</span>
                </div>
                <p className="text-[10px] text-warm-gray-500">
                  Baseline blindly retried expired cards and fraud cases with 0% success, burning gateway fees.
                </p>
              </div>
            </div>

            {/* Right: RecoverAI Column */}
            <div className="p-5 bg-burnt-orange/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-burnt-orange font-display">
                    RECOVERAI AUTONOMOUS ENGINE
                  </span>
                  <p className="text-[11px] text-warm-gray-500">Diagnosis &rarr; Likelihood Model &rarr; ERV &rarr; Guardrails</p>
                </div>
                <span className="px-2 py-0.5 bg-moss-green-light border border-moss-green/30 text-moss-green-dark rounded-xs text-[10px] font-mono font-bold">
                  AI Closed-Loop
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] text-warm-gray-500 block">Recovered Revenue</span>
                  <span className="text-xl font-bold font-mono text-moss-green-dark">
                    <MoneyValue amount={simulationData.recoverai_recovered_revenue} />
                  </span>
                  <span className="text-[10px] text-moss-green font-bold block mt-0.5">
                    {simulationData.recoverai_recovery_rate}% capture rate (+{(simulationData.recoverai_recovery_rate - simulationData.baseline_recovery_rate).toFixed(1)}% pts)
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-warm-gray-500 block">Net Recovery Value</span>
                  <span className="text-xl font-bold font-mono text-graphite">
                    <MoneyValue amount={simulationData.recoverai_net_recovery_value} />
                  </span>
                  <span className="text-[10px] text-moss-green font-bold block mt-0.5">
                    ROI: {simulationData.roi_multiple_recoverai}x yield on fees
                  </span>
                </div>
              </div>

              <div className="p-3 bg-moss-green/10 rounded-sm border border-moss-green/30 text-[11px] space-y-1 text-moss-green-dark">
                <div className="flex justify-between font-bold">
                  <span>Incremental Revenue Gained:</span>
                  <span className="font-mono text-base text-moss-green-dark">
                    +<MoneyValue amount={simulationData.incremental_revenue_recovered} />
                  </span>
                </div>
                <p className="text-[10px] text-warm-gray-600">
                  Prevented customer fatigue, suppressed fraud retries, and routed high-ticket orders via smart links.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Metrics Summary Grid */}
      {simulationData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Transaction GMV"
            value={<MoneyValue amount={simulationData.total_gmv} />}
            subtitle={`${simulationData.total_transactions_count} total generated cohort`}
            highlightColor="default"
          />
          <MetricCard
            title="Revenue At Risk"
            value={<MoneyValue amount={simulationData.revenue_at_risk} />}
            subtitle="Payment declines + cart drops"
            highlightColor="burnt-orange"
          />
          <MetricCard
            title="Net Recovered Revenue"
            value={<MoneyValue amount={simulationData.recoverai_recovered_revenue} />}
            delta={{
              value: simulationData.relative_improvement_percent,
              label: 'vs baseline dunning'
            }}
            highlightColor="moss-green"
          />
          <MetricCard
            title="Safety Guardrail Stops"
            value={simulationData.recoverai_stopped_cases.toString()}
            subtitle={`${simulationData.recoverai_human_escalations} routed to human concierge`}
            highlightColor="muted-amber"
          />
        </div>
      )}

      {/* Simulation Visualizations: Waterfall & Strategy Breakdown */}
      {simulationData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Waterfall Chart */}
          <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-graphite font-display">
                Revenue Attrition & Recovery Waterfall
              </h3>
              <span className="text-[10px] font-mono text-warm-gray-400">Values in INR</span>
            </div>
            <p className="text-xs text-warm-gray-500 mb-4">
              Flow from total GMV to clean authorization, drop-off risk, and net recovery capture
            </p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={simulationData.waterfall}
                  margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DDD8CE" />
                  <XAxis
                    dataKey="stage"
                    tick={{ fontSize: 10, fill: '#77736B' }}
                    angle={-18}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#77736B' }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                    contentStyle={{ backgroundColor: '#24231F', borderColor: '#43403B', color: '#FFFDF8', fontSize: '12px' }}
                  />
                  <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                    {simulationData.waterfall.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recovery Strategy Breakdown */}
          <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-graphite font-display">
                RecoverAI Strategy Performance
              </h3>
              <span className="text-[10px] font-mono text-warm-gray-400">Yield by Action</span>
            </div>
            <p className="text-xs text-warm-gray-500 mb-4">
              Conversion efficiency and monetary return by autonomous intervention channel
            </p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={simulationData.strategy_breakdown}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#DDD8CE" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#77736B' }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="strategy"
                    tick={{ fontSize: 10, fill: '#1E1D1A' }}
                    width={110}
                    tickFormatter={(v) => v.replace(/_/g, ' ')}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      name === 'recovered_amount' ? `₹${Number(val).toLocaleString('en-IN')}` : val,
                      name === 'recovered_amount' ? 'Recovered' : 'Attempts'
                    ]}
                    contentStyle={{ backgroundColor: '#24231F', borderColor: '#43403B', color: '#FFFDF8', fontSize: '12px' }}
                  />
                  <Bar dataKey="recovered_amount" fill="#3F725B" radius={[0, 3, 3, 0]} name="Recovered (₹)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Additional Visualizations: Recovery Over Time & Failure Category */}
      {simulationData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recovery Over Time (Cumulative) */}
          <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-graphite font-display">
                Cumulative Recovery Curve: Baseline vs RecoverAI
              </h3>
              <span className="text-[10px] font-mono text-warm-gray-400">Cohort Timeline</span>
            </div>
            <p className="text-xs text-warm-gray-500 mb-4">
              Real-time recovery acceleration over chronological transaction batch sequence
            </p>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={simulationData.timeline_recovery}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="recaiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3F725B" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3F725B" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C08A3E" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#C08A3E" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DDD8CE" vertical={false} />
                  <XAxis dataKey="hour_label" tick={{ fontSize: 10, fill: '#77736B' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#77736B' }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`]}
                    contentStyle={{ backgroundColor: '#24231F', borderColor: '#43403B', color: '#FFFDF8', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area
                    type="monotone"
                    dataKey="recoverai_cumulative_recovered"
                    name="RecoverAI Cumulative (₹)"
                    stroke="#3F725B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#recaiGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="baseline_cumulative_recovered"
                    name="Baseline Dunning (₹)"
                    stroke="#C08A3E"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#baseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Failure-Category Recovery Rate Comparison */}
          <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-graphite font-display">
                Recovery Rate by Root Cause
              </h3>
              <span className="text-[10px] font-mono text-warm-gray-400">Capture %</span>
            </div>
            <p className="text-xs text-warm-gray-500 mb-4">
              RecoverAI vs Baseline across failure taxonomies
            </p>

            <div className="space-y-3.5">
              {simulationData.category_recovery.map((cat, idx) => (
                <div key={idx} className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-graphite truncate max-w-[130px]">
                      {cat.category.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span className="text-moss-green-dark font-bold">{cat.recoverai_rate}% AI</span>
                      <span className="text-warm-gray-400">vs</span>
                      <span className="text-warm-gray-600">{cat.baseline_rate}% Base</span>
                    </div>
                  </div>

                  {/* Dual Bar */}
                  <div className="h-2 w-full bg-warm-gray-100 rounded-xs overflow-hidden flex gap-0.5">
                    <div
                      className="bg-moss-green h-full rounded-xs transition-all"
                      style={{ width: `${cat.recoverai_rate}%` }}
                      title={`RecoverAI: ${cat.recoverai_rate}%`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Intervention Performance Breakdown Table */}
      {simulationData && (
        <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-graphite font-display">
                Intervention Economics & ROI Multipliers
              </h3>
              <p className="text-xs text-warm-gray-500">
                Detailed financial accounting of channel costs, recovered values, and win rates
              </p>
            </div>
            <span className="px-2 py-0.5 bg-warm-gray-100 text-warm-gray-700 rounded-xs text-[10px] font-mono border border-border">
              Calibrated Decision Costs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-warm-gray-50/60 text-warm-gray-500 uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3">Intervention Strategy</th>
                  <th className="py-2.5 px-3 text-right">Attempt Count</th>
                  <th className="py-2.5 px-3 text-right">Recovered Count</th>
                  <th className="py-2.5 px-3 text-right">Win Rate</th>
                  <th className="py-2.5 px-3 text-right">Recovered Amount</th>
                  <th className="py-2.5 px-3 text-right">Channel Cost</th>
                  <th className="py-2.5 px-3 text-right">Net Value</th>
                  <th className="py-2.5 px-3 text-right">ROI Multiplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {simulationData.strategy_breakdown.map((s, idx) => (
                  <tr key={idx} className="hover:bg-warm-gray-50/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-graphite flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-burnt-orange" />
                      <span>{s.strategy.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-warm-gray-600">{s.attempts}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-graphite font-medium">{s.recovered_count}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-moss-green-dark">{s.win_rate}%</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-graphite">
                      <MoneyValue amount={s.recovered_amount} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-warm-gray-500">₹{s.total_cost.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-moss-green">
                      <MoneyValue amount={s.recovered_amount - s.total_cost} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-burnt-orange">{s.roi_multiplier}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Simulated Transaction Audit Ledger Table */}
      {simulationData && (
        <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-graphite font-display">
                  Simulated Transaction Audit Ledger
                </h3>
                <span className="px-1.5 py-0.2 bg-warm-gray-100 text-[10px] font-mono text-warm-gray-600 rounded-xs border border-border">
                  Sample ({simulationData.transactions_sample.length} txs)
                </span>
              </div>
              <p className="text-xs text-warm-gray-500">
                Inspect individual transaction telemetry, diagnosis root causes, and comparative decision paths
              </p>
            </div>

            {/* Filter & Search */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-warm-gray-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search customer, action..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-surface border border-border rounded-sm text-xs text-graphite focus:outline-none focus:ring-1 focus:ring-burnt-orange w-44"
                />
              </div>

              <select
                value={outcomeFilter}
                onChange={(e: any) => setOutcomeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-surface border border-border rounded-sm text-xs text-graphite focus:outline-none focus:ring-1 focus:ring-burnt-orange"
              >
                <option value="ALL">All Outcomes</option>
                <option value="RECOVERED">Recovered Only</option>
                <option value="FAILED">Unrecovered Only</option>
                <option value="ESCALATED">Human Escalations</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-warm-gray-50/60 text-warm-gray-500 uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3">Order / Customer</th>
                  <th className="py-2.5 px-3">Rail / Bank</th>
                  <th className="py-2.5 px-3">Root Cause</th>
                  <th className="py-2.5 px-3">RecoverAI Action</th>
                  <th className="py-2.5 px-3 text-right">P(rec)</th>
                  <th className="py-2.5 px-3 text-right">ERV</th>
                  <th className="py-2.5 px-3 text-center">Baseline</th>
                  <th className="py-2.5 px-3 text-center">RecoverAI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-warm-gray-50/50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-graphite">{tx.customer_name}</div>
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-warm-gray-500">
                        <span>{tx.id}</span>
                        <span>&bull;</span>
                        <span className="font-bold text-graphite"><MoneyValue amount={tx.amount} /></span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-graphite">{tx.payment_method}</div>
                      <div className="text-[10px] text-warm-gray-500 truncate max-w-[120px]">{tx.bank}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 bg-warm-gray-100 text-warm-gray-700 rounded-xs text-[10px] font-mono border border-border">
                        {tx.failure_reason || (tx.is_abandoned ? 'CART_DROP' : 'DECLINE')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-graphite">
                      <div className="flex items-center gap-1.5">
                        {tx.is_human_escalation ? (
                          <UserCheck className="w-3.5 h-3.5 text-burnt-orange flex-shrink-0" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-moss-green flex-shrink-0" />
                        )}
                        <span className="truncate max-w-[140px]">{tx.recoverai_action.replace(/_/g, ' ')}</span>
                      </div>
                      {tx.recoverai_guardrail_reason && (
                        <div className="text-[9px] text-warm-gray-400 truncate max-w-[150px]" title={tx.recoverai_guardrail_reason}>
                          {tx.recoverai_guardrail_status}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-warm-gray-700">
                      {Math.round(tx.recoverai_probability * 100)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-graphite">
                      ₹{tx.recoverai_erv.toFixed(0)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {tx.baseline_recovered ? (
                        <span className="px-1.5 py-0.5 bg-moss-green/10 text-moss-green-dark border border-moss-green/30 rounded-xs text-[10px] font-mono">
                          RECOVERED
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-warm-gray-100 text-warm-gray-500 rounded-xs text-[10px] font-mono">
                          LOST
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {tx.recoverai_recovered ? (
                        <span className="px-2 py-0.5 bg-moss-green-light text-moss-green-dark border border-moss-green/40 rounded-xs text-[10px] font-mono font-bold">
                          RECOVERED
                        </span>
                      ) : tx.recoverai_action === 'NO_ACTION' ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-xs text-[10px] font-mono font-bold">
                          SUPPRESSED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-300 rounded-xs text-[10px] font-mono font-bold">
                          LOST
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Methodology Modal */}
      <MethodologyModal
        isOpen={isMethodologyOpen}
        onClose={() => setIsMethodologyOpen(false)}
        methodology={methodology}
      />
    </div>
  )
}
