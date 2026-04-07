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
import { BookOpen, Bot, SquareTerminal, Settings2, LifeBuoy, Send, Activity, Boxes, TicketCheck, CalendarCheck, FileText, Database, } from "lucide-react";
import { getUserPermissions, hasPermission } from "@/lib/utils/permissions";

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

  React.useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setUserDetails({
            UserId: data.userId ?? "",
            Firstname: data.firstname ?? "",
            Lastname: data.lastname ?? "",
            Email: data.email ?? "",
            profilePicture: data.profilePicture ?? "/avatars/default.jpg",
            Role: data.role ?? "",
          });

          // Fetch user permissions
          if (data.email) {
            const permissions = await getUserPermissions(data.email);
            setUserPermissions(permissions);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUserData();
  }, []);

  const sidebarData = {
    navMain: [
      {
        title: "Audit Logs",
        url: "#",
        icon: FileText,
        isActive: pathname?.startsWith("/audit-logs") || pathname?.startsWith("/admin/audit-settings"),
        items: [
          { 
            title: "View Logs", 
            url: "/audit-logs",
            hasAccess: hasPermission(userPermissions, "audit-logs")
          },
          { 
            title: "Settings", 
            url: "/admin/audit-settings",
            hasAccess: hasPermission(userPermissions, "admin/audit-settings")
          },
        ],
      },
      {
        title: "Applications",
        url: "#",
        icon: SquareTerminal,
        isActive: pathname?.startsWith("/application"),
        items: [{ 
          title: "Modules", 
          url: "/application/modules",
          hasAccess: hasPermission(userPermissions, "application/modules")
        }],
      },
      {
        title: "Taskflow",
        url: "#",
        icon: Activity,
        isActive: pathname?.startsWith("/taskflow"),
        items: [
          { 
            title: "Customer Database", 
            url: "/taskflow/customer-database",
            hasAccess: hasPermission(userPermissions, "taskflow/customer-database")
          },
          { 
            title: "Removal Accounts", 
            url: "/taskflow/removal-accounts",
            hasAccess: hasPermission(userPermissions, "taskflow/removal-accounts")
          },
          { 
            title: "Customer Audits", 
            url: "/taskflow/customer-audits",
            hasAccess: hasPermission(userPermissions, "taskflow/customer-audits")
          },
          { 
            title: "Approval of Accounts", 
            url: "/taskflow/customer-approval",
            hasAccess: hasPermission(userPermissions, "taskflow/customer-approval")
          },
          { 
            title: "Activity Logs", 
            url: "/taskflow/activity-logs",
            hasAccess: hasPermission(userPermissions, "taskflow/activity-logs")
          },
          { 
            title: "Progress Logs", 
            url: "/taskflow/progress-logs",
            hasAccess: hasPermission(userPermissions, "taskflow/progress-logs")
          },
          { 
            title: "Endorsed Tickets", 
            url: "/taskflow/csr-inquiries",
            hasAccess: hasPermission(userPermissions, "taskflow/csr-inquiries")
          },
        ],
      },
      {
        title: "Stash",
        url: "#",
        icon: Boxes,
        isActive: pathname?.startsWith("/stash"),
        items: [
          { 
            title: "Inventory", 
            url: "/stash/inventory",
            hasAccess: hasPermission(userPermissions, "stash/inventory")
          },
          { 
            title: "Assigned Assets", 
            url: "/stash/assigned-assets",
            hasAccess: hasPermission(userPermissions, "stash/assigned-assets")
          },
          { 
            title: "License", 
            url: "/stash/license",
            hasAccess: hasPermission(userPermissions, "stash/license")
          },
        ],
      },
      {
        title: "Help Desk",
        url: "#",
        icon: TicketCheck,
        isActive: pathname?.startsWith("/ticketing"),
        items: [
          { 
            title: "Tickets", 
            url: "/ticketing",
            hasAccess: hasPermission(userPermissions, "ticketing")
          },
          { 
            title: "Service Catalogue", 
            url: "/ticketing/service-catalogue",
            hasAccess: hasPermission(userPermissions, "ticketing/service-catalogue")
          },
        ],
      },
      {
        title: "CloudFlare",
        url: "#",
        icon: Bot,
        isActive: pathname?.startsWith("/cloudflare"),
        items: [
          { 
            title: "DNS", 
            url: "/cloudflare/dns",
            hasAccess: hasPermission(userPermissions, "cloudflare/dns")
          }
        ],
      },
      {
        title: "User Accounts",
        url: "#",
        icon: BookOpen,
        isActive: pathname?.startsWith("/admin"),
        items: [
          { 
            title: "Roles", 
            url: "/admin/roles",
            hasAccess: hasPermission(userPermissions, "admin/roles")
          },
          { 
            title: "Resigned and Terminated", 
            url: "/admin/roles-status",
            hasAccess: hasPermission(userPermissions, "admin/users")
          },
          { 
            title: "Sessions", 
            url: "/admin/sessions",
            hasAccess: hasPermission(userPermissions, "admin/sessions")
          },
          ...(hasPermission(userPermissions, "admin/it-permissions") ? [{ 
            title: "IT Permissions", 
            url: "/admin/it-permissions" 
          }] : []),
        ],
      },
      {
        title: "Settings",
        url: "#",
        icon: Settings2,
        isActive: pathname?.startsWith("/settings") || pathname?.startsWith("/admin/backup-database"),
        items: [
          { 
            title: "General", 
            url: "/settings/general",
            hasAccess: hasPermission(userPermissions, "settings/general")
          },
          { 
            title: "Database Backup", 
            url: "/admin/backup-database",
            hasAccess: hasPermission(userPermissions, "admin/backup-database")
          },
        ],
      },
    ],
    navSecondary: [
      { 
        title: "Support", 
        url: "/support", 
        icon: LifeBuoy,
        hasAccess: true // Support is always available
      },
      { 
        title: "Feedback", 
        url: "/feedback", 
        icon: Send,
        hasAccess: true // Feedback is always available
      },
    ],
    projects: [
      { 
        name: "Acculog", 
        url: "/acculog/activity-logs", 
        icon: CalendarCheck,
        hasAccess: hasPermission(userPermissions, "acculog")
      },
    ],
  };

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
