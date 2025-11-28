"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "../../components/app-sidebar"
import { Pagination } from "../../components/app-pagination"
import { Calendar } from "../../components/app-customer-database-calendar";
import { DeleteDialog } from "../../components/app-customer-database-delete-dialog"
import { ApproveDialog } from "../../components/app-customer-database-approval-dialog"
import { FilterDialog } from "../../components/app-customer-database-filter-dialog"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { BadgeCheck, AlertTriangle, Clock, XCircle, PauseCircle, UserX, UserCheck, ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Search, Trash } from "lucide-react";
import { DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

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
            .filter((c) => c.status === "Transferred" || c.status === "Pending")
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
            const res = await fetch(`/api/Data/Applications/Taskflow/CustomerDatabase/BulkEditStatus`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userIds: Array.from(selectedIds),
                    status: "Active",
                }),
            });

            const result = await res.json();

            if (result.success) {
                // Update local customers state to reflect new status
                setCustomers((prev) =>
                    prev.map((c) =>
                        selectedIds.has(c.id) ? { ...c, status: "Active", date_updated: new Date().toISOString() } : c
                    )
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
                                <BreadcrumbPage>Approval of Pending and Transfer Accounts</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>

                {/* 🔍 Search + Filters */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">

                    {/* 🔎 Search Input (left side, grow full width on mobile, fixed max-width on desktop) */}
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search customers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 pr-8 w-full"
                        />
                        {isFiltering && (
                            <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                    </div>

                    {/* 🧩 Right-Side Buttons (icon-only, grouped, inline-flex with gap) */}
                    <div className="flex items-center gap-2">
                        {/* Calendar Button (icon only) */}
                        <Calendar startDate={startDate} endDate={endDate} setStartDateAction={setStartDate} setEndDateAction={setEndDate} />

                        {/* Delete Button (only show if there are selected items) */}
                        {selectedIds.size > 0 && (
                            <>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="p-2 rounded-md"
                                    aria-label={`Delete Selected (${selectedIds.size})`}
                                    onClick={handleBulkDelete}
                                >
                                    <Trash className="h-5 w-5" />
                                </Button>

                                {/* Approve Button */}
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="p-2 rounded-md"
                                    aria-label={`Approve Selected (${selectedIds.size})`}
                                    onClick={() => setShowApproveDialog(true)}
                                >
                                    Approve
                                </Button>
                            </>
                        )}

                        {/* Filter Toggle Button (icon only) */}
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
                        // optionally pass the icon button as trigger if you want
                        />

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

                {/* Table */}
                <div className="mx-4 border border-border shadow-sm rounded-lg">
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
                                                        <TableCell
                                                            className={`uppercase whitespace-normal break-words max-w-[250px] ${isDuplicate ? "bg-red-100" : isMissingType || isMissingStatus ? "bg-yellow-100" : ""
                                                                }`}
                                                        >
                                                            {c.company_name}
                                                        </TableCell>
                                                        <TableCell className="capitalize whitespace-normal break-words max-w-[200px]">
                                                            {c.contact_person}
                                                        </TableCell>
                                                        <TableCell className="whitespace-normal break-words max-w-[250px]">
                                                            {c.email_address}
                                                        </TableCell>
                                                        <TableCell className={isMissingType ? "bg-yellow-100" : ""}>
                                                            {c.type_client || "—"}
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
