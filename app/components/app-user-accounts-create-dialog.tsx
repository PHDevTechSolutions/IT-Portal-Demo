"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import type { UserAccount } from "../types/UserAccount/route"

interface CreateDialogProps {
    open: boolean
    onOpenChangeAction: (value: boolean) => void
    setAccountsAction: React.Dispatch<React.SetStateAction<UserAccount[]>>
}

export function CreateDialog({ open, onOpenChangeAction, setAccountsAction }: CreateDialogProps) {
    const [newUser, setNewUser] = useState<Partial<UserAccount>>({
        ReferenceID: "",
        TSM: "",
        Manager: "",
        Location: "",
        Firstname: "",
        Lastname: "",
        Email: "",
        Department: "",
        Company: "",
        Position: "",
        Role: "",
        Password: "",
        Status: "Active",
        TargetQuota: "",
    })
    const [showCreatePassword, setShowCreatePassword] = useState(false)
    const [managers, setManagers] = useState<{ label: string; value: string }[]>([])
    const [tsms, setTsms] = useState<{ label: string; value: string }[]>([])

    function generateReferenceID(firstname: string, lastname: string, location: string) {
        if (!firstname || !lastname || !location) return ""
        const initials = firstname[0].toUpperCase() + lastname[0].toUpperCase()
        const randomNum = Math.floor(100000 + Math.random() * 900000)
        return `${initials}-${location}-${randomNum}`
    }

    // Fetch managers & TSMs if department is Sales
    useEffect(() => {
        if (newUser.Department !== "Sales") return
        const fetchDropdowns = async () => {
            try {
                const [managerRes, tsmRes] = await Promise.all([
                    fetch("/api/UserManagement/FetchManager?Role=Manager"),
                    fetch("/api/UserManagement/FetchTSM?Role=Territory Sales Manager")
                ])
                const managerData = await managerRes.json()
                const tsmData = await tsmRes.json()

                setManagers(managerData.map((m: any) => ({ label: `${m.Firstname} ${m.Lastname}`, value: m.ReferenceID })))
                setTsms(tsmData.map((t: any) => ({ label: `${t.Firstname} ${t.Lastname}`, value: t.ReferenceID })))
            } catch (err) {
                toast.error("Failed to fetch manager/TSM lists.")
            }
        }
        fetchDropdowns()
    }, [newUser.Department])

    const handleSave = async () => {
        const toastId = toast.loading("Creating user...")
        try {
            const res = await fetch("/api/UserManagement/UserCreate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newUser),
            })
            const result = await res.json()
            if (!res.ok || !result.success) throw new Error(result.message || "Create failed")

            setAccountsAction(prev => [...prev, result.data]) // use renamed prop
            toast.success("✅ User created successfully!", { id: toastId })
            onOpenChangeAction(false) // use renamed prop
            setNewUser({
                Firstname: "",
                Lastname: "",
                Email: "",
                Department: "",
                Company: "",
                Position: "",
                Role: "",
                Password: "",
                Status: "Active",
                TargetQuota: "",
                Location: "",
                ReferenceID: "",
            })
        } catch (err) {
            toast.error((err as Error).message, { id: toastId })
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChangeAction}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {/* Firstname */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Firstname</label>
                        <Input
                            placeholder="Firstname"
                            value={newUser.Firstname || ""}
                            onChange={e => {
                                const Firstname = e.target.value
                                setNewUser(prev => ({
                                    ...prev,
                                    Firstname,
                                    ReferenceID: generateReferenceID(
                                        Firstname || "",
                                        prev.Lastname || "",
                                        prev.Location || ""
                                    ),
                                }))
                            }}
                        />
                    </div>

                    {/* Lastname */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Lastname</label>
                        <Input
                            placeholder="Lastname"
                            value={newUser.Lastname || ""}
                            onChange={e => {
                                const Lastname = e.target.value
                                setNewUser(prev => ({
                                    ...prev,
                                    Lastname,
                                    ReferenceID: generateReferenceID(
                                        prev.Firstname || "",
                                        Lastname || "",
                                        prev.Location || ""
                                    ),
                                }))
                            }}
                        />
                    </div>

                    {/* Location */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Location</label>
                        <select
                            className="border rounded-md px-3 py-2 text-sm"
                            value={newUser.Location || ""}
                            onChange={e => {
                                const Location = e.target.value
                                setNewUser(prev => ({
                                    ...prev,
                                    Location,
                                    ReferenceID: generateReferenceID(
                                        prev.Firstname || "",
                                        prev.Lastname || "",
                                        Location || ""
                                    ),
                                }))
                            }}
                        >
                            <option value="">Select Location</option>
                            <option value="NCR">NCR</option>
                            <option value="CDO">CDO</option>
                            <option value="Davao">Davao</option>
                            <option value="Cebu">Cebu</option>
                            <option value="North-Luzon">North-Luzon</option>
                            <option value="Philippines">Philippines</option>
                        </select>
                    </div>

                    {/* Reference ID */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Reference ID</label>
                        <Input value={newUser.ReferenceID || ""} readOnly className="bg-gray-100" />
                    </div>

                    {/* Company */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Company</label>
                        <Select
                            value={newUser.Company || ""}
                            onValueChange={(value) => {
                                const domain =
                                    value === "Ecoshift Corporation"
                                        ? "@ecoshiftcorp.com"
                                        : value === "Disruptive Solutions Inc"
                                            ? "@disruptivesolutionsinc.com"
                                            : "";

                                setNewUser((prev) => {
                                    const firstInitial = prev.Firstname ? prev.Firstname.charAt(0).toLowerCase() : "";
                                    const lastName = prev.Lastname ? prev.Lastname.toLowerCase() : "";
                                    const email = firstInitial && lastName && domain ? `${firstInitial}.${lastName}${domain}` : prev.Email || "";
                                    return { ...prev, Company: value, Email: email };
                                });
                            }}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Company" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Ecoshift Corporation">Ecoshift Corporation</SelectItem>
                                <SelectItem value="Disruptive Solutions Inc">Disruptive Solutions Inc</SelectItem>
                            </SelectContent>
                        </Select>

                    </div>

                    {/* Email */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Email</label>
                        <Input
                            type="email"
                            placeholder="Email"
                            value={newUser.Email || ""}
                            onChange={e => setNewUser(prev => ({ ...prev, Email: e.target.value }))}
                            readOnly
                        />
                    </div>

                    {/* Department */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Department</label>
                        <Select
                            value={newUser.Department || ""}
                            onValueChange={value => setNewUser(prev => ({ ...prev, Department: value }))}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Sales">Sales</SelectItem>
                                <SelectItem value="IT">IT</SelectItem>
                                <SelectItem value="CSR">CSR</SelectItem>
                                <SelectItem value="HR">HR</SelectItem>
                                <SelectItem value="Ecommerce">Ecommerce</SelectItem>
                                <SelectItem value="Marketing">Marketing</SelectItem>
                                <SelectItem value="Engineering">Engineering</SelectItem>
                                <SelectItem value="Admin">Admin</SelectItem>
                                <SelectItem value="Warehouse Operations">Warehouse Operations</SelectItem>
                                <SelectItem value="Accounting">Accounting</SelectItem>
                                <SelectItem value="Owner">Owner</SelectItem>
                                <SelectItem value="Procurement">Procurement</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Sales-specific fields */}
                    {newUser.Department === "Sales" && (
                        <>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-gray-600">Manager</label>
                                <Select
                                    value={newUser.Manager || ""}
                                    onValueChange={value => setNewUser(prev => ({ ...prev, Manager: value }))}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select Manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {managers.map(m => (
                                            <SelectItem key={m.value} value={m.value}>
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-gray-600">TSM</label>
                                <Select
                                    value={newUser.TSM || ""}
                                    onValueChange={value => setNewUser(prev => ({ ...prev, TSM: value }))}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select TSM" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tsms.map(t => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-gray-600">Target Quota</label>
                                <Input
                                    type="number"
                                    placeholder="Enter target quota"
                                    value={newUser.TargetQuota || ""}
                                    onChange={e => setNewUser(prev => ({ ...prev, TargetQuota: e.target.value }))}
                                />
                            </div>
                        </>
                    )}

                    {/* Position */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Position</label>
                        <Input
                            placeholder="Position"
                            value={newUser.Position || ""}
                            onChange={e => setNewUser(prev => ({ ...prev, Position: e.target.value }))}
                        />
                    </div>

                    {/* Role */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Role</label>
                        <Input
                            placeholder="Role"
                            value={newUser.Role || ""}
                            onChange={e => setNewUser(prev => ({ ...prev, Role: e.target.value }))}
                        />
                    </div>

                    {/* Status */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Status</label>
                        <select
                            className="border rounded-md px-3 py-2 text-sm"
                            value={newUser.Status || ""}
                            onChange={e => setNewUser(prev => ({ ...prev, Status: e.target.value }))}
                        >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Suspended">Suspended</option>
                        </select>
                    </div>

                    {/* Password */}
                    <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-600">Password</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Input
                                    type={showCreatePassword ? "text" : "password"}
                                    placeholder="Password"
                                    value={newUser.Password || ""}
                                    onChange={e => setNewUser(prev => ({ ...prev, Password: e.target.value }))}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCreatePassword(prev => !prev)}
                                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 text-xs"
                                >
                                    {showCreatePassword ? "Hide" : "Show"}
                                </button>
                            </div>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    const generated = Math.random().toString(36).slice(-10)
                                    setNewUser(prev => ({ ...prev, Password: generated }))
                                    toast.info("New password generated!")
                                }}
                            >
                                Generate
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-6">
                    <Button onClick={handleSave} className="w-full sm:w-auto">
                        Save User
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
