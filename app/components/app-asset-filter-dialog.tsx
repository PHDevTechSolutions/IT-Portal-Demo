"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Asset } from "./app-asset-edit-dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";

interface FilterDialogProps {
    open: boolean;
    onOpenChangeAction: (open: boolean) => void;
    asset: Asset[];
    filterStatus: string | undefined;
    setFilterStatusAction: (val: string | undefined) => void;
    filterAssetType: string | undefined;
    setFilterAssetTypeAction: (val: string | undefined) => void;
    filterBrand: string | undefined;
    setFilterBrandAction: (val: string | undefined) => void;
    filterModel: string | undefined;
    setFilterModelAction: (val: string | undefined) => void;
    filterRam: string | undefined;
    setFilterRamAction: (val: string | undefined) => void;
    filterStorage: string | undefined;
    setFilterStorageAction: (val: string | undefined) => void;
    filterLocation: string | undefined;
    setFilterLocationAction: (val: string | undefined) => void;
    resetFiltersAction: () => void;
}

export function ActivityFilterDialog({
    open,
    onOpenChangeAction,
    asset,
    filterStatus,
    setFilterStatusAction,
    filterAssetType,
    setFilterAssetTypeAction,
    filterBrand,
    setFilterBrandAction,
    filterModel,
    setFilterModelAction,
    filterRam,
    setFilterRamAction,
    filterStorage,
    setFilterStorageAction,
    filterLocation,
    setFilterLocationAction,
    resetFiltersAction,
}: FilterDialogProps) {
    const uniqueValues = (key: keyof Asset) =>
        [...new Set(asset.map((a) => a[key]).filter(Boolean))].sort() as string[];

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

                    {/* Asset Type */}
                    <div className="space-y-1">
                        <label className="text-sm">Asset Type</label>
                        <Select 
                            value={filterAssetType ?? "all"}
                            onValueChange={(value) =>
                                setFilterAssetTypeAction(value === "all" ? undefined : value)
                            }
                        >
                            <SelectTrigger className="w-full capitalize">
                                <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">All</SelectItem>
                                    {uniqueValues("assetType").map((s) => (
                                        <SelectItem key={s} value={s} className="capitalize">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Brand */}
                    <div className="space-y-1">
                        <label className="text-sm">Brand</label>
                        <Select 
                            value={filterBrand ?? "all"}
                            onValueChange={(value) =>
                                setFilterBrandAction(value === "all" ? undefined : value)
                            }
                        >
                            <SelectTrigger className="w-full capitalize">
                                <SelectValue placeholder="Select a brand" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">All</SelectItem>
                                    {uniqueValues("brand").map((s) => (
                                        <SelectItem key={s} value={s} className="capitalize">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Model */}
                    <div className="space-y-1">
                        <label className="text-sm">Model</label>
                        <Select 
                            value={filterModel ?? "all"}
                            onValueChange={(value) =>
                                setFilterModelAction(value === "all" ? undefined : value)
                            }
                        >
                            <SelectTrigger className="w-full capitalize">
                                <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">All</SelectItem>
                                    {uniqueValues("model").map((s) => (
                                        <SelectItem key={s} value={s} className="capitalize">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Ram */}
                    <div className="space-y-1">
                        <label className="text-sm">Ram</label>
                        <Select 
                            value={filterRam ?? "all"}
                            onValueChange={(value) =>
                                setFilterRamAction(value === "all" ? undefined : value)
                            }
                        >
                            <SelectTrigger className="w-full capitalize">
                                <SelectValue placeholder="Select a ram" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">All</SelectItem>
                                    {uniqueValues("ram").map((s) => (
                                        <SelectItem key={s} value={s} className="capitalize">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Storage */}
                    <div className="space-y-1">
                        <label className="text-sm">Storage</label>
                        <Select 
                            value={filterStorage ?? "all"}
                            onValueChange={(value) =>
                                setFilterStorageAction(value === "all" ? undefined : value)
                            }
                        >
                            <SelectTrigger className="w-full capitalize">
                                <SelectValue placeholder="Select a storage" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">All</SelectItem>
                                    {uniqueValues("storage").map((s) => (
                                        <SelectItem key={s} value={s} className="capitalize">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Location */}
                    <div className="space-y-1">
                        <label className="text-sm">Location</label>
                        <Select 
                            value={filterLocation ?? "all"}
                            onValueChange={(value) =>
                                setFilterLocationAction(value === "all" ? undefined : value)
                            }
                        >
                            <SelectTrigger className="w-full capitalize">
                                <SelectValue placeholder="Select a location" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">All</SelectItem>
                                    {uniqueValues("location").map((s) => (
                                        <SelectItem key={s} value={s} className="capitalize">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status */}
                    <div className="space-y-1">
                        <label className="text-sm">Activity Status</label>
                        <Select 
                            value={filterStatus ?? "all"}
                            onValueChange={(value) =>
                                setFilterStatusAction(value === "all" ? undefined : value)
                            }
                        >
                            <SelectTrigger className="w-full capitalize">
                                <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">All</SelectItem>
                                    {uniqueValues("status").map((s) => (
                                        <SelectItem key={s} value={s} className="capitalize">
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
