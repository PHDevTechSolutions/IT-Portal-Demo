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
import { Trash2, AlertTriangle } from "lucide-react"

interface DeleteDialogProps {
  open: boolean
  count: number
  onCancelAction: () => void
  onConfirmAction: () => void
}

export function DeleteDialog({ open, count, onCancelAction, onConfirmAction }: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancelAction}>
      <DialogContent className="bg-slate-900/95 border-red-500/30 max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <DialogTitle className="text-cyan-100 tracking-wider">SECURITY ALERT</DialogTitle>
          </div>
          <DialogDescription className="text-cyan-300/60 text-sm pt-2">
            You are about to purge <span className="text-red-400 font-bold">{count}</span> user profile{count !== 1 ? "s" : ""} from the system. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={onCancelAction}
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-none"
          >
            Abort
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirmAction}
            className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-none"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Purge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
