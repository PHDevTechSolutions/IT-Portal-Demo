"use client"

import React, { useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "../../components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Item {
  id: number
  title: string
  description: string
  url: string
}

export default function AccountPage() {
  const searchParams = useSearchParams()
  const queryUserId = searchParams?.get("userId")
  const [userId] = useState<string | null>(queryUserId ?? null)
  const router = useRouter()

  // All items combined
  const items: Item[] = [
    {
      id: 1,
      title: "Taskflow ( Current Live )",
      description: "Manage and track activity time and motion efficiently.",
      url: "https://ecoshift-erp-system.vercel.app/",
    },
    {
      id: 2,
      title: "Taskflow ( Demo Server )",
      description: "Manage and track activity time and motion efficiently.",
      url: "https://taskflow-tau-seven.vercel.app/",
    },
    {
      id: 3,
      title: "Ecodesk ( Current Live )",
      description: "Customer support ticketing system for seamless issue tracking.",
      url: "https://ecoshift-erp-system.vercel.app/",
    },
    {
      id: 4,
      title: "Acculog ( Current Live )",
      description: "Attendance tracking system to monitor employee hours.",
      url: "https://acculog.vercel.app/",
    },
    {
      id: 5,
      title: "Acculog ( Demo Server )",
      description: "Attendance tracking system to monitor employee hours.",
      url: "https://acculog-demo-navy.vercel.app/",
    },
    {
      id: 6,
      title: "Room Reservation ( Demo Server )",
      description: "Reserve rooms and manage shift schedules easily.",
      url: "https://shift-reservation.vercel.app/Book",
    },
    {
      id: 7,
      title: "Stash IT Asset ( Old Version )",
      description: "IT asset management system to track company equipment.",
      url: "https://stash-rouge-pi.vercel.app/",
    },
    {
      id: 8,
      title: "Stash IT Asset ( New Version )",
      description: "IT asset management system to track company equipment.",
      url: "https://stash-it-asset-management-system.vercel.app/",
    },
    {
      id: 9,
      title: "Know My Employee",
      description: "Employee analytics and HR insights platform.",
      url: "https://kme-orcin.vercel.app/Home",
    },
    {
      id: 10,
      title: "Linker X",
      description: "Platform to store and share links securely.",
      url: "https://linker-x-delta.vercel.app/",
    },
    {
      id: 11,
      title: "Ecoshift Corporation",
      description: "Official website of Ecoshift Corporation.",
      url: "https://www.ecoshiftcorp.com/",
    },
    {
      id: 12,
      title: "Disruptive Solutions Inc",
      description: "Disruptive Solutions Inc official site.",
      url: "https://disruptivesolutionsinc.com/",
    },
    {
      id: 13,
      title: "Ecoshift Shopify Admin",
      description: "Shopify admin login for Ecoshift.",
      url: "https://admin.shopify.com/login?ui_locales=en-PH&errorHint=no_cookie_session",
    },
    {
      id: 14,
      title: "Ecoshift Shopify Website",
      description: "Ecoshift Shopify customer-facing website.",
      url: "https://eshome.ph/",
    },
    {
      id: 15,
      title: "Elementor Pro",
      description: "Elementor Pro website login and management.",
      url: "https://my.elementor.com/login/?redirect_to=%2Fwebsites%2F",
    },
    {
      id: 16,
      title: "Nitropack",
      description: "Nitropack dashboard for website speed optimization.",
      url: "https://app.nitropack.io/dashboard",
    },
    {
      id: 17,
      title: "Vercel",
      description: "Vercel platform login for deployments.",
      url: "https://vercel.com/login",
    },
    {
      id: 18,
      title: "VAH",
      description: "VAH official site.",
      url: "https://buildchem-nu.vercel.app/",
    },
    {
      id: 19,
      title: "Neon PostgreSQL",
      description: "Neon cloud Postgres database console and management.",
      url: "https://console.neon.tech/realms/prod-realm/protocol/openid-connect/auth?client_id=neon-console&redirect_uri=https%3A%2F%2Fconsole.neon.tech%2Fauth%2Fkeycloak%2Fcallback&response_type=code&scope=openid+profile+email&state=AbXDgr_yQo6C3WZ9xHF_mA%3D%3D%2C%2C%2C",
    },
    {
      id: 20,
      title: "MongoDB",
      description: "MongoDB cloud account and database management.",
      url: "https://account.mongodb.com/account/login?n=https%3A%2F%2Fcloud.mongodb.com%2Fv2%2F6891bf020016b943a3459440&nextHash=%23metrics%2FreplicaSet%2F6891bf5e52da71245672c0d1%2Fexplorer%2FLinkerX%2Fnotes%2Ffind&signedOut=true",
    },
    {
      id: 21,
      title: "Supabase",
      description: "Supabase dashboard for backend database and authentication.",
      url: "https://supabase.com/dashboard/sign-in",
    },
    {
      id: 22,
      title: "Redis",
      description: "Redis Cloud subscription and metrics dashboard.",
      url: "https://cloud.redis.io/#/subscriptions/subscription/2915038/bdb-view/13569236/metric",
    },
    {
      id: 23,
      title: "Firebase",
      description: "Firebase console for Firestore and project management.",
      url: "https://console.firebase.google.com/u/0/project/taskflow-4605f/firestore/databases/-default-/indexes",
    },
  ]

  const [search, setSearch] = useState("")

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase())
    )
  }, [search, items])

  const itemsPerPage = 10
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)

  const paginatedItems = filteredItems.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  React.useEffect(() => {
    setPage(1)
  }, [search])

  const generatePages = (total: number) => Array.from({ length: total }, (_, i) => i + 1)

  return (
    <SidebarProvider>
      <AppSidebar userId={userId} />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
              Back
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Applications</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Modules</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-col gap-4 p-4 pt-0">
          <Input
            type="search"
            placeholder="Search by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />

          <Table>
            <TableCaption>
              List of applications and sites (filtered: {filteredItems.length} result
              {filteredItems.length !== items.length ? `s` : ""})
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No results found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>
                      <Button variant="link" size="sm" asChild>
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          Open Link
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <Pagination className="mt-4 justify-center">
              <PaginationContent>
                <PaginationItem>
                  <PaginationLink
                    onClick={() => page > 1 && setPage(page - 1)}
                    className={page === 1 ? "pointer-events-none opacity-50" : ""}
                  >
                    Prev
                  </PaginationLink>
                </PaginationItem>
                {generatePages(totalPages).map((p) => (
                  <PaginationItem key={p}>
                    <PaginationLink onClick={() => setPage(p)} isActive={p === page}>
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationLink
                    onClick={() => page < totalPages && setPage(page + 1)}
                    className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                  >
                    Next
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
