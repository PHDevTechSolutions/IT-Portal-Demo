import { Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
  selectedCount: number;
}

function ApproveDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  selectedCount,
}: ApproveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-slate-100 rounded-none p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sm bg-cyan-500/10 border border-cyan-500/30">
              <CheckCircle2 className="size-5 text-cyan-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold uppercase tracking-widest text-cyan-400">
                Approve Transfer
              </DialogTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                This action will update customer assignments
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-sm text-slate-300 leading-relaxed">
            Are you sure you want to approve{" "}
            <span className="text-cyan-400 font-semibold">{selectedCount}</span>{" "}
            selected customer{selectedCount === 1 ? "" : "s"}?
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Their status will be set to{" "}
            <span className="text-green-400 font-medium">Active</span> and the
            reference ID will be updated to the transfer target.
          </p>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-8 text-xs rounded-none text-slate-400 hover:text-slate-200 hover:bg-slate-700 uppercase tracking-wider"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="h-8 text-xs rounded-none bg-cyan-600 hover:bg-cyan-500 text-white border-0 px-5 uppercase tracking-wider"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Approving…
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5 mr-1.5" />
                Approve
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ApproveDialog };
