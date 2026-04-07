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
  FileStack, ListTodo
} from "lucide-react";
import { getUserPermissions, hasPermission } from "@/lib/utils/permissions";

// Icon mapping
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  SquareTerminal,
  Activity,
  Boxes,
  TicketCheck,
  FolderKanban,
  Users,
  Package,
  DollarSign,
  Wallet,
  UserCircle,
  UserPlus,
  Bot,
  BookOpen,
  Settings2,
  BarChart3,
  PieChart,
  FileStack,
  CalendarCheck,
  FileText,
  Database,
  LifeBuoy,
  Send,
};

interface SidebarModule {
  key: string;
  title: string;
  icon: string;
  items: { title: string; url: string }[];
}

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

  // Fetch sidebar modules and user data
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch sidebar modules
        const modulesRes = await fetch("/api/SidebarModules");
        if (modulesRes.ok) {
          const modulesData = await modulesRes.json();
          if (modulesData.success) {
            setSidebarModules(modulesData.modules);
          }
        }

        // Fetch user data
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

          // Fetch user permissions (skip for Super Admin)
          if (data.email && data.role !== "SuperAdmin") {
            const permissions = await getUserPermissions(data.email);
            setUserPermissions(permissions);
          } else if (data.role === "SuperAdmin") {
            // Super Admin gets all permissions
            setUserPermissions({
              modules: ["applications", "taskflow", "stash", "help-desk", "cloudflare", "user-accounts", "settings", "acculog"],
              submodules: ["*"]
            });
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  // Build dynamic sidebar data from fetched modules
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
      
      // Filter items to only those with access
      const accessibleItems = module.items
        .map((item) => {
          const permissionKey = `${module.key}:${item.title}`;
          return {
            title: item.title,
            url: item.url,
            hasAccess: hasPermission(userPermissions, permissionKey)
          };
        })
        .filter((item) => item.hasAccess); // Only keep accessible items
      
      // Only add module if it has accessible items
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
        { 
          title: "My Tasks", 
          url: "/dashboard/tasks", 
          icon: ListTodo,
          hasAccess: true
        },
        { 
          title: "Support", 
          url: "/support", 
          icon: LifeBuoy,
          hasAccess: true
        },
        { 
          title: "Feedback", 
          url: "/feedback", 
          icon: Send,
          hasAccess: true
        },
      ],
      projects: [
        { 
          name: "Acculog", 
          url: "/acculog/activity-logs", 
          icon: CalendarCheck,
          hasAccess: hasPermission(userPermissions, "acculog:Activity Logs")
        },
      ],
    };
  }, [sidebarModules, userPermissions, pathname]);

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <img src="/xchire-logo.png" className="w-8 h-8" alt="Logo" />
                <span className="font-medium">IT Portal</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={sidebarData.navMain} />
        <NavProjects projects={sidebarData.projects} />
        <NavSecondary items={sidebarData.navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
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
