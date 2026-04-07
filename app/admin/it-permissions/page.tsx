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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const IT_ROLES = ["IT Staff", "IT Admin", "IT Manager", "IT Support", "Developer"];

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getBadgeColor(role: string): string {
  const map: Record<string, string> = {
    "IT Staff": "bg-blue-100 text-blue-800",
    "IT Admin": "bg-purple-100 text-purple-800",
    "IT Manager": "bg-green-100 text-green-800",
    "IT Support": "bg-yellow-100 text-yellow-800",
    Developer: "bg-black text-yellow-400",
    Admin: "bg-red-100 text-red-800",
    SuperAdmin: "bg-red-600 text-white",
  };
  return map[role] || "bg-gray-100 text-gray-800";
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: "bg-green-500 text-white",
    terminated: "bg-red-600 text-white",
    resigned: "bg-red-600 text-white",
    inactive: "bg-gray-500 text-white",
    locked: "bg-orange-500 text-white",
  };
  return map[status.toLowerCase()] || "bg-gray-500 text-white";
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
                      <BreadcrumbPage>IT Permissions</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </header>

              {/* Page Title */}
              <div className="px-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <ShieldCheck className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                      IT Department Permissions
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Manage access permissions for IT users based on their roles
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total IT Users</p>
                        <p className="text-2xl font-bold">{users.length}</p>
                      </div>
                      <Users className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Users</p>
                        <p className="text-2xl font-bold">
                          {users.filter((u) => u.Status.toLowerCase() === "active").length}
                        </p>
                      </div>
                      <ShieldCheck className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Modules</p>
                        <p className="text-2xl font-bold">{isLoadingModules ? "..." : sidebarModules.length}</p>
                      </div>
                      <LayoutGrid className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">IT Roles</p>
                        <p className="text-2xl font-bold">{IT_ROLES.length}</p>
                      </div>
                      <UserCog className="w-8 h-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <div className="px-4 pb-4 flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {IT_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Users Table */}
              <div className="px-4 pb-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      IT Department Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isFetching ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Position</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Access</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredUsers.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                  No IT users found
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredUsers.map((user) => (
                                <TableRow key={user._id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">
                                        {user.Firstname} {user.Lastname}
                                      </p>
                                      <p className="text-sm text-muted-foreground">{user.Email}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={getBadgeColor(user.Role)}>
                                      {user.Role}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{user.Position}</TableCell>
                                  <TableCell>
                                    <Badge className={getStatusColor(user.Status)}>
                                      {user.Status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Shield className="w-4 h-4 text-primary" />
                                      <span className="text-sm">
                                        {(user.Directories || []).length} modules
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openPermissionDialog(user)}
                                      className="gap-2"
                                    >
                                      <Shield className="w-4 h-4" />
                                      Manage Access
                                    </Button>
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
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Manage Permissions
                    </DialogTitle>
                    <DialogDescription>
                      {selectedUser && (
                        <>
                          Grant or revoke access for{" "}
                          <span className="font-semibold">
                            {selectedUser.Firstname} {selectedUser.Lastname}
                          </span>
                        </>
                      )}
                    </DialogDescription>
                    {selectedUser && (
                      <div className="mt-2">
                        <Badge variant="secondary">
                          {selectedUser.Role}
                        </Badge>
                      </div>
                    )}
                  </DialogHeader>

                  <div className="py-4">
                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      <Button variant="outline" size="sm" onClick={grantAllModules}>
                        <Unlock className="w-4 h-4 mr-2" />
                        Grant All
                      </Button>
                      <Button variant="outline" size="sm" onClick={revokeAllModules}>
                        <Lock className="w-4 h-4 mr-2" />
                        Revoke All
                      </Button>
                      <Button variant="outline" size="sm" onClick={applyRoleDefaults}>
                        <UserCog className="w-4 h-4 mr-2" />
                        Apply Role Defaults
                      </Button>
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
                            <div className="border rounded-lg overflow-hidden">
                              <div
                                className={`flex items-center gap-3 p-3 ${
                                  isGranted ? "bg-primary/5" : "bg-muted/50"
                                }`}
                              >
                                <Checkbox
                                  checked={isGranted}
                                  onCheckedChange={() => toggleModule(module.key)}
                                  id={`module-${module.key}`}
                                />
                                <label
                                  htmlFor={`module-${module.key}`}
                                  className="flex-1 font-medium cursor-pointer"
                                >
                                  {module.title}
                                </label>
                                <span className="text-xs text-muted-foreground">
                                  {grantCount} granted
                                </span>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                              </div>
                              <CollapsibleContent>
                                <div className="p-3 bg-muted/30 space-y-2">
                                  <p className="text-xs text-muted-foreground mb-2">
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
                                      />
                                      <label
                                        htmlFor={`submodule-${module.key}-${item.title}`}
                                        className="text-sm cursor-pointer"
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
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={savePermissions} disabled={isSaving}>
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
            </SidebarInset>
          </SidebarProvider>
        </ProtectedPageWrapper>
      </FormatProvider>
    </UserProvider>
  );
}
