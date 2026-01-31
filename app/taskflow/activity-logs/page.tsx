"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, } from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";

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

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture?: string;
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

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Activity>>({});

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Agent list and user details states
  const [agents, setAgents] = useState<Agent[]>([]);

  // Fetch activities from supabase
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

  useEffect(() => {
    if (selectedActivity) {
      setFormData(selectedActivity);
      setIsEditing(false);
    }
  }, [selectedActivity]);

  // Create a map from agent ReferenceID to agent info for quick lookup
  const agentMap = useMemo(() => {
    const map: Record<string, { name: string; profilePicture?: string }> = {};
    agents.forEach((agent) => {
      if (agent.ReferenceID && agent.Firstname && agent.Lastname) {
        map[agent.ReferenceID.toLowerCase()] = {
          name: `${agent.Firstname} ${agent.Lastname}`,
          profilePicture: agent.profilePicture,
        };
      }
    });
    return map;
  }, [agents]);

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

  const handleChange = (key: keyof Activity, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpdate = async () => {
    if (!selectedActivity?.id) return;

    const { error } = await supabase
      .from("activity")
      .update({
        tsm: formData.tsm,
        manager: formData.manager,
        company_name: formData.company_name,
        contact_person: formData.contact_person,
        contact_number: formData.contact_number,
        email_address: formData.email_address,
        address: formData.address,
        type_client: formData.type_client,
        scheduled_date: formData.scheduled_date,
      })
      .eq("id", selectedActivity.id);

    if (error) {
      toast.error("Failed to update activity");
      return;
    }

    toast.success("Activity updated successfully");
    await fetchActivities();
    setIsEditing(false);
    setSelectedActivity(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedActivities.map((a) => a.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));

    setSelectedIds(allSelected
      ? selectedIds.filter((id) => !pageIds.includes(id))
      : [...new Set([...selectedIds, ...pageIds])]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const { error } = await supabase
      .from("activity")
      .delete()
      .in("id", selectedIds);

    if (error) {
      toast.error("Failed to delete selected activities");
      return;
    }

    toast.success(`${selectedIds.length} activity deleted`);
    setSelectedIds([]);
    setShowDeleteConfirm(false);
    fetchActivities();
  };


  return (
    <SidebarProvider>
      <AppSidebar />
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
          {/* Search */}
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

          {/* Delete Selected Button (Right Side) */}
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full sm:w-auto"
            >
              Delete Selected ({selectedIds.length})
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="mx-4 border border-border shadow-sm rounded-lg overflow-auto p-2">
          {isFetching ? (
            <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="size-6 animate-spin" />
              <span>Loading activities...</span>
            </div>
          ) : (
            <Table className="min-w-[800px] w-full text-sm whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        paginatedActivities.length > 0 &&
                        paginatedActivities.every((a) => selectedIds.includes(a.id))
                      }
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Ref, TSM & Manager</TableHead>
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
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(act.id)}
                          onChange={() => toggleSelect(act.id)}
                        />
                      </TableCell>

                      <TableCell>
                        {act.company_name || "-"}
                        <br />
                        <span className="text-[10px]">{act.activity_reference_number}</span>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span><strong>Ref:</strong> {act.referenceid || "-"}</span>
                          <span><strong>TSM:</strong> {act.tsm || "-"}</span>
                          <span><strong>Manager:</strong> {act.manager || "-"}</span>
                        </div>
                      </TableCell>

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
        <Dialog
          open={!!selectedActivity}
          onOpenChange={(open) => {
            if (!open) setSelectedActivity(null);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Activity Details</DialogTitle>
            </DialogHeader>

            {selectedActivity && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                {/* TSM */}
                <div>
                  <strong>TSM:</strong>
                  {isEditing ? (
                    <Input
                      value={formData.tsm || ""}
                      onChange={(e) => handleChange("tsm", e.target.value)}
                    />
                  ) : (
                    <span> {selectedActivity.tsm || "-"}</span>
                  )}
                </div>

                {/* Manager */}
                <div>
                  <strong>Manager:</strong>
                  {isEditing ? (
                    <Input
                      value={formData.manager || ""}
                      onChange={(e) => handleChange("manager", e.target.value)}
                    />
                  ) : (
                    <span> {selectedActivity.manager || "-"}</span>
                  )}
                </div>

                {/* Company Name */}
                <div>
                  <strong>Company Name:</strong>
                  {isEditing ? (
                    <Input
                      value={formData.company_name || ""}
                      onChange={(e) => handleChange("company_name", e.target.value)}
                    />
                  ) : (
                    <span> {selectedActivity.company_name || "-"}</span>
                  )}
                </div>

                {/* Contact Person */}
                <div>
                  <strong>Contact Person:</strong>
                  {isEditing ? (
                    <Input
                      value={formData.contact_person || ""}
                      onChange={(e) => handleChange("contact_person", e.target.value)}
                    />
                  ) : (
                    <span> {selectedActivity.contact_person || "-"}</span>
                  )}
                </div>

                {/* Contact Number */}
                <div>
                  <strong>Contact Number:</strong>
                  {isEditing ? (
                    <Input
                      value={formData.contact_number || ""}
                      onChange={(e) => handleChange("contact_number", e.target.value)}
                    />
                  ) : (
                    <span> {selectedActivity.contact_number || "-"}</span>
                  )}
                </div>

                {/* Email */}
                <div>
                  <strong>Email Address:</strong>
                  {isEditing ? (
                    <Input
                      value={formData.email_address || ""}
                      onChange={(e) => handleChange("email_address", e.target.value)}
                    />
                  ) : (
                    <span> {selectedActivity.email_address || "-"}</span>
                  )}
                </div>

                {/* Address */}
                <div className="col-span-2">
                  <strong>Address:</strong>
                  {isEditing ? (
                    <Input
                      value={formData.address || ""}
                      onChange={(e) => handleChange("address", e.target.value)}
                    />
                  ) : (
                    <span> {selectedActivity.address || "-"}</span>
                  )}
                </div>
              </div>
            )}


            <DialogFooter className="flex justify-between">
              {!isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setSelectedActivity(null)}>
                    Close
                  </Button>
                  <Button onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdate}>
                    Save Changes
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
            </DialogHeader>

            <p className="text-sm">
              Are you sure you want to delete{" "}
              <strong>{selectedIds.length}</strong> selected activities?
              This action cannot be undone.
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleBulkDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
