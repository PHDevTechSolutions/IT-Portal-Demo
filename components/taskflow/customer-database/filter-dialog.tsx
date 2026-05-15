"use client";

import React from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  filterTSA,
  setFilterTSA,
  tsaList,
  filterType,
  setFilterType,
  typeOptions,
  filterStatus,
  setFilterStatus,
  statusOptions,
  rowsPerPage,
  setRowsPerPage,
  setPage,
}: FilterDialogProps) {
  const [open, setOpen] = React.useState(false);

  const hasActiveFilters =
    filterTSA !== "all" || filterType !== "all" || filterStatus !== "all";

  const handleReset = () => {
    setFilterTSA("all");
    setFilterType("all");
    setFilterStatus("all");
    setPage(1);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`bg-slate-800 border-slate-600 text-slate-300 hover:bg-cyan-500/10 hover:border-cyan-500/40 hover:text-cyan-400 rounded-none h-9 text-xs uppercase tracking-wider ${
            hasActiveFilters
              ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/5"
              : ""
          }`}
        >
          <SlidersHorizontal className="size-4 mr-1" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md bg-slate-900 border-slate-700 text-slate-100 rounded-none p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sm bg-cyan-500/10 border border-cyan-500/30">
              <SlidersHorizontal className="size-4 text-cyan-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold uppercase tracking-widest text-cyan-400">
                Filter Customers
              </DialogTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Refine your customer list
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Filter TSA */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Filter by TSA
            </label>
            <Select value={filterTSA} onValueChange={setFilterTSA}>
              <SelectTrigger className="w-full h-9 text-xs bg-slate-800 border-slate-700 text-slate-200 rounded-none focus:border-cyan-500/50 focus:ring-0">
                <SelectValue placeholder="Select TSA" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-200 rounded-none">
                {tsaList.map((t) => (
                  <SelectItem
                    key={t.value}
                    value={t.value}
                    className="text-xs capitalize focus:bg-cyan-500/10 focus:text-cyan-400"
                  >
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Type */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Filter by Type
            </label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full h-9 text-xs bg-slate-800 border-slate-700 text-slate-200 rounded-none focus:border-cyan-500/50 focus:ring-0">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-200 rounded-none">
                {typeOptions.map((t) => (
                  <SelectItem
                    key={t}
                    value={t}
                    className="text-xs capitalize focus:bg-cyan-500/10 focus:text-cyan-400"
                  >
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Status */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Filter by Status
            </label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full h-9 text-xs bg-slate-800 border-slate-700 text-slate-200 rounded-none focus:border-cyan-500/50 focus:ring-0">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-200 rounded-none">
                {statusOptions.map((s) => (
                  <SelectItem
                    key={s}
                    value={s}
                    className="text-xs capitalize focus:bg-cyan-500/10 focus:text-cyan-400"
                  >
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rows Per Page */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Rows Per Page
            </label>
            <Select
              value={rowsPerPage.toString()}
              onValueChange={(value) => {
                setRowsPerPage(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full h-9 text-xs bg-slate-800 border-slate-700 text-slate-200 rounded-none focus:border-cyan-500/50 focus:ring-0">
                <SelectValue placeholder="Rows per page" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-200 rounded-none">
                {["20", "50", "100", "1000", "12000", "30000"].map((v) => (
                  <SelectItem
                    key={v}
                    value={v}
                    className="text-xs focus:bg-cyan-500/10 focus:text-cyan-400"
                  >
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 text-xs rounded-none text-slate-500 hover:text-slate-300 hover:bg-slate-700 uppercase tracking-wider"
          >
            Reset
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-8 text-xs rounded-none text-slate-400 hover:text-slate-200 hover:bg-slate-700 uppercase tracking-wider"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setPage(1);
                setOpen(false);
              }}
              className="h-8 text-xs rounded-none bg-cyan-600 hover:bg-cyan-500 text-white border-0 px-5 uppercase tracking-wider"
            >
              Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
