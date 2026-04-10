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
import { Edit3, Save, X, Activity } from "lucide-react";

export interface Log {
  _id: string;
  ReferenceID?: string;
  date_created: string;
  Email: string;
  Type: string;
  Status: string;
  Location: string;
  Latitude: string;
  Longitude: string;
  PhotoURL: string;
  Remarks: string;
}

interface EditActivityModalProps {
  log: Log;
  onCloseAction: () => void;
  onSaveAction: (updated: Log) => void;
}

const editableFields: { key: keyof Log; label: string }[] = [
  { key: "ReferenceID", label: "ReferenceID" },
  { key: "Email", label: "Email" },
  { key: "Type", label: "Type" },
  { key: "Status", label: "Status" },
  { key: "Location", label: "Location" },
  { key: "Latitude", label: "Latitude" },
  { key: "Longitude", label: "Longitude" },
  { key: "PhotoURL", label: "PhotoURL" },
  { key: "Remarks", label: "Remarks" },
];

export default function EditActivityModal({
  log,
  onCloseAction,
  onSaveAction,
}: EditActivityModalProps) {
  // deep copy to avoid mutating original log
  const [formData, setFormData] = useState<Log>({ ...log });

  const handleChange = (field: keyof Log, value: string) => {
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
      <DialogContent className="max-w-[900px] w-full bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
        {/* Animated background grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />
        </div>
        
        <DialogHeader className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <Edit3 className="h-5 w-5 text-cyan-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-white tracking-wider">EDIT ACTIVITY</DialogTitle>
          </div>
          <p className="text-sm text-cyan-300/60 mt-1">Modify activity log details</p>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="relative z-10 grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto p-1 mt-4"
        >
          {/* Display _id (readonly) */}
          <div className="flex flex-col col-span-2">
            <label className="mb-1.5 text-xs font-medium text-cyan-300/80 uppercase tracking-wider">Record ID</label>
            <Input 
              value={formData._id} 
              disabled 
              className="bg-slate-900/80 border-cyan-500/30 text-cyan-100/60 font-mono text-sm"
            />
          </div>

          {editableFields.map(({ key, label }) => (
            <div className="flex flex-col" key={key}>
              <label htmlFor={key} className="mb-1.5 text-xs font-medium text-cyan-300/80 uppercase tracking-wider">
                {label}
              </label>
              <Input
                id={key}
                value={formData[key] ?? ""}
                onChange={(e) => handleChange(key, e.target.value)}
                className="bg-slate-900/50 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-500/40 focus:border-cyan-400 focus:ring-cyan-400/20"
              />
            </div>
          ))}

          <div className="col-span-2 flex justify-end gap-3 mt-6 pt-4 border-t border-cyan-500/20">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCloseAction}
              className="bg-slate-900/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button 
              type="submit"
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
