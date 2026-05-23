"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Eye, GitMerge, Inbox, Loader2, MessageSquare, Package,
  RefreshCw, Search, ShieldAlert, Trash2, Users, X, XCircle,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection, doc, onSnapshot, orderBy, query,
  serverTimestamp, Timestamp, updateDoc,
} from "firebase/firestore";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { CUSTOMER_AUDITS_COLLECTION } from "@/lib/audit/customer-audit";

// ─── Types ────────────────────────────────────────────────────────────────────
export type AuditIssueType = "same-tsa-duplicate" | "cross-tsa-duplicate" | "missing-type" | "missing-status";
export type AuditStatus = "pending" | "resolved" | "cancelled";
export type AuditActionKind = "delete-dupes" | "fill-field" | "resolve" | "dismiss";

export interface Customer {
  id: number; account_reference_number: string; company_name: string;
  contact_person: string; contact_number: string; email_address: string;
  address: string; region: string; type_client: string; referenceid: string;
  tsm: string; manager: string; status: string; remarks: string;
  date_created: string; date_updated: string; next_available_date?: string;
}

export interface AuditRow {
  id: string; customerId: string | null; customerName: string | null;
  referenceId: string | null; issue: AuditIssueType | null;
  missingField: string | null; duplicateGroupId: string | null;
  duplicateGroupType: "same-tsa" | "cross-tsa" | null;
  duplicateMatchReason: string | null; auditStatus: AuditStatus;
  auditRemarks: string | null; timestamp: Date | null;
  customer: Customer | null; performedBy: string | null; performedByRole: string | null;
}

interface AuditActionTarget {
  primaryEntry: AuditRow; action: AuditActionKind;
  groupEntries?: AuditRow[]; keepCustomerId?: string;
  fieldUpdates?: Record<string, string>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;
const FILLABLE_FIELDS: Array<{ key: keyof Customer; label: string; options?: string[] }> = [
  { key: "type_client", label: "Type Client", options: ["New Client","Existing Client","Prospect","Partner","CSR Client","Transferred Account"] },
  { key: "status", label: "Status", options: ["Active","Inactive","Non-Buying","On Hold","New Client","park"] },
  { key: "contact_person", label: "Contact Person" },
  { key: "contact_number", label: "Contact Number" },
  { key: "email_address", label: "Email Address" },
  { key: "address", label: "Address" },
  { key: "region", label: "Region" },
  { key: "tsm", label: "TSM Reference ID" },
  { key: "manager", label: "Manager Reference ID" },
];
const MISSING_FIELD_LABELS: Partial<Record<AuditIssueType, string>> = {
  "missing-type": "type_client", "missing-status": "status",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object" && v !== null && "toDate" in v) return (v as Timestamp).toDate();
  return null;
}
function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function normalizeCustomer(raw: unknown, fallbackId?: string | null, fallbackRef?: string | null, fallbackName?: string | null): Customer | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Partial<Customer> & { id?: number | string };
  const numId = typeof v.id === "number" ? v.id : Number(v.id ?? fallbackId ?? NaN);
  if (!Number.isFinite(numId)) return null;
  return {
    id: numId, account_reference_number: v.account_reference_number ?? "",
    company_name: v.company_name ?? fallbackName ?? "", contact_person: v.contact_person ?? "",
    contact_number: v.contact_number ?? "", email_address: v.email_address ?? "",
    address: v.address ?? "", region: v.region ?? "", type_client: v.type_client ?? "",
    referenceid: v.referenceid ?? fallbackRef ?? "", tsm: v.tsm ?? "", manager: v.manager ?? "",
    status: v.status ?? "", remarks: v.remarks ?? "", date_created: v.date_created ?? "",
    date_updated: v.date_updated ?? "", next_available_date: v.next_available_date,
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
  return FILLABLE_FIELDS.filter((f) => { const val = customer[f.key]; return !val || String(val).trim() === ""; });
}

// ─── IssueBadge ───────────────────────────────────────────────────────────────
function IssueBadge({ issue }: { issue: AuditIssueType | null }) {
  if (!issue) return <span className="text-[10px] text-slate-600 font-mono">—</span>;
  const cfg: Record<AuditIssueType, { label: string; cls: string }> = {
    "same-tsa-duplicate":  { label: "Dup · Same TSA",  cls: "bg-red-500/10 text-red-400 border-red-500/30" },
    "cross-tsa-duplicate": { label: "Dup · Cross TSA", cls: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
    "missing-type":        { label: "Missing Type",    cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
    "missing-status":      { label: "Missing Status",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  };
  return (
    <span className={cn("inline-flex text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border tracking-widest", cfg[issue].cls)}>
      {cfg[issue].label}
    </span>
  );
}

// ─── AuditStatusBadge ─────────────────────────────────────────────────────────
function AuditStatusBadge({ status }: { status: AuditStatus }) {
  if (status === "pending")
    return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-amber-500/30 bg-amber-500/10 text-amber-400 uppercase tracking-widest"><Clock className="w-2.5 h-2.5" /> Pending</span>;
  if (status === "resolved")
    return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 uppercase tracking-widest"><CheckCircle2 className="w-2.5 h-2.5" /> Resolved</span>;
  return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-slate-700 bg-slate-800 text-slate-500 uppercase tracking-widest"><XCircle className="w-2.5 h-2.5" /> Dismissed</span>;
}

// ─── AuditRemarksDialog ───────────────────────────────────────────────────────
interface AuditRemarksDialogProps {
  target: AuditActionTarget | null; open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (target: AuditActionTarget, remarks: string) => Promise<void>;
  tsaMap: Record<string, string>;
}
function AuditRemarksDialog({ target, open, onOpenChange, onConfirm, tsaMap }: AuditRemarksDialogProps) {
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keepId, setKeepId] = useState<string>("");

  useEffect(() => {
    if (open && target) {
      setRemarks(""); setRemarksError(false);
      if (target.action === "delete-dupes" && target.groupEntries?.length) {
        const sorted = [...target.groupEntries].filter((e) => e.customer)
          .sort((a, b) => (a.customer!.date_created ?? "").localeCompare(b.customer!.date_created ?? ""));
        setKeepId(sorted[0]?.customerId ?? "");
      }
    }
  }, [open, target]);

  if (!target) return null;
  const { action, primaryEntry } = target;
  const customer = primaryEntry.customer;
  const remarksOk = remarks.trim().length > 0;

  const actionCfg: Record<AuditActionKind, { title: string; desc: string; icon: React.ReactNode; confirmLabel: string; confirmCls: string }> = {
    "delete-dupes": { title: "Delete Duplicates", desc: "All duplicate entries except the selected original will be permanently deleted.", icon: <Trash2 className="w-4 h-4 text-red-400" />, confirmLabel: "Delete Duplicates", confirmCls: "bg-red-600 hover:bg-red-500 text-white border-0" },
    "fill-field":   { title: "Fill Missing Field", desc: "The missing field will be updated and the issue resolved.", icon: <CheckCircle2 className="w-4 h-4 text-amber-400" />, confirmLabel: "Fill & Resolve", confirmCls: "bg-amber-600 hover:bg-amber-500 text-white border-0" },
    "resolve":      { title: "Resolve Issue", desc: "Mark this audit issue as resolved. No data changes will be applied.", icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, confirmLabel: "Mark Resolved", confirmCls: "bg-emerald-600 hover:bg-emerald-500 text-white border-0" },
    "dismiss":      { title: "Dismiss Issue", desc: "Dismiss this issue. It will be marked as cancelled.", icon: <XCircle className="w-4 h-4 text-slate-400" />, confirmLabel: "Dismiss", confirmCls: "bg-slate-700 hover:bg-slate-600 text-white border-0" },
  };
  const cfg = actionCfg[action];
  const groupEntries = target.groupEntries ?? [primaryEntry];

  const handleConfirm = async () => {
    if (!remarksOk) { setRemarksError(true); return; }
    setLoading(true);
    try {
      const updatedTarget = action === "delete-dupes" ? { ...target, keepCustomerId: keepId } : target;
      await onConfirm(updatedTarget, remarks.trim());
      onOpenChange(false);
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) { setRemarks(""); setRemarksError(false); onOpenChange(false); } }}>
      <DialogContent className="sm:max-w-lg bg-[#0d1117] border-orange-500/20 text-slate-100 rounded-none p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 border border-orange-500/20">{cfg.icon}</div>
            <div>
              <DialogTitle className="text-sm font-bold uppercase tracking-widest font-mono text-orange-400">{cfg.title}</DialogTitle>
              <DialogDescription className="text-[11px] text-slate-500 mt-0.5">{cfg.desc}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="px-5 py-4 space-y-4">
          {/* Customer identity */}
          <div className="flex items-center gap-3 border border-orange-500/10 bg-orange-500/[0.03] px-3 py-2.5">
            <div className="h-8 w-8 shrink-0 bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono font-semibold uppercase truncate text-slate-200">{customer?.company_name || primaryEntry.customerName || "—"}</p>
              <p className="text-[10px] text-slate-500 font-mono">TSA: {tsaMap[primaryEntry.referenceId?.toLowerCase() ?? ""] || primaryEntry.referenceId || "—"}</p>
            </div>
            <IssueBadge issue={primaryEntry.issue} />
          </div>

          {/* Delete dupes: keep selector */}
          {action === "delete-dupes" && groupEntries.length > 1 && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono font-bold uppercase text-orange-500/60 tracking-widest">Select record to keep ({groupEntries.length} duplicates)</p>
              <div className="border border-slate-700/50 divide-y divide-slate-800 max-h-48 overflow-y-auto">
                {groupEntries.map((entry) => {
                  const c = entry.customer; if (!c) return null;
                  const isKeep = keepId === entry.customerId;
                  return (
                    <div key={entry.id} className={cn("flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-500/5 transition-colors", isKeep && "bg-emerald-500/5 border-l-2 border-l-emerald-500/50")} onClick={() => setKeepId(entry.customerId ?? "")}>
                      <div className={cn("w-3.5 h-3.5 border-2 shrink-0 transition-colors", isKeep ? "border-emerald-500 bg-emerald-500" : "border-slate-600")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-mono font-semibold uppercase truncate text-slate-200">{c.company_name}</p>
                        <p className="text-[10px] text-slate-500">{c.contact_person} · {c.email_address}</p>
                      </div>
                      <span className={cn("text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 border", isKeep ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30")}>{isKeep ? "Keep" : "Delete"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fill field summary */}
          {action === "fill-field" && target.fieldUpdates && (
            <div className="border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
              <p className="text-[10px] font-mono font-bold uppercase text-amber-400/70 tracking-widest">Fields to update</p>
              {Object.entries(target.fieldUpdates).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-amber-500/70">{k}</span>
                  <span className="text-slate-600">→</span>
                  <span className="font-semibold text-amber-300">{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Remarks */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase text-orange-500/60 tracking-widest flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" /> Remarks <span className="text-red-400">*</span>
            </label>
            <Textarea autoFocus value={remarks} onChange={(e) => { setRemarks(e.target.value); if (e.target.value.trim()) setRemarksError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleConfirm(); } }}
              placeholder={action === "delete-dupes" ? "Explain why these duplicates are being removed…" : action === "fill-field" ? "Explain why you are filling this field…" : action === "resolve" ? "Explain how this issue was resolved…" : "Explain why you are dismissing this issue…"}
              className={cn("rounded-none resize-none min-h-[80px] text-xs font-mono bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-orange-500/50", remarksError && "border-red-500/50")}
              disabled={loading} />
            {remarksError && <p className="flex items-center gap-1.5 text-[10px] text-red-400 font-mono"><AlertCircle className="w-3 h-3 shrink-0" /> Remarks are required before proceeding.</p>}
            <p className="text-[10px] text-slate-600 font-mono">Tip: Ctrl+Enter / ⌘+Enter to confirm.</p>
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" className="rounded-none text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs uppercase tracking-wider font-mono" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button size="sm" className={cn("rounded-none gap-1.5 text-xs uppercase tracking-wider font-mono", remarksOk ? cfg.confirmCls : "bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed")} onClick={handleConfirm} disabled={loading || !remarksOk}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : action === "delete-dupes" ? <Trash2 className="w-3.5 h-3.5" /> : action === "dismiss" ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {loading ? "Processing…" : cfg.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AuditPreviewModal ────────────────────────────────────────────────────────
interface AuditPreviewModalProps {
  entry: AuditRow | null; open: boolean; onOpenChange: (v: boolean) => void;
  groupEntries: AuditRow[]; tsaMap: Record<string, string>;
  onAction: (target: AuditActionTarget) => void;
}
function AuditPreviewModal({ entry, open, onOpenChange, groupEntries, tsaMap, onAction }: AuditPreviewModalProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  useEffect(() => { if (open) setFieldValues({}); }, [open, entry?.id]);
  if (!entry) return null;
  const c = entry.customer;
  const isPending = entry.auditStatus === "pending";
  const isDuplicate = entry.issue === "same-tsa-duplicate" || entry.issue === "cross-tsa-duplicate";
  const blankFields = getBlankFields(c);
  const hasFillableValues = Object.values(fieldValues).some((v) => v.trim().length > 0);
  const resolvedName = (ref?: string | null) => tsaMap[ref?.toLowerCase() ?? ""] || ref || "—";

  const DetailRow = ({ label, value, mono = false, warn = false }: { label: string; value?: string | null; mono?: boolean; warn?: boolean }) => (
    <div className="space-y-0.5">
      <p className="text-[9px] font-mono font-bold uppercase text-orange-500/50 tracking-widest">{label}</p>
      {warn && (!value || value.trim() === "")
        ? <p className="text-[11px] text-amber-400 flex items-center gap-1 font-mono italic"><AlertTriangle className="w-3 h-3" /> Empty</p>
        : <p className={cn("text-[11px] text-slate-300", mono && "font-mono")}>{value || <span className="text-slate-600">—</span>}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-[#0d1117] border-orange-500/20 text-slate-100 rounded-none h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-bold uppercase tracking-widest font-mono text-orange-400 flex items-center gap-2 flex-wrap">
                Audit Details <AuditStatusBadge status={entry.auditStatus} /> <IssueBadge issue={entry.issue} />
              </DialogTitle>
              <DialogDescription className="text-[10px] mt-0.5 font-mono text-slate-600 truncate">Doc: {entry.id}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 py-4 space-y-5">
            {/* Company identity */}
            <div>
              <p className="text-[9px] font-mono font-bold uppercase text-orange-500/50 tracking-widest mb-1">Customer Record</p>
              <p className="text-sm font-mono font-bold uppercase text-slate-100">{c?.company_name || entry.customerName || "—"}</p>
              {c?.account_reference_number && <p className="text-[10px] font-mono text-orange-500/40 mt-0.5">{c.account_reference_number}</p>}
            </div>

            {/* Divider */}
            <div className="h-px bg-orange-500/10" />

            {/* Core fields grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <DetailRow label="Contact Person" value={c?.contact_person} warn={!c?.contact_person} />
              <DetailRow label="Contact Number" value={c?.contact_number} warn={!c?.contact_number} />
              <DetailRow label="Email" value={c?.email_address} warn={!c?.email_address} />
              <DetailRow label="Address" value={c?.address} warn={!c?.address} />
              <DetailRow label="Region" value={c?.region} warn={!c?.region} />
              <DetailRow label="Type Client" value={c?.type_client} warn={!c?.type_client} />
              <DetailRow label="Status" value={c?.status} warn={!c?.status} />
              <DetailRow label="TSA" value={resolvedName(c?.referenceid)} mono />
              <DetailRow label="TSM" value={resolvedName(c?.tsm)} mono />
              <DetailRow label="Manager" value={resolvedName(c?.manager)} mono />
              <DetailRow label="Date Created" value={c?.date_created ? new Date(c.date_created).toLocaleDateString() : undefined} />
              <DetailRow label="Date Updated" value={c?.date_updated ? new Date(c.date_updated).toLocaleDateString() : undefined} />
            </div>

            {/* Duplicate group */}
            {isDuplicate && groupEntries.length > 1 && (
              <>
                <div className="h-px bg-orange-500/10" />
                <div className="space-y-3">
                  <p className="text-[9px] font-mono font-bold uppercase text-orange-500/50 tracking-widest flex items-center gap-2">
                    {entry.issue === "cross-tsa-duplicate" ? <GitMerge className="w-3 h-3 text-orange-400" /> : <Users className="w-3 h-3 text-red-400" />}
                    Duplicate Group — {groupEntries.length} records
                    {entry.duplicateMatchReason && <span className="font-normal normal-case opacity-50">· {entry.duplicateMatchReason}</span>}
                  </p>
                  <div className="divide-y divide-slate-800 border border-slate-700/50">
                    {groupEntries.map((ge, idx) => {
                      const gc = ge.customer; const isThis = ge.id === entry.id;
                      return (
                        <div key={ge.id} className={cn("px-3 py-2.5 flex items-start gap-3", isThis && "bg-orange-500/[0.04] border-l-2 border-l-orange-500/40")}>
                          <span className="text-[9px] font-mono text-slate-600 w-5 shrink-0 mt-0.5">#{idx + 1}</span>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[11px] font-mono font-bold uppercase text-slate-200">{gc?.company_name || ge.customerName || "—"}</p>
                              {isThis && <span className="text-[8px] font-mono font-bold uppercase bg-orange-500/10 text-orange-400 border border-orange-500/30 px-1.5 py-0.5">Viewing</span>}
                            </div>
                            <p className="text-[10px] text-slate-500">{gc?.contact_person} · {gc?.email_address}</p>
                            <p className="text-[10px] text-slate-500 font-mono">TSA: {resolvedName(gc?.referenceid)}
                              {entry.issue === "cross-tsa-duplicate" && gc?.referenceid !== c?.referenceid && <span className="ml-2 text-orange-400 font-bold">(Different TSA)</span>}
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

            {/* Blank fields — fill inputs */}
            {isPending && blankFields.length > 0 && (
              <>
                <div className="h-px bg-orange-500/10" />
                <div className="space-y-3">
                  <p className="text-[9px] font-mono font-bold uppercase text-orange-500/50 tracking-widest flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-amber-400" /> Blank Fields — fill to resolve
                  </p>
                  <div className="space-y-2">
                    {blankFields.map((field) => (
                      <div key={field.key as string} className="border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
                        <p className="text-[9px] font-mono font-bold uppercase text-amber-400/70 tracking-widest">{field.label}</p>
                        {field.options ? (
                          <Select value={fieldValues[field.key as string] ?? ""} onValueChange={(v) => setFieldValues((prev) => ({ ...prev, [field.key as string]: v }))}>
                            <SelectTrigger className="rounded-none h-8 bg-slate-800 border-slate-700 text-slate-200 text-xs font-mono focus:border-orange-500/50">
                              <SelectValue placeholder={`Select ${field.label}…`} />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                              {field.options.map((opt) => <SelectItem key={opt} value={opt} className="text-xs focus:bg-orange-500/10 focus:text-orange-400">{opt}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value={fieldValues[field.key as string] ?? ""} onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key as string]: e.target.value }))}
                            placeholder={`Enter ${field.label}…`} className="rounded-none h-8 bg-slate-800 border-slate-700 text-slate-200 text-xs font-mono placeholder:text-slate-600 focus:border-orange-500/50" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Audit metadata */}
            <div className="h-px bg-orange-500/10" />
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-[9px] font-mono font-bold uppercase text-orange-500/50 tracking-widest mb-0.5">Logged by</p><p className="text-[11px] text-slate-300">{entry.performedBy || "—"}</p></div>
              <div><p className="text-[9px] font-mono font-bold uppercase text-orange-500/50 tracking-widest mb-0.5">Logged at</p><p className="text-[11px] text-slate-500 font-mono">{formatDate(entry.timestamp)}</p></div>
              {entry.auditRemarks && (
                <div className="col-span-2">
                  <p className="text-[9px] font-mono font-bold uppercase text-orange-500/50 tracking-widest mb-0.5 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Remarks</p>
                  <p className="text-[11px] italic border border-slate-700/50 bg-slate-800/40 px-3 py-2 text-slate-400">"{entry.auditRemarks}"</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer actions */}
        {isPending && (
          <div className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 shrink-0 flex flex-col sm:flex-row gap-2">
            {isDuplicate && groupEntries.length > 1 && (
              <Button size="sm" variant="outline" className="rounded-none gap-1.5 text-[10px] font-mono uppercase tracking-widest border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => { onAction({ primaryEntry: entry, action: "delete-dupes", groupEntries: groupEntries.filter((ge) => ge.customer) }); onOpenChange(false); }}>
                <Trash2 className="w-3.5 h-3.5" /> Delete Duplicates
              </Button>
            )}
            {hasFillableValues && (
              <Button size="sm" className="rounded-none gap-1.5 text-[10px] font-mono uppercase tracking-widest bg-amber-600 hover:bg-amber-500 text-white border-0"
                onClick={() => { onAction({ primaryEntry: entry, action: "fill-field", fieldUpdates: Object.fromEntries(Object.entries(fieldValues).filter(([, v]) => v.trim().length > 0)) }); onOpenChange(false); }}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Fill {Object.values(fieldValues).filter((v) => v.trim()).length} Field(s)
              </Button>
            )}
            <div className="sm:ml-auto flex gap-2">
              <Button size="sm" className="rounded-none gap-1.5 text-[10px] font-mono uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                onClick={() => { onAction({ primaryEntry: entry, action: "resolve" }); onOpenChange(false); }}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
              </Button>
              <Button size="sm" variant="outline" className="rounded-none gap-1.5 text-[10px] font-mono uppercase tracking-widest border-slate-700 text-slate-400 hover:bg-slate-800"
                onClick={() => { onAction({ primaryEntry: entry, action: "dismiss" }); onOpenChange(false); }}>
                <XCircle className="w-3.5 h-3.5" /> Dismiss
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomerAuditsPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [tsaMap, setTsaMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterIssue, setFilterIssue] = useState<"all" | AuditIssueType>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | AuditStatus>("all");
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<AuditRow | null>(null);
  const [actionTarget, setActionTarget] = useState<AuditActionTarget | null>(null);
  const [actionOpen, setActionOpen] = useState(false);

  useEffect(() => {
    fetch("/api/UserManagement/Fetch").then((r) => (r.ok ? r.json() : [])).then((data: any[]) => {
      if (!Array.isArray(data)) return;
      const map: Record<string, string> = {};
      data.forEach((u) => { if (u.ReferenceID) { const key = String(u.ReferenceID).toLowerCase(); map[key] = `${u.Firstname ?? ""} ${u.Lastname ?? ""}`.trim() || u.ReferenceID; } });
      setTsaMap(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const q = query(collection(db, CUSTOMER_AUDITS_COLLECTION), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows: AuditRow[] = snap.docs.map((docSnap): AuditRow | null => {
        const raw = docSnap.data() as Record<string, unknown>;
        if (raw.action !== "audit") return null;
        const afterData = (raw.after ?? {}) as Record<string, unknown>;
        const flaggedIssues = Array.isArray(afterData.flaggedIssues) ? afterData.flaggedIssues : [];
        const issue = normalizeIssue(flaggedIssues);
        return {
          id: docSnap.id, customerId: raw.customerId ? String(raw.customerId) : null,
          customerName: (raw.customerName as string) || null, referenceId: (raw.referenceId as string) || null,
          issue, missingField: issue ? (MISSING_FIELD_LABELS[issue] ?? null) : null,
          duplicateGroupId: (afterData.duplicateGroupId as string) || null,
          duplicateGroupType: (afterData.duplicateGroupType as "same-tsa" | "cross-tsa") || null,
          duplicateMatchReason: (afterData.duplicateMatchReason as string) || null,
          auditStatus: (["pending","resolved","cancelled"].includes(raw.auditStatus as string) ? raw.auditStatus : "pending") as AuditStatus,
          auditRemarks: (raw.auditRemarks as string) || null, timestamp: toDate(raw.timestamp),
          customer: normalizeCustomer(raw.before, raw.customerId as string, raw.referenceId as string, raw.customerName as string),
          performedBy: (raw.performedBy as string) || null, performedByRole: (raw.performedByRole as string) || null,
        } satisfies AuditRow;
      }).filter((r): r is AuditRow => r !== null);
      setEntries(rows); setLoading(false);
    }, (err) => { console.error("[CustomerAudits] Firestore error:", err.message); setLoading(false); });
    return () => unsub();
  }, []);

  const groupMap = useMemo(() => {
    const map = new Map<string, AuditRow[]>();
    for (const e of entries) { if (e.duplicateGroupId) { if (!map.has(e.duplicateGroupId)) map.set(e.duplicateGroupId, []); map.get(e.duplicateGroupId)!.push(e); } }
    return map;
  }, [entries]);

  const stats = useMemo(() => {
    const pending = entries.filter((e) => e.auditStatus === "pending");
    return { total: pending.length, sameTsa: pending.filter((e) => e.issue === "same-tsa-duplicate").length, crossTsa: pending.filter((e) => e.issue === "cross-tsa-duplicate").length, missingType: pending.filter((e) => e.issue === "missing-type").length, missingStatus: pending.filter((e) => e.issue === "missing-status").length };
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      if (q) { const c = e.customer; const hit = [c?.company_name, c?.contact_person, c?.email_address, c?.contact_number, e.referenceId, tsaMap[e.referenceId?.toLowerCase() ?? ""]].some((f) => f?.toLowerCase().includes(q)); if (!hit) return false; }
      if (filterIssue !== "all" && e.issue !== filterIssue) return false;
      if (filterStatus !== "all" && e.auditStatus !== filterStatus) return false;
      return true;
    });
  }, [entries, search, filterIssue, filterStatus, tsaMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleAction = useCallback((target: AuditActionTarget) => { setActionTarget(target); setActionOpen(true); }, []);

  const handleConfirmAction = useCallback(async (target: AuditActionTarget, remarks: string) => {
    const { action, primaryEntry, groupEntries = [], keepCustomerId, fieldUpdates = {} } = target;
    try {
      if (action === "delete-dupes") {
        const toDelete = groupEntries.filter((e) => e.customerId !== keepCustomerId && e.customer);
        const deleteIds = toDelete.map((e) => e.customer!.id).filter(Boolean);
        if (deleteIds.length > 0) {
          const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/BulkDelete", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: deleteIds }) });
          const result = await res.json();
          if (!res.ok || !result.success) { toast.error(result.error || "Failed to delete duplicates."); return; }
        }
        const allGroupEntries = groupEntries.length > 0 ? groupEntries : [primaryEntry];
        await Promise.all(allGroupEntries.map((e) => updateDoc(doc(db, CUSTOMER_AUDITS_COLLECTION, e.id), { auditStatus: "resolved", auditRemarks: remarks, updatedAt: serverTimestamp() })));
        toast.success(`Deleted ${toDelete.length} duplicate(s). Original preserved.`);
      } else if (action === "fill-field") {
        const customer = primaryEntry.customer;
        if (!customer) { toast.error("Customer data not available."); return; }
        const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Edit", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: customer.id, referenceid: customer.referenceid, manager: customer.manager, tsm: fieldUpdates.tsm ?? customer.tsm, company_name: customer.company_name, contact_person: fieldUpdates.contact_person ?? customer.contact_person, contact_number: fieldUpdates.contact_number ?? customer.contact_number, email_address: fieldUpdates.email_address ?? customer.email_address, type_client: fieldUpdates.type_client ?? customer.type_client, company_group: "", address: fieldUpdates.address ?? customer.address, delivery_address: "", region: fieldUpdates.region ?? customer.region, status: fieldUpdates.status ?? customer.status }) });
        const result = await res.json();
        if (!res.ok || !result.success) { toast.error(result.error || "Failed to update customer fields."); return; }
        await updateDoc(doc(db, CUSTOMER_AUDITS_COLLECTION, primaryEntry.id), { auditStatus: "resolved", auditRemarks: remarks, updatedAt: serverTimestamp() });
        toast.success(`Updated ${Object.keys(fieldUpdates).length} field(s) and resolved.`);
      } else if (action === "resolve") {
        await updateDoc(doc(db, CUSTOMER_AUDITS_COLLECTION, primaryEntry.id), { auditStatus: "resolved", auditRemarks: remarks, updatedAt: serverTimestamp() });
        toast.success("Issue marked as resolved.");
      } else if (action === "dismiss") {
        await updateDoc(doc(db, CUSTOMER_AUDITS_COLLECTION, primaryEntry.id), { auditStatus: "cancelled", auditRemarks: remarks, updatedAt: serverTimestamp() });
        toast.success("Issue dismissed.");
      }
    } catch (err: any) { console.error("[CustomerAudits] Action error:", err); toast.error(err.message || "Action failed. Please try again."); }
  }, []);

  // ── Stat card ────────────────────────────────────────────────────────────────
  const StatCard = ({ label, count, icon, activeIssue, accent = "orange" }: { label: string; count: number; icon: React.ReactNode; activeIssue?: AuditIssueType; accent?: string }) => {
    const isActive = activeIssue && filterIssue === activeIssue;
    return (
      <button type="button" onClick={() => { if (!activeIssue) return; setFilterIssue((prev) => (prev === activeIssue ? "all" : activeIssue)); setPage(0); }}
        className={cn("border px-3 py-2.5 flex items-center gap-3 text-left transition-all w-full bg-[#0d1117]", "hover:bg-orange-500/5 hover:border-orange-500/20", isActive ? "border-orange-500/40 bg-orange-500/[0.06]" : "border-slate-800")}>
        <div className="shrink-0 text-orange-400/60">{icon}</div>
        <div>
          <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/50">{label}</p>
          <p className="text-xl font-mono font-bold tabular-nums text-slate-200 leading-tight">{loading ? "—" : count}</p>
        </div>
      </button>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
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
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/taskflow/customer-database" className="text-slate-500 hover:text-orange-400 text-xs font-mono uppercase tracking-wider">Taskflow</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block text-slate-700" />
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/taskflow/customer-database" className="text-slate-500 hover:text-orange-400 text-xs font-mono uppercase tracking-wider">Customer DB</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block text-slate-700" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-orange-400 text-xs font-mono tracking-widest uppercase">Audit Issues</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-2 px-4 relative z-10">
              <button onClick={() => { setSearch(""); setFilterIssue("all"); setFilterStatus("all"); setPage(0); }}
                className="inline-flex items-center gap-1.5 h-7 px-3 text-[9px] font-mono uppercase tracking-widest border border-slate-800 bg-transparent text-slate-500 hover:border-orange-500/30 hover:text-orange-400 hover:bg-orange-500/10 transition-colors">
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
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
                  <ShieldAlert className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <h1 className="text-sm font-bold tracking-widest uppercase text-orange-400 font-mono leading-tight">Audit Issues</h1>
                  <p className="text-[10px] text-slate-600 font-mono mt-0.5 tracking-wider">DUPLICATES · MISSING FIELDS · REVIEW</p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]" />
                  <span className="text-orange-400/60">Firebase Sync</span>
                </div>
                <div className="w-px h-3 bg-slate-700" />
                <span className="text-orange-400/60">{loading ? "Loading…" : `${filtered.length} issue(s)`}</span>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `linear-gradient(rgba(251,146,60,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(251,146,60,0.03) 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
            <div className="relative z-10 flex flex-col gap-4 p-4 sm:p-6">

              {/* ── Stats ── */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <StatCard label="Total Pending" count={stats.total} icon={<ShieldAlert className="size-4" />} />
                <StatCard label="Same-TSA Dups" count={stats.sameTsa} icon={<Users className="size-4" />} activeIssue="same-tsa-duplicate" />
                <StatCard label="Cross-TSA Dups" count={stats.crossTsa} icon={<GitMerge className="size-4" />} activeIssue="cross-tsa-duplicate" />
                <StatCard label="Missing Type" count={stats.missingType} icon={<AlertTriangle className="size-4" />} activeIssue="missing-type" />
                <StatCard label="Missing Status" count={stats.missingStatus} icon={<AlertTriangle className="size-4" />} activeIssue="missing-status" />
              </div>

              {/* ── Toolbar ── */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] max-w-xs flex-1">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-600" />
                  <Input placeholder="Search company, contact, email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    className="pl-8 h-9 rounded-none text-xs font-mono bg-[#0d1117] border-slate-800 text-slate-300 placeholder:text-slate-700 focus:border-orange-500/40" />
                  {search && <button onClick={() => { setSearch(""); setPage(0); }} className="absolute right-2.5 top-2.5 text-slate-600 hover:text-orange-400 transition-colors"><X className="w-3.5 h-3.5" /></button>}
                </div>
                <Select value={filterIssue} onValueChange={(v) => { setFilterIssue(v as typeof filterIssue); setPage(0); }}>
                  <SelectTrigger className="h-9 w-[170px] rounded-none text-[10px] font-mono uppercase tracking-wider bg-[#0d1117] border-slate-800 text-slate-400 focus:border-orange-500/40">
                    <SelectValue placeholder="All Issues" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                    <SelectItem value="all" className="text-xs focus:bg-orange-500/10 focus:text-orange-400">All Issues</SelectItem>
                    <SelectItem value="same-tsa-duplicate" className="text-xs focus:bg-orange-500/10 focus:text-orange-400">Same-TSA Duplicate</SelectItem>
                    <SelectItem value="cross-tsa-duplicate" className="text-xs focus:bg-orange-500/10 focus:text-orange-400">Cross-TSA Duplicate</SelectItem>
                    <SelectItem value="missing-type" className="text-xs focus:bg-orange-500/10 focus:text-orange-400">Missing Type</SelectItem>
                    <SelectItem value="missing-status" className="text-xs focus:bg-orange-500/10 focus:text-orange-400">Missing Status</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as typeof filterStatus); setPage(0); }}>
                  <SelectTrigger className="h-9 w-[130px] rounded-none text-[10px] font-mono uppercase tracking-wider bg-[#0d1117] border-slate-800 text-slate-400 focus:border-orange-500/40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                    <SelectItem value="all" className="text-xs focus:bg-orange-500/10 focus:text-orange-400">All Status</SelectItem>
                    <SelectItem value="pending" className="text-xs focus:bg-orange-500/10 focus:text-orange-400">Pending</SelectItem>
                    <SelectItem value="resolved" className="text-xs focus:bg-orange-500/10 focus:text-orange-400">Resolved</SelectItem>
                    <SelectItem value="cancelled" className="text-xs focus:bg-orange-500/10 focus:text-orange-400">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ── Table ── */}
              <div className="border border-orange-500/10 bg-[#0a0d14] overflow-auto">
                <Table className="whitespace-nowrap text-[11px] min-w-full">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="border-b border-orange-500/20 bg-[#0d1117] hover:bg-[#0d1117]">
                      {["Company","Contact","Email","TSA","Issue","Status","Date","Actions"].map((h, i) => (
                        <TableHead key={h} className={cn("py-2 px-3 text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/60 border-r border-orange-500/5 last:border-r-0", i === 7 && "text-right")}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-5 h-5 animate-spin text-orange-500/40" />
                          <span className="text-[10px] font-mono uppercase tracking-widest text-orange-500/30">Loading audit data…</span>
                        </div>
                      </TableCell></TableRow>
                    ) : paged.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                          <div className="relative p-3 border border-orange-500/20 bg-orange-500/5">
                            <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-orange-500/30" />
                            <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-orange-500/30" />
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/30" />
                            <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/30" />
                            <Inbox className="w-5 h-5 text-orange-500/30" />
                          </div>
                          <p className="text-[10px] font-mono uppercase tracking-widest text-orange-500/30">No audit issues found</p>
                          {(search || filterIssue !== "all" || filterStatus !== "all") && (
                            <button onClick={() => { setSearch(""); setFilterIssue("all"); setFilterStatus("all"); }}
                              className="text-[9px] font-mono uppercase tracking-widest border border-slate-700 text-slate-500 hover:border-orange-500/30 hover:text-orange-400 px-3 py-1 transition-colors">
                              Clear filters
                            </button>
                          )}
                        </div>
                      </TableCell></TableRow>
                    ) : paged.map((entry) => {
                      const c = entry.customer;
                      const isPending = entry.auditStatus === "pending";
                      const isDuplicate = entry.issue === "same-tsa-duplicate" || entry.issue === "cross-tsa-duplicate";
                      const groupEntries = entry.duplicateGroupId ? (groupMap.get(entry.duplicateGroupId) ?? [entry]) : [entry];
                      const tsaName = tsaMap[entry.referenceId?.toLowerCase() ?? ""] || entry.referenceId || "—";
                      const blankCount = getBlankFields(c).length;
                      const cellBase = "py-2 px-3 border-r border-orange-500/5 last:border-r-0";
                      return (
                        <TableRow key={entry.id} className="border-b border-orange-500/5 hover:bg-orange-500/[0.04] transition-colors cursor-pointer" onClick={() => setPreview(entry)}>
                          <TableCell className={cellBase}>
                            <p className="text-[11px] font-mono font-semibold uppercase truncate max-w-[200px] text-slate-200">{c?.company_name || entry.customerName || "—"}</p>
                            {c?.account_reference_number && <p className="text-[9px] font-mono text-orange-500/40">{c.account_reference_number}</p>}
                          </TableCell>
                          <TableCell className={cellBase}>
                            <p className="text-[11px] truncate max-w-[140px] text-slate-300">{c?.contact_person || <span className="text-amber-400/60 italic text-[10px] font-mono">empty</span>}</p>
                            {c?.contact_number ? <p className="text-[10px] text-slate-500 font-mono">{c.contact_number}</p> : <p className="text-[10px] text-amber-400/60 italic font-mono">no number</p>}
                          </TableCell>
                          <TableCell className={cellBase}>
                            <p className="text-[11px] font-mono truncate max-w-[160px] text-slate-400">{c?.email_address || <span className="text-amber-400/60 italic text-[10px]">empty</span>}</p>
                          </TableCell>
                          <TableCell className={cellBase}>
                            <p className="text-[10px] text-slate-500 font-mono truncate max-w-[100px]" title={tsaName}>{tsaName}</p>
                          </TableCell>
                          <TableCell className={cellBase}>
                            <IssueBadge issue={entry.issue} />
                            {isDuplicate && groupEntries.length > 1 && <p className="text-[9px] text-slate-600 font-mono mt-0.5">{groupEntries.length} in group</p>}
                            {blankCount > 0 && !isDuplicate && <p className="text-[9px] text-amber-400/60 font-mono mt-0.5">{blankCount} blank field(s)</p>}
                          </TableCell>
                          <TableCell className={cellBase}><AuditStatusBadge status={entry.auditStatus} /></TableCell>
                          <TableCell className={cellBase}>
                            <p className="text-[10px] text-slate-500 font-mono whitespace-nowrap">{formatDate(entry.timestamp)}</p>
                          </TableCell>
                          <TableCell className={cn(cellBase, "text-right")} onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button className="h-7 w-7 flex items-center justify-center text-slate-600 hover:text-orange-400 hover:bg-orange-500/10 transition-colors" onClick={(e) => { e.stopPropagation(); setPreview(entry); }} title="Preview"><Eye className="w-3.5 h-3.5" /></button>
                              {isPending && (<>
                                {isDuplicate && groupEntries.length > 1 && (
                                  <button className="h-7 px-2 text-[9px] font-mono uppercase tracking-widest border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1"
                                    onClick={(e) => { e.stopPropagation(); handleAction({ primaryEntry: entry, action: "delete-dupes", groupEntries: groupEntries.filter((ge) => ge.customer) }); }}>
                                    <Trash2 className="w-3 h-3" /> Dupes
                                  </button>
                                )}
                                <button className="h-7 w-7 flex items-center justify-center border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Resolve"
                                  onClick={(e) => { e.stopPropagation(); handleAction({ primaryEntry: entry, action: "resolve" }); }}><CheckCircle2 className="w-3 h-3" /></button>
                                <button className="h-7 w-7 flex items-center justify-center border border-slate-700 text-slate-500 hover:bg-slate-800 transition-colors" title="Dismiss"
                                  onClick={(e) => { e.stopPropagation(); handleAction({ primaryEntry: entry, action: "dismiss" }); }}><XCircle className="w-3 h-3" /></button>
                              </>)}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-orange-500/10 pt-2">
                  <p className="text-[10px] font-mono text-orange-500/40 uppercase tracking-widest">Page {page + 1} of {totalPages} · {filtered.length} total</p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                      className="h-8 w-8 flex items-center justify-center border border-orange-500/20 text-orange-500/50 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-1 px-3 h-8 border border-orange-500/20 bg-orange-500/5">
                      <span className="text-[11px] font-mono text-orange-400">{page + 1}</span>
                      <span className="text-[11px] font-mono text-orange-500/30">/</span>
                      <span className="text-[11px] font-mono text-orange-500/40">{totalPages}</span>
                    </div>
                    <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="h-8 w-8 flex items-center justify-center border border-orange-500/20 text-orange-500/50 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <AuditPreviewModal entry={preview} open={!!preview} onOpenChange={(v) => !v && setPreview(null)}
        groupEntries={preview?.duplicateGroupId ? (groupMap.get(preview.duplicateGroupId) ?? [preview]) : preview ? [preview] : []}
        tsaMap={tsaMap} onAction={handleAction} />

      <AuditRemarksDialog target={actionTarget} open={actionOpen} onOpenChange={(v) => { if (!v) setActionOpen(false); }} onConfirm={handleConfirmAction} tsaMap={tsaMap} />
    </ProtectedPageWrapper>
  );
}
