"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isPast, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { Clock, AlertTriangle, Flame } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed" | "on-hold" | "cancelled";
  priority: "low" | "medium" | "high";
  createdAt: any;
  dueDate?: Date;
}

interface TaskReminderNotificationsProps {
  userId: string;
}

// ─── Notification toast content ───────────────────────────────────────────────

function ReminderToast({
  title,
  daysPending,
  isOverdue,
  isHighPriority,
}: {
  title: string;
  daysPending: number;
  isOverdue: boolean;
  isHighPriority: boolean;
}) {
  const label = isOverdue
    ? "Overdue Mission"
    : isHighPriority
    ? "High Priority Alert"
    : "Mission Reminder";

  const Icon = isOverdue ? AlertTriangle : isHighPriority ? Flame : Clock;

  const accentColor = isOverdue
    ? "text-red-400 border-red-500/30"
    : isHighPriority
    ? "text-orange-400 border-orange-500/30"
    : "text-orange-300 border-orange-500/20";

  const iconGlow = isOverdue
    ? "drop-shadow-[0_0_6px_rgba(248,113,113,0.7)]"
    : "drop-shadow-[0_0_6px_rgba(251,146,60,0.7)]";

  return (
    <div
      className={`flex items-start gap-3 bg-[#0d1117]/95 backdrop-blur-xl px-3 py-2.5 rounded border ${accentColor}`}
    >
      {/* Icon */}
      <div className={`mt-0.5 shrink-0 ${accentColor.split(" ")[0]} ${iconGlow}`}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Body */}
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-widest uppercase font-mono text-orange-400 leading-tight">
          {label}
        </p>
        <p className="text-[11px] text-slate-400 mt-1 leading-snug truncate max-w-[220px]">
          <span className="text-slate-200">"{title}"</span> pending{" "}
          <span className="text-orange-400 font-mono font-semibold">
            {daysPending}d
          </span>
          {isOverdue && (
            <span className="text-red-400 font-mono"> · overdue</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Background notification component ────────────────────────────────────────

export function TaskReminderNotifications({
  userId,
}: TaskReminderNotificationsProps) {
  const [notifiedTasks, setNotifiedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const tasksRef = collection(db, "user_tasks");
    const q = query(
      tasksRef,
      where("userId", "==", userId),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();

      snapshot.forEach((doc) => {
        const task = doc.data() as Task;
        const taskId = doc.id;

        if (notifiedTasks.has(taskId)) return;

        const createdAt = task.createdAt?.toDate?.() ?? new Date();
        const daysPending = differenceInDays(now, createdAt);

        if (daysPending < 1) return;

        const isOverdue = Boolean(task.dueDate && isPast(task.dueDate));
        const isHighPriority = task.priority === "high";

        if (!isOverdue && !isHighPriority && daysPending < 3) return;

        toast(
          <ReminderToast
            title={task.title}
            daysPending={daysPending}
            isOverdue={isOverdue}
            isHighPriority={isHighPriority}
          />,
          {
            duration: 8000,
            action: {
              label: "View",
              onClick: () => {
                window.location.href = "/dashboard/tasks";
              },
            },
          }
        );

        setNotifiedTasks((prev) => new Set([...prev, taskId]));
      });
    });

    return () => unsubscribe();
  }, [userId, notifiedTasks]);

  // Reset notified set every 30 minutes so tasks can re-notify
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(
      () => setNotifiedTasks(new Set()),
      30 * 60 * 1000
    );
    return () => clearInterval(interval);
  }, [userId]);

  return null;
}

// ─── Hook: pending task counts for badges ─────────────────────────────────────

export function usePendingTasksCount(userId: string) {
  const [count, setCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const tasksRef = collection(db, "user_tasks");
    const q = query(
      tasksRef,
      where("userId", "==", userId),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      let pending = 0;
      let overdue = 0;

      snapshot.forEach((doc) => {
        const task = doc.data() as Task;
        pending++;

        const createdAt = task.createdAt?.toDate?.() ?? new Date();
        const daysPending = differenceInDays(now, createdAt);

        if (daysPending >= 1 || (task.dueDate && isPast(task.dueDate))) {
          overdue++;
        }
      });

      setCount(pending);
      setOverdueCount(overdue);
    });

    return () => unsubscribe();
  }, [userId]);

  return { count, overdueCount };
}
