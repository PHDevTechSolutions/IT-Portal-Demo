"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger, } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { Pagination } from "@/components/app-pagination";
import { Star, ExternalLink } from "lucide-react";

interface Item {
  id: number;
  title: string;
  description: string;
  url: string;
}

export default function AccountPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({});
  const [lastVisitedUrl, setLastVisitedUrl] = useState<string | null>(null);
  const router = useRouter();

  // Load userId, visit counts and last visited url from localStorage on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    setUserId(storedUserId);

    const storedCounts = localStorage.getItem("visitCounts");
    setVisitCounts(storedCounts ? JSON.parse(storedCounts) : {});

    const lastUrl = localStorage.getItem("lastVisitedUrl");
    setLastVisitedUrl(lastUrl);
  }, []);

  const items: Item[] = [
    {
      id: 1,
      title: "Taskflow",
      description: "Manage and track activity time and motion efficiently.",
      url: "https://taskflow-crm.vercel.app/auth/login",
    },
    {
      id: 2,
      title: "Taskflow ( Demo )",
      description: "Manage and track activity time and motion efficiently.",
      url: "https://ecoshift-erp-system.vercel.app/Login",
    },
    {
      id: 3,
      title: "Taskflow V2 ( Internal Demo Server )",
      description: "Manage and track activity time and motion efficiently.",
      url: "https://taskflow-demo-v2.vercel.app/auth/login",
    },
    {
      id: 4,
      title: "Ecodesk",
      description: "Customer support ticketing system for seamless issue tracking.",
      url: "https://ecodesk-erp.vercel.app/login",
    },
    {
      id: 5,
      title: "Ecodesk ( OLD )",
      description: "Customer support ticketing system for seamless issue tracking.",
      url: "https://ecodesk-erp.vercel.app/login",
    },
    {
      id: 6,
      title: "Acculog ( Sales Only )",
      description: "Attendance tracking system to monitor employee hours.",
      url: "https://acculog-hris.vercel.app/Login",
    },
    {
      id: 7,
      title: "Acculog ( Regular User )",
      description: "Attendance tracking system to monitor employee hours.",
      url: "https://acculog.vercel.app/",
    },
    {
      id: 8,
      title: "Room Reservation",
      description: "Reserve rooms and manage shift schedules easily.",
      url: "https://shift-reservation.vercel.app/Book",
    },
    {
      id: 10,
      title: "Stash IT Asset",
      description: "IT asset management system to track company equipment.",
      url: "https://stash-demo.vercel.app/auth/login",
    },
    {
      id: 11,
      title: "Know My Employee",
      description: "Employee analytics and HR insights platform.",
      url: "https://kme-orcin.vercel.app/Home",
    },
    {
      id: 12,
      title: "Linker X",
      description: "Platform to store and share links securely.",
      url: "https://linker-x-delta.vercel.app/",
    },
    {
      id: 13,
      title: "Ecoshift Corporation",
      description: "Official website of Ecoshift Corporation.",
      url: "https://www.ecoshiftcorp.com/",
    },
    {
      id: 14,
      title: "Disruptive Solutions Inc",
      description: "Disruptive Solutions Inc official site.",
      url: "https://disruptivesolutionsinc.com/",
    },
    {
      id: 15,
      title: "Ecoshift Shopify Admin",
      description: "Shopify admin login for Ecoshift.",
      url: "https://admin.shopify.com/login?ui_locales=en-PH&errorHint=no_cookie_session",
    },
    {
      id: 16,
      title: "Ecoshift Shopify Website",
      description: "Ecoshift Shopify customer-facing website.",
      url: "https://eshome.ph/",
    },
    {
      id: 17,
      title: "Elementor Pro",
      description: "Elementor Pro website login and management.",
      url: "https://my.elementor.com/login/?redirect_to=%2Fwebsites%2F",
    },
    {
      id: 18,
      title: "Nitropack",
      description: "Nitropack dashboard for website speed optimization.",
      url: "https://app.nitropack.io/dashboard",
    },
    {
      id: 19,
      title: "Vercel",
      description: "Vercel platform login for deployments.",
      url: "https://vercel.com/login",
    },
    {
      id: 20,
      title: "VAH",
      description: "VAH official site.",
      url: "https://buildchem-nu.vercel.app/",
    },
    {
      id: 21,
      title: "Neon PostgreSQL",
      description: "Neon cloud Postgres database console and management.",
      url: "https://console.neon.tech/realms/prod-realm/protocol/openid-connect/auth?client_id=neon-console&redirect_uri=https%3A%2F%2Fconsole.neon.tech%2Fauth%2Fkeycloak%2Fcallback&response_type=code&scope=openid+profile+email&state=AbXDgr_yQo6C3WZ9xHF_mA%3D%3D%2C%2C%2C",
    },
    {
      id: 22,
      title: "MongoDB",
      description: "MongoDB cloud account and database management.",
      url: "https://account.mongodb.com/account/login?n=https%3A%2F%2Fcloud.mongodb.com%2Fv2%2F6891bf020016b943a3459440&nextHash=%23metrics%2FreplicaSet%2F6891bf5e52da71245672c0d1%2Fexplorer%2FLinkerX%2Fnotes%2Ffind&signedOut=true",
    },
    {
      id: 23,
      title: "Supabase",
      description: "Supabase dashboard for backend database and authentication.",
      url: "https://supabase.com/dashboard/sign-in",
    },
    {
      id: 24,
      title: "Redis",
      description: "Redis Cloud subscription and metrics dashboard.",
      url: "https://cloud.redis.io/#/subscriptions/subscription/2915038/bdb-view/13569236/metric",
    },
    {
      id: 25,
      title: "Firebase",
      description: "Firebase console for Firestore and project management.",
      url: "https://console.firebase.google.com/u/0/project/taskflow-4605f/firestore/databases/-default-/indexes",
    },
    {
      id: 26,
      title: "IT Ticketing",
      description: "IT Ticketing.",
      url: "https://ticketing-demo-dusky.vercel.app/auth/login",
    },
  ]

  // Filter items based on search
  const [search, setSearch] = useState("");
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, items]);

  // Pagination variables
  const itemsPerPage = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const paginatedItems = filteredItems.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  // Update visit counts in localStorage and state
  const handleVisit = (url: string) => {
    // Open in new tab
    window.open(url, "_blank", "noopener noreferrer");

    // Update visit counts
    setVisitCounts((prev) => {
      const newCounts = { ...prev };
      newCounts[url] = (newCounts[url] || 0) + 1;

      // Save back to localStorage
      localStorage.setItem("visitCounts", JSON.stringify(newCounts));

      return newCounts;
    });

    // Update last visited url
    setLastVisitedUrl(url);
    localStorage.setItem("lastVisitedUrl", url);
  };

  // Get top 5 most visited URLs sorted descending
  const topVisited = useMemo(() => {
    // Map visitCounts to entries, sort descending by count, limit 5
    const sortedUrls = Object.entries(visitCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([url]) => url);

    // Return item details for the URLs found, ignore if url not in items list
    return sortedUrls
      .map((url) => items.find((item) => item.url === url))
      .filter((item): item is Item => !!item); // filter out undefined
  }, [visitCounts, items]);

  const generatePages = (total: number) => Array.from({ length: total }, (_, i) => i + 1);

  return (
    <UserProvider>
      <FormatProvider>
        <ProtectedPageWrapper>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              {/* Header */}
              <header className="flex h-16 shrink-0 items-center gap-2 px-4">
                <div className="flex items-center gap-2">
                  <SidebarTrigger className="-ml-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/dashboard")}
                  >
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

              {/* Two column layout */}

              <div className="flex gap-2 p-6 pt-2 h-[calc(100vh-64px)] overflow-hidden">
                {/* Left column: Top 5 Most Visited */}
                <Card className="w-1/3 border-gray-200 shadow-md overflow-hidden flex flex-col">
                  <CardHeader className="pb-2 flex items-left gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-400" />
                      Top 5 Most Visited
                    </CardTitle>
                  </CardHeader>

                  <ScrollArea className="flex-grow">
                    <CardContent className="p-2">
                      {topVisited.length === 0 ? (
                        <p className="text-center text-gray-500 italic p-4">No visits yet.</p>
                      ) : (
                        <ul>
                          {topVisited.map((item) => (
                            <li
                              key={item.id}
                              onClick={() => handleVisit(item.url)}
                              title={`${item.description} (Visited ${visitCounts[item.url] ?? 0} times)`}
                              className="cursor-pointer px-4 py-3 flex justify-between items-center rounded-md border-b"
                            >
                              <span className="font-medium truncate">{item.title}</span>
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-400" />
                                {visitCounts[item.url] ?? 0} visits
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </ScrollArea>
                </Card>

                {/* Right column: Search + List */}
                <Card className="w-2/3 flex flex-col shadow-md border-gray-200">
                  <CardContent className="flex flex-col p-6 space-y-4">
                    <Input
                      type="search"
                      placeholder="Search by title or description..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="max-w-lg"
                    />

                    <ScrollArea className="flex-grow rounded-md border border-gray-200 p-2">
                      <Table className="min-w-full">
                        <TableCaption className="text-muted-foreground">
                          List of applications and sites (filtered: {filteredItems.length} result
                          {filteredItems.length !== items.length ? "s" : ""})
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-left">Title</TableHead>
                            <TableHead className="text-left">Description</TableHead>
                            <TableHead className="text-center">Link</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-8 italic">
                                No results found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedItems.map((item) => (
                              <TableRow
                                key={item.id}
                                className="cursor-pointer"
                              >
                                <TableCell className="font-semibold">{item.title}</TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleVisit(item.url)}
                                    className="inline-flex items-center gap-1"
                                  >
                                    Open Link <ExternalLink className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>

                    <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />

                  </CardContent>
                </Card>
              </div>

            </SidebarInset>
          </SidebarProvider>
        </ProtectedPageWrapper>
      </FormatProvider>
    </UserProvider>
  );
}
