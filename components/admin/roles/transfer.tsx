"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface TransferDialogProps {
    open: boolean;
    onOpenChangeAction: (open: boolean) => void;
    transferType: "TSM" | "Manager" | null;
    transferSelection: string;
    setTransferSelectionAction: (val: string) => void;
    selectedIds: Set<string>;
    setSelectedIdsAction: (ids: Set<string>) => void;
    setAccountsAction: (fn: (prev: any[]) => any[]) => void;
    tsms: { label: string; value: string }[];
    managers: { label: string; value: string }[];
}

export const TransferDialog: React.FC<TransferDialogProps> = ({
    open,
    onOpenChangeAction,
    transferType,
    transferSelection,
    setTransferSelectionAction,
    selectedIds,
    setSelectedIdsAction,
    setAccountsAction,
    tsms,
    managers,
}) => {
    const handleConfirm = async () => {
        if (!transferSelection) return toast.error("Select a user first!");
        const toastId = toast.loading("Transferring users...");
        try {
            const res = await fetch("/api/UserManagement/UserTransfer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ids: Array.from(selectedIds),
                    type: transferType,
                    targetId: transferSelection,
                }),
            });

            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.message || "Transfer failed");

            setAccountsAction(prev =>
                prev.map(u =>
                    selectedIds.has(u._id)
                        ? { ...u, [transferType!]: transferSelection }
                        : u
                )
            );
            setSelectedIdsAction(new Set());
            toast.success("Users transferred successfully!", { id: toastId });
            onOpenChangeAction(false);
        } catch (err) {
            toast.error((err as Error).message, { id: toastId });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChangeAction}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {transferType === "TSM" ? "Transfer Selected to TSM" : "Transfer Selected to Manager"}
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                    <Select value={transferSelection} onValueChange={setTransferSelectionAction}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={`Select ${transferType}`} />
                        </SelectTrigger>
                        <SelectContent>
                            {(transferType === "TSM" ? tsms : managers).map(u => (
                                <SelectItem key={u.value} value={u.value}>
                                    {u.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <DialogFooter className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChangeAction(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm}>Confirm</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
