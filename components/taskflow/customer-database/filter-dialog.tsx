"use client";

import React from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FilterDialogProps {
  filterTSA: string;
  setFilterTSA: (value: string) => void;
  tsaList: { value: string; label: string }[];
  filterType: string;
  setFilterType: (value: string) => void;
  typeOptions: string[];
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  statusOptions: string[];
  rowsPerPage: number;
  setRowsPerPage: (value: number) => void;
  setPage: (page: number) => void;
}

export function FilterDialog({
  filterTSA, setFilterTSA, tsaList,
  filterType, setFilterType, typeOptions,
  filterStatus, setFilterStatus, statusOptions,
  rowsPerPage, setRowsPerPage, setPage,
}: FilterDialogProps) {
  const [open, setOpen] = React.useState(false);

  const hasActiveFilters = filterTSA !== "all" || filterType !== "all" || filterStatus !== "all";

  const handleReset = () => {
    setFilterTSA("all");
    setFilterType("all");
    setFilterStatus("all");
    setPage(1);
  };

  const selectCls = "w-full h-9 text-xs font-mono bg-[#0d1117] border-slate-800 text-slate-200 rounded-none focus:border-orange-500/50 focus:ring-0";
  const contentCls = "bg-slate-800 border-slate-700 text-slate-200 rounded-none";
  const itemCls = "text-xs font-mono focus:bg-orange-500/10 focus:text-orange-400";
  const labelCls = "text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/50";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 h-9 px-3 text-[10px] font-mono uppercase tracking-widest border transition-colors",
            hasActiveFilters
              ? "border-orange-500/40 bg-orange-500/5 text-orange-400"
              : "border-slate-800 bg-[#0d1117] text-slate-400 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300",
          )}
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]" />
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md bg-[#0d1117] border-orange-500/20 text-slate-100 rounded-none p-0 gap-0">

        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 border border-orange-500/20">
              <SlidersHorizontal className="size-4 text-orange-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold uppercase tracking-widest font-mono text-orange-400">
                Filter Customers
              </DialogTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">Refine your customer list</p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* TSA */}
          <div className="space-y-1.5">
            <label className={labelCls}>Filter by TSA</label>
            <Select value={filterTSA} onValueChange={setFilterTSA}>
              <SelectTrigger className={selectCls}><SelectValue placeholder="Select TSA" /></SelectTrigger>
              <SelectContent className={contentCls}>
                {tsaList.map((t) => (
                  <SelectItem key={t.value} value={t.value} className={cn(itemCls, "capitalize")}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className={labelCls}>Filter by Type</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className={selectCls}><SelectValue placeholder="Select Type" /></SelectTrigger>
              <SelectContent className={contentCls}>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t} className={cn(itemCls, "capitalize")}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className={labelCls}>Filter by Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className={selectCls}><SelectValue placeholder="Select Status" /></SelectTrigger>
              <SelectContent className={contentCls}>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s} className={cn(itemCls, "capitalize")}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rows per page */}
          <div className="space-y-1.5">
            <label className={labelCls}>Rows Per Page</label>
            <Select value={rowsPerPage.toString()} onValueChange={(v) => { setRowsPerPage(Number(v)); setPage(1); }}>
              <SelectTrigger className={selectCls}><SelectValue placeholder="Rows per page" /></SelectTrigger>
              <SelectContent className={contentCls}>
                {["20", "50", "100", "1000", "12000", "30000"].map((v) => (
                  <SelectItem key={v} value={v} className={itemCls}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-between gap-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-slate-700 text-slate-500 hover:border-orange-500/30 hover:text-orange-400 transition-colors"
          >
            <RotateCcw className="size-3" /> Reset
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { setPage(1); setOpen(false); }}
              className="px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-orange-500/30 bg-orange-600 text-white hover:bg-orange-500 transition-colors"
            >
              Apply
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
