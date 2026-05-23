"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Bell, ChevronsUpDown, LogOut, User } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface NavUserProps {
  user: {
    id?: string;
    name: string;
    email: string;
    avatar: string;
  };
}

// ─── Logout / nav overlay ─────────────────────────────────────────────────────

function FullscreenOverlay({ label, progress }: { label: string; progress: number }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0d14]/90 backdrop-blur-sm">
      {/* Corner brackets */}
      <div className="absolute top-6 left-6 w-6 h-6 border-l-2 border-t-2 border-orange-500/50" />
      <div className="absolute top-6 right-6 w-6 h-6 border-r-2 border-t-2 border-orange-500/50" />
      <div className="absolute bottom-6 left-6 w-6 h-6 border-l-2 border-b-2 border-orange-500/50" />
      <div className="absolute bottom-6 right-6 w-6 h-6 border-r-2 border-b-2 border-orange-500/50" />

      <div className="flex flex-col items-center gap-4 w-64">
        {/* Animated dot */}
        <div className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.9)] animate-pulse" />
        <p className="text-orange-400 font-mono text-xs tracking-[0.2em] uppercase">{label}</p>

        {/* Progress bar */}
        <div className="w-full h-px bg-slate-800 relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-orange-500 to-orange-300 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-orange-300/60 to-transparent"
            style={{ left: `${progress - 4}%`, transition: "left 0.15s" }}
          />
        </div>

        <p className="text-slate-600 font-mono text-[10px] tracking-widest">{progress}%</p>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NavUser({ user }: NavUserProps) {
  const router = useRouter();
  const [overlay, setOverlay] = useState<{ label: string; progress: number } | null>(null);

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  // ── Shared progress runner ────────────────────────────────────────────────
  const runProgress = (label: string, onDone: () => void) => {
    setOverlay({ label, progress: 0 });
    let value = 0;
    const interval = setInterval(() => {
      value += 12;
      setOverlay({ label, progress: Math.min(value, 100) });
      if (value >= 100) {
        clearInterval(interval);
        setTimeout(onDone, 200);
      }
    }, 120);
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    toast.info("Signing out…");
    runProgress("Terminating session", async () => {
      await fetch("/api/logout", { method: "POST" }).catch(() => {});
      try { localStorage.removeItem("deviceId"); } catch {}
      toast.success("Session terminated.");
      router.replace("/Login");
    });
  };

  // ── Account ───────────────────────────────────────────────────────────────
  const handleAccount = () => {
    runProgress("Loading account", () => {
      setOverlay(null);
      router.push("/account");
    });
  };

  return (
    <>
      {overlay && <FullscreenOverlay label={overlay.label} progress={overlay.progress} />}

      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="
                  group w-full flex items-center gap-2.5 px-2 py-2
                  bg-transparent hover:bg-orange-500/8
                  border border-transparent hover:border-orange-500/20
                  rounded-none transition-all duration-150
                  text-slate-400 hover:text-orange-300
                  focus-visible:outline-none focus-visible:ring-0
                "
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-sm bg-orange-500/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Avatar className="h-7 w-7 rounded-sm border border-orange-500/20 relative">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-sm bg-orange-500/10 text-orange-400 text-[10px] font-mono font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 border border-[#0d1117] shadow-[0_0_4px_rgba(251,146,60,0.8)]" />
                </div>

                {/* Name / email */}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[11px] font-mono font-semibold text-slate-300 truncate tracking-wide leading-tight">
                    {user.name || "Unknown"}
                  </p>
                  <p className="text-[9px] font-mono text-slate-600 truncate tracking-wider leading-tight mt-0.5">
                    {user.email || "—"}
                  </p>
                </div>

                <ChevronsUpDown className="h-3 w-3 text-slate-600 group-hover:text-orange-400/60 shrink-0 transition-colors" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            {/* Dropdown */}
            <DropdownMenuContent
              className="
                min-w-56 rounded-none
                bg-[#0d1117] border border-orange-500/20
                text-slate-300 shadow-[0_8px_32px_rgba(0,0,0,0.6)]
                p-0 overflow-hidden
              "
              side="top"
              align="end"
              sideOffset={6}
            >
              {/* User info header */}
              <DropdownMenuLabel className="p-0 font-normal border-b border-orange-500/15">
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <Avatar className="h-8 w-8 rounded-sm border border-orange-500/20">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-sm bg-orange-500/10 text-orange-400 text-xs font-mono font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono font-semibold text-orange-300 truncate tracking-wide">
                      {user.name || "Unknown"}
                    </p>
                    <p className="text-[9px] font-mono text-slate-600 truncate tracking-wider mt-0.5">
                      {user.email || "—"}
                    </p>
                  </div>
                  {/* Status */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.8)]" />
                    <span className="text-[9px] font-mono text-orange-400/60 uppercase tracking-widest">Online</span>
                  </div>
                </div>
              </DropdownMenuLabel>

              {/* Actions */}
              <DropdownMenuGroup className="p-1">
                <DropdownMenuItem
                  onSelect={handleAccount}
                  className="
                    flex items-center gap-2.5 px-2 py-1.5
                    text-[11px] font-mono text-slate-400
                    hover:text-orange-300 hover:bg-orange-500/10
                    rounded-none cursor-pointer
                    focus:bg-orange-500/10 focus:text-orange-300
                    border-l-2 border-transparent hover:border-orange-500/40
                    transition-all duration-150
                  "
                >
                  <BadgeCheck className="h-3.5 w-3.5 text-orange-500/60" />
                  <span className="tracking-wide">Account</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="
                    flex items-center gap-2.5 px-2 py-1.5
                    text-[11px] font-mono text-slate-400
                    hover:text-orange-300 hover:bg-orange-500/10
                    rounded-none cursor-pointer
                    focus:bg-orange-500/10 focus:text-orange-300
                    border-l-2 border-transparent hover:border-orange-500/40
                    transition-all duration-150
                  "
                >
                  <Bell className="h-3.5 w-3.5 text-orange-500/60" />
                  <span className="tracking-wide">Notifications</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="bg-orange-500/10 my-0" />

              {/* Logout */}
              <div className="p-1">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="
                    flex items-center gap-2.5 px-2 py-1.5
                    text-[11px] font-mono text-red-500/70
                    hover:text-red-400 hover:bg-red-500/10
                    rounded-none cursor-pointer
                    focus:bg-red-500/10 focus:text-red-400
                    border-l-2 border-transparent hover:border-red-500/40
                    transition-all duration-150
                  "
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="tracking-wide">Sign Out</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
