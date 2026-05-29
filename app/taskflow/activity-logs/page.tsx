"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, Activity as ActivityIcon,
  ChevronDown, AlertCircle, CheckCircle2, Clock, XCircle, Zap,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { supabase } from "@/utils/supabase";
import { Calendar } from "@/components/taskflow/customer-database/calendar";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Activity {
  id: string;
  referenceid: string;
  tsm: string;
  manager: string;
  status: string;
  date_created: string | null;
  ticket_reference_number: string;
  scheduled_date: string | null;
  agent: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  type_client: string;
  activity_reference_number: string;
  ticket_remarks: string;
  cancellation_remarks: string;
}

// ─── All known statuses (for select dropdown) ────────────────────────────────
const ALL_STATUSES = [
  "Open", "Pending", "New", "Received", "Endorsed", "For Follow-up", "Follow-up",
  "In Progress", "On-Progress", "Ongoing", "Processing",
  "Approval for TSM", "For Approval", "Waiting Approval", "For TSM Approval",
  "Quote-Done", "SO-Done", "Delivered / Closed Transaction",
  "Completed", "Done", "Resolved", "Closed",
  "Cancelled", "Canceled", "Rejected", "Declined",
] as const;

// ─── Kanban column config ─────────────────────────────────────────────────────
const COLUMNS = [
  {
    key: "open" as const,
    label: "Open / Pending",
    icon: Clock,
    color: "#fbbf24",
    border: "#fbbf2440",
    bg: "rgba(251,191,36,0.05)",
    statuses: ["open", "pending", "new", "received", "endorsed", "for follow-up", "follow-up"],
  },
  {
    key: "in_progress" as const,
    label: "In Progress",
    icon: Zap,
    color: "#60a5fa",
    border: "#60a5fa40",
    bg: "rgba(96,165,250,0.05)",
    statuses: ["in progress", "on progress", "on-progress", "ongoing", "processing"]
  },
  {
    key: "approval" as const,
    label: "Approval for TSM",
    icon: AlertCircle,
    color: "#a78bfa",
    border: "#a78bfa40",
    bg: "rgba(167,139,250,0.05)",
    statuses: ["approval for tsm", "for approval", "waiting approval", "for tsm approval"],
  },
  {
    key: "done" as const,
    label: "Completed / Done",
    icon: CheckCircle2,
    color: "#34d399",
    border: "#34d39940",
    bg: "rgba(52,211,153,0.05)",
    statuses: [
      "quote-done", "so-done", "delivered / closed transaction",
      "completed", "done", "resolved", "closed",
    ],
  },
  {
    key: "cancelled" as const,
    label: "Cancelled",
    icon: XCircle,
    color: "#f87171",
    border: "#f8717140",
    bg: "rgba(248,113,113,0.05)",
    statuses: ["cancelled", "canceled", "rejected", "declined"],
  },
] as const;

type ColumnKey = typeof COLUMNS[number]["key"];

// ─── Helper: normalize status for matching ────────────────────────────────────
const normalizeStatus = (s: string) =>
  (s ?? "").toLowerCase().replace(/_/g, "-").trim();

// ─── Helper: find column key for a status ────────────────────────────────────
const getColumnForStatus = (status: string): ColumnKey | null => {
  const normalized = normalizeStatus(status);
  const col = COLUMNS.find(c => c.statuses.some(s => s === normalized));
  return col?.key ?? null;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
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

const PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function statusBadge(status: string) {
  const s = normalizeStatus(status);

  if (["quote-done", "so-done", "delivered / closed transaction", "completed", "done", "resolved", "closed"].some(x => s.includes(x)))
    return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (["on-progress", "in-progress", "in progress", "on progress", "ongoing", "processing"].some(x => s.includes(x)))
    return "text-sky-400 border-sky-500/30 bg-sky-500/10";
  if (["approval for tsm", "for approval", "for tsm approval", "waiting approval"].some(x => s.includes(x)))
    return "text-violet-400 border-violet-500/30 bg-violet-500/10";
  if (["cancelled", "canceled", "rejected", "declined"].some(x => s.includes(x)))
    return "text-red-400 border-red-500/30 bg-red-500/10";
  if (["pending", "open", "new", "received", "endorsed", "follow-up"].some(x => s.includes(x)))
    return "text-amber-400 border-amber-500/30 bg-amber-500/10";

  return "text-slate-400 border-slate-500/30 bg-slate-500/10";
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────
function KanbanCard({ act, onClick }: { act: Activity; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="border cursor-pointer transition-colors"
      style={{ borderColor: C.border, backgroundColor: C.bg }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b"
        style={{ borderColor: C.muted + "30", backgroundColor: C.panel }}
      >
        <span className="text-[9px] font-bold font-mono" style={{ color: C.accent }}>
          {act.activity_reference_number || "—"}
        </span>
        <span className="text-[9px] font-mono" style={{ color: C.muted }}>
          {formatDate(act.date_created)}
        </span>
      </div>
      <div className="px-3 py-2.5 space-y-1.5">
        <p className="text-[11px] font-bold uppercase truncate" style={{ color: C.text }}>
          {act.company_name || "—"}
        </p>
        {act.contact_person && (
          <p className="text-[10px] truncate" style={{ color: C.dim }}>{act.contact_person}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 border ${statusBadge(act.status)}`}>
            {act.status || "—"}
          </span>
          {act.agent && (
            <span className="text-[9px] font-mono truncate max-w-[80px]" style={{ color: C.muted }}>
              {act.agent}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({
  col, cards, total, isLoading, onViewMore, onCardClick, hasMore,
}: {
  col: typeof COLUMNS[number];
  cards: Activity[];
  total: number;
  isLoading: boolean;
  onViewMore: () => void;
  onCardClick: (act: Activity) => void;
  hasMore: boolean;
}) {
  const Icon = col.icon;
  return (
    <div
      className="flex flex-col min-w-[260px] max-w-[300px] flex-1 border"
      style={{ borderColor: col.border, backgroundColor: col.bg }}
    >
      <div
        className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b"
        style={{ borderColor: col.border, backgroundColor: C.panel }}
      >
        <Icon className="size-3.5 shrink-0" style={{ color: col.color }} />
        <span className="text-[10px] font-bold uppercase tracking-wider flex-1" style={{ color: col.color }}>
          {col.label}
        </span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 border"
          style={{ borderColor: col.border, color: col.color, backgroundColor: col.color + "15" }}
        >
          {total}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 min-h-[200px]">
        {isLoading && cards.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="size-3.5 animate-spin" style={{ color: col.color }} />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Loading…</span>
          </div>
        ) : cards.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>No records</span>
          </div>
        ) : (
          cards.map(act => (
            <KanbanCard key={`${col.key}-${act.id}`} act={act} onClick={() => onCardClick(act)} />
          ))
        )}

        {hasMore && (
          <button
            onClick={onViewMore}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
            style={{ borderColor: col.border, color: col.color, backgroundColor: "transparent" }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = col.color + "10"; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            {isLoading ? <Loader2 className="size-3 animate-spin" /> : <ChevronDown className="size-3" />}
            {isLoading ? "Loading…" : `View More (${total - cards.length} remaining)`}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ActivityLogsPage() {
  const router = useRouter();

  const [colCards, setColCards] = useState<Record<ColumnKey, Activity[]>>({
    open: [], in_progress: [], approval: [], done: [], cancelled: [],
  });
  const [colTotals, setColTotals] = useState<Record<ColumnKey, number>>({
    open: 0, in_progress: 0, approval: 0, done: 0, cancelled: 0,
  });
  const [colPages, setColPages] = useState<Record<ColumnKey, number>>({
    open: 1, in_progress: 1, approval: 1, done: 1, cancelled: 1,
  });
  const [colLoading, setColLoading] = useState<Record<ColumnKey, boolean>>({
    open: false, in_progress: false, approval: false, done: false, cancelled: false,
  });

  const [search, setSearch]               = useState("");
  const [searchResults, setSearchResults] = useState<Activity[]>([]);
  const [searchTotal, setSearchTotal]     = useState(0);
  const [searchPage, setSearchPage]       = useState(1);
  const [isSearching, setIsSearching]     = useState(false);
  const [isSearchMode, setIsSearchMode]   = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  const [selectedAct, setSelectedAct]       = useState<Activity | null>(null);
  const [editForm, setEditForm]             = useState<Partial<Activity>>({});
  const [isSaving, setIsSaving]             = useState(false);
  const [ticketSource, setTicketSource]     = useState<any>(null);
  const [historyRecs, setHistoryRecs]       = useState<any[]>([]);
  const [loadingTicket, setLoadingTicket]   = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cleanup debounce on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, []);

  // ── Fetch a single column ────────────────────────────────────────────────
  const fetchColumn = useCallback(async (col: ColumnKey, page = 1, append = false) => {
    setColLoading(prev => ({ ...prev, [col]: true }));
    try {
      const params = new URLSearchParams({
        column: col, page: String(page), pageSize: String(PAGE_SIZE),
      });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo", dateTo);

      const res  = await fetch(`/api/taskflow/activity-logs?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setColCards(prev => ({
        ...prev,
        [col]: append ? [...prev[col], ...(json.data ?? [])] : (json.data ?? []),
      }));
      setColTotals(prev => ({ ...prev, [col]: json.total ?? 0 }));
      setColPages(prev => ({ ...prev, [col]: page }));
    } catch (err: any) {
      toast.error(`Failed to load ${col}: ${err.message}`);
    } finally {
      setColLoading(prev => ({ ...prev, [col]: false }));
    }
  }, [dateFrom, dateTo]);

  // ── Load all columns ─────────────────────────────────────────────────────
  const loadAll = useCallback(() => {
    setIsSearchMode(false);
    setSearch("");
    COLUMNS.forEach(col => fetchColumn(col.key, 1, false));
  }, [fetchColumn]);

  // FIX: depend on loadAll only (not dateFrom/dateTo directly) to avoid double-fire
  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Search ───────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string, page = 1) => {
    if (!q.trim()) { setIsSearchMode(false); setSearchResults([]); return; }
    setIsSearching(true);
    setIsSearchMode(true);
    try {
      const params = new URLSearchParams({
        search: q, page: String(page), pageSize: String(PAGE_SIZE),
      });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo", dateTo);

      const res  = await fetch(`/api/taskflow/activity-logs?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // FIX: split value vs updater — no mixed forms
      if (page === 1) {
        setSearchResults(json.data ?? []);
      } else {
        setSearchResults(prev => [...prev, ...(json.data ?? [])]);
      }
      setSearchTotal(json.total ?? 0);
      setSearchPage(page);
    } catch (err: any) {
      toast.error("Search failed: " + err.message);
    } finally {
      setIsSearching(false);
    }
  }, [dateFrom, dateTo]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!val.trim()) { setIsSearchMode(false); setSearchResults([]); return; }
    searchDebounce.current = setTimeout(() => doSearch(val, 1), 600);
  };

  const clearSearch = () => {
    setSearch(""); setIsSearchMode(false); setSearchResults([]);
  };

  // ── View More per column ─────────────────────────────────────────────────
  const handleViewMore = (col: ColumnKey) => {
    fetchColumn(col, colPages[col] + 1, true);
  };

  // ── Edit dialog ──────────────────────────────────────────────────────────
  const openEdit = async (act: Activity) => {
    setSelectedAct(act);
    setEditForm({ ...act });
    setTicketSource(null);
    setHistoryRecs([]);

    if (act.ticket_reference_number) {
      setLoadingTicket(true);
      try {
        const res  = await fetch(`/api/fetch-ticket-source?ticket_reference_number=${encodeURIComponent(act.ticket_reference_number)}`);
        const json = await res.json();
        setTicketSource(json.ticketSource?.[0] ?? null);
      } catch {
        /* silent — no ticket source is valid */
      } finally {
        setLoadingTicket(false);
      }
    }

    if (act.activity_reference_number) {
      setLoadingHistory(true);
      try {
        const res  = await fetch(`/api/fetch-history?activity_reference_number=${encodeURIComponent(act.activity_reference_number)}`);
        const json = await res.json();
        setHistoryRecs(Array.isArray(json.history) ? json.history : []);
      } catch {
        /* silent */
      } finally {
        setLoadingHistory(false);
      }
    }
  };

  const handleSave = async () => {
    if (!selectedAct) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("activity").update(editForm).eq("id", selectedAct.id);
      if (error) throw new Error(error.message);
      toast.success("Activity updated");
      setSelectedAct(null);

      // FIX: case-insensitive column matching after save
      const colKey = getColumnForStatus(editForm.status ?? "");
      if (colKey) fetchColumn(colKey, 1, false);
      else loadAll();
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const totalAll = Object.values(colTotals).reduce((a, b) => a + b, 0);

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset
          className="flex flex-col h-svh overflow-hidden bg-[#080d12]"
          style={{ fontFamily: C.font, color: C.text }}
        >
          {/* Dot grid background */}
          <div className="fixed inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
            backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
          }} />

          {/* ── Header ── */}
          <header
            className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b bg-[#080d12]"
            style={{ borderColor: C.border }}
          >
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <button
              onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest"
              style={{ color: C.dim, background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}
            >
              Home
            </button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>
                    Taskflow
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>
                    Activity Logs
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Supabase</span>
            </div>
          </header>

          {/* ── Title bar ── */}
          <div
            className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b"
            style={{ borderColor: C.border, backgroundColor: C.panel }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center border"
              style={{ borderColor: C.border, backgroundColor: "#0f1923" }}
            >
              <ActivityIcon className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Activity Logs</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Kanban · {totalAll.toLocaleString()} total records
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Calendar
                startDate={dateFrom} endDate={dateTo}
                setStartDateAction={setDateFrom} setEndDateAction={setDateTo}
              />
              <button
                onClick={loadAll}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}
              >
                <RefreshCw className="size-3" /> Refresh
              </button>
            </div>
          </div>

          {/* ── Stats bar ── */}
          <div className="relative z-10 shrink-0 grid grid-cols-5 border-b" style={{ borderColor: C.border }}>
            {COLUMNS.map((col, i) => (
              <div
                key={col.key}
                className="flex flex-col items-center justify-center py-2.5"
                style={{
                  borderColor: C.border,
                  backgroundColor: C.panel,
                  borderRight: i < COLUMNS.length - 1 ? `1px solid ${C.border}` : "none",
                }}
              >
                <span className="text-base font-bold leading-none" style={{ color: col.color }}>
                  {colTotals[col.key]}
                </span>
                <span className="text-[9px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>
                  {col.label.split(" / ")[0]}
                </span>
              </div>
            ))}
          </div>

          {/* ── Search bar ── */}
          <div
            className="relative z-10 shrink-0 flex items-center gap-2 px-4 py-2 border-b"
            style={{ borderColor: C.border, backgroundColor: C.bg }}
          >
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
              <input
                placeholder="Search by activity ref no. or company name…"
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                style={{
                  backgroundColor: C.panel, border: `1px solid ${C.border}`,
                  color: C.text, fontFamily: C.font,
                }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
              />
              {search && (
                <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="size-3" style={{ color: C.dim }} />
                </button>
              )}
            </div>
            {isSearchMode && (
              <span className="text-[10px]" style={{ color: C.muted }}>
                {isSearching
                  ? "Searching…"
                  : <><span style={{ color: C.text }}>{searchTotal}</span> results</>}
              </span>
            )}
            {isSearchMode && (
              <button
                onClick={clearSearch}
                className="text-[10px] font-bold uppercase tracking-wider transition-colors"
                style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}
              >
                ← Back to board
              </button>
            )}
          </div>

          {/* ── Board / Search results ── */}
          <div className="relative z-10 flex-1 overflow-hidden">
            {isSearchMode ? (
              <div className="h-full overflow-y-auto custom-scrollbar px-4 py-4">
                {isSearching && searchResults.length === 0 ? (
                  <div className="flex items-center justify-center h-full gap-3">
                    <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                    <span className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Searching…</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No results found</span>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto space-y-2">
                    <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: C.muted }}>
                      Showing {searchResults.length} of {searchTotal} results for &ldquo;{search}&rdquo;
                    </p>
                    {searchResults.map(act => (
                      <div
                        key={act.id}
                        onClick={() => openEdit(act)}
                        className="flex items-center gap-4 px-4 py-3 border cursor-pointer transition-colors"
                        style={{ borderColor: C.border, backgroundColor: C.panel }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                      >
                        <span className="text-[10px] font-bold font-mono shrink-0" style={{ color: C.accent }}>
                          {act.activity_reference_number || "—"}
                        </span>
                        <span className="flex-1 text-[11px] font-bold uppercase truncate" style={{ color: C.text }}>
                          {act.company_name || "—"}
                        </span>
                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 border shrink-0 ${statusBadge(act.status)}`}>
                          {act.status || "—"}
                        </span>
                        <span className="text-[10px] font-mono shrink-0" style={{ color: C.muted }}>
                          {formatDate(act.date_created)}
                        </span>
                      </div>
                    ))}
                    {searchResults.length < searchTotal && (
                      <button
                        onClick={() => doSearch(search, searchPage + 1)}
                        disabled={isSearching}
                        className="w-full flex items-center justify-center gap-2 py-3 border transition-colors disabled:opacity-40"
                        style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}
                      >
                        {isSearching ? <Loader2 className="size-3 animate-spin" /> : <ChevronDown className="size-3" />}
                        Load more ({searchTotal - searchResults.length} remaining)
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full overflow-x-auto custom-scrollbar overflow-y-hidden">
                <div className="flex gap-3 h-full px-4 py-4 min-w-max">
                  {COLUMNS.map(col => (
                    <KanbanColumn
                      key={col.key}
                      col={col}
                      cards={colCards[col.key]}
                      total={colTotals[col.key]}
                      isLoading={colLoading[col.key]}
                      hasMore={colCards[col.key].length < colTotals[col.key]}
                      onViewMore={() => handleViewMore(col.key)}
                      onCardClick={openEdit}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* ── Edit Dialog ── */}
      {selectedAct && (
        <Dialog open={!!selectedAct} onOpenChange={() => setSelectedAct(null)}>
          <DialogContent
            className="max-w-5xl w-full rounded-none p-0 gap-0 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}
          >
            <DialogHeader
              className="px-5 py-4 border-b sticky top-0 z-10"
              style={{ borderColor: C.border, backgroundColor: C.bg }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-7 w-7 items-center justify-center border"
                  style={{ borderColor: C.border, backgroundColor: "#0f1923" }}
                >
                  <ActivityIcon className="size-3.5" style={{ color: C.accent }} />
                </div>
                <div>
                  <DialogTitle className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                    Edit Activity
                  </DialogTitle>
                  <p className="text-[10px] mt-0.5 truncate max-w-[400px]" style={{ color: C.muted }}>
                    {selectedAct.company_name || selectedAct.activity_reference_number}
                  </p>
                </div>
              </div>
            </DialogHeader>

            {/* FIX: use border-r via inline style per column instead of divide-x */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
              {/* Col 1: Core fields */}
              <div className="p-4 space-y-3" style={{ borderRight: `1px solid ${C.border}` }}>
                <p className="text-[9px] font-bold uppercase tracking-widest pb-2 border-b" style={{ color: C.accent, borderColor: C.border }}>
                  Core Info
                </p>
                {(["company_name", "contact_person", "contact_number", "email_address", "address", "type_client", "agent", "ticket_reference_number", "activity_reference_number"] as const).map(f => (
                  <div key={f} className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>
                      {f.replace(/_/g, " ")}
                    </label>
                    <input
                      value={(editForm as any)[f] ?? ""}
                      onChange={e => setEditForm(p => ({ ...p, [f]: e.target.value }))}
                      className="w-full h-8 px-3 text-[11px] focus:outline-none"
                      style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                    />
                  </div>
                ))}

                {/* FIX: Status as select dropdown — prevents typos and wrong column routing */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>
                    Status
                  </label>
                  <select
                    value={editForm.status ?? ""}
                    onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full h-8 px-3 text-[11px] focus:outline-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  >
                    <option value="">— Select status —</option>
                    {ALL_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Col 2: Remarks */}
              <div className="p-4 space-y-3" style={{ borderRight: `1px solid ${C.border}` }}>
                <p className="text-[9px] font-bold uppercase tracking-widest pb-2 border-b" style={{ color: C.accent, borderColor: C.border }}>
                  Remarks
                </p>
                {(["ticket_remarks", "cancellation_remarks", "tsm", "manager", "referenceid"] as const).map(f => (
                  <div key={f} className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>
                      {f.replace(/_/g, " ")}
                    </label>
                    <input
                      value={(editForm as any)[f] ?? ""}
                      onChange={e => setEditForm(p => ({ ...p, [f]: e.target.value }))}
                      className="w-full h-8 px-3 text-[11px] focus:outline-none"
                      style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                    />
                  </div>
                ))}
              </div>

              {/* Col 3: Ticket source */}
              <div className="p-4 space-y-3" style={{ borderRight: `1px solid ${C.border}` }}>
                <p className="text-[9px] font-bold uppercase tracking-widest pb-2 border-b" style={{ color: "#fbbf24", borderColor: C.border }}>
                  Ticket Source
                </p>
                {loadingTicket ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" style={{ color: C.accent }} />
                    <span className="text-[10px]" style={{ color: C.muted }}>Loading…</span>
                  </div>
                ) : ticketSource ? (
                  ([
                    ["Reference ID", ticketSource.referenceid],
                    ["Company",      ticketSource.company_name],
                    ["Contact",      ticketSource.contact_person],
                    ["Phone",        ticketSource.contact_number],
                    ["Email",        ticketSource.email_address],
                    ["Inquiry",      ticketSource.inquiry],
                    ["Agent",        ticketSource.agent],
                    ["Status",       ticketSource.status],
                  ] as [string, string][]).map(([l, v]) => (
                    <div key={l} className="space-y-0.5">
                      <label className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>{l}</label>
                      <p className="text-[11px] font-mono break-all" style={{ color: C.text }}>{v || "—"}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px]" style={{ color: C.muted }}>No ticket source found.</p>
                )}
              </div>

              {/* Col 4: History */}
              <div className="p-4 space-y-3">
                <p
                  className="text-[9px] font-bold uppercase tracking-widest pb-2 border-b flex items-center justify-between"
                  style={{ color: "#a78bfa", borderColor: C.border }}
                >
                  History
                  <span style={{ color: C.muted }}>{historyRecs.length} records</span>
                </p>
                {loadingHistory ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" style={{ color: "#a78bfa" }} />
                    <span className="text-[10px]" style={{ color: C.muted }}>Loading…</span>
                  </div>
                ) : historyRecs.length === 0 ? (
                  <p className="text-[10px]" style={{ color: C.muted }}>No history records.</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {historyRecs.map((r: any, i: number) => (
                      <div
                        key={r.id ?? i}
                        className="p-2.5 border space-y-1"
                        style={{ borderColor: "#a78bfa30", backgroundColor: "rgba(167,139,250,0.04)" }}
                      >
                        <p className="text-[10px] font-bold truncate" style={{ color: C.text }}>
                          {r.company_name || "—"}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 border ${statusBadge(r.status)}`}>
                            {r.status || "—"}
                          </span>
                          <span className="text-[9px] font-mono" style={{ color: C.muted }}>
                            {formatDate(r.date_created)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-2 px-5 py-3 border-t sticky bottom-0"
              style={{ borderColor: C.border, backgroundColor: C.bg }}
            >
              <button
                onClick={() => setSelectedAct(null)}
                className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 h-8 px-5 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                style={{ backgroundColor: "rgba(232,99,10,0.15)", borderColor: C.accent, color: C.accent }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.25)"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.15)"; }}
              >
                {isSaving && <Loader2 className="size-3 animate-spin" />}
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </ProtectedPageWrapper>
  );
}