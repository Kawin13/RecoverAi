import React, { useState } from "react"
import { Building2, Loader2, CheckCircle2, ArrowRight, Zap } from "lucide-react"
import { useWorkspace } from "../../context/WorkspaceContext"

interface WorkspaceOnboardingModalProps { onComplete: () => void }

const BUSINESS_TYPES = [
  { value: "ecommerce", label: "E-Commerce", icon: "🛒" },
  { value: "saas", label: "SaaS / Software", icon: "💻" },
  { value: "d2c", label: "D2C Brand", icon: "🏷️" },
  { value: "marketplace", label: "Marketplace", icon: "🏪" },
  { value: "fintech", label: "Fintech", icon: "💳" },
  { value: "other", label: "Other", icon: "🏢" },
]

export const WorkspaceOnboardingModal: React.FC<WorkspaceOnboardingModalProps> = ({ onComplete }) => {
  const { createWorkspace } = useWorkspace()
  const [workspaceName, setWorkspaceName] = useState("")
  const [businessType, setBusinessType] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = workspaceName.trim()
    if (!name) { setError("Please enter a workspace name."); return }
    setSubmitting(true); setError(null)
    try {
      await createWorkspace(name, businessType || undefined)
      setDone(true)
      setTimeout(onComplete, 1200)
    } catch (err: any) {
      setError(err.message || "Failed to create workspace. Please try again.")
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-3xl border border-border shadow-fintech-modal w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="p-8 pb-6 border-b border-border">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-fintech-purple">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-navy font-display">Create Your Workspace</h2>
              <p className="text-xs text-slate-500 mt-0.5">Set up your merchant workspace to start recovering revenue</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[{ icon: "🤖", label: "Autonomous AI Recovery" }, { icon: "🔒", label: "Isolated Data & Secrets" }, { icon: "📊", label: "Real-time Analytics" }].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-1 p-2.5 bg-primary-light rounded-xl border border-primary-border text-center">
                <span className="text-lg">{f.icon}</span>
                <span className="text-[10px] text-primary font-semibold leading-tight">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center animate-in fade-in">
              <div className="w-14 h-14 rounded-full bg-moss-green-light flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-moss-green-dark" />
              </div>
              <p className="text-base font-bold text-navy font-display">Workspace Created!</p>
              <p className="text-xs text-slate-500">Taking you to your dashboard…</p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="ws-name" className="block text-xs font-semibold text-navy mb-1.5">Workspace Name <span className="text-rose-500">*</span></label>
                <input id="ws-name" type="text" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="e.g. Zenith Commerce India" maxLength={100} required autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-border bg-slate-50 text-sm text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all" />
                <p className="text-[11px] text-slate-400 mt-1">Usually your company or brand name</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy mb-2">Business Type <span className="text-slate-400">(optional)</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {BUSINESS_TYPES.map((bt) => (
                    <button key={bt.value} type="button" onClick={() => setBusinessType(bt.value === businessType ? "" : bt.value)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center text-[11px] font-medium transition-all ${businessType === bt.value ? "bg-primary text-white border-primary shadow-fintech-purple" : "bg-slate-50 text-slate-600 border-border hover:border-primary/40 hover:bg-primary-light"}`}>
                      <span className="text-base">{bt.icon}</span>
                      <span className="leading-tight">{bt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-xs text-brick-red bg-brick-red-light px-3 py-2 rounded-xl border border-brick-red/20">{error}</p>}
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200/60 rounded-xl text-[11px] text-amber-800">
                <Zap className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <span>RecoverAI runs exclusively in <strong>Razorpay Test Mode</strong>. Connect credentials from Settings after setup.</span>
              </div>
              <button type="submit" disabled={submitting || !workspaceName.trim()} id="create-workspace-submit"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm transition-all shadow-fintech-purple disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {submitting ? "Creating Workspace…" : "Create Workspace & Continue"}
                {!submitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

export default WorkspaceOnboardingModal
