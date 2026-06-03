"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavMain }      from "../components/nav-main";
import { NavSecondary } from "../components/nav-secondary";
import { NavUser }      from "../components/nav-user";
import {
  BookOpen, Bot, SquareTerminal, Settings2, LifeBuoy, Send,
  Activity, Boxes, TicketCheck, CalendarCheck, FileText, Database,
  LucideIcon, LayoutDashboard, Users, FolderKanban, Package,
  DollarSign, Wallet, UserCircle, UserPlus, BarChart3, PieChart,
  FileStack, ListTodo, ClipboardList, Key,
} from "lucide-react";
import { getUserPermissions, hasPermission } from "@/lib/utils/permissions";

// ─── Master bypass ReferenceID ────────────────────────────────────────────────
const MASTER_REF_ID = "XLGR-GLOBAL-ERP-000000";

// ─── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, SquareTerminal, Activity, Boxes, TicketCheck,
  FolderKanban, Users, Package, DollarSign, Wallet, UserCircle,
  UserPlus, Bot, BookOpen, Settings2, BarChart3, PieChart, FileStack,
  CalendarCheck, FileText, Database, LifeBuoy, Send,
};

// ─── navSecondary config with required permission keys ────────────────────────
// permKey: null = always visible, string = must have that permission
const NAV_SECONDARY = [
  { title: "My Tasks",       url: "/dashboard/tasks",         icon: ListTodo,       permKey: null },
  { title: "Attendance",     url: "/hr/attendance",           icon: ClipboardList,  permKey: "hr:Attendance" },
  { title: "AI Credentials", url: "/settings/ai-credentials", icon: Key,            permKey: "settings:AI Credentials" },
  { title: "Support",        url: "/support",                 icon: LifeBuoy,       permKey: null },
  { title: "Feedback",       url: "/feedback",                icon: Send,           permKey: null },
  { title: "API Tester",     url: "/settings/api-tester",     icon: SquareTerminal, permKey: "settings:General" },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface SidebarModule {
  key: string; title: string; icon: string;
  items: { title: string; url: string }[];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const [userDetails, setUserDetails] = React.useState({
    UserId: "", Firstname: "", Lastname: "",
    Email: "", profilePicture: "", Role: "", ReferenceID: "",
  });

  const [userPermissions, setUserPermissions] = React.useState({
    modules: [] as string[],
    submodules: [] as string[],
  });

  const [isMaster,       setIsMaster]       = React.useState(false);
  const [sidebarModules, setSidebarModules] = React.useState<SidebarModule[]>([]);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch sidebar modules
        const modulesRes = await fetch("/api/SidebarModules");
        if (modulesRes.ok) {
          const modulesData = await modulesRes.json();
          if (modulesData.success) setSidebarModules(modulesData.modules);
        }

        // Fetch current user
        const userRes = await fetch("/api/me", { cache: "no-store" });
        if (!userRes.ok) return;
        const data = await userRes.json();

        const referenceId = data.referenceId ?? data.referenceID ?? data.ReferenceID ?? "";

        setUserDetails({
          UserId:         data.userId         ?? "",
          Firstname:      data.firstname       ?? "",
          Lastname:       data.lastname        ?? "",
          Email:          data.email           ?? "",
          profilePicture: data.profilePicture  ?? "/avatars/default.jpg",
          Role:           data.role            ?? "",
          ReferenceID:    referenceId,
        });

        // ── Master bypass: sees everything ──────────────────────────────────
        if (referenceId === MASTER_REF_ID) {
          setIsMaster(true);
          setUserPermissions({ modules: ["*"], submodules: ["*"] });
          return;
        }

        // ── Everyone else: use their actual Directories permissions ─────────
        if (data.email) {
          const permissions = await getUserPermissions(data.email);
          setUserPermissions(permissions);
        }
      } catch (error) {
        console.error("Error fetching sidebar data:", error);
      }
    };
    fetchData();
  }, []);

  const sidebarData = React.useMemo(() => {
    const navMain: {
      title: string; url: string; icon: LucideIcon;
      isActive?: boolean;
      items: { title: string; url: string; hasAccess: boolean }[];
    }[] = [];

    sidebarModules.forEach((module) => {
      const IconComponent = ICON_MAP[module.icon] || SquareTerminal;

      const accessibleItems = module.items
        .map((item) => ({
          title: item.title,
          url:   item.url,
          // Master sees all; everyone else filtered by their Directories
          hasAccess: isMaster
            ? true
            : hasPermission(userPermissions, `${module.key}:${item.title}`),
        }))
        .filter((item) => item.hasAccess);

      if (accessibleItems.length > 0) {
        navMain.push({
          title:    module.title,
          url:      "#",
          icon:     IconComponent,
          isActive: pathname?.startsWith(`/${module.key}`),
          items:    accessibleItems,
        });
      }
    });

    // Filter navSecondary by permissions too
    const navSecondary = NAV_SECONDARY
      .filter(item => {
        if (isMaster) return true;
        if (item.permKey === null) return true; // always visible
        return hasPermission(userPermissions, item.permKey);
      })
      .map(item => ({ ...item, hasAccess: true }));

    return { navMain, navSecondary };
  }, [sidebarModules, userPermissions, isMaster, pathname]);

  return (
    <Sidebar variant="sidebar" className="border-none bg-[#0d1117] text-slate-300" {...props}>

      {/* ── Header ── */}
      <SidebarHeader className="bg-[#0d1117] border-b border-orange-500/15 px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-orange-500/10 rounded-none">
              <Link href="/dashboard" className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-orange-500/20 blur-sm rounded" />
                  <img src="/xchire-logo.png" className="relative w-7 h-7" alt="Logo" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-bold tracking-widest uppercase text-orange-400 font-mono">IT Portal</span>
                  <span className="text-[9px] text-slate-600 tracking-widest uppercase font-mono">ERP System</span>
                </div>
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)] shrink-0" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent className="bg-[#0d1117] px-0 custom-scrollbar">
        <NavMain items={sidebarData.navMain} />
        <NavSecondary items={sidebarData.navSecondary} className="mt-auto" />
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="bg-[#0d1117] border-t border-orange-500/15 px-2 py-2">
        <NavUser
          user={{
            id:     userDetails.UserId,
            name:   `${userDetails.Firstname} ${userDetails.Lastname}`,
            email:  userDetails.Email,
            avatar: userDetails.profilePicture,
          }}
        />
      </SidebarFooter>

    </Sidebar>
  );
}