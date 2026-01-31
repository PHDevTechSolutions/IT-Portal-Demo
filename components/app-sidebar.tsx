"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { BookOpen, Bot, SquareTerminal, Settings2, LifeBuoy, Send, Frame, PieChart, Activity, Boxes, TicketCheck, CalendarCheck } from "lucide-react";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const pathname = usePathname();

  const [userId, setUserId] = React.useState<string | null>(null);
  const [userDetails, setUserDetails] = React.useState({
    UserId: "",
    Firstname: "",
    Lastname: "",
    Email: "",
    profilePicture: "",
    ReferenceID: "",
    Position: "",
  });

  // Load userId from URL query param on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUserId(params.get("id"));
  }, []);

  // Fetch user details when userId changes
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
          ReferenceID: data.ReferenceID || "",
          Position: data.Position || "",
        });
      })
      .catch((err) => {
        console.error("Failed to fetch user details:", err);
      });
  }, [userId]);

  // Helper: append userId to URL query string properly
  const appendUserId = React.useCallback(
    (url: string) => {
      if (!userId) return url;
      if (!url || url === "#") return url;
      return url.includes("?") ? `${url}&id=${encodeURIComponent(userId)}` : `${url}?id=${encodeURIComponent(userId)}`;
    },
    [userId]
  );

  // Role based access filter
  const position = userDetails.Position?.trim();

  const fullAccess = ["IT Manager", "IT Senior Supervisor", "Senior Fullstack Developer"];

  // Full sidebar data
  const fullSidebar = {
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

  // Filter sidebar based on role
  let filtered = { ...fullSidebar };

  if (!fullAccess.includes(position)) {
    if (position === "Asset Supervisor") {
      filtered = {
        navMain: [fullSidebar.navMain[3]], // Settings only
        navSecondary: [],
        projects: [
          fullSidebar.projects.find((p) => p.name === "Taskflow Sales Management System")!,
          fullSidebar.projects.find((p) => p.name === "IT Asset Management System")!,
        ].filter(Boolean),
      };
    } else if (position === "IT Associate") {
      filtered = {
        navMain: [
          fullSidebar.navMain[0], // Applications
          {
            ...fullSidebar.navMain[2], // User Accounts
            items: [fullSidebar.navMain[2].items[0]], // Roles only
          },
          fullSidebar.navMain[3], // Settings
        ],
        navSecondary: [],
        projects: [
          fullSidebar.projects.find((p) => p.name === "Taskflow Sales Management System")!,
          fullSidebar.projects.find((p) => p.name === "Acculog HR Attendance System")!,
        ],
      };
    } else if (position === "IT - OJT") {
      filtered = {
        navMain: [fullSidebar.navMain[3]], // Settings
        navSecondary: [],
        projects: [fullSidebar.projects.find((p) => p.name === "Taskflow Sales Management System")!],
      };
    }
  }

  // Replace the onClick handlers with normal React Router links to avoid DOM props problem
  // We'll create items with proper hrefs instead of onClick

  // Helper to render nav items with hrefs
  const navMainItems = filtered.navMain.map((item) => ({
    ...item,
    url: item.items?.[0]?.url || item.url,
  }));

  const navProjects = filtered.projects;
  const navSecondaryItems = filtered.navSecondary;

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href={appendUserId("/dashboard")} className="flex items-center gap-2">
                <div className="text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-lg">
                  <img src="/xchire-logo.png" className="w-8 h-8" alt="Logo" />
                </div>
                <div className="grid flex-1 text-left text-sm">
                  <span className="truncate font-medium">IT Portal</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMainItems} />
        <NavProjects projects={navProjects} />
        <NavSecondary items={navSecondaryItems} className="mt-auto" />
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
