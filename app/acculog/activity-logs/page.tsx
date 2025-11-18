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

import EditActivityModal, { Log } from "../../components/app-acculog-edit-dialog";
import { Calendar23 } from "../../components/app-acculog-daterange";
import { DeleteDialog } from "../../components/app-acculog-delete-dialog";
import { ActivityFilterDialog } from "../../components/app-acculog-filter-dialog";

interface UserAccount {
    ReferenceID: string;
    _id: string;
}

export default function ActivityLogsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);
    const [log, setLog] = useState<Log[]>([]);
    const [accounts, setAccounts] = useState<UserAccount[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isFetching, setIsFetching] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const rowsPerPage = 20;
    const [editingActivity, setEditingActivity] = useState<Log | null>(null);
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
            const response = await fetch("/api/Data/Applications/PantsIn/Fetch");
            const json = await response.json();
            if (!response.ok || json.success === false)
                throw new Error(json.error || "Failed to fetch activities");
            setLog(json.data || []);
        } catch (err: any) {
            toast.error(`Error fetching activity logs: ${err.message}`);
        } finally {
            setIsFetching(false);
        }
    };

    const fetchAccounts = async () => {
        try {
            const res = await fetch("/api/UserManagement/Fetch");
            const data = await res.json();
            const normalized = (data || []).map((u: any) => ({
                ReferenceID: (u.ReferenceID || "").toString().trim().toLowerCase(),
            }));
            setAccounts(normalized);
        } catch (err) {
            console.error("Error fetching accounts", err);
        }
    };

    useEffect(() => {
        fetchActivities();
        fetchAccounts();
    }, []);

    // Filter activities based on search, date range, and filters
    const filtered = useMemo(() => {
        return log
            .filter((a) => {
                // Search filter
                if (
                    search &&
                    !Object.values(a).join(" ").toLowerCase().includes(search.toLowerCase())
                )
                    return false;

                // Date range filter
                if (dateRange?.from || dateRange?.to) {
                    if (!a.date_created) return false;
                    const created = new Date(a.date_created);
                    if (dateRange.from && created < dateRange.from) return false;
                    if (dateRange.to && created > dateRange.to) return false;
                }

                // Activity filters
                if (filterStatus && a.Status !== filterStatus) return false;

                return true;
            })
            .sort((a, b) => {
                const dateA = new Date(a.date_created ?? 0).getTime();
                const dateB = new Date(b.date_created ?? 0).getTime();
                return dateB - dateA;
            });
    }, [log, search, dateRange, filterStatus]);

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
    const openEditDialog = (activity: Log) => {
        setEditingActivity(activity);
        setShowEditDialog(true);
    };

    // Close Edit modal
    const closeEditDialog = () => {
        setEditingActivity(null);
        setShowEditDialog(false);
    };

    // Save edited activity and update state
    const handleSaveEdit = async (updated: Log) => {
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
            setLog((prev) =>
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

    const confirmDelete = async () => {
        const toastId = toast.loading("Deleting activities...");
        try {
            const res = await fetch("/api/Data/Applications/PantsIn/DeleteBulk", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });

            const result = await res.json();

            if (!res.ok || !result.success) {
                throw new Error(result.error || "Delete failed");
            }

            setLog((prev) => prev.filter((a) => !selectedIds.has(a._id)));
            setSelectedIds(new Set());

            toast.success(`Deleted ${result.deletedCount} activities.`, { id: toastId });
        } catch (err: any) {
            toast.error(`Error deleting activities: ${err.message}`, { id: toastId });
        } finally {
            setShowDeleteDialog(false);
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

                        <Calendar23
                            range={range}
                            onRangeChange={(newRange) => {
                                setRange(newRange);
                                setDateRange(newRange);
                            }}
                        />
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
                            <Table className="min-w-[900px] w-full text-sm">
                                <TableHeader className="bg-muted sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="w-10 text-center">
                                            <Checkbox
                                                checked={selectedIds.size === current.length && current.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                            />

                                        </TableHead>
                                        <TableHead>ReferenceID</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date Created</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Latitude</TableHead>
                                        <TableHead>Longitude</TableHead>
                                        <TableHead>PhotoURL</TableHead>
                                        <TableHead className="w-16 text-center">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {current.map((act, index) => (
                                        <TableRow
                                            key={act._id || `${act.ReferenceID}-${index}`} // dito na fix ang key uniqueness
                                            className="even:bg-muted/40 text-[11px]"
                                        >
                                            <TableCell className="text-center">
                                                <Checkbox
                                                    checked={selectedIds.has(act._id)}
                                                    onCheckedChange={() => toggleSelect(act._id)}
                                                />

                                            </TableCell>

                                            <TableCell>{act.ReferenceID || "N/A"}</TableCell>
                                            <TableCell>{act.Email || "N/A"}</TableCell>
                                            <TableCell>{act.Type || "N/A"}</TableCell>
                                            <TableCell>
                                                <Badge className="text-[8px]">{act.Status || "N/A"}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {act.date_created
                                                    ? new Date(act.date_created).toLocaleString()
                                                    : "N/A"}
                                            </TableCell>
                                            <TableCell>{act.Location || "N/A"}</TableCell>
                                            <TableCell>{act.Latitude || "N/A"}</TableCell>
                                            <TableCell>{act.Longitude || "N/A"}</TableCell>
                                            <TableCell>
                                                {act.PhotoURL ? (
                                                    <img
                                                        src={act.PhotoURL}
                                                        alt={`Photo of ${act.ReferenceID || "activity"}`}
                                                        className="w-12 h-12 object-cover rounded"
                                                    />
                                                ) : (
                                                    "N/A"
                                                )}
                                            </TableCell>

                                            <TableCell className="text-center">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => openEditDialog(act)}
                                                    aria-label={`Edit activity ${act.ReferenceID || act._id}`}
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
                        log={editingActivity}
                        onCloseAction={closeEditDialog}
                        onSaveAction={handleSaveEdit}
                    />
                )}

                {/* Delete Dialog */}
                <DeleteDialog
                    open={showDeleteDialog}
                    count={selectedIds.size}
                    onCancelAction={() => setShowDeleteDialog(false)}
                    onConfirmAction={confirmDelete}
                />

                <ActivityFilterDialog
                    open={showFilterDialog}
                    onOpenChangeAction={setShowFilterDialog}
                    log={log}
                    filterStatus={filterStatus}
                    setFilterStatusAction={setFilterStatus}
                    resetFiltersAction={resetFilters}
                />

            </SidebarInset>
        </SidebarProvider>
    );
}
