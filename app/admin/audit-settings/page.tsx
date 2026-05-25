"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbSeparator, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Archive, Trash2, Calendar, Clock, AlertTriangle,
  CheckCircle2, Loader2, Database, HardDrive, Settings,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LogStats {
  systemAudits:                    { count: number };
  systemAudits_archive:            { count: number };
  activity_logs:                   { count: number };
  taskflow_customer_audit_logs:    { count: number };
}
interface RetentionSettings {
  retentionDays: number;
  autoArchive:   boolean;
  autoPurge:     boolean;
  archiveEnabled:boolean;
}

// ─── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  muted:  "#253040",
  dim:    "#4a6070",
  text:   "#c8d8e8",
  accent: "#e8630a",
  font:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, title, danger, children }: {
  icon: any; title: string; danger?: boolean; children: React.ReactNode;
}) {
  const color = danger ? "#f87171" : C.accent;
  return (
    <div className="border" style={{ borderColor: danger ? "#f8717140" : C.border, backgroundColor: C.panel }}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b"
        style={{ borderColor: danger ? "#f8717140" : C.border, backgroundColor: C.bg }}>
        <div className="flex h-6 w-6 items-center justify-center border"
          style={{ borderColor: danger ? "#f8717140" : C.border, backgroundColor: "#0f1923" }}>
          <Icon className="size-3" style={{ color }} />
        </div>
        <h2 className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onCheckedChange }: {
  label: string; hint?: string; checked: boolean; onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-b-0"
      style={{ borderColor: C.muted + "30" }}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.text }}>{label}</p>
        {hint && <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-orange-500" />
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-3 border-r last:border-r-0"
      style={{ borderColor: C.border, backgroundColor: C.panel }}>
      <span className="text-lg font-bold leading-none" style={{ color }}>{value}</span>
      <span className="text-[9px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>{label}</span>
    </div>
  );
}

export default function AuditLogSettingsPage() {
  const router = useRouter();

  const [stats,    setStats]    = useState<LogStats | null>(null);
  const [settings, setSettings] = useState<RetentionSettings>({
    retentionDays: 90, autoArchive: true, autoPurge: false, archiveEnabled: true,
  });
  const [archiving, setArchiving] = useState(false);
  const [purging,   setPurging]   = useState(false);
  const [purgeDateRange, setPurgeDateRange] = useState({ from: "", to: "" });

  useEffect(() => { fetchStats(); }, []);

  const api = async (body: object) => {
    const res = await fetch("/api/Data/Applications/Admin/AuditLogs/Manage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const fetchStats = async () => {
    try {
      const data = await api({ action: "get_stats" });
      if (data.success) setStats(data.stats);
    } catch {}
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const data = await api({ action: "archive", params: { retentionDays: settings.retentionDays } });
      data.success
        ? (toast.success(`Archived ${data.archivedCount} logs older than ${settings.retentionDays} days`), fetchStats())
        : toast.error(data.error || "Archive failed");
    } catch { toast.error("Archive failed"); } finally { setArchiving(false); }
  };

  const handlePurge = async () => {
    if (!confirm("Permanently delete these logs? This cannot be undone.")) return;
    setPurging(true);
    try {
      const params = purgeDateRange.from && purgeDateRange.to
        ? { fromDate: purgeDateRange.from, toDate: purgeDateRange.to }
        : { all: true };
      const data = await api({ action: "purge", params });
      data.success
        ? (toast.success(`Deleted ${data.deletedCount} logs`), fetchStats())
        : toast.error(data.error || "Purge failed");
    } catch { toast.error("Purge failed"); } finally { setPurging(false); }
  };

  const set = (patch: Partial<RetentionSettings>) => setSettings(p => ({ ...p, ...patch }));

  const totalLogs   = stats ? stats.systemAudits.count + stats.activity_logs.count + stats.taskflow_customer_audit_logs.count : 0;
  const archivedLogs = stats?.systemAudits_archive?.count ?? 0;

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden bg-[#080d12]"
          style={{ fontFamily: C.font, color: C.text }}>

          {/* Dot-grid */}
          <div className="fixed inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
            backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
          }} />

          {/* ── Header ── */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b bg-[#080d12]"
            style={{ borderColor: C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/audit-logs" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Audit Logs</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Settings</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Live</span>
            </div>
          </header>

          {/* ── Title bar ── */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b bg-[#0d1117]"
            style={{ borderColor: C.border }}>
            <div className="flex h-8 w-8 items-center justify-center border"
              style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <Settings className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Audit Log Settings</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Retention · Archive · Purge
              </p>
            </div>
            <div className="ml-auto">
              <button onClick={() => router.push("/audit-logs")}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                ← Audit Logs
              </button>
            </div>
          </div>

          {/* ── Stats bar ── */}
          <div className="relative z-10 shrink-0 grid grid-cols-4 border-b" style={{ borderColor: C.border }}>
            <StatTile icon={Database}  label="Active Logs"  value={totalLogs.toLocaleString()}    color={C.text} />
            <StatTile icon={Archive}   label="Archived"     value={archivedLogs.toLocaleString()}  color="#fbbf24" />
            <StatTile icon={Clock}     label="Retention"    value={`${settings.retentionDays}d`}   color="#34d399" />
            <StatTile icon={HardDrive} label="Collections"  value={4}                              color="#60a5fa" />
          </div>

          {/* ── Scrollable content ── */}
          <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5">
            <div className="w-full space-y-4">

              {/* Row 1: Retention + Purge */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Retention Policy */}
                <SectionCard icon={Clock} title="Retention Policy">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>
                        Retention Period
                      </p>
                      <span className="text-[11px] font-bold px-2 py-0.5 border"
                        style={{ borderColor: C.border, color: C.accent, backgroundColor: "rgba(232,99,10,0.1)" }}>
                        {settings.retentionDays} days
                      </span>
                    </div>
                    <Slider
                      value={[settings.retentionDays]}
                      onValueChange={([v]: number[]) => set({ retentionDays: v })}
                      min={7} max={365} step={1}
                      className="w-full [&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-500 [&_.bg-primary]:bg-orange-500"
                    />
                    <p className="text-[10px] mt-2" style={{ color: C.muted }}>
                      Logs older than {settings.retentionDays} days are eligible for archiving
                    </p>
                  </div>

                  <ToggleRow label="Auto-Archive" hint="Automatically archive old logs on schedule"
                    checked={settings.autoArchive} onCheckedChange={v => set({ autoArchive: v })} />
                  <ToggleRow label="Enable Archiving" hint="Keep archived logs in a separate collection"
                    checked={settings.archiveEnabled} onCheckedChange={v => set({ archiveEnabled: v })} />

                  <button onClick={handleArchive} disabled={archiving}
                    className="w-full flex items-center justify-center gap-2 h-9 text-[11px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                    style={{ backgroundColor: "rgba(232,99,10,0.1)", borderColor: C.accent, color: C.accent }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)"; }}>
                    {archiving ? <Loader2 className="size-3 animate-spin" /> : <Archive className="size-3" />}
                    {archiving ? "Archiving…" : "Archive Old Logs Now"}
                  </button>
                </SectionCard>

                {/* Purge */}
                <SectionCard icon={Trash2} title="Purge Logs" danger>
                  {/* Warning */}
                  <div className="flex items-start gap-2.5 px-3 py-2.5 border"
                    style={{ borderColor: "#f8717140", backgroundColor: "rgba(248,113,113,0.05)" }}>
                    <AlertTriangle className="size-3.5 shrink-0 mt-0.5" style={{ color: "#f87171" }} />
                    <p className="text-[10px]" style={{ color: "#f87171" }}>
                      Purging permanently deletes logs from the database. Consider archiving instead.
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.dim }}>
                      Date Range (optional)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[["From", "from"], ["To", "to"]].map(([lbl, key]) => (
                        <div key={key}>
                          <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>{lbl}</p>
                          <input type="date" value={(purgeDateRange as any)[key]}
                            onChange={e => setPurgeDateRange(p => ({ ...p, [key]: e.target.value }))}
                            className="w-full h-8 px-2 text-[11px] focus:outline-none"
                            style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }} />
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] mt-1.5" style={{ color: C.muted }}>
                      Leave empty to purge all logs (not recommended)
                    </p>
                  </div>

                  <button onClick={handlePurge} disabled={purging}
                    className="w-full flex items-center justify-center gap-2 h-9 text-[11px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                    style={{ backgroundColor: "rgba(248,113,113,0.1)", borderColor: "#f8717140", color: "#f87171" }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.1)"; }}>
                    {purging ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                    {purging ? "Purging…" : "Purge Logs"}
                  </button>
                </SectionCard>
              </div>

              {/* Collection Stats */}
              {stats && (
                <SectionCard icon={Database} title="Collection Statistics">
                  <div className="space-y-0 border" style={{ borderColor: C.border }}>
                    {Object.entries(stats).map(([col, data], i) => (
                      <div key={col} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0"
                        style={{ borderColor: C.muted + "30", backgroundColor: i % 2 === 0 ? C.bg : C.panel }}>
                        <div className="flex items-center gap-2.5">
                          <Database className="size-3" style={{ color: C.dim }} />
                          <span className="text-[11px] font-mono" style={{ color: C.text }}>{col}</span>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 border"
                          style={{
                            borderColor: col.includes("archive") ? "#fbbf2440" : `${C.accent}40`,
                            color: col.includes("archive") ? "#fbbf24" : C.accent,
                            backgroundColor: col.includes("archive") ? "rgba(251,191,36,0.08)" : "rgba(232,99,10,0.08)",
                          }}>
                          {data.count.toLocaleString()} logs
                        </span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

            </div>
          </div>

        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
