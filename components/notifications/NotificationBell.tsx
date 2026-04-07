"use client";

import React, { useState, useEffect } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Download,
  ListTodo,
  Clock,
} from "lucide-react";
import { formatDistanceToNow, differenceInDays, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Customer {
  id?: string;
  company_name?: string;
  contact_person?: string;
  date_created?: string;
  email?: string;
  phone?: string;
}

interface Task {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed" | "on-hold" | "cancelled";
  priority: "low" | "medium" | "high";
  createdAt: any;
  dueDate?: any;
}

interface TaskNotification {
  id: string;
  title: string;
  message: string;
  type: "warning" | "error" | "info";
  category: "task";
  createdAt: string;
  read: boolean;
  isTaskReminder: boolean;
  taskId: string;
  daysPending: number;
}

const categoryIcons: Record<string, React.ReactNode> = {
  backup: <Database className="h-4 w-4" />,
  customer: <UserPlus className="h-4 w-4" />,
  activity: <Activity className="h-4 w-4" />,
  progress: <TrendingUp className="h-4 w-4" />,
  taskflow: <History className="h-4 w-4" />,
  system: <Info className="h-4 w-4" />,
  task: <ListTodo className="h-4 w-4" />,
};

const typeIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <AlertTriangle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
};

const typeColors: Record<string, string> = {
  success: "border-l-green-500 bg-green-50/50",
  error: "border-l-red-500 bg-red-50/50",
  warning: "border-l-yellow-500 bg-yellow-50/50",
  info: "border-l-blue-500 bg-blue-50/50",
};

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const [taskNotifications, setTaskNotifications] = useState<TaskNotification[]>([]);
  const [customerNotifications, setCustomerNotifications] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>("");

  // Get userId from localStorage or context
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  // Fetch customer database for new entries
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Fetch");
        const result = await response.json();
        
        if (result.success && result.data) {
          const now = new Date();
          const customers: Customer[] = result.data;
          
          // Filter customers added in the last 2 days (48 hours)
          const newCustomers = customers.filter((customer) => {
            if (!customer.date_created) return false;
            const createdDate = new Date(customer.date_created);
            const hoursDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
            return hoursDiff <= 48; // 2 days = 48 hours
          });

          // Sort by latest date_created first (newest first)
          newCustomers.sort((a, b) => {
            const dateA = new Date(a.date_created || 0).getTime();
            const dateB = new Date(b.date_created || 0).getTime();
            return dateB - dateA; // Descending order (latest first)
          });

          // Create notifications for new customers
          const customerNotifs = newCustomers.map((customer) => ({
            id: `customer-${customer.id || Math.random()}`,
            title: "New Customer Added",
            message: `${customer.company_name || customer.contact_person || "A new customer"} was added to the database`,
            type: "success" as const,
            category: "customer" as const,
            createdAt: customer.date_created || new Date().toISOString(),
            read: false,
            isCustomerNotification: true,
            customerId: customer.id,
          }));

          setCustomerNotifications(customerNotifs);
        }
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
    };

    fetchCustomers();
    // Check every 5 minutes for new customers
    const interval = setInterval(fetchCustomers, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to pending tasks for reminders
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
      const taskNotifs: TaskNotification[] = [];

      snapshot.forEach((doc) => {
        const task = doc.data() as Task;
        const createdAt = task.createdAt?.toDate?.() || new Date();
        const daysPending = differenceInDays(now, createdAt);

        // Only show tasks pending for 1 day or more
        if (daysPending >= 1) {
          const isOverdue = task.dueDate && isPast(task.dueDate?.toDate?.());
          const isHighPriority = task.priority === "high";

          let type: "warning" | "error" | "info" = "info";
          if (isOverdue) type = "error";
          else if (isHighPriority) type = "warning";
          else if (daysPending >= 3) type = "warning";

          taskNotifs.push({
            id: `task-${doc.id}`,
            title: isOverdue ? "Overdue Task" : isHighPriority ? "High Priority Task" : "Pending Task Reminder",
            message: `"${task.title}" has been pending for ${daysPending} day${daysPending > 1 ? 's' : ''}${isOverdue ? " and is overdue" : ""}`,
            type,
            category: "task",
            createdAt: new Date().toISOString(),
            read: false,
            isTaskReminder: true,
            taskId: doc.id,
            daysPending,
          });
        }
      });

      setTaskNotifications(taskNotifs);
    });

    return () => unsubscribe();
  }, [userId]);

  // Combine all notifications: regular, task, and customer
  const allNotifications = [...customerNotifications, ...taskNotifications, ...notifications];
  const totalUnreadCount = unreadCount + taskNotifications.length + customerNotifications.length;

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    toast.success("All notifications marked as read");
  };

  const handleNotificationClick = async (notification: {
    id: string;
    title: string;
    message: string;
    type: string;
    category: string;
    createdAt: string;
    read: boolean;
    metadata?: Record<string, any>;
    isTaskReminder?: boolean;
    taskId?: string;
    isCustomerNotification?: boolean;
    customerId?: string;
  }) => {
    // Handle task reminders - navigate to tasks page
    if (notification.category === "task" || notification.isTaskReminder) {
      window.location.href = "/dashboard/tasks";
      setOpen(false);
      return;
    }

    // Handle customer notifications - navigate to customer database
    if (notification.category === "customer" || notification.isCustomerNotification) {
      window.location.href = "/taskflow/customer-database";
      setOpen(false);
      return;
    }

    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Handle backup download notifications
    if (notification.category === "backup" && notification.metadata && "backupId" in notification.metadata) {
      await downloadBackup(notification.metadata.backupId);
    }
  };

  const downloadBackup = async (backupId: string) => {
    try {
      const response = await fetch("/api/Data/Applications/Admin/BackupSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "download",
          backupId: backupId,
        }),
      });

      const result = await response.json();
      if (result.success && result.downloadUrl) {
        // Create download link
        const link = document.createElement("a");
        link.href = result.downloadUrl;
        link.download = `backup-${backupId}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success("Backup downloaded successfully");
      } else {
        toast.error(result.error || "Failed to download backup");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download backup");
    }
  };

  // Group notifications by date
  const groupedNotifications = allNotifications.reduce<Record<string, typeof allNotifications>>((groups, notification) => {
    const date = new Date(notification.createdAt).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(notification);
    return groups;
  }, {});

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {totalUnreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h4 className="font-semibold">Notifications</h4>
            <p className="text-xs text-muted-foreground">
              {totalUnreadCount} unread
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={totalUnreadCount === 0}
            >
              <Check className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {allNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs">
                Notifications appear here when events occur
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {Object.entries(groupedNotifications).map(([date, items]) => {
                const notificationItems = items as typeof allNotifications;
                return (
                  <div key={date}>
                    <div className="px-4 py-2 bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground">
                        {new Date(date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="divide-y">
                      {notificationItems.map((notification) => (
                        <div
                          key={notification.id}
                          className={cn(
                            "p-4 cursor-pointer transition-colors hover:bg-muted/50 border-l-4",
                            typeColors[notification.type],
                            !notification.read && "bg-muted/30"
                          )}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {categoryIcons[notification.category] || (
                                <Info className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {typeIcons[notification.type]}
                                <p className="font-medium text-sm truncate">
                                  {notification.title}
                                </p>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(
                                    new Date(notification.createdAt),
                                    { addSuffix: true }
                                  )}
                                </span>
                                <div className="flex items-center gap-2">
                                  {!notification.read && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      New
                                    </Badge>
                                  )}
                                  {notification.category === "backup" && notification.metadata && typeof notification.metadata === "object" && "backupId" in notification.metadata && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const metadata = notification.metadata as any;
                                        if (metadata?.backupId) {
                                          downloadBackup(metadata.backupId);
                                        }
                                      }}
                                    >
                                      <CheckCircle className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                dismissNotification(notification.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <Separator />
        <div className="p-3">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
