"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "../../components/app-sidebar"
import { Pagination } from "../../components/app-pagination"
import { Download } from "../../components/app-customer-database-download"
import { Audit } from "../../components/app-customer-database-audit"
import { Calendar } from "../../components/app-customer-database-calendar";
import { ImportDialog } from "../../components/app-customer-database-import"
import { AuditDialog } from "../../components/app-customer-database-audit-dialog"
import { DeleteDialog } from "../../components/app-customer-database-delete-dialog"
import { TransferDialog } from "../../components/app-customer-database-transfer"
import { FilterDialog } from "../../components/app-customer-database-filter"
import { toast } from "sonner"
import { Loader2, Filter } from "lucide-react"
import { BadgeCheck, AlertTriangle, Clock, XCircle, PauseCircle, UserX, UserCheck, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ButtonGroup } from "@/components/ui/button-group"
type AuditKey = "duplicates" | "missingType" | "missingStatus";

interface Customer {
    id: number
    account_reference_number: string;
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
}

function DraggableRow({ item, children }: { item: Customer; children: React.ReactNode }) {
    const { setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.8 : 1,
    }
    return (
        <TableRow ref={setNodeRef} style={style} className="data-[dragging=true]:opacity-75 hover:bg-muted/5">
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

    const [showAuditDialog, setShowAuditDialog] = useState(false);
    const [auditSelection, setAuditSelection] = useState<Record<AuditKey, boolean>>({
        duplicates: false,
        missingType: false,
        missingStatus: false,
    });

    // 🔹 Manager & TSM lists
    const [tsas, setTsas] = useState<{ label: string; value: string }[]>([])
    const [tsms, setTsms] = useState<{ label: string; value: string }[]>([])
    const [managers, setManagers] = useState<{ label: string; value: string }[]>([])

    const [showTransferDialog, setShowTransferDialog] = useState(false)
    const [transferType, setTransferType] = useState<"TSM" | "Manager" | null>(null)
    const [transferSelection, setTransferSelection] = useState<string>("")

    const [isGenerating, setIsGenerating] = useState(false);
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

    const toggleAuditSelection = (key: "duplicates" | "missingType" | "missingStatus") => {
        setAuditSelection(prev => ({ ...prev, [key]: !prev[key] }));
    };

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

    useEffect(() => {
        if (!showTransferDialog) return;

        const fetchDropdowns = async () => {
            try {
                const [tsaRes, tsmRes, managerRes] = await Promise.all([
                    fetch("/api/UserManagement/FetchTSA?Role=Territory Sales Associate"),
                    fetch("/api/UserManagement/FetchTSM?Role=Territory Sales Manager"),
                    fetch("/api/UserManagement/FetchManager?Role=Manager"),
                ]);
                const tsaData = await tsaRes.json();
                const tsmData = await tsmRes.json();
                const managerData = await managerRes.json();
                setTsas(
                    tsaData.map((m: any) => ({
                        label: `${m.Firstname} ${m.Lastname}`,
                        value: m.ReferenceID,
                    }))
                );
                setTsms(
                    tsmData.map((t: any) => ({
                        label: `${t.Firstname} ${t.Lastname}`,
                        value: t.ReferenceID,
                    }))
                );
                setManagers(
                    managerData.map((m: any) => ({
                        label: `${m.Firstname} ${m.Lastname}`,
                        value: m.ReferenceID,
                    }))
                );
            } catch (err) {
                toast.error("Failed to fetch manager/TSM lists.");
            }
        };

        fetchDropdowns();
    }, [showTransferDialog]);

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
    useEffect(() => setPage(1), [search, filterType, filterStatus])
    const filtered = useMemo(() =>
        customers
            .filter((c) =>
                [c.company_name, c.contact_person, c.email_address, c.region, c.manager, c.tsm]
                    .some((field) => field?.toLowerCase().includes(search.toLowerCase()))
            )
            .filter((c) => (filterType === "all" ? true : c.type_client === filterType))
            .filter((c) => (filterStatus === "all" ? true : c.status === filterStatus))
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
                const nameA = a.company_name?.toLowerCase() || "";
                const nameB = b.company_name?.toLowerCase() || "";

                if (nameA < nameB) return sortOrder === "asc" ? -1 : 1;
                if (nameA > nameB) return sortOrder === "asc" ? 1 : -1;
                return 0;
            }),
        [customers, search, filterType, filterStatus, filterTSA, startDate, endDate, sortOrder]
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
    const totalCount = filtered.length;

    const handleReturn = () => {
        setIsAuditView(false)
        setAudited([])
        setDuplicateIds(new Set())
    }

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

    const handleAutoGenerate = async () => {
        if (selectedIds.size === 0) {
            toast.error("No customers selected.");
            return;
        }

        setIsGenerating(true);

        try {
            const selectedCustomers = customers.filter(c => selectedIds.has(c.id));

            // Helper to get initials from company_name
            const getInitials = (name: string) => {
                const parts = name.trim().split(/\s+/);
                if (parts.length === 1) return parts[0][0].toUpperCase();
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            };

            // For each customer, build ref based on initials + region (instead of hardcoded "NCR")
            const updates = selectedCustomers.map((customer, index) => {
                const initials = getInitials(customer.company_name);
                // Get region code or fallback to 'NCR'
                const regionCode = (customer.region || 'NCR').toUpperCase().replace(/\s+/g, '');

                // Sequence number with leading zeros length 10
                const seqNum = (index + 1).toString().padStart(10, "0");

                // Format: [Initials]-[RegionCode]-[Sequence]
                const newRef = `${initials}-${regionCode}-${seqNum}`;

                return {
                    id: customer.id,
                    account_reference_number: newRef,
                };
            });

            const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/UpdateReferenceNumber", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates }),
            });

            const result = await res.json();

            if (result.success) {
                setCustomers((prev) =>
                    prev.map((c) => {
                        const update = updates.find((u) => u.id === c.id);
                        if (update) return { ...c, referenceid: update.account_reference_number };
                        return c;
                    })
                );
                toast.success("Reference numbers generated and updated successfully.");
            } else {
                toast.error(result.error || "Failed to update reference numbers.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred during update.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <SidebarProvider>
            <AppSidebar userId={userId} />
            <SidebarInset>
                {/* Header */}
                <header className="flex h-16 shrink-0 items-center gap-2 px-4">
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
                                <BreadcrumbPage>Customer Database</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>

                {/* 🔍 Search + Filters */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 px-4 py-3">
                    {/* 🔎 Search Input */}
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Search customers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 w-full pr-8"
                        />
                        {isFiltering && (
                            <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-muted-foreground" />
                        )}
                    </div>

                    {/* 🧩 Right-Side Button Group */}
                    <div className="flex flex-wrap items-center justify-end w-full gap-2 sm:w-auto">
                        <Button
                            variant="outline"
                            onClick={() => setShowFilters((prev) => !prev)}
                        >
                            <Filter />
                        </Button>

                        <Calendar
                            startDate={startDate}
                            endDate={endDate}
                            setStartDateAction={setStartDate}
                            setEndDateAction={setEndDate}
                        />

                        <ImportDialog />

                        <Download data={filtered} filename="CustomerDatabase" />

                        {selectedIds.size > 0 && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowTransferDialog(true)}
                                    className="min-w-[100px]"
                                >
                                    <ArrowRight className="w-4 h-4" /> Transfer
                                </Button>

                                <Button
                                    onClick={handleAutoGenerate}
                                    size="sm"
                                    disabled={isGenerating}
                                    className="min-w-[140px]"
                                >
                                    {isGenerating ? "Generating..." : "Auto-Generate ID"} ({selectedIds.size})
                                </Button>

                                <Button
                                    onClick={handleBulkDelete}
                                    variant="destructive"
                                    size="sm"
                                    className="rounded-none sm:rounded-r-md border-l sm:border-l-0 min-w-[140px]"
                                >
                                    Delete Selected ({selectedIds.size})
                                </Button>
                            </>
                        )}

                        {!isAuditView ? (
                            <Audit
                                customers={customers}
                                setAuditedAction={setAudited}
                                setDuplicateIdsAction={setDuplicateIds}
                                setIsAuditViewAction={setIsAuditView}
                            />
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleReturn}
                                className="rounded-none sm:rounded-r-md border-l sm:border-l-0 min-w-[120px]"
                            >
                                Return to List
                            </Button>
                        )}

                        <TransferDialog
                            open={showTransferDialog}
                            onOpenChangeAction={(open) => {
                                setShowTransferDialog(open);
                                if (!open) {
                                    setTransferSelection("");
                                    setTransferType(null);
                                }
                            }}
                            selectedIds={new Set(Array.from(selectedIds).map(String))}
                            setSelectedIdsAction={(ids: Set<string>) => {
                                const newIds = new Set(Array.from(ids).map((id) => Number(id)));
                                setSelectedIdsAction(newIds);
                            }}
                            setAccountsAction={(updateFn) => setCustomers((prev) => updateFn(prev))}
                            tsas={tsas}
                            tsms={tsms}
                            managers={managers}
                        />
                    </div>

                    {/* 🧮 Filters Section (collapsible) */}
                    {showFilters && (
                        <FilterDialog
                            open={showFilters}
                            onOpenChange={setShowFilters}
                            filterTSA={filterTSA}
                            setFilterTSA={setFilterTSA}
                            filterType={filterType}
                            setFilterType={setFilterType}
                            filterStatus={filterStatus}
                            setFilterStatus={setFilterStatus}
                            rowsPerPage={rowsPerPage}
                            setRowsPerPage={setRowsPerPage}
                            tsaList={tsaList}
                            typeOptions={typeOptions}
                            statusOptions={statusOptions}
                            sortOrder={sortOrder}
                            setSortOrder={setSortOrder}
                            onClose={() => setShowFilters(false)}
                        />
                    )}
                </div>

                {isAuditView && (
                    <div className="mx-4 mb-2 mt-1 flex flex-col gap-2 bg-muted/50 rounded-md px-4 py-2 border border-border text-[13px]">
                        {/* 🔍 Top Row: Summary + Buttons */}
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            {/* 🧾 Audit Summary (left) */}
                            <div
                                className="font-medium cursor-pointer select-none underline text-red-600"
                                onClick={() => {
                                    // Default: lahat ng audit type unchecked
                                    setAuditSelection({
                                        duplicates: true,      // pwede default checked
                                        missingType: true,
                                        missingStatus: true,
                                    });
                                    setShowAuditDialog(true);
                                }}
                            >
                                🧾 Audit Summary: <span className="font-semibold text-red-600">{audited.length}</span> total issues found
                            </div>

                            {/* 🧩 Button Group Filters (right side) */}
                            <div className="flex flex-wrap gap-2 justify-end ml-auto">
                                <ButtonGroup aria-label="Audit Filter Buttons" className="flex">
                                    <Button
                                        size="sm"
                                        variant={auditFilter === "missingType" ? "secondary" : "outline"}
                                        className={`rounded-l-md ${auditFilter === "missingType" ? "bg-yellow-100 text-yellow-900" : ""
                                            }`}
                                        onClick={() =>
                                            setAuditFilter(auditFilter === "missingType" ? "" : "missingType")
                                        }
                                    >
                                        ⚠ Missing Type:{" "}
                                        {audited.filter((c) => !c.type_client?.trim() && c.status?.trim()).length}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={auditFilter === "missingStatus" ? "secondary" : "outline"}
                                        className={
                                            auditFilter === "missingStatus"
                                                ? "bg-yellow-100 text-yellow-900"
                                                : ""
                                        }
                                        onClick={() =>
                                            setAuditFilter(auditFilter === "missingStatus" ? "" : "missingStatus")
                                        }
                                    >
                                        ⚠ Missing Status:{" "}
                                        {audited.filter((c) => !c.status?.trim() && c.type_client?.trim()).length}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={auditFilter === "duplicates" ? "secondary" : "outline"}
                                        className={`rounded-r-md ${auditFilter === "duplicates" ? "bg-red-100 text-red-900" : ""
                                            }`}
                                        onClick={() =>
                                            setAuditFilter(auditFilter === "duplicates" ? "" : "duplicates")
                                        }
                                    >
                                        🔁 Duplicates: {Array.from(duplicateIds).length}
                                    </Button>
                                </ButtonGroup>
                            </div>
                        </div>
                    </div>
                )}

                <DeleteDialog
                    open={showDeleteDialog}
                    onOpenChange={setShowDeleteDialog}
                    selectedCount={selectedIds.size}
                    onConfirm={executeBulkDelete}
                />

                <AuditDialog
                    showAuditDialog={showAuditDialog}
                    setShowAuditDialogAction={setShowAuditDialog}
                    audited={audited}
                    duplicateIds={duplicateIds}
                    auditSelection={auditSelection}
                    toggleAuditSelectionAction={toggleAuditSelection}
                    setAuditFilterAction={setAuditFilter}
                    setCustomersAction={setCustomers}
                />

                {/* Table */}
                <div className="p-4">
                    <div className="flex justify-start mb-2">
                        <Badge variant="outline">{`Total: ${totalCount}`}</Badge>
                    </div>
                    <div className="overflow-auto min-h-[200px] flex items-center justify-center">
                        {isFetching ? (
                            <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
                                <Loader2 className="size-6 animate-spin" />
                                <span>Loading customers...</span>
                            </div>

                        ) : current.length > 0 ? (
                            <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
                                <SortableContext items={current.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                                    <Table className="whitespace-nowrap text-[13px] min-w-full">
                                        <TableHeader className="bg-muted sticky top-0 z-10">
                                            <TableRow>
                                                <TableHead className="w-8 text-center">
                                                    <input type="checkbox" checked={selectAll} onChange={handleSelectAll} />
                                                </TableHead>
                                                <TableHead>#</TableHead>
                                                <TableHead>Company</TableHead>
                                                <TableHead>Contact</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Area</TableHead>
                                                <TableHead>TSA</TableHead>
                                                <TableHead>TSM</TableHead>
                                                <TableHead>Manager</TableHead>
                                                <TableHead>Date Created</TableHead>
                                                <TableHead>Date Updated</TableHead>
                                                <TableHead>Next Available</TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody className="text-[12px]">
                                            {current.map((c) => {
                                                const isMissingType = !c.type_client?.trim()
                                                const isMissingStatus = !c.status?.trim()
                                                const isDuplicate = duplicateIds.has(c.id)
                                                const isSelected = selectedIds.has(c.id)

                                                return (
                                                    <DraggableRow key={c.id} item={c}>
                                                        <TableCell className="text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleSelect(c.id)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="capitalize whitespace-normal break-words max-w-[200px]">
                                                            {c.account_reference_number}
                                                        </TableCell>
                                                        <TableCell
                                                            className="uppercase whitespace-normal break-words max-w-[250px]"
                                                        >
                                                            <span
                                                                className={
                                                                    isDuplicate || isMissingType || isMissingStatus
                                                                        ? "line-through underline decoration-red-500 decoration-2"
                                                                        : ""
                                                                }
                                                            >
                                                                {c.company_name}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="capitalize whitespace-normal break-words max-w-[200px]">
                                                            {c.contact_person}
                                                        </TableCell>
                                                        <TableCell className="whitespace-normal break-words max-w-[250px]">
                                                            {c.email_address}
                                                        </TableCell>
                                                        <TableCell>
                                                            <span
                                                                className={
                                                                    isMissingType
                                                                        ? "line-through underline decoration-red-500 decoration-2"
                                                                        : ""
                                                                }
                                                            >
                                                                {c.type_client || "—"}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="text-center">
                                                            {c.status ? (
                                                                (() => {
                                                                    const status = c.status.trim().toLowerCase()
                                                                    switch (status) {
                                                                        case "active":
                                                                            return (
                                                                                <Badge
                                                                                    variant="secondary"
                                                                                    className="bg-green-500/90 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700 flex items-center gap-1 transition-colors duration-200"
                                                                                >
                                                                                    <BadgeCheck className="size-3.5" />
                                                                                    Active
                                                                                </Badge>
                                                                            )
                                                                        case "new client":
                                                                            return (
                                                                                <Badge
                                                                                    variant="secondary"
                                                                                    className="bg-blue-500/90 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700 flex items-center gap-1 transition-colors duration-200"
                                                                                >
                                                                                    <UserCheck className="size-3.5" />
                                                                                    New Client
                                                                                </Badge>
                                                                            )
                                                                        case "non-buying":
                                                                            return (
                                                                                <Badge
                                                                                    variant="secondary"
                                                                                    className="bg-yellow-500/90 hover:bg-yellow-600 text-white dark:bg-yellow-600 dark:hover:bg-yellow-700 flex items-center gap-1 transition-colors duration-200"
                                                                                >
                                                                                    <AlertTriangle className="size-3.5" />
                                                                                    Non-Buying
                                                                                </Badge>
                                                                            )
                                                                        case "inactive":
                                                                            return (
                                                                                <Badge
                                                                                    variant="secondary"
                                                                                    className="bg-red-500/90 hover:bg-red-600 text-white dark:bg-red-600 dark:hover:bg-red-700 flex items-center gap-1 transition-colors duration-200"
                                                                                >
                                                                                    <XCircle className="size-3.5" />
                                                                                    Inactive
                                                                                </Badge>
                                                                            )
                                                                        case "on hold":
                                                                            return (
                                                                                <Badge
                                                                                    variant="secondary"
                                                                                    className="bg-stone-500/90 hover:bg-stone-600 text-white dark:bg-stone-600 dark:hover:bg-stone-700 flex items-center gap-1 transition-colors duration-200"
                                                                                >
                                                                                    <PauseCircle className="size-3.5" />
                                                                                    On Hold
                                                                                </Badge>
                                                                            )
                                                                        case "used":
                                                                            return (
                                                                                <Badge
                                                                                    variant="secondary"
                                                                                    className="bg-blue-900 hover:bg-blue-800 text-white flex items-center gap-1 transition-colors duration-200"
                                                                                >
                                                                                    <Clock className="size-3.5" />
                                                                                    Used
                                                                                </Badge>
                                                                            )
                                                                        case "for deletion":
                                                                        case "remove":
                                                                            return (
                                                                                <Badge
                                                                                    variant="secondary"
                                                                                    className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800 flex items-center gap-1 transition-colors duration-200"
                                                                                >
                                                                                    <UserX className="size-3.5" />
                                                                                    {c.status}
                                                                                </Badge>
                                                                            )
                                                                        default:
                                                                            return (
                                                                                <Badge
                                                                                    variant="outline"
                                                                                    className="text-muted-foreground hover:bg-muted transition-colors duration-200"
                                                                                >
                                                                                    {c.status}
                                                                                </Badge>
                                                                            )
                                                                    }
                                                                })()
                                                            ) : (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-muted-foreground hover:bg-muted transition-colors duration-200"
                                                                >
                                                                    —
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>{c.region}</TableCell>
                                                        <TableCell className="capitalize">
                                                            {tsaMap[c.referenceid?.trim().toLowerCase()] || c.referenceid || "-"}
                                                        </TableCell>

                                                        <TableCell>{c.tsm}</TableCell>
                                                        <TableCell>{c.manager}</TableCell>
                                                        <TableCell>{new Date(c.date_created).toLocaleDateString()}</TableCell>
                                                        <TableCell>{new Date(c.date_updated).toLocaleDateString()}</TableCell>
                                                        <TableCell>
                                                            {c.next_available_date
                                                                ? new Date(c.next_available_date).toLocaleDateString()
                                                                : "-"}
                                                        </TableCell>
                                                    </DraggableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </SortableContext>
                            </DndContext>
                        ) : (
                            <div className="py-10 text-center text-xs text-muted-foreground">
                                No customers found.
                            </div>
                        )}
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex justify-center items-center gap-4 my-4">
                    {/* Pagination */}
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPageChangeAction={setPage}
                    />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
