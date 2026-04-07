"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isPast, differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";
import { Clock, AlertCircle } from "lucide-react";

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

export function TaskReminderNotifications({ userId }: TaskReminderNotificationsProps) {
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
        
        // Skip if already notified for this session
        if (notifiedTasks.has(taskId)) return;
        
        // Check if task is pending and over 1 day old
        const createdAt = task.createdAt?.toDate?.() || new Date();
        const daysPending = differenceInDays(now, createdAt);
        
        if (daysPending >= 1) {
          // Show notification based on priority and age
          const isOverdue = task.dueDate && isPast(task.dueDate);
          const isHighPriority = task.priority === "high";
          
          if (isOverdue || isHighPriority || daysPending >= 3) {
            // Show prominent notification
            toast(
              <div className="flex items-start gap-3">
                <div className={isOverdue ? "text-red-500" : isHighPriority ? "text-orange-500" : "text-yellow-500"}>
                  {isOverdue ? <AlertCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {isOverdue ? "Overdue Task!" : isHighPriority ? "High Priority Task Pending" : "Task Reminder"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    "{task.title}" has been pending for {daysPending} day{daysPending > 1 ? 's' : ''}
                    {isOverdue ? " and is now overdue" : ""}
                  </p>
                </div>
              </div>,
              {
                duration: 8000,
                action: {
                  label: "View",
                  onClick: () => {
                    window.location.href = "/dashboard/tasks";
                  }
                }
              }
            );
            
            // Mark as notified for this session
            setNotifiedTasks(prev => new Set([...prev, taskId]));
          }
        }
      });
    });

    return () => unsubscribe();
  }, [userId, notifiedTasks]);

  // Also check periodically (every 30 minutes) for new reminders
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      // Clear notified tasks to allow new notifications
      setNotifiedTasks(new Set());
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, [userId]);

  return null; // This is a background component, no UI
}

// Hook to check pending tasks count for badge
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
      let pendingCount = 0;
      let overdue = 0;
      const now = new Date();

      snapshot.forEach((doc) => {
        const task = doc.data() as Task;
        pendingCount++;
        
        const createdAt = task.createdAt?.toDate?.() || new Date();
        const daysPending = differenceInDays(now, createdAt);
        
        if (daysPending >= 1 || (task.dueDate && isPast(task.dueDate))) {
          overdue++;
        }
      });

      setCount(pendingCount);
      setOverdueCount(overdue);
    });

    return () => unsubscribe();
  }, [userId]);

  return { count, overdueCount };
}
