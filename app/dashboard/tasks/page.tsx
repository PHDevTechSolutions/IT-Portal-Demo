"use client";

import React, { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { MyTaskDashboard } from "@/components/dashboard/my-task-dashboard";
import { DataMigrator } from "@/components/dashboard/data-migrator";
import { TaskReminderNotifications } from "@/components/dashboard/task-reminders";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { DashboardDataProvider } from "@/contexts/DashboardDataContext";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ListTodo } from "lucide-react";

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
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${
      active ? "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]" : "bg-slate-600"
    }`} />
  );
}

// ─── Tasks content ────────────────────────────────────────────────────────────

function TasksContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId, role } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

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
                  <BreadcrumbLink href="/dashboard" className="text-slate-500 hover:text-orange-400 text-xs font-mono">
                    HOME
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block text-slate-700" />
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard" className="text-slate-500 hover:text-orange-400 text-xs font-mono">
                    DASHBOARD
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block text-slate-700" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-orange-400 text-xs font-mono tracking-widest uppercase">
                    My Tasks
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-3 px-4 relative z-10">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-orange-400/70 uppercase tracking-widest">
              <StatusDot />
              <span>Live</span>
            </div>
            <NotificationBell />
          </div>
        </header>

        {/* ── Page title bar ── */}
        <div className="shrink-0 px-4 sm:px-6 pt-3 pb-2 border-b border-slate-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative p-2 bg-orange-500/10 border border-orange-500/30">
                <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-orange-500/50" />
                <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-orange-500/50" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/50" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/50" />
                <ListTodo className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-widest uppercase text-orange-400 font-mono leading-tight">
                  Mission Log
                </h1>
                <p className="text-[10px] text-slate-600 font-mono mt-0.5 tracking-wider">
                  TASKS · ASSIGNMENTS · TRACKING
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
          <div className="relative z-10">
            {/* Background task reminder (no UI) */}
            <TaskReminderNotifications userId={userId || "guest"} />

            {/* Data migrator */}
            <DataMigrator userId={userId || "guest"} userName="User" />

            {/* Main task dashboard */}
            <MyTaskDashboard
              userId={userId || "guest"}
              userName="User"
              userRole={role || ""}
            />
          </div>
        </div>

      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function TasksPage() {
  return (
    <UserProvider>
      <FormatProvider>
        <DashboardDataProvider>
          <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
            <Suspense fallback={
              <div className="flex h-screen items-center justify-center bg-[#0a0d14] text-orange-400 font-mono text-xs tracking-widest">
                INITIALIZING…
              </div>
            }>
              <TasksContent />
            </Suspense>
          </SidebarProvider>
        </DashboardDataProvider>
      </FormatProvider>
    </UserProvider>
  );
}
