"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Pagination } from "@/components/app-pagination";
import { toast } from "sonner";
import {
  Loader2, Search, ArrowUpDown, Trash2, Pencil, Repeat2, ArrowRight,
  Download, Eye, EyeOff, RotateCcw, UserPlus, SlidersHorizontal, Save,
  X as XIcon, ShieldOff, Zap, Fingerprint, LayoutGrid, Server, Database,
  Activity, AlertTriangle, Users, Lock, UserCheck, Building2, ChevronRight,
  Plus, RefreshCw, ShieldCheck, ShieldAlert, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ButtonGroup } from "@/components/ui/button-group";
import { DeleteDialog } from "@/components/admin/roles/delete";
import { TransferDialog } from "@/components/admin/roles/transfer";
import { ConvertEmailDialog } from "@/components/admin/roles/convert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────────── */

interface UserAccount {
  _id: string; ReferenceID: string; TSM: string; TSMName?: string;
  Manager: string; ManagerName?: string; Location: string;
  Firstname: string; Lastname: string; Email: string;
  Department: string; Company: string; Position: string;
  Role: string; Password?: string; Status: string; TargetQuota: string;
  profilePicture?: string; Directories?: string[];
  LoginAttempts?: number; LockUntil?: Date | null;
}

type SortKey = keyof Pick<UserAccount, "Firstname"|"Lastname"|"Email"|"Department"|"Company"|"Position">;

/* ─── Config ─────────────────────────────────────────────────────── */

const DIRECTORIES = [
  { key: "Ecodesk",   label: "Ecodesk",   description: "CSR ticketing system",             submodules: ["Dashboard","Inquiries","Customer Database","Reports","Taskflow"] },
  { key: "Taskflow",  label: "Taskflow",  description: "Sales tracking, activity, time & motion", submodules: ["Dashboard","Sales Performance","National Call Ranking","Customer Database","Work Management","Reports","Conversion Rates"] },
  { key: "Acculog",   label: "Acculog",   description: "HRIS module",                      submodules: ["Dashboard","Time Attendance","Button - Site Visit","Button - Client Visit","Recruitment"] },
  { key: "Help-Desk", label: "Help Desk", description: "IT ticketing system",              submodules: [] },
  { key: "Stash",     label: "Stash",     description: "IT inventory management",          submodules: [] },
];

const DEFAULT_ROLES = ["User","Manager","Admin","SuperAdmin","Developer"];

const ROLES_BY_DEPARTMENT: Record<string, string[]> = {
  Sales: ["Territory Sales Associate","Territory Sales Manager","Manager"],
  "Sales Project": ["Office Sales"],
  IT: ["IT Staff","IT Admin","IT Manager","IT Support","Developer","SuperAdmin"],
  CSR: ["Staff","Admin","Manager"],
  HR: ["Staff","Manager","Admin"],
  Ecommerce: ["Staff","Manager","Admin"],
  Marketing: ["Staff","Manager","Admin"],
  Engineering: ["Engineer","Senior Engineer","Manager"],
  Admin: ["Staff","Manager","Admin"],
  "Warehouse Operations": ["Staff","Manager","Supervisor"],
  Accounting: ["Staff","Manager","Admin"],
  Owner: ["Owner"],
  Procurement: ["Staff","Manager","Admin"],
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  active:           { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  terminated:       { bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/30"     },
  resigned:         { bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/30"     },
  "do not disturb": { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/30"   },
  locked:           { bg: "bg-rose-500/10",    text: "text-rose-400",    border: "border-rose-500/30"    },
  inactive:         { bg: "bg-slate-500/10",   text: "text-slate-400",   border: "border-slate-500/30"   },
  suspended:        { bg: "bg-orange-500/10",  text: "text-orange-400",  border: "border-orange-500/30"  },
};

const DEPT_STYLES: Record<string, string> = {
  IT:          "text-sky-400    border-sky-500/30    bg-sky-500/10",
  HR:          "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  Sales:       "text-orange-400 border-orange-500/30 bg-orange-500/10",
  Marketing:   "text-pink-400   border-pink-500/30   bg-pink-500/10",
  CSR:         "text-violet-400 border-violet-500/30 bg-violet-500/10",
  "Dev-Team":  "text-amber-400  border-amber-500/30  bg-amber-500/10",
};

function getRolesForDepartment(dept: string): string[] {
  return ROLES_BY_DEPARTMENT[dept] ?? DEFAULT_ROLES;
}

function generateReferenceID(f: string, l: string, loc: string): string {
  if (!f || !l || !loc) return "";
  return f[0].toUpperCase() + l[0].toUpperCase() + "-" + loc + "-" + Math.floor(100000 + Math.random() * 900000);
}

function getDeptStyle(dept: string, position: string): string {
  if (["Guest","Senior Fullstack Developer","IT - OJT"].includes(position)) return DEPT_STYLES["Dev-Team"];
  return DEPT_STYLES[dept] || "text-slate-400 border-slate-600/40 bg-slate-500/10";
}

function getStatusStyle(status: string) {
  return STATUS_STYLES[(status || "").toLowerCase()] ?? { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30" };
}

/* ─── Small helpers ──────────────────────────────────────────────── */

const OpsLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-600 mb-1">{children}</p>
);

const OpsInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref}
      className={cn("w-full bg-[#0a0d14] border border-orange-500/20 text-slate-300 font-mono text-xs px-3 py-2 focus:outline-none focus:border-orange-500/50 rounded-none placeholder:text-slate-700 transition-colors", className)}
      {...props} />
  )
);
OpsInput.displayName = "OpsInput";

function OpsSelect({ value, onValueChange, placeholder, disabled, children }: {
  value: string; onValueChange: (v: string) => void; placeholder?: string;
  disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="h-8 rounded-none bg-[#0a0d14] border border-orange-500/20 text-slate-300 text-[11px] font-mono focus:ring-0 focus:border-orange-500/40 hover:border-orange-500/30 [&>span]:truncate">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-none bg-[#0d1117] border border-orange-500/20">
        {children}
      </SelectContent>
    </Select>
  );
}

const OpsSelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
  <SelectItem value={value} className="text-[11px] font-mono text-slate-300 hover:bg-orange-500/10 hover:text-orange-400 focus:bg-orange-500/10 focus:text-orange-400 rounded-none cursor-pointer">{children}</SelectItem>
);

function StatTile({ icon: Icon, label, value, accent = "#f97316", sub }: {
  icon: any; label: string; value: number | string; accent?: string; sub?: string;
}) {
  return (
    <div className="relative bg-[#0d1117]/60 border border-orange-500/10 px-5 py-4 flex items-center gap-4 group hover:border-orange-500/25 transition-colors">
      <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-orange-500/30" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-orange-500/30" />
      <div className="w-8 h-8 flex items-center justify-center border border-orange-500/15 bg-orange-500/5 shrink-0">
        <Icon size={14} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">{label}</p>
        <p className="text-2xl font-bold tabular-nums text-slate-100 leading-none mt-0.5">{value}</p>
        {sub && <p className="text-[9px] font-mono text-slate-700 mt-0.5">{sub}</p>}
      </div>
      <div className="ml-auto w-px self-stretch opacity-15" style={{ background: accent }} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = getStatusStyle(status);
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wide border", s.bg, s.text, s.border)}>
      {status || "—"}
    </span>
  );
}

function DeptBadge({ dept, position }: { dept: string; position: string }) {
  const cls = getDeptStyle(dept, position);
  const label = ["Guest","Senior Fullstack Developer","IT - OJT"].includes(position) ? "Dev Team" : dept || "—";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wide border", cls)}>
      {label}
    </span>
  );
}

/* ─── Security Badge ─────────────────────────────────────────────── */
function SecurityBadge({ biometric, totp }: { biometric: boolean; totp: boolean }) {
  if (!biometric && !totp) {
    return (
      <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest"
        style={{ color: "#4a6070" }}>
        <ShieldAlert className="size-3" />
        None
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {biometric && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wide border"
          style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "#34d39910" }}>
          <Fingerprint className="size-2.5" /> Biometric
        </span>
      )}
      {totp && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wide border"
          style={{ borderColor: "#60a5fa40", color: "#60a5fa", backgroundColor: "#60a5fa10" }}>
          <KeyRound className="size-2.5" /> 2FA
        </span>
      )}
    </div>
  );
}

/* ─── Form Panel ─────────────────────────────────────────────────── */

interface FormPanelProps {
  open: boolean; onClose: () => void;
  mode: "create" | "edit";
  newUser: Partial<UserAccount> & { Password?: string };
  setNewUser: React.Dispatch<React.SetStateAction<Partial<UserAccount> & { Password?: string }>>;
  isLoading: boolean; isResetting: boolean;
  showPassword: boolean; setShowPassword: (v: boolean) => void;
  formManagers: { label: string; value: string }[];
  formTsms: { label: string; value: string }[];
  accounts: UserAccount[];
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  onResetAccess: () => void;
}

function FormPanel({
  open, onClose, mode, newUser, setNewUser, isLoading, isResetting,
  showPassword, setShowPassword, formManagers, formTsms, accounts,
  onSubmit, onReset, onResetAccess,
}: FormPanelProps) {
  const hasDir = (key: string) => newUser.Directories?.includes(key);

  const toggleDir = (key: string, checked: boolean) => {
    setNewUser(prev => {
      const current = prev.Directories || [];
      if (key === "Ecodesk") {
        if (!checked) return { ...prev, Directories: current.filter(d => !d.startsWith("Ecodesk")) };
        if (!current.includes("Ecodesk")) return { ...prev, Directories: [...current, "Ecodesk"] };
      }
      if (checked) {
        if (!current.includes(key)) return { ...prev, Directories: [...current, key] };
      } else {
        return { ...prev, Directories: current.filter(d => d !== key) };
      }
      return prev;
    });
  };

  const handleCompanyChange = (value: string) => {
    const domain = value === "Ecoshift Corporation" ? "@ecoshiftcorp.com"
      : value === "Disruptive Solutions Inc" ? "@disruptivesolutionsinc.com"
      : value === "Buildchem Solutions" ? "@buildchemsolutions.com" : "";
    setNewUser(prev => {
      const fi = prev.Firstname ? prev.Firstname.charAt(0).toLowerCase() : "";
      const ln = prev.Lastname ? prev.Lastname.toLowerCase() : "";
      const email = fi && ln && domain ? `${fi}.${ln}${domain}` : prev.Email || "";
      return { ...prev, Company: value, Email: email };
    });
  };

  const isEditingLocked = mode === "edit" && (
    (newUser.Status || "").trim().toLowerCase() === "locked" || (newUser.LoginAttempts ?? 0) >= 5
  );

  const inputCls = "w-full bg-[#0a0d14] border border-orange-500/20 text-slate-300 font-mono text-xs px-3 py-2 focus:outline-none focus:border-orange-500/50 rounded-none placeholder:text-slate-700 transition-colors";

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-[#0d1117] border-l border-orange-500/20 p-0 flex flex-col">
        {/* Sheet header */}
        <SheetHeader className="px-5 py-3.5 border-b border-orange-500/15 bg-[#0a0d14] shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[11px] font-mono font-bold uppercase tracking-widest text-orange-400 flex items-center gap-2">
              <div className="w-1 h-4 bg-orange-500" />
              {mode === "edit" ? "Edit Profile" : "New Identity"}
            </SheetTitle>
            <div className="flex items-center gap-2">
              {(mode === "edit" || newUser.Firstname || newUser.Email) && (
                <button onClick={() => { onReset(); onClose(); }}
                  className="text-[10px] font-mono text-slate-600 hover:text-slate-400 border border-slate-800 px-2 py-1 transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>
          {mode === "edit" && newUser.Firstname && (
            <p className="text-[10px] font-mono text-slate-600 mt-0.5 ml-3">
              Target: <span className="text-orange-400/70">{newUser.Firstname} {newUser.Lastname}</span>
            </p>
          )}
        </SheetHeader>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={onSubmit} className="p-5 space-y-4">

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <OpsLabel>Firstname <span className="text-red-500">*</span></OpsLabel>
                <OpsInput placeholder="Firstname" value={newUser.Firstname || ""} disabled={isLoading}
                  onChange={e => { const Firstname = e.target.value; setNewUser(prev => ({ ...prev, Firstname, ReferenceID: generateReferenceID(Firstname, prev.Lastname || "", prev.Location || "") })); }} />
              </div>
              <div>
                <OpsLabel>Lastname <span className="text-red-500">*</span></OpsLabel>
                <OpsInput placeholder="Lastname" value={newUser.Lastname || ""} disabled={isLoading}
                  onChange={e => { const Lastname = e.target.value; setNewUser(prev => ({ ...prev, Lastname, ReferenceID: generateReferenceID(prev.Firstname || "", Lastname, prev.Location || "") })); }} />
              </div>
            </div>

            {/* Location */}
            <div>
              <OpsLabel>Location <span className="text-red-500">*</span></OpsLabel>
              <select className={inputCls} value={newUser.Location || ""} disabled={isLoading}
                onChange={e => { const Location = e.target.value; setNewUser(prev => ({ ...prev, Location, ReferenceID: generateReferenceID(prev.Firstname || "", prev.Lastname || "", Location) })); }}>
                <option value="" className="bg-slate-900">Select Location</option>
                {["NCR","CDO","Davao","Cebu","North-Luzon","Philippines"].map(loc => <option key={loc} value={loc} className="bg-slate-900">{loc}</option>)}
              </select>
            </div>

            {/* Reference ID */}
            <div>
              <OpsLabel>Reference ID</OpsLabel>
              <div className="relative">
                <OpsInput value={newUser.ReferenceID || ""} readOnly className="bg-orange-500/5 text-orange-400/80 pr-8 cursor-default" />
                <Fingerprint size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-500/30" />
              </div>
            </div>

            {/* Company */}
            <div>
              <OpsLabel>Organization</OpsLabel>
              <OpsSelect value={newUser.Company || ""} onValueChange={handleCompanyChange} placeholder="Select company" disabled={isLoading}>
                <OpsSelectItem value="Ecoshift Corporation">Ecoshift Corporation</OpsSelectItem>
                <OpsSelectItem value="Disruptive Solutions Inc">Disruptive Solutions Inc</OpsSelectItem>
                <OpsSelectItem value="Buildchem Solutions">Buildchem Solutions</OpsSelectItem>
              </OpsSelect>
            </div>

            {/* Email */}
            <div>
              <OpsLabel>Email <span className="text-red-500">*</span></OpsLabel>
              <OpsInput type="email" placeholder="Auto-generated from company" value={newUser.Email || ""} disabled={isLoading}
                onChange={e => setNewUser(prev => ({ ...prev, Email: e.target.value }))} />
            </div>

            {/* Department */}
            <div>
              <OpsLabel>Department</OpsLabel>
              <OpsSelect value={newUser.Department || ""} onValueChange={v => setNewUser(prev => ({ ...prev, Department: v, Role: "" }))} placeholder="Select department" disabled={isLoading}>
                {["Sales","IT","CSR","HR","Ecommerce","Marketing","Engineering","Admin","Warehouse Operations","Accounting","Owner","Procurement"].map(d => <OpsSelectItem key={d} value={d}>{d}</OpsSelectItem>)}
              </OpsSelect>
            </div>

            {/* Sales: Manager + TSM */}
            {newUser.Department === "Sales" && (
              <>
                <div>
                  <OpsLabel>Manager</OpsLabel>
                  <OpsSelect value={newUser.Manager || ""} onValueChange={v => { const m = formManagers.find(x => x.value === v); setNewUser(prev => ({ ...prev, Manager: v, ManagerName: m?.label || "", TSM: "", TSMName: "" })); }} placeholder="Select manager" disabled={isLoading}>
                    {formManagers.map(m => <OpsSelectItem key={m.value} value={m.value}>{m.label}</OpsSelectItem>)}
                  </OpsSelect>
                </div>
                <div>
                  <OpsLabel>TSM</OpsLabel>
                  <OpsSelect value={newUser.TSM || ""} onValueChange={v => { const t = formTsms.find(x => x.value === v); const tsmUser = accounts.find(a => a.ReferenceID === v && a.Role === "Territory Sales Manager"); const mgr = tsmUser?.Manager ? formManagers.find(m => m.value === tsmUser.Manager) : null; setNewUser(prev => ({ ...prev, TSM: v, TSMName: t?.label || "", ...(tsmUser?.Manager ? { Manager: tsmUser.Manager, ManagerName: mgr?.label || "" } : {}) })); }} placeholder="Select TSM" disabled={isLoading}>
                    {formTsms.map(t => <OpsSelectItem key={t.value} value={t.value}>{t.label}</OpsSelectItem>)}
                  </OpsSelect>
                </div>
              </>
            )}

            {/* Role */}
            <div>
              <OpsLabel>Role</OpsLabel>
              <OpsSelect value={newUser.Role || ""} onValueChange={v => setNewUser(prev => ({ ...prev, Role: v }))} placeholder={newUser.Department ? "Select role" : "Select department first"} disabled={isLoading || !newUser.Department}>
                {getRolesForDepartment(newUser.Department || "").map(r => <OpsSelectItem key={r} value={r}>{r}</OpsSelectItem>)}
              </OpsSelect>
            </div>

            {/* Position */}
            <div>
              <OpsLabel>Position</OpsLabel>
              <OpsInput placeholder="Position title" value={newUser.Position || ""} disabled={isLoading}
                onChange={e => setNewUser(prev => ({ ...prev, Position: e.target.value }))} />
            </div>

            {/* Status */}
            <div>
              <OpsLabel>Status</OpsLabel>
              <select className={inputCls} value={newUser.Status || "Active"} disabled={isLoading}
                onChange={e => setNewUser(prev => ({ ...prev, Status: e.target.value }))}>
                {["Active","Inactive","Suspended","Terminated","Resigned","Locked"].map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
              </select>
              {(newUser.Status || "").toLowerCase() === "locked" && (
                <p className="text-[10px] font-mono text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle size={10} /> Account locked — reset required</p>
              )}
            </div>

            {/* Locked user reset block */}
            {isEditingLocked && (
              <div className="border border-amber-500/25 bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldOff size={12} className="text-amber-400" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wide text-amber-300">Security Lock Active</span>
                  </div>
                  {(newUser.LoginAttempts ?? 0) > 0 && (
                    <span className="text-[10px] font-mono text-amber-400">{newUser.LoginAttempts}/5 attempts</span>
                  )}
                </div>
                <button type="button" disabled={isResetting || isLoading} onClick={onResetAccess}
                  className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-mono font-bold uppercase tracking-wide text-amber-400 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-colors disabled:opacity-40">
                  {isResetting ? <><Loader2 size={11} className="animate-spin" /> Resetting…</> : <><RotateCcw size={11} /> Reset Access</>}
                </button>
              </div>
            )}

            {/* Password */}
            <div>
              <OpsLabel>Password <span className="text-red-500">*</span></OpsLabel>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <OpsInput type={showPassword ? "text" : "password"} placeholder="Min. 8 characters"
                    value={newUser.Password || ""} disabled={isLoading}
                    className="pr-9"
                    onChange={e => setNewUser(prev => ({ ...prev, Password: e.target.value }))} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors" disabled={isLoading}>
                    {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                <button type="button" disabled={isLoading}
                  onClick={() => { const g = Math.random().toString(36).slice(-10); setNewUser(prev => ({ ...prev, Password: g })); toast.info("Password generated"); }}
                  className="shrink-0 px-3 border border-orange-500/25 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors">
                  <Zap size={12} />
                </button>
              </div>
            </div>

            {/* Directories */}
            <div>
              <OpsLabel>Access Permissions</OpsLabel>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {DIRECTORIES.map(dir => (
                  <div key={dir.key} className={cn("border p-3 transition-colors", hasDir(dir.key) ? "border-orange-500/30 bg-orange-500/5" : "border-orange-500/10 bg-[#0a0d14]/40")}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={!!hasDir(dir.key)} onChange={e => toggleDir(dir.key, e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 accent-orange-500 bg-slate-900" />
                      <div>
                        <span className="text-[11px] font-mono font-semibold text-slate-300">{dir.label}</span>
                        <span className="text-[9px] font-mono text-slate-700 ml-2">{dir.description}</span>
                      </div>
                    </label>
                    {dir.submodules.length > 0 && hasDir(dir.key) && (
                      <div className="mt-2.5 ml-6 pl-3 border-l border-orange-500/15 space-y-1.5">
                        {dir.submodules.map(sub => {
                          const key = `${dir.key}:${sub}`;
                          return (
                            <label key={key} className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={!!hasDir(key)} onChange={e => toggleDir(key, e.target.checked)}
                                className="h-3 w-3 accent-orange-500 bg-slate-900" />
                              <span className="text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors">{sub}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] font-mono font-bold uppercase tracking-widest text-orange-400 border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-colors disabled:opacity-40">
              {isLoading
                ? <><Loader2 size={12} className="animate-spin" />{mode === "edit" ? "Saving…" : "Creating…"}</>
                : mode === "edit"
                  ? <><Save size={12} /> Save Profile</>
                  : <><UserPlus size={12} /> Create Identity</>
              }
            </button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId: currentUserId, email, role, name } = useUser();

  const getAuditHeaders = () => ({
    "Content-Type": "application/json",
    "x-user-id": currentUserId || "",
    "x-user-email": email || "",
    "x-user-role": role || "",
    "x-user-name": name || "",
  });

  /* ── State ── */
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>("Firstname");
  const [sortAsc, setSortAsc] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [viewingUser, setViewingUser] = useState<UserAccount | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [managers, setManagers] = useState<{ label: string; value: string }[]>([]);
  const [tsms, setTsms] = useState<{ label: string; value: string }[]>([]);
  const [formManagers, setFormManagers] = useState<{ label: string; value: string }[]>([]);
  const [formTsms, setFormTsms] = useState<{ label: string; value: string }[]>([]);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState<Partial<UserAccount> & { Password?: string }>({
    ReferenceID: "", TSM: "", Manager: "", Location: "", Firstname: "", Lastname: "",
    Email: "", Department: "", Company: "", Position: "", Role: "", Password: "",
    Status: "Active", TargetQuota: "", Directories: [],
  });

  /* ── Security status map { userId: { biometricEnabled, totpEnabled } } ── */
  const [securityMap, setSecurityMap] = useState<Record<string, { biometricEnabled: boolean; totpEnabled: boolean }>>({});

  /* ── Fetch accounts ── */
  useEffect(() => {
    const load = async () => {
      setIsFetching(true);
      const tid = toast.loading("Syncing user database…");
      try {
        const res  = await fetch("/api/UserManagement/Fetch");
        const data = await res.json() || [];
        setAccounts(data);
        toast.success("Database synchronized", { id: tid });

        // Batch-fetch security status after accounts load
        if (Array.isArray(data) && data.length > 0) {
          const ids = data.map((u: UserAccount) => u._id).join(",");
          fetch(`/api/UserManagement/SecurityStatus?userIds=${ids}`)
            .then(r => r.json())
            .then(d => setSecurityMap(d))
            .catch(() => {});
        }
      } catch { toast.error("Connection failed", { id: tid }); }
      finally { setIsFetching(false); }
    };
    load();
  }, []);

  const selectedAreSales = useMemo(() =>
    accounts.some(a => selectedIds.has(a._id) && a.Department === "Sales"),
    [accounts, selectedIds]);

  /* ── Transfer dialog managers/tsms ── */
  useEffect(() => {
    if (!showTransferDialog || !selectedAreSales) return;
    const load = async () => {
      try {
        const [mr, tr] = await Promise.all([
          fetch("/api/UserManagement/FetchManager?Role=Manager"),
          fetch("/api/UserManagement/FetchTSM?Role=Territory Sales Manager"),
        ]);
        const [md, td] = await Promise.all([mr.json(), tr.json()]);
        setManagers(md.map((m: any) => ({ label: `${m.Firstname} ${m.Lastname}`, value: m.ReferenceID })));
        setTsms(td.map((t: any) => ({ label: `${t.Firstname} ${t.Lastname}`, value: t.ReferenceID })));
      } catch { toast.error("Failed to fetch supervisor data"); }
    };
    load();
  }, [showTransferDialog, selectedAreSales]);

  /* ── Form managers/tsms ── */
  useEffect(() => {
    if (newUser.Department !== "Sales") return;
    const load = async () => {
      try {
        const [mr, tr] = await Promise.all([
          fetch("/api/UserManagement/FetchManager?Role=Manager"),
          fetch("/api/UserManagement/FetchTSM?Role=Territory Sales Manager"),
        ]);
        const [md, td] = await Promise.all([mr.json(), tr.json()]);
        setFormManagers(md.map((m: any) => ({ label: `${m.Firstname} ${m.Lastname}`, value: m.ReferenceID })));
        setFormTsms(td.map((t: any) => ({ label: `${t.Firstname} ${t.Lastname}`, value: t.ReferenceID })));
      } catch { toast.error("Failed to fetch supervisor data"); }
    };
    load();
  }, [newUser.Department]);

  /* ── CRUD ── */
  const resetForm = () => {
    setNewUser({ ReferenceID: "", TSM: "", Manager: "", Location: "", Firstname: "", Lastname: "", Email: "", Department: "", Company: "", Position: "", Role: "", Password: "", Status: "Active", TargetQuota: "", Directories: [] });
    setShowPassword(false);
    setFormMode("create");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === "edit") { await handleSaveEdit(); return; }
    if (!newUser.Firstname || !newUser.Lastname || !newUser.Email || !newUser.Location) { toast.error("Missing required fields"); return; }
    setIsFormLoading(true);
    try {
      const res = await fetch("/api/UserManagement/UserCreate", { method: "POST", headers: getAuditHeaders(), body: JSON.stringify(newUser) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Create failed");
      setAccounts(prev => [...prev, result.data]);
      toast.success("Identity created");
      resetForm(); setFormOpen(false);
    } catch (err) { toast.error((err as Error).message); }
    finally { setIsFormLoading(false); }
  };

  const handleSaveEdit = async () => {
    if (!newUser._id) { toast.error("No user loaded"); return; }
    setIsFormLoading(true);
    const tid = toast.loading("Updating profile…");
    const prevUser = accounts.find(a => a._id === newUser._id);
    try {
      const payload = { ...newUser };
      if (!payload.Password?.trim()) delete payload.Password;
      const res = await fetch("/api/UserManagement/UserUpdate", { method: "PUT", headers: getAuditHeaders(), body: JSON.stringify({ id: newUser._id, ...payload }) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Update failed");

      const savedStatus = (newUser.Status || "").trim().toLowerCase();
      const isSales = (newUser.Department || "").trim().toLowerCase() === "sales";
      const isPark = ["inactive","terminated","resigned"].includes(savedStatus);
      if (isSales && (isPark || savedStatus === "active") && newUser.ReferenceID) {
        try {
          const pr = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/ParkByReferenceId", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ referenceId: newUser.ReferenceID, targetStatus: isPark ? "park" : "Active" }) });
          const pd = await pr.json();
          if (pd.success) toast.info(pd.message);
        } catch {}
      }
      if (isSales && newUser.ReferenceID) {
        const ops: Promise<void>[] = [];
        const sync = async (field: "tsm"|"manager", v: string) => {
          await fetch("/api/UserManagement/TransferTSA", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tsaReferenceId: newUser.ReferenceID, field, newSupervisorReferenceId: v }) });
        };
        if (newUser.TSM && newUser.TSM !== prevUser?.TSM) ops.push(sync("tsm", newUser.TSM));
        if (newUser.Manager && newUser.Manager !== prevUser?.Manager) ops.push(sync("manager", newUser.Manager));
        if (ops.length) { await Promise.all(ops); toast.info("Supervisor data synced"); }
      }
      setAccounts(prev => prev.map(a => a._id === newUser._id ? { ...a, ...newUser } : a));
      toast.success("Profile updated", { id: tid });
      resetForm(); setFormOpen(false);
    } catch (err) { toast.error((err as Error).message, { id: tid }); }
    finally { setIsFormLoading(false); }
  };

  const handleDelete = async () => {
    const tid = toast.loading("Purging accounts…");
    try {
      const res = await fetch("/api/UserManagement/UserDelete", { method: "POST", headers: getAuditHeaders(), body: JSON.stringify({ ids: Array.from(selectedIds) }) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error("Delete failed");
      setAccounts(prev => prev.filter(a => !selectedIds.has(a._id)));
      setSelectedIds(new Set());
      toast.success("Accounts purged", { id: tid });
    } catch { toast.error("Delete failed", { id: tid }); }
    finally { setShowDeleteDialog(false); }
  };

  const handleResetAccess = async () => {
    if (!newUser._id) { toast.error("No user selected"); return; }
    setIsResetting(true);
    const tid = toast.loading("Resetting credentials…");
    try {
      const res = await fetch("/api/UserManagement/ResetClientAccess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: newUser._id }) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Reset failed");
      setNewUser(prev => ({ ...prev, Status: "Active", LoginAttempts: 0, LockUntil: null }));
      setAccounts(prev => prev.map(a => a._id === newUser._id ? { ...a, Status: "Active", LoginAttempts: 0 } : a));
      toast.success("Access reset — user unlocked", { id: tid });
    } catch (err) { toast.error((err as Error).message, { id: tid }); }
    finally { setIsResetting(false); }
  };

  const handleDownload = async () => {
    if (!filtered.length) return;
    setIsDownloading(true);
    const tid = toast.loading("Generating export…");
    try {
      const header = "ReferenceID,Firstname,Lastname,Email,Department,Company,Position,TSM,Manager,Status";
      const rows = filtered.map(u => [u.ReferenceID,u.Firstname,u.Lastname,u.Email,u.Department,u.Company,u.Position,u.TSM,u.Manager,u.Status].map(v => `"${v||""}"`).join(","));
      await new Promise(r => setTimeout(r, 300));
      const blob = new Blob([[header,...rows].join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: `users_${new Date().toISOString().split("T")[0]}.csv` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Export complete", { id: tid });
    } catch { toast.error("Export failed", { id: tid }); }
    finally { setIsDownloading(false); }
  };

  const openEdit = (user: UserAccount) => {
    const copy: Partial<UserAccount> & { Password?: string } = { ...user };
    delete copy.Password;
    setNewUser({ ...copy, Password: "" });
    setFormMode("edit");
    setFormOpen(true);
  };

  /* ── Computed ── */
  const departmentOptions = useMemo(() => ["all", ...Array.from(new Set(accounts.map(a => a.Department).filter(Boolean)))], [accounts]);
  const companyOptions    = useMemo(() => ["all", ...Array.from(new Set(accounts.map(a => a.Company).filter(Boolean)))], [accounts]);
  const statusOptions     = useMemo(() => ["all", ...Array.from(new Set(accounts.map(a => a.Status).filter(Boolean)))], [accounts]);
  const salesRoleOptions  = useMemo(() => ["all", ...Array.from(new Set(accounts.filter(a => a.Department === "Sales").map(a => a.Role).filter(Boolean)))], [accounts]);

  const filtered = useMemo(() => {
    return [...accounts
      .filter(a => [a.Firstname,a.Lastname,a.Email,a.Department,a.Company,a.Position,a.ReferenceID].some(f => f?.toLowerCase().includes(search.toLowerCase())))
      .filter(a => filterDepartment === "all" || a.Department === filterDepartment)
      .filter(a => filterCompany === "all" || a.Company === filterCompany)
      .filter(a => filterStatus === "all" || (a.Status||"").toLowerCase() === filterStatus.toLowerCase())
      .filter(a => filterRole === "all" || filterDepartment !== "Sales" || a.Role === filterRole)
    ].sort((a, b) => {
      const va = (a[sortKey] || "").toLowerCase();
      const vb = (b[sortKey] || "").toLowerCase();
      return va < vb ? (sortAsc ? -1 : 1) : va > vb ? (sortAsc ? 1 : -1) : 0;
    });
  }, [accounts, search, filterDepartment, filterCompany, filterStatus, filterRole, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const current = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const stats = useMemo(() => ({
    total:      accounts.length,
    active:     accounts.filter(a => (a.Status||"").toLowerCase() === "active").length,
    locked:     accounts.filter(a => (a.Status||"").toLowerCase() === "locked").length,
    terminated: accounts.filter(a => ["terminated","resigned"].includes((a.Status||"").toLowerCase())).length,
    departments: new Set(accounts.map(a => a.Department).filter(Boolean)).size,
  }), [accounts]);

  const MASTER_REF = "XLGR-GLOBAL-ERP-000000";
  const handleSort = (key: SortKey) => { if (sortKey === key) setSortAsc(!sortAsc); else { setSortKey(key); setSortAsc(true); } };
  const toggleSelectAll = () => {
    const selectable = current.filter(u => u.ReferenceID !== MASTER_REF).map(u => u._id);
    if (selectedIds.size === selectable.length && selectable.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectable));
  };
  const toggleSelect = (id: string) => { setSelectedIds(prev => { const c = new Set(prev); c.has(id) ? c.delete(id) : c.add(id); return c; }); };

  const hasFilters = filterDepartment !== "all" || filterCompany !== "all" || filterRole !== "all" || filterStatus !== "all";

  const SortHead = ({ col, label }: { col: SortKey; label: string }) => (
    <TableHead onClick={() => handleSort(col)}
      className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400/60 cursor-pointer select-none hover:text-orange-400 transition-colors whitespace-nowrap">
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown size={10} className={sortKey === col ? "text-orange-400" : "text-slate-700"} />
      </div>
    </TableHead>
  );

  /* ─── Color tokens ───────────────────────────────────────────── */
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

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <UserProvider>
      <FormatProvider>
        <ProtectedPageWrapper>
          <TooltipProvider delayDuration={0}>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset className="flex flex-col h-svh overflow-hidden"
                style={{ backgroundColor: C.bg, fontFamily: C.font, color: C.text }}>

                {/* Dot-grid texture */}
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
                        <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>User Accounts</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                  <div className="ml-auto flex items-center gap-1.5">
                    {isFetching && <Loader2 className="size-3 animate-spin" style={{ color: C.accent }} />}
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Live</span>
                  </div>
                </header>

                {/* ── Page title bar ── */}
                <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b"
                  style={{ borderColor: C.border, backgroundColor: C.panel }}>
                  <div className="flex h-8 w-8 items-center justify-center border"
                    style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
                    <Fingerprint className="size-4" style={{ color: C.accent }} />
                  </div>
                  <div>
                    <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Identity Management</h1>
                    <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>Users · Roles · Access Control</p>
                  </div>
                  <div className="ml-auto hidden md:flex items-center gap-3 text-[10px] uppercase tracking-widest">
                    <span style={{ color: C.muted }}>{accounts.length} loaded</span>
                    <div className="w-px h-3" style={{ backgroundColor: C.border }} />
                    <span style={{ color: C.dim }}>{filtered.length} matching</span>
                  </div>
                </div>

                {/* ── Stats bar ── */}
                <div className="relative z-10 shrink-0 grid grid-cols-5 border-b" style={{ borderColor: C.border }}>
                  {[
                    { label: "Total",       value: stats.total,       color: C.text,      icon: Users },
                    { label: "Active",      value: stats.active,      color: "#34d399",   icon: UserCheck },
                    { label: "Locked",      value: stats.locked,      color: "#f87171",   icon: Lock },
                    { label: "Terminated",  value: stats.terminated,  color: "#ef4444",   icon: AlertTriangle },
                    { label: "Departments", value: stats.departments, color: "#60a5fa",   icon: Building2 },
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

                  {/* Search */}
                  <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
                    <input placeholder="Search name, email, ref ID…" value={search}
                      onChange={e => { setSearch(e.target.value); setPage(1); }}
                      className="w-full pl-8 pr-3 h-8 text-[11px] focus:outline-none"
                      style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                    />
                    {search && (
                      <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2">
                        <XIcon className="size-3" style={{ color: C.dim }} />
                      </button>
                    )}
                  </div>

                  {/* Dept filter */}
                  <select value={filterDepartment} onChange={e => { setFilterDepartment(e.target.value); setFilterRole("all"); setPage(1); }}
                    className="h-8 text-[11px] px-2 focus:outline-none"
                    style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                    {departmentOptions.map(d => <option key={d} value={d}>{d === "all" ? "All Depts" : d}</option>)}
                  </select>

                  {/* Status filter */}
                  <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                    className="h-8 text-[11px] px-2 focus:outline-none"
                    style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                    {statusOptions.map(s => <option key={s} value={s}>{s === "all" ? "All Status" : s}</option>)}
                  </select>

                  {/* Sales role filter */}
                  {filterDepartment === "Sales" && (
                    <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); }}
                      className="h-8 text-[11px] px-2 focus:outline-none"
                      style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                      {salesRoleOptions.map(r => <option key={r} value={r}>{r === "all" ? "All Roles" : r}</option>)}
                    </select>
                  )}

                  {hasFilters && (
                    <button onClick={() => { setFilterDepartment("all"); setFilterCompany("all"); setFilterRole("all"); setFilterStatus("all"); setPage(1); }}
                      className="flex items-center gap-1 text-[10px]" style={{ color: C.dim }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                      onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                      <XIcon className="size-3" /> Clear
                    </button>
                  )}

                  <div className="flex-1" />

                  {/* Selection actions */}
                  {selectedIds.size > 0 && (
                    <>
                      <span className="text-[10px] px-2 py-1 border" style={{ borderColor: C.border, color: C.accent, fontFamily: C.font }}>
                        {selectedIds.size} selected
                      </span>
                      {selectedAreSales && (
                        <button onClick={() => setShowTransferDialog(true)}
                          className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                          style={{ backgroundColor: "transparent", borderColor: "#38bdf8", color: "#38bdf8" }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(56,189,248,0.1)" }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent" }}>
                          <ArrowRight className="size-3" /> Transfer
                        </button>
                      )}
                      <button onClick={() => setShowDeleteDialog(true)}
                        className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                        style={{ backgroundColor: "transparent", borderColor: "#f87171", color: "#f87171" }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.1)" }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent" }}>
                        <Trash2 className="size-3" /> Delete {selectedIds.size}
                      </button>
                    </>
                  )}

                  <button onClick={() => setShowConvertDialog(true)}
                    className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                    style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                    <Repeat2 className="size-3" /> Convert
                  </button>

                  <button onClick={handleDownload} disabled={!filtered.length || isDownloading}
                    className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-30"
                    style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                    {isDownloading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />} Export
                  </button>

                  <button onClick={() => { resetForm(); setFormMode("create"); setFormOpen(true); }}
                    className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                    style={{ backgroundColor: "rgba(232,99,10,0.1)", borderColor: C.accent, color: C.accent }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.2)" }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)" }}>
                    <Plus className="size-3" /> New Identity
                  </button>
                </div>

                {/* ── Table ── */}
                <div className="relative z-10 flex-1 overflow-auto">
                  {isFetching ? (
                    <div className="flex items-center justify-center h-full gap-3">
                      <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                      <span className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>Synchronizing…</span>
                    </div>
                  ) : current.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                      <Database className="size-7" style={{ color: C.muted }} />
                      <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No profiles found</p>
                      {hasFilters && (
                        <button onClick={() => { setFilterDepartment("all"); setFilterCompany("all"); setFilterRole("all"); setFilterStatus("all"); }}
                          className="text-[10px] mt-1" style={{ color: C.dim }}>Clear filters</button>
                      )}
                    </div>
                  ) : (
                    <table className="w-full border-collapse" style={{ fontSize: "11px", fontFamily: C.font }}>
                      <thead className="sticky top-0 z-10">
                        <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                          <th className="px-3 py-2.5 w-10" style={{ borderRight: `1px solid ${C.border}` }}>
                            <Checkbox checked={selectedIds.size > 0 && selectedIds.size === current.filter(u => u.ReferenceID !== MASTER_REF).length}
                              onCheckedChange={toggleSelectAll}
                              className="border-orange-500/30 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 rounded-none h-3.5 w-3.5" />
                          </th>
                          <th className="px-3 py-2.5 w-10 text-left text-[9px] font-bold uppercase tracking-widest"
                            style={{ color: C.accent, borderRight: `1px solid ${C.border}` }}>Av</th>
                          {(["Firstname","Email","Department","Company","Position"] as SortKey[]).map((col, i) => (
                            <th key={col} onClick={() => handleSort(col)}
                              className="text-left px-3 py-2.5 whitespace-nowrap font-bold uppercase tracking-widest cursor-pointer select-none"
                              style={{ color: sortKey === col ? C.accent : `${C.accent}99`, fontSize: "9px", borderRight: `1px solid ${C.border}` }}>
                              <div className="flex items-center gap-1">
                                {["Identity","Email","Dept","Org","Position"][i]}
                                <ArrowUpDown className="size-2.5" style={{ color: sortKey === col ? C.accent : C.muted }} />
                              </div>
                            </th>
                          ))}
                          <th className="text-left px-3 py-2.5 whitespace-nowrap font-bold uppercase tracking-widest text-[9px]"
                            style={{ color: `${C.accent}99`, borderRight: `1px solid ${C.border}` }}>Status</th>
                          <th className="text-left px-3 py-2.5 whitespace-nowrap font-bold uppercase tracking-widest text-[9px]"
                            style={{ color: `${C.accent}99`, borderRight: `1px solid ${C.border}` }}>Security</th>
                          <th className="text-right px-3 py-2.5 whitespace-nowrap font-bold uppercase tracking-widest text-[9px]"
                            style={{ color: `${C.accent}99` }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.map((u, i) => (
                          <tr key={u._id}
                            style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel, borderBottom: `1px solid ${C.border}`, cursor: u.ReferenceID === "XLGR-GLOBAL-ERP-000000" ? "default" : "pointer" }}
                            onClick={() => u.ReferenceID !== "XLGR-GLOBAL-ERP-000000" && setViewingUser(u)}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>

                            <td className="px-3 py-2" style={{ borderRight: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(u._id)}
                                onCheckedChange={() => toggleSelect(u._id)}
                                disabled={u.ReferenceID === "XLGR-GLOBAL-ERP-000000"}
                                className="border-orange-500/30 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 rounded-none h-3.5 w-3.5 disabled:opacity-20 disabled:cursor-not-allowed" />
                            </td>

                            <td className="px-3 py-2" style={{ borderRight: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                              {u.profilePicture ? (
                                <img src={u.profilePicture} alt="" className="w-7 h-7 object-cover" style={{ border: `1px solid ${C.border}` }} />
                              ) : (
                                <div className="w-7 h-7 flex items-center justify-center text-[10px] font-bold"
                                  style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(232,99,10,0.05)", color: `${C.accent}80` }}>
                                  {(u.Firstname?.[0] || "")}{(u.Lastname?.[0] || "")}
                                </div>
                              )}
                            </td>

                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              <p className="font-semibold" style={{ color: C.text }}>{u.Firstname} {u.Lastname}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: `${C.accent}60` }}>{u.ReferenceID}</p>
                            </td>

                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              <p className="truncate max-w-[180px]" style={{ color: C.dim }}>{u.Email}</p>
                            </td>

                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              <DeptBadge dept={u.Department} position={u.Position} />
                            </td>

                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              <p style={{ color: C.dim }}>{u.Company || "—"}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{u.Location || "—"}</p>
                            </td>

                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              <p className="truncate max-w-[120px]" style={{ color: C.dim }}>{u.Position || "—"}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{u.Role || "—"}</p>
                            </td>

                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              <StatusBadge status={u.Status} />
                              {(u.LoginAttempts ?? 0) > 0 && (
                                <p className="text-[9px] mt-0.5" style={{ color: "#f87171" }}>{u.LoginAttempts}/5 attempts</p>
                              )}
                            </td>

                            {/* Security column */}
                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              <SecurityBadge
                                biometric={securityMap[u._id]?.biometricEnabled ?? false}
                                totp={securityMap[u._id]?.totpEnabled ?? false}
                              />
                            </td>

                            <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                              {u.ReferenceID === "XLGR-GLOBAL-ERP-000000" ? (
                                <div className="flex items-center justify-end">
                                  <span className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 border"
                                    style={{ borderColor: C.border, color: C.muted }}>
                                    Protected
                                  </span>
                                </div>
                              ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button onClick={() => setViewingUser(u)}
                                      className="w-6 h-6 flex items-center justify-center border transition-all"
                                      style={{ borderColor: C.border, color: C.dim }}
                                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                                      <Eye className="size-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-[10px] font-mono bg-[#0d1117] border-orange-500/20">View</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button onClick={() => openEdit(u)}
                                      className="w-6 h-6 flex items-center justify-center border transition-all"
                                      style={{ borderColor: C.border, color: C.dim }}
                                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                                      <Pencil className="size-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-[10px] font-mono bg-[#0d1117] border-orange-500/20">Edit</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button onClick={() => { setSelectedIds(new Set([u._id])); setShowDeleteDialog(true); }}
                                      className="w-6 h-6 flex items-center justify-center border transition-all"
                                      style={{ borderColor: C.border, color: C.dim }}
                                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171" }}
                                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                                      <Trash2 className="size-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-[10px] font-mono bg-[#0d1117] border-orange-500/20">Delete</TooltipContent>
                                </Tooltip>
                              </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* ── Footer / Pagination ── */}
                <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-2 border-t"
                  style={{ borderColor: C.border, backgroundColor: C.panel }}>
                  <span className="text-[10px]" style={{ color: C.muted }}>
                    Showing{" "}
                    <span style={{ color: C.text }}>
                      {filtered.length === 0 ? 0 : (page - 1) * rowsPerPage + 1}–{Math.min(page * rowsPerPage, filtered.length)}
                    </span>
                    {" "}of{" "}
                    <span style={{ color: C.text }}>{filtered.length}</span>
                    {" "}profiles
                    {selectedIds.size > 0 && <span style={{ color: C.accent }}> · {selectedIds.size} selected</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <select value={String(rowsPerPage)} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                      className="h-7 text-[10px] px-2 focus:outline-none"
                      style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.dim, fontFamily: C.font }}>
                      {[10,20,50,100].map(n => <option key={n} value={n}>{n} rows</option>)}
                    </select>
                    <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />
                  </div>
                </div>

                {/* ── Form Sheet ── */}
                <FormPanel
                  open={formOpen} onClose={() => { setFormOpen(false); }} mode={formMode}
                  newUser={newUser} setNewUser={setNewUser} isLoading={isFormLoading}
                  isResetting={isResetting} showPassword={showPassword} setShowPassword={setShowPassword}
                  formManagers={formManagers} formTsms={formTsms} accounts={accounts}
                  onSubmit={handleSubmit} onReset={resetForm} onResetAccess={handleResetAccess}
                />

                {/* ── View Dialog ── */}
                {viewingUser && (
                  <Dialog open={!!viewingUser} onOpenChange={() => setViewingUser(null)}>
                    <DialogContent className="sm:max-w-xl max-w-[95vw] max-h-[88vh] overflow-y-auto rounded-none p-0 gap-0"
                      style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>

                      <DialogHeader className="px-5 py-4 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                        <div className="flex items-start gap-3">
                          {viewingUser.profilePicture ? (
                            <img src={viewingUser.profilePicture} alt="" className="w-12 h-12 object-cover" style={{ border: `1px solid ${C.border}` }} />
                          ) : (
                            <div className="w-12 h-12 flex items-center justify-center text-sm font-bold"
                              style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(232,99,10,0.05)", color: `${C.accent}80` }}>
                              {viewingUser.Firstname?.[0]}{viewingUser.Lastname?.[0]}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <DialogTitle className="text-sm font-bold" style={{ color: C.text }}>
                              {viewingUser.Firstname} {viewingUser.Lastname}
                            </DialogTitle>
                            <p className="text-[10px] mt-0.5 truncate" style={{ color: C.dim }}>{viewingUser.Email}</p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <StatusBadge status={viewingUser.Status} />
                              <DeptBadge dept={viewingUser.Department} position={viewingUser.Position} />
                            </div>
                          </div>
                        </div>
                      </DialogHeader>

                      <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { label: "Reference ID", value: viewingUser.ReferenceID },
                            { label: "Company",      value: viewingUser.Company },
                            { label: "Location",     value: viewingUser.Location },
                            { label: "Department",   value: viewingUser.Department },
                            { label: "Position",     value: viewingUser.Position },
                            { label: "Role",         value: viewingUser.Role },
                          ].map(({ label, value }) => (
                            <div key={label} className="px-3 py-2.5 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                              <p className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>{label}</p>
                              <p className="text-[11px] font-semibold mt-0.5" style={{ color: C.text }}>{value || "—"}</p>
                            </div>
                          ))}
                        </div>

                        {viewingUser.Directories && viewingUser.Directories.length > 0 && (
                          <div>
                            <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: C.muted }}>Access Permissions</p>
                            <div className="flex flex-wrap gap-1.5">
                              {viewingUser.Directories.map((dir, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 border"
                                  style={{ borderColor: C.border, color: `${C.accent}80`, backgroundColor: "rgba(232,99,10,0.05)" }}>
                                  {dir}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <DialogFooter className="px-5 py-3 border-t flex gap-2" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                        <button onClick={() => setViewingUser(null)}
                          className="px-4 py-1.5 text-[10px] uppercase tracking-widest border transition-colors"
                          style={{ borderColor: C.border, color: C.dim }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                          Close
                        </button>
                        <button onClick={() => { setViewingUser(null); openEdit(viewingUser); }}
                          className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors"
                          style={{ backgroundColor: "rgba(232,99,10,0.1)", borderColor: C.accent, color: C.accent }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.2)" }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)" }}>
                          <Pencil className="size-3" /> Edit Profile
                        </button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                {/* ── Dialogs ── */}
                <DeleteDialog
                  open={showDeleteDialog} count={selectedIds.size}
                  onCancelAction={() => setShowDeleteDialog(false)}
                  onConfirmAction={handleDelete}
                />
                <TransferDialog
                  open={showTransferDialog} onOpenChangeAction={setShowTransferDialog}
                  selectedUsers={accounts.filter(a => selectedIds.has(a._id))}
                  setSelectedIdsAction={setSelectedIds} setAccountsAction={setAccounts}
                  tsms={tsms} managers={managers}
                />
                <ConvertEmailDialog
                  open={showConvertDialog} onOpenChangeAction={setShowConvertDialog}
                  accounts={accounts} setAccountsAction={setAccounts}
                />

              </SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
        </ProtectedPageWrapper>
      </FormatProvider>
    </UserProvider>
  );
}