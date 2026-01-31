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
    activity_reference_number: string;
    referenceid: string;
    tsm: string;
    manager: string;
    type_client: string;
    project_name: string;
    product_category: string;
    project_type: string;
    source: string;
    target_quota: string;
    type_activity: string;
    callback: string;
    call_status: string;
    call_type: string;
    quotation_number: string;
    quotation_amount: string;
    so_number: string;
    so_amount: string;
    actual_sales: string;
    delivery_date: string;
    dr_number: string;
    ticket_reference_number: string;
    remarks: string;
    status: string;
    start_date: string;
    end_date: string;
    date_followup: string;
    date_site_visit: string;
    date_created: string;
    date_updated: string;
    account_reference_number: string;
    payment_terms: string;
    scheduled_status: string;
    product_quantity: string;
    product_amount: string;
    product_description: string;
    product_photo: string;
    product_sku: string;
    product_title: string;
    quotation_type: string;
    si_date: string;
    agent: string;
    tsm_approved_status: string;
    tsm_approved_remarks: string;
    tsm_approved_date: string;
    company_name: string;
    contact_person: string;
    contact_number: string;
    email_address: string;
    address: string;
    vat_type: string;
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

    // Fetch activities from supabase
    const fetchActivities = async () => {
        setIsFetching(true);

        const { data, error } = await supabase
            .from("history")
            .select("*") // select all columns

        if (error) {
            toast.error(`Error fetching activities: ${error.message}`);
            setActivities([]);
        } else {
            setActivities(data);
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

    const filteredActivities = useMemo(() => {
        if (!search.trim())
            return [...activities].sort((a, b) =>
                new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
            );

        const lowerSearch = search.toLowerCase();

        return activities
            .filter((act) =>
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
            )
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

        try {
            const { error } = await supabase
                .from("history")
                .update(formData) // send all formData fields
                .eq("id", selectedActivity.id);

            if (error) {
                toast.error("Failed to update activity: " + error.message);
                return;
            }

            toast.success("Activity updated successfully");
            await fetchActivities();
            setIsEditing(false);
            setSelectedActivity(null);
        } catch (err) {
            toast.error("An unexpected error occurred");
            console.error(err);
        }
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
            .from("history")
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
                                <BreadcrumbPage>Progress Logs</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>

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
                                    <TableHead>Status</TableHead>
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

                                            <TableCell>{act.status || "-"}</TableCell>

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
                    <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle>Activity Details</DialogTitle>
                        </DialogHeader>

                        {selectedActivity && (
                            <div className="overflow-y-auto pr-2 flex-1">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {Object.keys(selectedActivity)
                                        .filter((key) => key !== "id") // exclude id
                                        .map((key) => {
                                            const isLongField =
                                                key === "remarks" || key === "address" || key === "product_description";

                                            return (
                                                <div key={key} className={isLongField ? "col-span-2" : ""}>
                                                    <strong>
                                                        {key
                                                            .replace(/_/g, " ")
                                                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                                                        :
                                                    </strong>
                                                    {isEditing ? (
                                                        isLongField ? (
                                                            <textarea
                                                                className="w-full border rounded px-2 py-1 text-sm"
                                                                value={(formData as any)[key] || ""}
                                                                onChange={(e) =>
                                                                    handleChange(key as keyof Activity, e.target.value)
                                                                }
                                                            />
                                                        ) : (
                                                            <Input
                                                                type="text"
                                                                value={(formData as any)[key] || ""}
                                                                onChange={(e) =>
                                                                    handleChange(key as keyof Activity, e.target.value)
                                                                }
                                                            />
                                                        )
                                                    ) : (
                                                        <span> {(selectedActivity as any)[key] || "-"}</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        <DialogFooter className="flex justify-between mt-2">
                            {!isEditing ? (
                                <>
                                    <Button variant="outline" onClick={() => setSelectedActivity(null)}>
                                        Close
                                    </Button>
                                    <Button onClick={() => setIsEditing(true)}>Edit</Button>
                                </>
                            ) : (
                                <>
                                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleUpdate}>Save Changes</Button>
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
