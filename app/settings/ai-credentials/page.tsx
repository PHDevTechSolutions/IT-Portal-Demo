"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { toast } from "sonner";
import {
  Key, Plus, Trash2, Eye, EyeOff, CheckCircle2,
  Loader2, Shield, X, RefreshCw, Sparkles,
} from "lucide-react";

const C = {
  bg:     "#080d12", panel:  "#0d1117", border: "#1a2535",
  muted:  "#253040", dim:    "#4a6070", text:   "#c8d8e8",
  accent: "#e8630a", font:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

const PROVIDERS = [
  { value: "groq",   label: "Groq",   color: "#f97316" },
  { value: "openai", label: "OpenAI", color: "#34d399" },
  { value: "serper", label: "Serper", color: "#60a5fa" },
];

interface Credential {
  _id: string; label: string; provider: string;
  keyMasked: string; isActive: boolean;
  createdAt?: string; updatedAt?: string;
}

function providerColor(p: string) {
  return PROVIDERS.find(x => x.value === p)?.color ?? C.dim;
}

export default function AICredentialsPage() {
  const router = useRouter();
  const [creds,      setCreds]      = useState<Credential[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [showKey,    setShowKey]    = useState(false);

  // Form state
  const [label,    setLabel]    = useState("");
  const [provider, setProvider] = useState("groq");
  const [apiKey,   setApiKey]   = useState("");

  const fetchCreds = async () => {
    setIsFetching(true);
    try {
      const res  = await fetch("/api/settings/ai-credentials");
      const json = await res.json();
      if (json.success) setCreds(json.credentials ?? []);
      else toast.error(json.error ?? "Failed to load");
    } catch { toast.error("Network error"); }
    finally { setIsFetching(false); }
  };

  useEffect(() => { fetchCreds(); }, []);

  const handleAdd = async () => {
    if (!label.trim() || !apiKey.trim()) { toast.error("Label and API key are required"); return; }
    setSaving(true);
    try {
      const res  = await fetch("/api/settings/ai-credentials", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, provider, apiKey }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("API key added");
      setLabel(""); setApiKey(""); setProvider("groq"); setShowForm(false);
      fetchCreds();
    } catch (err: any) { toast.error(err.message ?? "Failed to add"); }
    finally { setSaving(false); }
  };

  const handleSetActive = async (id: string) => {
    setActivatingId(id);
    try {
      const res  = await fetch("/api/settings/ai-credentials", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, setActive: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Active key updated — all AI routes will use this key");
      fetchCreds();
    } catch (err: any) { toast.error(err.message ?? "Failed"); }
    finally { setActivatingId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this API key?")) return;
    setDeletingId(id);
    try {
      const res  = await fetch("/api/settings/ai-credentials", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Deleted");
      fetchCreds();
    } catch (err: any) { toast.error(err.message ?? "Failed"); }
    finally { setDeletingId(null); }
  };

  const activeKey = creds.find(c => c.isActive);

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden bg-[#080d12]"
          style={{ fontFamily: C.font, color: C.text }}>

          <div className="fixed inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
            backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
          }} />

          {/* Header */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b bg-[#080d12]"
            style={{ borderColor: C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest rounded-none hover:bg-transparent"
              style={{ color: C.dim }}>Home</Button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/settings/general" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Settings</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>AI Credentials</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </header>

          {/* Title bar */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b bg-[#0d1117]"
            style={{ borderColor: C.border }}>
            <div className="flex h-8 w-8 items-center justify-center border"
              style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <Key className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>AI Credentials</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Manage API keys · Active key is used by all AI features
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={fetchCreds}
                className="h-7 w-7 flex items-center justify-center border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                <RefreshCw className="size-3" />
              </button>
              <button onClick={() => setShowForm(f => !f)}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ backgroundColor: "rgba(232,99,10,0.1)", borderColor: C.accent, color: C.accent }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)"; }}>
                {showForm ? <X className="size-3" /> : <Plus className="size-3" />}
                {showForm ? "Cancel" : "Add Key"}
              </button>
            </div>
          </div>

          {/* Active key banner */}
          {activeKey && (
            <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-2 border-b"
              style={{ borderColor: "#34d39930", backgroundColor: "rgba(52,211,153,0.05)" }}>
              <CheckCircle2 className="size-3.5 shrink-0" style={{ color: "#34d399" }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#34d399" }}>
                Active:
              </span>
              <span className="text-[11px] font-bold" style={{ color: C.text }}>{activeKey.label}</span>
              <span className="text-[9px] px-1.5 py-0.5 border font-bold uppercase"
                style={{ borderColor: providerColor(activeKey.provider) + "40", color: providerColor(activeKey.provider), backgroundColor: providerColor(activeKey.provider) + "10" }}>
                {activeKey.provider}
              </span>
              <span className="text-[10px] font-mono" style={{ color: C.muted }}>{activeKey.keyMasked}</span>
              <span className="ml-auto text-[10px]" style={{ color: C.muted }}>
                All AI routes (Dashboard, Tickets, Attendance, Customers, Scrapping) use this key
              </span>
            </div>
          )}

          {/* Add form */}
          {showForm && (
            <div className="relative z-10 shrink-0 border-b px-4 py-4" style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: C.accent }}>New API Key</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5 flex-1 min-w-[160px]">
                  <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>Label</label>
                  <input value={label} onChange={e => setLabel(e.target.value)}
                    placeholder="e.g. Production Groq Key"
                    className="w-full h-8 px-3 text-[11px] focus:outline-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>Provider</label>
                  <select value={provider} onChange={e => setProvider(e.target.value)}
                    className="h-8 px-2 text-[11px] focus:outline-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                    {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>API Key</label>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey} onChange={e => setApiKey(e.target.value)}
                      placeholder="sk-... or gsk_..."
                      className="w-full h-8 px-3 pr-9 text-[11px] focus:outline-none font-mono"
                      style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                    />
                    <button onClick={() => setShowKey(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      style={{ color: C.dim }}>
                      {showKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    </button>
                  </div>
                </div>
                <button onClick={handleAdd} disabled={saving || !label.trim() || !apiKey.trim()}
                  className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "rgba(232,99,10,0.15)", borderColor: C.accent, color: C.accent }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.25)"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.15)"; }}>
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                  {saving ? "Saving…" : "Add"}
                </button>
              </div>
            </div>
          )}

          {/* Credentials list */}
          <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4">
            {isFetching ? (
              <div className="flex items-center justify-center h-full gap-3">
                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                <span className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Loading…</span>
              </div>
            ) : creds.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="flex h-16 w-16 items-center justify-center border"
                  style={{ borderColor: C.border, backgroundColor: "rgba(232,99,10,0.05)" }}>
                  <Key className="size-7 opacity-30" style={{ color: C.accent }} />
                </div>
                <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No API keys yet</p>
                <button onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border"
                  style={{ backgroundColor: "rgba(232,99,10,0.1)", borderColor: C.accent, color: C.accent }}>
                  <Plus className="size-3" /> Add your first key
                </button>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-2">
                {creds.map(c => (
                  <div key={c._id}
                    className="flex items-center gap-4 px-4 py-3 border transition-colors"
                    style={{
                      borderColor: c.isActive ? "#34d39940" : C.border,
                      backgroundColor: c.isActive ? "rgba(52,211,153,0.04)" : C.panel,
                    }}>

                    {/* Provider badge */}
                    <span className="text-[9px] font-bold uppercase px-2 py-1 border shrink-0"
                      style={{ borderColor: providerColor(c.provider) + "40", color: providerColor(c.provider), backgroundColor: providerColor(c.provider) + "10" }}>
                      {c.provider}
                    </span>

                    {/* Label + key */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold" style={{ color: C.text }}>{c.label}</span>
                        {c.isActive && (
                          <span className="flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 border"
                            style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "rgba(52,211,153,0.1)" }}>
                            <CheckCircle2 className="size-2.5" /> Active
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: C.muted }}>{c.keyMasked}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!c.isActive && (
                        <button onClick={() => handleSetActive(c._id)} disabled={activatingId === c._id}
                          className="flex items-center gap-1 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                          style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "rgba(52,211,153,0.08)" }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(52,211,153,0.15)"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(52,211,153,0.08)"; }}>
                          {activatingId === c._id ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                          Set Active
                        </button>
                      )}
                      <button onClick={() => handleDelete(c._id)} disabled={deletingId === c._id}
                        className="h-7 w-7 flex items-center justify-center border transition-colors disabled:opacity-40"
                        style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                        {deletingId === c._id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Info box */}
                <div className="mt-4 p-4 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="size-3.5" style={{ color: C.accent }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>How it works</span>
                  </div>
                  <ul className="space-y-1 text-[10px]" style={{ color: C.dim }}>
                    <li>· The <span style={{ color: C.text }}>Active</span> key is used by all AI features: Dashboard Insights, Ticket Analysis, Attendance Analysis, Customer Analysis, Lead Scrapping</li>
                    <li>· If no active key is set in the database, the system falls back to the <span style={{ color: C.text }}>GROQ_API_KEY</span> environment variable</li>
                    <li>· Keys are stored encrypted in MongoDB and never exposed in full after saving</li>
                    <li>· Only one key per provider can be active at a time</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
