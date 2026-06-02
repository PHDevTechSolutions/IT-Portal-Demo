"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { toast } from "sonner";
import {
  Shield, Plus, Trash2, Pencil, ChevronRight,
  Loader2, CheckCircle2, XCircle, ToggleLeft, ToggleRight,
  Wifi, Monitor, AlertTriangle, Copy, X, Save,
} from "lucide-react";

/* ─── Tokens ─────────────────────────────────────────────────────── */
const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  muted:  "#253040",
  dim:    "#4a6070",
  text:   "#c8d8e8",
  accent: "#e8630a",
  green:  "#34d399",
  red:    "#f87171",
  font:   "'JetBrains Mono','Fira Code',monospace",
};

interface Entry {
  _id:       string;
  ip:        string;
  label:     string;
  deviceId:  string;
  enabled:   boolean;
  createdAt: string;
}

interface FormState {
  ip: string; label: string; deviceId: string;
}

const EMPTY: FormState = { ip: "", label: "", deviceId: "" };

/* ─── Form dialog ────────────────────────────────────────────────── */
function EntryForm({ open, onClose, initial, myIp, myDeviceId, onSaved }: {
  open: boolean; onClose: () => void;
  initial: Entry | null;
  myIp: string; myDeviceId: string;
  onSaved: () => void;
}) {
  const [form,    setForm]    = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? { ip: initial.ip, label: initial.label, deviceId: initial.deviceId } : EMPTY);
  }, [open, initial]);

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ip.trim()) { toast.error("IP address is required."); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/settings/ip-whitelist", {
        method:  initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(initial ? { _id: initial._id, ...form } : form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(initial ? "Entry updated." : "IP added to whitelist.");
      onSaved(); onClose();
    } catch (err: any) { toast.error(err.message ?? "Save failed."); }
    finally { setLoading(false); }
  };

  if (!open) return null;

  const inp = (label: string, k: keyof FormState, ph: string, action?: React.ReactNode) => (
    <div className="space-y-1">
      <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>{label}</label>
      <div className="flex gap-1.5">
        <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph}
          className="flex-1 h-8 px-3 text-[11px] focus:outline-none"
          style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
          onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
          onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
        {action}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(8,13,18,0.85)" }}>
      <div className="w-full max-w-md border overflow-hidden"
        style={{ borderColor: C.border, backgroundColor: C.panel, fontFamily: C.font }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <div className="flex items-center gap-2">
            {initial ? <Pencil className="size-3.5" style={{ color: C.accent }} />
                     : <Plus   className="size-3.5" style={{ color: C.accent }} />}
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
              {initial ? "Edit Entry" : "Add IP to Whitelist"}
            </span>
          </div>
          <button onClick={onClose} style={{ color: C.dim }}
            onMouseEnter={e => (e.currentTarget.style.color = C.red)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
            <X className="size-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {inp("IP Address *", "ip", "e.g. 192.168.1.100",
            <button type="button" onClick={() => set("ip", myIp)}
              className="h-8 px-2 text-[9px] uppercase border transition-colors shrink-0"
              style={{ borderColor: C.border, color: C.dim }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
              My IP
            </button>
          )}
          {inp("Label", "label", "e.g. Office PC, Home Laptop")}
          {inp("Device ID (optional)", "deviceId", "Auto-filled from browser",
            <button type="button" onClick={() => set("deviceId", myDeviceId)}
              className="h-8 px-2 text-[9px] uppercase border transition-colors shrink-0"
              style={{ borderColor: C.border, color: C.dim }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
              My ID
            </button>
          )}

          <div className="flex items-center gap-2 pt-1 justify-end">
            <button type="button" onClick={onClose}
              className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border"
              style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-1.5 h-8 px-5 text-[10px] font-bold uppercase tracking-wider border disabled:opacity-40"
              style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
              {loading ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {loading ? "Saving…" : initial ? "Update" : "Add Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function IPWhitelistingPage() {
  const router = useRouter();

  const [entries,     setEntries]     = useState<Entry[]>([]);
  const [enabled,     setEnabled]     = useState(false);
  const [isLoading,   setIsLoading]   = useState(true);
  const [toggling,    setToggling]    = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);
  const [formOpen,    setFormOpen]    = useState(false);
  const [editing,     setEditing]     = useState<Entry | null>(null);
  const [myIp,        setMyIp]        = useState("");
  const [myDeviceId,  setMyDeviceId]  = useState("");

  /* ── Load my IP + deviceId ── */
  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then(r => r.json()).then(d => setMyIp(d.ip ?? "")).catch(() => {});
    const stored = localStorage.getItem("deviceId") ?? (() => {
      const id = crypto.randomUUID();
      localStorage.setItem("deviceId", id);
      return id;
    })();
    setMyDeviceId(stored);
  }, []);

  /* ── Load entries ── */
  const load = async () => {
    setIsLoading(true);
    try {
      const res  = await fetch("/api/settings/ip-whitelist");
      const json = await res.json();
      if (json.success) { setEntries(json.entries); setEnabled(json.enabled); }
    } catch { toast.error("Failed to load whitelist."); }
    finally  { setIsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  /* ── Toggle global ── */
  const handleToggle = async () => {
    setToggling(true);
    try {
      const res  = await fetch("/api/settings/ip-whitelist", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-global", enabled: !enabled }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setEnabled(v => !v);
      toast.success(!enabled ? "IP Whitelist enabled." : "IP Whitelist disabled.");
    } catch (err: any) { toast.error(err.message ?? "Toggle failed."); }
    finally { setToggling(false); }
  };

  /* ── Toggle entry ── */
  const handleToggleEntry = async (entry: Entry) => {
    try {
      await fetch("/api/settings/ip-whitelist", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: entry._id, enabled: !entry.enabled }),
      });
      setEntries(prev => prev.map(e => e._id === entry._id ? { ...e, enabled: !e.enabled } : e));
    } catch { toast.error("Update failed."); }
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res  = await fetch("/api/settings/ip-whitelist", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setEntries(prev => prev.filter(e => e._id !== id));
      toast.success("Entry removed.");
    } catch (err: any) { toast.error(err.message ?? "Delete failed."); }
    finally { setDeleting(null); }
  };

  /* ── Copy ── */
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard.");
  };

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden"
          style={{ backgroundColor: C.bg, color: C.text, fontFamily: C.font }}>

          {/* Dot grid */}
          <div className="fixed inset-0 pointer-events-none"
            style={{ backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`, backgroundSize: "24px 24px", opacity: 0.12, zIndex: 0 }} />

          {/* Header */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b"
            style={{ backgroundColor: C.bg, borderColor: C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <button onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest"
              style={{ color: C.dim }}
              onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
              Home
            </button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Settings</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>IP Whitelisting</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          {/* Title bar */}
          <div className="relative z-10 shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
                <Shield className="size-4" style={{ color: C.accent }} />
              </div>
              <div>
                <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>IP Whitelisting</h1>
                <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                  Restrict access by IP address and device
                </p>
              </div>
            </div>

            {/* Global toggle */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-widest" style={{ color: enabled ? C.green : C.dim }}>
                {enabled ? "Enforced" : "Disabled"}
              </span>
              <button onClick={handleToggle} disabled={toggling}
                className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                style={{
                  borderColor:     enabled ? C.green + "50" : C.border,
                  color:           enabled ? C.green : C.dim,
                  backgroundColor: enabled ? C.green + "10" : "transparent",
                }}>
                {toggling ? <Loader2 className="size-3.5 animate-spin" />
                  : enabled ? <ToggleRight className="size-3.5" /> : <ToggleLeft className="size-3.5" />}
                {enabled ? "Disable" : "Enable"}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* My info card */}
            <div className="border p-4" style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: C.accent }}>
                Your Current Info
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between px-3 py-2 border"
                  style={{ borderColor: C.border, backgroundColor: C.bg }}>
                  <div className="flex items-center gap-2">
                    <Wifi className="size-3.5" style={{ color: C.dim }} />
                    <div>
                      <p className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>Your IP</p>
                      <p className="text-[11px] font-bold font-mono mt-0.5" style={{ color: C.text }}>
                        {myIp || "Detecting…"}
                      </p>
                    </div>
                  </div>
                  {myIp && (
                    <button onClick={() => copy(myIp)} style={{ color: C.dim }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                      <Copy className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between px-3 py-2 border"
                  style={{ borderColor: C.border, backgroundColor: C.bg }}>
                  <div className="flex items-center gap-2">
                    <Monitor className="size-3.5" style={{ color: C.dim }} />
                    <div>
                      <p className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>Device ID</p>
                      <p className="text-[10px] font-bold font-mono mt-0.5 truncate max-w-[140px]" style={{ color: C.text }}>
                        {myDeviceId ? myDeviceId.slice(0, 18) + "…" : "—"}
                      </p>
                    </div>
                  </div>
                  {myDeviceId && (
                    <button onClick={() => copy(myDeviceId)} style={{ color: C.dim }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                      <Copy className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Warning when enabled with no entries */}
            {enabled && entries.filter(e => e.enabled).length === 0 && (
              <div className="flex items-start gap-2.5 px-4 py-3 border"
                style={{ borderColor: "#fbbf2440", backgroundColor: "#fbbf2408" }}>
                <AlertTriangle className="size-4 shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
                <p className="text-[11px]" style={{ color: "#fbbf24" }}>
                  Whitelist is <strong>enabled</strong> but has no active entries.
                  All access is currently blocked. Add your IP first.
                </p>
              </div>
            )}

            {/* Table header */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>
                {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
              </p>
              <button onClick={() => { setEditing(null); setFormOpen(true); }}
                className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ backgroundColor: "rgba(232,99,10,0.1)", borderColor: C.accent, color: C.accent }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.2)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)")}>
                <Plus className="size-3" /> Add Entry
              </button>
            </div>

            {/* Table */}
            <div className="border overflow-hidden" style={{ borderColor: C.border }}>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-2">
                  <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                  <span className="text-[11px] uppercase tracking-widest" style={{ color: C.dim }}>Loading…</span>
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Shield className="size-8 opacity-10" style={{ color: C.accent }} />
                  <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.dim }}>
                    No entries yet
                  </p>
                  <button onClick={() => { setEditing(null); setFormOpen(true); }}
                    className="text-[10px] uppercase tracking-wider" style={{ color: C.accent }}>
                    + Add your IP
                  </button>
                </div>
              ) : (
                <table className="w-full border-collapse text-[11px]" style={{ fontFamily: C.font }}>
                  <thead>
                    <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                      {["IP Address","Label","Device ID","Status","Added","Actions"].map((h, i) => (
                        <th key={h} className={`px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest ${i === 5 ? "text-right" : "text-left"}`}
                          style={{ color: `${C.accent}99`, borderRight: i < 5 ? `1px solid ${C.border}` : undefined }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={e._id}
                        style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel, borderBottom: `1px solid ${C.border}` }}>
                        <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.text }}>
                          {e.ip}
                          {e.ip === myIp && (
                            <span className="ml-2 text-[8px] px-1.5 py-0.5 border"
                              style={{ borderColor: C.green + "40", color: C.green, backgroundColor: C.green + "10" }}>
                              You
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>
                          {e.label || "—"}
                        </td>
                        <td className="px-4 py-2.5 font-mono" style={{ borderRight: `1px solid ${C.border}`, color: C.muted }}>
                          {e.deviceId ? e.deviceId.slice(0, 16) + "…" : "—"}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                          <button onClick={() => handleToggleEntry(e)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase border transition-colors"
                            style={{
                              borderColor:     e.enabled ? C.green + "40" : C.border,
                              color:           e.enabled ? C.green : C.dim,
                              backgroundColor: e.enabled ? C.green + "10" : "transparent",
                            }}>
                            {e.enabled
                              ? <><CheckCircle2 className="size-3" /> Allowed</>
                              : <><XCircle      className="size-3" /> Blocked</>}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[10px]"
                          style={{ borderRight: `1px solid ${C.border}`, color: C.muted }}>
                          {new Date(e.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => { setEditing(e); setFormOpen(true); }}
                              className="flex items-center justify-center h-6 w-6 border transition-colors"
                              style={{ borderColor: C.border, color: C.dim }}
                              onMouseEnter={e2 => { e2.currentTarget.style.borderColor = C.accent; e2.currentTarget.style.color = C.accent; }}
                              onMouseLeave={e2 => { e2.currentTarget.style.borderColor = C.border; e2.currentTarget.style.color = C.dim; }}>
                              <Pencil className="size-3" />
                            </button>
                            <button onClick={() => handleDelete(e._id)} disabled={deleting === e._id}
                              className="flex items-center justify-center h-6 w-6 border transition-colors disabled:opacity-40"
                              style={{ borderColor: C.border, color: C.dim }}
                              onMouseEnter={e2 => { e2.currentTarget.style.borderColor = C.red; e2.currentTarget.style.color = C.red; }}
                              onMouseLeave={e2 => { e2.currentTarget.style.borderColor = C.border; e2.currentTarget.style.color = C.dim; }}>
                              {deleting === e._id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </SidebarInset>
      </SidebarProvider>

      <EntryForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        initial={editing}
        myIp={myIp}
        myDeviceId={myDeviceId}
        onSaved={load}
      />
    </ProtectedPageWrapper>
  );
}
