"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "../../components/app-sidebar";
import { Pagination } from "../../components/app-pagination";
import { toast } from "sonner";
import { Loader2, Search, Trash2, Download as DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ButtonGroup } from "@/components/ui/button-group";
import { DeleteDialog } from "../../components/app-user-accounts-delete-dialog";
import { SpinnerItem } from "../../components/app-user-accounts-download-spinner";

interface ActivityLog {
  id: string;
  browser?: string;
  date_created?: string; // formatted string
  deviceId?: string;
  email?: string;
  location?: string;
  latitude?: string | number;
  longitude?: string | number;
  os?: string;
  status?: string;
  timestamp?: string;
  userId?: string;
}

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);

  const [accounts, setAccounts] = useState<ActivityLog[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch activity logs from Firestore with Timestamp conversion
  useEffect(() => {
    const fetchAccounts = async () => {
      setIsFetching(true);
      const toastId = toast.loading("Fetching activity logs...");
      try {
        const q = query(collection(db, "activity_logs"), orderBy("date_created", "desc"));
        const querySnapshot = await getDocs(q);

        const data: ActivityLog[] = querySnapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          // Convert Firestore Timestamp to string
          const dateCreatedStr =
            d.date_created instanceof Timestamp
              ? d.date_created.toDate().toLocaleString()
              : d.date_created || "";

          return {
            id: docSnap.id,
            browser: d.browser,
            date_created: dateCreatedStr,
            deviceId: d.deviceId,
            email: d.email,
            location: d.location,
            latitude: d.latitude,
            longitude: d.longitude,
            os: d.os,
            status: d.status,
            timestamp: d.timestamp,
            userId: d.userId,
          };
        });

        setAccounts(data);
        toast.success("Activity logs loaded successfully!", { id: toastId });
      } catch (err) {
        console.error("Error fetching activity logs:", err);
        toast.error("Failed to fetch activity logs", { id: toastId });
      } finally {
        setIsFetching(false);
      }
    };

    fetchAccounts();
  }, []);

  // Filtering and sorting logic
  const filtered = useMemo(() => {
    const filteredList = accounts
      .filter((a) =>
        [a.email, a.status].some((field) => field?.toLowerCase().includes(search.toLowerCase()))
      )
      .filter((a) => (filterStatus === "all" ? true : a.status === filterStatus));

    return filteredList.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return dateB - dateA; // latest first
    });
  }, [accounts, search, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const current = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // Badge colors for status
  const getBadgeColor = (stat?: string) => {
    const colorMap: Record<string, string> = {
      login: "bg-green-100 text-green-800",
      logout: "bg-red-100 text-red-800",
    };
    if (!stat) return "bg-gray-100 text-gray-800";
    return colorMap[stat.toLowerCase()] || "bg-gray-100 text-gray-800";
  };

  // Select all / individual
  const toggleSelectAll = () => {
    if (selectedIds.size === current.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(current.map((u) => u.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  // Delete selected logs
  const confirmDelete = async () => {
    if (selectedIds.size === 0) return;

    const toastId = toast.loading("Deleting activity logs...");
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, "activity_logs", id));
      }

      setAccounts((prev) => prev.filter((a) => !selectedIds.has(a.id)));
      setSelectedIds(new Set());
      toast.success("Selected activity logs deleted.", { id: toastId });
    } catch (err) {
      console.error("Error deleting activity logs:", err);
      toast.error("Failed to delete activity logs.", { id: toastId });
    } finally {
      setShowDeleteDialog(false);
    }
  };

  // CSV Download handler
  const handleDownload = async () => {
    if (!filtered.length) {
      alert("No data available to download.");
      return;
    }

    setIsDownloading(true);

    const headers = [
      "Browser",
      "Date Created",
      "Device ID",
      "Email",
      "Location",
      "Latitude",
      "Longitude",
      "OS",
      "Status",
      "Timestamp",
      "User ID",
    ];

    const rows = filtered.map((u) => [
      u.browser || "",
      u.date_created || "",
      u.deviceId || "",
      u.email || "",
      typeof u.location === "string" ? u.location : JSON.stringify(u.location) || "",
      u.latitude?.toString() || "",
      u.longitude?.toString() || "",
      u.os || "",
      u.status || "",
      u.timestamp || "",
      u.userId || "",
    ]);

    const csvContentArray = [headers, ...rows].map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
    );

    const totalBytes = csvContentArray.reduce((acc, row) => acc + row.length, 0);

    let canceled = false;
    let currentBytes = 0;

    const toastId = toast(
      <SpinnerItem
        currentBytes={currentBytes}
        totalBytes={totalBytes}
        fileCount={filtered.length}
        onCancel={() => {
          canceled = true;
        }}
      />,
      { duration: Infinity }
    );

    try {
      const csvContentLines: string[] = [];

      for (let i = 0; i < csvContentArray.length; i++) {
        if (canceled) throw new Error("Download canceled");

        csvContentLines.push(csvContentArray[i]);
        currentBytes = csvContentLines.join("\n").length;

        toast(
          <SpinnerItem
            currentBytes={currentBytes}
            totalBytes={totalBytes}
            fileCount={filtered.length}
            onCancel={() => {
              canceled = true;
            }}
          />,
          { id: toastId, duration: Infinity }
        );

        await new Promise((res) => setTimeout(res, 5));
      }

      const csvContent = csvContentLines.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("CSV download complete!", { id: toastId });
    } catch (err) {
      if ((err as Error).message === "Download canceled") {
        toast.error("CSV download canceled.", { id: toastId });
      } else {
        toast.error("Failed to download CSV.", { id: toastId });
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar userId={userId} />
      <SidebarInset>
        {/* Header & Breadcrumb */}
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
                <BreadcrumbPage>Activity Logs</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        {/* Search + Filters + Download */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search emails or status..."
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
                disabled={!filtered.length || isDownloading}
                onClick={handleDownload}
              >
                <DownloadIcon className="w-4 h-4" /> Download
              </Button>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px] h-10 text-sm">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  {/* Add more status options if needed */}
                </SelectContent>
              </Select>

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
            </ButtonGroup>
          </div>
        </div>

        {/* Table */}
        <div className="mx-4 border border-border shadow-sm rounded-lg">
          {isFetching ? (
            <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="size-6 animate-spin" />
              <span>Loading activity logs...</span>
            </div>
          ) : current.length > 0 ? (
            <Table className="text-sm overflow-auto">
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <Checkbox checked={selectedIds.size === current.length} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Latitude</TableHead>
                  <TableHead>Longitude</TableHead>
                  <TableHead>OS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-center">
                      <Checkbox checked={selectedIds.has(log.id)} onCheckedChange={() => toggleSelect(log.id)} />
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getBadgeColor(log.status)} font-medium`}>{log.status || "—"}</Badge>
                    </TableCell>
                    <TableCell>{log.email || "—"}</TableCell>
                    <TableCell>{log.browser || "—"}</TableCell>
                    <TableCell>{log.date_created || "—"}</TableCell>
                    <TableCell>{log.deviceId || "—"}</TableCell>
                    <TableCell>{typeof log.location === "string" ? log.location : JSON.stringify(log.location) || "—"}</TableCell>
                    <TableCell>{log.latitude ?? "—"}</TableCell>
                    <TableCell>{log.longitude ?? "—"}</TableCell>
                    <TableCell>{log.os || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-10 text-center text-xs text-muted-foreground">No activity logs found.</div>
          )}
        </div>

        {/* Delete dialog */}
        <DeleteDialog
          open={showDeleteDialog}
          count={selectedIds.size}
          onCancelAction={() => setShowDeleteDialog(false)}
          onConfirmAction={confirmDelete}
        />

        {/* Pagination */}
        <div className="flex justify-center items-center gap-4 my-4">
          <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
