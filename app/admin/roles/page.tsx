"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Pagination } from "@/components/app-pagination";
import { toast } from "sonner";
import {
  Loader2, Search, ArrowUpDown, Trash2, Pencil, Repeat2, ArrowRight,
  Download, Eye, EyeOff, RotateCcw, UserPlus, SlidersHorizontal, Save,
  X as XIcon, ShieldOff, Zap, Fingerprint, LayoutGrid, Server, Database,
  Activity, Wifi, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteDialog } from "@/components/admin/roles/delete";
import { TransferDialog } from "@/components/admin/roles/transfer";
import { ConvertEmailDialog } from "@/components/admin/roles/convert";
import { SpinnerItem } from "@/components/admin/roles/download";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

const THEME = {
  bg: "bg-[#050a14]",
  border: "border-cyan-500/30",
  text: "text-cyan-100",
  textMuted: "text-cyan-300/60",
  cardBg: "bg-slate-900/90",
  inputBg: "bg-slate-900/50",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
  terminated: "bg-red-500/20 text-red-400 border-red-500/50",
  resigned: "bg-red-500/20 text-red-400 border-red-500/50",
  "do not disturb": "bg-amber-500/20 text-amber-400 border-amber-500/50",
  locked: "bg-rose-500/20 text-rose-400 border-rose-500/50",
  inactive: "bg-slate-500/20 text-slate-400 border-slate-500/50",
  suspended: "bg-orange-500/20 text-orange-400 border-orange-500/50",
};

interface UserAccount {
  _id: string;
  ReferenceID: string;
  TSM: string;
  TSMName?: string;
  Manager: string;
  ManagerName?: string;
  Location: string;
  Firstname: string;
  Lastname: string;
  Email: string;
  Department: string;
  Company: string;
  Position: string;
  Role: string;
  Password?: string;
  Status: string;
  TargetQuota: string;
  profilePicture?: string;
  Directories?: string[];
  LoginAttempts?: number;
  LockUntil?: Date | null;
}

type SortKey = keyof Pick<UserAccount, "Firstname" | "Lastname" | "Email" | "Department" | "Company" | "Position">;

const DIRECTORIES = [
  { key: "Ecodesk", label: "Ecodesk", description: "CSR ticketing system", submodules: ["Dashboard", "Inquiries", "Customer Database", "Reports", "Taskflow"] },
  { key: "Taskflow", label: "Taskflow", description: "Sales tracking, activity, time & motion", submodules: ["Dashboard", "Sales Performance", "National Call Ranking", "Customer Database", "Work Management", "Reports", "Conversion Rates"] },
  { key: "Acculog", label: "Acculog", description: "HRIS module", submodules: ["Dashboard", "Time Attendance", "Button - Site Visit", "Button - Client Visit", "Recruitment"] },
  { key: "Help-Desk", label: "Help Desk", description: "IT ticketing system", submodules: [] },
  { key: "Stash", label: "Stash", description: "IT inventory management", submodules: [] },
];

const DEFAULT_ROLES = ["User", "Manager", "Admin", "SuperAdmin", "Developer"];

const ROLES_BY_DEPARTMENT: Record<string, string[]> = {
  Sales: ["Territory Sales Associate", "Territory Sales Manager", "Manager"],
  "Sales Project": ["Office Sales"],
  IT: ["IT Staff", "IT Admin", "IT Manager", "IT Support", "Developer", "SuperAdmin"],
  CSR: ["Staff", "Admin", "Manager"],
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

function generateReferenceID(firstname: string, lastname: string, location: string): string {
  if (!firstname || !lastname || !location) return "";
  const initials = firstname[0].toUpperCase() + lastname[0].toUpperCase();
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return initials + "-" + location + "-" + randomNum;
}

function getBadgeColor(dept: string): string {
  const map: Record<string, string> = {
    IT: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    HR: "bg-green-500/20 text-green-400 border-green-500/50",
    Finance: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    Marketing: "bg-pink-500/20 text-pink-400 border-pink-500/50",
    Sales: "bg-purple-500/20 text-purple-400 border-purple-500/50",
    "Dev-Team": "bg-yellow-400/20 text-yellow-300 border-yellow-400/50",
  };
  return map[dept] || "bg-slate-500/20 text-slate-400 border-slate-500/50";
}

function SciFiCard({ children, className = "", glow = true }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <Card className={`relative group ${THEME.cardBg} ${THEME.border} ${className}`}>
      {glow && <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />}
      <div className="relative">{children}</div>
    </Card>
  );
}

function SciFiInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <Input className={`${THEME.inputBg} ${THEME.border} ${THEME.text} placeholder:text-cyan-300/40 rounded-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 ${className}`} {...props} />;
}

function SciFiButton({ children, variant = "default", className = "", ...props }: React.ComponentProps<typeof Button>) {
  const baseClasses = "rounded-none tracking-wider text-xs font-bold uppercase transition-all";
  const variants = {
    default: "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0",
    outline: "border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300",
    ghost: "text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10",
    destructive: "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30",
  };
  return <Button className={`${baseClasses} ${variants[variant as keyof typeof variants]} ${className}`} {...props}>{children}</Button>;
}

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);
  const { userId: currentUserId, email, role, name } = useUser();

  const getAuditHeaders = () => ({
    "Content-Type": "application/json",
    "x-user-id": currentUserId || "",
    "x-user-email": email || "",
    "x-user-role": role || "",
    "x-user-name": name || "",
  });

  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("Firstname");
  const [sortAsc, setSortAsc] = useState(true);
  const [activeView, setActiveView] = useState("grid");
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserAccount | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [managers, setManagers] = useState<{ label: string; value: string }[]>([]);
  const [tsms, setTsms] = useState<{ label: string; value: string }[]>([]);
  const [newUser, setNewUser] = useState<Partial<UserAccount> & { Password?: string }>({
    ReferenceID: "", TSM: "", Manager: "", Location: "", Firstname: "", Lastname: "",
    Email: "", Department: "", Company: "", Position: "", Role: "", Password: "",
    Status: "Active", TargetQuota: "", Directories: [],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [formManagers, setFormManagers] = useState<{ label: string; value: string }[]>([]);
  const [formTsms, setFormTsms] = useState<{ label: string; value: string }[]>([]);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const fetchAccounts = async () => {
      setIsFetching(true);
      const toastId = toast.loading("Initializing data stream...");
      try {
        const res = await fetch("/api/UserManagement/Fetch");
        const data = await res.json();
        setAccounts(data || []);
        toast.success("User database synchronized", { id: toastId });
      } catch (err) {
        toast.error("Connection failed - check network", { id: toastId });
      } finally {
        setIsFetching(false);
      }
    };
    fetchAccounts();
  }, []);

  const selectedAreSales = useMemo(() => accounts.some((a) => selectedIds.has(a._id) && a.Department === "Sales"), [accounts, selectedIds]);

  useEffect(() => {
    if (!showTransferDialog || !selectedAreSales) return;
    const fetchDropdowns = async () => {
      try {
        const [mr, tr] = await Promise.all([
          fetch("/api/UserManagement/FetchManager?Role=Manager"),
          fetch("/api/UserManagement/FetchTSM?Role=Territory Sales Manager"),
        ]);
        const md = await mr.json();
        const td = await tr.json();
        setManagers(md.map((m: any) => ({ label: m.Firstname + " " + m.Lastname, value: m.ReferenceID })));
        setTsms(td.map((t: any) => ({ label: t.Firstname + " " + t.Lastname, value: t.ReferenceID })));
      } catch {
        toast.error("Failed to fetch supervisor data");
      }
    };
    fetchDropdowns();
  }, [showTransferDialog, selectedAreSales]);

  useEffect(() => {
    if (newUser.Department !== "Sales") return;
    const fetchFormDropdowns = async () => {
      try {
        const [mr, tr] = await Promise.all([
          fetch("/api/UserManagement/FetchManager?Role=Manager"),
          fetch("/api/UserManagement/FetchTSM?Role=Territory Sales Manager"),
        ]);
        const md = await mr.json();
        const td = await tr.json();
        setFormManagers(md.map((m: any) => ({ label: m.Firstname + " " + m.Lastname, value: m.ReferenceID })));
        setFormTsms(td.map((t: any) => ({ label: t.Firstname + " " + t.Lastname, value: t.ReferenceID })));
      } catch {
        toast.error("Failed to fetch supervisor data");
      }
    };
    fetchFormDropdowns();
  }, [newUser.Department]);

  const hasDir = (key: string) => newUser.Directories?.includes(key);

  const toggleDir = (key: string, checked: boolean) => {
    setNewUser((prev) => {
      const current = prev.Directories || [];
      if (key === "Ecodesk") {
        if (!checked) return { ...prev, Directories: current.filter((d) => !d.startsWith("Ecodesk")) };
        if (!current.includes("Ecodesk")) return { ...prev, Directories: [...current, "Ecodesk"] };
      }
      if (checked) {
        if (!current.includes(key)) return { ...prev, Directories: [...current, key] };
      } else {
        return { ...prev, Directories: current.filter((d) => d !== key) };
      }
      return prev;
    });
  };

  const resetForm = () => {
    setNewUser({ ReferenceID: "", TSM: "", Manager: "", Location: "", Firstname: "", Lastname: "", Email: "", Department: "", Company: "", Position: "", Role: "", Password: "", Status: "Active", TargetQuota: "", Directories: [] });
    setShowPassword(false);
    setFormMode("create");
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === "edit") {
      await handleSaveEdit();
      return;
    }
    if (!newUser.Firstname || !newUser.Lastname || !newUser.Email || !newUser.Location) {
      toast.error("Missing required fields");
      return;
    }
    setIsFormLoading(true);
    try {
      const res = await fetch("/api/UserManagement/UserCreate", {
        method: "POST",
        headers: getAuditHeaders(),
        body: JSON.stringify(newUser),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Create failed");
      setAccounts((prev) => [...prev, result.data]);
      toast.success("User profile created successfully");
      resetForm();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsFormLoading(false);
    }
  };

  const departmentOptions = useMemo(() => ["all", ...Array.from(new Set(accounts.map((a) => a.Department).filter(Boolean)))], [accounts]);
  const companyOptions = useMemo(() => ["all", ...Array.from(new Set(accounts.map((a) => a.Company).filter(Boolean)))], [accounts]);
  const salesRoleOptions = useMemo(() => ["all", ...Array.from(new Set(accounts.filter((a) => a.Department === "Sales").map((a) => a.Role).filter(Boolean)))], [accounts]);

  const filtered = useMemo(() => {
    const list = accounts
      .filter((a) => [a.Firstname, a.Lastname, a.Email, a.Department, a.Company, a.Position].some((f) => f?.toLowerCase().includes(search.toLowerCase())))
      .filter((a) => (filterDepartment === "all" ? true : a.Department === filterDepartment))
      .filter((a) => (filterCompany === "all" ? true : a.Company === filterCompany))
      .filter((a) => (filterRole === "all" || filterDepartment !== "Sales" ? true : a.Role === filterRole));
    return [...list].sort((a, b) => {
      const va = (a[sortKey] || "").toString().toLowerCase();
      const vb = (b[sortKey] || "").toString().toLowerCase();
      return va < vb ? (sortAsc ? -1 : 1) : va > vb ? (sortAsc ? 1 : -1) : 0;
    });
  }, [accounts, search, filterDepartment, filterCompany, filterRole, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const current = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === current.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(current.map((u) => u._id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  const handleEdit = (user: UserAccount) => {
    const copy: Partial<UserAccount> & { Password?: string } = { ...user };
    delete copy.Password;
    setNewUser({ ...copy, Password: "" });
    setFormMode("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = async () => {
    const toastId = toast.loading("Purging accounts...");
    try {
      const res = await fetch("/api/UserManagement/UserDelete", {
        method: "POST",
        headers: getAuditHeaders(),
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error("Delete failed");
      setAccounts((prev) => prev.filter((a) => !selectedIds.has(a._id)));
      setSelectedIds(new Set());
      toast.success("Accounts purged from system", { id: toastId });
    } catch (err) {
      toast.error("Error deleting accounts", { id: toastId });
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const syncTsmManager = async (tsaReferenceId: string, field: "tsm" | "manager", newSupervisorReferenceId: string): Promise<void> => {
    if (!tsaReferenceId || !newSupervisorReferenceId) return;
    try {
      const res = await fetch("/api/UserManagement/TransferTSA", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tsaReferenceId, field, newSupervisorReferenceId }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        console.error("[TransferTSA] HTTP " + res.status + " - route not found");
        return;
      }
      const data = await res.json();
      if (!data.success) console.warn("[TransferTSA] partial failure:", data);
    } catch (err) {
      console.error("[TransferTSA]", err);
    }
  };

  const handleSaveEdit = async () => {
    if (!newUser._id) { toast.error("No user loaded for editing"); return; }
    const toastId = toast.loading("Updating profile...");
    setIsFormLoading(true);
    const prevUser = accounts.find((a) => a._id === newUser._id);

    try {
      const payload = { ...newUser };
      if (!payload.Password || payload.Password.trim() === "") delete payload.Password;

      const res = await fetch("/api/UserManagement/UserUpdate", {
        method: "PUT",
        headers: getAuditHeaders(),
        body: JSON.stringify({ id: newUser._id, ...payload }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Update failed");

      const savedStatus = (newUser.Status || "").trim().toLowerCase();
      const isSales = (newUser.Department || "").trim().toLowerCase() === "sales";
      const isPark = ["inactive", "terminated", "resigned"].includes(savedStatus);
      const isRestore = savedStatus === "active";

      if (isSales && (isPark || isRestore) && newUser.ReferenceID) {
        try {
          const parkRes = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/ParkByReferenceId", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ referenceId: newUser.ReferenceID, targetStatus: isPark ? "park" : "Active" }),
          });
          const parkResult = await parkRes.json();
          if (parkResult.success) toast.info(parkResult.message);
        } catch (cascadeErr) {
          console.error("[cascade park]", cascadeErr);
        }
      }

      if (isSales && newUser.ReferenceID) {
        const syncOps: Promise<void>[] = [];
        if (newUser.TSM && newUser.TSM !== prevUser?.TSM) syncOps.push(syncTsmManager(newUser.ReferenceID, "tsm", newUser.TSM));
        if (newUser.Manager && newUser.Manager !== prevUser?.Manager) syncOps.push(syncTsmManager(newUser.ReferenceID, "manager", newUser.Manager));
        if (syncOps.length > 0) {
          await Promise.all(syncOps);
          toast.info("Supervisor data synced across databases");
        }
      }

      setAccounts((prev) => prev.map((a) => (a._id === newUser._id ? { ...a, ...newUser } : a)));
      toast.success("Profile updated successfully", { id: toastId });
      resetForm();
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleResetClientAccess = async () => {
    if (!newUser._id) { toast.error("No user selected"); return; }
    setIsResetting(true);
    const toastId = toast.loading("Resetting access credentials...");
    try {
      const res = await fetch("/api/UserManagement/ResetClientAccess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newUser._id }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Reset failed");
      setNewUser((prev) => ({ ...prev, Status: "Active", LoginAttempts: 0, LockUntil: null }));
      setAccounts((prev) => prev.map((a) => (a._id === newUser._id ? { ...a, Status: "Active", LoginAttempts: 0 } : a)));
      toast.success("Access credentials reset - user unlocked", { id: toastId });
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setIsResetting(false);
    }
  };

  const handleDownload = async () => {
    if (filtered.length === 0) return;
    setIsDownloading(true);
    const toastId = toast.loading("Generating data export...");
    try {
      const header = "ReferenceID,Firstname,Lastname,Email,Department,Company,Position,TSM,Manager,Status";
      const rows = filtered.map((u) => {
        const values = [u.ReferenceID, u.Firstname, u.Lastname, u.Email, u.Department, u.Company, u.Position, u.TSM, u.Manager, u.Status];
        return values.map((v) => '"' + (v || "") + '"').join(",");
      });
      const csvContent = [header, ...rows].join("\n");
      await new Promise((resolve) => setTimeout(resolve, 500));
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "user_accounts_export_" + new Date().toISOString().split("T")[0] + ".csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Data export complete", { id: toastId });
    } catch {
      toast.error("Export failed", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCompanyChange = (value: string) => {
    const domain = value === "Ecoshift Corporation" ? "@ecoshiftcorp.com" : value === "Disruptive Solutions Inc" ? "@disruptivesolutionsinc.com" : "";
    setNewUser((prev) => {
      const firstInitial = prev.Firstname ? prev.Firstname.charAt(0).toLowerCase() : "";
      const lastName = prev.Lastname ? prev.Lastname.toLowerCase() : "";
      const email = firstInitial && lastName && domain ? firstInitial + "." + lastName + domain : prev.Email || "";
      return { ...prev, Company: value, Email: email };
    });
  };

  const isEditingLockedUser = formMode === "edit" && ((newUser.Status || "").trim().toLowerCase() === "locked" || (newUser.LoginAttempts ?? 0) >= 5);

  return (
    <UserProvider>
      <FormatProvider>
        <ProtectedPageWrapper>
          <TooltipProvider delayDuration={0}>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <div className="min-h-screen w-full bg-[#050a14] relative overflow-hidden">
                  <div className="absolute inset-0 h-full w-full">
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
                  </div>
                  <div className="relative z-10 w-full">
                    <header className="flex h-16 items-center gap-2 px-4 border-b border-cyan-500/20 bg-slate-900/50 backdrop-blur-sm">
                      <SidebarTrigger className="-ml-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20" />
                      <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20">Home</Button>
                      <Separator orientation="vertical" className="h-4 bg-cyan-500/30 hidden sm:block" />
                      <Breadcrumb className="hidden sm:flex">
                        <BreadcrumbList>
                          <BreadcrumbItem><BreadcrumbLink href="#" className="text-cyan-400 hover:text-cyan-300">Admin</BreadcrumbLink></BreadcrumbItem>
                          <BreadcrumbSeparator className="text-cyan-500/50" />
                          <BreadcrumbItem><BreadcrumbPage className="text-cyan-100">User Accounts</BreadcrumbPage></BreadcrumbItem>
                        </BreadcrumbList>
                      </Breadcrumb>
                    </header>
                    <div className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30"><Fingerprint className="h-6 w-6 text-cyan-400" /></div>
                        <div>
                          <h1 className="text-2xl font-bold text-white tracking-wider">IDENTITY MANAGEMENT</h1>
                          <p className="text-sm text-cyan-300/60">Manage user profiles and access credentials</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-cyan-500/20">
                            <Activity className="h-4 w-4 text-emerald-400" />
                            <span className="text-xs text-cyan-300">{accounts.length} Profiles</span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-cyan-500/20">
                            <Wifi className="h-4 w-4 text-cyan-400 animate-pulse" />
                            <span className="text-xs text-cyan-300">System Online</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 pb-8 items-start">
                      <div className="lg:col-span-4 sticky top-6 z-10">
                        <SciFiCard className="max-h-[calc(100vh-10rem)] overflow-y-auto">
                          <CardHeader className="border-b border-cyan-500/20">
                            <div className="flex items-center justify-between gap-3">
                              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-cyan-100">
                                {formMode === "edit" ? <><Fingerprint className="w-4 h-4 text-cyan-400" /> Edit Profile</> : <><UserPlus className="w-4 h-4 text-cyan-400" /> New Identity</>}
                              </CardTitle>
                              {(formMode === "edit" || newUser.Firstname || newUser.Email || newUser.Role) && (
                                <SciFiButton variant="ghost" size="sm" onClick={resetForm} disabled={isFormLoading} className="h-7"><XIcon className="mr-1 h-3 w-3" /> {formMode === "edit" ? "Cancel" : "Reset"}</SciFiButton>
                              )}
                            </div>
                            {formMode === "edit" && newUser.Firstname && (
                              <p className="text-[10px] text-cyan-300/60 mt-1">Target: <span className="font-semibold text-cyan-100">{newUser.Firstname} {newUser.Lastname}</span></p>
                            )}
                          </CardHeader>
                          <CardContent className="pt-5">
                            <form onSubmit={handleCreateAccount} className="space-y-4">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold uppercase text-cyan-400/70">Firstname <span className="text-red-400">*</span></label>
                                  <SciFiInput placeholder="Firstname" className="h-10" value={newUser.Firstname || ""} disabled={isFormLoading} onChange={(e) => { const Firstname = e.target.value; setNewUser((prev) => ({ ...prev, Firstname, ReferenceID: generateReferenceID(Firstname, prev.Lastname || "", prev.Location || "") })); }} />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold uppercase text-cyan-400/70">Lastname <span className="text-red-400">*</span></label>
                                  <SciFiInput placeholder="Lastname" className="h-10" value={newUser.Lastname || ""} disabled={isFormLoading} onChange={(e) => { const Lastname = e.target.value; setNewUser((prev) => ({ ...prev, Lastname, ReferenceID: generateReferenceID(prev.Firstname || "", Lastname, prev.Location || "") })); }} />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-cyan-400/70">Location <span className="text-red-400">*</span></label>
                                <select className={`w-full ${THEME.inputBg} ${THEME.border} ${THEME.text} px-3 py-2 text-xs h-10 rounded-none focus:border-cyan-400 focus:outline-none`} value={newUser.Location || ""} disabled={isFormLoading} onChange={(e) => { const Location = e.target.value; setNewUser((prev) => ({ ...prev, Location, ReferenceID: generateReferenceID(prev.Firstname || "", prev.Lastname || "", Location) })); }}>
                                  <option value="" className="bg-slate-900">Select Location</option>
                                  {["NCR", "CDO", "Davao", "Cebu", "North-Luzon", "Philippines"].map((loc) => <option key={loc} value={loc} className="bg-slate-900">{loc}</option>)}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-cyan-400/70">Reference ID</label>
                                <div className="relative">
                                  <SciFiInput value={newUser.ReferenceID || ""} readOnly className="h-10 bg-cyan-950/30 font-mono text-cyan-300" />
                                  <Fingerprint className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-500/50" />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-cyan-400/70">Organization</label>
                                <Select value={newUser.Company || ""} onValueChange={handleCompanyChange} disabled={isFormLoading}>
                                  <SelectTrigger className={`${THEME.inputBg} ${THEME.border} ${THEME.text} rounded-none h-10`}><SelectValue placeholder="Select Company" /></SelectTrigger>
                                  <SelectContent className={`${THEME.cardBg} ${THEME.border}`}>
                                    <SelectItem value="Ecoshift Corporation" className="text-cyan-100">Ecoshift Corporation</SelectItem>
                                    <SelectItem value="Disruptive Solutions Inc" className="text-cyan-100">Disruptive Solutions Inc</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-cyan-400/70">Email <span className="text-red-400">*</span></label>
                                <SciFiInput type="email" placeholder="Auto-generated from company" className="h-10" value={newUser.Email || ""} disabled={isFormLoading} onChange={(e) => setNewUser((prev) => ({ ...prev, Email: e.target.value }))} />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-cyan-400/70">Department</label>
                                <Select value={newUser.Department || ""} onValueChange={(v) => setNewUser((prev) => ({ ...prev, Department: v, Role: "" }))} disabled={isFormLoading}>
                                  <SelectTrigger className={`${THEME.inputBg} ${THEME.border} ${THEME.text} rounded-none h-10`}><SelectValue placeholder="Select Department" /></SelectTrigger>
                                  <SelectContent className={`${THEME.cardBg} ${THEME.border}`}>
                                    {["Sales", "IT", "CSR", "HR", "Ecommerce", "Marketing", "Engineering", "Admin", "Warehouse Operations", "Accounting", "Owner", "Procurement"].map((d) => <SelectItem key={d} value={d} className="text-cyan-100">{d}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              {newUser.Department === "Sales" && (
                                <>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-cyan-400/70">Manager</label>
                                    <Select value={newUser.Manager || ""} onValueChange={(v) => { const selectedManager = formManagers.find((m) => m.value === v); setNewUser((prev) => ({ ...prev, Manager: v, ManagerName: selectedManager?.label || "", TSM: "", TSMName: "" })); }} disabled={isFormLoading}>
                                      <SelectTrigger className={`${THEME.inputBg} ${THEME.border} ${THEME.text} rounded-none h-10`}><SelectValue placeholder="Select Manager" /></SelectTrigger>
                                      <SelectContent className={`${THEME.cardBg} ${THEME.border}`}>{formManagers.map((m) => <SelectItem key={m.value} value={m.value} className="text-cyan-100">{m.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-cyan-400/70">TSM</label>
                                    <Select value={newUser.TSM || ""} onValueChange={(v) => { const selectedTSM = formTsms.find((t) => t.value === v); const tsmUser = accounts.find((a) => a.ReferenceID === v && a.Role === "Territory Sales Manager"); const managerDetails = tsmUser?.Manager ? formManagers.find((m) => m.value === tsmUser.Manager) : null; setNewUser((prev) => ({ ...prev, TSM: v, TSMName: selectedTSM?.label || "", ...(tsmUser?.Manager ? { Manager: tsmUser.Manager, ManagerName: managerDetails?.label || "" } : {}) })); }} disabled={isFormLoading}>
                                      <SelectTrigger className={`${THEME.inputBg} ${THEME.border} ${THEME.text} rounded-none h-10`}><SelectValue placeholder="Select TSM" /></SelectTrigger>
                                      <SelectContent className={`${THEME.cardBg} ${THEME.border}`}>{formTsms.map((t) => <SelectItem key={t.value} value={t.value} className="text-cyan-100">{t.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                  </div>
                                </>
                              )}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-cyan-400/70">Role</label>
                                <Select value={newUser.Role || ""} onValueChange={(v) => setNewUser((prev) => ({ ...prev, Role: v }))} disabled={isFormLoading || !newUser.Department}>
                                  <SelectTrigger className={`${THEME.inputBg} ${THEME.border} ${THEME.text} rounded-none h-10`}><SelectValue placeholder={newUser.Department ? "Select Role" : "Select Department first"} /></SelectTrigger>
                                  <SelectContent className={`${THEME.cardBg} ${THEME.border}`}>{getRolesForDepartment(newUser.Department || "").map((r) => <SelectItem key={r} value={r} className="text-cyan-100">{r}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-cyan-400/70">Position</label>
                                <SciFiInput placeholder="Position" className="h-10" value={newUser.Position || ""} disabled={isFormLoading} onChange={(e) => setNewUser((prev) => ({ ...prev, Position: e.target.value }))} />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-cyan-400/70">Status</label>
                                <select className={`w-full ${THEME.inputBg} ${THEME.border} ${THEME.text} px-3 py-2 text-xs h-10 rounded-none focus:border-cyan-400 focus:outline-none`} value={newUser.Status || "Active"} disabled={isFormLoading} onChange={(e) => setNewUser((prev) => ({ ...prev, Status: e.target.value }))}>
                                  <option value="Active" className="bg-slate-900">Active</option>
                                  <option value="Inactive" className="bg-slate-900">Inactive</option>
                                  <option value="Suspended" className="bg-slate-900">Suspended</option>
                                  <option value="Terminated" className="bg-slate-900">Terminated</option>
                                  <option value="Resigned" className="bg-slate-900">Resigned</option>
                                  <option value="Locked" className="bg-slate-900">Locked</option>
                                </select>
                                {(newUser.Status || "").toLowerCase() === "locked" && (
                                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Account locked - reset required</p>
                                )}
                              </div>
                              {isEditingLockedUser && (
                                <div className="rounded-none border border-amber-500/30 bg-amber-950/20 p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <ShieldOff className="h-4 w-4 text-amber-400 shrink-0" />
                                    <span className="text-[11px] font-semibold text-amber-300">Security Lock Active</span>
                                    {(newUser.LoginAttempts ?? 0) > 0 && <span className="ml-auto text-[10px] text-amber-400">{newUser.LoginAttempts}/5 attempts</span>}
                                  </div>
                                  <p className="text-[10px] text-amber-400/70">Reset credentials to unlock account</p>
                                  <SciFiButton type="button" variant="outline" disabled={isResetting || isFormLoading} onClick={handleResetClientAccess} className="w-full h-9 text-[10px] border-amber-500/30 text-amber-400 hover:bg-amber-500/20">
                                    {isResetting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Resetting...</> : <><RotateCcw className="h-3.5 w-3.5" /> Reset Access</>}
                                  </SciFiButton>
                                </div>
                              )}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-cyan-400/70">Password <span className="text-red-400">*</span></label>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <SciFiInput type={showPassword ? "text" : "password"} placeholder="Min. 8 characters" className="h-10 pr-10" value={newUser.Password || ""} disabled={isFormLoading} onChange={(e) => setNewUser((prev) => ({ ...prev, Password: e.target.value }))} />
                                    <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400/50 hover:text-cyan-300" disabled={isFormLoading}>
                                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                  </div>
                                  <SciFiButton type="button" variant="outline" className="h-10 px-3 shrink-0" disabled={isFormLoading} onClick={() => { const generated = Math.random().toString(36).slice(-10); setNewUser((prev) => ({ ...prev, Password: generated })); toast.info("New password generated"); }}><Zap className="h-4 w-4" /></SciFiButton>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase text-cyan-400/70">Access Permissions</label>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {DIRECTORIES.map((dir) => (
                                    <div key={dir.key} className={`rounded-none border ${THEME.border} p-3 ${hasDir(dir.key) ? "bg-cyan-500/5 border-cyan-400/40" : "bg-slate-900/30"}`}>
                                      <label className="flex items-start gap-3 cursor-pointer">
                                        <input type="checkbox" checked={!!hasDir(dir.key)} onChange={(e) => toggleDir(dir.key, e.target.checked)} className="mt-1 h-4 w-4 rounded border-cyan-500/50 bg-slate-900 text-cyan-400 focus:ring-cyan-400/50" />
                                        <div className="flex flex-col"><span className="text-xs font-medium text-cyan-100">{dir.label}</span><span className="text-[10px] text-cyan-400/50">{dir.description}</span></div>
                                      </label>
                                      {dir.submodules.length > 0 && hasDir(dir.key) && (
                                        <div className="mt-3 ml-7 space-y-2 border-l border-cyan-500/20 pl-4">
                                          {dir.submodules.map((sub) => {
                                            const key = dir.key + ":" + sub;
                                            return (
                                              <label key={key} className="flex items-center gap-2 text-[10px] cursor-pointer text-cyan-300/70 hover:text-cyan-200">
                                                <input type="checkbox" checked={!!hasDir(key)} onChange={(e) => toggleDir(key, e.target.checked)} className="h-3.5 w-3.5 rounded border-cyan-500/50 bg-slate-900 text-cyan-400" />
                                                {sub}
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <SciFiButton type="submit" disabled={isFormLoading} className="w-full h-11">
                                {isFormLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> {formMode === "edit" ? "Saving..." : "Creating..."}</> : formMode === "edit" ? <><Save className="h-4 w-4" /> Save Profile</> : <><UserPlus className="h-4 w-4" /> Create Identity</>}
                              </SciFiButton>
                            </form>
                          </CardContent>
                        </SciFiCard>
                      </div>
                      <div className="lg:col-span-8 space-y-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-2 top-2.5 size-4 text-cyan-400/50" />
                            <SciFiInput placeholder="Search profiles..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8 w-full" />
                            {isFetching && <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-cyan-400" />}
                          </div>
                          <div className="flex flex-wrap gap-2 items-center">
                            <SciFiButton variant="outline" size="sm" className="h-10" onClick={() => setShowConvertDialog(true)}><Repeat2 className="w-4 h-4 mr-1" /> Convert</SciFiButton>
                            <ConvertEmailDialog open={showConvertDialog} onOpenChangeAction={setShowConvertDialog} accounts={accounts} setAccountsAction={setAccounts} />
                            <SciFiButton variant="outline" size="sm" className="h-10" disabled={filtered.length === 0 || isDownloading} onClick={handleDownload}><Download className="w-4 h-4 mr-1" /> Export</SciFiButton>
                            {selectedAreSales && <SciFiButton variant="outline" size="sm" className="h-10" disabled={selectedIds.size === 0} onClick={() => setShowTransferDialog(true)}><ArrowRight className="w-4 h-4 mr-1" /> Transfer</SciFiButton>}
                            {selectedIds.size > 0 && <SciFiButton variant="destructive" size="sm" className="h-10" onClick={() => setShowDeleteDialog(true)}><Trash2 className="w-4 h-4 mr-1" /> Delete {selectedIds.size}</SciFiButton>}
                            <ButtonGroup>
                              <SciFiButton variant={activeView === "grid" ? "default" : "outline"} size="sm" className="h-10" onClick={() => setActiveView("grid")}><LayoutGrid className="w-4 h-4" /></SciFiButton>
                              <SciFiButton variant={activeView === "list" ? "default" : "outline"} size="sm" className="h-10" onClick={() => setActiveView("list")}><Server className="w-4 h-4" /></SciFiButton>
                            </ButtonGroup>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <SciFiButton variant="outline" size="sm" className={`h-10 gap-2 ${filterDepartment !== "all" || filterCompany !== "all" || filterRole !== "all" || sortKey !== "Firstname" || !sortAsc ? "border-cyan-400 text-cyan-300 bg-cyan-500/10" : ""}`}>
                                  <SlidersHorizontal className="w-4 h-4" /> Filters
                                  {(filterDepartment !== "all" || filterCompany !== "all" || filterRole !== "all" || sortKey !== "Firstname" || !sortAsc) && <span className="ml-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                                </SciFiButton>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={`w-56 p-0 flex flex-col max-h-[420px] ${THEME.cardBg} ${THEME.border}`}>
                                <div className="sticky top-0 z-10 bg-slate-900 border-b border-cyan-500/20 px-3 py-2 flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Filters</span>
                                  <button type="button" className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors" onClick={() => { setFilterDepartment("all"); setFilterCompany("all"); setFilterRole("all"); setSortKey("Firstname"); setSortAsc(true); setRowsPerPage(10); setPage(1); }}>Reset all</button>
                                </div>
                                <div className="overflow-y-auto flex-1">
                                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/70 pt-2">Sort By</DropdownMenuLabel>
                                  {[{ key: "Firstname", asc: true, label: "Name A → Z" }, { key: "Firstname", asc: false, label: "Name Z → A" }, { key: "Department", asc: true, label: "Department A → Z" }, { key: "Company", asc: true, label: "Company A → Z" }, { key: "Position", asc: true, label: "Position A → Z" }, { key: "Email", asc: true, label: "Email A → Z" }].map((opt) => (
                                    <DropdownMenuCheckboxItem key={opt.key + "-" + opt.asc} checked={sortKey === opt.key && sortAsc === opt.asc} onCheckedChange={() => { setSortKey(opt.key as SortKey); setSortAsc(opt.asc); setPage(1); }} className="text-cyan-100 focus:bg-cyan-500/20 focus:text-cyan-200">{opt.label}</DropdownMenuCheckboxItem>
                                  ))}
                                  <DropdownMenuSeparator className="bg-cyan-500/20" />
                                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/70">Department</DropdownMenuLabel>
                                  {departmentOptions.map((d) => <DropdownMenuCheckboxItem key={d} checked={filterDepartment === d} onCheckedChange={() => { setFilterDepartment(d); setFilterRole("all"); setPage(1); }} className="text-cyan-100 focus:bg-cyan-500/20 focus:text-cyan-200">{d === "all" ? "All Departments" : d}</DropdownMenuCheckboxItem>)}
                                  {filterDepartment === "Sales" && (<><DropdownMenuSeparator className="bg-cyan-500/20" /><DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/70">Sales Role</DropdownMenuLabel>{salesRoleOptions.map((r) => <DropdownMenuCheckboxItem key={r} checked={filterRole === r} onCheckedChange={() => { setFilterRole(r); setPage(1); }} className="text-cyan-100 focus:bg-cyan-500/20 focus:text-cyan-200">{r === "all" ? "All Roles" : r}</DropdownMenuCheckboxItem>)}</>)}
                                  <DropdownMenuSeparator className="bg-cyan-500/20" />
                                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/70">Company</DropdownMenuLabel>
                                  {companyOptions.map((c) => <DropdownMenuCheckboxItem key={c} checked={filterCompany === c} onCheckedChange={() => { setFilterCompany(c); setPage(1); }} className="text-cyan-100 focus:bg-cyan-500/20 focus:text-cyan-200">{c === "all" ? "All Companies" : c}</DropdownMenuCheckboxItem>)}
                                  <DropdownMenuSeparator className="bg-cyan-500/20" />
                                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/70">Rows per page</DropdownMenuLabel>
                                  {[10, 20, 50, 100].map((n) => <DropdownMenuCheckboxItem key={n} checked={rowsPerPage === n} onCheckedChange={() => { setRowsPerPage(n); setPage(1); }} className="text-cyan-100 focus:bg-cyan-500/20 focus:text-cyan-200">{n} rows</DropdownMenuCheckboxItem>)}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <TransferDialog open={showTransferDialog} onOpenChangeAction={setShowTransferDialog} selectedUsers={accounts.filter((a) => selectedIds.has(a._id))} setSelectedIdsAction={setSelectedIds} setAccountsAction={setAccounts} tsms={tsms} managers={managers} />
                          </div>
                        </div>
                        <SciFiCard className="overflow-auto">
                          {isFetching && (
                            <div className="py-10 text-center flex flex-col items-center gap-2 text-cyan-300/40">
                              <Loader2 className="size-8 animate-spin" />
                              <span className="text-xs tracking-wider">SYNCHRONIZING DATA...</span>
                            </div>
                          )}
                          {!isFetching && current.length > 0 && activeView === "grid" && (
                            <Table className="text-sm">
                              <TableHeader>
                                <TableRow className="border-b border-cyan-500/20 hover:bg-transparent">
                                  <TableHead className="w-10 text-center">
                                    <Checkbox checked={selectedIds.size === current.length && current.length > 0} onCheckedChange={toggleSelectAll} className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500" />
                                  </TableHead>
                                  <TableHead className="text-cyan-300">Identity</TableHead>
                                  <TableHead className="text-cyan-300 cursor-pointer select-none" onClick={() => handleSort("Firstname")}>
                                    <div className="flex items-center gap-1">
                                      Fullname
                                      <ArrowUpDown className={sortKey === "Firstname" ? "size-4 text-cyan-400" : "size-4 text-cyan-500/50"} />
                                    </div>
                                  </TableHead>
                                  <TableHead className="text-cyan-300 cursor-pointer select-none" onClick={() => handleSort("Email")}>
                                    <div className="flex items-center gap-1">
                                      Email
                                      <ArrowUpDown className={sortKey === "Email" ? "size-4 text-cyan-400" : "size-4 text-cyan-500/50"} />
                                    </div>
                                  </TableHead>
                                  <TableHead className="text-cyan-300 cursor-pointer select-none" onClick={() => handleSort("Department")}>
                                    <div className="flex items-center gap-1">
                                      Dept
                                      <ArrowUpDown className={sortKey === "Department" ? "size-4 text-cyan-400" : "size-4 text-cyan-500/50"} />
                                    </div>
                                  </TableHead>
                                  <TableHead className="text-cyan-300 cursor-pointer select-none" onClick={() => handleSort("Company")}>
                                    <div className="flex items-center gap-1">
                                      Org
                                      <ArrowUpDown className={sortKey === "Company" ? "size-4 text-cyan-400" : "size-4 text-cyan-500/50"} />
                                    </div>
                                  </TableHead>
                                  <TableHead className="text-cyan-300">Status</TableHead>
                                  <TableHead className="text-cyan-300">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {current.map((u) => (
                                  <TableRow key={u._id} className="cursor-pointer border-b border-cyan-500/10 hover:bg-cyan-500/5 transition-colors" onClick={() => setViewingUser(u)}>
                                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                      <Checkbox checked={selectedIds.has(u._id)} onCheckedChange={() => toggleSelect(u._id)} className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500" />
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                      {u.profilePicture ? (
                                        <img src={u.profilePicture} alt="profile" className="w-10 h-10 rounded-lg object-cover border border-cyan-500/30" />
                                      ) : (
                                        <div className="w-10 h-10 rounded-lg bg-slate-800 border border-cyan-500/20 flex items-center justify-center">
                                          <Fingerprint className="w-5 h-5 text-cyan-500/50" />
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="capitalize text-cyan-100">{u.Firstname}, {u.Lastname}</TableCell>
                                    <TableCell className="text-cyan-300/70">
                                      {u.Email}
                                      <br />
                                      <span className="text-[10px] font-mono text-cyan-400/50">{u.ReferenceID}</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={getBadgeColor(["Guest", "Senior Fullstack Developer", "IT - OJT"].includes(u.Position) ? "Dev-Team" : u.Department) + " text-xs"}>
                                        {["Guest", "Senior Fullstack Developer", "IT - OJT"].includes(u.Position) ? "Dev Team" : u.Department || "—"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-cyan-300/70">
                                      {u.Company || "—"}
                                      <br />
                                      <span className="text-[10px] text-cyan-400/50">{u.Location || "—"}</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={(STATUS_COLORS[(u.Status || "").toLowerCase()] || "bg-slate-500/20 text-slate-400") + " text-xs border"}>
                                        {u.Status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                      <SciFiButton variant="outline" size="sm" onClick={() => handleEdit(u)}>
                                        <Pencil className="w-3 h-3" />
                                      </SciFiButton>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                          {!isFetching && current.length > 0 && activeView === "list" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                              {current.map((u) => (
                                <div key={u._id} className={"p-4 rounded-lg border " + THEME.border + " " + THEME.cardBg + " hover:border-cyan-400/50 transition-all cursor-pointer group"} onClick={() => setViewingUser(u)}>
                                  <div className="flex items-start gap-3">
                                    {u.profilePicture ? (
                                      <img src={u.profilePicture} alt="profile" className="w-12 h-12 rounded-lg object-cover border border-cyan-500/30" />
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-slate-800 border border-cyan-500/20 flex items-center justify-center">
                                        <Fingerprint className="w-6 h-6 text-cyan-500/50" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-cyan-100 truncate">{u.Firstname} {u.Lastname}</h3>
                                        <Checkbox checked={selectedIds.has(u._id)} onCheckedChange={() => toggleSelect(u._id)} onClick={(e) => e.stopPropagation()} className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500" />
                                      </div>
                                      <p className="text-xs text-cyan-400/50 truncate font-mono">{u.ReferenceID}</p>
                                      <p className="text-xs text-cyan-300/60 truncate">{u.Email}</p>
                                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <Badge className={getBadgeColor(u.Department) + " text-[10px]"}>{u.Department}</Badge>
                                        <Badge className={(STATUS_COLORS[(u.Status || "").toLowerCase()] || "") + " text-[10px]"}>{u.Status}</Badge>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {!isFetching && current.length === 0 && (
                            <div className="py-10 text-center text-cyan-300/40">
                              <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p className="text-sm">No user profiles found</p>
                            </div>
                          )}
                        </SciFiCard>
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                          <p className="text-xs text-cyan-300/50">Showing {filtered.length === 0 ? 0 : (page - 1) * rowsPerPage + 1}–{Math.min(page * rowsPerPage, filtered.length)} of {filtered.length} profiles</p>
                          <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </SidebarInset>
            </SidebarProvider>
            {viewingUser && (
              <Dialog open={!!viewingUser} onOpenChange={() => setViewingUser(null)}>
                <DialogContent className={`sm:max-w-2xl max-w-[95vw] max-h-[90vh] overflow-y-auto ${THEME.cardBg} ${THEME.border} border`}>
                  <DialogHeader className="pb-0">
                    <div className="flex items-start gap-4">
                      {viewingUser.profilePicture ? <img src={viewingUser.profilePicture} alt="avatar" className="w-16 h-16 rounded-lg object-cover border border-cyan-500/30" /> : <div className="w-16 h-16 rounded-lg bg-slate-800 border border-cyan-500/20 flex items-center justify-center"><Fingerprint className="w-8 h-8 text-cyan-500/50" /></div>}
                      <div className="flex-1 min-w-0">
                        <DialogTitle className="text-lg text-cyan-100">{viewingUser.Firstname} {viewingUser.Lastname}</DialogTitle>
                        <p className="text-xs text-cyan-300/60 mt-0.5">{viewingUser.Email}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge className={`${STATUS_COLORS[(viewingUser.Status || "").toLowerCase()] || ""} text-[10px]`}>{viewingUser.Status}</Badge>
                          {viewingUser.Department && <Badge className={`${getBadgeColor(viewingUser.Department)} text-[10px]`}>{viewingUser.Department}</Badge>}
                        </div>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="space-y-5 pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[{ label: "Reference ID", value: viewingUser.ReferenceID }, { label: "Company", value: viewingUser.Company }, { label: "Location", value: viewingUser.Location }, { label: "Department", value: viewingUser.Department }, { label: "Position", value: viewingUser.Position }, { label: "Role", value: viewingUser.Role }].map(({ label, value }) => (
                        <div key={label} className="p-3 rounded-lg bg-slate-950/50 border border-cyan-500/10">
                          <p className="text-[10px] text-cyan-400/50 uppercase tracking-wider">{label}</p>
                          <p className="text-sm font-medium text-cyan-100 mt-0.5">{value || "—"}</p>
                        </div>
                      ))}
                    </div>
                    {viewingUser.Directories && viewingUser.Directories.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/50 mb-2">Access Permissions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {viewingUser.Directories.map((dir, i) => <span key={i} className="text-[10px] bg-cyan-500/10 text-cyan-300 px-2 py-1 rounded border border-cyan-500/20">{dir}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter className="mt-4 gap-2">
                    <SciFiButton variant="outline" onClick={() => setViewingUser(null)}>Close</SciFiButton>
                    <SciFiButton onClick={() => { setViewingUser(null); handleEdit(viewingUser); }}><Pencil className="w-3 h-3 mr-1.5" /> Edit Profile</SciFiButton>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <DeleteDialog open={showDeleteDialog} count={selectedIds.size} onCancelAction={() => setShowDeleteDialog(false)} onConfirmAction={confirmDelete} />
          </TooltipProvider>
        </ProtectedPageWrapper>
      </FormatProvider>
    </UserProvider>
  );
}
