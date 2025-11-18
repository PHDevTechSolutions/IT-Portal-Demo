"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "../../components/app-sidebar";
import { toast } from "sonner";
import { Loader2, Search, Edit as EditIcon, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, } from "@/components/ui/breadcrumb";
import { Pagination } from "../../components/app-pagination";
import { Separator } from "@/components/ui/separator";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";

import EditActivityModal, { Asset } from "../../components/app-asset-edit-dialog";

export default function ActivityLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);
  const [asset, setAsset] = useState<Asset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 20;
  const [editingActivity, setEditingActivity] = useState<Asset | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [range, setRange] = React.useState<DateRange | undefined>();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  const resetFilters = () => {
    setFilterStatus(undefined);
    setRange(undefined);
    setDateRange(undefined);
    setSearch("");
    setPage(1);
  };

  const fetchActivities = async () => {
    try {
      setIsFetching(true);
      const response = await fetch("/api/Data/Applications/ITAsset/Fetch");
      const json = await response.json();
      if (!response.ok || json.success === false)
        throw new Error(json.error || "Failed to fetch activities");
      setAsset(json.data || []);
    } catch (err: any) {
      toast.error(`Error fetching activity logs: ${err.message}`);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // Filter activities based on search, date range, and filters
  const filtered = useMemo(() => {
    return asset
      .filter((a) => {
        // Search filter
        if (
          search &&
          !Object.values(a).join(" ").toLowerCase().includes(search.toLowerCase())
        )
          return false;

        // Date range filter
        if (dateRange?.from || dateRange?.to) {
          if (!a.createdAt) return false;
          const created = new Date(a.createdAt);
          if (dateRange.from && created < dateRange.from) return false;
          if (dateRange.to && created > dateRange.to) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.createdAt ?? 0).getTime();
        const dateB = new Date(b.createdAt ?? 0).getTime();
        return dateB - dateA;
      });
  }, [asset, search, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const current = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.size === current.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(current.map((a) => a._id)));
    }
  };

  const toggleSelect = (_id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(_id)) newSet.delete(_id);
      else newSet.add(_id);
      return newSet;
    });
  };

  // Open Edit modal
  const openEditDialog = (activity: Asset) => {
    setEditingActivity(activity);
    setShowEditDialog(true);
  };

  // Close Edit modal
  const closeEditDialog = () => {
    setEditingActivity(null);
    setShowEditDialog(false);
  };

  // Save edited activity and update state
  const handleSaveEdit = async (updated: Asset) => {
    const toastId = toast.loading("Saving changes...");

    try {
      const res = await fetch("/api/Data/Applications/PantsIn/Edit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Update failed");
      }

      // Update UI list
      setAsset((prev) =>
        prev.map((act) =>
          act._id === updated._id ? { ...act, ...updated } : act
        )
      );

      toast.success("Activity updated successfully!", { id: toastId });
      closeEditDialog();
    } catch (err: any) {
      toast.error(`Error updating activity: ${err.message}`, { id: toastId });
    }
  };

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
                <BreadcrumbLink href="#">Acculog</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Activity Logs</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        {/* Search, Date Range, Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search activities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-full"
            />
            {isFetching && (
              <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setShowFilterDialog(true)}
              className="h-9 w-9"
            >
              <Filter className="size-4" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                resetFilters();
              }}
            >
              Clear
            </Button>

            {selectedIds.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="whitespace-nowrap"
              >
                Delete Selected ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="mx-4 border border-border shadow-sm rounded-lg overflow-hidden">
          {isFetching ? (
            <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="size-6 animate-spin" />
              <span>Loading activities...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px] w-full text-sm">
                <TableHeader className="bg-muted sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={selectedIds.size === current.length && current.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    {/* Columns only for the specified fields */}
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Asset Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="w-16 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {current.map((act, index) => (
                    <TableRow
                      key={act._id || `${act.assetTag}-${index}`}
                      className="even:bg-muted/40 text-[11px]"
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedIds.has(act._id)}
                          onCheckedChange={() => toggleSelect(act._id)}
                        />
                      </TableCell>

                      <TableCell>{act.assetTag || "N/A"}</TableCell>
                      <TableCell>{act.assetType || "N/A"}</TableCell>
                      <TableCell>{act.status || "N/A"}</TableCell>
                      <TableCell>{act.location || "N/A"}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          onClick={() => openEditDialog(act)}
                          aria-label={`Edit asset ${act.assetTag || act._id}`}
                        >
                          <EditIcon className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center gap-4 my-4">
          <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />
        </div>

        {/* Edit Activity Modal */}
        {showEditDialog && editingActivity && (
          <EditActivityModal
            asset={editingActivity}
            onCloseAction={closeEditDialog}
            onSaveAction={handleSaveEdit}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
