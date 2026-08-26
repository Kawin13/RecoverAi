import React, { useState } from 'react'
import { SectionHeader } from '../components/common/SectionHeader'
import { MoneyValue } from '../components/common/MoneyValue'
import {
  Play,
  CheckCircle2,
  RefreshCw
} from 'lucide-react'

interface Scenario {
  id: string
  title: string
  customer: string
  amount: number
  method: 'Card' | 'UPI' | 'NetBanking'
  errorReason: string
  errorCategory: string
  expectedWinner: string
  erv: number
  probability: number
  generatedMessage: string
}

export const Simulation: React.FC = () => {
  const scenarios: Scenario[] = [
    {
      id: 'scen_1',
      title: 'HDFC Card 3DS OTP Expiry',
      customer: 'Aakash Verma (Enterprise LTV ₹1,40,000)',
      amount: 28999,
      method: 'Card',
      errorReason: 'Customer timed out on 3DS OTP verification page',
      errorCategory: 'AUTHENTICATION_FAILED',
      expectedWinner: 'Dynamic 1-Click Paylink (SMS + Email)',
      erv: 25519,
      probability: 0.88,
      generatedMessage: 'Hi Aakash, your order #ORD-77124 was paused due to OTP expiry. Resume securely with 1-click: https://pay.recov.ai/pl_77124 (valid 30 mins).'
    },
    {
      id: 'scen_2',
      title: 'SBI UPI Switch Outage / Latency Spike',
      customer: 'Divya Nair (VIP LTV ₹3,20,000)',
      amount: 45000,
      method: 'UPI',
      errorReason: 'NPCI SBI UPI Switch response timeout > 12,000ms',
      errorCategory: 'BANK_TIMEOUT',
      expectedWinner: 'UPI Intent Fallback (Auto-route to secondary PSP)',
      erv: 42300,
      probability: 0.94,
      generatedMessage: 'SBI UPI is experiencing network latency. Tap here to instantly complete via GPay / PhonePe with zero re-entry: https://pay.recov.ai/upi_fallback_89'
    },
    {
      id: 'scen_3',
      title: 'Corporate Card Limit Exceeded',
      customer: 'TechMatrix Global (Growth LTV ₹85,000)',
      amount: 112000,
      method: 'Card',
      errorReason: 'Daily transaction limit exceeded on card',
      errorCategory: 'INSUFFICIENT_FUNDS',
      expectedWinner: 'Timed Smart Retry + Split Payment Option',
      erv: 69440,
      probability: 0.62,
      generatedMessage: 'Your corporate card limit was reached for Invoice #INV-4410. Pay via corporate NetBanking or schedule split-charge here: https://pay.recov.ai/split_4410'
    },
    {
      id: 'scen_4',
      title: 'Cart Abandoned at Checkout Final Step',
      customer: 'Rohit Sharma (Standard LTV ₹15,000)',
      amount: 8499,
      method: 'UPI',
      errorReason: 'Customer dropped at payment selection without error code',
      errorCategory: 'CHECKOUT_ABANDONED',
      expectedWinner: 'WhatsApp Concierge + 5% Fee Waiver',
      erv: 6459,
      probability: 0.76,
      generatedMessage: 'Hey Rohit, your items are reserved! Complete checkout now with ₹250 instant festival savings: https://pay.recov.ai/wa_8499'
    }
  ]

  const [selectedScenario, setSelectedScenario] = useState<Scenario>(scenarios[0])
  const [simulationState, setSimulationState] = useState<'IDLE' | 'INGESTING' | 'DIAGNOSING' | 'OPTIMIZING' | 'DISPATCHED' | 'RECOVERED'>('IDLE')
  const [activeStep, setActiveStep] = useState<number>(0)

  const runSimulation = () => {
    setSimulationState('INGESTING')
    setActiveStep(1)

    setTimeout(() => {
      setSimulationState('DIAGNOSING')
      setActiveStep(2)
    }, 700)

    setTimeout(() => {
      setSimulationState('OPTIMIZING')
      setActiveStep(3)
    }, 1400)

    setTimeout(() => {
      setSimulationState('DISPATCHED')
      setActiveStep(4)
    }, 2100)

    setTimeout(() => {
      setSimulationState('RECOVERED')
      setActiveStep(5)
    }, 3000)
  }

  const resetSimulation = () => {
    setSimulationState('IDLE')
    setActiveStep(0)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Payment Recovery Simulator Sandbox"
        subtitle="Trigger synthetic failure webhooks and watch RecoverAI execute real-time diagnosis, ERV scoring, and autonomous recovery"
        actions={
          <div className="flex items-center gap-2">
            {simulationState !== 'IDLE' && (
              <button
                type="button"
                onClick={resetSimulation}
                className="px-3 py-1.5 bg-surface hover:bg-warm-gray-100 border border-border text-graphite rounded-sm text-xs font-medium transition-colors"
              >
                Reset Sandbox
              </button>
            )}
            <button
              type="button"
              onClick={runSimulation}
              disabled={simulationState !== 'IDLE' && simulationState !== 'RECOVERED'}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-sm text-xs font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange disabled:opacity-50"
            >
              {simulationState !== 'IDLE' && simulationState !== 'RECOVERED' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Run Live Simulation</span>
            </button>
          </div>
        }
      />

      {/* Scenario Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {scenarios.map((scen) => (
          <div
            key={scen.id}
            onClick={() => {
              setSelectedScenario(scen)
              resetSimulation()
            }}
            className={`p-3.5 rounded-md border text-xs cursor-pointer transition-all ${
              selectedScenario.id === scen.id
                ? 'bg-surface border-burnt-orange shadow-fintech-card ring-1 ring-burnt-orange/30'
                : 'bg-surface/70 border-border hover:border-warm-gray-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-graphite font-display">{scen.title}</span>
              <span className="font-mono font-bold text-graphite"><MoneyValue amount={scen.amount} /></span>
            </div>
            <p className="text-[11px] text-warm-gray-500 line-clamp-2">{scen.errorReason}</p>
          </div>
        ))}
      </div>

      {/* Simulation Stage Progress Tracker */}
      <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card">
        <h3 className="text-xs font-bold text-warm-gray-500 uppercase tracking-wider mb-4 font-display">
          Autonomous Recovery Pipeline Execution
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {[
            { step: 1, name: '1. Ingestion', desc: 'Webhook Received' },
            { step: 2, name: '2. Diagnosis', desc: selectedScenario.errorCategory.replace(/_/g, ' ') },
            { step: 3, name: '3. ML Propensity', desc: `P(rec) = ${Math.round(selectedScenario.probability * 100)}%` },
            { step: 4, name: '4. AI Dispatch', desc: selectedScenario.expectedWinner.split('(')[0] },
            { step: 5, name: '5. Attribution', desc: 'Revenue Captured' },
          ].map((s) => {
            const isCompleted = activeStep > s.step || activeStep === 5
            const isCurrent = activeStep === s.step && activeStep !== 5

            return (
              <div
                key={s.step}
                className={`p-3 rounded-sm border text-xs transition-all ${
                  isCompleted
                    ? 'bg-moss-green-light border-moss-green/40 text-moss-green-dark'
                    : isCurrent
                    ? 'bg-burnt-orange-light border-burnt-orange/50 text-burnt-orange-dark ring-2 ring-burnt-orange/20 animate-pulse'
                    : 'bg-warm-gray-50 border-border text-warm-gray-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">{s.name}</span>
                  {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-moss-green" />}
                </div>
                <span className="text-[10px] block truncate font-mono">{s.desc}</span>
              </div>
            )
          })}
        </div>

        {/* Live Output Log Area */}
        <div className="mt-6 p-4 bg-dark-surface rounded-sm border border-warm-gray-800 text-surface text-xs font-mono space-y-2">
          <div className="flex items-center justify-between text-warm-gray-400 pb-2 border-b border-warm-gray-800 text-[11px]">
            <span>AGENT EXECUTION LOGS</span>
            <span>STATUS: {simulationState}</span>
          </div>

          {simulationState === 'IDLE' && (
            <p className="text-warm-gray-500 italic">Select a scenario above and click "Run Live Simulation" to observe the autonomous recovery agent.</p>
          )}

          {activeStep >= 1 && (
            <p className="text-warm-gray-300">
              <span className="text-moss-green">[EVENT_INGESTED]</span> Webhook received for order amount <MoneyValue amount={selectedScenario.amount} numericClassName="text-white" /> from {selectedScenario.customer}.
            </p>
          )}

          {activeStep >= 2 && (
            <p className="text-warm-gray-300">
              <span className="text-burnt-orange">[DIAGNOSTIC_CLASSIFIER]</span> Root cause identified: <span className="text-burnt-orange-light">{selectedScenario.errorReason}</span>.
            </p>
          )}

          {activeStep >= 3 && (
            <p className="text-warm-gray-300">
              <span className="text-muted-amber">[ERV_OPTIMIZER]</span> Scored 5 strategies. Winner: <span className="text-white font-bold">{selectedScenario.expectedWinner}</span> (ERV: ₹{selectedScenario.erv.toLocaleString('en-IN')}).
            </p>
          )}

          {activeStep >= 4 && (
            <div className="p-2.5 bg-warm-gray-900 rounded-sm border border-warm-gray-700 text-warm-gray-200 mt-2 space-y-1">
              <span className="text-[10px] text-burnt-orange font-bold uppercase tracking-wider block">Generated Gemini Intervention Payload:</span>
              <p className="text-xs italic text-surface">{selectedScenario.generatedMessage}</p>
            </div>
          )}

          {activeStep === 5 && (
            <div className="p-3 bg-moss-green/20 border border-moss-green/40 rounded-sm text-moss-green-light mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-moss-green" />
                <span className="font-bold">RECOVERY SUCCESSFUL!</span>
              </div>
              <span>Captured <MoneyValue amount={selectedScenario.amount} numericClassName="text-white font-bold" /> into Merchant Ledger</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
