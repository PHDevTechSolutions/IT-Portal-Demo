"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import { Loader2, Search, AlertCircle, CheckCircle2, Ticket } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/taskflow/customer-database/calendar";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Activity {
  id: string; company_name: string; contact_person: string;
  contact_number: string | null; email_address: string; address: string;
  ticket_reference_number: string; wrap_up: string; inquiry: string;
  tsm: string; agent: string; status: string;
  date_created: string; date_updated: string; referenceid: string;
}
interface ActivityData {
  activity_reference_number: string; scheduled_date: string; company_name: string;
  contact_person: string; contact_number: string; email_address: string; address: string;
  type_client: string; cancellation_remarks: string; ticket_remarks: string; status: string;
}
interface Agent { ReferenceID: string; Firstname: string; Lastname: string; profilePicture?: string; }

const ROWS_PER_PAGE = 10;
const BATCH_SIZE = 1000;
const DELETE_HOLD_DURATION = 2000;

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CsrInquiriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteHoldProgress, setDeleteHoldProgress] = useState(0);
  const [isHoldingDelete, setIsHoldingDelete] = useState(false);
  const deleteHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortColumn, setSortColumn] = useState<string>("date_created");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    referenceid: true, tsm: true, company_name: true, contact_person: true,
    contact_number: true, email_address: true, address: true,
    ticket_reference_number: true, wrap_up: true, inquiry: true,
    agent: true, status: true, date_created: true, date_updated: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; field: string } | null>(null);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<string>("");
  const [bulkEditValue, setBulkEditValue] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Activity>>({});
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());
  const [auditErrors, setAuditErrors] = useState<string[]>([]);
  const [showAuditPanel, setShowAuditPanel] = useState(true);
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  // ── Fetch users ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/Dashboard/FetchUser").then((r) => r.json()).then((result) => {
      if (result.success && result.data) setAgents(result.data);
    }).catch(console.error);
  }, []);

  const agentMap = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((a) => { map[a.ReferenceID] = `${a.Firstname || ""} ${a.Lastname || ""}`.trim() || a.ReferenceID; });
    return map;
  }, [agents]);

  const uniqueAgents = useMemo(() => {
    const ids = new Set(activities.map((a) => a.agent).filter(Boolean));
    return Array.from(ids).map((id) => ({ id, name: agentMap[id] || id }));
  }, [activities, agentMap]);

  // ── Fetch activities ───────────────────────────────────────────────────────
  const fetchActivities = async () => {
    setIsFetching(true);
    let allData: any[] = []; let hasMore = true; let start = 0; let batches = 0;
    while (hasMore && batches < 100) {
      let q = supabase.from("endorsed-ticket").select("*");
      if (dateFrom) q = q.gte("date_created", dateFrom);
      if (dateTo) q = q.lte("date_created", dateTo);
      if (selectedAgent) q = q.eq("agent", selectedAgent);
      const { data, error } = await q.order("date_created", { ascending: false }).range(start, start + BATCH_SIZE - 1);
      if (error) { toast.error(`Error: ${error.message}`); setActivities([]); setIsFetching(false); return; }
      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < BATCH_SIZE) hasMore = false; else { start += BATCH_SIZE; batches++; }
      } else { hasMore = false; }
    }
    setActivities(allData); setIsFetching(false);
  };

  useEffect(() => { fetchActivities(); }, []);
  useEffect(() => { fetchActivities(); }, [dateFrom, dateTo, selectedAgent]);

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : "N/A";

  // ── Field validation ───────────────────────────────────────────────────────
  const isFieldIncomplete = (field: keyof Activity, value: string | null | number | undefined): boolean => {
    const v = value != null ? String(value) : "";
    if (!v || v.trim() === "" || v === "null" || v === "undefined") return true;
    switch (field) {
      case "email_address": { const emails = v.split(",").map((e) => e.trim()).filter((e) => e.length > 0); return emails.length === 0 || !emails.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)); }
      case "contact_number": { const nums = v.replace(/,/g, "/").split("/").map((n) => n.trim()).filter((n) => n.length > 0); return nums.length === 0 || !nums.every((n) => n.length >= 7 && /^[0-9+\-\s()]*$/.test(n)); }
      case "company_name": return v.trim().length < 2;
      case "contact_person": { const ps = v.split("/").map((p) => p.trim()).filter((p) => p.length > 0); return ps.length === 0 || !ps.every((p) => p.length >= 2); }
      default: return false;
    }
  };

  const incompleteFieldKeys: (keyof Activity)[] = ["company_name","contact_person","contact_number","email_address","address","ticket_reference_number","wrap_up","inquiry","agent","status"];

  // ── Filtered / sorted / paginated ──────────────────────────────────────────
  const filteredActivities = useMemo(() => {
    let r = activities;
    if (showIncompleteOnly) r = r.filter((a) => incompleteFieldKeys.some((f) => isFieldIncomplete(f, a[f])));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((a) => [a.company_name, a.ticket_reference_number, a.wrap_up, a.inquiry, a.tsm, a.agent, a.status, a.date_created, a.date_updated, a.referenceid].filter(Boolean).some((f) => f.toLowerCase().includes(q)));
    }
    return r;
  }, [activities, search, showIncompleteOnly]);

  const sortedActivities = useMemo(() => {
    if (!sortColumn) return filteredActivities;
    return [...filteredActivities].sort((a, b) => {
      const av = a[sortColumn as keyof Activity] || ""; const bv = b[sortColumn as keyof Activity] || "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredActivities, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedActivities.length / ROWS_PER_PAGE));
  const paginatedActivities = useMemo(() => sortedActivities.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE), [sortedActivities, page]);

  useEffect(() => { setPage(1); }, [search]);

  // ── Keyboard nav ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedCell) return;
      const ci = paginatedActivities.findIndex((a) => a.id === focusedCell.rowId);
      const fields = Object.keys(columnVisibility).filter((k) => columnVisibility[k]);
      const fi = fields.indexOf(focusedCell.field);
      if (e.key === "ArrowDown" && ci < paginatedActivities.length - 1) { e.preventDefault(); setFocusedCell({ rowId: paginatedActivities[ci + 1].id, field: focusedCell.field }); }
      else if (e.key === "ArrowUp" && ci > 0) { e.preventDefault(); setFocusedCell({ rowId: paginatedActivities[ci - 1].id, field: focusedCell.field }); }
      else if (e.key === "ArrowRight" && fi < fields.length - 1) { e.preventDefault(); setFocusedCell({ rowId: focusedCell.rowId, field: fields[fi + 1] }); }
      else if (e.key === "ArrowLeft" && fi > 0) { e.preventDefault(); setFocusedCell({ rowId: focusedCell.rowId, field: fields[fi - 1] }); }
      else if (e.key === "Escape") setFocusedCell(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedCell, paginatedActivities, columnVisibility]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const activityStats = useMemo(() => {
    const total = activities.length;
    const completed = activities.filter((a) => ["completed","resolved","done"].includes(a.status?.toLowerCase())).length;
    const received = activities.filter((a) => ["received","pending","new"].includes(a.status?.toLowerCase())).length;
    const endorsed = activities.filter((a) => ["endorsed","in_progress"].includes(a.status?.toLowerCase())).length;
    const incomplete = activities.filter((a) => incompleteFieldKeys.some((f) => isFieldIncomplete(f, a[f]))).length;
    return { total, completed, received, endorsed, incomplete };
  }, [activities]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    const headers = Object.keys(columnVisibility).filter((k) => columnVisibility[k]);
    const csv = [headers.join(","), ...paginatedActivities.map((row) => headers.map((h) => { const v = String(row[h as keyof Activity] || ""); return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v; }).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `endorsed-tickets-${new Date().toISOString().split("T")[0]}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleSort = (col: string) => { if (sortColumn === col) setSortDirection((d) => d === "asc" ? "desc" : "asc"); else { setSortColumn(col); setSortDirection("asc"); } };
  const toggleColumnVisibility = (col: string) => setColumnVisibility((prev) => ({ ...prev, [col]: !prev[col] }));

  const handleBulkEdit = async () => {
    if (!selectedIds.length || !bulkEditField) return;
    const { error } = await supabase.from("endorsed-ticket").update({ [bulkEditField]: bulkEditValue }).in("id", selectedIds);
    if (error) { toast.error("Failed to bulk update"); return; }
    toast.success(`Updated ${selectedIds.length} rows`);
    setShowBulkEditDialog(false); setBulkEditField(""); setBulkEditValue(""); setSelectedIds([]); await fetchActivities();
  };

  const toggleSelect = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleSelectAll = () => {
    const ids = paginatedActivities.map((a) => a.id);
    const allSel = ids.every((id) => selectedIds.includes(id));
    setSelectedIds(allSel ? selectedIds.filter((id) => !ids.includes(id)) : [...new Set([...selectedIds, ...ids])]);
  };

  const fetchActivityData = async (ticketRef: string) => {
    if (!ticketRef) { setActivityData(null); return; }
    setIsLoadingActivity(true);
    try {
      const res = await fetch("/api/fetch-activity");
      const result = await res.json();
      const match = (result.activities || []).find((a: any) => a.ticket_reference_number === ticketRef);
      if (match) setActivityData({ activity_reference_number: match.activity_reference_number || "", scheduled_date: match.scheduled_date || "", company_name: match.company_name || "", contact_person: match.contact_person || "", contact_number: match.contact_number || "", email_address: match.email_address || "", address: match.address || "", type_client: match.type_client || "", cancellation_remarks: match.cancellation_remarks || "", ticket_remarks: match.ticket_remarks || "", status: match.status || "" });
      else setActivityData(null);
    } catch { setActivityData(null); }
    finally { setIsLoadingActivity(false); }
  };

  const handleEditClick = (a: Activity) => { setEditingActivity(a); setEditFormData({ ...a }); setActivityData(null); setShowEditDialog(true); fetchActivityData(a.ticket_reference_number); };
  const handleEditFormChange = (field: keyof Activity, value: string) => setEditFormData((prev) => ({ ...prev, [field]: value }));

  const handleSaveEdit = async () => {
    if (!editingActivity) return;
    const updates: Partial<Activity> = {};
    Object.keys(editFormData).forEach((k) => { const f = k as keyof Activity; if (editFormData[f] !== editingActivity[f]) updates[f] = editFormData[f] as any; });
    if (!Object.keys(updates).length) { toast.info("No changes to save"); setShowEditDialog(false); return; }
    const { error } = await supabase.from("endorsed-ticket").update(updates).eq("id", editingActivity.id);
    if (error) { toast.error(`Failed to update: ${error.message}`); return; }
    toast.success("Activity updated"); setShowEditDialog(false); setEditingActivity(null); await fetchActivities();
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const { error } = await supabase.from("endorsed-ticket").delete().in("id", selectedIds);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success(`${selectedIds.length} activities deleted`);
    setSelectedIds([]); setShowDeleteConfirm(false); setDeleteHoldProgress(0); setIsHoldingDelete(false); fetchActivities();
  };

  const startDeleteHold = () => {
    setIsHoldingDelete(true); setDeleteHoldProgress(0);
    const start = Date.now();
    deleteHoldTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min((elapsed / DELETE_HOLD_DURATION) * 100, 100);
      setDeleteHoldProgress(progress);
      if (elapsed >= DELETE_HOLD_DURATION) { clearInterval(deleteHoldTimerRef.current!); deleteHoldTimerRef.current = null; handleBulkDelete(); }
    }, 50);
  };
  const stopDeleteHold = () => {
    setIsHoldingDelete(false); setDeleteHoldProgress(0);
    if (deleteHoldTimerRef.current) { clearInterval(deleteHoldTimerRef.current); deleteHoldTimerRef.current = null; }
  };
  const handleDeleteDialogClose = (open: boolean) => { if (!open) stopDeleteHold(); setShowDeleteConfirm(open); };

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-[#0a0d14] text-slate-100 flex flex-col h-svh overflow-hidden">

          {/* ── Header ── */}
          <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-orange-500/20 bg-[#0d1117]/90 backdrop-blur-sm overflow-hidden">
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/50" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/50" />
            <div className="flex items-center gap-2 px-4 relative z-10">
              <SidebarTrigger className="-ml-1 text-orange-400/70 hover:text-orange-300 hover:bg-orange-500/10" />
              <Separator orientation="vertical" className="h-4 bg-orange-500/20" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#" className="text-slate-500 hover:text-orange-400 font-mono uppercase tracking-wider text-xs">Taskflow</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-slate-700" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-orange-400 font-mono tracking-widest uppercase text-xs">CSR Inquiries</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          {/* ── Page title bar ── */}
          <div className="shrink-0 px-4 sm:px-6 pt-3 pb-2 border-b border-slate-800/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative p-2 bg-orange-500/10 border border-orange-500/30">
                  <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-orange-500/50" />
                  <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-orange-500/50" />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/50" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/50" />
                  <Ticket className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <h1 className="text-sm font-bold tracking-widest uppercase text-orange-400 font-mono leading-tight">CSR Inquiries</h1>
                  <p className="text-[10px] text-slate-600 font-mono mt-0.5 tracking-wider">
                    {isFetching ? "Loading…" : <><span className="text-slate-300 font-semibold">{sortedActivities.length}</span> records</>}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="shrink-0 px-4 sm:px-6 py-2 border-b border-slate-800/60">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative min-w-[180px] max-w-xs flex-1">
                <Search className="absolute left-2 top-2.5 size-3.5 text-slate-600" />
                <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 h-9 text-xs bg-[#0d1117] border-slate-800 text-slate-300 placeholder:text-slate-700 focus:border-orange-500/40 rounded-none font-mono" />
                {isFetching && <Loader2 className="absolute right-2 top-2.5 size-3.5 animate-spin text-orange-500/50" />}
              </div>

              {/* Agent filter */}
              <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}
                className="h-9 text-xs font-mono bg-[#0d1117] border border-slate-800 text-slate-400 px-2 focus:border-orange-500/50 focus:outline-none min-w-[140px]">
                <option value="">All Agents</option>
                {uniqueAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {selectedAgent && (
                <button onClick={() => setSelectedAgent("")}
                  className="h-9 px-2 text-[9px] font-mono uppercase tracking-widest border border-slate-800 text-slate-500 hover:border-orange-500/30 hover:text-orange-400 transition-colors">
                  Clear
                </button>
              )}

              {/* Calendar date range */}
              <Calendar startDate={dateFrom} endDate={dateTo} setStartDateAction={setDateFrom} setEndDateAction={setDateTo} />

              {/* Export */}
              <button onClick={exportToCSV}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-[10px] font-mono uppercase tracking-widest border border-slate-800 bg-[#0d1117] text-slate-400 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300 transition-colors">
                Export CSV
              </button>

              {/* Columns toggle */}
              <button onClick={() => setShowColumnMenu(!showColumnMenu)}
                className={cn("inline-flex items-center gap-1.5 h-9 px-3 text-[10px] font-mono uppercase tracking-widest border transition-colors",
                  showColumnMenu ? "border-orange-500/40 bg-orange-500/5 text-orange-400" : "border-slate-800 bg-[#0d1117] text-slate-400 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300")}>
                Columns
              </button>

              {/* Selection actions */}
              {selectedIds.length > 0 && (<>
                <button onClick={() => setShowBulkEditDialog(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 text-[10px] font-mono uppercase tracking-widest border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors">
                  Bulk Edit ({selectedIds.length})
                </button>
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 text-[10px] font-mono uppercase tracking-widest border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                  Delete ({selectedIds.length})
                </button>
              </>)}

              {/* Pagination */}
              <div className="ml-auto flex items-center gap-1.5">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="h-8 w-8 flex items-center justify-center border border-orange-500/20 text-orange-500/50 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors font-mono text-xs">←</button>
                <div className="flex items-center gap-1 px-3 h-8 border border-orange-500/20 bg-orange-500/5">
                  <span className="text-[11px] font-mono text-orange-400">{page}</span>
                  <span className="text-[11px] font-mono text-orange-500/30">/</span>
                  <span className="text-[11px] font-mono text-orange-500/40">{totalPages}</span>
                </div>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="h-8 w-8 flex items-center justify-center border border-orange-500/20 text-orange-500/50 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors font-mono text-xs">→</button>
              </div>
            </div>
          </div>

          {/* ── Column visibility menu ── */}
          {showColumnMenu && (
            <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-slate-800/60 bg-[#0d1117]">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {Object.keys(columnVisibility).map((col) => (
                  <label key={col} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={columnVisibility[col]} onChange={() => toggleColumnVisibility(col)} className="accent-orange-500" />
                    <span className="text-[10px] font-mono text-slate-400 group-hover:text-orange-400 capitalize transition-colors">{col.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Card Grid ── */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `linear-gradient(rgba(251,146,60,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(251,146,60,0.03) 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
            <div className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-3 px-1">
                <input type="checkbox" checked={paginatedActivities.length > 0 && paginatedActivities.every((a) => selectedIds.includes(a.id))} onChange={toggleSelectAll} className="accent-orange-500" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-orange-500/40">{paginatedActivities.length} records on this page</span>
              </div>

              {isFetching ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <Loader2 className="size-5 animate-spin text-orange-500/40" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-orange-500/30">Loading activities…</span>
                </div>
              ) : paginatedActivities.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <div className="relative p-3 border border-orange-500/20 bg-orange-500/5">
                    <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-orange-500/30" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-orange-500/30" />
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/30" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/30" />
                    <Ticket className="size-5 text-orange-500/30" />
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-orange-500/30">No activities found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {paginatedActivities.map((act, index) => {
                    const incompleteCount = incompleteFieldKeys.filter((f) => isFieldIncomplete(f, act[f])).length;
                    const isSelected = selectedIds.includes(act.id);
                    return (
                      <div key={act.id} onClick={() => handleEditClick(act)}
                        className={cn("border transition-colors cursor-pointer",
                          isSelected ? "border-orange-500/40 bg-orange-500/[0.06]" : "border-orange-500/10 bg-[#0d1117] hover:border-orange-500/30 hover:bg-orange-500/[0.03]",
                          incompleteCount > 0 && "border-l-2 border-l-red-500/50")}>
                        {/* Card header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-orange-500/10 bg-[#0a0d14]">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={isSelected} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); toggleSelect(act.id); }} className="accent-orange-500" />
                            <span className="text-[9px] font-mono text-orange-500/30">#{(page - 1) * ROWS_PER_PAGE + index + 1}</span>
                          </div>
                          {incompleteCount > 0
                            ? <div className="flex items-center gap-1 text-red-400"><AlertCircle className="h-3 w-3" /><span className="text-[9px] font-mono font-bold">{incompleteCount}</span></div>
                            : <div className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" /><span className="text-[9px] font-mono">OK</span></div>}
                        </div>
                        {/* Card body */}
                        <div className="p-3 space-y-1.5">
                          {columnVisibility.referenceid && act.referenceid && (
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40">Ref ID</span>
                              <span className="text-[10px] font-mono text-orange-400 font-semibold">{act.referenceid}</span>
                            </div>
                          )}
                          {columnVisibility.company_name && (
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40 shrink-0">Company</span>
                              <span className={cn("text-[10px] font-mono text-right truncate max-w-[160px]", isFieldIncomplete("company_name", act.company_name) ? "text-red-400" : "text-slate-200 font-semibold uppercase")}>{act.company_name || "—"}</span>
                            </div>
                          )}
                          {columnVisibility.contact_person && (
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40 shrink-0">Contact</span>
                              <span className={cn("text-[10px] font-mono text-right", isFieldIncomplete("contact_person", act.contact_person) ? "text-red-400" : "text-slate-300")}>{act.contact_person || "—"}</span>
                            </div>
                          )}
                          {columnVisibility.contact_number && (
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40 shrink-0">Phone</span>
                              <span className={cn("text-[10px] font-mono text-right", isFieldIncomplete("contact_number", act.contact_number) ? "text-red-400" : "text-slate-400")}>{act.contact_number || "—"}</span>
                            </div>
                          )}
                          {columnVisibility.email_address && (
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40 shrink-0">Email</span>
                              <span className={cn("text-[10px] font-mono text-right truncate max-w-[160px]", isFieldIncomplete("email_address", act.email_address) ? "text-red-400" : "text-slate-500")}>{act.email_address || "—"}</span>
                            </div>
                          )}
                          {columnVisibility.ticket_reference_number && (
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40">Ticket</span>
                              <span className={cn("text-[10px] font-mono", isFieldIncomplete("ticket_reference_number", act.ticket_reference_number) ? "text-red-400" : "text-slate-400")}>{act.ticket_reference_number || "—"}</span>
                            </div>
                          )}
                          {columnVisibility.status && (
                            <div className="flex items-center justify-between pt-1.5 border-t border-orange-500/10">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40">Status</span>
                              <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 uppercase tracking-widest border",
                                ["completed","resolved","done"].includes(act.status?.toLowerCase()) ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : ["pending","open","new"].includes(act.status?.toLowerCase()) ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : ["cancelled","closed"].includes(act.status?.toLowerCase()) ? "bg-red-500/10 text-red-400 border-red-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700")}>
                                {act.status || "N/A"}
                              </span>
                            </div>
                          )}
                          {columnVisibility.agent && (
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40">Agent</span>
                              <span className={cn("text-[10px] font-mono", isFieldIncomplete("agent", act.agent) ? "text-red-400" : "text-slate-400")} title={agentMap[act.agent] || act.agent}>{act.agent || "—"}</span>
                            </div>
                          )}
                          {columnVisibility.date_created && (
                            <div className="flex items-center justify-between pt-1.5 border-t border-orange-500/10">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40">Created</span>
                              <span className="text-[10px] font-mono text-slate-500">{formatDate(act.date_created)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Audit Panel ── */}
          {showAuditPanel ? (
            <div className="fixed right-4 bottom-4 z-50 w-60 border border-orange-500/20 bg-[#0d1117] shadow-2xl">
              <div className="flex items-center justify-between px-3 py-2 border-b border-orange-500/10 bg-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-orange-400">Audit Panel</span>
                </div>
                <button onClick={() => setShowAuditPanel(false)} className="text-slate-600 hover:text-red-400 text-sm leading-none">×</button>
              </div>
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {[{ label: "Total", value: activityStats.total, color: "text-orange-400" }, { label: "Completed", value: activityStats.completed, color: "text-emerald-400" }, { label: "Received", value: activityStats.received, color: "text-amber-400" }, { label: "Endorsed", value: activityStats.endorsed, color: "text-blue-400" }].map(({ label, value, color }) => (
                    <div key={label} className="border border-orange-500/10 bg-[#0a0d14] p-2 text-center">
                      <div className={cn("text-base font-mono font-bold", color)}>{value}</div>
                      <div className="text-[8px] font-mono uppercase tracking-widest text-orange-500/40">{label}</div>
                    </div>
                  ))}
                </div>
                {activityStats.incomplete > 0 && (
                  <button onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
                    className={cn("w-full p-2 text-left border transition-colors", showIncompleteOnly ? "border-red-500/50 bg-red-500/20" : "border-red-500/20 bg-red-500/5 hover:bg-red-500/10")}>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-red-400">Incomplete</span>
                      <span className="text-sm font-mono font-bold text-red-400">{activityStats.incomplete}</span>
                    </div>
                    <div className="text-[8px] font-mono text-red-400/50 mt-0.5">{showIncompleteOnly ? "Click to show all" : "Click to filter"}</div>
                  </button>
                )}
                <div className="text-[8px] font-mono text-orange-500/20 text-center border-t border-orange-500/10 pt-2">{new Date().toLocaleTimeString()}</div>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAuditPanel(true)}
              className="fixed right-4 bottom-4 z-50 w-11 h-11 border border-orange-500/20 bg-[#0d1117] hover:border-orange-500/40 shadow-lg flex items-center justify-center relative">
              <AlertCircle className="h-4 w-4 text-orange-400" />
              {activityStats.incomplete > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-mono font-bold flex items-center justify-center">
                  {activityStats.incomplete > 9 ? "9+" : activityStats.incomplete}
                </span>
              )}
            </button>
          )}
        </SidebarInset>
      </SidebarProvider>

      {/* ── Hold-to-Delete Dialog ── */}
      <Dialog open={showDeleteConfirm} onOpenChange={handleDeleteDialogClose}>
        <DialogContent className="max-w-md bg-[#0d1117] border-red-500/20 text-slate-100 rounded-none p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 border border-red-500/20"><AlertCircle className="w-4 h-4 text-red-400" /></div>
              <DialogTitle className="text-sm font-bold uppercase tracking-widest font-mono text-red-400">Hold to Delete</DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4">
            <p className="text-[11px] font-mono text-slate-400 leading-relaxed">Delete <span className="text-red-400 font-bold">{selectedIds.length}</span> selected activities. This cannot be undone.</p>
            <div className="space-y-2">
              <div className="h-1.5 border border-slate-700 bg-[#0a0d14] overflow-hidden">
                <div className="h-full bg-red-500 transition-all duration-75 ease-linear" style={{ width: `${deleteHoldProgress}%` }} />
              </div>
              <p className="text-[9px] font-mono text-slate-600 text-center uppercase tracking-widest">
                {isHoldingDelete ? `Holding… ${Math.round(deleteHoldProgress)}%` : `Press and hold for ${DELETE_HOLD_DURATION / 1000}s to confirm`}
              </p>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-end gap-2">
            <button onClick={() => handleDeleteDialogClose(false)}
              className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors">
              Cancel
            </button>
            <button onMouseDown={startDeleteHold} onMouseUp={stopDeleteHold} onMouseLeave={stopDeleteHold} onTouchStart={startDeleteHold} onTouchEnd={stopDeleteHold} onTouchCancel={stopDeleteHold}
              style={{ userSelect: "none", WebkitUserSelect: "none" }}
              className={cn("px-4 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors select-none",
                isHoldingDelete ? "bg-red-500 text-white border-red-500" : "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20")}>
              {isHoldingDelete ? <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Deleting… {Math.round(deleteHoldProgress)}%</span> : `Hold to Delete (${selectedIds.length})`}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Edit Dialog ── */}
      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent className="max-w-md bg-[#0d1117] border-orange-500/20 text-slate-100 rounded-none p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60">
            <DialogTitle className="text-sm font-bold uppercase tracking-widest font-mono text-orange-400">Bulk Edit</DialogTitle>
            <p className="text-[11px] text-slate-500 mt-0.5">{selectedIds.length} rows selected</p>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/50">Field to Edit</label>
              <select value={bulkEditField} onChange={(e) => setBulkEditField(e.target.value)}
                className="w-full h-9 text-xs font-mono bg-[#0a0d14] border border-slate-800 text-slate-300 px-2 focus:border-orange-500/50 focus:outline-none">
                <option value="">Select a field…</option>
                <option value="tsm">TSM</option>
                <option value="status">Status</option>
                <option value="agent">Agent</option>
                <option value="wrap_up">Wrap Up</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/50">New Value</label>
              <Input value={bulkEditValue} onChange={(e) => setBulkEditValue(e.target.value)} placeholder="Enter new value…"
                className="h-9 text-xs font-mono bg-[#0a0d14] border-slate-800 text-slate-300 placeholder:text-slate-700 focus:border-orange-500/40 rounded-none" />
            </div>
          </div>
          <div className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-end gap-2">
            <button onClick={() => setShowBulkEditDialog(false)}
              className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors">
              Cancel
            </button>
            <button onClick={handleBulkEdit} disabled={!bulkEditField || !bulkEditValue}
              className="px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-orange-500/30 bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Update {selectedIds.length} Rows
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 3-Column Edit Dialog ── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-[95vw] w-full bg-[#0d1117] border-orange-500/20 text-slate-100 rounded-none max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 border border-orange-500/20"><Ticket className="w-4 h-4 text-orange-400" /></div>
              <div>
                <DialogTitle className="text-sm font-bold uppercase tracking-widest font-mono text-orange-400">Edit Record</DialogTitle>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{editingActivity?.referenceid || editingActivity?.id}</p>
              </div>
            </div>
          </DialogHeader>

          {editingActivity && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-x divide-orange-500/10">

              {/* Col 1 — Incomplete */}
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-red-400">Counter Checking</h3>
                  <span className="ml-auto text-[9px] font-mono text-slate-600">{incompleteFieldKeys.filter((f) => isFieldIncomplete(f, editingActivity[f])).length} issues</span>
                </div>
                {incompleteFieldKeys.filter((f) => isFieldIncomplete(f, editingActivity[f])).map((f) => (
                  <div key={f} className="space-y-1">
                    <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-red-400 flex items-center gap-1">{f.replace(/_/g, " ")} <span className="text-red-500">*</span></label>
                    <Input value={(editFormData as any)[f] || ""} onChange={(e) => handleEditFormChange(f as keyof Activity, e.target.value)}
                      className="h-8 text-xs font-mono bg-slate-800 border-red-500/30 text-slate-200 focus:border-red-400 rounded-none placeholder:text-slate-600"
                      placeholder={`Enter ${f.replace(/_/g, " ")}…`} />
                  </div>
                ))}
                {incompleteFieldKeys.filter((f) => isFieldIncomplete(f, editingActivity[f])).length === 0 && (
                  <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-mono"><CheckCircle2 className="h-4 w-4" /> All fields complete</div>
                )}
              </div>

              {/* Col 2 — Complete */}
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">Complete Data</h3>
                  <span className="ml-auto text-[9px] font-mono text-slate-600">{incompleteFieldKeys.filter((f) => !isFieldIncomplete(f, editingActivity[f])).length} verified</span>
                </div>
                {incompleteFieldKeys.filter((f) => !isFieldIncomplete(f, editingActivity[f])).map((f) => (
                  <div key={f} className="space-y-1">
                    <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-400/70 flex items-center gap-1">{f.replace(/_/g, " ")} <CheckCircle2 className="h-2.5 w-2.5" /></label>
                    <Input value={(editFormData as any)[f] || ""} onChange={(e) => handleEditFormChange(f as keyof Activity, e.target.value)}
                      className="h-8 text-xs font-mono bg-slate-800 border-emerald-500/20 text-slate-200 focus:border-emerald-400 rounded-none" />
                  </div>
                ))}
                {/* Read-only + TSM */}
                <div className="pt-3 border-t border-orange-500/10 space-y-2">
                  {[{ label: "Reference ID", field: "referenceid", disabled: true }, { label: "TSM", field: "tsm", disabled: false }].map(({ label, field, disabled }) => (
                    <div key={field} className="space-y-1">
                      <label className="text-[9px] font-mono uppercase tracking-widest text-orange-500/40">{label}</label>
                      <Input value={(editFormData as any)[field] || ""} disabled={disabled} onChange={disabled ? undefined : (e) => handleEditFormChange(field as keyof Activity, e.target.value)}
                        className={cn("h-8 text-xs font-mono rounded-none", disabled ? "bg-slate-800/40 border-slate-700/50 text-slate-500" : "bg-slate-800 border-slate-700 text-slate-200 focus:border-orange-500/40")} />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    {[{ label: "Date Created", field: "date_created" }, { label: "Date Updated", field: "date_updated" }].map(({ label, field }) => (
                      <div key={field} className="space-y-1">
                        <label className="text-[9px] font-mono uppercase tracking-widest text-orange-500/40">{label}</label>
                        <Input value={formatDate((editFormData as any)[field] || "")} disabled className="h-8 text-[10px] font-mono bg-slate-800/40 border-slate-700/50 text-slate-500 rounded-none" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Col 3 — Ticket Creation */}
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-orange-500/20">
                  <Loader2 className={cn("h-4 w-4 text-orange-400", isLoadingActivity && "animate-spin")} />
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400">Ticket Creation</h3>
                  <span className="ml-auto text-[9px] font-mono text-slate-600">{activityData ? "Found" : "Not Found"}</span>
                </div>
                {isLoadingActivity ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-orange-500/40" /></div>
                ) : activityData ? (
                  [["Activity Ref #", activityData.activity_reference_number], ["Scheduled Date", activityData.scheduled_date ? new Date(activityData.scheduled_date).toLocaleDateString() : "N/A"], ["Company", activityData.company_name], ["Contact Person", activityData.contact_person], ["Contact Number", activityData.contact_number], ["Email", activityData.email_address], ["Address", activityData.address], ["Type Client", activityData.type_client], ["Status", activityData.status]].map(([label, value]) => (
                    <div key={label} className="space-y-0.5">
                      <label className="text-[9px] font-mono uppercase tracking-widest text-orange-500/50">{label}</label>
                      <Input value={value} disabled className="h-8 text-[10px] font-mono bg-slate-800/40 border-slate-700/50 text-slate-400 rounded-none" />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-6 w-6 text-slate-700 mx-auto mb-2" />
                    <p className="text-[10px] font-mono text-slate-600">No activity found for this ticket</p>
                    <p className="text-[9px] font-mono text-slate-700 mt-1">{editingActivity.ticket_reference_number || "N/A"}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-end gap-2">
            <button onClick={() => setShowEditDialog(false)}
              className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors">
              Cancel
            </button>
            <button onClick={handleSaveEdit}
              className="px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-orange-500/30 bg-orange-600 text-white hover:bg-orange-500 transition-colors">
              Save Changes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedPageWrapper>
  );
}
