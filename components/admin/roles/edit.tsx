"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { UserAccount } from "@/app/api/types/user-account";

interface EditDialogProps {
  open: boolean
  onOpenChangeAction: (value: boolean) => void
  editData: UserAccount | null
  setEditDataAction: React.Dispatch<React.SetStateAction<UserAccount | null>>
  onSaveAction: (updated: UserAccount) => Promise<void>
}

// Role options per department
const DEFAULT_ROLES = ["User", "Manager", "Admin", "SuperAdmin", "Developer"];

const ROLES_BY_DEPARTMENT: Record<string, string[]> = {
  Sales: ["Territory Sales Associate", "Territory Sales Manager", "Manager"],
  "Sales Project": ["Office Sales"],
  CSR: ["Staff", "Admin"],
  IT: ["IT Staff", "IT Admin", "IT Manager", "IT Support", "Developer"],
  HR: ["Staff", "Manager", "Admin"],
  Ecommerce: ["Staff", "Manager", "Admin"],
  Marketing: ["Staff", "Manager", "Admin"],
  Engineering: ["Engineer", "Senior Engineer", "Manager"],
  Admin: ["Staff", "Manager", "Admin"],
  "Warehouse Operations": ["Staff", "Manager", "Supervisor"],
  Accounting: ["Staff", "Manager", "Admin"],
  Owner: ["Owner"],
  Procurement: ["Staff", "Manager", "Admin"],
};

function getRolesForDepartment(dept: string): string[] {
  return ROLES_BY_DEPARTMENT[dept] ?? DEFAULT_ROLES;
}

export function EditDialog({
  open,
  onOpenChangeAction,
  editData,
  setEditDataAction,
  onSaveAction,
}: EditDialogProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [managers, setManagers] = useState<{ label: string; value: string }[]>([])
  const [tsms, setTsms] = useState<{ label: string; value: string }[]>([])

  // Fetch managers and TSMs when dialog opens and department is Sales
  useEffect(() => {
    if (!open || !editData || editData.Department !== "Sales") return;
    
    const fetchDropdowns = async () => {
      try {
        const [managerRes, tsmRes] = await Promise.all([
          fetch("/api/UserManagement/FetchManager?Role=Manager"),
          fetch("/api/UserManagement/FetchTSM?Role=Territory Sales Manager"),
        ]);
        const managerData = await managerRes.json();
        const tsmData = await tsmRes.json();

        setManagers(
          managerData.map((m: any) => ({
            label: `${m.Firstname} ${m.Lastname}`,
            value: m.ReferenceID,
          }))
        );

        setTsms(
          tsmData.map((t: any) => ({
            label: `${t.Firstname} ${t.Lastname}`,
            value: t.ReferenceID,
          }))
        );
      } catch (err) {
        console.error("Error fetching managers or TSMs:", err);
        toast.error("Failed to fetch manager/TSM lists.");
      }
    };

    fetchDropdowns();
  }, [open, editData?.Department]);

  if (!editData) return null

  // Directories and submodules list
  const directories = [
    {
      key: "Ecodesk",
      label: "Ecodesk",
      description: "CSR ticketing system",
      submodules: [
        "Dashboard",
        "Inquiries",
        "Customer Database",
        "Reports",
        "Taskflow",
      ],
    },
    {
      key: "Taskflow",
      label: "Taskflow",
      description: "Sales tracking, activity, time & motion",
      submodules: [
        "Dashboard",
        "Sales Performance",
        "National Call Ranking",
        "Customer Database",
        "Work Management",
        "Reports",
        "Conversion Rates",
      ],
    },
    {
      key: "Acculog",
      label: "Acculog",
      description: "HRIS module (attendance, logs, records)",
      submodules: [
        "Dashboard",
        "Time Attendance",
        "Button - Site Visit",
        "Button - Client Visit",
        "Recruitment",
      ],
    },
    {
      key: "Help-Desk",
      label: "Help Desk",
      description: "IT ticketing system",
    },
    {
      key: "Stash",
      label: "Stash",
      description: "IT inventory management",
    },
  ]

  // Helper: check if directory/subdirectory is included
  const hasDir = (key: string) => editData.Directories?.includes(key)

  // Toggle directory or subdirectory
  const toggleDir = (key: string, checked: boolean) => {
    setEditDataAction((prev) => {
      if (!prev) return prev
      const current = prev.Directories || []

      // If toggling a main directory (e.g. "Ecodesk")
      const isMainDir = directories.some((d) => d.key === key)

      if (isMainDir) {
        if (checked) {
          // Add main directory if not present
          if (!current.includes(key)) {
            return { ...prev, Directories: [...current, key] }
          }
        } else {
          // Remove main directory AND all its submodules
          const filtered = current.filter(
            (d) => d !== key && !d.startsWith(`${key}:`)
          )
          return { ...prev, Directories: filtered }
        }
      } else {
        // Subdirectory toggle (e.g. "Ecodesk:Dashboard")
        const [parentDir] = key.split(":")

        if (checked) {
          // Add parent dir if not present
          const withParent =
            current.includes(parentDir) ? current : [...current, parentDir]

          if (!current.includes(key)) {
            return { ...prev, Directories: [...withParent, key] }
          }
        } else {
          // Remove subdirectory key
          const filtered = current.filter((d) => d !== key)
          return { ...prev, Directories: filtered }
        }
      }

      return prev
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 max-h-[500px] overflow-y-auto">
          {/* Firstname */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Firstname</label>
            <Input
              placeholder="Firstname"
              value={editData.Firstname || ""}
              onChange={(e) =>
                setEditDataAction((prev) => ({ ...prev!, Firstname: e.target.value }))
              }
            />
          </div>

          {/* Lastname */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Lastname</label>
            <Input
              placeholder="Lastname"
              value={editData.Lastname || ""}
              onChange={(e) =>
                setEditDataAction((prev) => ({ ...prev!, Lastname: e.target.value }))
              }
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Email</label>
            <Input
              placeholder="Email"
              value={editData.Email || ""}
              onChange={(e) =>
                setEditDataAction((prev) => ({ ...prev!, Email: e.target.value }))
              }
            />
          </div>

          {/* Company */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Company</label>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={editData.Company || ""}
              onChange={(e) =>
                setEditDataAction((prev) => ({ ...prev!, Company: e.target.value }))
              }
            >
              <option value="">Select Company</option>
              <option value="Ecoshift Corporation">Ecoshift Corporation</option>
              <option value="Disruptive Solutions Inc">Disruptive Solutions Inc</option>
            </select>
          </div>

          {/* Department */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Department</label>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={editData.Department || ""}
              onChange={(e) => {
                const newDept = e.target.value;
                setEditDataAction((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    Department: newDept,
                    Role: "", // Reset role when department changes
                    // Clear Sales-specific fields if not Sales
                    ...(newDept !== "Sales" ? { Manager: "", TSM: "", ManagerName: "", TSMName: "", TargetQuota: "" } : {}),
                  };
                });
              }}
            >
              <option value="">Select Department</option>
              <option value="Sales">Sales</option>
              <option value="IT">IT</option>
              <option value="CSR">CSR</option>
              <option value="HR">HR</option>
              <option value="Ecommerce">Ecommerce</option>
              <option value="Marketing">Marketing</option>
              <option value="Engineering">Engineering</option>
              <option value="Admin">Admin</option>
              <option value="Warehouse Operations">Warehouse Operations</option>
              <option value="Accounting">Accounting</option>
              <option value="Owner">Owner</option>
              <option value="Procurement">Procurement</option>
            </select>
          </div>

          {/* Sales-specific fields */}
          {editData.Department === "Sales" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-600">Target Quota</label>
                <Input
                  type="number"
                  placeholder="Enter target quota"
                  value={editData.TargetQuota || ""}
                  onChange={(e) =>
                    setEditDataAction((prev) => ({ ...prev!, TargetQuota: e.target.value }))
                  }
                />
              </div>
              {/* Manager - Now a Select Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-600">Manager</label>
                <select
                  className="border rounded-md px-3 py-2 text-sm"
                  value={editData.Manager || ""}
                  onChange={(e) =>
                    setEditDataAction((prev) => ({ ...prev!, Manager: e.target.value }))
                  }
                >
                  <option value="">Select Manager</option>
                  {managers.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-600">Manager Name</label>
                <Input
                  value={editData.ManagerName || ""}
                  onChange={(e) =>
                    setEditDataAction((prev) => ({ ...prev!, ManagerName: e.target.value }))
                  }
                  className="capitalize"
                />
              </div>
              {/* TSM - Now a Select Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-600">TSM</label>
                <select
                  className="border rounded-md px-3 py-2 text-sm"
                  value={editData.TSM || ""}
                  onChange={(e) =>
                    setEditDataAction((prev) => ({ ...prev!, TSM: e.target.value }))
                  }
                >
                  <option value="">Select TSM</option>
                  {tsms.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-600">TSM Name</label>
                <Input
                  value={editData.TSMName || ""}
                  onChange={(e) =>
                    setEditDataAction((prev) => ({ ...prev!, TSMName: e.target.value }))
                  }
                  className="capitalize"
                />
              </div>
            </>
          )}

          {/* Position */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Position</label>
            <Input
              placeholder="Position"
              value={editData.Position || ""}
              onChange={(e) =>
                setEditDataAction((prev) => ({ ...prev!, Position: e.target.value }))
              }
            />
          </div>

          {/* Role - Now a Select Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Role</label>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={editData.Role || ""}
              onChange={(e) =>
                setEditDataAction((prev) => ({ ...prev!, Role: e.target.value }))
              }
            >
              <option value="">Select Role</option>
              {getRolesForDepartment(editData.Department || "").map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Status</label>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={editData.Status || ""}
              onChange={(e) => {
                const newStatus = e.target.value;
                const wasLocked = editData.Status?.toLowerCase() === "locked";
                const nowActive = newStatus.toLowerCase() === "active";
                
                setEditDataAction((prev) => {
                  if (!prev) return prev;
                  
                  if (wasLocked && nowActive) {
                    // Reset login attempts and lock until when unlocking
                    return {
                      ...prev,
                      Status: newStatus,
                      LoginAttempts: 0,
                      LockUntil: null,
                    };
                  }
                  
                  return { ...prev, Status: newStatus };
                });
              }}
            >
              <option value="">Select Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
              <option value="Locked">Locked</option>
              <option value="Terminated">Terminated</option>
              <option value="Resigned">Resigned</option>
            </select>
            {editData.Status?.toLowerCase() === "locked" && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ User is locked. Change to Active to unlock and reset login attempts.
              </p>
            )}
          </div>

          {/* Password */}
          <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Password</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password (leave blank to keep unchanged)"
                  value={editData.Password || ""}
                  onChange={(e) =>
                    setEditDataAction((prev) => ({ ...prev!, Password: e.target.value }))
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 text-xs"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  const generated = Math.random().toString(36).slice(-10)
                  setEditDataAction((prev) => ({ ...prev!, Password: generated }))
                  toast.info("New password generated!")
                }}
              >
                Generate
              </Button>
            </div>
          </div>

          {/* Directory Access */}
          <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 mt-4">
            <label className="text-sm font-medium text-gray-600">Directory Access</label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {directories.map((dir) => (
                <div
                  key={dir.key}
                  className="rounded-md border p-3"
                >
                  {/* Main Directory Checkbox */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDir(dir.key)}
                      onChange={(e) => toggleDir(dir.key, e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{dir.label}</span>
                      <span className="text-xs text-muted-foreground">{dir.description}</span>
                    </div>
                  </label>

                  {/* Subdirectories */}
                  {dir.submodules && hasDir(dir.key) && (
                    <div className="mt-3 ml-7 space-y-2 border-l pl-4">
                      {dir.submodules.map((sub) => {
                        const key = `${dir.key}:${sub}`
                        return (
                          <label
                            key={key}
                            className="flex items-center gap-2 text-xs cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={hasDir(key)}
                              onChange={(e) => toggleDir(key, e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-gray-300"
                            />
                            {sub}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            onClick={async () => {
              const toastId = toast.loading("💾 Saving changes...")
              try {
                // Create a copy of editData without empty password
                const dataToSave = { ...editData }
                if (!dataToSave.Password || dataToSave.Password.trim() === "") {
                  delete dataToSave.Password
                }
                await onSaveAction(dataToSave)
                toast.success("✅ Account updated successfully!", { id: toastId })
              } catch (err) {
                toast.error("❌ Failed to update account", { id: toastId })
              }
            }}
            className="w-full sm:w-auto"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
