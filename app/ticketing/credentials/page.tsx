"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, Key, ChevronLeft, ChevronRight,
  BadgeCheck, XCircle, Lock, Unlock, User, Pencil, Trash2, ShieldCheck,
  Eye, EyeOff,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Credential {
  _id:           string;
  Email:         string;
  Role:          string;
  Firstname:     string;
  Lastname:      string;
  ReferenceID:   string;
  Status:        string;
  ContactNumber: string;
  Department:    string;
  createdAt:     string | null;
  updatedAt:     string | null;
  LoginAttempts: number;
  LockUntil:     string | null;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:      "#080d12",
  panel:   "#0d1117",
  border:  "#1a2535",
  muted:   "#253040",
  dim:     "#4a6070",
  text:    "#c8d8e8",
  accent:  "#e8630a",
  font:    "'JetBrains Mono','Fira Code',monospace",
  success: "#34d399",
  warn:    "#fbbf24",
  error:   "#f87171",
  info:    "#60a5fa",
};

const PAGE_SIZE = 50;

function statusColor(status: string) {
  const s = (status ?? "").toLowerCase();
  if (s === "active")   return { color: C.success, bg: `${C.success}10`, border: `${C.success}40` };
  if (s === "inactive") return { color: C.error,   bg: `${C.error}10`,   border: `${C.error}40`   };
  return                       { color: C.dim,     bg: `${C.dim}10`,     border: `${C.dim}40`     };
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function Field({ label, value, onChange, type = "text", options }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; options?: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] uppercase tracking-widest font-bold" style={{ color: `${C.accent}80` }}>
        {label}
      </label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full h-8 px-2 text-[11px] focus:outline-none"
          style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          className="w-full h-8 px-2 text-[11px] focus:outline-none"
          style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
          onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
          onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
      )}
    </div>
  );
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────
function EditDialog({ user, onClose, onSaved }: {
  user: Credential; onClose: () => void; onSaved: (updated: Credential) => void;
}) {
  const [form, setForm] = useState({
    Firstname:     user.Firstname     ?? "",
    Lastname:      user.Lastname      ?? "",
    Email:         user.Email         ?? "",
    Role:          user.Role          ?? "",
    Department:    user.Department    ?? "",
    ContactNumber: user.ContactNumber ?? "",
    Status:        user.Status        ?? "Active",
    ReferenceID:   user.ReferenceID   ?? "",
  });
  const [newPassword,  setNewPassword]  = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [tab,          setTab]          = useState<"info" | "password">("info");

  const save = async () => {
    setSaving(true);
    try {
      const body: any = { _id: user._id, ...form };
      if (tab === "password" && newPassword.trim()) {
        body.resetPassword = newPassword.trim();
      }
      const res  = await fetch("/api/helpdesk/credentials", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Save failed");
      toast.success(tab === "password" ? "Password reset successfully." : "User updated.");
      onSaved({ ...user, ...form, updatedAt: new Date().toISOString() });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="flex flex-col border shadow-2xl" style={{
        borderColor: C.border, backgroundColor: C.bg,
        width: "min(560px, 96vw)", maxHeight: "88vh", fontFamily: C.font,
      }}>
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b flex items-center gap-3"
          style={{ borderColor: C.border, backgroundColor: C.panel }}>
          <div className="p-2 border" style={{ borderColor: C.border }}>
            <Pencil className="size-4" style={{ color: C.accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
              Edit User
            </h2>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: C.dim }}>
              {user.Firstname} {user.Lastname} · {user.Email}
            </p>
          </div>
          <button onClick={onClose} style={{ color: C.dim }}
            onMouseEnter={e => (e.currentTarget.style.color = C.error)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
            <X className="size-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex shrink-0 border-b" style={{ borderColor: C.border }}>
          {(["info", "password"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 text-[9px] uppercase tracking-widest font-bold transition-colors"
              style={{
                color: tab === t ? C.accent : C.dim,
                borderBottom: tab === t ? `2px solid ${C.accent}` : "2px solid transparent",
                backgroundColor: "transparent",
              }}>
              {t === "info" ? "User Info" : "Reset Password"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "info" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name"    value={form.Firstname}     onChange={v => setForm(f => ({ ...f, Firstname: v }))} />
              <Field label="Last Name"     value={form.Lastname}      onChange={v => setForm(f => ({ ...f, Lastname: v }))} />
              <Field label="Email"         value={form.Email}         onChange={v => setForm(f => ({ ...f, Email: v }))} type="email" />
              <Field label="Reference ID"  value={form.ReferenceID}   onChange={v => setForm(f => ({ ...f, ReferenceID: v }))} />
              <Field label="Role"          value={form.Role}          onChange={v => setForm(f => ({ ...f, Role: v }))} />
              <Field label="Department"    value={form.Department}    onChange={v => setForm(f => ({ ...f, Department: v }))} />
              <Field label="Contact Number" value={form.ContactNumber} onChange={v => setForm(f => ({ ...f, ContactNumber: v }))} />
              <Field label="Status"        value={form.Status}        onChange={v => setForm(f => ({ ...f, Status: v }))}
                options={["Active", "Inactive"]} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 border" style={{ borderColor: `${C.warn}30`, backgroundColor: `${C.warn}05` }}>
                <p className="text-[10px]" style={{ color: C.warn }}>
                  ⚠ Setting a new password will also reset login attempts and unlock the account.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest font-bold" style={{ color: `${C.accent}80` }}>
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password…"
                    className="w-full h-9 px-3 pr-10 text-[11px] focus:outline-none"
                    style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: C.dim }}>
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {newPassword && (
                  <p className="text-[9px] mt-1" style={{ color: newPassword.length >= 8 ? C.success : C.warn }}>
                    {newPassword.length >= 8 ? "✓ Strong enough" : `${8 - newPassword.length} more characters needed`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t flex items-center justify-end gap-2"
          style={{ borderColor: C.border, backgroundColor: C.panel }}>
          <button onClick={onClose}
            className="h-8 px-4 text-[9px] uppercase tracking-widest border transition-colors"
            style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving || (tab === "password" && !newPassword.trim())}
            className="flex items-center gap-1.5 h-8 px-4 text-[9px] font-bold uppercase tracking-widest border disabled:opacity-40 transition-colors"
            style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
            {saving ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
            {tab === "password" ? "Reset Password" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────
function DeleteDialog({ user, onClose, onDeleted }: {
  user: Credential; onClose: () => void; onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      const res  = await fetch("/api/helpdesk/credentials", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: user._id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Delete failed");
      toast.success(`Deleted ${user.Firstname} ${user.Lastname}.`);
      onDeleted(user._id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="border shadow-2xl" style={{
        borderColor: `${C.error}40`, backgroundColor: C.bg,
        width: "min(420px, 96vw)", fontFamily: C.font,
      }}>
        <div className="px-5 py-4 border-b flex items-center gap-3"
          style={{ borderColor: `${C.error}20`, backgroundColor: C.panel }}>
          <div className="p-2 border" style={{ borderColor: `${C.error}30`, backgroundColor: `${C.error}10` }}>
            <Trash2 className="size-4" style={{ color: C.error }} />
          </div>
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.error }}>
              Delete User
            </h2>
            <p className="text-[10px] mt-0.5" style={{ color: C.dim }}>This action cannot be undone.</p>
          </div>
          <button onClick={onClose} className="ml-auto" style={{ color: C.dim }}
            onMouseEnter={e => (e.currentTarget.style.color = C.error)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px]" style={{ color: C.text }}>
            Are you sure you want to permanently delete:
          </p>
          <div className="mt-2 p-3 border" style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <p className="text-[11px] font-bold" style={{ color: C.text }}>
              {user.Firstname} {user.Lastname}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: C.dim }}>{user.Email}</p>
            <p className="text-[9px] mt-0.5" style={{ color: C.info }}>{user.ReferenceID}</p>
          </div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2"
          style={{ borderColor: `${C.error}20`, backgroundColor: C.panel }}>
          <button onClick={onClose}
            className="h-8 px-4 text-[9px] uppercase tracking-widest border transition-colors"
            style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
            Cancel
          </button>
          <button onClick={confirm} disabled={deleting}
            className="flex items-center gap-1.5 h-8 px-4 text-[9px] font-bold uppercase tracking-widest border disabled:opacity-40"
            style={{ borderColor: `${C.error}50`, color: C.error, backgroundColor: `${C.error}10` }}>
            {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CredentialsPage() {
  const router = useRouter();

  const [users,       setUsers]       = useState<Credential[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [editTarget,  setEditTarget]  = useState<Credential | null>(null);
  const [delTarget,   setDelTarget]   = useState<Credential | null>(null);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async (q: string, pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search: q, page: String(pg), limit: String(PAGE_SIZE) });
      const res  = await fetch(`/api/helpdesk/credentials?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Fetch failed");
      setUsers(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(search, page); }, [page]);

  const handleSearch = (val: string) => {
    setSearch(val); setPage(1);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchUsers(val, 1), 400);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const COL_HEADERS = [
    "#", "Reference ID", "Name", "Email", "Role", "Department",
    "Contact", "Status", "Login Attempts", "Locked Until", "Created", "Updated", "Actions",
  ];

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden"
          style={{ backgroundColor: C.bg, color: C.text, fontFamily: C.font }}>

          <div className="fixed inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
            backgroundSize: "24px 24px", opacity: 0.12, zIndex: 0,
          }} />

          {/* Header */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b"
            style={{ backgroundColor: C.bg, borderColor: C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <button onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest bg-transparent border-none"
              style={{ color: C.dim }}
              onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>Home</button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/ticketing/tickets"
                    className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>
                    Help Desk
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>
                    Credentials
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto">
              <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase border"
                style={{ borderColor: `${C.success}40`, color: C.success, backgroundColor: `${C.success}10` }}>
                <Key className="size-2.5" /> MongoDB Assets
              </span>
            </div>
          </header>

          {/* Title bar */}
          <div className="relative z-10 shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center border"
                style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <Key className="size-4" style={{ color: C.accent }} />
              </div>
              <div>
                <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                  User Credentials
                </h1>
                <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                  {loading ? "Loading…" : `${total.toLocaleString()} users`}
                </p>
              </div>
            </div>
            <button onClick={() => fetchUsers(search, page)}
              className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
              <RefreshCw className="size-3" /> Refresh
            </button>
          </div>

          {/* Search bar */}
          <div className="relative z-10 shrink-0 flex items-center gap-2 px-4 py-2 border-b"
            style={{ borderColor: C.border, backgroundColor: C.bg }}>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
              <input
                placeholder="Search name, email, role, department, ref ID…"
                value={search} onChange={e => handleSearch(e.target.value)}
                className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
              />
              {loading
                ? <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 animate-spin" style={{ color: C.dim }} />
                : search && <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => handleSearch("")}><X className="size-3" style={{ color: C.dim }} /></button>
              }
            </div>
            <span className="text-[10px] ml-2 shrink-0" style={{ color: C.muted }}>
              {total.toLocaleString()} results
            </span>
          </div>

          {/* Table */}
          <div className="relative z-10 flex-1 overflow-auto">
            {loading && users.length === 0 ? (
              <div className="flex items-center justify-center h-full gap-3">
                <Loader2 className="size-5 animate-spin" style={{ color: C.accent }} />
                <span className="text-[11px] uppercase tracking-widest" style={{ color: C.dim }}>Loading…</span>
              </div>
            ) : (
              <table className="w-full border-collapse" style={{ fontFamily: C.font, fontSize: 11 }}>
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                    {COL_HEADERS.map(h => (
                      <th key={h}
                        className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
                        style={{ color: C.accent, borderRight: `1px solid ${C.border}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan={COL_HEADERS.length}
                      className="text-center py-16 text-[10px] uppercase tracking-widest"
                      style={{ color: C.muted }}>No users found</td></tr>
                  ) : users.map((u, i) => {
                    const sc = statusColor(u.Status);
                    const isLocked = u.LockUntil && new Date(u.LockUntil) > new Date();
                    const td = `px-3 py-2 whitespace-nowrap`;
                    const br = `1px solid ${C.border}15`;
                    return (
                      <tr key={u._id}
                        style={{ backgroundColor: i % 2 === 0 ? "transparent" : `${C.panel}80`, borderBottom: `1px solid ${C.border}20` }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${C.accent}06`)}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? "transparent" : `${C.panel}80`)}>
                        <td className={td} style={{ color: C.muted, borderRight: br, fontSize: 9 }}>{(page-1)*PAGE_SIZE+i+1}</td>
                        <td className={td} style={{ color: C.info, borderRight: br }}>{u.ReferenceID || "—"}</td>
                        <td className={td} style={{ color: C.text, borderRight: br, fontWeight: "bold" }}>
                          <div className="flex items-center gap-1.5">
                            <User className="size-3 shrink-0" style={{ color: C.dim }} />
                            {`${u.Firstname ?? ""} ${u.Lastname ?? ""}`.trim() || "—"}
                          </div>
                        </td>
                        <td className={td} style={{ color: C.dim, borderRight: br }}>{u.Email || "—"}</td>
                        <td className={td} style={{ borderRight: br }}>
                          <span className="px-1.5 py-0.5 border text-[9px] uppercase"
                            style={{ borderColor: `${C.warn}30`, color: C.warn, backgroundColor: `${C.warn}08` }}>
                            {u.Role || "—"}
                          </span>
                        </td>
                        <td className={td} style={{ color: C.dim, borderRight: br }}>{u.Department || "—"}</td>
                        <td className={td} style={{ color: C.dim, borderRight: br }}>{u.ContactNumber || "—"}</td>
                        <td className={td} style={{ borderRight: br }}>
                          <span className="flex items-center gap-1 px-1.5 py-0.5 border text-[9px] font-bold uppercase w-fit"
                            style={{ borderColor: sc.border, color: sc.color, backgroundColor: sc.bg }}>
                            {(u.Status ?? "").toLowerCase() === "active" ? <BadgeCheck className="size-3" /> : <XCircle className="size-3" />}
                            {u.Status || "—"}
                          </span>
                        </td>
                        <td className={td} style={{ borderRight: br, textAlign: "center" }}>
                          <span style={{
                            color: (u.LoginAttempts ?? 0) >= 5 ? C.error : (u.LoginAttempts ?? 0) > 0 ? C.warn : C.dim,
                            fontWeight: (u.LoginAttempts ?? 0) > 0 ? "bold" : "normal",
                          }}>{u.LoginAttempts ?? 0}</span>
                        </td>
                        <td className={td} style={{ borderRight: br }}>
                          {isLocked
                            ? <span className="flex items-center gap-1 text-[9px]" style={{ color: C.error }}><Lock className="size-3" />{formatDate(u.LockUntil)}</span>
                            : <span className="flex items-center gap-1 text-[9px]" style={{ color: C.muted }}><Unlock className="size-3" />—</span>}
                        </td>
                        <td className={td} style={{ color: C.muted, borderRight: br }}>{formatDate(u.createdAt)}</td>
                        <td className={td} style={{ color: C.muted, borderRight: br }}>{formatDate(u.updatedAt)}</td>
                        {/* Actions */}
                        <td className={td}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditTarget(u)}
                              className="flex items-center justify-center h-6 w-6 border transition-colors"
                              style={{ borderColor: `${C.info}30`, color: C.info, backgroundColor: `${C.info}08` }}
                              title="Edit user"
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${C.info}18`)}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${C.info}08`)}>
                              <Pencil className="size-3" />
                            </button>
                            <button onClick={() => setDelTarget(u)}
                              className="flex items-center justify-center h-6 w-6 border transition-colors"
                              style={{ borderColor: `${C.error}30`, color: C.error, backgroundColor: `${C.error}08` }}
                              title="Delete user"
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${C.error}18`)}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${C.error}08`)}>
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-2 border-t"
              style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <span className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>
                Page {page} of {totalPages} · {total.toLocaleString()} total
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="flex items-center justify-center h-6 w-6 border disabled:opacity-30"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}>
                  <ChevronLeft className="size-3" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className="h-6 min-w-[24px] px-1.5 text-[9px] border transition-colors"
                      style={{
                        borderColor: page === p ? C.accent : C.border,
                        color: page === p ? C.accent : C.dim,
                        backgroundColor: page === p ? `${C.accent}10` : "transparent",
                      }}>{p}</button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="flex items-center justify-center h-6 w-6 border disabled:opacity-30"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}>
                  <ChevronRight className="size-3" />
                </button>
              </div>
            </div>
          )}

        </SidebarInset>
      </SidebarProvider>

      {/* Edit dialog */}
      {editTarget && (
        <EditDialog
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={updated => {
            setUsers(prev => prev.map(u => u._id === updated._id ? { ...u, ...updated } : u));
            setEditTarget(null);
          }}
        />
      )}

      {/* Delete dialog */}
      {delTarget && (
        <DeleteDialog
          user={delTarget}
          onClose={() => setDelTarget(null)}
          onDeleted={id => {
            setUsers(prev => prev.filter(u => u._id !== id));
            setTotal(t => t - 1);
            setDelTarget(null);
          }}
        />
      )}
    </ProtectedPageWrapper>
  );
}
