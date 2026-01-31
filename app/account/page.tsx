"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"

// ShadCN Field + Select
import { Field, FieldLabel, FieldDescription, FieldGroup, FieldSet } from "@/components/ui/field"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

interface UserDetails {
    id: string
    Firstname: string
    Lastname: string
    Email: string
    ContactNumber: string
    Password?: string
    ConfirmPassword?: string
    Status: string
    profilePicture: string
}

export default function AccountPage() {
    const searchParams = useSearchParams()
    const queryUserId = searchParams?.get("userId")
    const [userId, setUserId] = useState<string | null>(queryUserId ?? null)
    const [user, setUser] = useState<UserDetails | null>(null)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong" | "">("")
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const router = useRouter()

    // fallback to localStorage if URL param is missing
    useEffect(() => {
        if (!userId) {
            const storedUserId = localStorage.getItem("userId")
            setUserId(storedUserId)
        }
    }, [userId])

    // fetch user data
    useEffect(() => {
        if (!userId) return
        fetch(`/api/user?id=${encodeURIComponent(userId)}`)
            .then((res) => res.json())
            .then((data) => {
                setUser({
                    id: data._id,
                    Firstname: data.Firstname || "",
                    Lastname: data.Lastname || "",
                    Email: data.Email || "",
                    ContactNumber: data.ContactNumber || "",
                    Status: data.Status || "Active",
                    profilePicture: data.profilePicture || "/avatars/default.jpg",
                })
            })
            .catch(() => toast.error("Failed to load user data"))
    }, [userId])

    const handleImageUpload = async (file: File) => {
        if (!user) return
        setUploading(true)
        const data = new FormData()
        data.append("file", file)
        data.append("upload_preset", "Xchire")

        try {
            const res = await fetch(
                "https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload",
                { method: "POST", body: data }
            )
            const json = await res.json()
            if (json.secure_url) {
                setUser({ ...user, profilePicture: json.secure_url })
                toast.success("Image uploaded successfully")
            } else {
                toast.error("Failed to upload image")
            }
        } catch (error) {
            toast.error("Error uploading image")
            console.error(error)
        } finally {
            setUploading(false)
        }
    }

    const calculatePasswordStrength = (password: string) => {
        if (!password) return ""
        if (password.length < 4) return "weak"
        if (password.match(/^(?=.*[a-z])(?=.*\d).{6,}$/)) return "medium"
        if (password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/))
            return "strong"
        return "weak"
    }

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        if (!user.id) {
            toast.error("User ID not found")
            return
        }

        if (user.Password && user.Password.length > 10) {
            toast.error("Password must be at most 10 characters")
            return
        }

        if (user.Password && user.Password !== user.ConfirmPassword) {
            toast.error("Password and Confirm Password do not match")
            return
        }

        setLoading(true)

        const payload = {
            id: user.id,
            Firstname: user.Firstname,
            Lastname: user.Lastname,
            Email: user.Email,
            ContactNumber: user.ContactNumber,
            Status: user.Status,
            profilePicture: user.profilePicture,
            Password: user.Password && user.Password.trim() !== "" ? user.Password : undefined,
        }

        try {
            const response = await fetch("/api/Profile/Edit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (response.ok) {
                toast.success("Profile updated successfully")
                setUser({ ...user, Password: "", ConfirmPassword: "" })
                setPasswordStrength("")
            } else {
                const error = await response.json()
                toast.error(error?.error || "Failed to update profile")
            }
        } catch (err) {
            toast.error("Failed to update profile")
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    if (!user) return <p className="p-8">Loading user data...</p>

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>

                <header className="flex h-16 shrink-0 items-center gap-2">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />

                        {/* Back button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push("/dashboard")}
                        >
                            Back
                        </Button>

                        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbLink href="#">Account</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Profile</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>


                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                    <div className="p-6 w-full w-full mx-auto">
                        <h1 className="text-2xl font-semibold mb-4">Account Information</h1>

                        <div className="flex items-center gap-4 mb-6">
                            <Avatar className="h-16 w-16">
                                <AvatarImage src={user.profilePicture} alt={user.Firstname} />
                                <AvatarFallback>{user.Firstname?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploading ? "Uploading..." : "Change Picture"}
                                </Button>
                            </div>
                        </div>

                        <form onSubmit={handleUpdate}>
                            <FieldSet>
                                {/* First Name */}
                                <FieldGroup className="grid grid-cols-1 md:grid-cols-2">
                                    <Field>
                                        <Label>First Name</Label>
                                        <Input
                                            value={user.Firstname || ""}
                                            onChange={(e) => setUser({ ...user, Firstname: e.target.value })}
                                        />
                                    </Field>
                                    {/* Last Name */}
                                    <Field>
                                        <Label>Last Name</Label>
                                        <Input
                                            value={user.Lastname || ""}
                                            onChange={(e) => setUser({ ...user, Lastname: e.target.value })}
                                        />
                                    </Field>
                                    {/* Email */}
                                    <Field>
                                        <Label>Email</Label>
                                        <Input
                                            type="email"
                                            value={user.Email || ""}
                                            onChange={(e) => setUser({ ...user, Email: e.target.value })}
                                        />
                                    </Field>
                                    {/* Contact Number */}
                                    <Field>
                                        <Label>Contact Number</Label>
                                        <Input
                                            value={user.ContactNumber || ""}
                                            onChange={(e) => setUser({ ...user, ContactNumber: e.target.value })}
                                        />
                                    </Field>
                                    {/* Password */}
                                    <Field>
                                        <Label>Password</Label>
                                        <Input
                                            type="password"
                                            placeholder="********"
                                            value={user.Password || ""}
                                            onChange={(e) => {
                                                const pwd = e.target.value
                                                setUser({ ...user, Password: pwd })
                                                setPasswordStrength(calculatePasswordStrength(pwd))
                                            }}
                                        />
                                        {user.Password && (
                                            <p className="text-xs mt-1">
                                                Strength:{" "}
                                                <span
                                                    className={
                                                        passwordStrength === "weak"
                                                            ? "text-red-500"
                                                            : passwordStrength === "medium"
                                                                ? "text-yellow-500"
                                                                : "text-green-500"
                                                    }
                                                >
                                                    {passwordStrength}
                                                </span>
                                            </p>
                                        )}
                                    </Field>
                                    {/* Confirm Password */}
                                    <Field>
                                        <Label>Confirm Password</Label>
                                        <Input
                                            type="password"
                                            placeholder="********"
                                            value={user.ConfirmPassword || ""}
                                            onChange={(e) => setUser({ ...user, ConfirmPassword: e.target.value })}
                                        />
                                    </Field>
                                    {/* Status with Select */}
                                    <Field>
                                        <FieldLabel>Status</FieldLabel>
                                        <Select
                                            value={user.Status}
                                            onValueChange={(val) => setUser({ ...user, Status: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Active">Active</SelectItem>
                                                <SelectItem value="Inactive">Inactive</SelectItem>
                                                <SelectItem value="Locked">Locked</SelectItem>
                                                <SelectItem value="Terminated">Terminated</SelectItem>
                                                <SelectItem value="Resigned">Resigned</SelectItem>
                                                <SelectItem value="Do Not Disturb">Do Not Disturb</SelectItem>
                                                <SelectItem value="Busy">Busy</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FieldDescription>Select your current status.</FieldDescription>
                                    </Field>
                                </FieldGroup>
                            </FieldSet>
                            <Field orientation="horizontal" className="pt-4">
                                <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
                            </Field>
                        </form>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
