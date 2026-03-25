"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
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
  BookOpen,
  Bot,
  SquareTerminal,
  Settings2,
  LifeBuoy,
  Send,
  Activity,
  Boxes,
  TicketCheck,
  CalendarCheck,
} from "lucide-react";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const [userId, setUserId] = React.useState<string | null>(null);
  const [userDetails, setUserDetails] = React.useState({
    UserId: "",
    Firstname: "",
    Lastname: "",
    Email: "",
    profilePicture: "",
  });

  // Load userId from query param
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUserId(params.get("id"));
  }, []);

  // Fetch user details
  React.useEffect(() => {
    if (!userId) return;

    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((data) => {
        setUserDetails({
          UserId: data._id || userId,
          Firstname: data.Firstname || "",
          Lastname: data.Lastname || "",
          Email: data.Email || "",
          profilePicture: data.profilePicture || "/avatars/default.jpg",
        });
      })
      .catch(console.error);
  }, [userId]);

  const appendUserId = React.useCallback(
    (url: string) => {
      if (!userId || url === "#") return url;
      return url.includes("?")
        ? `${url}&id=${encodeURIComponent(userId)}`
        : `${url}?id=${encodeURIComponent(userId)}`;
    },
    [userId]
  );

  // 🔓 FULL ACCESS SIDEBAR (NO ROLE FILTERING)
  const sidebarData = {
    navMain: [
      {
        title: "Applications",
        url: "#",
        icon: SquareTerminal,
        isActive: pathname?.startsWith("/application"),
        items: [{ title: "Modules", url: appendUserId("/application/modules") }],
      },
      {
        title: "Taskflow",
        url: "#",
        icon: Activity,
        isActive: pathname?.startsWith("/taskflow"),
        items: [
          { title: "Customer Database", url: appendUserId("/taskflow/customer-database") },
          { title: "Customer Audits", url: appendUserId("/taskflow/customer-audits") },
          { title: "Audit Logs", url: appendUserId("/taskflow/audit-logs") },
          { title: "Approval of Accounts", url: appendUserId("/taskflow/customer-approval") },
          { title: "Activity Logs", url: appendUserId("/taskflow/activity-logs") },
          { title: "Progress Logs", url: appendUserId("/taskflow/progress-logs") },
          { title: "Endorsed Tickets", url: appendUserId("/taskflow/csr-inquiries") },
        ],
      },
      {
        title: "Stash",
        url: "#",
        icon: Boxes,
        isActive: pathname?.startsWith("/stash"),
        items: [
          { title: "Inventory", url: appendUserId("/stash/inventory") },
          { title: "Assigned Assets", url: appendUserId("/stash/assigned-assets") },
          { title: "License", url: appendUserId("/stash/license") },
        ],
      },
      {
        title: "Help Desk",
        url: "#",
        icon: TicketCheck,
        isActive: pathname?.startsWith("/ticketing"),
        items: [
          { title: "Tickets", url: appendUserId("/ticketing/tickets") },
          { title: "Service Catalogue", url: appendUserId("/ticketing/service-catalogue") },
        ],
      },
      {
        title: "CloudFlare",
        url: "#",
        icon: Bot,
        isActive: pathname?.startsWith("/cloudflare"),
        items: [{ title: "DNS", url: appendUserId("/cloudflare/dns") }],
      },
      {
        title: "User Accounts",
        url: "#",
        icon: BookOpen,
        isActive: pathname?.startsWith("/admin"),
        items: [
          { title: "Roles", url: appendUserId("/admin/roles") },
          { title: "Resigned and Terminated", url: appendUserId("/admin/roles-status") },
          { title: "Sessions", url: appendUserId("/admin/sessions") },
        ],
      },
      {
        title: "Settings",
        url: "#",
        icon: Settings2,
        isActive: pathname?.startsWith("/settings"),
        items: [{ title: "General", url: appendUserId("/settings/general") }],
      },
    ],
    navSecondary: [
      { title: "Support", url: appendUserId("/support"), icon: LifeBuoy },
      { title: "Feedback", url: appendUserId("/feedback"), icon: Send },
    ],
    projects: [
      { name: "Acculog", url: appendUserId("/acculog/activity-logs"), icon: CalendarCheck },
    ],
  };

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href={appendUserId("/dashboard")} className="flex items-center gap-2">
                <img src="/xchire-logo.png" className="w-8 h-8" alt="Logo" />
                <span className="font-medium">IT Portal</span>
              </a>
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
