"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Activity } from "./app-activity-edit-dialog";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterDialogProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  activities: Activity[];

  filterActivityStatus: string | undefined;
  filterTypeClient: string | undefined;
  filterSource: string | undefined;

  setFilterActivityStatusAction: (val: string | undefined) => void;
  setFilterTypeClientAction: (val: string | undefined) => void;
  setFilterSourceAction: (val: string | undefined) => void;

  resetFiltersAction: () => void;
}

export function ActivityFilterDialog({
  open,
  onOpenChangeAction,
  activities,
  filterActivityStatus,
  filterTypeClient,
  filterSource,
  setFilterActivityStatusAction,
  setFilterTypeClientAction,
  setFilterSourceAction,
  resetFiltersAction,
}: FilterDialogProps) {
  const uniqueValues = (key: keyof Activity) =>
    [...new Set(activities.map((a) => a[key]).filter(Boolean))].sort() as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle>Advance Filters</DialogTitle>
          <DialogDescription>
            Apply additional filters to refine your activity list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Activity Status */}
          <div className="space-y-1">
            <label className="text-sm">Activity Status</label>
            <Select
              value={filterActivityStatus ?? "all"}
              onValueChange={(value) =>
                setFilterActivityStatusAction(value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All</SelectItem>
                  {uniqueValues("activitystatus").map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Type of Client */}
          <div className="space-y-1">
            <label className="text-sm">Type of Client</label>
            <Select
              value={filterTypeClient ?? "all"}
              onValueChange={(value) =>
                setFilterTypeClientAction(value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All</SelectItem>
                  {uniqueValues("typeclient").map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          <div className="space-y-1">
            <label className="text-sm">Source</label>
            <Select
              value={filterSource ?? "all"}
              onValueChange={(value) =>
                setFilterSourceAction(value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a source" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All</SelectItem>
                  {uniqueValues("source").map((src) => (
                    <SelectItem key={src} value={src}>
                      {src}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={resetFiltersAction}>
            Reset Filters
          </Button>
          <Button onClick={() => onOpenChangeAction(false)}>Apply Filters</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
