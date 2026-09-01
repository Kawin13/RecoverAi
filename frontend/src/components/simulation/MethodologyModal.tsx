import React, { useState } from 'react'
import {
  X,
  Scale,
  ShieldCheck,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  TrendingUp
} from 'lucide-react'
import { MethodologyDoc } from '../../services/api'

interface MethodologyModalProps {
  isOpen: boolean
  onClose: () => void
  methodology: MethodologyDoc | null
}

export const MethodologyModal: React.FC<MethodologyModalProps> = ({
  isOpen,
  onClose,
  methodology
}) => {
  const [activeTab, setActiveTab] = useState<'comparison' | 'erv' | 'ml' | 'guardrails'>('comparison')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-graphite/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-surface rounded-md border border-border max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border bg-dark-surface text-surface flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-burnt-orange flex items-center justify-center text-white font-bold">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-display tracking-tight text-white">
                  Simulation Methodology & Empirical Assumptions
                </h2>
                <span className="px-2 py-0.5 bg-warm-gray-800 text-[10px] font-mono text-warm-gray-300 border border-warm-gray-700 rounded-sm">
                  v2.0 Model
                </span>
              </div>
              <p className="text-xs text-warm-gray-400">
                Transparent documentation of Baseline rules, Recovery Likelihood modeling, ERV valuation, and safety controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm hover:bg-warm-gray-800 text-warm-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mandatory Simulated Test Data Banner */}
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-5 py-2.5 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong className="font-bold">SIMULATED TEST DATA:</strong> All outcomes and telemetry are synthetic benchmarks produced by the RecoverAI simulation sandbox. No live payment links or merchant charges are processed.
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-warm-gray-50/50 px-5 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('comparison')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'comparison'
                ? 'border-burnt-orange text-burnt-orange font-bold'
                : 'border-transparent text-warm-gray-500 hover:text-graphite'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Baseline vs RecoverAI</span>
          </button>
          <button
            onClick={() => setActiveTab('erv')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'erv'
                ? 'border-burnt-orange text-burnt-orange font-bold'
                : 'border-transparent text-warm-gray-500 hover:text-graphite'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>ERV Formula Math</span>
          </button>
          <button
            onClick={() => setActiveTab('ml')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'ml'
                ? 'border-burnt-orange text-burnt-orange font-bold'
                : 'border-transparent text-warm-gray-500 hover:text-graphite'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Recovery Likelihood Model</span>
          </button>
          <button
            onClick={() => setActiveTab('guardrails')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'guardrails'
                ? 'border-burnt-orange text-burnt-orange font-bold'
                : 'border-transparent text-warm-gray-500 hover:text-graphite'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Operational Guardrails</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-160px)] text-xs text-warm-gray-700 leading-relaxed">
          {activeTab === 'comparison' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-md border border-border bg-warm-gray-50/80 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-graphite font-display text-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-warm-gray-400" />
                    <span>Traditional Baseline (Industry Default)</span>
                  </div>
                  <ul className="space-y-1.5 text-warm-gray-600 list-disc pl-4 text-[11px]">
                    <li><strong>Immediate blind retry:</strong> Retries immediately on same rail without diagnosing root cause.</li>
                    <li><strong>No risk filtering:</strong> Retries expired cards and fraud drops, incurring recurring gateway penalty fees.</li>
                    <li><strong>Static channel dunning:</strong> Dispatches a generic message on a single static channel.</li>
                    <li><strong>Zero cost awareness:</strong> Spends high SMS/concierge costs on micro-transactions.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-md border border-burnt-orange/30 bg-burnt-orange/5 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-burnt-orange font-display text-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-burnt-orange" />
                    <span>RecoverAI Autonomous Engine</span>
                  </div>
                  <ul className="space-y-1.5 text-warm-gray-700 list-disc pl-4 text-[11px]">
                    <li><strong>Root cause diagnosis:</strong> Categorizes failure taxonomy before executing any action.</li>
                    <li><strong>Likelihood scoring:</strong> Evaluates probability P(recovery | action) across 4 candidate strategies.</li>
                    <li><strong>ERV maximization:</strong> Computes net expected recovery value in minor currency units after costs.</li>
                    <li><strong>Safety guardrails:</strong> Enforces human review on high-ticket drops and hard blocks on fraud.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'erv' && (
            <div className="space-y-4">
              <div className="p-4 bg-dark-surface text-surface rounded-md font-mono space-y-2">
                <span className="text-burnt-orange-light font-bold text-xs uppercase tracking-wider block">
                  Expected Recovery Value (ERV) Objective Function:
                </span>
                <p className="text-sm font-bold text-emerald-400">
                  ERV(a) = P(recovery | a) &times; Amount &minus; Execution_Cost(a) &minus; Friction_Penalty(a) &minus; Risk_Penalty(a)
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 bg-warm-gray-50 border border-border rounded-sm space-y-1.5">
                  <span className="font-bold text-graphite font-display text-xs">Component Definitions:</span>
                  <ul className="space-y-1 text-[11px] text-warm-gray-600 list-disc pl-4">
                    <li>
                      <strong className="text-graphite">P(recovery | a):</strong> Recovery likelihood predicted for candidate strategy <code className="font-mono text-graphite">a</code>.
                    </li>
                    <li>
                      <strong className="text-graphite">Amount:</strong> Total at-risk transaction value in integer minor currency units.
                    </li>
                    <li>
                      <strong className="text-graphite">Execution Cost:</strong> Direct hard cost (e.g. ₹0.30 WhatsApp dispatch fee, ₹0.50 payment link surcharge, ₹0.00 automated retry).
                    </li>
                    <li>
                      <strong className="text-graphite">Friction Penalty:</strong> Quantified customer annoyance cost (e.g. ₹2.00 for intrusive SMS; ₹0.10 for seamless in-app prompt).
                    </li>
                    <li>
                      <strong className="text-graphite">Risk Penalty:</strong> 90% haircut on suspicious transactions; 0 for supervised human reviews.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ml' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3 bg-surface border border-border rounded-sm">
                <div>
                  <span className="font-bold text-graphite font-display text-xs">Production Model Architecture:</span>
                  <p className="text-[11px] text-warm-gray-500">Gradient Boosted Decision Engine with Preprocessing Pipeline</p>
                </div>
                <span className="px-2.5 py-1 bg-moss-green-light text-moss-green-dark border border-moss-green/30 rounded-sm font-mono text-[11px] font-bold">
                  ROC-AUC 0.72 | F1 0.86
                </span>
              </div>

              <div>
                <span className="font-bold font-display text-graphite text-xs block mb-2">18 Analyzed Payment Signals:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                  {[
                    'amount (INR)',
                    'payment_method',
                    'bank',
                    'failure_reason',
                    'failure_category',
                    'attempt_count',
                    'previous_success_count',
                    'previous_failure_count',
                    'preferred_payment_method',
                    'customer_tenure_days',
                    'customer_value_segment',
                    'hour_of_day (0-23)',
                    'day_of_week (0-6)',
                    'merchant_category',
                    'checkout_abandoned (0/1)',
                    'checkout_duration_sec',
                    'device_type',
                    'historical_avg_order_value'
                  ].map((feat, idx) => (
                    <div key={idx} className="p-2 bg-warm-gray-50 border border-border rounded-xs text-warm-gray-700">
                      &bull; {feat}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-warm-gray-50 border border-border rounded-sm text-[11px] text-warm-gray-600">
                <strong>Batch Analysis:</strong> The simulation processes transaction cohorts through optimized predictive scoring, evaluating 1,000 transactions and candidate strategy actions in under 200ms.
              </div>
            </div>
          )}

          {activeTab === 'guardrails' && (
            <div className="space-y-4">
              <p className="text-warm-gray-600 text-xs">
                To safeguard customer experience, merchant reputation, and regulatory compliance, RecoverAI applies 6 deterministic policy gates before any intervention can be executed:
              </p>

              <div className="space-y-2.5">
                {methodology?.guardrail_policies?.map((g, idx) => (
                  <div key={idx} className="p-3 bg-surface border border-border rounded-sm flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-moss-green mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-bold font-mono text-graphite text-xs">{g.rule}</span>
                      <p className="text-[11px] text-warm-gray-600 mt-0.5">{g.policy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-warm-gray-50 flex items-center justify-between">
          <span className="text-[11px] text-warm-gray-500 font-mono">
            RecoverAI Autonomous Financial Intelligence Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-dark-surface hover:bg-graphite text-surface rounded-sm text-xs font-medium transition-colors"
          >
            Close Methodology
          </button>
        </div>
      </div>
    </div>
  )
}
