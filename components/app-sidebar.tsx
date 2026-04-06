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
import { BookOpen, Bot, SquareTerminal, Settings2, LifeBuoy, Send, Activity, Boxes, TicketCheck, CalendarCheck, } from "lucide-react";

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

  React.useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setUserDetails({
          UserId: data.userId ?? "",
          Firstname: data.firstname ?? "",
          Lastname: data.lastname ?? "",
          Email: data.email ?? "",
          profilePicture: data.profilePicture ?? "/avatars/default.jpg",
          Role: data.role ?? "",
        });
      })
      .catch(console.error);
  }, []);

  const sidebarData = {
    navMain: [
      {
        title: "Applications",
        url: "#",
        icon: SquareTerminal,
        isActive: pathname?.startsWith("/application"),
        items: [{ title: "Modules", url: "/application/modules" }],
      },
      {
        title: "Taskflow",
        url: "#",
        icon: Activity,
        isActive: pathname?.startsWith("/taskflow"),
        items: [
          { title: "Customer Database", url: "/taskflow/customer-database" },
          { title: "Removal Accounts", url: "/taskflow/removal-accounts" },
          { title: "Customer Audits", url: "/taskflow/customer-audits" },
          { title: "Audit Logs", url: "/taskflow/audit-logs" },
          { title: "Approval of Accounts", url: "/taskflow/customer-approval" },
          { title: "Activity Logs", url: "/taskflow/activity-logs" },
          { title: "Progress Logs", url: "/taskflow/progress-logs" },
          { title: "Endorsed Tickets", url: "/taskflow/csr-inquiries" },
        ],
      },
      {
        title: "Stash",
        url: "#",
        icon: Boxes,
        isActive: pathname?.startsWith("/stash"),
        items: [
          { title: "Inventory", url: "/stash/inventory" },
          { title: "Assigned Assets", url: "/stash/assigned-assets" },
          { title: "License", url: "/stash/license" },
        ],
      },
      {
        title: "Help Desk",
        url: "#",
        icon: TicketCheck,
        isActive: pathname?.startsWith("/ticketing"),
        items: [
          { title: "Tickets", url: "/ticketing/tickets" },
          { title: "Service Catalogue", url: "/ticketing/service-catalogue" },
        ],
      },
      {
        title: "CloudFlare",
        url: "#",
        icon: Bot,
        isActive: pathname?.startsWith("/cloudflare"),
        items: [{ title: "DNS", url: "/cloudflare/dns" }],
      },
      {
        title: "User Accounts",
        url: "#",
        icon: BookOpen,
        isActive: pathname?.startsWith("/admin"),
        items: [
          { title: "Roles", url: "/admin/roles" },
          { title: "Resigned and Terminated", url: "/admin/roles-status" },
          { title: "Sessions", url: "/admin/sessions" },
          ...(userDetails.Role === "SuperAdmin" ? [{ title: "IT Permissions", url: "/admin/it-permissions" }] : []),
        ],
      },
      {
        title: "Settings",
        url: "#",
        icon: Settings2,
        isActive: pathname?.startsWith("/settings"),
        items: [{ title: "General", url: "/settings/general" }],
      },
    ],
    navSecondary: [
      { title: "Support", url: "/support", icon: LifeBuoy },
      { title: "Feedback", url: "/feedback", icon: Send },
    ],
    projects: [
      { name: "Acculog", url: "/acculog/activity-logs", icon: CalendarCheck },
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
