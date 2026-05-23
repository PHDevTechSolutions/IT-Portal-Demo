"use client"

import { useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { SectionCards } from "@/components/dashboard/cards/section-cards"
import { ChartAreaInteractive } from "@/components/dashboard/chart/progress"
import { UserProvider, useUser } from "@/contexts/UserContext"
import { FormatProvider } from "@/contexts/FormatContext"
import { DashboardDataProvider } from "@/contexts/DashboardDataContext"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { NotificationBell } from "@/components/notifications/NotificationBell"

// ─── Animated scan line ───────────────────────────────────────────────────────

function ScanLine() {
  return (
    <div
      className="pointer-events-none absolute left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent"
      style={{ animation: "scanline 6s linear infinite", top: 0 }}
    />
  )
}

// ─── Corner bracket decoration ────────────────────────────────────────────────

function CornerBrackets({ color = "orange" }: { color?: "orange" | "cyan" }) {
  const cls = color === "orange"
    ? "border-orange-500/50"
    : "border-cyan-500/50"
  return (
    <>
      <div className={`absolute top-0 left-0 w-3 h-3 border-l border-t ${cls}`} />
      <div className={`absolute top-0 right-0 w-3 h-3 border-r border-t ${cls}`} />
      <div className={`absolute bottom-0 left-0 w-3 h-3 border-l border-b ${cls}`} />
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-r border-b ${cls}`} />
    </>
  )
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ active = true }: { active?: boolean }) {
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${active ? "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]" : "bg-slate-600"}`} />
  )
}

// ─── Dashboard content ────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams()
  const { userId, setUserId } = useUser()
  const queryUserId = searchParams?.get("id") ?? ""

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId)
    }
  }, [queryUserId, userId, setUserId])

  return (
    <ProtectedPageWrapper>
      <AppSidebar />
      <SidebarInset className="bg-[#0a0d14] text-slate-100 ">

        {/* ── Header ── */}
        <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-orange-500/20 bg-[#0d1117]/90 backdrop-blur-sm overflow-hidden">
          {/* Bottom glow line */}
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
          {/* Corner accents */}
          <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/50" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/50" />

          <div className="flex items-center gap-2 px-4 relative z-10">
            <SidebarTrigger className="-ml-1 text-orange-400/70 hover:text-orange-300 hover:bg-orange-500/10" />
            <Separator orientation="vertical" className="h-4 bg-orange-500/20" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#" className="text-slate-500 hover:text-orange-400 text-xs font-mono">
                    HOME
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block text-slate-700" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-orange-400 text-xs font-mono tracking-widest uppercase">
                    Dashboard
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
            <NotificationBell />
          </div>
        </header>

        {/* ── Page title bar ── */}
        <div className="shrink-0 px-4 sm:px-6 pt-3 pb-2 border-b border-slate-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Terminal icon panel */}
              <div className="relative p-2 bg-orange-500/10 border border-orange-500/30">
                <CornerBrackets color="orange" />
                <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-widest uppercase text-orange-400 font-mono leading-tight">
                  Command Center
                </h1>
                <p className="text-[10px] text-slate-600 font-mono mt-0.5 tracking-wider">
                  SYSTEM · ANALYTICS · OVERVIEW
                </p>
              </div>
            </div>

            {/* System status panel */}
            <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
              <div className="flex items-center gap-1.5">
                <StatusDot active />
                <span className="text-orange-400/60">Systems Online</span>
              </div>
              <div className="w-px h-3 bg-slate-700" />
              <div className="flex items-center gap-1.5">
                <StatusDot active />
                <span className="text-orange-400/60">Data Sync Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main body ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">

          {/* Background grid */}
          <div className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(rgba(251,146,60,0.04) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(251,146,60,0.04) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />

          {/* Scan line animation */}
          <style>{`
            @keyframes scanline {
              0%   { top: 0%; opacity: 0; }
              5%   { opacity: 1; }
              95%  { opacity: 1; }
              100% { top: 100%; opacity: 0; }
            }
          `}</style>
          <ScanLine />

          {/* Content */}
          <div className="relative z-10 flex flex-col gap-4 py-4 px-0">

            {/* ── Section label ── */}
            <div className="px-4 sm:px-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-orange-500/30 to-transparent" />
              <span className="text-[10px] font-mono text-orange-500/60 uppercase tracking-widest shrink-0">
                ◈ Metrics Overview
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-orange-500/30 to-transparent" />
            </div>

            {/* ── Cards ── */}
            <SectionCards />

            {/* ── Section label ── */}
            <div className="px-4 sm:px-6 flex items-center gap-3 mt-2">
              <div className="h-px flex-1 bg-gradient-to-r from-orange-500/30 to-transparent" />
              <span className="text-[10px] font-mono text-orange-500/60 uppercase tracking-widest shrink-0">
                ◈ Telemetry · Activity &amp; Progress
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-orange-500/30 to-transparent" />
            </div>

            {/* ── Chart ── */}
            <div className="px-4 sm:px-6">
              <ChartAreaInteractive />
            </div>

            {/* Bottom spacer */}
            <div className="h-4" />
          </div>
        </div>

      </SidebarInset>
    </ProtectedPageWrapper>
  )
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function Page() {
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
              <DashboardContent />
            </Suspense>
          </SidebarProvider>
        </DashboardDataProvider>
      </FormatProvider>
    </UserProvider>
  )
}
