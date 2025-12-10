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
  tsaList: { label: string; value: string }[]
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
          {/* TSA Filter */}
          <Select value={filterTSA} onValueChange={setFilterTSA}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by TSA" />
            </SelectTrigger>
            <SelectContent className="rounded-none sm:rounded-r-md border-l sm:border-l-0 capitalize">
              {tsaList.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Type Filter */}
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

          {/* Status Filter */}
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

          {/* Rows per Page */}
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

          {/* NEW Sort Order */}
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
