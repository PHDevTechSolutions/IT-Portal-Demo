"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  AlertTriangle,
  GitMerge,
  Users,
  ArrowRight,
  Terminal,
  ChevronRight,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logCustomerAudit } from "@/lib/audit/customer-audit";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  industry: string;
  date_updated: string;
  next_available_date?: string;
}

export interface DuplicateGroup {
  id: string;
  type: "same-tsa" | "cross-tsa";
  matchReason: string;
  customers: Customer[];
}

export interface AuditResult {
  duplicateGroups: DuplicateGroup[];
  missingType: Customer[];
  missingStatus: Customer[];
  allAffectedCustomers: Customer[];
  duplicateIds: Set<number>;
}

/** Shape written to / read from localStorage — Set<number> becomes number[] */
export interface PersistedAuditResult {
  auditedAt: string;
  duplicateGroups: DuplicateGroup[];
  missingType: Customer[];
  missingStatus: Customer[];
  allAffectedCustomers: Customer[];
  duplicateIds: number[];
}

export const AUDIT_STORAGE_KEY = "customer-audit-result";

export function persistAuditResult(result: AuditResult): void {
  const payload: PersistedAuditResult = {
    auditedAt: new Date().toISOString(),
    duplicateGroups: result.duplicateGroups,
    missingType: result.missingType,
    missingStatus: result.missingStatus,
    allAffectedCustomers: result.allAffectedCustomers,
    duplicateIds: Array.from(result.duplicateIds),
  };
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    console.error("[persistAuditResult] Failed to write to localStorage.");
  }
}

export function loadAuditResult(): PersistedAuditResult | null {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedAuditResult;
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

function ts() {
  return new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function buildGroups(pairs: [number, number][], allIds: number[]): number[][] {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  };
  const union = (a: number, b: number) => parent.set(find(a), find(b));
  pairs.forEach(([a, b]) => union(a, b));
  const groupMap = new Map<number, number[]>();
  for (const id of allIds) {
    const root = find(id);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)!.push(id);
  }
  return Array.from(groupMap.values()).filter((g) => g.length > 1);
}

// ─── Core audit logic ─────────────────────────────────────────────────────────

function runAuditLogic(customers: Customer[]): AuditResult {
  const n = customers.length;
  const sameTsaPairs: [number, number][] = [];
  const sameTsaInvolvedIds = new Set<number>();
  const byTSA = new Map<string, Customer[]>();

  for (const c of customers) {
    const key = norm(c.referenceid);
    if (!byTSA.has(key)) byTSA.set(key, []);
    byTSA.get(key)!.push(c);
  }

  for (const [, group] of byTSA) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i],
          b = group[j];
        if (
          norm(a.company_name) === norm(b.company_name) &&
          (norm(a.contact_person) === norm(b.contact_person) ||
            norm(a.email_address) === norm(b.email_address))
        ) {
          sameTsaPairs.push([a.id, b.id]);
          sameTsaInvolvedIds.add(a.id);
          sameTsaInvolvedIds.add(b.id);
        }
      }
    }
  }

  const crossTsaPairs: [number, number][] = [];
  const crossTsaInvolvedIds = new Set<number>();

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = customers[i],
        b = customers[j];
      if (
        norm(a.company_name) === norm(b.company_name) &&
        norm(a.contact_person) === norm(b.contact_person) &&
        norm(a.email_address) === norm(b.email_address) &&
        norm(a.referenceid) !== norm(b.referenceid)
      ) {
        crossTsaPairs.push([a.id, b.id]);
        crossTsaInvolvedIds.add(a.id);
        crossTsaInvolvedIds.add(b.id);
      }
    }
  }

  const byId = new Map(customers.map((c) => [c.id, c]));
  const sameTsaGroupIds = buildGroups(
    sameTsaPairs,
    Array.from(sameTsaInvolvedIds),
  );
  const crossTsaGroupIds = buildGroups(
    crossTsaPairs,
    Array.from(crossTsaInvolvedIds),
  );

  const duplicateGroups: DuplicateGroup[] = [
    ...sameTsaGroupIds.map((ids, i) => {
      const members = ids.map((id) => byId.get(id)!).filter(Boolean);
      const reasons: string[] = [];
      if (
        members.length >= 2 &&
        norm(members[0].contact_person) === norm(members[1].contact_person)
      )
        reasons.push("contact");
      if (
        members.length >= 2 &&
        norm(members[0].email_address) === norm(members[1].email_address)
      )
        reasons.push("email");
      return {
        id: `same-tsa-${i}`,
        type: "same-tsa" as const,
        matchReason: `Same TSA — matched on: company + ${reasons.join(" & ") || "contact/email"}`,
        customers: members,
      };
    }),
    ...crossTsaGroupIds.map((ids, i) => ({
      id: `cross-tsa-${i}`,
      type: "cross-tsa" as const,
      matchReason:
        "Cross-TSA — company + contact + email match across different TSAs",
      customers: ids.map((id) => byId.get(id)!).filter(Boolean),
    })),
  ];

  const duplicateIds = new Set<number>([
    ...sameTsaInvolvedIds,
    ...crossTsaInvolvedIds,
  ]);
  const missingType = customers.filter(
    (c) => !norm(c.type_client) && norm(c.status),
  );
  const missingStatus = customers.filter(
    (c) => !norm(c.status) && norm(c.type_client),
  );
  const affectedSet = new Set<number>([
    ...duplicateIds,
    ...missingType.map((c) => c.id),
    ...missingStatus.map((c) => c.id),
  ]);

  return {
    duplicateGroups,
    missingType,
    missingStatus,
    allAffectedCustomers: customers.filter((c) => affectedSet.has(c.id)),
    duplicateIds,
  };
}

// ─── Terminal ─────────────────────────────────────────────────────────────────

type Phase = "terminal" | "results" | "confirm";

interface LogLine {
  id: number;
  text: string;
  type: "info" | "success" | "warn" | "error" | "cmd";
}

function TerminalLine({ line }: { line: LogLine }) {
  const color =
    line.type === "success"
      ? "text-emerald-400"
      : line.type === "warn"
        ? "text-amber-400"
        : line.type === "error"
          ? "text-red-400"
          : line.type === "cmd"
            ? "text-cyan-300 font-semibold"
            : "text-zinc-300";
  const prefix =
    line.type === "cmd"
      ? "$ "
      : line.type === "success"
        ? "✓ "
        : line.type === "warn"
          ? "⚠ "
          : line.type === "error"
            ? "✗ "
            : "  ";
  return (
    <div className={cn("font-mono text-[12px] leading-relaxed", color)}>
      <span className="text-zinc-600 mr-2 select-none">{ts()}</span>
      <span className="text-zinc-500 select-none">{prefix}</span>
      {line.text}
    </div>
  );
}

// ─── Exported sub-components ──────────────────────────────────────────────────

export function DuplicateGroupCard({ group }: { group: DuplicateGroup }) {
  const isCross = group.type === "cross-tsa";
  return (
    <div
      className={cn(
        "rounded-lg border p-4 text-sm space-y-3",
        isCross
          ? "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40"
          : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isCross ? (
            <GitMerge className="size-4 text-orange-500 shrink-0 mt-0.5" />
          ) : (
            <Users className="size-4 text-red-500 shrink-0 mt-0.5" />
          )}
          <Badge
            variant="secondary"
            className={cn(
              "text-[11px] font-semibold",
              isCross
                ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
            )}
          >
            {isCross ? "Cross-TSA" : "Same-TSA"} Duplicate
          </Badge>
        </div>
        <Badge variant="outline" className="text-[11px] shrink-0">
          {group.customers.length} records
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        {group.matchReason}
      </p>
      <div className="space-y-2">
        {group.customers.map((c, i) => (
          <div
            key={c.id}
            className="rounded-md border px-3 py-2 text-[12px] space-y-0.5 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
          >
            <div className="flex items-center gap-2 flex-wrap">
              {i > 0 && (
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  ↳ duplicate
                </span>
              )}
              <span className="font-semibold uppercase text-foreground">
                {c.company_name}
              </span>
              {c.account_reference_number && (
                <span className="text-muted-foreground font-mono text-[11px]">
                  {c.account_reference_number}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
              <span>{c.contact_person || "—"}</span>
              <span>{c.email_address || "—"}</span>
              <span className="text-[11px] font-mono">
                {c.referenceid || "—"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IssueBadgeCard({
  label,
  count,
  icon,
  colorClass,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  colorClass: string;
}) {
  if (count === 0) return null;
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 flex items-center gap-3",
        colorClass,
      )}
    >
      {icon}
      <div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
          {label}
        </div>
        <div className="text-2xl font-bold tabular-nums">{count}</div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  /** Legacy props — kept for compatibility, session is preferred */
  userId?: string | null;
  referenceId?: string | null;
  performedByRole?: string | null;
  onConfirmAudit?: (result: AuditResult) => void;
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export function AuditDialog({
  open,
  onOpenChange,
  customers,
  userId: propUserId,
  referenceId: propReferenceId,
  performedByRole: propRole,
  onConfirmAudit,
}: AuditDialogProps) {
  const router = useRouter();

  // ── Session-based identity (preferred over props) ─────────────────────────
  const sessionUser = useCurrentUser();
  const userId = sessionUser.uid ?? propUserId ?? null;
  const referenceId = sessionUser.referenceId ?? propReferenceId ?? null;
  const performedByRole = sessionUser.role ?? propRole ?? null;

  const [phase, setPhase] = useState<Phase>("terminal");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isCursorOn, setIsCursorOn] = useState(true);
  const [isDone, setIsDone] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const lineCounter = useRef(0);

  useEffect(() => {
    if (phase !== "terminal") return;
    const id = setInterval(() => setIsCursorOn((v) => !v), 530);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (!open) return;
    setPhase("terminal");
    setLogs([]);
    setAuditResult(null);
    setIsDone(false);
    lineCounter.current = 0;
  }, [open]);

  const addLog = useCallback(
    (text: string, type: LogLine["type"] = "info", delay = 0) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          lineCounter.current += 1;
          setLogs((prev) => [...prev, { id: lineCounter.current, text, type }]);
          resolve();
        }, delay);
      }),
    [],
  );

  useEffect(() => {
    if (!open || phase !== "terminal") return;
    let cancelled = false;

    const run = async () => {
      await addLog("Initializing audit engine...", "cmd", 120);
      await addLog(
        `Loaded ${customers.length.toLocaleString()} customer records.`,
        "info",
        420,
      );
      await addLog(
        "─────────────────────────────────────────────",
        "info",
        600,
      );
      await addLog(
        "Checking same-TSA duplicates (company + contact/email)...",
        "cmd",
        850,
      );

      const result = await new Promise<AuditResult>((res) => {
        setTimeout(() => res(runAuditLogic(customers)), 200);
      });
      if (cancelled) return;

      const sameTsaGroups = result.duplicateGroups.filter(
        (g) => g.type === "same-tsa",
      );
      const crossTsaGroups = result.duplicateGroups.filter(
        (g) => g.type === "cross-tsa",
      );

      if (sameTsaGroups.length > 0) {
        await addLog(
          `Found ${sameTsaGroups.length} same-TSA group(s) — ${sameTsaGroups.reduce((s, g) => s + g.customers.length, 0)} records.`,
          "warn",
          400,
        );
      } else {
        await addLog("No same-TSA duplicates found.", "success", 400);
      }

      await addLog(
        "Checking cross-TSA duplicates (company + contact + email)...",
        "cmd",
        700,
      );

      if (crossTsaGroups.length > 0) {
        await addLog(
          `Found ${crossTsaGroups.length} cross-TSA group(s) — ${crossTsaGroups.reduce((s, g) => s + g.customers.length, 0)} records.`,
          "warn",
          400,
        );
      } else {
        await addLog("No cross-TSA duplicates found.", "success", 400);
      }

      await addLog("Scanning for missing type_client...", "cmd", 700);
      if (result.missingType.length > 0) {
        await addLog(
          `${result.missingType.length} record(s) missing type_client.`,
          "warn",
          400,
        );
      } else {
        await addLog("All records have type_client set.", "success", 400);
      }

      await addLog("Scanning for missing status...", "cmd", 600);
      if (result.missingStatus.length > 0) {
        await addLog(
          `${result.missingStatus.length} record(s) missing status.`,
          "warn",
          400,
        );
      } else {
        await addLog("All records have status set.", "success", 400);
      }

      await addLog(
        "─────────────────────────────────────────────",
        "info",
        600,
      );
      const totalIssues =
        result.duplicateIds.size +
        result.missingType.length +
        result.missingStatus.length;
      await addLog(
        totalIssues === 0
          ? "Audit complete. No issues detected."
          : `Audit complete. ${result.duplicateGroups.length} group(s), ${totalIssues} records flagged.`,
        totalIssues === 0 ? "success" : "warn",
        300,
      );

      if (cancelled) return;
      setAuditResult(result);
      setIsDone(true);
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ─── Phase renderers ──────────────────────────────────────────────────────

  const renderTerminal = () => (
    <div className="flex flex-col h-full gap-4">
      <div className="rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-red-500" />
            <span className="size-3 rounded-full bg-yellow-500" />
            <span className="size-3 rounded-full bg-green-500" />
          </div>
          <div className="flex-1 text-center">
            <span className="font-mono text-[11px] text-zinc-400 tracking-wide">
              customer-audit — bash
            </span>
          </div>
          <Terminal className="size-3.5 text-zinc-500" />
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-0.5">
            {logs.map((line) => (
              <TerminalLine key={line.id} line={line} />
            ))}
            {!isDone && (
              <div className="font-mono text-[12px] text-zinc-300 mt-1">
                <span className="text-zinc-600 mr-2 select-none">{ts()}</span>
                <span
                  className={cn(
                    "inline-block w-2 h-3.5 bg-emerald-400 align-middle",
                    isCursorOn ? "opacity-100" : "opacity-0",
                  )}
                />
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </ScrollArea>
      </div>
      <div className="flex justify-end gap-2 shrink-0">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          disabled={!isDone}
          onClick={() => setPhase("results")}
          className="gap-1.5"
        >
          View Results <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );

  const renderResults = () => {
    if (!auditResult) return null;
    const { duplicateGroups, missingType, missingStatus, duplicateIds } =
      auditResult;
    const hasAnyIssue =
      duplicateGroups.length > 0 ||
      missingType.length > 0 ||
      missingStatus.length > 0;

    return (
      <div className="flex flex-col h-full gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <IssueBadgeCard
            label="Dup Groups"
            count={duplicateGroups.length}
            icon={<Users className="size-5 text-red-500" />}
            colorClass="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
          />
          <IssueBadgeCard
            label="Dup Records"
            count={duplicateIds.size}
            icon={<XCircle className="size-5 text-red-400" />}
            colorClass="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
          />
          <IssueBadgeCard
            label="Missing Type"
            count={missingType.length}
            icon={<AlertTriangle className="size-5 text-amber-500" />}
            colorClass="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
          />
          <IssueBadgeCard
            label="Missing Status"
            count={missingStatus.length}
            icon={<AlertTriangle className="size-5 text-amber-500" />}
            colorClass="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
          />
        </div>
        <ScrollArea className="flex-1 min-h-0 pr-1">
          {!hasAnyIssue ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <CheckCircle2 className="size-10 text-emerald-500" />
              <p className="text-sm font-medium">No issues found</p>
              <p className="text-xs">The customer database looks clean.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {duplicateGroups.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-0.5">
                    Duplicate Groups ({duplicateGroups.length})
                  </p>
                  {duplicateGroups.map((g) => (
                    <DuplicateGroupCard key={g.id} group={g} />
                  ))}
                </div>
              )}
              {(missingType.length > 0 || missingStatus.length > 0) && (
                <div className="space-y-2">
                  {duplicateGroups.length > 0 && <Separator className="my-2" />}
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-0.5">
                    Data Issues
                  </p>
                  {[
                    { list: missingType, label: "Missing Type" },
                    { list: missingStatus, label: "Missing Status" },
                  ].map(({ list, label }) =>
                    list.length > 0 ? (
                      <div
                        key={label}
                        className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-4 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="size-4 text-amber-500" />
                          <span className="text-sm font-medium">
                            {label} ({list.length})
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {list.slice(0, 6).map((c) => (
                            <div
                              key={c.id}
                              className="text-[12px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-1.5"
                            >
                              <span className="font-semibold uppercase">
                                {c.company_name}
                              </span>{" "}
                              <span className="text-muted-foreground">
                                — {c.contact_person || "—"}
                              </span>
                            </div>
                          ))}
                          {list.length > 6 && (
                            <p className="text-[11px] text-muted-foreground pl-1">
                              + {list.length - 6} more
                            </p>
                          )}
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        <div className="flex justify-between gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPhase("terminal")}
          >
            ← Back to Log
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {hasAnyIssue && (
              <Button onClick={() => setPhase("confirm")} className="gap-1.5">
                Review & Proceed <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderConfirm = () => {
    if (!auditResult) return null;
    const total = auditResult.allAffectedCustomers.length;
    const dupeGroups = auditResult.duplicateGroups.length;
    const sameTsa = auditResult.duplicateGroups.filter(
      (g) => g.type === "same-tsa",
    ).length;
    const crossTsa = auditResult.duplicateGroups.filter(
      (g) => g.type === "cross-tsa",
    ).length;

    const handleConfirm = async () => {
      const duplicateGroupByCustomerId = new Map<number, DuplicateGroup>();
      auditResult.duplicateGroups.forEach((group) => {
        group.customers.forEach((customer) =>
          duplicateGroupByCustomerId.set(customer.id, group),
        );
      });

      persistAuditResult(auditResult);

      await Promise.all(
        auditResult.allAffectedCustomers.map(async (customer) => {
          const duplicateGroup = duplicateGroupByCustomerId.get(customer.id);
          const issueTypes: string[] = [];
          if (duplicateGroup)
            issueTypes.push(
              duplicateGroup.type === "cross-tsa"
                ? "cross-tsa-duplicate"
                : "same-tsa-duplicate",
            );
          if (auditResult.missingType.some((item) => item.id === customer.id))
            issueTypes.push("missing-type");
          if (auditResult.missingStatus.some((item) => item.id === customer.id))
            issueTypes.push("missing-status");

          await logCustomerAudit({
            action: "audit",
            customerId: customer.id,
            customerName: customer.company_name,
            referenceId: customer.referenceid || referenceId || null,
            performedBy: userId ?? null,
            performedByRole: performedByRole ?? null,
            auditStatus: "pending",
            auditRemarks: null,
            before: customer,
            after: {
              flaggedIssues: issueTypes,
              duplicateGroupId: duplicateGroup?.id ?? null,
              duplicateGroupType: duplicateGroup?.type ?? null,
              duplicateMatchReason: duplicateGroup?.matchReason ?? null,
            },
            metadata: {
              source: "customer-database",
              triggeredFrom: "audit-dialog",
            },
            actor: {
              uid: userId ?? null,
              name: sessionUser.name ?? null,
              email: sessionUser.email ?? null,
              role: performedByRole ?? null,
              referenceId: referenceId ?? null,
            },
            context: {
              page: "Customer Database",
              source: "AuditDialog",
              bulk: auditResult.allAffectedCustomers.length > 1,
            },
          });
        }),
      );

      onConfirmAudit?.(auditResult);
      onOpenChange(false);
      router.push("/taskflow/customer-audits");
    };

    return (
      <div className="flex flex-col h-full gap-6">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
          <div className="size-16 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
            <CheckCircle2 className="size-8 text-blue-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Send to Customer Audits?</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Flagged records will be sent to the{" "}
              <span className="font-medium text-foreground">
                Customer Audits
              </span>{" "}
              page for review and resolution.
            </p>
          </div>
          <div className="rounded-xl border bg-muted/50 p-5 w-full max-w-sm space-y-3 text-sm text-left">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total flagged</span>
              <span className="font-semibold tabular-nums">{total}</span>
            </div>
            {dupeGroups > 0 && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Duplicate groups
                  </span>
                  <span className="font-semibold tabular-nums">
                    {dupeGroups}
                  </span>
                </div>
                {sameTsa > 0 && (
                  <div className="flex justify-between pl-4 text-[12px]">
                    <span className="text-muted-foreground">↳ Same-TSA</span>
                    <span className="tabular-nums">{sameTsa}</span>
                  </div>
                )}
                {crossTsa > 0 && (
                  <div className="flex justify-between pl-4 text-[12px]">
                    <span className="text-muted-foreground">↳ Cross-TSA</span>
                    <span className="tabular-nums">{crossTsa}</span>
                  </div>
                )}
              </>
            )}
            {auditResult.missingType.length > 0 && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Missing type</span>
                  <span className="font-semibold tabular-nums">
                    {auditResult.missingType.length}
                  </span>
                </div>
              </>
            )}
            {auditResult.missingStatus.length > 0 && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Missing status</span>
                  <span className="font-semibold tabular-nums">
                    {auditResult.missingStatus.length}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-between gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setPhase("results")}>
            ← Back to Results
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="gap-1.5">
              Confirm — Go to Audits <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const titles: Record<Phase, string> = {
    terminal: "Running Audit",
    results: "Audit Results",
    confirm: "Confirm Audit",
  };
  const phaseOrder: Phase[] = ["terminal", "results", "confirm"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[82vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 shrink-0 border-b">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center">
              <Terminal className="size-4 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-base">{titles[phase]}</DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {phase === "terminal" &&
                  "Scanning customer database for issues..."}
                {phase === "results" &&
                  "Issues found — review before proceeding"}
                {phase === "confirm" && "Confirm flagged records to audit page"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {phaseOrder.map((p, i) => (
                <span
                  key={p}
                  className={cn(
                    "size-2 rounded-full transition-colors",
                    phase === p
                      ? "bg-primary"
                      : i < phaseOrder.indexOf(phase)
                        ? "bg-primary/40"
                        : "bg-zinc-200 dark:bg-zinc-700",
                  )}
                />
              ))}
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 px-6 py-5 flex flex-col">
          {phase === "terminal" && renderTerminal()}
          {phase === "results" && renderResults()}
          {phase === "confirm" && renderConfirm()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
