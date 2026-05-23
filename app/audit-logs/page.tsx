"use client";
import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, Timestamp, limit } from "firebase/firestore";
import {
  ArrowRight, Search, Activity, Clock, Plus, Pencil, Trash2, Hash,
  ChevronLeft, ChevronRight, X, RefreshCw, Eye, DatabaseBackup,
  LogIn, LogOut, FileDown, FileSpreadsheet, Calendar as CalendarIcon,
  Users, Layers, Download,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { exportAuditLogsToPDF } from "@/lib/utils/audit-pdf-export";
import { exportAuditLogsToCSV } from "@/lib/utils/audit-csv-export";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
type CustomerAuditAction = "transfer"|"create"|"update"|"delete"|"autoid";
type SystemAuditAction   = "assign"|"approve"|"reject"|"lock"|"unlock"|"reset_password"|"change_role"|"change_status"|"bulk_create"|"bulk_update"|"bulk_delete"|"export"|"import"|"view";
type ActivityLogAction   = "transfer"|"login"|"logout"|"other";
type AuditTrailAction    = "create"|"update"|"delete"|"login"|"logout"|"view"|"export"|"import"|"assign"|"transfer"|"approve"|"reject"|"other";
type AnyAction = CustomerAuditAction | ActivityLogAction | SystemAuditAction | AuditTrailAction;

interface AuditActor { uid?: string|null; name?: string|null; email?: string|null; role?: string|null; referenceId?: string|null; }
interface TransferDetail {
  tsa?: { fromId?: string|null; fromName?: string|null; toId?: string|null; toName?: string|null }|null;
  tsm?: { fromName?: string|null; toName?: string|null }|null;
  manager?: { fromName?: string|null; toName?: string|null }|null;
}
interface UnifiedLog {
  id: string;
  source: "customer_audit"|"activity_logs"|"system_audit"|"audit_trails";
  action: AnyAction;
  affectedCount?: number; customerId?: string|null; customerName?: string|null;
  resourceId?: string|null; resourceName?: string|null; resourceType?: string|null;
  module?: string|null; page?: string|null;
  transfer?: TransferDetail|null;
  changes?: Record<string,{before:unknown;after:unknown}>|null;
  actor?: AuditActor|null;
  timestamp?: Timestamp|null;
  context?: { page?: string; source?: string; bulk?: boolean }|null;
  ReferenceID?: string|null; TSM?: string|null; Manager?: string|null;
  previousTSM?: string|null; previousManager?: string|null;
  metadata?: Record<string,unknown>|null;
  details?: string|null; message?: string|null; ipAddress?: string|null;
  userAgent?: string|null; entityName?: string|null; entityId?: string|null;
  entityType?: string|null; department?: string|null;
}

const PAGE_SIZE = 20;

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

// ─── Action config ────────────────────────────────────────────────────────────
type ActionCfg = { label: string; icon: React.ReactNode; badge: string };
const ACTION_CONFIG: Record<string, ActionCfg> = {
  transfer: { label: "Transfer",  icon: <ArrowRight className="h-3 w-3" />, badge: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
  create:   { label: "Create",    icon: <Plus       className="h-3 w-3" />, badge: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  update:   { label: "Update",    icon: <Pencil     className="h-3 w-3" />, badge: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
  delete:   { label: "Delete",    icon: <Trash2     className="h-3 w-3" />, badge: "text-red-400 border-red-500/30 bg-red-500/10" },
  autoid:   { label: "Auto-ID",   icon: <Hash       className="h-3 w-3" />, badge: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  login:    { label: "Login",     icon: <LogIn      className="h-3 w-3" />, badge: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  logout:   { label: "Logout",    icon: <LogOut     className="h-3 w-3" />, badge: "text-slate-400 border-slate-500/30 bg-slate-500/10" },
  other:    { label: "Activity",  icon: <Activity   className="h-3 w-3" />, badge: "text-slate-400 border-slate-500/30 bg-slate-500/10" },
};
const getActionCfg = (a: string): ActionCfg => ACTION_CONFIG[a] ?? ACTION_CONFIG.other;

const SOURCE_BADGE: Record<string, string> = {
  customer_audit: "text-sky-400 border-sky-500/30",
  activity_logs:  "text-violet-400 border-violet-500/30",
  system_audit:   "text-amber-400 border-amber-500/30",
  audit_trails:   "text-pink-400 border-pink-500/30",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTimestamp(ts: Timestamp|null|undefined): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month:"short", day:"numeric", year:"numeric",
    hour:"2-digit", minute:"2-digit", hour12:true, timeZone:"Asia/Manila",
  }).format(ts.toDate());
}
function timeAgo(ts: Timestamp|null|undefined): string {
  if (!ts) return "—";
  const m = Math.floor((Date.now() - ts.toDate().getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}
function getInitials(name?: string|null): string {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase();
}
const AVATAR_COLORS = [
  "from-sky-500 to-sky-700","from-violet-500 to-violet-700","from-emerald-500 to-emerald-700",
  "from-amber-500 to-amber-700","from-rose-500 to-rose-700","from-cyan-500 to-cyan-700",
  "from-fuchsia-500 to-fuchsia-700","from-teal-500 to-teal-700",
];
function avatarColor(s?: string|null): string {
  if (!s) return "from-slate-500 to-slate-700";
  const h = s.split("").reduce((a,c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TransferPill({ log }: { log: UnifiedLog }) {
  if (log.source === "activity_logs") {
    return (
      <div className="space-y-0.5 text-[11px]" style={{ fontFamily: C.font }}>
        {log.ReferenceID && <div className="flex items-center gap-1.5"><span className="px-1 border text-[9px] font-bold uppercase" style={{ borderColor: C.border, color: C.dim }}>REF</span><span style={{ color: C.text }}>{log.ReferenceID}</span></div>}
        {log.TSM && <div className="flex items-center gap-1.5 flex-wrap"><span className="px-1 border text-[9px] font-bold uppercase" style={{ borderColor: C.border, color: C.dim }}>TSM</span>{log.previousTSM && <><span style={{ color: C.muted }}>{log.previousTSM}</span><ArrowRight className="size-3" style={{ color: C.muted }} /></>}<span style={{ color: C.text }}>{log.TSM}</span></div>}
        {log.Manager && <div className="flex items-center gap-1.5 flex-wrap"><span className="px-1 border text-[9px] font-bold uppercase" style={{ borderColor: C.border, color: C.dim }}>MGR</span>{log.previousManager && <><span style={{ color: C.muted }}>{log.previousManager}</span><ArrowRight className="size-3" style={{ color: C.muted }} /></>}<span style={{ color: C.text }}>{log.Manager}</span></div>}
      </div>
    );
  }
  const tsa = log.transfer?.tsa;
  if (tsa) {
    const extras = [log.transfer?.tsm?.toName && `TSM → ${log.transfer.tsm.toName}`, log.transfer?.manager?.toName && `Mgr → ${log.transfer.manager.toName}`].filter(Boolean);
    return (
      <div className="space-y-0.5 text-[11px]" style={{ fontFamily: C.font }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-1 border text-[9px] font-bold uppercase" style={{ borderColor: C.border, color: C.dim }}>TSA</span>
          <span style={{ color: C.muted }}>{tsa.fromName || tsa.fromId || "—"}</span>
          <ArrowRight className="size-3" style={{ color: C.muted }} />
          <span style={{ color: C.text }}>{tsa.toName || tsa.toId || "—"}</span>
        </div>
        {extras.length > 0 && <p style={{ color: C.muted, fontSize: "10px" }}>{extras.join(" · ")}</p>}
      </div>
    );
  }
  return <span style={{ color: C.muted }}>—</span>;
}

function SourceTag({ source }: { source: UnifiedLog["source"] }) {
  const cls = SOURCE_BADGE[source] ?? "text-slate-400 border-slate-500/30";
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 border ${cls}`}
      style={{ fontFamily: C.font, backgroundColor: "transparent" }}>
      {source.replace("_", " ")}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomerAuditLogsPage() {
  const router = useRouter();
  const currentUser = useCurrentUser();

  const [customerAuditLogs, setCustomerAuditLogs] = useState<UnifiedLog[]>([]);
  const [activityLogs,      setActivityLogs]      = useState<UnifiedLog[]>([]);
  const [systemAuditLogs,   setSystemAuditLogs]   = useState<UnifiedLog[]>([]);
  const [auditTrailLogs,    setAuditTrailLogs]    = useState<UnifiedLog[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const [search,        setSearch]        = useState("");
  const [filterAction,  setFilterAction]  = useState("all");
  const [filterSource,  setFilterSource]  = useState("all");
  const [filterDate,    setFilterDate]    = useState("all");
  const [filterActor,   setFilterActor]   = useState("all");
  const [filterModule,  setFilterModule]  = useState("all");
  const [dateRange,     setDateRange]     = useState<{from:Date|undefined;to:Date|undefined}>({ from:undefined, to:undefined });
  const [currentPage,   setCurrentPage]   = useState(1);
  const [selectedLog,   setSelectedLog]   = useState<UnifiedLog|null>(null);
  const [activeView,    setActiveView]    = useState<"logs"|"analytics">("logs");
  const [selectedLogs,  setSelectedLogs]  = useState<Set<string>>(new Set());
  const [calOpen,       setCalOpen]       = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAllLogs = useCallback(async () => {
    setError(false); setLoading(true);
    let primaryDocs: UnifiedLog[] = [];
    try {
      const snap = await getDocs(query(collection(db,"taskflow_customer_audit_logs"), orderBy("timestamp","desc"), limit(500)));
      primaryDocs = snap.docs.map(d => ({ id:d.id, source:"customer_audit" as const, ...(d.data() as any) }));
    } catch { setError(true); setLoading(false); return; }

    const [actRes, sysRes, trailRes] = await Promise.allSettled([
      getDocs(query(collection(db,"activity_logs"),  orderBy("date_created","desc"), limit(500))),
      getDocs(query(collection(db,"systemAudits"),   orderBy("timestamp","desc"),    limit(500))),
      getDocs(query(collection(db,"audit_trails"),   orderBy("timestamp","desc"),    limit(500))),
    ]);

    const actDocs: UnifiedLog[] = actRes.status === "fulfilled" ? actRes.value.docs.map(d => {
      const data = d.data();
      const rawAction = (data.action ?? data.status ?? "other") as string;
      const action: AnyAction = rawAction === "transfer" ? "transfer" : rawAction === "login" ? "login" : rawAction === "logout" ? "logout" : "other";
      return { id:d.id, source:"activity_logs" as const, action,
        actor:{ name:data.actorName??null, email:data.actorEmail??data.email??null, referenceId:data.actorReferenceID??data.ReferenceID??null, uid:data.userId??null, role:null },
        timestamp:data.date_created??data.timestamp??null,
        ReferenceID:data.ReferenceID??null, TSM:data.TSM??null, Manager:data.Manager??null,
        previousTSM:data.previousTSM??null, previousManager:data.previousManager??null,
        transfer:null, changes:null, context:null, customerName:data.ReferenceID??null,
      } satisfies UnifiedLog;
    }) : [];

    const sysDocs: UnifiedLog[] = sysRes.status === "fulfilled" ? sysRes.value.docs.map(d => {
      const data = d.data();
      return { id:d.id, source:"system_audit" as const, action:(data.action??"other") as AnyAction,
        resourceId:data.resourceId??null, resourceName:data.resourceName??null, resourceType:data.resourceType??null,
        module:data.module??null, page:data.page??null,
        actor:{ uid:data.actorUid??null, name:data.actorName??null, email:data.actorEmail??null, role:data.actorRole??null, referenceId:data.actorReferenceId??null },
        timestamp:data.timestamp??null, affectedCount:data.affectedCount??1,
        changes:data.changes??null, transfer:data.transfer??null, metadata:data.metadata??null,
        context:{ source:data.source??null, page:data.page??null },
      } satisfies UnifiedLog;
    }) : [];

    const trailDocs: UnifiedLog[] = trailRes.status === "fulfilled" ? trailRes.value.docs.map(d => {
      const data = d.data();
      return { id:d.id, source:"audit_trails" as const, action:(data.action??"other") as AnyAction,
        actor:{ name:data.fullName??`${data.firstName??""} ${data.lastName??""}`.trim()??null, email:data.email??null, referenceId:data.referenceId??null, role:data.role??null, uid:null },
        timestamp:data.timestamp??data.createdAt??null,
        changes:data.changes??null, details:data.details??null, message:data.message??null,
        ipAddress:data.ipAddress??null, userAgent:data.userAgent??null,
        entityName:data.entityname??data.entityName??null, entityId:data.entityId??null,
        entityType:data.entityType??null, department:data.department??null,
      } satisfies UnifiedLog;
    }) : [];

    setCustomerAuditLogs(primaryDocs);
    setActivityLogs(actDocs);
    setSystemAuditLogs(sysDocs);
    setAuditTrailLogs(trailDocs);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAllLogs(); }, [fetchAllLogs]);

  const allLogs = useMemo<UnifiedLog[]>(() => {
    return [...customerAuditLogs, ...activityLogs, ...systemAuditLogs, ...auditTrailLogs]
      .sort((a,b) => (b.timestamp?.toMillis?.()??0) - (a.timestamp?.toMillis?.()??0));
  }, [customerAuditLogs, activityLogs, systemAuditLogs, auditTrailLogs]);

  const uniqueActors = useMemo(() => {
    const m = new Map<string,{name:string;email:string}>();
    allLogs.forEach(l => {
      const k = l.actor?.email || l.actor?.name || "unknown";
      if (k !== "unknown" && !m.has(k)) m.set(k, { name:l.actor?.name||"Unknown", email:l.actor?.email||"" });
    });
    return Array.from(m.entries()).sort((a,b) => a[1].name.localeCompare(b[1].name));
  }, [allLogs]);

  const uniqueModules = useMemo(() => {
    const s = new Set<string>();
    allLogs.forEach(l => { if (l.module) s.add(l.module); });
    return Array.from(s).sort();
  }, [allLogs]);

  const stats = useMemo(() => {
    const s = { total:0, transfers:0, creates:0, updates:0, deletes:0, autoids:0, logins:0 };
    for (const l of allLogs) {
      s.total++;
      if (l.action==="transfer") s.transfers++;
      else if (l.action==="create") s.creates++;
      else if (l.action==="update") s.updates++;
      else if (l.action==="delete") s.deletes++;
      else if (l.action==="autoid") s.autoids++;
      else if (l.action==="login"||l.action==="logout") s.logins++;
    }
    return s;
  }, [allLogs]);

  const isWithinDateRange = useCallback((ts: Timestamp|null|undefined) => {
    if (!ts) return true;
    const date = ts.toDate();
    if (dateRange.from || dateRange.to) {
      const from = dateRange.from ? new Date(new Date(dateRange.from).setHours(0,0,0,0)) : null;
      const to   = dateRange.to   ? new Date(new Date(dateRange.to).setHours(23,59,59,999)) : null;
      if (from && date < from) return false;
      if (to   && date > to)   return false;
      return true;
    }
    if (filterDate === "all") return true;
    const now = new Date();
    if (filterDate === "today") return date.toDateString() === now.toDateString();
    if (filterDate === "week")  return date >= new Date(now.getTime() - 7*86400000);
    if (filterDate === "month") return date >= new Date(now.getTime() - 30*86400000);
    return true;
  }, [filterDate, dateRange]);

  const filtered = useMemo(() => allLogs.filter(log => {
    if (filterAction !== "all" && log.action !== filterAction) return false;
    if (filterSource !== "all" && log.source !== filterSource) return false;
    if (filterActor  !== "all" && (log.actor?.email||log.actor?.name||"unknown") !== filterActor) return false;
    if (filterModule !== "all" && log.module !== filterModule) return false;
    if (!isWithinDateRange(log.timestamp)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return [log.customerName, log.resourceName, log.customerId, log.resourceId,
        log.actor?.name, log.actor?.email, log.actor?.referenceId, log.module,
        log.ReferenceID, log.TSM, log.Manager,
        log.transfer?.tsa?.fromName, log.transfer?.tsa?.toName,
        log.transfer?.tsm?.toName, log.transfer?.manager?.toName,
      ].some(v => v?.toLowerCase().includes(q));
    }
    return true;
  }), [allLogs, filterAction, filterSource, filterActor, filterModule, filterDate, dateRange, search, isWithinDateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE);

  useEffect(() => setCurrentPage(1), [search, filterAction, filterSource, filterDate, filterActor, filterModule, dateRange]);

  const hasFilters = !!search || filterAction!=="all" || filterSource!=="all" || filterDate!=="all" || filterActor!=="all" || filterModule!=="all" || dateRange.from || dateRange.to;

  const clearFilters = () => {
    setSearch(""); setFilterAction("all"); setFilterSource("all"); setFilterDate("all");
    setFilterActor("all"); setFilterModule("all"); setDateRange({from:undefined,to:undefined});
    setSelectedLogs(new Set());
  };

  const toggleLogSelection = (id: string) => setSelectedLogs(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const selectAllVisible   = () => setSelectedLogs(prev => { const n=new Set(prev); paginated.forEach(l=>n.add(`${l.source}-${l.id}`)); return n; });
  const clearSelection     = () => setSelectedLogs(new Set());
  const exportSelected     = () => exportAuditLogsToCSV(filtered.filter(l => selectedLogs.has(`${l.source}-${l.id}`)));

  const startRow = filtered.length === 0 ? 0 : (currentPage-1)*PAGE_SIZE+1;
  const endRow   = Math.min(currentPage*PAGE_SIZE, filtered.length);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ProtectedPageWrapper>
      <TooltipProvider delayDuration={0}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="flex flex-col h-svh overflow-hidden"
            style={{ backgroundColor: C.bg, fontFamily: C.font, color: C.text }}>

            {/* Dot-grid */}
            <div className="fixed inset-0 pointer-events-none" style={{
              backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
              backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
            }} />

            {/* ── Header ── */}
            <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b"
              style={{ backgroundColor: C.bg, borderColor: C.border }}>
              <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
              <div className="w-px h-4" style={{ backgroundColor: C.border }} />
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}
                className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest rounded-none hover:bg-transparent"
                style={{ color: C.dim }}>Home</Button>
              <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Admin</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Audit Logs</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto flex items-center gap-1.5">
                {loading && <span className="text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>Loading…</span>}
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Live</span>
              </div>
            </header>

            {/* ── Title bar ── */}
            <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b"
              style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <div className="flex h-8 w-8 items-center justify-center border"
                style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
                <DatabaseBackup className="size-4" style={{ color: C.accent }} />
              </div>
              <div>
                <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Audit Logs</h1>
                <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                  {loading ? "Syncing…" : <><span style={{ color: C.text }}>{filtered.length}</span> events · {currentUser.name && <span style={{ color: C.dim }}>{currentUser.name}</span>}</>}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {/* View toggle */}
                <div className="flex border" style={{ borderColor: C.border }}>
                  {(["logs","analytics"] as const).map(v => (
                    <button key={v} onClick={() => setActiveView(v)}
                      className="px-3 h-7 text-[10px] font-bold uppercase tracking-wider transition-colors"
                      style={{
                        backgroundColor: activeView===v ? C.accent : "transparent",
                        color: activeView===v ? "#080d12" : C.dim,
                      }}>
                      {v}
                    </button>
                  ))}
                </div>
                <button onClick={() => exportAuditLogsToCSV(filtered)} disabled={!filtered.length}
                  className="flex items-center gap-1 h-7 px-2 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-30"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.dim; }}>
                  <FileSpreadsheet className="size-3" /> CSV
                </button>
                <button onClick={() => exportAuditLogsToPDF(filtered)} disabled={!filtered.length}
                  className="flex items-center gap-1 h-7 px-2 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-30"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.dim; }}>
                  <FileDown className="size-3" /> PDF
                </button>
                <button onClick={fetchAllLogs}
                  className="flex items-center gap-1 h-7 px-2 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.dim; }}>
                  <RefreshCw className="size-3" />
                </button>
              </div>
            </div>

            {/* ── Stats bar ── */}
            <div className="relative z-10 shrink-0 grid grid-cols-7 border-b" style={{ borderColor: C.border }}>
              {[
                { label:"Total",     value:stats.total,     color:C.text },
                { label:"Transfer",  value:stats.transfers, color:"#a78bfa" },
                { label:"Create",    value:stats.creates,   color:"#34d399" },
                { label:"Update",    value:stats.updates,   color:"#60a5fa" },
                { label:"Delete",    value:stats.deletes,   color:"#f87171" },
                { label:"Auto-ID",   value:stats.autoids,   color:"#fbbf24" },
                { label:"Sessions",  value:stats.logins,    color:"#6ee7b7" },
              ].map(({ label, value, color }, i) => (
                <div key={i} className="flex flex-col items-center justify-center py-2.5 border-r last:border-r-0"
                  style={{ borderColor: C.border, backgroundColor: C.panel }}>
                  <span className="text-base font-bold leading-none" style={{ color }}>{loading ? "—" : value}</span>
                  <span className="text-[9px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>{label}</span>
                </div>
              ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="relative z-10 shrink-0 flex items-center gap-2 px-4 py-2 border-b flex-wrap"
              style={{ borderColor: C.border, backgroundColor: C.bg }}>

              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
                <input placeholder="Search name, email, ref ID…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                  style={{ backgroundColor: C.panel, border:`1px solid ${C.border}`, color:C.text, fontFamily:C.font }}
                  onFocus={e => (e.currentTarget.style.borderColor=C.accent)}
                  onBlur={e  => (e.currentTarget.style.borderColor=C.border)}
                />
                {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-3" style={{ color:C.dim }} /></button>}
              </div>

              {/* Source */}
              <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
                className="h-8 text-[11px] px-2 focus:outline-none"
                style={{ backgroundColor:C.panel, border:`1px solid ${C.border}`, color:C.text, fontFamily:C.font }}>
                <option value="all">All Sources</option>
                <option value="customer_audit">customer_audit</option>
                <option value="activity_logs">activity_logs</option>
                <option value="system_audit">system_audit</option>
                <option value="audit_trails">audit_trails</option>
              </select>

              {/* Action */}
              <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                className="h-8 text-[11px] px-2 focus:outline-none"
                style={{ backgroundColor:C.panel, border:`1px solid ${C.border}`, color:C.text, fontFamily:C.font }}>
                <option value="all">All Actions</option>
                {["transfer","create","update","delete","autoid","login","logout"].map(a => (
                  <option key={a} value={a}>{ACTION_CONFIG[a]?.label ?? a}</option>
                ))}
              </select>

              {/* Date preset */}
              <select value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="h-8 text-[11px] px-2 focus:outline-none"
                style={{ backgroundColor:C.panel, border:`1px solid ${C.border}`, color:C.text, fontFamily:C.font }}>
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>

              {/* Date range calendar */}
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 h-8 px-3 text-[11px] border transition-colors"
                    style={{
                      backgroundColor: C.panel,
                      borderColor: calOpen ? C.accent : (dateRange.from ? C.accent : C.border),
                      color: dateRange.from ? C.text : C.dim,
                    }}>
                    <CalendarIcon className="size-3" style={{ color: dateRange.from ? C.accent : C.dim }} />
                    {dateRange.from
                      ? dateRange.to
                        ? `${format(dateRange.from,"MMM d")} – ${format(dateRange.to,"MMM d, yy")}`
                        : format(dateRange.from,"MMM d, yyyy")
                      : "Date range"}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0 border"
                  style={{ backgroundColor: C.panel, borderColor: C.border, fontFamily: C.font }}>
                  <style>{`
                    .al-cal .rdp-month_caption,.al-cal .rdp-caption_label{color:${C.accent};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
                    .al-cal .rdp-weekday{color:${C.dim};font-size:10px}
                    .al-cal .rdp-day_button{color:${C.text};font-size:11px;border-radius:0}
                    .al-cal .rdp-day_button:hover{background:rgba(232,99,10,.15)!important;color:${C.accent}!important}
                    .al-cal [data-selected-single=true] .rdp-day_button,.al-cal [data-range-start=true] .rdp-day_button,.al-cal [data-range-end=true] .rdp-day_button{background:${C.accent}!important;color:#080d12!important;font-weight:700}
                    .al-cal [data-range-middle=true] .rdp-day_button{background:rgba(232,99,10,.18)!important;color:${C.accent}!important;border-radius:0!important}
                    .al-cal .rdp-today .rdp-day_button{border:1px solid ${C.accent};color:${C.accent}}
                    .al-cal button[class*="button_previous"],.al-cal button[class*="button_next"]{color:${C.dim};background:transparent;border:1px solid ${C.border};border-radius:0}
                    .al-cal button[class*="button_previous"]:hover,.al-cal button[class*="button_next"]:hover{border-color:${C.accent};color:${C.accent}}
                  `}</style>
                  <Calendar mode="range" selected={{ from:dateRange.from, to:dateRange.to }}
                    onSelect={r => { setDateRange({from:r?.from,to:r?.to}); if(r?.from&&r?.to) setCalOpen(false); }}
                    numberOfMonths={2} initialFocus className="al-cal p-3" />
                </PopoverContent>
              </Popover>
              {dateRange.from && <button onClick={() => setDateRange({from:undefined,to:undefined})}><X className="size-3" style={{ color:C.dim }} /></button>}

              {/* Actor filter */}
              {uniqueActors.length > 0 && (
                <select value={filterActor} onChange={e => setFilterActor(e.target.value)}
                  className="h-8 text-[11px] px-2 focus:outline-none max-w-[160px]"
                  style={{ backgroundColor:C.panel, border:`1px solid ${C.border}`, color:C.text, fontFamily:C.font }}>
                  <option value="all">All Actors</option>
                  {uniqueActors.map(([k,a]) => <option key={k} value={k}>{a.name}</option>)}
                </select>
              )}

              {/* Module filter */}
              {uniqueModules.length > 0 && (
                <select value={filterModule} onChange={e => setFilterModule(e.target.value)}
                  className="h-8 text-[11px] px-2 focus:outline-none"
                  style={{ backgroundColor:C.panel, border:`1px solid ${C.border}`, color:C.text, fontFamily:C.font }}>
                  <option value="all">All Modules</option>
                  {uniqueModules.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}

              {hasFilters && (
                <button onClick={clearFilters}
                  className="flex items-center gap-1 h-8 px-2 text-[10px] font-bold uppercase tracking-wider transition-colors"
                  style={{ color:C.dim }}
                  onMouseEnter={e => (e.currentTarget.style.color="#f87171")}
                  onMouseLeave={e => (e.currentTarget.style.color=C.dim)}>
                  <X className="size-3" /> Clear
                </button>
              )}
            </div>

            {/* ── Bulk bar ── */}
            {activeView === "logs" && selectedLogs.size > 0 && (
              <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-1.5 border-b"
                style={{ borderColor: C.border, backgroundColor: "rgba(232,99,10,0.06)" }}>
                <div className="flex items-center gap-3 text-[11px]">
                  <span style={{ color: C.accent }}>{selectedLogs.size} selected</span>
                  <button onClick={selectAllVisible} style={{ color: C.dim }}
                    onMouseEnter={e=>(e.currentTarget.style.color=C.accent)} onMouseLeave={e=>(e.currentTarget.style.color=C.dim)}>
                    Select visible
                  </button>
                  <button onClick={clearSelection} style={{ color: C.dim }}
                    onMouseEnter={e=>(e.currentTarget.style.color="#f87171")} onMouseLeave={e=>(e.currentTarget.style.color=C.dim)}>
                    Clear
                  </button>
                </div>
                <button onClick={exportSelected}
                  className="flex items-center gap-1 h-6 px-2 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                  style={{ borderColor:C.border, color:C.dim, backgroundColor:"transparent" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
                  <FileSpreadsheet className="size-3" /> Export selected
                </button>
              </div>
            )}

            {/* ── Table / Analytics ── */}
            <div className="relative z-10 flex-1 overflow-auto">
              {activeView === "logs" ? (
                <>
                  {error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <p className="text-sm" style={{ color:"#f87171" }}>Failed to load audit logs</p>
                      <button onClick={fetchAllLogs}
                        className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border"
                        style={{ borderColor:C.border, color:C.dim, backgroundColor:"transparent" }}>
                        <RefreshCw className="size-3" /> Retry
                      </button>
                    </div>
                  ) : (
                    <table className="w-full border-collapse" style={{ fontSize:"11px", fontFamily:C.font }}>
                      <thead className="sticky top-0 z-10">
                        <tr style={{ backgroundColor:C.panel, borderBottom:`1px solid ${C.border}` }}>
                          <th className="px-3 py-2.5 w-10" style={{ borderRight:`1px solid ${C.border}` }}>
                            <input type="checkbox"
                              checked={paginated.length>0 && paginated.every(l=>selectedLogs.has(`${l.source}-${l.id}`))}
                              onChange={() => paginated.every(l=>selectedLogs.has(`${l.source}-${l.id}`))
                                ? setSelectedLogs(prev=>{const n=new Set(prev);paginated.forEach(l=>n.delete(`${l.source}-${l.id}`));return n;})
                                : selectAllVisible()}
                              className="h-3.5 w-3.5"
                              style={{ accentColor: C.accent }}
                            />
                          </th>
                          {["Actor","Action","Subject / Detail","Time",""].map((h,i) => (
                            <th key={i} className="text-left px-3 py-2.5 whitespace-nowrap font-bold uppercase tracking-widest text-[9px]"
                              style={{ color:C.accent, borderRight:i<4?`1px solid ${C.border}`:"none" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          Array.from({length:8}).map((_,i) => (
                            <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                              {Array.from({length:6}).map((_,j) => (
                                <td key={j} className="px-3 py-3">
                                  <div className="h-3 rounded animate-pulse" style={{ backgroundColor:C.muted, width:`${60+Math.random()*30}%` }} />
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : paginated.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-16" style={{ color:C.muted }}>
                              No logs match your filters.
                              {hasFilters && <button onClick={clearFilters} className="ml-2 underline" style={{ color:C.accent }}>Clear filters</button>}
                            </td>
                          </tr>
                        ) : paginated.map((log, i) => {
                          const cfg = getActionCfg(log.action);
                          const isBulk = log.context?.bulk || (log.affectedCount??0) > 1;
                          const actorDisplay = log.actor?.name || log.actor?.email || log.actor?.referenceId || "Unknown";
                          const logKey = `${log.source}-${log.id}`;
                          const isSelected = selectedLogs.has(logKey);
                          return (
                            <tr key={logKey}
                              style={{
                                backgroundColor: isSelected ? "rgba(232,99,10,0.06)" : i%2===0 ? C.bg : C.panel,
                                borderBottom:`1px solid ${C.border}`,
                              }}
                              onMouseEnter={e => { if(!isSelected) e.currentTarget.style.backgroundColor="rgba(232,99,10,0.03)"; }}
                              onMouseLeave={e => { if(!isSelected) e.currentTarget.style.backgroundColor=i%2===0?C.bg:C.panel; }}>

                              {/* Checkbox */}
                              <td className="px-3 py-2.5" style={{ borderRight:`1px solid ${C.border}` }}>
                                <input type="checkbox" checked={isSelected} onChange={() => toggleLogSelection(logKey)}
                                  className="h-3.5 w-3.5" style={{ accentColor:C.accent }} />
                              </td>

                              {/* Actor */}
                              <td className="px-3 py-2.5 whitespace-nowrap" style={{ borderRight:`1px solid ${C.border}` }}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${avatarColor(log.actor?.name||log.actor?.email)}`}>
                                    {getInitials(log.actor?.name||log.actor?.email)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold truncate max-w-[140px]" style={{ color:C.text }}>{actorDisplay}</p>
                                    {log.actor?.email && log.actor.email !== actorDisplay && (
                                      <p className="text-[10px] truncate max-w-[140px]" style={{ color:C.dim }}>{log.actor.email}</p>
                                    )}
                                    <SourceTag source={log.source} />
                                  </div>
                                </div>
                              </td>

                              {/* Action */}
                              <td className="px-3 py-2.5 whitespace-nowrap" style={{ borderRight:`1px solid ${C.border}` }}>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${cfg.badge}`}>
                                  {cfg.icon}{cfg.label}
                                </span>
                                {isBulk && <p className="text-[9px] mt-0.5" style={{ color:C.muted }}>Bulk · {log.affectedCount??""}</p>}
                              </td>

                              {/* Subject */}
                              <td className="px-3 py-2.5 max-w-[260px]" style={{ borderRight:`1px solid ${C.border}` }}>
                                {log.action === "transfer" ? (
                                  <TransferPill log={log} />
                                ) : log.action === "update" && log.changes ? (
                                  <div>
                                    {(log.customerName||log.resourceName) && <p className="font-semibold truncate text-[11px]" style={{ color:C.text }}>{log.customerName||log.resourceName}</p>}
                                    <p style={{ color:C.muted, fontSize:"10px" }}>{Object.keys(log.changes).join(", ")} changed</p>
                                  </div>
                                ) : log.source === "audit_trails" && (log.message||log.details) ? (
                                  <div>
                                    {log.message && <p className="truncate max-w-[240px] text-[11px]" style={{ color:C.text }}>{log.message}</p>}
                                    {log.details && <p className="truncate max-w-[240px] text-[10px]" style={{ color:C.muted }}>{log.details}</p>}
                                  </div>
                                ) : log.customerName || log.resourceName ? (
                                  <p className="font-semibold truncate max-w-[240px]" style={{ color:C.text }}>{log.customerName||log.resourceName}</p>
                                ) : (
                                  <span style={{ color:C.muted }}>—</span>
                                )}
                              </td>

                              {/* Time */}
                              <td className="px-3 py-2.5 whitespace-nowrap" style={{ borderRight:`1px solid ${C.border}` }}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-default">
                                      <p className="font-semibold" style={{ color:C.text }}>{timeAgo(log.timestamp)}</p>
                                      <p className="text-[10px]" style={{ color:C.muted }}>{formatTimestamp(log.timestamp)}</p>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent><p className="text-xs">{formatTimestamp(log.timestamp)}</p></TooltipContent>
                                </Tooltip>
                              </td>

                              {/* View */}
                              <td className="px-3 py-2.5 text-center">
                                <button onClick={() => setSelectedLog(log)}
                                  className="h-6 w-6 flex items-center justify-center border transition-all mx-auto"
                                  style={{ borderColor:C.border, color:C.dim }}
                                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
                                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
                                  <Eye className="size-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              ) : (
                /* ── Analytics placeholder ── */
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Activity className="size-10 opacity-20" style={{ color:C.accent }} />
                  <p className="text-[11px] uppercase tracking-widest" style={{ color:C.muted }}>Analytics view</p>
                  <p className="text-[10px]" style={{ color:C.muted }}>{filtered.length} events in current filter</p>
                </div>
              )}
            </div>

            {/* ── Footer / Pagination ── */}
            {activeView === "logs" && !error && (
              <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-2 border-t"
                style={{ borderColor:C.border, backgroundColor:C.panel }}>
                <span className="text-[10px]" style={{ color:C.muted }}>
                  Showing <span style={{ color:C.text }}>{startRow}–{endRow}</span> of <span style={{ color:C.text }}>{filtered.length}</span> events
                  {selectedLogs.size > 0 && <span style={{ color:C.accent }}> · {selectedLogs.size} selected</span>}
                </span>
                <div className="flex items-center gap-1" style={{ fontSize:"11px" }}>
                  <button onClick={() => setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1}
                    className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                    style={{ backgroundColor:"transparent", borderColor:C.border, color:C.dim }}
                    onMouseEnter={e=>{if(currentPage>1){e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
                    <ChevronLeft className="size-3" /> Prev
                  </button>
                  {Array.from({length:Math.min(totalPages,7)},(_,i)=>{
                    let p: number;
                    if(totalPages<=7) p=i+1;
                    else if(currentPage<=4) p=i+1;
                    else if(currentPage>=totalPages-3) p=totalPages-6+i;
                    else p=currentPage-3+i;
                    return (
                      <button key={p} onClick={()=>setCurrentPage(p)}
                        className="h-7 w-7 border text-[10px] font-bold transition-colors"
                        style={{ backgroundColor:p===currentPage?C.accent:"transparent", borderColor:p===currentPage?C.accent:C.border, color:p===currentPage?"#080d12":C.dim }}>
                        {p}
                      </button>
                    );
                  })}
                  <button onClick={() => setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages}
                    className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                    style={{ backgroundColor:"transparent", borderColor:C.border, color:C.dim }}
                    onMouseEnter={e=>{if(currentPage<totalPages){e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim;}}>
                    Next <ChevronRight className="size-3" />
                  </button>
                </div>
              </div>
            )}

          </SidebarInset>
        </SidebarProvider>

        {/* ── Detail dialog ── */}
        {selectedLog && (
          <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
            <DialogContent className="max-w-lg rounded-none p-0 gap-0"
              style={{ backgroundColor:C.panel, border:`1px solid ${C.border}`, fontFamily:C.font }}>
              <DialogHeader className="px-5 py-4 border-b" style={{ borderColor:C.border, backgroundColor:C.bg }}>
                <DialogTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color:C.accent }}>
                  <DatabaseBackup className="size-3" /> Log Detail
                  <SourceTag source={selectedLog.source} />
                </DialogTitle>
              </DialogHeader>
              <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
                {/* Action badge */}
                {(() => { const cfg=getActionCfg(selectedLog.action); return (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${cfg.badge}`}>
                    {cfg.icon}{cfg.label}
                    {selectedLog.context?.bulk && <span className="ml-1 opacity-70">· Bulk ({selectedLog.affectedCount??""} records)</span>}
                  </span>
                ); })()}

                {/* Actor */}
                <div className="p-3 border space-y-2" style={{ borderColor:C.border, backgroundColor:C.bg }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color:C.muted }}>Actor</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold ${avatarColor(selectedLog.actor?.name||selectedLog.actor?.email)}`}>
                      {getInitials(selectedLog.actor?.name||selectedLog.actor?.email)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color:C.text }}>{selectedLog.actor?.name||"Unknown"}</p>
                      <p className="text-[11px]" style={{ color:C.dim }}>{selectedLog.actor?.email||"No email"}</p>
                      {selectedLog.actor?.referenceId && <p className="text-[10px] font-mono" style={{ color:C.muted }}>{selectedLog.actor.referenceId}</p>}
                    </div>
                  </div>
                </div>

                {/* Transfer detail */}
                {selectedLog.action === "transfer" && (
                  <div className="p-3 border space-y-2" style={{ borderColor:"rgba(167,139,250,0.3)", backgroundColor:"rgba(167,139,250,0.05)" }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color:"#a78bfa" }}>Transfer Detail</p>
                    <TransferPill log={selectedLog} />
                  </div>
                )}

                {/* Changes */}
                {selectedLog.action === "update" && selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                  <div className="p-3 border space-y-2" style={{ borderColor:"rgba(96,165,250,0.3)", backgroundColor:"rgba(96,165,250,0.05)" }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color:"#60a5fa" }}>Changes</p>
                    <div className="space-y-1.5">
                      {Object.entries(selectedLog.changes).map(([field,{before,after}]) => (
                        <div key={field} className="grid grid-cols-[120px_1fr_1fr] gap-2 text-[11px]">
                          <span className="font-bold capitalize" style={{ color:C.dim }}>{field.replace(/_/g," ")}</span>
                          <span className="line-through truncate" style={{ color:C.muted }}>{String(before??"—")}</span>
                          <span className="font-semibold truncate" style={{ color:C.text }}>{String(after??"—")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source-specific details */}
                {selectedLog.source === "system_audit" && (
                  <div className="p-3 border space-y-1.5" style={{ borderColor:"rgba(251,191,36,0.3)", backgroundColor:"rgba(251,191,36,0.05)" }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color:"#fbbf24" }}>System Audit</p>
                    {[["Module",selectedLog.module],["Page",selectedLog.page],["Resource Type",selectedLog.resourceType],["Resource ID",selectedLog.resourceId],["Affected",selectedLog.affectedCount]].filter(([,v])=>v).map(([k,v]) => (
                      <div key={String(k)} className="flex justify-between text-[11px]">
                        <span style={{ color:C.dim }}>{k}:</span>
                        <span className="font-mono" style={{ color:C.text }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedLog.source === "audit_trails" && (
                  <div className="p-3 border space-y-1.5" style={{ borderColor:"rgba(244,114,182,0.3)", backgroundColor:"rgba(244,114,182,0.05)" }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color:"#f472b6" }}>Audit Trail</p>
                    {[["Department",selectedLog.department],["Entity",selectedLog.entityName],["Entity ID",selectedLog.entityId],["Entity Type",selectedLog.entityType]].filter(([,v])=>v).map(([k,v]) => (
                      <div key={String(k)} className="flex justify-between text-[11px]">
                        <span style={{ color:C.dim }}>{k}:</span>
                        <span style={{ color:C.text }}>{String(v)}</span>
                      </div>
                    ))}
                    {selectedLog.message && <p className="text-[11px] pt-1 border-t" style={{ borderColor:"rgba(244,114,182,0.2)", color:C.text }}>{selectedLog.message}</p>}
                    {selectedLog.details && <p className="text-[10px]" style={{ color:C.dim }}>{selectedLog.details}</p>}
                    {selectedLog.ipAddress && <p className="text-[10px] font-mono" style={{ color:C.muted }}>IP: {selectedLog.ipAddress}</p>}
                  </div>
                )}

                {/* Timestamp */}
                <div className="flex items-center gap-2 text-[11px]" style={{ color:C.muted }}>
                  <Clock className="size-3" />
                  <span>Logged at</span>
                  <span className="font-semibold" style={{ color:C.text }}>{formatTimestamp(selectedLog.timestamp)}</span>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </TooltipProvider>
    </ProtectedPageWrapper>
  );
}
