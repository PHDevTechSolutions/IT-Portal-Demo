"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Copy, ShieldAlert } from "lucide-react";
import { Pagination } from "@/components/app-pagination";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { PageShell } from "@/components/page-shell";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  account_reference_number: string;
  company_name: string;
  contact_person: string;
  referenceid: string;
  [key: string]: unknown;
}

interface UserRecord {
  referenceId: string;
  name: string;
  status: string;
}

interface DuplicateGroup {
  ref: string;
  accounts: Account[];
}

const ROWS_PER_PAGE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DataCheckingPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refIdUserMap, setRefIdUserMap] = useState<Map<string, UserRecord>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ── Fetch accounts then resolve user names ─────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // 1. Fetch accounts
        const res = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/Fetch",
          { cache: "no-store" },
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error ?? "Failed to fetch accounts.");
          return;
        }
        const fetchedAccounts: Account[] = json.data ?? [];
        setAccounts(fetchedAccounts);

        // 2. Collect unique referenceids
        const uniqueIds = new Set(
          fetchedAccounts
            .map((a) => (a.referenceid ?? "").trim().toLowerCase())
            .filter(Boolean),
        );

        // 3. Fetch users and build id → name map
        const userRes = await fetch("/api/UserManagement/Fetch");
        if (!userRes.ok) return;
        const userData = await safeJson(userRes);
        const users: any[] = Array.isArray(userData)
          ? userData
          : (userData?.data ?? []);

        const map = new Map<string, UserRecord>();
        for (const u of users) {
          const refId = (u.ReferenceID ?? "").trim();
          if (!refId) continue;
          const key = refId.toLowerCase();
          if (uniqueIds.has(key)) {
            map.set(key, {
              referenceId: refId,
              name: `${u.Firstname ?? ""} ${u.Lastname ?? ""}`.trim() || refId,
              status: u.Status ?? "",
            });
          }
        }
        setRefIdUserMap(map);
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // ── Resolve referenceid → display name ────────────────────────────────────
  const resolveName = (referenceid: string): string => {
    const key = (referenceid ?? "").trim().toLowerCase();
    return refIdUserMap.get(key)?.name ?? referenceid ?? "—";
  };

  // ── Group duplicates ───────────────────────────────────────────────────────
  const duplicateGroups = useMemo<DuplicateGroup[]>(() => {
    const map = new Map<string, Account[]>();
    for (const account of accounts) {
      const ref = (account.account_reference_number ?? "").trim();
      if (!ref) continue;
      if (!map.has(ref)) map.set(ref, []);
      map.get(ref)!.push(account);
    }
    return Array.from(map.entries())
      .filter(([, group]) => group.length >= 2)
      .map(([ref, accs]) => ({ ref, accounts: accs }))
      .sort((a, b) => b.accounts.length - a.accounts.length);
  }, [accounts]);

  // ── Search filter ──────────────────────────────────────────────────────────
  const filtered = useMemo<DuplicateGroup[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return duplicateGroups;
    return duplicateGroups.filter(
      (g) =>
        g.ref.toLowerCase().includes(q) ||
        g.accounts.some(
          (a) =>
            a.company_name?.toLowerCase().includes(q) ||
            a.contact_person?.toLowerCase().includes(q) ||
            resolveName(a.referenceid).toLowerCase().includes(q) ||
            (a.referenceid ?? "").toLowerCase().includes(q),
        ),
    );
  }, [duplicateGroups, search, refIdUserMap]);

  // Reset to page 1 on search change
  useEffect(() => {
    setPage(1);
  }, [search]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated = filtered.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE,
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <PageShell
          breadcrumbs={[
            { label: "Taskflow", href: "/taskflow/customer-database" },
            { label: "Data Checking" },
          ]}
          title="Data Checking"
          subtitle="DUPLICATES · VALIDATION · INTEGRITY"
          icon={<ShieldAlert className="w-4 h-4 text-orange-400" />}
          statusItems={["Duplicate Scan"]}
        >
            {isLoading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-slate-500 text-xs font-mono">
                <Loader2 className="size-4 animate-spin text-orange-500" />
                <span className="uppercase tracking-widest">Loading accounts…</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-20 text-red-400 text-xs font-mono uppercase tracking-widest">
                {error}
              </div>
            ) : (
              <div className="flex flex-col px-4 sm:px-6 py-4 gap-3">

                {/* ── Toolbar ── */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-600" />
                      <Input
                        placeholder="Search ref no., company, or agent…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-7 h-8 w-64 text-xs rounded-none bg-[#0d1117] border-slate-800 text-slate-300 placeholder:text-slate-700 focus-visible:ring-orange-500/30 focus-visible:border-orange-500/40 font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className="text-[10px] px-2 py-0.5 rounded-none bg-orange-500/10 text-orange-400 border border-orange-500/30 font-mono">
                        {filtered.length} group{filtered.length !== 1 ? "s" : ""}
                      </Badge>
                      <Badge className="text-[10px] px-2 py-0.5 rounded-none bg-red-500/10 text-red-400 border border-red-500/30 font-mono">
                        {filtered.reduce((sum, g) => sum + g.accounts.length, 0)} dupes
                      </Badge>
                    </div>
                  </div>
                  <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />
                </div>

                {/* ── Table ── */}
                <div className="overflow-auto border border-slate-800/60">
                  {filtered.length === 0 ? (
                    <div className="flex items-center justify-center py-16 text-slate-700 text-xs font-mono uppercase tracking-widest">
                      {accounts.length === 0 ? "No records found." : "No duplicate account reference numbers detected."}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-800 bg-[#0d1117]/80 hover:bg-[#0d1117]/80">
                          <TableHead className="w-10 text-center text-[10px] uppercase tracking-widest text-slate-600 font-mono">#</TableHead>
                          <TableHead className="w-48 text-[10px] uppercase tracking-widest text-slate-600 font-mono">Account Ref. No.</TableHead>
                          <TableHead className="w-16 text-center text-[10px] uppercase tracking-widest text-slate-600 font-mono">Count</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-widest text-slate-600 font-mono">Company Name</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-widest text-slate-600 font-mono">Contact Person</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-widest text-slate-600 font-mono">Agent</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginated.map((group, groupIdx) =>
                          group.accounts.map((account, rowIdx) => (
                            <TableRow
                              key={`${group.ref}-${rowIdx}`}
                              className={`text-xs border-slate-800/40 hover:bg-orange-500/5 transition-colors ${rowIdx === 0 ? "border-t-2 border-t-orange-500/20" : ""}`}
                            >
                              <TableCell className="text-center text-slate-700 font-mono text-[10px]">
                                {rowIdx === 0 ? (page - 1) * ROWS_PER_PAGE + groupIdx + 1 : ""}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {rowIdx === 0 ? (
                                  <div className="flex items-center gap-1.5 text-orange-300">
                                    <Copy className="h-3 w-3 text-orange-500/50 shrink-0" />
                                    <span>{group.ref || <span className="italic text-slate-700">—</span>}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-700 pl-4">↳</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {rowIdx === 0 ? (
                                  <Badge className="text-[10px] px-1.5 py-0 rounded-none bg-red-500/10 text-red-400 border border-red-500/30 font-mono">
                                    {group.accounts.length}×
                                  </Badge>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-slate-300 font-mono text-[11px]">
                                {account.company_name || <span className="text-slate-700 italic">—</span>}
                              </TableCell>
                              <TableCell className="text-slate-400 font-mono text-[11px]">
                                {account.contact_person || <span className="text-slate-700 italic">—</span>}
                              </TableCell>
                              <TableCell>
                                {account.referenceid ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-orange-300 font-mono text-[11px] uppercase">{resolveName(account.referenceid)}</span>
                                    <span className="text-[10px] text-slate-700 font-mono">{account.referenceid}</span>
                                  </div>
                                ) : <span className="text-slate-700 italic">—</span>}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* ── Pagination bottom ── */}
                <div className="flex justify-end">
                  <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />
                </div>
              </div>
            )}
        </PageShell>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
