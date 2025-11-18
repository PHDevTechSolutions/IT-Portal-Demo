"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface Asset {
  _id: string;
  assetTag?: string;
  assetType: string;
  status: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

interface EditActivityModalProps {
  asset: Asset;
  onCloseAction: () => void;
  onSaveAction: (updated: Asset) => void;
}

// Editable fields updated to match your Log interface keys and labels
const editableFields: { key: keyof Asset; label: string }[] = [
  { key: "assetTag", label: "Asset Tag" },
  { key: "assetType", label: "Asset Type" },
  { key: "status", label: "Status" },
  { key: "location", label: "Location" },
];

export default function EditActivityModal({
  asset,
  onCloseAction,
  onSaveAction,
}: EditActivityModalProps) {
  // deep copy to avoid mutating original log
  const [formData, setFormData] = useState<Asset>({ ...asset });

  const handleChange = (field: keyof Asset, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
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
          className="grid grid-cols-2 gap-6 max-h-[75vh] overflow-y-auto p-1"
        >
          {/* Display _id (readonly) */}
          <div className="flex flex-col col-span-2">
            <label className="mb-1 text-sm font-medium">Record ID</label>
            <Input value={formData._id} disabled className="bg-gray-100" />
          </div>

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
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
