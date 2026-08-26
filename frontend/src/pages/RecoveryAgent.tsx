import React, { useState } from 'react'
import { SectionHeader } from '../components/common/SectionHeader'
import { MetricCard } from '../components/common/MetricCard'
import { DecisionTimeline } from '../components/common/DecisionTimeline'
import { mockAgentActivities } from '../data/mockData'
import {
  Bot,
  Sliders,
  Cpu,
  Sparkles,
  CheckCircle2,
  FileCode,
  Save,
  RefreshCw
} from 'lucide-react'

export const RecoveryAgent: React.FC = () => {
  const [minConfidence, setMinConfidence] = useState(65)
  const [autoExecutionEnabled, setAutoExecutionEnabled] = useState(true)
  const [selectedPromptType, setSelectedPromptType] = useState<'PAYLINK' | 'UPI_SWITCH' | 'DUNNING'>('PAYLINK')
  const [isSaving, setIsSaving] = useState(false)

  const promptTemplates = {
    PAYLINK: `Role: RecoverAI Customer Recovery Concierge
Context: Customer {{customer_name}} encountered a 3DS OTP timeout on Order {{order_id}} for ₹{{amount}}.
Objective: Generate a 1-sentence urgent, courteous SMS with direct dynamic 1-click Razorpay payment link.
Tone: Warm, friction-free, secure. No robotic jargon.`,
    UPI_SWITCH: `Role: RecoverAI Gateway Optimization Agent
Context: Customer {{customer_name}} faced bank switch latency on Card payment for Order {{order_id}}.
Objective: Provide seamless UPI Intent fallback link with auto-selected preferred VPA app.
Tone: Direct, reassuring, instant resolution.`,
    DUNNING: `Role: RecoverAI Customer Success & Billing Specialist
Context: Subscription renewal failed for {{customer_name}} (Card Expired). Customer LTV is ₹{{ltv}}.
Objective: Compose empathetic email offering instant payment method update and 5% loyalty fee credit.
Tone: High-touch, appreciative, respectful.`
  }

  const handleSaveConfig = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      alert('Recovery Agent configuration and decision thresholds updated successfully!')
    }, 600)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Recovery Agent Intelligence Core"
        subtitle="Configure autonomous decision thresholds, inspect ML propensity weights, and monitor real-time AI reasoning"
        actions={
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-sm text-xs font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Agent Policy</span>
          </button>
        }
      />

      {/* Model & Agent Status Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Agent Operating Status"
          value="Autonomous (Optimal)"
          subtitle="Sub-second decision engine"
          highlightColor="moss-green"
          icon={Bot}
        />
        <MetricCard
          title="ML Propensity Engine"
          value="XGBoost v2.4"
          subtitle="Trained on 140k payment events"
          highlightColor="burnt-orange"
          icon={Cpu}
        />
        <MetricCard
          title="LLM Reasoning Core"
          value="Gemini 2.5 Flash"
          subtitle="Avg inference latency: 310ms"
          highlightColor="muted-amber"
          icon={Sparkles}
        />
        <MetricCard
          title="Decision Accuracy (AUC)"
          value="0.914"
          subtitle="Top decile precision: 94.2%"
          highlightColor="moss-green"
          icon={CheckCircle2}
        />
      </div>

      {/* Two Column Section: Agent Controls & Prompt Template Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Decision Policy & Propensity Factors */}
        <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Sliders className="w-4 h-4 text-burnt-orange" />
            <h3 className="text-sm font-bold text-graphite font-display">
              Autonomous Decision Policy
            </h3>
          </div>

          {/* Autonomous Execution Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-warm-gray-50 border border-border rounded-sm">
            <div>
              <span className="text-xs font-medium text-graphite block">Full Autopilot Dispatch</span>
              <span className="text-[11px] text-warm-gray-500">Execute top ERV action without manual review</span>
            </div>
            <button
              type="button"
              onClick={() => setAutoExecutionEnabled(!autoExecutionEnabled)}
              aria-label="Toggle autonomous execution"
              className={`w-10 h-5 rounded-full transition-colors relative focus-visible:ring-2 focus-visible:ring-burnt-orange ${
                autoExecutionEnabled ? 'bg-moss-green' : 'bg-warm-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  autoExecutionEnabled ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Confidence Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-graphite">Minimum Confidence Threshold</span>
              <span className="font-mono font-bold text-burnt-orange">{minConfidence}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="95"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-full accent-burnt-orange cursor-pointer"
            />
            <p className="text-[11px] text-warm-gray-500">
              Interventions with recovery probability below {minConfidence}% will enter cooling down or manual triage.
            </p>
          </div>

          {/* ML Feature Weights */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-semibold text-graphite uppercase tracking-wider font-display">
              Top Predictive Features
            </h4>
            <div className="space-y-2 text-xs">
              {[
                { factor: 'Customer Historical LTV & Tier', weight: '34%' },
                { factor: 'Failure Code & Error Category', weight: '28%' },
                { factor: 'Payment Method Switch Reliability', weight: '19%' },
                { factor: 'Elapsed Time Since Drop-off', weight: '12%' },
                { factor: 'Device & Geolocation Friction', weight: '7%' },
              ].map((f) => (
                <div key={f.factor} className="flex items-center justify-between text-[11px] p-2 bg-warm-gray-50 rounded-sm">
                  <span className="text-warm-gray-700">{f.factor}</span>
                  <span className="font-mono font-bold text-graphite">{f.weight}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Generative Prompt Templates & Live Telemetry (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prompt Template Inspector */}
          <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-warm-gray-700" />
                <h3 className="text-sm font-bold text-graphite font-display">
                  Gemini Recovery Prompt Generator
                </h3>
              </div>
              <div className="flex items-center gap-1 bg-warm-gray-100 p-0.5 rounded-sm text-xs">
                {(['PAYLINK', 'UPI_SWITCH', 'DUNNING'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedPromptType(type)}
                    className={`px-2.5 py-1 rounded-sm text-[11px] font-medium transition-colors ${
                      selectedPromptType === type
                        ? 'bg-surface text-graphite shadow-xs font-semibold'
                        : 'text-warm-gray-600 hover:text-graphite'
                    }`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-dark-surface text-warm-gray-300 font-mono text-xs p-4 rounded-sm border border-warm-gray-800 leading-relaxed overflow-x-auto whitespace-pre-wrap">
              {promptTemplates[selectedPromptType]}
            </div>
            <p className="text-[11px] text-warm-gray-500">
              RecoverAI injects transaction context and mathematical ERV constraints dynamically into Gemini 2.5 Flash for contextual generation.
            </p>
          </div>

          {/* Live Decision Feed */}
          <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card">
            <h3 className="text-sm font-bold text-graphite font-display mb-3 pb-2 border-b border-border">
              Real-Time Decision Reasoning Feed
            </h3>
            <DecisionTimeline activities={mockAgentActivities.slice(0, 3)} />
          </div>
        </div>
      </div>
    </div>
  )
}
