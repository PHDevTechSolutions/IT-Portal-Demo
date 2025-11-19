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
import type { Log } from "./app-acculog-edit-dialog";

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
    log: Log[];

    filterStatus: string | undefined;
    setFilterStatusAction: (val: string | undefined) => void;
    resetFiltersAction: () => void;
}

export function ActivityFilterDialog({
    open,
    onOpenChangeAction,
    log,
    filterStatus,
    setFilterStatusAction,
    resetFiltersAction,
}: FilterDialogProps) {
    const uniqueValues = (key: keyof Log) =>
        [...new Set(log.map((a) => a[key]).filter(Boolean))].sort() as string[];

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
                            value={filterStatus ?? "all"}
                            onValueChange={(value) =>
                                setFilterStatusAction(value === "all" ? undefined : value)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">All</SelectItem>
                                    {uniqueValues("Status").map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {s}
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
