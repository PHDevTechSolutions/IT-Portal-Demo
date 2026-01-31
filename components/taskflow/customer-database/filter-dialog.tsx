"use client";

import React from "react";
import { Filter } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger, // <- import this
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Add DialogTrigger here */}
      <DialogTrigger asChild>
        <Button variant="outline">
          <Filter />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle>Filter Customers</DialogTitle>
          <DialogDescription>
            Use the filters below to refine your customer list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Filter TSA */}
          <div className="space-y-1">
            <label className="text-sm">Filter by TSA</label>
            <Select
              value={filterTSA}
              onValueChange={(value) => setFilterTSA(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select TSA" />
              </SelectTrigger>
              <SelectContent className="capitalize">
                {tsaList.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Type */}
          <div className="space-y-1">
            <label className="text-sm">Filter by Type</label>
            <Select 
              value={filterType}
              onValueChange={(value) => setFilterType(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent className="capitalize">
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Status */}
          <div className="space-y-1">
            <label className="text-sm">Filter by Status</label>
            <Select
              value={filterStatus}
              onValueChange={(value) => setFilterStatus(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent className="capitalize">
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rows Per Page */}
          <div className="space-y-1">
            <label className="text-sm">Rows Per Page</label>
            <Select
              value={rowsPerPage.toString()}
              onValueChange={(value) => {
                setRowsPerPage(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Rows Per Page" />
              </SelectTrigger>
              <SelectContent className="capitalize">
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
                <SelectItem value="12000">12000</SelectItem>
                <SelectItem value="30000">30000</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setPage(1);
              setOpen(false);
            }}
          >
            Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
