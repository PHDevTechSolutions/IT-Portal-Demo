"use client";
import React, { useState, useEffect } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDistanceToNow, differenceInDays, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Bell, Check, X, Database, UserPlus, Activity, TrendingUp,
  History, CheckCircle, AlertTriangle, Info, ListTodo,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id?: string; company_name?: string; contact_person?: string;
  date_created?: string; email?: string; phone?: string;
}
interface Task {
  id: string; title: string;
  status: "pending"|"in-progress"|"completed"|"on-hold"|"cancelled";
  priority: "low"|"medium"|"high"; createdAt: any; dueDate?: any;
}
interface TaskNotification {
  id: string; title: string; message: string;
  type: "warning"|"error"|"info"; category: "task";
  createdAt: string; read: boolean; isTaskReminder: boolean;
  taskId: string; daysPending: number;
}

// ─── Color tokens ─────────────────────────────────────────────────────────────
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

// ─── Config maps ──────────────────────────────────────────────────────────────
const CATEGORY_ICON: Record<string, React.ReactNode> = {
  backup:   <Database   className="size-3.5" />,
  customer: <UserPlus   className="size-3.5" />,
  activity: <Activity   className="size-3.5" />,
  progress: <TrendingUp className="size-3.5" />,
  taskflow: <History    className="size-3.5" />,
  system:   <Info       className="size-3.5" />,
  task:     <ListTodo   className="size-3.5" />,
  transfer: <AlertTriangle className="size-3.5" />,
};

const TYPE_COLOR: Record<string, { dot: string; border: string; bg: string }> = {
  success: { dot: "#34d399", border: "#34d39940", bg: "rgba(52,211,153,0.05)"  },
  error:   { dot: "#f87171", border: "#f8717140", bg: "rgba(248,113,113,0.05)" },
  warning: { dot: "#fbbf24", border: "#fbbf2440", bg: "rgba(251,191,36,0.05)"  },
  info:    { dot: "#60a5fa", border: "#60a5fa40", bg: "rgba(96,165,250,0.05)"  },
};

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const [taskNotifications,     setTaskNotifications]     = useState<TaskNotification[]>([]);
  const [customerNotifications, setCustomerNotifications] = useState<any[]>([]);
  const [transferNotifications, setTransferNotifications] = useState<any[]>([]);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (id) setUserId(id);
  }, []);

  // ── New customers (last 48h) ───────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        const res  = await window.fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Fetch");
        const json = await res.json();
        if (!json.success || !json.data) return;
        const now = new Date();
        const recent = (json.data as Customer[])
          .filter(c => c.date_created && (now.getTime() - new Date(c.date_created).getTime()) / 3600000 <= 48)
          .sort((a, b) => new Date(b.date_created!).getTime() - new Date(a.date_created!).getTime());
        setCustomerNotifications(recent.map(c => ({
          id: `customer-${c.id || Math.random()}`,
          title: "New Customer Added",
          message: `${c.company_name || c.contact_person || "A new customer"} was added to the database`,
          type: "success", category: "customer",
          createdAt: c.date_created || new Date().toISOString(),
          read: false, isCustomerNotification: true, customerId: c.id,
        })));
      } catch {}
    };
    fetch();
    const t = setInterval(fetch, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // ── Pending task reminders ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, "user_tasks"), where("userId","==",userId), where("status","==","pending"));
    return onSnapshot(q, snap => {
      const now = new Date();
      const notifs: TaskNotification[] = [];
      snap.forEach(doc => {
        const task = doc.data() as Task;
        const created = task.createdAt?.toDate?.() || new Date();
        const days = differenceInDays(now, created);
        if (days < 1) return;
        const overdue = task.dueDate && isPast(task.dueDate?.toDate?.());
        const hi = task.priority === "high";
        const type: "warning"|"error"|"info" = overdue ? "error" : (hi || days >= 3) ? "warning" : "info";
        notifs.push({
          id: `task-${doc.id}`,
          title: overdue ? "Overdue Task" : hi ? "High Priority Task" : "Pending Task Reminder",
          message: `"${task.title}" has been pending for ${days} day${days>1?"s":""}${overdue?" and is overdue":""}`,
          type, category: "task",
          createdAt: new Date().toISOString(),
          read: false, isTaskReminder: true, taskId: doc.id, daysPending: days,
        });
      });
      setTaskNotifications(notifs);
    });
  }, [userId]);

  // ── Transfer approvals ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const check = async () => {
      try {
        const res   = await window.fetch("/api/UserManagement/Fetch");
        const users = await res.json();
        if (!Array.isArray(users)) return;
        const me = users.find((u: any) => u._id === userId || u.userId === userId);
        if (!me) return;
        const canApprove = me.roles?.some((r: any) =>
          r.permissions?.includes("approve_transfer") || r.name === "Admin" || r.name === "Manager");
        if (!canApprove) return;
        const notifs = users
          .filter((u: any) => u.transferRequests?.some((r: any) => !r.status || r.status === "pending" || r.approvalStatus === "pending"))
          .flatMap((u: any) =>
            u.transferRequests
              .filter((r: any) => !r.status || r.status === "pending" || r.approvalStatus === "pending")
              .map((r: any, i: number) => ({
                id: `transfer-${u._id}-${i}`,
                title: "Transfer Approval Required",
                message: `${u.userName || u.Email} requests transfer to ${r.targetType || r.target}`,
                type: "warning", category: "taskflow",
                createdAt: r.createdAt || new Date().toISOString(),
                read: false, isTransferNotification: true,
                transferId: r.id || `${u._id}-${i}`, fromUserId: u._id, toUserId: r.targetId,
              }))
          );
        setTransferNotifications(notifs);
      } catch {}
    };
    check();
    const t = setInterval(check, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, [userId]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const allNotifications = [...transferNotifications, ...customerNotifications, ...taskNotifications, ...notifications];
  const totalUnread = unreadCount + taskNotifications.length + customerNotifications.length + transferNotifications.length;

  const grouped = allNotifications.reduce<Record<string, typeof allNotifications>>((acc, n) => {
    const d = new Date(n.createdAt).toDateString();
    (acc[d] ??= []).push(n);
    return acc;
  }, {});

  const handleClick = async (n: any) => {
    if (n.category === "task" || n.isTaskReminder)          { window.location.href = "/dashboard/tasks";          setOpen(false); return; }
    if (n.category === "customer" || n.isCustomerNotification) { window.location.href = "/taskflow/customer-database"; setOpen(false); return; }
    if (n.isTransferNotification)                           { window.location.href = "/user-management";          setOpen(false); return; }
    if (!n.read) await markAsRead(n.id);
    if (n.category === "backup" && n.metadata?.backupId) downloadBackup(n.metadata.backupId);
  };

  const downloadBackup = async (backupId: string) => {
    try {
      const res  = await window.fetch("/api/Data/Applications/Admin/BackupSettings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", backupId }),
      });
      const data = await res.json();
      if (data.success && data.downloadUrl) {
        const a = document.createElement("a"); a.href = data.downloadUrl;
        a.download = `backup-${backupId}.zip`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        toast.success("Backup downloaded");
      } else toast.error(data.error || "Download failed");
    } catch { toast.error("Download failed"); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center border transition-colors"
          style={{ borderColor: C.border, backgroundColor: "transparent", color: C.dim }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {totalUnread > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center text-[9px] font-bold"
              style={{ backgroundColor: C.accent, color: "#080d12", fontFamily: C.font }}
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-96 p-0 rounded-none"
        style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>Notifications</p>
            <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{totalUnread} unread</p>
          </div>
          <button
            onClick={async () => { await markAllAsRead(); toast.success("All marked as read"); }}
            disabled={totalUnread === 0}
            className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-30"
            style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}
          >
            <Check className="size-3" /> Mark all read
          </button>
        </div>

        {/* ── List ── */}
        <ScrollArea className="h-[400px]">
          {allNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Bell className="size-8 opacity-20" style={{ color: C.dim }} />
              <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No notifications</p>
              <p className="text-[10px]" style={{ color: C.muted }}>Events will appear here</p>
            </div>
          ) : (
            Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                {/* Date group header */}
                <div className="px-4 py-1.5 border-b" style={{ borderColor: C.muted + "30", backgroundColor: C.bg }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>
                    {new Date(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                </div>

                {/* Notifications in group */}
                {(items as typeof allNotifications).map(n => {
                  const tc = TYPE_COLOR[n.type] ?? TYPE_COLOR.info;
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-l-2 transition-colors"
                      style={{
                        borderBottomColor: C.muted + "30",
                        borderLeftColor: tc.border,
                        backgroundColor: n.read ? "transparent" : tc.bg,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = n.read ? "transparent" : tc.bg)}
                    >
                      {/* Category icon */}
                      <div className="mt-0.5 shrink-0" style={{ color: tc.dot }}>
                        {CATEGORY_ICON[n.category] ?? <Info className="size-3.5" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tc.dot }} />
                          <p className="text-[11px] font-bold truncate" style={{ color: C.text }}>{n.title}</p>
                        </div>
                        <p className="text-[10px] line-clamp-2" style={{ color: C.dim }}>{n.message}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[9px]" style={{ color: C.muted }}>
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </span>
                          {!n.read && (
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5"
                              style={{ backgroundColor: "rgba(232,99,10,0.15)", color: C.accent }}>
                              New
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dismiss */}
                      <button
                        onClick={e => { e.stopPropagation(); dismissNotification(n.id); }}
                        className="shrink-0 h-5 w-5 flex items-center justify-center border transition-colors mt-0.5"
                        style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}
                      >
                        <X className="size-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </ScrollArea>

        {/* ── Footer ── */}
        <div className="border-t" style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <button
            onClick={() => { setOpen(false); window.location.href = "/dashboard/notifications"; }}
            className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
            style={{ color: C.dim, backgroundColor: "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}
          >
            View all notifications
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
