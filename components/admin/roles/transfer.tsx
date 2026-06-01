"use client";
import React, { useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Database, Lock, Calendar, CheckCircle2, XCircle,
  Loader2, ArrowRightLeft, Shield, ChevronRight,
} from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  muted:  "#253040",
  dim:    "#4a6070",
  text:   "#c8d8e8",
  accent: "#e8630a",
  font:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = "config" | "running" | "done";
type LogLevel = "header" | "info" | "success" | "error" | "warn" | "dim" | "running";

interface LogEntry { id: string; time: string; level: LogLevel; text: string; }
interface HistoryDateRange { from: string; to: string; }

const SUPABASE_TABLES = [
  "activity", "documentation", "history", "revised_quotations",
  "meetings", "signatories", "spf_request",
] as const;

interface TransferDialogProps {
  open:                boolean;
  onOpenChangeAction:  (open: boolean) => void;
  selectedUsers:       { _id: string; ReferenceID: string; Department?: string; TSM?: string; Manager?: string }[];
  setSelectedIdsAction:(ids: Set<string>) => void;
  setAccountsAction:   (fn: (prev: any[]) => any[]) => void;
  tsms:                { label: string; value: string }[];
  managers:            { label: string; value: string }[];
  // All agents available as transfer targets
  agents?:             { label: string; value: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function safeFetch(url: string, init: RequestInit) {
  let res: Response;
  try { res = await fetch(url, init); }
  catch (e: any) { return { success: false, error: `Network error: ${e.message}` }; }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    return { success: false, error: `HTTP ${res.status}: ${text.includes("<!DOCTYPE") ? "Route not found." : text.slice(0, 150)}` };
  }
  try { return await res.json(); }
  catch (e: any) { return { success: false, error: `JSON parse error: ${e.message}` }; }
}

async function logTransferToFirestore(params: {
  ReferenceID: string; TSM: string | null; Manager: string | null;
  previousTSM: string | null; previousManager: string | null;
  actorName: string | null; actorEmail: string | null; actorReferenceID: string | null;
}) {
  try {
    await addDoc(collection(db, "activity_logs"), {
      action: "transfer", status: "transfer",
      ReferenceID: params.ReferenceID, TSM: params.TSM, Manager: params.Manager,
      previousTSM: params.previousTSM, previousManager: params.previousManager,
      actorName: params.actorName, actorEmail: params.actorEmail,
      actorReferenceID: params.actorReferenceID, email: params.actorEmail,
      date_created: serverTimestamp(), timestamp: serverTimestamp(),
    });
  } catch (err) { console.warn("[TransferDialog] Firestore write failed:", err); }
}

// ─── Terminal ─────────────────────────────────────────────────────────────────
const LEVEL_STYLE: Record<LogLevel, { color: string }> = {
  header:  { color: C.accent },
  info:    { color: C.text },
  success: { color: "#34d399" },
  error:   { color: "#f87171" },
  warn:    { color: "#fbbf24" },
  dim:     { color: C.dim },
  running: { color: "#60a5fa" },
};

function Terminal({ entries }: { entries: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [entries]);
  return (
    <div className="overflow-y-auto h-56 p-3 space-y-0.5"
      style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, fontFamily: C.font }}>
      {entries.length === 0
        ? <span className="text-[10px]" style={{ color: C.muted }}>Waiting to start…</span>
        : entries.map(e => (
          <div key={e.id} className="flex gap-2 text-[10px] leading-5">
            <span className="shrink-0" style={{ color: C.muted }}>{e.time}</span>
            <span style={{ color: LEVEL_STYLE[e.level].color }}>{e.text}</span>
          </div>
        ))}
      <div ref={bottomRef} />
    </div>
  );
}

let _seq = 0;
const uid  = () => String(++_seq);
const nowTime = () => new Date().toLocaleTimeString("en-PH", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
const mkLog = (level: LogLevel, text: string): LogEntry => ({ id: uid(), time: nowTime(), level, text });

// ─── Component ────────────────────────────────────────────────────────────────
export const TransferDialog: React.FC<TransferDialogProps> = ({
  open, onOpenChangeAction, selectedUsers, setSelectedIdsAction, setAccountsAction, tsms, managers, agents,
}) => {
  const { name: actorName, email: actorEmail, referenceId: actorReferenceId } = useCurrentUser() || {};

  const [phase,           setPhase]           = React.useState<Phase>("config");
  const [isLoading,       setIsLoading]       = React.useState(false);
  const [tsmEnabled,      setTsmEnabled]      = React.useState(false);
  const [tsmSelection,    setTsmSelection]    = React.useState("");
  const [managerEnabled,  setManagerEnabled]  = React.useState(false);
  const [managerSelection,setManagerSelection]= React.useState("");
  const [selectedTables,  setSelectedTables]  = React.useState<Set<string>>(() => new Set(SUPABASE_TABLES));
  const [historyRange,    setHistoryRange]    = React.useState<HistoryDateRange>({ from: "", to: "" });
  const [logEntries,      setLogEntries]      = React.useState<LogEntry[]>([]);
  const [summary,         setSummary]         = React.useState({ succeeded: 0, failed: 0, total: 0 });

  // ── Agent Data Transfer state ──────────────────────────────────────────────
  const [agentTransferEnabled, setAgentTransferEnabled] = React.useState(false);
  const [fromAgent,            setFromAgent]            = React.useState("");
  const [toAgent,              setToAgent]              = React.useState("");
  const [tsaList,              setTsaList]              = React.useState<{ label: string; value: string }[]>([]);
  const [tsaLoading,           setTsaLoading]           = React.useState(false);

  // Fetch TSAs when agent transfer is enabled
  React.useEffect(() => {
    if (!agentTransferEnabled || tsaList.length > 0) return;
    setTsaLoading(true);
    fetch("/api/UserManagement/FetchTSA?Role=Territory Sales Associate")
      .then(r => r.json())
      .then(data => {
        const list = (Array.isArray(data) ? data : []).map((u: any) => ({
          value: u.ReferenceID,
          label: `${u.Firstname ?? ""} ${u.Lastname ?? ""}`.trim() || u.ReferenceID,
        })).sort((a: any, b: any) => a.label.localeCompare(b.label));
        setTsaList(list);
      })
      .catch(() => toast.error("Failed to load TSA list"))
      .finally(() => setTsaLoading(false));
  }, [agentTransferEnabled]);

  const addLog = (e: LogEntry) => setLogEntries(prev => [...prev, e]);

  const handleOpenChange = (o: boolean) => {
    if (!o && !isLoading) {
      setPhase("config"); setLogEntries([]); setSummary({ succeeded: 0, failed: 0, total: 0 });
      setTsmEnabled(false); setTsmSelection(""); setManagerEnabled(false); setManagerSelection("");
      setSelectedTables(new Set(SUPABASE_TABLES)); setHistoryRange({ from: "", to: "" });
      setAgentTransferEnabled(false); setFromAgent(""); setToAgent("");
    }
    onOpenChangeAction(o);
  };

  const toggleTable = (t: string) => setSelectedTables(prev => {
    const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n;
  });

  const salesUsers = selectedUsers.filter(u => u.Department === "Sales" && u.ReferenceID);

  // ── Transfer handler ────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!tsmEnabled && !managerEnabled && !agentTransferEnabled) {
      toast.error("Enable at least one transfer target."); return;
    }
    if (tsmEnabled && !tsmSelection)    { toast.error("Select a TSM."); return; }
    if (managerEnabled && !managerSelection) { toast.error("Select a Manager."); return; }
    if (agentTransferEnabled) {
      if (!fromAgent) { toast.error("Select the source agent (From)."); return; }
      if (!toAgent)   { toast.error("Select the destination agent (To)."); return; }
      if (fromAgent === toAgent) { toast.error("Source and destination agents must be different."); return; }
    }
    if ((tsmEnabled || managerEnabled) && salesUsers.length === 0) {
      toast.error("No Sales users selected for supervisor transfer."); return;
    }

    const tables = Array.from(selectedTables);
    const dateRange = selectedTables.has("history") && historyRange.from && historyRange.to ? historyRange : undefined;

    if (selectedTables.has("history") && (historyRange.from || historyRange.to) && !(historyRange.from && historyRange.to)) {
      toast.error("Provide both From and To dates for history filter, or clear both."); return;
    }

    setPhase("running"); setIsLoading(true); setLogEntries([]);
    let succeeded = 0, failed = 0;

    const fieldSummary = [tsmEnabled && `TSM → ${tsmSelection}`, managerEnabled && `Manager → ${managerSelection}`].filter(Boolean).join("  |  ");
    addLog(mkLog("header", `══ Transfer — ${salesUsers.length} user(s) ══`));
    addLog(mkLog("dim",    `Fields: ${fieldSummary}`));
    addLog(mkLog("dim",    `Tables: MongoDB · Neon · ${tables.join(", ")}`));
    if (dateRange) addLog(mkLog("dim", `History filter: ${dateRange.from} → ${dateRange.to}`));
    addLog(mkLog("dim",    "─".repeat(52)));

    for (const user of salesUsers) {
      addLog(mkLog("header", `▶ ${user.ReferenceID}`));
      const fieldCalls: { field: "tsm" | "manager"; newValue: string }[] = [];
      if (tsmEnabled && tsmSelection)       fieldCalls.push({ field: "tsm",     newValue: tsmSelection });
      if (managerEnabled && managerSelection) fieldCalls.push({ field: "manager", newValue: managerSelection });

      let userSucceeded = true;

      for (const { field, newValue } of fieldCalls) {
        const label = field === "tsm" ? "TSM     " : "Manager ";
        addLog(mkLog("running", `  [${label}] MongoDB + Neon + Supabase … running`));

        const result = await safeFetch("/api/UserManagement/TransferTSA", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tsaReferenceId: user.ReferenceID, field, newSupervisorReferenceId: newValue,
            selectedTables: tables, historyDateRange: dateRange,
          }),
        });

        // Replace the "running" line
        setLogEntries(prev => {
          const copy = [...prev];
          let idx = -1;
          for (let i = copy.length - 1; i >= 0; i--) { if (copy[i].level === "running") { idx = i; break; } }
          if (idx !== -1) {
            if (!result.success) {
              copy[idx] = mkLog("error", `  [${label}] ✗ ${result.error ?? "Unknown error"}`);
            } else {
              const rLog = result.log ?? {};
              const mongoStatus = rLog.mongodb === "ok" ? "✓ MongoDB" : `✗ MongoDB(${rLog.mongodb})`;
              const neonCount   = rLog.neon?.updated ?? "?";
              const neonStatus  = rLog.neon?.error ? "✗ Neon" : `✓ Neon(${neonCount} rows)`;
              copy[idx] = mkLog("success", `  [${label}] ${mongoStatus} · ${neonStatus}`);
            }
          }
          return copy;
        });

        if (!result.success) { userSucceeded = false; continue; }

        // Supabase table results
        const sbResults = (result.log?.supabase ?? {}) as Record<string, { updated: number; skipped?: boolean; error?: string }>;
        for (const table of SUPABASE_TABLES) {
          const r = sbResults[table];
          if (!r) continue;
          const lbl = table.padEnd(18, ".");
          if (r.skipped)     addLog(mkLog("dim",     `           Supabase ${lbl} – skipped`));
          else if (r.error)  addLog(mkLog("error",   `           Supabase ${lbl} ✗ ${r.error}`));
          else {
            const extra = table === "history" && dateRange ? ` (${dateRange.from} → ${dateRange.to})` : "";
            addLog(mkLog("success", `           Supabase ${lbl} ✓ ${r.updated >= 0 ? r.updated : "?"} row(s)${extra}`));
          }
        }

        // Firestore log
        await logTransferToFirestore({
          ReferenceID: user.ReferenceID,
          TSM:             field === "tsm"     ? newValue : null,
          Manager:         field === "manager" ? newValue : null,
          previousTSM:     field === "tsm"     ? (user.TSM     ?? null) : null,
          previousManager: field === "manager" ? (user.Manager ?? null) : null,
          actorName:       actorName     || "System",
          actorEmail:      actorEmail    || "system@ecoshift.com",
          actorReferenceID: actorReferenceId || "SYSTEM",
        });
        addLog(mkLog("dim", `           Firestore activity_logs ✓ written`));
      }

      if (userSucceeded) { succeeded++; addLog(mkLog("success", "  ✓ Done")); }
      else               { failed++;    addLog(mkLog("warn",    "  ⚠ Partial failure — see above")); }
      addLog(mkLog("dim", "─".repeat(52)));
    }

    addLog(mkLog("dim", ""));
    if (failed === 0)       addLog(mkLog("success", `✔ All ${succeeded} transfer(s) completed successfully.`));
    else if (succeeded > 0) addLog(mkLog("warn",    `⚠ ${succeeded} succeeded, ${failed} failed.`));
    else                    addLog(mkLog("error",   `✖ All ${failed} transfer(s) failed.`));

    // ── Agent Data Transfer ────────────────────────────────────────────────
    if (agentTransferEnabled && fromAgent && toAgent) {
      addLog(mkLog("dim",    ""));
      addLog(mkLog("header", `══ Agent Data Transfer ══`));
      addLog(mkLog("dim",    `From: ${fromAgent}  →  To: ${toAgent}`));
      addLog(mkLog("dim",    `Tables: ${tables.join(", ")}`));
      addLog(mkLog("dim",    "─".repeat(52)));
      addLog(mkLog("running", "  Transferring data records … running"));

      const agentResult = await safeFetch("/api/UserManagement/TransferAgentData", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromReferenceId: fromAgent,
          toReferenceId:   toAgent,
          selectedTables:  tables,
          historyDateRange: dateRange,
        }),
      });

      setLogEntries(prev => {
        const copy = [...prev];
        let idx = -1;
        for (let i = copy.length - 1; i >= 0; i--) { if (copy[i].level === "running") { idx = i; break; } }
        if (idx !== -1) {
          copy[idx] = agentResult.success
            ? mkLog("success", `  ✓ Agent data transfer initiated`)
            : mkLog("error",   `  ✗ ${agentResult.error ?? "Unknown error"}`);
        }
        return copy;
      });

      if (agentResult.success) {
        // Log per-table results
        const sbResults = (agentResult.log?.supabase ?? {}) as Record<string, { updated: number; skipped?: boolean; error?: string }>;
        for (const table of SUPABASE_TABLES) {
          const r = sbResults[table];
          if (!r) continue;
          const lbl = table.padEnd(18, ".");
          if (r.skipped)    addLog(mkLog("dim",     `           Supabase ${lbl} – skipped`));
          else if (r.error) addLog(mkLog("error",   `           Supabase ${lbl} ✗ ${r.error}`));
          else {
            const extra = table === "history" && dateRange ? ` (${dateRange.from} → ${dateRange.to})` : "";
            addLog(mkLog("success", `           Supabase ${lbl} ✓ ${r.updated >= 0 ? r.updated : "?"} row(s)${extra}`));
          }
        }
        // Neon result
        if (agentResult.log?.neon) {
          const n = agentResult.log.neon;
          addLog(mkLog(n.error ? "error" : "success",
            `           Neon accounts${" ".repeat(9)} ${n.error ? `✗ ${n.error}` : `✓ ${n.updated ?? "?"} row(s)`}`));
        }
        // Firestore log
        await logTransferToFirestore({
          ReferenceID:      fromAgent,
          TSM:              null,
          Manager:          null,
          previousTSM:      null,
          previousManager:  null,
          actorName:        actorName     || "System",
          actorEmail:       actorEmail    || "system@ecoshift.com",
          actorReferenceID: actorReferenceId || "SYSTEM",
        });
        addLog(mkLog("dim",     `           Firestore activity_logs ✓ written`));
        addLog(mkLog("success", `  ✓ Agent data transfer complete`));
      } else {
        addLog(mkLog("error", `  ✖ Agent data transfer failed`));
      }
      addLog(mkLog("dim", "─".repeat(52)));
    }
    if (succeeded > 0) {
      setAccountsAction(prev => prev.map(u => {
        if (!salesUsers.slice(0, succeeded).some(s => s._id === u._id)) return u;
        return {
          ...u,
          ...(tsmEnabled     && tsmSelection     ? { TSM:     tsmSelection     } : {}),
          ...(managerEnabled && managerSelection ? { Manager: managerSelection } : {}),
        };
      }));
      setSelectedIdsAction(new Set());
    }

    setSummary({ succeeded, failed, total: salesUsers.length });
    setPhase("done");
    setIsLoading(false);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl rounded-none p-0 gap-0 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>

        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b shrink-0" style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <ArrowRightLeft className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <DialogTitle className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                Data Transfer Protocol
              </DialogTitle>
              <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>
                {salesUsers.length} Sales user{salesUsers.length !== 1 ? "s" : ""} selected · MongoDB + Neon + Supabase
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 py-4 space-y-5">

          {/* ── Config panel ── */}
          {phase === "config" && (
            <>
              {/* Transfer targets */}
              <div className="space-y-3">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent + "80" }}>
                  Transfer Targets
                </p>
                <p className="text-[10px]" style={{ color: C.dim }}>
                  Enable one or both. Each updates the supervisor across MongoDB, Neon, and selected Supabase tables.
                </p>

                {/* TSM */}
                <div className="border p-3 space-y-2.5 transition-colors"
                  style={{ borderColor: tsmEnabled ? C.accent + "60" : C.border, backgroundColor: tsmEnabled ? "rgba(232,99,10,0.05)" : "transparent" }}>
                  <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setTsmEnabled(v => !v)}>
                    <Checkbox checked={tsmEnabled} onCheckedChange={v => setTsmEnabled(!!v)}
                      className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 pointer-events-none" />
                    <span className="text-[11px] font-bold" style={{ color: C.text }}>Update TSM</span>
                    <span className="text-[9px] ml-auto" style={{ color: C.muted }}>Territory Sales Manager</span>
                  </div>
                  {tsmEnabled && (
                    <Select value={tsmSelection} onValueChange={setTsmSelection}>
                      <SelectTrigger className="h-8 text-[11px] rounded-none focus:ring-0"
                        style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                        <SelectValue placeholder="Choose a TSM…" />
                      </SelectTrigger>
                      <SelectContent style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>
                        {tsms.map(u => (
                          <SelectItem key={u.value} value={u.value}
                            className="text-[11px] focus:bg-orange-500/10 focus:text-orange-400"
                            style={{ color: C.text }}>{u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Manager */}
                <div className="border p-3 space-y-2.5 transition-colors"
                  style={{ borderColor: managerEnabled ? C.accent + "60" : C.border, backgroundColor: managerEnabled ? "rgba(232,99,10,0.05)" : "transparent" }}>
                  <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setManagerEnabled(v => !v)}>
                    <Checkbox checked={managerEnabled} onCheckedChange={v => setManagerEnabled(!!v)}
                      className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 pointer-events-none" />
                    <span className="text-[11px] font-bold" style={{ color: C.text }}>Update Manager</span>
                    <span className="text-[9px] ml-auto" style={{ color: C.muted }}>Regional Manager</span>
                  </div>
                  {managerEnabled && (
                    <Select value={managerSelection} onValueChange={setManagerSelection}>
                      <SelectTrigger className="h-8 text-[11px] rounded-none focus:ring-0"
                        style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                        <SelectValue placeholder="Choose a Manager…" />
                      </SelectTrigger>
                      <SelectContent style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>
                        {managers.map(u => (
                          <SelectItem key={u.value} value={u.value}
                            className="text-[11px] focus:bg-orange-500/10 focus:text-orange-400"
                            style={{ color: C.text }}>{u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Database targets */}
              <div className="space-y-3">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent + "80" }}>
                  Database Targets
                </p>

                {/* Locked */}
                <div className="grid grid-cols-2 gap-1.5">
                  {["MongoDB — users", "Neon — accounts"].map(t => (
                    <div key={t} className="flex items-center gap-2 px-3 py-2 border"
                      style={{ borderColor: C.border, backgroundColor: C.bg }}>
                      <Lock className="size-3 shrink-0" style={{ color: C.dim }} />
                      <span className="text-[10px] font-mono" style={{ color: C.dim }}>{t}</span>
                      <span className="ml-auto text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                        style={{ borderColor: C.border, color: C.muted }}>always</span>
                    </div>
                  ))}
                </div>

                {/* Toggleable Supabase tables */}
                <div className="grid grid-cols-2 gap-1.5">
                  {SUPABASE_TABLES.map(table => {
                    const isChecked = selectedTables.has(table);
                    return (
                      <div key={table} className="space-y-1">
                        <div
                          className="flex items-center gap-2 px-3 py-2 border cursor-pointer transition-colors"
                          style={{
                            borderColor:     isChecked ? C.accent + "60" : C.border,
                            backgroundColor: isChecked ? "rgba(232,99,10,0.05)" : "transparent",
                          }}
                          onClick={() => toggleTable(table)}>
                          <Checkbox checked={isChecked} onCheckedChange={() => toggleTable(table)}
                            className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 pointer-events-none" />
                          <span className="text-[10px] font-mono" style={{ color: C.text }}>{table}</span>
                          {table === "history" && isChecked && (
                            <Calendar className="size-3 ml-auto" style={{ color: C.accent }} />
                          )}
                        </div>

                        {/* History date range */}
                        {table === "history" && isChecked && (
                          <div className="ml-1 pl-3 border-l-2 space-y-1.5 pb-1"
                            style={{ borderColor: C.accent + "40" }}
                            onClick={e => e.stopPropagation()}>
                            <p className="text-[9px]" style={{ color: C.dim }}>Date range filter (optional)</p>
                            <div className="flex items-center gap-1.5">
                              <input type="date" value={historyRange.from}
                                onChange={e => setHistoryRange(r => ({ ...r, from: e.target.value }))}
                                className="flex-1 h-7 px-2 text-[10px] focus:outline-none"
                                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }} />
                              <ChevronRight className="size-3 shrink-0" style={{ color: C.muted }} />
                              <input type="date" value={historyRange.to}
                                onChange={e => setHistoryRange(r => ({ ...r, to: e.target.value }))}
                                className="flex-1 h-7 px-2 text-[10px] focus:outline-none"
                                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }} />
                            </div>
                            {(historyRange.from || historyRange.to) && !(historyRange.from && historyRange.to) && (
                              <p className="text-[9px]" style={{ color: "#f87171" }}>Both dates required, or clear both.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-[9px]" style={{ color: C.muted }}>
                  {selectedTables.size} of {SUPABASE_TABLES.length} Supabase tables selected
                </p>
              </div>

              {/* ── Agent Data Transfer ── */}
              <div className="space-y-3">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent + "80" }}>
                  Agent Data Transfer
                </p>
                <p className="text-[10px]" style={{ color: C.dim }}>
                  Reassign all data records (accounts, activity, history, etc.) from one TSA to another.
                </p>

                <div className="border p-3 space-y-3 transition-colors"
                  style={{ borderColor: agentTransferEnabled ? C.accent + "60" : C.border, backgroundColor: agentTransferEnabled ? "rgba(232,99,10,0.05)" : "transparent" }}>
                  <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setAgentTransferEnabled(v => !v)}>
                    <Checkbox checked={agentTransferEnabled} onCheckedChange={v => setAgentTransferEnabled(!!v)}
                      className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 pointer-events-none" />
                    <span className="text-[11px] font-bold" style={{ color: C.text }}>Transfer Agent Data</span>
                    <span className="text-[9px] ml-auto" style={{ color: C.muted }}>TSA → TSA</span>
                  </div>

                  {agentTransferEnabled && (
                    <div className="space-y-2.5">
                      {tsaLoading ? (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="size-3 animate-spin" style={{ color: C.accent }} />
                          <span className="text-[10px]" style={{ color: C.muted }}>Loading TSA list…</span>
                        </div>
                      ) : (
                        <>
                          {/* From agent */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>
                              From (Source Agent)
                            </label>
                            <Select value={fromAgent} onValueChange={setFromAgent}>
                              <SelectTrigger className="h-8 text-[11px] rounded-none focus:ring-0"
                                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                                <SelectValue placeholder="Select source TSA…" />
                              </SelectTrigger>
                              <SelectContent style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>
                                {tsaList.map(u => (
                                  <SelectItem key={u.value} value={u.value}
                                    className="text-[11px] focus:bg-orange-500/10 focus:text-orange-400"
                                    style={{ color: u.value === toAgent ? C.muted : C.text }}>
                                    {u.label}
                                    {u.value === toAgent && <span className="ml-2 text-[8px]" style={{ color: C.muted }}>(same as To)</span>}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Arrow */}
                          <div className="flex items-center gap-2 px-2">
                            <div className="flex-1 h-px" style={{ backgroundColor: C.border }} />
                            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border"
                              style={{ borderColor: C.accent + "40", color: C.accent, backgroundColor: "rgba(232,99,10,0.08)" }}>
                              <ArrowRightLeft className="size-3" /> Transfer All Data
                            </div>
                            <div className="flex-1 h-px" style={{ backgroundColor: C.border }} />
                          </div>

                          {/* To agent */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>
                              To (Destination Agent)
                            </label>
                            <Select value={toAgent} onValueChange={setToAgent}>
                              <SelectTrigger className="h-8 text-[11px] rounded-none focus:ring-0"
                                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                                <SelectValue placeholder="Select destination TSA…" />
                              </SelectTrigger>
                              <SelectContent style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>
                                {tsaList.map(u => (
                                  <SelectItem key={u.value} value={u.value}
                                    className="text-[11px] focus:bg-orange-500/10 focus:text-orange-400"
                                    style={{ color: u.value === fromAgent ? C.muted : C.text }}>
                                    {u.label}
                                    {u.value === fromAgent && <span className="ml-2 text-[8px]" style={{ color: C.muted }}>(same as From)</span>}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Warning */}
                          {fromAgent && toAgent && fromAgent !== toAgent && (
                            <div className="flex items-start gap-2 px-3 py-2 border"
                              style={{ borderColor: "#fbbf2440", backgroundColor: "rgba(251,191,36,0.05)" }}>
                              <span className="text-[10px] font-bold shrink-0" style={{ color: "#fbbf24" }}>⚠</span>
                              <p className="text-[9px]" style={{ color: "#fbbf24" }}>
                                All records with <span className="font-mono">{fromAgent}</span> as the assigned agent will be
                                reassigned to <span className="font-mono">{toAgent}</span> across the selected tables. This cannot be undone.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actor info */}
              {actorName && (                <div className="flex items-center gap-2 px-3 py-2 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                  <Shield className="size-3 shrink-0" style={{ color: C.dim }} />
                  <p className="text-[9px]" style={{ color: C.dim }}>
                    Acting as <span style={{ color: C.text }}>{actorName}</span>
                    {actorReferenceId && <span style={{ color: C.muted }}> ({actorReferenceId})</span>}
                    {" — "}changes logged to <span className="font-mono" style={{ color: C.accent }}>activity_logs</span>
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Config summary (running/done) ── */}
          {phase !== "config" && (
            <div className="flex flex-wrap gap-3 text-[10px] px-3 py-2 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              {tsmEnabled     && <span style={{ color: C.dim }}>TSM: <span style={{ color: C.text }}>{tsmSelection}</span></span>}
              {managerEnabled && <span style={{ color: C.dim }}>Manager: <span style={{ color: C.text }}>{managerSelection}</span></span>}
              <span style={{ color: C.muted }}>·</span>
              <span style={{ color: C.dim }}>Tables: <span style={{ color: C.text }}>{Array.from(selectedTables).join(", ")}</span></span>
              {historyRange.from && historyRange.to && (
                <><span style={{ color: C.muted }}>·</span>
                <span style={{ color: C.dim }}>History: <span style={{ color: C.text }}>{historyRange.from} → {historyRange.to}</span></span></>
              )}
            </div>
          )}

          {/* ── Terminal ── */}
          {(phase === "running" || phase === "done") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: C.accent + "80" }}>
                  Transfer Log
                  {phase === "running" && <Loader2 className="size-3 animate-spin" style={{ color: C.accent }} />}
                </p>
                {phase === "done" && (
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: C.text }}>
                    {summary.failed === 0
                      ? <CheckCircle2 className="size-3.5" style={{ color: "#34d399" }} />
                      : <XCircle     className="size-3.5" style={{ color: "#f87171" }} />}
                    {summary.succeeded}/{summary.total} completed
                  </span>
                )}
              </div>
              <Terminal entries={logEntries} />
            </div>
          )}

          {/* ── Footer ── */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t" style={{ borderColor: C.border }}>
            {phase === "config" && (
              <>
                <button onClick={() => handleOpenChange(false)} disabled={isLoading}
                  className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={
                    (!tsmEnabled && !managerEnabled && !agentTransferEnabled) ||
                    (tsmEnabled && !tsmSelection) ||
                    (managerEnabled && !managerSelection) ||
                    (agentTransferEnabled && (!fromAgent || !toAgent || fromAgent === toAgent)) ||
                    ((tsmEnabled || managerEnabled) && salesUsers.length === 0)
                  }
                  className="flex items-center gap-1.5 h-8 px-5 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                  style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
                  <ArrowRightLeft className="size-3" />
                  Initiate Transfer
                  {(tsmEnabled || managerEnabled) && salesUsers.length > 0 && (
                    <span className="ml-1 text-[9px] opacity-80">
                      ({salesUsers.length} × {[tsmEnabled, managerEnabled].filter(Boolean).length} field{[tsmEnabled, managerEnabled].filter(Boolean).length > 1 ? "s" : ""})
                    </span>
                  )}
                  {agentTransferEnabled && fromAgent && toAgent && fromAgent !== toAgent && (
                    <span className="ml-1 text-[9px] opacity-80">+ data</span>
                  )}
                </button>
              </>
            )}
            {phase === "running" && (
              <button disabled className="flex items-center gap-1.5 h-8 px-5 text-[10px] font-bold uppercase tracking-wider border opacity-60"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}>
                <Loader2 className="size-3 animate-spin" /> Processing…
              </button>
            )}
            {phase === "done" && (
              <button onClick={() => handleOpenChange(false)}
                className="flex items-center gap-1.5 h-8 px-5 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
                <CheckCircle2 className="size-3" /> Close
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
