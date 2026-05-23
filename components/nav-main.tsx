"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    hasAccess?: boolean;
    items?: {
      title: string;
      url: string;
      hasAccess?: boolean;
    }[];
  }[];
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup className="px-0 py-2">
      {/* Section label */}
      <SidebarGroupLabel className="px-3 mb-1 text-[9px] font-mono tracking-[0.2em] uppercase text-orange-500/40">
        ◈ Platform
      </SidebarGroupLabel>

      <SidebarMenu className="gap-0">
        {items.map((item) =>
          item.hasAccess === false ? null : (
            <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
              <SidebarMenuItem className="px-2">
                {/* Parent button */}
                {item.items?.length ? (
                  <SidebarMenuButton
                    tooltip={item.title}
                    className="
                      group/btn w-full flex items-center gap-2.5 px-2 py-1.5
                      text-slate-400 hover:text-orange-300
                      hover:bg-orange-500/8
                      rounded-none border-l-2 border-transparent
                      hover:border-orange-500/40
                      data-[active=true]:border-orange-500
                      data-[active=true]:text-orange-300
                      data-[active=true]:bg-orange-500/10
                      transition-all duration-150 text-xs font-mono
                    "
                    data-active={item.isActive}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0 text-orange-500/60 group-hover/btn:text-orange-400 transition-colors" />
                    <span className="flex-1 truncate tracking-wide">{item.title}</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    className="
                      group/btn w-full flex items-center gap-2.5 px-2 py-1.5
                      text-slate-400 hover:text-orange-300
                      hover:bg-orange-500/8
                      rounded-none border-l-2 border-transparent
                      hover:border-orange-500/40
                      transition-all duration-150 text-xs font-mono
                    "
                  >
                    <Link href={item.url}>
                      <item.icon className="h-3.5 w-3.5 shrink-0 text-orange-500/60 group-hover/btn:text-orange-400 transition-colors" />
                      <span className="flex-1 truncate tracking-wide">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                )}

                {/* Chevron toggle */}
                {item.items?.length ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction
                        className="
                          right-3 text-slate-600 hover:text-orange-400
                          hover:bg-transparent
                          data-[state=open]:rotate-90
                          transition-all duration-200
                        "
                      >
                        <ChevronRight className="h-3 w-3" />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 border-l border-orange-500/15 pl-0 py-0.5 gap-0">
                        {item.items.map((subItem) =>
                          subItem.hasAccess === false ? null : (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname === subItem.url}
                                className="
                                  group/sub flex items-center gap-2 pl-3 pr-2 py-1
                                  text-[11px] font-mono tracking-wide
                                  text-slate-500 hover:text-orange-300
                                  hover:bg-orange-500/8
                                  rounded-none border-l-2 border-transparent
                                  hover:border-orange-400/40
                                  data-[active=true]:border-orange-400
                                  data-[active=true]:text-orange-300
                                  data-[active=true]:bg-orange-500/10
                                  transition-all duration-150
                                "
                              >
                                <Link href={subItem.url}>
                                  {/* Active indicator dot */}
                                  <span
                                    className={`
                                      w-1 h-1 rounded-full shrink-0 transition-colors
                                      ${pathname === subItem.url
                                        ? "bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.8)]"
                                        : "bg-slate-700 group-hover/sub:bg-orange-500/50"
                                      }
                                    `}
                                  />
                                  <span className="truncate">{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
