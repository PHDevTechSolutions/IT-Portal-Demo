"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    GitMerge,
    RefreshCw,
    ShieldAlert,
    Trash2,
    Users,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import {
    loadAuditResult,
    AUDIT_STORAGE_KEY,
    DuplicateGroupCard,
    type DuplicateGroup,
    type Customer,
    type PersistedAuditResult,
} from "@/components/taskflow/customer-database/audit-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "all" | "same-tsa" | "cross-tsa" | "missing-type" | "missing-status";

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
    label,
    count,
    icon,
    active,
    onClick,
    colorClass,
}: {
    label: string;
    count: number;
    icon: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
    colorClass: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "rounded-xl border px-5 py-4 flex items-center gap-4 text-left transition-all w-full",
                "hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "ring-2 ring-primary shadow-sm" : "",
                colorClass
            )}
        >
            <div className="shrink-0">{icon}</div>
            <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                    {label}
                </div>
                <div className="text-2xl font-bold tabular-nums leading-tight">{count}</div>
            </div>
        </button>
    );
}

// ─── Missing-issue card ───────────────────────────────────────────────────────

function MissingIssueCard({
    title,
    customers,
    onFixAll,
    isFixing,
}: {
    title: string;
    customers: Customer[];
    onFixAll: () => void;
    isFixing: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? customers : customers.slice(0, 5);

    return (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200 dark:border-amber-800/60">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                        <AlertTriangle className="size-4 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{title}</p>
                        <p className="text-[11px] text-muted-foreground">{customers.length} records</p>
                    </div>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onFixAll}
                    disabled={isFixing || customers.length === 0}
                    className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50 text-[12px]"
                >
                    {isFixing ? "Fixing..." : "Fix All"}
                </Button>
            </div>

            {/* Rows */}
            <div className="divide-y divide-amber-200 dark:divide-amber-800/40">
                {visible.map((c, i) => (
                    <div
                        key={c.id}
                        className="px-5 py-3 flex items-center justify-between gap-4 text-[12px] hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
                    >
                        <div className="min-w-0">
                            <p className="font-semibold uppercase truncate">{c.company_name}</p>
                            <p className="text-muted-foreground truncate">
                                {c.contact_person || "—"} · {c.email_address || "—"}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {c.type_client && (
                                <Badge variant="outline" className="text-[10px]">{c.type_client}</Badge>
                            )}
                            {c.status && (
                                <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                            )}
                            <span className="font-mono text-[10px] text-muted-foreground">
                                #{i + 1}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Show more/less */}
            {customers.length > 5 && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="w-full px-5 py-2.5 text-[12px] text-muted-foreground hover:bg-amber-100/60 dark:hover:bg-amber-900/30 flex items-center justify-center gap-1.5 transition-colors border-t border-amber-200 dark:border-amber-800/40"
                >
                    {expanded ? (
                        <><ChevronUp className="size-3.5" /> Show less</>
                    ) : (
                        <><ChevronDown className="size-3.5" /> Show {customers.length - 5} more</>
                    )}
                </button>
            )}
        </div>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onGoBack }: { onGoBack: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-32 gap-5 text-center px-4">
            <div className="size-20 rounded-2xl bg-muted flex items-center justify-center">
                <ShieldAlert className="size-9 text-muted-foreground" />
            </div>
            <div className="space-y-2 max-w-xs">
                <h2 className="text-base font-semibold">No audit data found</h2>
                <p className="text-sm text-muted-foreground">
                    Run an audit from the Customer Database to flag duplicate and
                    incomplete records for review.
                </p>
            </div>
            <Button onClick={onGoBack} variant="outline" className="gap-2">
                ← Go to Customer Database
            </Button>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomerAuditsPage() {
    const router = useRouter();

    const [data, setData] = useState<PersistedAuditResult | null>(null);
    const [tab, setTab] = useState<Tab>("all");
    const [isFixingType, setIsFixingType] = useState(false);
    const [isFixingStatus, setIsFixingStatus] = useState(false);
    const [resolvedGroupIds, setResolvedGroupIds] = useState<Set<string>>(new Set());

    // Load from localStorage on mount
    useEffect(() => {
        const stored = loadAuditResult();
        setData(stored);
    }, []);

    if (!data) {
        return (
            <ProtectedPageWrapper>
                <SidebarProvider>
                    <AppSidebar />
                    <SidebarInset>
                        <Header router={router} auditedAt={undefined} onClear={() => { }} />
                        <EmptyState onGoBack={() => router.push("/taskflow/customer-database")} />
                    </SidebarInset>
                </SidebarProvider>
            </ProtectedPageWrapper>
        );
    }

    const {
        auditedAt,
        duplicateGroups,
        missingType,
        missingStatus,
    } = data;

    const duplicateIds = new Set(data.duplicateIds);
    const sameTsaGroups = duplicateGroups.filter((g) => g.type === "same-tsa");
    const crossTsaGroups = duplicateGroups.filter((g) => g.type === "cross-tsa");
    const visibleGroups = duplicateGroups.filter((g) => !resolvedGroupIds.has(g.id));

    const totalDupRecords = duplicateIds.size;
    const totalIssues = totalDupRecords + missingType.length + missingStatus.length;

    // ── Tab filtering ─────────────────────────────────────────────────────────

    const groupsForTab: DuplicateGroup[] = (() => {
        if (tab === "same-tsa") return visibleGroups.filter((g) => g.type === "same-tsa");
        if (tab === "cross-tsa") return visibleGroups.filter((g) => g.type === "cross-tsa");
        return visibleGroups;
    })();

    const showMissingType = tab === "all" || tab === "missing-type";
    const showMissingStatus = tab === "all" || tab === "missing-status";
    const showDuplicates = tab === "all" || tab === "same-tsa" || tab === "cross-tsa";

    // ── Fix all missing type ──────────────────────────────────────────────────

    const handleFixAllType = async () => {
        const ids = missingType.map((c) => c.id);
        if (!ids.length) return;
        setIsFixingType(true);
        try {
            const res = await fetch(
                "/api/Data/Applications/Taskflow/CustomerDatabase/BulkEditTypeClient",
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIds: ids, type_client: "TSA Client" }),
                }
            );
            const json = await res.json();
            if (json.success) {
                toast.success(`Updated type for ${ids.length} customer(s).`);
                setData((prev) =>
                    prev ? { ...prev, missingType: [] } : prev
                );
            } else {
                toast.error(json.error || "Failed to update type.");
            }
        } catch {
            toast.error("Something went wrong.");
        } finally {
            setIsFixingType(false);
        }
    };

    // ── Fix all missing status ────────────────────────────────────────────────

    const handleFixAllStatus = async () => {
        const ids = missingStatus.map((c) => c.id);
        if (!ids.length) return;
        setIsFixingStatus(true);
        try {
            const res = await fetch(
                "/api/Data/Applications/Taskflow/CustomerDatabase/BulkEditStatus",
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIds: ids, status: "Active" }),
                }
            );
            const json = await res.json();
            if (json.success) {
                toast.success(`Updated status for ${ids.length} customer(s).`);
                setData((prev) =>
                    prev ? { ...prev, missingStatus: [] } : prev
                );
            } else {
                toast.error(json.error || "Failed to update status.");
            }
        } catch {
            toast.error("Something went wrong.");
        } finally {
            setIsFixingStatus(false);
        }
    };

    // ── Dismiss a duplicate group ─────────────────────────────────────────────

    const handleDismissGroup = (groupId: string) => {
        setResolvedGroupIds((prev) => new Set([...prev, groupId]));
        toast.success("Group dismissed.");
    };

    // ── Clear audit data ──────────────────────────────────────────────────────

    const handleClear = () => {
        localStorage.removeItem(AUDIT_STORAGE_KEY);
        setData(null);
        toast.info("Audit data cleared.");
    };

    const remainingIssues =
        visibleGroups.reduce((s, g) => s + g.customers.length, 0) +
        (data.missingType?.length ?? 0) +
        (data.missingStatus?.length ?? 0);

    return (
        <ProtectedPageWrapper>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <Header router={router} auditedAt={auditedAt} onClear={handleClear} />

                    {/* ── Stats row ── */}
                    <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <StatCard
                            label="All Issues"
                            count={remainingIssues}
                            icon={<ShieldAlert className="size-6 text-zinc-500" />}
                            active={tab === "all"}
                            onClick={() => setTab("all")}
                            colorClass="bg-muted/60 border-border"
                        />
                        <StatCard
                            label="Same-TSA Dups"
                            count={sameTsaGroups.filter((g) => !resolvedGroupIds.has(g.id)).length}
                            icon={<Users className="size-6 text-red-500" />}
                            active={tab === "same-tsa"}
                            onClick={() => setTab("same-tsa")}
                            colorClass="bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                        />
                        <StatCard
                            label="Cross-TSA Dups"
                            count={crossTsaGroups.filter((g) => !resolvedGroupIds.has(g.id)).length}
                            icon={<GitMerge className="size-6 text-orange-500" />}
                            active={tab === "cross-tsa"}
                            onClick={() => setTab("cross-tsa")}
                            colorClass="bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800"
                        />
                        <StatCard
                            label="Missing Type"
                            count={data.missingType?.length ?? 0}
                            icon={<AlertTriangle className="size-6 text-amber-500" />}
                            active={tab === "missing-type"}
                            onClick={() => setTab("missing-type")}
                            colorClass="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                        />
                        <StatCard
                            label="Missing Status"
                            count={data.missingStatus?.length ?? 0}
                            icon={<XCircle className="size-6 text-amber-400" />}
                            active={tab === "missing-status"}
                            onClick={() => setTab("missing-status")}
                            colorClass="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                        />
                    </div>

                    {/* ── All-clear ── */}
                    {remainingIssues === 0 && (
                        <div className="mx-4 mb-4 rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 px-6 py-5 flex items-center gap-4">
                            <CheckCircle2 className="size-8 text-emerald-500 shrink-0" />
                            <div>
                                <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                                    All issues resolved!
                                </p>
                                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                                    The customer database is clean. You can clear this audit or run a new one.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Content ── */}
                    <ScrollArea className="flex-1 px-4 pb-8">
                        <div className="space-y-4 max-w-4xl">

                            {/* ── Duplicate group cards ── */}
                            {showDuplicates && groupsForTab.length > 0 && (
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2 pt-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                            Duplicate Groups ({groupsForTab.length})
                                        </p>
                                        <Separator className="flex-1" />
                                    </div>
                                    {groupsForTab.map((g) => (
                                        <DuplicateGroupWithActions
                                            key={g.id}
                                            group={g}
                                            onDismiss={() => handleDismissGroup(g.id)}
                                        />
                                    ))}
                                </section>
                            )}

                            {/* ── Missing Type ── */}
                            {showMissingType && (data.missingType?.length ?? 0) > 0 && (
                                <section className="space-y-3">
                                    {(showDuplicates && groupsForTab.length > 0) && (
                                        <Separator />
                                    )}
                                    <div className="flex items-center gap-2 pt-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                            Missing Type ({data.missingType.length})
                                        </p>
                                        <Separator className="flex-1" />
                                    </div>
                                    <MissingIssueCard
                                        title="Customers Missing type_client"
                                        customers={data.missingType}
                                        onFixAll={handleFixAllType}
                                        isFixing={isFixingType}
                                    />
                                </section>
                            )}

                            {/* ── Missing Status ── */}
                            {showMissingStatus && (data.missingStatus?.length ?? 0) > 0 && (
                                <section className="space-y-3">
                                    {(showMissingType && (data.missingType?.length ?? 0) > 0) && (
                                        <Separator />
                                    )}
                                    <div className="flex items-center gap-2 pt-1">
                                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                            Missing Status ({data.missingStatus.length})
                                        </p>
                                        <Separator className="flex-1" />
                                    </div>
                                    <MissingIssueCard
                                        title="Customers Missing status"
                                        customers={data.missingStatus}
                                        onFixAll={handleFixAllStatus}
                                        isFixing={isFixingStatus}
                                    />
                                </section>
                            )}

                            {/* ── Empty tab state ── */}
                            {!showDuplicates || (groupsForTab.length === 0 &&
                                !showMissingType &&
                                !showMissingStatus) ? (
                                ((tab !== "all" as Tab) &&
                                    groupsForTab.length === 0 &&
                                    (data.missingType?.length ?? 0) === 0 &&
                                    (data.missingStatus?.length ?? 0) === 0) && (
                                    <div className="py-16 text-center text-sm text-muted-foreground">
                                        No issues in this category.
                                    </div>
                                )
                            ) : null}

                        </div>
                    </ScrollArea>
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    );
}

// ─── Duplicate group card wrapper with dismiss action ─────────────────────────

function DuplicateGroupWithActions({
    group,
    onDismiss,
}: {
    group: DuplicateGroup;
    onDismiss: () => void;
}) {
    return (
        <div className="relative group">
            <DuplicateGroupCard group={group} />
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-background/80"
                    onClick={onDismiss}
                >
                    <CheckCircle2 className="size-3.5 mr-1" /> Dismiss
                </Button>
            </div>
        </div>
    );
}

// ─── Shared header ────────────────────────────────────────────────────────────

function Header({
    router,
    auditedAt,
    onClear,
}: {
    router: ReturnType<typeof useRouter>;
    auditedAt?: string;
    onClear: () => void;
}) {
    const formatted = auditedAt
        ? new Date(auditedAt).toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
        })
        : null;

    return (
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b">
            <SidebarTrigger className="-ml-1" />
            <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard")}
            >
                Home
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                router.push("/taskflow/customer-database");
                            }}
                        >
                            Taskflow
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                router.push("/taskflow/customer-database");
                            }}
                        >
                            Customer Database
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Customer Audits</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="ml-auto flex items-center gap-3">
                {formatted && (
                    <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground border rounded-full px-3 py-1">
                        <RefreshCw className="size-3" />
                        Last audit: {formatted}
                    </span>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
                    onClick={onClear}
                >
                    <Trash2 className="size-3.5" /> Clear Audit
                </Button>
            </div>
        </header>
    );
}