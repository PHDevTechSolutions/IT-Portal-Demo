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
  const { userId, setUserId, role } = useUser();
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
        <header className="relative flex h-auto min-h-[56px] items-center gap-2 justify-between px-2 md:px-4 py-2 flex-wrap bg-slate-950/95 backdrop-blur-xl border-b border-cyan-500/30 overflow-hidden">
          {/* Corner brackets */}
          <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-cyan-500/50" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-cyan-500/50" />
          {/* Cyan glow line on bottom edge */}
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          
          <div className="flex items-center gap-2 relative z-10">
            <SidebarTrigger className="-ml-1 touch-button text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10" />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.href = "/dashboard"}
              className="bg-slate-900/80 border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-400/50 text-xs uppercase tracking-wider"
            >
              Home
            </Button>
            <Separator orientation="vertical" className="h-4 hidden sm:block bg-cyan-500/30" />
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
        <div className="flex flex-1 flex-col bg-[#050a14]">
          <div className="w-full">
            <TaskReminderNotifications userId={userId || "guest"} />
            <DataMigrator userId={userId || "guest"} userName={"User"} />
            <MyTaskDashboard userId={userId || "guest"} userName={"User"} userRole={role || ""} />
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
