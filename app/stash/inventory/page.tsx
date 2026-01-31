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

import { supabase } from "@/utils/supabase-it";
import { Input } from "@/components/ui/input";

interface Activity {
    id: string;
    referenceid: string;
    asset_tag: string;
    asset_type: string;
    status: string;
    location: string;
    new_user: string;
    old_user: string;
    department: string;
    position: string;
    brand: string;
    model: string;
    processor: string;
    ram: string;
    storage: string;
    serial_number: string;
    purchase_date: string;
    warranty_date: string;
    asset_age: string;
    amount: string;
    remarks: string;
    mac_address: string;
    date_created: string;
    date_updated: string;
}

interface Agent {
    ReferenceID: string;
    Firstname: string;
    Lastname: string;
    profilePicture?: string;
}

const ROWS_PER_PAGE = 15;

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
            .from("inventory")
            .select(`*`)
            .order("date_updated", { ascending: false });

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

    const filteredActivities = useMemo(() => {
        let filtered = activities;

        if (search.trim()) {
            const lowerSearch = search.toLowerCase();

            filtered = activities.filter((act) =>
                [act.referenceid, act.asset_tag]
                    .filter(Boolean)
                    .some((field) => field.toLowerCase().includes(lowerSearch))
            );
        }

        // Sort by date_updated descending (latest first)
        return filtered.sort(
            (a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()
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
            .from("inventory")
            .update(formData) // send all formData fields
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
            .from("inventory")
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
                                <BreadcrumbLink href="#">Stash</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Inventory</BreadcrumbPage>
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
                                    <TableHead>ReferenceID</TableHead>
                                    <TableHead>Asset Tag</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>New User</TableHead>
                                    <TableHead>Old User</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Status</TableHead>
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

                                            <TableCell>{act.referenceid || "-"}</TableCell>
                                            <TableCell>{act.asset_tag || "-"}</TableCell>
                                            <TableCell>{act.asset_type || "-"}</TableCell>
                                            <TableCell>{act.location || "-"}</TableCell>
                                            <TableCell>{act.new_user || "-"}</TableCell>
                                            <TableCell>{act.old_user || "-"}</TableCell>
                                            <TableCell>{act.department || "-"}</TableCell>
                                            <TableCell>{act.status || "-"}</TableCell>
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
                    <DialogContent className="max-w-2xl max-h-[60vh] overflow-y-auto">

                        <DialogHeader>
                            <DialogTitle>Activity Details</DialogTitle>
                        </DialogHeader>

                        {selectedActivity && (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {/* Referenceid */}
                                <div>
                                    <strong>ReferenceID:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.referenceid || ""}
                                            onChange={(e) => handleChange("referenceid", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.referenceid || "-"}</span>
                                    )}
                                </div>

                                {/* Asset Tag */}
                                <div>
                                    <strong>Asset Tag:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.asset_tag || ""}
                                            onChange={(e) => handleChange("asset_tag", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.asset_tag || "-"}</span>
                                    )}
                                </div>

                                {/* Asset Type */}
                                <div>
                                    <strong>Asset Type:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.asset_type || ""}
                                            onChange={(e) => handleChange("asset_type", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.asset_type || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Status:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.status || ""}
                                            onChange={(e) => handleChange("status", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.status || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Location:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.location || ""}
                                            onChange={(e) => handleChange("location", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.location || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>New User:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.new_user || ""}
                                            onChange={(e) => handleChange("new_user", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.new_user || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Old User:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.old_user || ""}
                                            onChange={(e) => handleChange("old_user", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.old_user || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Department:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.department || ""}
                                            onChange={(e) => handleChange("department", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.department || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Position:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.position || ""}
                                            onChange={(e) => handleChange("position", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.position || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Brand:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.brand || ""}
                                            onChange={(e) => handleChange("brand", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.brand || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Model:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.model || ""}
                                            onChange={(e) => handleChange("model", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.model || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Processor:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.processor || ""}
                                            onChange={(e) => handleChange("processor", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.processor || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Ram:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.ram || ""}
                                            onChange={(e) => handleChange("ram", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.ram || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Storage:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.storage || ""}
                                            onChange={(e) => handleChange("storage", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.storage || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Serial Number:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.serial_number || ""}
                                            onChange={(e) => handleChange("serial_number", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.serial_number || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Purchase Date:</strong>
                                    {isEditing ? (
                                        <Input type="date"
                                            value={formData.purchase_date || ""}
                                            onChange={(e) => handleChange("purchase_date", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.purchase_date || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Warranty Date:</strong>
                                    {isEditing ? (
                                        <Input type="date"
                                            value={formData.warranty_date || ""}
                                            onChange={(e) => handleChange("warranty_date", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.warranty_date || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Asset Age:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.asset_age || ""}
                                            onChange={(e) => handleChange("asset_age", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.asset_age || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Amount:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.amount || ""}
                                            onChange={(e) => handleChange("amount", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.amount || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Remarks:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.remarks || ""}
                                            onChange={(e) => handleChange("remarks", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.remarks || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Mac Address:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.mac_address || ""}
                                            onChange={(e) => handleChange("mac_address", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.mac_address || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Date Created:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.date_created || ""}
                                            onChange={(e) => handleChange("date_created", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.date_created || "-"}</span>
                                    )}
                                </div>

                                <div>
                                    <strong>Date Updated:</strong>
                                    {isEditing ? (
                                        <Input
                                            value={formData.date_updated || ""}
                                            onChange={(e) => handleChange("date_updated", e.target.value)}
                                        />
                                    ) : (
                                        <span> {selectedActivity.date_updated || "-"}</span>
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
