"use client";

/**
 * PageShell
 *
 * Shared layout wrapper for all authenticated pages.
 * Provides the dark terminal header, breadcrumb, title bar,
 * background grid, and scan-line animation consistent with the dashboard.
 *
 * Usage:
 *   <PageShell
 *     breadcrumbs={[{ label: "Taskflow", href: "/taskflow/customer-database" }]}
 *     title="Customer Database"
 *     subtitle="RECORDS · MANAGEMENT · CRM"
 *     icon={<Database className="w-4 h-4 text-orange-400" />}
 *   >
 *     {children}
 *   </PageShell>
 */

import React from "react";
import {
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

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
        className="pointer-events-none absolute left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/25 to-transparent"
        style={{ animation: "scanline 8s linear infinite", top: 0 }}
      />
    </>
  );
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot() {
  return (
    <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]" />
  );
}

// ─── Corner brackets ──────────────────────────────────────────────────────────

function CornerBrackets() {
  return (
    <>
      <div className="absolute top-0 left-0 w-2.5 h-2.5 border-l border-t border-orange-500/50" />
      <div className="absolute top-0 right-0 w-2.5 h-2.5 border-r border-t border-orange-500/50" />
      <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l border-b border-orange-500/50" />
      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r border-b border-orange-500/50" />
    </>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BreadcrumbEntry {
  label: string;
  href?: string;
}

interface PageShellProps {
  /** Breadcrumb trail — last entry becomes the current page label */
  breadcrumbs: BreadcrumbEntry[];
  /** Page title shown in the title bar */
  title: string;
  /** Small subtitle below the title (optional) */
  subtitle?: string;
  /** Icon shown in the title panel (optional) */
  icon?: React.ReactNode;
  /** Right-side status labels in the title bar (optional) */
  statusItems?: string[];
  /** Right-side slot in the header (e.g. NotificationBell) */
  headerRight?: React.ReactNode;
  /** Page body content */
  children: React.ReactNode;
  /** Extra className on the scrollable body wrapper */
  bodyClassName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PageShell({
  breadcrumbs,
  title,
  subtitle,
  icon,
  statusItems,
  headerRight,
  children,
  bodyClassName = "",
}: PageShellProps) {
  const crumbs = breadcrumbs;
  const lastCrumb = crumbs[crumbs.length - 1];
  const parentCrumbs = crumbs.slice(0, -1);

  return (
    <SidebarInset className="bg-[#0a0d14] text-slate-100 flex flex-col h-svh overflow-hidden">

      {/* ── Top header ── */}
      <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-orange-500/20 bg-[#0d1117]/90 backdrop-blur-sm overflow-hidden">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/50" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/50" />

        <div className="flex items-center gap-2 px-4 relative z-10">
          <SidebarTrigger className="-ml-1 text-orange-400/70 hover:text-orange-300 hover:bg-orange-500/10" />
          <Separator orientation="vertical" className="h-4 bg-orange-500/20" />
          <Breadcrumb>
            <BreadcrumbList>
              {parentCrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink
                      href={crumb.href ?? "#"}
                      className="text-slate-500 hover:text-orange-400 text-xs font-mono uppercase tracking-wider"
                    >
                      {crumb.label}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block text-slate-700" />
                </React.Fragment>
              ))}
              <BreadcrumbItem>
                <BreadcrumbPage className="text-orange-400 text-xs font-mono tracking-widest uppercase">
                  {lastCrumb.label}
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
          {headerRight}
        </div>
      </header>

      {/* ── Title bar ── */}
      <div className="shrink-0 px-4 sm:px-6 pt-3 pb-2 border-b border-slate-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="relative p-2 bg-orange-500/10 border border-orange-500/30 shrink-0">
                <CornerBrackets />
                {icon}
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold tracking-widest uppercase text-orange-400 font-mono leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[10px] text-slate-600 font-mono mt-0.5 tracking-wider uppercase">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {statusItems && statusItems.length > 0 && (
            <div className="hidden md:flex items-center gap-3 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
              {statusItems.map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <div className="w-px h-3 bg-slate-700" />}
                  <div className="flex items-center gap-1.5">
                    <StatusDot />
                    <span className="text-orange-400/60">{item}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className={`flex-1 overflow-y-auto overflow-x-hidden relative ${bodyClassName}`}>
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
        <div className="relative z-10">
          {children}
        </div>
      </div>

    </SidebarInset>
  );
}
