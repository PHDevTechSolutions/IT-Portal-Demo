"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "../../components/app-sidebar"
import { Pagination } from "../../components/app-pagination"
import { toast } from "sonner"
import { Loader2, Search, ArrowUpDown, Trash2, Pencil, Repeat2, Plus, ArrowRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ButtonGroup } from "@/components/ui/button-group"
import { DeleteDialog } from "../../components/app-user-accounts-delete-dialog"
import { CreateDialog } from "../../components/app-user-accounts-create-dialog"
import { EditDialog } from "../../components/app-user-accounts-edit-dialog"
import { TransferDialog } from "../../components/app-user-accounts-transfer-dialog"
import { ConvertEmailDialog } from "../../components/app-user-accounts-convert-dialog"
import { SpinnerItem } from "../../components/app-user-accounts-download-spinner"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";

const statusColors: Record<string, string> = {
    active: "bg-green-500 text-white",
    terminated: "bg-red-600 text-white",
    resigned: "bg-red-600 text-white",
    "do not disturb": "bg-black text-white",
    locked: "bg-gray-500 text-white",
};

interface UserAccount {
    _id: string
    ReferenceID: string
    TSM: string
    Manager: string
    Location: string
    Firstname: string
    Lastname: string
    Email: string
    Department: string
    Company: string
    Position: string
    Role: string
    Password?: string
    Status: string
    TargetQuota: string
    profilePicture?: string
    Directories?: string[]
}

type SortKey = keyof Pick<UserAccount, "Firstname" | "Lastname" | "Email" | "Department" | "Company" | "Position">

export default function AccountPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [userId] = useState<string | null>(searchParams?.get("userId") ?? null)

    const [accounts, setAccounts] = useState<UserAccount[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isFetching, setIsFetching] = useState(false)
    const [search, setSearch] = useState("")
    const [filterDepartment, setFilterDepartment] = useState("all")
    const [filterCompany, setFilterCompany] = useState("all")
    const [page, setPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(20)
    const [sortKey, setSortKey] = useState<SortKey>("Firstname")
    const [sortAsc, setSortAsc] = useState(true)

    // Dialogs
    const [showEditDialog, setShowEditDialog] = useState(false)
    const [editData, setEditData] = useState<UserAccount | null>(null)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)

    // State for create user
    const [showCreateDialog, setShowCreateDialog] = useState(false)

    // 🔹 Manager & TSM lists
    const [managers, setManagers] = useState<{ label: string; value: string }[]>([])
    const [tsms, setTsms] = useState<{ label: string; value: string }[]>([])

    const [showTransferDialog, setShowTransferDialog] = useState(false)
    const [transferType, setTransferType] = useState<"TSM" | "Manager" | null>(null)
    const [transferSelection, setTransferSelection] = useState<string>("")

    const [showConvertDialog, setShowConvertDialog] = useState(false)

    const [isDownloading, setIsDownloading] = useState(false)
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedDirectories, setSelectedDirectories] = useState<string[]>([]);

    const handleDownload = async () => {
        if (filtered.length === 0) return;
        setIsDownloading(true);

        let currentBytes = 0;
        const totalBytes = filtered.reduce((acc, u) => {
            return (
                acc +
                [
                    u.ReferenceID,
                    u.Firstname,
                    u.Lastname,
                    u.Email,
                    u.Department,
                    u.Company,
                    u.Position,
                    u.TSM,
                    u.Manager,
                    u.Status
                ]
                    .map(v => (v?.length || 0) + 3)
                    .reduce((a, b) => a + b, 0)
            );
        }, 0);

        // ✅ Toast spinner setup
        const toastId = toast(
            () => (
                <SpinnerItem
                    currentBytes={currentBytes}
                    totalBytes={totalBytes}
                    fileCount={filtered.length}
                    onCancel={() => {
                        toast.dismiss(toastId);
                        setIsDownloading(false);
                    }}
                />
            ),
            { duration: Infinity }
        );

        try {
            // ✅ Add new headers here
            const csvHeader = [
                "ReferenceID",
                "Firstname",
                "Lastname",
                "Email",
                "Department",
                "Company",
                "Position",
                "TSM",
                "Manager",
                "Status"
            ].join(",");

            // ✅ Map user data to match new header order
            const csvRows = filtered.map(u =>
                [
                    u.ReferenceID,
                    u.Firstname,
                    u.Lastname,
                    u.Email,
                    u.Department,
                    u.Company,
                    u.Position,
                    u.TSM,
                    u.Manager,
                    u.Status
                ]
                    .map(v => `"${v || ""}"`)
                    .join(",")
            );

            const csvContent = [csvHeader, ...csvRows].join("\n");

            // simulate download progress
            const blob = new Blob([csvContent], { type: "text/csv" });
            const reader = new FileReader();
            reader.onload = () => {
                currentBytes = (reader.result as string).length;
            };
            reader.readAsText(blob);

            await new Promise(resolve => setTimeout(resolve, 500)); // spinner delay

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `user_accounts_page_${page}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success("CSV download started!", { id: toastId });
        } catch (err) {
            toast.error("Failed to download CSV", { id: toastId });
        } finally {
            setIsDownloading(false);
        }
    };

    useEffect(() => {
        if (!showTransferDialog) return
        if (filterDepartment !== "Sales") return

        const fetchDropdowns = async () => {
            try {
                const [managerRes, tsmRes] = await Promise.all([
                    fetch("/api/UserManagement/FetchManager?Role=Manager"),
                    fetch("/api/UserManagement/FetchTSM?Role=Territory Sales Manager")
                ])
                const managerData = await managerRes.json()
                const tsmData = await tsmRes.json()

                setManagers(managerData.map((m: any) => ({
                    label: `${m.Firstname} ${m.Lastname}`,
                    value: m.ReferenceID
                })))

                setTsms(tsmData.map((t: any) => ({
                    label: `${t.Firstname} ${t.Lastname}`,
                    value: t.ReferenceID
                })))
            } catch (err) {
                console.error("Error fetching managers or TSMs:", err)
                toast.error("Failed to fetch manager/TSM lists.")
            }
        }

        fetchDropdowns()
    }, [showTransferDialog, filterDepartment])

    // 🔹 Fetch user accounts
    useEffect(() => {
        const fetchAccounts = async () => {
            setIsFetching(true)
            const toastId = toast.loading("Fetching user accounts...")
            try {
                const res = await fetch("/api/UserManagement/Fetch")
                const data = await res.json()
                setAccounts(data || [])
                toast.success("User accounts loaded successfully!", { id: toastId })
            } catch (err) {
                console.error("Error fetching:", err)
                toast.error("Failed to fetch accounts", { id: toastId })
            } finally {
                setIsFetching(false)
            }
        }
        fetchAccounts()
    }, [])

    // 🔹 Filter options
    const departmentOptions = useMemo(
        () => ["all", ...new Set(accounts.map(a => a.Department).filter(Boolean))],
        [accounts]
    )

    const companyOptions = useMemo(
        () => ["all", ...new Set(accounts.map(a => a.Company).filter(Boolean))],
        [accounts]
    )

    // 🔹 Filter and sort logic
    const filtered = useMemo(() => {
        const list = accounts
            .filter(a =>
                [a.Firstname, a.Lastname, a.Email, a.Department, a.Company, a.Position]
                    .some(f => f?.toLowerCase().includes(search.toLowerCase()))
            )
            .filter(a => (filterDepartment === "all" ? true : a.Department === filterDepartment))
            .filter(a => (filterCompany === "all" ? true : a.Company === filterCompany))

        return [...list].sort((a, b) => {
            const valA = (a[sortKey] || "").toString().toLowerCase()
            const valB = (b[sortKey] || "").toString().toLowerCase()
            if (valA < valB) return sortAsc ? -1 : 1
            if (valA > valB) return sortAsc ? 1 : -1
            return 0
        })
    }, [accounts, search, filterDepartment, filterCompany, sortKey, sortAsc])

    const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
    const current = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage)

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(!sortAsc)
        else {
            setSortKey(key)
            setSortAsc(true)
        }
    }

    const getBadgeColor = (dept: string) => {
        const colorMap: Record<string, string> = {
            IT: "bg-blue-100 text-blue-800",
            HR: "bg-green-100 text-green-800",
            Finance: "bg-yellow-100 text-yellow-800",
            Marketing: "bg-pink-100 text-pink-800",
            Sales: "bg-purple-100 text-purple-800",
            "Dev-Team": "bg-black text-yellow-400",
        }
        return colorMap[dept] || "bg-gray-100 text-gray-800"
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === current.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(current.map(u => u._id)))
    }

    const openDirectoryDialog = (directories: string[] = []) => {
        setSelectedDirectories(directories);
        setOpenDialog(true);
    };


    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const copy = new Set(prev)
            if (copy.has(id)) copy.delete(id)
            else copy.add(id)
            return copy
        })
    }

    const confirmDelete = async () => {
        const toastId = toast.loading("Deleting accounts...")
        try {
            const res = await fetch("/api/UserManagement/UserDelete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            })
            const result = await res.json()
            if (!res.ok || !result.success) throw new Error("Delete failed")

            setAccounts(prev => prev.filter(a => !selectedIds.has(a._id)))
            setSelectedIds(new Set())
            toast.success("Selected accounts deleted successfully.", { id: toastId })
        } catch (err) {
            toast.error("Error deleting accounts.", { id: toastId })
        } finally {
            setShowDeleteDialog(false)
        }
    }

    const handleEdit = (user: UserAccount) => {
        // Create a copy of the user object
        const userCopy = { ...user };

        // Remove the Password field from the copy
        delete userCopy.Password;

        setEditData(userCopy) // This is the corrected line
        setShowEditDialog(true)
    }

    const handleSaveEdit = async () => {
        if (!editData) {
            toast.error("No user selected for editing.")
            return
        }

        const toastId = toast.loading("Updating account...")

        try {
            const res = await fetch("/api/UserManagement/UserUpdate", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editData._id,
                    ...editData,
                }),
            })

            const result = await res.json()
            if (!res.ok || !result.success) throw new Error(result.message || "Update failed")

            // Update local state
            setAccounts(prev =>
                prev.map(a => (a._id === editData._id ? { ...a, ...editData } : a))
            )

            toast.success("User updated successfully!", { id: toastId })
            setShowEditDialog(false)
        } catch (err) {
            toast.error((err as Error).message, { id: toastId })
        }
    }

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
                                <BreadcrumbLink href="#">Admin</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>User Accounts</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>

                {/* Filters + Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 w-full"
                        />
                        {isFetching && <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-muted-foreground" />}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        <ButtonGroup>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 text-sm"
                                onClick={() => setShowConvertDialog(true)}
                            >
                                <Repeat2 className="w-4 h-4" /> Convert Emails
                            </Button>

                            <ConvertEmailDialog
                                open={showConvertDialog}
                                onOpenChangeAction={setShowConvertDialog}
                                accounts={accounts}
                                setAccountsAction={setAccounts}
                            />

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 text-sm"
                                disabled={filtered.length === 0 || isDownloading}
                                onClick={handleDownload}
                            >
                                <Download className="w-4 h-4" /> Download
                            </Button>

                            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                                <SelectTrigger className="w-[200px] h-10 text-sm">
                                    <SelectValue placeholder="Filter by Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departmentOptions.map(d => (
                                        <SelectItem key={d} value={d}>
                                            {d === "all" ? "All Departments" : d}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={filterCompany} onValueChange={setFilterCompany}>
                                <SelectTrigger className="w-[200px] h-10 text-sm">
                                    <SelectValue placeholder="Filter by Company" />
                                </SelectTrigger>
                                <SelectContent>
                                    {companyOptions.map(c => (
                                        <SelectItem key={c} value={c}>
                                            {c === "all" ? "All Companies" : c}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {filterDepartment === "Sales" && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-10 text-sm"
                                        disabled={selectedIds.size === 0}
                                        onClick={() => {
                                            setTransferType("TSM");
                                            setShowTransferDialog(true);
                                        }}
                                    >
                                        <ArrowRight className="w-4 h-4" /> Transfer to TSM
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-10 text-sm"
                                        disabled={selectedIds.size === 0}
                                        onClick={() => {
                                            setTransferType("Manager");
                                            setShowTransferDialog(true);
                                        }}
                                    >
                                        <ArrowRight className="w-4 h-4" /> Transfer to Manager
                                    </Button>
                                </>
                            )}

                            <Button
                                variant="default"
                                size="sm"
                                className="h-10 text-sm"
                                onClick={() => setShowCreateDialog(true)}
                            >
                                <Plus className="w-4 h-4" /> Create
                            </Button>

                            {selectedIds.size > 0 && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-10 text-sm flex items-center gap-1"
                                    onClick={() => setShowDeleteDialog(true)}
                                >
                                    <Trash2 className="w-4 h-4" /> Delete {selectedIds.size}
                                </Button>
                            )}

                            <TransferDialog
                                open={showTransferDialog}
                                onOpenChangeAction={setShowTransferDialog}
                                transferType={transferType}
                                transferSelection={transferSelection}
                                setTransferSelectionAction={setTransferSelection}
                                selectedIds={selectedIds}
                                setSelectedIdsAction={setSelectedIds}
                                setAccountsAction={setAccounts}
                                tsms={tsms}
                                managers={managers}
                            />
                        </ButtonGroup>
                    </div>
                </div>

                {/* Table */}
                <div className="mx-4 border border-border shadow-sm rounded-lg overflow-auto">
                    {isFetching ? (
                        <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
                            <Loader2 className="size-6 animate-spin" />
                            <span>Loading accounts...</span>
                        </div>
                    ) : current.length > 0 ? (
                        <Table className="text-sm whitespace-nowrap">
                            <TableHeader className="bg-muted sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-10 text-center">
                                        <Checkbox
                                            checked={selectedIds.size === current.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>Profile</TableHead>
                                    {["Fullname", "Email", "Department", "Company", "Position", "Status"].map((key) => (
                                        <TableHead
                                            key={key}
                                            onClick={() => handleSort(key as SortKey)}
                                            className="cursor-pointer select-none"
                                        >
                                            <div className="flex items-center gap-1">
                                                {key}
                                                <ArrowUpDown
                                                    className={`size-4 transition-transform ${sortKey === key ? "text-primary" : "text-muted-foreground"}`}
                                                />
                                            </div>
                                        </TableHead>
                                    ))}
                                    {/* New header for Directory Access */}
                                    <TableHead>Directory Access</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {current.map(u => (
                                    <React.Fragment key={u._id}>
                                        <TableRow>
                                            <TableCell className="text-center">
                                                <Checkbox
                                                    checked={selectedIds.has(u._id)}
                                                    onCheckedChange={() => toggleSelect(u._id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {u.profilePicture ? (
                                                    <img src={u.profilePicture} alt="profile" className="w-10 h-10 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                                                        N/A
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="capitalize">{u.Firstname}, {u.Lastname}</TableCell>
                                            <TableCell>{u.Email}<br /><span className="text-[10px] italic">{u.ReferenceID}</span></TableCell>
                                            <TableCell>
                                                <Badge className={`${getBadgeColor(
                                                    (u.Position === "Guest" ||
                                                        u.Position === "Senior Fullstack Developer" ||
                                                        u.Position === "IT - OJT")
                                                        ? "Dev-Team"
                                                        : u.Department
                                                )} font-medium`}>
                                                    {(u.Position === "Guest" ||
                                                        u.Position === "Senior Fullstack Developer" ||
                                                        u.Position === "IT - OJT")
                                                        ? "Dev Team"
                                                        : (u.Department || "—")}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{u.Company || "—"}<br />{u.Location || "—"}</TableCell>
                                            <TableCell>{u.Position || "—"}<br />{u.Role === "Territory Sales Associate" && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    TQ: {u.TargetQuota || "—"}<br />
                                                    TSM: {u.TSM || "—"}<br />
                                                    Manager: {u.Manager || "—"}
                                                </div>
                                            )}</TableCell>
                                            <TableCell className="capitalize">
                                                <Badge className={statusColors[u.Status.toLowerCase()] || "bg-gray-300"}>
                                                    {u.Status}
                                                </Badge>
                                            </TableCell>

                                            {/* New Directory Access cell */}
                                            <TableCell className="text-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openDirectoryDialog(u.Directories || [])}
                                                >
                                                    View Directory Access ({u.Directories?.length || 0})
                                                </Button>

                                            </TableCell>

                                            <TableCell>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEdit(u)}
                                                    disabled={u.Position === "Senior Fullstack Developer" || u.Position === "IT - OJT"}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="py-10 text-center text-xs text-muted-foreground">No user found.</div>
                    )}
                </div>

                {/* Expandable row for directories */}
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                    <DialogContent className="sm:max-w-lg max-w-[90vw]">
                        <DialogHeader>
                            <DialogTitle className="mb-2">Directory Access</DialogTitle>
                            <DialogDescription>
                                {selectedDirectories.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 max-h-60 overflow-auto">
                                        {selectedDirectories.map((dir, idx) => (
                                            <li key={idx}>{dir}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm italic text-muted-foreground">
                                        No directory access assigned.
                                    </p>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button onClick={() => setOpenDialog(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <EditDialog
                    open={showEditDialog}
                    onOpenChangeAction={setShowEditDialog}
                    editData={editData}
                    setEditDataAction={setEditData}
                    onSaveAction={handleSaveEdit}
                />

                {/* Create User Dialog */}
                <CreateDialog
                    open={showCreateDialog}
                    onOpenChangeAction={setShowCreateDialog}
                    setAccountsAction={setAccounts}
                />

                <DeleteDialog
                    open={showDeleteDialog}
                    count={selectedIds.size}
                    onCancelAction={() => setShowDeleteDialog(false)}
                    onConfirmAction={confirmDelete}
                />

                <div className="flex justify-center items-center gap-4 my-4">
                    <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
