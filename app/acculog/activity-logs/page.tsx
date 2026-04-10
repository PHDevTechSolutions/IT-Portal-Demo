"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import { 
  Loader2, 
  Search, 
  Edit as EditIcon, 
  Filter, 
  Activity,
  Zap,
  Database,
  Clock,
  Shield,
  Trash2,
  FileText,
  Calendar,
  MapPin,
  Image as ImageIcon,
  RefreshCw,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Pagination } from "@/components/app-pagination";
import { Separator } from "@/components/ui/separator";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import EditActivityModal, { Log } from "@/components/acculog/edit";
import { Calendar23 } from "@/components/acculog/daterange";
import { DeleteDialog } from "@/components/acculog/delete";
import { ActivityFilterDialog } from "@/components/acculog/filter";

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
        <TooltipProvider delayDuration={0}>
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                {/* Dark Tech Background */}
                <div className="min-h-screen w-full bg-[#050a14] relative overflow-hidden">
                    {/* Animated background grid */}
                    <div className="absolute inset-0 h-full w-full">
                        <div 
                            className="absolute inset-0 opacity-[0.03]"
                            style={{
                                backgroundImage: `
                                    linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px),
                                    linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)
                                `,
                                backgroundSize: '50px 50px',
                            }}
                        />
                        <div 
                            className="absolute inset-0 opacity-[0.02]"
                            style={{
                                backgroundImage: `radial-gradient(circle at 50% 50%, rgba(6,182,212,0.8) 0%, transparent 50%)`,
                            }}
                        />
                    </div>

                    {/* Floating particles */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {[...Array(8)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute w-1 h-1 bg-cyan-500/30 rounded-full animate-pulse"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 3}s`,
                                    animationDuration: `${3 + Math.random() * 2}s`,
                                }}
                            />
                        ))}
                    </div>

                    {/* Main Content */}
                    <div className="relative z-10 w-full">
                        {/* Header */}
                        <header className="flex h-16 items-center gap-2 px-4 border-b border-cyan-500/20 bg-slate-900/50 backdrop-blur-sm">
                            <SidebarTrigger className="-ml-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20" />
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => router.push("/dashboard")}
                                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                            >
                                Home
                            </Button>
                            <Separator orientation="vertical" className="h-4 bg-cyan-500/30" />
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <BreadcrumbLink href="#" className="text-cyan-400 hover:text-cyan-300">Acculog</BreadcrumbLink>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator className="text-cyan-500/50" />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage className="text-cyan-100">Activity Logs</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </header>

                        {/* Page Title */}
                        <div className="px-4 py-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                                    <Activity className="h-6 w-6 text-cyan-400" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-white tracking-wider">ACTIVITY LOGS</h1>
                                    <p className="text-sm text-cyan-300/60">System activity monitoring and audit trail</p>
                                </div>
                            </div>
                        </div>

                        {/* Search, Date Range, Actions */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
                            <div className="relative w-full sm:max-w-xs group">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-cyan-500/60" />
                                <Input
                                    placeholder="Search activities..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-10 w-full bg-slate-900/50 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-500/40 focus:border-cyan-400 focus:ring-cyan-400/20"
                                />
                                {isFetching && (
                                    <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-cyan-400" />
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => setShowFilterDialog(true)}
                                    className="h-9 w-9 bg-slate-900/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
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
                                    className="bg-slate-900/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                                >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                    Clear
                                </Button>

                                {selectedIds.size > 0 && (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => setShowDeleteDialog(true)}
                                        className="whitespace-nowrap bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 border border-red-400/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                        Delete Selected ({selectedIds.size})
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="relative group mx-4">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl blur opacity-10 group-hover:opacity-20 transition-opacity" />
                            <div className="relative bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl overflow-hidden">
                                {isFetching ? (
                                    <div className="py-10 text-center flex flex-col items-center gap-2 text-cyan-300/60">
                                        <Loader2 className="size-8 animate-spin text-cyan-400" />
                                        <span className="text-sm">Loading activity data...</span>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table className="min-w-[900px] w-full text-sm">
                                            <TableHeader>
                                                <TableRow className="border-b border-cyan-500/20 bg-slate-800/50">
                                                    <TableHead className="w-10 text-center">
                                                        <Checkbox
                                                            checked={selectedIds.size === current.length && current.length > 0}
                                                            onCheckedChange={toggleSelectAll}
                                                            className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                                                        />
                                                    </TableHead>
                                                    <TableHead className="text-cyan-300 font-medium">ReferenceID</TableHead>
                                                    <TableHead className="text-cyan-300 font-medium">Email</TableHead>
                                                    <TableHead className="text-cyan-300 font-medium">Type</TableHead>
                                                    <TableHead className="text-cyan-300 font-medium">Status</TableHead>
                                                    <TableHead className="text-cyan-300 font-medium">Date Created</TableHead>
                                                    <TableHead className="text-cyan-300 font-medium">Location</TableHead>
                                                    <TableHead className="text-cyan-300 font-medium">Latitude</TableHead>
                                                    <TableHead className="text-cyan-300 font-medium">Longitude</TableHead>
                                                    <TableHead className="text-cyan-300 font-medium">PhotoURL</TableHead>
                                                    <TableHead className="w-16 text-center text-cyan-300 font-medium">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {current.map((act, index) => (
                                                    <TableRow
                                                        key={act._id || `${act.ReferenceID}-${index}`}
                                                        className="border-b border-cyan-500/10 hover:bg-cyan-500/5 transition-colors"
                                                    >
                                                        <TableCell className="text-center">
                                                            <Checkbox
                                                                checked={selectedIds.has(act._id)}
                                                                onCheckedChange={() => toggleSelect(act._id)}
                                                                className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                                                            />
                                                        </TableCell>

                                                        <TableCell className="text-cyan-100 font-mono text-xs">{act.ReferenceID || "N/A"}</TableCell>
                                                        <TableCell className="text-cyan-200/80 text-xs">{act.Email || "N/A"}</TableCell>
                                                        <TableCell className="text-cyan-200/80 text-xs">{act.Type || "N/A"}</TableCell>
                                                        <TableCell>
                                                            <Badge className={`text-[10px] border ${
                                                                act.Status === "Active" || act.Status === "Success"
                                                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                                                                    : act.Status === "Inactive" || act.Status === "Failed"
                                                                    ? "bg-red-500/20 text-red-400 border-red-500/50"
                                                                    : "bg-amber-500/20 text-amber-400 border-amber-500/50"
                                                            }`}>
                                                                {act.Status || "N/A"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-cyan-300/70 text-xs">
                                                            {act.date_created
                                                                ? new Date(act.date_created).toLocaleString()
                                                                : "N/A"}
                                                        </TableCell>
                                                        <TableCell className="text-cyan-200/80 text-xs">{act.Location || "N/A"}</TableCell>
                                                        <TableCell className="text-cyan-300/60 text-xs font-mono">{act.Latitude || "N/A"}</TableCell>
                                                        <TableCell className="text-cyan-300/60 text-xs font-mono">{act.Longitude || "N/A"}</TableCell>
                                                        <TableCell>
                                                            {act.PhotoURL ? (
                                                                <div className="relative group">
                                                                    <img
                                                                        src={act.PhotoURL}
                                                                        alt={`Photo of ${act.ReferenceID || "activity"}`}
                                                                        className="w-10 h-10 object-cover rounded border border-cyan-500/30"
                                                                    />
                                                                    <div className="absolute inset-0 bg-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity rounded" />
                                                                </div>
                                                            ) : (
                                                                <span className="text-cyan-500/40 text-xs">N/A</span>
                                                            )}
                                                        </TableCell>

                                                        <TableCell className="text-center">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => openEditDialog(act)}
                                                                        className="bg-slate-900/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                                                                    >
                                                                        <EditIcon className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left" className="bg-slate-900 border-cyan-500/30 text-cyan-100">
                                                                    Edit activity
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>

                                        </Table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-center items-center gap-4 my-4 px-4">
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
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
        </TooltipProvider>
    );
}
