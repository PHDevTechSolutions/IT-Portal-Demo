"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import { Loader2, Search, ClipboardList } from "lucide-react";
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
  id: string; activity_reference_number: string; referenceid: string; tsm: string;
  manager: string; type_client: string; project_name: string; product_category: string;
  project_type: string; source: string; target_quota: string; type_activity: string;
  callback: string; call_status: string; call_type: string; quotation_number: string;
  quotation_amount: string; so_number: string; so_amount: string; actual_sales: string;
  delivery_date: string; dr_number: string; ticket_reference_number: string; remarks: string;
  status: string; start_date: string; end_date: string; date_followup: string;
  date_site_visit: string; date_created: string; date_updated: string;
  account_reference_number: string; payment_terms: string; scheduled_status: string;
  product_quantity: string; product_amount: string; product_description: string;
  product_photo: string; product_sku: string; product_title: string; quotation_type: string;
  si_date: string; agent: string; tsm_approved_status: string; tsm_approved_remarks: string;
  tsm_approved_date: string; company_name: string; contact_person: string;
  contact_number: string; email_address: string; address: string; vat_type: string;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProgressLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortColumn, setSortColumn] = useState<string>("date_updated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    referenceid: true, tsm: true, manager: true, company_name: true, contact_person: true,
    contact_number: true, email_address: true, address: true, type_client: true,
    project_name: true, product_category: true, project_type: true, source: true,
    target_quota: true, type_activity: true, callback: true, call_status: true,
    call_type: true, quotation_number: true, quotation_amount: true, so_number: true,
    so_amount: true, actual_sales: true, delivery_date: true, dr_number: true,
    ticket_reference_number: true, remarks: true, status: true, start_date: true,
    end_date: true, date_followup: true, date_site_visit: true, account_reference_number: true,
    payment_terms: true, scheduled_status: true, product_quantity: true, product_amount: true,
    product_description: true, product_sku: true, product_title: true, quotation_type: true,
    si_date: true, agent: true, tsm_approved_status: true, tsm_approved_remarks: true,
    tsm_approved_date: true, vat_type: true, activity_reference_number: true,
    date_created: true, date_updated: true,
  });
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [fetchLimit, setFetchLimit] = useState(100);
  const [totalDbRows, setTotalDbRows] = useState(0);
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; field: string } | null>(null);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<string>("");
  const [bulkEditValue, setBulkEditValue] = useState("");
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Activity>>({});

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchActivities = async (limit?: number) => {
    setIsFetching(true);
    try {
      const maxRows = limit || fetchLimit;
      let queryParams = "";
      if (dateFrom && dateTo) {
        const days = Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24));
        queryParams = `?days=${days}`;
      }
      const res = await fetch(`/api/fetch-progress${queryParams}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to fetch progress logs");
      setTotalDbRows(result.count || result.activities?.length || 0);
      let data: Activity[] = result.activities || [];
      if (dateFrom) data = data.filter((a) => a.date_created >= dateFrom);
      if (dateTo) data = data.filter((a) => a.date_created <= dateTo + "T23:59:59");
      data.sort((a, b) => new Date(b.date_updated || b.date_created || 0).getTime() - new Date(a.date_updated || a.date_created || 0).getTime());
      setAllActivities(data);
      setActivities(data.slice(0, maxRows));
      toast.success(`Loaded ${Math.min(data.length, maxRows)} of ${data.length} progress logs`);
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`);
      setActivities([]);
    }
    setIsFetching(false);
  };

  const handleFetchMore = () => {
    const next = fetchLimit === 100 ? 2100 : fetchLimit === 2100 ? 7100 : fetchLimit + 5000;
    setFetchLimit(next); fetchActivities(next);
    toast.success(`Fetching up to ${next.toLocaleString()} rows…`);
  };

  useEffect(() => { fetchActivities(); }, []);
  useEffect(() => { fetchActivities(); }, [dateFrom, dateTo]);
  useEffect(() => { setStatusOptions([...new Set(activities.map((a) => a.status).filter(Boolean))].sort()); }, [activities]);
  useEffect(() => { setPage(1); }, [dateFrom, dateTo, search, statusFilter, rowsPerPage]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const filteredActivities = useMemo(() => {
    let r = search.trim() ? allActivities : activities;
    if (statusFilter) r = r.filter((a) => a.status?.toLowerCase() === statusFilter.toLowerCase());
    if (!search.trim()) return r;
    const q = search.toLowerCase();
    return r.filter((a) => [a.id, a.referenceid, a.activity_reference_number, a.ticket_reference_number, a.account_reference_number, a.tsm, a.manager, a.agent, a.company_name, a.contact_person, a.contact_number, a.email_address, a.address, a.type_client, a.vat_type, a.project_name, a.product_category, a.project_type, a.source, a.type_activity, a.target_quota, a.call_status, a.call_type, a.quotation_number, a.quotation_amount, a.quotation_type, a.so_number, a.so_amount, a.actual_sales, a.dr_number, a.payment_terms, a.scheduled_status, a.product_sku, a.product_title, a.product_quantity, a.product_amount, a.product_description, a.status, a.remarks, a.tsm_approved_status, a.tsm_approved_remarks].filter(Boolean).some((f) => String(f).toLowerCase().includes(q)));
  }, [activities, allActivities, search, statusFilter]);

  const sortedActivities = useMemo(() => {
    if (!sortColumn) return filteredActivities;
    return [...filteredActivities].sort((a, b) => {
      const av = a[sortColumn as keyof Activity] || ""; const bv = b[sortColumn as keyof Activity] || "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredActivities, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedActivities.length / rowsPerPage));
  const paginatedActivities = useMemo(() => sortedActivities.slice((page - 1) * rowsPerPage, page * rowsPerPage), [sortedActivities, page, rowsPerPage]);

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

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : "N/A";

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleEditClick = (a: Activity) => { setEditingActivity(a); setEditFormData({ ...a }); setShowEditDialog(true); };
  const handleEditFormChange = (field: keyof Activity, value: string) => setEditFormData((prev) => ({ ...prev, [field]: value }));
  const handleSaveEdit = async () => {
    if (!editingActivity) return;
    const { error } = await supabase.from("history").update(editFormData).eq("id", editingActivity.id);
    if (error) { toast.error("Failed to update progress log"); return; }
    toast.success("Progress log updated"); setShowEditDialog(false); setEditingActivity(null); await fetchActivities();
  };

  const exportToCSV = () => {
    const headers = Object.keys(columnVisibility).filter((k) => columnVisibility[k]);
    const csv = [headers.join(","), ...paginatedActivities.map((row) => headers.map((h) => { const v = String(row[h as keyof Activity] || ""); return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v; }).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `progress-logs-${new Date().toISOString().split("T")[0]}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleSort = (col: string) => { if (sortColumn === col) setSortDirection((d) => d === "asc" ? "desc" : "asc"); else { setSortColumn(col); setSortDirection("asc"); } };
  const toggleColumnVisibility = (col: string) => setColumnVisibility((prev) => ({ ...prev, [col]: !prev[col] }));

  const handleBulkEdit = async () => {
    if (!selectedIds.length || !bulkEditField) return;
    const { error } = await supabase.from("history").update({ [bulkEditField]: bulkEditValue }).in("id", selectedIds);
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
  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const { error } = await supabase.from("history").delete().in("id", selectedIds);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success(`${selectedIds.length} records deleted`);
    setSelectedIds([]); setShowDeleteConfirm(false); fetchActivities();
  };

  // ── Edit field helper ──────────────────────────────────────────────────────
  const EditField = ({ label, field, type = "text", colSpan = false }: { label: string; field: keyof Activity; type?: string; colSpan?: boolean }) => (
    <div className={cn("space-y-1", colSpan && "col-span-2")}>
      <label className="text-[9px] font-mono uppercase tracking-widest text-orange-500/50">{label}</label>
      <Input type={type} value={(editFormData as any)[field] || ""} onChange={(e) => handleEditFormChange(field, e.target.value)}
        className="h-8 text-xs font-mono bg-[#0a0d14] border-slate-800 text-slate-300 focus:border-orange-500/40 rounded-none placeholder:text-slate-700" />
    </div>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <h4 className="text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/50 border-b border-orange-500/10 pb-1 mb-2 col-span-2">{title}</h4>
  );

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
                    <BreadcrumbPage className="text-orange-400 font-mono tracking-widest uppercase text-xs flex items-center gap-2">
                      Progress Logs
                      {search.trim() && <span className="text-[9px] px-1.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/30 font-mono">{filteredActivities.length}/{activities.length}</span>}
                    </BreadcrumbPage>
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
                  <ClipboardList className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <h1 className="text-sm font-bold tracking-widest uppercase text-orange-400 font-mono leading-tight">Progress Logs</h1>
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
              <div className="relative min-w-[200px] max-w-xs flex-1">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-600" />
                <Input placeholder="Search all fields…" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 h-9 text-xs bg-[#0d1117] border-slate-800 text-slate-300 placeholder:text-slate-700 focus:border-orange-500/40 rounded-none font-mono" />
                {isFetching && <Loader2 className="absolute right-2 top-2.5 h-3.5 w-3.5 animate-spin text-orange-500/50" />}
              </div>

              {/* Calendar date range */}
              <Calendar startDate={dateFrom} endDate={dateTo} setStartDateAction={setDateFrom} setEndDateAction={setDateTo} />

              {/* Filters */}
              <button onClick={() => setShowFilterDialog(true)}
                className={cn("inline-flex items-center gap-1.5 h-9 px-3 text-[10px] font-mono uppercase tracking-widest border transition-colors",
                  statusFilter ? "border-orange-500/40 bg-orange-500/5 text-orange-400" : "border-slate-800 bg-[#0d1117] text-slate-400 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300")}>
                Filters {statusFilter && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
              </button>

              {/* Export */}
              <button onClick={exportToCSV}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-[10px] font-mono uppercase tracking-widest border border-slate-800 bg-[#0d1117] text-slate-400 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300 transition-colors">
                Export CSV
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
                  <span className="text-[10px] font-mono uppercase tracking-widest text-orange-500/30">Loading progress logs…</span>
                </div>
              ) : paginatedActivities.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <div className="relative p-3 border border-orange-500/20 bg-orange-500/5">
                    <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-orange-500/30" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-orange-500/30" />
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/30" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/30" />
                    <ClipboardList className="size-5 text-orange-500/30" />
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-orange-500/30">No progress logs found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {paginatedActivities.map((act, index) => {
                    const isSelected = selectedIds.includes(act.id);
                    return (
                      <div key={`${act.id}-${index}`} onClick={() => handleEditClick(act)}
                        className={cn("border transition-colors cursor-pointer",
                          isSelected ? "border-orange-500/40 bg-orange-500/[0.06]" : "border-orange-500/10 bg-[#0d1117] hover:border-orange-500/30 hover:bg-orange-500/[0.03]")}>
                        {/* Card header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-orange-500/10 bg-[#0a0d14]">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={isSelected} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); toggleSelect(act.id); }} className="accent-orange-500" />
                            <span className="text-[9px] font-mono text-orange-500/30">#{(page - 1) * rowsPerPage + index + 1}</span>
                          </div>
                        </div>
                        {/* Card body */}
                        <div className="p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono uppercase text-orange-500/40">Activity Ref</span>
                            <span className="text-[10px] font-mono text-orange-400 font-semibold">{act.activity_reference_number || "—"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono uppercase text-orange-500/40">Ticket Ref</span>
                            <span className="text-[10px] font-mono text-slate-400">{act.ticket_reference_number || "—"}</span>
                          </div>
                          {columnVisibility.company_name && (
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40 shrink-0">Company</span>
                              <span className="text-[10px] font-mono text-slate-200 font-semibold uppercase text-right truncate max-w-[160px]">{act.company_name || "—"}</span>
                            </div>
                          )}
                          {columnVisibility.contact_person && (
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40 shrink-0">Contact</span>
                              <span className="text-[10px] font-mono text-slate-300 text-right">{act.contact_person || "—"}</span>
                            </div>
                          )}
                          {columnVisibility.contact_number && (
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40 shrink-0">Phone</span>
                              <span className="text-[10px] font-mono text-slate-400 text-right">{act.contact_number || "—"}</span>
                            </div>
                          )}
                          {columnVisibility.email_address && (
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40 shrink-0">Email</span>
                              <span className="text-[10px] font-mono text-slate-500 text-right truncate max-w-[160px]">{act.email_address || "—"}</span>
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
                          {columnVisibility.tsm && (
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40">TSM</span>
                              <span className="text-[10px] font-mono text-slate-400">{act.tsm || "—"}</span>
                            </div>
                          )}
                          {columnVisibility.manager && (
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40">Manager</span>
                              <span className="text-[10px] font-mono text-slate-400">{act.manager || "—"}</span>
                            </div>
                          )}
                          {columnVisibility.date_created && (
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono uppercase text-orange-500/40">Date</span>
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

          {/* ── Delete Dialog ── */}
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent className="max-w-md bg-[#0d1117] border-red-500/20 text-slate-100 rounded-none p-0 gap-0">
              <DialogHeader className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 border border-red-500/20">
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <DialogTitle className="text-sm font-bold uppercase tracking-widest font-mono text-red-400">Confirm Delete</DialogTitle>
                </div>
              </DialogHeader>
              <div className="px-5 py-4">
                <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                  You are about to delete <span className="text-red-400 font-bold">{selectedIds.length}</span> progress log records. This action cannot be undone.
                </p>
              </div>
              <div className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-end gap-2">
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors">
                  Cancel
                </button>
                <button onClick={handleBulkDelete}
                  className="px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                  Delete ({selectedIds.length})
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
                    <option value="manager">Manager</option>
                    <option value="status">Status</option>
                    <option value="agent">Agent</option>
                    <option value="type_client">Type Client</option>
                    <option value="call_status">Call Status</option>
                    <option value="tsm_approved_status">TSM Approved Status</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/50">New Value</label>
                  <Input value={bulkEditValue} onChange={(e) => setBulkEditValue(e.target.value)} placeholder="Enter new value…"
                    className="h-9 text-xs font-mono bg-[#0a0d14] border-slate-800 text-slate-300 placeholder:text-slate-700 focus:border-orange-500/40 rounded-none" />
                </div>
                <p className="text-[9px] font-mono text-slate-600">Updates <span className="text-orange-400 font-bold">{selectedIds.length}</span> selected records.</p>
              </div>
              <div className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-end gap-2">
                <button onClick={() => setShowBulkEditDialog(false)}
                  className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors">
                  Cancel
                </button>
                <button onClick={handleBulkEdit} disabled={!bulkEditField || !bulkEditValue}
                  className="px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-orange-500/30 bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  Update {selectedIds.length} Records
                </button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ── Edit Dialog ── */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-3xl w-full bg-[#0d1117] border-orange-500/20 text-slate-100 rounded-none max-h-[90vh] overflow-y-auto p-0 gap-0">
              <DialogHeader className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 border border-orange-500/20"><ClipboardList className="w-4 h-4 text-orange-400" /></div>
                  <div>
                    <DialogTitle className="text-sm font-bold uppercase tracking-widest font-mono text-orange-400">Edit Progress Log</DialogTitle>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[400px]">{editingActivity?.company_name || editingActivity?.id}</p>
                  </div>
                </div>
              </DialogHeader>

              {editingActivity && (
                <div className="px-5 py-4 space-y-5">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <SectionHeader title="Basic Information" />
                    <EditField label="Reference ID" field="referenceid" />
                    <EditField label="Activity Ref" field="activity_reference_number" />
                    <EditField label="Ticket Ref" field="ticket_reference_number" />
                    <EditField label="Account Ref" field="account_reference_number" />
                  </div>

                  {/* Client Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <SectionHeader title="Client Information" />
                    <EditField label="Company Name" field="company_name" />
                    <EditField label="Contact Person" field="contact_person" />
                    <EditField label="Contact Number" field="contact_number" />
                    <EditField label="Email Address" field="email_address" />
                    <EditField label="Address" field="address" colSpan />
                    <EditField label="Type Client" field="type_client" />
                    <EditField label="VAT Type" field="vat_type" />
                  </div>

                  {/* Project Details */}
                  <div className="grid grid-cols-2 gap-3">
                    <SectionHeader title="Project Details" />
                    <EditField label="Project Name" field="project_name" />
                    <EditField label="Product Category" field="product_category" />
                    <EditField label="Project Type" field="project_type" />
                    <EditField label="Source" field="source" />
                    <EditField label="Type Activity" field="type_activity" />
                    <EditField label="Target Quota" field="target_quota" />
                    <EditField label="Start Date" field="start_date" type="date" />
                    <EditField label="End Date" field="end_date" type="date" />
                  </div>

                  {/* Call Details */}
                  <div className="grid grid-cols-2 gap-3">
                    <SectionHeader title="Call Details" />
                    <EditField label="Call Status" field="call_status" />
                    <EditField label="Call Type" field="call_type" />
                    <EditField label="Callback" field="callback" type="date" />
                    <EditField label="Date Followup" field="date_followup" type="date" />
                    <EditField label="Date Site Visit" field="date_site_visit" type="date" />
                  </div>

                  {/* Quotation & Sales */}
                  <div className="grid grid-cols-2 gap-3">
                    <SectionHeader title="Quotation & Sales" />
                    <EditField label="Quotation Number" field="quotation_number" />
                    <EditField label="Quotation Amount" field="quotation_amount" />
                    <EditField label="Quotation Type" field="quotation_type" />
                    <EditField label="SO Number" field="so_number" />
                    <EditField label="SO Amount" field="so_amount" />
                    <EditField label="Actual Sales" field="actual_sales" />
                  </div>

                  {/* Delivery */}
                  <div className="grid grid-cols-2 gap-3">
                    <SectionHeader title="Delivery Information" />
                    <EditField label="Delivery Date" field="delivery_date" type="date" />
                    <EditField label="DR Number" field="dr_number" />
                    <EditField label="SI Date" field="si_date" type="date" />
                    <EditField label="Payment Terms" field="payment_terms" />
                    <EditField label="Scheduled Status" field="scheduled_status" />
                  </div>

                  {/* Product */}
                  <div className="grid grid-cols-2 gap-3">
                    <SectionHeader title="Product Details" />
                    <EditField label="Product SKU" field="product_sku" />
                    <EditField label="Product Title" field="product_title" />
                    <EditField label="Product Qty" field="product_quantity" />
                    <EditField label="Product Amount" field="product_amount" />
                    <EditField label="Product Description" field="product_description" colSpan />
                  </div>

                  {/* Assignment */}
                  <div className="grid grid-cols-2 gap-3">
                    <SectionHeader title="Assignment" />
                    <EditField label="TSM" field="tsm" />
                    <EditField label="Manager" field="manager" />
                    <EditField label="Agent" field="agent" />
                    <EditField label="Status" field="status" />
                  </div>

                  {/* TSM Approval */}
                  <div className="grid grid-cols-2 gap-3">
                    <SectionHeader title="TSM Approval" />
                    <EditField label="Approved Status" field="tsm_approved_status" />
                    <EditField label="Approved Date" field="tsm_approved_date" type="date" />
                    <EditField label="Approved Remarks" field="tsm_approved_remarks" colSpan />
                  </div>

                  {/* Remarks */}
                  <div className="grid grid-cols-2 gap-3">
                    <SectionHeader title="Remarks" />
                    <EditField label="Remarks" field="remarks" colSpan />
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

          {/* ── Filter Dialog ── */}
          <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
            <DialogContent className="max-w-2xl bg-[#0d1117] border-orange-500/20 text-slate-100 rounded-none max-h-[80vh] overflow-y-auto p-0 gap-0">
              <DialogHeader className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60 sticky top-0 z-10">
                <DialogTitle className="text-sm font-bold uppercase tracking-widest font-mono text-orange-400">Filters & Options</DialogTitle>
              </DialogHeader>

              <div className="px-5 py-4 space-y-5">
                {/* Fetch more banner */}
                {activities.length < totalDbRows && (
                  <div className="border border-orange-500/20 bg-orange-500/5 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-mono text-orange-400">Showing {activities.length.toLocaleString()} of {totalDbRows.toLocaleString()} records</p>
                      <p className="text-[9px] font-mono text-slate-600 mt-0.5">{activities.length === 100 ? "Initial load: 100 records" : `Fetched ${fetchLimit.toLocaleString()} rows`}</p>
                    </div>
                    <button onClick={() => { handleFetchMore(); setShowFilterDialog(false); }}
                      className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors shrink-0">
                      {activities.length === 100 ? "Fetch 2K" : "Fetch 5K more"}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Left — Filters */}
                  <div className="space-y-4">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/50 border-b border-orange-500/10 pb-2">Filters</p>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-mono uppercase tracking-widest text-orange-500/40">Status</label>
                      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full h-9 text-xs font-mono bg-[#0a0d14] border border-slate-800 text-slate-300 px-2 focus:border-orange-500/50 focus:outline-none">
                        <option value="">All Statuses</option>
                        {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {statusFilter && (
                      <button onClick={() => setStatusFilter("")}
                        className="w-full h-9 text-[9px] font-mono uppercase tracking-widest border border-slate-700 text-slate-500 hover:border-orange-500/30 hover:text-orange-400 transition-colors">
                        Clear Filter
                      </button>
                    )}
                  </div>

                  {/* Right — Sort & Display */}
                  <div className="space-y-4">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/50 border-b border-orange-500/10 pb-2">Sort & Display</p>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-mono uppercase tracking-widest text-orange-500/40">Sort By</label>
                      <select value={sortColumn} onChange={(e) => setSortColumn(e.target.value)}
                        className="w-full h-9 text-xs font-mono bg-[#0a0d14] border border-slate-800 text-slate-300 px-2 focus:border-orange-500/50 focus:outline-none">
                        {["date_updated","date_created","referenceid","company_name","contact_person","status","tsm","manager","ticket_reference_number","activity_reference_number"].map((c) => (
                          <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-mono uppercase tracking-widest text-orange-500/40">Direction</label>
                      <div className="flex gap-2">
                        {(["asc","desc"] as const).map((d) => (
                          <button key={d} onClick={() => setSortDirection(d)}
                            className={cn("flex-1 h-9 text-[9px] font-mono uppercase tracking-widest border transition-colors",
                              sortDirection === d ? "border-orange-500/40 bg-orange-500/10 text-orange-400" : "border-slate-800 bg-[#0a0d14] text-slate-500 hover:border-orange-500/30 hover:text-orange-400")}>
                            {d === "asc" ? "ASC ↑" : "DESC ↓"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-mono uppercase tracking-widest text-orange-500/40">Rows Per Page</label>
                      <div className="flex gap-2">
                        {[10, 20, 50, 100].map((n) => (
                          <button key={n} onClick={() => { setRowsPerPage(n); setPage(1); }}
                            className={cn("flex-1 h-9 text-[9px] font-mono uppercase tracking-widest border transition-colors",
                              rowsPerPage === n ? "border-orange-500/40 bg-orange-500/10 text-orange-400" : "border-slate-800 bg-[#0a0d14] text-slate-500 hover:border-orange-500/30 hover:text-orange-400")}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column visibility */}
                <div className="space-y-3 border-t border-orange-500/10 pt-4">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/50">Column Visibility</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.keys(columnVisibility).map((col) => (
                      <label key={col} className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={columnVisibility[col]} onChange={() => toggleColumnVisibility(col)} className="accent-orange-500" />
                        <span className="text-[10px] font-mono text-slate-400 group-hover:text-orange-400 capitalize transition-colors">{col.replace(/_/g, " ")}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex justify-end">
                <button onClick={() => setShowFilterDialog(false)}
                  className="px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-orange-500/30 bg-orange-600 text-white hover:bg-orange-500 transition-colors">
                  Close
                </button>
              </div>
            </DialogContent>
          </Dialog>

        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
