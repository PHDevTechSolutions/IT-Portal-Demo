const fs = require('fs');

// 1. Pagination Component
const paginationContent = `"use client"

import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PaginationProps {
  page: number
  totalPages: number
  onPageChangeAction: (newPage: number) => void
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onPageChangeAction,
}) => {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChangeAction(Math.max(1, page - 1))}
        disabled={page === 1}
        className="h-8 w-8 p-0 border-cyan-500/30 bg-slate-900/50 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 disabled:opacity-30 disabled:hover:bg-transparent rounded-none"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center gap-1 px-3 py-1 rounded border border-cyan-500/30 bg-slate-900/50">
        <span className="text-xs text-cyan-400 font-mono">{page}</span>
        <span className="text-xs text-cyan-500/50">/</span>
        <span className="text-xs text-cyan-300/60 font-mono">{totalPages}</span>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChangeAction(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="h-8 w-8 p-0 border-cyan-500/30 bg-slate-900/50 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 disabled:opacity-30 disabled:hover:bg-transparent rounded-none"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
`;

// 2. Delete Dialog
const deleteContent = `"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trash2, AlertTriangle } from "lucide-react"

interface DeleteDialogProps {
  open: boolean
  count: number
  onCancelAction: () => void
  onConfirmAction: () => void
}

export function DeleteDialog({ open, count, onCancelAction, onConfirmAction }: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancelAction}>
      <DialogContent className="bg-slate-900/95 border-red-500/30 max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <DialogTitle className="text-cyan-100 tracking-wider">SECURITY ALERT</DialogTitle>
          </div>
          <DialogDescription className="text-cyan-300/60 text-sm pt-2">
            You are about to purge <span className="text-red-400 font-bold">{count}</span> user profile{count !== 1 ? "s" : ""} from the system. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={onCancelAction}
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-none"
          >
            Abort
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirmAction}
            className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-none"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Purge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
`;

// 3. Convert Dialog
const convertContent = `"use client";

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
import { Search, Mail, ArrowRight, RotateCcw, Database } from "lucide-react";

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

const DOMAIN_OPTIONS = [
  { value: "disruptivesolutionsinc.com", label: "Disruptive Solutions Inc", badge: "DSI", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "ecoshiftcorp.com", label: "Ecoshift Corporation", badge: "ECO", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { value: "gmail.com", label: "Gmail", badge: "Gmail", color: "bg-red-500/20 text-red-400 border-red-500/30" },
];

function getDomainLabel(email: string): string {
  const domain = email.split("@")[1] ?? "";
  return DOMAIN_OPTIONS.find((d) => d.value === domain)?.label ?? domain;
}

function getLocalPart(email: string): string {
  return email.split("@")[0] ?? email;
}

export function ConvertEmailDialog({ open, onOpenChangeAction, accounts, setAccountsAction }: ConvertEmailDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetDomain, setTargetDomain] = useState("");
  const [filterDomain, setFilterDomain] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [search, setSearch] = useState("");

  const departments = useMemo(() => {
    const depts = new Set(accounts.map((a) => a.Department).filter(Boolean) as string[]);
    return ["all", ...Array.from(depts).sort()];
  }, [accounts]);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const domain = a.Email?.split("@")[1] ?? "";
      const name = (a.Firstname ?? "") + " " + (a.Lastname ?? "") + " " + (a.Email ?? "").toLowerCase();
      if (filterDomain !== "all" && domain !== filterDomain) return false;
      if (filterDept !== "all" && a.Department !== filterDept) return false;
      if (search.trim() && !name.includes(search.toLowerCase())) return false;
      return true;
    });
  }, [accounts, filterDomain, filterDept, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selectedIds.has(a._id));
  const someFilteredSelected = filtered.some((a) => selectedIds.has(a._id));

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

  const handleConvert = async () => {
    if (!targetDomain) return toast.error("Select a target domain first.");
    if (selectedIds.size === 0) return toast.error("Select at least one account.");

    const toastId = toast.loading("Converting emails...");
    try {
      const res = await fetch("/api/UserManagement/ConvertEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), targetDomain }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Conversion failed");

      setAccountsAction((prev) =>
        prev.map((acc) => {
          if (!selectedIds.has(acc._id)) return acc;
          const local = getLocalPart(acc.Email ?? "");
          return { ...acc, Email: local + "@" + targetDomain };
        }),
      );

      toast.success(selectedIds.size + " email" + (selectedIds.size > 1 ? "s" : "") + " converted.", { id: toastId });
      handleClose();
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    }
  };

  const previewEmail = (email: string) => {
    if (!targetDomain) return email;
    return getLocalPart(email) + "@" + targetDomain;
  };

  const targetOption = DOMAIN_OPTIONS.find((d) => d.value === targetDomain);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-slate-900/95 border-cyan-500/30">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <Mail className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <DialogTitle className="text-cyan-100 tracking-wider flex items-center gap-2">
                EMAIL DOMAIN CONVERSION
              </DialogTitle>
              <DialogDescription className="text-cyan-300/60 text-xs">
                Filter and select accounts to convert email domains
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-cyan-400/50" />
            <Input
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs bg-slate-900/50 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-300/40 rounded-none"
            />
          </div>

          <Select value={filterDomain} onValueChange={setFilterDomain}>
            <SelectTrigger className="w-[180px] h-9 text-xs bg-slate-900/50 border-cyan-500/30 text-cyan-100 rounded-none">
              <SelectValue placeholder="Filter by domain" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-cyan-500/30">
              <SelectItem value="all" className="text-cyan-100">All Domains</SelectItem>
              {DOMAIN_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value} className="text-cyan-100">{d.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[160px] h-9 text-xs bg-slate-900/50 border-cyan-500/30 text-cyan-100 rounded-none">
              <SelectValue placeholder="Filter by dept" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-cyan-500/30">
              {departments.map((d) => <SelectItem key={d} value={d} className="text-cyan-100">{d === "all" ? "All Departments" : d}</SelectItem>)}
            </SelectContent>
          </Select>

          {(filterDomain !== "all" || filterDept !== "all" || search) && (
            <Button variant="ghost" size="sm" className="h-9 text-xs px-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-none" onClick={resetFilters}>
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-cyan-300/50 px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500" />
            <span>
              {selectedIds.size > 0 ? <><span className="font-semibold text-cyan-100">{selectedIds.size}</span> selected</> : "Select all visible (" + filtered.length + ")"}
            </span>
          </label>
          {selectedIds.size > 0 && (
            <button type="button" className="text-[10px] uppercase font-bold text-cyan-400/70 hover:text-cyan-300 transition-colors" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          )}
        </div>

        <div className="max-h-64 overflow-y-auto border border-cyan-500/20 rounded-none divide-y divide-cyan-500/10 bg-slate-950/30">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-cyan-300/40 italic">No accounts match your filters.</p>
          ) : (
            filtered.map((acc) => {
              const selected = selectedIds.has(acc._id);
              const currentDomain = acc.Email?.split("@")[1] ?? "";
              const domainOpt = DOMAIN_OPTIONS.find((d) => d.value === currentDomain);

              return (
                <div
                  key={acc._id}
                  onClick={() => toggleOne(acc._id)}
                  className={"flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors " + (selected ? "bg-cyan-500/10" : "hover:bg-cyan-500/5")}
                >
                  <Checkbox checked={selected} onCheckedChange={() => toggleOne(acc._id)} onClick={(e) => e.stopPropagation()} className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium truncate text-cyan-100">{acc.Firstname} {acc.Lastname}</span>
                      {acc.Department && <span className="text-[9px] font-bold uppercase text-cyan-300/60 bg-cyan-500/10 px-1 py-0.5 rounded border border-cyan-500/20">{acc.Department}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-cyan-300/50 truncate">{acc.Email}</span>
                      {targetDomain && targetDomain !== currentDomain && selected && (
                        <>
                          <ArrowRight className="w-2.5 h-2.5 text-cyan-400/50 flex-shrink-0" />
                          <span className="text-[10px] text-cyan-400 font-medium truncate">{previewEmail(acc.Email ?? "")}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {domainOpt && <Badge variant="outline" className={"text-[9px] font-bold px-1.5 py-0 flex-shrink-0 " + domainOpt.color}>{domainOpt.badge}</Badge>}
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase text-cyan-400/50 tracking-wider">Convert selected to</p>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_OPTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setTargetDomain(d.value)}
                className={"flex items-center gap-2 px-3 py-2 rounded-none border text-xs font-medium transition-all " + (targetDomain === d.value ? "border-cyan-400 bg-cyan-500/10 text-cyan-300" : "border-cyan-500/30 hover:border-cyan-400/50 hover:bg-cyan-500/5 text-cyan-300/60")}
              >
                <Badge variant="outline" className={"text-[9px] font-bold px-1.5 py-0 " + d.color}>{d.badge}</Badge>
                {d.label}
                <span className="text-[9px] text-cyan-400/50">@{d.value}</span>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex-1 text-xs text-cyan-300/50 self-center">
            {selectedIds.size > 0 && targetDomain ? (
              <>
                Converting <span className="font-semibold text-cyan-100">{selectedIds.size}</span> account{selectedIds.size > 1 ? "s" : ""} to <span className="font-semibold text-cyan-100">@{targetDomain}</span>
              </>
            ) : (
              "Select accounts and target domain to proceed"
            )}
          </div>
          <Button variant="outline" onClick={handleClose} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-none">
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={selectedIds.size === 0 || !targetDomain} className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0 rounded-none">
            Convert {selectedIds.size > 0 ? "(" + selectedIds.size + ")" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
`;

// Write all files
fs.writeFileSync('components/app-pagination.tsx', paginationContent);
fs.writeFileSync('components/admin/roles/delete.tsx', deleteContent);
fs.writeFileSync('components/admin/roles/convert.tsx', convertContent);

console.log('All components updated successfully!');
";

fs.writeFileSync('fix-components.js', content);
node fix-components.js && del fix-components.js
