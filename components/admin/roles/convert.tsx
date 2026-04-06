"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Mail, ArrowRight, RotateCcw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  _id: string;
  Email: string;
  Department?: string;
  Firstname?: string;
  Lastname?: string;
}

interface ConvertEmailDialogProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  accounts: Account[];
  setAccountsAction: React.Dispatch<React.SetStateAction<any[]>>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const DOMAIN_OPTIONS = [
  {
    value: "disruptivesolutionsinc.com",
    label: "Disruptive Solutions Inc",
    badge: "DSI",
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    value: "ecoshiftcorp.com",
    label: "Ecoshift Corporation",
    badge: "ECO",
    color: "bg-green-100 text-green-800 border-green-200",
  },
  {
    value: "gmail.com",
    label: "Gmail",
    badge: "Gmail",
    color: "bg-red-100 text-red-800 border-red-200",
  },
];

function getDomainLabel(email: string): string {
  const domain = email.split("@")[1] ?? "";
  return DOMAIN_OPTIONS.find((d) => d.value === domain)?.label ?? domain;
}

function getLocalPart(email: string): string {
  return email.split("@")[0] ?? email;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConvertEmailDialog({
  open,
  onOpenChangeAction,
  accounts,
  setAccountsAction,
}: ConvertEmailDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetDomain, setTargetDomain] = useState("");
  const [filterDomain, setFilterDomain] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [search, setSearch] = useState("");

  // ── Derived data ────────────────────────────────────────────────────────────

  const departments = useMemo(() => {
    const depts = new Set(
      accounts.map((a) => a.Department).filter(Boolean) as string[],
    );
    return ["all", ...Array.from(depts).sort()];
  }, [accounts]);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const domain = a.Email?.split("@")[1] ?? "";
      const name =
        `${a.Firstname ?? ""} ${a.Lastname ?? ""} ${a.Email ?? ""}`.toLowerCase();

      if (filterDomain !== "all" && domain !== filterDomain) return false;
      if (filterDept !== "all" && a.Department !== filterDept) return false;
      if (search.trim() && !name.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [accounts, filterDomain, filterDept, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((a) => selectedIds.has(a._id));
  const someFilteredSelected = filtered.some((a) => selectedIds.has(a._id));

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((a) => next.delete(a._id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((a) => next.add(a._id));
        return next;
      });
    }
  };

  const resetFilters = () => {
    setFilterDomain("all");
    setFilterDept("all");
    setSearch("");
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    resetFilters();
    setTargetDomain("");
    onOpenChangeAction(false);
  };

  // ── Convert ─────────────────────────────────────────────────────────────────

  const handleConvert = async () => {
    if (!targetDomain) return toast.error("Select a target domain first.");
    if (selectedIds.size === 0)
      return toast.error("Select at least one account.");

    const toastId = toast.loading("Converting emails…");
    try {
      const res = await fetch("/api/UserManagement/ConvertEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          targetDomain,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success)
        throw new Error(result.message || "Conversion failed");

      // Optimistic UI update
      setAccountsAction((prev) =>
        prev.map((acc) => {
          if (!selectedIds.has(acc._id)) return acc;
          const local = getLocalPart(acc.Email ?? "");
          return { ...acc, Email: `${local}@${targetDomain}` };
        }),
      );

      toast.success(
        `${selectedIds.size} email${selectedIds.size > 1 ? "s" : ""} converted.`,
        { id: toastId },
      );
      handleClose();
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    }
  };

  // ── Preview ─────────────────────────────────────────────────────────────────

  const previewEmail = (email: string) => {
    if (!targetDomain) return email;
    return `${getLocalPart(email)}@${targetDomain}`;
  };

  const targetOption = DOMAIN_OPTIONS.find((d) => d.value === targetDomain);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Convert Email Domains
          </DialogTitle>
          <DialogDescription>
            Filter accounts, select which ones to convert, then choose the
            target domain.
          </DialogDescription>
        </DialogHeader>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>

          {/* Domain filter */}
          <Select value={filterDomain} onValueChange={setFilterDomain}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="Filter by domain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {DOMAIN_OPTIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Department filter */}
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Filter by dept" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d === "all" ? "All Departments" : d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset */}
          {(filterDomain !== "all" || filterDept !== "all" || search) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs px-2"
              onClick={resetFilters}
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          )}
        </div>

        {/* ── Bulk header ── */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={allFilteredSelected}
              data-state={
                someFilteredSelected && !allFilteredSelected
                  ? "indeterminate"
                  : undefined
              }
              onCheckedChange={toggleAll}
            />
            <span>
              {selectedIds.size > 0 ? (
                <>
                  <span className="font-semibold text-foreground">
                    {selectedIds.size}
                  </span>{" "}
                  selected
                </>
              ) : (
                `Select all visible (${filtered.length})`
              )}
            </span>
          </label>
          {selectedIds.size > 0 && (
            <button
              type="button"
              className="text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Account list ── */}
        <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground italic">
              No accounts match your filters.
            </p>
          ) : (
            filtered.map((acc) => {
              const selected = selectedIds.has(acc._id);
              const currentDomain = acc.Email?.split("@")[1] ?? "";
              const domainOpt = DOMAIN_OPTIONS.find(
                (d) => d.value === currentDomain,
              );

              return (
                <div
                  key={acc._id}
                  onClick={() => toggleOne(acc._id)}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                    selected ? "bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => toggleOne(acc._id)}
                    onClick={(e) => e.stopPropagation()}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium truncate">
                        {acc.Firstname} {acc.Lastname}
                      </span>
                      {acc.Department && (
                        <span className="text-[9px] font-bold uppercase text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          {acc.Department}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground truncate">
                        {acc.Email}
                      </span>
                      {targetDomain &&
                        targetDomain !== currentDomain &&
                        selected && (
                          <>
                            <ArrowRight className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-[10px] text-primary font-medium truncate">
                              {previewEmail(acc.Email ?? "")}
                            </span>
                          </>
                        )}
                    </div>
                  </div>

                  {domainOpt && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-bold px-1.5 py-0 flex-shrink-0 ${domainOpt.color}`}
                    >
                      {domainOpt.badge}
                    </Badge>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Target domain selector ── */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">
            Convert selected to
          </p>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_OPTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setTargetDomain(d.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all ${
                  targetDomain === d.value
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border hover:border-primary/40 hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <Badge
                  variant="outline"
                  className={`text-[9px] font-bold px-1.5 py-0 ${d.color}`}
                >
                  {d.badge}
                </Badge>
                {d.label}
                <span className="text-[9px] text-muted-foreground">
                  @{d.value}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex-1 text-xs text-muted-foreground self-center">
            {selectedIds.size > 0 && targetDomain ? (
              <>
                Converting{" "}
                <span className="font-semibold text-foreground">
                  {selectedIds.size}
                </span>{" "}
                account{selectedIds.size > 1 ? "s" : ""} →{" "}
                <span className="font-semibold text-foreground">
                  @{targetDomain}
                </span>
              </>
            ) : (
              "Select accounts and a target domain to proceed."
            )}
          </div>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={selectedIds.size === 0 || !targetDomain}
          >
            Convert {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
