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
import type { Log } from "./edit";
import { Filter, X, Check } from "lucide-react";

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
            <DialogContent className="max-w-md bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                {/* Animated background grid */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
                    <div 
                        className="absolute inset-0 opacity-[0.02]"
                        style={{
                            backgroundImage: `
                                linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)
                            `,
                            backgroundSize: '40px 40px',
                        }}
                    />
                </div>

                <DialogHeader className="relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                            <Filter className="h-5 w-5 text-cyan-400" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-white tracking-wider">ADVANCE FILTERS</DialogTitle>
                    </div>
                    <DialogDescription className="text-cyan-300/70 mt-1">
                        Apply additional filters to refine your activity list.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative z-10 space-y-4 py-2">
                    {/* Activity Status */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-cyan-300/80 uppercase tracking-wider">Activity Status</label>
                        <Select
                            value={filterStatus ?? "all"}
                            onValueChange={(value) =>
                                setFilterStatusAction(value === "all" ? undefined : value)
                            }
                        >
                            <SelectTrigger className="w-full bg-slate-900/50 border-cyan-500/30 text-cyan-100 focus:ring-cyan-400/20">
                                <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0a0f1c] border-cyan-500/30">
                                <SelectGroup>
                                    <SelectItem value="all" className="text-cyan-100 focus:bg-cyan-500/20 focus:text-cyan-300">All</SelectItem>
                                    {uniqueValues("Status").map((s) => (
                                        <SelectItem key={s} value={s} className="text-cyan-100 focus:bg-cyan-500/20 focus:text-cyan-300">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter className="relative z-10 gap-2 mt-4">
                    <Button 
                        variant="outline" 
                        onClick={resetFiltersAction}
                        className="bg-slate-900/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                    >
                        <X className="w-4 h-4 mr-1" />
                        Reset Filters
                    </Button>
                    <Button 
                        onClick={() => onOpenChangeAction(false)}
                        className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                    >
                        <Check className="w-4 h-4 mr-1" />
                        Apply Filters
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
