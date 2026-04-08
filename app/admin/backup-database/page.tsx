"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  Database, 
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  Loader2,
  HardDrive,
  FileSpreadsheet,
  Save,
  Play,
  Bell,
  RotateCcw,
  Shield,
  AlertCircle,
  Server,
  Cloud,
  Zap,
  Trash2,
  Eye,
  X,
  Mail,
  Upload,
  CheckCircle,
  CalendarDays
} from "lucide-react";
import { format } from "date-fns";

interface BackupSettings {
  enabled: boolean;
  frequency: "weekly" | "monthly" | "yearly";
  dayOfWeek: number;
  dayOfMonth: number;
  monthOfYear: number;
  time: string;
  dateRangeFrom: string;
  dateRangeTo: string;
  includeTables: string[];
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  emailNotifications: boolean;
  notificationEmail: string;
  retentionCount: number;
  storageLocation: "local" | "cloud" | "both";
  cloudProvider: "aws" | "gcp" | "azure" | "supabase";
}

interface BackupHistory {
  id: string;
  timestamp: string;
  status: "success" | "failed" | "in_progress";
  size: string;
  frequency: string;
  recordsCount: number;
  downloadUrl?: string;
  tables?: string[];
}

const AVAILABLE_TABLES = [
  { id: "activity", name: "Activity Logs", db: "supabase", label: "Activity Logs" },
  { id: "documentation", name: "Documentation", db: "supabase", label: "Documentation" },
  { id: "history", name: "History", db: "supabase", label: "History" },
  { id: "revised_quotations", name: "Revised Quotations", db: "supabase", label: "Revised Quotations" },
  { id: "meetings", name: "Meetings", db: "supabase" },
  { id: "signatories", name: "Signatories", db: "supabase" },
  { id: "spf_request", name: "SPF Requests", db: "supabase" },
  { id: "users", name: "Users (MongoDB)", db: "mongodb" },
  { id: "system_audits", name: "System Audits", db: "mongodb" },
  { id: "customer_database", name: "Customer Database", db: "mongodb" },
];

export default function BackupDatabaseSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [settings, setSettings] = useState<BackupSettings>({
    enabled: true,
    frequency: "weekly",
    dayOfWeek: 0,
    dayOfMonth: 1,
    monthOfYear: 1,
    time: "02:00",
    dateRangeFrom: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    dateRangeTo: format(new Date(), "yyyy-MM-dd"),
    includeTables: ["activity", "history", "users", "customer_database"],
    notifyOnSuccess: true,
    notifyOnFailure: true,
    emailNotifications: false,
    notificationEmail: "",
    retentionCount: 10,
    storageLocation: "local" as const,
    cloudProvider: "supabase" as const,
  });
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);
  const [nextBackupTime, setNextBackupTime] = useState<string>("");
  
  // Preview dialog state
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  // Progress tracking for backup
  const [backupProgress, setBackupProgress] = useState<{ current: number; total: number; table: string } | null>(null);
  
  // Restore dialog state
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [restoreOptions, setRestoreOptions] = useState({
    restoreTables: [] as string[],
    overwrite: false,
    notifyOnRestore: true,
  });
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [restoreResults, setRestoreResults] = useState<any>(null);
  
  // Calendar view state
  const [calendarViewOpen, setCalendarViewOpen] = useState(false);
  const [scheduledBackups, setScheduledBackups] = useState<any[]>([]);
  
  // Verification state
  const [verifyingBackup, setVerifyingBackup] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  useEffect(() => {
    fetchSettings();
    fetchBackupHistory();
  }, []);

  useEffect(() => {
    calculateNextBackup();
  }, [settings]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/Data/Applications/Admin/BackupSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_settings" }),
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  const fetchBackupHistory = async () => {
    try {
      const res = await fetch("/api/Data/Applications/Admin/BackupSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_history" }),
      });
      const data = await res.json();
      if (data.success) {
        setBackupHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch backup history:", err);
    }
  };

  const calculateNextBackup = () => {
    if (!settings.enabled) {
      setNextBackupTime("Disabled");
      return;
    }

    const now = new Date();
    const [hours, minutes] = settings.time.split(":").map(Number);
    let nextDate = new Date(now);
    nextDate.setHours(hours, minutes, 0, 0);

    if (settings.frequency === "weekly") {
      const daysUntilTarget = (settings.dayOfWeek - now.getDay() + 7) % 7;
      nextDate.setDate(now.getDate() + daysUntilTarget);
      if (nextDate <= now) {
        nextDate.setDate(nextDate.getDate() + 7);
      }
    } else if (settings.frequency === "monthly") {
      nextDate.setDate(settings.dayOfMonth);
      if (nextDate <= now) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
    } else if (settings.frequency === "yearly") {
      nextDate.setMonth(settings.monthOfYear - 1);
      nextDate.setDate(settings.dayOfMonth);
      if (nextDate <= now) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
    }

    setNextBackupTime(format(nextDate, "MMM dd, yyyy 'at' h:mm a"));
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/Data/Applications/Admin/BackupSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_settings", settings }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Backup settings saved successfully");
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleRunBackupNow = async () => {
    setRunningBackup(true);
    try {
      const res = await fetch("/api/Data/Applications/Admin/BackupSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_backup", settings }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Backup completed! Exported ${data.recordsCount} records.`);
        fetchBackupHistory();
      } else {
        toast.error(data.error || "Backup failed");
      }
    } catch (err) {
      toast.error("Backup failed");
    } finally {
      setRunningBackup(false);
    }
  };

  const handleDownloadBackup = async (backupId: string) => {
    try {
      const res = await fetch("/api/Data/Applications/Admin/BackupSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", backupId }),
      });
      const data = await res.json();
      if (data.success && data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      } else {
        toast.error("Failed to get download URL");
      }
    } catch (err) {
      toast.error("Failed to download backup");
    }
  };

  const handleDownloadZip = async (backupId: string) => {
    try {
      toast.info("Preparing ZIP file with separate Excel files for each table...");
      const res = await fetch("/api/Data/Applications/Admin/BackupSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download_zip", backupId }),
      });
      const data = await res.json();
      if (data.success && data.downloadUrl) {
        // Create temporary link to download ZIP
        const link = document.createElement("a");
        link.href = data.downloadUrl;
        link.download = `backup_${backupId}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("ZIP file downloaded successfully! Each table is in a separate Excel file.");
      } else {
        toast.error(data.error || "Failed to generate ZIP file");
      }
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download ZIP file");
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    try {
      const res = await fetch("/api/Data/Applications/Admin/BackupSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_backup", backupId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Backup deleted successfully");
        fetchBackupHistory();
      } else {
        toast.error(data.error || "Failed to delete backup");
      }
    } catch (err) {
      toast.error("Failed to delete backup");
    }
  };

  const handlePreviewBackup = async (backupId: string) => {
    setLoadingPreview(true);
    setPreviewDialogOpen(true);
    try {
      const res = await fetch("/api/Data/Applications/Admin/BackupSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_preview", backupId }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData(data.preview);
      } else {
        toast.error(data.error || "Failed to load preview");
        setPreviewDialogOpen(false);
      }
    } catch (err) {
      toast.error("Failed to load preview");
      setPreviewDialogOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleOpenRestore = (backupId: string, tables: string[]) => {
    setSelectedBackupId(backupId);
    setRestoreOptions((prev) => ({ ...prev, restoreTables: tables }));
    setRestoreDialogOpen(true);
    setRestoreResults(null);
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackupId) return;
    setRestoringBackup(true);
    try {
      const res = await fetch("/api/Data/Applications/Admin/BackupSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore_backup",
          backupId: selectedBackupId,
          options: restoreOptions,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Backup restored successfully!");
        setRestoreResults(data.results);
      } else {
        toast.error(data.error || "Failed to restore backup");
      }
    } catch (err) {
      toast.error("Failed to restore backup");
    } finally {
      setRestoringBackup(false);
    }
  };

  const handleVerifyBackup = async (backupId: string) => {
    setVerifyingBackup(true);
    try {
      const res = await fetch("/api/Data/Applications/Admin/BackupSettings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_backup", backupId }),
      });
      const data = await res.json();
      setVerificationResult(data);
      if (data.success && data.verified) {
        toast.success("Backup verified successfully!");
      } else if (data.success && !data.verified) {
        toast.error("Backup verification failed - data may be corrupted!");
      } else {
        toast.error(data.error || "Failed to verify backup");
      }
    } catch (err) {
      toast.error("Failed to verify backup");
    } finally {
      setVerifyingBackup(false);
    }
  };

  const toggleTable = (tableId: string) => {
    setSettings((prev) => ({
      ...prev,
      includeTables: prev.includeTables.includes(tableId)
        ? prev.includeTables.filter((id) => id !== tableId)
        : [...prev.includeTables, tableId],
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-emerald-500";
      case "failed":
        return "bg-red-500";
      case "in_progress":
        return "bg-amber-500";
      default:
        return "bg-slate-500";
    }
  };

  return (
    <ProtectedPageWrapper>
      <TooltipProvider delayDuration={0}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            {/* Dark Tech Background */}
            <div className="min-h-screen w-full bg-[#050a14] relative overflow-hidden">
              {/* Animated background grid */}
              <div className="absolute inset-0 h-full w-full">
                <div 
                  className="h-full w-full opacity-10"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(6, 182, 212, 0.15) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(6, 182, 212, 0.15) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px',
                    backgroundRepeat: 'repeat'
                  }}
                />
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
              </div>

              {/* Floating particles */}
              <div className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none">
                {[...Array(15)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 bg-cyan-400/40 rounded-full"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animation: `float ${5 + Math.random() * 10}s linear infinite`,
                      animationDelay: `${Math.random() * 5}s` 
                    }}
                  />
                ))}
              </div>

              {/* Main Content */}
              <div className="relative z-10 w-full">
                {/* Header */}
                <header className="flex h-14 shrink-0 items-center gap-2 px-4 bg-slate-950/80 backdrop-blur-sm border-b border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <SidebarTrigger className="-ml-1 text-cyan-400 hover:text-cyan-300" />
                    <Separator orientation="vertical" className="h-4 bg-cyan-500/30" />
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem>
                          <BreadcrumbLink href="/dashboard" className="text-slate-400 hover:text-cyan-400">Dashboard</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="text-cyan-500/50" />
                        <BreadcrumbItem>
                          <BreadcrumbLink href="/settings/general" className="text-slate-400 hover:text-cyan-400">Settings</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="text-cyan-500/50" />
                        <BreadcrumbItem>
                          <BreadcrumbPage className="text-cyan-400 font-medium uppercase tracking-wider text-sm">
                            Database Backup
                          </BreadcrumbPage>
                        </BreadcrumbItem>
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>
                  
                  <div className="flex items-center gap-4 ml-auto text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-cyan-300/80 font-mono">SYSTEM ONLINE</span>
                    </div>
                    <span className="text-cyan-500/50">|</span>
                    <span className="text-cyan-300/80 font-mono">V.2.0.6</span>
                  </div>
                </header>

                <main className="px-4 py-6 w-full">
                  <div className="mx-auto w-full space-y-6">
                    {/* Page Title */}
                    <div className="mb-8">
                      <h1 className="text-3xl font-bold tracking-wider text-white uppercase">
                        <span className="text-cyan-400">DATABASE</span> BACKUP
                      </h1>
                      <p className="text-white/60 text-xs tracking-[0.3em] uppercase mt-1">
                        Automated Data Protection System
                      </p>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Frequency Card */}
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                        <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
                          <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-cyan-500/50" />
                          <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-cyan-500/50" />
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-cyan-500/50" />
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-cyan-500/50" />
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <Clock className="h-8 w-8 text-cyan-400" />
                              <div>
                                <p className="text-xs text-cyan-300/60 uppercase tracking-wider">Backup Frequency</p>
                                <p className="text-lg font-bold text-cyan-100 capitalize">{settings.frequency}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Next Backup Card */}
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                        <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
                          <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-cyan-500/50" />
                          <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-cyan-500/50" />
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-cyan-500/50" />
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-cyan-500/50" />
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <Calendar className="h-8 w-8 text-emerald-400" />
                              <div>
                                <p className="text-xs text-cyan-300/60 uppercase tracking-wider">Next Backup</p>
                                <p className="text-sm font-bold text-cyan-100">{nextBackupTime || "Calculating..."}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Tables Card */}
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                        <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
                          <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-cyan-500/50" />
                          <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-cyan-500/50" />
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-cyan-500/50" />
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-cyan-500/50" />
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <HardDrive className="h-8 w-8 text-purple-400" />
                              <div>
                                <p className="text-xs text-cyan-300/60 uppercase tracking-wider">Tables Selected</p>
                                <p className="text-2xl font-bold text-cyan-100">{settings.includeTables.length}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Retention Card */}
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                        <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
                          <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-cyan-500/50" />
                          <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-cyan-500/50" />
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-cyan-500/50" />
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-cyan-500/50" />
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <RotateCcw className="h-8 w-8 text-amber-400" />
                              <div>
                                <p className="text-xs text-cyan-300/60 uppercase tracking-wider">Backups Kept</p>
                                <p className="text-2xl font-bold text-cyan-100">{settings.retentionCount}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Settings Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Backup Schedule Card */}
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                        <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
                          <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
                          <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
                          <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
                          <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
                          
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400 tracking-wider uppercase">
                              <Clock className="h-5 w-5" />
                              Backup Schedule
                            </CardTitle>
                            <CardDescription className="text-cyan-300/60">
                              Configure when automated backups should run.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Enable/Disable */}
                            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                              <div className="space-y-0.5">
                                <Label className="text-cyan-100">Enable Automated Backups</Label>
                                <p className="text-xs text-cyan-300/60">
                                  Turn on/off automated backup schedule
                                </p>
                              </div>
                              <Switch
                                checked={settings.enabled}
                                onCheckedChange={(checked) =>
                                  setSettings((s) => ({ ...s, enabled: checked }))
                                }
                              />
                            </div>

                            {/* Frequency */}
                            <div className="space-y-2">
                              <Label className="text-cyan-100">Backup Frequency</Label>
                              <Select
                                value={settings.frequency}
                                onValueChange={(value: "weekly" | "monthly" | "yearly") =>
                                  setSettings((s) => ({ ...s, frequency: value }))
                                }
                                disabled={!settings.enabled}
                              >
                                <SelectTrigger className="bg-slate-900 border-cyan-500/30 text-cyan-100">
                                  <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-cyan-500/30">
                                  <SelectItem value="weekly" className="text-cyan-100 focus:bg-cyan-500/20">Weekly</SelectItem>
                                  <SelectItem value="monthly" className="text-cyan-100 focus:bg-cyan-500/20">Monthly</SelectItem>
                                  <SelectItem value="yearly" className="text-cyan-100 focus:bg-cyan-500/20">Yearly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Day Selection based on frequency */}
                            {settings.frequency === "weekly" && (
                              <div className="space-y-2">
                                <Label className="text-cyan-100">Day of Week</Label>
                                <Select
                                  value={settings.dayOfWeek.toString()}
                                  onValueChange={(value) =>
                                    setSettings((s) => ({ ...s, dayOfWeek: parseInt(value) }))
                                  }
                                  disabled={!settings.enabled}
                                >
                                  <SelectTrigger className="bg-slate-900 border-cyan-500/30 text-cyan-100">
                                    <SelectValue placeholder="Select day" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-900 border-cyan-500/30">
                                    {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                                      (day, index) => (
                                        <SelectItem key={index} value={index.toString()} className="text-cyan-100 focus:bg-cyan-500/20">
                                          {day}
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {settings.frequency === "monthly" && (
                              <div className="space-y-2">
                                <Label className="text-cyan-100">Day of Month</Label>
                                <Select
                                  value={settings.dayOfMonth.toString()}
                                  onValueChange={(value) =>
                                    setSettings((s) => ({ ...s, dayOfMonth: parseInt(value) }))
                                  }
                                  disabled={!settings.enabled}
                                >
                                  <SelectTrigger className="bg-slate-900 border-cyan-500/30 text-cyan-100">
                                    <SelectValue placeholder="Select day" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-900 border-cyan-500/30">
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                      <SelectItem key={day} value={day.toString()} className="text-cyan-100 focus:bg-cyan-500/20">
                                        {day}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {settings.frequency === "yearly" && (
                              <>
                                <div className="space-y-2">
                                  <Label className="text-cyan-100">Month</Label>
                                  <Select
                                    value={settings.monthOfYear.toString()}
                                    onValueChange={(value) =>
                                      setSettings((s) => ({ ...s, monthOfYear: parseInt(value) }))
                                    }
                                    disabled={!settings.enabled}
                                  >
                                    <SelectTrigger className="bg-slate-900 border-cyan-500/30 text-cyan-100">
                                      <SelectValue placeholder="Select month" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-cyan-500/30">
                                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(
                                        (month, index) => (
                                          <SelectItem key={index + 1} value={(index + 1).toString()} className="text-cyan-100 focus:bg-cyan-500/20">
                                            {month}
                                          </SelectItem>
                                        )
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-cyan-100">Day of Month</Label>
                                  <Select
                                    value={settings.dayOfMonth.toString()}
                                    onValueChange={(value) =>
                                      setSettings((s) => ({ ...s, dayOfMonth: parseInt(value) }))
                                    }
                                    disabled={!settings.enabled}
                                  >
                                    <SelectTrigger className="bg-slate-900 border-cyan-500/30 text-cyan-100">
                                      <SelectValue placeholder="Select day" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-cyan-500/30">
                                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                        <SelectItem key={day} value={day.toString()} className="text-cyan-100 focus:bg-cyan-500/20">
                                          {day}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </>
                            )}

                            {/* Time */}
                            <div className="space-y-2">
                              <Label className="text-cyan-100">Backup Time</Label>
                              <Input
                                type="time"
                                value={settings.time}
                                onChange={(e) =>
                                  setSettings((s) => ({ ...s, time: e.target.value }))
                                }
                                disabled={!settings.enabled}
                                className="bg-slate-900 border-cyan-500/30 text-cyan-100"
                              />
                              <p className="text-xs text-cyan-300/60">
                                Recommended: Set during off-peak hours (e.g., 2:00 AM)
                              </p>
                            </div>

                            {/* Retention */}
                            <div className="space-y-2">
                              <Label className="text-cyan-100">Retention (Backups to Keep)</Label>
                              <Select
                                value={settings.retentionCount.toString()}
                                onValueChange={(value) =>
                                  setSettings((s) => ({ ...s, retentionCount: parseInt(value) }))
                                }
                              >
                                <SelectTrigger className="bg-slate-900 border-cyan-500/30 text-cyan-100">
                                  <SelectValue placeholder="Select retention" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-cyan-500/30">
                                  {[5, 10, 20, 30, 50, 100].map((count) => (
                                    <SelectItem key={count} value={count.toString()} className="text-cyan-100 focus:bg-cyan-500/20">
                                      {count} backups
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Data Selection Card */}
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                        <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
                          <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
                          <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
                          <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
                          <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
                          
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400 tracking-wider uppercase">
                              <FileSpreadsheet className="h-5 w-5" />
                              Data Selection
                            </CardTitle>
                            <CardDescription className="text-cyan-300/60">
                              Choose which tables to backup and set the date range.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Date Range */}
                            <div className="space-y-4">
                              <Label className="text-cyan-100">Date Range (Optional)</Label>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-xs text-cyan-300/60">From</Label>
                                  <Input
                                    type="date"
                                    value={settings.dateRangeFrom}
                                    onChange={(e) =>
                                      setSettings((s) => ({ ...s, dateRangeFrom: e.target.value }))
                                    }
                                    className="bg-slate-900 border-cyan-500/30 text-cyan-100"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs text-cyan-300/60">To</Label>
                                  <Input
                                    type="date"
                                    value={settings.dateRangeTo}
                                    onChange={(e) =>
                                      setSettings((s) => ({ ...s, dateRangeTo: e.target.value }))
                                    }
                                    className="bg-slate-900 border-cyan-500/30 text-cyan-100"
                                  />
                                </div>
                              </div>
                              <p className="text-xs text-cyan-300/60">
                                Leave dates empty to backup all data regardless of date.
                              </p>
                            </div>

                            <Separator className="bg-cyan-500/20" />

                            {/* Tables Selection */}
                            <div className="space-y-3">
                              <Label className="text-cyan-100">Select Tables to Backup</Label>
                              <div className="space-y-2 max-h-[300px] overflow-y-auto border border-cyan-500/30 rounded-lg p-3 bg-slate-800/30">
                                {AVAILABLE_TABLES.map((table) => (
                                  <div key={table.id} className="flex items-center space-x-2 p-2 hover:bg-cyan-500/10 rounded transition-colors">
                                    <Checkbox
                                      id={table.id}
                                      checked={settings.includeTables.includes(table.id)}
                                      onCheckedChange={() => toggleTable(table.id)}
                                    />
                                    <div className="flex-1">
                                      <Label htmlFor={table.id} className="text-sm text-cyan-100 cursor-pointer">
                                        {table.name}
                                      </Label>
                                      <p className="text-xs text-cyan-300/60">
                                        {table.db === "supabase" ? "PostgreSQL (Supabase)" : "MongoDB"}
                                      </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-300">
                                      {table.db}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Storage Location Card */}
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                      <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
                        
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400 tracking-wider uppercase">
                            <Cloud className="h-5 w-5" />
                            Storage Location
                          </CardTitle>
                          <CardDescription className="text-cyan-300/60">
                            Choose where to store your backup files.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-cyan-100">Storage Type</Label>
                            <Select
                              value={settings.storageLocation}
                              onValueChange={(v: "local" | "cloud" | "both") =>
                                setSettings((s) => ({ ...s, storageLocation: v }))
                              }
                            >
                              <SelectTrigger className="bg-slate-950 border-cyan-500/30 text-cyan-100">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-cyan-500/30">
                                <SelectItem value="local" className="text-cyan-100">Local Storage</SelectItem>
                                <SelectItem value="cloud" className="text-cyan-100">Cloud Only</SelectItem>
                                <SelectItem value="both" className="text-cyan-100">Local + Cloud</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {settings.storageLocation !== "local" && (
                            <div className="space-y-2">
                              <Label className="text-cyan-100">Cloud Provider</Label>
                              <Select
                                value={settings.cloudProvider}
                                onValueChange={(v: "aws" | "gcp" | "azure" | "supabase") =>
                                  setSettings((s) => ({ ...s, cloudProvider: v }))
                                }
                              >
                                <SelectTrigger className="bg-slate-950 border-cyan-500/30 text-cyan-100">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-cyan-500/30">
                                  <SelectItem value="supabase" className="text-cyan-100">Supabase</SelectItem>
                                  <SelectItem value="aws" className="text-cyan-100">AWS S3</SelectItem>
                                  <SelectItem value="gcp" className="text-cyan-100">Google Cloud</SelectItem>
                                  <SelectItem value="azure" className="text-cyan-100">Azure Blob</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Notifications Card */}
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                      <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
                        
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400 tracking-wider uppercase">
                            <Bell className="h-5 w-5" />
                            Notifications
                          </CardTitle>
                          <CardDescription className="text-cyan-300/60">
                            Configure notification alerts for backup status.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                            <div className="space-y-0.5">
                              <Label className="text-cyan-100">Notify on Success</Label>
                              <p className="text-xs text-cyan-300/60">
                                Send notification when backup completes successfully
                              </p>
                            </div>
                            <Switch
                              checked={settings.notifyOnSuccess}
                              onCheckedChange={(checked) =>
                                setSettings((s) => ({ ...s, notifyOnSuccess: checked }))
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                            <div className="space-y-0.5">
                              <Label className="text-cyan-100">Notify on Failure</Label>
                              <p className="text-xs text-cyan-300/60">
                                Send notification when backup fails
                              </p>
                            </div>
                            <Switch
                              checked={settings.notifyOnFailure}
                              onCheckedChange={(checked) =>
                                setSettings((s) => ({ ...s, notifyOnFailure: checked }))
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                            <div className="space-y-0.5">
                              <Label className="text-cyan-100 flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Email Notifications
                              </Label>
                              <p className="text-xs text-cyan-300/60">
                                Also send email notifications alongside Firebase
                              </p>
                            </div>
                            <Switch
                              checked={settings.emailNotifications}
                              onCheckedChange={(checked) =>
                                setSettings((s) => ({ ...s, emailNotifications: checked }))
                              }
                            />
                          </div>
                          {settings.emailNotifications && (
                            <div className="space-y-2 p-3 bg-slate-800/30 rounded-lg border border-cyan-500/10">
                              <Label className="text-cyan-100">Notification Email</Label>
                              <Input
                                type="email"
                                placeholder="admin@company.com"
                                value={settings.notificationEmail || ""}
                                onChange={(e) =>
                                  setSettings((s) => ({ ...s, notificationEmail: e.target.value }))
                                }
                                className="bg-slate-900 border-cyan-500/30 text-cyan-100"
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button
                        onClick={handleSaveSettings}
                        disabled={loading}
                        className="flex-1 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Settings
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleRunBackupNow}
                        disabled={runningBackup || settings.includeTables.length === 0}
                        variant="outline"
                        className="flex-1 bg-slate-900 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                      >
                        {runningBackup ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Running Backup...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Run Backup Now
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Backup History Card */}
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                      <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
                        
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400 tracking-wider uppercase">
                            <Cloud className="h-5 w-5" />
                            Backup History
                          </CardTitle>
                          <CardDescription className="text-cyan-300/60">
                            Recent backup operations and their status.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {backupHistory.length === 0 ? (
                            <div className="text-center py-8 text-cyan-300/60">
                              <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p>No backup history available</p>
                            </div>
                          ) : (
                            <div className="space-y-3 w-full">
                              {backupHistory.map((backup) => (
                                <div
                                  key={backup.id}
                                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20 w-full"
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    <div
                                      className={`h-3 w-3 rounded-full ${getStatusColor(backup.status)}`}
                                    />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-cyan-100">
                                        {format(new Date(backup.timestamp), "MMM dd, yyyy HH:mm")}
                                      </p>
                                      <p className="text-xs text-cyan-300/60">
                                        {backup.frequency} • {backup.recordsCount.toLocaleString()} records • {backup.size}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* Preview Button - Available for all statuses */}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handlePreviewBackup(backup.id)}
                                      className="bg-slate-900 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    
                                    {backup.status === "success" && (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => handleDownloadZip(backup.id)}
                                          className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                        >
                                          <Download className="h-4 w-4 mr-1" />
                                          ZIP
                                        </Button>
                                        
                                        {/* Restore Button */}
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleOpenRestore(backup.id, backup.tables || [])}
                                          className="bg-slate-900 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                                        >
                                          <RotateCcw className="h-4 w-4 mr-1" />
                                          Restore
                                        </Button>
                                        
                                        {/* Verify Button */}
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleVerifyBackup(backup.id)}
                                          disabled={verifyingBackup}
                                          className="bg-slate-900 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300"
                                        >
                                          {verifyingBackup ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Shield className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </>
                                    )}
                                    {backup.status === "failed" && (
                                      <Badge variant="destructive">Failed</Badge>
                                    )}
                                    {backup.status === "in_progress" && (
                                      <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                        Running
                                      </Badge>
                                    )}
                                    
                                    {/* Delete Button */}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        if (confirm("Are you sure you want to delete this backup?")) {
                                          handleDeleteBackup(backup.id);
                                        }
                                      }}
                                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </main>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="bg-slate-900 border-cyan-500/30 text-cyan-100 max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-cyan-400 flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Backup Preview
            </DialogTitle>
            <DialogDescription className="text-cyan-300/60">
              Preview of the backup data (first 5 rows per table)
            </DialogDescription>
          </DialogHeader>
          
          {loadingPreview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <span className="ml-2 text-cyan-300">Loading preview...</span>
            </div>
          ) : previewData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                <div>
                  <p className="text-xs text-cyan-300/60 uppercase">Date</p>
                  <p className="text-sm text-cyan-100">{format(new Date(previewData.timestamp), "MMM dd, yyyy HH:mm")}</p>
                </div>
                <div>
                  <p className="text-xs text-cyan-300/60 uppercase">Tables</p>
                  <p className="text-sm text-cyan-100">{previewData.tables?.length || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-cyan-300/60 uppercase">Records</p>
                  <p className="text-sm text-cyan-100">{previewData.recordsCount?.toLocaleString() || 0}</p>
                </div>
              </div>

              {previewData.previewData && Object.entries(previewData.previewData).map(([tableName, rows]: [string, any]) => (
                <div key={tableName} className="space-y-2">
                  <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    {tableName}
                    <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-300">
                      {rows.length} rows
                    </Badge>
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-cyan-500/20">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-800/80 hover:bg-slate-800/80">
                          {rows.length > 0 && Object.keys(rows[0]).slice(0, 5).map((key) => (
                            <TableHead key={key} className="text-cyan-400 text-xs">{key}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row: any, idx: number) => (
                          <TableRow key={idx} className="bg-slate-900/50 hover:bg-slate-800/50">
                            {Object.values(row).slice(0, 5).map((value: any, vidx: number) => (
                              <TableCell key={vidx} className="text-cyan-100/80 text-xs py-2">
                                {typeof value === 'string' && value.length > 30 
                                  ? value.substring(0, 30) + '...' 
                                  : String(value)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-cyan-300/60 text-center py-4">No preview data available</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Progress Dialog */}
      {runningBackup && backupProgress && (
        <Dialog open={runningBackup}>
          <DialogContent className="bg-slate-900 border-cyan-500/30 text-cyan-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Backup in Progress
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-cyan-300">Processing: {backupProgress.table}</span>
                  <span className="text-cyan-400">{backupProgress.current} of {backupProgress.total}</span>
                </div>
                <Progress 
                  value={(backupProgress.current / backupProgress.total) * 100} 
                  className="h-2 bg-slate-800"
                />
              </div>
              <p className="text-xs text-cyan-300/60 text-center">
                Please wait while we backup your data...
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="bg-slate-900 border-cyan-500/30 text-cyan-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-amber-400 flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Restore Backup
            </DialogTitle>
            <DialogDescription className="text-cyan-300/60">
              Restore data from backup to database
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {restoreResults ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Restore completed!</span>
                </div>
                <div className="space-y-2">
                  {restoreResults.map((result: any, idx: number) => (
                    <div key={idx} className="flex justify-between p-2 bg-slate-800/50 rounded border border-cyan-500/20">
                      <span className="text-cyan-300">{result.table}</span>
                      <span className="text-emerald-400">{result.restored} / {result.total} records</span>
                    </div>
                  ))}
                </div>
                <Button 
                  onClick={() => setRestoreDialogOpen(false)} 
                  className="w-full bg-cyan-600 hover:bg-cyan-500"
                >
                  Close
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-cyan-100">Tables to Restore</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_TABLES.map((table) => (
                      <div key={table.id} className="flex items-center gap-2 p-2 bg-slate-800/30 rounded">
                        <Checkbox
                          checked={restoreOptions.restoreTables.includes(table.id)}
                          onCheckedChange={(checked) => {
                            setRestoreOptions((prev) => ({
                              ...prev,
                              restoreTables: checked
                                ? [...prev.restoreTables, table.id]
                                : prev.restoreTables.filter((id) => id !== table.id),
                            }));
                          }}
                        />
                        <span className="text-sm text-cyan-200">{table.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div>
                    <Label className="text-cyan-100">Overwrite Existing Data</Label>
                    <p className="text-xs text-cyan-300/60">Delete existing data before restoring</p>
                  </div>
                  <Switch
                    checked={restoreOptions.overwrite}
                    onCheckedChange={(checked) =>
                      setRestoreOptions((prev) => ({ ...prev, overwrite: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <Label className="text-cyan-100">Notify on Restore</Label>
                  <Switch
                    checked={restoreOptions.notifyOnRestore}
                    onCheckedChange={(checked) =>
                      setRestoreOptions((prev) => ({ ...prev, notifyOnRestore: checked }))
                    }
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setRestoreDialogOpen(false)}
                    className="flex-1 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRestoreBackup}
                    disabled={restoringBackup || restoreOptions.restoreTables.length === 0}
                    className="flex-1 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white"
                  >
                    {restoringBackup ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Restoring...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Restore
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Calendar View Dialog */}
      <Dialog open={calendarViewOpen} onOpenChange={setCalendarViewOpen}>
        <DialogContent className="bg-slate-900 border-cyan-500/30 text-cyan-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-cyan-400 flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Backup Schedule Calendar
            </DialogTitle>
            <DialogDescription className="text-cyan-300/60">
              View upcoming scheduled backups
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-xs text-cyan-400 font-medium py-2">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - 15 + i);
                const isToday = date.toDateString() === new Date().toDateString();
                const hasBackup = date.getDay() === settings.dayOfWeek && settings.enabled;
                
                return (
                  <div
                    key={i}
                    className={`
                      aspect-square p-2 rounded-lg border text-xs flex flex-col items-center justify-center
                      ${isToday ? "bg-cyan-600/30 border-cyan-500" : "bg-slate-800/30 border-cyan-500/20"}
                      ${hasBackup ? "ring-2 ring-emerald-500/50" : ""}
                    `}
                  >
                    <span className={isToday ? "text-cyan-200 font-bold" : "text-cyan-300/70"}>
                      {date.getDate()}
                    </span>
                    {hasBackup && (
                      <div className="mt-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-cyan-300/70">Scheduled Backup</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-cyan-600/30 border border-cyan-500" />
                <span className="text-cyan-300/70">Today</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verification Result Dialog */}
      <Dialog open={!!verificationResult} onOpenChange={() => setVerificationResult(null)}>
        <DialogContent className="bg-slate-900 border-cyan-500/30 text-cyan-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {verificationResult?.verified ? (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  <span className="text-emerald-400">Verification Passed</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <span className="text-red-400">Verification Failed</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
              <p className="text-xs text-cyan-300/60 uppercase mb-1">Checksum (SHA-256)</p>
              <p className="text-xs text-cyan-100 font-mono break-all">
                {verificationResult?.checksum}
              </p>
            </div>
            
            {verificationResult?.storedChecksum && (
              <div className="p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                <p className="text-xs text-cyan-300/60 uppercase mb-1">Stored Checksum</p>
                <p className="text-xs text-cyan-100 font-mono break-all">
                  {verificationResult?.storedChecksum}
                </p>
              </div>
            )}
            
            <p className="text-sm text-cyan-300/80 text-center">
              {verificationResult?.message}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedPageWrapper>
  );
}
