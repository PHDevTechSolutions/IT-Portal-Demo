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

      onSuccessAction?.({
        tsa: tsaSelection
          ? {
              toId: tsaSelection,
              toName:
                tsas.find((t) => t.value === tsaSelection)?.label ?? tsaSelection,
            }
          : null,
        tsm: tsmSelection
          ? {
              toId: tsmSelection,
              toName:
                tsms.find((t) => t.value === tsmSelection)?.label ?? tsmSelection,
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
      <DialogContent className="max-w-md bg-[#0d1117] border-orange-500/20 rounded-none p-0 gap-0">

        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 border border-orange-500/30">
              <UserCog className="size-4 text-orange-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold uppercase tracking-widest font-mono text-orange-400">
                Transfer Selected Users
              </DialogTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Move customers between TSA / TSM / Manager
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {[
            { label: "Transfer to TSA", options: tsas, value: tsaSelection, onChange: setTsaSelection, placeholder: "Select TSA" },
            { label: "Transfer to TSM", options: tsms, value: tsmSelection, onChange: setTsmSelection, placeholder: "Select TSM" },
            { label: "Transfer to Manager", options: managers, value: managerSelection, onChange: setManagerSelection, placeholder: "Select Manager" },
          ].map(({ label, options, value, onChange, placeholder }) => (
            <div key={label}>
              <label className="block mb-1.5 text-[10px] font-bold uppercase tracking-widest font-mono text-slate-500">
                {label}
              </label>
              <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-slate-300 rounded-none h-9 text-xs focus:border-orange-500/50 font-mono">
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                  {options.map((u) => (
                    <SelectItem
                      key={u.value}
                      value={u.value}
                      className="text-xs capitalize focus:bg-orange-500/10 focus:text-orange-400"
                    >
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChangeAction(false)}
            className="h-8 text-xs rounded-none text-slate-400 hover:text-slate-200 hover:bg-slate-700 uppercase tracking-wider font-mono"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="h-8 text-xs rounded-none bg-orange-600 hover:bg-orange-500 text-white border-0 px-5 gap-1.5 uppercase tracking-wider font-mono"
          >
            Confirm <ArrowRight className="size-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
