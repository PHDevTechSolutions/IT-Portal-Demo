"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "../../components/app-sidebar";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";

interface Activity {
  id: string;
  referenceid: string;
  tsm: string;
  manager: string;
  date_created: string | null;
  ticket_reference_number: string;
  scheduled_date: string | null;
  agent: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  type_client: string;
  activity_reference_number: string;
}

const ROWS_PER_PAGE = 10;

export default function ActivityLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // For modal
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const fetchActivities = async () => {
    setIsFetching(true);
    const { data, error } = await supabase
      .from("activity")
      .select(
        `
      id,
      referenceid,
      tsm,
      manager,
      date_created,
      ticket_reference_number,
      scheduled_date,
      agent,
      company_name,
      contact_person,
      contact_number,
      email_address,
      address,
      type_client,
      activity_reference_number
    `
      )
      .order("date_created", { ascending: false });

    if (error) {
      toast.error(`Error fetching activities: ${error.message}`);
      setActivities([]);
    } else {
      setActivities(data || []);
    }
    setIsFetching(false);
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const filteredActivities = useMemo(() => {
    if (!search.trim()) return activities;

    const lowerSearch = search.toLowerCase();

    return activities.filter((act) =>
      [
        act.referenceid,
        act.tsm,
        act.manager,
        act.ticket_reference_number,
        act.agent,
        act.company_name,
        act.contact_person,
        act.contact_number,
        act.email_address,
        act.address,
        act.type_client,
        act.activity_reference_number,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(lowerSearch))
    );
  }, [activities, search]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / ROWS_PER_PAGE));
  const paginatedActivities = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return filteredActivities.slice(start, start + ROWS_PER_PAGE);
  }, [filteredActivities, page]);

  const goToPrevious = () => setPage((p) => Math.max(1, p - 1));
  const goToNext = () => setPage((p) => Math.min(totalPages, p + 1));

  useEffect(() => {
    setPage(1);
  }, [search]);

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : "N/A";

  return (
    <SidebarProvider>
      <AppSidebar userId={userId} />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
            Home
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Taskflow</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Activity Logs</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        {/* Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-full"
            />
            {isFetching && (
              <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Table */}
        <div className="mx-4 border border-border shadow-sm rounded-lg overflow-auto">
          {isFetching ? (
            <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="size-6 animate-spin" />
              <span>Loading activities...</span>
            </div>
          ) : (
            <Table className="min-w-[800px] w-full text-sm whitespace-nowrap">
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Ref, TSM & Manager</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedActivities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No activities found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedActivities.map((act) => (
                    <TableRow key={act.id}>
                      <TableCell>{act.company_name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span><strong>Ref:</strong> {act.referenceid || "-"}</span>
                          <span><strong>TSM:</strong> {act.tsm || "-"}</span>
                          <span><strong>Manager:</strong> {act.manager || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{act.agent || "-"}</TableCell>
                      <TableCell>{formatDate(act.date_created)}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => setSelectedActivity(act)}>
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center gap-4 my-4">
          <Button variant="outline" onClick={goToPrevious} disabled={page === 1}>
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" onClick={goToNext} disabled={page === totalPages}>
            Next
          </Button>
        </div>

        {/* Modal/Dialog */}
        {selectedActivity && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
            onClick={() => setSelectedActivity(null)}
          >
            <div
              className="bg-white rounded-lg max-w-lg w-full p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold mb-4">Activity Details</h2>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Reference ID:</strong> {selectedActivity.referenceid || "-"}</div>
                <div><strong>TSM:</strong> {selectedActivity.tsm || "-"}</div>
                <div><strong>Manager:</strong> {selectedActivity.manager || "-"}</div>
                <div><strong>Date Created:</strong> {formatDate(selectedActivity.date_created)}</div>
                <div><strong>Scheduled Date:</strong> {formatDate(selectedActivity.scheduled_date)}</div>
                <div><strong>Ticket Ref. Number:</strong> {selectedActivity.ticket_reference_number || "-"}</div>
                <div><strong>Agent:</strong> {selectedActivity.agent || "-"}</div>
                <div><strong>Company Name:</strong> {selectedActivity.company_name || "-"}</div>
                <div><strong>Contact Person:</strong> {selectedActivity.contact_person || "-"}</div>
                <div><strong>Contact Number:</strong> {selectedActivity.contact_number || "-"}</div>
                <div><strong>Email Address:</strong> {selectedActivity.email_address || "-"}</div>
                <div><strong>Address:</strong> {selectedActivity.address || "-"}</div>
                <div><strong>Type Client:</strong> {selectedActivity.type_client || "-"}</div>
                <div><strong>Activity Ref. Number:</strong> {selectedActivity.activity_reference_number || "-"}</div>
              </div>

              <Button className="mt-6" onClick={() => setSelectedActivity(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
