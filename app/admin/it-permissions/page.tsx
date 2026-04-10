"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Shield,
  ShieldCheck,
  Users,
  LayoutGrid,
  X,
  Save,
  ChevronDown,
  ChevronRight,
  UserCog,
  Lock,
  Unlock,
  ScanLine,
  Fingerprint,
  Eye,
  EyeOff,
  Key,
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  History,
  Download,
  RefreshCw,
  Filter,
  Zap,
  Terminal,
  Copy,
  Layers,
  FileText,
  Calendar,
  AlertCircle,
  Clock,
  Trash2,
  Plus,
  MoreHorizontal,
  CheckSquare
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UserAccount {
  _id: string;
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  Email: string;
  Department: string;
  Company: string;
  Position: string;
  Role: string;
  Status: string;
  Directories?: string[];
}

interface SidebarModule {
  key: string;
  title: string;
  icon: string;
  description: string;
  items: { title: string; url: string }[];
}

interface RolePermission {
  role: string;
  department: string;
  modules: string[];
  submodules: string[];
}

interface PermissionTemplate {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: "grant" | "revoke" | "template_apply" | "copy" | "bulk_update";
  targetUserId: string;
  targetUserName: string;
  changes: {
    module?: string;
    submodule?: string;
    oldValue: boolean;
    newValue: boolean;
  }[];
  timestamp: string;
  performedBy: string;
  reason?: string;
}

interface TimeBasedPermission {
  id: string;
  userId: string;
  permission: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdBy: string;
}

interface ConflictWarning {
  type: "dependency" | "exclusive" | "risk";
  message: string;
  modules: string[];
  severity: "low" | "medium" | "high";
}

const IT_ROLES = ["IT Staff", "IT Admin", "IT Manager", "IT Support", "Developer"];

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getBadgeColor(role: string): string {
  const map: Record<string, string> = {
    "IT Staff": "bg-cyan-500/20 text-cyan-300 border-cyan-500/50",
    "IT Admin": "bg-purple-500/20 text-purple-300 border-purple-500/50",
    "IT Manager": "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
    "IT Support": "bg-amber-500/20 text-amber-300 border-amber-500/50",
    Developer: "bg-pink-500/20 text-pink-300 border-pink-500/50",
    Admin: "bg-red-500/20 text-red-300 border-red-500/50",
    SuperAdmin: "bg-gradient-to-r from-red-500/30 to-orange-500/30 text-orange-200 border-orange-500/50",
  };
  return map[role] || "bg-slate-500/20 text-slate-300 border-slate-500/50";
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
    terminated: "bg-red-500/20 text-red-300 border-red-500/50",
    resigned: "bg-orange-500/20 text-orange-300 border-orange-500/50",
    inactive: "bg-slate-500/20 text-slate-300 border-slate-500/50",
    locked: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
  };
  return map[status.toLowerCase()] || "bg-slate-500/20 text-slate-300 border-slate-500/50";
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function ITPermissionsPage() {
  const router = useRouter();

  // ── State ────────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [sidebarModules, setSidebarModules] = useState<SidebarModule[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(true);

  // ── Bulk Actions State ─────────────────────────────────────────────────────
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showBulkActionDialog, setShowBulkActionDialog] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"grant" | "revoke" | "template">("grant");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // ── Templates State ──────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isTemplateSaving, setIsTemplateSaving] = useState(false);

  // ── Copy Permissions State ─────────────────────────────────────────────────
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [sourceUserId, setSourceUserId] = useState<string | null>(null);
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [isCopying, setIsCopying] = useState(false);

  // ── Preview State ───────────────────────────────────────────────────────────
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewUser, setPreviewUser] = useState<UserAccount | null>(null);
  const [previewAccessibleScreens, setPreviewAccessibleScreens] = useState<string[]>([]);

  // ── Audit Log State ──────────────────────────────────────────────────────────
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showAuditLogDialog, setShowAuditLogDialog] = useState(false);
  const [isLoadingAuditLog, setIsLoadingAuditLog] = useState(false);
  const [auditLogFilter, setAuditLogFilter] = useState("all");

  // ── Conflict Warnings State ─────────────────────────────────────────────────
  const [conflictWarnings, setConflictWarnings] = useState<ConflictWarning[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  // ── Time-based Permissions State ────────────────────────────────────────────
  const [timeBasedPermissions, setTimeBasedPermissions] = useState<TimeBasedPermission[]>([]);
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [tempPermission, setTempPermission] = useState<string>("");
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [isTimeSaving, setIsTimeSaving] = useState(false);

  // ── Fetch Sidebar Modules ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchSidebarModules = async () => {
      setIsLoadingModules(true);
      try {
        const res = await fetch("/api/SidebarModules");
        const data = await res.json();
        if (data.success) {
          setSidebarModules(data.modules);
        } else {
          toast.error("Failed to fetch sidebar modules");
        }
      } catch (err) {
        console.error("Error fetching sidebar modules:", err);
        toast.error("Failed to fetch sidebar modules");
      } finally {
        setIsLoadingModules(false);
      }
    };
    fetchSidebarModules();
  }, []);

  // ── Check Super Admin Access ────────────────────────────────────────────────
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) {
          router.push("/dashboard");
          return;
        }
        const data = await res.json();
        if (data.role !== "SuperAdmin") {
          toast.error("Access Denied: Super Admin only");
          router.push("/dashboard");
          return;
        }
        setCurrentUserRole(data.role);
      } catch (err) {
        router.push("/dashboard");
      } finally {
        setIsLoadingRole(false);
      }
    };
    checkAccess();
  }, [router]);

  // ── Fetch IT Users ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchUsers = async () => {
      setIsFetching(true);
      const toastId = toast.loading("Fetching IT users...");
      try {
        const res = await fetch("/api/ITPermissions/FetchUsers");
        const data = await res.json();
        if (data.success) {
          setUsers(data.users || []);
          toast.success("IT users loaded successfully!", { id: toastId });
        } else {
          throw new Error(data.message || "Failed to fetch users");
        }
      } catch (err) {
        toast.error("Failed to fetch IT users", { id: toastId });
        console.error(err);
      } finally {
        setIsFetching(false);
      }
    };
    fetchUsers();
  }, []);

  // ── Fetch Role Permissions ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchRolePermissions = async () => {
      try {
        const res = await fetch("/api/ITPermissions/FetchRolePermissions");
        const data = await res.json();
        if (data.success) {
          setRolePermissions(data.permissions || []);
        }
      } catch (err) {
        console.error("Failed to fetch role permissions:", err);
      }
    };
    fetchRolePermissions();
  }, []);

  // ── Filtered Users ──────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) =>
        [u.Firstname, u.Lastname, u.Email, u.Role, u.Position]
          .some((f) => f?.toLowerCase().includes(search.toLowerCase()))
      )
      .filter((u) =>
        filterRole === "all" ? true : u.Role === filterRole
      )
      .sort((a, b) => {
        const nameA = `${a.Firstname} ${a.Lastname}`.toLowerCase();
        const nameB = `${b.Firstname} ${b.Lastname}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [users, search, filterRole]);

  // ── Permission Management ──────────────────────────────────────────────────
  const openPermissionDialog = (user: UserAccount) => {
    setSelectedUser(user);
    // Initialize permissions from user's Directories or role defaults
    const existingPerms = user.Directories || [];
    setUserPermissions(existingPerms);
    setShowPermissionDialog(true);
  };

  const toggleModule = (moduleKey: string) => {
    setUserPermissions((prev) => {
      const hasModule = prev.includes(moduleKey);
      if (hasModule) {
        // Remove module and all its submodules
        const module = sidebarModules.find((m) => m.key === moduleKey);
        const submodules = module?.items.map((item) => `${moduleKey}:${item.title}`) || [];
        return prev.filter((p) => p !== moduleKey && !submodules.includes(p));
      } else {
        return [...prev, moduleKey];
      }
    });
  };

  const toggleSubmodule = (moduleKey: string, submoduleTitle: string) => {
    const key = `${moduleKey}:${submoduleTitle}`;
    setUserPermissions((prev) => {
      const hasSubmodule = prev.includes(key);
      if (hasSubmodule) {
        return prev.filter((p) => p !== key);
      } else {
        // Auto-enable parent module if not already enabled
        const newPerms = prev.includes(moduleKey) ? prev : [...prev, moduleKey];
        return [...newPerms, key];
      }
    });
  };

  const isModuleGranted = (moduleKey: string) => userPermissions.includes(moduleKey);
  const isSubmoduleGranted = (moduleKey: string, submoduleTitle: string) =>
    userPermissions.includes(`${moduleKey}:${submoduleTitle}`);

  const getModuleGrantCount = (moduleKey: string) => {
    const module = sidebarModules.find((m) => m.key === moduleKey);
    if (!module) return "0/0";
    const granted = module.items.filter((item) =>
      userPermissions.includes(`${moduleKey}:${item.title}`)
    ).length;
    return `${granted}/${module.items.length}`;
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    const toastId = toast.loading("Saving permissions...");
    try {
      const res = await fetch("/api/ITPermissions/UpdatePermissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser._id,
          permissions: userPermissions,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Update local state
        setUsers((prev) =>
          prev.map((u) =>
            u._id === selectedUser._id ? { ...u, Directories: userPermissions } : u
          )
        );
        toast.success("Permissions updated successfully!", { id: toastId });
        setShowPermissionDialog(false);
      } else {
        throw new Error(data.message || "Failed to update permissions");
      }
    } catch (err) {
      toast.error("Failed to save permissions", { id: toastId });
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpandModule = (moduleKey: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleKey)
        ? prev.filter((k) => k !== moduleKey)
        : [...prev, moduleKey]
    );
  };

  const grantAllModules = () => {
    const allPerms = sidebarModules.flatMap((m) => [
      m.key,
      ...m.items.map((item) => `${m.key}:${item.title}`),
    ]);
    setUserPermissions(allPerms);
  };

  const revokeAllModules = () => {
    setUserPermissions([]);
  };

  const applyRoleDefaults = () => {
    if (!selectedUser) return;
    const rolePerm = rolePermissions.find(
      (rp) => rp.role === selectedUser.Role && rp.department === "IT"
    );
    if (rolePerm) {
      setUserPermissions([...rolePerm.modules, ...rolePerm.submodules]);
      toast.info(`Applied default permissions for ${selectedUser.Role}`);
    } else {
      toast.warning(`No default permissions found for ${selectedUser.Role}`);
    }
  };

  // ── Bulk Actions Functions ───────────────────────────────────────────────
  const toggleSelectUser = (userId: string) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const selectAllUsers = () => {
    setSelectedUsers(new Set(filteredUsers.map(u => u._id)));
  };

  const deselectAllUsers = () => {
    setSelectedUsers(new Set());
  };

  const executeBulkAction = async () => {
    if (selectedUsers.size === 0) {
      toast.error("No users selected");
      return;
    }
    
    setIsBulkProcessing(true);
    const toastId = toast.loading(`Processing ${bulkActionType} for ${selectedUsers.size} users...`);
    
    try {
      const res = await fetch("/api/ITPermissions/BulkUpdate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
          action: bulkActionType,
          permissions: bulkActionType === "template" && selectedTemplateId 
            ? templates.find(t => t.id === selectedTemplateId)?.permissions 
            : undefined
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(`Bulk ${bulkActionType} completed for ${selectedUsers.size} users!`, { id: toastId });
        setShowBulkActionDialog(false);
        setSelectedUsers(new Set());
        // Refresh users
        const refreshRes = await fetch("/api/ITPermissions/FetchUsers");
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setUsers(refreshData.users || []);
        }
      } else {
        throw new Error(data.message || "Bulk update failed");
      }
    } catch (err: any) {
      toast.error("Bulk update failed: " + err.message, { id: toastId });
      console.error(err);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // ── Template Functions ─────────────────────────────────────────────────────
  const saveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!selectedUser) {
      toast.error("No user selected");
      return;
    }
    
    setIsTemplateSaving(true);
    const toastId = toast.loading("Saving template...");
    
    try {
      const res = await fetch("/api/ITPermissions/SaveTemplate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          permissions: userPermissions,
          role: selectedUser.Role,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success("Template saved successfully!", { id: toastId });
        setShowTemplateDialog(false);
        setTemplateName("");
        setTemplateDescription("");
        // Refresh templates
        const refreshRes = await fetch("/api/ITPermissions/FetchTemplates");
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setTemplates(refreshData.templates || []);
        }
      } else {
        throw new Error(data.message || "Failed to save template");
      }
    } catch (err: any) {
      toast.error("Failed to save template: " + err.message, { id: toastId });
    } finally {
      setIsTemplateSaving(false);
    }
  };

  const applyTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) {
      toast.error("Template not found");
      return;
    }
    
    setUserPermissions(template.permissions);
    toast.success(`Applied template: ${template.name}`);
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/ITPermissions/DeleteTemplate?id=${templateId}`, {
        method: "DELETE",
      });
      
      const data = await res.json();
      if (data.success) {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
        toast.success("Template deleted");
      } else {
        throw new Error(data.message || "Failed to delete template");
      }
    } catch (err: any) {
      toast.error("Failed to delete template: " + err.message);
    }
  };

  // ── Copy Permissions Functions ─────────────────────────────────────────────
  const openCopyDialog = (sourceUser: UserAccount) => {
    setSourceUserId(sourceUser._id);
    setTargetUserIds([]);
    setShowCopyDialog(true);
  };

  const executeCopyPermissions = async () => {
    if (!sourceUserId || targetUserIds.length === 0) {
      toast.error("Please select source and target users");
      return;
    }
    
    setIsCopying(true);
    const toastId = toast.loading("Copying permissions...");
    
    try {
      const sourceUser = users.find(u => u._id === sourceUserId);
      const res = await fetch("/api/ITPermissions/CopyPermissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUserId,
          targetUserIds,
          permissions: sourceUser?.Directories || [],
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(`Permissions copied to ${targetUserIds.length} users!`, { id: toastId });
        setShowCopyDialog(false);
        // Refresh users
        const refreshRes = await fetch("/api/ITPermissions/FetchUsers");
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setUsers(refreshData.users || []);
        }
      } else {
        throw new Error(data.message || "Copy failed");
      }
    } catch (err: any) {
      toast.error("Copy failed: " + err.message, { id: toastId });
    } finally {
      setIsCopying(false);
    }
  };

  // ── Preview Functions ────────────────────────────────────────────────────
  const previewUserPermissions = (user: UserAccount) => {
    setPreviewUser(user);
    const accessibleScreens: string[] = [];
    
    sidebarModules.forEach(module => {
      if ((user.Directories || []).includes(module.key)) {
        accessibleScreens.push(module.title);
      }
      module.items.forEach(item => {
        if ((user.Directories || []).includes(`${module.key}:${item.title}`)) {
          accessibleScreens.push(`${module.title} > ${item.title}`);
        }
      });
    });
    
    setPreviewAccessibleScreens(accessibleScreens);
    setShowPreviewDialog(true);
  };

  // ── Audit Log Functions ──────────────────────────────────────────────────
  const fetchAuditLog = async () => {
    setIsLoadingAuditLog(true);
    try {
      const res = await fetch("/api/ITPermissions/FetchAuditLog");
      const data = await res.json();
      if (data.success) {
        setAuditLog(data.logs || []);
      } else {
        toast.error("Failed to fetch audit log");
      }
    } catch (err) {
      console.error("Error fetching audit log:", err);
      toast.error("Failed to fetch audit log");
    } finally {
      setIsLoadingAuditLog(false);
    }
  };

  const exportAuditLog = () => {
    const csv = [
      ["Timestamp", "Action", "Performed By", "Target User", "Changes"].join(","),
      ...auditLog.map(log => [
        log.timestamp,
        log.action,
        log.performedBy,
        log.targetUserName,
        log.changes.map(c => `${c.module}: ${c.oldValue} → ${c.newValue}`).join("; ")
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit log exported");
  };

  // ── Conflict Detection Functions ─────────────────────────────────────────
  const checkConflicts = (permissions: string[]): ConflictWarning[] => {
    const warnings: ConflictWarning[] = [];
    
    // Check for high-risk combinations
    const hasAdmin = permissions.includes("admin");
    const hasSuperAdmin = permissions.includes("SuperAdmin");
    
    if (hasSuperAdmin && !permissions.includes("security:2fa-required")) {
      warnings.push({
        type: "risk",
        message: "SuperAdmin access without 2FA is high risk",
        modules: ["SuperAdmin", "security"],
        severity: "high"
      });
    }
    
    // Check for exclusive permissions
    if (permissions.includes("finance:readonly") && permissions.includes("finance:admin")) {
      warnings.push({
        type: "exclusive",
        message: "Finance read-only and admin permissions may conflict",
        modules: ["finance:readonly", "finance:admin"],
        severity: "medium"
      });
    }
    
    // Check for missing dependencies
    sidebarModules.forEach(module => {
      const hasModule = permissions.includes(module.key);
      const hasSubmodules = module.items.some(item => 
        permissions.includes(`${module.key}:${item.title}`)
      );
      
      if (hasSubmodules && !hasModule) {
        warnings.push({
          type: "dependency",
          message: `${module.title} submodules require parent module access`,
          modules: [module.key],
          severity: "low"
        });
      }
    });
    
    return warnings;
  };

  // ── Time-based Permission Functions ────────────────────────────────────────
  const addTimeBasedPermission = async () => {
    if (!selectedUser || !tempPermission || !tempStartDate || !tempEndDate) {
      toast.error("Please fill all fields");
      return;
    }
    
    setIsTimeSaving(true);
    const toastId = toast.loading("Adding time-based permission...");
    
    try {
      const res = await fetch("/api/ITPermissions/AddTimeBasedPermission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser._id,
          permission: tempPermission,
          startDate: tempStartDate,
          endDate: tempEndDate,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success("Time-based permission added!", { id: toastId });
        setShowTimeDialog(false);
        setTempPermission("");
        setTempStartDate("");
        setTempEndDate("");
        // Refresh
        const refreshRes = await fetch(`/api/ITPermissions/FetchTimeBasedPermissions?userId=${selectedUser._id}`);
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setTimeBasedPermissions(refreshData.permissions || []);
        }
      } else {
        throw new Error(data.message || "Failed to add");
      }
    } catch (err: any) {
      toast.error("Failed: " + err.message, { id: toastId });
    } finally {
      setIsTimeSaving(false);
    }
  };

  const removeTimeBasedPermission = async (permissionId: string) => {
    try {
      const res = await fetch(`/api/ITPermissions/RemoveTimeBasedPermission?id=${permissionId}`, {
        method: "DELETE",
      });
      
      const data = await res.json();
      if (data.success) {
        setTimeBasedPermissions(prev => prev.filter(p => p.id !== permissionId));
        toast.success("Permission removed");
      } else {
        throw new Error(data.message || "Failed to remove");
      }
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    }
  };

  return (
    <UserProvider>
      <FormatProvider>
        <ProtectedPageWrapper>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              {/* Dark Tech Background */}
              <div className="min-h-screen w-full bg-[#050a14] relative overflow-hidden">
                {/* Animated background grid */}
                <div className="absolute inset-0 h-full w-full">
                  <div 
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage: `
                        linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)
                      `,
                      backgroundSize: '50px 50px',
                    }}
                  />
                </div>

                {/* Main Content */}
                <div className="relative z-10 w-full">
                  {/* Header */}
                  <header className="flex h-16 items-center gap-2 px-4 border-b border-cyan-500/20 bg-slate-900/50 backdrop-blur-sm">
                    <SidebarTrigger className="-ml-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20" />
                    <Separator orientation="vertical" className="h-4 bg-cyan-500/30" />
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem>
                          <BreadcrumbLink href="/dashboard" className="text-cyan-400 hover:text-cyan-300">Dashboard</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="text-cyan-500/50" />
                        <BreadcrumbItem>
                          <BreadcrumbLink href="#" className="text-cyan-400 hover:text-cyan-300">Admin</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="text-cyan-500/50" />
                        <BreadcrumbItem>
                          <BreadcrumbPage className="text-cyan-100">IT Permissions</BreadcrumbPage>
                        </BreadcrumbItem>
                      </BreadcrumbList>
                    </Breadcrumb>
                  </header>

                  {/* Page Title */}
                  <div className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                        <ShieldCheck className="h-6 w-6 text-cyan-400" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-white tracking-wider">IT PERMISSIONS</h1>
                        <p className="text-sm text-cyan-300/60">Manage access permissions for IT users based on their roles</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardContent className="relative p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-cyan-300/60">Total IT Users</p>
                            <p className="text-2xl font-bold text-white">{users.length}</p>
                          </div>
                          <Users className="w-8 h-8 text-cyan-400" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardContent className="relative p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-cyan-300/60">Active Users</p>
                            <p className="text-2xl font-bold text-white">
                              {users.filter((u) => u.Status.toLowerCase() === "active").length}
                            </p>
                          </div>
                          <ShieldCheck className="w-8 h-8 text-emerald-400" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardContent className="relative p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-cyan-300/60">Modules</p>
                            <p className="text-2xl font-bold text-white">{isLoadingModules ? "..." : sidebarModules.length}</p>
                          </div>
                          <LayoutGrid className="w-8 h-8 text-purple-400" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-cyan-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardContent className="relative p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-cyan-300/60">IT Roles</p>
                            <p className="text-2xl font-bold text-white">{IT_ROLES.length}</p>
                          </div>
                          <UserCog className="w-8 h-8 text-orange-400" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Filters & Bulk Actions */}
                  <div className="px-4 pb-4 flex flex-wrap gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-300/40" />
                      <Input
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-slate-900/50 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-300/40"
                      />
                    </div>
                    <Select value={filterRole} onValueChange={setFilterRole}>
                      <SelectTrigger className="w-[180px] bg-slate-900/50 border-cyan-500/30 text-cyan-100">
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-cyan-500/30">
                        <SelectItem value="all" className="text-cyan-100">All Roles</SelectItem>
                        {IT_ROLES.map((role) => (
                          <SelectItem key={role} value={role} className="text-cyan-100">
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bulk Actions Bar */}
                  {selectedUsers.size > 0 && (
                    <div className="px-4 pb-4">
                      <div className="flex items-center gap-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                        <span className="text-cyan-300">
                          <CheckSquare className="w-5 h-5 inline mr-2" />
                          {selectedUsers.size} users selected
                        </span>
                        <div className="flex gap-2 ml-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowBulkActionDialog(true)}
                            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                          >
                            <Zap className="w-4 h-4 mr-2" />
                            Bulk Actions
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCopyDialog(users.find(u => u._id === Array.from(selectedUsers)[0])!)}
                            disabled={selectedUsers.size !== 1}
                            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy From
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={deselectAllUsers}
                            className="text-cyan-400 hover:text-cyan-300"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Clear
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Users Table */}
                  <div className="px-4 pb-8">
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardHeader className="relative">
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                          <Users className="w-5 h-5 text-cyan-400" />
                          IT Department Users
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="relative">
                        {isFetching ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                          </div>
                        ) : (
                          <div className="border border-cyan-500/20 rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-b border-cyan-500/20">
                                  <TableHead className="w-12">
                                    <Checkbox
                                      checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUsers.has(u._id))}
                                      onCheckedChange={() => {
                                        if (filteredUsers.every(u => selectedUsers.has(u._id))) {
                                          deselectAllUsers();
                                        } else {
                                          selectAllUsers();
                                        }
                                      }}
                                      className="border-cyan-500/50"
                                    />
                                  </TableHead>
                                  <TableHead className="text-cyan-300">User</TableHead>
                                  <TableHead className="text-cyan-300">Role</TableHead>
                                  <TableHead className="text-cyan-300">Position</TableHead>
                                  <TableHead className="text-cyan-300">Status</TableHead>
                                  <TableHead className="text-cyan-300">Access</TableHead>
                                  <TableHead className="text-right text-cyan-300">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredUsers.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-cyan-300/40">
                                      No IT users found
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  filteredUsers.map((user) => (
                                    <TableRow key={user._id} className="border-b border-cyan-500/10 hover:bg-cyan-500/5">
                                      <TableCell>
                                        <Checkbox
                                          checked={selectedUsers.has(user._id)}
                                          onCheckedChange={() => toggleSelectUser(user._id)}
                                          className="border-cyan-500/50"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <div>
                                          <p className="font-medium text-cyan-100">
                                            {user.Firstname} {user.Lastname}
                                          </p>
                                          <p className="text-sm text-cyan-300/60">{user.Email}</p>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge className={`${getBadgeColor(user.Role)} border`}>
                                          {user.Role}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-cyan-300">{user.Position}</TableCell>
                                      <TableCell>
                                        <Badge className={`${getStatusColor(user.Status)} border`}>
                                          {user.Status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <Shield className="w-4 h-4 text-cyan-400" />
                                          <span className="text-sm text-cyan-300">
                                            {(user.Directories || []).length} modules
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex gap-2 justify-end">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => previewUserPermissions(user)}
                                            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
                                          >
                                            <Eye className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openPermissionDialog(user)}
                                            className="gap-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                                          >
                                            <Shield className="w-4 h-4" />
                                            Manage
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Permission Dialog */}
                  <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                          <Shield className="w-5 h-5 text-cyan-400" />
                          Manage Permissions
                        </DialogTitle>
                        <DialogDescription className="text-cyan-300/60">
                          {selectedUser && (
                            <>
                              Grant or revoke access for{" "}
                              <span className="font-semibold text-cyan-200">
                                {selectedUser.Firstname} {selectedUser.Lastname}
                              </span>
                            </>
                          )}
                        </DialogDescription>
                        {selectedUser && (
                          <div className="mt-2">
                            <Badge className={`${getBadgeColor(selectedUser.Role)} border`}>
                              {selectedUser.Role}
                            </Badge>
                          </div>
                        )}
                      </DialogHeader>

                      <div className="py-4">
                        {/* Quick Actions */}
                        <div className="flex flex-wrap gap-2 mb-6">
                          <Button variant="outline" size="sm" onClick={grantAllModules} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20">
                            <Unlock className="w-4 h-4 mr-2" />
                            Grant All
                          </Button>
                          <Button variant="outline" size="sm" onClick={revokeAllModules} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20">
                            <Lock className="w-4 h-4 mr-2" />
                            Revoke All
                          </Button>
                          <Button variant="outline" size="sm" onClick={applyRoleDefaults} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20">
                            <UserCog className="w-4 h-4 mr-2" />
                            Apply Role Defaults
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20">
                            <Layers className="w-4 h-4 mr-2" />
                            Save as Template
                          </Button>
                          {templates.length > 0 && (
                            <Select value={selectedTemplateId || ""} onValueChange={(id) => { setSelectedTemplateId(id); applyTemplate(id); }}>
                              <SelectTrigger className="w-[180px] bg-slate-900/50 border-cyan-500/30 text-cyan-100">
                                <SelectValue placeholder="Apply Template..." />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-cyan-500/30">
                                {templates.map((t) => (
                                  <SelectItem key={t.id} value={t.id} className="text-cyan-100">
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {/* Modules List */}
                        <div className="space-y-2">
                          {sidebarModules.map((module) => {
                            const isExpanded = expandedModules.includes(module.key);
                            const isGranted = isModuleGranted(module.key);
                            const grantCount = getModuleGrantCount(module.key);

                            return (
                              <Collapsible
                                key={module.key}
                                open={isExpanded}
                                onOpenChange={() => toggleExpandModule(module.key)}
                              >
                                <div className="border border-cyan-500/20 rounded-lg overflow-hidden">
                                  <div
                                    className={`flex items-center gap-3 p-3 ${
                                      isGranted ? "bg-cyan-500/10" : "bg-slate-800/50"
                                    }`}
                                  >
                                    <Checkbox
                                      checked={isGranted}
                                      onCheckedChange={() => toggleModule(module.key)}
                                      id={`module-${module.key}`}
                                      className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                                    />
                                    <label
                                      htmlFor={`module-${module.key}`}
                                      className="flex-1 font-medium cursor-pointer text-cyan-100"
                                    >
                                      {module.title}
                                    </label>
                                    <span className="text-xs text-cyan-300/60">
                                      {grantCount} granted
                                    </span>
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20">
                                        {isExpanded ? (
                                          <ChevronDown className="w-4 h-4" />
                                        ) : (
                                          <ChevronRight className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </CollapsibleTrigger>
                                  </div>
                                  <CollapsibleContent>
                                    <div className="p-3 bg-slate-900/50 space-y-2">
                                      <p className="text-xs text-cyan-300/60 mb-2">
                                        {module.description}
                                      </p>
                                      {module.items.map((item) => (
                                        <div
                                          key={item.title}
                                          className="flex items-center gap-2 pl-6"
                                        >
                                          <Checkbox
                                            checked={isSubmoduleGranted(module.key, item.title)}
                                            onCheckedChange={() =>
                                              toggleSubmodule(module.key, item.title)
                                            }
                                            id={`submodule-${module.key}-${item.title}`}
                                            className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                                          />
                                          <label
                                            htmlFor={`submodule-${module.key}-${item.title}`}
                                            className="text-sm cursor-pointer text-cyan-300"
                                          >
                                            {item.title}
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>
                            );
                          })}
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowPermissionDialog(false)}
                          className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button 
                          onClick={savePermissions} 
                          disabled={isSaving}
                          className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
                        >
                          {isSaving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Save Permissions
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Save Template Dialog */}
                  <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                    <DialogContent className="bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                      <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                          <Layers className="w-5 h-5 text-cyan-400" />
                          Save as Template
                        </DialogTitle>
                        <DialogDescription className="text-cyan-300/60">
                          Save current permission set as a reusable template
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                        <div>
                          <label className="text-sm text-cyan-300/60 mb-2 block">Template Name</label>
                          <Input
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="e.g., Standard Developer Access"
                            className="bg-slate-900/50 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-300/40"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-cyan-300/60 mb-2 block">Description (optional)</label>
                          <Input
                            value={templateDescription}
                            onChange={(e) => setTemplateDescription(e.target.value)}
                            placeholder="e.g., Full access to development modules"
                            className="bg-slate-900/50 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-300/40"
                          />
                        </div>
                        <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                          <p className="text-sm text-cyan-300">
                            <span className="font-semibold">{userPermissions.length}</span> permissions will be saved
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTemplateDialog(false)} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20">
                          Cancel
                        </Button>
                        <Button 
                          onClick={saveAsTemplate} 
                          disabled={isTemplateSaving || !templateName.trim()}
                          className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white"
                        >
                          {isTemplateSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                          Save Template
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Bulk Actions Dialog */}
                  <Dialog open={showBulkActionDialog} onOpenChange={setShowBulkActionDialog}>
                    <DialogContent className="bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                      <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                          <Zap className="w-5 h-5 text-cyan-400" />
                          Bulk Actions
                        </DialogTitle>
                        <DialogDescription className="text-cyan-300/60">
                          Apply permissions to {selectedUsers.size} selected users
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                        <Select value={bulkActionType} onValueChange={(v) => setBulkActionType(v as any)}>
                          <SelectTrigger className="bg-slate-900/50 border-cyan-500/30 text-cyan-100">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-cyan-500/30">
                            <SelectItem value="grant" className="text-cyan-100">Grant All Modules</SelectItem>
                            <SelectItem value="revoke" className="text-cyan-100">Revoke All Modules</SelectItem>
                            <SelectItem value="template" className="text-cyan-100">Apply Template</SelectItem>
                          </SelectContent>
                        </Select>
                        {bulkActionType === "template" && (
                          <Select value={selectedTemplateId || ""} onValueChange={setSelectedTemplateId}>
                            <SelectTrigger className="bg-slate-900/50 border-cyan-500/30 text-cyan-100">
                              <SelectValue placeholder="Select template" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-cyan-500/30">
                              {templates.map((t) => (
                                <SelectItem key={t.id} value={t.id} className="text-cyan-100">
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowBulkActionDialog(false)} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20">
                          Cancel
                        </Button>
                        <Button onClick={executeBulkAction} disabled={isBulkProcessing || (bulkActionType === "template" && !selectedTemplateId)} className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
                          {isBulkProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                          Execute
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Copy Permissions Dialog */}
                  <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
                    <DialogContent className="bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                      <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                          <Copy className="w-5 h-5 text-cyan-400" />
                          Copy Permissions
                        </DialogTitle>
                        <DialogDescription className="text-cyan-300/60">
                          Copy permissions from {users.find(u => u._id === sourceUserId)?.Firstname} {users.find(u => u._id === sourceUserId)?.Lastname}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <p className="text-sm text-cyan-300/60 mb-2">Select target users:</p>
                        <div className="max-h-[200px] overflow-auto space-y-2 border border-cyan-500/20 rounded-lg p-2">
                          {users.filter(u => u._id !== sourceUserId).map((user) => (
                            <div key={user._id} className="flex items-center gap-2 p-2 hover:bg-cyan-500/10 rounded">
                              <Checkbox
                                checked={targetUserIds.includes(user._id)}
                                onCheckedChange={() => {
                                  setTargetUserIds(prev => 
                                    prev.includes(user._id) 
                                      ? prev.filter(id => id !== user._id)
                                      : [...prev, user._id]
                                  );
                                }}
                                className="border-cyan-500/50"
                              />
                              <span className="text-cyan-100">{user.Firstname} {user.Lastname}</span>
                              <Badge className={`${getBadgeColor(user.Role)} border ml-auto`}>{user.Role}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCopyDialog(false)} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20">
                          Cancel
                        </Button>
                        <Button onClick={executeCopyPermissions} disabled={isCopying || targetUserIds.length === 0} className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
                          {isCopying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                          Copy to {targetUserIds.length} Users
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Preview Dialog */}
                  <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
                    <DialogContent className="bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                          <Eye className="w-5 h-5 text-cyan-400" />
                          Permission Preview
                        </DialogTitle>
                        <DialogDescription className="text-cyan-300/60">
                          {previewUser?.Firstname} {previewUser?.Lastname} can access:
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        {previewAccessibleScreens.length === 0 ? (
                          <p className="text-cyan-300/40 text-center py-4">No permissions granted</p>
                        ) : (
                          <div className="space-y-2 max-h-[300px] overflow-auto">
                            {previewAccessibleScreens.map((screen, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span className="text-cyan-100">{screen}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button onClick={() => setShowPreviewDialog(false)} className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Audit Log Button & Dialog Trigger */}
                  <div className="fixed bottom-6 right-6">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => { setShowAuditLogDialog(true); fetchAuditLog(); }}
                      className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                    >
                      <History className="w-5 h-5 mr-2" />
                      Audit Log
                    </Button>
                  </div>

                  {/* Audit Log Dialog */}
                  <Dialog open={showAuditLogDialog} onOpenChange={setShowAuditLogDialog}>
                    <DialogContent className="bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] max-w-3xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                          <History className="w-5 h-5 text-cyan-400" />
                          Audit Log
                        </DialogTitle>
                        <DialogDescription className="text-cyan-300/60">
                          Track all permission changes
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <div className="flex justify-between items-center mb-4">
                          <Select value={auditLogFilter} onValueChange={setAuditLogFilter}>
                            <SelectTrigger className="w-[150px] bg-slate-900/50 border-cyan-500/30 text-cyan-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-cyan-500/30">
                              <SelectItem value="all" className="text-cyan-100">All Actions</SelectItem>
                              <SelectItem value="grant" className="text-cyan-100">Grants</SelectItem>
                              <SelectItem value="revoke" className="text-cyan-100">Revokes</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={exportAuditLog} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20">
                            <Download className="w-4 h-4 mr-2" />
                            Export CSV
                          </Button>
                        </div>
                        {isLoadingAuditLog ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                          </div>
                        ) : auditLog.length === 0 ? (
                          <p className="text-cyan-300/40 text-center py-8">No audit log entries</p>
                        ) : (
                          <div className="space-y-2 max-h-[400px] overflow-auto">
                            {auditLog.map((entry) => (
                              <div key={entry.id} className="p-3 bg-slate-900/50 rounded-lg border border-cyan-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className={
                                    entry.action === "grant" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" :
                                    entry.action === "revoke" ? "bg-red-500/20 text-red-300 border-red-500/50" :
                                    "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                                  }>
                                    {entry.action}
                                  </Badge>
                                  <span className="text-xs text-cyan-300/60">{entry.timestamp}</span>
                                </div>
                                <p className="text-sm text-cyan-100">
                                  <span className="text-cyan-400">{entry.performedBy}</span> {entry.action}d permissions for <span className="text-cyan-400">{entry.targetUserName}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </ProtectedPageWrapper>
      </FormatProvider>
    </UserProvider>
  );
}
