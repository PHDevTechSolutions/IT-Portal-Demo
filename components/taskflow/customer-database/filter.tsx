"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Statuses that are considered "inactive" for badge display purposes
const INACTIVE_STATUSES = ["Terminated", "Resigned", "Inactive"]

interface TsaOption {
  label: string
  value: string
  /** Raw Status field from MongoDB user document — optional for backwards-compat */
  status?: string
}

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  filterTSA: string
  setFilterTSA: (val: string) => void
  filterType: string
  setFilterType: (val: string) => void
  filterStatus: string
  setFilterStatus: (val: string) => void
  rowsPerPage: number
  setRowsPerPage: (val: number) => void
  tsaList: TsaOption[]
  typeOptions: string[]
  statusOptions: string[]

  sortOrder: "asc" | "desc"
  setSortOrder: (val: "asc" | "desc") => void

  onClose: () => void
}

export function FilterDialog({
  open,
  onOpenChange,
  filterTSA,
  setFilterTSA,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  rowsPerPage,
  setRowsPerPage,
  tsaList,
  typeOptions,
  statusOptions,
  sortOrder,
  setSortOrder,
  onClose,
}: FilterDialogProps) {

  // Split into active and inactive groups for visual separation
  const activeTsas = tsaList.filter(t => t.value === "all" || !INACTIVE_STATUSES.includes(t.status ?? ""))
  const inactiveTsas = tsaList.filter(t => t.value !== "all" && INACTIVE_STATUSES.includes(t.status ?? ""))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Filter Options</DialogTitle>
          <DialogDescription>
            Use the filters below to narrow down the customer list.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* ── TSA Filter ── */}
          <Select value={filterTSA} onValueChange={setFilterTSA}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by TSA" />
            </SelectTrigger>
            <SelectContent className="capitalize">
              {/* Active / "All" items */}
              {activeTsas.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}

              {/* Inactive / Terminated / Resigned items — grouped with divider */}
              {inactiveTsas.length > 0 && (
                <>
                  <div className="mx-2 my-1 h-px bg-border" />
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Inactive
                  </p>
                  {inactiveTsas.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        {t.label}
                        <span
                          className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${t.status === "Terminated"
                              ? "bg-red-100 text-red-700"
                              : t.status === "Resigned"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                        >
                          {t.status}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          {/* ── Type Filter ── */}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="rounded-none sm:rounded-r-md border-l sm:border-l-0">
              <SelectValue placeholder="Filter by Type" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "all" ? "All Types" : t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ── Status Filter ── */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="rounded-none sm:rounded-r-md border-l sm:border-l-0">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All Status" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ── Rows per Page ── */}
          <Select
            value={rowsPerPage.toString()}
            onValueChange={(v) => setRowsPerPage(Number(v))}
          >
            <SelectTrigger className="rounded-none sm:rounded-r-md border-l sm:border-l-0">
              <SelectValue placeholder="Rows/Page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="1000">1000</SelectItem>
              <SelectItem value="12000">12000</SelectItem>
              <SelectItem value="30000">30000</SelectItem>
            </SelectContent>
          </Select>

          {/* ── Sort Order ── */}
          <Select
            value={sortOrder}
            onValueChange={(v) => setSortOrder(v as "asc" | "desc")}
          >
            <SelectTrigger className="rounded-none sm:rounded-r-md border-l sm:border-l-0">
              <SelectValue placeholder="Sort Order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">A to Z (Ascending)</SelectItem>
              <SelectItem value="desc">Z to A (Descending)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}