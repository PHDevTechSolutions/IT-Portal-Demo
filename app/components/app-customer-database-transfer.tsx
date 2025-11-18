"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface TransferDialogProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  selectedIds: Set<string>;
  setSelectedIdsAction: (ids: Set<string>) => void;
  setAccountsAction: (fn: (prev: any[]) => any[]) => void;
  tsas: { label: string; value: string }[];
  tsms: { label: string; value: string }[];
  managers: { label: string; value: string }[];
}

export const TransferDialog: React.FC<TransferDialogProps> = ({
  open,
  onOpenChangeAction,
  selectedIds,
  setSelectedIdsAction,
  setAccountsAction,
  tsas,
  tsms,
  managers,
}) => {
  const [tsaSelection, setTsaSelection] = useState<string>("");
  const [tsmSelection, setTsmSelection] = useState<string>("");
  const [managerSelection, setManagerSelection] = useState<string>("");

  const handleConfirm = async () => {
    if (!tsaSelection && !tsmSelection && !managerSelection) {
      toast.error("Select at least one TSA, TSM, or Manager");
      return;
    }

    const toastId = toast.loading("Transferring users...");
    try {
      if (tsaSelection) {
        const resTsa = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/BulkTransfer",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: Array.from(selectedIds),
              type: "TSA",
              targetId: tsaSelection,
            }),
          }
        );

        if (!resTsa.ok) {
          const errJson = await resTsa.json();
          throw new Error(errJson.error || "TSA transfer failed");
        }
      }

      if (tsmSelection) {
        const resTsm = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/BulkTransfer",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: Array.from(selectedIds),
              type: "TSM",
              targetId: tsmSelection,
            }),
          }
        );

        if (!resTsm.ok) {
          const errJson = await resTsm.json();
          throw new Error(errJson.error || "TSM transfer failed");
        }
      }

      if (managerSelection) {
        const resManager = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/BulkTransfer",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: Array.from(selectedIds),
              type: "Manager",
              targetId: managerSelection,
            }),
          }
        );

        if (!resManager.ok) {
          const errJson = await resManager.json();
          throw new Error(errJson.error || "Manager transfer failed");
        }
      }

      // Update local state correctly (fix tsa assignment)
      setAccountsAction((prev) =>
        prev.map((u) =>
          selectedIds.has(String(u.id))
            ? {
                ...u,
                ...(tsaSelection ? { tsa: tsaSelection } : {}),
                ...(tsmSelection ? { tsm: tsmSelection } : {}),
                ...(managerSelection ? { manager: managerSelection } : {}),
              }
            : u
        )
      );

      setSelectedIdsAction(new Set());
      toast.success("Users transferred successfully!", { id: toastId });
      onOpenChangeAction(false);

      // Reset selections
      setTsaSelection("");
      setTsmSelection("");
      setManagerSelection("");
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Selected Users</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <label className="block mb-1 font-medium text-xs">Transfer to TSA</label>
            <Select value={tsaSelection} onValueChange={setTsaSelection}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select TSA" />
              </SelectTrigger>
              <SelectContent>
                {tsas.map((u) => (
                  <SelectItem key={u.value} value={u.value} className="capitalize">
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block mb-1 font-medium text-xs">Transfer to TSM</label>
            <Select value={tsmSelection} onValueChange={setTsmSelection}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select TSM" />
              </SelectTrigger>
              <SelectContent>
                {tsms.map((u) => (
                  <SelectItem key={u.value} value={u.value} className="capitalize">
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block mb-1 font-medium text-xs">Transfer to Manager</label>
            <Select value={managerSelection} onValueChange={setManagerSelection}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Manager" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((u) => (
                  <SelectItem key={u.value} value={u.value} className="capitalize">
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
