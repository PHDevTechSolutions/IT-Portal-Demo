"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger, } from "@/components/ui/sidebar"
import { SectionCards } from "@/components/dashboard/cards/section-cards"
import { ChartAreaInteractive } from "@/components/dashboard/chart/progress"

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { DashboardDataProvider } from "@/contexts/DashboardDataContext";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { NotificationBell } from "@/components/notifications/NotificationBell";

function DashboardContent() {
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
        <header className="relative flex h-16 shrink-0 items-center gap-2 justify-between bg-slate-950/95 backdrop-blur-xl border-b border-cyan-500/30 overflow-hidden">
          {/* Corner brackets */}
          <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-cyan-500/50" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-cyan-500/50" />
          {/* Cyan glow line on bottom edge */}
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          
          <div className="flex items-center gap-2 px-4 relative z-10">
            <SidebarTrigger className="-ml-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10" />
            <Separator
              orientation="vertical"
              className="mr-2 h-4 bg-cyan-500/30"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2 px-4">
            <NotificationBell />
          </div>
        </header>

        {/* ✅ Main dashboard content */}
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
          
          <div className="relative z-10 @container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </ProtectedPageWrapper>
  )
}

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <DashboardDataProvider>
          <SidebarProvider>
            <Suspense fallback={<div>Loading...</div>}>
              <DashboardContent />
            </Suspense>
          </SidebarProvider>
        </DashboardDataProvider>
      </FormatProvider>
    </UserProvider>
  );
}
