"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  limit,
} from "firebase/firestore";

import {
  ArrowRight,
  Search,
  Activity,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Hash,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  Eye,
  DatabaseBackup,
  LogIn,
  LogOut,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

// ─── Types ────────────────────────────────────────────────────────────────────

/** All action types from the customer-audit collection */
type CustomerAuditAction =
  | "transfer"
  | "create"
  | "update"
  | "delete"
  | "autoid";

/** Action types from the activity_logs collection */
type ActivityLogAction = "transfer" | "login" | "logout" | "other";

type AnyAction = CustomerAuditAction | ActivityLogAction;

interface AuditActor {
  uid?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  referenceId?: string | null;
}

interface TransferDetail {
  tsa?: {
    fromId?: string | null;
    fromName?: string | null;
    toId?: string | null;
    toName?: string | null;
  } | null;
  tsm?: { fromName?: string | null; toName?: string | null } | null;
  manager?: { fromName?: string | null; toName?: string | null } | null;
}

/** Unified log entry — handles both Firestore collections */
interface UnifiedLog {
  id: string;
  /** Which Firestore collection this came from */
  source: "customer_audit" | "activity_logs";
  action: AnyAction;
  affectedCount?: number;
  customerId?: string | null;
  customerName?: string | null;
  transfer?: TransferDetail | null;
  changes?: Record<string, { before: unknown; after: unknown }> | null;
  actor?: AuditActor | null;
  timestamp?: Timestamp | null;
  context?: {
    page?: string;
    source?: string;
    bulk?: boolean;
  } | null;
  // activity_logs-specific raw fields
  ReferenceID?: string | null;
  TSM?: string | null;
  Manager?: string | null;
  previousTSM?: string | null;
  previousManager?: string | null;
}

const PAGE_SIZE = 20;

// ─── Action config ─────────────────────────────────────────────────────────────

type ActionCfg = {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
};

const ACTION_CONFIG: Record<string, ActionCfg> = {
  transfer: {
    label: "Transferred",
    icon: <ArrowRight className="h-3 w-3" />,
    color: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800",
  },
  create: {
    label: "Created",
    icon: <Plus className="h-3 w-3" />,
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800",
  },
  update: {
    label: "Updated",
    icon: <Pencil className="h-3 w-3" />,
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800",
  },
  delete: {
    label: "Deleted",
    icon: <Trash2 className="h-3 w-3" />,
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800",
  },
  autoid: {
    label: "Auto-ID",
    icon: <Hash className="h-3 w-3" />,
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800",
  },
  login: {
    label: "Login",
    icon: <LogIn className="h-3 w-3" />,
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800",
  },
  logout: {
    label: "Logout",
    icon: <LogOut className="h-3 w-3" />,
    color: "text-slate-700 dark:text-slate-400",
    bg: "bg-slate-50 border-slate-200 dark:bg-slate-950/40 dark:border-slate-800",
  },
  other: {
    label: "Activity",
    icon: <Activity className="h-3 w-3" />,
    color: "text-zinc-700 dark:text-zinc-400",
    bg: "bg-zinc-50 border-zinc-200 dark:bg-zinc-950/40 dark:border-zinc-800",
  },
};

function getActionCfg(action: string): ActionCfg {
  return ACTION_CONFIG[action] ?? ACTION_CONFIG.other;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(ts: Timestamp | null | undefined): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  }).format(ts.toDate());
}

function timeAgo(ts: Timestamp | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts.toDate().getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avatarColor(str: string | null | undefined): string {
  if (!str) return "from-slate-400 to-slate-600";
  const palette = [
    "from-blue-400 to-blue-600",
    "from-violet-400 to-violet-600",
    "from-emerald-400 to-emerald-600",
    "from-amber-400 to-amber-600",
    "from-rose-400 to-rose-600",
    "from-cyan-400 to-cyan-600",
    "from-fuchsia-400 to-fuchsia-600",
    "from-teal-400 to-teal-600",
  ];
  const hash = str.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

// ─── Transfer pill ─────────────────────────────────────────────────────────────

function TransferPill({ log }: { log: UnifiedLog }) {
  // Unified view of transfer data across both sources
  const tsa = log.transfer?.tsa;
  const tsm = log.transfer?.tsm;
  const manager = log.transfer?.manager;

  // activity_logs source — use PascalCase fields directly
  const activityTSM = log.TSM;
  const activityManager = log.Manager;
  const activityReferenceID = log.ReferenceID;

  if (log.source === "activity_logs") {
    return (
      <div className="space-y-0.5">
        {activityReferenceID && (
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold px-1.5 py-0.5"
            >
              REF
            </Badge>
            <span className="text-xs font-semibold font-mono">
              {activityReferenceID}
            </span>
          </div>
        )}
        {activityTSM && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold px-1.5 py-0.5"
            >
              TSM
            </Badge>
            {log.previousTSM && (
              <>
                <span className="text-xs text-muted-foreground font-mono">
                  {log.previousTSM}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              </>
            )}
            <span className="text-xs font-semibold font-mono">
              {activityTSM}
            </span>
          </div>
        )}
        {activityManager && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold px-1.5 py-0.5"
            >
              MGR
            </Badge>
            {log.previousManager && (
              <>
                <span className="text-xs text-muted-foreground font-mono">
                  {log.previousManager}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              </>
            )}
            <span className="text-xs font-semibold font-mono">
              {activityManager}
            </span>
          </div>
        )}
      </div>
    );
  }

  // customer_audit source
  if (tsa) {
    const extras: string[] = [];
    if (tsm?.toName) extras.push(`TSM → ${tsm.toName}`);
    if (manager?.toName) extras.push(`Mgr → ${manager.toName}`);
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className="text-[10px] font-semibold px-1.5 py-0.5"
          >
            TSA
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">
            {tsa.fromName || tsa.fromId || "—"}
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-xs font-semibold">
            {tsa.toName || tsa.toId || "—"}
          </span>
        </div>
        {extras.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {extras.join(" · ")}
          </p>
        )}
      </div>
    );
  }

  return <span className="text-[10px] text-muted-foreground">—</span>;
}

// ─── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: UnifiedLog["source"] }) {
  if (source === "activity_logs") {
    return (
      <Badge
        variant="outline"
        className="text-[9px] px-1 py-0 border-violet-300 text-violet-600 font-mono"
      >
        activity_logs
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-[9px] px-1 py-0 border-sky-300 text-sky-600 font-mono"
    >
      customer_audit
    </Badge>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomerAuditLogsPage() {
  const router = useRouter();
  const currentUser = useCurrentUser();

  const [customerAuditLogs, setCustomerAuditLogs] = useState<UnifiedLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<UnifiedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<UnifiedLog | null>(null);

  // ── Live Firestore: taskflow_customer_audit_logs ──────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, "taskflow_customer_audit_logs"),
      orderBy("timestamp", "desc"),
      limit(500),
    );
    const unsub = onSnapshot(q, (snap) => {
      const items: UnifiedLog[] = snap.docs.map((d) => ({
        id: d.id,
        source: "customer_audit" as const,
        ...(d.data() as Omit<UnifiedLog, "id" | "source">),
      }));
      setCustomerAuditLogs(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Live Firestore: activity_logs ─────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, "activity_logs"),
      orderBy("date_created", "desc"),
      limit(500),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: UnifiedLog[] = snap.docs.map((d) => {
          const data = d.data();
          // Normalise action — activity_logs stores "status" as the action-like field
          // with values like "transfer", "login", "logout"
          const rawAction = (data.action ?? data.status ?? "other") as string;
          const action: AnyAction =
            rawAction === "transfer"
              ? "transfer"
              : rawAction === "login"
                ? "login"
                : rawAction === "logout"
                  ? "logout"
                  : "other";

          // Build a unified actor from activity_logs fields
          // The collection stores: actorName, actorEmail, actorReferenceID
          // (PascalCase legacy fields: email, userId are also present from login logs)
          const actor: AuditActor = {
            name: data.actorName ?? null,
            email: data.actorEmail ?? data.email ?? null,
            referenceId: data.actorReferenceID ?? data.ReferenceID ?? null,
            uid: data.userId ?? null,
            role: null,
          };

          return {
            id: d.id,
            source: "activity_logs" as const,
            action,
            actor,
            timestamp: data.date_created ?? data.timestamp ?? null,
            // activity_logs PascalCase fields
            ReferenceID: data.ReferenceID ?? null,
            TSM: data.TSM ?? null,
            Manager: data.Manager ?? null,
            previousTSM: data.previousTSM ?? null,
            previousManager: data.previousManager ?? null,
            // customer_audit compat fields — not present, but keep typed
            transfer: null,
            changes: null,
            context: null,
            customerName: data.ReferenceID ?? null,
          } satisfies UnifiedLog;
        });
        setActivityLogs(items);
      },
      (err) => {
        // activity_logs collection may not exist yet — that's fine
        if (err.code !== "not-found") {
          console.warn(
            "[activity_logs] Firestore listener error:",
            err.message,
          );
        }
      },
    );
    return () => unsub();
  }, []);

  // ── Merge + sort both collections ─────────────────────────────────────────
  const allLogs = useMemo<UnifiedLog[]>(() => {
    const merged = [...customerAuditLogs, ...activityLogs];
    return merged.sort((a, b) => {
      const ta = a.timestamp?.toMillis?.() ?? 0;
      const tb = b.timestamp?.toMillis?.() ?? 0;
      return tb - ta;
    });
  }, [customerAuditLogs, activityLogs]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const s = {
      total: allLogs.length,
      transfers: 0,
      creates: 0,
      updates: 0,
      deletes: 0,
      autoids: 0,
      logins: 0,
    };
    for (const l of allLogs) {
      if (l.action === "transfer") s.transfers++;
      else if (l.action === "create") s.creates++;
      else if (l.action === "update") s.updates++;
      else if (l.action === "delete") s.deletes++;
      else if (l.action === "autoid") s.autoids++;
      else if (l.action === "login" || l.action === "logout") s.logins++;
    }
    return s;
  }, [allLogs]);

  // ── Date filter ────────────────────────────────────────────────────────────
  const isWithinDateRange = useCallback(
    (ts: Timestamp | null | undefined) => {
      if (filterDate === "all" || !ts) return true;
      const date = ts.toDate();
      const now = new Date();
      if (filterDate === "today")
        return date.toDateString() === now.toDateString();
      if (filterDate === "week")
        return date >= new Date(now.getTime() - 7 * 86400000);
      if (filterDate === "month")
        return date >= new Date(now.getTime() - 30 * 86400000);
      return true;
    },
    [filterDate],
  );

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allLogs.filter((log) => {
      if (filterAction !== "all" && log.action !== filterAction) return false;
      if (filterSource !== "all" && log.source !== filterSource) return false;
      if (!isWithinDateRange(log.timestamp)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          log.customerName?.toLowerCase().includes(q) ||
          log.customerId?.toLowerCase().includes(q) ||
          log.actor?.name?.toLowerCase().includes(q) ||
          log.actor?.email?.toLowerCase().includes(q) ||
          log.actor?.referenceId?.toLowerCase().includes(q) ||
          log.ReferenceID?.toLowerCase().includes(q) ||
          log.TSM?.toLowerCase().includes(q) ||
          log.Manager?.toLowerCase().includes(q) ||
          log.transfer?.tsa?.fromName?.toLowerCase().includes(q) ||
          log.transfer?.tsa?.toName?.toLowerCase().includes(q) ||
          log.transfer?.tsm?.toName?.toLowerCase().includes(q) ||
          log.transfer?.manager?.toName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    allLogs,
    filterAction,
    filterSource,
    filterDate,
    search,
    isWithinDateRange,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(
    () => setCurrentPage(1),
    [search, filterAction, filterSource, filterDate],
  );

  const clearFilters = () => {
    setSearch("");
    setFilterAction("all");
    setFilterSource("all");
    setFilterDate("all");
  };

  const hasFilters =
    !!search ||
    filterAction !== "all" ||
    filterSource !== "all" ||
    filterDate !== "all";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <ProtectedPageWrapper>
      <TooltipProvider delayDuration={0}>
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
                    <BreadcrumbLink href="#">Customer Database</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Audit Logs</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>

            <main className="p-6 md:p-10 space-y-6">
              {/* Page heading */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Audit Logs
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Real-time activity trail from{" "}
                    <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                      taskflow_customer_audit_logs
                    </span>{" "}
                    +{" "}
                    <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                      activity_logs
                    </span>
                    {!loading && (
                      <>
                        {" "}
                        —{" "}
                        <span className="font-semibold text-foreground">
                          {filtered.length}
                        </span>{" "}
                        events
                      </>
                    )}
                    {/* Current user indicator */}
                    {currentUser.name && (
                      <span className="ml-2 text-muted-foreground">
                        · Viewing as{" "}
                        <span className="font-semibold text-foreground">
                          {currentUser.name}
                        </span>
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                {[
                  {
                    label: "Total",
                    value: stats.total,
                    icon: <Activity className="h-4 w-4" />,
                    color: "text-foreground",
                    bg: "bg-muted/50 border",
                  },
                  {
                    label: "Transferred",
                    value: stats.transfers,
                    icon: <ArrowRight className="h-4 w-4" />,
                    color: ACTION_CONFIG.transfer.color,
                    bg: ACTION_CONFIG.transfer.bg,
                  },
                  {
                    label: "Created",
                    value: stats.creates,
                    icon: <Plus className="h-4 w-4" />,
                    color: ACTION_CONFIG.create.color,
                    bg: ACTION_CONFIG.create.bg,
                  },
                  {
                    label: "Updated",
                    value: stats.updates,
                    icon: <Pencil className="h-4 w-4" />,
                    color: ACTION_CONFIG.update.color,
                    bg: ACTION_CONFIG.update.bg,
                  },
                  {
                    label: "Deleted",
                    value: stats.deletes,
                    icon: <Trash2 className="h-4 w-4" />,
                    color: ACTION_CONFIG.delete.color,
                    bg: ACTION_CONFIG.delete.bg,
                  },
                  {
                    label: "Auto-ID",
                    value: stats.autoids,
                    icon: <Hash className="h-4 w-4" />,
                    color: ACTION_CONFIG.autoid.color,
                    bg: ACTION_CONFIG.autoid.bg,
                  },
                  {
                    label: "Sessions",
                    value: stats.logins,
                    icon: <LogIn className="h-4 w-4" />,
                    color: ACTION_CONFIG.login.color,
                    bg: ACTION_CONFIG.login.bg,
                  },
                ].map((stat) => (
                  <Card key={stat.label} className={cn("border", stat.bg)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-xs font-medium", stat.color)}>
                          {stat.label}
                        </span>
                        <span className={stat.color}>{stat.icon}</span>
                      </div>
                      <p
                        className={cn(
                          "text-2xl font-bold tabular-nums",
                          stat.color,
                        )}
                      >
                        {loading ? "—" : stat.value.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Filter bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9 h-9 text-sm"
                        placeholder="Search by name, email, ReferenceID, TSM…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {search && (
                        <button
                          onClick={() => setSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Source filter */}
                    <Select
                      value={filterSource}
                      onValueChange={setFilterSource}
                    >
                      <SelectTrigger className="h-9 w-[170px] text-xs">
                        <SelectValue placeholder="Source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="customer_audit">
                          customer_audit
                        </SelectItem>
                        <SelectItem value="activity_logs">
                          activity_logs
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Action filter */}
                    <Select
                      value={filterAction}
                      onValueChange={setFilterAction}
                    >
                      <SelectTrigger className="h-9 w-[150px] text-xs">
                        <SelectValue placeholder="Action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="transfer">Transferred</SelectItem>
                        <SelectItem value="create">Created</SelectItem>
                        <SelectItem value="update">Updated</SelectItem>
                        <SelectItem value="delete">Deleted</SelectItem>
                        <SelectItem value="autoid">Auto-ID</SelectItem>
                        <SelectItem value="login">Login</SelectItem>
                        <SelectItem value="logout">Logout</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Date filter */}
                    <Select value={filterDate} onValueChange={setFilterDate}>
                      <SelectTrigger className="h-9 w-[140px] text-xs">
                        <SelectValue placeholder="Date Range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">Last 7 Days</SelectItem>
                        <SelectItem value="month">Last 30 Days</SelectItem>
                      </SelectContent>
                    </Select>

                    {hasFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 gap-2 text-xs text-muted-foreground"
                        onClick={clearFilters}
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear
                      </Button>
                    )}

                    <span className="ml-auto text-xs text-muted-foreground">
                      {loading ? "Loading…" : `${filtered.length} events`}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[200px]">
                            Actor
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[120px]">
                            Action
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Subject / Detail
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[170px]">
                            Time
                          </th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[60px]">
                            View
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {loading ? (
                          Array.from({ length: 8 }).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                              {Array.from({ length: 5 }).map((_, j) => (
                                <td key={j} className="px-4 py-3">
                                  <div className="h-4 bg-muted rounded w-full" />
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : paginated.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-16">
                              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                <DatabaseBackup className="h-10 w-10 opacity-20" />
                                <p className="text-sm font-medium">
                                  No logs found
                                </p>
                                {hasFilters && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={clearFilters}
                                    className="text-xs"
                                  >
                                    Clear filters
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          paginated.map((log) => {
                            const cfg = getActionCfg(log.action);
                            const isBulk =
                              log.context?.bulk || (log.affectedCount ?? 0) > 1;
                            const actorDisplay =
                              log.actor?.name ||
                              log.actor?.email ||
                              log.actor?.referenceId ||
                              "Unknown";

                            return (
                              <tr
                                key={`${log.source}-${log.id}`}
                                className="hover:bg-muted/30 transition-colors"
                              >
                                {/* Actor */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className={cn(
                                        "w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold",
                                        avatarColor(
                                          log.actor?.name || log.actor?.email,
                                        ),
                                      )}
                                    >
                                      {getInitials(
                                        log.actor?.name || log.actor?.email,
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold truncate leading-tight">
                                        {actorDisplay}
                                      </p>
                                      {log.actor?.email &&
                                        log.actor.email !== actorDisplay && (
                                          <p className="text-[10px] text-muted-foreground truncate leading-tight">
                                            {log.actor.email}
                                          </p>
                                        )}
                                      <SourceBadge source={log.source} />
                                    </div>
                                  </div>
                                </td>

                                {/* Action */}
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-1">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "gap-1 text-[11px] font-semibold border w-fit",
                                        cfg.bg,
                                        cfg.color,
                                      )}
                                    >
                                      {cfg.icon}
                                      {cfg.label}
                                    </Badge>
                                    {isBulk && (
                                      <span className="text-[10px] text-muted-foreground font-medium">
                                        Bulk · {log.affectedCount ?? "?"}{" "}
                                        records
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Subject / detail */}
                                <td className="px-4 py-3">
                                  {log.action === "transfer" ? (
                                    <TransferPill log={log} />
                                  ) : log.action === "update" && log.changes ? (
                                    <div className="min-w-0">
                                      {log.customerName && (
                                        <p className="text-xs font-medium truncate uppercase mb-0.5">
                                          {log.customerName}
                                        </p>
                                      )}
                                      <p className="text-[10px] text-muted-foreground">
                                        {Object.keys(log.changes).join(", ")}{" "}
                                        changed
                                      </p>
                                    </div>
                                  ) : log.customerName ? (
                                    <p className="text-xs font-medium uppercase truncate max-w-[200px]">
                                      {log.customerName}
                                    </p>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </td>

                                {/* Time */}
                                <td className="px-4 py-3">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="cursor-default">
                                        <p className="text-xs font-medium">
                                          {timeAgo(log.timestamp)}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                          {formatTimestamp(log.timestamp)}
                                        </p>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">
                                        {formatTimestamp(log.timestamp)}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </td>

                                {/* View */}
                                <td className="px-4 py-3 text-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setSelectedLog(log)}
                                  >
                                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {!loading && filtered.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                      <p className="text-xs text-muted-foreground">
                        Showing{" "}
                        <span className="font-medium text-foreground">
                          {(currentPage - 1) * PAGE_SIZE + 1}–
                          {Math.min(currentPage * PAGE_SIZE, filtered.length)}
                        </span>{" "}
                        of{" "}
                        <span className="font-medium text-foreground">
                          {filtered.length}
                        </span>{" "}
                        events
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => p - 1)}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            let p: number;
                            if (totalPages <= 5) p = i + 1;
                            else if (currentPage <= 3) p = i + 1;
                            else if (currentPage >= totalPages - 2)
                              p = totalPages - 4 + i;
                            else p = currentPage - 2 + i;
                            return (
                              <Button
                                key={p}
                                variant={
                                  currentPage === p ? "default" : "outline"
                                }
                                size="icon"
                                className="h-7 w-7 text-xs"
                                onClick={() => setCurrentPage(p)}
                              >
                                {p}
                              </Button>
                            );
                          },
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => p + 1)}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </main>
          </SidebarInset>
        </SidebarProvider>

        {/* ── Detail dialog ────────────────────────────────────────────────── */}
        {selectedLog && (
          <Dialog
            open={!!selectedLog}
            onOpenChange={() => setSelectedLog(null)}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <DatabaseBackup className="h-4 w-4 text-primary" />
                  Log Detail
                  <SourceBadge source={selectedLog.source} />
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Action */}
                {(() => {
                  const cfg = getActionCfg(selectedLog.action);
                  return (
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 text-xs font-semibold border",
                        cfg.bg,
                        cfg.color,
                      )}
                    >
                      {cfg.icon}
                      {cfg.label}
                      {selectedLog.context?.bulk && (
                        <span className="ml-1 opacity-70">
                          · Bulk ({selectedLog.affectedCount ?? "?"} records)
                        </span>
                      )}
                    </Badge>
                  );
                })()}

                {/* Actor */}
                <div className="p-3 rounded-lg bg-muted/40 border space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Actor
                  </p>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold",
                        avatarColor(
                          selectedLog.actor?.name || selectedLog.actor?.email,
                        ),
                      )}
                    >
                      {getInitials(
                        selectedLog.actor?.name || selectedLog.actor?.email,
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {selectedLog.actor?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedLog.actor?.email || "No email"}
                      </p>
                      {selectedLog.actor?.referenceId && (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {selectedLog.actor.referenceId}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Transfer detail — activity_logs source */}
                {selectedLog.source === "activity_logs" &&
                  selectedLog.action === "transfer" && (
                    <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                        Transfer Detail
                      </p>
                      <div className="space-y-2 text-xs">
                        {selectedLog.ReferenceID && (
                          <div>
                            <span className="text-muted-foreground">
                              ReferenceID:{" "}
                            </span>
                            <span className="font-mono font-semibold">
                              {selectedLog.ReferenceID}
                            </span>
                          </div>
                        )}
                        {selectedLog.TSM && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-16 shrink-0">
                              TSM
                            </span>
                            {selectedLog.previousTSM && (
                              <>
                                <span className="font-mono text-muted-foreground">
                                  {selectedLog.previousTSM}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              </>
                            )}
                            <span className="font-mono font-semibold">
                              {selectedLog.TSM}
                            </span>
                          </div>
                        )}
                        {selectedLog.Manager && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-16 shrink-0">
                              Manager
                            </span>
                            {selectedLog.previousManager && (
                              <>
                                <span className="font-mono text-muted-foreground">
                                  {selectedLog.previousManager}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              </>
                            )}
                            <span className="font-mono font-semibold">
                              {selectedLog.Manager}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {/* Transfer detail — customer_audit source */}
                {selectedLog.source === "customer_audit" &&
                  selectedLog.action === "transfer" &&
                  selectedLog.transfer && (
                    <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                        Transfer Detail
                      </p>
                      <TransferPill log={selectedLog} />
                    </div>
                  )}

                {/* Field changes for update */}
                {selectedLog.action === "update" &&
                  selectedLog.changes &&
                  Object.keys(selectedLog.changes).length > 0 && (
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Changes
                      </p>
                      <div className="space-y-2">
                        {Object.entries(selectedLog.changes).map(
                          ([field, { before, after }]) => (
                            <div
                              key={field}
                              className="grid grid-cols-[120px_1fr_1fr] gap-2 items-start text-xs"
                            >
                              <span className="font-medium text-muted-foreground capitalize">
                                {field.replace(/_/g, " ")}
                              </span>
                              <span className="line-through text-muted-foreground truncate">
                                {String(before ?? "—")}
                              </span>
                              <span className="font-semibold truncate">
                                {String(after ?? "—")}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                {/* Timestamp */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Logged at</span>
                  <span className="font-semibold text-foreground">
                    {formatTimestamp(selectedLog.timestamp)}
                  </span>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </TooltipProvider>
    </ProtectedPageWrapper>
  );
}
