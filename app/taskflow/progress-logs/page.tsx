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

export default function ActivityLogsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [allActivities, setAllActivities] = useState<Activity[]>([]); // All data for searching
    const [isFetching, setIsFetching] = useState(false);

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

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
    // Combined filter dialog
    const [showFilterDialog, setShowFilterDialog] = useState(false);
    const [statusFilter, setStatusFilter] = useState("");
    const [statusOptions, setStatusOptions] = useState<string[]>([]);

    // Progressive fetching states
    const [fetchLimit, setFetchLimit] = useState(100); // Initial 100 rows
    const [totalDbRows, setTotalDbRows] = useState(0); // Total rows in database

    // Keyboard navigation
    const [focusedCell, setFocusedCell] = useState<{rowId: string, field: string} | null>(null);

    // Bulk edit
    const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
    const [bulkEditField, setBulkEditField] = useState<string>("");
    const [bulkEditValue, setBulkEditValue] = useState("");

    // Save indicator
    const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());

    // Edit dialog state
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<Activity>>({});

    // Fetch activities from API with progressive loading
    const fetchActivities = async (limit?: number) => {
        setIsFetching(true);

        try {
            const maxRows = limit || fetchLimit;

            // Build query params for date filter
            let queryParams = '';
            if (dateFrom && dateTo) {
                const daysDiff = Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24));
                queryParams = `?days=${daysDiff}`;
            }

            const response = await fetch(`/api/fetch-progress${queryParams}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to fetch progress logs');
            }

            // Get total count
            const totalCount = result.count || result.activities?.length || 0;
            setTotalDbRows(totalCount);

            // Filter by date range if set
            let data = result.activities || [];
            if (dateFrom) {
                data = data.filter((act: Activity) => act.date_created >= dateFrom);
            }
            if (dateTo) {
                data = data.filter((act: Activity) => act.date_created <= dateTo + 'T23:59:59');
            }

            // Sort by date_updated descending
            data.sort((a: Activity, b: Activity) => {
                const dateA = new Date(a.date_updated || a.date_created || 0).getTime();
                const dateB = new Date(b.date_updated || b.date_created || 0).getTime();
                return dateB - dateA;
            });

            // Store all data for searching
            setAllActivities(data);

            // Apply limit for display
            const limitedData = data.slice(0, maxRows);
            setActivities(limitedData);
            toast.success(`Loaded ${limitedData.length} of ${totalCount} progress logs`);
        } catch (err) {
            toast.error(`Error fetching activities: ${(err as Error).message}`);
            setActivities([]);
        }

        setIsFetching(false);
    };

    // Handle fetch more button click
    const handleFetchMore = () => {
        let nextLimit: number;

        if (fetchLimit === 100) {
            nextLimit = 2100; // 100 + 2000
        } else if (fetchLimit === 2100) {
            nextLimit = 7100; // 2100 + 5000
        } else {
            // After 7100, keep adding 5000
            nextLimit = fetchLimit + 5000;
        }

        setFetchLimit(nextLimit);
        fetchActivities(nextLimit);
        toast.success(`Fetching up to ${nextLimit.toLocaleString()} rows...`);
    };

    // Handle edit click
    const handleEditClick = (activity: Activity) => {
        setEditingActivity(activity);
        setEditFormData({ ...activity });
        setShowEditDialog(true);
    };

    // Handle edit form change
    const handleEditFormChange = (field: keyof Activity, value: string) => {
        setEditFormData(prev => ({ ...prev, [field]: value }));
    };

    // Save edited activity
    const handleSaveEdit = async () => {
        if (!editingActivity || !editFormData) return;

        const { error } = await supabase
            .from("history")
            .update(editFormData)
            .eq("id", editingActivity.id);

        if (error) {
            toast.error("Failed to update progress log");
            return;
        }

        toast.success("Progress log updated successfully");
        setShowEditDialog(false);
        setEditingActivity(null);
        await fetchActivities();
    };

    useEffect(() => {
        fetchActivities();
    }, []);

    useEffect(() => {
        fetchActivities();
    }, [dateFrom, dateTo]);

    // Populate status options when activities change
    useEffect(() => {
        const uniqueStatuses = [...new Set(activities.map(act => act.status).filter(Boolean))];
        setStatusOptions(uniqueStatuses.sort());
    }, [activities]);

    // Reset page when filters, search, or rowsPerPage changes
    useEffect(() => {
        setPage(1);
    }, [dateFrom, dateTo, search, statusFilter, rowsPerPage]);

    const filteredActivities = useMemo(() => {
        // Use allActivities for searching, activities for display when no search
        let result = search.trim() ? allActivities : activities;

        // Apply status filter
        if (statusFilter) {
            result = result.filter(act => act.status?.toLowerCase() === statusFilter.toLowerCase());
        }

        if (!search.trim()) return result;
        const lowerSearch = search.toLowerCase();

        return result
            .filter((act) =>
                [
                    act.id,
                    act.referenceid,
                    act.activity_reference_number,
                    act.ticket_reference_number,
                    act.account_reference_number,
                    act.tsm,
                    act.manager,
                    act.agent,
                    act.company_name,
                    act.contact_person,
                    act.contact_number,
                    act.email_address,
                    act.address,
                    act.type_client,
                    act.vat_type,
                    act.project_name,
                    act.product_category,
                    act.project_type,
                    act.source,
                    act.type_activity,
                    act.target_quota,
                    act.call_status,
                    act.call_type,
                    act.quotation_number,
                    act.quotation_amount,
                    act.quotation_type,
                    act.so_number,
                    act.so_amount,
                    act.actual_sales,
                    act.dr_number,
                    act.payment_terms,
                    act.scheduled_status,
                    act.product_sku,
                    act.product_title,
                    act.product_quantity,
                    act.product_amount,
                    act.product_description,
                    act.status,
                    act.remarks,
                    act.tsm_approved_status,
                    act.tsm_approved_remarks,
                ]
                    .filter(Boolean)
                    .some((field) => String(field).toLowerCase().includes(lowerSearch))
            )
    }, [activities, allActivities, search, statusFilter]);

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

    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(sortedActivities.length / rowsPerPage));
    }, [sortedActivities.length, rowsPerPage]);

    const paginatedActivities = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return sortedActivities.slice(start, start + rowsPerPage);
    }, [sortedActivities, page, rowsPerPage]);

    const goToPrevious = () => setPage((p) => Math.max(1, p - 1));
    const goToNext = () => setPage((p) => Math.min(totalPages, p + 1));

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
                    <header className="flex h-14 shrink-0 items-center gap-2 px-4 bg-slate-950 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="h-4 bg-slate-700" />
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <BreadcrumbLink href="#" className="text-slate-400 hover:text-cyan-400">Taskflow</BreadcrumbLink>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator className="text-slate-600" />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage className="text-cyan-400 font-medium flex items-center gap-2">
                                            Progress Logs
                                            {search.trim() && (
                                                <span className="text-[10px] px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-none">
                                                    {filteredActivities.length} / {activities.length}
                                                </span>
                                            )}
                                        </BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>
                    </header>

                    {/* Toolbar */}
                    <div className="flex flex-col gap-3 px-4 py-3 bg-slate-950">
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                            {/* Left: Search + Pagination */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
                                {/* Search */}
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        placeholder="Search all fields..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-8 w-full bg-slate-900 border-slate-700 text-slate-300 focus:border-cyan-500/50 rounded-none h-9"
                                    />
                                    {isFetching && (
                                        <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-cyan-400" />
                                    )}
                                </div>

                                {/* Pagination */}
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={goToPrevious}
                                        disabled={page === 1}
                                        className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 rounded-none h-8 px-2"
                                    >
                                        ←
                                    </Button>
                                    <span className="text-sm text-slate-400 min-w-[80px] text-center">
                                        {page} / {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={goToNext}
                                        disabled={page === totalPages}
                                        className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 rounded-none h-8 px-2"
                                    >
                                        →
                                    </Button>
                                </div>
                            </div>

                            {/* Right: Date Range + Filter + Actions */}
                            <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
                                {/* Date Range */}
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="w-32 bg-slate-900 border-slate-700 text-slate-300 focus:border-cyan-500/50 rounded-none h-9"
                                        placeholder="From"
                                    />
                                    <span className="text-slate-500">-</span>
                                    <Input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="w-32 bg-slate-900 border-slate-700 text-slate-300 focus:border-cyan-500/50 rounded-none h-9"
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
                                            className="text-slate-400 hover:text-cyan-400 hover:bg-slate-900 rounded-none h-9 px-2"
                                        >
                                            ×
                                        </Button>
                                    )}
                                </div>

                                <Separator orientation="vertical" className="h-6 bg-slate-700 hidden sm:block" />

                                {/* Filters Button */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowFilterDialog(true)}
                                    className={`text-xs uppercase tracking-wider rounded-none h-9 ${showFilterDialog || statusFilter ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400'}`}
                                >
                                    Filters {statusFilter && '•'}
                                </Button>

                                {/* Export */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={exportToCSV}
                                    className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 text-xs uppercase tracking-wider rounded-none h-9"
                                >
                                    Export
                                </Button>

                                {selectedIds.length > 0 && (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowBulkEditDialog(true)}
                                            className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20 text-xs uppercase tracking-wider rounded-none h-9"
                                        >
                                            Bulk Edit ({selectedIds.length})
                                        </Button>

                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 text-xs uppercase tracking-wider rounded-none h-9"
                                        >
                                            Delete ({selectedIds.length})
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Card Grid */}
                    <div className="flex-1 overflow-hidden bg-slate-950">
                        {isFetching ? (
                            <div className="py-20 text-center flex flex-col items-center gap-3 text-slate-500">
                                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                                <span className="text-xs uppercase tracking-wider">Loading progress logs...</span>
                            </div>
                        ) : (
                            <div className="h-full overflow-y-auto">
                                {/* Grid Header */}
                                <div className="grid grid-cols-[40px_40px_1fr] gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
                                    <div className="text-slate-300 font-medium text-xs">#</div>
                                    <div className="text-slate-300 font-medium text-xs">
                                        <input
                                            type="checkbox"
                                            checked={
                                                paginatedActivities.length > 0 &&
                                                paginatedActivities.every((a) => selectedIds.includes(a.id))
                                            }
                                            onChange={toggleSelectAll}
                                            className="accent-cyan-500"
                                        />
                                    </div>
                                    <div className="text-slate-300 font-medium text-xs">Progress Log Details</div>
                                </div>

                                {/* Grid Cards - 4 columns */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
                                    {paginatedActivities.length === 0 ? (
                                        <div className="py-20 text-center text-slate-500 text-sm">
                                            No progress logs found.
                                        </div>
                                    ) : (
                                        paginatedActivities.map((act, index) => (
                                            <div
                                                key={`${act.id}-${index}`}
                                                onClick={() => handleEditClick(act)}
                                                className="bg-slate-900 border border-slate-800 hover:border-cyan-500/30 transition-colors cursor-pointer group"
                                            >
                                                {/* Card Header */}
                                                <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(act.id)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                toggleSelect(act.id);
                                                            }}
                                                            className="accent-cyan-500"
                                                        />
                                                        <span className="text-xs text-slate-500">#{(page - 1) * rowsPerPage + index + 1}</span>
                                                    </div>
                                                </div>

                                                {/* Card Body */}
                                                <div className="p-3 space-y-2">
                                                    {/* Activity Ref */}
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-slate-500 uppercase">Activity Ref</span>
                                                        <span className="text-xs text-cyan-400 font-medium">{act.activity_reference_number || '-'}</span>
                                                    </div>

                                                    {/* Ticket Ref */}
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-slate-500 uppercase">Ticket Ref</span>
                                                        <span className="text-xs text-slate-300">{act.ticket_reference_number || '-'}</span>
                                                    </div>

                                                    {/* Company */}
                                                    {columnVisibility.company_name && (
                                                        <div className="flex items-start justify-between gap-2">
                                                            <span className="text-xs text-slate-500 uppercase">Company</span>
                                                            <span className="text-xs text-slate-300 text-right">{act.company_name || '-'}</span>
                                                        </div>
                                                    )}

                                                    {/* Contact */}
                                                    {columnVisibility.contact_person && (
                                                        <div className="flex items-start justify-between gap-2">
                                                            <span className="text-xs text-slate-500 uppercase">Contact</span>
                                                            <span className="text-xs text-slate-300 text-right">{act.contact_person || '-'}</span>
                                                        </div>
                                                    )}

                                                    {/* Phone */}
                                                    {columnVisibility.contact_number && (
                                                        <div className="flex items-start justify-between gap-2">
                                                            <span className="text-xs text-slate-500 uppercase">Phone</span>
                                                            <span className="text-xs text-slate-300 text-right">{act.contact_number || '-'}</span>
                                                        </div>
                                                    )}

                                                    {/* Email */}
                                                    {columnVisibility.email_address && (
                                                        <div className="flex items-start justify-between gap-2">
                                                            <span className="text-xs text-slate-500 uppercase">Email</span>
                                                            <span className="text-xs text-slate-300 text-right truncate max-w-[150px]">{act.email_address || '-'}</span>
                                                        </div>
                                                    )}

                                                    {/* Status */}
                                                    {columnVisibility.status && (
                                                        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                                                            <span className="text-xs text-slate-500 uppercase">Status</span>
                                                            <span className={`text-xs px-2 py-0.5 ${act.status?.toLowerCase() === 'completed' || act.status?.toLowerCase() === 'resolved'
                                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                                    : act.status?.toLowerCase() === 'pending' || act.status?.toLowerCase() === 'open'
                                                                        ? 'bg-yellow-500/10 text-yellow-400'
                                                                        : act.status?.toLowerCase() === 'cancelled' || act.status?.toLowerCase() === 'closed'
                                                                            ? 'bg-red-500/10 text-red-400'
                                                                            : 'bg-slate-800 text-slate-300'
                                                                }`}>
                                                                {act.status || 'N/A'}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* TSM */}
                                                    {columnVisibility.tsm && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-slate-500 uppercase">TSM</span>
                                                            <span className="text-xs text-slate-300">{act.tsm || '-'}</span>
                                                        </div>
                                                    )}

                                                    {/* Manager */}
                                                    {columnVisibility.manager && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-slate-500 uppercase">Manager</span>
                                                            <span className="text-xs text-slate-300">{act.manager || '-'}</span>
                                                        </div>
                                                    )}

                                                    {/* Date Created */}
                                                    {columnVisibility.date_created && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-slate-500 uppercase">Date</span>
                                                            <span className="text-xs text-slate-400">{formatDate(act.date_created)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                        <DialogContent className="max-w-md bg-slate-900/95 border-red-500/30">
                            <DialogHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <DialogTitle className="text-cyan-100 tracking-wider">SECURITY ALERT</DialogTitle>
                                </div>
                            </DialogHeader>

                            <p className="text-sm text-cyan-300/60 pt-2">
                                You are about to purge{" "}
                                <span className="text-red-400 font-bold">{selectedIds.length}</span> activity records from the system. This action cannot be undone.
                            </p>

                            <DialogFooter className="gap-2">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-none"
                                >
                                    Abort
                                </Button>
                                <Button 
                                    variant="destructive" 
                                    onClick={handleBulkDelete}
                                    className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-none"
                                >
                                    Purge
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
                        <DialogContent className="max-w-md bg-slate-900/95 border-cyan-500/30">
                            <DialogHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                                        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </div>
                                    <DialogTitle className="text-cyan-100 tracking-wider">BULK EDIT PROTOCOL</DialogTitle>
                                </div>
                            </DialogHeader>

                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="text-xs font-bold uppercase text-cyan-400/70 tracking-wider">Target Field</label>
                                    <select
                                        value={bulkEditField}
                                        onChange={(e) => setBulkEditField(e.target.value)}
                                        className="w-full mt-1 p-2 border border-slate-700 bg-slate-900 text-slate-300 rounded-none focus:border-cyan-500/50"
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
                                    <label className="text-xs font-bold uppercase text-cyan-400/70 tracking-wider">New Value</label>
                                    <Input
                                        value={bulkEditValue}
                                        onChange={(e) => setBulkEditValue(e.target.value)}
                                        className="mt-1 bg-slate-900 border-slate-700 text-slate-300 rounded-none focus:border-cyan-500/50"
                                        placeholder="Enter new value"
                                    />
                                </div>
                                <p className="text-xs text-cyan-300/50">
                                    This will update <span className="text-cyan-400 font-bold">{selectedIds.length}</span> selected records.
                                </p>
                            </div>

                            <DialogFooter className="gap-2">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowBulkEditDialog(false)}
                                    className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-none"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={handleBulkEdit} 
                                    disabled={!bulkEditField || !bulkEditValue}
                                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0 rounded-none"
                                >
                                    Update {selectedIds.length} Records
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Edit Dialog */}
                    <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                        <DialogContent className="max-w-2xl bg-slate-900/95 border-cyan-500/30">
                            <DialogHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                                        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </div>
                                    <DialogTitle className="text-cyan-100 tracking-wider">EDIT PROGRESS LOG</DialogTitle>
                                </div>
                            </DialogHeader>

                            {editingActivity && (
                                <div className="max-h-[60vh] overflow-y-auto pr-2">
                                    {/* Basic Info Section */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold uppercase text-cyan-400 tracking-wider border-b border-slate-700 pb-1 mb-2">Basic Information</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Reference ID</label>
                                                <Input value={editFormData.referenceid || ''} onChange={(e) => handleEditFormChange('referenceid', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Activity Ref</label>
                                                <Input value={editFormData.activity_reference_number || ''} onChange={(e) => handleEditFormChange('activity_reference_number', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Ticket Ref</label>
                                                <Input value={editFormData.ticket_reference_number || ''} onChange={(e) => handleEditFormChange('ticket_reference_number', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Account Ref</label>
                                                <Input value={editFormData.account_reference_number || ''} onChange={(e) => handleEditFormChange('account_reference_number', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Client Info Section */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold uppercase text-cyan-400 tracking-wider border-b border-slate-700 pb-1 mb-2">Client Information</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Company Name</label>
                                                <Input value={editFormData.company_name || ''} onChange={(e) => handleEditFormChange('company_name', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Contact Person</label>
                                                <Input value={editFormData.contact_person || ''} onChange={(e) => handleEditFormChange('contact_person', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Contact Number</label>
                                                <Input value={editFormData.contact_number || ''} onChange={(e) => handleEditFormChange('contact_number', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Email Address</label>
                                                <Input value={editFormData.email_address || ''} onChange={(e) => handleEditFormChange('email_address', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1 col-span-2">
                                                <label className="text-xs text-slate-400 uppercase">Address</label>
                                                <Input value={editFormData.address || ''} onChange={(e) => handleEditFormChange('address', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Type Client</label>
                                                <Input value={editFormData.type_client || ''} onChange={(e) => handleEditFormChange('type_client', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">VAT Type</label>
                                                <Input value={editFormData.vat_type || ''} onChange={(e) => handleEditFormChange('vat_type', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Project Info Section */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold uppercase text-cyan-400 tracking-wider border-b border-slate-700 pb-1 mb-2">Project Details</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Project Name</label>
                                                <Input value={editFormData.project_name || ''} onChange={(e) => handleEditFormChange('project_name', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Product Category</label>
                                                <Input value={editFormData.product_category || ''} onChange={(e) => handleEditFormChange('product_category', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Project Type</label>
                                                <Input value={editFormData.project_type || ''} onChange={(e) => handleEditFormChange('project_type', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Source</label>
                                                <Input value={editFormData.source || ''} onChange={(e) => handleEditFormChange('source', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Type Activity</label>
                                                <Input value={editFormData.type_activity || ''} onChange={(e) => handleEditFormChange('type_activity', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Target Quota</label>
                                                <Input value={editFormData.target_quota || ''} onChange={(e) => handleEditFormChange('target_quota', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Start Date</label>
                                                <Input type="date" value={editFormData.start_date || ''} onChange={(e) => handleEditFormChange('start_date', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">End Date</label>
                                                <Input type="date" value={editFormData.end_date || ''} onChange={(e) => handleEditFormChange('end_date', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Call Info Section */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold uppercase text-cyan-400 tracking-wider border-b border-slate-700 pb-1 mb-2">Call Details</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Call Status</label>
                                                <Input value={editFormData.call_status || ''} onChange={(e) => handleEditFormChange('call_status', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Call Type</label>
                                                <Input value={editFormData.call_type || ''} onChange={(e) => handleEditFormChange('call_type', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Callback</label>
                                                <Input type="date" value={editFormData.callback || ''} onChange={(e) => handleEditFormChange('callback', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Date Followup</label>
                                                <Input type="date" value={editFormData.date_followup || ''} onChange={(e) => handleEditFormChange('date_followup', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Date Site Visit</label>
                                                <Input type="date" value={editFormData.date_site_visit || ''} onChange={(e) => handleEditFormChange('date_site_visit', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quotation Section */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold uppercase text-cyan-400 tracking-wider border-b border-slate-700 pb-1 mb-2">Quotation & Sales</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Quotation Number</label>
                                                <Input value={editFormData.quotation_number || ''} onChange={(e) => handleEditFormChange('quotation_number', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Quotation Amount</label>
                                                <Input value={editFormData.quotation_amount || ''} onChange={(e) => handleEditFormChange('quotation_amount', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Quotation Type</label>
                                                <Input value={editFormData.quotation_type || ''} onChange={(e) => handleEditFormChange('quotation_type', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">SO Number</label>
                                                <Input value={editFormData.so_number || ''} onChange={(e) => handleEditFormChange('so_number', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">SO Amount</label>
                                                <Input value={editFormData.so_amount || ''} onChange={(e) => handleEditFormChange('so_amount', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Actual Sales</label>
                                                <Input value={editFormData.actual_sales || ''} onChange={(e) => handleEditFormChange('actual_sales', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Delivery Section */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold uppercase text-cyan-400 tracking-wider border-b border-slate-700 pb-1 mb-2">Delivery Information</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Delivery Date</label>
                                                <Input type="date" value={editFormData.delivery_date || ''} onChange={(e) => handleEditFormChange('delivery_date', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">DR Number</label>
                                                <Input value={editFormData.dr_number || ''} onChange={(e) => handleEditFormChange('dr_number', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">SI Date</label>
                                                <Input type="date" value={editFormData.si_date || ''} onChange={(e) => handleEditFormChange('si_date', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Payment Terms</label>
                                                <Input value={editFormData.payment_terms || ''} onChange={(e) => handleEditFormChange('payment_terms', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Scheduled Status</label>
                                                <Input value={editFormData.scheduled_status || ''} onChange={(e) => handleEditFormChange('scheduled_status', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Product Section */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold uppercase text-cyan-400 tracking-wider border-b border-slate-700 pb-1 mb-2">Product Details</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Product SKU</label>
                                                <Input value={editFormData.product_sku || ''} onChange={(e) => handleEditFormChange('product_sku', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Product Title</label>
                                                <Input value={editFormData.product_title || ''} onChange={(e) => handleEditFormChange('product_title', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Product Qty</label>
                                                <Input value={editFormData.product_quantity || ''} onChange={(e) => handleEditFormChange('product_quantity', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Product Amount</label>
                                                <Input value={editFormData.product_amount || ''} onChange={(e) => handleEditFormChange('product_amount', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1 col-span-2">
                                                <label className="text-xs text-slate-400 uppercase">Product Description</label>
                                                <Input value={editFormData.product_description || ''} onChange={(e) => handleEditFormChange('product_description', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Assignment Section */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold uppercase text-cyan-400 tracking-wider border-b border-slate-700 pb-1 mb-2">Assignment</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">TSM</label>
                                                <Input value={editFormData.tsm || ''} onChange={(e) => handleEditFormChange('tsm', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Manager</label>
                                                <Input value={editFormData.manager || ''} onChange={(e) => handleEditFormChange('manager', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Agent</label>
                                                <Input value={editFormData.agent || ''} onChange={(e) => handleEditFormChange('agent', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Status</label>
                                                <Input value={editFormData.status || ''} onChange={(e) => handleEditFormChange('status', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* TSM Approval Section */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold uppercase text-cyan-400 tracking-wider border-b border-slate-700 pb-1 mb-2">TSM Approval</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Approved Status</label>
                                                <Input value={editFormData.tsm_approved_status || ''} onChange={(e) => handleEditFormChange('tsm_approved_status', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400 uppercase">Approved Date</label>
                                                <Input type="date" value={editFormData.tsm_approved_date || ''} onChange={(e) => handleEditFormChange('tsm_approved_date', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                            <div className="space-y-1 col-span-2">
                                                <label className="text-xs text-slate-400 uppercase">Approved Remarks</label>
                                                <Input value={editFormData.tsm_approved_remarks || ''} onChange={(e) => handleEditFormChange('tsm_approved_remarks', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Remarks Section */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold uppercase text-cyan-400 tracking-wider border-b border-slate-700 pb-1 mb-2">Remarks</h4>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-400 uppercase">Remarks</label>
                                            <Input value={editFormData.remarks || ''} onChange={(e) => handleEditFormChange('remarks', e.target.value)} className="bg-slate-900 border-slate-700 text-slate-300 rounded-none h-8" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <DialogFooter className="gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowEditDialog(false)}
                                    className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-none"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveEdit}
                                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0 rounded-none"
                                >
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Combined Filter Dialog */}
                    <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
                        <DialogContent className="max-w-2xl bg-slate-900/95 border-cyan-500/30 max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                                        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                        </svg>
                                    </div>
                                    <DialogTitle className="text-cyan-100 tracking-wider">FILTERS & OPTIONS</DialogTitle>
                                </div>
                            </DialogHeader>

                            {/* Fetch More Alert Banner - Inside Dialog */}
                            {activities.length < totalDbRows && (
                                <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div>
                                                <p className="text-sm text-cyan-400 font-medium">
                                                    Showing {activities.length.toLocaleString()} of {totalDbRows.toLocaleString()} records
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {activities.length === 100
                                                        ? "Initial load: 100 records"
                                                        : `Fetched ${fetchLimit.toLocaleString()} rows`}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                handleFetchMore();
                                                setShowFilterDialog(false);
                                            }}
                                            className="bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-none"
                                        >
                                            {activities.length === 100
                                                ? "Fetch more 2K"
                                                : "Fetch more 5K"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-6 py-4">
                                {/* Left Column - Filters */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-medium text-cyan-400 uppercase tracking-wider border-b border-slate-700 pb-2">
                                        Filters
                                    </h3>

                                    {/* Status Filter */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400 uppercase tracking-wider">Filter by Status</label>
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 text-slate-300 rounded-none h-9 px-2 text-sm"
                                        >
                                            <option value="">All Statuses</option>
                                            {statusOptions.map((status) => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Clear Filters */}
                                    {statusFilter && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setStatusFilter("")}
                                            className="w-full bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 rounded-none h-9"
                                        >
                                            Clear Filter
                                        </Button>
                                    )}
                                </div>

                                {/* Right Column - Sorting & Page Length */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-medium text-cyan-400 uppercase tracking-wider border-b border-slate-700 pb-2">
                                        Sorting & Display
                                    </h3>

                                    {/* Sort Column */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400 uppercase tracking-wider">Sort By</label>
                                        <select
                                            value={sortColumn}
                                            onChange={(e) => setSortColumn(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 text-slate-300 rounded-none h-9 px-2 text-sm"
                                        >
                                            <option value="date_updated">Date Updated</option>
                                            <option value="date_created">Date Created</option>
                                            <option value="referenceid">Reference ID</option>
                                            <option value="company_name">Company Name</option>
                                            <option value="contact_person">Contact Person</option>
                                            <option value="status">Status</option>
                                            <option value="tsm">TSM</option>
                                            <option value="manager">Manager</option>
                                            <option value="ticket_reference_number">Ticket Reference</option>
                                            <option value="activity_reference_number">Activity Reference</option>
                                        </select>
                                    </div>

                                    {/* Sort Direction */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400 uppercase tracking-wider">Sort Direction</label>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSortDirection('asc')}
                                                className={`flex-1 rounded-none h-9 ${sortDirection === 'asc' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                                            >
                                                ASC ↑
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSortDirection('desc')}
                                                className={`flex-1 rounded-none h-9 ${sortDirection === 'desc' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                                            >
                                                DESC ↓
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Page Length */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400 uppercase tracking-wider">Rows Per Page</label>
                                        <div className="flex gap-2">
                                            {[10, 20, 50, 100].map((num) => (
                                                <Button
                                                    key={num}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setRowsPerPage(num);
                                                        setPage(1);
                                                    }}
                                                    className={`flex-1 rounded-none h-9 ${rowsPerPage === num ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                                                >
                                                    {num}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Column Visibility Section */}
                            <div className="space-y-3 border-t border-slate-700 pt-4">
                                <h3 className="text-xs font-medium text-cyan-400 uppercase tracking-wider">
                                    Column Visibility
                                </h3>
                                <div className="grid grid-cols-4 gap-2">
                                    {Object.keys(columnVisibility).map(column => (
                                        <label key={column} className="flex items-center gap-2 text-sm cursor-pointer text-slate-300 hover:text-cyan-400">
                                            <input
                                                type="checkbox"
                                                checked={columnVisibility[column]}
                                                onChange={() => toggleColumnVisibility(column)}
                                                className="accent-cyan-500"
                                            />
                                            <span className="capitalize">{column.replace(/_/g, ' ')}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <DialogFooter className="mt-4 gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowFilterDialog(false)}
                                    className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-none"
                                >
                                    Close
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    );
}
