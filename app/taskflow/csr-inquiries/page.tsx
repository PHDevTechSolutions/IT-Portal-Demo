"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "../../components/app-sidebar";
import { toast } from "sonner";
import { Loader2, Search, Edit as EditIcon, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Pagination } from "../../components/app-pagination";
import { Separator } from "@/components/ui/separator";
import type { DateRange } from "react-day-picker";
import { Calendar23 } from "../../components/app-activity-daterange";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

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
    const [fetchActivityData, setFetchActivityData] = useState<any[]>([]);
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

    // Row height, dapat consistent sa lahat ng tables (adjust kung iba)
    const rowHeight = 70; // middle section badge row height, adjust kung needed

    // State para sa selected row index
    const [selectedRow, setSelectedRow] = useState<number | null>(null);

    // Scroll function para i-sync scrollTop ng 3 divs base sa row index
    const scrollToRow = (index: number) => {
        const scrollPos = index * rowHeight;
        if (leftRef.current) leftRef.current.scrollTop = scrollPos;
        if (middleRef.current) middleRef.current.scrollTop = scrollPos;
        if (rightRef.current) rightRef.current.scrollTop = scrollPos;
    };

    // Fetch CSR Inquiries
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

    // Fetch Ecodesk Ticket Activity
    const fetchActivity = async () => {
        try {
            const response = await fetch("/api/Data/Applications/Ecodesk/Tickets/FetchActivity");
            const data = await response.json();
            setFetchActivityData(data || []);
        } catch (error) {
            toast.error("Error fetching Ecodesk Activity.");
            console.error("Error fetching Ecodesk Activity:", error);
        }
    };

    // Fetch user accounts
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
        fetchActivity();
        fetchAccounts();
    }, []);

    // Filtering + Pagination for CSR Inquiries
    const filtered = useMemo(() => {
        return activities
            .filter((a) => {
                if (search && !Object.values(a).join(" ").toLowerCase().includes(search.toLowerCase()))
                    return false;
                if (dateRange?.from || dateRange?.to) {
                    if (!a.date_created) return false;
                    const created = new Date(a.date_created);
                    if (dateRange.from && created < dateRange.from) return false;
                    if (dateRange.to && created > dateRange.to) return false;
                }
                if (filterStatus && a.status !== filterStatus) return false;
                if (filterTypeClient && a.typeclient !== filterTypeClient) return false;
                return true;
            })
            .sort((a, b) => new Date(b.date_created ?? 0).getTime() - new Date(a.date_created ?? 0).getTime());
    }, [activities, search, dateRange, filterStatus, filterTypeClient]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
    const current = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    // Build a map for quick lookup of Ecodesk tickets by normalized ticket reference number
    const ecoMap = useMemo(() => {
        const map = new Map<string, any>();
        fetchActivityData.forEach((d) => {
            const key = (
                d.TicketReferenceNumber ||
                d.ticketreferencenumber ||
                ""
            ).toString().trim().toLowerCase();
            if (key) map.set(key, d);
        });
        return map;
    }, [fetchActivityData]);

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

    const openEditDialog = (activity: Inquiries) => {
        setEditingActivity(activity);
        setShowEditDialog(true);
    };

    const closeEditDialog = () => {
        setEditingActivity(null);
        setShowEditDialog(false);
    };

    // Scroll syncing refs and handlers
    const leftRef = useRef<HTMLDivElement>(null);
    const middleRef = useRef<HTMLDivElement>(null);
    const rightRef = useRef<HTMLDivElement>(null);

    // Sync vertical scroll between the 3 containers
    const onScroll = (source: "left" | "middle" | "right") => {
        return (e: React.UIEvent<HTMLDivElement>) => {
            const scrollTop = e.currentTarget.scrollTop;
            if (source !== "left" && leftRef.current && e.currentTarget !== leftRef.current) {
                leftRef.current.scrollTop = scrollTop;
            }
            if (source !== "middle" && middleRef.current && e.currentTarget !== middleRef.current) {
                middleRef.current.scrollTop = scrollTop;
            }
            if (source !== "right" && rightRef.current && e.currentTarget !== rightRef.current) {
                rightRef.current.scrollTop = scrollTop;
            }
        };
    };

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

                {/* Search + Filter */}
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
                        <Button size="icon" variant="outline" onClick={() => setShowFilterDialog(true)}>
                            <Filter className="size-4" />
                        </Button>

                        <Calendar23
                            range={range}
                            onRangeChange={(newRange) => {
                                setRange(newRange);
                                setDateRange(newRange);
                            }}
                        />
                        <Button size="sm" variant="outline" onClick={resetFilters}>
                            Clear
                        </Button>

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

                {/* === THREE TABLES SIDE BY SIDE WITH SCROLL SYNC === */}
                <div
                    className="grid gap-4 px-4 pb-4"
                    style={{
                        minHeight: 600,
                        gridTemplateColumns: "45% 10% 45%", // Left 45%, Middle 10%, Right 45%
                    }}
                >
                    {/* Left Table - Ecodesk Activity */}
                    <div
                        className="border border-border shadow-sm rounded-lg overflow-hidden"
                        ref={leftRef}
                        onScroll={onScroll("left")}
                        style={{ maxHeight: 600, overflowY: "auto" }}
                    >
                        <div className="bg-muted px-3 py-2 text-xs font-semibold">Ecodesk Ticket Activity</div>
                        <Table className="w-full text-xs">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ticket Reference #</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {current.map((act, idx) => {
                                    // Normalize key for lookup
                                    const key = (act.ticketreferencenumber || act.TicketReferenceNumber || "")
                                        .toString()
                                        .trim()
                                        .toLowerCase();

                                    // Get the corresponding Ecodesk data from the map
                                    const eco = ecoMap.get(key);

                                    if (!eco) {
                                        return (
                                            <TableRow key={`eco-empty-${act.id}`}>
                                                <TableCell colSpan={9} className="text-left text-red-600">
                                                    No Ecodesk data
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }

                                    // Use composite key to ensure uniqueness (TicketReferenceNumber + ReferenceID + index)
                                    return (
                                        <TableRow key={`eco-${eco.TicketReferenceNumber}-${eco.ReferenceID}-${idx}`}>
                                            <Accordion type="single" collapsible>
                                                <AccordionItem value="item-1">
                                                    <AccordionTrigger>
                                                        <TableCell>{eco.TicketReferenceNumber || eco.ticketreferencenumber || "N/A"}</TableCell>
                                                    </AccordionTrigger>
                                                    <AccordionContent>
                                                        <div className="px-2 py-1 space-y-1 text-xs">
                                                            <p><strong>Reference ID:</strong> {eco.ReferenceID}</p>
                                                            <p><strong>Company:</strong> {eco.CompanyName}</p>
                                                            <p><strong>Customer:</strong> {eco.CustomerName}</p>
                                                            <p><strong>Contact:</strong> {eco.ContactNumber}</p>
                                                            <p><strong>Email:</strong> {eco.Email}</p>
                                                            <p><strong>City:</strong> {eco.CityAddress}</p>
                                                            <p><strong>WrapUp:</strong> {eco.WrapUp}</p>
                                                            <p className="max-w-[240px] whitespace-normal break-words">
                                                                <strong>Inquiries:</strong> {eco.Inquiries}
                                                            </p>
                                                            <p><strong>Ticket Endorsed:</strong>{eco.TicketEndorsed ? new Date(eco.TicketEndorsed).toLocaleString() : "N/A"}</p>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Accordion>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    <div
                        className="shadow-sm rounded-lg overflow-hidden flex flex-col"
                        ref={middleRef}
                        onScroll={onScroll("middle")}
                        style={{ maxHeight: 600, overflowY: "auto" }} // no border here
                    >
                        <div className="bg-muted px-3 py-2 text-xs font-semibold text-center">Status</div>
                        <Table className="w-full text-xs">
                            <TableHead></TableHead>
                            <TableBody>
                                {current.map((act) => {
                                    const key = (act.ticketreferencenumber || act.TicketReferenceNumber || "")
                                        .toString()
                                        .trim()
                                        .toLowerCase();
                                    const matched = ecoMap.has(key);
                                    return (
                                        <TableRow key={`status-${act.id}`} className="text-center" style={{ height: 70 }}>
                                            {/* Removed invalid nested TableRow */}
                                            <TableCell className="relative flex items-center justify-center px-0">
                                                
                                                {/* Badge */}
                                                {matched ? (
                                                    <Badge className="z-10 bg-green-600 px-4">Transferred</Badge>
                                                ) : (
                                                    <Badge variant="destructive" className="z-10 px-4">
                                                        Invalid Transfer
                                                    </Badge>
                                                )}

                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>


                    {/* Right Table - CSR Inquiries */}
                    <div
                        className="border border-border shadow-sm rounded-lg overflow-hidden"
                        ref={rightRef}
                        onScroll={onScroll("right")}
                        style={{ maxHeight: 600, overflowY: "auto" }}
                    >
                        <div className="bg-muted px-3 py-2 text-xs font-semibold">CSR Inquiries</div>
                        <Table className="w-full text-xs">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10 text-center">
                                        <Checkbox
                                            checked={selectedIds.size === current.length && current.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>Ticket Reference #</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {current.map((act) => {
                                    const key = (act.ticketreferencenumber || act.TicketReferenceNumber || "").toString().trim().toLowerCase();
                                    const matched = ecoMap.has(key);
                                    return (
                                        <TableRow
                                            key={`csr-${act.id}`}
                                            className={
                                                !matched
                                                    ? "bg-red-500 text-white hover:bg-white hover:text-black"
                                                    : "hover:bg-white hover:text-black"
                                            }
                                            style={{ height: 48 }}
                                        >

                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Checkbox
                                                        checked={selectedIds.has(act.id)}
                                                        onCheckedChange={() => toggleSelect(act.id)}
                                                    />
                                                    <Button variant="outline" size="icon" onClick={() => openEditDialog(act)}>
                                                        <EditIcon className="size-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <Accordion type="single" collapsible>
                                                <AccordionItem value="item-1">
                                                    <AccordionTrigger>
                                                        <TableCell>{act.ticketreferencenumber || act.TicketReferenceNumber || "N/A"}</TableCell>
                                                    </AccordionTrigger>
                                                    <AccordionContent>
                                                        <div className="px-2 py-1 space-y-1 text-xs">
                                                            <strong>{act.companyname || "N/A"}</strong>
                                                            <br />
                                                            Contact: {act.contactperson} / {act.contactnumber}
                                                            <br />
                                                            Email: {act.emailaddress}
                                                            <br />
                                                            WrapUp: {act.wrapup}
                                                            <br />
                                                            <span className="text-muted-foreground">Inquiries: {act.inquiries}</span>
                                                            <br />
                                                            <Badge className="text-[8px] capitalize">{act.status || "N/A"}</Badge>
                                                            <br />
                                                            Created: {act.date_created ? new Date(act.date_created).toLocaleString() : "N/A"}
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Accordion>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex justify-center items-center gap-4 my-4">
                    <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />
                </div>

                {/* Dialogs */}
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
