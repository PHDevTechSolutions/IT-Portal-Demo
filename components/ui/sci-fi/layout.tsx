"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SciFiLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function SciFiLayout({ children, className }: SciFiLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-[#0a0f1a]", className)}>
      {/* Background grid effect */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />
      {children}
    </div>
  );
}

interface SciFiThreeColumnProps {
  leftPanel: React.ReactNode;
  centerContent: React.ReactNode;
  rightPanel: React.ReactNode;
  leftWidth?: string;
  rightWidth?: string;
}

export function SciFiThreeColumn({
  leftPanel,
  centerContent,
  rightPanel,
  leftWidth = "w-80",
  rightWidth = "w-80",
}: SciFiThreeColumnProps) {
  return (
    <div className="flex gap-4 p-4 h-[calc(100vh-4rem)]">
      {/* Left Panel - Dialogs */}
      <div className={cn("flex-shrink-0", leftWidth)}>
        <div className="h-full overflow-y-auto pr-2">
          {leftPanel}
        </div>
      </div>

      {/* Center - Main Table */}
      <div className="flex-1 min-w-0">
        <div className="h-full overflow-hidden flex flex-col">
          {centerContent}
        </div>
      </div>

      {/* Right Panel - Filters */}
      <div className={cn("flex-shrink-0", rightWidth)}>
        <div className="h-full overflow-y-auto pl-2">
          {rightPanel}
        </div>
      </div>
    </div>
  );
}

interface SciFiPanelProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  glowColor?: "cyan" | "purple" | "amber";
}

export function SciFiPanel({ 
  children, 
  title, 
  className,
  glowColor = "cyan" 
}: SciFiPanelProps) {
  const glowColors = {
    cyan: "border-cyan-500/30 shadow-cyan-500/10",
    purple: "border-purple-500/30 shadow-purple-500/10",
    amber: "border-amber-500/30 shadow-amber-500/10",
  };

  const headerColors = {
    cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-400",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  };

  return (
    <div 
      className={cn(
        "relative rounded-xl overflow-hidden",
        "bg-slate-900/80 backdrop-blur-xl border",
        glowColors[glowColor],
        "shadow-lg",
        className
      )}
    >
      {/* Top glow line */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 h-px",
          glowColor === "cyan" && "bg-gradient-to-r from-transparent via-cyan-500 to-transparent",
          glowColor === "purple" && "bg-gradient-to-r from-transparent via-purple-500 to-transparent",
          glowColor === "amber" && "bg-gradient-to-r from-transparent via-amber-500 to-transparent"
        )}
      />

      {/* Title */}
      {title && (
        <div className={cn("px-4 py-3 border-b", headerColors[glowColor])}>
          <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
            {title}
          </h3>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {children}
      </div>

      {/* Corner accents */}
      <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-slate-500/30" />
      <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-slate-500/30" />
      <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-slate-500/30" />
      <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-slate-500/30" />
    </div>
  );
}

export function SciFiHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-4 py-3 border-b border-cyan-500/20 bg-slate-900/50">
      <div className="flex items-center gap-3">
        {/* Decorative element */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <div className="w-1 h-1 rounded-full bg-cyan-400" />
          <div className="w-1 h-1 rounded-full bg-cyan-300" />
        </div>
        
        <div>
          <h1 className="text-xl font-bold text-cyan-400 tracking-wider uppercase">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
