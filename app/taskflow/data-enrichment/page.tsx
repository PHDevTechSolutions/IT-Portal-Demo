"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Pagination } from "@/components/app-pagination";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { toast } from "sonner";
import {
  Search, Loader2, ChevronRight, Sparkles,
  Building2, User, Phone, Mail, MapPin,
  X, CheckCircle2, AlertCircle, Clock, Globe,
  Send, ArrowRight,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────── */

interface Customer {
  id:             number;
  company_name:   string;
  contact_person: string;
  contact_number: string;
  email_address:  string;
  address:        string;
  [key: string]:  unknown;
}

type EnrichStatus = "idle" | "scraping" | "done" | "empty" | "error";

interface EnrichResult {
  contact_person: string;
  contact_number: string;
  email_address:  string;
  address:        string;
  website:        string;
  source_url:     string;
}

interface CustomerEnrichState {
  status:   EnrichStatus;
  enriched: EnrichResult | null;
  logs:     string[];
  error?:   string;
}

interface LogLine {
  id:   number;
  text: string;
  type: "info" | "success" | "error" | "dim" | "header";
}

interface ApprovalField {
  field_name:      string;
  current_value:   string;
  suggested_value: string;
  selected:        boolean;
}

interface ApprovalItem {
  account_id:   number;
  company_name: string;
  source_url:   string;
  fields:       ApprovalField[];
}

const ROWS_PER_PAGE = 20;

const FIELD_LABELS: Record<string, string> = {
  contact_person: "Contact Person",
  contact_number: "Contact No.",
  email_address:  "Email Address",
  address:        "Address",
};

const LINE_COLOR: Record<LogLine["type"], string> = {
  header:  "#e8630a",
  info:    "#c8d8e8",
  success: "#34d399",
  error:   "#f87171",
  dim:     "#4a6070",
};

/* ─── StatusIcon ─────────────────────────────────────────────────── */
function StatusIcon({ status }: { status: EnrichStatus | undefined }) {
  if (!status || status === "idle") return null;
  if (status === "scraping") return <Loader2 className="size-3 animate-spin text-orange-400" />;
  if (status === "done")     return <CheckCircle2 className="size-3 text-emerald-400" />;
  if (status === "empty")    return <Clock className="size-3 text-slate-500" />;
  if (status === "error")    return <AlertCircle className="size-3 text-red-400" />;
  return null;
}

/* ─── ApprovalDialog ─────────────────────────────────────────────── */
function ApprovalDialog({
  open, onClose, items, onSubmit, isSubmitting,
}: {
  open:        boolean;
  onClose:     () => void;
  items:       ApprovalItem[];
  onSubmit:    (items: ApprovalItem[]) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [localItems, setLocalItems] = useState<ApprovalItem[]>([]);

  useEffect(() => { if (open) setLocalItems(items); }, [open, items]);

  const toggleField = (ai: number, fi: number) => {
    setLocalItems(prev => prev.map((item, i) =>
      i !== ai ? item : {
        ...item,
        fields: item.fields.map((f, j) =>
          j !== fi ? f : { ...f, selected: !f.selected }
        ),
      }
    ));
  };

  const selectedCount = localItems.reduce(
    (acc, item) => acc + item.fields.filter(f => f.selected).length, 0
  );

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !isSubmitting) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] flex flex-col rounded-none p-0 gap-0"
        style={{ backgroundColor: "#0d1117", border: "1px solid #1a2535" }}
      >
        <DialogHeader className="px-5 py-4 border-b shrink-0" style={{ borderColor: "#1a2535", backgroundColor: "#080d12" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: "#1a2535" }}>
              <Send className="size-4" style={{ color: "#e8630a" }} />
            </div>
            <div>
              <DialogTitle className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#e8630a", fontFamily: "monospace" }}>
                Submit for Editing Approval
              </DialogTitle>
              <p className="text-[9px] mt-0.5" style={{ color: "#4a6070", fontFamily: "monospace" }}>
                Select which suggested fields to submit · {selectedCount} field{selectedCount !== 1 ? "s" : ""} selected
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {localItems.map((item, ai) => (
            <div key={item.account_id} className="border" style={{ borderColor: "#1a2535" }}>
              {/* Company header */}
              <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: "#1a2535", backgroundColor: "#080d12" }}>
                <Building2 className="size-3 shrink-0" style={{ color: "#e8630a" }} />
                <span className="text-[11px] font-bold uppercase font-mono" style={{ color: "#c8d8e8" }}>
                  {item.company_name}
                </span>
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-[9px] font-mono truncate max-w-[180px]"
                    style={{ color: "#4a6070" }}>
                    {item.source_url.replace(/^https?:\/\//, "").slice(0, 40)}
                  </a>
                )}
              </div>
              {/* Fields */}
              <div className="divide-y" style={{ borderColor: "#1a2535" }}>
                {item.fields.map((field, fi) => (
                  <div
                    key={field.field_name}
                    className="flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors"
                    style={{ backgroundColor: field.selected ? "rgba(232,99,10,0.05)" : "transparent" }}
                    onClick={() => toggleField(ai, fi)}
                  >
                    <Checkbox
                      checked={field.selected}
                      onCheckedChange={() => toggleField(ai, fi)}
                      className="mt-0.5 rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 pointer-events-none"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest font-mono" style={{ color: "#e8630a" }}>
                        {FIELD_LABELS[field.field_name] ?? field.field_name}
                      </p>
                      <div className="flex items-start gap-2 flex-wrap">
                        {/* Current */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] uppercase tracking-wider mb-0.5 font-mono" style={{ color: "#4a6070" }}>Current</p>
                          <p className="text-[10px] font-mono break-all" style={{ color: field.current_value ? "#c8d8e8" : "#253040" }}>
                            {field.current_value || "— empty —"}
                          </p>
                        </div>
                        <ArrowRight className="size-3 shrink-0 mt-4" style={{ color: "#253040" }} />
                        {/* Suggested */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] uppercase tracking-wider mb-0.5 font-mono" style={{ color: "#34d399" }}>Suggested</p>
                          <p className="text-[10px] font-mono break-all" style={{ color: "#34d399" }}>
                            {field.suggested_value}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: "#1a2535", backgroundColor: "#080d12" }}>
          <button onClick={onClose} disabled={isSubmitting}
            className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors font-mono"
            style={{ borderColor: "#1a2535", color: "#4a6070", backgroundColor: "transparent" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#e8630a"; e.currentTarget.style.color = "#e8630a"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a2535"; e.currentTarget.style.color = "#4a6070"; }}>
            Cancel
          </button>
          <button
            onClick={() => onSubmit(localItems)}
            disabled={isSubmitting || selectedCount === 0}
            className="flex items-center gap-1.5 h-8 px-5 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40 font-mono"
            style={{ borderColor: "#e8630a", color: "#fff", backgroundColor: "#e8630a" }}>
            {isSubmitting
              ? <><Loader2 className="size-3 animate-spin" /> Submitting…</>
              : <><Send className="size-3" /> Submit ({selectedCount})</>
            }
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */

export default function DataEnrichmentPage() {
  const router  = useRouter();
  const seqRef  = useRef(0);

  const [customers,    setCustomers]    = useState<Customer[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(1);
  const [selected,     setSelected]     = useState<Set<number>>(new Set());
  const [selectAll,    setSelectAll]    = useState(false);
  const [enrichMap,    setEnrichMap]    = useState<Record<number, CustomerEnrichState>>({});
  const [isEnriching,  setIsEnriching]  = useState(false);
  const [termLines,    setTermLines]    = useState<LogLine[]>([]);
  const [termOpen,     setTermOpen]     = useState(false);
  const termBottomRef = useRef<HTMLDivElement>(null);

  // Approval dialog state
  const [approvalOpen,     setApprovalOpen]     = useState(false);
  const [approvalItems,    setApprovalItems]     = useState<ApprovalItem[]>([]);
  const [isSubmitting,     setIsSubmitting]      = useState(false);

  // Snapshot of original values BEFORE enrichment overwrites them
  const originalValuesRef = useRef<Record<number, Partial<Customer>>>({});

  const mkLine = (text: string, type: LogLine["type"] = "info"): LogLine => ({
    id: ++seqRef.current, text, type,
  });

  /* ── Fetch ── */
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res  = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Fetch", { cache: "no-store" });
        const json = await res.json();
        setCustomers(Array.isArray(json) ? json : (json?.data ?? []));
      } catch { setCustomers([]); }
      finally  { setIsLoading(false); }
    };
    load();
  }, []);

  useEffect(() => { termBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [termLines]);

  /* ── Filter + Pagination ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      [c.company_name, c.contact_person, c.contact_number, c.email_address, c.address]
        .some(f => (f ?? "").toString().toLowerCase().includes(q)),
    );
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const current    = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  useEffect(() => setPage(1), [search]);

  /* ── Selection ── */
  const toggleOne = (id: number) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () => {
    if (selectAll) { setSelected(new Set()); setSelectAll(false); }
    else           { setSelected(new Set(current.map(c => c.id))); setSelectAll(true); }
  };

  useEffect(() => {
    setSelectAll(current.length > 0 && current.every(c => selected.has(c.id)));
  }, [selected, current]);

  /* ── Enrich ── */
  const addLine = (text: string, type: LogLine["type"] = "info") =>
    setTermLines(prev => [...prev, mkLine(text, type)]);

  const handleEnrich = async () => {
    if (selected.size === 0) { toast.error("Select at least one customer."); return; }
    const targets = customers.filter(c => selected.has(c.id))
      .map(c => ({ id: c.id, company_name: c.company_name, address: c.address }));

    setIsEnriching(true); setTermOpen(true); setTermLines([]);

    // Snapshot original values BEFORE enrichment overwrites them
    for (const t of targets) {
      const c = customers.find(x => x.id === t.id);
      if (c) {
        originalValuesRef.current[t.id] = {
          contact_person: c.contact_person,
          contact_number: c.contact_number,
          email_address:  c.email_address,
          address:        c.address,
        };
      }
    }

    setEnrichMap(prev => {
      const next = { ...prev };
      for (const t of targets) next[t.id] = { status: "scraping", enriched: null, logs: [] };
      return next;
    });

    addLine(`══ Data Enrichment — ${targets.length} company(s) ══`, "header");
    addLine("Sources: BusinessList.ph · Yellow Pages PH · Serper", "dim");
    addLine("─".repeat(52), "dim");

    try {
      const res = await fetch("/api/taskflow/data-enrichment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers: targets }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.status === "complete") { addLine("─".repeat(52), "dim"); addLine("✔ Enrichment complete.", "success"); break; }
            if (msg.status === "scraping") { addLine(`▶ ${msg.log}`, "header"); }
            if (["done", "empty", "error"].includes(msg.status)) {
              const company = targets.find(t => t.id === msg.id)?.company_name ?? `ID ${msg.id}`;
              if (Array.isArray(msg.log)) {
                for (const l of msg.log as string[]) {
                  const t: LogLine["type"] = l.startsWith("  ✓") ? "success" : l.startsWith("  ✗") ? "error" : l.startsWith("Trying") || l.startsWith("Visiting") ? "info" : "dim";
                  addLine(`  ${l}`, t);
                }
              }
              if (msg.status === "done") {
                const e = msg.enriched as EnrichResult;
                const saved = [e.email_address && "email", e.contact_number && "phone", e.contact_person && "contact"].filter(Boolean).join(", ");
                addLine(`  ✓ ${company} — saved: ${saved || "no new fields"}`, "success");
                setCustomers(prev => prev.map(c => c.id !== msg.id ? c : {
                  ...c,
                  contact_person: e.contact_person || c.contact_person,
                  contact_number: e.contact_number || c.contact_number,
                  email_address:  e.email_address  || c.email_address,
                  address:        e.address        || c.address,
                }));
              } else if (msg.status === "empty") {
                addLine(`  — ${company}: no data found`, "dim");
              } else {
                addLine(`  ✗ ${company}: ${msg.error}`, "error");
              }
              setEnrichMap(prev => ({
                ...prev,
                [msg.id]: { status: msg.status, enriched: msg.enriched ?? null, logs: Array.isArray(msg.log) ? msg.log : [], error: msg.error },
              }));
              addLine("─".repeat(52), "dim");
            }
          } catch { /* malformed */ }
        }
      }
    } catch (err: any) {
      addLine(`✗ Fatal: ${err.message}`, "error");
      toast.error(err.message ?? "Enrichment failed");
    } finally { setIsEnriching(false); }
  };

  /* ── Open Approval Dialog ── */
  const handleOpenApproval = () => {
    const items: ApprovalItem[] = [];

    for (const id of selected) {
      const eState = enrichMap[id];
      if (!eState || eState.status !== "done" || !eState.enriched) continue;

      const customer = customers.find(c => c.id === id);
      if (!customer) continue;

      // Use the ORIGINAL values (before enrichment overwrote them) for the diff
      const original = originalValuesRef.current[id] ?? {};
      const e = eState.enriched;
      const fields: ApprovalField[] = [];

      const FIELDS: (keyof EnrichResult)[] = ["contact_person", "contact_number", "email_address", "address"];
      for (const f of FIELDS) {
        const suggested = e[f];
        if (!suggested?.trim()) continue;
        // current_value = what was in DB before enrichment ran
        const current = ((original[f as keyof typeof original] ?? customer[f] ?? "") as string);
        fields.push({
          field_name:      f,
          current_value:   current,
          suggested_value: suggested,
          selected:        true,
        });
      }

      if (fields.length > 0) {
        items.push({
          account_id:   id,
          company_name: customer.company_name,
          source_url:   e.source_url ?? "",
          fields,
        });
      }
    }

    if (items.length === 0) {
      toast.error("No enriched suggestions to submit. Run enrichment first.");
      return;
    }

    setApprovalItems(items);
    setApprovalOpen(true);
  };

  /* ── Submit Approvals ── */
  const handleSubmitApprovals = async (items: ApprovalItem[]) => {
    const submissions = items.flatMap(item =>
      item.fields
        .filter(f => f.selected && f.suggested_value.trim())
        .map(f => ({
          account_id:      item.account_id,
          company_name:    item.company_name,
          field_name:      f.field_name,
          current_value:   f.current_value,
          suggested_value: f.suggested_value,
          source_url:      item.source_url,
        }))
    );

    if (submissions.length === 0) {
      toast.error("Select at least one field to submit.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res  = await fetch("/api/taskflow/data-enrichment/approvals", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ submissions }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`${json.inserted} suggestion${json.inserted !== 1 ? "s" : ""} submitted for approval.`);
      setApprovalOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to submit approvals.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── How many selected have enriched data ── */
  const enrichedSelectedCount = Array.from(selected)
    .filter(id => enrichMap[id]?.status === "done").length;

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-[#0a0d14] text-slate-100 flex flex-col h-svh overflow-hidden" suppressHydrationWarning>

          {/* Header */}
          <header className="relative flex h-12 shrink-0 items-center border-b border-orange-500/15 bg-[#0d1117]/90 backdrop-blur-sm overflow-hidden">
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/40" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/40" />
            <div className="flex items-center gap-2 px-4 relative z-10">
              <SidebarTrigger className="-ml-1 text-orange-400/70 hover:text-orange-300 hover:bg-orange-500/10" />
              <button onClick={() => router.push("/dashboard")}
                className="text-slate-500 hover:text-orange-400 text-xs hidden sm:flex font-mono px-2 py-1 hover:bg-orange-500/10 transition-colors">
                Home
              </button>
              <Separator orientation="vertical" className="h-4 bg-orange-500/15 hidden sm:block" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#" className="text-slate-500 hover:text-orange-400 text-xs hidden sm:block font-mono uppercase tracking-wider">
                      Taskflow
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator><ChevronRight size={10} className="text-slate-700" /></BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-orange-400 text-xs font-mono tracking-widest uppercase">
                      Data Enrichment
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          {/* Toolbar */}
          <div className="shrink-0 px-3 sm:px-4 pt-3 pb-2 border-b border-slate-800/60 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-orange-400/60" />
                  <h1 className="text-sm font-bold tracking-widest uppercase text-orange-400 font-mono">Data Enrichment</h1>
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {isLoading ? "Loading…" : <><span className="font-semibold text-slate-300">{filtered.length}</span> record{filtered.length !== 1 ? "s" : ""}</>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Enrich button */}
                {selected.size > 0 && (
                  <button onClick={handleEnrich} disabled={isEnriching}
                    className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40 font-mono"
                    style={{ backgroundColor: "rgba(232,99,10,0.15)", borderColor: "#e8630a", color: "#e8630a" }}>
                    {isEnriching
                      ? <><Loader2 className="size-3 animate-spin" /> Enriching…</>
                      : <><Sparkles className="size-3" /> Enrich ({selected.size})</>}
                  </button>
                )}
                {/* Submit for Approval button — only when enriched data exists */}
                {enrichedSelectedCount > 0 && (
                  <button onClick={handleOpenApproval} disabled={isEnriching}
                    className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40 font-mono"
                    style={{ backgroundColor: "rgba(52,211,153,0.1)", borderColor: "#34d399", color: "#34d399" }}>
                    <Send className="size-3" /> For Approval ({enrichedSelectedCount})
                  </button>
                )}
                {/* Show/Hide log */}
                {termLines.length > 0 && (
                  <button onClick={() => setTermOpen(v => !v)}
                    className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors font-mono"
                    style={{ borderColor: termOpen ? "#e8630a" : "#1a2535", color: termOpen ? "#e8630a" : "#4a6070", backgroundColor: "transparent" }}>
                    <Globe className="size-3" />{termOpen ? "Hide Log" : "Show Log"}
                  </button>
                )}
                <Badge variant="outline" className="border-orange-500/30 text-orange-400/70 text-[10px] font-mono">
                  Total: {customers.length}
                </Badge>
              </div>
            </div>
            {/* Search + Pagination */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-600" />
                <Input placeholder="Search company, contact, email, address…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9 text-xs bg-[#0d1117] border-slate-800 text-slate-300 placeholder:text-slate-700 focus:border-orange-500/40 rounded-none font-mono" />
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden min-h-0 px-3 sm:px-4 pb-3 pt-2 gap-2">

            {/* Table */}
            <div className="flex-1 border border-orange-500/10 bg-[#0a0d14] overflow-auto min-h-0">
              {isLoading ? (
                <div className="py-20 flex flex-col items-center gap-3">
                  <Loader2 className="size-5 animate-spin text-orange-500/60" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-orange-500/40">Loading records…</span>
                </div>
              ) : current.length > 0 ? (
                <Table className="whitespace-nowrap text-[11px] min-w-full">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="border-b border-orange-500/20 bg-[#0d1117] hover:bg-[#0d1117]">
                      <TableHead className="w-8 px-2 py-2 text-center">
                        <Checkbox checked={selectAll} onCheckedChange={toggleAll}
                          className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500" />
                      </TableHead>
                      <TableHead className="w-6 px-1 py-2" />
                      {([
                        { label: "Company Name",   Icon: Building2, w: "min-w-[200px]" },
                        { label: "Contact Person", Icon: User,      w: "min-w-[150px]" },
                        { label: "Contact No.",    Icon: Phone,     w: "min-w-[130px]" },
                        { label: "Email Address",  Icon: Mail,      w: "min-w-[200px]" },
                        { label: "Address",        Icon: MapPin,    w: "min-w-[260px]" },
                      ] as const).map(({ label, Icon, w }) => (
                        <TableHead key={label} className={`${w} py-2 px-3 text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/60 border-r border-orange-500/5 last:border-r-0`}>
                          <span className="flex items-center gap-1.5"><Icon className="size-3 shrink-0" />{label}</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {current.map(c => {
                      const isSelected = selected.has(c.id);
                      const eState     = enrichMap[c.id];
                      const isNew      = eState?.status === "done";
                      return (
                        <TableRow key={c.id}
                          className="border-b border-orange-500/5 transition-colors hover:bg-orange-500/[0.04]"
                          style={{ borderLeft: isSelected ? "2px solid rgba(232,99,10,0.5)" : "2px solid transparent", backgroundColor: isSelected ? "rgba(232,99,10,0.04)" : undefined }}>
                          <TableCell className="w-8 px-2 text-center">
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(c.id)}
                              className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500" />
                          </TableCell>
                          <TableCell className="w-6 px-1"><StatusIcon status={eState?.status} /></TableCell>
                          <TableCell className="py-2 px-3 border-r border-orange-500/5 min-w-[200px]">
                            <span className="font-mono text-[11px] uppercase text-slate-200">{c.company_name || "—"}</span>
                          </TableCell>
                          <TableCell className="py-2 px-3 border-r border-orange-500/5 min-w-[150px]">
                            <span className={`capitalize ${isNew && eState?.enriched?.contact_person ? "text-emerald-400" : "text-slate-300"}`}>{c.contact_person || "—"}</span>
                          </TableCell>
                          <TableCell className="py-2 px-3 border-r border-orange-500/5 min-w-[130px]">
                            <span className={`font-mono ${isNew && eState?.enriched?.contact_number ? "text-emerald-400" : "text-slate-400"}`}>{c.contact_number || "—"}</span>
                          </TableCell>
                          <TableCell className="py-2 px-3 border-r border-orange-500/5 min-w-[200px]">
                            <span className={isNew && eState?.enriched?.email_address ? "text-emerald-400" : "text-slate-500"}>{c.email_address || "—"}</span>
                          </TableCell>
                          <TableCell className="py-2 px-3 min-w-[260px] max-w-[320px] whitespace-normal break-words">
                            <span className={isNew && eState?.enriched?.address ? "text-emerald-400" : "text-slate-500"}>{c.address || "—"}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-20 flex flex-col items-center gap-3">
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
            </div>

            {/* Terminal Panel */}
            {termOpen && (
              <div className="w-80 shrink-0 flex flex-col border overflow-hidden" style={{ borderColor: "#1a2535", backgroundColor: "#080d12" }}>
                <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#1a2535", backgroundColor: "#0d1117" }}>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                    </div>
                    <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#4a6070" }}>enrichment — log</span>
                  </div>
                  <button onClick={() => setTermOpen(false)}
                    className="flex items-center justify-center h-5 w-5 transition-colors" style={{ color: "#4a6070" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#4a6070")}>
                    <X className="size-3" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-0.5" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
                  {termLines.length === 0
                    ? <span className="text-[10px]" style={{ color: "#253040" }}>Waiting…</span>
                    : termLines.map(line => (
                        <div key={line.id} className="text-[10px] leading-5" style={{ color: LINE_COLOR[line.type] }}>{line.text}</div>
                      ))}
                  {isEnriching && (
                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "#e8630a" }}>
                      <Loader2 className="size-3 animate-spin" /><span>Running…</span>
                    </div>
                  )}
                  <div ref={termBottomRef} />
                </div>
              </div>
            )}
          </div>

        </SidebarInset>
      </SidebarProvider>

      {/* Approval Dialog */}
      <ApprovalDialog
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        items={approvalItems}
        onSubmit={handleSubmitApprovals}
        isSubmitting={isSubmitting}
      />

    </ProtectedPageWrapper>
  );
}
