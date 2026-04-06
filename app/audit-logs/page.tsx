"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { exportAuditLogsToPDF } from "@/lib/utils/audit-pdf-export";
import { exportAuditLogsToCSV } from "@/lib/utils/audit-csv-export";
import { FileDown, FileSpreadsheet, Calendar as CalendarIcon, Users, Layers } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

/** All action types from the customer-audit collection */
type CustomerAuditAction =
  | "transfer"
  | "create"
  | "update"
  | "delete"
  | "autoid";

/** Action types from system audits */
type SystemAuditAction =
  | "assign"
  | "approve"
  | "reject"
  | "lock"
  | "unlock"
  | "reset_password"
  | "change_role"
  | "change_status"
  | "bulk_create"
  | "bulk_update"
  | "bulk_delete"
  | "export"
  | "import"
  | "view";

/** Action types from the activity_logs collection */
type ActivityLogAction = "transfer" | "login" | "logout" | "other";

/** Action types from audit_trails collection */
type AuditTrailAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "view"
  | "export"
  | "import"
  | "assign"
  | "transfer"
  | "approve"
  | "reject"
  | "other";

type AnyAction = CustomerAuditAction | ActivityLogAction | SystemAuditAction | AuditTrailAction;

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
  source: "customer_audit" | "activity_logs" | "system_audit" | "audit_trails";
  action: AnyAction;
  affectedCount?: number;
  customerId?: string | null;
  customerName?: string | null;
  resourceId?: string | null;
  resourceName?: string | null;
  resourceType?: string | null;
  module?: string | null;
  page?: string | null;
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
  // system audit fields
  metadata?: Record<string, unknown> | null;
  // audit_trails-specific fields
  details?: string | null;
  message?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  entityName?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  department?: string | null;
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
  if (source === "system_audit") {
    return (
      <Badge
        variant="outline"
        className="text-[9px] px-1 py-0 border-amber-300 text-amber-600 font-mono"
      >
        system_audit
      </Badge>
    );
  }
  if (source === "audit_trails") {
    return (
      <Badge
        variant="outline"
        className="text-[9px] px-1 py-0 border-pink-300 text-pink-600 font-mono"
      >
        audit_trails
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
  const [systemAuditLogs, setSystemAuditLogs] = useState<UnifiedLog[]>([]);
  const [auditTrailLogs, setAuditTrailLogs] = useState<UnifiedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [filterActor, setFilterActor] = useState<string>("all");
  const [filterModule, setFilterModule] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<UnifiedLog | null>(null);
  const [activeView, setActiveView] = useState<"logs" | "analytics">("logs");
  
  // ── Bulk Selection ───────────────────────────────────────────────────────
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [newLogsCount, setNewLogsCount] = useState(0);
  const lastViewedTimestamp = useRef<number>(Date.now());

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
      
      // Count new logs since last view
      const newCount = items.filter(
        (item) => (item.timestamp?.toMillis?.() || 0) > lastViewedTimestamp.current
      ).length;
      if (newCount > 0) {
        setNewLogsCount((prev) => prev + newCount);
      }
      
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

  // ── Live Firestore: audit_trails ─────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, "audit_trails"),
      orderBy("timestamp", "desc"),
      limit(500),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: UnifiedLog[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            source: "audit_trails" as const,
            action: (data.action ?? "other") as AnyAction,
            actor: {
              name: data.fullName ?? `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim() ?? null,
              email: data.email ?? null,
              referenceId: data.referenceId ?? null,
              role: data.role ?? null,
              uid: null,
            },
            timestamp: data.timestamp ?? data.createdAt ?? null,
            changes: data.changes ?? null,
            details: data.details ?? null,
            message: data.message ?? null,
            ipAddress: data.ipAddress ?? null,
            userAgent: data.userAgent ?? null,
            entityName: data.entityname ?? data.entityName ?? null,
            entityId: data.entityId ?? null,
            entityType: data.entityType ?? null,
            department: data.department ?? null,
          } satisfies UnifiedLog;
        });
        setAuditTrailLogs(items);
      },
      (err) => {
        if (err.code !== "not-found") {
          console.warn("[audit_trails] Firestore listener error:", err.message);
        }
      },
    );
    return () => unsub();
  }, []);

  // ── Live Firestore: systemAudits ─────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, "systemAudits"),
      orderBy("timestamp", "desc"),
      limit(500),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: UnifiedLog[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            source: "system_audit" as const,
            action: (data.action ?? "other") as AnyAction,
            resourceId: data.resourceId ?? null,
            resourceName: data.resourceName ?? null,
            resourceType: data.resourceType ?? null,
            module: data.module ?? null,
            page: data.page ?? null,
            actor: {
              uid: data.actorUid ?? null,
              name: data.actorName ?? null,
              email: data.actorEmail ?? null,
              role: data.actorRole ?? null,
              referenceId: data.actorReferenceId ?? null,
            },
            timestamp: data.timestamp ?? null,
            affectedCount: data.affectedCount ?? 1,
            changes: data.changes ?? null,
            transfer: data.transfer ?? null,
            metadata: data.metadata ?? null,
            context: {
              source: data.source ?? null,
              page: data.page ?? null,
            },
          } satisfies UnifiedLog;
        });
        setSystemAuditLogs(items);
      },
      (err) => {
        // systemAudits collection may not exist yet — that's fine
        if (err.code !== "not-found") {
          console.warn(
            "[systemAudits] Firestore listener error:",
            err.message,
          );
        }
      },
    );
    return () => unsub();
  }, []);

  // ── Merge + sort all collections ─────────────────────────────────────────
  const allLogs = useMemo<UnifiedLog[]>(() => {
    const merged = [...customerAuditLogs, ...activityLogs, ...systemAuditLogs, ...auditTrailLogs];
    return merged.sort((a, b) => {
      const ta = a.timestamp?.toMillis?.() ?? 0;
      const tb = b.timestamp?.toMillis?.() ?? 0;
      return tb - ta;
    });
  }, [customerAuditLogs, activityLogs, systemAuditLogs, auditTrailLogs]);

  // ── Unique actors and modules for filter dropdowns ───────────────────────
  const uniqueActors = useMemo(() => {
    const actors = new Map<string, { name: string; email: string }>();
    allLogs.forEach((log) => {
      const key = log.actor?.email || log.actor?.name || "unknown";
      if (key !== "unknown" && !actors.has(key)) {
        actors.set(key, {
          name: log.actor?.name || "Unknown",
          email: log.actor?.email || "",
        });
      }
    });
    return Array.from(actors.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [allLogs]);

  const uniqueModules = useMemo(() => {
    const modules = new Set<string>();
    allLogs.forEach((log) => {
      if (log.module) modules.add(log.module);
    });
    return Array.from(modules).sort();
  }, [allLogs]);

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
      if (!ts) return true;
      const date = ts.toDate();

      // Custom date range picker takes priority
      if (dateRange.from || dateRange.to) {
        const from = dateRange.from ? new Date(dateRange.from.setHours(0, 0, 0, 0)) : null;
        const to = dateRange.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : null;

        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      }

      // Preset filters
      if (filterDate === "all") return true;
      const now = new Date();
      if (filterDate === "today")
        return date.toDateString() === now.toDateString();
      if (filterDate === "week")
        return date >= new Date(now.getTime() - 7 * 86400000);
      if (filterDate === "month")
        return date >= new Date(now.getTime() - 30 * 86400000);
      return true;
    },
    [filterDate, dateRange],
  );

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allLogs.filter((log) => {
      if (filterAction !== "all" && log.action !== filterAction) return false;
      if (filterSource !== "all" && log.source !== filterSource) return false;
      if (filterActor !== "all") {
        const actorKey = log.actor?.email || log.actor?.name || "unknown";
        if (actorKey !== filterActor) return false;
      }
      if (filterModule !== "all" && log.module !== filterModule) return false;
      if (!isWithinDateRange(log.timestamp)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          log.customerName?.toLowerCase().includes(q) ||
          log.resourceName?.toLowerCase().includes(q) ||
          log.customerId?.toLowerCase().includes(q) ||
          log.resourceId?.toLowerCase().includes(q) ||
          log.actor?.name?.toLowerCase().includes(q) ||
          log.actor?.email?.toLowerCase().includes(q) ||
          log.actor?.referenceId?.toLowerCase().includes(q) ||
          log.module?.toLowerCase().includes(q) ||
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
    filterActor,
    filterModule,
    filterDate,
    dateRange,
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
    [search, filterAction, filterSource, filterDate, filterActor, filterModule, dateRange],
  );

  // ── Bulk Selection Handlers ──────────────────────────────────────────────
  const toggleLogSelection = (logId: string) => {
    setSelectedLogs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const selectAllVisible = () => {
    const visibleIds = paginated.map((log) => `${log.source}-${log.id}`);
    setSelectedLogs((prev) => {
      const newSet = new Set(prev);
      visibleIds.forEach((id) => newSet.add(id));
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedLogs(new Set());
  };

  const exportSelectedLogs = () => {
    const selected = filtered.filter((log) =>
      selectedLogs.has(`${log.source}-${log.id}`)
    );
    exportAuditLogsToCSV(selected);
  };

  const clearNewLogsBadge = () => {
    setNewLogsCount(0);
    lastViewedTimestamp.current = Date.now();
  };

  const clearFilters = () => {
    setSearch("");
    setFilterAction("all");
    setFilterSource("all");
    setFilterDate("all");
    setFilterActor("all");
    setFilterModule("all");
    setDateRange({ from: undefined, to: undefined });
    setSelectedLogs(new Set());
  };

  // ── Analytics Data ────────────────────────────────────────────────────────
  const analyticsData = useMemo(() => {
    // Actions per day (last 30 days)
    const actionsPerDay: Record<string, number> = {};
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      actionsPerDay[dateStr] = 0;
    }

    // Top actors
    const actorCounts: Record<string, { name: string; count: number }> = {};

    // Action distribution
    const actionCounts: Record<string, number> = {};

    // Hourly activity (0-23)
    const hourlyActivity: number[] = new Array(24).fill(0);

    filtered.forEach((log) => {
      // Actions per day
      if (log.timestamp?.toDate) {
        const dateStr = log.timestamp.toDate().toISOString().split("T")[0];
        if (actionsPerDay[dateStr] !== undefined) {
          actionsPerDay[dateStr]++;
        }

        // Hourly activity
        const hour = log.timestamp.toDate().getHours();
        hourlyActivity[hour]++;
      }

      // Actor counts
      const actorKey = log.actor?.email || log.actor?.name || "Unknown";
      if (!actorCounts[actorKey]) {
        actorCounts[actorKey] = { name: log.actor?.name || actorKey, count: 0 };
      }
      actorCounts[actorKey].count++;

      // Action counts
      const action = log.action || "other";
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    });

    // Convert to arrays for charts
    const actionsPerDayArray = Object.entries(actionsPerDay).map(([date, count]) => ({
      date: format(new Date(date), "MMM dd"),
      fullDate: date,
      count,
    }));

    const topActorsArray = Object.entries(actorCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([key, data]) => ({
        name: data.name,
        count: data.count,
      }));

    const actionDistributionArray = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([action, count]) => ({
        action,
        label: ACTION_CONFIG[action]?.label || action,
        count,
        color: ACTION_CONFIG[action]?.color || "text-gray-500",
      }));

    const hourlyActivityArray = hourlyActivity.map((count, hour) => ({
      hour: `${hour}:00`,
      hour12: hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`,
      count,
    }));

    return {
      actionsPerDay: actionsPerDayArray,
      topActors: topActorsArray,
      actionDistribution: actionDistributionArray,
      hourlyActivity: hourlyActivityArray,
    };
  }, [filtered]);

  const hasFilters =
    !!search ||
    filterAction !== "all" ||
    filterSource !== "all" ||
    filterDate !== "all" ||
    filterActor !== "all" ||
    filterModule !== "all" ||
    dateRange.from ||
    dateRange.to;

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
                    <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
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
                    </span>{" "}
                    +{" "}
                    <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                      systemAudits
                    </span>{" "}
                    +{" "}
                    <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                      audit_trails
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
                <div className="flex items-center gap-2">
                  {/* New Logs Badge */}
                  {newLogsCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-xs bg-primary/10 border-primary/30"
                      onClick={clearNewLogsBadge}
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      {newLogsCount} new
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => exportAuditLogsToCSV(filtered)}
                    disabled={filtered.length === 0}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => exportAuditLogsToPDF(filtered)}
                    disabled={filtered.length === 0}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Export PDF
                  </Button>
                </div>
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

              {/* View Tabs */}
              <div className="flex items-center gap-2 border-b">
                <button
                  onClick={() => setActiveView("logs")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                    activeView === "logs"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <DatabaseBackup className="inline-block mr-2 h-4 w-4" />
                  Logs
                </button>
                <button
                  onClick={() => setActiveView("analytics")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                    activeView === "analytics"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Activity className="inline-block mr-2 h-4 w-4" />
                  Analytics
                </button>
              </div>

              {/* Bulk Selection Bar */}
              {activeView === "logs" && selectedLogs.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-primary/5 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {selectedLogs.size} log{selectedLogs.size > 1 ? "s" : ""} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={selectAllVisible}
                    >
                      Select all visible
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={clearSelection}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={exportSelectedLogs}
                    >
                      <FileSpreadsheet className="h-3 w-3" />
                      Export Selected
                    </Button>
                  </div>
                </div>
              )}

              {activeView === "logs" ? (
                <>
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
                        <SelectItem value="system_audit">
                          system_audit
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

                    {/* Date Range Picker */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 w-[240px] justify-start text-left font-normal text-xs",
                            !dateRange.from && !dateRange.to && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {dateRange.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                {format(dateRange.to, "LLL dd, y")}
                              </>
                            ) : (
                              format(dateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick a date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange.from}
                          selected={{
                            from: dateRange.from,
                            to: dateRange.to,
                          }}
                          onSelect={(range) => {
                            setDateRange({
                              from: range?.from,
                              to: range?.to,
                            });
                          }}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>

                    {/* Actor filter */}
                    {uniqueActors.length > 0 && (
                      <Select
                        value={filterActor}
                        onValueChange={setFilterActor}
                      >
                        <SelectTrigger className="h-9 w-[180px] text-xs">
                          <Users className="mr-2 h-3 w-3" />
                          <SelectValue placeholder="Actor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Actors</SelectItem>
                          {uniqueActors.map(([key, actor]) => (
                            <SelectItem key={key} value={key}>
                              {actor.name}
                              {actor.email && actor.email !== actor.name && (
                                <span className="ml-1 text-muted-foreground">({actor.email})</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Module filter */}
                    {uniqueModules.length > 0 && (
                      <Select
                        value={filterModule}
                        onValueChange={setFilterModule}
                      >
                        <SelectTrigger className="h-9 w-[180px] text-xs">
                          <Layers className="mr-2 h-3 w-3" />
                          <SelectValue placeholder="Module" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Modules</SelectItem>
                          {uniqueModules.map((module) => (
                            <SelectItem key={module} value={module}>
                              {module}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

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
                          <th className="px-4 py-3 w-[40px]">
                            <input
                              type="checkbox"
                              checked={paginated.length > 0 && paginated.every(log => selectedLogs.has(`${log.source}-${log.id}`))}
                              onChange={() => {
                                if (paginated.every(log => selectedLogs.has(`${log.source}-${log.id}`))) {
                                  // Deselect all visible
                                  setSelectedLogs(prev => {
                                    const newSet = new Set(prev);
                                    paginated.forEach(log => newSet.delete(`${log.source}-${log.id}`));
                                    return newSet;
                                  });
                                } else {
                                  selectAllVisible();
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </th>
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
                            <td colSpan={6} className="text-center py-16">
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
                                className={cn(
                                  "hover:bg-muted/30 transition-colors",
                                  selectedLogs.has(`${log.source}-${log.id}`) && "bg-primary/5"
                                )}
                              >
                                {/* Checkbox */}
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedLogs.has(`${log.source}-${log.id}`)}
                                    onChange={() => toggleLogSelection(`${log.source}-${log.id}`)}
                                    className="h-4 w-4 rounded border-gray-300"
                                  />
                                </td>
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
                                      {(log.customerName || log.resourceName) && (
                                        <p className="text-xs font-medium truncate uppercase mb-0.5">
                                          {log.customerName || log.resourceName}
                                        </p>
                                      )}
                                      <p className="text-[10px] text-muted-foreground">
                                        {Object.keys(log.changes).join(", ")}{" "}
                                        changed
                                      </p>
                                    </div>
                                  ) : log.source === "system_audit" && log.resourceName ? (
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium truncate uppercase mb-0.5">
                                        {log.resourceName}
                                      </p>
                                      {log.module && (
                                        <p className="text-[10px] text-muted-foreground">
                                          Module: {log.module}
                                        </p>
                                      )}
                                    </div>
                                  ) : log.source === "audit_trails" && (log.message || log.details) ? (
                                    <div className="min-w-0">
                                      {log.message && (
                                        <p className="text-xs truncate max-w-[250px]">
                                          {log.message}
                                        </p>
                                      )}
                                      {log.details && (
                                        <p className="text-[10px] text-muted-foreground truncate max-w-[250px]">
                                          {log.details}
                                        </p>
                                      )}
                                      {log.entityName && (
                                        <p className="text-[10px] text-pink-600 truncate">
                                          {log.entityName}
                                        </p>
                                      )}
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
                </>
              ) : (
                /* Analytics Dashboard */
                <div className="space-y-6">
                  {/* Actions per Day Chart */}
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-4">Activity Timeline (Last 30 Days)</h3>
                      <div className="h-[250px] w-full">
                        {analyticsData.actionsPerDay.length > 0 ? (
                          <div className="flex items-end justify-between h-full gap-1">
                            {analyticsData.actionsPerDay.map((day, idx) => {
                              const maxCount = Math.max(...analyticsData.actionsPerDay.map(d => d.count), 1);
                              const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                              return (
                                <div key={day.fullDate} className="flex-1 flex flex-col items-center gap-1">
                                  <div
                                    className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors relative group"
                                    style={{ height: `${height}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                                  >
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                                      {day.date}: {day.count} actions
                                    </div>
                                  </div>
                                  {idx % 5 === 0 && (
                                    <span className="text-[10px] text-muted-foreground rotate-45 origin-left translate-y-2">
                                      {day.date}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            No data available
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Top Actors */}
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Top 10 Most Active Users</h3>
                        <div className="space-y-3">
                          {analyticsData.topActors.length > 0 ? (
                            analyticsData.topActors.map((actor, idx) => {
                              const maxCount = analyticsData.topActors[0]?.count || 1;
                              const width = (actor.count / maxCount) * 100;
                              return (
                                <div key={actor.name} className="flex items-center gap-3">
                                  <span className="text-sm font-medium w-6 text-muted-foreground">{idx + 1}</span>
                                  <div className="flex-1">
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="font-medium truncate">{actor.name}</span>
                                      <span className="text-muted-foreground">{actor.count}</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-primary rounded-full"
                                        style={{ width: `${width}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-center text-muted-foreground py-8">
                              No data available
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Action Distribution */}
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Action Distribution</h3>
                        <div className="space-y-3">
                          {analyticsData.actionDistribution.length > 0 ? (
                            analyticsData.actionDistribution.map((item) => {
                              const maxCount = analyticsData.actionDistribution[0]?.count || 1;
                              const width = (item.count / maxCount) * 100;
                              return (
                                <div key={item.action} className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="font-medium flex items-center gap-2">
                                        <span className={item.color}>●</span>
                                        {item.label}
                                      </span>
                                      <span className="text-muted-foreground">{item.count}</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className={cn("h-full rounded-full", item.color.replace("text-", "bg-").replace("700", "500").replace("400", "500"))}
                                        style={{ width: `${width}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-center text-muted-foreground py-8">
                              No data available
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Hourly Activity Heatmap */}
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-4">Activity by Hour of Day</h3>
                      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-24 gap-1">
                        {analyticsData.hourlyActivity.map((hour) => {
                          const maxCount = Math.max(...analyticsData.hourlyActivity.map(h => h.count), 1);
                          const intensity = maxCount > 0 ? hour.count / maxCount : 0;
                          const bgOpacity = Math.max(0.1, intensity);
                          return (
                            <div
                              key={hour.hour}
                              className="aspect-square rounded flex items-center justify-center text-xs relative group cursor-pointer"
                              style={{ backgroundColor: `rgba(59, 130, 246, ${bgOpacity})` }}
                            >
                              <span className={intensity > 0.5 ? "text-white" : "text-foreground"}>
                                {hour.hour12}
                              </span>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                                {hour.hour12}: {hour.count} actions
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                        <span>Less active</span>
                        <div className="flex gap-1">
                          {[0.1, 0.3, 0.5, 0.7, 0.9].map((opacity) => (
                            <div
                              key={opacity}
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: `rgba(59, 130, 246, ${opacity})` }}
                            />
                          ))}
                        </div>
                        <span>More active</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
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

                {/* System Audit Details */}
                {selectedLog.source === "system_audit" && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      System Audit Details
                    </p>
                    <div className="space-y-1 text-xs">
                      {selectedLog.module && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Module:</span>
                          <span className="font-medium">{selectedLog.module}</span>
                        </div>
                      )}
                      {selectedLog.page && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Page:</span>
                          <span className="font-medium">{selectedLog.page}</span>
                        </div>
                      )}
                      {selectedLog.resourceType && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Resource Type:</span>
                          <span className="font-medium">{selectedLog.resourceType}</span>
                        </div>
                      )}
                      {selectedLog.resourceId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Resource ID:</span>
                          <span className="font-mono">{selectedLog.resourceId}</span>
                        </div>
                      )}
                      {selectedLog.affectedCount && selectedLog.affectedCount > 1 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Affected Count:</span>
                          <span className="font-medium">{selectedLog.affectedCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Audit Trails Details */}
                {selectedLog.source === "audit_trails" && (
                  <div className="p-3 rounded-lg bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-pink-600 dark:text-pink-400">
                      Audit Trail Details
                    </p>
                    <div className="space-y-1 text-xs">
                      {selectedLog.department && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Department:</span>
                          <span className="font-medium">{selectedLog.department}</span>
                        </div>
                      )}
                      {selectedLog.entityName && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Entity Name:</span>
                          <span className="font-medium">{selectedLog.entityName}</span>
                        </div>
                      )}
                      {selectedLog.entityId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Entity ID:</span>
                          <span className="font-mono">{selectedLog.entityId}</span>
                        </div>
                      )}
                      {selectedLog.entityType && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Entity Type:</span>
                          <span className="font-medium">{selectedLog.entityType}</span>
                        </div>
                      )}
                      {selectedLog.details && (
                        <div className="pt-1 border-t border-pink-200 dark:border-pink-800">
                          <span className="text-muted-foreground block mb-1">Details:</span>
                          <span className="text-xs">{selectedLog.details}</span>
                        </div>
                      )}
                      {selectedLog.message && (
                        <div className="pt-1 border-t border-pink-200 dark:border-pink-800">
                          <span className="text-muted-foreground block mb-1">Message:</span>
                          <span className="text-xs">{selectedLog.message}</span>
                        </div>
                      )}
                      {selectedLog.ipAddress && (
                        <div className="flex justify-between pt-1 border-t border-pink-200 dark:border-pink-800">
                          <span className="text-muted-foreground">IP Address:</span>
                          <span className="font-mono text-[10px]">{selectedLog.ipAddress}</span>
                        </div>
                      )}
                      {selectedLog.userAgent && (
                        <div className="pt-1">
                          <span className="text-muted-foreground block mb-1">User Agent:</span>
                          <span className="text-[10px] text-muted-foreground break-all">{selectedLog.userAgent}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata for system_audit */}
                {selectedLog.source === "system_audit" && selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Metadata
                    </p>
                    <div className="space-y-1 text-xs">
                      {Object.entries(selectedLog.metadata).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{key}:</span>
                          <span className="font-mono truncate max-w-[200px]">
                            {typeof value === "object" ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
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
