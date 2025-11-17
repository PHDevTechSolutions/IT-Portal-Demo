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

import EditActivityModal, { Inquiries } from "../../components/app-inquiries-edit-dialog";
import { DeleteDialog } from "../../components/app-inquiries-delete-dialog";
import { ActivityFilterDialog } from "../../components/app-inquiries-filter-dialog";

interface UserAccount {
    referenceid: string;
    targetquota: string;
}

export default function ActivityLogsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);
    const [activities, setActivities] = useState<Inquiries[]>([]);
    const [accounts, setAccounts] = useState<UserAccount[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isFetching, setIsFetching] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [rowsPerPage] = useState(20);
    const [editingActivity, setEditingActivity] = useState<Inquiries | null>(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [range, setRange] = React.useState<DateRange | undefined>();
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showBulkUpdateDialog, setShowBulkUpdateDialog] = useState(false);

    const [showFilterDialog, setShowFilterDialog] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
    const [filterTypeClient, setFilterTypeClient] = useState<string | undefined>(undefined);

    const resetFilters = () => {
        setFilterStatus("");
        setFilterTypeClient("");
        setRange(undefined);
        setDateRange(undefined);
        setSearch("");
        setPage(1);
    };

    // Fetch activities
    const fetchActivities = async () => {
        try {
            setIsFetching(true);
            const response = await fetch("/api/Data/Applications/Taskflow/Inquiries/Fetch");
            const json = await response.json();
            if (!response.ok || json.success === false)
                throw new Error(json.error || "Failed to fetch activities");
            setActivities(json.data || []);
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
        return activities
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

                if (filterStatus && a.status !== filterStatus)
                    return false;
                if (filterTypeClient && a.typeclient !== filterTypeClient)
                    return false;

                return true;
            })
            .sort((a, b) => {
                const dateA = new Date(a.date_created ?? 0).getTime();
                const dateB = new Date(b.date_created ?? 0).getTime();
                return dateB - dateA;
            });
    }, [activities, search, dateRange, filterStatus, filterTypeClient]);

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
    const openEditDialog = (activity: Inquiries) => {
        setEditingActivity(activity);
        setShowEditDialog(true);
    };

    const closeEditDialog = () => {
        setEditingActivity(null);
        setShowEditDialog(false);
    };

    // Save updated activity: call API and update state
    const handleSaveEdit = async (updatedActivity: Inquiries) => {
        try {
            if (!updatedActivity.id) {
                throw new Error("Missing activity id");
            }

            const {
                id,
                companyname,
                contactperson,
                contactnumber,
                emailaddress,
                address,
                typeclient,
                ticketreferencenumber,
                wrapup,
                inquiries,
                csragent,
                status,
                salesagentname
            } = updatedActivity;

            const payload = {
                id,
                companyname,
                contactperson,
                contactnumber,
                emailaddress,
                address,
                typeclient,
                ticketreferencenumber,
                wrapup,
                inquiries,
                csragent,
                status,
                salesagentname,
            };

            const response = await fetch("/api/inquiries/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || "Failed to update activity");
            }

            setActivities((prev) =>
                prev.map((a) => (a.id === updatedActivity.id ? result.updatedActivity : a))
            );
            closeEditDialog();
            toast.success("Activity updated.");
        } catch (error: any) {
            toast.error(`Update failed: ${error.message}`);
        }
    };

    const confirmDelete = async () => {
        const toastId = toast.loading("Deleting activities...");
        try {
            const res = await fetch("/api/activity/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error("Delete failed");

            setActivities((prev) => prev.filter((a) => !selectedIds.has(a.id)));
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
                                <BreadcrumbPage>CSR Inquiries</BreadcrumbPage>
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
                            <span>Loading activities...</span>
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
                                        <TableHead>Ticket Ref #</TableHead>
                                        <TableHead>Agent</TableHead>
                                        <TableHead>Company Info</TableHead>
                                        <TableHead>CSR Agent</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="w-16 text-center">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {current.map((act, index) => (
                                        <TableRow key={act.id || `activity-${index}`} className="even:bg-muted/40 text-[11px]">
                                            <TableCell className="text-center">
                                                <Checkbox
                                                    checked={selectedIds.has(act.id)}
                                                    onCheckedChange={() => toggleSelect(act.id)}
                                                />
                                            </TableCell>

                                            <TableCell>{act.ticketreferencenumber || "N/A"}</TableCell>
                                            <TableCell>{act.salesagentname || "N/A"}</TableCell>

                                            <TableCell className="text-[11px] leading-tight">
                                                <strong>{act.companyname || "N/A"}</strong>
                                                <br />
                                                {act.contactperson} / {act.contactnumber}
                                                <br />
                                                {act.emailaddress}
                                                <br />
                                                <span className="text-muted-foreground break-words whitespace-normal">{act.address}</span>
                                            </TableCell>
                                            <TableCell>{act.csragent || "N/A"}{act.wrapup || "N/A"}{act.inquiries || "N/A"}</TableCell>
                                            <TableCell><Badge>{act.status || "N/A"}</Badge></TableCell>
                                            <TableCell>
                                                Created:{" "}
                                                {act.date_created ? new Date(act.date_created).toLocaleString() : "N/A"} <br /> Updated:{" "}
                                                {act.date_updated ? new Date(act.date_updated).toLocaleString() : "N/A"}
                                            </TableCell>

                                            <TableCell className="text-center">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => openEditDialog(act)}
                                                    aria-label={`Edit activity ${act.activitynumber || act.id}`}
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
                    <EditActivityModal
                        activity={editingActivity}
                        onCloseAction={closeEditDialog}
                        onSaveAction={handleSaveEdit}
                    />
                )}

                <DeleteDialog
                    open={showDeleteDialog}
                    count={selectedIds.size}
                    onCancelAction={() => setShowDeleteDialog(false)}
                    onConfirmAction={confirmDelete}
                />

                <ActivityFilterDialog
                    open={showFilterDialog}
                    onOpenChangeAction={setShowFilterDialog}
                    activities={activities}
                    filterStatus={filterStatus}
                    filterTypeClient={filterTypeClient}
                    setFilterStatusAction={setFilterStatus}
                    setFilterTypeClientAction={setFilterTypeClient}
                    resetFiltersAction={resetFilters}
                />

            </SidebarInset>
        </SidebarProvider>
    );
}
