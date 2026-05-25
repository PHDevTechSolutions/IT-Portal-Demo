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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Database, Download, Calendar, Clock, Loader2, HardDrive,
  FileSpreadsheet, Save, Play, Bell, RotateCcw, Shield,
  AlertCircle, Cloud, Trash2, Eye, Upload, CheckCircle,
  CalendarDays, Mail, Server,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BackupSettings {
  enabled: boolean; frequency: "weekly"|"monthly"|"yearly";
  dayOfWeek: number; dayOfMonth: number; monthOfYear: number; time: string;
  dateRangeFrom: string; dateRangeTo: string; includeTables: string[];
  notifyOnSuccess: boolean; notifyOnFailure: boolean;
  emailNotifications: boolean; notificationEmail: string;
  retentionCount: number; storageLocation: "local"|"cloud"|"both";
  cloudProvider: "aws"|"gcp"|"azure"|"supabase";
}
interface BackupHistory {
  id: string; timestamp: string; status: "success"|"failed"|"in_progress";
  size: string; frequency: string; recordsCount: number;
  downloadUrl?: string; tables?: string[];
}

const AVAILABLE_TABLES = [
  { id: "activity",          name: "Activity Logs",       db: "supabase" },
  { id: "documentation",     name: "Documentation",       db: "supabase" },
  { id: "history",           name: "History",             db: "supabase" },
  { id: "revised_quotations",name: "Revised Quotations",  db: "supabase" },
  { id: "meetings",          name: "Meetings",            db: "supabase" },
  { id: "signatories",       name: "Signatories",         db: "supabase" },
  { id: "spf_request",       name: "SPF Requests",        db: "supabase" },
  { id: "users",             name: "Users (MongoDB)",     db: "mongodb"  },
  { id: "system_audits",     name: "System Audits",       db: "mongodb"  },
  { id: "customer_database", name: "Customer Database",   db: "mongodb"  },
];

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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

// ─── Small helpers ────────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="border" style={{ borderColor: C.border, backgroundColor: C.panel }}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
        <div className="flex h-6 w-6 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
          <Icon className="size-3" style={{ color: C.accent }} />
        </div>
        <h2 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: C.dim }}>{children}</p>;
}

function OpsSelect({ value, onValueChange, disabled, children }: {
  value: string; onValueChange: (v: any) => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="h-8 rounded-none text-[11px] focus:ring-0 w-full"
        style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-none" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>
        {children}
      </SelectContent>
    </Select>
  );
}

function OpsSelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <SelectItem value={value} className="text-[11px] rounded-none focus:bg-orange-500/10 focus:text-orange-400"
      style={{ color: C.text, fontFamily: C.font }}>{children}</SelectItem>
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

function StatusDot({ status }: { status: string }) {
  const color = status === "success" ? "#34d399" : status === "failed" ? "#f87171" : "#fbbf24";
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BackupDatabaseSettingsPage() {
  const router = useRouter();

  const [loading,       setLoading]       = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [settings, setSettings] = useState<BackupSettings>({
    enabled: true, frequency: "weekly", dayOfWeek: 0, dayOfMonth: 1,
    monthOfYear: 1, time: "02:00",
    dateRangeFrom: format(new Date(Date.now() - 30*24*60*60*1000), "yyyy-MM-dd"),
    dateRangeTo: format(new Date(), "yyyy-MM-dd"),
    includeTables: ["activity","history","users","customer_database"],
    notifyOnSuccess: true, notifyOnFailure: true,
    emailNotifications: false, notificationEmail: "",
    retentionCount: 10, storageLocation: "local", cloudProvider: "supabase",
  });
  const [backupHistory,      setBackupHistory]      = useState<BackupHistory[]>([]);
  const [nextBackupTime,     setNextBackupTime]      = useState("");
  const [previewDialogOpen,  setPreviewDialogOpen]   = useState(false);
  const [previewData,        setPreviewData]         = useState<any>(null);
  const [loadingPreview,     setLoadingPreview]      = useState(false);
  const [restoreDialogOpen,  setRestoreDialogOpen]   = useState(false);
  const [selectedBackupId,   setSelectedBackupId]    = useState<string|null>(null);
  const [restoreOptions,     setRestoreOptions]      = useState({ restoreTables: [] as string[], overwrite: false, notifyOnRestore: true });
  const [restoringBackup,    setRestoringBackup]     = useState(false);
  const [restoreResults,     setRestoreResults]      = useState<any>(null);
  const [verifyingBackup,    setVerifyingBackup]     = useState(false);
  const [verificationResult, setVerificationResult]  = useState<any>(null);
  const [calendarOpen,       setCalendarOpen]        = useState(false);

  useEffect(() => { fetchSettings(); fetchBackupHistory(); }, []);
  useEffect(() => { calculateNextBackup(); }, [settings]);

  const api = async (body: object) => {
    const res = await fetch("/api/Data/Applications/Admin/BackupSettings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const fetchSettings = async () => {
    try {
      const data = await api({ action: "get_settings" });
      if (data.success && data.settings) setSettings(data.settings);
    } catch {}
  };

  const fetchBackupHistory = async () => {
    try {
      const data = await api({ action: "get_history" });
      if (data.success) setBackupHistory(data.history || []);
    } catch {}
  };

  const calculateNextBackup = () => {
    if (!settings.enabled) { setNextBackupTime("Disabled"); return; }
    const now = new Date();
    const [h, m] = settings.time.split(":").map(Number);
    let next = new Date(now); next.setHours(h, m, 0, 0);
    if (settings.frequency === "weekly") {
      const d = (settings.dayOfWeek - now.getDay() + 7) % 7;
      next.setDate(now.getDate() + d);
      if (next <= now) next.setDate(next.getDate() + 7);
    } else if (settings.frequency === "monthly") {
      next.setDate(settings.dayOfMonth);
      if (next <= now) next.setMonth(next.getMonth() + 1);
    } else {
      next.setMonth(settings.monthOfYear - 1); next.setDate(settings.dayOfMonth);
      if (next <= now) next.setFullYear(next.getFullYear() + 1);
    }
    setNextBackupTime(format(next, "MMM dd, yyyy 'at' h:mm a"));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const data = await api({ action: "save_settings", settings });
      data.success ? toast.success("Settings saved") : toast.error(data.error || "Failed");
    } catch { toast.error("Failed to save"); } finally { setLoading(false); }
  };

  const handleRunNow = async () => {
    setRunningBackup(true);
    try {
      const data = await api({ action: "run_backup", settings });
      if (data.success) { toast.success(`Backup done — ${data.recordsCount} records`); fetchBackupHistory(); }
      else toast.error(data.error || "Backup failed");
    } catch { toast.error("Backup failed"); } finally { setRunningBackup(false); }
  };

  const handleDownloadZip = async (id: string) => {
    try {
      const data = await api({ action: "download_zip", backupId: id });
      if (data.success && data.downloadUrl) {
        const a = document.createElement("a"); a.href = data.downloadUrl;
        a.download = `backup_${id}.zip`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        toast.success("ZIP downloaded");
      } else toast.error(data.error || "Failed");
    } catch { toast.error("Download failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this backup?")) return;
    try {
      const data = await api({ action: "delete_backup", backupId: id });
      data.success ? (toast.success("Deleted"), fetchBackupHistory()) : toast.error(data.error || "Failed");
    } catch { toast.error("Delete failed"); }
  };

  const handlePreview = async (id: string) => {
    setLoadingPreview(true); setPreviewDialogOpen(true);
    try {
      const data = await api({ action: "get_preview", backupId: id });
      data.success ? setPreviewData(data.preview) : (toast.error(data.error || "Failed"), setPreviewDialogOpen(false));
    } catch { toast.error("Preview failed"); setPreviewDialogOpen(false); } finally { setLoadingPreview(false); }
  };

  const handleOpenRestore = (id: string, tables: string[]) => {
    setSelectedBackupId(id); setRestoreOptions(p => ({ ...p, restoreTables: tables }));
    setRestoreDialogOpen(true); setRestoreResults(null);
  };

  const handleRestore = async () => {
    if (!selectedBackupId) return;
    setRestoringBackup(true);
    try {
      const data = await api({ action: "restore_backup", backupId: selectedBackupId, options: restoreOptions });
      data.success ? (toast.success("Restored!"), setRestoreResults(data.results)) : toast.error(data.error || "Failed");
    } catch { toast.error("Restore failed"); } finally { setRestoringBackup(false); }
  };

  const handleVerify = async (id: string) => {
    setVerifyingBackup(true);
    try {
      const data = await api({ action: "verify_backup", backupId: id });
      setVerificationResult(data);
      data.verified ? toast.success("Verified!") : toast.error("Verification failed");
    } catch { toast.error("Verify failed"); } finally { setVerifyingBackup(false); }
  };

  const toggleTable = (id: string) =>
    setSettings(p => ({
      ...p, includeTables: p.includeTables.includes(id)
        ? p.includeTables.filter(t => t !== id)
        : [...p.includeTables, id],
    }));

  const set = (patch: Partial<BackupSettings>) => setSettings(p => ({ ...p, ...patch }));

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
                  <BreadcrumbLink href="/settings/general" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Settings</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Database Backup</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Online</span>
            </div>
          </header>

          {/* ── Title bar ── */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b bg-[#0d1117]"
            style={{ borderColor: C.border }}>
            <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <Database className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Database Backup</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>Automated Data Protection System</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setCalendarOpen(true)}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                <CalendarDays className="size-3" /> Schedule
              </button>
            </div>
          </div>

          {/* ── Stats bar ── */}
          <div className="relative z-10 shrink-0 grid grid-cols-4 border-b" style={{ borderColor: C.border }}>
            {[
              { label: "Frequency",      value: settings.frequency,          color: "#60a5fa", icon: Clock },
              { label: "Next Backup",    value: nextBackupTime || "…",       color: "#34d399", icon: Calendar },
              { label: "Tables",         value: settings.includeTables.length, color: "#a78bfa", icon: HardDrive },
              { label: "Keep",           value: `${settings.retentionCount} backups`, color: C.accent, icon: RotateCcw },
            ].map(({ label, value, color, icon: Icon }, i) => (
              <div key={i} className="flex flex-col items-center justify-center py-3 border-r last:border-r-0"
                style={{ borderColor: C.border, backgroundColor: C.panel }}>
                <span className="text-sm font-bold leading-none capitalize" style={{ color }}>{value}</span>
                <span className="text-[9px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>{label}</span>
              </div>
            ))}
          </div>

          {/* ── Scrollable content ── */}
          <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5">
            <div className="w-full space-y-4">

              {/* Row 1: Schedule + Data Selection */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Schedule */}
                <SectionCard icon={Clock} title="Backup Schedule">
                  <ToggleRow label="Enable Automated Backups" hint="Turn on/off the backup schedule"
                    checked={settings.enabled} onCheckedChange={v => set({ enabled: v })} />

                  <div>
                    <FieldLabel>Frequency</FieldLabel>
                    <OpsSelect value={settings.frequency} onValueChange={v => set({ frequency: v })} disabled={!settings.enabled}>
                      <OpsSelectItem value="weekly">Weekly</OpsSelectItem>
                      <OpsSelectItem value="monthly">Monthly</OpsSelectItem>
                      <OpsSelectItem value="yearly">Yearly</OpsSelectItem>
                    </OpsSelect>
                  </div>

                  {settings.frequency === "weekly" && (
                    <div>
                      <FieldLabel>Day of Week</FieldLabel>
                      <OpsSelect value={settings.dayOfWeek.toString()} onValueChange={v => set({ dayOfWeek: +v })} disabled={!settings.enabled}>
                        {DAYS.map((d, i) => <OpsSelectItem key={i} value={i.toString()}>{d}</OpsSelectItem>)}
                      </OpsSelect>
                    </div>
                  )}

                  {(settings.frequency === "monthly" || settings.frequency === "yearly") && (
                    <div>
                      <FieldLabel>Day of Month</FieldLabel>
                      <OpsSelect value={settings.dayOfMonth.toString()} onValueChange={v => set({ dayOfMonth: +v })} disabled={!settings.enabled}>
                        {Array.from({length:31},(_,i)=>i+1).map(d => <OpsSelectItem key={d} value={d.toString()}>{d}</OpsSelectItem>)}
                      </OpsSelect>
                    </div>
                  )}

                  {settings.frequency === "yearly" && (
                    <div>
                      <FieldLabel>Month</FieldLabel>
                      <OpsSelect value={settings.monthOfYear.toString()} onValueChange={v => set({ monthOfYear: +v })} disabled={!settings.enabled}>
                        {MONTHS.map((m, i) => <OpsSelectItem key={i+1} value={(i+1).toString()}>{m}</OpsSelectItem>)}
                      </OpsSelect>
                    </div>
                  )}

                  <div>
                    <FieldLabel>Backup Time</FieldLabel>
                    <input type="time" value={settings.time} disabled={!settings.enabled}
                      onChange={e => set({ time: e.target.value })}
                      className="w-full h-8 px-3 text-[11px] focus:outline-none"
                      style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }} />
                    <p className="text-[10px] mt-1" style={{ color: C.muted }}>Recommended: off-peak hours (e.g. 02:00)</p>
                  </div>

                  <div>
                    <FieldLabel>Retention (backups to keep)</FieldLabel>
                    <OpsSelect value={settings.retentionCount.toString()} onValueChange={v => set({ retentionCount: +v })}>
                      {[5,10,20,30,50,100].map(n => <OpsSelectItem key={n} value={n.toString()}>{n} backups</OpsSelectItem>)}
                    </OpsSelect>
                  </div>
                </SectionCard>

                {/* Data Selection */}
                <SectionCard icon={FileSpreadsheet} title="Data Selection">
                  <div>
                    <FieldLabel>Date Range (optional)</FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {[["From", "dateRangeFrom"], ["To", "dateRangeTo"]].map(([lbl, key]) => (
                        <div key={key}>
                          <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>{lbl}</p>
                          <input type="date" value={(settings as any)[key]}
                            onChange={e => set({ [key]: e.target.value } as any)}
                            className="w-full h-8 px-2 text-[11px] focus:outline-none"
                            style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }} />
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: C.muted }}>Leave empty to backup all data</p>
                  </div>

                  <div>
                    <FieldLabel>Tables to Backup</FieldLabel>
                    <div className="border overflow-y-auto max-h-52 space-y-0" style={{ borderColor: C.border }}>
                      {AVAILABLE_TABLES.map(t => (
                        <label key={t.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer border-b last:border-b-0 transition-colors"
                          style={{ borderColor: C.muted + "30" }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                          <Checkbox checked={settings.includeTables.includes(t.id)}
                            onCheckedChange={() => toggleTable(t.id)}
                            className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 h-3.5 w-3.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold" style={{ color: C.text }}>{t.name}</p>
                            <p className="text-[9px]" style={{ color: C.muted }}>{t.db === "supabase" ? "PostgreSQL · Supabase" : "MongoDB"}</p>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 border font-bold uppercase"
                            style={{ borderColor: t.db === "supabase" ? "#60a5fa40" : "#a78bfa40", color: t.db === "supabase" ? "#60a5fa" : "#a78bfa" }}>
                            {t.db}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </SectionCard>
              </div>

              {/* Row 2: Storage + Notifications */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Storage */}
                <SectionCard icon={Cloud} title="Storage Location">
                  <div>
                    <FieldLabel>Storage Type</FieldLabel>
                    <OpsSelect value={settings.storageLocation} onValueChange={v => set({ storageLocation: v })}>
                      <OpsSelectItem value="local">Local Storage</OpsSelectItem>
                      <OpsSelectItem value="cloud">Cloud Only</OpsSelectItem>
                      <OpsSelectItem value="both">Local + Cloud</OpsSelectItem>
                    </OpsSelect>
                  </div>
                  {settings.storageLocation !== "local" && (
                    <div>
                      <FieldLabel>Cloud Provider</FieldLabel>
                      <OpsSelect value={settings.cloudProvider} onValueChange={v => set({ cloudProvider: v })}>
                        <OpsSelectItem value="supabase">Supabase</OpsSelectItem>
                        <OpsSelectItem value="aws">AWS S3</OpsSelectItem>
                        <OpsSelectItem value="gcp">Google Cloud</OpsSelectItem>
                        <OpsSelectItem value="azure">Azure Blob</OpsSelectItem>
                      </OpsSelect>
                    </div>
                  )}
                </SectionCard>

                {/* Notifications */}
                <SectionCard icon={Bell} title="Notifications">
                  <ToggleRow label="Notify on Success" hint="Alert when backup completes"
                    checked={settings.notifyOnSuccess} onCheckedChange={v => set({ notifyOnSuccess: v })} />
                  <ToggleRow label="Notify on Failure" hint="Alert when backup fails"
                    checked={settings.notifyOnFailure} onCheckedChange={v => set({ notifyOnFailure: v })} />
                  <ToggleRow label="Email Notifications" hint="Send email alongside Firebase"
                    checked={settings.emailNotifications} onCheckedChange={v => set({ emailNotifications: v })} />
                  {settings.emailNotifications && (
                    <div>
                      <FieldLabel>Notification Email</FieldLabel>
                      <input type="email" placeholder="admin@company.com" value={settings.notificationEmail}
                        onChange={e => set({ notificationEmail: e.target.value })}
                        className="w-full h-8 px-3 text-[11px] focus:outline-none"
                        style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }} />
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button onClick={handleSave} disabled={loading}
                  className="flex items-center gap-2 h-9 px-5 text-[11px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "rgba(232,99,10,0.15)", borderColor: C.accent, color: C.accent }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.25)"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.15)"; }}>
                  {loading ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                  {loading ? "Saving…" : "Save Settings"}
                </button>
                <button onClick={handleRunNow} disabled={runningBackup || settings.includeTables.length === 0}
                  className="flex items-center gap-2 h-9 px-5 text-[11px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                  {runningBackup ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                  {runningBackup ? "Running…" : "Run Backup Now"}
                </button>
              </div>

              {/* Backup History */}
              <SectionCard icon={Database} title="Backup History">
                {backupHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <HardDrive className="size-8 opacity-20" style={{ color: C.dim }} />
                    <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No backup history</p>
                  </div>
                ) : (
                  <div className="space-y-0 border" style={{ borderColor: C.border }}>
                    {backupHistory.map((b, i) => (
                      <div key={b.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
                        style={{ borderColor: C.muted + "30", backgroundColor: i % 2 === 0 ? C.bg : C.panel }}>
                        <StatusDot status={b.status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold" style={{ color: C.text }}>
                            {format(new Date(b.timestamp), "MMM dd, yyyy HH:mm")}
                          </p>
                          <p className="text-[10px]" style={{ color: C.muted }}>
                            {b.frequency} · {b.recordsCount.toLocaleString()} records · {b.size}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Preview */}
                          <button onClick={() => handlePreview(b.id)}
                            className="h-6 w-6 flex items-center justify-center border transition-all"
                            style={{ borderColor: C.border, color: C.dim }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                            <Eye className="size-3" />
                          </button>
                          {b.status === "success" && (<>
                            {/* Download ZIP */}
                            <button onClick={() => handleDownloadZip(b.id)}
                              className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase tracking-wider border transition-all"
                              style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "rgba(52,211,153,0.08)" }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(52,211,153,0.15)"; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(52,211,153,0.08)"; }}>
                              <Download className="size-3" /> ZIP
                            </button>
                            {/* Restore */}
                            <button onClick={() => handleOpenRestore(b.id, b.tables || [])}
                              className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase tracking-wider border transition-all"
                              style={{ borderColor: "#fbbf2440", color: "#fbbf24", backgroundColor: "rgba(251,191,36,0.08)" }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(251,191,36,0.15)"; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(251,191,36,0.08)"; }}>
                              <RotateCcw className="size-3" /> Restore
                            </button>
                            {/* Verify */}
                            <button onClick={() => handleVerify(b.id)} disabled={verifyingBackup}
                              className="h-6 w-6 flex items-center justify-center border transition-all disabled:opacity-40"
                              style={{ borderColor: "#a78bfa40", color: "#a78bfa" }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(167,139,250,0.1)"; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                              {verifyingBackup ? <Loader2 className="size-3 animate-spin" /> : <Shield className="size-3" />}
                            </button>
                          </>)}
                          {b.status === "in_progress" && (
                            <span className="text-[9px] px-2 py-0.5 border font-bold uppercase"
                              style={{ borderColor: "#fbbf2440", color: "#fbbf24" }}>
                              <Loader2 className="size-3 animate-spin inline mr-1" />Running
                            </span>
                          )}
                          {/* Delete */}
                          <button onClick={() => handleDelete(b.id)}
                            className="h-6 w-6 flex items-center justify-center border transition-all"
                            style={{ borderColor: C.border, color: C.dim }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

            </div>
          </div>

        </SidebarInset>
      </SidebarProvider>

      {/* ── Preview Dialog ── */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto rounded-none p-0 gap-0"
          style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>
          <DialogHeader className="px-5 py-4 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
            <DialogTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: C.accent }}>
              <Eye className="size-3" /> Backup Preview
            </DialogTitle>
            <DialogDescription className="text-[10px] uppercase tracking-wider mt-1" style={{ color: C.muted }}>
              First 5 rows per table
            </DialogDescription>
          </DialogHeader>
          <div className="p-5">
            {loadingPreview ? (
              <div className="flex items-center justify-center py-10 gap-3">
                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                <span className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Loading…</span>
              </div>
            ) : previewData ? (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  {[["Date", format(new Date(previewData.timestamp), "MMM dd, yyyy HH:mm")],
                    ["Tables", previewData.tables?.length || 0],
                    ["Records", (previewData.recordsCount || 0).toLocaleString()]].map(([l, v]) => (
                    <div key={String(l)} className="px-3 py-2 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                      <p className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>{l}</p>
                      <p className="text-[11px] font-bold mt-0.5" style={{ color: C.text }}>{v}</p>
                    </div>
                  ))}
                </div>
                {previewData.previewData && Object.entries(previewData.previewData).map(([tbl, rows]: [string, any]) => (
                  <div key={tbl}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: C.accent }}>
                      <FileSpreadsheet className="size-3" /> {tbl}
                      <span className="text-[9px] px-1.5 py-0.5 border" style={{ borderColor: C.border, color: C.dim }}>{rows.length} rows</span>
                    </p>
                    <div className="overflow-x-auto border" style={{ borderColor: C.border }}>
                      <table className="w-full border-collapse" style={{ fontSize: "10px", fontFamily: C.font }}>
                        <thead>
                          <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                            {rows.length > 0 && Object.keys(rows[0]).slice(0,5).map((k: string) => (
                              <th key={k} className="text-left px-3 py-2 font-bold uppercase tracking-widest text-[9px]" style={{ color: C.accent }}>{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row: any, i: number) => (
                            <tr key={i} style={{ backgroundColor: i%2===0?C.bg:C.panel, borderBottom: `1px solid ${C.border}` }}>
                              {Object.values(row).slice(0,5).map((v: any, j: number) => (
                                <td key={j} className="px-3 py-1.5" style={{ color: C.dim }}>
                                  {typeof v === "string" && v.length > 30 ? v.slice(0,30)+"…" : String(v ?? "—")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center py-8" style={{ color: C.muted }}>No preview data</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Restore Dialog ── */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="max-w-lg rounded-none p-0 gap-0"
          style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>
          <DialogHeader className="px-5 py-4 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
            <DialogTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "#fbbf24" }}>
              <RotateCcw className="size-3" /> Restore Backup
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            {restoreResults ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2" style={{ color: "#34d399" }}>
                  <CheckCircle className="size-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Restore completed</span>
                </div>
                {restoreResults.map((r: any, i: number) => (
                  <div key={i} className="flex justify-between px-3 py-2 border" style={{ borderColor: C.border }}>
                    <span className="text-[11px]" style={{ color: C.text }}>{r.table}</span>
                    <span className="text-[11px] font-bold" style={{ color: "#34d399" }}>{r.restored}/{r.total}</span>
                  </div>
                ))}
                <button onClick={() => setRestoreDialogOpen(false)}
                  className="w-full h-8 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.dim }}>Tables to Restore</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {AVAILABLE_TABLES.map(t => (
                      <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 border cursor-pointer"
                        style={{ borderColor: C.border }}>
                        <Checkbox checked={restoreOptions.restoreTables.includes(t.id)}
                          onCheckedChange={c => setRestoreOptions(p => ({
                            ...p, restoreTables: c ? [...p.restoreTables, t.id] : p.restoreTables.filter(x => x !== t.id)
                          }))}
                          className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 h-3.5 w-3.5" />
                        <span className="text-[10px]" style={{ color: C.text }}>{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <ToggleRow label="Overwrite Existing Data" hint="Delete existing data before restoring"
                  checked={restoreOptions.overwrite} onCheckedChange={v => setRestoreOptions(p => ({ ...p, overwrite: v }))} />
                <ToggleRow label="Notify on Restore"
                  checked={restoreOptions.notifyOnRestore} onCheckedChange={v => setRestoreOptions(p => ({ ...p, notifyOnRestore: v }))} />
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setRestoreDialogOpen(false)}
                    className="flex-1 h-8 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                    style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}>
                    Cancel
                  </button>
                  <button onClick={handleRestore} disabled={restoringBackup || restoreOptions.restoreTables.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 h-8 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                    style={{ backgroundColor: "rgba(251,191,36,0.15)", borderColor: "#fbbf24", color: "#fbbf24" }}>
                    {restoringBackup ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                    {restoringBackup ? "Restoring…" : "Restore"}
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Verification Dialog ── */}
      <Dialog open={!!verificationResult} onOpenChange={() => setVerificationResult(null)}>
        <DialogContent className="max-w-md rounded-none p-0 gap-0"
          style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>
          <DialogHeader className="px-5 py-4 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
            <DialogTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"
              style={{ color: verificationResult?.verified ? "#34d399" : "#f87171" }}>
              {verificationResult?.verified ? <CheckCircle className="size-3" /> : <AlertCircle className="size-3" />}
              {verificationResult?.verified ? "Verification Passed" : "Verification Failed"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-3">
            {[["Checksum (SHA-256)", verificationResult?.checksum], ["Stored Checksum", verificationResult?.storedChecksum]].filter(([,v])=>v).map(([l,v]) => (
              <div key={String(l)} className="px-3 py-2 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <p className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>{l}</p>
                <p className="text-[10px] font-mono break-all mt-0.5" style={{ color: C.text }}>{v}</p>
              </div>
            ))}
            <p className="text-[11px] text-center" style={{ color: C.dim }}>{verificationResult?.message}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Calendar Dialog ── */}
      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="max-w-lg rounded-none p-0 gap-0"
          style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>
          <DialogHeader className="px-5 py-4 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
            <DialogTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: C.accent }}>
              <CalendarDays className="size-3" /> Backup Schedule Calendar
            </DialogTitle>
          </DialogHeader>
          <div className="p-5">
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                <div key={d} className="text-[9px] font-bold uppercase py-1" style={{ color: C.accent }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({length:35},(_,i) => {
                const date = new Date(); date.setDate(date.getDate() - 15 + i);
                const isToday = date.toDateString() === new Date().toDateString();
                const hasBackup = date.getDay() === settings.dayOfWeek && settings.enabled;
                return (
                  <div key={i} className="aspect-square flex flex-col items-center justify-center border text-[10px]"
                    style={{
                      borderColor: isToday ? C.accent : C.border,
                      backgroundColor: isToday ? "rgba(232,99,10,0.1)" : C.bg,
                      color: isToday ? C.accent : C.dim,
                    }}>
                    {date.getDate()}
                    {hasBackup && <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: "#34d399" }} />}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-[10px]" style={{ color: C.muted }}>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#34d399" }} /> Scheduled</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 border" style={{ borderColor: C.accent }} /> Today</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </ProtectedPageWrapper>
  );
}
