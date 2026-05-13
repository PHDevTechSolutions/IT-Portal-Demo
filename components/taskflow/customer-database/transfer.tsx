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
import { ArrowRight, UserCog } from "lucide-react";

export interface TransferSuccessPayload {
  tsa?: { toId: string; toName: string } | null;
  tsm?: { toId: string; toName: string } | null;
  manager?: { toId: string; toName: string } | null;
}

interface TransferDialogProps {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  selectedIds: Set<string>;
  setSelectedIdsAction: (ids: Set<string>) => void;
  setAccountsAction: (fn: (prev: any[]) => any[]) => void;
  tsas: { label: string; value: string }[];
  tsms: { label: string; value: string }[];
  managers: { label: string; value: string }[];
  /**
   * Called once after ALL selected transfers succeed.
   * Receives a single bundle so the parent can write one audit log entry.
   */
  onSuccessAction?: (payload: TransferSuccessPayload) => void;
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
  onSuccessAction,
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
        const res = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/BulkTransfer",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: Array.from(selectedIds),
              type: "TSA",
              targetId: tsaSelection,
            }),
          },
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "TSA transfer failed");
        }
      }

      if (tsmSelection) {
        const res = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/BulkTransfer",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: Array.from(selectedIds),
              type: "TSM",
              targetId: tsmSelection,
            }),
          },
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "TSM transfer failed");
        }
      }

      if (managerSelection) {
        const res = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/BulkTransfer",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: Array.from(selectedIds),
              type: "Manager",
              targetId: managerSelection,
            }),
          },
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Manager transfer failed");
        }
      }

      // Update local state
      setAccountsAction((prev) =>
        prev.map((u) =>
          selectedIds.has(String(u.id))
            ? {
                ...u,
                ...(tsaSelection ? { tsa: tsaSelection } : {}),
                ...(tsmSelection ? { tsm: tsmSelection } : {}),
                ...(managerSelection ? { manager: managerSelection } : {}),
              }
            : u,
        ),
      );

      setSelectedIdsAction(new Set());
      toast.success("Users transferred successfully!", { id: toastId });

      // ── Single bundled audit callback ──────────────────────────────────
      onSuccessAction?.({
        tsa: tsaSelection
          ? {
              toId: tsaSelection,
              toName:
                tsas.find((t) => t.value === tsaSelection)?.label ??
                tsaSelection,
            }
          : null,
        tsm: tsmSelection
          ? {
              toId: tsmSelection,
              toName:
                tsms.find((t) => t.value === tsmSelection)?.label ??
                tsmSelection,
            }
          : null,
        manager: managerSelection
          ? {
              toId: managerSelection,
              toName:
                managers.find((m) => m.value === managerSelection)?.label ??
                managerSelection,
            }
          : null,
      });

      onOpenChangeAction(false);
      setTsaSelection("");
      setTsmSelection("");
      setManagerSelection("");
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-w-md bg-slate-900/95 border-cyan-500/30 rounded-none">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <UserCog className="size-5 text-cyan-400" />
            </div>
            <div>
              <DialogTitle className="text-cyan-100 tracking-wider uppercase">Transfer Selected Users</DialogTitle>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Move customers between TSA/TSM/Manager
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <label className="block mb-1 text-[11px] font-bold uppercase text-slate-400">
              Transfer to TSA
            </label>
            <Select value={tsaSelection} onValueChange={setTsaSelection}>
              <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-slate-300 rounded-none h-9 text-xs focus:border-cyan-500/50">
                <SelectValue placeholder="Select TSA" />
              </SelectTrigger>
              <SelectContent>
                {tsas.map((u) => (
                  <SelectItem
                    key={u.value}
                    value={u.value}
                    className="capitalize"
                  >
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-bold uppercase text-slate-400">
              Transfer to TSM
            </label>
            <Select value={tsmSelection} onValueChange={setTsmSelection}>
              <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-slate-300 rounded-none h-9 text-xs focus:border-cyan-500/50">
                <SelectValue placeholder="Select TSM" />
              </SelectTrigger>
              <SelectContent>
                {tsms.map((u) => (
                  <SelectItem
                    key={u.value}
                    value={u.value}
                    className="capitalize"
                  >
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-bold uppercase text-slate-400">
              Transfer to Manager
            </label>
            <Select
              value={managerSelection}
              onValueChange={setManagerSelection}
            >
              <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-slate-300 rounded-none h-9 text-xs focus:border-cyan-500/50">
                <SelectValue placeholder="Select Manager" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((u) => (
                  <SelectItem
                    key={u.value}
                    value={u.value}
                    className="capitalize"
                  >
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChangeAction(false)}
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-none"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0 rounded-none gap-1"
          >
            Confirm <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
