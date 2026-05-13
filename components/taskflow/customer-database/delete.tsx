import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: () => Promise<void>;
  onCancel?: () => void;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900/95 border-cyan-500/30 rounded-none">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <Trash2 className="size-5 text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-cyan-100 tracking-wider uppercase">Delete Selected Customers</DialogTitle>
              <p className="text-[11px] text-slate-400 mt-0.5">
                This action cannot be undone.
              </p>
            </div>
          </div>
          <DialogDescription className="text-slate-300 mt-4">
            This will permanently delete{" "}
            <span className="text-cyan-400 font-semibold">{selectedCount}</span> selected customer
            {selectedCount === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              if (onCancel) onCancel();
            }}
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-none"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              onOpenChange(false);
              await onConfirm();
            }}
            className="bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 rounded-none"
          >
            Delete {selectedCount > 0 && `(${selectedCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
