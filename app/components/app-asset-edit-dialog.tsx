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
  newUser: string;
  oldUser: string;
  department: string;
  position: string;
  brand: string;
  model: string;
  processor: string;
  ram: string;
  storage: string;
  serialNumber: string;
  purchaseDate: string;
  assetAge: string;
  amount: string;
  remarks: string;
  macAddress: string;
  createdAt: string;
  updatedAt: string;
}

interface EditActivityModalProps {
  asset: Asset;
  onCloseAction: () => void;
  onSaveAction: (updated: Asset) => void;
}

export default function EditActivityModal({
  asset,
  onCloseAction,
  onSaveAction,
}: EditActivityModalProps) {
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


  // All editable fields except readonly system fields
  const editableFields: { key: keyof Asset; label: string }[] = [
    { key: "assetTag", label: "Asset Tag" },
    { key: "assetType", label: "Asset Type" },
    { key: "status", label: "Status" },
    { key: "location", label: "Location" },
    { key: "newUser", label: "New User" },
    { key: "oldUser", label: "Old User" },
    { key: "department", label: "Department" },
    { key: "position", label: "Position" },
    { key: "brand", label: "Brand" },
    { key: "model", label: "Model" },
    { key: "processor", label: "Processor" },
    { key: "ram", label: "RAM" },
    { key: "storage", label: "Storage" },
    { key: "serialNumber", label: "Serial Number" },
    { key: "purchaseDate", label: "Purchase Date" },
    { key: "assetAge", label: "Asset Age" },
    { key: "amount", label: "Amount" },
    { key: "remarks", label: "Remarks" },
    { key: "macAddress", label: "MAC Address" },
  ];

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCloseAction()}>
      <DialogContent className="max-w-[900px] w-full">
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-2 gap-6 max-h-[75vh] overflow-y-auto p-1"
        >
          {/* Readonly fields */}
          <Input value={formData._id} type="hidden" className="bg-gray-100" />
          <Input value={formData.createdAt} disabled className="bg-gray-100" type="hidden" />
          <Input value={formData.updatedAt} disabled className="bg-gray-100" type="hidden" />

          {/* Editable fields */}
          {editableFields.map(({ key, label }) => (
            <div key={key} className="flex flex-col">
              <label htmlFor={key} className="text-sm font-medium mb-1">
                {label}
              </label>
              <Input
                id={key}
                value={formData[key] ?? ""}
                onChange={(e) => handleChange(key, e.target.value)} className="capitalize"
              />
            </div>
          ))}

          {/* Action Buttons */}
          <div className="col-span-2 flex justify-end gap-3 mt-4">
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
