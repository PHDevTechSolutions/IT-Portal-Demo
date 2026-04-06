"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  glow?: "cyan" | "purple" | "green" | "amber" | "none";
}

export function GlassPanel({
  children,
  className,
  title,
  glow = "cyan",
}: GlassPanelProps) {
  const glowColors = {
    cyan: "shadow-cyan-500/20 border-cyan-500/30",
    purple: "shadow-purple-500/20 border-purple-500/30",
    green: "shadow-emerald-500/20 border-emerald-500/30",
    amber: "shadow-amber-500/20 border-amber-500/30",
    none: "border-slate-700",
  };

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden",
        "bg-slate-900/60 backdrop-blur-xl",
        "border shadow-lg",
        glowColors[glow],
        className
      )}
    >
      {/* Decorative top line */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-0.5",
          glow === "cyan" && "bg-gradient-to-r from-transparent via-cyan-500 to-transparent",
          glow === "purple" && "bg-gradient-to-r from-transparent via-purple-500 to-transparent",
          glow === "green" && "bg-gradient-to-r from-transparent via-emerald-500 to-transparent",
          glow === "amber" && "bg-gradient-to-r from-transparent via-amber-500 to-transparent",
          glow === "none" && "bg-slate-700"
        )}
      />

      {/* Title */}
      {title && (
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-200 tracking-wider uppercase">
            {title}
          </h3>
        </div>
      )}

      {/* Content */}
      <div className="p-4">{children}</div>

      {/* Corner accents */}
      <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-slate-500/50" />
      <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-slate-500/50" />
      <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-slate-500/50" />
      <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-slate-500/50" />
    </div>
  );
}
