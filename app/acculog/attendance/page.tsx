"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, Download, ClipboardList,
  ChevronLeft, ChevronRight, MapPin, Building2, MessageSquare,
  CheckCircle2, XCircle, Clock, ExternalLink, Save, Database,
} from "lucide-react";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

interface ClientVisitRecord {
  _id: string;
  ReferenceID: string;
  Type: string;
  Status: string;
  Location?: string;
  SiteVisitAccount?: string;
  Remarks?: string;
  date_created?: string;
  PhotoURL?: string;
  Latitude?: number;
  Longitude?: number;
  account_reference_number?: string;
}

const C = {
  bg: "#080d12", panel: "#0d1117", border: "#1a2535",
  muted: "#253040", dim: "#4a6070", text: "#c8d8e8",
  accent: "#e8630a", font: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};
const PAGE_SIZE = 20;

const DATABASES = [
  { id: "supabase_accounts", label: "Supabase — accounts", desc: "Taskflow customer accounts" },
  { id: "neon_accounts", label: "Neon (PostgreSQL) — accounts", desc: "Taskflow Neon DB accounts table" },
];

function formatDate(val?: string | null) {
  if (!val) return "—";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila",
    }).format(new Date(val));
  } catch { return val; }
}

function statusStyle(s: string) {
  const v = s.toLowerCase();
  if (["active", "success"].includes(v))
    return { color: "#34d399", border: "#34d39940", bg: "rgba(52,211,153,0.08)", icon: CheckCircle2 };
  if (["inactive", "failed"].includes(v))
    return { color: "#f87171", border: "#f8717140", bg: "rgba(248,113,113,0.08)", icon: XCircle };
  return { color: "#fbbf24", border: "#fbbf2440", bg: "rgba(251,191,36,0.08)", icon: Clock };
}

export default function AcculogAttendancePage() {
  const router = useRouter();

  const [records, setRecords] = useState<ClientVisitRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupDb, setLookupDb] = useState("supabase_accounts");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMatches, setLookupMatches] = useState<any[]>([]);
  const [lookupStats, setLookupStats] = useState<{ total: number; matched: number; unmatched: number } | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ updated: number } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, dateFrom, dateTo]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        type: "Client Visit",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (dateFrom) params.set("dateFrom", new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        params.set("dateTo", end.toISOString());
      }
      const res = await fetch(`/api/hr/attendance?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const data: ClientVisitRecord[] = json.data ?? [];
      setRecords(data);
      setTotal(json.total ?? 0);
      const init: Record<string, string> = {};
      data.forEach(r => { init[r._id] = r.account_reference_number ?? ""; });
      setEditValues(init);
      setDirtyIds(new Set());
    } catch (err: any) {
      toast.error("Failed to load: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleEditChange = (id: string, val: string) => {
    setEditValues(prev => ({ ...prev, [id]: val }));
    setDirtyIds(prev => new Set(prev).add(id));
  };

  const handleSave = async (id: string) => {
    setSavingId(id);
    try {
      const res = await fetch("/api/hr/attendance/update", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: id, account_reference_number: editValues[id] ?? "" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Saved");
      setDirtyIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      setRecords(prev => prev.map(r => r._id === id ? { ...r, account_reference_number: editValues[id] } : r));
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") { e.preventDefault(); handleSave(id); }
    if (e.key === "Escape") {
      const original = records.find(r => r._id === id)?.account_reference_number ?? "";
      setEditValues(prev => ({ ...prev, [id]: original }));
      setDirtyIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const handleLookup = async () => {
    setLookupLoading(true);
    setLookupMatches([]);
    setLookupStats(null);
    setSelectedMatches(new Set());
    setApplyResult(null);
    try {
      const res = await fetch("/api/hr/attendance/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ database: lookupDb }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setLookupMatches(json.matches ?? []);
      setLookupStats({ total: json.total, matched: json.matched, unmatched: json.unmatched });
      const autoSelect = new Set<string>(
        (json.matches ?? []).filter((m: any) => m.confidence === "exact").map((m: any) => m.attendanceId)
      );
      setSelectedMatches(autoSelect);
      if ((json.matches ?? []).length === 0) toast.success(json.message ?? "No matches found");
    } catch (err: any) {
      toast.error(err.message ?? "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleApply = async () => {
    const toApply = lookupMatches.filter(m => selectedMatches.has(m.attendanceId));
    if (!toApply.length) { toast.error("Select at least one match"); return; }
    setApplying(true);
    try {
      const res = await fetch("/api/hr/attendance/bulk-update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: toApply.map(m => ({ attendanceId: m.attendanceId, account_reference_number: m.foundAccountRef })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setApplyResult({ updated: json.updated });
      toast.success(`Updated ${json.updated} records`);
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message ?? "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const handleExport = () => {
    const headers = ["Reference ID", "Type", "Status", "Location", "Site Visit Account", "Account Ref No.", "Remarks", "Date Created"];
    const rows = records.map(r =>
      [r.ReferenceID, r.Type, r.Status, r.Location ?? "", r.SiteVisitAccount ?? "",
       r.account_reference_number ?? "", r.Remarks ?? "", r.date_created ?? ""]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `client-visits_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    toast.success("Exported");
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(page * PAGE_SIZE, total);
  const dirtyCount = dirtyIds.size;

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden bg-[#080d12]" style={{ fontFamily: C.font, color: C.text }}>
          {/* Dot grid background */}
          <div className="fixed inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
            backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
          }} />

          {/* Header */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b bg-[#080d12]" style={{ borderColor: C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <button onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest"
              style={{ color: C.dim, background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>Home</button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Acculog</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Client Visit Attendance</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              {loading && <Loader2 className="size-3 animate-spin" style={{ color: C.accent }} />}
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Live</span>
            </div>
          </header>

          {/* Title bar */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <ClipboardList className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Client Visit Attendance</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Acculog · Type: Client Visit · {total.toLocaleString()} records
              </p>
            </div>
            {dirtyCount > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[9px] px-2 py-0.5 border" style={{ borderColor: "#fbbf2440", color: "#fbbf24", backgroundColor: "rgba(251,191,36,0.08)" }}>
                  {dirtyCount} unsaved change{dirtyCount !== 1 ? "s" : ""}
                </span>
                <span className="text-[9px]" style={{ color: C.muted }}>Press Enter or click 💾 to save</span>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="relative z-10 shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
              <input placeholder="Search ref ID, location, account…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e => (e.currentTarget.style.borderColor = C.border)} />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-3" style={{ color: C.dim }} /></button>}
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Success">Success</option>
              <option value="Inactive">Inactive</option>
              <option value="Failed">Failed</option>
              <option value="Pending">Pending</option>
            </select>
            <div className="flex items-center gap-1">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="h-8 text-[11px] px-2 focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: dateFrom ? C.text : C.dim, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e => (e.currentTarget.style.borderColor = C.border)} />
              <span className="text-[10px]" style={{ color: C.muted }}>–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="h-8 text-[11px] px-2 focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: dateTo ? C.text : C.dim, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e => (e.currentTarget.style.borderColor = C.border)} />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }}><X className="size-3" style={{ color: C.dim }} /></button>
              )}
            </div>
            <div className="flex-1" />
            <button onClick={() => fetchRecords()}
              className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
              <RefreshCw className="size-3" /> Refresh
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
              <Download className="size-3" /> Export
            </button>
            <button onClick={() => { setLookupOpen(true); setLookupMatches([]); setLookupStats(null); setApplyResult(null); }}
              className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ borderColor: "#60a5fa40", color: "#60a5fa", backgroundColor: "rgba(96,165,250,0.08)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.18)"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.08)"; }}>
              <Database className="size-3" /> Database Look Up
            </button>
          </div>

          {/* Table */}
          <div className="relative z-10 flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full gap-3">
                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                <span className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Loading…</span>
              </div>
            ) : (
              <table className="w-full border-collapse" style={{ fontSize: "11px", fontFamily: C.font }}>
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                    {["Reference ID", "Type", "Status", "Location", "Site Visit Account", "Account Ref No.", "Remarks", "Date Created", "Photo"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 whitespace-nowrap font-bold uppercase tracking-widest"
                        style={{ color: h === "Account Ref No." ? "#fbbf24" : C.accent, fontSize: "9px", borderRight: `1px solid ${C.border}` }}>
                        {h}{h === "Account Ref No." && <span className="ml-1 text-[7px] normal-case" style={{ color: "#fbbf2480" }}>editable</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-16" style={{ color: C.muted }}>No client visit records found.</td></tr>
                  ) : records.map((r, i) => {
                    const st = statusStyle(r.Status ?? "");
                    const StatusIcon = st.icon;
                    const isDirty = dirtyIds.has(r._id);
                    const isSaving = savingId === r._id;
                    return (
                      <tr key={r._id}
                        style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel, borderBottom: `1px solid ${C.border}` }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>
                        <td className="px-4 py-2.5 whitespace-nowrap font-bold" style={{ borderRight: `1px solid ${C.border}`, color: C.accent }}>{r.ReferenceID || "—"}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 border" style={{ borderColor: "#f9a8d440", color: "#f9a8d4", backgroundColor: "rgba(249,168,212,0.08)" }}>{r.Type || "—"}</span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 border" style={{ borderColor: st.border, color: st.color, backgroundColor: st.bg }}>
                            <StatusIcon className="size-2.5" />{r.Status || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 max-w-[160px]" style={{ borderRight: `1px solid ${C.border}` }}>
                          {r.Location ? <div className="flex items-start gap-1"><MapPin className="size-3 shrink-0 mt-0.5" style={{ color: C.dim }} /><span className="text-[10px] truncate" style={{ color: C.dim }}>{r.Location}</span></div> : <span style={{ color: C.muted }}>—</span>}
                        </td>
                        <td className="px-4 py-2.5 max-w-[140px]" style={{ borderRight: `1px solid ${C.border}` }}>
                          {r.SiteVisitAccount ? <div className="flex items-center gap-1"><Building2 className="size-3 shrink-0" style={{ color: C.dim }} /><span className="text-[10px] truncate" style={{ color: C.text }}>{r.SiteVisitAccount}</span></div> : <span style={{ color: C.muted }}>—</span>}
                        </td>
                        <td className="px-2 py-1.5" style={{ borderRight: `1px solid ${C.border}`, minWidth: "160px" }}>
                          <div className="flex items-center gap-1.5">
                            <input value={editValues[r._id] ?? ""} onChange={e => handleEditChange(r._id, e.target.value)}
                              onKeyDown={e => handleKeyDown(e, r._id)} placeholder="Enter ref no…"
                              className="flex-1 h-6 px-2 text-[10px] font-mono focus:outline-none"
                              style={{ backgroundColor: isDirty ? "rgba(251,191,36,0.08)" : C.bg, border: `1px solid ${isDirty ? "#fbbf24" : C.border}`, color: isDirty ? "#fbbf24" : C.text, fontFamily: C.font }}
                              onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                              onBlur={e => (e.currentTarget.style.borderColor = isDirty ? "#fbbf24" : C.border)} />
                            {isDirty && (
                              <button onClick={() => handleSave(r._id)} disabled={isSaving} title="Save (Enter)"
                                className="flex items-center justify-center h-6 w-6 border transition-colors disabled:opacity-40 shrink-0"
                                style={{ borderColor: "#fbbf2440", backgroundColor: "rgba(251,191,36,0.1)", color: "#fbbf24" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "#fbbf2440"; e.currentTarget.style.color = "#fbbf24"; }}>
                                {isSaving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 max-w-[180px]" style={{ borderRight: `1px solid ${C.border}` }}>
                          {r.Remarks ? <div className="flex items-start gap-1"><MessageSquare className="size-3 shrink-0 mt-0.5" style={{ color: C.dim }} /><span className="text-[10px] line-clamp-2" style={{ color: C.dim }}>{r.Remarks}</span></div> : <span style={{ color: C.muted }}>—</span>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.muted }}>
                          <span className="text-[10px] font-mono">{formatDate(r.date_created)}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {r.PhotoURL ? (
                            <a href={r.PhotoURL} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[9px] transition-colors" style={{ color: "#60a5fa" }}
                              onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                              onMouseLeave={e => (e.currentTarget.style.color = "#60a5fa")}>
                              <ExternalLink className="size-3" /> View
                            </a>
                          ) : <span style={{ color: C.muted }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-2 border-t" style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <span className="text-[10px]" style={{ color: C.muted }}>
              Showing <span style={{ color: C.text }}>{startRow}–{endRow}</span> of <span style={{ color: C.text }}>{total}</span> records
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                onMouseEnter={e => { if (page > 1) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                <ChevronLeft className="size-3" /> Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) p = i + 1;
                else if (page <= 4) p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else p = page - 3 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="h-7 w-7 border text-[10px] font-bold transition-colors"
                    style={{ backgroundColor: p === page ? C.accent : "transparent", borderColor: p === page ? C.accent : C.border, color: p === page ? "#080d12" : C.dim }}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                onMouseEnter={e => { if (page < totalPages) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                Next <ChevronRight className="size-3" />
              </button>
            </div>
          </div>

          {/* Database Look Up Dialog */}
          {lookupOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(8,13,18,0.85)", backdropFilter: "blur(4px)" }}>
              <div className="relative flex flex-col w-full max-w-2xl max-h-[85vh] border" style={{ backgroundColor: C.panel, borderColor: C.border, fontFamily: C.font }}>
                {/* Dialog Header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b shrink-0" style={{ borderColor: C.border }}>
                  <Database className="size-4" style={{ color: "#60a5fa" }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.text }}>Database Look Up</span>
                  <button onClick={() => setLookupOpen(false)} className="ml-auto" style={{ color: C.dim }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.text)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                    <X className="size-4" />
                  </button>
                </div>

                {/* Dialog Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {/* Section 1: Select Database */}
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: C.dim }}>Select Database</p>
                    <div className="space-y-2">
                      {DATABASES.map(db => (
                        <label key={db.id} className="flex items-start gap-3 p-3 border cursor-pointer transition-colors"
                          style={{ borderColor: lookupDb === db.id ? "#60a5fa40" : C.border, backgroundColor: lookupDb === db.id ? "rgba(96,165,250,0.06)" : "transparent" }}>
                          <input type="radio" name="lookupDb" value={db.id} checked={lookupDb === db.id}
                            onChange={() => setLookupDb(db.id)} className="mt-0.5 accent-blue-400" />
                          <div>
                            <p className="text-[11px] font-bold" style={{ color: lookupDb === db.id ? "#60a5fa" : C.text }}>{db.label}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: C.dim }}>{db.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Stats bar */}
                  {lookupStats && (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Total Empty", val: lookupStats.total, color: C.text },
                        { label: "Matched", val: lookupStats.matched, color: "#34d399" },
                        { label: "Unmatched", val: lookupStats.unmatched, color: "#f87171" },
                      ].map(s => (
                        <div key={s.label} className="flex flex-col items-center py-3 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                          <span className="text-lg font-bold" style={{ color: s.color }}>{s.val}</span>
                          <span className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: C.dim }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Section 3: Results table */}
                  {lookupMatches.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>
                          Results — {lookupMatches.length} match{lookupMatches.length !== 1 ? "es" : ""}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedMatches(new Set(lookupMatches.map((m: any) => m.attendanceId)))}
                            className="text-[9px] uppercase tracking-wider px-2 py-0.5 border transition-colors"
                            style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                            Select All
                          </button>
                          <button onClick={() => setSelectedMatches(new Set())}
                            className="text-[9px] uppercase tracking-wider px-2 py-0.5 border transition-colors"
                            style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                            Deselect All
                          </button>
                        </div>
                      </div>
                      <div className="border overflow-auto max-h-64" style={{ borderColor: C.border }}>
                        <table className="w-full border-collapse" style={{ fontSize: "10px", fontFamily: C.font }}>
                          <thead className="sticky top-0">
                            <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                              {["", "Reference ID", "Site Visit Account", "Found Account Ref", "Company Name", "Confidence"].map(h => (
                                <th key={h} className="text-left px-3 py-2 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
                                  style={{ color: C.accent, borderRight: `1px solid ${C.border}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {lookupMatches.map((m: any, i: number) => {
                              const isSelected = selectedMatches.has(m.attendanceId);
                              const isExact = m.confidence === "exact";
                              return (
                                <tr key={m.attendanceId}
                                  style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel, borderBottom: `1px solid ${C.border}` }}
                                  onClick={() => {
                                    setSelectedMatches(prev => {
                                      const n = new Set(prev);
                                      isSelected ? n.delete(m.attendanceId) : n.add(m.attendanceId);
                                      return n;
                                    });
                                  }}>
                                  <td className="px-3 py-2" style={{ borderRight: `1px solid ${C.border}` }}>
                                    <input type="checkbox" checked={isSelected} onChange={() => {}} className="accent-blue-400" />
                                  </td>
                                  <td className="px-3 py-2 font-bold whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.accent }}>{m.referenceId || "—"}</td>
                                  <td className="px-3 py-2 max-w-[120px] truncate" style={{ borderRight: `1px solid ${C.border}`, color: C.text }}>{m.siteVisitAccount || "—"}</td>
                                  <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: "#fbbf24" }}>{m.foundAccountRef || "—"}</td>
                                  <td className="px-3 py-2 max-w-[120px] truncate" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{m.companyName || "—"}</td>
                                  <td className="px-3 py-2">
                                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                                      style={{
                                        borderColor: isExact ? "#34d39940" : "#fbbf2440",
                                        color: isExact ? "#34d399" : "#fbbf24",
                                        backgroundColor: isExact ? "rgba(52,211,153,0.08)" : "rgba(251,191,36,0.08)",
                                      }}>
                                      {m.confidence}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Apply result */}
                  {applyResult && (
                    <div className="flex items-center gap-2 px-3 py-2 border" style={{ borderColor: "#34d39940", backgroundColor: "rgba(52,211,153,0.08)" }}>
                      <CheckCircle2 className="size-4" style={{ color: "#34d399" }} />
                      <span className="text-[11px] font-bold" style={{ color: "#34d399" }}>✓ Updated {applyResult.updated} records</span>
                    </div>
                  )}
                </div>

                {/* Dialog Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t shrink-0" style={{ borderColor: C.border }}>
                  <button onClick={() => setLookupOpen(false)}
                    className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                    style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                    Cancel
                  </button>
                  <button onClick={handleLookup} disabled={lookupLoading}
                    className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-50"
                    style={{ borderColor: "#60a5fa40", color: "#60a5fa", backgroundColor: "rgba(96,165,250,0.1)" }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.1)"; }}>
                    {lookupLoading ? <Loader2 className="size-3 animate-spin" /> : <Database className="size-3" />}
                    Search Database
                  </button>
                  {lookupMatches.length > 0 && !applyResult && (
                    <button onClick={handleApply} disabled={applying || selectedMatches.size === 0}
                      className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-50"
                      style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "rgba(52,211,153,0.1)" }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(52,211,153,0.2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(52,211,153,0.1)"; }}>
                      {applying ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                      Apply to {selectedMatches.size} Selected
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
