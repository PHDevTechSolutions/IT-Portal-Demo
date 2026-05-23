"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { AppSidebar } from "@/components/app-sidebar";
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
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Check,
  X,
  Database,
  UserPlus,
  Activity,
  TrendingUp,
  History,
  CheckCircle,
  AlertTriangle,
  Info,
  ListTodo,
} from "lucide-react";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { DashboardDataProvider } from "@/contexts/DashboardDataContext";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { useNotifications } from "@/contexts/NotificationContext";

interface Customer {
  id: string;
  company_name?: string;
  contact_person?: string;
  date_created?: string;
}

interface TaskNotification {
  id: string;
  title: string;
  priority: string;
  dueDate: string;
  type: string;
  category: string;
  message: string;
  createdAt: string;
  read: boolean;
  isTaskReminder: boolean;
}

// ─── Icon maps ────────────────────────────────────────────────────────────────

const categoryIcons: Record<string, React.ReactNode> = {
  backup:   <Database  className="h-4 w-4" />,
  customer: <UserPlus  className="h-4 w-4" />,
  activity: <Activity  className="h-4 w-4" />,
  progress: <TrendingUp className="h-4 w-4" />,
  taskflow: <History   className="h-4 w-4" />,
  system:   <Info      className="h-4 w-4" />,
  task:     <ListTodo  className="h-4 w-4" />,
  transfer: <AlertTriangle className="h-4 w-4" />,
};

const typeIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle  className="h-3.5 w-3.5 text-emerald-400" />,
  error:   <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />,
  info:    <Info          className="h-3.5 w-3.5 text-orange-300" />,
};

// Left-border + subtle bg per type — kept semantic, accent shifted to orange family
const typeColors: Record<string, string> = {
  success: "border-l-emerald-500 bg-emerald-500/5",
  error:   "border-l-red-500    bg-red-500/5",
  warning: "border-l-orange-500 bg-orange-500/5",
  info:    "border-l-orange-400 bg-orange-400/5",
};

// ─── Scan line ────────────────────────────────────────────────────────────────

function ScanLine() {
  return (
    <>
      <style>{`
        @keyframes scanline {
          0%   { top: 0%;   opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
      <div
        className="pointer-events-none absolute left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent"
        style={{ animation: "scanline 8s linear infinite", top: 0 }}
      />
    </>
  );
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ active = true }: { active?: boolean }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${
        active
          ? "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]"
          : "bg-slate-600"
      }`}
    />
  );
}

// ─── Corner brackets ──────────────────────────────────────────────────────────

function CornerBrackets({ color = "orange" }: { color?: "orange" | "slate" }) {
  const cls =
    color === "orange" ? "border-orange-500/40" : "border-slate-700/60";
  return (
    <>
      <div className={`absolute top-0 left-0  w-3 h-3 border-l border-t ${cls}`} />
      <div className={`absolute top-0 right-0 w-3 h-3 border-r border-t ${cls}`} />
      <div className={`absolute bottom-0 left-0  w-3 h-3 border-l border-b ${cls}`} />
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-r border-b ${cls}`} />
    </>
  );
}

// ─── Notifications content ────────────────────────────────────────────────────

function NotificationsContent() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
  } = useNotifications();

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [taskNotifications, setTaskNotifications] = useState<TaskNotification[]>([]);
  const [customerNotifications, setCustomerNotifications] = useState<any[]>([]);
  const [transferNotifications, setTransferNotifications] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>("");

  // ── userId from localStorage ──────────────────────────────────────────────
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) setUserId(storedUserId);
  }, []);

  // ── Customer notifications ────────────────────────────────────────────────
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/Fetch"
        );
        const result = await response.json();

        if (result.success && result.data) {
          const now = new Date();
          const customers: Customer[] = result.data;

          const newCustomers = customers
            .filter((c) => {
              if (!c.date_created) return false;
              const hrs =
                (now.getTime() - new Date(c.date_created).getTime()) /
                (1000 * 60 * 60);
              return hrs <= 48;
            })
            .sort(
              (a, b) =>
                new Date(b.date_created || 0).getTime() -
                new Date(a.date_created || 0).getTime()
            );

          setCustomerNotifications(
            newCustomers.map((c) => ({
              id: `customer-${c.id ?? Math.random()}`,
              title: "New Customer Added",
              message: `${
                c.company_name ?? c.contact_person ?? "A new customer"
              } was added to the database`,
              type: "success" as const,
              category: "customer" as const,
              createdAt: c.date_created ?? new Date().toISOString(),
              read: false,
              isCustomerNotification: true,
              customerId: c.id,
            }))
          );
        }
      } catch (err) {
        console.error("Error fetching customers:", err);
      }
    };

    fetchCustomers();
    const interval = setInterval(fetchCustomers, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Task notifications ────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, "user_tasks"),
      where("userId", "==", userId),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const notifs: TaskNotification[] = [];

      snapshot.forEach((doc) => {
        const task = doc.data();
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        if (!dueDate || dueDate > sevenDaysFromNow) return;

        const isUrgent =
          dueDate <= new Date(now.getTime() + 24 * 60 * 60 * 1000);

        notifs.push({
          id: `task-${doc.id}`,
          title: isUrgent ? "Urgent: Task Due Soon!" : "Task Reminder",
          priority: task.priority ?? "normal",
          dueDate: task.dueDate,
          type: isUrgent ? "error" : "warning",
          category: "task",
          message: `"${task.title}" is due ${dueDate.toLocaleDateString()}`,
          createdAt: task.createdAt ?? new Date().toISOString(),
          read: false,
          isTaskReminder: true,
        });
      });

      setTaskNotifications(notifs);
    });

    return () => unsubscribe();
  }, [userId]);

  // ── Transfer notifications ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, "transfer_requests"),
      where("toUserId", "==", userId),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransferNotifications(
        snapshot.docs.map((doc) => {
          const t = doc.data();
          return {
            id: `transfer-${doc.id}`,
            title: "Transfer Request",
            message: `${t.fromUserName ?? "Someone"} wants to transfer ${
              t.customerName ?? "a customer"
            } to you`,
            type: "info" as const,
            category: "transfer" as const,
            createdAt: t.createdAt ?? new Date().toISOString(),
            read: false,
            isTransferNotification: true,
            transferId: doc.id,
          };
        })
      );
    });

    return () => unsubscribe();
  }, [userId]);

  // ── Combine & filter ──────────────────────────────────────────────────────
  const allNotifications = [
    ...transferNotifications,
    ...customerNotifications,
    ...taskNotifications,
    ...notifications,
  ];

  const filteredNotifications = allNotifications.filter((n) =>
    filter === "unread" ? !n.read : true
  );

  const groupedNotifications = filteredNotifications.reduce<
    Record<string, typeof filteredNotifications>
  >((groups, n) => {
    const date = new Date(n.createdAt).toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(n);
    return groups;
  }, {});

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) await markAsRead(notification.id);

    if (notification.category === "task" || notification.isTaskReminder) {
      window.location.href = "/dashboard/tasks";
    } else if (
      notification.category === "customer" ||
      notification.isCustomerNotification
    ) {
      window.location.href = "/taskflow/customer-database";
    } else if (notification.isTransferNotification) {
      window.location.href = "/user-management";
    }
  };

  const totalUnread = allNotifications.filter((n) => !n.read).length;

  return (
    <ProtectedPageWrapper>
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
                  <BreadcrumbLink
                    href="/dashboard"
                    className="text-slate-500 hover:text-orange-400 text-xs font-mono uppercase tracking-wider"
                  >
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block text-slate-700" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-orange-400 text-xs font-mono tracking-widest uppercase">
                    Notifications
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-3 px-4 relative z-10">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-orange-400/70 uppercase tracking-widest">
              <StatusDot />
              <span>Live</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsRead()}
              disabled={unreadCount === 0}
              className="bg-transparent border-orange-500/30 text-orange-400/80 hover:bg-orange-500/10 hover:text-orange-300 hover:border-orange-400/50 text-[10px] font-mono uppercase tracking-widest"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Mark all read
            </Button>
          </div>
        </header>

        {/* ── Page title bar ── */}
        <div className="shrink-0 px-4 sm:px-6 pt-3 pb-2 border-b border-slate-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative p-2 bg-orange-500/10 border border-orange-500/30">
                <CornerBrackets color="orange" />
                <Bell className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-widest uppercase text-orange-400 font-mono leading-tight">
                  Signal Feed
                </h1>
                <p className="text-[10px] text-slate-600 font-mono mt-0.5 tracking-wider">
                  ALERTS · REMINDERS · EVENTS
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
              <div className="flex items-center gap-1.5">
                <StatusDot active />
                <span className="text-orange-400/60">Firebase Sync</span>
              </div>
              <div className="w-px h-3 bg-slate-700" />
              <div className="flex items-center gap-1.5">
                <StatusDot active />
                <span className="text-orange-400/60">Real-time</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">

          {/* Background grid */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(rgba(251,146,60,0.03) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(251,146,60,0.03) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
          <ScanLine />

          {/* Content */}
          <div className="relative z-10 p-4 sm:p-6 flex flex-col gap-4">

            {/* ── Filter bar ── */}
            <div className="flex items-center gap-2">
              {(["all", "unread"] as const).map((f) => {
                const label = f === "all"
                  ? `All (${allNotifications.length})`
                  : `Unread (${totalUnread})`;
                const active = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-3 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors",
                      active
                        ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
                        : "bg-transparent border-slate-700/60 text-slate-500 hover:border-orange-500/30 hover:text-orange-400/70"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ── Notifications card ── */}
            <Card className="relative bg-[#0d1117]/90 backdrop-blur-xl border-orange-500/20 overflow-hidden">
              <CornerBrackets color="orange" />

              <ScrollArea className="h-[calc(100vh-260px)]">
                {filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <div className="relative p-4 bg-orange-500/10 border border-orange-500/20">
                      <CornerBrackets color="orange" />
                      <Bell className="h-8 w-8 text-orange-400/40" />
                    </div>
                    <p className="text-xs font-mono uppercase tracking-widest text-orange-400/40">
                      No signals detected
                    </p>
                    <p className="text-[10px] text-slate-600 font-mono">
                      {filter === "unread"
                        ? "All signals acknowledged"
                        : "Notifications appear here when events occur"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-orange-500/10">
                    {Object.entries(groupedNotifications).map(([date, items]) => (
                      <div key={date}>

                        {/* Date group header */}
                        <div className="px-4 py-2 bg-[#0a0d14]/80 border-b border-orange-500/10 sticky top-0 z-10">
                          <div className="flex items-center gap-2">
                            <div className="h-px flex-1 bg-gradient-to-r from-orange-500/20 to-transparent" />
                            <p className="text-[10px] font-mono text-orange-500/50 uppercase tracking-widest shrink-0">
                              {new Date(date).toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                              })}
                            </p>
                            <div className="h-px flex-1 bg-gradient-to-l from-orange-500/20 to-transparent" />
                          </div>
                        </div>

                        {/* Notification rows */}
                        <div>
                          {(items as typeof filteredNotifications).map((n) => (
                            <div
                              key={n.id}
                              className={cn(
                                "px-4 py-3 cursor-pointer transition-colors border-l-2 hover:bg-orange-500/5",
                                typeColors[n.type],
                                !n.read && "bg-orange-500/[0.03]"
                              )}
                              onClick={() => handleNotificationClick(n)}
                            >
                              <div className="flex items-start gap-3">

                                {/* Category icon */}
                                <div className="mt-0.5 shrink-0 p-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400/70">
                                  {categoryIcons[n.category] ?? (
                                    <Info className="h-4 w-4" />
                                  )}
                                </div>

                                {/* Body */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    {typeIcons[n.type]}
                                    <p className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200 truncate">
                                      {n.title}
                                    </p>
                                    {!n.read && (
                                      <Badge className="ml-auto shrink-0 text-[9px] font-mono uppercase tracking-widest bg-orange-500/15 text-orange-400 border border-orange-500/30 px-1.5 py-0">
                                        New
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 leading-snug mb-1.5">
                                    {n.message}
                                  </p>
                                  <span className="text-[10px] font-mono text-orange-500/40">
                                    {formatDistanceToNow(new Date(n.createdAt), {
                                      addSuffix: true,
                                    })}
                                  </span>
                                </div>

                                {/* Dismiss */}
                                <button
                                  className="shrink-0 mt-0.5 p-1 text-slate-600 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dismissNotification(n.id);
                                  }}
                                  aria-label="Dismiss notification"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </Card>
          </div>
        </div>

      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

function NotificationsPage() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  return <NotificationsContent />;
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <DashboardDataProvider>
          <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center bg-[#0a0d14] text-orange-400 font-mono text-xs tracking-widest">
                  INITIALIZING…
                </div>
              }
            >
              <NotificationsPage />
            </Suspense>
          </SidebarProvider>
        </DashboardDataProvider>
      </FormatProvider>
    </UserProvider>
  );
}
