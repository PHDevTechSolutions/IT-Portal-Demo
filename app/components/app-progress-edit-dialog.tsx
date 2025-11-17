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

export interface Progress {
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
  typeclient?: string;
  projectname?: string;
  projectcategory?: string;
  projecttype?: string;
  source?: string;
  targetquota?: string;
  quotationnumber: string;
  quotationamount: string;
  sonumber: string;
  soamount: string;
  actualsales: string;
  drnumber: string;
  deliverydate: string;
  activityremarks?: string;
  ticketreferencenumber?: string;
  wrapup?: string;
  inquiries?: string;
  typeactivity: string;
  callback: string;
  callstatus: string;
  typecall: string;
  remarks: string;
  startdate: string;
  enddate: string;
  deliveryaddress: string;
  companygroup: string;
  paymentterm: string;
  followup_date: string;
  scheduled_status: string;
  site_visit_date: string;
  csragent?: string;
  activitystatus: string;
  date_created?: string;
  date_updated?: string;
}

interface EditProgressModalProps {
  progress: Progress;
  onCloseAction: () => void;
  onSaveAction: (updated: Progress) => void;
}

// Added all the new fields from the interface below
const editableFields: { key: keyof Progress; label: string }[] = [
  { key: "activitynumber", label: "Activity Number" },
  { key: "companyname", label: "Company Name" },
  { key: "contactperson", label: "Contact Person" },
  { key: "contactnumber", label: "Contact Number" },
  { key: "emailaddress", label: "Email Address" },
  { key: "address", label: "Address" },
  { key: "area", label: "Area" },
  { key: "typeclient", label: "Type Client" },
  { key: "projectname", label: "Project Name" },
  { key: "projectcategory", label: "Project Category" },
  { key: "projecttype", label: "Project Type" },
  { key: "source", label: "Source" },
  { key: "targetquota", label: "Target Quota" },
  { key: "quotationnumber", label: "Quotation Number" },
  { key: "quotationamount", label: "Quotation Amount" },
  { key: "sonumber", label: "SO Number" },
  { key: "soamount", label: "SO Amount" },
  { key: "actualsales", label: "Actual Sales" },
  { key: "drnumber", label: "DR Number" },
  { key: "deliverydate", label: "Delivery Date" },
  { key: "activityremarks", label: "Activity Remarks" },
  { key: "ticketreferencenumber", label: "Ticket Reference Number" },
  { key: "wrapup", label: "Wrap Up" },
  { key: "inquiries", label: "Inquiries" },
  { key: "typeactivity", label: "Type Activity" },
  { key: "callback", label: "Callback" },
  { key: "callstatus", label: "Call Status" },
  { key: "typecall", label: "Type Call" },
  { key: "remarks", label: "Remarks" },
  { key: "startdate", label: "Start Date" },
  { key: "enddate", label: "End Date" },
  { key: "deliveryaddress", label: "Delivery Address" },
  { key: "companygroup", label: "Company Group" },
  { key: "paymentterm", label: "Payment Term" },
  { key: "followup_date", label: "Follow Up Date" },
  { key: "scheduled_status", label: "Scheduled Status" },
  { key: "site_visit_date", label: "Site Visit Date" },
  { key: "csragent", label: "CSR Agent" },
  { key: "activitystatus", label: "Status" },
];

export default function EditProgressModal({
  progress,
  onCloseAction,
  onSaveAction,
}: EditProgressModalProps) {
  const [formData, setFormData] = useState<Progress>(progress);

  const handleChange = (field: keyof Progress, value: string) => {
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
