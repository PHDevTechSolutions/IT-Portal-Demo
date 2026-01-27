"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavMain } from "../components/nav-main"
import { NavProjects } from "../components/nav-projects"
import { NavSecondary } from "../components/nav-secondary"
import { NavUser } from "../components/nav-user"
import {
  BookOpen,
  Bot,
  SquareTerminal,
  Settings2,
  LifeBuoy,
  Send,
  Frame,
  PieChart,
} from "lucide-react"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userId: string | null
}

export function AppSidebar({ userId, ...props }: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [userDetails, setUserDetails] = React.useState({
    UserId: "",
    Firstname: "",
    Lastname: "",
    Email: "",
    profilePicture: "",
    ReferenceID: "",
    Position: "",
  })

  React.useEffect(() => {
    if (!userId) return
    const fetchData = async () => {
      const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      const data = await res.json()
      setUserDetails({
        UserId: data._id || userId,
        Firstname: data.Firstname || "",
        Lastname: data.Lastname || "",
        Email: data.Email || "",
        profilePicture: data.profilePicture || "/avatars/default.jpg",
        ReferenceID: data.ReferenceID || "",
        Position: data.Position || "",
      })
    }
    fetchData()
  }, [userId])

  const appendUserId = (url: string) =>
    userId ? (url.includes("?") ? `${url}&userId=${userId}` : `${url}?userId=${userId}`) : url

  // -------------------------------
  // FULL SIDEBAR DATA (BASE)
  // -------------------------------
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
      { name: "Taskflow Sales Management System", url: appendUserId("/taskflow"), icon: Frame },
      { name: "Ecodesk Ticketing System", url: appendUserId("/ecodesk"), icon: PieChart },
      { name: "Acculog HR Attendance System", url: appendUserId("/acculog"), icon: Frame },
    ],
  }

  // -------------------------------------
  // ROLE-BASED FILTERING STARTS HERE
  // -------------------------------------
  const position = userDetails.Position?.trim()

  const fullAccess = [
    "IT Manager",
    "IT Senior Supervisor",
    "Senior Fullstack Developer",
  ]

  let filtered = { ...fullSidebar }

  if (!fullAccess.includes(position)) {
    // ASSET SUPERVISOR — Only Taskflow SMS + Settings
    if (position === "Asset Supervisor") {
      filtered = {
        navMain: [
          fullSidebar.navMain[3], // Settings only
        ],
        navSecondary: [],
        projects: [
          fullSidebar.projects.find((p) => p.name === "Taskflow Sales Management System")!,
          fullSidebar.projects.find((p) => p.name === "IT Asset Management System")!,
        ].filter(Boolean),
      }
    }


    // IT ASSOCIATE
    else if (position === "IT Associate") {
      filtered = {
        navMain: [
          fullSidebar.navMain[0], // Applications
          {
            ...fullSidebar.navMain[2], // User Accounts
            items: [fullSidebar.navMain[2].items[0]], // Roles only
          },
          fullSidebar.navMain[3], // ALWAYS include Settings
        ],
        navSecondary: [],
        projects: [
          fullSidebar.projects.find((p) => p.name === "Taskflow Sales Management System")!,
          fullSidebar.projects.find((p) => p.name === "Acculog HR Attendance System")!,
        ],
      }
    }

    // IT - OJT — ONLY Taskflow + Settings
    else if (position === "IT - OJT") {
      filtered = {
        navMain: [
          fullSidebar.navMain[3], // Settings
        ],
        navSecondary: [],
        projects: [
          fullSidebar.projects.find((p) => p.name === "Taskflow Sales Management System")!,
        ],
      }
    }
  }

  const goToPage = (url: string) => {
    if (!userId) return
    router.push(appendUserId(url))
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a onClick={() => goToPage("/dashboard")}>
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-lg">
                  <img src="/xchire-logo.png" className="w-4 h-4" />
                </div>
                <div className="grid flex-1 text-left text-sm">
                  <span className="truncate font-medium">IT Portal</span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          items={filtered.navMain.map((item) => ({
            ...item,
            onClick: () => goToPage(item.items?.[0]?.url || item.url),
          }))}
        />

        <NavProjects
          projects={filtered.projects.map((p) => ({
            ...p,
            onClick: () => goToPage(p.url),
          }))}
        />

        <NavSecondary
          items={filtered.navSecondary.map((item) => ({
            ...item,
            onClick: () => goToPage(item.url),
          }))}
          className="mt-auto"
        />
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
  )
}
