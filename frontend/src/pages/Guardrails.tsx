import React, { useState } from 'react'
import { SectionHeader } from '../components/common/SectionHeader'
import { mockGuardrailRules } from '../data/mockData'
import { GuardrailRule } from '../types'
import { ShieldAlert, Save, RefreshCw } from 'lucide-react'

export const Guardrails: React.FC = () => {
  const [rules, setRules] = useState<GuardrailRule[]>(mockGuardrailRules)
  const [isSaving, setIsSaving] = useState(false)

  const handleToggle = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      alert('Safety guardrails and threshold rules updated successfully!')
    }, 500)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Merchant Guardrails & Safety Policies"
        subtitle="Enforce strict financial, rate limiting, and communication boundaries on autonomous agent interventions"
        actions={
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-sm text-xs font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Guardrail Rules</span>
          </button>
        }
      />

      <div className="bg-muted-amber-subtle border border-muted-amber/30 rounded-md p-4 flex items-start gap-3 text-xs">
        <ShieldAlert className="w-5 h-5 text-muted-amber-dark flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-muted-amber-dark font-display">
            Active Circuit Breaker Protection
          </h4>
          <p className="text-warm-gray-700 mt-0.5">
            If any autonomous action breaches a configured threshold, RecoverAI will immediately block the dispatch or divert the transaction into the manual review queue.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="bg-surface rounded-md border border-border p-4 shadow-fintech-card flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-graphite font-display">{rule.name}</h4>
                <span className="px-2 py-0.2 bg-warm-gray-100 text-warm-gray-700 text-[10px] font-mono rounded-xs border border-border uppercase">
                  {rule.category}
                </span>
              </div>
              <p className="text-xs text-warm-gray-600">{rule.description}</p>
              <div className="text-[11px] text-warm-gray-500 pt-1">
                Action on Breach: <strong className="text-brick-red-dark">{rule.actionOnBreach.replace(/_/g, ' ')}</strong>
              </div>
            </div>

            <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-warm-gray-500">Threshold:</span>
                <input
                  type="text"
                  defaultValue={rule.thresholdValue}
                  className="w-20 px-2 py-1 bg-warm-gray-50 border border-border rounded-sm text-xs font-mono font-bold text-graphite text-center focus:outline-none focus:border-burnt-orange"
                />
                <span className="text-warm-gray-500 font-mono text-[11px]">{rule.unit}</span>
              </div>

              <button
                type="button"
                onClick={() => handleToggle(rule.id)}
                aria-label={`Toggle ${rule.name}`}
                className={`w-10 h-5 rounded-full transition-colors relative focus-visible:ring-2 focus-visible:ring-burnt-orange ${
                  rule.enabled ? 'bg-moss-green' : 'bg-warm-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    rule.enabled ? 'right-0.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
