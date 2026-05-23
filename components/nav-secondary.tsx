"use client";

import * as React from "react";
import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    hasAccess?: boolean;
  }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname();
  const visible = items.filter((i) => i.hasAccess !== false);
  if (visible.length === 0) return null;

  return (
    <SidebarGroup className="px-0 py-2" {...props}>
      {/* Divider line */}
      <div className="mx-3 mb-2 h-px bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-transparent" />

      <SidebarGroupLabel className="px-3 mb-1 text-[9px] font-mono tracking-[0.2em] uppercase text-orange-500/40">
        ◈ Tools
      </SidebarGroupLabel>

      <SidebarGroupContent>
        <SidebarMenu className="gap-0">
          {visible.map((item) => {
            const isActive = pathname === item.url;
            return (
              <SidebarMenuItem key={item.title} className="px-2">
                <SidebarMenuButton
                  asChild
                  size="sm"
                  className="
                    group/btn w-full flex items-center gap-2.5 px-2 py-1
                    text-slate-500 hover:text-orange-300
                    hover:bg-orange-500/8
                    rounded-none border-l-2 border-transparent
                    hover:border-orange-500/30
                    transition-all duration-150 text-[11px] font-mono
                  "
                  style={isActive ? {
                    borderLeftColor: "rgba(249,115,22,0.6)",
                    color: "rgb(253,186,116)",
                    backgroundColor: "rgba(249,115,22,0.08)",
                  } : undefined}
                >
                  <Link href={item.url} className="flex items-center gap-2.5 w-full">
                    <item.icon
                      className={`h-3 w-3 shrink-0 transition-colors ${
                        isActive ? "text-orange-400" : "text-slate-600 group-hover/btn:text-orange-400/70"
                      }`}
                    />
                    <span className="flex-1 truncate tracking-wide">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
