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
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-slate-100 rounded-none p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sm bg-red-500/10 border border-red-500/30">
              <Trash2 className="size-5 text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold uppercase tracking-widest text-red-400">
                Delete Customers
              </DialogTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                This action cannot be undone
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-5 py-5">
          <DialogDescription className="text-sm text-slate-300 leading-relaxed">
            This will permanently delete{" "}
            <span className="text-red-400 font-semibold">{selectedCount}</span>{" "}
            selected customer{selectedCount === 1 ? "" : "s"} from the database.
          </DialogDescription>
          <p className="text-xs text-slate-500 mt-2">
            All associated data will be removed and cannot be recovered.
          </p>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              if (onCancel) onCancel();
            }}
            className="h-8 text-xs rounded-none text-slate-400 hover:text-slate-200 hover:bg-slate-700 uppercase tracking-wider"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              onOpenChange(false);
              await onConfirm();
            }}
            className="h-8 text-xs rounded-none bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:text-red-300 uppercase tracking-wider"
          >
            <Trash2 className="size-3.5 mr-1.5" />
            Delete {selectedCount > 0 && `(${selectedCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
