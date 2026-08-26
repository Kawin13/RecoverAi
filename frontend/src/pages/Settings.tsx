import React, { useState } from 'react'
import { SectionHeader } from '../components/common/SectionHeader'
import { CreditCard, Bot, Save, CheckCircle2, Copy } from 'lucide-react'

export const Settings: React.FC = () => {
  const [apiKeyId, setApiKeyId] = useState('rzp_test_9948271A')
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash')
  const webhookUrl = 'https://api.recoverai.io/v1/webhooks/razorpay'
  const [copied, setCopied] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="System Settings & Integrations"
        subtitle="Manage payment gateway credentials, AI provider configurations, and webhook listeners"
        actions={
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-burnt-orange hover:bg-burnt-orange-hover text-white rounded-sm text-xs font-medium transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-burnt-orange"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Configuration</span>
          </button>
        }
      />

      {isSaved && (
        <div className="p-3 bg-moss-green-light border border-moss-green/30 text-moss-green-dark text-xs rounded-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-moss-green" />
          <span>Configuration saved successfully.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Gateway (Razorpay) */}
        <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <CreditCard className="w-4 h-4 text-burnt-orange" />
            <h3 className="text-sm font-bold text-graphite font-display">
              Razorpay Integration (Test Sandbox)
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-warm-gray-600 block mb-1 font-medium">Razorpay Key ID</label>
              <input
                type="text"
                value={apiKeyId}
                onChange={(e) => setApiKeyId(e.target.value)}
                className="w-full px-3 py-2 bg-warm-gray-50 border border-border rounded-sm font-mono text-xs text-graphite focus:outline-none focus:border-burnt-orange"
              />
            </div>

            <div>
              <label className="text-warm-gray-600 block mb-1 font-medium">Razorpay Key Secret</label>
              <input
                type="password"
                value="••••••••••••••••••••••••"
                readOnly
                className="w-full px-3 py-2 bg-warm-gray-100 border border-border rounded-sm font-mono text-xs text-warm-gray-500 cursor-not-allowed"
              />
              <span className="text-[10px] text-warm-gray-500 mt-1 block">Secrets are managed locally in backend .env</span>
            </div>

            <div>
              <label className="text-warm-gray-600 block mb-1 font-medium">Webhook Ingestion Endpoint</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-warm-gray-50 border border-border rounded-sm font-mono text-xs text-graphite"
                />
                <button
                  type="button"
                  onClick={handleCopyWebhook}
                  className="px-3 py-2 bg-surface hover:bg-warm-gray-100 border border-border rounded-sm text-xs text-warm-gray-700 flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AI Engine & Gemini Configuration */}
        <div className="bg-surface rounded-md border border-border p-5 shadow-fintech-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Bot className="w-4 h-4 text-moss-green" />
            <h3 className="text-sm font-bold text-graphite font-display">
              AI Decision & Generative Engine
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-warm-gray-600 block mb-1 font-medium">Active Gemini Model</label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full px-3 py-2 bg-warm-gray-50 border border-border rounded-sm text-xs text-graphite focus:outline-none focus:border-burnt-orange"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended: Fast & High Quality)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Complex Reasoning)</option>
              </select>
            </div>

            <div>
              <label className="text-warm-gray-600 block mb-1 font-medium">Agent Tone Persona</label>
              <select
                defaultValue="EMPATHETIC_FINANCIAL"
                className="w-full px-3 py-2 bg-warm-gray-50 border border-border rounded-sm text-xs text-graphite focus:outline-none focus:border-burnt-orange"
              >
                <option value="EMPATHETIC_FINANCIAL">Empathetic Financial Ops (Helpful & High-Trust)</option>
                <option value="DIRECT_CONCIERGE">Direct Concierge (Minimalist & Urgent)</option>
                <option value="VIP_EXECUTIVE">VIP Executive Dunning</option>
              </select>
            </div>

            <div>
              <label className="text-warm-gray-600 block mb-1 font-medium">Maximum Generation Retries</label>
              <input
                type="number"
                defaultValue={2}
                min={1}
                max={5}
                className="w-full px-3 py-2 bg-warm-gray-50 border border-border rounded-sm font-mono text-xs text-graphite focus:outline-none focus:border-burnt-orange"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
