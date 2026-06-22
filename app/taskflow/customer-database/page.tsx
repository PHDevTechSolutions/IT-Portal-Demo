"use client";

import React, {
  useEffect, useState, useMemo, useRef, useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as ExcelJS from "exceljs";
import {
  useCustomers, useBulkDelete, useBulkTransfer,
  useUpdateReferenceNumbers, useImportCustomers,
} from "@/lib/hooks/useCustomers";
import { useAuditLogging } from "@/lib/hooks/useAuditLogging";
import {
  SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Pagination } from "@/components/app-pagination";
import { Download } from "@/components/taskflow/customer-database/download";
import { Audit } from "@/components/taskflow/customer-database/audit";
import { Calendar } from "@/components/taskflow/customer-database/calendar";
import { AuditDialog } from "@/components/taskflow/customer-database/audit-dialog";
import { DeleteDialog } from "@/components/taskflow/customer-database/delete";
import { TransferDialog } from "@/components/taskflow/customer-database/transfer";
import { toast } from "sonner";
import {
  Loader2, Search, ArrowRight, Check, ChevronsUpDown,
  FileSpreadsheet, Upload, X, RotateCcw, Download as DownloadIcon,
  BadgeCheck, AlertTriangle, Clock, XCircle, PauseCircle,
  UserX, UserCheck, Hash, SlidersHorizontal, Terminal, Settings,
  ExternalLink, ChevronRight,
  Sparkles, TrendingUp, Lightbulb, BarChart3, ChevronDown, ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { cn } from "@/lib/utils";
import {
  logCustomerAudit, type AuditActor, type TransferDetail,
} from "@/lib/audit/customer-audit";
import type { TransferSuccessPayload } from "@/components/taskflow/customer-database/transfer";

/* ─── Types ──────────────────────────────────────────────────────── */

type AuditKey = "duplicates" | "missingType" | "missingStatus";

interface Customer {
  id: number;
  account_reference_number: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  delivery_address?: string;
  region: string;
  province?: string;
  city?: string;
  type_client: string;
  type?: string;
  referenceid: string;
  tsm: string;
  manager: string;
  status: string;
  remarks: string;
  industry?: string;
  gender?: string;
  company_group?: string;
  date_created: string;
  date_updated: string;
  next_available_date?: string;
  date_transferred?: string;
  date_approved?: string;
  date_removed?: string;
  transfer_to?: string;
  it_approved_date?: string;
}

interface UserRecord {
  referenceId: string; name: string; status: string;
}

interface ComboOption {
  value: string; label: string;
}

const INACTIVE_STATUSES = ["Terminated", "Resigned", "Inactive"];
const AUDIT_PAGE = "Customer Database";

/* ─── Helpers ────────────────────────────────────────────────────── */

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

// ── Module-level user name cache — fetched once per session, 10 min TTL ──
const _userCache: { map: Map<string, UserRecord> | null; ts: number } = { map: null, ts: 0 };
const USER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function fetchUserNameMap(): Promise<Map<string, UserRecord>> {
  const now = Date.now();
  if (_userCache.map && (now - _userCache.ts) < USER_CACHE_TTL_MS) {
    return _userCache.map;
  }
  const map = new Map<string, UserRecord>();
  try {
    const res  = await fetch("/api/UserManagement/Fetch", { cache: "default" });
    if (!res.ok) return map;
    const data = await safeJson(res);
    const users: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    for (const u of users) {
      const refId = (u.ReferenceID ?? "").trim();
      if (!refId) continue;
      map.set(refId.toLowerCase(), {
        referenceId: refId,
        name:   `${u.Firstname ?? ""} ${u.Lastname ?? ""}`.trim() || refId,
        status: u.Status ?? "",
      });
    }
    _userCache.map = map;
    _userCache.ts  = now;
  } catch { /* return whatever we have */ }
  return map;
}

async function parseExcelForFile(
  file: File, tsaValue: string, managerValue: string, tsmValue: string,
): Promise<any[]> {
  const reader = new FileReader();
  return new Promise<any[]>((resolve, reject) => {
    reader.onload = async (event) => {
      try {
        const data = event.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);
        const ws = workbook.worksheets[0];
        const parsed: any[] = [];

        // ── Build header map from row 1 ──────────────────────────────────
        // Supports both header-based (any order) and positional (legacy) formats
        const headers: string[] = [];
        const headerRow = ws.getRow(1);
        headerRow.eachCell((cell, col) => {
          headers[col] = String(cell.value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
        });

        const hasHeaders = headers.some(h => [
          "company_name","contact_person","referenceid","tsm","manager",
          "status","type_client","region","address",
        ].includes(h));

        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // skip header

          const get = (colName: string): any => {
            if (hasHeaders) {
              const idx = headers.indexOf(colName);
              return idx >= 0 ? row.getCell(idx).value : undefined;
            }
            return undefined;
          };
          // Positional fallback (legacy template — 11 columns)
          const pos = (n: number): any => row.getCell(n).value;

          // Helper: prefer header value, fallback to positional
          const v = (headerName: string, posCol: number): any =>
            hasHeaders ? get(headerName) : pos(posCol);

          const cellDate = (headerName: string): any => {
            const val = hasHeaders ? get(headerName) : undefined;
            return val instanceof Date ? val.toISOString() : val ? String(val) : undefined;
          };

          const record: any = {
            // Core fields — injected from dropdowns if not in file
            referenceid:      s(get("referenceid"))      || tsaValue  || "",
            manager:          s(get("manager"))           || managerValue || "",
            tsm:              s(get("tsm"))               || tsmValue  || "",

            // Required
            company_name:     s(v("company_name",     1)) || "",
            contact_person:   s(v("contact_person",   2)) || "",
            contact_number:   s(v("contact_number",   3)) || "",
            email_address:    s(v("email_address",    4)) || "",
            type_client:      s(v("type_client",      5)) || "",
            address:          s(v("address",          6)) || "",
            region:           s(v("region",           7)) || "",
            status:           s(v("status",           8)) || "Active",
            company_group:    s(v("company_group",    9)) || "",
            delivery_address: s(v("delivery_address", 10)) || "",
            industry:         s(v("industry",         11)) || "",

            // Extended columns (header-based only)
            remarks:               s(get("remarks")),
            gender:                s(get("gender")),
            type:                  s(get("type")),
            account_reference_number: s(get("account_reference_number")),
            date_transferred:      cellDate("date_transferred"),
            province:              s(get("province")),
            city:                  s(get("city")),
            date_approved:         cellDate("date_approved"),
            date_removed:          cellDate("date_removed"),
            transfer_to:           s(get("transfer_to")),
            tin_number:            s(get("tin_number")),
            reason:                s(get("reason")),
            it_approved_date:      cellDate("it_approved_date"),
            next_available_date:   cellDate("next_available_date"),
            date_created:          cellDate("date_created"),
            date_updated:          cellDate("date_updated"),
          };

          // Skip completely empty rows
          if (!record.company_name && !record.email_address && !record.contact_person) return;

          parsed.push(record);
        });
        resolve(parsed);
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

/** Trim + null-coerce helper (used above) */
function s(v: any): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

async function parseExcelForBulkUpdate(file: File): Promise<{ data: any[], columns: string[] }> {
  const reader = new FileReader();
  return new Promise<{ data: any[], columns: string[] }>((resolve, reject) => {
    reader.onload = async (event) => {
      try {
        const data = event.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);
        const ws = workbook.worksheets[0];
        const parsed: any[] = [];
        const columns: string[] = [];
        
        // Get header row
        const headerRow = ws.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
          const headerValue = cell.value?.toString().trim().toLowerCase();
          if (headerValue) {
            columns.push(headerValue);
          }
        });

        // Parse data rows
        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowData: any = {};
          row.eachCell((cell, colNumber) => {
            const header = columns[colNumber - 1];
            if (header) {
              rowData[header] = cell.value || "";
            }
          });
          if (Object.keys(rowData).length > 0) {
            parsed.push(rowData);
          }
        });

        resolve({ data: parsed, columns });
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

/* ─── Combobox ───────────────────────────────────────────────────── */

function Combobox({ options, value, onValueChange, placeholder = "Select…", disabled = false, emptyText = "No results.", className }: {
  options: ComboOption[]; value: string; onValueChange: (value: string) => void;
  placeholder?: string; disabled?: boolean; emptyText?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
          className={cn("w-full justify-between font-normal h-9 text-xs rounded-none", !selected && "text-muted-foreground", className)}>
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 min-w-[220px]" align="start">
        <Command>
          <CommandInput placeholder="Search…" className="h-9 text-xs" />
          <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">{emptyText}</CommandEmpty>
          <CommandGroup className="max-h-56 overflow-auto">
            {options.map(opt => (
              <CommandItem key={opt.value} value={opt.label}
                onSelect={() => { onValueChange(opt.value === value ? "" : opt.value); setOpen(false); }}
                className="text-xs">
                <Check className={cn("mr-2 h-4 w-4 flex-shrink-0", value === opt.value ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{opt.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ─── DropZone ───────────────────────────────────────────────────── */

function DropZone({ file, fileName, onFileSelect, onClear, disabled }: {
  file: File | null; fileName: string | null;
  onFileSelect: (file: File) => void; onClear: () => void; disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) onFileSelect(f);
  };
  return (
    <div onDragOver={e => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn("relative border-2 border-dashed rounded-none p-5 text-center cursor-pointer transition-all select-none",
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
        disabled && "opacity-50 pointer-events-none",
        file && "border-primary/40 bg-primary/5")}>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" disabled={disabled}
        onChange={e => e.target.files?.[0] && onFileSelect(e.target.files[0])} />
      {file ? (
        <div className="flex flex-col items-center gap-1.5">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <p className="text-xs font-medium text-foreground truncate max-w-[180px]">{fileName}</p>
          <p className="text-[10px] text-muted-foreground">Click to replace or drag a new file</p>
          <Button type="button" variant="ghost" size="sm" className="absolute top-1.5 right-1.5 h-6 w-6 p-0"
            onClick={e => { e.stopPropagation(); onClear(); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-xs font-semibold">Drag & drop an Excel file</p>
          <p className="text-[10px] text-muted-foreground">or click to browse (.xlsx, .xls)</p>
        </div>
      )}
    </div>
  );
}

/* ─── StatusBadge ────────────────────────────────────────────────── */

function StatusBadge({ status }: { status?: string | null }) {
  const s = (status ?? "").trim().toLowerCase();
  const base = "rounded-none px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest border transition-colors";
  const ops  = "border-orange-500/20 text-orange-500/60 hover:border-orange-500/50 hover:text-orange-400 hover:bg-orange-500/10 bg-orange-500/10";
  if (!s) return <Badge variant="outline" className={cn(base, ops)}>—</Badge>;
  if (s === "active") return <Badge variant="secondary" className={cn(base, "gap-1 border-green-500/20 text-green-500/60 hover:border-green-500/50 hover:text-green-400 hover:bg-green-500/10 bg-green-500/10")}><BadgeCheck className="size-3.5" /> Active</Badge>;
  if (s === "removed") return <Badge variant="secondary" className={cn(base, "gap-1 border-red-500/20 text-red-500/60 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 bg-red-500/10")}><UserCheck className="size-3.5" /> Removed</Badge>;
  if (s === "subject for transfer") return <Badge variant="secondary" className={cn(base, "gap-1 border-yellow-500/20 text-yellow-500/60 hover:bg-yellow-500/10 bg-yellow-500/10")}><AlertTriangle className="size-3.5" /> Subject for Transfer</Badge>;
  if (s === "for approval") return <Badge variant="secondary" className={cn(base, "gap-1 border-blue-500/20 text-blue-500/60 hover:bg-blue-500/10 bg-blue-500/10")}><XCircle className="size-3.5" /> For Approval</Badge>;
  if (s === "on hold") return <Badge variant="secondary" className={cn(base, ops)}><PauseCircle className="size-3.5 mr-1" /> On Hold</Badge>;
  if (s === "used") return <Badge variant="secondary" className={cn(base, ops)}><Clock className="size-3.5 mr-1" /> Used</Badge>;
  if (s === "park") return <Badge variant="secondary" className={cn(base, ops)}><PauseCircle className="size-3.5 mr-1" /> Parked</Badge>;
  if (s === "for deletion" || s === "remove") return <Badge variant="secondary" className={cn(base, ops)}><UserX className="size-3.5 mr-1" /> {status}</Badge>;
  return <Badge variant="outline" className={cn(base, ops)}>{status}</Badge>;
}

/* ─── Main Page ──────────────────────────────────────────────────── */

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ── React Query ── */
  const { data: customersData, isLoading: isFetching, error: customersError } = useCustomers();
  const bulkDeleteMutation           = useBulkDelete();
  const bulkTransferMutation         = useBulkTransfer();
  const updateReferenceNumbersMutation = useUpdateReferenceNumbers();
  const importCustomersMutation      = useImportCustomers();

  /* ── Table state ── */
  const [customers,      setCustomers]      = useState<Customer[]>([]);
  const [search,         setSearch]         = useState("");
  const [filterTSA,      setFilterTSA]      = useState("all");
  const [filterTSM,      setFilterTSM]      = useState("all");
  const [filterManager,  setFilterManager]  = useState("all");
  const [filterType,     setFilterType]     = useState("all");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [page,           setPage]           = useState(1);
  const [rowsPerPage,    setRowsPerPage]     = useState(20);
  const [sortOrder,      setSortOrder]      = useState<"asc"|"desc">("desc");
  const [startDate,      setStartDate]      = useState("");
  const [endDate,        setEndDate]        = useState("");
  const [isFiltering,    setIsFiltering]    = useState(false);

  /* ── Audit state ── */
  const [audited,        setAudited]        = useState<Customer[]>([]);
  const [isAuditView,    setIsAuditView]    = useState(false);
  const [duplicateIds,   setDuplicateIds]   = useState<Set<number>>(new Set());
  const [auditFilter,    setAuditFilter]    = useState<""|"all"|"missingType"|"missingStatus"|"duplicates">("");
  const [showAuditDialog,setShowAuditDialog]= useState(false);

  /* ── Ref ID map ── */
  const [refIdUserMap,   setRefIdUserMap]   = useState<Map<string, UserRecord>>(new Map());

  /* ── Selection ── */
  const [showDeleteDialog,setShowDeleteDialog] = useState(false);
  const [selectedIds,     setSelectedIdsAction]= useState<Set<number>>(new Set());
  const [selectAll,       setSelectAll]        = useState(false);

  /* ── Transfer ── */
  const [tsas,    setTsas]    = useState<ComboOption[]>([]);
  const [tsms,    setTsms]    = useState<ComboOption[]>([]);
  const [managers,setManagers]= useState<ComboOption[]>([]);
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  /* ── Dialogs ── */
  const [showImportDialog,    setShowImportDialog]    = useState(false);
  const [showImportAllDialog, setShowImportAllDialog] = useState(false);
  const [showFilterDialog,    setShowFilterDialog]    = useState(false);
  const [showOthersDialog,    setShowOthersDialog]    = useState(false);
  const [isGenerating,        setIsGenerating]        = useState(false);

  /* ── Import All (CSV, no TSA picker) ── */
  const [importAllFile,       setImportAllFile]       = useState<File|null>(null);
  const [importAllPreview,    setImportAllPreview]    = useState<any[]>([]);
  const [importAllLog,        setImportAllLog]        = useState<{type:"info"|"warn"|"ok"|"err";msg:string}[]>([]);
  const [importAllFailed,     setImportAllFailed]     = useState<any[]>([]);
  const [isImportAllLoading,  setIsImportAllLoading]  = useState(false);
  const [isImportAllParsing,  setIsImportAllParsing]  = useState(false);
  const importAllLogEndRef = React.useRef<HTMLDivElement>(null);
  const addImportAllLog = React.useCallback(
    (type:"info"|"warn"|"ok"|"err", msg:string) =>
      setImportAllLog(prev => [...prev, {type, msg}]),
    []
  );
  React.useEffect(() => { importAllLogEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [importAllLog]);

  /* ── Bulk Update by Reference ── */
  const [bulkUpdateFile,      setBulkUpdateFile]      = useState<File|null>(null);
  const [bulkUpdateFileName,  setBulkUpdateFileName]  = useState<string|null>(null);
  const [bulkUpdatePreview,   setBulkUpdatePreview]   = useState<any[]>([]);
  const [bulkUpdateColumns,   setBulkUpdateColumns]   = useState<string[]>([]);
  const [isBulkUpdateLoading, setIsBulkUpdateLoading] = useState(false);
  const [bulkUpdateLog,       setBulkUpdateLog]       = useState<{type:"info"|"warn"|"ok"|"err";msg:string}[]>([]);
  const [isBulkUpdateParsing, setIsBulkUpdateParsing] = useState(false);
  const [bulkUpdateMode,      setBulkUpdateMode]      = useState<"byId"|"byTsaTsmManager">("byId");
  const bulkUpdateLogEndRef = useRef<HTMLDivElement>(null);
  const addBulkUpdateLog = useCallback((type:"info"|"warn"|"ok"|"err", msg:string) => setBulkUpdateLog(prev=>[...prev,{type,msg}]), []);
  useEffect(() => { bulkUpdateLogEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [bulkUpdateLog]);

  /* ── AI Insights ── */
  interface CDBAnalysis {
    overview: string;
    problems: { title:string; description:string; severity:string; count?:number }[];
    patterns: { title:string; description:string }[];
    recommendations: { title:string; description:string; priority:string }[];
    metrics: Record<string,string>;
  }
  const [insightsOpen,    setInsightsOpen]    = useState(false);
  const [isAnalyzing,     setIsAnalyzing]     = useState(false);
  const [analysis,        setAnalysis]        = useState<CDBAnalysis|null>(null);
  const [analyzedCount,   setAnalyzedCount]   = useState(0);
  const [expandedSection, setExpandedSection] = useState<string|null>("problems");

  const SEVERITY_STYLE: Record<string,{color:string;bg:string}> = {
    critical: { color:"#f87171", bg:"rgba(248,113,113,0.1)" },
    high:     { color:"#fb923c", bg:"rgba(251,146,60,0.1)"  },
    medium:   { color:"#fbbf24", bg:"rgba(251,191,36,0.1)"  },
    low:      { color:"#34d399", bg:"rgba(52,211,153,0.1)"  },
  };
  const PRIORITY_COLOR: Record<string,string> = {
    immediate:    "#f87171",
    "short-term": "#fbbf24",
    "long-term":  "#60a5fa",
  };

  const handleAnalyze = async () => {
    if (!filtered.length) { toast.error("No customers to analyze"); return; }
    setIsAnalyzing(true); setInsightsOpen(true); setAnalysis(null);
    try {
      // Build a compact summary client-side — never send raw records (too large)
      const byStatus: Record<string,number> = {};
      const byType:   Record<string,number> = {};
      const byRegion: Record<string,number> = {};
      const byIndustry: Record<string,number> = {};
      const byTSA:    Record<string,number> = {};
      let missingEmail = 0, missingContact = 0, missingType = 0, missingStatus = 0, unassigned = 0, parked = 0, active = 0, forDeletion = 0;
      const companyNames: Record<string,number> = {};

      for (const c of filtered) {
        const s = (c.status ?? "unknown").toLowerCase();
        byStatus[s] = (byStatus[s]??0)+1;
        const t = c.type_client ?? "unknown"; byType[t] = (byType[t]??0)+1;
        const r = c.region ?? "unknown";      byRegion[r] = (byRegion[r]??0)+1;
        const ind = c.industry ?? "unknown";  byIndustry[ind] = (byIndustry[ind]??0)+1;
        const tsa = c.referenceid ?? "unassigned"; byTSA[tsa] = (byTSA[tsa]??0)+1;
        if (!c.email_address?.trim())   missingEmail++;
        if (!c.contact_number?.trim())  missingContact++;
        if (!c.type_client?.trim())     missingType++;
        if (!c.status?.trim())          missingStatus++;
        if (!c.referenceid?.trim())     unassigned++;
        if (s === "park")               parked++;
        if (s === "active")             active++;
        if (["for deletion","remove"].includes(s)) forDeletion++;
        const cn = (c.company_name??"").toLowerCase().trim();
        if (cn) companyNames[cn] = (companyNames[cn]??0)+1;
      }

      const summary = {
        total: filtered.length,
        byStatus,
        byTypeClient: byType,
        byRegion,
        byIndustry,
        topTSAs: Object.entries(byTSA).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id,count])=>({id,count})),
        missingEmail, missingContact, missingType, missingStatus,
        unassigned, parkedCount: parked, activeCount: active, forDeletion,
        duplicateCompanies: Object.values(companyNames).filter(v=>v>1).length,
      };

      const res  = await fetch("/api/taskflow/customer-database/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers: summary }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Analysis failed");
      setAnalysis(json.analysis);
      setAnalyzedCount(filtered.length);
    } catch (err: any) {
      toast.error(err.message ?? "AI analysis failed");
      setInsightsOpen(false);
    } finally { setIsAnalyzing(false); }
  };

  /* ── Actor ── */
  const [currentActor, setCurrentActor] = useState<AuditActor>({ uid:null,name:null,email:null,role:null,referenceId:null });
  const currentActorRef = useRef<AuditActor>(currentActor);
  useEffect(() => { currentActorRef.current = currentActor; }, [currentActor]);
  const preTransferSnapshotRef = useRef<Customer[]>([]);

  const { logCreate, logDelete, logTransfer, logAutoGenerate, logUpdate } = useAuditLogging(currentActorRef.current);

  /* ── Import state ── */
  const [importFile,               setImportFile]              = useState<File|null>(null);
  const [importOriginalFileName,   setImportOriginalFileName]  = useState<string|null>(null);
  const [importPreviewData,        setImportPreviewData]       = useState<any[]>([]);
  const [importFailedRows,         setImportFailedRows]        = useState<any[]>([]);
  const [importManagerOptions,     setImportManagerOptions]    = useState<ComboOption[]>([]);
  const [importTsmOptions,         setImportTsmOptions]        = useState<ComboOption[]>([]);
  const [importTsaOptions,         setImportTsaOptions]        = useState<ComboOption[]>([]);
  const [importSelectedManager,    setImportSelectedManager]   = useState("");
  const [importSelectedTSM,        setImportSelectedTSM]       = useState("");
  const [importSelectedTSA,        setImportSelectedTSA]       = useState("");
  const [isImportLoading,          setIsImportLoading]         = useState(false);
  const [parseLog,                 setParseLog]                = useState<{type:"info"|"warn"|"ok"|"err";msg:string}[]>([]);
  const [isParsing,                setIsParsing]               = useState(false);
  const parseLogEndRef = useRef<HTMLDivElement>(null);
  const addParseLog = useCallback((type:"info"|"warn"|"ok"|"err", msg:string) => setParseLog(prev=>[...prev,{type,msg}]), []);
  useEffect(() => { parseLogEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [parseLog]);

  /* ── Load actor ── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("currentUser");
      if (!stored) return;
      const p = JSON.parse(stored);
      setCurrentActor({ uid:p.uid??null, name:p.name??null, email:p.email??null, role:p.role??null, referenceId:p.referenceId??null });
    } catch {}
  }, []);

  /* ── Resolve display names ── */
  useEffect(() => {
    if (!customers.length) return;
    // Use module-level cached fetch — avoids repeated MongoDB hits
    fetchUserNameMap().then(map => setRefIdUserMap(map)).catch(() => {});
  }, [customers]);

  /* ── Sync from React Query ── */
  useEffect(() => { if (customersData) setCustomers(customersData); }, [customersData]);
  useEffect(() => { if (customersError) toast.error(`Failed to load data: ${customersError.message}`); }, [customersError]);

  /* ── Transfer dropdowns ── */
  useEffect(() => {
    if (!showTransferDialog) return;
    const load = async () => {
      try {
        const [r1,r2,r3] = await Promise.all([
          fetch("/api/UserManagement/FetchTSA?Role=Territory Sales Associate"),
          fetch("/api/UserManagement/FetchTSM?Role=Territory Sales Manager"),
          fetch("/api/UserManagement/FetchManager?Role=Manager"),
        ]);
        const [d1,d2,d3] = await Promise.all([r1.ok?safeJson(r1):[], r2.ok?safeJson(r2):[], r3.ok?safeJson(r3):[]]);
        setTsas((Array.isArray(d1)?d1:[]).map((m:any)=>({label:`${m.Firstname} ${m.Lastname}`,value:m.ReferenceID})));
        setTsms((Array.isArray(d2)?d2:[]).map((t:any)=>({label:`${t.Firstname} ${t.Lastname}`,value:t.ReferenceID})));
        setManagers((Array.isArray(d3)?d3:[]).map((m:any)=>({label:`${m.Firstname} ${m.Lastname}`,value:m.ReferenceID})));
      } catch { toast.error("Failed to fetch supervisor data"); }
    };
    load();
  }, [showTransferDialog]);

  /* ── Import manager fetch ── */
  useEffect(() => {
    fetch("/api/UserManagement/FetchManager?Role=Manager").then(r=>r.json()).then(data=>{
      setImportManagerOptions((Array.isArray(data)?data:[]).map((u:any)=>({value:u.ReferenceID,label:`${u.Firstname} ${u.Lastname}`})).sort((a:ComboOption,b:ComboOption)=>a.label.localeCompare(b.label)));
    }).catch(()=>{});
  }, []);

  /* ── Import TSM scoped ── */
  useEffect(() => {
    if (!importSelectedManager) { setImportTsmOptions([]); setImportSelectedTSM(""); setImportSelectedTSA(""); return; }
    fetch(`/api/UserManagement/FetchTSM?Role=Territory Sales Manager&managerReferenceID=${importSelectedManager}`).then(r=>r.json()).then(data=>{
      if (Array.isArray(data)) setImportTsmOptions(data.map((u:any)=>({value:u.ReferenceID,label:`${u.Firstname} ${u.Lastname}`})).sort((a:ComboOption,b:ComboOption)=>a.label.localeCompare(b.label)));
      else setImportTsmOptions([]);
    }).catch(()=>{});
    setImportSelectedTSM(""); setImportSelectedTSA("");
  }, [importSelectedManager]);

  /* ── Import TSA scoped ── */
  useEffect(() => {
    if (!importSelectedTSM) { setImportTsaOptions([]); setImportSelectedTSA(""); return; }
    fetch(`/api/UserManagement/FetchTSA?Role=Territory%20Sales%20Associate&managerReferenceID=${importSelectedTSM}`).then(r=>r.json()).then(data=>{
      if (Array.isArray(data)) setImportTsaOptions(data.map((u:any)=>({value:u.ReferenceID,label:`${u.Firstname} ${u.Lastname}`})).sort((a:ComboOption,b:ComboOption)=>a.label.localeCompare(b.label)));
      else setImportTsaOptions([]);
    }).catch(()=>{});
    setImportSelectedTSA("");
  }, [importSelectedTSM]);

  /* ── Filter debounce ── */
  useEffect(() => {
    setIsFiltering(true);
    const t = setTimeout(()=>{ setIsFiltering(false); },400);
    return ()=>clearTimeout(t);
  }, [search, filterType]);

  useEffect(()=>setPage(1),[search,filterType,filterStatus,filterTSA,filterTSM,filterManager]);

  /* ── Derived options ── */
  const typeOptions   = useMemo(()=>["all",...new Set(customers.map(c=>c.type_client).filter(Boolean))].sort(),[customers]);
  const statusOptions = useMemo(()=>["all",...new Set(customers.map(c=>c.status).filter(Boolean))].sort(),[customers]);

  const filterTsaOptions = useMemo<ComboOption[]>(()=>{
    const seen = new Map<string,ComboOption>();
    for (const c of customers) {
      const key=(c.referenceid??"").trim();
      if (!key||seen.has(key.toLowerCase())) continue;
      const user=refIdUserMap.get(key.toLowerCase());
      seen.set(key.toLowerCase(),{value:key,label:user?.name||key});
    }
    return [{value:"all",label:"All TSA"},...Array.from(seen.values()).sort((a,b)=>a.label.localeCompare(b.label))];
  },[customers,refIdUserMap]);

  const filterTsmOptions = useMemo<ComboOption[]>(()=>{
    const seen = new Map<string,ComboOption>();
    for (const c of customers) {
      const key=(c.tsm??"").trim();
      if (!key||seen.has(key.toLowerCase())) continue;
      const user=refIdUserMap.get(key.toLowerCase());
      seen.set(key.toLowerCase(),{value:key,label:user?.name||key});
    }
    return [{value:"all",label:"All TSM"},...Array.from(seen.values()).sort((a,b)=>a.label.localeCompare(b.label))];
  },[customers,refIdUserMap]);

  const filterManagerOptions = useMemo<ComboOption[]>(()=>{
    const seen = new Map<string,ComboOption>();
    for (const c of customers) {
      const key=(c.manager??"").trim();
      if (!key||seen.has(key.toLowerCase())) continue;
      const user=refIdUserMap.get(key.toLowerCase());
      seen.set(key.toLowerCase(),{value:key,label:user?.name||key});
    }
    return [{value:"all",label:"All Manager"},...Array.from(seen.values()).sort((a,b)=>a.label.localeCompare(b.label))];
  },[customers,refIdUserMap]);

  /* ── Filtered data ── */
  const filtered = useMemo(()=>customers
    .filter(c=>[c.company_name,c.account_reference_number,c.contact_person,c.contact_number,c.email_address,c.region,c.manager,c.tsm].some(f=>f?.toLowerCase().includes(search.toLowerCase())))
    .filter(c=>filterType==="all"||c.type_client===filterType)
    .filter(c=>filterStatus==="all"||(c.status??"").trim().toLowerCase()===filterStatus.toLowerCase())
    .filter(c=>filterTSA==="all"||c.referenceid?.trim().toLowerCase()===filterTSA.trim().toLowerCase())
    .filter(c=>filterTSM==="all"||(c.tsm??"").trim().toLowerCase()===filterTSM.trim().toLowerCase())
    .filter(c=>filterManager==="all"||(c.manager??"").trim().toLowerCase()===filterManager.trim().toLowerCase())
    .filter(c=>{ if (!startDate&&!endDate) return true; const d=new Date(c.date_created).getTime(); const s=startDate?new Date(startDate).getTime():null; const e=endDate?new Date(endDate).getTime():null; if (s&&d<s) return false; if (e&&d>e) return false; return true; })
    .sort((a,b)=>{ const da=new Date(a.date_created).getTime(); const db=new Date(b.date_created).getTime(); return sortOrder==="asc"?da-db:db-da; })
  ,[customers,search,filterType,filterStatus,filterTSA,filterTSM,filterManager,startDate,endDate,sortOrder]);

  const displayData = useMemo(()=>{
    if (!isAuditView) return filtered;
    if (auditFilter===""||auditFilter==="all") return audited;
    if (auditFilter==="missingType") return audited.filter(c=>!c.type_client?.trim()&&c.status?.trim());
    if (auditFilter==="missingStatus") return audited.filter(c=>!c.status?.trim()&&c.type_client?.trim());
    if (auditFilter==="duplicates") return audited.filter(c=>duplicateIds.has(c.id));
    return audited;
  },[filtered,audited,isAuditView,auditFilter,duplicateIds]);

  const totalPages = Math.max(1, Math.ceil(displayData.length/rowsPerPage));
  const current    = displayData.slice((page-1)*rowsPerPage, page*rowsPerPage);
  const totalCount = filtered.length;

  /* ── Import handlers ── */
  const handleFileSelect = async (file: File) => {
    setImportFile(file); setImportOriginalFileName(file.name.replace(/\.[^/.]+$/,"")); setParseLog([]); setIsParsing(true);
    addParseLog("info",`📂 Reading "${file.name}"…`);
    try {
      const data = await parseExcelForFile(file, importSelectedTSA, importSelectedManager, importSelectedTSM);
      addParseLog("ok",`✅ Parsed ${data.length} row(s)`);
      const types=[...new Set(data.map((r:any)=>r.type_client).filter(Boolean))] as string[];
      const statuses=[...new Set(data.map((r:any)=>r.status).filter(Boolean))] as string[];
      if (types.length) addParseLog("info",`  → ${types.length} type(s): ${types.slice(0,4).join(", ")}${types.length>4?" …":""}`);
      if (statuses.length) addParseLog("info",`  → ${statuses.length} status(es): ${statuses.slice(0,4).join(", ")}${statuses.length>4?" …":""}`);
      const missingStatus=data.filter((r:any)=>!r.status?.trim()).length;
      const missingType=data.filter((r:any)=>!r.type_client?.trim()).length;
      if (missingStatus) addParseLog("warn",`  ⚠️  ${missingStatus} row(s) missing status`);
      if (missingType) addParseLog("warn",`  ⚠️  ${missingType} row(s) missing type`);
      addParseLog("ok",`🚀 Ready — ${data.length} record(s) queued for upload`);
      setImportPreviewData(data);
    } catch { addParseLog("err",`❌ Failed to parse "${file.name}"`); toast.error("Failed to parse Excel file."); }
    finally { setIsParsing(false); }
  };

  const handleImportUpload = async () => {
    if (!importFile) return toast.error("Please select a file.");
    if (!importSelectedTSA) return toast.error("Please select a TSA.");
    setIsImportLoading(true); setImportFailedRows([]);
    try {
      const parsed = await parseExcelForFile(importFile, importSelectedTSA, importSelectedManager, importSelectedTSM);
      const total = parsed.length; const batchSize = 10; const failed: any[] = [];
      for (let i=0;i<total;i+=batchSize) {
        const batch=parsed.slice(i,i+batchSize);
        toast(`Uploading ${i+1}–${Math.min(i+batchSize,total)}/${total}: ${batch[0].company_name}`,{duration:1000});
        const res=await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({referenceid:importSelectedTSA,tsm:importSelectedTSM||"",data:batch})});
        const result=await res.json();
        if (!result.success&&result.failed) failed.push(...result.failed);
      }
      const successCount=total-failed.length;
      if (failed.length>0) { setImportFailedRows(failed); toast.error(`Failed to import ${failed.length} records.`); }
      else toast.success(`Successfully imported ${total} records.`);
      if (successCount>0) {
        const tsaLabel=importTsaOptions.find(o=>o.value===importSelectedTSA)?.label??importSelectedTSA;
        await logCustomerAudit({ action:"create", affectedCount:successCount, customerName:`${successCount} customers imported`, transfer:null, changes:{assigned_tsa:{before:null,after:tsaLabel}}, actor:currentActorRef.current, context:{page:AUDIT_PAGE,source:"ImportForm",bulk:successCount>1} });
      }
      setImportFile(null); setImportPreviewData([]); setParseLog([]);
    } catch { toast.error("Failed to import file."); }
    finally { setIsImportLoading(false); }
  };

  const handleDownloadFailed = () => {
    if (!importFailedRows.length) { toast.info("No failed rows."); return; }
    const wb=new ExcelJS.Workbook(); const ws=wb.addWorksheet("Failed Rows");
    const allCols = [
      "company_name","contact_person","contact_number","email_address","type_client",
      "address","delivery_address","region","status","company_group","industry",
      "remarks","gender","type","account_reference_number","referenceid","tsm","manager",
      "date_transferred","province","city","date_approved","date_removed",
      "transfer_to","tin_number","reason","it_approved_date","next_available_date",
      "date_created","date_updated","_error",
    ];
    ws.addRow(allCols);
    importFailedRows.forEach(row => ws.addRow(allCols.map(k => row[k] ?? "")));
    wb.xlsx.writeBuffer().then(buffer=>{
      const blob=new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
      const url=URL.createObjectURL(blob);
      const a=Object.assign(document.createElement("a"),{href:url,download:`${importOriginalFileName||"failed_rows"}.xlsx`});
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    });
  };

  /* ── Import All (CSV) ─────────────────────────────────────────────── */
  /** Parse CSV file using headers in row 1 — returns array of row objects */
  const parseCsvFile = (file: File): Promise<any[]> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
          if (lines.length < 2) { resolve([]); return; }

          // Parse CSV header — handle quoted fields
          const parseRow = (line: string): string[] => {
            const result: string[] = [];
            let cur = "", inQuote = false;
            for (let i = 0; i < line.length; i++) {
              const ch = line[i];
              if (ch === '"') { inQuote = !inQuote; continue; }
              if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ""; continue; }
              cur += ch;
            }
            result.push(cur.trim());
            return result;
          };

          const headers = parseRow(lines[0]).map(h =>
            h.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
          );

          const rows: any[] = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cells = parseRow(line);
            if (cells.every(c => !c)) continue; // skip blank rows
            const obj: any = {};
            headers.forEach((h, idx) => { obj[h] = cells[idx] ?? ""; });
            // Skip row if no company_name
            if (!obj.company_name?.trim()) continue;
            rows.push(obj);
          }
          resolve(rows);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsText(file, "utf-8");
    });

  const handleImportAllFileSelect = async (file: File) => {
    setImportAllFile(file);
    setImportAllLog([]);
    setImportAllPreview([]);
    setImportAllFailed([]);
    setIsImportAllParsing(true);
    addImportAllLog("info", `📂 Reading "${file.name}"…`);
    try {
      const rows = await parseCsvFile(file);
      addImportAllLog("ok",  `✅ Parsed ${rows.length} row(s)`);
      const missing = rows.filter(r => !r.company_name?.trim()).length;
      if (missing) addImportAllLog("warn", `  ⚠️  ${missing} row(s) missing company_name (will be skipped)`);
      const missingStatus = rows.filter(r => !r.status?.trim()).length;
      if (missingStatus) addImportAllLog("info", `  ℹ️  ${missingStatus} row(s) missing status (will default to "Active")`);
      addImportAllLog("ok", `🚀 Ready — ${rows.length} record(s) queued`);
      setImportAllPreview(rows);
    } catch {
      addImportAllLog("err", `❌ Failed to parse file`);
      toast.error("Failed to parse CSV file.");
    } finally {
      setIsImportAllParsing(false);
    }
  };

  const handleImportAllUpload = async () => {
    if (!importAllFile) return toast.error("Please select a CSV file.");
    if (!importAllPreview.length) return toast.error("No rows to import.");
    setIsImportAllLoading(true);
    setImportAllFailed([]);
    const total = importAllPreview.length;
    const batchSize = 50; // larger batches — no dropdown enrichment needed
    let inserted = 0;
    const failed: any[] = [];
    try {
      for (let i = 0; i < total; i += batchSize) {
        const batch = importAllPreview.slice(i, i + batchSize);
        addImportAllLog("info", `  Uploading rows ${i + 1}–${Math.min(i + batchSize, total)}…`);
        const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: batch }),
        });
        const result = await res.json();
        inserted += result.insertedCount ?? 0;
        if (result.failed?.length) failed.push(...result.failed);
      }
      if (failed.length) {
        setImportAllFailed(failed);
        addImportAllLog("warn", `⚠️  ${failed.length} row(s) failed`);
        toast.error(`Imported ${inserted} / ${total} — ${failed.length} failed`);
      } else {
        addImportAllLog("ok", `✅ All ${inserted} record(s) imported successfully!`);
        toast.success(`Successfully imported ${inserted} records.`);
        setImportAllFile(null);
        setImportAllPreview([]);
        setImportAllLog([]);
      }
    } catch {
      addImportAllLog("err", "❌ Upload failed — check console");
      toast.error("Import All failed.");
    } finally {
      setIsImportAllLoading(false);
    }
  };

  const handleDownloadImportAllFailed = () => {
    if (!importAllFailed.length) return;
    const headers = Object.keys(importAllFailed[0]).filter(k => k !== "_error");
    const lines = [
      [...headers, "_error"].join(","),
      ...importAllFailed.map(row =>
        [...headers, "_error"].map(k => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "import_all_failed.csv" });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── Bulk Update handlers ── */
  const handleBulkUpdateFileSelect = async (file: File) => {
    setBulkUpdateFile(file); setBulkUpdateFileName(file.name.replace(/\.[^/.]+$/,"")); setBulkUpdateLog([]); setIsBulkUpdateParsing(true);
    addBulkUpdateLog("info",`📂 Reading "${file.name}"…`);
    try {
      const { data, columns } = await parseExcelForBulkUpdate(file);
      addBulkUpdateLog("ok",`✅ Parsed ${data.length} row(s)`);
      addBulkUpdateLog("info",`  → Columns found: ${columns.join(", ")}`);
      
      // Check required columns based on mode
      if (bulkUpdateMode === "byTsaTsmManager") {
        // Only require either account_reference_number or referenceid as identifier
        if (!columns.includes("account_reference_number") && !columns.includes("referenceid")) {
          addBulkUpdateLog("err",`❌ Missing required column: account_reference_number or referenceid`);
          toast.error("Excel file must contain either 'account_reference_number' or 'referenceid' column");
          setBulkUpdateFile(null); setBulkUpdateFileName(null); setBulkUpdatePreview([]); setBulkUpdateColumns([]);
          return;
        }
      } else {
        // Check if account_reference_number column exists for byId mode
        if (!columns.includes("account_reference_number")) {
          addBulkUpdateLog("err",`❌ Missing required column: account_reference_number`);
          toast.error("Excel file must contain 'account_reference_number' column");
          setBulkUpdateFile(null); setBulkUpdateFileName(null); setBulkUpdatePreview([]); setBulkUpdateColumns([]);
          return;
        }
      }
      
      addBulkUpdateLog("ok",`🚀 Ready — ${data.length} record(s) queued for update`);
      setBulkUpdatePreview(data);
      setBulkUpdateColumns(columns);
    } catch { addBulkUpdateLog("err",`❌ Failed to parse "${file.name}"`); toast.error("Failed to parse Excel file."); }
    finally { setIsBulkUpdateParsing(false); }
  };

  const handleBulkUpdateUpload = async () => {
    if (!bulkUpdateFile) return toast.error("Please select a file.");
    if (!bulkUpdatePreview.length) return toast.error("No data to update.");
    setIsBulkUpdateLoading(true); setBulkUpdateLog([]);
    
    const modeLabel = bulkUpdateMode === "byTsaTsmManager" ? "TSA, TSM, Manager, Status, Industry, and Type Client" : "all fields";
    addBulkUpdateLog("info",`🚀 Starting bulk update (${modeLabel})...`);
    
    try {
      const total = bulkUpdatePreview.length; const batchSize = 10;
      let successCount = 0; let failCount = 0;
      
      for (let i=0;i<total;i+=batchSize) {
        let batch = bulkUpdatePreview.slice(i,i+batchSize);
        
        // If mode is byTsaTsmManager, filter to only include TSA, TSM, Manager, Status, Industry, and Type Client fields
        if (bulkUpdateMode === "byTsaTsmManager") {
          batch = batch.map(row => ({
            account_reference_number: row.account_reference_number,
            referenceid: row.referenceid || row.tsa,
            tsm: row.tsm,
            manager: row.manager,
            status: row.status,
            industry: row.industry,
            type_client: row.type_client
          }));
        }
        
        addBulkUpdateLog("info",`  → Processing ${i+1}–${Math.min(i+batchSize,total)}/${total}...`);
        
        const res=await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/BulkUpdateByReference",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({updates:batch})});
        const result=await res.json();
        
        if (result.success) {
          successCount += result.updated;
          failCount += result.failed;
          addBulkUpdateLog("ok",`  ✓ Updated ${result.updated}, Failed ${result.failed}`);
          if (result.errors?.length > 0) {
            result.errors.forEach((err: any) => addBulkUpdateLog("warn",`    ⚠ ${err.error}: ${err.account_reference_number}`));
          }
        } else {
          addBulkUpdateLog("err",`  ❌ Batch failed: ${result.error}`);
        }
      }
      
      addBulkUpdateLog("ok",`✅ Complete — ${successCount} updated, ${failCount} failed`);
      if (failCount > 0) {
        toast.error(`Bulk update completed with ${failCount} failures.`);
      } else {
        toast.success(`Successfully updated ${successCount} records.`);
      }
      
      setBulkUpdateFile(null); setBulkUpdatePreview([]); setBulkUpdateColumns([]); setBulkUpdateLog([]);
    } catch { addBulkUpdateLog("err",`❌ Bulk update failed`); toast.error("Failed to perform bulk update."); }
    finally { setIsBulkUpdateLoading(false); }
  };

  /* ── Bulk delete ── */
  const executeBulkDelete = async () => {
    if (!selectedIds.size) { toast.error("No customers selected."); return; }
    const ids=Array.from(selectedIds);
    const deleted=customers.filter(c=>selectedIds.has(c.id));
    let loadId=toast.loading(`Deleting 0/${ids.length}…`);
    try {
      const res=await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/BulkDelete",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({userIds:ids})});
      const result=await safeJson(res)??{};
      if (!res.ok||!result.success) { toast.error(result.error||"Delete failed"); return; }
      for (let i=0;i<ids.length;i++) { toast.dismiss(loadId); loadId=toast.loading(`Deleting ${i+1}/${ids.length}…`); await new Promise(r=>setTimeout(r,30)); }
      toast.success(`Deleted ${ids.length} customers.`);
      setCustomers(prev=>prev.filter(c=>!selectedIds.has(c.id)));
      setSelectedIdsAction(new Set());
      await Promise.all(deleted.map(c=>logCustomerAudit({action:"delete",affectedCount:deleted.length,customerId:String(c.id),customerName:c.company_name,actor:currentActorRef.current,context:{page:AUDIT_PAGE,source:"BulkDelete",bulk:deleted.length>1}})));
    } catch { toast.error("Bulk delete failed."); }
  };

  const toggleSelect=(id:number)=>{
    const s=new Set(selectedIds);
    s.has(id)?s.delete(id):s.add(id);
    setSelectedIdsAction(s);
    setSelectAll(s.size===current.length);
  };
  const handleSelectAll=()=>{
    if (selectAll) { setSelectedIdsAction(new Set()); setSelectAll(false); }
    else { setSelectedIdsAction(new Set(current.map(c=>c.id))); setSelectAll(true); }
  };

  /* ── Auto-generate ── */
  const handleAutoGenerate = async () => {
    if (!selectedIds.size) { toast.error("No customers selected."); return; }
    setIsGenerating(true);
    try {
      const sel=customers.filter(c=>selectedIds.has(c.id));
      const getInitials=(name:string)=>{ const p=name.trim().split(/\s+/); return p.length===1?p[0][0].toUpperCase():(p[0][0]+p[p.length-1][0]).toUpperCase(); };
      const updates=sel.map((c,i)=>({ id:c.id, account_reference_number:`${getInitials(c.company_name)}-${(c.region||"NCR").toUpperCase().replace(/\s+/g,"")}-${(i+1).toString().padStart(10,"0")}` }));
      const res=await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/UpdateReferenceNumber",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({updates})});
      const result=await safeJson(res)??{};
      if (!res.ok||!result.success) { toast.error(result.error||"Failed to update reference numbers"); return; }
      setCustomers(prev=>prev.map(c=>{ const u=updates.find(u=>u.id===c.id); return u?{...c,account_reference_number:u.account_reference_number}:c; }));
      toast.success("Reference numbers generated.");
    } catch { toast.error("Error during update."); }
    finally { setIsGenerating(false); }
  };

  /* ── Transfer ── */
  const handleOpenTransfer=()=>{
    preTransferSnapshotRef.current=customers.filter(c=>selectedIds.has(c.id));
    setShowTransferDialog(true);
  };

  const handleTransferSuccess=async(payload:TransferSuccessPayload)=>{
    const snap=preTransferSnapshotRef.current;
    if (!snap.length) return;
    const transfer:TransferDetail={
      tsa:payload.tsa?{toId:payload.tsa.toId,toName:payload.tsa.toName,fromId:snap[0].referenceid||null,fromName:refIdUserMap.get(snap[0].referenceid?.trim().toLowerCase())?.name||snap[0].referenceid||null}:null,
      tsm:payload.tsm?{toName:payload.tsm.toName,fromName:snap[0].tsm||null}:null,
      manager:payload.manager?{toName:payload.manager.toName,fromName:snap[0].manager||null}:null,
    };
    await Promise.all(snap.map(c=>logCustomerAudit({action:"transfer",affectedCount:snap.length,customerId:String(c.id),customerName:c.company_name,transfer,actor:currentActorRef.current,context:{page:AUDIT_PAGE,source:"TransferDialog",bulk:snap.length>1}})));
    preTransferSnapshotRef.current=[];
  };

  const handleResetFilters=()=>{ setFilterTSA("all"); setFilterTSM("all"); setFilterManager("all"); setFilterType("all"); setFilterStatus("all"); setStartDate(""); setEndDate(""); setSortOrder("desc"); setRowsPerPage(20); setPage(1); };

  const hasActiveFilters = filterTSA!=="all"||filterTSM!=="all"||filterManager!=="all"||filterType!=="all"||filterStatus!=="all"||!!startDate||!!endDate||sortOrder!=="desc"||rowsPerPage!==20;

  const parseLogColor=(type:string)=>{ if(type==="ok") return "text-emerald-400"; if(type==="warn") return "text-amber-400"; if(type==="err") return "text-red-400"; return "text-zinc-400"; };

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-[#0a0d14] text-slate-100 flex flex-col h-svh overflow-hidden">

          {/* ── Header ── */}
          <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-orange-500/15 bg-[#0d1117]/90 backdrop-blur-sm overflow-hidden">
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/40" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/40" />
            <div className="flex items-center gap-2 px-4 relative z-10">
              <SidebarTrigger className="-ml-1 text-orange-400/70 hover:text-orange-300 hover:bg-orange-500/10" />
              <Button variant="ghost" size="sm" onClick={()=>router.push("/dashboard")}
                className="text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 text-xs hidden sm:flex font-mono">
                Home
              </Button>
              <Separator orientation="vertical" className="h-4 bg-orange-500/15 hidden sm:block" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#" className="text-slate-500 hover:text-orange-400 text-xs hidden sm:block font-mono uppercase tracking-wider">Taskflow</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator><ChevronRight size={10} className="text-slate-700" /></BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-orange-400 text-xs font-mono tracking-widest uppercase">Customer Database</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          {/* ── Toolbar ── */}
          <div className="shrink-0 px-3 sm:px-4 pt-3 pb-2 border-b border-slate-800/60 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-sm sm:text-base font-bold tracking-widest uppercase text-orange-400 font-mono leading-tight">Customer Database Backup</h1>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {isFetching ? "Loading…" : <><span className="font-semibold text-slate-300">{filtered.length}</span> customer{filtered.length!==1?"s":""}</>}
                </p>
              </div>
              <Badge variant="outline" className="border-orange-500/30 text-orange-400/70 text-[10px] shrink-0 font-mono">
                Total: {totalCount}
              </Badge>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                {/* Search */}
                <div className="relative min-w-[160px] max-w-xs">
                  <Search className="absolute left-2 top-2.5 size-3.5 text-slate-600" />
                  <Input placeholder="Search customers…" value={search} onChange={e=>setSearch(e.target.value)}
                    className="pl-7 h-9 text-xs bg-[#0d1117] border-slate-800 text-slate-300 placeholder:text-slate-700 focus:border-orange-500/40 rounded-none font-mono" />
                  {isFiltering && <Loader2 className="absolute right-2 top-2.5 size-3.5 animate-spin text-slate-500" />}
                </div>

                <Calendar startDate={startDate} endDate={endDate} setStartDateAction={setStartDate} setEndDateAction={setEndDate} />

                <Button variant="outline" size="sm" onClick={()=>setShowFilterDialog(true)}
                  className={cn("bg-[#0d1117] border-slate-800 text-slate-400 hover:bg-orange-500/10 hover:border-orange-500/40 hover:text-orange-300 rounded-none h-9 text-[11px] uppercase tracking-wider font-mono",
                    hasActiveFilters&&"border-orange-500/40 text-orange-400 bg-orange-500/5")}>
                  <SlidersHorizontal className="size-4 mr-1" />Filters
                  {hasActiveFilters && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />}
                </Button>
                <Button variant="outline" size="sm" onClick={()=>setShowImportDialog(true)}
                  className="bg-[#0d1117] border-slate-800 text-slate-400 hover:bg-orange-500/10 hover:border-orange-500/40 hover:text-orange-300 rounded-none h-9 text-[11px] uppercase tracking-wider font-mono">
                  <Upload className="size-4 mr-1" /> Import
                </Button>
                <Button variant="outline" size="sm" onClick={()=>setShowImportAllDialog(true)}
                  className="bg-[#0d1117] border-emerald-800/60 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-300 rounded-none h-9 text-[11px] uppercase tracking-wider font-mono">
                  <FileSpreadsheet className="size-4 mr-1" /> Import All
                </Button>
                <Download data={filtered} filename="CustomerDatabase" />
                <Button variant="outline" size="sm" onClick={() => setShowOthersDialog(true)}
                  className="bg-[#0d1117] border-slate-800 text-[11px] text-slate-400 hover:bg-orange-500/10 hover:border-orange-500/40 hover:text-orange-300 rounded-none h-9 uppercase tracking-wider font-mono">
                  <Settings className="size-4 mr-1" /> Others
                </Button>
                {/* AI Insights */}
                <button onClick={handleAnalyze} disabled={isAnalyzing || !filtered.length}
                  className="flex items-center gap-1.5 h-9 px-3 text-[11px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40 rounded-none font-mono"
                  style={{ backgroundColor:insightsOpen?"rgba(167,139,250,0.15)":"transparent", borderColor:insightsOpen?"#a78bfa":"rgb(30,41,59)", color:insightsOpen?"#a78bfa":"rgb(148,163,184)" }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor="#a78bfa"; e.currentTarget.style.color="#a78bfa"; }}
                  onMouseLeave={e=>{ if(!insightsOpen){ e.currentTarget.style.borderColor="rgb(30,41,59)"; e.currentTarget.style.color="rgb(148,163,184)"; } }}>
                  {isAnalyzing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  AI Insights
                </button>

                {selectedIds.size>0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleOpenTransfer}
                      className="bg-[#0d1117] border-slate-800 text-[11px] text-slate-400 hover:bg-orange-500/10 hover:border-orange-500/40 hover:text-orange-300 rounded-none h-9 uppercase tracking-wider font-mono">
                      <ArrowRight className="size-4 mr-1" /> Transfer
                    </Button>
                    <Button size="sm" onClick={handleAutoGenerate} disabled={isGenerating}
                      className="bg-[#0d1117] text-[11px] border border-slate-800 text-slate-400 hover:bg-orange-500/10 hover:border-orange-500/40 hover:text-orange-300 rounded-none h-9 uppercase tracking-wider font-mono">
                      <Hash className="size-4 mr-1" />
                      {isGenerating?"Generating…":`Auto-ID (${selectedIds.size})`}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={()=>setShowDeleteDialog(true)}
                      className="bg-red-500/10 text-[11px] border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-none h-9 uppercase tracking-wider border">
                      Delete ({selectedIds.size})
                    </Button>
                  </>
                )}

                {!isAuditView ? (
                  <Audit customers={customers} setAuditedAction={setAudited} setDuplicateIdsAction={setDuplicateIds} setIsAuditViewAction={setIsAuditView} />
                ) : (
                  <Button variant="outline" size="sm" onClick={()=>{ setIsAuditView(false); setAudited([]); setDuplicateIds(new Set()); }}
                    className="bg-[#0d1117] border-slate-800 text-slate-400 hover:bg-orange-500/10 hover:border-orange-500/40 hover:text-orange-300 rounded-none h-9 text-xs uppercase tracking-wider font-mono">
                    Return to List
                  </Button>
                )}
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />
            </div>
          </div>

          {/* ── Table area ── */}
          <div className="flex-1 overflow-hidden flex flex-col px-3 sm:px-4 pb-3 min-h-0">

            {/* Audit bar */}
            {isAuditView && (
              <div className="shrink-0 flex items-center justify-between flex-wrap gap-2 px-3 py-2 mb-2 border border-orange-500/20 bg-orange-500/[0.03]">
                <button className="text-[10px] font-mono uppercase tracking-widest text-orange-400/70 hover:text-orange-400 transition-colors flex items-center gap-1.5"
                  onClick={()=>setShowAuditDialog(true)}>
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]" />
                  Audit Active · <span className="text-orange-400 font-bold">{audited.length}</span> issues flagged
                </button>
                <div className="flex items-center gap-1.5">
                  {([
                    {key:"missingType",label:"Missing Type",count:audited.filter(c=>!c.type_client?.trim()&&c.status?.trim()).length,color:"text-amber-400 border-amber-500/30 bg-amber-500/5",active:"bg-amber-500/20 border-amber-500/50 text-amber-300"},
                    {key:"missingStatus",label:"Missing Status",count:audited.filter(c=>!c.status?.trim()&&c.type_client?.trim()).length,color:"text-amber-400 border-amber-500/30 bg-amber-500/5",active:"bg-amber-500/20 border-amber-500/50 text-amber-300"},
                    {key:"duplicates",label:"Duplicates",count:Array.from(duplicateIds).length,color:"text-red-400 border-red-500/30 bg-red-500/5",active:"bg-red-500/20 border-red-500/50 text-red-300"},
                  ] as const).map(({key,label,count,color,active})=>{
                    const isActive=auditFilter===key;
                    return (
                      <button key={key} onClick={()=>setAuditFilter(isActive?"":key)}
                        className={cn("px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest border transition-colors",isActive?active:color)}>
                        {label}: <span className="font-bold">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <DeleteDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} selectedCount={selectedIds.size} onConfirm={executeBulkDelete} />
            <AuditDialog open={showAuditDialog} onOpenChange={setShowAuditDialog} customers={customers} onConfirmAudit={(result)=>{ setAudited(result.allAffectedCustomers); setDuplicateIds(result.duplicateIds); setIsAuditView(true); }} />

            {/* ── Table ── */}
            <div className="flex flex-1 overflow-hidden min-h-0 mt-2 gap-0">
            <div className="flex-1 overflow-auto min-h-0 border border-orange-500/10 bg-[#0a0d14]">
              {isFetching ? (
                <div className="py-16 flex flex-col items-center gap-3 text-slate-600">
                  <Loader2 className="size-5 animate-spin text-orange-500/60" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-orange-500/40">Loading records…</span>
                </div>
              ) : current.length>0 ? (
                <Table className="whitespace-nowrap text-[11px] min-w-full">
                  <TableHeader className="sticky top-0 z-40 bg-[#0d1117]">
                    <TableRow className="border-b border-orange-500/20 bg-[#0d1117] hover:bg-[#0d1117]">
                      <TableHead className="w-[32px] text-center px-2 py-2 sticky left-0 z-50 bg-[#0d1117]">
                        <input type="checkbox" checked={selectAll} onChange={handleSelectAll} className="accent-orange-500" />
                      </TableHead>
                      {[
                        {label:"Actions",          w:"w-[80px]", stickyLeft: 32},
                        {label:"Status",           w:"w-[100px]", stickyLeft: 112},
                        {label:"Company",          w:"w-[180px]", stickyLeft: 212},
                        {label:"Account Reference Number", w:"min-w-[160px]", stickyLeft: null},
                        {label:"Company Group",    w:"min-w-[120px]", stickyLeft: null},
                        {label:"Contact Person",   w:"min-w-[130px]", stickyLeft: null},
                        {label:"Contact No.",      w:"min-w-[120px]", stickyLeft: null},
                        {label:"Email",            w:"min-w-[180px]", stickyLeft: null},
                        {label:"Type Client",      w:"min-w-[100px]", stickyLeft: null},
                        {label:"Industry",         w:"min-w-[80px]", stickyLeft: null},
                        {label:"Gender",           w:"min-w-[60px]", stickyLeft: null},
                        {label:"Address",          w:"min-w-[200px]", stickyLeft: null},
                        {label:"Delivery Address", w:"min-w-[200px]", stickyLeft: null},
                        {label:"Region",           w:"min-w-[100px]", stickyLeft: null},
                        {label:"Province",         w:"min-w-[100px]", stickyLeft: null},
                        {label:"City",             w:"min-w-[100px]", stickyLeft: null},
                        {label:"Remarks",          w:"min-w-[120px]", stickyLeft: null},
                        {label:"TSA",              w:"min-w-[120px]", stickyLeft: null},
                        {label:"TSM",              w:"min-w-[120px]", stickyLeft: null},
                        {label:"Manager",          w:"min-w-[120px]", stickyLeft: null},
                        {label:"Transfer To",      w:"min-w-[100px]", stickyLeft: null},
                        {label:"Date Created",     w:"min-w-[100px]", stickyLeft: null},
                        {label:"Date Updated",     w:"min-w-[100px]", stickyLeft: null},
                        {label:"Next Available",   w:"min-w-[100px]", stickyLeft: null},
                        {label:"Date Transferred", w:"min-w-[100px]", stickyLeft: null},
                        {label:"Date Approved",    w:"min-w-[100px]", stickyLeft: null},
                        {label:"Date Removed",     w:"min-w-[100px]", stickyLeft: null},
                        {label:"IT Approved Date", w:"min-w-[130px]", stickyLeft: null},
                      ].map(({label,w,stickyLeft})=>(
                        <TableHead key={label} className={cn(w,"py-2 px-3 text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/60 border-r border-orange-500/5 last:border-r-0", stickyLeft !== null ? "sticky z-50 bg-[#0d1117]" : "")} style={stickyLeft !== null ? {left: `${stickyLeft}px`} : {}}>
                          {label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {current.map(c=>{
                      const isMissingType   = !c.type_client?.trim();
                      const isMissingStatus = !c.status?.trim();
                      const isDuplicate     = duplicateIds.has(c.id);
                      const isSelected      = selectedIds.has(c.id);
                      const isParked        = c.status?.trim().toLowerCase()==="park";

                      const renderUserCell=(refId:string|undefined)=>{
                        const key=(refId??"").trim().toLowerCase();
                        const user=refIdUserMap.get(key);
                        const label=user?.name||refId||"—";
                        const isInactive=user&&INACTIVE_STATUSES.includes(user.status??"");
                        return (
                          <span className="flex items-center gap-1 flex-wrap">
                            <span className="text-slate-300">{label}</span>
                            {isInactive && (
                              <span className={cn("text-[8px] font-mono font-bold px-1 py-0.5 leading-none uppercase tracking-wider",
                                user?.status==="Terminated"?"bg-red-900/50 text-red-400":user?.status==="Resigned"?"bg-orange-900/50 text-orange-400":"bg-slate-700 text-slate-400")}>
                                {user?.status}
                              </span>
                            )}
                          </span>
                        );
                      };

                      const fmtDate=(d?:string|null)=>d?new Date(d).toLocaleDateString():"—";
                      const cb="py-2 px-3 border-r border-orange-500/5 last:border-r-0";

                      return (
                        <TableRow key={c.id} className={cn("border-b border-orange-500/5 transition-colors hover:bg-orange-500/[0.04]",
                          isParked&&"opacity-40",
                          isSelected?"bg-orange-500/[0.06] border-l-2 border-l-orange-500/50":"border-l-2 border-l-transparent")}>

                          <TableCell className={cn(cb,"text-center w-[32px] sticky left-0 z-30 bg-[#0a0d14]")} style={{backgroundColor: isSelected ? "rgba(251,146,60,0.06)" : "#0a0d14"}}>
                            <input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(c.id)} className="accent-orange-500" />
                          </TableCell>

                          {/* ── Edit → navigate to /[id] ── */}
                          <TableCell className={cn(cb,"w-[80px] sticky z-30 bg-[#0a0d14]")} style={{left: "32px", backgroundColor: isSelected ? "rgba(251,146,60,0.06)" : "#0a0d14"}}>
                            <button
                              onClick={()=>router.push(`/taskflow/customer-database/${c.id}`)}
                              className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest border border-orange-500/20 text-orange-500/60 hover:border-orange-500/50 hover:text-orange-400 hover:bg-orange-500/10 transition-colors whitespace-nowrap">
                              <ExternalLink size={9} /> Edit
                            </button>
                          </TableCell>

                          <TableCell className={cn(cb,"w-[100px] sticky z-30 bg-[#0a0d14]")} style={{left: "112px", backgroundColor: isSelected ? "rgba(251,146,60,0.06)" : "#0a0d14"}}><StatusBadge status={c.status} /></TableCell>

                          <TableCell className={cn(cb,"w-[180px] sticky z-30 bg-[#0a0d14]")} style={{left: "212px", backgroundColor: isSelected ? "rgba(251,146,60,0.06)" : "#0a0d14"}}>
                            <div className={cn("font-mono text-[11px] uppercase leading-tight text-slate-200",
                              (isDuplicate||isMissingType||isMissingStatus)&&"line-through decoration-red-500/70 decoration-2")}>
                              {c.company_name||"—"}
                            </div>
                          </TableCell>

                          <TableCell className={cn(cb,"min-w-[160px] text-slate-400 font-mono text-[11px]")}>{c.account_reference_number||"—"}</TableCell>

                          <TableCell className={cn(cb,"min-w-[120px] text-slate-500")}>{c.company_group||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[130px] text-slate-300 capitalize")}>{c.contact_person||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[120px] text-slate-400 font-mono")}>{c.contact_number||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[180px] text-slate-500")}>{c.email_address||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[100px]")}>
                            <span className={cn("text-slate-300",isMissingType&&"line-through decoration-red-500/70 decoration-2 text-slate-600")}>{c.type_client||"—"}</span>
                          </TableCell>
                          <TableCell className={cn(cb,"min-w-[80px] text-slate-500")}>{c.industry||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[60px] text-slate-500 capitalize")}>{c.gender||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[200px] text-slate-500 whitespace-normal break-words max-w-[200px]")}>{c.address||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[200px] text-slate-500 whitespace-normal break-words max-w-[200px]")}>{c.delivery_address||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[100px] text-slate-300")}>{c.region||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[100px] text-slate-500")}>{c.province||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[100px] text-slate-500")}>{c.city||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[120px] text-slate-500 whitespace-normal break-words max-w-[120px]")}>{c.remarks||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[120px] capitalize")}>{renderUserCell(c.referenceid)}</TableCell>
                          <TableCell className={cn(cb,"min-w-[120px] capitalize")}>{renderUserCell(c.tsm)}</TableCell>
                          <TableCell className={cn(cb,"min-w-[120px] capitalize")}>{renderUserCell(c.manager)}</TableCell>
                          <TableCell className={cn(cb,"min-w-[100px] text-slate-500")}>{c.transfer_to||"—"}</TableCell>
                          <TableCell className={cn(cb,"min-w-[100px] text-slate-500 font-mono text-[10px]")}>{fmtDate(c.date_created)}</TableCell>
                          <TableCell className={cn(cb,"min-w-[100px] text-slate-500 font-mono text-[10px]")}>{fmtDate(c.date_updated)}</TableCell>
                          <TableCell className={cn(cb,"min-w-[100px] text-slate-500 font-mono text-[10px]")}>{fmtDate(c.next_available_date)}</TableCell>
                          <TableCell className={cn(cb,"min-w-[100px] text-slate-500 font-mono text-[10px]")}>{fmtDate(c.date_transferred)}</TableCell>
                          <TableCell className={cn(cb,"min-w-[100px] text-slate-500 font-mono text-[10px]")}>{fmtDate(c.date_approved)}</TableCell>
                          <TableCell className={cn(cb,"min-w-[100px] text-slate-500 font-mono text-[10px]")}>{fmtDate(c.date_removed)}</TableCell>
                          <TableCell className={cn(cb,"min-w-[130px] font-mono text-[10px]")}>
                            {c.it_approved_date
                              ? <span className="text-emerald-400/80">{fmtDate(c.it_approved_date)}</span>
                              : <span className="text-slate-700">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-16 flex flex-col items-center gap-3">
                  <div className="relative p-3 border border-orange-500/20 bg-orange-500/5">
                    <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-orange-500/40" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-orange-500/40" />
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/40" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/40" />
                    <Search className="size-5 text-orange-500/30" />
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-orange-500/30">No records found</p>
                </div>
              )}
            </div>{/* end table */}

            {/* ── AI Insights Panel ── */}
            {insightsOpen && (
              <div className="w-80 shrink-0 flex flex-col border-l overflow-hidden"
                style={{ borderColor:"#a78bfa40", backgroundColor:"#0d1117" }}>
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor:"#a78bfa30", backgroundColor:"#0d0f1a" }}>
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-3.5" style={{ color:"#a78bfa" }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color:"#a78bfa" }}>AI Insights</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleAnalyze} disabled={isAnalyzing} title="Re-analyze"
                      className="h-5 w-5 flex items-center justify-center border transition-colors disabled:opacity-40"
                      style={{ borderColor:"#a78bfa40", color:"#a78bfa", backgroundColor:"transparent" }}
                      onMouseEnter={e=>(e.currentTarget.style.backgroundColor="rgba(167,139,250,0.1)")}
                      onMouseLeave={e=>(e.currentTarget.style.backgroundColor="transparent")}>
                      <RotateCcw className="size-2.5" />
                    </button>
                    <button onClick={()=>setInsightsOpen(false)}
                      className="h-5 w-5 flex items-center justify-center border transition-colors"
                      style={{ borderColor:"rgb(30,41,59)", color:"rgb(100,116,139)", backgroundColor:"transparent" }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor="#f87171"; e.currentTarget.style.color="#f87171"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgb(30,41,59)"; e.currentTarget.style.color="rgb(100,116,139)"; }}>
                      <X className="size-2.5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin"
                          style={{ borderColor:"#a78bfa", borderTopColor:"transparent" }} />
                        <Sparkles className="absolute inset-0 m-auto size-4" style={{ color:"#a78bfa" }} />
                      </div>
                      <p className="text-[10px] font-mono uppercase tracking-widest animate-pulse text-center" style={{ color:"#a78bfa" }}>
                        Groq analyzing {analyzedCount || filtered.length} customers…
                      </p>
                    </div>
                  ) : !analysis ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
                      <Sparkles className="size-8 opacity-20" style={{ color:"#a78bfa" }} />
                      <p className="text-[10px] font-mono" style={{ color:"rgb(71,85,105)" }}>No analysis yet</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {/* Overview */}
                      <div className="p-3 border" style={{ borderColor:"#a78bfa30", backgroundColor:"rgba(167,139,250,0.05)" }}>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 font-mono" style={{ color:"#a78bfa" }}>Overview</p>
                        <p className="text-[11px] leading-relaxed font-mono" style={{ color:"rgb(203,213,225)" }}>{analysis.overview}</p>
                      </div>
                      {/* Metrics */}
                      {analysis.metrics && Object.keys(analysis.metrics).length > 0 && (
                        <div className="border" style={{ borderColor:"rgb(30,41,59)" }}>
                          <div className="px-3 py-2 border-b" style={{ borderColor:"rgb(30,41,59)", backgroundColor:"#0a0d14" }}>
                            <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 font-mono" style={{ color:"rgb(251,146,60)" }}>
                              <BarChart3 className="size-3" /> Metrics
                            </p>
                          </div>
                          <div className="divide-y" style={{ borderColor:"rgba(37,48,64,0.5)" }}>
                            {Object.entries(analysis.metrics).filter(([,v])=>v).map(([k,v]) => (
                              <div key={k} className="flex items-center justify-between px-3 py-1.5">
                                <span className="text-[10px] capitalize font-mono" style={{ color:"rgb(100,116,139)" }}>{k.replace(/([A-Z])/g,' $1').trim()}</span>
                                <span className="text-[10px] font-bold font-mono" style={{ color:"rgb(203,213,225)" }}>{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Problems */}
                      {(analysis.problems?.length??0) > 0 && (
                        <div className="border" style={{ borderColor:"#f8717130" }}>
                          <button onClick={()=>setExpandedSection(s=>s==="problems"?null:"problems")}
                            className="w-full flex items-center justify-between px-3 py-2 border-b"
                            style={{ borderColor:"#f8717130", backgroundColor:"rgba(248,113,113,0.05)" }}>
                            <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 font-mono" style={{ color:"#f87171" }}>
                              <AlertTriangle className="size-3" /> Problems ({analysis.problems.length})
                            </p>
                            {expandedSection==="problems" ? <ChevronUp className="size-3" style={{ color:"#f87171" }}/> : <ChevronDown className="size-3" style={{ color:"#f87171" }}/>}
                          </button>
                          {expandedSection==="problems" && (
                            <div className="divide-y" style={{ borderColor:"rgba(37,48,64,0.3)" }}>
                              {analysis.problems.map((p,i) => {
                                const sev = SEVERITY_STYLE[p.severity] ?? SEVERITY_STYLE.medium;
                                return (
                                  <div key={i} className="px-3 py-2.5">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border font-mono"
                                        style={{ borderColor:sev.color+"40", color:sev.color, backgroundColor:sev.bg }}>{p.severity}</span>
                                      {p.count && <span className="text-[9px] font-mono" style={{ color:"rgb(71,85,105)" }}>×{p.count}</span>}
                                    </div>
                                    <p className="text-[10px] font-bold font-mono" style={{ color:"rgb(203,213,225)" }}>{p.title}</p>
                                    <p className="text-[10px] mt-0.5 leading-relaxed font-mono" style={{ color:"rgb(100,116,139)" }}>{p.description}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Patterns */}
                      {(analysis.patterns?.length??0) > 0 && (
                        <div className="border" style={{ borderColor:"#60a5fa30" }}>
                          <button onClick={()=>setExpandedSection(s=>s==="patterns"?null:"patterns")}
                            className="w-full flex items-center justify-between px-3 py-2 border-b"
                            style={{ borderColor:"#60a5fa30", backgroundColor:"rgba(96,165,250,0.05)" }}>
                            <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 font-mono" style={{ color:"#60a5fa" }}>
                              <TrendingUp className="size-3" /> Patterns ({analysis.patterns.length})
                            </p>
                            {expandedSection==="patterns" ? <ChevronUp className="size-3" style={{ color:"#60a5fa" }}/> : <ChevronDown className="size-3" style={{ color:"#60a5fa" }}/>}
                          </button>
                          {expandedSection==="patterns" && (
                            <div className="divide-y" style={{ borderColor:"rgba(37,48,64,0.3)" }}>
                              {analysis.patterns.map((p,i) => (
                                <div key={i} className="px-3 py-2.5">
                                  <p className="text-[10px] font-bold font-mono" style={{ color:"rgb(203,213,225)" }}>{p.title}</p>
                                  <p className="text-[10px] mt-0.5 leading-relaxed font-mono" style={{ color:"rgb(100,116,139)" }}>{p.description}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Recommendations */}
                      {(analysis.recommendations?.length??0) > 0 && (
                        <div className="border" style={{ borderColor:"#34d39930" }}>
                          <button onClick={()=>setExpandedSection(s=>s==="recs"?null:"recs")}
                            className="w-full flex items-center justify-between px-3 py-2 border-b"
                            style={{ borderColor:"#34d39930", backgroundColor:"rgba(52,211,153,0.05)" }}>
                            <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 font-mono" style={{ color:"#34d399" }}>
                              <Lightbulb className="size-3" /> Recommendations ({analysis.recommendations.length})
                            </p>
                            {expandedSection==="recs" ? <ChevronUp className="size-3" style={{ color:"#34d399" }}/> : <ChevronDown className="size-3" style={{ color:"#34d399" }}/>}
                          </button>
                          {expandedSection==="recs" && (
                            <div className="divide-y" style={{ borderColor:"rgba(37,48,64,0.3)" }}>
                              {analysis.recommendations.map((r,i) => {
                                const pc = PRIORITY_COLOR[r.priority] ?? "#60a5fa";
                                return (
                                  <div key={i} className="px-3 py-2.5">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border font-mono"
                                        style={{ borderColor:pc+"40", color:pc, backgroundColor:pc+"10" }}>{r.priority}</span>
                                    </div>
                                    <p className="text-[10px] font-bold font-mono" style={{ color:"rgb(203,213,225)" }}>{r.title}</p>
                                    <p className="text-[10px] mt-0.5 leading-relaxed font-mono" style={{ color:"rgb(100,116,139)" }}>{r.description}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-[9px] text-center pb-2 font-mono" style={{ color:"rgb(71,85,105)" }}>
                        Groq · llama-3.3-70b · {analyzedCount} customers analyzed
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>{/* end flex row */}
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* ── Dialogs ── */}
      <TransferDialog
        open={showTransferDialog} onOpenChangeAction={v=>setShowTransferDialog(v)}
        selectedIds={new Set(Array.from(selectedIds).map(String))}
        setSelectedIdsAction={(ids:Set<string>)=>setSelectedIdsAction(new Set(Array.from(ids).map(id=>Number(id))))}
        setAccountsAction={(updateFn)=>setCustomers(prev=>updateFn(prev))}
        tsas={tsas} tsms={tsms} managers={managers} onSuccessAction={handleTransferSuccess}
      />

      {/* ── Import Dialog ── */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-lg bg-[#0d1117] border-none text-slate-100 rounded-none p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-slate-700/60 bg-[#0d1117]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 border border-orange-500/30">
                <Upload className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold uppercase tracking-widest text-orange-400">Import Customer Database</DialogTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">Upload an Excel file to import customers</p>
              </div>
              {(importFile||importSelectedManager) && (
                <Button variant="ghost" size="sm" disabled={isImportLoading} className="ml-auto h-7 text-[9px] uppercase font-bold text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-none"
                  onClick={()=>{ setImportFile(null); setImportOriginalFileName(null); setImportPreviewData([]); setImportFailedRows([]); setImportSelectedManager(""); setImportSelectedTSM(""); setImportSelectedTSA(""); setParseLog([]); }}>
                  <RotateCcw className="mr-1 h-3 w-3" /> Reset
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
            <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase text-slate-500">Manager</label><Combobox options={importManagerOptions} value={importSelectedManager} onValueChange={setImportSelectedManager} placeholder="Select Manager…" disabled={isImportLoading} className="bg-slate-800 border-slate-700 text-slate-200 rounded-none" /></div>
            <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase text-slate-500">Territory Sales Manager</label><Combobox options={importTsmOptions} value={importSelectedTSM} onValueChange={setImportSelectedTSM} placeholder="Select TSM…" disabled={isImportLoading||!importSelectedManager} emptyText={!importSelectedManager?"Select a Manager first.":"No TSMs found."} className="bg-slate-800 border-slate-700 text-slate-200 rounded-none" /></div>
            <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase text-slate-500">Territory Sales Associate <span className="text-red-400">*</span></label><Combobox options={importTsaOptions} value={importSelectedTSA} onValueChange={setImportSelectedTSA} placeholder="Select TSA…" disabled={isImportLoading||!importSelectedTSM} emptyText={!importSelectedManager?"Select a Manager first.":!importSelectedTSM?"Select a TSM first.":"No TSAs found."} className="bg-slate-800 border-slate-700 text-slate-200 rounded-none" /></div>
            <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase text-slate-500">Excel File <span className="text-red-400">*</span></label><DropZone file={importFile} fileName={importOriginalFileName} onFileSelect={handleFileSelect} onClear={()=>{ setImportFile(null); setImportOriginalFileName(null); setImportPreviewData([]); setParseLog([]); }} disabled={isImportLoading} /></div>
            {parseLog.length>0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1.5"><Terminal className="w-3 h-3" /> Parse Output {isParsing&&<Loader2 className="w-3 h-3 animate-spin" />}</label>
                <div className="border border-zinc-700 bg-zinc-950 overflow-hidden rounded-none">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
                    <span className="w-2 h-2 rounded-full bg-red-500" /><span className="w-2 h-2 rounded-full bg-yellow-500" /><span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-mono text-[10px] text-zinc-500 ml-1 select-none">parser — bash</span>
                  </div>
                  <div className="px-3 py-2 font-mono text-[10px] space-y-0.5 max-h-36 overflow-y-auto">
                    {parseLog.map((line,i)=><div key={i} className={cn("leading-relaxed",parseLogColor(line.type))}>{line.msg}</div>)}
                    {isParsing&&<span className="inline-block w-1.5 h-3 bg-emerald-400 animate-pulse align-middle" />}
                    <div ref={parseLogEndRef} />
                  </div>
                </div>
              </div>
            )}
            {importPreviewData.length>0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-500">Preview ({importPreviewData.length} rows)</label>
                <div className="overflow-auto max-h-44 border border-slate-700 rounded-none text-[10px]">
                  <table className="w-full whitespace-nowrap">
                    <thead className="bg-slate-800 sticky top-0"><tr>{["Company","Contact","Email","Type","Region","Status"].map(h=><th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-800">
                      {importPreviewData.slice(0,20).map((row,i)=><tr key={i} className="hover:bg-slate-800/40 text-slate-300"><td className="px-2 py-1 truncate max-w-[100px]">{row.company_name}</td><td className="px-2 py-1 truncate max-w-[80px]">{row.contact_person}</td><td className="px-2 py-1 truncate max-w-[100px]">{row.email_address}</td><td className="px-2 py-1">{row.type_client}</td><td className="px-2 py-1">{row.region}</td><td className="px-2 py-1">{row.status}</td></tr>)}
                      {importPreviewData.length>20&&<tr><td colSpan={6} className="px-2 py-1.5 text-center text-slate-500 italic">+{importPreviewData.length-20} more rows</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="px-6 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={()=>setShowImportDialog(false)} className="h-8 text-xs rounded-none text-slate-400 hover:text-slate-200 hover:bg-slate-700">Close</Button>
            <div className="flex gap-2 items-center">
              {importFailedRows.length>0 && <Button variant="ghost" size="sm" onClick={handleDownloadFailed} className="h-8 text-xs rounded-none bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 gap-1"><DownloadIcon className="h-3.5 w-3.5" />Failed ({importFailedRows.length})</Button>}
              {importPreviewData.length > 0 && !isImportLoading && (
                <span className="text-[11px] font-mono text-slate-500 mr-1">
                  {importPreviewData.length} rows ready
                </span>
              )}
              <Button
                onClick={handleImportUpload}
                disabled={isImportLoading || !importFile || !importSelectedTSA}
                className="h-9 text-[11px] font-bold rounded-none bg-orange-600 hover:bg-orange-500 text-white border-0 px-6 gap-2 uppercase tracking-widest disabled:opacity-40">
                {isImportLoading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Importing…</>
                  : <><Upload className="h-3.5 w-3.5" />Import All ({importPreviewData.length || 0})</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import All Dialog (CSV, no TSA picker) ── */}
      <Dialog open={showImportAllDialog} onOpenChange={v => { setShowImportAllDialog(v); if (!v) { setImportAllFile(null); setImportAllPreview([]); setImportAllLog([]); setImportAllFailed([]); } }}>
        <DialogContent className="max-w-lg bg-[#0d1117] border-none text-slate-100 rounded-none p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-slate-700/60 bg-[#0d1117]">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-sm font-bold uppercase tracking-widest text-emerald-400">Import All — CSV</DialogTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">Upload a CSV with headers. All 30 columns read directly from the file.</p>
              </div>
              {(importAllFile || importAllLog.length > 0) && (
                <Button variant="ghost" size="sm" disabled={isImportAllLoading}
                  className="ml-auto h-7 text-[9px] uppercase font-bold text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-none"
                  onClick={() => { setImportAllFile(null); setImportAllPreview([]); setImportAllLog([]); setImportAllFailed([]); }}>
                  <RotateCcw className="mr-1 h-3 w-3" /> Reset
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Column reference */}
            <div className="text-[10px] font-mono text-slate-600 leading-relaxed border border-slate-800 bg-[#080d12] px-3 py-2 rounded-none">
              <span className="text-slate-500 font-bold">Expected columns (header row 1):</span><br/>
              referenceid · tsm · manager · company_name · contact_person · contact_number · email_address · address · delivery_address · region · industry · remarks · status · type_client · company_group · gender · type · account_reference_number · date_created · date_updated · next_available_date · date_transferred · province · city · date_approved · date_removed · transfer_to · tin_number · reason · it_approved_date
            </div>

            {/* Drop zone */}
            <div>
              <label
                htmlFor="import-all-csv"
                className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed cursor-pointer transition-colors rounded-none ${
                  importAllFile ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-700 bg-[#080d12] hover:border-emerald-500/30 hover:bg-emerald-500/5"
                }`}>
                {isImportAllParsing ? (
                  <><Loader2 className="h-5 w-5 animate-spin text-emerald-400 mb-1" /><span className="text-[11px] text-slate-400">Parsing…</span></>
                ) : importAllFile ? (
                  <><FileSpreadsheet className="h-6 w-6 text-emerald-400 mb-1" /><span className="text-[11px] font-bold text-emerald-300">{importAllFile.name}</span><span className="text-[10px] text-slate-500">{importAllPreview.length} rows parsed</span></>
                ) : (
                  <><Upload className="h-5 w-5 text-slate-600 mb-1" /><span className="text-[11px] text-slate-500">Drop CSV here or click to browse</span><span className="text-[10px] text-slate-700 mt-0.5">.csv files only</span></>
                )}
                <input id="import-all-csv" type="file" accept=".csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImportAllFileSelect(f); e.target.value = ""; }} />
              </label>
            </div>

            {/* Parse log */}
            {importAllLog.length > 0 && (
              <div className="bg-black/40 border border-slate-800 rounded-none p-3 max-h-36 overflow-y-auto font-mono text-[10px] space-y-0.5">
                {importAllLog.map((l, i) => (
                  <div key={i} className={
                    l.type === "ok"   ? "text-emerald-400" :
                    l.type === "warn" ? "text-amber-400" :
                    l.type === "err"  ? "text-red-400" :
                    "text-slate-500"
                  }>{l.msg}</div>
                ))}
                <div ref={importAllLogEndRef} />
              </div>
            )}

            {/* Preview count */}
            {importAllPreview.length > 0 && (
              <div className="flex items-center justify-between text-[11px] font-mono border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <span className="text-emerald-400 font-bold">{importAllPreview.length} records ready to import</span>
                <span className="text-slate-600">{Object.keys(importAllPreview[0] ?? {}).length} columns detected</span>
              </div>
            )}
          </div>

          <div className="px-6 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setShowImportAllDialog(false)} className="h-8 text-xs rounded-none text-slate-400 hover:text-slate-200 hover:bg-slate-700">Close</Button>
            <div className="flex gap-2 items-center">
              {importAllFailed.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleDownloadImportAllFailed}
                  className="h-8 text-xs rounded-none bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 gap-1">
                  <DownloadIcon className="h-3.5 w-3.5" /> Failed ({importAllFailed.length})
                </Button>
              )}
              <Button
                onClick={handleImportAllUpload}
                disabled={isImportAllLoading || !importAllFile || importAllPreview.length === 0}
                className="h-9 text-[11px] font-bold rounded-none bg-emerald-600 hover:bg-emerald-500 text-white border-0 px-6 gap-2 uppercase tracking-widest disabled:opacity-40">
                {isImportAllLoading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Importing…</>
                  : <><Upload className="h-3.5 w-3.5" />Import All ({importAllPreview.length})</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Filter Dialog ── */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="max-w-md bg-[#0d1117] border-none text-slate-100 rounded-none p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-slate-700/60 bg-[#0d1117]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 border border-orange-500/30"><SlidersHorizontal className="w-4 h-4 text-slate-300" /></div>
                <div><DialogTitle className="text-sm font-bold uppercase tracking-widest text-orange-400">Filters</DialogTitle><p className="text-[11px] text-slate-500 mt-0.5">Narrow down the customer list</p></div>
              </div>
              {hasActiveFilters && <Button variant="ghost" size="sm" onClick={handleResetFilters} className="h-7 text-[9px] uppercase font-bold text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-none"><RotateCcw className="mr-1 h-3 w-3" /> Reset</Button>}
            </div>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase text-slate-500">Manager</label><Combobox options={filterManagerOptions} value={filterManager} onValueChange={v=>{setFilterManager(v||"all");setPage(1);}} placeholder="All Managers" className="bg-slate-800 border-slate-700 text-slate-200 rounded-none" /></div>
            <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase text-slate-500">Sales Manager (TSM)</label><Combobox options={filterTsmOptions} value={filterTSM} onValueChange={v=>{setFilterTSM(v||"all");setPage(1);}} placeholder="All TSM" className="bg-slate-800 border-slate-700 text-slate-200 rounded-none" /></div>
            <div className="space-y-1.5"><label className="text-[10px] font-bold uppercase text-slate-500">Sales Associate (TSA)</label><Combobox options={filterTsaOptions} value={filterTSA} onValueChange={v=>{setFilterTSA(v||"all");setPage(1);}} placeholder="All TSA" className="bg-slate-800 border-slate-700 text-slate-200 rounded-none" /></div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500">Client Type</label>
              <Select value={filterType} onValueChange={v=>{setFilterType(v);setPage(1);}}>
                <SelectTrigger className="h-9 text-xs rounded-none bg-slate-800 border-slate-700 text-slate-200"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">{typeOptions.map(t=><SelectItem key={t} value={t} className="text-xs capitalize focus:bg-orange-500/10 focus:text-orange-400">{t==="all"?"All Types":t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500">Status</label>
              <Select value={filterStatus} onValueChange={v=>{setFilterStatus(v);setPage(1);}}>
                <SelectTrigger className="h-9 text-xs rounded-none bg-slate-800 border-slate-700 text-slate-200"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  {statusOptions.map(s=>(
                    <SelectItem key={s} value={s} className="text-xs capitalize focus:bg-orange-500/10 focus:text-orange-400">
                      {s==="all"?"All Statuses":s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500">Sort Order</label>
              <Select value={sortOrder} onValueChange={v=>setSortOrder(v as "asc"|"desc")}>
                <SelectTrigger className="h-9 text-xs rounded-none bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200"><SelectItem value="desc" className="text-xs focus:bg-orange-500/10 focus:text-orange-400">Latest First</SelectItem><SelectItem value="asc" className="text-xs focus:bg-orange-500/10 focus:text-orange-400">Oldest First</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500">Rows per Page</label>
              <Select value={rowsPerPage.toString()} onValueChange={v=>{setRowsPerPage(Number(v));setPage(1);}}>
                <SelectTrigger className="h-9 text-xs rounded-none bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">{[20,50,100,1000,12000,30000].map(n=><SelectItem key={n} value={n.toString()} className="text-xs focus:bg-orange-500/10 focus:text-orange-400">{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="px-6 py-3 border-t border-slate-700/60 bg-slate-800/60 flex justify-end">
            <Button onClick={()=>setShowFilterDialog(false)} className="h-8 text-xs rounded-none bg-orange-600 hover:bg-orange-500 text-white border-0 px-5 uppercase tracking-wider">Apply</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Others Dialog ── */}
      <Dialog open={showOthersDialog} onOpenChange={setShowOthersDialog}>
        <DialogContent className="max-w-2xl bg-[#0d1117] border-none text-slate-100 rounded-none p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-slate-700/60 bg-[#0d1117]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 border border-orange-500/30">
                <Settings className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold uppercase tracking-widest text-orange-400">Bulk Update Options</DialogTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">Select a bulk update method</p>
              </div>
              {(bulkUpdateFile||bulkUpdatePreview.length>0) && (
                <Button variant="ghost" size="sm" disabled={isBulkUpdateLoading} className="ml-auto h-7 text-[9px] uppercase font-bold text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-none"
                  onClick={()=>{ setBulkUpdateFile(null); setBulkUpdateFileName(null); setBulkUpdatePreview([]); setBulkUpdateColumns([]); setBulkUpdateLog([]); }}>
                  <RotateCcw className="mr-1 h-3 w-3" /> Reset
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500">Update Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setBulkUpdateMode("byId"); setBulkUpdateFile(null); setBulkUpdateFileName(null); setBulkUpdatePreview([]); setBulkUpdateColumns([]); setBulkUpdateLog([]); }}
                  className={cn("p-3 border rounded-none text-left transition-all", bulkUpdateMode === "byId" ? "border-orange-500 bg-orange-500/10" : "border-slate-700 hover:border-slate-600 bg-slate-800/30")}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-200 mb-1">BULK UPDATE BY ID</div>
                  <div className="text-[10px] text-slate-500">Update all fields using account reference number as identifier</div>
                </button>
                <button
                  onClick={() => { setBulkUpdateMode("byTsaTsmManager"); setBulkUpdateFile(null); setBulkUpdateFileName(null); setBulkUpdatePreview([]); setBulkUpdateColumns([]); setBulkUpdateLog([]); }}
                  className={cn("p-3 border rounded-none text-left transition-all", bulkUpdateMode === "byTsaTsmManager" ? "border-orange-500 bg-orange-500/10" : "border-slate-700 hover:border-slate-600 bg-slate-800/30")}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-200 mb-1">BULK UPDATE BY TSA, TSM, MANAGER, STATUS, INDUSTRY AND TYPE CLIENT BY ID</div>
                  <div className="text-[10px] text-slate-500">Update TSA, TSM, Manager, Status, Industry, and Type Client fields using account reference number</div>
                </button>
              </div>
            </div>
            <div className="space-y-4 overflow-y-auto max-h-[70vh]">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500">Excel/CSV File <span className="text-red-400">*</span></label>
              <DropZone file={bulkUpdateFile} fileName={bulkUpdateFileName} onFileSelect={handleBulkUpdateFileSelect} onClear={()=>{ setBulkUpdateFile(null); setBulkUpdateFileName(null); setBulkUpdatePreview([]); setBulkUpdateColumns([]); setBulkUpdateLog([]); }} disabled={isBulkUpdateLoading} />
            </div>
            {bulkUpdateLog.length>0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1.5"><Terminal className="w-3 h-3" /> Update Log {isBulkUpdateParsing&&<Loader2 className="w-3 h-3 animate-spin" />}</label>
                <div className="border border-zinc-700 bg-zinc-950 overflow-hidden rounded-none">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
                    <span className="w-2 h-2 rounded-full bg-red-500" /><span className="w-2 h-2 rounded-full bg-yellow-500" /><span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-mono text-[10px] text-zinc-500 ml-1 select-none">bulk-update — bash</span>
                  </div>
                  <div className="px-3 py-2 font-mono text-[10px] space-y-0.5 max-h-36 overflow-y-auto">
                    {bulkUpdateLog.map((line,i)=><div key={i} className={cn("leading-relaxed",parseLogColor(line.type))}>{line.msg}</div>)}
                    {(isBulkUpdateParsing||isBulkUpdateLoading)&&<span className="inline-block w-1.5 h-3 bg-emerald-400 animate-pulse align-middle" />}
                    <div ref={bulkUpdateLogEndRef} />
                  </div>
                </div>
              </div>
            )}
            {bulkUpdatePreview.length>0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-500">Preview ({bulkUpdatePreview.length} rows)</label>
                <div className="overflow-auto max-h-44 border border-slate-700 rounded-none text-[10px]">
                  <table className="w-full whitespace-nowrap">
                    <thead className="bg-slate-800 sticky top-0">
                      <tr>
                        {bulkUpdateColumns.slice(0,8).map(col=><th key={col} className="px-2 py-1.5 text-left font-semibold text-slate-400 uppercase tracking-wider">{col}</th>)}
                        {bulkUpdateColumns.length>8&&<th className="px-2 py-1.5 text-left font-semibold text-slate-400 uppercase tracking-wider">...</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {bulkUpdatePreview.slice(0,10).map((row,i)=><tr key={i} className="hover:bg-slate-800/40 text-slate-300">
                        {bulkUpdateColumns.slice(0,8).map(col=><td key={col} className="px-2 py-1 truncate max-w-[100px]">{row[col]||""}</td>)}
                        {bulkUpdateColumns.length>8&&<td className="px-2 py-1 text-slate-500">...</td>}
                      </tr>)}
                      {bulkUpdatePreview.length>10&&<tr><td colSpan={bulkUpdateColumns.length>8?9:8} className="px-2 py-1.5 text-center text-slate-500 italic">+{bulkUpdatePreview.length-10} more rows</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          </div>
          <div className="px-6 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={()=>setShowOthersDialog(false)} className="h-8 text-xs rounded-none text-slate-400 hover:text-slate-200 hover:bg-slate-700">Close</Button>
            <Button onClick={handleBulkUpdateUpload} disabled={isBulkUpdateLoading||!bulkUpdateFile||!bulkUpdatePreview.length} className="h-8 text-xs rounded-none bg-orange-600 hover:bg-orange-500 text-white border-0 px-5 gap-2 uppercase tracking-wider">
              {isBulkUpdateLoading?<><Loader2 className="h-3.5 w-3.5 animate-spin" />Updating...</>:<><Upload className="h-3.5 w-3.5" />Update Records</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedPageWrapper>
  );
}
