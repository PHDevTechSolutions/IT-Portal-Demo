"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRightIcon,
  DatabaseIcon,
  ActivityIcon,
  BarChart2Icon,
  MessageCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  ItemMedia,
} from "@/components/ui/item";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "../components/app-sidebar";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const links = [
  {
    name: "Customer Database",
    path: "/taskflow/customer-database",
    icon: DatabaseIcon,
  },
  {
    name: "Activity Logs",
    path: "/taskflow/activity-logs",
    icon: ActivityIcon,
  },
  {
    name: "Progress Logs",
    path: "/taskflow/progress-logs",
    icon: BarChart2Icon,
  },
  {
    name: "CSR Inquiries",
    path: "/taskflow/csr-inquiries",
    icon: MessageCircleIcon,
  },
];

export default function TaskflowLinks() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryUserId = searchParams?.get("userId");
  const [userId] = useState<string | null>(queryUserId ?? null);

  const appendUserId = (url: string) => {
    if (!userId) return url;
    return url.includes("?") ? `${url}&userId=${userId}` : `${url}?userId=${userId}`;
  };

  const handleApplicationsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = appendUserId("/application/modules");
    router.push(url);
  };

  return (
    <SidebarProvider>
      <AppSidebar userId={userId} />
      <SidebarInset>
        {/* Header with SidebarTrigger, Back Button and Breadcrumbs */}
        <header className="flex h-16 items-center gap-2 px-6 border-b border-gray-200">
          <SidebarTrigger className="-ml-1" />
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
            Back
          </Button>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href={appendUserId("/application/modules")}
                  onClick={handleApplicationsClick}
                >
                  Applications
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Modules</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        {/* Main content */}
        <main className="flex flex-col gap-6 p-6 w-full max-w-full">
          {links.map(({ name, path, icon: Icon }) => (
            <Item
              key={path}
              variant="outline"
              size="sm"
              asChild
              className="w-full cursor-pointer"
            >
              <a
                href={path}
                className="flex items-center justify-between w-full"
                onClick={(e) => {
                  e.preventDefault();
                  router.push(appendUserId(path));
                }}
              >
                <ItemMedia>
                  <Icon className="h-6 w-6 text-blue-500" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{name}</ItemTitle>
                  <ItemDescription>Go to {name}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                </ItemActions>
              </a>
            </Item>
          ))}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
