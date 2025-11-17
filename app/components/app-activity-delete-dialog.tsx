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
import { Trash2 } from "lucide-react"

interface DeleteDialogProps {
  open: boolean
  count: number
  onCancelAction: () => void
  onConfirmAction: () => void
}

export function DeleteDialog({ open, count, onCancelAction, onConfirmAction }: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancelAction}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <b>{count}</b> account{count !== 1 ? "s" : ""}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelAction}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirmAction}>
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
