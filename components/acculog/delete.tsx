"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trash2, AlertTriangle, X } from "lucide-react"

interface DeleteDialogProps {
  open: boolean
  count: number
  onCancelAction: () => void
  onConfirmAction: () => void
}

export function DeleteDialog({ open, count, onCancelAction, onConfirmAction }: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancelAction}>
      <DialogContent className="bg-[#0a0f1c] border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.15)] max-w-md">
        {/* Animated background grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(239,68,68,0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(239,68,68,0.5) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <DialogHeader className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-white tracking-wider">CONFIRM DELETION</DialogTitle>
          </div>
          <DialogDescription className="text-cyan-300/70 mt-3">
            Are you sure you want to delete <b className="text-red-400">{count}</b> activity record{count !== 1 ? "s" : ""}?
            <br />
            <span className="text-xs text-cyan-500/60 mt-2 block">This action cannot be undone.</span>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="relative z-10 gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={onCancelAction}
            className="bg-slate-900/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button 
            onClick={onConfirmAction}
            className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white border-0 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
