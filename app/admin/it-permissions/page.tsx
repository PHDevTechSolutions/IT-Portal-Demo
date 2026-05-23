"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, Shield, ShieldCheck, Users, LayoutGrid,
  X, Save, UserCog, Lock, Unlock, RefreshCw, Download, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserAccount {
  _id: string; ReferenceID: string; Firstname: string; Lastname: string;
  Email: string; Department: string; Company: string; Position: string;
  Role: string; Status: string; Directories?: string[];
}
interface SidebarModule {
  key: string; title: string; icon: string; description: string;
  items: { title: string; url: string }[];
}
interface RolePermission { role: string; department: string; modules: string[]; submodules: string[]; }

const IT_ROLES = ["IT Staff", "IT Admin", "IT Manager", "IT Support", "Developer"];

// ─── Color tokens ─────────────────────────────────────────────────────────────
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

const ROLE_BADGE: Record<string, string> = {
  "IT Staff":   "bg-sky-500/15 text-sky-400 border-sky-500/30",
  "IT Admin":   "bg-violet-500/15 text-violet-400 border-violet-500/30",
  "IT Manager": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "IT Support": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Developer:    "bg-pink-500/15 text-pink-400 border-pink-500/30",
  SuperAdmin:   "bg-orange-500/15 text-orange-400 border-orange-500/30",
};
const STATUS_BADGE: Record<string, string> = {
  active:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  terminated: "bg-red-500/15 text-red-400 border-red-500/30",
  resigned:   "bg-red-500/15 text-red-400 border-red-500/30",
  inactive:   "bg-slate-500/15 text-slate-400 border-slate-500/30",
  locked:     "bg-amber-500/15 text-amber-400 border-amber-500/30",
};
const rb = (r: string) => ROLE_BADGE[r]   ?? "bg-slate-500/15 text-slate-400 border-slate-500/30";
const sb = (s: string) => STATUS_BADGE[s?.toLowerCase()] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ITPermissionsPage() {
  const router = useRouter();

  const [users,          setUsers]          = useState<UserAccount[]>([]);
  const [isFetching,     setIsFetching]     = useState(false);
  const [search,         setSearch]         = useState("");
  const [filterRole,     setFilterRole]     = useState("all");
  const [sidebarModules, setSidebarModules] = useState<SidebarModule[]>([]);
  const [rolePermissions,setRolePermissions]= useState<RolePermission[]>([]);
  const [isLoadingRole,  setIsLoadingRole]  = useState(true);

  // Per-user dirty permission state: userId → Set<permKey>
  const [dirtyPerms, setDirtyPerms] = useState<Record<string, Set<string>>>({});
  // Which users have unsaved changes
  const [savingIds,  setSavingIds]  = useState<Set<string>>(new Set());

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/SidebarModules")
      .then(r => r.json())
      .then(d => { if (d.success) setSidebarModules(d.modules); })
      .catch(() => toast.error("Failed to fetch modules"));
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res  = await fetch("/api/me", { cache: "no-store" });
        const data = await res.json();
        if (data.role !== "SuperAdmin") { toast.error("Access Denied"); router.push("/dashboard"); }
      } catch { router.push("/dashboard"); }
      finally { setIsLoadingRole(false); }
    };
    check();
  }, [router]);

  useEffect(() => {
    const load = async () => {
      setIsFetching(true);
      const tid = toast.loading("Loading IT users…");
      try {
        const res  = await fetch("/api/ITPermissions/FetchUsers");
        const data = await res.json();
        if (data.success) { setUsers(data.users || []); toast.success("Loaded", { id: tid }); }
        else throw new Error(data.message);
      } catch { toast.error("Failed to load users", { id: tid }); }
      finally { setIsFetching(false); }
    };
    load();
  }, []);

  useEffect(() => {
    fetch("/api/ITPermissions/FetchRolePermissions")
      .then(r => r.json())
      .then(d => { if (d.success) setRolePermissions(d.permissions || []); })
      .catch(() => {});
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  // Get effective permissions for a user (dirty overrides saved)
  const getPerms = useCallback((user: UserAccount): Set<string> => {
    if (dirtyPerms[user._id]) return dirtyPerms[user._id];
    return new Set(user.Directories ?? []);
  }, [dirtyPerms]);

  const isDirty = (userId: string) => !!dirtyPerms[userId];

  const togglePerm = (user: UserAccount, key: string, isModule: boolean) => {
    setDirtyPerms(prev => {
      const base = new Set(prev[user._id] ?? (user.Directories ?? []));
      if (isModule) {
        const mod = sidebarModules.find(m => m.key === key);
        const subs = mod?.items.map(i => `${key}:${i.title}`) ?? [];
        if (base.has(key)) { base.delete(key); subs.forEach(s => base.delete(s)); }
        else               { base.add(key);    subs.forEach(s => base.add(s)); }
      } else {
        // submodule: auto-enable parent
        const [modKey] = key.split(":");
        if (base.has(key)) { base.delete(key); }
        else               { base.add(key); base.add(modKey); }
      }
      return { ...prev, [user._id]: base };
    });
  };

  const grantAll = (user: UserAccount) => {
    const all = new Set(sidebarModules.flatMap(m => [m.key, ...m.items.map(i => `${m.key}:${i.title}`)]));
    setDirtyPerms(prev => ({ ...prev, [user._id]: all }));
  };

  const revokeAll = (user: UserAccount) => {
    setDirtyPerms(prev => ({ ...prev, [user._id]: new Set() }));
  };

  const applyRoleDefault = (user: UserAccount) => {
    const rp = rolePermissions.find(r => r.role === user.Role && r.department === "IT");
    if (rp) {
      setDirtyPerms(prev => ({ ...prev, [user._id]: new Set([...rp.modules, ...rp.submodules]) }));
      toast.info(`Applied defaults for ${user.Role}`);
    } else toast.warning(`No defaults for ${user.Role}`);
  };

  const discardChanges = (userId: string) => {
    setDirtyPerms(prev => { const n = { ...prev }; delete n[userId]; return n; });
  };

  const saveUser = async (user: UserAccount) => {
    const perms = Array.from(getPerms(user));
    setSavingIds(prev => new Set(prev).add(user._id));
    const tid = toast.loading(`Saving ${user.Firstname}…`);
    try {
      const res  = await fetch("/api/ITPermissions/UpdatePermissions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user._id, permissions: perms }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setUsers(prev => prev.map(u => u._id === user._id ? { ...u, Directories: perms } : u));
      setDirtyPerms(prev => { const n = { ...prev }; delete n[user._id]; return n; });
      toast.success("Saved!", { id: tid });
    } catch (err: any) { toast.error(err.message ?? "Save failed", { id: tid }); }
    finally { setSavingIds(prev => { const n = new Set(prev); n.delete(user._id); return n; }); }
  };

  // ── Filtered ──────────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() =>
    users
      .filter(u => [u.Firstname, u.Lastname, u.Email, u.Role, u.Position]
        .some(f => f?.toLowerCase().includes(search.toLowerCase())))
      .filter(u => filterRole === "all" || u.Role === filterRole)
      .sort((a, b) => `${a.Firstname} ${a.Lastname}`.localeCompare(`${b.Firstname} ${b.Lastname}`)),
    [users, search, filterRole]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:   users.length,
    active:  users.filter(u => u.Status?.toLowerCase() === "active").length,
    modules: sidebarModules.length,
    roles:   IT_ROLES.length,
  }), [users, sidebarModules]);

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: C.bg }}>
        <Loader2 className="size-5 animate-spin" style={{ color: C.accent }} />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <UserProvider>
      <FormatProvider>
        <ProtectedPageWrapper>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex flex-col h-svh overflow-hidden"
              style={{ backgroundColor: C.bg, fontFamily: C.font, color: C.text }}>

              {/* Dot-grid */}
              <div className="fixed inset-0 pointer-events-none" style={{
                backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
                backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
              }} />

              {/* ── Header ── */}
              <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b"
                style={{ backgroundColor: C.bg, borderColor: C.border }}>
                <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
                <div className="w-px h-4" style={{ backgroundColor: C.border }} />
                <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}
                  className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest rounded-none hover:bg-transparent"
                  style={{ color: C.dim }}>Home</Button>
                <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Admin</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>IT Permissions</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <div className="ml-auto flex items-center gap-1.5">
                  {isFetching && <Loader2 className="size-3 animate-spin" style={{ color: C.accent }} />}
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Live</span>
                </div>
              </header>

              {/* ── Title bar ── */}
              <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b"
                style={{ borderColor: C.border, backgroundColor: C.panel }}>
                <div className="flex h-8 w-8 items-center justify-center border"
                  style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
                  <ShieldCheck className="size-4" style={{ color: C.accent }} />
                </div>
                <div>
                  <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>IT Permissions</h1>
                  <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>Manage module access for IT users</p>
                </div>
                <div className="ml-auto hidden md:flex items-center gap-3 text-[10px] uppercase tracking-widest">
                  <span style={{ color: C.muted }}>{users.length} users</span>
                  <div className="w-px h-3" style={{ backgroundColor: C.border }} />
                  <span style={{ color: C.dim }}>{sidebarModules.length} modules</span>
                </div>
              </div>

              {/* ── Stats bar ── */}
              <div className="relative z-10 shrink-0 grid grid-cols-4 border-b" style={{ borderColor: C.border }}>
                {[
                  { label: "Total Users", value: stats.total,   color: C.text,    icon: Users },
                  { label: "Active",      value: stats.active,  color: "#34d399", icon: ShieldCheck },
                  { label: "Modules",     value: stats.modules, color: "#60a5fa", icon: LayoutGrid },
                  { label: "IT Roles",    value: stats.roles,   color: "#a78bfa", icon: UserCog },
                ].map(({ label, value, color, icon: Icon }, i) => (
                  <div key={i} className="flex flex-col items-center justify-center py-3 border-r last:border-r-0"
                    style={{ borderColor: C.border, backgroundColor: C.panel }}>
                    <span className="text-lg font-bold leading-none" style={{ color }}>{value}</span>
                    <span className="text-[9px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* ── Toolbar ── */}
              <div className="relative z-10 shrink-0 flex items-center gap-2 px-4 py-2 border-b flex-wrap"
                style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
                  <input placeholder="Search users…" value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                    style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                  {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-3" style={{ color: C.dim }} /></button>}
                </div>
                <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                  className="h-8 text-[11px] px-2 focus:outline-none"
                  style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                  <option value="all">All Roles</option>
                  {IT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="flex-1" />
                <span className="text-[10px]" style={{ color: C.muted }}>
                  Click checkboxes inline · Save per row
                </span>
              </div>

              {/* ── Table ── */}
              <div className="relative z-10 flex-1 overflow-auto">
                {isFetching ? (
                  <div className="flex items-center justify-center h-full gap-3">
                    <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                    <span className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>Loading…</span>
                  </div>
                ) : (
                  <table className="w-full border-collapse" style={{ fontSize: "11px", fontFamily: C.font }}>
                    <thead className="sticky top-0 z-10">
                      {/* ── Row 1: module group headers ── */}
                      <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                        {/* Fixed identity columns */}
                        <th className="text-left px-3 py-2 whitespace-nowrap font-bold uppercase tracking-widest text-[9px]"
                          style={{ color: C.accent, borderRight: `1px solid ${C.border}`, minWidth: 180 }}>User</th>
                        <th className="text-left px-3 py-2 whitespace-nowrap font-bold uppercase tracking-widest text-[9px]"
                          style={{ color: C.accent, borderRight: `1px solid ${C.border}`, minWidth: 90 }}>Role</th>
                        <th className="text-left px-3 py-2 whitespace-nowrap font-bold uppercase tracking-widest text-[9px]"
                          style={{ color: C.accent, borderRight: `1px solid ${C.border}`, minWidth: 80 }}>Status</th>
                        {/* Module group headers — span all submodule cols + 1 for the module checkbox */}
                        {sidebarModules.map(m => (
                          <th key={m.key}
                            colSpan={1 + m.items.length}
                            className="text-center px-2 py-2 font-bold uppercase tracking-widest text-[9px] border-l"
                            style={{ color: C.accent, borderColor: C.border, backgroundColor: "rgba(232,99,10,0.06)" }}>
                            {m.title}
                          </th>
                        ))}
                        {/* Actions */}
                        <th className="text-center px-3 py-2 whitespace-nowrap font-bold uppercase tracking-widest text-[9px] border-l"
                          style={{ color: C.accent, borderColor: C.border, minWidth: 160 }}>Actions</th>
                      </tr>
                      {/* ── Row 2: sub-column labels ── */}
                      <tr style={{ backgroundColor: "#0a0f18", borderBottom: `1px solid ${C.border}` }}>
                        <th style={{ borderRight: `1px solid ${C.border}` }} />
                        <th style={{ borderRight: `1px solid ${C.border}` }} />
                        <th style={{ borderRight: `1px solid ${C.border}` }} />
                        {sidebarModules.map(m => (
                          <>
                            {/* Module-level checkbox header */}
                            <th key={`${m.key}-all`}
                              className="text-center px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider border-l"
                              style={{ color: C.dim, borderColor: C.border, minWidth: 52, backgroundColor: "rgba(232,99,10,0.04)" }}>
                              All
                            </th>
                            {m.items.map(item => (
                              <th key={`${m.key}:${item.title}`}
                                className="text-center px-1 py-1.5 text-[9px] uppercase tracking-wide"
                                style={{ color: C.dim, borderLeft: `1px solid ${C.muted}20`, minWidth: 64, maxWidth: 80 }}>
                                <span className="block truncate max-w-[72px] mx-auto" title={item.title}>{item.title}</span>
                              </th>
                            ))}
                          </>
                        ))}
                        <th style={{ borderLeft: `1px solid ${C.border}` }} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={3 + sidebarModules.reduce((a, m) => a + 1 + m.items.length, 0) + 1}
                            className="text-center py-16" style={{ color: C.muted }}>
                            No IT users found.
                          </td>
                        </tr>
                      ) : filteredUsers.map((user, i) => {
                        const perms   = getPerms(user);
                        const dirty   = isDirty(user._id);
                        const saving  = savingIds.has(user._id);
                        const rowBg   = i % 2 === 0 ? C.bg : C.panel;
                        return (
                          <tr key={user._id}
                            style={{ backgroundColor: dirty ? "rgba(232,99,10,0.04)" : rowBg, borderBottom: `1px solid ${C.border}` }}>

                            {/* Identity */}
                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              <p className="font-semibold" style={{ color: C.text }}>{user.Firstname} {user.Lastname}</p>
                              <p className="text-[10px] mt-0.5 truncate max-w-[160px]" style={{ color: C.dim }}>{user.Email}</p>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${rb(user.Role)}`}>{user.Role}</span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${sb(user.Status)}`}>{user.Status}</span>
                            </td>

                            {/* Module + submodule checkboxes */}
                            {sidebarModules.map(m => (
                              <>
                                {/* Module-level "All" checkbox */}
                                <td key={`${user._id}-${m.key}`}
                                  className="text-center px-2 py-2 border-l"
                                  style={{ borderColor: C.border, backgroundColor: "rgba(232,99,10,0.03)" }}>
                                  <Checkbox
                                    checked={perms.has(m.key)}
                                    onCheckedChange={() => togglePerm(user, m.key, true)}
                                    className="h-3.5 w-3.5 rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                  />
                                </td>
                                {/* Submodule checkboxes */}
                                {m.items.map(item => {
                                  const key = `${m.key}:${item.title}`;
                                  return (
                                    <td key={`${user._id}-${key}`}
                                      className="text-center px-1 py-2"
                                      style={{ borderLeft: `1px solid ${C.muted}20` }}>
                                      <Checkbox
                                        checked={perms.has(key)}
                                        onCheckedChange={() => togglePerm(user, key, false)}
                                        className="h-3.5 w-3.5 rounded-none border-slate-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                      />
                                    </td>
                                  );
                                })}
                              </>
                            ))}

                            {/* Actions */}
                            <td className="px-3 py-2 border-l" style={{ borderColor: C.border }}>
                              <div className="flex items-center gap-1.5 justify-center flex-wrap">
                                <button onClick={() => grantAll(user)} title="Grant all"
                                  className="h-6 px-2 text-[9px] font-bold uppercase tracking-wider border transition-colors"
                                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#34d399"; e.currentTarget.style.color = "#34d399"; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                                  All
                                </button>
                                <button onClick={() => revokeAll(user)} title="Revoke all"
                                  className="h-6 px-2 text-[9px] font-bold uppercase tracking-wider border transition-colors"
                                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                                  None
                                </button>
                                {dirty && !saving && (
                                  <button onClick={() => discardChanges(user._id)} title="Discard"
                                    className="h-6 px-2 text-[9px] font-bold uppercase tracking-wider border transition-colors"
                                    style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                                    <X className="size-3" />
                                  </button>
                                )}
                                <button onClick={() => saveUser(user)} disabled={!dirty || saving}
                                  className="h-6 px-2 text-[9px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-30"
                                  style={{
                                    borderColor: dirty ? C.accent : C.border,
                                    color: dirty ? C.accent : C.dim,
                                    backgroundColor: dirty ? "rgba(232,99,10,0.1)" : "transparent",
                                  }}>
                                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
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

              {/* ── Footer ── */}
              <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-2 border-t"
                style={{ borderColor: C.border, backgroundColor: C.panel }}>
                <span className="text-[10px]" style={{ color: C.muted }}>
                  <span style={{ color: C.text }}>{filteredUsers.length}</span> users shown ·{" "}
                  <span style={{ color: C.accent }}>{Object.keys(dirtyPerms).length}</span> unsaved
                </span>
                <span className="text-[10px]" style={{ color: C.muted }}>
                  Orange highlight = unsaved changes · Save icon activates on change
                </span>
              </div>

            </SidebarInset>
          </SidebarProvider>
        </ProtectedPageWrapper>
      </FormatProvider>
    </UserProvider>
  );
}
