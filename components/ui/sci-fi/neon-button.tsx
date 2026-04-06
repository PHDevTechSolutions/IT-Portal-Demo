"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface NeonButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

export function NeonButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className,
  type = "button",
}: NeonButtonProps) {
  const variants = {
    primary: {
      base: "bg-cyan-500/10 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/20 hover:border-cyan-400 hover:shadow-cyan-500/30",
      active: "shadow-[0_0_15px_rgba(6,182,212,0.4)]",
    },
    secondary: {
      base: "bg-slate-800/50 text-slate-300 border-slate-600 hover:bg-slate-700/50 hover:border-slate-500 hover:shadow-slate-500/20",
      active: "",
    },
    danger: {
      base: "bg-red-500/10 text-red-400 border-red-500/50 hover:bg-red-500/20 hover:border-red-400 hover:shadow-red-500/30",
      active: "shadow-[0_0_15px_rgba(239,68,68,0.4)]",
    },
    ghost: {
      base: "bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30",
      active: "",
    },
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative font-medium tracking-wide uppercase transition-all duration-200",
        "border rounded-lg",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none",
        variants[variant].base,
        sizes[size],
        !disabled && "hover:shadow-lg",
        className
      )}
    >
      {/* Glow effect line */}
      <span
        className={cn(
          "absolute bottom-0 left-1/2 -translate-x-1/2 h-px transition-all duration-200",
          variant === "primary" && "bg-cyan-400",
          variant === "danger" && "bg-red-400",
          variant === "secondary" && "bg-slate-400",
          disabled ? "w-0" : "w-1/2 group-hover:w-3/4"
        )}
      />

      {children}
    </button>
  );
}
