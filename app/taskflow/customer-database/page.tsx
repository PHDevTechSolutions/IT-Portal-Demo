"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as ExcelJS from "exceljs";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
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
  Loader2,
  Search,
  ArrowRight,
  Check,
  ChevronsUpDown,
  FileSpreadsheet,
  Upload,
  X,
  RotateCcw,
  Download as DownloadIcon,
  BadgeCheck,
  AlertTriangle,
  Clock,
  XCircle,
  PauseCircle,
  UserX,
  UserCheck,
  Hash,
  SlidersHorizontal,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ButtonGroup } from "@/components/ui/button-group";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { cn } from "@/lib/utils";
import {
  logCustomerAudit,
  type AuditActor,
  type TransferDetail,
} from "@/lib/audit/customer-audit";
import type { TransferSuccessPayload } from "@/components/taskflow/customer-database/transfer";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditKey = "duplicates" | "missingType" | "missingStatus";

interface Customer {
  id: number;
  account_reference_number: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  region: string;
  type_client: string;
  referenceid: string;
  tsm: string;
  manager: string;
  status: string;
  remarks: string;
  industry: string;
  date_created: string;
  date_updated: string;
  next_available_date?: string;
}

interface UserRecord {
  referenceId: string;
  name: string;
  status: string;
}

interface ComboOption {
  value: string;
  label: string;
  status?: string;
}

const INACTIVE_STATUSES = ["Terminated", "Resigned", "Inactive"];
const AUDIT_PAGE = "Customer Database";

// ─── Safe JSON ────────────────────────────────────────────────────────────────

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(
      `[safeJson] Non-JSON (HTTP ${res.status}) from ${res.url}\n`,
      text.slice(0, 300),
    );
    return null;
  }
}

// ─── Excel Parser (pure, module-level) ───────────────────────────────────────

async function parseExcelForFile(
  file: File,
  tsaValue: string,
  managerValue: string,
  tsmValue: string,
): Promise<any[]> {
  const reader = new FileReader();
  return new Promise<any[]>((resolve, reject) => {
    reader.onload = async (event) => {
      try {
        const data = event.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);
        const worksheet = workbook.worksheets[0];
        const parsed: any[] = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          parsed.push({
            referenceid: tsaValue,
            manager: managerValue,
            tsm: tsmValue,
            tsa: tsaValue,
            company_name: row.getCell(1).value || "",
            contact_person: row.getCell(2).value || "",
            contact_number: row.getCell(3).value || "",
            email_address: row.getCell(4).value || "",
            type_client: row.getCell(5).value || "",
            address: row.getCell(6).value || "",
            region: row.getCell(7).value || "",
            status: row.getCell(8).value || "",
            company_group: row.getCell(9).value || "",
            delivery_address: row.getCell(10).value || "",
            industry: row.getCell(11).value || "",
          });
        });
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ─── Combobox ─────────────────────────────────────────────────────────────────

interface ComboboxProps {
  options: ComboOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
  className?: string;
}

function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  disabled = false,
  emptyText = "No results found.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-9 text-xs rounded-none",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 min-w-[220px]" align="start">
        <Command>
          <CommandInput placeholder="Search…" className="h-9 text-xs" />
          <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">
            {emptyText}
          </CommandEmpty>
          <CommandGroup className="max-h-56 overflow-auto">
            {options.map((opt) => (
              <CommandItem
                key={opt.value}
                value={opt.label}
                onSelect={() => {
                  onValueChange(opt.value === value ? "" : opt.value);
                  setOpen(false);
                }}
                className="text-xs"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4 flex-shrink-0",
                    value === opt.value ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="truncate">{opt.label}</span>
                {opt.status && INACTIVE_STATUSES.includes(opt.status) && (
                  <span
                    className={cn(
                      "ml-auto text-[9px] font-bold px-1 py-0.5 rounded-full leading-none",
                      opt.status === "Terminated"
                        ? "bg-red-100 text-red-700"
                        : opt.status === "Resigned"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-100 text-gray-600",
                    )}
                  >
                    {opt.status}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── DropZone ─────────────────────────────────────────────────────────────────

interface DropZoneProps {
  file: File | null;
  fileName: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

function DropZone({
  file,
  fileName,
  onFileSelect,
  onClear,
  disabled,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) onFileSelect(f);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "relative border-2 border-dashed rounded-none p-5 text-center cursor-pointer transition-all select-none",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/30",
        disabled && "opacity-50 pointer-events-none",
        file && "border-primary/40 bg-primary/5",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        disabled={disabled}
        onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
      />
      {file ? (
        <div className="flex flex-col items-center gap-1.5">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <p className="text-xs font-medium text-foreground truncate max-w-[180px]">
            {fileName}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Click to replace or drag a new file
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-1.5 right-1.5 h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-xs font-semibold text-foreground">
            Drag & drop an Excel file
          </p>
          <p className="text-[10px] text-muted-foreground">
            or click to browse (.xlsx, .xls)
          </p>
        </div>
      )}
    </div>
  );
}

// ─── EditCustomerDialog ───────────────────────────────────────────────────────

interface EditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onSave: (updated: Customer) => void;
  actorRef: React.MutableRefObject<AuditActor>;
}

function EditCustomerDialog({
  open,
  onOpenChange,
  customer,
  onSave,
  actorRef,
}: EditCustomerDialogProps) {
  const [form, setForm] = useState<Customer | null>(null);

  useEffect(() => {
    if (customer) {
      setForm({
        ...customer,
        company_name: customer.company_name ?? "",
        contact_person: customer.contact_person ?? "",
        contact_number: customer.contact_number ?? "",
        email_address: customer.email_address ?? "",
        address: customer.address ?? "",
        region: customer.region ?? "",
        type_client: customer.type_client ?? "",
        status: customer.status ?? "",
        remarks: customer.remarks ?? "",
        account_reference_number: customer.account_reference_number ?? "",
        tsm: customer.tsm ?? "",
        manager: customer.manager ?? "",
        referenceid: customer.referenceid ?? "",
      });
    } else {
      setForm(null);
    }
  }, [customer]);

  if (!form) return null;

  const handleChange = (key: keyof Customer, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSubmit = async () => {
    if (!form || !customer) return;
    try {
      const res = await fetch(
        "/api/Data/Applications/Taskflow/CustomerDatabase/Edit",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const result = (await safeJson(res)) ?? {};
      if (!res.ok || !result.success) {
        toast.error(result.error || `Update failed (HTTP ${res.status})`);
        return;
      }
      onSave(form);
      toast.success("Customer updated successfully");
      onOpenChange(false);

      const TRACKED: (keyof Customer)[] = [
        "company_name",
        "contact_person",
        "contact_number",
        "email_address",
        "address",
        "region",
        "type_client",
        "status",
        "remarks",
      ];
      const changes: Record<string, { before: unknown; after: unknown }> = {};
      for (const key of TRACKED) {
        if (customer[key] !== form[key])
          changes[key] = {
            before: customer[key] ?? null,
            after: form[key] ?? null,
          };
      }
      if (Object.keys(changes).length > 0) {
        await logCustomerAudit({
          action: "update",
          affectedCount: 1,
          customerId: String(form.id),
          customerName: form.company_name,
          changes,
          actor: actorRef.current,
          context: {
            page: AUDIT_PAGE,
            source: "EditCustomerDialog",
            bulk: false,
          },
        });
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Input
            placeholder="Company Name"
            value={form.company_name ?? ""}
            onChange={(e) => handleChange("company_name", e.target.value)}
          />
          <Input
            placeholder="Contact Person"
            value={form.contact_person ?? ""}
            onChange={(e) => handleChange("contact_person", e.target.value)}
          />
          <Input
            placeholder="Contact Number"
            value={form.contact_number ?? ""}
            onChange={(e) => handleChange("contact_number", e.target.value)}
          />
          <Input
            placeholder="Email Address"
            value={form.email_address ?? ""}
            onChange={(e) => handleChange("email_address", e.target.value)}
          />
          <Input
            placeholder="Type Client"
            value={form.type_client ?? ""}
            onChange={(e) => handleChange("type_client", e.target.value)}
          />
          <Input
            placeholder="Status"
            value={form.status ?? ""}
            onChange={(e) => handleChange("status", e.target.value)}
          />
          <Input
            placeholder="Region"
            value={form.region ?? ""}
            onChange={(e) => handleChange("region", e.target.value)}
          />
          <Input
            placeholder="Remarks"
            value={form.remarks ?? ""}
            onChange={(e) => handleChange("remarks", e.target.value)}
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string | null }) {
  const s = (status ?? "").trim().toLowerCase();
  if (!s)
    return (
      <Badge variant="outline" className="text-muted-foreground">
        —
      </Badge>
    );
  if (s === "active")
    return (
      <Badge
        variant="secondary"
        className="bg-green-500/90 hover:bg-green-600 text-white flex items-center gap-1"
      >
        <BadgeCheck className="size-3.5" /> Active
      </Badge>
    );
  if (s === "new client")
    return (
      <Badge
        variant="secondary"
        className="bg-blue-500/90 hover:bg-blue-600 text-white flex items-center gap-1"
      >
        <UserCheck className="size-3.5" /> New Client
      </Badge>
    );
  if (s === "non-buying")
    return (
      <Badge
        variant="secondary"
        className="bg-yellow-500/90 hover:bg-yellow-600 text-white flex items-center gap-1"
      >
        <AlertTriangle className="size-3.5" /> Non-Buying
      </Badge>
    );
  if (s === "inactive")
    return (
      <Badge
        variant="secondary"
        className="bg-red-500/90 hover:bg-red-600 text-white flex items-center gap-1"
      >
        <XCircle className="size-3.5" /> Inactive
      </Badge>
    );
  if (s === "on hold")
    return (
      <Badge
        variant="secondary"
        className="bg-stone-500/90 hover:bg-stone-600 text-white flex items-center gap-1"
      >
        <PauseCircle className="size-3.5" /> On Hold
      </Badge>
    );
  if (s === "used")
    return (
      <Badge
        variant="secondary"
        className="bg-blue-900 hover:bg-blue-800 text-white flex items-center gap-1"
      >
        <Clock className="size-3.5" /> Used
      </Badge>
    );
  if (s === "park")
    return (
      <Badge
        variant="secondary"
        className="bg-slate-500/90 hover:bg-slate-600 text-white flex items-center gap-1"
      >
        <PauseCircle className="size-3.5" /> Parked
      </Badge>
    );
  if (s === "for deletion" || s === "remove")
    return (
      <Badge
        variant="secondary"
        className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1"
      >
        <UserX className="size-3.5" /> {status}
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {status}
    </Badge>
  );
}

// ─── AccountPage ──────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);

  // ── Customer table state ────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [filterTSA, setFilterTSA] = useState("all");
  const [filterTSM, setFilterTSM] = useState("all");
  const [filterManager, setFilterManager] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ── Audit state ─────────────────────────────────────────────────────────────
  const [audited, setAudited] = useState<Customer[]>([]);
  const [isAuditView, setIsAuditView] = useState(false);
  const [duplicateIds, setDuplicateIds] = useState<Set<number>>(new Set());
  const [auditFilter, setAuditFilter] = useState<
    "" | "all" | "missingType" | "missingStatus" | "duplicates"
  >("");
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [auditSelection, setAuditSelection] = useState({
    duplicates: false,
    missingType: false,
    missingStatus: false,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Fetch / loading state ───────────────────────────────────────────────────
  const [isFetching, setIsFetching] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  // ── ReferenceID → user record map — fetched once after customers load ────────
  // Single MongoDB query covers all roles; used for table display + filter labels.
  const [refIdUserMap, setRefIdUserMap] = useState<Map<string, UserRecord>>(
    new Map(),
  );

  // ── Selection state ─────────────────────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedIds, setSelectedIdsAction] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // ── Transfer state ──────────────────────────────────────────────────────────
  const [tsas, setTsas] = useState<ComboOption[]>([]);
  const [tsms, setTsms] = useState<ComboOption[]>([]);
  const [managers, setManagers] = useState<ComboOption[]>([]);
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  // ── Auto-generate state ─────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Actor / audit refs ──────────────────────────────────────────────────────
  const [currentActor, setCurrentActor] = useState<AuditActor>({
    uid: null,
    name: null,
    email: null,
    role: null,
    referenceId: null,
  });
  const currentActorRef = useRef<AuditActor>(currentActor);
  useEffect(() => {
    currentActorRef.current = currentActor;
  }, [currentActor]);
  const preTransferSnapshotRef = useRef<Customer[]>([]);

  // ── Import form state ───────────────────────────────────────────────────────
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importOriginalFileName, setImportOriginalFileName] = useState<
    string | null
  >(null);
  const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
  const [importFailedRows, setImportFailedRows] = useState<any[]>([]);
  const [importManagerOptions, setImportManagerOptions] = useState<
    ComboOption[]
  >([]);
  const [importTsmOptions, setImportTsmOptions] = useState<ComboOption[]>([]);
  const [importTsaOptions, setImportTsaOptions] = useState<ComboOption[]>([]);
  const [importSelectedManager, setImportSelectedManager] = useState("");
  const [importSelectedTSM, setImportSelectedTSM] = useState("");
  const [importSelectedTSA, setImportSelectedTSA] = useState("");
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // ── Parse console state ─────────────────────────────────────────────────────
  const [parseLog, setParseLog] = useState<
    { type: "info" | "warn" | "ok" | "err"; msg: string }[]
  >([]);
  const [isParsing, setIsParsing] = useState(false);
  const parseLogEndRef = useRef<HTMLDivElement>(null);

  const addParseLog = useCallback(
    (type: "info" | "warn" | "ok" | "err", msg: string) =>
      setParseLog((prev) => [...prev, { type, msg }]),
    [],
  );

  useEffect(() => {
    parseLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [parseLog]);

  // ── Load current actor ──────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("currentUser");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      setCurrentActor({
        uid: parsed.uid ?? null,
        name: parsed.name ?? null,
        email: parsed.email ?? null,
        role: parsed.role ?? null,
        referenceId: parsed.referenceId ?? null,
      });
    } catch {
      console.warn("[CustomerAudit] Could not read user from localStorage.");
    }
  }, []);

  // ── Resolve display names for all referenceIDs in the loaded customer set ────
  // Fires whenever the customer list changes. Collects every unique referenceid,
  // tsm, and manager value, then fetches matching user records from MongoDB via
  // the generic /api/UserManagement/Fetch endpoint. The resulting map is used
  // for table column display and as fallback labels in filter comboboxes.
  useEffect(() => {
    if (customers.length === 0) return;

    const uniqueIds = new Set<string>();
    for (const c of customers) {
      if (c.referenceid?.trim())
        uniqueIds.add(c.referenceid.trim().toLowerCase());
      if (c.tsm?.trim()) uniqueIds.add(c.tsm.trim().toLowerCase());
      if (c.manager?.trim()) uniqueIds.add(c.manager.trim().toLowerCase());
    }
    if (uniqueIds.size === 0) return;

    const fetchUserNames = async () => {
      try {
        const res = await fetch("/api/UserManagement/Fetch");
        if (!res.ok) return;
        const data = await safeJson(res);
        const users: any[] = Array.isArray(data) ? data : (data?.data ?? []);

        const map = new Map<string, UserRecord>();
        for (const u of users) {
          const refId = (u.ReferenceID ?? "").trim();
          if (!refId) continue;
          const key = refId.toLowerCase();
          if (uniqueIds.has(key)) {
            map.set(key, {
              referenceId: refId,
              name: `${u.Firstname ?? ""} ${u.Lastname ?? ""}`.trim() || refId,
              status: u.Status ?? "Active",
            });
          }
        }
        setRefIdUserMap(map);
      } catch (err) {
        console.error("[CustomerDatabase] Failed to resolve user names:", err);
      }
    };

    fetchUserNames();
  }, [customers]);

  // ── Fetch customers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      setIsFetching(true);
      const toastId = toast.loading("Fetching customer data...");
      try {
        const response = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/Fetch",
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await safeJson(response);
        if (!json) throw new Error("Invalid JSON from server");
        setCustomers(json.data || []);
        toast.success("Customer data loaded successfully!", { id: toastId });
      } catch (err: any) {
        toast.error(`Failed to load customer data: ${err.message}`, {
          id: toastId,
        });
      } finally {
        setIsFetching(false);
      }
    };
    fetchData();
  }, []);

  // ── Fetch dropdowns for TransferDialog ─────────────────────────────────────
  useEffect(() => {
    if (!showTransferDialog) return;
    const fetchDropdowns = async () => {
      try {
        const [tsaRes, tsmRes, managerRes] = await Promise.all([
          fetch("/api/UserManagement/FetchTSA?Role=Territory Sales Associate"),
          fetch("/api/UserManagement/FetchTSM?Role=Territory Sales Manager"),
          fetch("/api/UserManagement/FetchManager?Role=Manager"),
        ]);
        const [tsaData, tsmData, managerData] = await Promise.all([
          tsaRes.ok ? safeJson(tsaRes) : [],
          tsmRes.ok ? safeJson(tsmRes) : [],
          managerRes.ok ? safeJson(managerRes) : [],
        ]);
        setTsas(
          (Array.isArray(tsaData) ? tsaData : []).map((m: any) => ({
            label: `${m.Firstname} ${m.Lastname}`,
            value: m.ReferenceID,
          })),
        );
        setTsms(
          (Array.isArray(tsmData) ? tsmData : []).map((t: any) => ({
            label: `${t.Firstname} ${t.Lastname}`,
            value: t.ReferenceID,
          })),
        );
        setManagers(
          (Array.isArray(managerData) ? managerData : []).map((m: any) => ({
            label: `${m.Firstname} ${m.Lastname}`,
            value: m.ReferenceID,
          })),
        );
      } catch {
        toast.error("Failed to fetch manager/TSM lists.");
      }
    };
    fetchDropdowns();
  }, [showTransferDialog]);

  // ── Import form: fetch managers ─────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/UserManagement/FetchManager?Role=Manager")
      .then((res) => res.json())
      .then((data) => {
        const opts: ComboOption[] = (Array.isArray(data) ? data : [])
          .map((u: any) => ({
            value: u.ReferenceID,
            label: `${u.Firstname} ${u.Lastname}`,
          }))
          .sort((a: ComboOption, b: ComboOption) =>
            a.label.localeCompare(b.label),
          );
        setImportManagerOptions(opts);
      })
      .catch((err) => console.error("Error fetching managers:", err));
  }, []);

  // ── Import form: fetch TSMs scoped to selected manager ──────────────────────
  useEffect(() => {
    if (!importSelectedManager) {
      setImportTsmOptions([]);
      setImportSelectedTSM("");
      setImportSelectedTSA("");
      return;
    }

    fetch(
      `/api/UserManagement/FetchTSM?Role=Territory Sales Manager&managerReferenceID=${importSelectedManager}`,
    )
      .then((res) => res.json())
      .then((data) => {
        const opts: ComboOption[] = (Array.isArray(data) ? data : [])
          .map((u: any) => ({
            value: u.ReferenceID,
            label: `${u.Firstname} ${u.Lastname}`,
          }))
          .sort((a: ComboOption, b: ComboOption) =>
            a.label.localeCompare(b.label),
          );
        setImportTsmOptions(opts);
      })
      .catch((err) => console.error("Error fetching TSMs:", err));
  }, [importSelectedManager]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIdsAction(new Set());
      setSelectAll(false);
    } else {
      setSelectedIdsAction(new Set(current.map((c) => c.id)));
      setSelectAll(true);
    }
  };

  const handleAutoGenerate = async () => {
    if (selectedIds.size === 0) {
      toast.error("No customers selected.");
      return;
    }

    setIsGenerating(true);

    try {
      const selectedCustomers = customers.filter((c) => selectedIds.has(c.id));

      // Helper to get initials from company_name
      const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      };

      // For each customer, build ref based on initials + region (instead of hardcoded "NCR")
      const updates = selectedCustomers.map((customer, index) => {
        const initials = getInitials(customer.company_name);
        // Get region code or fallback to 'NCR'
        const regionCode = (customer.region || "NCR").toUpperCase().replace(/\s+/g, "");

        // Sequence number with leading zeros length 10
        const seqNum = (index + 1).toString().padStart(10, "0");

        // Format: [Initials]-[RegionCode]-[Sequence]
        const newRef = `${initials}-${regionCode}-${seqNum}`;

        return {
          id: customer.id,
          account_reference_number: newRef,
        };
      });

      const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/UpdateReferenceNumber", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      const result = await res.json();

      if (result.success) {
        setCustomers((prev) =>
          prev.map((c) => {
            const update = updates.find((u) => u.id === c.id);
            if (update) return { ...c, referenceid: update.account_reference_number };
            return c;
          }),
        );
        toast.success("Reference numbers generated and updated successfully.");
      } else {
        toast.error(result.error || "Failed to update reference numbers.");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred during update.");
    } finally {
      setIsGenerating(false);
    }
  };

  function EditCustomerDialog({
    open,
    onOpenChange,
    customer,
    onSave,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    customer: Customer | null;
    onSave: (updated: Customer) => void;
  }) {
    const [form, setForm] = useState<Customer | null>(customer);

    useEffect(() => {
      setForm(customer);
    }, [customer]);

    if (!form) return null;

    const handleChange = (key: keyof Customer, value: string) => {
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    };

    const handleSubmit = async () => {
      try {
        const res = await fetch(
          `/api/Data/Applications/Taskflow/CustomerDatabase/Edit`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          },
        );

        const result = await res.json();

        if (!result.success) {
          toast.error(result.error || "Update failed");
          return;
        }

        onSave(form);
        toast.success("Customer updated successfully");
        onOpenChange(false);
      } catch (err) {
        toast.error("Something went wrong");
      }
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Input
              placeholder="Company Name"
              value={form.company_name}
              onChange={(e) => handleChange("company_name", e.target.value)}
            />
            <Input
              placeholder="Contact Person"
              value={form.contact_person}
              onChange={(e) => handleChange("contact_person", e.target.value)}
            />
            <Input
              placeholder="Contact Number"
              value={form.contact_number}
              onChange={(e) => handleChange("contact_number", e.target.value)}
            />
            <Input
              placeholder="Email Address"
              value={form.email_address}
              onChange={(e) => handleChange("email_address", e.target.value)}
            />
            <Input
              placeholder="Type"
              value={form.type_client}
              onChange={(e) => handleChange("type_client", e.target.value)}
            />
            <Input
              placeholder="Status"
              value={form.status}
              onChange={(e) => handleChange("status", e.target.value)}
            />
            <Input
              placeholder="Region"
              value={form.region}
              onChange={(e) => handleChange("region", e.target.value)}
            />
            <Input
              placeholder="Remarks"
              value={form.remarks}
              onChange={(e) => handleChange("remarks", e.target.value)}
            />
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const nullIndustryCount = useMemo(() => {
    return customers.filter((c) => !c.industry || !c.industry.toString().trim()).length;
  }, [customers]);

  // ── Filtered + sorted data ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return customers
      .filter((c) =>
        [
          c.company_name,
          c.contact_person,
          c.email_address,
          c.region,
          c.manager,
          c.tsm,
        ].some((field) => field?.toLowerCase().includes(search.toLowerCase())),
      )
      .filter((c) =>
        filterType === "all" ? true : c.type_client === filterType,
      )
      .filter((c) =>
        filterStatus === "all" ? true : c.status === filterStatus,
      )
      .filter((c) =>
        filterTSA === "all"
          ? true
          : c.referenceid?.trim().toLowerCase() === filterTSA.trim().toLowerCase(),
      )
      .filter((c) =>
        filterTSM === "all"
          ? true
          : (c.tsm ?? "").trim().toLowerCase() === filterTSM.trim().toLowerCase(),
      )
      .filter((c) =>
        filterManager === "all"
          ? true
          : (c.manager ?? "").trim().toLowerCase() === filterManager.trim().toLowerCase(),
      )
      .filter((c) => {
        if (!startDate && !endDate) return true;
        const created = new Date(c.date_created).getTime();
        const start = startDate ? new Date(startDate).getTime() : null;
        const end = endDate ? new Date(endDate).getTime() : null;
        if (start && created < start) return false;
        if (end && created > end) return false;
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date_created).getTime();
        const dateB = new Date(b.date_created).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });
  }, [
    customers,
    search,
    filterType,
    filterStatus,
    filterTSA,
    filterTSM,
    filterManager,
    startDate,
    endDate,
    sortOrder,
  ]);

  const displayData = useMemo(() => {
    if (!isAuditView) return filtered;
    if (auditFilter === "" || auditFilter === "all") return audited;
    if (auditFilter === "missingType")
      return audited.filter((c) => !c.type_client?.trim() && c.status?.trim());
    if (auditFilter === "missingStatus")
      return audited.filter((c) => !c.status?.trim() && c.type_client?.trim());
    if (auditFilter === "duplicates")
      return audited.filter((c) => duplicateIds.has(c.id));
    return audited;
  }, [filtered, audited, isAuditView, auditFilter, duplicateIds]);

  const totalPages = Math.max(1, Math.ceil(displayData.length / rowsPerPage));
  const current = displayData.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
  );
  const totalCount = filtered.length;

  // ── Derived: filter options from customer data ───────────────────────────────
  const typeOptions = useMemo(() => {
    const types = [...new Set(customers.map((c) => c.type_client).filter(Boolean))].sort();
    return ["all", ...types];
  }, [customers]);

  const statusOptions = useMemo(() => {
    const statuses = [...new Set(customers.map((c) => c.status).filter(Boolean))].sort();
    return ["all", ...statuses];
  }, [customers]);

  const filterTsaOptions = useMemo<ComboOption[]>(() => {
    const seen = new Map<string, ComboOption>();
    for (const c of customers) {
      const key = (c.referenceid ?? "").trim();
      if (!key || seen.has(key.toLowerCase())) continue;
      const user = refIdUserMap.get(key.toLowerCase());
      seen.set(key.toLowerCase(), {
        value: key,
        label: user?.name || key,
        status: user?.status,
      });
    }
    return [
      { value: "all", label: "All TSA" },
      ...Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [customers, refIdUserMap]);

  const filterTsmOptions = useMemo<ComboOption[]>(() => {
    const seen = new Map<string, ComboOption>();
    for (const c of customers) {
      const key = (c.tsm ?? "").trim();
      if (!key || seen.has(key.toLowerCase())) continue;
      const user = refIdUserMap.get(key.toLowerCase());
      seen.set(key.toLowerCase(), {
        value: key,
        label: user?.name || key,
        status: user?.status,
      });
    }
    return [
      { value: "all", label: "All TSM" },
      ...Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [customers, refIdUserMap]);

  const filterManagerOptions = useMemo<ComboOption[]>(() => {
    const seen = new Map<string, ComboOption>();
    for (const c of customers) {
      const key = (c.manager ?? "").trim();
      if (!key || seen.has(key.toLowerCase())) continue;
      const user = refIdUserMap.get(key.toLowerCase());
      seen.set(key.toLowerCase(), {
        value: key,
        label: user?.name || key,
        status: user?.status,
      });
    }
    return [
      { value: "all", label: "All Manager" },
      ...Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [customers, refIdUserMap]);

  const handleReturn = () => {
    setIsAuditView(false);
    setAuditFilter("");
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIdsAction(next);
  };

  const toggleAuditSelection = (key: keyof typeof auditSelection) => {
    setAuditSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const executeBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsDeleting(true);
    const toastId = toast.loading("Deleting selected customers…");
    try {
      const res = await fetch(
        "/api/Data/Applications/Taskflow/CustomerDatabase/BulkDelete",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        },
      );
      const result = await safeJson(res);
      if (!res.ok || !result?.success) {
        toast.error(result?.error || "Delete failed", { id: toastId });
        return;
      }
      toast.success(`Deleted ${ids.length} customer(s)`, { id: toastId });
      setCustomers((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      setSelectedIdsAction(new Set());
      setSelectAll(false);

      await logCustomerAudit({
        action: "delete",
        affectedCount: ids.length,
        actor: currentActorRef.current,
        context: {
          page: AUDIT_PAGE,
          source: "DeleteDialog",
          bulk: true,
        },
      });
    } catch {
      toast.error("Delete error", { id: toastId });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
              Home
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Taskflow</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Customer Database</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          {/* Main Content */}
          <div className="flex-1 overflow-auto px-4 py-2">
            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 py-3">
              {/* Search Input */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-full pr-8"
                />
                {isFiltering && (
                  <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Right-Side Button Group */}
              <div className="flex flex-wrap items-center justify-end w-full gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters((prev) => !prev)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
                <Calendar
                  startDate={startDate}
                  endDate={endDate}
                  setStartDateAction={setStartDate}
                  setEndDateAction={setEndDate}
                />
                <Download data={filtered} filename="CustomerDatabase" />
                {selectedIds.size > 0 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowTransferDialog(true)}
                    >
                      <ArrowRight className="w-4 h-4" /> Transfer
                    </Button>
                    <Button
                      onClick={handleAutoGenerate}
                      disabled={isGenerating}
                    >
                      {isGenerating ? "Generating..." : "Auto-Generate ID"} (
                      {selectedIds.size})
                    </Button>
                    <Button
                      onClick={() => setShowDeleteDialog(true)}
                      variant="destructive"
                    >
                      Delete Selected ({selectedIds.size})
                    </Button>
                  </>
                )}

                {!isAuditView ? (
                  <Audit
                    customers={customers}
                    setAuditedAction={setAudited}
                    setDuplicateIdsAction={setDuplicateIds}
                    setIsAuditViewAction={setIsAuditView}
                  />
                ) : (
                  <Button variant="outline" onClick={handleReturn}>
                    Return to List
                  </Button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium mb-1 block">TSA</label>
                    <Combobox
                      options={filterTsaOptions}
                      value={filterTSA}
                      onValueChange={setFilterTSA}
                      placeholder="Select TSA..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">TSM</label>
                    <Combobox
                      options={filterTsmOptions}
                      value={filterTSM}
                      onValueChange={setFilterTSM}
                      placeholder="Select TSM..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Manager</label>
                    <Combobox
                      options={filterManagerOptions}
                      value={filterManager}
                      onValueChange={setFilterManager}
                      placeholder="Select Manager..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Type</label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t === "all" ? "All Types" : t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Status</label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s === "all" ? "All Statuses" : s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Sort Order</label>
                    <Select
                      value={sortOrder}
                      onValueChange={(v) => setSortOrder(v as "asc" | "desc")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Newest First</SelectItem>
                        <SelectItem value="asc">Oldest First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Rows per page</label>
                    <Select
                      value={rowsPerPage.toString()}
                      onValueChange={(v) => setRowsPerPage(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 20, 50, 100].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} rows
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

                    {isAuditView && (
                        <div className="mx-4 mb-2 mt-1 flex flex-col gap-2 bg-muted/50 rounded-md px-4 py-2 border border-border text-[13px]">
                            {/* 🔍 Top Row: Summary + Buttons */}
                            <div className="flex justify-between items-center flex-wrap gap-2">
                                {/* 🧾 Audit Summary (left) */}
                                <div
                                    className="font-medium cursor-pointer select-none underline text-red-600"
                                    onClick={() => {
                                        // Default: lahat ng audit type unchecked
                                        setAuditSelection({
                                            duplicates: true,      // pwede default checked
                                            missingType: true,
                                            missingStatus: true,
                                        });
                                        setShowAuditDialog(true);
                                    }}
                                >
                                    🧾 Audit Summary: <span className="font-semibold text-red-600">{audited.length}</span> total issues found
                                </div>

                                {/* 🧩 Button Group Filters (right side) */}
                                <div className="flex flex-wrap gap-2 justify-end ml-auto">
                                    <ButtonGroup aria-label="Audit Filter Buttons" className="flex">
                                        <Button
                                            size="sm"
                                            variant={auditFilter === "missingType" ? "secondary" : "outline"}
                                            className={`rounded-l-md ${auditFilter === "missingType" ? "bg-yellow-100 text-yellow-900" : ""
                                                }`}
                                            onClick={() =>
                                                setAuditFilter(auditFilter === "missingType" ? "" : "missingType")
                                            }
                                        >
                                            ⚠ Missing Type:{" "}
                                            {audited.filter((c) => !c.type_client?.trim() && c.status?.trim()).length}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={auditFilter === "missingStatus" ? "secondary" : "outline"}
                                            className={
                                                auditFilter === "missingStatus"
                                                    ? "bg-yellow-100 text-yellow-900"
                                                    : ""
                                            }
                                            onClick={() =>
                                                setAuditFilter(auditFilter === "missingStatus" ? "" : "missingStatus")
                                            }
                                        >
                                            ⚠ Missing Status:{" "}
                                            {audited.filter((c) => !c.status?.trim() && c.type_client?.trim()).length}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={auditFilter === "duplicates" ? "secondary" : "outline"}
                                            className={`rounded-r-md ${auditFilter === "duplicates" ? "bg-red-100 text-red-900" : ""
                                                }`}
                                            onClick={() =>
                                                setAuditFilter(auditFilter === "duplicates" ? "" : "duplicates")
                                            }
                                        >
                                            🔁 Duplicates: {Array.from(duplicateIds).length}
                                        </Button>
                                    </ButtonGroup>
                                </div>
                            </div>
                        </div>
                    )}

                    <DeleteDialog
                        open={showDeleteDialog}
                        onOpenChange={setShowDeleteDialog}
                        selectedCount={selectedIds.size}
                        onConfirm={executeBulkDelete}
                    />

                    <AuditDialog
                        open={showAuditDialog}
                        onOpenChange={setShowAuditDialog}
                        customers={customers}
                        onConfirmAudit={(result) => {
                            setAudited(result.allAffectedCustomers);
                            setDuplicateIds(result.duplicateIds);
                            setIsAuditView(true);
                        }}
                    />

                    {/* Table */}
                    <div className="p-4">
                        <div className="flex justify-start mb-2">
                            <Badge variant="outline">{`Total: ${totalCount}`}</Badge>
                        </div>
                        <div className="overflow-auto min-h-[200px] flex items-center justify-center">
                            {isFetching ? (
                                <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
                                    <Loader2 className="size-6 animate-spin" />
                                    <span>Loading customers...</span>
                                </div>

                            ) : current.length > 0 ? (
                                <Table className="whitespace-nowrap text-[13px] min-w-full">
                                    <TableHeader className="bg-muted sticky top-0 z-10">
                                        <TableRow>
                                            <TableHead className="w-8 text-center"><input type="checkbox" checked={selectAll} onChange={handleSelectAll} /></TableHead>
                                            <TableHead className="text-center">Actions</TableHead>
                                            <TableHead>Company</TableHead>
                                            <TableHead>Contact</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Industry {`Missing Industry: ${nullIndustryCount}`}</TableHead>
                                            <TableHead>Area</TableHead>
                                            <TableHead>TSA</TableHead>
                                            <TableHead>TSM</TableHead>
                                            <TableHead>Manager</TableHead>
                                            <TableHead>Date Created</TableHead>
                                            <TableHead>Date Updated</TableHead>
                                            <TableHead>Next Available</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody className="text-[12px]">
                                        {current.map((c) => {
                                            const isMissingType = !c.type_client?.trim()
                                            const isMissingStatus = !c.status?.trim()
                                            const isDuplicate = duplicateIds.has(c.id)
                                            const isSelected = selectedIds.has(c.id)

                                            return (
                                                <TableRow key={c.id}>
                                                    <TableCell className="text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelect(c.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setEditingCustomer(c)
                                                                setShowEditDialog(true)
                                                            }}
                                                        >
                                                            Edit
                                                        </Button>
                                                    </TableCell>

                                                    <TableCell
                                                        className="uppercase whitespace-normal break-words max-w-[250px]"
                                                    >
                                                        <span
                                                            className={
                                                                isDuplicate || isMissingType || isMissingStatus
                                                                    ? "line-through underline decoration-red-500 decoration-2"
                                                                    : ""
                                                            }
                                                        >
                                                            {c.company_name} <br />{c.account_reference_number}
                                                        </span>
                                                    </TableCell>

                                                    <TableCell className="capitalize whitespace-normal break-words max-w-[200px]">
                                                        {c.contact_person}
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal break-words max-w-[250px]">
                                                        {c.email_address}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span
                                                            className={
                                                                isMissingType
                                                                    ? "line-through underline decoration-red-500 decoration-2"
                                                                    : ""
                                                            }
                                                        >
                                                            {c.type_client || "—"}
                                                        </span>
                                                    </TableCell>

                                                    <TableCell className="text-center">
                                                        {c.status ? (
                                                            (() => {
                                                                const status = c.status.trim().toLowerCase()
                                                                switch (status) {
                                                                    case "active":
                                                                        return (
                                                                            <Badge
                                                                                variant="secondary"
                                                                                className="bg-green-500/90 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700 flex items-center gap-1 transition-colors duration-200"
                                                                            >
                                                                                <BadgeCheck className="size-3.5" />
                                                                                Active
                                                                            </Badge>
                                                                        )
                                                                    case "new client":
                                                                        return (
                                                                            <Badge
                                                                                variant="secondary"
                                                                                className="bg-blue-500/90 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700 flex items-center gap-1 transition-colors duration-200"
                                                                            >
                                                                                <UserCheck className="size-3.5" />
                                                                                New Client
                                                                            </Badge>
                                                                        )
                                                                    case "non-buying":
                                                                        return (
                                                                            <Badge
                                                                                variant="secondary"
                                                                                className="bg-yellow-500/90 hover:bg-yellow-600 text-white dark:bg-yellow-600 dark:hover:bg-yellow-700 flex items-center gap-1 transition-colors duration-200"
                                                                            >
                                                                                <AlertTriangle className="size-3.5" />
                                                                                Non-Buying
                                                                            </Badge>
                                                                        )
                                                                    case "inactive":
                                                                        return (
                                                                            <Badge
                                                                                variant="secondary"
                                                                                className="bg-red-500/90 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700 flex items-center gap-1 transition-colors duration-200"
                                                                            >
                                                                                <XCircle className="size-3.5" />
                                                                                Inactive
                                                                            </Badge>
                                                                        )
                                                                    case "on hold":
                                                                        return (
                                                                            <Badge
                                                                                variant="secondary"
                                                                                className="bg-stone-500/90 hover:bg-stone-600 text-white dark:bg-stone-600 dark:hover:bg-stone-700 flex items-center gap-1 transition-colors duration-200"
                                                                            >
                                                                                <PauseCircle className="size-3.5" />
                                                                                On Hold
                                                                            </Badge>
                                                                        )
                                                                    case "used":
                                                                        return (
                                                                            <Badge
                                                                                variant="secondary"
                                                                                className="bg-blue-900 hover:bg-blue-800 text-white flex items-center gap-1 transition-colors duration-200"
                                                                            >
                                                                                <Clock className="size-3.5" />
                                                                                Used
                                                                            </Badge>
                                                                        )
                                                                    case "for deletion":
                                                                    case "remove":
                                                                        return (
                                                                            <Badge
                                                                                variant="secondary"
                                                                                className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800 flex items-center gap-1 transition-colors duration-200"
                                                                            >
                                                                                <UserX className="size-3.5" />
                                                                                {c.status}
                                                                            </Badge>
                                                                        )
                                                                    default:
                                                                        return (
                                                                            <Badge
                                                                                variant="outline"
                                                                                className="text-muted-foreground hover:bg-muted transition-colors duration-200"
                                                                            >
                                                                                {c.status}
                                                                            </Badge>
                                                                        )
                                                                }
                                                            })()
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-muted-foreground hover:bg-muted transition-colors duration-200"
                                                            >
                                                                —
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{c.industry}</TableCell>
                                                    <TableCell>{c.region}</TableCell>
                                                    <TableCell className="capitalize">
                                                        {(() => {
                                                            const key = c.referenceid?.trim().toLowerCase() || "";
                                                            const user = refIdUserMap.get(key);
                                                            return user?.name || c.referenceid || "-";
                                                        })()}
                                                    </TableCell>

                                                    <TableCell>{c.tsm}</TableCell>
                                                    <TableCell>{c.manager}</TableCell>
                                                    <TableCell>{new Date(c.date_created).toLocaleDateString()}</TableCell>
                                                    <TableCell>{new Date(c.date_updated).toLocaleDateString()}</TableCell>
                                                    <TableCell>
                                                        {c.next_available_date
                                                            ? new Date(c.next_available_date).toLocaleDateString()
                                                            : "-"}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="py-10 text-center text-xs text-muted-foreground">
                                    No customers found.
                                </div>
                            )}
                        </div>
                    </div>

                    <EditCustomerDialog
                        open={showEditDialog}
                        onOpenChange={setShowEditDialog}
                        customer={editingCustomer}
                        onSave={(updated) => {
                            setCustomers(prev =>
                                prev.map(c => c.id === updated.id ? updated : c)
                            )
                        }}
                    />

                    {/* Pagination */}
                    <div className="flex justify-center items-center gap-4 my-4">
                        {/* Pagination */}
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            onPageChangeAction={setPage}
                        />
                    </div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    );
}
