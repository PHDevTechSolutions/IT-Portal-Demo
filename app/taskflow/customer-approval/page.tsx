"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Pagination } from "@/components/app-pagination"
import { Calendar } from "@/components/taskflow/customer-database/calendar"
import { DeleteDialog } from "@/components/taskflow/customer-database/delete"
import { ApproveDialog } from "@/components/taskflow/customer-database/approval"
import { FilterDialog } from "@/components/taskflow/customer-database/filter-dialog"
import { toast } from "sonner"
import {
    Loader2,
    Search,
    Trash,
    FileDown,
    BadgeCheck,
    AlertTriangle,
    Clock,
    XCircle,
    PauseCircle,
    UserX,
    UserCheck,
    CheckCircle2,
    XOctagon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
    DndContext,
    closestCenter,
    MouseSensor,
    TouchSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext,
    verticalListSortingStrategy,
    arrayMove,
    useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
    id: number
    company_name: string
    contact_person: string
    contact_number: string
    email_address: string
    address: string
    region: string
    type_client: string
    referenceid: string
    tsm: string
    manager: string
    status: string
    remarks: string
    date_created: string
    date_updated: string
    next_available_date?: string
    transfer_to: string
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string | null }) {
    const s = (status ?? "").trim().toLowerCase()
    if (!s)
        return <Badge variant="outline" className="text-slate-500 border-slate-700">—</Badge>
    if (s === "active")
        return (
            <Badge variant="secondary" className="bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                <BadgeCheck className="size-3.5" /> Active
            </Badge>
        )
    if (s === "new client")
        return (
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                <UserCheck className="size-3.5" /> New Client
            </Badge>
        )
    if (s === "non-buying")
        return (
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
                <AlertTriangle className="size-3.5" /> Non-Buying
            </Badge>
        )
    if (s === "inactive")
        return (
            <Badge variant="secondary" className="bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                <XCircle className="size-3.5" /> Inactive
            </Badge>
        )
    if (s === "on hold")
        return (
            <Badge variant="secondary" className="bg-stone-500/20 text-stone-400 border border-stone-500/30 flex items-center gap-1">
                <PauseCircle className="size-3.5" /> On Hold
            </Badge>
        )
    if (s === "used")
        return (
            <Badge variant="secondary" className="bg-blue-900/40 text-blue-300 border border-blue-700/40 flex items-center gap-1">
                <Clock className="size-3.5" /> Used
            </Badge>
        )
    if (s === "approval for transfer")
        return (
            <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                <Clock className="size-3.5" /> Approval for Transfer
            </Badge>
        )
    if (s === "for deletion" || s === "remove")
        return (
            <Badge variant="secondary" className="bg-red-600/20 text-red-400 border border-red-600/30 flex items-center gap-1">
                <UserX className="size-3.5" /> {status}
            </Badge>
        )
    return (
        <Badge variant="outline" className="text-slate-400 border-slate-700">{status}</Badge>
    )
}

// ─── DraggableRow ─────────────────────────────────────────────────────────────

function DraggableRow({ item, children }: { item: Customer; children: React.ReactNode }) {
    const { setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    }
    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className="border-slate-800 hover:bg-slate-800/50 data-[dragging=true]:opacity-60"
        >
            {children}
        </TableRow>
    )
}

export default function AccountPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [userId] = useState<string | null>(searchParams?.get("userId") ?? null)
    const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor), useSensor(KeyboardSensor))

    const [customers, setCustomers] = useState<Customer[]>([])
    const [search, setSearch] = useState("")
    const [filterType, setFilterType] = useState("all")
    const [filterStatus, setFilterStatus] = useState("all")
    const [page, setPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(20)
    // 🔹 Audit states
    const [audited, setAudited] = useState<Customer[]>([])
    const [isAuditView, setIsAuditView] = useState(false)
    const [duplicateIds, setDuplicateIds] = useState<Set<number>>(new Set())
    // 🔍 Audit filter state (for interactive summary)
    const [auditFilter, setAuditFilter] = useState<"" | "all" | "missingType" | "missingStatus" | "duplicates">("")
    const [showFilters, setShowFilters] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [isFiltering, setIsFiltering] = useState(false)
    // 🔹 TSA & Date Range filters
    const [tsaList, setTsaList] = useState<{ value: string; label: string }[]>([])
    const [filterTSA, setFilterTSA] = useState("all")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [selectedIds, setSelectedIdsAction] = useState<Set<number>>(new Set())
    const [selectAll, setSelectAll] = useState(false)

    const [showApproveDialog, setShowApproveDialog] = useState(false);
    const [isApproving, setIsApproving] = useState(false);

    // Fetch TSA list
    useEffect(() => {
        const fetchTSA = async () => {
            try {
                const res = await fetch(
                    "/api/UserManagement/FetchTSA?Role=Territory%20Sales%20Associate"
                );
                const json = await res.json();

                if (Array.isArray(json)) {
                    const formatted = json.map((user: any) => ({
                        value: user.ReferenceID,
                        label: `${user.Firstname} ${user.Lastname}`,
                    }));
                    setTsaList([{ value: "all", label: "All TSA" }, ...formatted]);
                } else {
                    console.error("Unexpected TSA response:", json);
                }
            } catch (err) {
                console.error("Error fetching TSA list:", err);
            }
        };
        fetchTSA();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsFetching(true)
            const toastId = toast.loading("Fetching customer data...")
            try {
                const response = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Fetch")
                const json = await response.json()
                setCustomers(json.data || [])
                toast.success("Customer data loaded successfully!", { id: toastId })
            } catch (err) {
                console.error("Error fetching customers:", err)
                toast.error("Failed to load customer data.", { id: toastId })
            } finally {
                setIsFetching(false)
            }
        }
        fetchData()
    }, [])

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (active.id !== over?.id) {
            const oldIndex = customers.findIndex((c) => c.id === active.id)
            const newIndex = customers.findIndex((c) => c.id === over?.id)
            setCustomers(arrayMove(customers, oldIndex, newIndex))
        }
    }

    // 🔹 Dynamic filters
    const typeOptions = useMemo(() => {
        const types = new Set(customers.map((c) => c.type_client).filter(Boolean))
        return ["all", ...Array.from(types)]
    }, [customers])

    const statusOptions = useMemo(() => {
        const statuses = new Set(customers.map((c) => c.status).filter(Boolean))
        return ["all", ...Array.from(statuses)]
    }, [customers])

    useEffect(() => {
        setIsFiltering(true)
        const timer = setTimeout(() => {
            setIsFiltering(false)
            toast.info("Filter updated.")
        }, 600)
        return () => clearTimeout(timer)
    }, [search, filterType, filterStatus])

    // 🔍 Filtered + Search
    useEffect(() => setPage(1), [search, filterType, filterStatus]);

    const filtered = useMemo(() =>
        customers
            .filter((c) =>
                [c.company_name, c.contact_person, c.email_address, c.region, c.manager, c.tsm]
                    .some((field) => field?.toLowerCase().includes(search.toLowerCase()))
            )
            .filter((c) => (filterType === "all" ? true : c.type_client === filterType))
            // Filter status to only Transferred or Pending
            .filter((c) => c.status === "Approval for Transfer")
            .filter((c) =>
                filterTSA === "all"
                    ? true
                    : c.referenceid?.trim().toLowerCase() === filterTSA.trim().toLowerCase()
            )
            .filter((c) => {
                if (!startDate && !endDate) return true;
                const created = new Date(c.date_created);
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate) : null;
                if (start && created < start) return false;
                if (end && created > end) return false;
                return true;
            })
            .sort((a, b) => {
                const dateA = new Date(a.date_created).getTime();
                const dateB = new Date(b.date_created).getTime();
                return dateB - dateA; // descending order: latest first
            }),
        [customers, search, filterType, filterTSA, startDate, endDate]
    );


    // 🧭 Pagination + display switch
    const displayData = useMemo(() => {
        if (!isAuditView) return filtered
        if (auditFilter === "" || auditFilter === "all") return audited
        if (auditFilter === "missingType")
            return audited.filter((c) => !c.type_client?.trim() && c.status?.trim())
        if (auditFilter === "missingStatus")
            return audited.filter((c) => !c.status?.trim() && c.type_client?.trim())
        if (auditFilter === "duplicates")
            return audited.filter((c) => duplicateIds.has(c.id))
        return audited
    }, [filtered, audited, isAuditView, auditFilter, duplicateIds])

    const totalPages = Math.max(1, Math.ceil(displayData.length / rowsPerPage))
    const current = displayData.slice((page - 1) * rowsPerPage, page * rowsPerPage)

    const tsaMap = useMemo(() => {
        const map: Record<string, string> = {};
        tsaList.forEach((t) => {
            map[t.value.toLowerCase()] = t.label;
        });
        return map;
    }, [tsaList]);

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return toast.error("No customers selected.");
        setShowDeleteDialog(true);
    };

    const executeBulkDelete = async (): Promise<void> => {
        if (selectedIds.size === 0) {
            toast.error("No customers selected.");
            return; // Early return with void
        }

        const idsArray = Array.from(selectedIds);
        let deletedCount = 0;
        let loadingToastId = toast.loading(`Deleting 0/${idsArray.length}...`);

        try {
            const res = await fetch(`/api/Data/Applications/Taskflow/CustomerDatabase/BulkDelete`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userIds: idsArray }),
            });
            const result = await res.json();

            if (result.success) {
                for (let i = 0; i < idsArray.length; i++) {
                    deletedCount++;
                    toast.dismiss(loadingToastId);
                    loadingToastId = toast.loading(`Deleting ${deletedCount}/${idsArray.length}...`);
                    await new Promise((res) => setTimeout(res, 30));
                }

                toast.success(`Deleted ${deletedCount} customers.`);

                // Remove deleted customers from state
                setCustomers((prev) => prev.filter((c) => !selectedIds.has(c.id)));
                setSelectedIdsAction(new Set());

                // No return value here!
            } else {
                toast.error(result.error || "Bulk delete failed.");
                // No return value here either
            }
        } catch (err) {
            console.error(err);
            toast.error("Bulk delete failed.");
        }
    };

    const toggleSelect = (id: number) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIdsAction(newSet)
        setSelectAll(newSet.size === current.length)
    }

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedIdsAction(new Set())
            setSelectAll(false)
        } else {
            setSelectedIdsAction(new Set(current.map(c => c.id)))
            setSelectAll(true)
        }
    }

    const executeBulkApprove = async () => {
        if (selectedIds.size === 0) {
            toast.error("No customers selected.");
            setShowApproveDialog(false);
            return;
        }
        setIsApproving(true);
        try {
            const res = await fetch(`/api/Data/Applications/Taskflow/CustomerDatabase/BulkApproveTransfer`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userIds: Array.from(selectedIds),
                    status: "Active",
                    updateReferenceIdFromTransferTo: true // optional flag to indicate you want to update referenceid
                }),
            });

            const result = await res.json();

            if (result.success) {
                // Update local customers state to reflect new status and update referenceid using transfer_to
                setCustomers((prev) =>
                    prev.map((c) => {
                        if (selectedIds.has(c.id)) {
                            return {
                                ...c,
                                status: "Active",
                                date_updated: new Date().toISOString(),
                                referenceid: c.transfer_to || c.referenceid, // update referenceid to transfer_to if exists
                            };
                        }
                        return c;
                    })
                );

                toast.success(`Approved ${selectedIds.size} customers successfully.`);
                setSelectedIdsAction(new Set());
                setSelectAll(false);
                setShowApproveDialog(false);
            } else {
                toast.error(result.error || "Approval failed.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Approval failed due to a network error.");
        } finally {
            setIsApproving(false);
        }
    };

    const executeBulkCancelTransfer = async () => {
        if (selectedIds.size === 0) {
            toast.error("No customers selected.");
            return;
        }
        setIsApproving(true);
        try {
            const res = await fetch(`/api/Data/Applications/Taskflow/CustomerDatabase/BulkCancelTransfer`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userIds: Array.from(selectedIds),
                    status: "Active", // o ano man ang status para sa cancelled transfer
                }),
            });

            const result = await res.json();

            if (result.success) {
                // Update local customers state to reflect cancel status (status lang, walang referenceid update)
                setCustomers((prev) =>
                    prev.map((c) =>
                        selectedIds.has(c.id)
                            ? {
                                ...c,
                                status: "Active", // or whatever status you want here
                                date_updated: new Date().toISOString(),
                            }
                            : c
                    )
                );

                toast.success(`Cancelled transfer for ${selectedIds.size} customers successfully.`);
                setSelectedIdsAction(new Set());
                setSelectAll(false);
            } else {
                toast.error(result.error || "Cancel transfer failed.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Cancel transfer failed due to a network error.");
        } finally {
            setIsApproving(false);
        }
    };

    const exportToExcel = async () => {
        const ExcelJS = (await import("exceljs")).default;
        const { saveAs } = await import("file-saver");

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Customer Approval");

        sheet.columns = [
            { header: "Company", key: "company_name", width: 35 },
            { header: "Contact Person", key: "contact_person", width: 25 },
            { header: "Email", key: "email_address", width: 30 },
            { header: "Type", key: "type_client", width: 18 },
            { header: "Status", key: "status", width: 22 },
            { header: "Area", key: "region", width: 20 },
            { header: "Transfer From", key: "transfer_from", width: 25 },
            { header: "Transfer To", key: "transfer_to_name", width: 25 },
            { header: "TSM", key: "tsm", width: 20 },
            { header: "Manager", key: "manager", width: 20 },
            { header: "Date Created", key: "date_created", width: 18 },
            { header: "Date Updated", key: "date_updated", width: 18 },
            { header: "Next Available", key: "next_available_date", width: 18 },
        ];

        // Style header row
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
            };
        });
        headerRow.height = 20;

        // Use filtered (all pages, not just current page)
        displayData.forEach((c, i) => {
            const row = sheet.addRow({
                company_name: c.company_name?.toUpperCase() || "",
                contact_person: c.contact_person || "",
                email_address: c.email_address || "",
                type_client: c.type_client || "—",
                status: c.status || "—",
                region: c.region || "",
                transfer_from: tsaMap[c.referenceid?.trim().toLowerCase()] || c.referenceid || "-",
                transfer_to_name: tsaMap[c.transfer_to?.trim().toLowerCase()] || c.transfer_to || "-",
                tsm: c.tsm || "",
                manager: c.manager || "",
                date_created: c.date_created ? new Date(c.date_created).toLocaleDateString() : "",
                date_updated: c.date_updated ? new Date(c.date_updated).toLocaleDateString() : "",
                next_available_date: c.next_available_date
                    ? new Date(c.next_available_date).toLocaleDateString()
                    : "-",
            });

            const rowBg = i % 2 === 0 ? "FFFFFFFF" : "FFF0F4FA";
            row.eachCell((cell) => {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
                cell.alignment = { vertical: "middle", wrapText: true };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFD0D0D0" } },
                    left: { style: "thin", color: { argb: "FFD0D0D0" } },
                    bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
                    right: { style: "thin", color: { argb: "FFD0D0D0" } },
                };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const timestamp = new Date().toISOString().slice(0, 10);
        saveAs(blob, `customer-approval-${timestamp}.xlsx`);
        toast.success("Excel file exported successfully!");
    };

    return (
        <ProtectedPageWrapper>
            <SidebarProvider className="dark">
                <AppSidebar />
                <SidebarInset className="bg-slate-950 text-slate-100 flex flex-col h-svh overflow-hidden">
                    {/* Header */}
                    <header className="flex h-14 shrink-0 items-center gap-2 px-3 sm:px-4 border-b border-cyan-500/20 bg-slate-900/80 backdrop-blur-sm">
                        <SidebarTrigger className="-ml-1 text-slate-400 hover:text-cyan-400" />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/dashboard")}
                            className="text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 text-xs hidden sm:flex"
                        >
                            Home
                        </Button>
                        <Separator orientation="vertical" className="h-4 bg-slate-700 hidden sm:block" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbLink href="#" className="text-slate-500 hover:text-cyan-400 text-xs hidden sm:block">
                                        Taskflow
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="text-slate-600 hidden sm:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="text-cyan-400 text-xs font-semibold tracking-wide">
                                        Customer Approval
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </header>

                    {/* Toolbar */}
                    <div className="shrink-0 px-3 sm:px-4 pt-3 pb-2 border-b border-slate-800 space-y-3">
                        {/* Title row */}
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h1 className="text-sm sm:text-base font-bold tracking-widest uppercase text-cyan-400 leading-tight">
                                    Customer Approval
                                </h1>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    {isFetching ? "Loading…" : (
                                        <>
                                            <span className="font-semibold text-slate-300">{displayData.length}</span>
                                            {" "}pending for approval
                                        </>
                                    )}
                                </p>
                            </div>
                            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px] shrink-0">
                                Total: {displayData.length}
                            </Badge>
                        </div>

                        {/* Action bar */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[160px] max-w-xs">
                                <Search className="absolute left-2 top-2.5 size-3.5 text-slate-500" />
                                <Input
                                    placeholder="Search customers…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-7 h-9 text-xs bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 rounded-none"
                                />
                                {isFiltering && (
                                    <Loader2 className="absolute right-2 top-2.5 size-3.5 animate-spin text-slate-500" />
                                )}
                            </div>

                            {/* Buttons */}
                            <div className="flex flex-wrap items-center gap-2">
                                <Calendar
                                    startDate={startDate}
                                    endDate={endDate}
                                    setStartDateAction={setStartDate}
                                    setEndDateAction={setEndDate}
                                />

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={exportToExcel}
                                    className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-cyan-500/10 hover:border-cyan-500/40 hover:text-cyan-400 rounded-none h-9 text-xs uppercase tracking-wider"
                                >
                                    <FileDown className="size-4 mr-1" /> Export
                                </Button>

                                <FilterDialog
                                    filterTSA={filterTSA}
                                    setFilterTSA={setFilterTSA}
                                    tsaList={tsaList}
                                    filterType={filterType}
                                    setFilterType={setFilterType}
                                    typeOptions={typeOptions}
                                    filterStatus={filterStatus}
                                    setFilterStatus={setFilterStatus}
                                    statusOptions={statusOptions}
                                    rowsPerPage={rowsPerPage}
                                    setRowsPerPage={setRowsPerPage}
                                    setPage={setPage}
                                />

                                {selectedIds.size > 0 && (
                                    <>
                                        <Button
                                            size="sm"
                                            onClick={() => setShowApproveDialog(true)}
                                            className="bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 hover:text-cyan-300 rounded-none h-9 text-xs uppercase tracking-wider"
                                        >
                                            <CheckCircle2 className="size-4 mr-1" />
                                            Approve ({selectedIds.size})
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={executeBulkCancelTransfer}
                                            disabled={isApproving}
                                            className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-200 rounded-none h-9 text-xs uppercase tracking-wider"
                                        >
                                            <XOctagon className="size-4 mr-1" />
                                            Cancel Transfer ({selectedIds.size})
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={handleBulkDelete}
                                            className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-none h-9 text-xs uppercase tracking-wider border"
                                        >
                                            <Trash className="size-4 mr-1" />
                                            Delete ({selectedIds.size})
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Scrollable table area */}
                    <div className="flex-1 overflow-auto px-3 sm:px-4 pb-3 min-h-0">
                        <div className="border border-slate-800 overflow-auto">
                            {isFetching ? (
                                <div className="py-20 text-center flex flex-col items-center gap-3 text-slate-500 text-xs">
                                    <Loader2 className="size-6 animate-spin text-cyan-500" />
                                    <span>Loading customers…</span>
                                </div>
                            ) : current.length > 0 ? (
                                <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
                                    <SortableContext items={current.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                                        <Table className="whitespace-nowrap text-[12px] min-w-full">
                                            <TableHeader className="bg-slate-900 sticky top-0 z-10">
                                                <TableRow className="border-slate-800 hover:bg-transparent">
                                                    <TableHead className="w-8 text-center text-slate-500">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectAll}
                                                            onChange={handleSelectAll}
                                                            className="accent-cyan-500"
                                                        />
                                                    </TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Company</TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Contact</TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Email</TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Type</TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Status</TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Area</TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Transfer From</TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Transfer To</TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">TSM</TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Manager</TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Date Created</TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Date Updated</TableHead>
                                                    <TableHead className="text-slate-400 text-[11px] uppercase tracking-wider">Next Available</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {current.map((c) => {
                                                    const isSelected = selectedIds.has(c.id)

                                                    return (
                                                        <DraggableRow key={c.id} item={c}>
                                                            <TableCell className="text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => toggleSelect(c.id)}
                                                                    className="accent-cyan-500"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="uppercase whitespace-normal break-words max-w-[250px] text-slate-200 font-medium">
                                                                {c.company_name}
                                                            </TableCell>
                                                            <TableCell className="capitalize whitespace-normal break-words max-w-[200px] text-slate-300">
                                                                {c.contact_person}
                                                            </TableCell>
                                                            <TableCell className="whitespace-normal break-words max-w-[250px] text-slate-400">
                                                                {c.email_address}
                                                            </TableCell>
                                                            <TableCell className="text-slate-300">
                                                                {c.type_client || <span className="text-slate-600">—</span>}
                                                            </TableCell>
                                                            <TableCell>
                                                                <StatusBadge status={c.status} />
                                                            </TableCell>
                                                            <TableCell className="text-slate-300">{c.region}</TableCell>
                                                            <TableCell className="capitalize text-slate-300">
                                                                {tsaMap[c.referenceid?.trim().toLowerCase()] || c.referenceid || <span className="text-slate-600">-</span>}
                                                            </TableCell>
                                                            <TableCell className="capitalize text-cyan-400 font-medium">
                                                                {tsaMap[c.transfer_to?.trim().toLowerCase()] || c.transfer_to || <span className="text-slate-600">-</span>}
                                                            </TableCell>
                                                            <TableCell className="text-slate-300">{c.tsm}</TableCell>
                                                            <TableCell className="text-slate-300">{c.manager}</TableCell>
                                                            <TableCell className="text-slate-400">
                                                                {new Date(c.date_created).toLocaleDateString()}
                                                            </TableCell>
                                                            <TableCell className="text-slate-400">
                                                                {new Date(c.date_updated).toLocaleDateString()}
                                                            </TableCell>
                                                            <TableCell className="text-slate-400">
                                                                {c.next_available_date
                                                                    ? new Date(c.next_available_date).toLocaleDateString()
                                                                    : <span className="text-slate-600">-</span>}
                                                            </TableCell>
                                                        </DraggableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </SortableContext>
                                </DndContext>
                            ) : (
                                <div className="py-20 text-center text-xs text-slate-500">
                                    No customers pending for approval.
                                </div>
                            )}
                        </div>
                    </div>

                    <ApproveDialog
                        open={showApproveDialog}
                        onOpenChange={setShowApproveDialog}
                        onConfirm={executeBulkApprove}
                        isLoading={isApproving}
                        selectedCount={selectedIds.size}
                    />

                    <DeleteDialog
                        open={showDeleteDialog}
                        onOpenChange={setShowDeleteDialog}
                        selectedCount={selectedIds.size}
                        onConfirm={executeBulkDelete}
                    />

                    {/* Pagination */}
                    <div className="shrink-0 flex justify-center items-center gap-4 py-3 border-t border-slate-800">
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            onPageChangeAction={setPage}
                        />
                    </div>

                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    )
}
