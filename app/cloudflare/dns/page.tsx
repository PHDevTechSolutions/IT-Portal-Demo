"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "../../components/app-sidebar";
import { Pagination } from "../../components/app-pagination";
import { toast } from "sonner";
import { Loader2, Search, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from "@/components/ui/table";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import ProtectedPageWrapper from "@/app/components/protected-page-wrapper";

// Interface for DNS record
interface DNSItem {
    id?: string;
    type?: string;
    name?: string;
    content?: string;
    ttl?: number;
    status?: string;
    lastModified?: string;
    zoneName?: string;
}

export default function DNSRecordsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);

    const [dnsData, setDnsData] = useState<DNSItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isFetching, setIsFetching] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    // Fetch DNS records
    useEffect(() => {
        const fetchDNSData = async () => {
            try {
                setIsFetching(true);
                const res = await fetch("/api/Data/Applications/Cloudflare/DNS/Fetch", {
                    method: "GET",
                    headers: { Accept: "application/json" },
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

                const json = await res.json();
                if (json.success === false) throw new Error(json.error || "Failed to load DNS data");
                if (!Array.isArray(json.data)) throw new Error("Invalid data format from server");

                setDnsData(json.data);
            } catch (err: any) {
                toast.error(`Error fetching DNS data: ${err.message}`);
                setDnsData([]);
            } finally {
                setIsFetching(false);
            }
        };

        fetchDNSData();
    }, []);

    // Filtered & sorted data
    const filteredData = useMemo(() => {
        return dnsData
            .filter((item) => {
                if (!search) return true;
                const s = search.toLowerCase();
                return (
                    item.name?.toLowerCase().includes(s) ||
                    item.zoneName?.toLowerCase().includes(s) ||
                    item.id?.toLowerCase().includes(s)
                );
            })
            .sort((a, b) => {
                const dateA = new Date(a.lastModified || "").getTime();
                const dateB = new Date(b.lastModified || "").getTime();
                return dateB - dateA; // latest first
            });
    }, [dnsData, search]);

    const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
    const current = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    // Selection handlers
    const toggleSelect = (id?: string) => {
        if (!id) return;
        setSelectedIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === current.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(current.map((i) => i.id || "")));
        }
    };

    // Copy handler
    const handleCopy = (content?: string) => {
        if (!content) {
            toast.error("Nothing to copy");
            return;
        }
        navigator.clipboard.writeText(content);
        toast.success("Content copied to clipboard");
    };

    const truncate = (text?: string, length = 10) => {
        if (!text) return "—";
        return text.length > length ? text.substring(0, length) + "..." : text;
    };

    return (
        <ProtectedPageWrapper>
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
                                    <BreadcrumbLink href="#">Cloudflare</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>DNS Records</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </header>

                    {/* Search bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Search DNS records..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8 w-full"
                            />
                            {isFetching && (
                                <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-muted-foreground" />
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="mx-4 border border-border shadow-sm rounded-lg overflow-auto">
                        {isFetching ? (
                            <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
                                <Loader2 className="size-6 animate-spin" />
                                <span>Loading DNS records...</span>
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
                                        <TableHead>ID</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Content</TableHead>
                                        <TableHead>TTL</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Last Modified</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {current.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-center">
                                                <Checkbox
                                                    checked={selectedIds.has(item.id || "")}
                                                    onCheckedChange={() => toggleSelect(item.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="whitespace-normal break-words max-w-[200px] text-[10px]">{item.id || "—"}</TableCell>
                                            <TableCell>{item.type || "—"}</TableCell>
                                            <TableCell>{item.name || "—"}</TableCell>
                                            <TableCell>{truncate(item.content)}</TableCell>
                                            <TableCell>{item.ttl ?? "—"}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        item.status?.toLowerCase() === "active"
                                                            ? "default"
                                                            : "secondary"
                                                    }
                                                >
                                                    {item.status || "—"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {item.lastModified
                                                    ? new Date(item.lastModified).toLocaleString()
                                                    : "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8"
                                                    onClick={() => handleCopy(item.content)}
                                                >
                                                    <Copy className="w-4 h-4 mr-1" />
                                                    Copy
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="py-10 text-center text-xs text-muted-foreground">
                                No DNS records found.
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-center items-center gap-4 my-4">
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            onPageChangeAction={setPage}
                        />
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    );
}
