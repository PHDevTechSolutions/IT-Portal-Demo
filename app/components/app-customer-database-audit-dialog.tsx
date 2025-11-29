"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type AuditKey = "duplicates" | "missingType" | "missingStatus";
type AuditFilter = "" | "all" | AuditKey;

interface Customer {
  id: number;
  account_reference_number: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  region: string;
  type_client: string;
  referenceid: string;
  tsm: string;
  manager: string;
  status: string;
  remarks: string;
  date_created: string;
  date_updated: string;
  next_available_date?: string;
}

interface AuditDialogProps {
  showAuditDialog: boolean;
  setShowAuditDialogAction: React.Dispatch<React.SetStateAction<boolean>>;
  audited: Customer[];
  duplicateIds: Set<number>;
  auditSelection: Record<AuditKey, boolean>;
  toggleAuditSelectionAction: (key: AuditKey) => void;
  setAuditFilterAction: React.Dispatch<React.SetStateAction<AuditFilter>>;
  setCustomersAction: React.Dispatch<React.SetStateAction<Customer[]>>;
}

export const AuditDialog: React.FC<AuditDialogProps> = ({
  showAuditDialog,
  setShowAuditDialogAction,
  audited,
  duplicateIds,
  auditSelection,
  toggleAuditSelectionAction,
  setAuditFilterAction,
  setCustomersAction,
}) => {
  return (
    (audited.length > 0 || duplicateIds.size > 0) && (
      <Dialog open={showAuditDialog} onOpenChange={setShowAuditDialogAction}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Audit Summary Details</DialogTitle>
            <DialogDescription>
              Here’s the breakdown of the audited data. You can select which issues to highlight:
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 mt-2 text-sm">
            {duplicateIds.size > 0 && (
              <label className="flex justify-between items-center gap-2">
                <span>Duplicates:</span>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-red-600">{duplicateIds.size}</span>
                  <input
                    type="checkbox"
                    checked={auditSelection.duplicates}
                    onChange={() => toggleAuditSelectionAction("duplicates")}
                  />
                </div>
              </label>
            )}
            {audited.some((c) => !c.type_client?.trim() && c.status?.trim()) && (
              <label className="flex justify-between items-center gap-2">
                <span>Missing Type:</span>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-yellow-600">
                    {audited.filter((c) => !c.type_client?.trim() && c.status?.trim()).length}
                  </span>
                  <input
                    type="checkbox"
                    checked={auditSelection.missingType}
                    onChange={() => toggleAuditSelectionAction("missingType")}
                  />
                </div>
              </label>
            )}
            {audited.some((c) => !c.status?.trim() && c.type_client?.trim()) && (
              <label className="flex justify-between items-center gap-2">
                <span>Missing Status:</span>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-yellow-600">
                    {audited.filter((c) => !c.status?.trim() && c.type_client?.trim()).length}
                  </span>
                  <input
                    type="checkbox"
                    checked={auditSelection.missingStatus}
                    onChange={() => toggleAuditSelectionAction("missingStatus")}
                  />
                </div>
              </label>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAuditDialogAction(false)}>
              Close
            </Button>
            <Button
              onClick={async () => {
                setShowAuditDialogAction(false);

                // Determine which audit types are selected
                if (auditSelection.duplicates) setAuditFilterAction("duplicates");
                else if (auditSelection.missingType) setAuditFilterAction("missingType");
                else if (auditSelection.missingStatus) setAuditFilterAction("missingStatus");
                else setAuditFilterAction("all");

                // Bulk update status if "Missing Status" is checked
                if (auditSelection.missingStatus) {
                  const missingStatusIds = audited
                    .filter((c) => !c.status?.trim() && c.type_client?.trim())
                    .map((c) => c.id);

                  if (missingStatusIds.length > 0) {
                    try {
                      const res = await fetch(
                        "/api/Data/Applications/Taskflow/CustomerDatabase/BulkEditStatus",
                        {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userIds: missingStatusIds, status: "Active" }),
                        }
                      );
                      const json = await res.json();

                      if (json.success) {
                        toast.success(`Updated status for ${missingStatusIds.length} customers.`);
                        setCustomersAction((prev) =>
                          prev.map((c) =>
                            missingStatusIds.includes(c.id) ? { ...c, status: "Active" } : c
                          )
                        );
                      } else {
                        toast.error(json.error || "Failed to update statuses.");
                      }
                    } catch (err) {
                      console.error(err);
                      toast.error("Failed to update statuses.");
                    }
                  }
                }
              }}
            >
              Take Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  );
};
