"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, ClipboardList,
  ChevronDown, AlertCircle, CheckCircle2, XCircle,
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
  activity_reference_number: string;
  referenceid: string;
  tsm: string;
  manager: string;
  type_client: string;
  project_name: string;
  product_category: string;
  project_type: string;
  source: string;
  target_quota: string;
  type_activity: string;
  callback: string;
  call_status: string;
  call_type: string;
  quotation_number: string;
  quotation_amount: string;
  so_number: string;
  so_amount: string;
  actual_sales: string;
  delivery_date: string;
  dr_number: string;
  ticket_reference_number: string;
  remarks: string;
  status: string;
  start_date: string;
  end_date: string;
  date_followup: string;
  date_site_visit: string;
  date_created: string;
  date_updated: string;
  account_reference_number: string;
  payment_terms: string;
  scheduled_status: string;
  product_quantity: string;
  product_amount: string;
  product_description: string;
  product_photo: string;
  product_sku: string;
  product_title: string;
  quotation_type: string;
  si_date: string;
  agent: string;
  tsm_approved_status: string;
  tsm_approved_remarks: string;
  tsm_approved_date: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  vat_type: string;
}

// ─── Kanban column config ─────────────────────────────────────────────────────
const COLUMNS = [
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
    statuses: ["completed", "delivered / closed transaction", "quote-done", "so-done", "resolved", "closed", "done"],
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
const normalizeStatus = (s: string) => (s ?? "").toLowerCase().replace(/_/g, "-").trim();

const getColumnForStatus = (status: string): ColumnKey | null => {
  const normalized = normalizeStatus(status);
  const col = COLUMNS.find(c => c.statuses.some(s => s === normalized));
  return col?.key ?? null;
};

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
function KanbanCard({ act, onClick, userNames }: {
  act: Activity; onClick: () => void; userNames: Record<string, string>;
}) {
  const resolvedName = act.referenceid ? userNames[act.referenceid] : null;
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
        {/* Reference ID + resolved user name */}
        {act.referenceid && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[9px] font-mono font-bold" style={{ color: "#60a5fa" }}>
              {act.referenceid}
            </span>
            {resolvedName && (
              <span className="text-[9px]" style={{ color: C.dim }}>
                — {resolvedName}
              </span>
            )}
          </div>
        )}
        {act.ticket_reference_number && (
          <p className="text-[9px] font-mono truncate" style={{ color: C.muted }}>
            {act.ticket_reference_number}
          </p>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 border ${statusBadge(act.status)}`}>
            {act.status || "—"}
          </span>
          {act.type_activity && (
            <span className="text-[8px] uppercase tracking-widest truncate max-w-[90px]" style={{ color: C.dim }}>
              {act.type_activity}
            </span>
          )}
        </div>
        {act.agent && (
          <p className="text-[9px] font-mono truncate" style={{ color: C.muted }}>{act.agent}</p>
        )}
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({
  col, cards, total, isLoading, onViewMore, onCardClick, hasMore, userNames,
}: {
  col: typeof COLUMNS[number];
  cards: Activity[];
  total: number;
  isLoading: boolean;
  onViewMore: () => void;
  onCardClick: (act: Activity) => void;
  hasMore: boolean;
  userNames: Record<string, string>;
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
            <KanbanCard key={`${col.key}-${act.id}`} act={act} onClick={() => onCardClick(act)} userNames={userNames} />
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
export default function ProgressLogsPage() {
  const router = useRouter();

  const [colCards, setColCards] = useState<Record<ColumnKey, Activity[]>>({
    approval: [], done: [], cancelled: [],
  });
  const [colTotals, setColTotals] = useState<Record<ColumnKey, number>>({
    approval: 0, done: 0, cancelled: 0,
  });
  const [colPages, setColPages] = useState<Record<ColumnKey, number>>({
    approval: 1, done: 1, cancelled: 1,
  });
  const [colLoading, setColLoading] = useState<Record<ColumnKey, boolean>>({
    approval: false, done: false, cancelled: false,
  });

  const [search, setSearch]               = useState("");
  const [searchResults, setSearchResults] = useState<Activity[]>([]);
  const [searchTotal, setSearchTotal]     = useState(0);
  const [searchPage, setSearchPage]       = useState(1);
  const [isSearching, setIsSearching]     = useState(false);
  const [isSearchMode, setIsSearchMode]   = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  // User name cache: { [ReferenceID]: "Firstname Lastname" }
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const [selectedAct, setSelectedAct] = useState<Activity | null>(null);
  const [editForm, setEditForm]       = useState<Partial<Activity>>({});
  const [isSaving, setIsSaving]       = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, []);

  // ── Resolve user names by ReferenceID (batch, cached) ───────────────────
  const resolveUserNames = useCallback(async (activities: Activity[]) => {
    const ids = activities
      .map(a => a.referenceid)
      .filter(Boolean)
      .filter(id => !userNames[id]); // only fetch missing ones

    if (ids.length === 0) return;
    const unique = [...new Set(ids)];
    try {
      const res  = await fetch(`/api/taskflow/user-lookup?ids=${unique.join(",")}`);
      const json = await res.json();
      if (json.users) {
        setUserNames(prev => ({ ...prev, ...json.users }));
      }
    } catch { /* silent */ }
  }, [userNames]);

  // ── Fetch a single column ──────────────────────────────────────────────────
  const fetchColumn = useCallback(async (col: ColumnKey, page = 1, append = false) => {
    setColLoading(prev => ({ ...prev, [col]: true }));
    try {
      const params = new URLSearchParams({
        column: col, page: String(page), pageSize: String(PAGE_SIZE),
      });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo", dateTo);

      const res  = await fetch(`/api/taskflow/progress-logs?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setColCards(prev => ({
        ...prev,
        [col]: append ? [...prev[col], ...(json.data ?? [])] : (json.data ?? []),
      }));
      setColTotals(prev => ({ ...prev, [col]: json.total ?? 0 }));
      setColPages(prev => ({ ...prev, [col]: page }));
      // Resolve names for the newly loaded cards
      resolveUserNames(json.data ?? []);
    } catch (err: any) {
      toast.error(`Failed to load ${col}: ${err.message}`);
    } finally {
      setColLoading(prev => ({ ...prev, [col]: false }));
    }
  }, [dateFrom, dateTo]);

  // ── Load all columns ───────────────────────────────────────────────────────
  const loadAll = useCallback(() => {
    setIsSearchMode(false);
    setSearch("");
    COLUMNS.forEach(col => fetchColumn(col.key, 1, false));
  }, [fetchColumn]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Search ─────────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string, page = 1) => {
    if (!q.trim()) { setIsSearchMode(false); setSearchResults([]); return; }
    setIsSearching(true);
    setIsSearchMode(true);
    try {
      const params = new URLSearchParams({ search: q, page: String(page), pageSize: String(PAGE_SIZE) });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo", dateTo);

      const res  = await fetch(`/api/taskflow/progress-logs?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      if (page === 1) setSearchResults(json.data ?? []);
      else setSearchResults(prev => [...prev, ...(json.data ?? [])]);
      setSearchTotal(json.total ?? 0);
      setSearchPage(page);
      // Resolve user names for search results
      resolveUserNames(json.data ?? []);
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

  const clearSearch = () => { setSearch(""); setIsSearchMode(false); setSearchResults([]); };

  const handleViewMore = (col: ColumnKey) => { fetchColumn(col, colPages[col] + 1, true); };

  // ── Edit dialog ────────────────────────────────────────────────────────────
  const openEdit = (act: Activity) => {
    setSelectedAct(act);
    setEditForm({ ...act });
  };

  const handleSave = async () => {
    if (!selectedAct) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("history").update(editForm).eq("id", selectedAct.id);
      if (error) throw new Error(error.message);
      toast.success("Progress log updated");
      setSelectedAct(null);
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
                    Progress Logs
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
              <ClipboardList className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Progress Logs</h1>
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
          <div className="relative z-10 shrink-0 grid grid-cols-3 border-b" style={{ borderColor: C.border }}>
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
                placeholder="Search by activity ref no., ticket ref, or company…"
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
              <div className="h-full overflow-y-auto px-4 py-4">
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
                        className="flex items-center gap-3 px-4 py-3 border cursor-pointer transition-colors"
                        style={{ borderColor: C.border, backgroundColor: C.panel }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                      >
                        <span className="text-[10px] font-bold font-mono shrink-0" style={{ color: C.accent }}>
                          {act.activity_reference_number || "—"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold uppercase truncate" style={{ color: C.text }}>
                            {act.company_name || "—"}
                          </p>
                          {act.referenceid && (
                            <p className="text-[9px] font-mono" style={{ color: "#60a5fa" }}>
                              {act.referenceid}
                              {userNames[act.referenceid] && (
                                <span style={{ color: C.dim }}> — {userNames[act.referenceid]}</span>
                              )}
                            </p>
                          )}
                          {act.type_activity && (
                            <p className="text-[8px] uppercase tracking-widest" style={{ color: C.dim }}>
                              {act.type_activity}
                            </p>
                          )}
                        </div>
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
              <div className="h-full overflow-x-auto overflow-y-hidden">
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
                      userNames={userNames}
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
            className="max-w-3xl w-full rounded-none p-0 gap-0 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}
          >
            <DialogHeader
              className="px-5 py-4 border-b sticky top-0 z-10"
              style={{ borderColor: C.border, backgroundColor: C.bg }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border }}>
                  <ClipboardList className="size-4" style={{ color: C.accent }} />
                </div>
                <div>
                  <DialogTitle className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                    Edit Progress Log
                  </DialogTitle>
                  <p className="text-[10px] mt-0.5 truncate max-w-[400px]" style={{ color: C.muted }}>
                    {selectedAct.company_name || selectedAct.id}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="px-5 py-4 space-y-5">
              {/* Basic Info */}
              <Section title="Basic Information">
                <Field label="Reference ID"       value={editForm.referenceid ?? ""}                onChange={v => setEditForm(p => ({ ...p, referenceid: v }))} />
                <Field label="Activity Ref"        value={editForm.activity_reference_number ?? ""}  onChange={v => setEditForm(p => ({ ...p, activity_reference_number: v }))} />
                <Field label="Ticket Ref"          value={editForm.ticket_reference_number ?? ""}    onChange={v => setEditForm(p => ({ ...p, ticket_reference_number: v }))} />
                <Field label="Account Ref"         value={editForm.account_reference_number ?? ""}   onChange={v => setEditForm(p => ({ ...p, account_reference_number: v }))} />
              </Section>

              {/* Client Info */}
              <Section title="Client Information">
                <Field label="Company Name"    value={editForm.company_name ?? ""}    onChange={v => setEditForm(p => ({ ...p, company_name: v }))} />
                <Field label="Contact Person"  value={editForm.contact_person ?? ""}  onChange={v => setEditForm(p => ({ ...p, contact_person: v }))} />
                <Field label="Contact Number"  value={editForm.contact_number ?? ""}  onChange={v => setEditForm(p => ({ ...p, contact_number: v }))} />
                <Field label="Email Address"   value={editForm.email_address ?? ""}   onChange={v => setEditForm(p => ({ ...p, email_address: v }))} />
                <Field label="Address"         value={editForm.address ?? ""}         onChange={v => setEditForm(p => ({ ...p, address: v }))} span2 />
                <Field label="Type Client"     value={editForm.type_client ?? ""}     onChange={v => setEditForm(p => ({ ...p, type_client: v }))} />
                <Field label="VAT Type"        value={editForm.vat_type ?? ""}        onChange={v => setEditForm(p => ({ ...p, vat_type: v }))} />
              </Section>

              {/* Project Details */}
              <Section title="Project Details">
                <Field label="Project Name"      value={editForm.project_name ?? ""}      onChange={v => setEditForm(p => ({ ...p, project_name: v }))} />
                <Field label="Product Category"  value={editForm.product_category ?? ""}  onChange={v => setEditForm(p => ({ ...p, product_category: v }))} />
                <Field label="Project Type"      value={editForm.project_type ?? ""}      onChange={v => setEditForm(p => ({ ...p, project_type: v }))} />
                <Field label="Source"            value={editForm.source ?? ""}            onChange={v => setEditForm(p => ({ ...p, source: v }))} />
                <Field label="Type Activity"     value={editForm.type_activity ?? ""}     onChange={v => setEditForm(p => ({ ...p, type_activity: v }))} />
                <Field label="Target Quota"      value={editForm.target_quota ?? ""}      onChange={v => setEditForm(p => ({ ...p, target_quota: v }))} />
                <Field label="Start Date"        value={editForm.start_date ?? ""}        onChange={v => setEditForm(p => ({ ...p, start_date: v }))}        type="date" />
                <Field label="End Date"          value={editForm.end_date ?? ""}          onChange={v => setEditForm(p => ({ ...p, end_date: v }))}          type="date" />
              </Section>

              {/* Call Details */}
              <Section title="Call Details">
                <Field label="Call Status"    value={editForm.call_status ?? ""}    onChange={v => setEditForm(p => ({ ...p, call_status: v }))} />
                <Field label="Call Type"      value={editForm.call_type ?? ""}      onChange={v => setEditForm(p => ({ ...p, call_type: v }))} />
                <Field label="Callback"       value={editForm.callback ?? ""}       onChange={v => setEditForm(p => ({ ...p, callback: v }))}       type="date" />
                <Field label="Date Followup"  value={editForm.date_followup ?? ""}  onChange={v => setEditForm(p => ({ ...p, date_followup: v }))}  type="date" />
                <Field label="Date Site Visit" value={editForm.date_site_visit ?? ""} onChange={v => setEditForm(p => ({ ...p, date_site_visit: v }))} type="date" />
              </Section>

              {/* Quotation & Sales */}
              <Section title="Quotation & Sales">
                <Field label="Quotation Number"  value={editForm.quotation_number ?? ""}  onChange={v => setEditForm(p => ({ ...p, quotation_number: v }))} />
                <Field label="Quotation Amount"  value={editForm.quotation_amount ?? ""}  onChange={v => setEditForm(p => ({ ...p, quotation_amount: v }))} />
                <Field label="Quotation Type"    value={editForm.quotation_type ?? ""}    onChange={v => setEditForm(p => ({ ...p, quotation_type: v }))} />
                <Field label="SO Number"         value={editForm.so_number ?? ""}         onChange={v => setEditForm(p => ({ ...p, so_number: v }))} />
                <Field label="SO Amount"         value={editForm.so_amount ?? ""}         onChange={v => setEditForm(p => ({ ...p, so_amount: v }))} />
                <Field label="Actual Sales"      value={editForm.actual_sales ?? ""}      onChange={v => setEditForm(p => ({ ...p, actual_sales: v }))} />
              </Section>

              {/* Delivery */}
              <Section title="Delivery Information">
                <Field label="Delivery Date"    value={editForm.delivery_date ?? ""}    onChange={v => setEditForm(p => ({ ...p, delivery_date: v }))}    type="date" />
                <Field label="DR Number"        value={editForm.dr_number ?? ""}        onChange={v => setEditForm(p => ({ ...p, dr_number: v }))} />
                <Field label="SI Date"          value={editForm.si_date ?? ""}          onChange={v => setEditForm(p => ({ ...p, si_date: v }))}          type="date" />
                <Field label="Payment Terms"    value={editForm.payment_terms ?? ""}    onChange={v => setEditForm(p => ({ ...p, payment_terms: v }))} />
                <Field label="Scheduled Status" value={editForm.scheduled_status ?? ""} onChange={v => setEditForm(p => ({ ...p, scheduled_status: v }))} />
              </Section>

              {/* Product */}
              <Section title="Product Details">
                <Field label="Product SKU"         value={editForm.product_sku ?? ""}         onChange={v => setEditForm(p => ({ ...p, product_sku: v }))} />
                <Field label="Product Title"       value={editForm.product_title ?? ""}       onChange={v => setEditForm(p => ({ ...p, product_title: v }))} />
                <Field label="Product Qty"         value={editForm.product_quantity ?? ""}    onChange={v => setEditForm(p => ({ ...p, product_quantity: v }))} />
                <Field label="Product Amount"      value={editForm.product_amount ?? ""}      onChange={v => setEditForm(p => ({ ...p, product_amount: v }))} />
                <Field label="Product Description" value={editForm.product_description ?? ""} onChange={v => setEditForm(p => ({ ...p, product_description: v }))} span2 />
              </Section>

              {/* Assignment */}
              <Section title="Assignment">
                <Field label="TSM"     value={editForm.tsm ?? ""}     onChange={v => setEditForm(p => ({ ...p, tsm: v }))} />
                <Field label="Manager" value={editForm.manager ?? ""} onChange={v => setEditForm(p => ({ ...p, manager: v }))} />
                <Field label="Agent"   value={editForm.agent ?? ""}   onChange={v => setEditForm(p => ({ ...p, agent: v }))} />
                <Field label="Status"  value={editForm.status ?? ""}  onChange={v => setEditForm(p => ({ ...p, status: v }))} />
              </Section>

              {/* TSM Approval */}
              <Section title="TSM Approval">
                <Field label="Approved Status"  value={editForm.tsm_approved_status ?? ""}  onChange={v => setEditForm(p => ({ ...p, tsm_approved_status: v }))} />
                <Field label="Approved Date"    value={editForm.tsm_approved_date ?? ""}    onChange={v => setEditForm(p => ({ ...p, tsm_approved_date: v }))}    type="date" />
                <Field label="Approved Remarks" value={editForm.tsm_approved_remarks ?? ""} onChange={v => setEditForm(p => ({ ...p, tsm_approved_remarks: v }))} span2 />
              </Section>

              {/* Remarks */}
              <Section title="Remarks">
                <Field label="Remarks" value={editForm.remarks ?? ""} onChange={v => setEditForm(p => ({ ...p, remarks: v }))} span2 />
              </Section>
            </div>

            {/* Footer */}
            <div
              className="px-5 py-3 border-t flex items-center justify-end gap-2 sticky bottom-0"
              style={{ borderColor: C.border, backgroundColor: C.bg }}
            >
              <button
                onClick={() => setSelectedAct(null)}
                className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors disabled:opacity-40"
                style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
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

// ─── Edit field sub-components ────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4
        className="text-[9px] font-mono font-bold uppercase tracking-widest pb-1 border-b"
        style={{ color: "#e8630a80", borderColor: "#e8630a20" }}
      >
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", span2 = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  span2?: boolean;
}) {
  const C_accent = "#e8630a";
  const C_border = "#1a2535";
  const C_panel  = "#0d1117";
  const C_text   = "#c8d8e8";
  const C_muted  = "#4a6070";
  const C_font   = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

  return (
    <div className={span2 ? "col-span-2 space-y-1" : "space-y-1"}>
      <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C_accent + "80" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-8 px-2 text-[11px] focus:outline-none"
        style={{
          backgroundColor: C_panel, border: `1px solid ${C_border}`,
          color: C_text, fontFamily: C_font,
        }}
        onFocus={e => (e.currentTarget.style.borderColor = C_accent)}
        onBlur={e  => (e.currentTarget.style.borderColor = C_border)}
      />
    </div>
  );
}
