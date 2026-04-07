"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  GitMerge,
  Inbox,
  Loader2,
  MessageSquare,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { CUSTOMER_AUDITS_COLLECTION } from "@/lib/audit/customer-audit";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AuditIssueType =
  | "same-tsa-duplicate"
  | "cross-tsa-duplicate"
  | "missing-type"
  | "missing-status";

export type AuditStatus = "pending" | "resolved" | "cancelled";

export type AuditActionKind =
  | "delete-dupes"
  | "fill-field"
  | "resolve"
  | "dismiss";

export interface Customer {
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
  date_created: string;
  date_updated: string;
  next_available_date?: string;
}

export interface AuditRow {
  id: string; // Firestore doc ID
  customerId: string | null;
  customerName: string | null;
  referenceId: string | null;
  issue: AuditIssueType | null;
  missingField: string | null;
  duplicateGroupId: string | null;
  duplicateGroupType: "same-tsa" | "cross-tsa" | null;
  duplicateMatchReason: string | null;
  auditStatus: AuditStatus;
  auditRemarks: string | null;
  timestamp: Date | null;
  customer: Customer | null;
  performedBy: string | null;
  performedByRole: string | null;
}

interface AuditActionTarget {
  primaryEntry: AuditRow;
  action: AuditActionKind;
  groupEntries?: AuditRow[];
  keepCustomerId?: string;
  fieldUpdates?: Record<string, string>; // fieldKey → value
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

/** Fields that can be blank and are displayed/fillable in the preview */
const FILLABLE_FIELDS: Array<{
  key: keyof Customer;
  label: string;
  options?: string[];
}> = [
  {
    key: "type_client",
    label: "Type Client",
    options: [
      "New Client",
      "Existing Client",
      "Prospect",
      "Partner",
      "CSR Client",
      "Transferred Account",
    ],
  },
  {
    key: "status",
    label: "Status",
    options: [
      "Active",
      "Inactive",
      "Non-Buying",
      "On Hold",
      "New Client",
      "park",
    ],
  },
  { key: "contact_person", label: "Contact Person" },
  { key: "contact_number", label: "Contact Number" },
  { key: "email_address", label: "Email Address" },
  { key: "address", label: "Address" },
  { key: "region", label: "Region" },
  { key: "tsm", label: "TSM Reference ID" },
  { key: "manager", label: "Manager Reference ID" },
];

const MISSING_FIELD_LABELS: Partial<Record<AuditIssueType, string>> = {
  "missing-type": "type_client",
  "missing-status": "status",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as Timestamp).toDate();
  }
  return null;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeCustomer(
  raw: unknown,
  fallbackId?: string | null,
  fallbackRef?: string | null,
  fallbackName?: string | null,
): Customer | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Partial<Customer> & { id?: number | string };
  const numId =
    typeof v.id === "number" ? v.id : Number(v.id ?? fallbackId ?? NaN);
  if (!Number.isFinite(numId)) return null;
  return {
    id: numId,
    account_reference_number: v.account_reference_number ?? "",
    company_name: v.company_name ?? fallbackName ?? "",
    contact_person: v.contact_person ?? "",
    contact_number: v.contact_number ?? "",
    email_address: v.email_address ?? "",
    address: v.address ?? "",
    region: v.region ?? "",
    type_client: v.type_client ?? "",
    referenceid: v.referenceid ?? fallbackRef ?? "",
    tsm: v.tsm ?? "",
    manager: v.manager ?? "",
    status: v.status ?? "",
    remarks: v.remarks ?? "",
    date_created: v.date_created ?? "",
    date_updated: v.date_updated ?? "",
    next_available_date: v.next_available_date,
  };
}

function normalizeIssue(flaggedIssues: unknown): AuditIssueType | null {
  const arr = Array.isArray(flaggedIssues) ? flaggedIssues : [];
  if (arr.includes("cross-tsa-duplicate")) return "cross-tsa-duplicate";
  if (arr.includes("same-tsa-duplicate")) return "same-tsa-duplicate";
  if (arr.includes("missing-type")) return "missing-type";
  if (arr.includes("missing-status")) return "missing-status";
  return null;
}

function getBlankFields(customer: Customer | null): typeof FILLABLE_FIELDS {
  if (!customer) return [];
  return FILLABLE_FIELDS.filter((f) => {
    const val = customer[f.key];
    return !val || String(val).trim() === "";
  });
}

// ─── IssueBadge ────────────────────────────────────────────────────────────────

function IssueBadge({ issue }: { issue: AuditIssueType | null }) {
  if (!issue) return <span className="text-xs text-muted-foreground">—</span>;

  const cfg: Record<AuditIssueType, { label: string; cls: string }> = {
    "same-tsa-duplicate": {
      label: "Dup · Same TSA",
      cls: "bg-red-50 text-red-700 border-red-200",
    },
    "cross-tsa-duplicate": {
      label: "Dup · Cross TSA",
      cls: "bg-orange-50 text-orange-700 border-orange-200",
    },
    "missing-type": {
      label: "Missing Type",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    "missing-status": {
      label: "Missing Status",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
  };

  return (
    <span
      className={cn(
        "inline-flex text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
        cfg[issue].cls,
      )}
    >
      {cfg[issue].label}
    </span>
  );
}

// ─── AuditStatusBadge ──────────────────────────────────────────────────────────

function AuditStatusBadge({ status }: { status: AuditStatus }) {
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-2.5 h-2.5" /> Pending
      </span>
    );
  if (status === "resolved")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-2.5 h-2.5" /> Resolved
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
      <XCircle className="w-2.5 h-2.5" /> Dismissed
    </span>
  );
}

// ─── AuditRemarksDialog ────────────────────────────────────────────────────────
// Adapted from RemarksConfirmDialog pattern

interface AuditRemarksDialogProps {
  target: AuditActionTarget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (target: AuditActionTarget, remarks: string) => Promise<void>;
  tsaMap: Record<string, string>;
}

function AuditRemarksDialog({
  target,
  open,
  onOpenChange,
  onConfirm,
  tsaMap,
}: AuditRemarksDialogProps) {
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keepId, setKeepId] = useState<string>("");

  useEffect(() => {
    if (open && target) {
      setRemarks("");
      setRemarksError(false);
      if (target.action === "delete-dupes" && target.groupEntries?.length) {
        // Default keep: oldest by date_created
        const sorted = [...target.groupEntries]
          .filter((e) => e.customer)
          .sort((a, b) =>
            (a.customer!.date_created ?? "").localeCompare(
              b.customer!.date_created ?? "",
            ),
          );
        setKeepId(sorted[0]?.customerId ?? "");
      }
    }
  }, [open, target]);

  if (!target) return null;

  const { action, primaryEntry } = target;
  const customer = primaryEntry.customer;
  const remarksOk = remarks.trim().length > 0;

  const actionCfg: Record<
    AuditActionKind,
    {
      title: string;
      desc: string;
      icon: React.ReactNode;
      iconBg: string;
      confirmLabel: string;
      confirmCls: string;
      confirmDisabledCls: string;
    }
  > = {
    "delete-dupes": {
      title: "Delete Duplicates",
      desc: "All duplicate entries except the selected original will be permanently deleted from the database.",
      icon: <Trash2 className="w-4 h-4 text-rose-600" />,
      iconBg: "bg-rose-100",
      confirmLabel: "Delete Duplicates",
      confirmCls: "bg-rose-600 hover:bg-rose-700 text-white",
      confirmDisabledCls: "bg-rose-200 text-rose-400 cursor-not-allowed",
    },
    "fill-field": {
      title: "Fill Missing Field",
      desc: "The missing field will be updated with the provided value and the issue will be resolved.",
      icon: <CheckCircle2 className="w-4 h-4 text-amber-600" />,
      iconBg: "bg-amber-100",
      confirmLabel: "Fill & Resolve",
      confirmCls: "bg-amber-500 hover:bg-amber-600 text-white",
      confirmDisabledCls: "bg-amber-200 text-amber-400 cursor-not-allowed",
    },
    resolve: {
      title: "Resolve Issue",
      desc: "Mark this audit issue as resolved. No data changes will be applied.",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
      iconBg: "bg-emerald-100",
      confirmLabel: "Mark Resolved",
      confirmCls: "bg-emerald-600 hover:bg-emerald-700 text-white",
      confirmDisabledCls: "bg-emerald-200 text-emerald-400 cursor-not-allowed",
    },
    dismiss: {
      title: "Dismiss Issue",
      desc: "Dismiss this issue. It will be marked as cancelled and no changes will be applied.",
      icon: <XCircle className="w-4 h-4 text-zinc-500" />,
      iconBg: "bg-zinc-100",
      confirmLabel: "Dismiss",
      confirmCls: "bg-zinc-700 hover:bg-zinc-800 text-white",
      confirmDisabledCls: "bg-zinc-200 text-zinc-400 cursor-not-allowed",
    },
  };

  const cfg = actionCfg[action];

  const handleConfirm = async () => {
    if (!remarksOk) {
      setRemarksError(true);
      return;
    }
    setLoading(true);
    try {
      const updatedTarget: AuditActionTarget =
        action === "delete-dupes"
          ? { ...target, keepCustomerId: keepId }
          : target;
      await onConfirm(updatedTarget, remarks.trim());
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const groupEntries = target.groupEntries ?? [primaryEntry];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !loading) {
          setRemarks("");
          setRemarksError(false);
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg rounded-none">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div
              className={cn(
                "w-9 h-9 rounded-none flex items-center justify-center shrink-0",
                cfg.iconBg,
              )}
            >
              {cfg.icon}
            </div>
            <div>
              <DialogTitle className="text-sm font-bold uppercase tracking-tight">
                {cfg.title}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {cfg.desc}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Customer identity */}
        <div className="flex items-center gap-3 bg-muted/40 border px-3 py-2.5 rounded-none">
          <div className="h-8 w-8 shrink-0 bg-background border flex items-center justify-center rounded-none">
            <Package className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate uppercase leading-tight">
              {customer?.company_name || primaryEntry.customerName || "—"}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono">
              TSA:{" "}
              {tsaMap[primaryEntry.referenceId?.toLowerCase() ?? ""] ||
                primaryEntry.referenceId ||
                "—"}
            </p>
          </div>
          <IssueBadge issue={primaryEntry.issue} />
        </div>

        {/* Delete dupes: keep selector */}
        {action === "delete-dupes" && groupEntries.length > 1 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
              Select the record to keep ({groupEntries.length} duplicates)
            </p>
            <div className="border rounded-none divide-y max-h-48 overflow-y-auto">
              {groupEntries.map((entry) => {
                const c = entry.customer;
                if (!c) return null;
                const isKeep = keepId === entry.customerId;
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors",
                      isKeep && "bg-emerald-50/60",
                    )}
                    onClick={() => setKeepId(entry.customerId ?? "")}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 shrink-0 transition-colors",
                        isKeep
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-muted-foreground",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase truncate">
                        {c.company_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.contact_person} · {c.email_address}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        TSA:{" "}
                        {tsaMap[c.referenceid?.toLowerCase()] || c.referenceid}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wide shrink-0 px-1.5 py-0.5 border rounded",
                        isKeep
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-600 border-rose-200",
                      )}
                    >
                      {isKeep ? "Keep" : "Delete"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fill field: summary of what will be filled */}
        {action === "fill-field" && target.fieldUpdates && (
          <div className="bg-amber-50 border border-amber-200 rounded-none p-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">
              Fields to update
            </p>
            {Object.entries(target.fieldUpdates).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="text-amber-600 font-mono">{k}</span>
                <span className="text-amber-500">→</span>
                <span className="font-semibold text-amber-800">{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Remarks */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3" />
            Remarks
            <span className="text-destructive">*</span>
          </label>
          <Textarea
            autoFocus
            value={remarks}
            onChange={(e) => {
              setRemarks(e.target.value);
              if (e.target.value.trim()) setRemarksError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleConfirm();
              }
            }}
            placeholder={
              action === "delete-dupes"
                ? "Explain why these duplicates are being removed…"
                : action === "fill-field"
                  ? "Explain why you are filling this field…"
                  : action === "resolve"
                    ? "Explain how this issue was resolved…"
                    : "Explain why you are dismissing this issue…"
            }
            className={cn(
              "rounded-none resize-none min-h-[80px] text-sm",
              remarksError &&
                "border-destructive focus-visible:ring-destructive/30",
            )}
            disabled={loading}
          />
          {remarksError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Remarks are required before proceeding.
            </p>
          )}
          <p className="text-[10px] text-muted-foreground">
            Tip: Press Ctrl+Enter / ⌘+Enter to confirm.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-none"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className={cn(
              "rounded-none gap-1.5",
              remarksOk ? cfg.confirmCls : cfg.confirmDisabledCls,
            )}
            onClick={handleConfirm}
            disabled={loading || !remarksOk}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : action === "delete-dupes" ? (
              <Trash2 className="w-3.5 h-3.5" />
            ) : action === "dismiss" ? (
              <XCircle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            {loading ? "Processing…" : cfg.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AuditPreviewModal ─────────────────────────────────────────────────────────

interface AuditPreviewModalProps {
  entry: AuditRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupEntries: AuditRow[];
  tsaMap: Record<string, string>;
  onAction: (target: AuditActionTarget) => void;
}

function AuditPreviewModal({
  entry,
  open,
  onOpenChange,
  groupEntries,
  tsaMap,
  onAction,
}: AuditPreviewModalProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) setFieldValues({});
  }, [open, entry?.id]);

  if (!entry) return null;

  const c = entry.customer;
  const isPending = entry.auditStatus === "pending";
  const isDuplicate =
    entry.issue === "same-tsa-duplicate" ||
    entry.issue === "cross-tsa-duplicate";
  const blankFields = getBlankFields(c);
  const hasFillableValues = Object.values(fieldValues).some(
    (v) => v.trim().length > 0,
  );

  const DetailRow = ({
    label,
    value,
    mono = false,
    warn = false,
  }: {
    label: string;
    value?: string | null;
    mono?: boolean;
    warn?: boolean;
  }) => (
    <div className="space-y-0.5">
      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
        {label}
      </p>
      {warn && (!value || value.trim() === "") ? (
        <p className="text-xs text-amber-600 flex items-center gap-1 italic">
          <AlertTriangle className="w-3 h-3" /> Empty
        </p>
      ) : (
        <p className={cn("text-sm", mono && "font-mono text-xs")}>
          {value || <span className="text-muted-foreground">—</span>}
        </p>
      )}
    </div>
  );

  const resolvedName = (ref?: string | null) =>
    tsaMap[ref?.toLowerCase() ?? ""] || ref || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-none h-[88vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-muted flex items-center justify-center shrink-0 rounded-none">
              <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2 flex-wrap">
                Audit Details
                <AuditStatusBadge status={entry.auditStatus} />
                <IssueBadge issue={entry.issue} />
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5 font-mono text-muted-foreground truncate">
                Doc: {entry.id}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-6">
            {/* Company identity */}
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1.5">
                Customer Record
              </p>
              <p className="text-base font-bold uppercase">
                {c?.company_name || entry.customerName || "—"}
              </p>
              {c?.account_reference_number && (
                <p className="text-xs font-mono text-muted-foreground">
                  Ref: {c.account_reference_number}
                </p>
              )}
            </div>

            {/* Core fields grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DetailRow
                label="Contact Person"
                value={c?.contact_person}
                warn={!c?.contact_person}
              />
              <DetailRow
                label="Contact Number"
                value={c?.contact_number}
                warn={!c?.contact_number}
              />
              <DetailRow
                label="Email"
                value={c?.email_address}
                warn={!c?.email_address}
              />
              <DetailRow
                label="Address"
                value={c?.address}
                warn={!c?.address}
              />
              <DetailRow label="Region" value={c?.region} warn={!c?.region} />
              <DetailRow
                label="Type Client"
                value={c?.type_client}
                warn={!c?.type_client}
              />
              <DetailRow label="Status" value={c?.status} warn={!c?.status} />
              <DetailRow
                label="TSA"
                value={resolvedName(c?.referenceid)}
                mono
              />
              <DetailRow label="TSM" value={resolvedName(c?.tsm)} mono />
              <DetailRow
                label="Manager"
                value={resolvedName(c?.manager)}
                mono
              />
              <DetailRow
                label="Date Created"
                value={
                  c?.date_created
                    ? new Date(c.date_created).toLocaleDateString()
                    : undefined
                }
              />
              <DetailRow
                label="Date Updated"
                value={
                  c?.date_updated
                    ? new Date(c.date_updated).toLocaleDateString()
                    : undefined
                }
              />
            </div>

            {/* Duplicate group members */}
            {isDuplicate && groupEntries.length > 1 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                    {entry.issue === "cross-tsa-duplicate" ? (
                      <GitMerge className="w-3 h-3 text-orange-500" />
                    ) : (
                      <Users className="w-3 h-3 text-red-500" />
                    )}
                    Duplicate Group — {groupEntries.length} records
                    {entry.duplicateMatchReason && (
                      <span className="font-normal normal-case opacity-60">
                        · {entry.duplicateMatchReason}
                      </span>
                    )}
                  </p>
                  <div className="divide-y border rounded-none">
                    {groupEntries.map((ge, idx) => {
                      const gc = ge.customer;
                      const isThis = ge.id === entry.id;
                      return (
                        <div
                          key={ge.id}
                          className={cn(
                            "px-4 py-3 flex items-start gap-3",
                            isThis && "bg-blue-50/40",
                          )}
                        >
                          <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0 mt-0.5">
                            #{idx + 1}
                          </span>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold uppercase">
                                {gc?.company_name || ge.customerName || "—"}
                              </p>
                              {isThis && (
                                <span className="text-[9px] font-bold uppercase bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded">
                                  Viewing
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {gc?.contact_person} · {gc?.email_address} ·{" "}
                              {gc?.contact_number}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              TSA: {resolvedName(gc?.referenceid)}
                              {entry.issue === "cross-tsa-duplicate" &&
                                gc?.referenceid !== c?.referenceid && (
                                  <span className="ml-2 text-orange-500 font-bold">
                                    (Different TSA)
                                  </span>
                                )}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Created:{" "}
                              {gc?.date_created
                                ? new Date(gc.date_created).toLocaleDateString()
                                : "—"}
                            </p>
                          </div>
                          <AuditStatusBadge status={ge.auditStatus} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Blank fields — fill inputs (shown for ANY pending audit entry) */}
            {isPending && blankFields.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    Blank Fields — fill to resolve
                  </p>
                  <div className="space-y-3">
                    {blankFields.map((field) => (
                      <div
                        key={field.key as string}
                        className="bg-amber-50 border border-amber-200 rounded-none p-3 space-y-2"
                      >
                        <p className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">
                          {field.label}
                        </p>
                        {field.options ? (
                          <Select
                            value={fieldValues[field.key as string] ?? ""}
                            onValueChange={(v) =>
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.key as string]: v,
                              }))
                            }
                          >
                            <SelectTrigger className="rounded-none h-8 bg-white text-xs">
                              <SelectValue
                                placeholder={`Select ${field.label}…`}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={fieldValues[field.key as string] ?? ""}
                            onChange={(e) =>
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.key as string]: e.target.value,
                              }))
                            }
                            placeholder={`Enter ${field.label}…`}
                            className="rounded-none h-8 bg-white text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Audit metadata */}
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider mb-0.5">
                  Logged by
                </p>
                <p>{entry.performedBy || "—"}</p>
              </div>
              <div>
                <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider mb-0.5">
                  Logged at
                </p>
                <p className="text-muted-foreground">
                  {formatDate(entry.timestamp)}
                </p>
              </div>
              {entry.auditRemarks && (
                <div className="col-span-2">
                  <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider mb-0.5 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Remarks
                  </p>
                  <p className="italic bg-muted/40 border px-3 py-2 text-foreground rounded-none">
                    "{entry.auditRemarks}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer actions */}
        {isPending && (
          <DialogFooter className="px-6 py-4 border-t shrink-0 flex-col sm:flex-row gap-2">
            {/* Delete dupes */}
            {isDuplicate && groupEntries.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-none gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  onAction({
                    primaryEntry: entry,
                    action: "delete-dupes",
                    groupEntries: groupEntries.filter((ge) => ge.customer),
                  });
                  onOpenChange(false);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Duplicates
              </Button>
            )}

            {/* Fill fields */}
            {hasFillableValues && (
              <Button
                size="sm"
                className="rounded-none gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => {
                  onAction({
                    primaryEntry: entry,
                    action: "fill-field",
                    fieldUpdates: Object.fromEntries(
                      Object.entries(fieldValues).filter(
                        ([, v]) => v.trim().length > 0,
                      ),
                    ),
                  });
                  onOpenChange(false);
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Fill{" "}
                {Object.values(fieldValues).filter((v) => v.trim()).length}{" "}
                Field(s)
              </Button>
            )}

            <div className="sm:ml-auto flex gap-2">
              {/* Resolve */}
              <Button
                size="sm"
                className="rounded-none gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  onAction({ primaryEntry: entry, action: "resolve" });
                  onOpenChange(false);
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
              </Button>

              {/* Dismiss */}
              <Button
                size="sm"
                variant="outline"
                className="rounded-none gap-1.5"
                onClick={() => {
                  onAction({ primaryEntry: entry, action: "dismiss" });
                  onOpenChange(false);
                }}
              >
                <XCircle className="w-3.5 h-3.5" /> Dismiss
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomerAuditsPage() {
  const router = useRouter();

  // ── Data state ───────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [tsaMap, setTsaMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterIssue, setFilterIssue] = useState<"all" | AuditIssueType>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | AuditStatus>("all");
  const [page, setPage] = useState(0);

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<AuditRow | null>(null);
  const [actionTarget, setActionTarget] = useState<AuditActionTarget | null>(
    null,
  );
  const [actionOpen, setActionOpen] = useState(false);

  // ── Fetch user identity ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    // Identity used for display only — no auth gate here
  }, []);

  // ── Fetch all users for TSA/TSM/Manager name resolution ─────────────────────
  useEffect(() => {
    fetch("/api/UserManagement/Fetch")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        const map: Record<string, string> = {};
        data.forEach((u) => {
          if (u.ReferenceID) {
            const key = String(u.ReferenceID).toLowerCase();
            const name =
              `${u.Firstname ?? ""} ${u.Lastname ?? ""}`.trim() ||
              u.ReferenceID;
            map[key] = name;
          }
        });
        setTsaMap(map);
      })
      .catch(() => {});
  }, []);

  // ── Firestore listener for customerAudits ────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, CUSTOMER_AUDITS_COLLECTION),
      orderBy("timestamp", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: AuditRow[] = snap.docs
          .map((docSnap): AuditRow | null => {
            const raw = docSnap.data() as Record<string, unknown>;

            // Only process audit action entries
            if (raw.action !== "audit") return null;

            const afterData = (raw.after ?? {}) as Record<string, unknown>;
            const flaggedIssues = Array.isArray(afterData.flaggedIssues)
              ? afterData.flaggedIssues
              : [];
            const issue = normalizeIssue(flaggedIssues);

            return {
              id: docSnap.id,
              customerId: raw.customerId ? String(raw.customerId) : null,
              customerName: (raw.customerName as string) || null,
              referenceId: (raw.referenceId as string) || null,
              issue,
              missingField: issue
                ? (MISSING_FIELD_LABELS[issue] ?? null)
                : null,
              duplicateGroupId: (afterData.duplicateGroupId as string) || null,
              duplicateGroupType:
                (afterData.duplicateGroupType as "same-tsa" | "cross-tsa") ||
                null,
              duplicateMatchReason:
                (afterData.duplicateMatchReason as string) || null,
              auditStatus: (["pending", "resolved", "cancelled"].includes(
                raw.auditStatus as string,
              )
                ? raw.auditStatus
                : "pending") as AuditStatus,
              auditRemarks: (raw.auditRemarks as string) || null,
              timestamp: toDate(raw.timestamp),
              customer: normalizeCustomer(
                raw.before,
                raw.customerId as string,
                raw.referenceId as string,
                raw.customerName as string,
              ),
              performedBy: (raw.performedBy as string) || null,
              performedByRole: (raw.performedByRole as string) || null,
            } satisfies AuditRow;
          })
          .filter((r): r is AuditRow => r !== null);

        setEntries(rows);
        setLoading(false);
      },
      (err) => {
        console.error("[CustomerAudits] Firestore error:", err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // ── Group entries by duplicateGroupId ────────────────────────────────────────
  const groupMap = useMemo(() => {
    const map = new Map<string, AuditRow[]>();
    for (const e of entries) {
      if (e.duplicateGroupId) {
        if (!map.has(e.duplicateGroupId)) map.set(e.duplicateGroupId, []);
        map.get(e.duplicateGroupId)!.push(e);
      }
    }
    return map;
  }, [entries]);

  // ── Pending stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pending = entries.filter((e) => e.auditStatus === "pending");
    return {
      total: pending.length,
      sameTsa: pending.filter((e) => e.issue === "same-tsa-duplicate").length,
      crossTsa: pending.filter((e) => e.issue === "cross-tsa-duplicate").length,
      missingType: pending.filter((e) => e.issue === "missing-type").length,
      missingStatus: pending.filter((e) => e.issue === "missing-status").length,
    };
  }, [entries]);

  // ── Filtered + paged ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      if (q) {
        const c = e.customer;
        const hit = [
          c?.company_name,
          c?.contact_person,
          c?.email_address,
          c?.contact_number,
          e.referenceId,
          tsaMap[e.referenceId?.toLowerCase() ?? ""],
        ].some((f) => f?.toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (filterIssue !== "all" && e.issue !== filterIssue) return false;
      if (filterStatus !== "all" && e.auditStatus !== filterStatus)
        return false;
      return true;
    });
  }, [entries, search, filterIssue, filterStatus, tsaMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Open action dialog ───────────────────────────────────────────────────────
  const handleAction = useCallback((target: AuditActionTarget) => {
    setActionTarget(target);
    setActionOpen(true);
  }, []);

  // ── Execute confirmed action ─────────────────────────────────────────────────
  const handleConfirmAction = useCallback(
    async (target: AuditActionTarget, remarks: string) => {
      const {
        action,
        primaryEntry,
        groupEntries = [],
        keepCustomerId,
        fieldUpdates = {},
      } = target;

      try {
        // ── Delete duplicates ──────────────────────────────────────────────────
        if (action === "delete-dupes") {
          const toDelete = groupEntries.filter(
            (e) => e.customerId !== keepCustomerId && e.customer,
          );
          const deleteIds = toDelete.map((e) => e.customer!.id).filter(Boolean);

          if (deleteIds.length > 0) {
            const res = await fetch(
              "/api/Data/Applications/Taskflow/CustomerDatabase/BulkDelete",
              {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userIds: deleteIds }),
              },
            );
            const result = await res.json();
            if (!res.ok || !result.success) {
              toast.error(result.error || "Failed to delete duplicates.");
              return;
            }
          }

          // Resolve all group entries in Firestore
          const allGroupEntries =
            groupEntries.length > 0 ? groupEntries : [primaryEntry];
          await Promise.all(
            allGroupEntries.map((e) =>
              updateDoc(doc(db, CUSTOMER_AUDITS_COLLECTION, e.id), {
                auditStatus: "resolved",
                auditRemarks: remarks,
                updatedAt: serverTimestamp(),
              }),
            ),
          );
          toast.success(
            `Deleted ${toDelete.length} duplicate(s). Original preserved.`,
          );
        }

        // ── Fill missing field(s) ──────────────────────────────────────────────
        else if (action === "fill-field") {
          const customer = primaryEntry.customer;
          if (!customer) {
            toast.error("Customer data not available.");
            return;
          }

          const res = await fetch(
            "/api/Data/Applications/Taskflow/CustomerDatabase/Edit",
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: customer.id,
                referenceid: customer.referenceid,
                manager: customer.manager,
                tsm: fieldUpdates.tsm ?? customer.tsm,
                company_name: customer.company_name,
                contact_person:
                  fieldUpdates.contact_person ?? customer.contact_person,
                contact_number:
                  fieldUpdates.contact_number ?? customer.contact_number,
                email_address:
                  fieldUpdates.email_address ?? customer.email_address,
                type_client: fieldUpdates.type_client ?? customer.type_client,
                company_group: "",
                address: fieldUpdates.address ?? customer.address,
                delivery_address: "",
                region: fieldUpdates.region ?? customer.region,
                status: fieldUpdates.status ?? customer.status,
              }),
            },
          );
          const result = await res.json();
          if (!res.ok || !result.success) {
            toast.error(result.error || "Failed to update customer fields.");
            return;
          }

          await updateDoc(
            doc(db, CUSTOMER_AUDITS_COLLECTION, primaryEntry.id),
            {
              auditStatus: "resolved",
              auditRemarks: remarks,
              updatedAt: serverTimestamp(),
            },
          );
          toast.success(
            `Updated ${Object.keys(fieldUpdates).length} field(s) and resolved.`,
          );
        }

        // ── Resolve ────────────────────────────────────────────────────────────
        else if (action === "resolve") {
          await updateDoc(
            doc(db, CUSTOMER_AUDITS_COLLECTION, primaryEntry.id),
            {
              auditStatus: "resolved",
              auditRemarks: remarks,
              updatedAt: serverTimestamp(),
            },
          );
          toast.success("Issue marked as resolved.");
        }

        // ── Dismiss ────────────────────────────────────────────────────────────
        else if (action === "dismiss") {
          await updateDoc(
            doc(db, CUSTOMER_AUDITS_COLLECTION, primaryEntry.id),
            {
              auditStatus: "cancelled",
              auditRemarks: remarks,
              updatedAt: serverTimestamp(),
            },
          );
          toast.success("Issue dismissed.");
        }
      } catch (err: any) {
        console.error("[CustomerAudits] Action error:", err);
        toast.error(err.message || "Action failed. Please try again.");
      }
    },
    [],
  );

  // ── Stats card ───────────────────────────────────────────────────────────────
  const StatCard = ({
    label,
    count,
    icon,
    activeIssue,
  }: {
    label: string;
    count: number;
    icon: React.ReactNode;
    activeIssue?: AuditIssueType;
  }) => (
    <button
      type="button"
      onClick={() => {
        if (!activeIssue) return;
        setFilterIssue((prev) => (prev === activeIssue ? "all" : activeIssue));
        setPage(0);
      }}
      className={cn(
        "rounded-none border px-4 py-3 flex items-center gap-3 text-left transition-all w-full",
        "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        activeIssue &&
          filterIssue === activeIssue &&
          "ring-2 ring-primary bg-primary/5",
      )}
    >
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
          {label}
        </p>
        <p className="text-2xl font-bold tabular-nums leading-tight">
          {loading ? "—" : count}
        </p>
      </div>
    </button>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header */}
          <header className="flex h-auto min-h-[56px] shrink-0 items-center gap-2 px-2 md:px-4 py-2 flex-wrap border-b">
            <SidebarTrigger className="-ml-1 touch-button" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              Home
            </Button>
            <Separator orientation="vertical" className="h-4 hidden sm:block" />
            <Breadcrumb className="hidden sm:flex">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/taskflow/customer-database">
                    Taskflow
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/taskflow/customer-database">
                    Customer Database
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Audit Issues</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-none"
                onClick={() => {
                  setSearch("");
                  setFilterIssue("all");
                  setFilterStatus("all");
                  setPage(0);
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset
              </Button>
            </div>
          </header>

          <div className="flex flex-col gap-4 p-4">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <StatCard
                label="Total Pending"
                count={stats.total}
                icon={<ShieldAlert className="size-5 text-zinc-500" />}
              />
              <StatCard
                label="Same-TSA Dups"
                count={stats.sameTsa}
                icon={<Users className="size-5 text-red-500" />}
                activeIssue="same-tsa-duplicate"
              />
              <StatCard
                label="Cross-TSA Dups"
                count={stats.crossTsa}
                icon={<GitMerge className="size-5 text-orange-500" />}
                activeIssue="cross-tsa-duplicate"
              />
              <StatCard
                label="Missing Type"
                count={stats.missingType}
                icon={<AlertTriangle className="size-5 text-amber-500" />}
                activeIssue="missing-type"
              />
              <StatCard
                label="Missing Status"
                count={stats.missingStatus}
                icon={<AlertTriangle className="size-5 text-amber-400" />}
                activeIssue="missing-status"
              />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search company, contact, email…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="pl-8 h-9 rounded-none text-sm"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setPage(0);
                    }}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <Select
                value={filterIssue}
                onValueChange={(v) => {
                  setFilterIssue(v as typeof filterIssue);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-9 w-[170px] rounded-none text-xs">
                  <SelectValue placeholder="All Issues" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Issues</SelectItem>
                  <SelectItem value="same-tsa-duplicate">
                    Same-TSA Duplicate
                  </SelectItem>
                  <SelectItem value="cross-tsa-duplicate">
                    Cross-TSA Duplicate
                  </SelectItem>
                  <SelectItem value="missing-type">Missing Type</SelectItem>
                  <SelectItem value="missing-status">Missing Status</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterStatus}
                onValueChange={(v) => {
                  setFilterStatus(v as typeof filterStatus);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-9 w-[130px] rounded-none text-xs">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="cancelled">Dismissed</SelectItem>
                </SelectContent>
              </Select>

              <p className="ml-auto text-xs text-muted-foreground">
                {loading ? "Loading…" : `${filtered.length} issue(s)`}
              </p>
            </div>

            {/* Table */}
            <div className="border rounded-none overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                      Company
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                      Contact
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                      Email
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                      TSA
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                      Issue
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                      Date
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin opacity-40" />
                          <span className="text-sm">Loading audit data…</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paged.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Inbox className="w-8 h-8 opacity-30" />
                          <span className="text-sm">No audit issues found</span>
                          {(search ||
                            filterIssue !== "all" ||
                            filterStatus !== "all") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-none text-xs"
                              onClick={() => {
                                setSearch("");
                                setFilterIssue("all");
                                setFilterStatus("all");
                              }}
                            >
                              Clear filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paged.map((entry) => {
                      const c = entry.customer;
                      const isPending = entry.auditStatus === "pending";
                      const isDuplicate =
                        entry.issue === "same-tsa-duplicate" ||
                        entry.issue === "cross-tsa-duplicate";
                      const groupEntries = entry.duplicateGroupId
                        ? (groupMap.get(entry.duplicateGroupId) ?? [entry])
                        : [entry];
                      const tsaName =
                        tsaMap[entry.referenceId?.toLowerCase() ?? ""] ||
                        entry.referenceId ||
                        "—";
                      const blankCount = getBlankFields(c).length;

                      return (
                        <TableRow
                          key={entry.id}
                          className={cn(
                            "cursor-pointer hover:bg-muted/20 transition-colors",
                          )}
                          onClick={() => setPreview(entry)}
                        >
                          <TableCell>
                            <p className="text-xs font-semibold uppercase truncate max-w-[200px]">
                              {c?.company_name || entry.customerName || "—"}
                            </p>
                            {c?.account_reference_number && (
                              <p className="text-[10px] font-mono text-muted-foreground">
                                {c.account_reference_number}
                              </p>
                            )}
                          </TableCell>

                          <TableCell>
                            <p className="text-xs truncate max-w-[140px]">
                              {c?.contact_person || (
                                <span className="text-amber-500 italic text-[10px]">
                                  empty
                                </span>
                              )}
                            </p>
                            {c?.contact_number ? (
                              <p className="text-[10px] text-muted-foreground">
                                {c.contact_number}
                              </p>
                            ) : (
                              <p className="text-[10px] text-amber-500 italic">
                                no number
                              </p>
                            )}
                          </TableCell>

                          <TableCell>
                            <p className="text-xs font-mono truncate max-w-[160px]">
                              {c?.email_address || (
                                <span className="text-amber-500 italic text-[10px]">
                                  empty
                                </span>
                              )}
                            </p>
                          </TableCell>

                          <TableCell>
                            <p
                              className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]"
                              title={tsaName}
                            >
                              {tsaName}
                            </p>
                          </TableCell>

                          <TableCell>
                            <IssueBadge issue={entry.issue} />
                            {isDuplicate && groupEntries.length > 1 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {groupEntries.length} in group
                              </p>
                            )}
                            {blankCount > 0 && !isDuplicate && (
                              <p className="text-[10px] text-amber-500 mt-0.5">
                                {blankCount} blank field(s)
                              </p>
                            )}
                          </TableCell>

                          <TableCell>
                            <AuditStatusBadge status={entry.auditStatus} />
                          </TableCell>

                          <TableCell>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(entry.timestamp)}
                            </p>
                          </TableCell>

                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {/* Preview */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreview(entry);
                                }}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>

                              {isPending && (
                                <>
                                  {/* Delete dupes */}
                                  {isDuplicate && groupEntries.length > 1 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[10px] gap-1 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-none"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAction({
                                          primaryEntry: entry,
                                          action: "delete-dupes",
                                          groupEntries: groupEntries.filter(
                                            (ge) => ge.customer,
                                          ),
                                        });
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" /> Dupes
                                    </Button>
                                  )}

                                  {/* Resolve */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 w-7 p-0 border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-none"
                                    title="Resolve"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction({
                                        primaryEntry: entry,
                                        action: "resolve",
                                      });
                                    }}
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                  </Button>

                                  {/* Dismiss */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 w-7 p-0 rounded-none"
                                    title="Dismiss"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction({
                                        primaryEntry: entry,
                                        action: "dismiss",
                                      });
                                    }}
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between py-1">
                <p className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages} · {filtered.length} total
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs rounded-none"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs rounded-none"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1}
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Preview modal */}
      <AuditPreviewModal
        entry={preview}
        open={!!preview}
        onOpenChange={(v) => !v && setPreview(null)}
        groupEntries={
          preview?.duplicateGroupId
            ? (groupMap.get(preview.duplicateGroupId) ?? [preview])
            : preview
              ? [preview]
              : []
        }
        tsaMap={tsaMap}
        onAction={handleAction}
      />

      {/* Remarks-gated action dialog */}
      <AuditRemarksDialog
        target={actionTarget}
        open={actionOpen}
        onOpenChange={(v) => {
          if (!v) setActionOpen(false);
        }}
        onConfirm={handleConfirmAction}
        tsaMap={tsaMap}
      />
    </ProtectedPageWrapper>
  );
}
