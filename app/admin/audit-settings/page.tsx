"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { 
  Archive, 
  Trash2, 
  Calendar, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Database,
  HardDrive,
  ChevronLeft,
  Settings
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface LogStats {
  systemAudits: { count: number };
  systemAudits_archive: { count: number };
  activity_logs: { count: number };
  taskflow_customer_audit_logs: { count: number };
}

interface RetentionSettings {
  retentionDays: number;
  autoArchive: boolean;
  autoPurge: boolean;
  archiveEnabled: boolean;
}

export default function AuditLogSettingsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<LogStats | null>(null);
  const [settings, setSettings] = useState<RetentionSettings>({
    retentionDays: 90,
    autoArchive: true,
    autoPurge: false,
    archiveEnabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [purgeDateRange, setPurgeDateRange] = useState({
    from: "",
    to: "",
  });

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/Data/Applications/Admin/AuditLogs/Manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_stats" }),
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/Data/Applications/Admin/AuditLogs/Manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "archive",
          params: { retentionDays: settings.retentionDays },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: `Successfully archived ${data.archivedCount} logs older than ${settings.retentionDays} days.`,
        });
        fetchStats();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to archive logs." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to archive logs." });
    } finally {
      setArchiving(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm("Are you sure you want to permanently delete these logs? This action cannot be undone.")) {
      return;
    }
    
    setPurging(true);
    setMessage(null);
    try {
      const res = await fetch("/api/Data/Applications/Admin/AuditLogs/Manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purge",
          params: purgeDateRange.from && purgeDateRange.to
            ? { fromDate: purgeDateRange.from, toDate: purgeDateRange.to }
            : { all: true },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: `Successfully deleted ${data.deletedCount} logs.`,
        });
        fetchStats();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to purge logs." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to purge logs." });
    } finally {
      setPurging(false);
    }
  };

  const totalLogs = stats
    ? stats.systemAudits.count + 
      stats.activity_logs.count + 
      stats.taskflow_customer_audit_logs.count
    : 0;

  const archivedLogs = stats?.systemAudits_archive?.count || 0;

  return (
    <ProtectedPageWrapper>
      <TooltipProvider delayDuration={0}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            {/* Header */}
            <header className="flex h-auto min-h-[56px] shrink-0 items-center gap-2 px-2 md:px-4 py-2 flex-wrap">
              <SidebarTrigger className="-ml-1 touch-button" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard")}
              >
                Home
              </Button>
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <Breadcrumb className="hidden sm:flex">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/audit-logs">Audit Logs</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Settings</BreadcrumbPage>
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
                    onClick={() => router.push("/audit-logs")}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Audit Log Settings
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Manage data retention policies, archive old logs, and purge log data.
                    </p>
                  </div>
                </div>
              </div>

      {message && (
        <Alert 
          variant={message.type === "success" ? "default" : "destructive"}
          className={cn("mb-6", message.type === "success" && "border-green-500 bg-green-50")}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <AlertTitle>{message.type === "success" ? "Success" : "Error"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Logs</p>
                <p className="text-2xl font-bold">{totalLogs.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Archive className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Archived</p>
                <p className="text-2xl font-bold">{archivedLogs.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Retention</p>
                <p className="text-2xl font-bold">{settings.retentionDays} days</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <HardDrive className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Collections</p>
                <p className="text-2xl font-bold">4</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Retention Policy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Retention Policy
            </CardTitle>
            <CardDescription>
              Configure how long audit logs are kept before archiving or deletion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <Label>Retention Period (days)</Label>
                  <Badge variant="secondary">{settings.retentionDays} days</Badge>
                </div>
                <Slider
                  value={[settings.retentionDays]}
                  onValueChange={([value]: number[]) => setSettings(s => ({ ...s, retentionDays: value }))}
                  min={7}
                  max={365}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Logs older than {settings.retentionDays} days will be eligible for archiving.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Archive</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically archive old logs
                  </p>
                </div>
                <Switch
                  checked={settings.autoArchive}
                  onCheckedChange={(checked) => 
                    setSettings(s => ({ ...s, autoArchive: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Archiving</Label>
                  <p className="text-xs text-muted-foreground">
                    Keep archived logs in separate collection
                  </p>
                </div>
                <Switch
                  checked={settings.archiveEnabled}
                  onCheckedChange={(checked) => 
                    setSettings(s => ({ ...s, archiveEnabled: checked }))
                  }
                />
              </div>
            </div>

            <Button 
              onClick={handleArchive}
              disabled={archiving}
              className="w-full"
            >
              {archiving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive Old Logs Now
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Purge Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Purge Logs
            </CardTitle>
            <CardDescription>
              Permanently delete logs. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Purging logs will permanently delete them from the database. 
                Consider archiving instead if you need to keep records.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Input
                    type="date"
                    value={purgeDateRange.from}
                    onChange={(e) => setPurgeDateRange(r => ({ ...r, from: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Input
                    type="date"
                    value={purgeDateRange.to}
                    onChange={(e) => setPurgeDateRange(r => ({ ...r, to: e.target.value }))}
                  />
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Leave dates empty to purge all logs (not recommended).
              </p>
            </div>

            <Button 
              onClick={handlePurge}
              disabled={purging}
              variant="destructive"
              className="w-full"
            >
              {purging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Purging...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Purge Logs
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Collection Stats */}
      {stats && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Collection Statistics</CardTitle>
            <CardDescription>Current log counts by collection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats).map(([collection, data]) => (
                <div key={collection} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{collection}</span>
                  </div>
                  <Badge variant={collection.includes("archive") ? "secondary" : "default"}>
                    {data.count.toLocaleString()} logs
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ProtectedPageWrapper>
  );
}
