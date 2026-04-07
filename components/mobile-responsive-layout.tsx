"use client";

import React from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";

interface MobileResponsiveLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}

/**
 * Mobile Responsive Layout Wrapper
 * Provides consistent responsive behavior across all pages
 */
export function MobileResponsiveLayout({ 
  children, 
  header,
  breadcrumb 
}: MobileResponsiveLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-x-hidden">
        {header || (
          <header className="flex h-auto min-h-[56px] shrink-0 items-center gap-2 mobile-header">
            <div className="flex items-center gap-2 px-2 md:px-4 w-full flex-wrap">
              <SidebarTrigger className="mobile-sidebar-trigger -ml-1" />
              {breadcrumb && (
                <>
                  <Separator orientation="vertical" className="hidden sm:block mr-2 data-[orientation=vertical]:h-4" />
                  {breadcrumb}
                </>
              )}
            </div>
          </header>
        )}
        
        <main className="flex flex-1 flex-col gap-2 md:gap-4 p-2 md:p-4 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * Responsive Table Wrapper
 * Makes tables scrollable on mobile
 */
export function ResponsiveTableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="responsive-table-wrapper -mx-2 md:mx-0">
      {children}
    </div>
  );
}

/**
 * Responsive Grid for Cards
 * Automatically adjusts grid columns based on screen size
 */
export function ResponsiveCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-card-grid">
    {children}
    </div>
  );
}

/**
 * Page Header with Title
 */
export function PageHeader({ 
  title, 
  description,
  action
}: { 
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
      <div>
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm md:text-base text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Responsive Content Container
 */
export function ResponsiveContent({ 
  children,
  className = ""
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full max-w-full overflow-x-hidden ${className}`}>
      {children}
    </div>
  );
}

/**
 * Mobile Action Buttons Container
 * Stacks buttons vertically on mobile, horizontal on desktop
 */
export function MobileActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mobile-stack">
      {children}
    </div>
  );
}

/**
 * Responsive Form Grid
 * 1 column on mobile, 2 columns on tablet+
 */
export function ResponsiveFormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 lg:gap-6">
      {children}
    </div>
  );
}
