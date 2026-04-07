"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Pagination } from "@/components/app-pagination";
import { toast } from "sonner";
import {
  Search,
  ArrowRight,
  RefreshCw,
  Trash2,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: number;
  account_reference_number: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  delivery_address?: string;
  region: string;
  province?: string;
  city?: string;
  type_client: string;
  type?: string;
  referenceid: string;
  tsm: string;
  manager: string;
  status: string;
  remarks: string;
  industry?: string;
  gender?: string;
  company_group?: string;
  date_created: string;
  date_updated: string;
  next_available_date?: string;
  date_transferred?: string;
  date_approved?: string;
  date_removed?: string;
  transfer_to?: string;
}

interface UserRecord {
  referenceId: string;
  name: string;
  status: string;
}

// ─── Safe JSON ────────────────────────────────────────────────────────────────

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(
      `[safeJson] Non-JSON (HTTP ${res.status}) from ${res.url}\n`,
      text.slice(0, 300),
    );
    return null;
  }
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string | null }) {
  const s = (status ?? "").trim().toLowerCase();
  if (!s)
    return (
      <Badge variant="outline" className="text-muted-foreground">
        —
      </Badge>
    );
  if (s === "active")
    return (
      <Badge
        variant="secondary"
        className="bg-green-500/90 hover:bg-green-600 text-white flex items-center gap-1"
      >
        Active
      </Badge>
    );
  if (s === "terminated")
    return (
      <Badge
        variant="secondary"
        className="bg-red-500/90 hover:bg-red-600 text-white flex items-center gap-1"
      >
        <UserX className="size-3.5" /> Terminated
      </Badge>
    );
  if (s === "resigned")
    return (
      <Badge
        variant="secondary"
        className="bg-orange-500/90 hover:bg-orange-600 text-white flex items-center gap-1"
      >
        <UserX className="size-3.5" /> Resigned
      </Badge>
    );
  if (s === "inactive")
    return (
      <Badge
        variant="secondary"
        className="bg-gray-500/90 hover:bg-gray-600 text-white flex items-center gap-1"
      >
        Inactive
      </Badge>
    );
  if (s === "for deletion" || s === "remove")
    return (
      <Badge
        variant="secondary"
        className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1"
      >
        <Trash2 className="size-3.5" /> {status}
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {status}
    </Badge>
  );
}

export default function RemovalAccountsPage() {
  const router = useRouter();

  // ── State ────────────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTSA, setFilterTSA] = useState("all");
  const [filterTSM, setFilterTSM] = useState("all");
  const [filterManager, setFilterManager] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // ── ReferenceID → user record map ─────────────────────────────────────────────
  const [refIdUserMap, setRefIdUserMap] = useState<Map<string, UserRecord>>(
    new Map(),
  );

  // ── Selection state ─────────────────────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // ── Fetch customers (non-Active only) ──────────────────────────────────────
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/FetchNonActive"
        );
        const result = await safeJson(res);
        
        // Data is already filtered by the API
        const customers = result?.data ?? [];
        setCustomers(customers);
      } catch (err) {
        console.error("Failed to fetch customers:", err);
        toast.error("Failed to fetch removal accounts");
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  // ── Filtered data ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return customers
      .filter((c) =>
        [
          c.company_name,
          c.account_reference_number,
          c.contact_person,
          c.email_address,
          c.region,
          c.manager,
          c.tsm,
        ].some((field) => field?.toLowerCase().includes(search.toLowerCase())),
      )
      .filter((c) =>
        filterType === "all" ? true : c.type_client === filterType,
      )
      .filter((c) =>
        filterStatus === "all" ? true : c.status?.toLowerCase() === filterStatus.toLowerCase(),
      )
      .filter((c) =>
        filterTSA === "all"
          ? true
          : c.referenceid?.trim().toLowerCase() === filterTSA.trim().toLowerCase(),
      )
      .filter((c) =>
        filterTSM === "all"
          ? true
          : (c.tsm ?? "").trim().toLowerCase() === filterTSM.trim().toLowerCase(),
      )
      .filter((c) =>
        filterManager === "all"
          ? true
          : (c.manager ?? "").trim().toLowerCase() === filterManager.trim().toLowerCase(),
      )
      .sort((a, b) => {
        const dateA = new Date(a.date_created).getTime();
        const dateB = new Date(b.date_created).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });
  }, [customers, search, filterType, filterStatus, filterTSA, filterTSM, filterManager, sortOrder]);

  // ── Derived options ───────────────────────────────────────────────────────────
  const typeOptions = useMemo(() => {
    const types = [...new Set(customers.map((c) => c.type_client).filter(Boolean))].sort();
    return ["all", ...types];
  }, [customers]);

  const statusOptions = useMemo(() => {
    const statuses = [...new Set(customers.map((c) => c.status).filter(Boolean))].sort();
    return ["all", ...statuses];
  }, [customers]);

  const filterTsaOptions = useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    for (const c of customers) {
      const key = (c.referenceid ?? "").trim();
      if (!key || seen.has(key.toLowerCase())) continue;
      const user = refIdUserMap.get(key.toLowerCase());
      seen.set(key.toLowerCase(), {
        value: key,
        label: user?.name || key,
      });
    }
    return [
      { value: "all", label: "All TSA" },
      ...Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [customers, refIdUserMap]);

  const filterTsmOptions = useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    for (const c of customers) {
      const key = (c.tsm ?? "").trim();
      if (!key || seen.has(key.toLowerCase())) continue;
      const user = refIdUserMap.get(key.toLowerCase());
      seen.set(key.toLowerCase(), {
        value: key,
        label: user?.name || key,
      });
    }
    return [
      { value: "all", label: "All TSM" },
      ...Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [customers, refIdUserMap]);

  const filterManagerOptions = useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    for (const c of customers) {
      const key = (c.manager ?? "").trim();
      if (!key || seen.has(key.toLowerCase())) continue;
      const user = refIdUserMap.get(key.toLowerCase());
      seen.set(key.toLowerCase(), {
        value: key,
        label: user?.name || key,
      });
    }
    return [
      { value: "all", label: "All Manager" },
      ...Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [customers, refIdUserMap]);

  // ── Pagination ───────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const current = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const totalCount = filtered.length;

  // ── Selection handlers ──────────────────────────────────────────────────────
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(current.map((c) => c.id)));
    }
    setSelectAll(!selectAll);
  };

  // ── Bulk delete ──────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const result = await safeJson(res);
      if (result?.success) {
        toast.success(`${selectedIds.size} accounts permanently deleted`);
        setCustomers((prev) => prev.filter((c) => !selectedIds.has(c.id)));
        setSelectedIds(new Set());
        setSelectAll(false);
        setShowDeleteDialog(false);
      } else {
        toast.error(result?.error || "Delete failed");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  // ── Reset pagination on filter change ─────────────────────────────────────────
  useEffect(() => {
    setPage(1);
  }, [search, filterType, filterStatus, filterTSA, filterTSM, filterManager]);

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header */}
          <header className="flex h-auto min-h-[56px] shrink-0 items-center gap-2 px-2 md:px-4 py-2 flex-wrap">
            <SidebarTrigger className="-ml-1 touch-button" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
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
                  <BreadcrumbPage>Removal Accounts</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          <main className="p-6 md:p-10 space-y-6">
            {/* Page heading */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Removal Accounts
                </h2>
                <p className="text-sm text-muted-foreground">
                  Manage inactive, terminated, and removed customer accounts
                  {!loading && (
                    <>
                      {" — "}
                      <span className="font-semibold text-foreground">
                        {filtered.length}
                      </span>{" "}
                      accounts
                    </>
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search accounts..."
                      className="pl-9 h-9 text-xs"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  {/* Status Filter */}
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[150px] h-9 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s === "all" ? "All Status" : s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Type Filter */}
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[150px] h-9 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t === "all" ? "All Types" : t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* TSA Filter */}
                  <Select value={filterTSA} onValueChange={setFilterTSA}>
                    <SelectTrigger className="w-[180px] h-9 text-xs">
                      <SelectValue placeholder="TSA" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterTsaOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* TSM Filter */}
                  <Select value={filterTSM} onValueChange={setFilterTSM}>
                    <SelectTrigger className="w-[180px] h-9 text-xs">
                      <SelectValue placeholder="TSM" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterTsmOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Manager Filter */}
                  <Select value={filterManager} onValueChange={setFilterManager}>
                    <SelectTrigger className="w-[180px] h-9 text-xs">
                      <SelectValue placeholder="Manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterManagerOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Permanently
                </Button>
              </div>
            )}

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            checked={selectAll}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300"
                          />
                        </TableHead>
                        <TableHead>Ref #</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>TSA</TableHead>
                        <TableHead>TSM</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead>Date Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mt-2">Loading...</p>
                          </TableCell>
                        </TableRow>
                      ) : current.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8">
                            <p className="text-sm text-muted-foreground">No removal accounts found</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        current.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(c.id)}
                                onChange={() => toggleSelection(c.id)}
                                className="rounded border-gray-300"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {c.account_reference_number || "—"}
                            </TableCell>
                            <TableCell className="font-medium">{c.company_name}</TableCell>
                            <TableCell>{c.contact_person || "—"}</TableCell>
                            <TableCell className="text-xs">{c.email_address || "—"}</TableCell>
                            <TableCell>
                              <StatusBadge status={c.status} />
                            </TableCell>
                            <TableCell>{c.type_client || "—"}</TableCell>
                            <TableCell className="text-xs">
                              {refIdUserMap.get(c.referenceid?.toLowerCase())?.name || c.referenceid || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {refIdUserMap.get(c.tsm?.toLowerCase())?.name || c.tsm || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {refIdUserMap.get(c.manager?.toLowerCase())?.name || c.manager || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {new Date(c.date_created).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChangeAction={setPage}
                  />
                </div>
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Permanent Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {selectedIds.size} account(s)?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedPageWrapper>
  );
}
