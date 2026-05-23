"use client";

import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavProjects({
  projects,
}: {
  projects: {
    name: string;
    url: string;
    icon: LucideIcon;
    hasAccess?: boolean;
  }[];
}) {
  const pathname = usePathname();
  const visible = projects.filter((p) => p.hasAccess !== false);
  if (visible.length === 0) return null;

  return (
    <SidebarGroup className="px-0 py-2 group-data-[collapsible=icon]:hidden">
      {/* Section label */}
      <SidebarGroupLabel className="px-3 mb-1 text-[9px] font-mono tracking-[0.2em] uppercase text-orange-500/40">
        ◈ Quick Access
      </SidebarGroupLabel>

      <SidebarMenu className="gap-0">
        {visible.map((item) => {
          const isActive = pathname?.startsWith(item.url);
          return (
            <SidebarMenuItem key={item.name} className="px-2">
              <SidebarMenuButton
                asChild
                className="
                  group/btn w-full flex items-center gap-2.5 px-2 py-1.5
                  text-slate-400 hover:text-orange-300
                  hover:bg-orange-500/8
                  rounded-none border-l-2 border-transparent
                  hover:border-orange-500/40
                  transition-all duration-150 text-xs font-mono
                "
                data-active={isActive}
                style={isActive ? {
                  borderLeftColor: "rgba(249,115,22,0.8)",
                  color: "rgb(253,186,116)",
                  backgroundColor: "rgba(249,115,22,0.08)",
                } : undefined}
              >
                <Link href={item.url} className="flex items-center gap-2.5 w-full">
                  <item.icon
                    className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                      isActive ? "text-orange-400" : "text-orange-500/50 group-hover/btn:text-orange-400"
                    }`}
                  />
                  <span className="flex-1 truncate tracking-wide">{item.name}</span>
                  {isActive && (
                    <span className="w-1 h-1 rounded-full bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.8)] shrink-0" />
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
