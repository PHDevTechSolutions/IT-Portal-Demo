"use client";

import React, { useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Database,
  Lock,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "config" | "running" | "done";
type LogLevel =
  | "header"
  | "info"
  | "success"
  | "error"
  | "warn"
  | "dim"
  | "running";

interface LogEntry {
  id: string;
  time: string;
  level: LogLevel;
  text: string;
}

interface HistoryDateRange {
  from: string;
  to: string;
}

const SUPABASE_TABLES = [
  "activity",
  "documentation",
  "history",
  "revised_quotations",
  "meetings",
  "signatories",
  "spf_request",
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface TransferDialogProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  /** Full account objects so we can snapshot previous TSM/Manager for the audit log */
  selectedUsers: {
    _id: string;
    ReferenceID: string;
    Department?: string;
    TSM?: string;
    Manager?: string;
  }[];
  setSelectedIdsAction: (ids: Set<string>) => void;
  setAccountsAction: (fn: (prev: any[]) => any[]) => void;
  tsms: { label: string; value: string }[];
  managers: { label: string; value: string }[];
}

// ─── Safe fetch ───────────────────────────────────────────────────────────────

async function safeFetch(
  url: string,
  init: RequestInit,
): Promise<{ success: boolean; error?: string; log?: any; [k: string]: any }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (networkErr: any) {
    return {
      success: false,
      error: `Network error: ${networkErr.message ?? "Failed to fetch"}`,
    };
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    return {
      success: false,
      error:
        `HTTP ${res.status}: ` +
        (text.includes("<!DOCTYPE")
          ? "Route not found. Ensure app/api/UserManagement/TransferTSA/route.ts is deployed."
          : text.slice(0, 150)),
    };
  }
  try {
    return await res.json();
  } catch (parseErr: any) {
    return { success: false, error: `JSON parse error: ${parseErr.message}` };
  }
}

// ─── Firestore write ──────────────────────────────────────────────────────────

/**
 * Writes a transfer event to Firestore `activity_logs`.
 * Field casing matches the MongoDB users collection: ReferenceID, TSM, Manager.
 */
async function logTransferToFirestore(params: {
  ReferenceID: string;
  TSM: string | null;
  Manager: string | null;
  previousTSM: string | null;
  previousManager: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorReferenceID: string | null;
}) {
  try {
    await addDoc(collection(db, "activity_logs"), {
      action: "transfer",
      status: "transfer",
      // PascalCase fields — match MongoDB/Firestore casing for this collection
      ReferenceID: params.ReferenceID,
      TSM: params.TSM,
      Manager: params.Manager,
      previousTSM: params.previousTSM,
      previousManager: params.previousManager,
      // Actor (who performed the transfer)
      actorName: params.actorName,
      actorEmail: params.actorEmail,
      actorReferenceID: params.actorReferenceID,
      // Compatibility with login-log fields that audit page also reads
      email: params.actorEmail,
      date_created: serverTimestamp(),
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    // Non-fatal — don't block UI on Firestore write failure
    console.warn("[TransferDialog] Firestore activity_log write failed:", err);
  }
}

// ─── Terminal helpers ─────────────────────────────────────────────────────────

const LEVEL_CLASS: Record<LogLevel, string> = {
  header: "text-cyan-400 font-semibold",
  info: "text-cyan-200",
  success: "text-emerald-400",
  error: "text-red-400",
  warn: "text-amber-400",
  dim: "text-cyan-500/50",
  running: "text-blue-400",
};

function Terminal({ entries }: { entries: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div className="bg-slate-950 border border-cyan-500/30 rounded-none h-64 overflow-y-auto font-mono text-xs p-3 select-text">
      {entries.length === 0 ? (
        <span className="text-cyan-500/30">Waiting to start...</span>
      ) : (
        entries.map((e) => (
          <div key={e.id} className="flex gap-2 leading-5">
            <span className="text-cyan-500/40 shrink-0">{e.time}</span>
            <span className={LEVEL_CLASS[e.level]}>{e.text}</span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function nowTime() {
  return new Date().toLocaleTimeString("en-PH", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

let _seq = 0;
function uid() {
  return String(++_seq);
}
function log(level: LogLevel, text: string): LogEntry {
  return { id: uid(), time: nowTime(), level, text };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TransferDialog: React.FC<TransferDialogProps> = ({
  open,
  onOpenChangeAction,
  selectedUsers,
  setSelectedIdsAction,
  setAccountsAction,
  tsms,
  managers,
}) => {
  // Current logged-in user (used as the audit actor)
  const { 
    uid: actorUid,
    name: actorName,
    email: actorEmail,
    referenceId: actorReferenceId,
    isLoading: userLoading 
  } = useCurrentUser() || {};

  const [phase, setPhase] = React.useState<Phase>("config");
  const [isLoading, setIsLoading] = React.useState(false);

  // ── Dual field selection ────────────────────────────────────────────────────
  const [tsmEnabled, setTsmEnabled] = React.useState(false);
  const [tsmSelection, setTsmSelection] = React.useState("");
  const [managerEnabled, setManagerEnabled] = React.useState(false);
  const [managerSelection, setManagerSelection] = React.useState("");

  // ── Table / date range selection ────────────────────────────────────────────
  const [selectedTables, setSelectedTables] = React.useState<Set<string>>(
    () => new Set(SUPABASE_TABLES),
  );
  const [historyRange, setHistoryRange] = React.useState<HistoryDateRange>({
    from: "",
    to: "",
  });

  // ── Terminal ────────────────────────────────────────────────────────────────
  const [logEntries, setLogEntries] = React.useState<LogEntry[]>([]);
  const [summary, setSummary] = React.useState({
    succeeded: 0,
    failed: 0,
    total: 0,
  });

  const addLog = (entry: LogEntry) => setLogEntries((prev) => [...prev, entry]);

  // ── Reset on close ──────────────────────────────────────────────────────────
  const handleOpenChange = (o: boolean) => {
    if (!o && !isLoading) {
      setPhase("config");
      setLogEntries([]);
      setSummary({ succeeded: 0, failed: 0, total: 0 });
      setTsmEnabled(false);
      setTsmSelection("");
      setManagerEnabled(false);
      setManagerSelection("");
      setSelectedTables(new Set(SUPABASE_TABLES));
      setHistoryRange({ from: "", to: "" });
    }
    onOpenChangeAction(o);
  };

  const toggleTable = (table: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return next;
    });
  };

  const salesUsers = selectedUsers.filter(
    (u) => u.Department === "Sales" && u.ReferenceID,
  );

  // ─── Transfer handler ───────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!tsmEnabled && !managerEnabled) {
      toast.error("Enable at least one transfer target (TSM or Manager).");
      return;
    }
    if (tsmEnabled && !tsmSelection) {
      toast.error("Select a TSM to transfer to.");
      return;
    }
    if (managerEnabled && !managerSelection) {
      toast.error("Select a Manager to transfer to.");
      return;
    }
    if (salesUsers.length === 0) {
      toast.error("No Sales users selected.");
      return;
    }

    const tables = Array.from(selectedTables);
    const dateRange =
      selectedTables.has("history") && historyRange.from && historyRange.to
        ? historyRange
        : undefined;

    if (
      selectedTables.has("history") &&
      (historyRange.from || historyRange.to) &&
      !(historyRange.from && historyRange.to)
    ) {
      toast.error(
        "Provide both From and To dates for the history filter, or clear both.",
      );
      return;
    }

    setPhase("running");
    setIsLoading(true);
    setLogEntries([]);

    const fieldSummary = [
      tsmEnabled && `TSM → ${tsmSelection}`,
      managerEnabled && `Manager → ${managerSelection}`,
    ]
      .filter(Boolean)
      .join("  |  ");

    let succeeded = 0;
    let failed = 0;

    addLog(log("header", `══ Transfer — ${salesUsers.length} user(s) ══`));
    addLog(log("dim", `Fields: ${fieldSummary}`));
    addLog(
      log(
        "dim",
        `Tables: MongoDB (locked) · Neon (locked) · ${tables.join(", ")}`,
      ),
    );
    if (dateRange)
      addLog(log("dim", `History filter: ${dateRange.from} → ${dateRange.to}`));
    addLog(log("dim", "─".repeat(52)));

    for (const user of salesUsers) {
      addLog(log("header", `▶ ${user.ReferenceID}`));

      // Collect all field calls for this user
      const fieldCalls: { field: "tsm" | "manager"; newValue: string }[] = [];
      if (tsmEnabled && tsmSelection)
        fieldCalls.push({ field: "tsm", newValue: tsmSelection });
      if (managerEnabled && managerSelection)
        fieldCalls.push({ field: "manager", newValue: managerSelection });

      let userSucceeded = true;

      for (const { field, newValue } of fieldCalls) {
        const label = field === "tsm" ? "TSM     " : "Manager ";
        addLog(
          log("running", `  [${label}] MongoDB + Neon + Supabase ... running`),
        );

        const result = await safeFetch("/api/UserManagement/TransferTSA", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tsaReferenceId: user.ReferenceID,
            field,
            newSupervisorReferenceId: newValue,
            selectedTables: tables,
            historyDateRange: dateRange,
          }),
        });

        // Replace the "running" line with the result
        setLogEntries((prev) => {
          const copy = [...prev];
          // Use compatible alternative to findLastIndex
          let idx = -1;
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].level === "running") {
              idx = i;
              break;
            }
          }
          if (idx !== -1) {
            if (!result.success) {
              copy[idx] = log(
                "error",
                `  [${label}] ✗ ${result.error ?? "Unknown error"}`,
              );
            } else {
              const rLog = result.log ?? {};
              const mongoStatus =
                rLog.mongodb === "ok"
                  ? "✓ MongoDB"
                  : `✗ MongoDB(${rLog.mongodb})`;
              const neonCount = rLog.neon?.updated ?? "?";
              const neonStatus = rLog.neon?.error
                ? `✗ Neon` 
                : `✓ Neon(${neonCount} rows)`;
              copy[idx] = log(
                "success",
                `  [${label}] ${mongoStatus} · ${neonStatus}`,
              );
            }
          }
          return copy;
        });

        if (!result.success) {
          userSucceeded = false;
          continue;
        }

        // Log Supabase table results inline
        const sbResults = (result.log?.supabase ?? {}) as Record<
          string,
          { updated: number; skipped?: boolean; error?: string }
        >;
        for (const table of SUPABASE_TABLES) {
          const r = sbResults[table];
          if (!r) continue;
          const lbl = table.padEnd(18, ".");
          if (r.skipped) {
            addLog(log("dim", `           Supabase ${lbl} – skipped`));
          } else if (r.error) {
            addLog(log("error", `           Supabase ${lbl} ✗ ${r.error}`));
          } else {
            const extra =
              table === "history" && dateRange
                ? ` (${dateRange.from} → ${dateRange.to})`
                : "";
            addLog(
              log(
                "success",
                `           Supabase ${lbl} ✓ ${r.updated >= 0 ? r.updated : "?"} row(s)${extra}`,
              ),
            );
          }
        }

        // Write to Firestore activity_logs
        await logTransferToFirestore({
          ReferenceID: user.ReferenceID,
          TSM: field === "tsm" ? newValue : null,
          Manager: field === "manager" ? newValue : null,
          previousTSM: field === "tsm" ? (user.TSM ?? null) : null,
          previousManager: field === "manager" ? (user.Manager ?? null) : null,
          actorName: actorName || "System",
          actorEmail: actorEmail || "system@ecoshift.com",
          actorReferenceID: actorReferenceId || "SYSTEM",
        });
        addLog(log("dim", `           Firestore activity_logs ✓ written`));
      }

      if (userSucceeded) {
        succeeded++;
        addLog(log("success", "  ✓ Done"));
      } else {
        failed++;
        addLog(log("warn", "  ⚠ Partial failure — see above"));
      }
      addLog(log("dim", "─".repeat(52)));
    }

    // Final summary
    addLog(log("dim", ""));
    if (failed === 0) {
      addLog(
        log(
          "success",
          `✔ All ${succeeded} transfer(s) completed successfully.`,
        ),
      );
    } else if (succeeded > 0) {
      addLog(log("warn", `⚠ ${succeeded} succeeded, ${failed} failed.`));
    } else {
      addLog(log("error", `✖ All ${failed} transfer(s) failed.`));
    }

    // Update local state for succeeded users
    if (succeeded > 0) {
      setAccountsAction((prev) =>
        prev.map((u) => {
          if (!salesUsers.slice(0, succeeded).some((s) => s._id === u._id))
            return u;
          return {
            ...u,
            ...(tsmEnabled && tsmSelection ? { TSM: tsmSelection } : {}),
            ...(managerEnabled && managerSelection
              ? { Manager: managerSelection }
              : {}),
          };
        }),
      );
      setSelectedIdsAction(new Set());
    }

    setSummary({ succeeded, failed, total: salesUsers.length });
    setPhase("done");
    setIsLoading(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-900/95 border-cyan-500/30">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <Database className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <DialogTitle className="text-cyan-100 tracking-wider flex items-center gap-2">
                DATA TRANSFER PROTOCOL
              </DialogTitle>
              {salesUsers.length > 0 && (
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px] mt-1">
                  {salesUsers.length} Sales user(s) selected
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Config panel ─────────────────────────────────────────────────── */}
          {phase === "config" && (
            <>
              {/* Dual TSM + Manager field selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-cyan-400/70 tracking-wider">Transfer Targets</label>
                <p className="text-xs text-cyan-300/50">
                  Enable one or both. Each selection updates the corresponding
                  supervisor across MongoDB, Neon, and the selected Supabase
                  tables.
                </p>

                {/* TSM row */}
                <div
                  className={"rounded-none border px-3 py-2.5 space-y-2 transition-colors " + (tsmEnabled ? "border-cyan-400/50 bg-cyan-500/10" : "border-cyan-500/20 bg-slate-900/30")}
                >
                  <div
                    className="flex items-center gap-2.5 cursor-pointer"
                    onClick={() => setTsmEnabled((v) => !v)}
                  >
                    <Checkbox
                      checked={tsmEnabled}
                      onCheckedChange={(v) => setTsmEnabled(!!v)}
                      className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500 pointer-events-none"
                    />
                    <span className="text-sm font-medium text-cyan-100">Update TSM</span>
                    <span className="text-xs text-cyan-400/50 ml-auto">
                      Territory Sales Manager
                    </span>
                  </div>
                  {tsmEnabled && (
                    <Select
                      value={tsmSelection}
                      onValueChange={setTsmSelection}
                    >
                      <SelectTrigger className="w-full h-8 text-xs bg-slate-900/50 border-cyan-500/30 text-cyan-100 rounded-none">
                        <SelectValue placeholder="Choose a TSM..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-cyan-500/30">
                        {tsms.map((u) => (
                          <SelectItem key={u.value} value={u.value} className="text-cyan-100">
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Manager row */}
                <div
                  className={"rounded-none border px-3 py-2.5 space-y-2 transition-colors " + (managerEnabled ? "border-cyan-400/50 bg-cyan-500/10" : "border-cyan-500/20 bg-slate-900/30")}
                >
                  <div
                    className="flex items-center gap-2.5 cursor-pointer"
                    onClick={() => setManagerEnabled((v) => !v)}
                  >
                    <Checkbox
                      checked={managerEnabled}
                      onCheckedChange={(v) => setManagerEnabled(!!v)}
                      className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500 pointer-events-none"
                    />
                    <span className="text-sm font-medium text-cyan-100">Update Manager</span>
                    <span className="text-xs text-cyan-400/50 ml-auto">
                      Regional Manager
                    </span>
                  </div>
                  {managerEnabled && (
                    <Select
                      value={managerSelection}
                      onValueChange={setManagerSelection}
                    >
                      <SelectTrigger className="w-full h-8 text-xs bg-slate-900/50 border-cyan-500/30 text-cyan-100 rounded-none">
                        <SelectValue placeholder="Choose a Manager..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-cyan-500/30">
                        {managers.map((u) => (
                          <SelectItem key={u.value} value={u.value} className="text-cyan-100">
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Table selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-cyan-400/70 tracking-wider">Database Targets</label>

                {/* Locked core tables */}
                <div className="grid grid-cols-2 gap-1.5">
                  {(["MongoDB  users", "Neon  accounts"] as const).map((t) => (
                    <div
                      key={t}
                      className="flex items-center gap-2 rounded-none border border-cyan-500/20 bg-slate-900/30 px-3 py-2 text-xs text-cyan-300/50"
                    >
                      <Lock className="w-3 h-3 shrink-0 text-cyan-400/50" />
                      <span className="font-mono">{t}</span>
                      <Badge variant="outline" className="ml-auto text-[10px] border-cyan-500/30 text-cyan-400/50">
                        always
                      </Badge>
                    </div>
                  ))}
                </div>

                {/* Toggleable Supabase tables */}
                <div className="grid grid-cols-2 gap-1.5">
                  {SUPABASE_TABLES.map((table) => {
                    const isChecked = selectedTables.has(table);
                    return (
                      <div key={table} className="space-y-1">
                        <div
                          className={"flex items-center gap-2 rounded-none border px-3 py-2 cursor-pointer transition-colors " +
                            (isChecked
                              ? "border-cyan-400/50 bg-cyan-500/10"
                              : "border-cyan-500/20 bg-slate-900/30 hover:bg-cyan-500/5")
                          }
                          onClick={() => toggleTable(table)}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleTable(table)}
                            className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500 pointer-events-none"
                          />
                          <span className="font-mono text-xs text-cyan-100">{table}</span>
                          {table === "history" && isChecked && (
                            <Calendar className="w-3 h-3 ml-auto text-cyan-400/50" />
                          )}
                        </div>

                        {/* Date range — only for history table */}
                        {table === "history" && isChecked && (
                          <div
                            className="ml-1 pl-3 border-l-2 border-cyan-400/30 space-y-1 pb-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-[10px] text-cyan-300/50">
                              Date range filter (optional)
                            </p>
                            <div className="flex gap-1.5 items-center">
                              <input
                                type="date"
                                value={historyRange.from}
                                onChange={(e) =>
                                  setHistoryRange((r) => ({
                                    ...r,
                                    from: e.target.value,
                                  }))
                                }
                                className="flex-1 rounded-none border border-cyan-500/30 bg-slate-900/50 px-2 py-1 text-xs text-cyan-100"
                              />
                              <span className="text-xs text-cyan-400/50">
                                →
                              </span>
                              <input
                                type="date"
                                value={historyRange.to}
                                onChange={(e) =>
                                  setHistoryRange((r) => ({
                                    ...r,
                                    to: e.target.value,
                                  }))
                                }
                                className="flex-1 rounded-none border border-cyan-500/30 bg-slate-900/50 px-2 py-1 text-xs text-cyan-100"
                              />
                            </div>
                            {(historyRange.from || historyRange.to) &&
                              !(historyRange.from && historyRange.to) && (
                                <p className="text-[10px] text-red-400">
                                  Both dates required, or clear both to update
                                  all history.
                                </p>
                              )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-cyan-300/50">
                  {selectedTables.size} of {SUPABASE_TABLES.length} Supabase
                  tables selected
                </p>
              </div>

              {/* Actor info */}
              {actorName && (
                <p className="text-[11px] text-cyan-300/50">
                  Acting as{" "}
                  <span className="font-medium text-cyan-100">
                    {actorName}
                  </span>
                  {actorReferenceId && (
                    <span className="text-cyan-400/50">
                      {" "}
                      ({actorReferenceId})
                    </span>
                  )}
                  {" — "}changes will be logged to{" "}
                  <span className="font-mono text-[10px] text-cyan-400">activity_logs</span>
                </p>
              )}
            </>
          )}

          {/* ── Config summary (running/done) ─────────────────────────────────── */}
          {phase !== "config" && (
            <div className="flex flex-wrap gap-2 text-[11px] text-cyan-300/50">
              {tsmEnabled && (
                <span>
                  <span className="font-medium text-cyan-100">TSM:</span>{" "}
                  {tsmSelection}
                </span>
              )}
              {managerEnabled && (
                <span>
                  <span className="font-medium text-cyan-100">Manager:</span>{" "}
                  {managerSelection}
                </span>
              )}
              <span className="text-cyan-500/50">·</span>
              <span>
                <span className="font-medium text-cyan-100">Tables:</span>{" "}
                {Array.from(selectedTables).join(", ")}
              </span>
              {historyRange.from && historyRange.to && (
                <>
                  <span className="text-cyan-500/50">·</span>
                  <span>
                    <span className="font-medium text-cyan-100">
                      History:
                    </span>{" "}
                    {historyRange.from} → {historyRange.to}
                  </span>
                </>
              )}
            </div>
          )}

          {/* ── Terminal ──────────────────────────────────────────────────────── */}
          {(phase === "running" || phase === "done") && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-cyan-400/70 tracking-wider flex items-center gap-1.5">
                  Transfer Log
                  {phase === "running" && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  )}
                </label>
                {phase === "done" && (
                  <span className="text-xs flex items-center gap-1 text-cyan-300">
                    {summary.failed === 0 ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                    {summary.succeeded}/{summary.total} completed
                  </span>
                )}
              </div>
              <Terminal entries={logEntries} />
            </div>
          )}

          {/* ── Footer buttons ────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-2 pt-1">
            {phase === "config" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isLoading}
                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-none"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={
                    (!tsmEnabled && !managerEnabled) ||
                    (tsmEnabled && !tsmSelection) ||
                    (managerEnabled && !managerSelection) ||
                    salesUsers.length === 0
                  }
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0 rounded-none"
                >
                  Initiate Transfer{" "}
                  {salesUsers.length > 0 &&
                    "(" + salesUsers.length + " × " + [tsmEnabled, managerEnabled].filter(Boolean).length + " field" + ([tsmEnabled, managerEnabled].filter(Boolean).length > 1 ? "s" : "") + ")"}
                </Button>
              </>
            )}
            {phase === "running" && (
              <Button variant="outline" disabled className="border-cyan-500/30 text-cyan-400 rounded-none">
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                Processing...
              </Button>
            )}
            {phase === "done" && (
              <Button 
                onClick={() => handleOpenChange(false)}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0 rounded-none"
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
