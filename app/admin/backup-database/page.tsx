"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  Database, 
  Download,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  HardDrive,
  ChevronLeft,
  Settings,
  FileSpreadsheet,
  Save,
  Play,
  Bell,
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface BackupSettings {
  enabled: boolean;
  frequency: "weekly" | "monthly" | "yearly";
  dayOfWeek: number; // 0-6 for weekly
  dayOfMonth: number; // 1-31 for monthly
  monthOfYear: number; // 1-12 for yearly
  time: string; // HH:mm format
  dateRangeFrom: string;
  dateRangeTo: string;
  includeTables: string[];
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  retentionCount: number; // how many backups to keep
}

interface BackupHistory {
  id: string;
  timestamp: string;
  status: "success" | "failed" | "in_progress";
  size: string;
  frequency: string;
  recordsCount: number;
  downloadUrl?: string;
}

const AVAILABLE_TABLES = [
  { id: "activity", name: "Activity Logs", db: "supabase" },
  { id: "documentation", name: "Documentation", db: "supabase" },
  { id: "history", name: "History", db: "supabase" },
  { id: "revised_quotations", name: "Revised Quotations", db: "supabase" },
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
    dayOfWeek: 0, // Sunday
    dayOfMonth: 1,
    monthOfYear: 1,
    time: "02:00",
    dateRangeFrom: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    dateRangeTo: format(new Date(), "yyyy-MM-dd"),
    includeTables: ["activity", "history", "users", "customer_database"],
    notifyOnSuccess: true,
    notifyOnFailure: true,
    retentionCount: 10,
  });
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);
  const [nextBackupTime, setNextBackupTime] = useState<string>("");

  // Fetch settings and history on mount
  useEffect(() => {
    fetchSettings();
    fetchBackupHistory();
  }, []);

  // Calculate next backup time when settings change
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
        body: JSON.stringify({
          action: "save_settings",
          settings,
        }),
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
        body: JSON.stringify({
          action: "run_backup",
          settings,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Backup completed successfully! Exported ${data.recordsCount} records.`);
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
        body: JSON.stringify({
          action: "download",
          backupId,
        }),
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
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "in_progress":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case "weekly":
        return `Every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][settings.dayOfWeek]}`;
      case "monthly":
        return `Monthly on day ${settings.dayOfMonth}`;
      case "yearly":
        return `Yearly on ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][settings.monthOfYear - 1]} ${settings.dayOfMonth}`;
      default:
        return freq;
    }
  };

  return (
    <ProtectedPageWrapper>
      <TooltipProvider delayDuration={0}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            {/* Header */}
            <header className="flex h-16 shrink-0 items-center gap-2 px-4">
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
                    <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/settings/general">Settings</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Database Backup</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>

            <main className="p-6 md:p-10 space-y-6">
              {/* Page heading */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => router.push("/settings/general")}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Database Backup Settings
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Configure automated database backups with date range selection and Excel export.
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Backup Frequency</p>
                        <p className="text-lg font-bold capitalize">{settings.frequency}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Next Backup</p>
                        <p className="text-sm font-bold">{nextBackupTime || "Calculating..."}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <HardDrive className="h-8 w-8 text-purple-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Tables Selected</p>
                        <p className="text-2xl font-bold">{settings.includeTables.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <RotateCcw className="h-8 w-8 text-amber-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Backups Kept</p>
                        <p className="text-2xl font-bold">{settings.retentionCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Backup Schedule Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Backup Schedule
                    </CardTitle>
                    <CardDescription>
                      Configure when automated backups should run.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Enable/Disable */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Enable Automated Backups</Label>
                        <p className="text-xs text-muted-foreground">
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

                    <Separator />

                    {/* Frequency */}
                    <div className="space-y-2">
                      <Label>Backup Frequency</Label>
                      <Select
                        value={settings.frequency}
                        onValueChange={(value: any) =>
                          setSettings((s) => ({ ...s, frequency: value }))
                        }
                        disabled={!settings.enabled}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Day Selection based on frequency */}
                    {settings.frequency === "weekly" && (
                      <div className="space-y-2">
                        <Label>Day of Week</Label>
                        <Select
                          value={settings.dayOfWeek.toString()}
                          onValueChange={(value) =>
                            setSettings((s) => ({ ...s, dayOfWeek: parseInt(value) }))
                          }
                          disabled={!settings.enabled}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                          <SelectContent>
                            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                              (day, index) => (
                                <SelectItem key={index} value={index.toString()}>
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
                        <Label>Day of Month</Label>
                        <Select
                          value={settings.dayOfMonth.toString()}
                          onValueChange={(value) =>
                            setSettings((s) => ({ ...s, dayOfMonth: parseInt(value) }))
                          }
                          disabled={!settings.enabled}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                              <SelectItem key={day} value={day.toString()}>
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
                          <Label>Month</Label>
                          <Select
                            value={settings.monthOfYear.toString()}
                            onValueChange={(value) =>
                              setSettings((s) => ({ ...s, monthOfYear: parseInt(value) }))
                            }
                            disabled={!settings.enabled}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select month" />
                            </SelectTrigger>
                            <SelectContent>
                              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(
                                (month, index) => (
                                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                                    {month}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Day of Month</Label>
                          <Select
                            value={settings.dayOfMonth.toString()}
                            onValueChange={(value) =>
                              setSettings((s) => ({ ...s, dayOfMonth: parseInt(value) }))
                            }
                            disabled={!settings.enabled}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                <SelectItem key={day} value={day.toString()}>
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
                      <Label>Backup Time</Label>
                      <Input
                        type="time"
                        value={settings.time}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, time: e.target.value }))
                        }
                        disabled={!settings.enabled}
                      />
                      <p className="text-xs text-muted-foreground">
                        Recommended: Set during off-peak hours (e.g., 2:00 AM)
                      </p>
                    </div>

                    {/* Retention */}
                    <div className="space-y-2">
                      <Label>Retention (Number of Backups to Keep)</Label>
                      <Select
                        value={settings.retentionCount.toString()}
                        onValueChange={(value) =>
                          setSettings((s) => ({ ...s, retentionCount: parseInt(value) }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select retention" />
                        </SelectTrigger>
                        <SelectContent>
                          {[5, 10, 20, 30, 50, 100].map((count) => (
                            <SelectItem key={count} value={count.toString()}>
                              {count} backups
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Data Selection & Date Range */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      Data Selection & Export
                    </CardTitle>
                    <CardDescription>
                      Choose which tables to backup and set the date range.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Date Range */}
                    <div className="space-y-4">
                      <Label>Date Range (Optional)</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">From</Label>
                          <Input
                            type="date"
                            value={settings.dateRangeFrom}
                            onChange={(e) =>
                              setSettings((s) => ({ ...s, dateRangeFrom: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">To</Label>
                          <Input
                            type="date"
                            value={settings.dateRangeTo}
                            onChange={(e) =>
                              setSettings((s) => ({ ...s, dateRangeTo: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Leave dates empty to backup all data regardless of date.
                      </p>
                    </div>

                    <Separator />

                    {/* Tables Selection */}
                    <div className="space-y-3">
                      <Label>Select Tables to Backup</Label>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-3">
                        {AVAILABLE_TABLES.map((table) => (
                          <div key={table.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={table.id}
                              checked={settings.includeTables.includes(table.id)}
                              onCheckedChange={() => toggleTable(table.id)}
                            />
                            <div className="flex-1">
                              <Label htmlFor={table.id} className="text-sm cursor-pointer">
                                {table.name}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {table.db === "supabase" ? "PostgreSQL (Supabase)" : "MongoDB"}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {table.db}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Firebase Notifications
                  </CardTitle>
                  <CardDescription>
                    Configure notification alerts for backup status.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notify on Success</Label>
                      <p className="text-xs text-muted-foreground">
                        Send Firebase notification when backup completes successfully
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifyOnSuccess}
                      onCheckedChange={(checked) =>
                        setSettings((s) => ({ ...s, notifyOnSuccess: checked }))
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notify on Failure</Label>
                      <p className="text-xs text-muted-foreground">
                        Send Firebase notification when backup fails
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifyOnFailure}
                      onCheckedChange={(checked) =>
                        setSettings((s) => ({ ...s, notifyOnFailure: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={handleSaveSettings}
                  disabled={loading}
                  className="flex-1"
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
                  className="flex-1"
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

              {/* Backup History */}
              <Card>
                <CardHeader>
                  <CardTitle>Backup History</CardTitle>
                  <CardDescription>Recent backup operations and their status.</CardDescription>
                </CardHeader>
                <CardContent>
                  {backupHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No backup history available</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {backupHistory.map((backup) => (
                        <div
                          key={backup.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-3 w-3 rounded-full ${getStatusColor(
                                backup.status
                              )}`}
                            />
                            <div>
                              <p className="text-sm font-medium">
                                {format(new Date(backup.timestamp), "MMM dd, yyyy HH:mm")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {backup.frequency} • {backup.recordsCount.toLocaleString()} records • {backup.size}
                              </p>
                            </div>
                          </div>
                          {backup.status === "success" && backup.downloadUrl && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadBackup(backup.id)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          {backup.status === "failed" && (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                          {backup.status === "in_progress" && (
                            <Badge variant="outline">
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              Running
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ProtectedPageWrapper>
  );
}
