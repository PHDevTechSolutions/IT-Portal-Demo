"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavMain } from "../components/nav-main";
import { NavProjects } from "../components/nav-projects";
import { NavSecondary } from "../components/nav-secondary";
import { NavUser } from "../components/nav-user";
import {
  BookOpen, Bot, SquareTerminal, Settings2, LifeBuoy, Send,
  Activity, Boxes, TicketCheck, CalendarCheck, FileText, Database,
  LucideIcon, LayoutDashboard, Users, FolderKanban, Package,
  DollarSign, Wallet, UserCircle, UserPlus, BarChart3, PieChart,
  FileStack, ListTodo,
} from "lucide-react";
import { getUserPermissions, hasPermission } from "@/lib/utils/permissions";

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, SquareTerminal, Activity, Boxes, TicketCheck,
  FolderKanban, Users, Package, DollarSign, Wallet, UserCircle,
  UserPlus, Bot, BookOpen, Settings2, BarChart3, PieChart, FileStack,
  CalendarCheck, FileText, Database, LifeBuoy, Send,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarModule {
  key: string;
  title: string;
  icon: string;
  items: { title: string; url: string }[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const [userDetails, setUserDetails] = React.useState({
    UserId: "",
    Firstname: "",
    Lastname: "",
    Email: "",
    profilePicture: "",
    Role: "",
  });

  const [userPermissions, setUserPermissions] = React.useState({
    modules: [] as string[],
    submodules: [] as string[],
  });

  const [sidebarModules, setSidebarModules] = React.useState<SidebarModule[]>([]);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const modulesRes = await fetch("/api/SidebarModules");
        if (modulesRes.ok) {
          const modulesData = await modulesRes.json();
          if (modulesData.success) setSidebarModules(modulesData.modules);
        }

        const userRes = await fetch("/api/me", { cache: "no-store" });
        if (userRes.ok) {
          const data = await userRes.json();
          setUserDetails({
            UserId: data.userId ?? "",
            Firstname: data.firstname ?? "",
            Lastname: data.lastname ?? "",
            Email: data.email ?? "",
            profilePicture: data.profilePicture ?? "/avatars/default.jpg",
            Role: data.role ?? "",
          });

          if (data.email && data.role !== "SuperAdmin") {
            const permissions = await getUserPermissions(data.email);
            setUserPermissions(permissions);
          } else if (data.role === "SuperAdmin") {
            setUserPermissions({
              modules: ["applications", "taskflow", "stash", "help-desk", "cloudflare", "user-accounts", "settings", "acculog"],
              submodules: ["*"],
            });
          }
        }
      } catch (error) {
        console.error("Error fetching sidebar data:", error);
      }
    };
    fetchData();
  }, []);

  const sidebarData = React.useMemo(() => {
    const navMain: {
      title: string;
      url: string;
      icon: LucideIcon;
      isActive?: boolean;
      items: { title: string; url: string; hasAccess: boolean }[];
    }[] = [];

    sidebarModules.forEach((module) => {
      const IconComponent = ICON_MAP[module.icon] || SquareTerminal;
      const accessibleItems = module.items
        .map((item) => ({
          title: item.title,
          url: item.url,
          hasAccess: hasPermission(userPermissions, `${module.key}:${item.title}`),
        }))
        .filter((item) => item.hasAccess);

      if (accessibleItems.length > 0) {
        navMain.push({
          title: module.title,
          url: "#",
          icon: IconComponent,
          isActive: pathname?.startsWith(`/${module.key}`),
          items: accessibleItems,
        });
      }
    });

    return {
      navMain,
      navSecondary: [
        { title: "My Tasks",   url: "/dashboard/tasks",      icon: ListTodo,      hasAccess: true },
        { title: "Support",    url: "/support",               icon: LifeBuoy,      hasAccess: true },
        { title: "Feedback",   url: "/feedback",              icon: Send,          hasAccess: true },
        { title: "API Tester", url: "/settings/api-tester",   icon: SquareTerminal, hasAccess: true },
      ],
      projects: [
        { name: "Acculog",         url: "/acculog/activity-logs",    icon: CalendarCheck, hasAccess: hasPermission(userPermissions, "acculog:Activity Logs") },
        { name: "Data Management", url: "/acculog/data-management",  icon: Database,      hasAccess: hasPermission(userPermissions, "acculog:Data Management") },
      ],
    };
  }, [sidebarModules, userPermissions, pathname]);

  return (
    <Sidebar
      variant="sidebar"
      className="border-none bg-[#0d1117] text-slate-300"
      {...props}
    >
      {/* ── Header ── */}
      <SidebarHeader className="bg-[#0d1117] border-b border-orange-500/15 px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-orange-500/10 rounded-none">
              <Link href="/dashboard" className="flex items-center gap-2.5">
                {/* Logo with orange glow */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-orange-500/20 blur-sm rounded" />
                  <img
                    src="/xchire-logo.png"
                    className="relative w-7 h-7"
                    alt="Logo"
                  />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-bold tracking-widest uppercase text-orange-400 font-mono">
                    IT Portal
                  </span>
                  <span className="text-[9px] text-slate-600 tracking-widest uppercase font-mono">
                    ERP System
                  </span>
                </div>
                {/* Live dot */}
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)] shrink-0" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent className="bg-[#0d1117] px-0">
        <NavMain items={sidebarData.navMain} />
        <NavProjects projects={sidebarData.projects} />
        <NavSecondary items={sidebarData.navSecondary} className="mt-auto" />
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="bg-[#0d1117] border-t border-orange-500/15 px-2 py-2">
        <NavUser
          user={{
            id: userDetails.UserId,
            name: `${userDetails.Firstname} ${userDetails.Lastname}`,
            email: userDetails.Email,
            avatar: userDetails.profilePicture,
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
