"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface BulkUpdateTargetQuotaModalProps {
  open: boolean;
  onCloseAction: () => void;
  onConfirmAction: (newQuota: string) => void;
  count: number;
}

export default function BulkUpdateTargetQuotaModal({
  open,
  onCloseAction,
  onConfirmAction,
  count,
}: BulkUpdateTargetQuotaModalProps) {
  const [newQuota, setNewQuota] = useState("");

  const handleSubmit = () => {
    if (!newQuota.trim()) {
      alert("Please enter a valid target quota.");
      return;
    }
    onConfirmAction(newQuota.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onCloseAction}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Update Target Quota</DialogTitle>
          <DialogDescription>
            You are updating target quota for {count} selected {count === 1 ? "progress" : "progress"}.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4">
          <Input
            placeholder="Enter new target quota"
            value={newQuota}
            onChange={(e) => setNewQuota(e.target.value)}
          />
        </div>
        <DialogFooter className="space-x-2">
          <Button variant="outline" onClick={onCloseAction}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Update</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
