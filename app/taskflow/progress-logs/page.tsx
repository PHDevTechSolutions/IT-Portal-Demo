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
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

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

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Date range filtering
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Column sorting
    const [sortColumn, setSortColumn] = useState<string>("date_updated");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    // Column visibility
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
        referenceid: true,
        tsm: true,
        manager: true,
        company_name: true,
        contact_person: true,
        contact_number: true,
        email_address: true,
        address: true,
        type_client: true,
        project_name: true,
        product_category: true,
        project_type: true,
        source: true,
        target_quota: true,
        type_activity: true,
        callback: true,
        call_status: true,
        call_type: true,
        quotation_number: true,
        quotation_amount: true,
        so_number: true,
        so_amount: true,
        actual_sales: true,
        delivery_date: true,
        dr_number: true,
        ticket_reference_number: true,
        remarks: true,
        status: true,
        start_date: true,
        end_date: true,
        date_followup: true,
        date_site_visit: true,
        account_reference_number: true,
        payment_terms: true,
        scheduled_status: true,
        product_quantity: true,
        product_amount: true,
        product_description: true,
        product_sku: true,
        product_title: true,
        quotation_type: true,
        si_date: true,
        agent: true,
        tsm_approved_status: true,
        tsm_approved_remarks: true,
        tsm_approved_date: true,
        vat_type: true,
        activity_reference_number: true,
        date_created: true,
        date_updated: true,
    });
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    // Keyboard navigation
    const [focusedCell, setFocusedCell] = useState<{rowId: string, field: string} | null>(null);

    // Bulk edit
    const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
    const [bulkEditField, setBulkEditField] = useState<string>("");
    const [bulkEditValue, setBulkEditValue] = useState("");

    // Save indicator
    const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());

    // Fetch activities from supabase
    const fetchActivities = async () => {
        setIsFetching(true);

        let query = supabase
            .from("history")
            .select("*");

        // Apply date range filter if set
        if (dateFrom) {
            query = query.gte("date_created", dateFrom);
        }
        if (dateTo) {
            query = query.lte("date_created", dateTo);
        }

        // Order by date_updated descending (latest first) and limit to 1000
        const { data, error } = await query
            .order("date_updated", { ascending: false })
            .limit(1000);

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
        fetchActivities();
    }, [dateFrom, dateTo]);

    const filteredActivities = useMemo(() => {
        if (!search.trim()) return activities;

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

    // Get sorted activities
    const sortedActivities = useMemo(() => {
        if (!sortColumn) return filteredActivities;
        
        return [...filteredActivities].sort((a, b) => {
            const aVal = a[sortColumn as keyof Activity] || '';
            const bVal = b[sortColumn as keyof Activity] || '';
            
            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [filteredActivities, sortColumn, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(sortedActivities.length / ROWS_PER_PAGE));
    const paginatedActivities = useMemo(() => {
        const start = (page - 1) * ROWS_PER_PAGE;
        return sortedActivities.slice(start, start + ROWS_PER_PAGE);
    }, [sortedActivities, page]);

    const goToPrevious = () => setPage((p) => Math.max(1, p - 1));
    const goToNext = () => setPage((p) => Math.min(totalPages, p + 1));

    useEffect(() => {
        setPage(1);
    }, [search]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!focusedCell) return;

            const currentIndex = paginatedActivities.findIndex(a => a.id === focusedCell.rowId);
            const fields = Object.keys(columnVisibility).filter(key => columnVisibility[key]);
            const currentFieldIndex = fields.indexOf(focusedCell.field);

            if (e.key === 'ArrowDown' && currentIndex < paginatedActivities.length - 1) {
                e.preventDefault();
                setFocusedCell({
                    rowId: paginatedActivities[currentIndex + 1].id,
                    field: focusedCell.field
                });
            } else if (e.key === 'ArrowUp' && currentIndex > 0) {
                e.preventDefault();
                setFocusedCell({
                    rowId: paginatedActivities[currentIndex - 1].id,
                    field: focusedCell.field
                });
            } else if (e.key === 'ArrowRight' && currentFieldIndex < fields.length - 1) {
                e.preventDefault();
                setFocusedCell({
                    rowId: focusedCell.rowId,
                    field: fields[currentFieldIndex + 1]
                });
            } else if (e.key === 'ArrowLeft' && currentFieldIndex > 0) {
                e.preventDefault();
                setFocusedCell({
                    rowId: focusedCell.rowId,
                    field: fields[currentFieldIndex - 1]
                });
            } else if (e.key === 'Escape') {
                setFocusedCell(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [focusedCell, paginatedActivities, columnVisibility]);

    const formatDate = (dateStr: string | null) =>
        dateStr ? new Date(dateStr).toLocaleDateString() : "N/A";

    const handleInlineUpdate = async (id: string, field: keyof Activity, value: string) => {
        try {
            const { error } = await supabase
                .from("history")
                .update({ [field]: value })
                .eq("id", id);

            if (error) {
                toast.error(`Failed to update ${field}: ` + error.message);
                return;
            }

            toast.success(`${field} updated successfully`);
            setUnsavedChanges(prev => {
                const newSet = new Set(prev);
                newSet.delete(`${id}-${field}`);
                return newSet;
            });
            await fetchActivities();
        } catch (err) {
            toast.error("An unexpected error occurred");
            console.error(err);
        }
    };

    // Export to CSV
    const exportToCSV = () => {
        const headers = Object.keys(columnVisibility).filter(key => columnVisibility[key]);
        const csvContent = [
            headers.join(','),
            ...paginatedActivities.map(row => 
                headers.map(header => {
                    const value = row[header as keyof Activity] || '';
                    const stringValue = String(value);
                    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                        return `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `progress-logs-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Handle column sort
    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    // Toggle column visibility
    const toggleColumnVisibility = (column: string) => {
        setColumnVisibility(prev => ({
            ...prev,
            [column]: !prev[column]
        }));
    };

    // Handle bulk edit
    const handleBulkEdit = async () => {
        if (selectedIds.length === 0 || !bulkEditField) return;

        const { error } = await supabase
            .from("history")
            .update({ [bulkEditField]: bulkEditValue })
            .in("id", selectedIds);

        if (error) {
            toast.error("Failed to bulk update");
            return;
        }

        toast.success(`Updated ${selectedIds.length} rows`);
        setShowBulkEditDialog(false);
        setBulkEditField("");
        setBulkEditValue("");
        setSelectedIds([]);
        await fetchActivities();
    };

    // Cell validation
    const validateCell = (field: string, value: string): boolean => {
        if (!value) return true;
        
        switch (field) {
            case 'email_address':
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            case 'contact_number':
                return /^[0-9+\-\s()]*$/.test(value);
            default:
                return true;
        }
    };

    // Handle cell change with validation
    const handleCellChange = (id: string, field: string, value: string) => {
        if (!validateCell(field, value)) {
            toast.error(`Invalid ${field.replace(/_/g, ' ')}`);
            return;
        }
        
        setUnsavedChanges(prev => new Set([...prev, `${id}-${field}`]));
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
        <ProtectedPageWrapper>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    {/* Header */}
                    <header className="flex h-auto min-h-[56px] items-center gap-2 px-2 md:px-4 py-2 flex-wrap">
                        <SidebarTrigger className="-ml-1 touch-button" />
                        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
                            Home
                        </Button>
                        <Separator orientation="vertical" className="h-4 hidden sm:block" />
                        <Breadcrumb className="hidden sm:flex">
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
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8 w-full"
                            />
                            {isFetching && (
                                <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-muted-foreground" />
                            )}
                        </div>

                        {/* Date Range Filter */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full sm:w-auto"
                                placeholder="From"
                            />
                            <span className="text-muted-foreground">to</span>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full sm:w-auto"
                                placeholder="To"
                            />
                            {(dateFrom || dateTo) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setDateFrom("");
                                        setDateTo("");
                                    }}
                                >
                                    Clear
                                </Button>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={exportToCSV}
                                className="flex items-center gap-2"
                            >
                                Export CSV
                            </Button>
                            
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowColumnMenu(!showColumnMenu)}
                                className="flex items-center gap-2"
                            >
                                Columns
                            </Button>

                            {selectedIds.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowBulkEditDialog(true)}
                                >
                                    Bulk Edit ({selectedIds.length})
                                </Button>
                            )}

                            {selectedIds.length > 0 && (
                                <Button
                                    variant="destructive"
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    Delete ({selectedIds.length})
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Column Visibility Menu */}
                    {showColumnMenu && (
                        <div className="mx-4 p-4 border border-border rounded-lg bg-background shadow-sm">
                            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                                {Object.keys(columnVisibility).map(column => (
                                    <label key={column} className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={columnVisibility[column]}
                                            onChange={() => toggleColumnVisibility(column)}
                                        />
                                        <span className="capitalize">{column.replace(/_/g, ' ')}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    <div className="mx-4 border border-border shadow-sm rounded-lg overflow-hidden">
                        {isFetching ? (
                            <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
                                <Loader2 className="size-6 animate-spin" />
                                <span>Loading activities...</span>
                            </div>
                        ) : (
                            <div className="overflow-auto max-h-[calc(100vh-300px)]">
                                <Table className="min-w-[3000px] w-full text-sm whitespace-nowrap">
                                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead className="w-10 bg-background">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        paginatedActivities.length > 0 &&
                                                        paginatedActivities.every((a) => selectedIds.includes(a.id))
                                                    }
                                                    onChange={toggleSelectAll}
                                                />
                                            </TableHead>
                                            <TableHead className="bg-background">Ref ID</TableHead>
                                            <TableHead className="bg-background">TSM</TableHead>
                                            <TableHead className="bg-background">Manager</TableHead>
                                            <TableHead className="bg-background">Company Name</TableHead>
                                            <TableHead className="bg-background">Contact Person</TableHead>
                                            <TableHead className="bg-background">Contact Number</TableHead>
                                            <TableHead className="bg-background">Email</TableHead>
                                            <TableHead className="bg-background">Address</TableHead>
                                            <TableHead className="bg-background">Type Client</TableHead>
                                            <TableHead className="bg-background">Project Name</TableHead>
                                            <TableHead className="bg-background">Product Category</TableHead>
                                            <TableHead className="bg-background">Project Type</TableHead>
                                            <TableHead className="bg-background">Source</TableHead>
                                            <TableHead className="bg-background">Target Quota</TableHead>
                                            <TableHead className="bg-background">Type Activity</TableHead>
                                            <TableHead className="bg-background">Callback</TableHead>
                                            <TableHead className="bg-background">Call Status</TableHead>
                                            <TableHead className="bg-background">Call Type</TableHead>
                                            <TableHead className="bg-background">Quotation #</TableHead>
                                            <TableHead className="bg-background">Quotation Amount</TableHead>
                                            <TableHead className="bg-background">SO #</TableHead>
                                            <TableHead className="bg-background">SO Amount</TableHead>
                                            <TableHead className="bg-background">Actual Sales</TableHead>
                                            <TableHead className="bg-background">Delivery Date</TableHead>
                                            <TableHead className="bg-background">DR #</TableHead>
                                            <TableHead className="bg-background">Ticket Ref #</TableHead>
                                            <TableHead className="bg-background">Remarks</TableHead>
                                            <TableHead className="bg-background">Status</TableHead>
                                            <TableHead className="bg-background">Start Date</TableHead>
                                            <TableHead className="bg-background">End Date</TableHead>
                                            <TableHead className="bg-background">Date Followup</TableHead>
                                            <TableHead className="bg-background">Date Site Visit</TableHead>
                                            <TableHead className="bg-background">Account Ref #</TableHead>
                                            <TableHead className="bg-background">Payment Terms</TableHead>
                                            <TableHead className="bg-background">Scheduled Status</TableHead>
                                            <TableHead className="bg-background">Product Qty</TableHead>
                                            <TableHead className="bg-background">Product Amount</TableHead>
                                            <TableHead className="bg-background">Product Description</TableHead>
                                            <TableHead className="bg-background">Product SKU</TableHead>
                                            <TableHead className="bg-background">Product Title</TableHead>
                                            <TableHead className="bg-background">Quotation Type</TableHead>
                                            <TableHead className="bg-background">SI Date</TableHead>
                                            <TableHead className="bg-background">Agent</TableHead>
                                            <TableHead className="bg-background">TSM Approved Status</TableHead>
                                            <TableHead className="bg-background">TSM Approved Remarks</TableHead>
                                            <TableHead className="bg-background">TSM Approved Date</TableHead>
                                            <TableHead className="bg-background">VAT Type</TableHead>
                                            <TableHead className="bg-background">Activity Ref #</TableHead>
                                            <TableHead className="bg-background">Date Created</TableHead>
                                            <TableHead className="bg-background">Date Updated</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                <TableBody>
                                    {paginatedActivities.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={50} className="text-center">
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
                                                    <Input
                                                        defaultValue={act.referenceid || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "referenceid", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.tsm || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "tsm", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.manager || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "manager", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.company_name || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "company_name", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.contact_person || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "contact_person", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.contact_number || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "contact_number", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.email_address || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "email_address", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.address || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "address", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.type_client || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "type_client", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.project_name || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "project_name", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.product_category || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "product_category", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.project_type || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "project_type", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.source || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "source", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.target_quota || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "target_quota", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.type_activity || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "type_activity", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        type="date"
                                                        defaultValue={act.callback || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "callback", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.call_status || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "call_status", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.call_type || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "call_type", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.quotation_number || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "quotation_number", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.quotation_amount || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "quotation_amount", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.so_number || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "so_number", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.so_amount || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "so_amount", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.actual_sales || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "actual_sales", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        type="date"
                                                        defaultValue={act.delivery_date || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "delivery_date", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.dr_number || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "dr_number", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.ticket_reference_number || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "ticket_reference_number", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.remarks || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "remarks", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.status || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "status", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        type="date"
                                                        defaultValue={act.start_date || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "start_date", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        type="date"
                                                        defaultValue={act.end_date || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "end_date", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        type="date"
                                                        defaultValue={act.date_followup || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "date_followup", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        type="date"
                                                        defaultValue={act.date_site_visit || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "date_site_visit", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.account_reference_number || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "account_reference_number", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.payment_terms || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "payment_terms", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.scheduled_status || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "scheduled_status", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.product_quantity || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "product_quantity", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.product_amount || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "product_amount", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.product_description || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "product_description", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.product_sku || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "product_sku", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.product_title || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "product_title", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.quotation_type || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "quotation_type", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        type="date"
                                                        defaultValue={act.si_date || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "si_date", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.agent || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "agent", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.tsm_approved_status || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "tsm_approved_status", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.tsm_approved_remarks || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "tsm_approved_remarks", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        type="date"
                                                        defaultValue={act.tsm_approved_date || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "tsm_approved_date", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <Input
                                                        defaultValue={act.vat_type || ""}
                                                        onBlur={(e) => handleInlineUpdate(act.id, "vat_type", e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </TableCell>

                                                <TableCell>
                                                    <span className="text-[10px]">{act.activity_reference_number}</span>
                                                </TableCell>

                                                <TableCell>{formatDate(act.date_created)}</TableCell>

                                                <TableCell>{formatDate(act.date_updated)}</TableCell>
                                            </TableRow>

                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
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

                    <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Bulk Edit</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium">Field to Edit</label>
                                    <select
                                        value={bulkEditField}
                                        onChange={(e) => setBulkEditField(e.target.value)}
                                        className="w-full mt-1 p-2 border rounded"
                                    >
                                        <option value="">Select a field</option>
                                        <option value="tsm">TSM</option>
                                        <option value="manager">Manager</option>
                                        <option value="status">Status</option>
                                        <option value="agent">Agent</option>
                                        <option value="type_client">Type Client</option>
                                        <option value="call_status">Call Status</option>
                                        <option value="tsm_approved_status">TSM Approved Status</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">New Value</label>
                                    <Input
                                        value={bulkEditValue}
                                        onChange={(e) => setBulkEditValue(e.target.value)}
                                        className="mt-1"
                                        placeholder="Enter new value"
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowBulkEditDialog(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleBulkEdit} disabled={!bulkEditField || !bulkEditValue}>
                                    Update {selectedIds.length} Rows
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    );
}
