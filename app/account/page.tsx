"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BiometricSettings } from "@/components/account/BiometricSettings";
import { TwoFactorSetup } from "@/components/account/TwoFactorSetup";
import {
  Select, SelectTrigger, SelectValue,
  SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  ChevronRight, Loader2, Camera, User,
  Mail, Phone, Lock, ShieldCheck, Save,
  AlertCircle, Building2, Briefcase,
} from "lucide-react";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  muted:  "#253040",
  dim:    "#4a6070",
  text:   "#c8d8e8",
  accent: "#e8630a",
  font:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

interface UserDetails {
  id:               string;
  Firstname:        string;
  Lastname:         string;
  Email:            string;
  ContactNumber:    string;
  Department:       string;
  Company:          string;
  Position:         string;
  Role:             string;
  Password?:        string;
  ConfirmPassword?: string;
  Status:           string;
  profilePicture:   string;
}

function pwStrength(pw: string): "weak" | "medium" | "strong" | "" {
  if (!pw) return "";
  if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(pw)) return "strong";
  if (/^(?=.*[a-z])(?=.*\d).{6,}$/.test(pw)) return "medium";
  if (pw.length >= 1) return "weak";
  return "";
}

const STRENGTH_COLOR = { weak: "#f87171", medium: "#fbbf24", strong: "#34d399" };

function FormField({ label, icon: Icon, children }: {
  label: string; icon?: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest"
        style={{ color: C.dim, fontFamily: C.font }}>
        {Icon && <Icon className="size-3" />}{label}
      </label>
      {children}
    </div>
  );
}

export default function AccountPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const queryUserId  = searchParams?.get("userId");

  const [userId,    setUserId]    = useState<string | null>(queryUserId ?? null);
  const [user,      setUser]      = useState<UserDetails | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) {
      const stored = localStorage.getItem("userId");
      if (stored) setUserId(stored);
      else setLoadError("No user ID found. Please log in again.");
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then(r => { if (!r.ok) throw new Error("Failed to fetch user"); return r.json(); })
      .then(data => {
        if (!data?._id) throw new Error("User not found");
        setUser({
          id: data._id, Firstname: data.Firstname || "", Lastname: data.Lastname || "",
          Email: data.Email || "", ContactNumber: data.ContactNumber || "",
          Department: data.Department || "", Company: data.Company || "",
          Position: data.Position || "", Role: data.Role || "",
          Status: data.Status || "Active",
          profilePicture: data.profilePicture || "/avatars/default.jpg",
        });
      })
      .catch(err => { setLoadError("Failed to load user data."); toast.error(err.message); })
      .finally(() => setLoading(false));
  }, [userId]);

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("upload_preset", "Xchire");
    try {
      const res = await fetch("https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.secure_url) { setUser({ ...user, profilePicture: json.secure_url }); toast.success("Photo updated."); }
      else toast.error("Upload failed.");
    } catch { toast.error("Upload error."); }
    finally { setUploading(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (user.Password && user.Password.length > 10) { toast.error("Password max 10 characters."); return; }
    if (user.Password && user.Password !== user.ConfirmPassword) { toast.error("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/Profile/Edit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id, Firstname: user.Firstname, Lastname: user.Lastname,
          Email: user.Email, ContactNumber: user.ContactNumber,
          Department: user.Department, Company: user.Company, Position: user.Position,
          Role: user.Role,
          Status: user.Status, profilePicture: user.profilePicture,
          Password: user.Password?.trim() || undefined,
        }),
      });
      if (res.ok) { toast.success("Profile saved."); setUser({ ...user, Password: "", ConfirmPassword: "" }); }
      else { const err = await res.json(); toast.error(err?.error || "Save failed."); }
    } catch { toast.error("Save failed."); }
    finally { setLoading(false); }
  };

  const strength = pwStrength(user?.Password ?? "");

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden"
          style={{ backgroundColor: C.bg, color: C.text, fontFamily: C.font }}>

          {/* ── Header ── */}
          <header className="relative flex h-12 shrink-0 items-center border-b overflow-hidden"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="absolute bottom-0 left-0 w-full h-px"
              style={{ background: `linear-gradient(to right, transparent, ${C.accent}50, transparent)` }} />
            <div className="flex items-center gap-2 px-4 relative z-10">
              <SidebarTrigger className="-ml-1" style={{ color: C.dim }} />
              <button onClick={() => router.push("/dashboard")}
                className="text-xs hidden sm:flex font-mono px-2 py-1 transition-colors"
                style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                Home
              </button>
              <Separator orientation="vertical" className="h-4 hidden sm:block"
                style={{ backgroundColor: C.border }} />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#"
                      className="text-xs hidden sm:block font-mono uppercase tracking-wider"
                      style={{ color: C.dim }}>Account</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <ChevronRight size={10} style={{ color: C.muted }} />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-mono tracking-widest uppercase"
                      style={{ color: C.accent }}>Profile</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">

            {/* Error */}
            {loadError && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="flex items-center gap-2" style={{ color: "#f87171" }}>
                  <AlertCircle className="size-5" />
                  <span className="text-sm font-bold uppercase tracking-widest">{loadError}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => router.push("/login")}
                    className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border"
                    style={{ borderColor: C.accent, color: C.accent, backgroundColor: "transparent" }}>
                    Go to Login
                  </button>
                  <button onClick={() => window.location.reload()}
                    className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border"
                    style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}>
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {!loadError && (loading || !user) && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="size-6 animate-spin" style={{ color: C.accent }} />
                <span className="text-[10px] uppercase tracking-widest animate-pulse"
                  style={{ color: C.dim }}>Loading profile…</span>
              </div>
            )}

            {/* Content */}
            {!loadError && !loading && user && (
              <div className="space-y-6 max-w-3xl">

                {/* Page title */}
                <div>
                  <h1 className="text-sm font-bold uppercase tracking-widest"
                    style={{ color: C.accent }}>Account Settings</h1>
                  <p className="text-[11px] mt-0.5" style={{ color: C.dim }}>
                    {user.Firstname} {user.Lastname} · {user.Email}
                  </p>
                </div>

                <form onSubmit={handleUpdate} className="space-y-6">

                  {/* Avatar */}
                  <div className="border p-4 flex items-center gap-5"
                    style={{ borderColor: C.border, backgroundColor: C.panel }}>
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={user.profilePicture} alt={user.Firstname}
                        className="w-16 h-16 object-cover border"
                        style={{ borderColor: C.border }} />
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center w-6 h-6 border disabled:opacity-40"
                        style={{ backgroundColor: C.accent, borderColor: C.accent, color: "#fff" }}>
                        {uploading ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: C.text }}>
                        {user.Firstname} {user.Lastname}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: C.dim }}>{user.Email}</p>
                      <span className="inline-block mt-1.5 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border"
                        style={{
                          borderColor: user.Status === "Active" ? "#34d39940" : C.border,
                          color:       user.Status === "Active" ? "#34d399"   : C.dim,
                          backgroundColor: user.Status === "Active" ? "#34d39910" : "transparent",
                        }}>
                        {user.Status}
                      </span>
                    </div>
                  </div>

                  {/* Personal info */}
                  <div className="border" style={{ borderColor: C.border, backgroundColor: C.panel }}>
                    <div className="px-4 py-3 border-b flex items-center gap-2"
                      style={{ borderColor: C.border, backgroundColor: C.bg }}>
                      <User className="size-3.5" style={{ color: C.accent }} />
                      <span className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: C.accent }}>Personal Information</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { label: "First Name",      icon: User,       key: "Firstname",     type: "text"  },
                        { label: "Last Name",       icon: User,       key: "Lastname",      type: "text"  },
                        { label: "Email Address",   icon: Mail,       key: "Email",         type: "email" },
                        { label: "Contact Number",  icon: Phone,      key: "ContactNumber", type: "text"  },
                        { label: "Department",      icon: Building2,  key: "Department",    type: "text"  },
                        { label: "Company",         icon: Building2,  key: "Company",       type: "text"  },
                        { label: "Position",        icon: Briefcase,  key: "Position",      type: "text"  },
                        { label: "Role",            icon: ShieldCheck, key: "Role",         type: "text"  },
                      ].map(({ label, icon, key, type }) => (
                        <FormField key={key} label={label} icon={icon}>
                          <Input type={type}
                            value={(user as any)[key] ?? ""}
                            onChange={e => setUser({ ...user, [key]: e.target.value })}
                            className="h-9 rounded-none text-xs focus-visible:ring-0"
                            style={{ backgroundColor: C.bg, borderColor: C.border, color: C.text, fontFamily: C.font }}
                            onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                            onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                        </FormField>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="border" style={{ borderColor: C.border, backgroundColor: C.panel }}>
                    <div className="px-4 py-3 border-b flex items-center gap-2"
                      style={{ borderColor: C.border, backgroundColor: C.bg }}>
                      <ShieldCheck className="size-3.5" style={{ color: C.accent }} />
                      <span className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: C.accent }}>Account Status</span>
                    </div>
                    <div className="p-4">
                      <Select value={user.Status} onValueChange={val => setUser({ ...user, Status: val })}>
                        <SelectTrigger className="h-9 rounded-none text-xs focus:ring-0"
                          style={{ backgroundColor: C.bg, borderColor: C.border, color: C.text, fontFamily: C.font }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent style={{ backgroundColor: C.panel, borderColor: C.border, fontFamily: C.font }}>
                          {["Active","Inactive","Locked","Terminated","Resigned","Do Not Disturb","Busy"].map(s => (
                            <SelectItem key={s} value={s}
                              className="text-xs focus:bg-orange-500/10 focus:text-orange-400"
                              style={{ color: C.text }}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="border" style={{ borderColor: C.border, backgroundColor: C.panel }}>
                    <div className="px-4 py-3 border-b flex items-center gap-2"
                      style={{ borderColor: C.border, backgroundColor: C.bg }}>
                      <Lock className="size-3.5" style={{ color: C.accent }} />
                      <span className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: C.accent }}>Change Password</span>
                      <span className="ml-auto text-[9px]" style={{ color: C.dim }}>
                        Leave blank to keep current
                      </span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="New Password" icon={Lock}>
                        <Input type="password" placeholder="••••••••"
                          value={user.Password ?? ""}
                          onChange={e => setUser({ ...user, Password: e.target.value })}
                          className="h-9 rounded-none text-xs tracking-widest focus-visible:ring-0"
                          style={{ backgroundColor: C.bg, borderColor: C.border, color: C.text, fontFamily: C.font }}
                          onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                          onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                        {user.Password && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex gap-0.5 flex-1">
                              {(["weak","medium","strong"] as const).map((lvl, i) => (
                                <div key={lvl} className="h-1 flex-1 transition-colors"
                                  style={{
                                    backgroundColor:
                                      ["weak","medium","strong"].indexOf(strength) >= i
                                        ? STRENGTH_COLOR[strength as keyof typeof STRENGTH_COLOR] ?? C.muted
                                        : C.muted,
                                  }} />
                              ))}
                            </div>
                            <span className="text-[9px] font-bold uppercase"
                              style={{ color: STRENGTH_COLOR[strength as keyof typeof STRENGTH_COLOR] ?? C.dim }}>
                              {strength}
                            </span>
                          </div>
                        )}
                      </FormField>
                      <FormField label="Confirm Password" icon={Lock}>
                        <Input type="password" placeholder="••••••••"
                          value={user.ConfirmPassword ?? ""}
                          onChange={e => setUser({ ...user, ConfirmPassword: e.target.value })}
                          className="h-9 rounded-none text-xs tracking-widest focus-visible:ring-0"
                          style={{
                            backgroundColor: C.bg,
                            borderColor: user.ConfirmPassword && user.Password !== user.ConfirmPassword
                              ? "#f87171" : C.border,
                            color: C.text, fontFamily: C.font,
                          }}
                          onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                          onBlur={e  => (e.currentTarget.style.borderColor =
                            user.ConfirmPassword && user.Password !== user.ConfirmPassword
                              ? "#f87171" : C.border)} />
                        {user.ConfirmPassword && user.Password !== user.ConfirmPassword && (
                          <p className="text-[9px] mt-1" style={{ color: "#f87171" }}>
                            Passwords do not match
                          </p>
                        )}
                      </FormField>
                    </div>
                  </div>

                  {/* Save */}
                  <div className="flex justify-end">
                    <button type="submit" disabled={loading}
                      className="flex items-center gap-2 h-9 px-6 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                      style={{ backgroundColor: C.accent, borderColor: C.accent, color: "#fff" }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#ff7a1a"; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.accent; }}>
                      {loading ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                      {loading ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </form>

                {/* Biometric */}
                <BiometricSettings
                  userId={user.id}
                  userName={user.Email}
                  userDisplayName={`${user.Firstname} ${user.Lastname}`}
                />

                {/* 2FA */}
                <TwoFactorSetup />

              </div>
            )}
          </div>

        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
