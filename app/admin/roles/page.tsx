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
  Loader2,
  Search,
  ArrowUpDown,
  Trash2,
  Pencil,
  Repeat2,
  ArrowRight,
  Download,
  Eye,
  EyeOff,
  RotateCcw,
  UserPlus,
  SlidersHorizontal,
  Save,
  X as XIcon,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteDialog } from "@/components/admin/roles/delete";
import { TransferDialog } from "@/components/admin/roles/transfer";
import { ConvertEmailDialog } from "@/components/admin/roles/convert";
import { SpinnerItem } from "@/components/admin/roles/download";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ─── Status colours ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500 text-white",
  terminated: "bg-red-600 text-white",
  resigned: "bg-red-600 text-white",
  "do not disturb": "bg-black text-white",
  locked: "bg-gray-500 text-white",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UserAccount {
  _id: string;
  ReferenceID: string;
  TSM: string;
  Manager: string;
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
  LoginAttempts?: number; // needed for Reset Client Access guard
}

type SortKey = keyof Pick<
  UserAccount,
  "Firstname" | "Lastname" | "Email" | "Department" | "Company" | "Position"
>;

// ─── Directory / module config ────────────────────────────────────────────────

const DIRECTORIES = [
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
    submodules: [],
  },
  {
    key: "Stash",
    label: "Stash",
    description: "IT inventory management",
    submodules: [],
  },
];

// ─── Role options per department ─────────────────────────────────────────────

const DEFAULT_ROLES = ["User", "Manager", "Admin", "SuperAdmin", "Developer"];

const ROLES_BY_DEPARTMENT: Record<string, string[]> = {
  Sales: ["Territory Sales Associate", "Territory Sales Manager", "Manager"],
  "Sales Project": ["Office Sales"],
  CSR: ["Staff", "Admin"],
};

function getRolesForDepartment(dept: string): string[] {
  return ROLES_BY_DEPARTMENT[dept] ?? DEFAULT_ROLES;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateReferenceID(
  firstname: string,
  lastname: string,
  location: string,
): string {
  if (!firstname || !lastname || !location) return "";
  const initials = firstname[0].toUpperCase() + lastname[0].toUpperCase();
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `${initials}-${location}-${randomNum}`;
}

function getBadgeColor(dept: string): string {
  const map: Record<string, string> = {
    IT: "bg-blue-100 text-blue-800",
    HR: "bg-green-100 text-green-800",
    Finance: "bg-yellow-100 text-yellow-800",
    Marketing: "bg-pink-100 text-pink-800",
    Sales: "bg-purple-100 text-purple-800",
    "Dev-Team": "bg-black text-yellow-400",
  };
  return map[dept] || "bg-gray-100 text-gray-800";
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);

  // ── Table data ──────────────────────────────────────────────────────────────
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

  // ── Form mode + dialogs ────────────────────────────────────────────────────
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserAccount | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // ── Transfer dropdowns ─────────────────────────────────────────────────────
  const [managers, setManagers] = useState<{ label: string; value: string }[]>(
    [],
  );
  const [tsms, setTsms] = useState<{ label: string; value: string }[]>([]);

  // ── Inline create/edit form state ──────────────────────────────────────────
  const [newUser, setNewUser] = useState<
    Partial<UserAccount> & { Password?: string; ConfirmPassword?: string }
  >({
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
    Directories: [],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [formManagers, setFormManagers] = useState<
    { label: string; value: string }[]
  >([]);
  const [formTsms, setFormTsms] = useState<{ label: string; value: string }[]>(
    [],
  );

  // ── Reset Client Access state ───────────────────────────────────────────────
  const [isResetting, setIsResetting] = useState(false);

  // ─── Fetch accounts ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAccounts = async () => {
      setIsFetching(true);
      const toastId = toast.loading("Fetching user accounts...");
      try {
        const res = await fetch("/api/UserManagement/Fetch");
        const data = await res.json();
        setAccounts(data || []);
        toast.success("User accounts loaded successfully!", { id: toastId });
      } catch (err) {
        toast.error("Failed to fetch accounts", { id: toastId });
      } finally {
        setIsFetching(false);
      }
    };
    fetchAccounts();
  }, []);

  // True when at least one selected user belongs to Sales — drives transfer buttons
  const selectedAreSales = useMemo(
    () =>
      accounts.some((a) => selectedIds.has(a._id) && a.Department === "Sales"),
    [accounts, selectedIds],
  );

  // ─── Fetch Manager / TSM dropdowns for transfer dialog ──────────────────────
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
        setManagers(
          md.map((m: any) => ({
            label: `${m.Firstname} ${m.Lastname}`,
            value: m.ReferenceID,
          })),
        );
        setTsms(
          td.map((t: any) => ({
            label: `${t.Firstname} ${t.Lastname}`,
            value: t.ReferenceID,
          })),
        );
      } catch {
        toast.error("Failed to fetch manager/TSM lists.");
      }
    };
    fetchDropdowns();
  }, [showTransferDialog, selectedAreSales]);

  // ─── Fetch Manager / TSM dropdowns for inline form (Sales dept) ─────────────
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
        setFormManagers(
          md.map((m: any) => ({
            label: `${m.Firstname} ${m.Lastname}`,
            value: m.ReferenceID,
          })),
        );
        setFormTsms(
          td.map((t: any) => ({
            label: `${t.Firstname} ${t.Lastname}`,
            value: t.ReferenceID,
          })),
        );
      } catch {
        toast.error("Failed to fetch manager/TSM lists.");
      }
    };
    fetchFormDropdowns();
    setNewUser((prev) => ({ ...prev, Manager: "", TSM: "" }));
  }, [newUser.Department]);

  // ─── Directory helpers ───────────────────────────────────────────────────────
  const hasDir = (key: string) => newUser.Directories?.includes(key);

  const toggleDir = (key: string, checked: boolean) => {
    setNewUser((prev) => {
      const current = prev.Directories || [];

      if (key === "Ecodesk") {
        if (!checked)
          return {
            ...prev,
            Directories: current.filter((d) => !d.startsWith("Ecodesk")),
          };
        if (!current.includes("Ecodesk"))
          return { ...prev, Directories: [...current, "Ecodesk"] };
      }

      if (checked) {
        if (!current.includes(key))
          return { ...prev, Directories: [...current, key] };
      } else {
        return { ...prev, Directories: current.filter((d) => d !== key) };
      }
      return prev;
    });
  };

  // ─── Reset form ──────────────────────────────────────────────────────────────
  const resetForm = () => {
    setNewUser({
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
      Directories: [],
    });
    setShowPassword(false);
    setFormMode("create");
  };

  // ─── Form submit: create or save-edit ─────────────────────────────────────────
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === "edit") {
      await handleSaveEdit();
      return;
    }
    if (
      !newUser.Firstname ||
      !newUser.Lastname ||
      !newUser.Email ||
      !newUser.Location
    ) {
      toast.error("Missing required fields.");
      return;
    }
    setIsFormLoading(true);
    try {
      const res = await fetch("/api/UserManagement/UserCreate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const result = await res.json();
      if (!res.ok || !result.success)
        throw new Error(result.message || "Create failed");
      setAccounts((prev) => [...prev, result.data]);
      toast.success("✅ User created successfully!");
      resetForm();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsFormLoading(false);
    }
  };

  // ─── Filter options ───────────────────────────────────────────────────────────
  const departmentOptions = useMemo(
    () => [
      "all",
      ...new Set(accounts.map((a) => a.Department).filter(Boolean)),
    ],
    [accounts],
  );
  const companyOptions = useMemo(
    () => ["all", ...new Set(accounts.map((a) => a.Company).filter(Boolean))],
    [accounts],
  );
  const salesRoleOptions = useMemo(
    () => [
      "all",
      ...new Set(
        accounts
          .filter((a) => a.Department === "Sales")
          .map((a) => a.Role)
          .filter(Boolean),
      ),
    ],
    [accounts],
  );

  // ─── Filtered + sorted list ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const list = accounts
      .filter(
        (a) =>
          !["resigned", "terminated"].includes(
            (a.Status || "").trim().toLowerCase(),
          ),
      )
      .filter((a) =>
        [
          a.Firstname,
          a.Lastname,
          a.Email,
          a.Department,
          a.Company,
          a.Position,
        ].some((f) => f?.toLowerCase().includes(search.toLowerCase())),
      )
      .filter((a) =>
        filterDepartment === "all" ? true : a.Department === filterDepartment,
      )
      .filter((a) =>
        filterCompany === "all" ? true : a.Company === filterCompany,
      )
      .filter((a) =>
        filterRole === "all" || filterDepartment !== "Sales"
          ? true
          : a.Role === filterRole,
      );

    return [...list].sort((a, b) => {
      const va = (a[sortKey] || "").toString().toLowerCase();
      const vb = (b[sortKey] || "").toString().toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [
    accounts,
    search,
    filterDepartment,
    filterCompany,
    filterRole,
    sortKey,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const current = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // ─── Table helpers ────────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === current.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(current.map((u) => u._id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
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

  // ─── Delete ───────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    const toastId = toast.loading("Deleting accounts...");
    try {
      const res = await fetch("/api/UserManagement/UserDelete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error("Delete failed");
      setAccounts((prev) => prev.filter((a) => !selectedIds.has(a._id)));
      setSelectedIds(new Set());
      toast.success("Selected accounts deleted successfully.", { id: toastId });
    } catch (err) {
      toast.error("Error deleting accounts.", { id: toastId });
    } finally {
      setShowDeleteDialog(false);
    }
  };

  // ─── Cross-DB sync helper ─────────────────────────────────────────────────────
  const syncTsmManager = async (
    tsaReferenceId: string,
    field: "tsm" | "manager",
    newSupervisorReferenceId: string,
  ): Promise<void> => {
    if (!tsaReferenceId || !newSupervisorReferenceId) return;
    try {
      const res = await fetch("/api/UserManagement/TransferTSA", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tsaReferenceId,
          field,
          newSupervisorReferenceId,
        }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        console.error(
          `[TransferTSA] HTTP ${res.status} — route not found or server error.`,
        );
        return;
      }
      const data = await res.json();
      if (!data.success) {
        console.warn("[TransferTSA] partial failure:", data);
      }
    } catch (err) {
      console.error("[TransferTSA]", err);
    }
  };

  // ─── Save edit ────────────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!newUser._id) {
      toast.error("No user loaded for editing.");
      return;
    }
    const toastId = toast.loading("Updating account...");
    setIsFormLoading(true);

    const prevUser = accounts.find((a) => a._id === newUser._id);

    try {
      const res = await fetch("/api/UserManagement/UserUpdate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newUser._id, ...newUser }),
      });
      const result = await res.json();
      if (!res.ok || !result.success)
        throw new Error(result.message || "Update failed");

      // Cascade: park / restore Taskflow customers when a Sales user's status changes
      const savedStatus = (newUser.Status || "").trim().toLowerCase();
      const isSales =
        (newUser.Department || "").trim().toLowerCase() === "sales";
      const isPark = ["inactive", "terminated", "resigned"].includes(
        savedStatus,
      );
      const isRestore = savedStatus === "active";

      if (isSales && (isPark || isRestore) && newUser.ReferenceID) {
        try {
          const parkRes = await fetch(
            "/api/Data/Applications/Taskflow/CustomerDatabase/ParkByReferenceId",
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                referenceId: newUser.ReferenceID,
                targetStatus: isPark ? "park" : "Active",
              }),
            },
          );
          const parkResult = await parkRes.json();
          if (parkResult.success) toast.info(parkResult.message);
        } catch (cascadeErr) {
          console.error("[cascade park]", cascadeErr);
        }
      }

      // Cross-DB sync via TransferTSA: only fires when TSM or Manager actually changed
      if (isSales && newUser.ReferenceID) {
        const syncOps: Promise<void>[] = [];

        if (newUser.TSM && newUser.TSM !== prevUser?.TSM) {
          syncOps.push(syncTsmManager(newUser.ReferenceID, "tsm", newUser.TSM));
        }
        if (newUser.Manager && newUser.Manager !== prevUser?.Manager) {
          syncOps.push(
            syncTsmManager(newUser.ReferenceID, "manager", newUser.Manager),
          );
        }

        if (syncOps.length > 0) {
          await Promise.all(syncOps);
          toast.info("TSM/Manager synced across all databases.");
        }
      }

      setAccounts((prev) =>
        prev.map((a) => (a._id === newUser._id ? { ...a, ...newUser } : a)),
      );
      toast.success("User updated successfully!", { id: toastId });
      resetForm();
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setIsFormLoading(false);
    }
  };

  // ─── Reset Client Access ──────────────────────────────────────────────────────
  /**
   * Calls POST /api/UserManagement/ResetClientAccess
   * Only updates Status → "Active" and LoginAttempts → 0 in MongoDB.
   * All other user fields are untouched (see ResetClientAccess.ts).
   */
  const handleResetClientAccess = async () => {
    if (!newUser._id) {
      toast.error("No user selected.");
      return;
    }
    setIsResetting(true);
    const toastId = toast.loading("Resetting client access...");
    try {
      const res = await fetch("/api/UserManagement/ResetClientAccess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newUser._id }),
      });
      const result = await res.json();
      if (!res.ok || !result.success)
        throw new Error(result.message || "Reset failed");

      // Update local form state — only Status and LoginAttempts change
      setNewUser((prev) => ({
        ...prev,
        Status: "Active",
        LoginAttempts: 0,
        LockUntil: null,
      }));

      // Update accounts list — only the Status column needs to reflect
      setAccounts((prev) =>
        prev.map((a) =>
          a._id === newUser._id
            ? { ...a, Status: "Active", LoginAttempts: 0 }
            : a,
        ),
      );

      toast.success("Client access reset successfully!", { id: toastId });
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setIsResetting(false);
    }
  };

  // ─── CSV download ─────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (filtered.length === 0) return;
    setIsDownloading(true);

    const totalBytes = filtered.reduce(
      (acc, u) =>
        acc +
        [
          u.ReferenceID,
          u.Firstname,
          u.Lastname,
          u.Email,
          u.Department,
          u.Company,
          u.Position,
          u.TSM,
          u.Manager,
          u.Status,
        ]
          .map((v) => (v?.length || 0) + 3)
          .reduce((a, b) => a + b, 0),
      0,
    );

    let currentBytes = 0;
    const toastId = toast(
      () => (
        <SpinnerItem
          currentBytes={currentBytes}
          totalBytes={totalBytes}
          fileCount={filtered.length}
          onCancel={() => {
            toast.dismiss(toastId);
            setIsDownloading(false);
          }}
        />
      ),
      { duration: Infinity },
    );

    try {
      const header = [
        "ReferenceID",
        "Firstname",
        "Lastname",
        "Email",
        "Department",
        "Company",
        "Position",
        "TSM",
        "Manager",
        "Status",
      ].join(",");
      const rows = filtered.map((u) =>
        [
          u.ReferenceID,
          u.Firstname,
          u.Lastname,
          u.Email,
          u.Department,
          u.Company,
          u.Position,
          u.TSM,
          u.Manager,
          u.Status,
        ]
          .map((v) => `"${v || ""}"`)
          .join(","),
      );
      const csvContent = [header, ...rows].join("\n");
      await new Promise((resolve) => setTimeout(resolve, 500));
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `user_accounts_page_${page}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("CSV download started!", { id: toastId });
    } catch {
      toast.error("Failed to download CSV", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── Company → email auto-fill ────────────────────────────────────────────────
  const handleCompanyChange = (value: string) => {
    const domain =
      value === "Ecoshift Corporation"
        ? "@ecoshiftcorp.com"
        : value === "Disruptive Solutions Inc"
          ? "@disruptivesolutionsinc.com"
          : "";

    setNewUser((prev) => {
      const firstInitial = prev.Firstname
        ? prev.Firstname.charAt(0).toLowerCase()
        : "";
      const lastName = prev.Lastname ? prev.Lastname.toLowerCase() : "";
      const email =
        firstInitial && lastName && domain
          ? `${firstInitial}.${lastName}${domain}`
          : prev.Email || "";
      return { ...prev, Company: value, Email: email };
    });
  };

  // ─── Derived: whether the user being edited is locked ─────────────────────────
  const isEditingLockedUser =
    formMode === "edit" &&
    ((newUser.Status || "").trim().toLowerCase() === "locked" ||
      (newUser.LoginAttempts ?? 0) >= 5);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <UserProvider>
      <FormatProvider>
        <ProtectedPageWrapper>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              {/* Header */}
              <header className="flex h-16 items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/dashboard")}
                >
                  Home
                </Button>
                <Separator orientation="vertical" className="h-4" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#">Admin</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>User Accounts</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </header>

              {/* Page title */}
              <div className="px-4 pb-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  User Management
                </h1>
                <p className="text-sm text-muted-foreground">
                  Manage company accounts and create new users —{" "}
                  {isFetching ? (
                    <span>Loading…</span>
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">
                        {filtered.length}
                      </span>{" "}
                      user{filtered.length !== 1 ? "s" : ""}
                    </>
                  )}
                </p>
              </div>

              {/* ══ Two-column layout ══ */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 pb-8 items-start">
                {/* ═══ LEFT: Inline Create / Edit Form ═══ */}
                <div className="lg:col-span-4 sticky top-6 z-10">
                  <Card className="rounded-none shadow-none border-foreground/10 max-h-[calc(100vh-10rem)] overflow-y-auto">
                    <CardHeader className="border-b">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                          {formMode === "edit" ? (
                            <>
                              <Pencil className="w-4 h-4" /> Edit Account
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" /> Create New
                              Account
                            </>
                          )}
                        </CardTitle>
                        {(formMode === "edit" ||
                          newUser.Firstname ||
                          newUser.Email ||
                          newUser.Role) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetForm}
                            className="h-7 rounded-none text-[9px] uppercase font-bold text-muted-foreground"
                            disabled={isFormLoading}
                          >
                            {formMode === "edit" ? (
                              <>
                                <XIcon className="mr-1 h-3 w-3" /> Cancel
                              </>
                            ) : (
                              <>
                                <RotateCcw className="mr-1 h-3 w-3" /> Reset
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      {formMode === "edit" && newUser.Firstname && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Editing:{" "}
                          <span className="font-semibold text-foreground">
                            {newUser.Firstname} {newUser.Lastname}
                          </span>
                        </p>
                      )}
                    </CardHeader>

                    <CardContent className="pt-5">
                      <form
                        onSubmit={handleCreateAccount}
                        className="space-y-4"
                      >
                        {/* Firstname */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase opacity-60">
                            Firstname{" "}
                            <span className="text-destructive">*</span>
                          </label>
                          <Input
                            placeholder="Firstname"
                            className="rounded-none h-10 text-xs"
                            value={newUser.Firstname || ""}
                            disabled={isFormLoading}
                            onChange={(e) => {
                              const Firstname = e.target.value;
                              setNewUser((prev) => ({
                                ...prev,
                                Firstname,
                                ReferenceID: generateReferenceID(
                                  Firstname,
                                  prev.Lastname || "",
                                  prev.Location || "",
                                ),
                              }));
                            }}
                          />
                        </div>

                        {/* Lastname */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase opacity-60">
                            Lastname <span className="text-destructive">*</span>
                          </label>
                          <Input
                            placeholder="Lastname"
                            className="rounded-none h-10 text-xs"
                            value={newUser.Lastname || ""}
                            disabled={isFormLoading}
                            onChange={(e) => {
                              const Lastname = e.target.value;
                              setNewUser((prev) => ({
                                ...prev,
                                Lastname,
                                ReferenceID: generateReferenceID(
                                  prev.Firstname || "",
                                  Lastname,
                                  prev.Location || "",
                                ),
                              }));
                            }}
                          />
                        </div>

                        {/* Location */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase opacity-60">
                            Location <span className="text-destructive">*</span>
                          </label>
                          <select
                            className="w-full border rounded-none px-3 py-2 text-xs h-10"
                            value={newUser.Location || ""}
                            disabled={isFormLoading}
                            onChange={(e) => {
                              const Location = e.target.value;
                              setNewUser((prev) => ({
                                ...prev,
                                Location,
                                ReferenceID: generateReferenceID(
                                  prev.Firstname || "",
                                  prev.Lastname || "",
                                  Location,
                                ),
                              }));
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

                        {/* Reference ID (readonly) */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase opacity-60">
                            Reference ID
                          </label>
                          <Input
                            value={newUser.ReferenceID || ""}
                            readOnly
                            className="rounded-none h-10 text-xs bg-muted/40"
                          />
                        </div>

                        {/* Company */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase opacity-60">
                            Company
                          </label>
                          <Select
                            value={newUser.Company || ""}
                            onValueChange={handleCompanyChange}
                            disabled={isFormLoading}
                          >
                            <SelectTrigger className="rounded-none h-10 text-xs">
                              <SelectValue placeholder="Select Company" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Ecoshift Corporation">
                                Ecoshift Corporation
                              </SelectItem>
                              <SelectItem value="Disruptive Solutions Inc">
                                Disruptive Solutions Inc
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase opacity-60">
                            Email <span className="text-destructive">*</span>
                          </label>
                          <Input
                            type="email"
                            placeholder="Auto-filled from company"
                            className="rounded-none h-10 text-xs"
                            value={newUser.Email || ""}
                            disabled={isFormLoading}
                            onChange={(e) =>
                              setNewUser((prev) => ({
                                ...prev,
                                Email: e.target.value,
                              }))
                            }
                          />
                        </div>

                        {/* Department */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase opacity-60">
                            Department
                          </label>
                          <Select
                            value={newUser.Department || ""}
                            onValueChange={(v) =>
                              setNewUser((prev) => ({
                                ...prev,
                                Department: v,
                                Role: "",
                              }))
                            }
                            disabled={isFormLoading}
                          >
                            <SelectTrigger className="rounded-none h-10 text-xs">
                              <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                "Sales",
                                "IT",
                                "CSR",
                                "HR",
                                "Ecommerce",
                                "Marketing",
                                "Engineering",
                                "Admin",
                                "Warehouse Operations",
                                "Accounting",
                                "Owner",
                                "Procurement",
                              ].map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Sales-only fields */}
                        {newUser.Department === "Sales" && (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase opacity-60">
                                Manager
                              </label>
                              <Select
                                value={newUser.Manager || ""}
                                onValueChange={(v) =>
                                  setNewUser((prev) => ({
                                    ...prev,
                                    Manager: v,
                                  }))
                                }
                                disabled={isFormLoading}
                              >
                                <SelectTrigger className="rounded-none h-10 text-xs">
                                  <SelectValue placeholder="Select Manager" />
                                </SelectTrigger>
                                <SelectContent>
                                  {formManagers.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                      {m.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase opacity-60">
                                TSM
                              </label>
                              <Select
                                value={newUser.TSM || ""}
                                onValueChange={(v) =>
                                  setNewUser((prev) => ({ ...prev, TSM: v }))
                                }
                                disabled={isFormLoading}
                              >
                                <SelectTrigger className="rounded-none h-10 text-xs">
                                  <SelectValue placeholder="Select TSM" />
                                </SelectTrigger>
                                <SelectContent>
                                  {formTsms.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase opacity-60">
                                Target Quota
                              </label>
                              <Input
                                type="number"
                                placeholder="Enter target quota"
                                className="rounded-none h-10 text-xs"
                                value={newUser.TargetQuota || ""}
                                disabled={isFormLoading}
                                onChange={(e) =>
                                  setNewUser((prev) => ({
                                    ...prev,
                                    TargetQuota: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          </>
                        )}

                        {/* Position */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase opacity-60">
                            Position
                          </label>
                          <Input
                            placeholder="Position"
                            className="rounded-none h-10 text-xs"
                            value={newUser.Position || ""}
                            disabled={isFormLoading}
                            onChange={(e) =>
                              setNewUser((prev) => ({
                                ...prev,
                                Position: e.target.value,
                              }))
                            }
                          />
                        </div>

                        {/* Role */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase opacity-60">
                            Role
                          </label>
                          <Select
                            value={newUser.Role || ""}
                            disabled={isFormLoading}
                            onValueChange={(v) =>
                              setNewUser((prev) => ({ ...prev, Role: v }))
                            }
                          >
                            <SelectTrigger className="rounded-none h-10 text-xs">
                              <SelectValue placeholder="Select Role" />
                            </SelectTrigger>
                            <SelectContent>
                              {getRolesForDepartment(
                                newUser.Department || "",
                              ).map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Status */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase opacity-60">
                            Status
                          </label>
                          <select
                            className="w-full border rounded-none px-3 py-2 text-xs h-10"
                            value={newUser.Status || "Active"}
                            disabled={isFormLoading}
                            onChange={(e) =>
                              setNewUser((prev) => ({
                                ...prev,
                                Status: e.target.value,
                              }))
                            }
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Suspended">Suspended</option>
                            {/* Locked is read-only from the system; shown so it
                                displays correctly when editing a locked user */}
                            <option value="Locked">Locked</option>
                          </select>
                        </div>

                        {/* ── Reset Client Access ─────────────────────────────
                            Only visible in edit mode when the user is Locked
                            or has reached 5 login attempts.
                            Calls POST /api/UserManagement/ResetClientAccess
                            which only updates Status + LoginAttempts + LockUntil.
                            All other fields remain untouched in MongoDB.
                        ─────────────────────────────────────────────────────── */}
                        {isEditingLockedUser && (
                          <div className="rounded-none border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <ShieldOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                                Account is Locked
                              </span>
                              {(newUser.LoginAttempts ?? 0) > 0 && (
                                <span className="ml-auto text-[10px] text-amber-700 dark:text-amber-400">
                                  {newUser.LoginAttempts}/5 attempts
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-amber-700 dark:text-amber-400">
                              Reset the user's status to Active and clear their
                              failed login count.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isResetting || isFormLoading}
                              onClick={handleResetClientAccess}
                              className="w-full rounded-none h-9 text-[10px] uppercase font-bold tracking-widest gap-2 border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/50"
                            >
                              {isResetting ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                                  Resetting…
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                                  Client Access
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        {/* Password */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase opacity-60">
                            Password <span className="text-destructive">*</span>
                          </label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Min. 8 characters"
                                className="rounded-none h-10 text-xs pr-10"
                                value={newUser.Password || ""}
                                disabled={isFormLoading}
                                onChange={(e) =>
                                  setNewUser((prev) => ({
                                    ...prev,
                                    Password: e.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword((p) => !p)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                disabled={isFormLoading}
                              >
                                {showPassword ? (
                                  <EyeOff size={14} />
                                ) : (
                                  <Eye size={14} />
                                )}
                              </button>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              className="rounded-none text-xs h-10 px-3 shrink-0"
                              disabled={isFormLoading}
                              onClick={() => {
                                const generated = Math.random()
                                  .toString(36)
                                  .slice(-10);
                                setNewUser((prev) => ({
                                  ...prev,
                                  Password: generated,
                                }));
                                toast.info("New password generated!");
                              }}
                            >
                              Generate
                            </Button>
                          </div>
                        </div>

                        {/* Directory Access */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase opacity-60">
                            Directory Access
                          </label>
                          <div className="space-y-2">
                            {DIRECTORIES.map((dir) => (
                              <div
                                key={dir.key}
                                className="rounded-none border p-3"
                              >
                                <label className="flex items-start gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!hasDir(dir.key)}
                                    onChange={(e) =>
                                      toggleDir(dir.key, e.target.checked)
                                    }
                                    className="mt-1 h-4 w-4 rounded border-gray-300"
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-xs font-medium">
                                      {dir.label}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {dir.description}
                                    </span>
                                  </div>
                                </label>

                                {dir.submodules.length > 0 &&
                                  hasDir(dir.key) && (
                                    <div className="mt-3 ml-7 space-y-2 border-l pl-4">
                                      {dir.submodules.map((sub) => {
                                        const key = `${dir.key}:${sub}`;
                                        return (
                                          <label
                                            key={key}
                                            className="flex items-center gap-2 text-[10px] cursor-pointer"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={!!hasDir(key)}
                                              onChange={(e) =>
                                                toggleDir(key, e.target.checked)
                                              }
                                              className="h-3.5 w-3.5 rounded border-gray-300"
                                            />
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

                        {/* Submit */}
                        <Button
                          type="submit"
                          disabled={isFormLoading}
                          className="w-full rounded-none uppercase font-bold text-[10px] h-11 tracking-widest gap-2"
                        >
                          {isFormLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />{" "}
                              {formMode === "edit"
                                ? "Saving…"
                                : "Provisioning…"}
                            </>
                          ) : formMode === "edit" ? (
                            <>
                              <Save className="h-4 w-4" /> Save Changes
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4" /> Create Account
                            </>
                          )}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>

                {/* ═══ RIGHT: Table ═══ */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Toolbar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Search */}
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                        className="pl-8 w-full"
                      />
                      {isFetching && (
                        <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      {/* Convert + Download */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 text-sm"
                        onClick={() => setShowConvertDialog(true)}
                      >
                        <Repeat2 className="w-4 h-4" /> Convert Emails
                      </Button>

                      <ConvertEmailDialog
                        open={showConvertDialog}
                        onOpenChangeAction={setShowConvertDialog}
                        accounts={accounts}
                        setAccountsAction={setAccounts}
                      />

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 text-sm"
                        disabled={filtered.length === 0 || isDownloading}
                        onClick={handleDownload}
                      >
                        <Download className="w-4 h-4" /> Download
                      </Button>

                      {/* Transfer button — visible when any selected user is Sales */}
                      {selectedAreSales && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 text-sm"
                          disabled={selectedIds.size === 0}
                          onClick={() => setShowTransferDialog(true)}
                        >
                          <ArrowRight className="w-4 h-4" /> Transfer
                        </Button>
                      )}

                      {/* Bulk delete */}
                      {selectedIds.size > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-10 text-sm flex items-center gap-1"
                          onClick={() => setShowDeleteDialog(true)}
                        >
                          <Trash2 className="w-4 h-4" /> Delete{" "}
                          {selectedIds.size}
                        </Button>
                      )}

                      {/* ── Consolidated filter / sort dropdown ── */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-10 gap-2 ${
                              filterDepartment !== "all" ||
                              filterCompany !== "all" ||
                              filterRole !== "all" ||
                              sortKey !== "Firstname" ||
                              !sortAsc
                                ? "border-primary text-primary bg-primary/5"
                                : ""
                            }`}
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                            Filters
                            {(filterDepartment !== "all" ||
                              filterCompany !== "all" ||
                              filterRole !== "all" ||
                              sortKey !== "Firstname" ||
                              !sortAsc) && (
                              <span className="ml-1 w-2 h-2 rounded-full bg-primary" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-56 p-0 flex flex-col max-h-[420px]"
                        >
                          {/* ── Sticky reset at top ── */}
                          <div className="sticky top-0 z-10 bg-popover border-b px-3 py-2 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              Filters
                            </span>
                            <button
                              type="button"
                              className="text-[10px] font-semibold text-primary hover:underline transition-colors"
                              onClick={() => {
                                setFilterDepartment("all");
                                setFilterCompany("all");
                                setFilterRole("all");
                                setSortKey("Firstname");
                                setSortAsc(true);
                                setRowsPerPage(10);
                                setPage(1);
                              }}
                            >
                              Reset all
                            </button>
                          </div>

                          {/* ── Scrollable body ── */}
                          <div className="overflow-y-auto flex-1">
                            {/* Sort section */}
                            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-2">
                              Sort By
                            </DropdownMenuLabel>
                            {(
                              [
                                {
                                  key: "Firstname",
                                  asc: true,
                                  label: "Name A → Z",
                                },
                                {
                                  key: "Firstname",
                                  asc: false,
                                  label: "Name Z → A",
                                },
                                {
                                  key: "Department",
                                  asc: true,
                                  label: "Department A → Z",
                                },
                                {
                                  key: "Company",
                                  asc: true,
                                  label: "Company A → Z",
                                },
                                {
                                  key: "Position",
                                  asc: true,
                                  label: "Position A → Z",
                                },
                                {
                                  key: "Email",
                                  asc: true,
                                  label: "Email A → Z",
                                },
                              ] as {
                                key: SortKey;
                                asc: boolean;
                                label: string;
                              }[]
                            ).map((opt) => (
                              <DropdownMenuCheckboxItem
                                key={`${opt.key}-${opt.asc}`}
                                checked={
                                  sortKey === opt.key && sortAsc === opt.asc
                                }
                                onCheckedChange={() => {
                                  setSortKey(opt.key);
                                  setSortAsc(opt.asc);
                                  setPage(1);
                                }}
                              >
                                {opt.label}
                              </DropdownMenuCheckboxItem>
                            ))}

                            <DropdownMenuSeparator />

                            {/* Department filter */}
                            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              Department
                            </DropdownMenuLabel>
                            {departmentOptions.map((d) => (
                              <DropdownMenuCheckboxItem
                                key={d}
                                checked={filterDepartment === d}
                                onCheckedChange={() => {
                                  setFilterDepartment(d);
                                  setFilterRole("all");
                                  setPage(1);
                                }}
                              >
                                {d === "all" ? "All Departments" : d}
                              </DropdownMenuCheckboxItem>
                            ))}

                            {/* Sales roles sub-filter */}
                            {filterDepartment === "Sales" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                  Sales Role
                                </DropdownMenuLabel>
                                {salesRoleOptions.map((r) => (
                                  <DropdownMenuCheckboxItem
                                    key={r}
                                    checked={filterRole === r}
                                    onCheckedChange={() => {
                                      setFilterRole(r);
                                      setPage(1);
                                    }}
                                  >
                                    {r === "all" ? "All Roles" : r}
                                  </DropdownMenuCheckboxItem>
                                ))}
                              </>
                            )}

                            <DropdownMenuSeparator />

                            {/* Company filter */}
                            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              Company
                            </DropdownMenuLabel>
                            {companyOptions.map((c) => (
                              <DropdownMenuCheckboxItem
                                key={c}
                                checked={filterCompany === c}
                                onCheckedChange={() => {
                                  setFilterCompany(c);
                                  setPage(1);
                                }}
                              >
                                {c === "all" ? "All Companies" : c}
                              </DropdownMenuCheckboxItem>
                            ))}

                            <DropdownMenuSeparator />

                            {/* Rows per page */}
                            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              Rows per page
                            </DropdownMenuLabel>
                            {[10, 20, 50, 100].map((n) => (
                              <DropdownMenuCheckboxItem
                                key={n}
                                checked={rowsPerPage === n}
                                onCheckedChange={() => {
                                  setRowsPerPage(n);
                                  setPage(1);
                                }}
                              >
                                {n} rows
                              </DropdownMenuCheckboxItem>
                            ))}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <TransferDialog
                        open={showTransferDialog}
                        onOpenChangeAction={setShowTransferDialog}
                        selectedUsers={accounts.filter((a) =>
                          selectedIds.has(a._id),
                        )}
                        setSelectedIdsAction={setSelectedIds}
                        setAccountsAction={setAccounts}
                        tsms={tsms}
                        managers={managers}
                      />
                    </div>
                  </div>

                  {/* Table */}
                  <div className="border border-border shadow-sm rounded-lg overflow-auto">
                    {isFetching ? (
                      <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
                        <Loader2 className="size-6 animate-spin" />
                        <span>Loading accounts…</span>
                      </div>
                    ) : current.length > 0 ? (
                      <Table className="text-sm whitespace-nowrap">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10 text-center">
                              <Checkbox
                                checked={
                                  selectedIds.size === current.length &&
                                  current.length > 0
                                }
                                onCheckedChange={toggleSelectAll}
                              />
                            </TableHead>
                            <TableHead>Profile</TableHead>
                            <TableHead
                              className="cursor-pointer select-none"
                              onClick={() => handleSort("Firstname")}
                            >
                              <div className="flex items-center gap-1">
                                Fullname{" "}
                                <ArrowUpDown
                                  className={`size-4 ${sortKey === "Firstname" ? "text-primary" : "text-muted-foreground"}`}
                                />
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer select-none"
                              onClick={() => handleSort("Email")}
                            >
                              <div className="flex items-center gap-1">
                                Email{" "}
                                <ArrowUpDown
                                  className={`size-4 ${sortKey === "Email" ? "text-primary" : "text-muted-foreground"}`}
                                />
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer select-none"
                              onClick={() => handleSort("Department")}
                            >
                              <div className="flex items-center gap-1">
                                Department{" "}
                                <ArrowUpDown
                                  className={`size-4 ${sortKey === "Department" ? "text-primary" : "text-muted-foreground"}`}
                                />
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer select-none"
                              onClick={() => handleSort("Company")}
                            >
                              <div className="flex items-center gap-1">
                                Company{" "}
                                <ArrowUpDown
                                  className={`size-4 ${sortKey === "Company" ? "text-primary" : "text-muted-foreground"}`}
                                />
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer select-none"
                              onClick={() => handleSort("Position")}
                            >
                              <div className="flex items-center gap-1">
                                Position{" "}
                                <ArrowUpDown
                                  className={`size-4 ${sortKey === "Position" ? "text-primary" : "text-muted-foreground"}`}
                                />
                              </div>
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {current.map((u) => (
                            <TableRow
                              key={u._id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setViewingUser(u)}
                            >
                              <TableCell
                                className="text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={selectedIds.has(u._id)}
                                  onCheckedChange={() => toggleSelect(u._id)}
                                />
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                {u.profilePicture ? (
                                  <img
                                    src={u.profilePicture}
                                    alt="profile"
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                                    N/A
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="capitalize">
                                {u.Firstname}, {u.Lastname}
                              </TableCell>
                              <TableCell>
                                {u.Email}
                                <br />
                                <span className="text-[10px] italic">
                                  {u.ReferenceID}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={`${getBadgeColor(
                                    [
                                      "Guest",
                                      "Senior Fullstack Developer",
                                      "IT - OJT",
                                    ].includes(u.Position)
                                      ? "Dev-Team"
                                      : u.Department,
                                  )} font-medium`}
                                >
                                  {[
                                    "Guest",
                                    "Senior Fullstack Developer",
                                    "IT - OJT",
                                  ].includes(u.Position)
                                    ? "Dev Team"
                                    : u.Department || "—"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {u.Company || "—"}
                                <br />
                                {u.Location || "—"}
                              </TableCell>
                              <TableCell>
                                {u.Position || "—"}
                                {u.Role === "Territory Sales Associate" && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    TQ: {u.TargetQuota || "—"}
                                    <br />
                                    TSM: {u.TSM || "—"}
                                    <br />
                                    Manager: {u.Manager || "—"}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="capitalize">
                                <Badge
                                  className={
                                    STATUS_COLORS[
                                      (u.Status || "").toLowerCase()
                                    ] || "bg-gray-300"
                                  }
                                >
                                  {u.Status}
                                </Badge>
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(u)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="py-10 text-center text-xs text-muted-foreground">
                        No users found.
                      </div>
                    )}
                  </div>

                  {/* Pagination + rows info */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 my-4">
                    <p className="text-xs text-muted-foreground">
                      Showing{" "}
                      {filtered.length === 0 ? 0 : (page - 1) * rowsPerPage + 1}
                      –{Math.min(page * rowsPerPage, filtered.length)} of{" "}
                      {filtered.length} users
                    </p>
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      onPageChangeAction={setPage}
                    />
                  </div>
                </div>
              </div>
            </SidebarInset>
          </SidebarProvider>

          {/* ── User detail / preview dialog ── */}
          {viewingUser &&
            (() => {
              const u = viewingUser;

              const subordinateTSAs = accounts.filter(
                (a) =>
                  a.Role === "Territory Sales Associate" &&
                  (a.TSM === u.ReferenceID || a.Manager === u.ReferenceID),
              );

              const isTSA = u.Role === "Territory Sales Associate";
              const isLeader = ["Territory Sales Manager", "Manager"].includes(
                u.Role,
              );

              const tsmUser = accounts.find((a) => a.ReferenceID === u.TSM);
              const managerUser = accounts.find(
                (a) => a.ReferenceID === u.Manager,
              );

              return (
                <Dialog
                  open={!!viewingUser}
                  onOpenChange={() => setViewingUser(null)}
                >
                  <DialogContent className="sm:max-w-2xl max-w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="pb-0">
                      <div className="flex items-start gap-4">
                        {u.profilePicture ? (
                          <img
                            src={u.profilePicture}
                            alt="avatar"
                            className="w-14 h-14 rounded-full object-cover flex-shrink-0 border"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground flex-shrink-0 border">
                            {(u.Firstname?.[0] ?? "") + (u.Lastname?.[0] ?? "")}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <DialogTitle className="text-lg">
                            {u.Firstname} {u.Lastname}
                          </DialogTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {u.Email}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <Badge
                              className={`${STATUS_COLORS[(u.Status || "").toLowerCase()] || "bg-gray-300"} text-[10px]`}
                            >
                              {u.Status}
                            </Badge>
                            {u.Department && (
                              <Badge
                                className={`${getBadgeColor(
                                  [
                                    "Guest",
                                    "Senior Fullstack Developer",
                                    "IT - OJT",
                                  ].includes(u.Position)
                                    ? "Dev-Team"
                                    : u.Department,
                                )} text-[10px]`}
                              >
                                {u.Department}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </DialogHeader>

                    <div className="space-y-5 pt-2">
                      {/* Core details */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          Account Details
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          {[
                            { label: "Reference ID", value: u.ReferenceID },
                            { label: "Company", value: u.Company },
                            { label: "Location", value: u.Location },
                            { label: "Department", value: u.Department },
                            { label: "Position", value: u.Position },
                            { label: "Role", value: u.Role },
                          ].map(({ label, value }) => (
                            <div key={label}>
                              <p className="text-[10px] text-muted-foreground">
                                {label}
                              </p>
                              <p className="font-medium text-xs mt-0.5">
                                {value || "—"}
                              </p>
                            </div>
                          ))}
                          {u.TargetQuota && (
                            <div>
                              <p className="text-[10px] text-muted-foreground">
                                Target Quota
                              </p>
                              <p className="font-medium text-xs mt-0.5">
                                {u.TargetQuota}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* TSA: show TSM + Manager hierarchy */}
                      {isTSA && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                            Reports To
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              {
                                label: "Territory Sales Manager",
                                user: tsmUser,
                                raw: u.TSM,
                              },
                              {
                                label: "Manager",
                                user: managerUser,
                                raw: u.Manager,
                              },
                            ].map(({ label, user: su, raw }) => (
                              <div
                                key={label}
                                className="rounded-md border p-3 flex items-center gap-3 bg-muted/30"
                              >
                                {su?.profilePicture ? (
                                  <img
                                    src={su.profilePicture}
                                    alt=""
                                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-muted border flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">
                                    {su
                                      ? (su.Firstname?.[0] ?? "") +
                                        (su.Lastname?.[0] ?? "")
                                      : "?"}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-[9px] font-bold uppercase text-muted-foreground">
                                    {label}
                                  </p>
                                  <p className="text-xs font-medium truncate">
                                    {su
                                      ? `${su.Firstname} ${su.Lastname}`
                                      : raw || "—"}
                                  </p>
                                  {su && (
                                    <p className="text-[9px] text-muted-foreground truncate">
                                      {su.Email}
                                    </p>
                                  )}
                                </div>
                                {su && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 flex-shrink-0"
                                    title={`Edit ${su.Firstname} ${su.Lastname}`}
                                    onClick={() => {
                                      setViewingUser(null);
                                      handleEdit(su);
                                    }}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* TSM / Manager: show TSAs under them */}
                      {isLeader && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                            Territory Sales Associates
                            <span className="ml-2 normal-case font-normal text-muted-foreground">
                              ({subordinateTSAs.length})
                            </span>
                          </p>
                          {subordinateTSAs.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">
                              No TSAs assigned under this user.
                            </p>
                          ) : (
                            <div className="divide-y border rounded-md max-h-48 overflow-y-auto">
                              {subordinateTSAs.map((tsa) => (
                                <div
                                  key={tsa._id}
                                  className="flex items-center gap-3 px-3 py-2"
                                >
                                  {tsa.profilePicture ? (
                                    <img
                                      src={tsa.profilePicture}
                                      alt=""
                                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-muted border flex items-center justify-center text-[9px] font-bold text-muted-foreground flex-shrink-0">
                                      {(tsa.Firstname?.[0] ?? "") +
                                        (tsa.Lastname?.[0] ?? "")}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">
                                      {tsa.Firstname} {tsa.Lastname}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground truncate">
                                      {tsa.Email}
                                    </p>
                                  </div>
                                  <Badge
                                    className={`${STATUS_COLORS[(tsa.Status || "").toLowerCase()] || "bg-gray-300"} text-[9px] flex-shrink-0`}
                                  >
                                    {tsa.Status}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 flex-shrink-0"
                                    title={`Edit ${tsa.Firstname} ${tsa.Lastname}`}
                                    onClick={() => {
                                      setViewingUser(null);
                                      handleEdit(tsa);
                                    }}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Directory access */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          Directory Access
                        </p>
                        {(u.Directories?.length ?? 0) === 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            No directory access assigned.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {u.Directories!.map((dir, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-muted px-2 py-1 rounded-md border"
                              >
                                {dir}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <DialogFooter className="mt-2">
                      <Button
                        variant="outline"
                        onClick={() => setViewingUser(null)}
                      >
                        Close
                      </Button>
                      <Button
                        onClick={() => {
                          setViewingUser(null);
                          handleEdit(u);
                        }}
                      >
                        <Pencil className="w-3 h-3 mr-1.5" /> Edit
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              );
            })()}

          {/* ── Delete dialog ── */}
          <DeleteDialog
            open={showDeleteDialog}
            count={selectedIds.size}
            onCancelAction={() => setShowDeleteDialog(false)}
            onConfirmAction={confirmDelete}
          />
        </ProtectedPageWrapper>
      </FormatProvider>
    </UserProvider>
  );
}