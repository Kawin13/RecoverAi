import React, { useState, useRef, useEffect } from "react"
import { Building2, ChevronDown, CheckCircle2, Plus, Loader2, RefreshCw } from "lucide-react"
import { useWorkspace } from "../../context/WorkspaceContext"
import { WorkspaceData } from "../../services/workspaceApi"

interface WorkspaceSwitcherProps { compact?: boolean }

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ compact = false }) => {
  const { activeWorkspace, workspaces, loading, switchWorkspace, createWorkspace, refreshWorkspaces } = useWorkspace()
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false); setIsCreating(false); setNewName(""); setCreateError(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => { if (isCreating && inputRef.current) inputRef.current.focus() }, [isCreating])

  const handleSwitch = (ws: WorkspaceData) => { switchWorkspace(ws); setIsOpen(false) }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreating(true); setCreateError(null)
    try {
      await createWorkspace(name)
      setIsCreating(false); setNewName(""); setIsOpen(false)
    } catch (err: any) {
      setCreateError(err.message || "Failed to create workspace")
    } finally { setCreating(false) }
  }

  const roleLabel = activeWorkspace?.role === "admin" ? "Admin" : "Operator"

  return (
    <div className="relative" ref={dropdownRef}>
      <button type="button" id="workspace-switcher-trigger" onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 ${compact ? "px-2.5 py-1.5" : "px-3.5 py-1.5"} bg-surface-blue/70 border border-surface-blue-border rounded-xl text-xs hover:border-primary/40 hover:bg-primary-light transition-all focus-visible:ring-2 focus-visible:ring-primary shadow-2xs group`}
        aria-label="Switch workspace" aria-expanded={isOpen}>
        <Building2 className="w-4 h-4 text-primary shrink-0" />
        {!compact && (
          <span className="font-semibold text-navy font-display truncate max-w-[140px]">
            {loading && workspaces.length === 0 ? "Loading\u2026" : (activeWorkspace?.name || "Select Workspace")}
          </span>
        )}
        {!compact && activeWorkspace && (
          <span className="text-[10px] px-2 py-0.5 bg-moss-green-light text-moss-green-dark border border-moss-green/30 rounded-full font-mono font-semibold shrink-0">{roleLabel}</span>
        )}
        {loading && workspaces.length > 0
          ? <Loader2 className="w-3 h-3 text-slate-400 animate-spin shrink-0" />
          : <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        }
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-surface border border-border shadow-fintech-modal rounded-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Your Workspaces</span>
            <button type="button" onClick={() => { refreshWorkspaces(); setIsOpen(false) }} className="p-1 text-slate-400 hover:text-navy rounded-lg transition-colors" title="Refresh">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {workspaces.length === 0 && !loading && <p className="text-xs text-slate-400 text-center py-4">No workspaces yet</p>}
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspace?.id
              return (
                <button key={ws.id} type="button" id={`workspace-option-${ws.id}`} onClick={() => handleSwitch(ws)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${isActive ? "bg-primary text-white shadow-fintech-purple" : "hover:bg-slate-50 text-navy"}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${isActive ? "bg-white/20 text-white" : "bg-primary-light text-primary"}`}>
                    {ws.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isActive ? "text-white" : "text-navy"}`}>{ws.name}</p>
                    <p className={`text-[10px] font-mono capitalize ${isActive ? "text-white/70" : "text-slate-500"}`}>{ws.role} &middot; {ws.member_count} member{ws.member_count !== 1 ? "s" : ""}</p>
                  </div>
                  {isActive && <CheckCircle2 className="w-4 h-4 text-white/80 shrink-0" />}
                </button>
              )
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-border">
            {!isCreating ? (
              <button type="button" id="create-new-workspace-btn" onClick={() => setIsCreating(true)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-primary hover:bg-primary-light font-semibold transition-all">
                <Plus className="w-3.5 h-3.5" /><span>Create New Workspace</span>
              </button>
            ) : (
              <form onSubmit={handleCreateSubmit} className="space-y-2">
                <input ref={inputRef} type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Workspace name\u2026" maxLength={100}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-slate-50 text-xs text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all" />
                {createError && <p className="text-[10px] text-brick-red px-1">{createError}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={creating || !newName.trim()} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-white rounded-xl text-xs font-bold transition-all hover:bg-primary-hover disabled:opacity-60 shadow-fintech-purple">
                    {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : null}{creating ? "Creating\u2026" : "Create"}
                  </button>
                  <button type="button" onClick={() => { setIsCreating(false); setNewName(""); setCreateError(null) }} className="px-3 py-2 text-xs text-slate-500 hover:text-navy rounded-xl hover:bg-slate-100 transition-all">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkspaceSwitcher
