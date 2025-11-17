"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface Inquiries {
  id: string;
  ReferenceID?: string;
  referenceid?: string;
  activitynumber?: string;
  companyname?: string;
  contactperson?: string;
  contactnumber?: string;
  emailaddress?: string;
  address?: string;
  area?: string;
  typeclient: string;
  ticketreferencenumber?: string;
  wrapup?: string;
  inquiries?: string;
  csragent?: string;
  salesagentname: string;
  status: string;
  date_created?: string;
  date_updated?: string;
}

interface EditActivityModalProps {
  activity: Inquiries;
  onCloseAction: () => void;
  onSaveAction: (updated: Inquiries) => void;
}

const editableFields: { key: keyof Inquiries; label: string }[] = [
  { key: "companyname", label: "Company Name" },
  { key: "contactperson", label: "Contact Person" },
  { key: "contactnumber", label: "Contact Number" },
  { key: "emailaddress", label: "Email Address" },
  { key: "address", label: "Address" },
  { key: "typeclient", label: "Type Client" },
  { key: "ticketreferencenumber", label: "Ticket Reference Number" },
  { key: "wrapup", label: "Wrap Up" },
  { key: "inquiries", label: "Inquiries" },
  { key: "csragent", label: "CSR Agent" },
];

export default function EditActivityModal({
  activity,
  onCloseAction,
  onSaveAction,
}: EditActivityModalProps) {
  const [formData, setFormData] = useState<Inquiries>(activity);

  const handleChange = (field: keyof Inquiries, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveAction(formData);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCloseAction()}>
      <DialogContent className="max-w-[900px] w-full">
        <DialogHeader>
          <DialogTitle>Edit Activity</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-2 gap-6 max-h-[75vh] overflow-y-auto"
        >
          {editableFields.map(({ key, label }) => (
            <div className="flex flex-col" key={key}>
              <label htmlFor={key} className="mb-1 text-sm font-medium">
                {label}
              </label>
              <Input
                id={key}
                value={formData[key] ?? ""}
                onChange={(e) => handleChange(key, e.target.value)}
              />
            </div>
          ))}

          <div className="col-span-2 flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={onCloseAction}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
