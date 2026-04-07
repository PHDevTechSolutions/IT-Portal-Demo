"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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
import { MyTaskDashboard } from "@/components/dashboard/my-task-dashboard";
import { DataMigrator } from "@/components/dashboard/data-migrator";
import { TaskReminderNotifications } from "@/components/dashboard/task-reminders";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { DashboardDataProvider } from "@/contexts/DashboardDataContext";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { NotificationBell } from "@/components/notifications/NotificationBell";

function TasksContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  // ✅ Load userId from localStorage after login
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  return (
    <ProtectedPageWrapper>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-auto min-h-[56px] items-center gap-2 justify-between px-2 md:px-4 py-2 flex-wrap">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1 touch-button" />
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/dashboard"}>
              Home
            </Button>
            <Separator orientation="vertical" className="h-4 hidden sm:block" />
            <Breadcrumb className="hidden sm:flex">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>My Tasks</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        {/* ✅ Main content */}
        <div className="flex flex-1 flex-col p-4 md:p-6">
          <div className="max-w-7xl mx-auto w-full space-y-4">
            <TaskReminderNotifications userId={userId || "guest"} />
            <h1 className="text-2xl font-bold">My Tasks</h1>
            <DataMigrator userId={userId || "guest"} userName={"User"} />
            <MyTaskDashboard userId={userId || "guest"} userName={"User"} />
          </div>
        </div>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

export default function TasksPage() {
  return (
    <UserProvider>
      <FormatProvider>
        <DashboardDataProvider>
          <SidebarProvider>
            <Suspense fallback={<div>Loading...</div>}>
              <TasksContent />
            </Suspense>
          </SidebarProvider>
        </DashboardDataProvider>
      </FormatProvider>
    </UserProvider>
  );
}
