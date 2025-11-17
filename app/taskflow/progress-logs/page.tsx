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
import { Pagination } from "../../components/app-pagination"
import { Separator } from "@/components/ui/separator";
import type { DateRange } from "react-day-picker";
import { Calendar23 } from "../../components/app-activity-daterange";
import { Badge } from "@/components/ui/badge";

import EditProgressModal, { Progress } from "../../components/app-progress-edit-dialog";
import { DeleteDialog } from "../../components/app-progress-delete-dialog";
import BulkUpdateTargetQuotaModal from "../../components/app-progress-bulk-target-quota";
import { ProgressFilterDialog } from "../../components/app-progress-filter-dialog";

interface UserAccount {
    referenceid: string;
    targetquota: string;
}

export default function ProgressLogsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);
    const [progress, setProgress] = useState<Progress[]>([]);
    const [accounts, setAccounts] = useState<UserAccount[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isFetching, setIsFetching] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [rowsPerPage] = useState(20);
    const [editingActivity, setEditingActivity] = useState<Progress | null>(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [range, setRange] = React.useState<DateRange | undefined>();
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showBulkUpdateDialog, setShowBulkUpdateDialog] = useState(false);

    const [showFilterDialog, setShowFilterDialog] = useState(false);
    const [filterTypeActivity, setFilterTypeActivity] = useState<string | undefined>(undefined);
    const [filterActivityStatus, setFilterActivityStatus] = useState<string | undefined>(undefined);
    const [filterTypeClient, setFilterTypeClient] = useState<string | undefined>(undefined);
    const [filterSource, setFilterSource] = useState<string | undefined>(undefined);

    const resetFilters = () => {
        setFilterTypeActivity("");
        setFilterActivityStatus("");
        setFilterTypeClient("");
        setFilterSource("");
        setRange(undefined);
        setDateRange(undefined);
        setSearch("");
        setPage(1);
    };

    // Fetch activities
    const fetchActivities = async () => {
        try {
            setIsFetching(true);
            const response = await fetch("/api/Data/Applications/Taskflow/Progress/Fetch");
            const json = await response.json();
            if (!response.ok || json.success === false)
                throw new Error(json.error || "Failed to fetch activities");
            setProgress(json.data || []);
        } catch (err: any) {
            toast.error(`Error fetching activity logs: ${err.message}`);
        } finally {
            setIsFetching(false);
        }
    };

    // Fetch accounts
    const fetchAccounts = async () => {
        try {
            const res = await fetch("/api/UserManagement/Fetch");
            const data = await res.json();
            const normalized = (data || []).map((u: any) => ({
                referenceid: (u.ReferenceID || u.referenceid || "").toString().trim().toLowerCase(),
                targetquota: u.targetquota || "",
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

    // Filter and paginate with search and dateRange
    const filtered = useMemo(() => {
        return progress
            .filter((a) => {
                // Search
                if (
                    search &&
                    !Object.values(a).join(" ").toLowerCase().includes(search.toLowerCase())
                )
                    return false;

                // Date range
                if (dateRange?.from || dateRange?.to) {
                    if (!a.date_created) return false;
                    const created = new Date(a.date_created);
                    if (dateRange.from && created < dateRange.from) return false;
                    if (dateRange.to && created > dateRange.to) return false;
                }
                
                if (filterTypeActivity && a.typeactivity !== filterTypeActivity)
                    return false;
                if (filterActivityStatus && a.activitystatus !== filterActivityStatus)
                    return false;
                if (filterTypeClient && a.typeclient !== filterTypeClient)
                    return false;
                if (filterSource && a.source !== filterSource)
                    return false;

                return true;
            })
            .sort((a, b) => {
                const dateA = new Date(a.date_created ?? 0).getTime();
                const dateB = new Date(b.date_created ?? 0).getTime();
                return dateB - dateA;
            });
    }, [progress, search, dateRange, filterTypeActivity, filterActivityStatus, filterTypeClient, filterSource]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
    const current = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    // Checkbox logic
    const toggleSelectAll = () => {
        if (selectedIds.size === current.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(current.map((a) => a.id)));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    // Edit dialog handlers
    const openEditDialog = (progress: Progress) => {
        setEditingActivity(progress);
        setShowEditDialog(true);
    };

    const closeEditDialog = () => {
        setEditingActivity(null);
        setShowEditDialog(false);
    };

    // Save updated activity: call API and update state
    const handleSaveEdit = async (updatedActivity: Progress) => {
        try {
            if (!updatedActivity.id) {
                throw new Error("Missing activity id");
            }

            // Payload will be the entire updatedActivity object (you can adjust this if you want to whitelist keys)
            const payload = { ...updatedActivity };

            const response = await fetch("/api/progress/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || "Failed to update activity");
            }

            // Update local state with the updated activity returned from the API
            setProgress((prev) =>
                prev.map((a) => (a.id === updatedActivity.id ? result.updatedActivity : a))
            );

            closeEditDialog();
            toast.success("Activity updated.");
        } catch (error: any) {
            toast.error(`Update failed: ${error.message}`);
        }
    };

    const handleBulkUpdate = async (newQuota: string) => {
        const toastId = toast.loading("Updating target quotas...");
        try {
            const res = await fetch("/api/progress/bulk-update-target-quota", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ids: Array.from(selectedIds),
                    targetquota: newQuota,
                }),
            });
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.error || "Update failed");

            // Update activities state with new targetquota for selected ids
            setProgress((prev) =>
                prev.map((a) =>
                    selectedIds.has(a.id) ? { ...a, targetquota: newQuota } : a
                )
            );
            toast.success("Target quotas updated.", { id: toastId });
            setSelectedIds(new Set());
            setShowBulkUpdateDialog(false);
        } catch (err: any) {
            toast.error(`Failed to update: ${err.message}`, { id: toastId });
        }
    };

    const confirmDelete = async () => {
        const toastId = toast.loading("Deleting activities...");
        try {
            const res = await fetch("/api/progress/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error("Delete failed");

            setProgress((prev) => prev.filter((a) => !selectedIds.has(a.id)));
            setSelectedIds(new Set());
            toast.success("Selected activities deleted successfully.", { id: toastId });
        } catch (err) {
            toast.error("Error deleting activities.", { id: toastId });
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
                                <BreadcrumbLink href="#">Taskflow</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Progress Logs</BreadcrumbPage>
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
                                setSearch("");
                                setRange(undefined);
                                setDateRange(undefined);
                                setPage(1);
                            }}
                        >
                            Clear
                        </Button>

                        {/* Delete Selected Button on the right side */}
                        {selectedIds.size > 0 && (
                            <>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setShowBulkUpdateDialog(true)}
                                    className="whitespace-nowrap"
                                >
                                    Update Target Quota ({selectedIds.size})
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setShowDeleteDialog(true)}
                                    className="whitespace-nowrap"
                                >
                                    Delete Selected ({selectedIds.size})
                                </Button>
                            </>
                        )}

                    </div>
                </div>

                {/* Table */}
                <div className="mx-4 border border-border shadow-sm rounded-lg overflow-hidden">
                    {isFetching ? (
                        <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
                            <Loader2 className="size-6 animate-spin" />
                            <span>Loading progress...</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="min-w-[1150px] w-full text-sm">
                                <TableHeader className="bg-muted sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="w-10 text-center">
                                            <Checkbox
                                                checked={selectedIds.size === current.length && current.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>Activity #</TableHead>
                                        <TableHead>Company Info</TableHead>
                                        <TableHead>Project Details</TableHead>
                                        <TableHead>Sales Details</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="w-16 text-center">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {current.map((act, index) => (
                                        <TableRow key={act.id || `progress-${index}`} className="even:bg-muted/40 text-[11px]">
                                            <TableCell className="text-center">
                                                <Checkbox
                                                    checked={selectedIds.has(act.id)}
                                                    onCheckedChange={() => toggleSelect(act.id)}
                                                />
                                            </TableCell>

                                            <TableCell>{act.activitynumber || "N/A"}</TableCell>

                                            <TableCell className="text-[11px] leading-tight">
                                                <strong>{act.companyname || "N/A"}</strong>
                                                <br />
                                                {act.contactperson} / {act.contactnumber}
                                                <br />
                                                {act.emailaddress}
                                            </TableCell>

                                            <TableCell className="text-[11px] leading-tight">
                                                <div>
                                                    <b>{act.projectname}</b> ({act.projectcategory})
                                                </div>
                                                <div>{act.projecttype}</div>
                                                <div>Ref ID: {act.referenceid || "N/A"}</div>
                                                <div>Source: {act.source}</div>
                                                <div>
                                                    {" "}
                                                    Target:{" "}
                                                    {act.targetquota ? (
                                                        act.targetquota
                                                    ) : (
                                                        <span className="text-red-500 italic">Missing</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[11px] leading-tight">
                                                <div>
                                                    <strong>Q-Num:</strong> {act.quotationnumber || "N/A"}
                                                </div>
                                                <div>
                                                    <strong>Q-Amount:</strong> {act.quotationamount || "N/A"}
                                                </div>
                                                <div>
                                                    <strong>SO Number:</strong> {act.sonumber || "N/A"}
                                                </div>
                                                <div>
                                                    <strong>SO Amount:</strong> {act.soamount || "N/A"}
                                                </div>
                                                <div>
                                                    <strong>Actual Sales:</strong> {act.actualsales || "N/A"}
                                                </div>
                                                <div>
                                                    <strong>DR Number:</strong> {act.drnumber || "N/A"}
                                                </div>
                                                <div>
                                                    <strong>Delivery Date:</strong> {act.deliverydate || "N/A"}
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <Badge className="text-[8px]">{act.activitystatus}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                Created:{" "}
                                                {act.date_created ? new Date(act.date_created).toLocaleString() : "N/A"} <br /> Updated:{" "}
                                                {act.date_updated ? new Date(act.date_updated).toLocaleString() : "N/A"}
                                            </TableCell>

                                            <TableCell className="text-center">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => openEditDialog(act)}
                                                    aria-label={`Edit progress ${act.activitynumber || act.id}`}
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

                <div className="flex justify-center items-center gap-4 my-4">
                    {/* Pagination */}
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPageChangeAction={setPage}
                    />
                </div>

                {/* Edit modal dialog */}
                {showEditDialog && editingActivity && (
                    <EditProgressModal
                        progress={editingActivity}
                        onCloseAction={closeEditDialog}
                        onSaveAction={handleSaveEdit}
                    />
                )}

                <BulkUpdateTargetQuotaModal
                    open={showBulkUpdateDialog}
                    count={selectedIds.size}
                    onCloseAction={() => setShowBulkUpdateDialog(false)}
                    onConfirmAction={handleBulkUpdate}
                />

                <DeleteDialog
                    open={showDeleteDialog}
                    count={selectedIds.size}
                    onCancelAction={() => setShowDeleteDialog(false)}
                    onConfirmAction={confirmDelete}
                />

                <ProgressFilterDialog
                    open={showFilterDialog}
                    onOpenChangeAction={setShowFilterDialog}
                    progress={progress}
                    filterTypeActivity={filterTypeActivity}
                    filterActivityStatus={filterActivityStatus}
                    filterTypeClient={filterTypeClient}
                    filterSource={filterSource}
                    setFilterActivityStatusAction={setFilterActivityStatus}
                    setFilterTypeActivityAction={setFilterTypeActivity}
                    setFilterTypeClientAction={setFilterTypeClient}
                    setFilterSourceAction={setFilterSource}
                    resetFiltersAction={resetFilters}
                />

            </SidebarInset>
        </SidebarProvider>
    );
}
