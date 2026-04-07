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
  useCustomers,
  useBulkDelete,
  useBulkTransfer,
  useUpdateReferenceNumbers,
  useImportCustomers,
} from "@/lib/hooks/useCustomers";
import { useAuditLogging } from "@/lib/hooks/useAuditLogging";
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
import { SciFiThreeColumn, SciFiPanel } from "@/components/ui/sci-fi/layout";
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
        delivery_address: customer.delivery_address ?? "",
        region: customer.region ?? "",
        province: customer.province ?? "",
        city: customer.city ?? "",
        type_client: customer.type_client ?? "",
        type: customer.type ?? "",
        status: customer.status ?? "",
        remarks: customer.remarks ?? "",
        industry: customer.industry ?? "",
        gender: customer.gender ?? "",
        company_group: customer.company_group ?? "",
        date_created: customer.date_created ?? "",
        date_updated: customer.date_updated ?? "",
        next_available_date: customer.next_available_date ?? "",
        date_transferred: customer.date_transferred ?? "",
        date_approved: customer.date_approved ?? "",
        date_removed: customer.date_removed ?? "",
        transfer_to: customer.transfer_to ?? "",
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
        "delivery_address",
        "region",
        "province",
        "city",
        "type_client",
        "type",
        "status",
        "remarks",
        "industry",
        "gender",
        "company_group",
        "next_available_date",
        "date_transferred",
        "date_approved",
        "date_removed",
        "transfer_to",
        "referenceid",
        "tsm",
        "manager",
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm max-h-[60vh] overflow-y-auto p-1">
          <Input
            placeholder="Account Reference Number"
            value={form.account_reference_number ?? ""}
            onChange={(e) => handleChange("account_reference_number", e.target.value)}
          />
          <Input
            placeholder="Company Name"
            value={form.company_name ?? ""}
            onChange={(e) => handleChange("company_name", e.target.value)}
          />
          <Input
            placeholder="Company Group"
            value={form.company_group ?? ""}
            onChange={(e) => handleChange("company_group", e.target.value)}
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
            placeholder="Address"
            value={form.address ?? ""}
            onChange={(e) => handleChange("address", e.target.value)}
          />
          <Input
            placeholder="Delivery Address"
            value={form.delivery_address ?? ""}
            onChange={(e) => handleChange("delivery_address", e.target.value)}
          />
          <Input
            placeholder="Region"
            value={form.region ?? ""}
            onChange={(e) => handleChange("region", e.target.value)}
          />
          <Input
            placeholder="Province"
            value={form.province ?? ""}
            onChange={(e) => handleChange("province", e.target.value)}
          />
          <Input
            placeholder="City"
            value={form.city ?? ""}
            onChange={(e) => handleChange("city", e.target.value)}
          />
          <Input
            placeholder="Industry"
            value={form.industry ?? ""}
            onChange={(e) => handleChange("industry", e.target.value)}
          />
          <Input
            placeholder="Gender"
            value={form.gender ?? ""}
            onChange={(e) => handleChange("gender", e.target.value)}
          />
          <Input
            placeholder="Type"
            value={form.type ?? ""}
            onChange={(e) => handleChange("type", e.target.value)}
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
            placeholder="Remarks"
            value={form.remarks ?? ""}
            onChange={(e) => handleChange("remarks", e.target.value)}
          />
          <Input
            placeholder="Next Available Date"
            value={form.next_available_date ?? ""}
            onChange={(e) => handleChange("next_available_date", e.target.value)}
          />
          <Input
            placeholder="Date Created"
            value={form.date_created ?? ""}
            onChange={(e) => handleChange("date_created", e.target.value)}
          />
          <Input
            placeholder="Date Updated"
            value={form.date_updated ?? ""}
            onChange={(e) => handleChange("date_updated", e.target.value)}
          />
          <Input
            placeholder="Date Transferred"
            value={form.date_transferred ?? ""}
            onChange={(e) => handleChange("date_transferred", e.target.value)}
          />
          <Input
            placeholder="Date Approved"
            value={form.date_approved ?? ""}
            onChange={(e) => handleChange("date_approved", e.target.value)}
          />
          <Input
            placeholder="Date Removed"
            value={form.date_removed ?? ""}
            onChange={(e) => handleChange("date_removed", e.target.value)}
          />
          <Input
            placeholder="Transfer To"
            value={form.transfer_to ?? ""}
            onChange={(e) => handleChange("transfer_to", e.target.value)}
          />
          <Input
            placeholder="Reference ID (TSA)"
            value={form.referenceid ?? ""}
            onChange={(e) => handleChange("referenceid", e.target.value)}
          />
          <Input
            placeholder="TSM"
            value={form.tsm ?? ""}
            onChange={(e) => handleChange("tsm", e.target.value)}
          />
          <Input
            placeholder="Manager"
            value={form.manager ?? ""}
            onChange={(e) => handleChange("manager", e.target.value)}
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

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);

  // ── React Query hooks with caching ───────────────────────────────────────────
  const {
    data: customersData,
    isLoading: isFetching,
    error: customersError,
  } = useCustomers();
  const bulkDeleteMutation = useBulkDelete();
  const bulkTransferMutation = useBulkTransfer();
  const updateReferenceNumbersMutation = useUpdateReferenceNumbers();
  const importCustomersMutation = useImportCustomers();

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

  // ── Fetch / loading state ───────────────────────────────────────────────────
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

  // ── Automated audit logging (after ref is defined) ──────────────────────────
  const { logCreate, logDelete, logTransfer, logAutoGenerate, logUpdate } =
    useAuditLogging(currentActorRef.current);

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

  // ── Sync customers from React Query ─────────────────────────────────────────
  useEffect(() => {
    if (customersData) {
      setCustomers(customersData);
    }
  }, [customersData]);

  // ── Show error toast if React Query fails ──────────────────────────────────
  useEffect(() => {
    if (customersError) {
      toast.error(`Failed to load customer data: ${customersError.message}`);
    }
  }, [customersError]);

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
        if (Array.isArray(data)) {
          const opts: ComboOption[] = data
            .map((u: any) => ({
              value: u.ReferenceID,
              label: `${u.Firstname} ${u.Lastname}`,
            }))
            .sort((a: ComboOption, b: ComboOption) =>
              a.label.localeCompare(b.label),
            );
          setImportTsmOptions(opts);
        } else {
          setImportTsmOptions([]);
        }
      })
      .catch((err) => console.error("Error fetching TSMs:", err));
    setImportSelectedTSM("");
    setImportSelectedTSA("");
  }, [importSelectedManager]);

  // ── Import form: fetch TSAs scoped to selected TSM ──────────────────────────
  useEffect(() => {
    if (!importSelectedTSM) {
      setImportTsaOptions([]);
      setImportSelectedTSA("");
      return;
    }
    fetch(
      `/api/UserManagement/FetchTSA?Role=Territory%20Sales%20Associate&managerReferenceID=${importSelectedTSM}`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const opts: ComboOption[] = data
            .map((u: any) => ({
              value: u.ReferenceID,
              label: `${u.Firstname} ${u.Lastname}`,
              status: u.Status ?? "Active",
            }))
            .sort((a: ComboOption, b: ComboOption) =>
              a.label.localeCompare(b.label),
            );
          setImportTsaOptions(opts);
        } else {
          setImportTsaOptions([]);
        }
      })
      .catch((err) => console.error("Error fetching TSAs:", err));
    setImportSelectedTSA("");
  }, [importSelectedTSM]);

  // ── Filter update effect ────────────────────────────────────────────────────
  useEffect(() => {
    setIsFiltering(true);
    const timer = setTimeout(() => {
      setIsFiltering(false);
      toast.info("Filter updated.");
    }, 600);
    return () => clearTimeout(timer);
  }, [search, filterType, filterStatus]);

  useEffect(
    () => setPage(1),
    [search, filterType, filterStatus, filterTSA, filterTSM, filterManager],
  );

  // ── Derived: filter options from customer data (alphabetically sorted) ──────
  const typeOptions = useMemo(() => {
    const types = [
      ...new Set(customers.map((c) => c.type_client).filter(Boolean)),
    ].sort();
    return ["all", ...types];
  }, [customers]);

  const statusOptions = useMemo(() => {
    const statuses = [
      ...new Set(customers.map((c) => c.status).filter(Boolean)),
    ].sort();
    return ["all", ...statuses];
  }, [customers]);

  // ── Filter combobox options — derived from customer data, names from refIdUserMap ──
  // The map is a fallback: if a user record wasn't found, the raw refId is shown.
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
      ...Array.from(seen.values()).sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
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
      ...Array.from(seen.values()).sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
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
      ...Array.from(seen.values()).sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
    ];
  }, [customers, refIdUserMap]);

  // ── Filtered + sorted data ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return customers
      .filter((c) =>
        [
          c.company_name,
          c.account_reference_number,
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
          : c.referenceid?.trim().toLowerCase() ===
            filterTSA.trim().toLowerCase(),
      )
      .filter((c) =>
        filterTSM === "all"
          ? true
          : (c.tsm ?? "").trim().toLowerCase() ===
            filterTSM.trim().toLowerCase(),
      )
      .filter((c) =>
        filterManager === "all"
          ? true
          : (c.manager ?? "").trim().toLowerCase() ===
            filterManager.trim().toLowerCase(),
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

  // ── Import handlers ─────────────────────────────────────────────────────────
  const handleFileSelect = async (file: File) => {
    setImportFile(file);
    setImportOriginalFileName(file.name.replace(/\.[^/.]+$/, ""));
    setParseLog([]);
    setIsParsing(true);
    addParseLog("info", `📂 Reading "${file.name}"…`);
    try {
      const data = await parseExcelForFile(
        file,
        importSelectedTSA,
        importSelectedManager,
        importSelectedTSM,
      );
      addParseLog("ok", `✅ Parsed ${data.length} row(s)`);

      const types = [
        ...new Set(data.map((r: any) => r.type_client).filter(Boolean)),
      ] as string[];
      const statuses = [
        ...new Set(data.map((r: any) => r.status).filter(Boolean)),
      ] as string[];
      const regions = [
        ...new Set(data.map((r: any) => r.region).filter(Boolean)),
      ] as string[];

      if (types.length)
        addParseLog(
          "info",
          `  → ${types.length} type(s): ${types.slice(0, 4).join(", ")}${types.length > 4 ? " …" : ""}`,
        );
      if (statuses.length)
        addParseLog(
          "info",
          `  → ${statuses.length} status(es): ${statuses.slice(0, 4).join(", ")}${statuses.length > 4 ? " …" : ""}`,
        );
      if (regions.length)
        addParseLog(
          "info",
          `  → ${regions.length} region(s): ${regions.slice(0, 4).join(", ")}${regions.length > 4 ? " …" : ""}`,
        );

      const missingStatus = data.filter((r: any) => !r.status?.trim()).length;
      const missingType = data.filter(
        (r: any) => !r.type_client?.trim(),
      ).length;
      if (missingStatus)
        addParseLog("warn", `  ⚠️  ${missingStatus} row(s) missing status`);
      if (missingType)
        addParseLog("warn", `  ⚠️  ${missingType} row(s) missing type`);

      addParseLog(
        "ok",
        `🚀 Ready — ${data.length} record(s) queued for upload`,
      );
      setImportPreviewData(data);
    } catch {
      addParseLog("err", `❌ Failed to parse "${file.name}"`);
      toast.error("Failed to parse Excel file.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleImportUpload = async () => {
    if (!importFile) return toast.error("Please select a file.");
    if (!importSelectedTSA) return toast.error("Please select a TSA.");

    setIsImportLoading(true);
    setImportFailedRows([]);

    try {
      const parsed = await parseExcelForFile(
        importFile,
        importSelectedTSA,
        importSelectedManager,
        importSelectedTSM,
      );
      const total = parsed.length;
      const batchSize = 10;
      const failed: any[] = [];

      for (let i = 0; i < total; i += batchSize) {
        const batch = parsed.slice(i, i + batchSize);
        toast(
          `Uploading ${i + 1}–${Math.min(i + batchSize, total)}/${total}: ${batch[0].company_name}`,
          { duration: 1000 },
        );
        const response = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/Import",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              referenceid: importSelectedTSA,
              tsm: importSelectedTSM || "",
              data: batch,
            }),
          },
        );
        const result = await response.json();
        if (!result.success && result.failed) failed.push(...result.failed);
      }

      const successCount = total - failed.length;
      if (failed.length > 0) {
        setImportFailedRows(failed);
        toast.error(
          `Failed to import ${failed.length} records. Download the failed rows for review.`,
        );
      } else {
        toast.success(`Successfully imported ${total} records.`);
      }

      if (successCount > 0) {
        const tsaLabel =
          importTsaOptions.find((o) => o.value === importSelectedTSA)?.label ??
          importSelectedTSA;
        handleImportSuccess(successCount, importSelectedTSA, tsaLabel);
      }

      setImportFile(null);
      setImportPreviewData([]);
      setParseLog([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to import file.");
    } finally {
      setIsImportLoading(false);
    }
  };

  const handleDownloadFailed = () => {
    if (importFailedRows.length === 0) {
      toast.info("No failed rows to download.");
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Failed Rows");
    worksheet.addRow([
      "company_name",
      "contact_person",
      "contact_number",
      "email_address",
      "type_client",
      "address",
      "region",
      "status",
      "company_group",
      "delivery_address",
      "industry",
    ]);
    importFailedRows.forEach((row) => {
      worksheet.addRow([
        row.company_name,
        row.contact_person,
        row.contact_number,
        row.email_address,
        row.type_client,
        row.address,
        row.region,
        row.status,
        row.company_group,
        row.delivery_address,
        row.industry,
      ]);
    });
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${importOriginalFileName || "failed_rows"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  // ── Import success callback ─────────────────────────────────────────────────
  const handleImportSuccess = async (
    count: number,
    tsaId: string,
    tsaName: string,
  ) => {
    await logCustomerAudit({
      action: "create",
      affectedCount: count,
      customerName: `${count} customers imported`,
      transfer: null,
      changes: { assigned_tsa: { before: null, after: tsaName } },
      actor: currentActorRef.current,
      context: { page: AUDIT_PAGE, source: "ImportForm", bulk: count > 1 },
    });
  };

  // ── Audit helpers ───────────────────────────────────────────────────────────
  const handleReturn = () => {
    setIsAuditView(false);
    setAudited([]);
    setDuplicateIds(new Set());
  };

  // ── Bulk delete ─────────────────────────────────────────────────────────────
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return toast.error("No customers selected.");
    setShowDeleteDialog(true);
  };

  const executeBulkDelete = async (): Promise<void> => {
    if (selectedIds.size === 0) {
      toast.error("No customers selected.");
      return;
    }
    const idsArray = Array.from(selectedIds);
    const deletedCustomers = customers.filter((c) => selectedIds.has(c.id));
    let deletedCount = 0;
    let loadingToastId = toast.loading(`Deleting 0/${idsArray.length}...`);
    try {
      const res = await fetch(
        "/api/Data/Applications/Taskflow/CustomerDatabase/BulkDelete",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: idsArray }),
        },
      );
      const result = (await safeJson(res)) ?? {};
      if (!res.ok || !result.success) {
        toast.error(result.error || `Delete failed (HTTP ${res.status})`);
        return;
      }
      for (let i = 0; i < idsArray.length; i++) {
        deletedCount++;
        toast.dismiss(loadingToastId);
        loadingToastId = toast.loading(
          `Deleting ${deletedCount}/${idsArray.length}...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      toast.success(`Deleted ${deletedCount} customers.`);
      setCustomers((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      setSelectedIdsAction(new Set());
      await Promise.all(
        deletedCustomers.map((c) =>
          logCustomerAudit({
            action: "delete",
            affectedCount: deletedCustomers.length,
            customerId: String(c.id),
            customerName: c.company_name,
            actor: currentActorRef.current,
            context: {
              page: AUDIT_PAGE,
              source: "BulkDelete",
              bulk: deletedCustomers.length > 1,
            },
          }),
        ),
      );
    } catch (err) {
      console.error(err);
      toast.error("Bulk delete failed.");
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIdsAction(newSet);
    setSelectAll(newSet.size === current.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIdsAction(new Set());
      setSelectAll(false);
    } else {
      setSelectedIdsAction(new Set(current.map((c) => c.id)));
      setSelectAll(true);
    }
  };

  // ── Auto-generate reference numbers ────────────────────────────────────────
  const handleAutoGenerate = async () => {
    if (selectedIds.size === 0) {
      toast.error("No customers selected.");
      return;
    }
    setIsGenerating(true);
    try {
      const selectedCustomers = customers.filter((c) => selectedIds.has(c.id));
      const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      };
      const updates = selectedCustomers.map((customer, index) => {
        const initials = getInitials(customer.company_name);
        const regionCode = (customer.region || "NCR")
          .toUpperCase()
          .replace(/\s+/g, "");
        const seqNum = (index + 1).toString().padStart(10, "0");
        return {
          id: customer.id,
          account_reference_number: `${initials}-${regionCode}-${seqNum}`,
        };
      });
      const res = await fetch(
        "/api/Data/Applications/Taskflow/CustomerDatabase/UpdateReferenceNumber",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        },
      );
      const result = (await safeJson(res)) ?? {};
      if (!res.ok || !result.success) {
        toast.error(result.error || "Failed to update reference numbers.");
        return;
      }
      setCustomers((prev) =>
        prev.map((c) => {
          const u = updates.find((u) => u.id === c.id);
          return u
            ? { ...c, account_reference_number: u.account_reference_number }
            : c;
        }),
      );
      toast.success("Reference numbers generated and updated successfully.");
      await Promise.all(
        selectedCustomers.map((c, i) =>
          logCustomerAudit({
            action: "autoid",
            affectedCount: selectedCustomers.length,
            customerId: String(c.id),
            customerName: c.company_name,
            changes: {
              account_reference_number: {
                before: c.account_reference_number || null,
                after: updates[i].account_reference_number,
              },
            },
            actor: currentActorRef.current,
            context: {
              page: AUDIT_PAGE,
              source: "AutoGenerateID",
              bulk: selectedCustomers.length > 1,
            },
          }),
        ),
      );
    } catch (error) {
      console.error(error);
      toast.error("An error occurred during update.");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Transfer ────────────────────────────────────────────────────────────────
  const handleOpenTransferDialog = () => {
    preTransferSnapshotRef.current = customers.filter((c) =>
      selectedIds.has(c.id),
    );
    setShowTransferDialog(true);
  };

  const handleTransferSuccess = async (payload: TransferSuccessPayload) => {
    const snapshot = preTransferSnapshotRef.current;
    if (!snapshot.length) return;
    const transfer: TransferDetail = {
      tsa: payload.tsa
        ? {
            toId: payload.tsa.toId,
            toName: payload.tsa.toName,
            fromId: snapshot[0].referenceid || null,
            fromName:
              refIdUserMap.get(snapshot[0].referenceid?.trim().toLowerCase())
                ?.name ||
              snapshot[0].referenceid ||
              null,
          }
        : null,
      tsm: payload.tsm
        ? { toName: payload.tsm.toName, fromName: snapshot[0].tsm || null }
        : null,
      manager: payload.manager
        ? {
            toName: payload.manager.toName,
            fromName: snapshot[0].manager || null,
          }
        : null,
    };
    await Promise.all(
      snapshot.map((c) =>
        logCustomerAudit({
          action: "transfer",
          affectedCount: snapshot.length,
          customerId: String(c.id),
          customerName: c.company_name,
          transfer,
          actor: currentActorRef.current,
          context: {
            page: AUDIT_PAGE,
            source: "TransferDialog",
            bulk: snapshot.length > 1,
          },
        }),
      ),
    );
    preTransferSnapshotRef.current = [];
  };

  // ── Reset filters ───────────────────────────────────────────────────────────
  const handleResetFilters = () => {
    setFilterTSA("all");
    setFilterTSM("all");
    setFilterManager("all");
    setFilterType("all");
    setFilterStatus("all");
    setStartDate("");
    setEndDate("");
    setSortOrder("desc");
    setRowsPerPage(20);
    setPage(1);
  };

  const hasActiveFilters =
    filterTSA !== "all" ||
    filterTSM !== "all" ||
    filterManager !== "all" ||
    filterType !== "all" ||
    filterStatus !== "all" ||
    !!startDate ||
    !!endDate ||
    sortOrder !== "desc" ||
    rowsPerPage !== 20;

  // ── Parse log color helper ──────────────────────────────────────────────────
  const parseLogColor = (type: string) => {
    if (type === "ok") return "text-emerald-400";
    if (type === "warn") return "text-amber-400";
    if (type === "err") return "text-red-400";
    return "text-zinc-400";
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
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

          {/* Page title */}
          <div className="px-4 pb-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Customer Database
            </h1>
            <p className="text-sm text-muted-foreground">
              {isFetching ? (
                "Loading…"
              ) : (
                <>
                  <span className="font-semibold text-foreground">
                    {filtered.length}
                  </span>{" "}
                  customer{filtered.length !== 1 ? "s" : ""}
                </>
              )}
            </p>
          </div>

          {/* ── Sci-Fi Two-column layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 pb-8 items-start">
            {/* ═══ LEFT: Import + Filter (Sci-Fi Panel) ═══ */}
            <div className="lg:col-span-4 sticky top-4 space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
              {/* ── Import Form Card ── */}
              <Card className="sci-fi-panel rounded-xl border-cyan-500/30">
                <CardHeader className="border-b border-cyan-500/30 px-4 py-3 bg-cyan-500/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-cyan-400">
                      <Upload className="w-4 h-4 text-cyan-400" /> Import Customer Database
                    </CardTitle>
                    {(importFile || importSelectedManager) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-lg text-[9px] uppercase font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
                        disabled={isImportLoading}
                        onClick={() => {
                          setImportFile(null);
                          setImportOriginalFileName(null);
                          setImportPreviewData([]);
                          setImportFailedRows([]);
                          setImportSelectedManager("");
                          setImportSelectedTSM("");
                          setImportSelectedTSA("");
                          setParseLog([]);
                        }}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" /> Reset
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4 px-4 space-y-3">
                  {/* Manager */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-60">
                      Manager
                    </label>
                    <Combobox
                      options={importManagerOptions}
                      value={importSelectedManager}
                      onValueChange={setImportSelectedManager}
                      placeholder="Select Manager…"
                      disabled={isImportLoading}
                    />
                  </div>

                  {/* TSM */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-60">
                      Territory Sales Manager
                    </label>
                    <Combobox
                      options={importTsmOptions}
                      value={importSelectedTSM}
                      onValueChange={setImportSelectedTSM}
                      placeholder="Select TSM…"
                      disabled={isImportLoading || !importSelectedManager}
                      emptyText={
                        !importSelectedManager
                          ? "Select a Manager first."
                          : "No TSMs found."
                      }
                    />
                  </div>

                  {/* TSA */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-60">
                      Territory Sales Associate{" "}
                      <span className="text-destructive">*</span>
                    </label>
                    <Combobox
                      options={importTsaOptions}
                      value={importSelectedTSA}
                      onValueChange={setImportSelectedTSA}
                      placeholder="Select TSA…"
                      disabled={isImportLoading || !importSelectedTSM}
                      emptyText={
                        !importSelectedManager
                          ? "Select a Manager first."
                          : !importSelectedTSM
                            ? "Select a TSM first."
                            : "No TSAs found."
                      }
                    />
                  </div>

                  {/* Dropzone */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-60">
                      Excel File <span className="text-destructive">*</span>
                    </label>
                    <DropZone
                      file={importFile}
                      fileName={importOriginalFileName}
                      onFileSelect={handleFileSelect}
                      onClear={() => {
                        setImportFile(null);
                        setImportOriginalFileName(null);
                        setImportPreviewData([]);
                        setParseLog([]);
                      }}
                      disabled={isImportLoading}
                    />
                  </div>

                  {/* Parse Console */}
                  {parseLog.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-60 flex items-center gap-1.5">
                        <Terminal className="w-3 h-3" /> Parse Output
                        {isParsing && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                      </label>
                      <div className="rounded-none border border-zinc-700 bg-zinc-950 overflow-hidden">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="w-2 h-2 rounded-full bg-yellow-500" />
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="font-mono text-[10px] text-zinc-500 ml-1 select-none">
                            parser — bash
                          </span>
                        </div>
                        <div className="px-3 py-2 font-mono text-[10px] space-y-0.5 max-h-36 overflow-y-auto">
                          {parseLog.map((line, i) => (
                            <div
                              key={i}
                              className={cn(
                                "leading-relaxed",
                                parseLogColor(line.type),
                              )}
                            >
                              {line.msg}
                            </div>
                          ))}
                          {isParsing && (
                            <span className="inline-block w-1.5 h-3 bg-emerald-400 animate-pulse align-middle" />
                          )}
                          <div ref={parseLogEndRef} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  {importPreviewData.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase opacity-60">
                        Preview ({importPreviewData.length} rows)
                      </label>
                      <div className="overflow-auto max-h-44 border rounded-none text-[10px]">
                        <table className="w-full whitespace-nowrap">
                          <thead className="bg-muted/50 sticky top-0">
                            <tr>
                              {[
                                "Company",
                                "Contact",
                                "Email",
                                "Type",
                                "Region",
                                "Status",
                              ].map((h) => (
                                <th
                                  key={h}
                                  className="px-2 py-1.5 text-left font-semibold text-muted-foreground uppercase tracking-wider"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {importPreviewData.slice(0, 20).map((row, i) => (
                              <tr key={i} className="hover:bg-muted/30">
                                <td className="px-2 py-1 truncate max-w-[100px]">
                                  {row.company_name}
                                </td>
                                <td className="px-2 py-1 truncate max-w-[80px]">
                                  {row.contact_person}
                                </td>
                                <td className="px-2 py-1 truncate max-w-[100px]">
                                  {row.email_address}
                                </td>
                                <td className="px-2 py-1">{row.type_client}</td>
                                <td className="px-2 py-1">{row.region}</td>
                                <td className="px-2 py-1">{row.status}</td>
                              </tr>
                            ))}
                            {importPreviewData.length > 20 && (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="px-2 py-1.5 text-center text-muted-foreground italic"
                                >
                                  +{importPreviewData.length - 20} more rows
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {importFailedRows.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDownloadFailed}
                        className="rounded-none text-xs flex-1 gap-1"
                      >
                        <DownloadIcon className="h-3.5 w-3.5" />
                        Failed ({importFailedRows.length})
                      </Button>
                    )}
                    <Button
                      onClick={handleImportUpload}
                      disabled={
                        isImportLoading || !importFile || !importSelectedTSA
                      }
                      className="rounded-none uppercase font-bold text-[10px] h-10 tracking-widest gap-2 flex-1"
                    >
                      {isImportLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />{" "}
                          Uploading…
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" /> Upload
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* ── Filter Panel Card ── */}
              <Card className="rounded-none shadow-none border-foreground/10">
                <CardHeader className="border-b px-4 py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4" /> Filters
                      {hasActiveFilters && (
                        <span className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </CardTitle>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-none text-[9px] uppercase font-bold text-muted-foreground"
                        onClick={handleResetFilters}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" /> Reset
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4 px-4 space-y-3">
                  {/* Manager Filter — flat combobox from customer data */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-60">
                      Manager
                    </label>
                    <Combobox
                      options={filterManagerOptions}
                      value={filterManager}
                      onValueChange={(v) => {
                        setFilterManager(v || "all");
                        setPage(1);
                      }}
                      placeholder="All Managers"
                    />
                  </div>

                  {/* TSM Filter — flat combobox from customer data */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-60">
                      Sales Manager
                    </label>
                    <Combobox
                      options={filterTsmOptions}
                      value={filterTSM}
                      onValueChange={(v) => {
                        setFilterTSM(v || "all");
                        setPage(1);
                      }}
                      placeholder="All TSM"
                    />
                  </div>

                  {/* TSA Filter — flat combobox from customer data */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-60">
                      Sales Associate
                    </label>
                    <Combobox
                      options={filterTsaOptions}
                      value={filterTSA}
                      onValueChange={(v) => {
                        setFilterTSA(v || "all");
                        setPage(1);
                      }}
                      placeholder="All TSA"
                    />
                  </div>

                  {/* Type Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-60">
                      Client Type
                    </label>
                    <Select
                      value={filterType}
                      onValueChange={(v) => {
                        setFilterType(v);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-none">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((t) => (
                          <SelectItem
                            key={t}
                            value={t}
                            className="text-xs capitalize"
                          >
                            {t === "all" ? "All Types" : t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-60">
                      Status
                    </label>
                    <Select
                      value={filterStatus}
                      onValueChange={(v) => {
                        setFilterStatus(v);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-none">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => (
                          <SelectItem
                            key={s}
                            value={s}
                            className="text-xs capitalize"
                          >
                            {s === "all" ? "All Statuses" : s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sort Order */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-60">
                      Sort Order
                    </label>
                    <Select
                      value={sortOrder}
                      onValueChange={(v) => setSortOrder(v as "asc" | "desc")}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc" className="text-xs">
                          Latest First
                        </SelectItem>
                        <SelectItem value="asc" className="text-xs">
                          Oldest First
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Rows per page */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase opacity-60">
                      Rows per Page
                    </label>
                    <Select
                      value={rowsPerPage.toString()}
                      onValueChange={(v) => {
                        setRowsPerPage(Number(v));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[20, 50, 100, 1000, 12000, 30000].map((n) => (
                          <SelectItem
                            key={n}
                            value={n.toString()}
                            className="text-xs"
                          >
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ═══ RIGHT: Table ═══ */}
            <div className="lg:col-span-8 space-y-4">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search customers…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-full pr-8"
                  />
                  {isFiltering && (
                    <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2">
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
                        size="sm"
                        onClick={handleOpenTransferDialog}
                      >
                        <ArrowRight className="w-4 h-4 mr-1" /> Transfer
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAutoGenerate}
                        disabled={isGenerating}
                      >
                        <Hash className="w-4 h-4 mr-1" />
                        {isGenerating
                          ? "Generating…"
                          : `Auto-ID (${selectedIds.size})`}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleBulkDelete}
                      >
                        Delete ({selectedIds.size})
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
                    <Button variant="outline" size="sm" onClick={handleReturn}>
                      Return to List
                    </Button>
                  )}
                </div>
              </div>

              {/* Audit summary bar */}
              {isAuditView && (
                <div className="flex flex-col gap-2 bg-muted/50 rounded-none px-4 py-2 border border-border text-[13px]">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div
                      className="font-medium cursor-pointer select-none underline text-red-600"
                      onClick={() => setShowAuditDialog(true)}
                    >
                      🧾 Audit Summary:{" "}
                      <span className="font-semibold text-red-600">
                        {audited.length}
                      </span>{" "}
                      total issues found
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end ml-auto">
                      <ButtonGroup>
                        <Button
                          size="sm"
                          variant={
                            auditFilter === "missingType"
                              ? "secondary"
                              : "outline"
                          }
                          className={cn(
                            "rounded-l-md",
                            auditFilter === "missingType" &&
                              "bg-yellow-100 text-yellow-900",
                          )}
                          onClick={() =>
                            setAuditFilter(
                              auditFilter === "missingType"
                                ? ""
                                : "missingType",
                            )
                          }
                        >
                          ⚠ Missing Type:{" "}
                          {
                            audited.filter(
                              (c) => !c.type_client?.trim() && c.status?.trim(),
                            ).length
                          }
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            auditFilter === "missingStatus"
                              ? "secondary"
                              : "outline"
                          }
                          className={cn(
                            auditFilter === "missingStatus" &&
                              "bg-yellow-100 text-yellow-900",
                          )}
                          onClick={() =>
                            setAuditFilter(
                              auditFilter === "missingStatus"
                                ? ""
                                : "missingStatus",
                            )
                          }
                        >
                          ⚠ Missing Status:{" "}
                          {
                            audited.filter(
                              (c) => !c.status?.trim() && c.type_client?.trim(),
                            ).length
                          }
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            auditFilter === "duplicates"
                              ? "secondary"
                              : "outline"
                          }
                          className={cn(
                            "rounded-r-md",
                            auditFilter === "duplicates" &&
                              "bg-red-100 text-red-900",
                          )}
                          onClick={() =>
                            setAuditFilter(
                              auditFilter === "duplicates" ? "" : "duplicates",
                            )
                          }
                        >
                          🔁 Duplicates: {Array.from(duplicateIds).length}
                        </Button>
                      </ButtonGroup>
                    </div>
                  </div>
                </div>
              )}

              {/* Dialogs */}
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
              <div>
                <div className="flex justify-start mb-2">
                  <Badge variant="outline">{`Total: ${totalCount}`}</Badge>
                </div>

                <div className="overflow-auto min-h-[200px] border border-border rounded-none flex items-center justify-center">
                  {isFetching ? (
                    <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
                      <Loader2 className="size-6 animate-spin" />
                      <span>Loading customers…</span>
                    </div>
                  ) : current.length > 0 ? (
                    <Table className="whitespace-nowrap text-[13px] min-w-full">
                      <TableHeader className="bg-muted sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-8 text-center">
                            <input
                              type="checkbox"
                              checked={selectAll}
                              onChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
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
                          const isMissingType = !c.type_client?.trim();
                          const isMissingStatus = !c.status?.trim();
                          const isDuplicate = duplicateIds.has(c.id);
                          const isSelected = selectedIds.has(c.id);
                          const isParked =
                            c.status?.trim().toLowerCase() === "park";

                          return (
                            <TableRow
                              key={c.id}
                              className={isParked ? "opacity-60" : ""}
                            >
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
                                    setEditingCustomer(c);
                                    setShowEditDialog(true);
                                  }}
                                >
                                  Edit
                                </Button>
                              </TableCell>

                              <TableCell className="uppercase whitespace-normal break-words max-w-[250px]">
                                <span
                                  className={
                                    isDuplicate ||
                                    isMissingType ||
                                    isMissingStatus
                                      ? "line-through underline decoration-red-500 decoration-2"
                                      : ""
                                  }
                                >
                                  {c.company_name}
                                  <br />
                                  <span className="text-[10px] normal-case">
                                    {c.account_reference_number}
                                  </span>
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
                                <StatusBadge status={c.status} />
                              </TableCell>

                              <TableCell>{c.region}</TableCell>

                              <TableCell className="capitalize">
                                {(() => {
                                  const key = c.referenceid
                                    ?.trim()
                                    .toLowerCase();
                                  const user = refIdUserMap.get(key ?? "");
                                  const label =
                                    user?.name || c.referenceid || "-";
                                  const isInactive =
                                    user &&
                                    INACTIVE_STATUSES.includes(
                                      user.status ?? "",
                                    );
                                  return (
                                    <span className="flex items-center gap-1 flex-wrap">
                                      {label}
                                      {isInactive && (
                                        <span
                                          className={cn(
                                            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
                                            user?.status === "Terminated"
                                              ? "bg-red-100 text-red-700"
                                              : user?.status === "Resigned"
                                                ? "bg-orange-100 text-orange-700"
                                                : "bg-gray-100 text-gray-600",
                                          )}
                                        >
                                          {user?.status}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })()}
                              </TableCell>

                              <TableCell className="capitalize">
                                {(() => {
                                  const key = (c.tsm ?? "")
                                    .trim()
                                    .toLowerCase();
                                  const user = refIdUserMap.get(key);
                                  const label = user?.name || c.tsm || "-";
                                  const isInactive =
                                    user &&
                                    INACTIVE_STATUSES.includes(
                                      user.status ?? "",
                                    );
                                  return (
                                    <span className="flex items-center gap-1 flex-wrap">
                                      {label}
                                      {isInactive && (
                                        <span
                                          className={cn(
                                            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
                                            user?.status === "Terminated"
                                              ? "bg-red-100 text-red-700"
                                              : user?.status === "Resigned"
                                                ? "bg-orange-100 text-orange-700"
                                                : "bg-gray-100 text-gray-600",
                                          )}
                                        >
                                          {user?.status}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="capitalize">
                                {(() => {
                                  const key = (c.manager ?? "")
                                    .trim()
                                    .toLowerCase();
                                  const user = refIdUserMap.get(key);
                                  const label = user?.name || c.manager || "-";
                                  const isInactive =
                                    user &&
                                    INACTIVE_STATUSES.includes(
                                      user.status ?? "",
                                    );
                                  return (
                                    <span className="flex items-center gap-1 flex-wrap">
                                      {label}
                                      {isInactive && (
                                        <span
                                          className={cn(
                                            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
                                            user?.status === "Terminated"
                                              ? "bg-red-100 text-red-700"
                                              : user?.status === "Resigned"
                                                ? "bg-orange-100 text-orange-700"
                                                : "bg-gray-100 text-gray-600",
                                          )}
                                        >
                                          {user?.status}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                {new Date(c.date_created).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {new Date(c.date_updated).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {c.next_available_date
                                  ? new Date(
                                      c.next_available_date,
                                    ).toLocaleDateString()
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          );
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

              {/* Pagination + rows info */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  {displayData.length === 0 ? 0 : (page - 1) * rowsPerPage + 1}–
                  {Math.min(page * rowsPerPage, displayData.length)} of{" "}
                  {displayData.length} customers
                </p>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChangeAction={setPage}
                />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* EditCustomerDialog */}
      <EditCustomerDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        customer={editingCustomer}
        actorRef={currentActorRef}
        onSave={(updated) =>
          setCustomers((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c)),
          )
        }
      />

      {/* TransferDialog */}
      <TransferDialog
        open={showTransferDialog}
        onOpenChangeAction={(open) => setShowTransferDialog(open)}
        selectedIds={new Set(Array.from(selectedIds).map(String))}
        setSelectedIdsAction={(ids: Set<string>) => {
          setSelectedIdsAction(
            new Set(Array.from(ids).map((id) => Number(id))),
          );
        }}
        setAccountsAction={(updateFn) => setCustomers((prev) => updateFn(prev))}
        tsas={tsas}
        tsms={tsms}
        managers={managers}
        onSuccessAction={handleTransferSuccess}
      />
    </ProtectedPageWrapper>
  );
}