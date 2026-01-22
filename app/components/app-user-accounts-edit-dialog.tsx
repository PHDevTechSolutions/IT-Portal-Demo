"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { UserAccount } from "../types/UserAccount/route"

interface EditDialogProps {
    open: boolean
    onOpenChangeAction: (value: boolean) => void
    editData: UserAccount | null
    setEditDataAction: React.Dispatch<React.SetStateAction<UserAccount | null>>
    onSaveAction: (updated: UserAccount) => Promise<void>
}

export function EditDialog({ open, onOpenChangeAction, editData, setEditDataAction, onSaveAction }: EditDialogProps) {
    const [showPassword, setShowPassword] = useState(false)

    if (!editData) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChangeAction}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Edit Account</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {/* Firstname */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Firstname</label>
                        <Input
                            placeholder="Firstname"
                            value={editData.Firstname || ""}
                            onChange={e => setEditDataAction(prev => ({ ...prev!, Firstname: e.target.value }))}
                        />
                    </div>

                    {/* Lastname */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Lastname</label>
                        <Input
                            placeholder="Lastname"
                            value={editData.Lastname || ""}
                            onChange={e => setEditDataAction(prev => ({ ...prev!, Lastname: e.target.value }))}
                        />
                    </div>

                    {/* Email */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Email</label>
                        <Input
                            placeholder="Email"
                            value={editData.Email || ""}
                            onChange={e => setEditDataAction(prev => ({ ...prev!, Email: e.target.value }))}
                        />
                    </div>

                    {/* Company */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Company</label>
                        <Input
                            placeholder="Company"
                            value={editData.Company || ""}
                            onChange={e => setEditDataAction(prev => ({ ...prev!, Company: e.target.value }))}
                        />
                    </div>

                    {/* Department */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Department</label>
                        <select
                            className="border rounded-md px-3 py-2 text-sm"
                            value={editData.Department || ""}
                            onChange={e => setEditDataAction(prev => ({ ...prev!, Department: e.target.value }))}
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
                                    value={(editData as any).TargetQuota || ""}
                                    onChange={e =>
                                        setEditDataAction(prev => ({ ...prev!, TargetQuota: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-gray-600">Manager</label>
                                <Input
                                    value={(editData as any).Manager || ""}
                                    onChange={e => setEditDataAction(prev => ({ ...prev!, Manager: e.target.value }))}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-gray-600">TSM</label>
                                <Input
                                    value={(editData as any).TSM || ""}
                                    onChange={e => setEditDataAction(prev => ({ ...prev!, TSM: e.target.value }))}
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
                            onChange={e => setEditDataAction(prev => ({ ...prev!, Position: e.target.value }))}
                        />
                    </div>

                    {/* Role */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Role</label>
                        <Input
                            placeholder="Role"
                            value={editData.Role || ""}
                            onChange={e => setEditDataAction(prev => ({ ...prev!, Role: e.target.value }))}
                        />
                    </div>

                    {/* Status */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Status</label>
                        <select
                            className="border rounded-md px-3 py-2 text-sm"
                            value={editData.Status || ""}
                            onChange={e => setEditDataAction(prev => ({ ...prev!, Status: e.target.value }))}
                        >
                            <option value="">Select Status</option>
                            <option value="Active">Active</option>
                            <option value="Terminated">Terminated</option>
                            <option value="Resigned">Resigned</option>
                        </select>
                    </div>

                    {/* Password */}
                    <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Password</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    value={editData.Password || ""}
                                    onChange={e => setEditDataAction(prev => ({ ...prev!, Password: e.target.value }))}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(prev => !prev)}
                                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 text-xs"
                                >
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    const generated = Math.random().toString(36).slice(-10)
                                    setEditDataAction(prev => ({ ...prev!, Password: generated }))
                                    toast.info("New password generated!")
                                }}
                            >
                                Generate
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-6">
                    <Button
                        onClick={async () => {
                            const toastId = toast.loading("💾 Saving changes...")
                            try {
                                await onSaveAction(editData)
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
