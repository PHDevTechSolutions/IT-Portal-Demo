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

const categoryIcons: Record<string, React.ReactNode> = {
  backup: <Database className="h-5 w-5" />,
  customer: <UserPlus className="h-5 w-5" />,
  activity: <Activity className="h-5 w-5" />,
  progress: <TrendingUp className="h-5 w-5" />,
  taskflow: <History className="h-5 w-5" />,
  system: <Info className="h-5 w-5" />,
  task: <ListTodo className="h-5 w-5" />,
  transfer: <AlertTriangle className="h-5 w-5" />,
};

const typeIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-emerald-400" />,
  error: <AlertTriangle className="h-5 w-5 text-red-400" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
  info: <Info className="h-5 w-5 text-cyan-400" />,
};

const typeColors: Record<string, string> = {
  success: "border-l-emerald-500 bg-emerald-500/10",
  error: "border-l-red-500 bg-red-500/10",
  warning: "border-l-yellow-500 bg-yellow-500/10",
  info: "border-l-cyan-500 bg-cyan-500/10",
};

function NotificationsContent() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification } =
    useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  
  // Additional notification sources (same as NotificationBell)
  const [taskNotifications, setTaskNotifications] = useState<TaskNotification[]>([]);
  const [customerNotifications, setCustomerNotifications] = useState<any[]>([]);
  const [transferNotifications, setTransferNotifications] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>("");
  
  // Get userId from localStorage
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);
  
  // Fetch customer notifications
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Fetch");
        const result = await response.json();
        
        if (result.success && result.data) {
          const now = new Date();
          const customers: Customer[] = result.data;
          
          const newCustomers = customers.filter((customer) => {
            if (!customer.date_created) return false;
            const createdDate = new Date(customer.date_created);
            const hoursDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
            return hoursDiff <= 48;
          });
          
          newCustomers.sort((a, b) => {
            const dateA = new Date(a.date_created || 0).getTime();
            const dateB = new Date(b.date_created || 0).getTime();
            return dateB - dateA;
          });
          
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
    const interval = setInterval(fetchCustomers, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Fetch task notifications
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
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const taskNotifs: TaskNotification[] = [];
      
      snapshot.forEach((doc) => {
        const task = doc.data();
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        
        if (dueDate && dueDate <= sevenDaysFromNow) {
          const isUrgent = dueDate <= new Date(now.getTime() + 24 * 60 * 60 * 1000);
          
          taskNotifs.push({
            id: `task-${doc.id}`,
            title: isUrgent ? "Urgent: Task Due Soon!" : "Task Reminder",
            priority: task.priority || "normal",
            dueDate: task.dueDate,
            type: isUrgent ? "error" : "warning",
            category: "task",
            message: `"${task.title}" is due ${dueDate.toLocaleDateString()}`,
            createdAt: task.createdAt || new Date().toISOString(),
            read: false,
            isTaskReminder: true,
          });
        }
      });
      
      setTaskNotifications(taskNotifs);
    });
    
    return () => unsubscribe();
  }, [userId]);
  
  // Fetch transfer notifications
  useEffect(() => {
    if (!userId) return;
    
    const transfersRef = collection(db, "transfer_requests");
    const q = query(
      transfersRef,
      where("toUserId", "==", userId),
      where("status", "==", "pending")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transferNotifs = snapshot.docs.map((doc) => {
        const transfer = doc.data();
        return {
          id: `transfer-${doc.id}`,
          title: "Transfer Request",
          message: `${transfer.fromUserName || "Someone"} wants to transfer ${transfer.customerName || "a customer"} to you`,
          type: "info" as const,
          category: "transfer" as const,
          createdAt: transfer.createdAt || new Date().toISOString(),
          read: false,
          isTransferNotification: true,
          transferId: doc.id,
        };
      });
      
      setTransferNotifications(transferNotifs);
    });
    
    return () => unsubscribe();
  }, [userId]);

  // Combine all notifications (same as NotificationBell)
  const allNotifications = [
    ...transferNotifications,
    ...customerNotifications,
    ...taskNotifications,
    ...notifications,
  ];
  
  // Calculate total unread
  const totalUnreadCount = allNotifications.filter((n) => !n.read).length;

  const filteredNotifications = allNotifications.filter((n) => {
    if (filter === "unread") return !n.read;
    return true;
  });

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce<Record<string, typeof filteredNotifications>>(
    (groups, notification) => {
      const date = new Date(notification.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(notification);
      return groups;
    },
    {}
  );

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate based on category
    if (notification.category === "task" || notification.isTaskReminder) {
      window.location.href = "/dashboard/tasks";
    } else if (notification.category === "customer" || notification.isCustomerNotification) {
      window.location.href = "/taskflow/customer-database";
    } else if (notification.isTransferNotification) {
      window.location.href = "/user-management";
    }
  };

  return (
    <ProtectedPageWrapper>
      <AppSidebar />
      <SidebarInset>
        <header className="relative flex h-16 shrink-0 items-center gap-2 justify-between bg-slate-950/95 backdrop-blur-xl border-b border-cyan-500/30 overflow-hidden">
          {/* Corner brackets */}
          <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-cyan-500/50" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-cyan-500/50" />
          {/* Cyan glow line on bottom edge */}
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          
          <div className="flex items-center gap-2 px-4 relative z-10">
            <SidebarTrigger className="-ml-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10" />
            <Separator orientation="vertical" className="mr-2 h-4 bg-cyan-500/30" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Notifications</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2 px-4 relative z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsRead()}
              disabled={unreadCount === 0}
              className="bg-slate-900/80 border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-400/50 text-xs uppercase tracking-wider"
            >
              <Check className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 flex-col bg-[#050a14] relative overflow-hidden">
          {/* Animated background grid */}
          <div className="absolute inset-0 h-full w-full">
            <div
              className="h-full w-full opacity-10"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(6, 182, 212, 0.15) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(6, 182, 212, 0.15) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px',
              }}
            />
          </div>

          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-cyan-400/30 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `float ${5 + Math.random() * 10}s linear infinite`,
                  animationDelay: `${Math.random() * 5}s`
                }}
              />
            ))}
          </div>

          <div className="relative z-10 flex-1 p-4 md:p-6">
            {/* Filter buttons */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
                className={cn(
                  "text-xs uppercase tracking-wider",
                  filter === "all"
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50 hover:bg-cyan-500/30"
                    : "bg-slate-900/80 border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/10"
                )}
              >
                All ({notifications.length})
              </Button>
              <Button
                variant={filter === "unread" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("unread")}
                className={cn(
                  "text-xs uppercase tracking-wider",
                  filter === "unread"
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50 hover:bg-cyan-500/30"
                    : "bg-slate-900/80 border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/10"
                )}
              >
                Unread ({unreadCount})
              </Button>
            </div>

            {/* Notifications list */}
            <Card className="relative bg-slate-950/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-cyan-500/50" />
              <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-cyan-500/50" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-l border-b border-cyan-500/50" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-r border-b border-cyan-500/50" />

              <ScrollArea className="h-[calc(100vh-220px)]">
                {filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-cyan-100/50">
                    <Bell className="h-16 w-16 mb-4 opacity-50 text-cyan-400" />
                    <p className="text-lg text-white/80">No notifications</p>
                    <p className="text-sm text-white/50">
                      {filter === "unread"
                        ? "No unread notifications"
                        : "Notifications appear here when events occur"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-cyan-500/10">
                    {Object.entries(groupedNotifications).map(([date, items]) => {
                      const notificationItems = items as typeof filteredNotifications;
                      return (
                        <div key={date}>
                          <div className="px-4 py-3 bg-slate-900/70 border-b border-cyan-500/20 sticky top-0">
                            <p className="text-xs font-medium text-cyan-400/80 uppercase tracking-wider">
                              {new Date(date).toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                          <div>
                            {notificationItems.map((notification) => (
                              <div
                                key={notification.id}
                                className={cn(
                                  "p-4 cursor-pointer transition-colors hover:bg-cyan-500/10 border-l-4",
                                  typeColors[notification.type],
                                  !notification.read && "bg-slate-800/50"
                                )}
                                onClick={() => handleNotificationClick(notification)}
                              >
                                <div className="flex items-start gap-4">
                                  <div className="mt-0.5 p-2 rounded-lg bg-slate-800/50 border border-cyan-500/20">
                                    {categoryIcons[notification.category] || (
                                      <Info className="h-5 w-5 text-cyan-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      {typeIcons[notification.type]}
                                      <p className="font-medium text-base truncate text-white">
                                        {notification.title}
                                      </p>
                                    </div>
                                    <p className="text-sm text-white/70 mb-2">
                                      {notification.message}
                                    </p>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-cyan-400/60">
                                        {formatDistanceToNow(
                                          new Date(notification.createdAt),
                                          { addSuffix: true }
                                        )}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {!notification.read && (
                                          <Badge className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                            New
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-cyan-100/60 hover:text-cyan-300 hover:bg-cyan-500/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      dismissNotification(notification.id);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
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
            </Card>
          </div>
        </div>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

function NotificationsPage() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  return (
    <NotificationsContent />
  );
}

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <DashboardDataProvider>
          <SidebarProvider>
            <Suspense fallback={<div>Loading...</div>}>
              <NotificationsPage />
            </Suspense>
          </SidebarProvider>
        </DashboardDataProvider>
      </FormatProvider>
    </UserProvider>
  );
}
