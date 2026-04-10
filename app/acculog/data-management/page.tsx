"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2,
  Database,
  Archive,
  Download,
  Upload,
  Shield,
  Zap,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Settings,
  BarChart3,
  Image as ImageIcon,
  Trash2,
  Save,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  History,
  FileJson,
  Server,
  BrainCircuit,
  Bell,
  Eye,
  X,
  Calendar,
  Filter,
  Search,
  MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as ExcelJS from "exceljs";

// Types
interface DataStats {
  totalRecords: number;
  archivedRecords: number;
  totalSize: string;
  lastBackup: string;
  integrityScore: number;
  anomalyCount: number;
}

interface BackupRecord {
  id: string;
  name: string;
  date: string;
  size: string;
  type: "full" | "incremental";
  status: "completed" | "failed" | "in_progress";
}

interface AutomationRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
  lastRun: string;
}

interface AnomalyRecord {
  id: string;
  type: string;
  severity: "low" | "medium" | "high";
  detectedAt: string;
  details: string;
  resolved: boolean;
}

interface PerformanceMetric {
  metric: string;
  value: string;
  status: "good" | "warning" | "critical";
  trend: "up" | "down" | "stable";
}

export default function DataManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(false);
  
  // Data States
  const [stats, setStats] = useState<DataStats>({
    totalRecords: 0,
    archivedRecords: 0,
    totalSize: "0 B",
    lastBackup: "Never",
    integrityScore: 100,
    anomalyCount: 0
  });
  
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  
  // Selected item for detail view
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyRecord | null>(null);
  const [showBackupDetail, setShowBackupDetail] = useState(false);
  const [showAnomalyDetail, setShowAnomalyDetail] = useState(false);

  // API Functions
  const fetchStats = async () => {
    try {
      const response = await fetch("/api/Data/Applications/Acculog/DataManagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stats" })
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchBackups = async () => {
    try {
      const response = await fetch("/api/Data/Applications/Acculog/DataManagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_backups" })
      });
      const data = await response.json();
      if (data.success) {
        setBackups(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch backups:", error);
    }
  };

  const fetchAutomationRules = async () => {
    try {
      const response = await fetch("/api/Data/Applications/Acculog/DataManagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_automation_rules" })
      });
      const data = await response.json();
      if (data.success) {
        setAutomationRules(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch automation rules:", error);
    }
  };

  const fetchAnomalies = async () => {
    try {
      const response = await fetch("/api/Data/Applications/Acculog/DataManagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detect_anomalies" })
      });
      const data = await response.json();
      if (data.success) {
        setAnomalies(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch anomalies:", error);
    }
  };

  const fetchPerformanceMetrics = async () => {
    try {
      const response = await fetch("/api/Data/Applications/Acculog/DataManagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "performance" })
      });
      const data = await response.json();
      if (data.success) {
        setPerformanceMetrics(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch performance metrics:", error);
    }
  };

  const createBackup = async (type: "full" | "incremental") => {
    const toastId = toast.loading("Creating backup...");
    try {
      const response = await fetch("/api/Data/Applications/Acculog/DataManagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_backup", type })
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Backup created successfully!", { id: toastId });
        await fetchBackups();
        await fetchStats();
      } else {
        toast.error("Failed to create backup", { id: toastId });
      }
    } catch (error) {
      toast.error("Error creating backup", { id: toastId });
    }
  };

  const resolveAnomalyAPI = async (id: string) => {
    try {
      const response = await fetch("/api/Data/Applications/Acculog/DataManagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve_anomaly", anomalyId: id })
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Anomaly resolved successfully");
        await fetchAnomalies();
        await fetchStats();
      } else {
        toast.error("Failed to resolve anomaly");
      }
    } catch (error) {
      toast.error("Error resolving anomaly");
    }
  };

  const toggleAutomationRuleAPI = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch("/api/Data/Applications/Acculog/DataManagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_automation_rule", ruleId: id, updates: { enabled } })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Automation rule ${enabled ? "enabled" : "disabled"}`);
        await fetchAutomationRules();
      } else {
        toast.error("Failed to update automation rule");
      }
    } catch (error) {
      toast.error("Error updating automation rule");
    }
  };

  const downloadBackup = async (backup: BackupRecord) => {
    const toastId = toast.loading("Preparing Excel download...");
    try {
      console.log("Starting download for backup:", backup.id);
      
      // Fetch backup data from API
      const response = await fetch("/api/Data/Applications/Acculog/DataManagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download_backup", backupId: backup.id })
      });
      
      console.log("API response status:", response.status);
      const data = await response.json();
      console.log("API response data:", data);
      
      if (!data.success) {
        toast.error("Failed to fetch backup data: " + (data.error || "Unknown error"), { id: toastId });
        return;
      }

      // Check if data exists
      const tasklogData = data.data?.tasklog || [];
      const archiveData = data.data?.archive || [];
      
      console.log("TaskLog records:", tasklogData.length);
      console.log("Archive records:", archiveData.length);

      // Create workbook with exceljs
      const workbook = new ExcelJS.Workbook();
      
      // TaskLog sheet - always create even if empty
      const tasklogWs = workbook.addWorksheet("TaskLog");
      if (tasklogData.length > 0) {
        const columns = Object.keys(tasklogData[0]).map(key => ({ header: key, key }));
        tasklogWs.columns = columns;
        tasklogData.forEach((row: any) => tasklogWs.addRow(row));
      } else {
        tasklogWs.columns = [{ header: "Message", key: "message" }];
        tasklogWs.addRow({ message: "No TaskLog data available" });
      }
      
      // Archive sheet - always create even if empty
      const archiveWs = workbook.addWorksheet("Archive");
      if (archiveData.length > 0) {
        const columns = Object.keys(archiveData[0]).map(key => ({ header: key, key }));
        archiveWs.columns = columns;
        archiveData.forEach((row: any) => archiveWs.addRow(row));
      } else {
        archiveWs.columns = [{ header: "Message", key: "message" }];
        archiveWs.addRow({ message: "No Archive data available" });
      }
      
      // Metadata sheet
      const metadataWs = workbook.addWorksheet("Metadata");
      metadataWs.columns = [
        { header: "Property", key: "property" },
        { header: "Value", key: "value" }
      ];
      metadataWs.addRows([
        { property: "BackupName", value: backup.name },
        { property: "BackupDate", value: backup.date },
        { property: "BackupType", value: backup.type },
        { property: "BackupSize", value: backup.size },
        { property: "BackupStatus", value: backup.status },
        { property: "ExportedAt", value: new Date().toISOString() },
        { property: "TaskLogRecords", value: String(tasklogData.length) },
        { property: "ArchiveRecords", value: String(archiveData.length) }
      ]);
      
      console.log("Generating Excel buffer...");
      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      console.log("Excel buffer generated, size:", buffer.byteLength);
      
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_${backup.id}_${backup.date.replace(/\//g, '-')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("Backup downloaded as Excel!", { id: toastId });
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error("Error downloading backup: " + error.message, { id: toastId });
    }
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchStats(),
        fetchBackups(),
        fetchAutomationRules(),
        fetchAnomalies(),
        fetchPerformanceMetrics()
      ]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Settings States
  const [retentionDays, setRetentionDays] = useState(90);
  const [autoArchiveEnabled, setAutoArchiveEnabled] = useState(true);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [integrityCheckEnabled, setIntegrityCheckEnabled] = useState(true);
  const [anomalyDetectionEnabled, setAnomalyDetectionEnabled] = useState(true);
  const [backupFrequency, setBackupFrequency] = useState("daily");
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState("");
  const [operationProgress, setOperationProgress] = useState(0);
  const [isOperationRunning, setIsOperationRunning] = useState(false);

  // Handlers
  const handleRunOperation = async (operation: string) => {
    setSelectedOperation(operation);
    setShowRunDialog(true);
    setIsOperationRunning(true);
    setOperationProgress(0);
    
    const toastId = toast.loading(`Running ${operation}...`);
    
    // Simulate operation progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setOperationProgress(i);
    }
    
    setIsOperationRunning(false);
    toast.success(`${operation} completed successfully!`, { id: toastId });
    setShowRunDialog(false);
  };

  const toggleAutomationRule = (id: string) => {
    setAutomationRules(prev => prev.map(rule => 
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
    ));
    toast.success("Automation rule updated");
  };

  const resolveAnomaly = async (id: string) => {
    await resolveAnomalyAPI(id);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "bg-red-500/20 text-red-400 border-red-500/50";
      case "medium": return "bg-amber-500/20 text-amber-400 border-amber-500/50";
      case "low": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/50";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
      case "warning": return "bg-amber-500/20 text-amber-400 border-amber-500/50";
      case "critical": return "bg-red-500/20 text-red-400 border-red-500/50";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/50";
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
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
              <div 
                className="absolute inset-0 opacity-[0.02]"
                style={{
                  backgroundImage: `radial-gradient(circle at 50% 50%, rgba(6,182,212,0.8) 0%, transparent 50%)`,
                }}
              />
            </div>

            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-cyan-500/30 rounded-full animate-pulse"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    animationDuration: `${3 + Math.random() * 2}s`,
                  }}
                />
              ))}
            </div>

            {/* Main Content */}
            <div className="relative z-10 w-full">
              {/* Header */}
              <header className="flex h-16 items-center gap-2 px-4 border-b border-cyan-500/20 bg-slate-900/50 backdrop-blur-sm">
                <SidebarTrigger className="-ml-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20" />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => router.push("/dashboard")}
                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                >
                  Home
                </Button>
                <Separator orientation="vertical" className="h-4 bg-cyan-500/30" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/acculog/activity-logs" className="text-cyan-400 hover:text-cyan-300">Acculog</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-cyan-500/50" />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-cyan-100">Data Management</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </header>

              {/* Page Title */}
              <div className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                    <Database className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white tracking-wider">DATA MANAGEMENT</h1>
                    <p className="text-sm text-cyan-300/60">Advanced data operations, automation & monitoring</p>
                  </div>
                </div>
              </div>

              {/* Main Tabs */}
              <div className="px-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="bg-slate-900/50 border border-cyan-500/30">
                    <TabsTrigger value="overview" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-400">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="backup" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-400">
                      <Download className="h-4 w-4 mr-2" />
                      Backup & Restore
                    </TabsTrigger>
                    <TabsTrigger value="automation" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-400">
                      <Zap className="h-4 w-4 mr-2" />
                      Automation
                    </TabsTrigger>
                    <TabsTrigger value="anomalies" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-400">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Anomalies
                    </TabsTrigger>
                    <TabsTrigger value="performance" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-400">
                      <Activity className="h-4 w-4 mr-2" />
                      Performance
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-400">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="mt-4 space-y-4">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                        <CardContent className="relative p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-cyan-300/60 uppercase tracking-wider">Total Records</p>
                              <p className="text-2xl font-bold text-white mt-1">{stats.totalRecords.toLocaleString()}</p>
                            </div>
                            <Database className="h-8 w-8 text-cyan-400" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                        <CardContent className="relative p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-cyan-300/60 uppercase tracking-wider">Archived</p>
                              <p className="text-2xl font-bold text-white mt-1">{stats.archivedRecords.toLocaleString()}</p>
                            </div>
                            <Archive className="h-8 w-8 text-amber-400" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                        <CardContent className="relative p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-cyan-300/60 uppercase tracking-wider">Integrity Score</p>
                              <p className="text-2xl font-bold text-white mt-1">{stats.integrityScore}%</p>
                            </div>
                            <Shield className="h-8 w-8 text-emerald-400" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                        <CardContent className="relative p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-cyan-300/60 uppercase tracking-wider">Anomalies</p>
                              <p className="text-2xl font-bold text-white mt-1">{stats.anomalyCount}</p>
                            </div>
                            <AlertTriangle className="h-8 w-8 text-red-400" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Quick Actions */}
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardHeader className="relative">
                        <CardTitle className="text-white tracking-wider flex items-center gap-2">
                          <Zap className="h-5 w-5 text-cyan-400" />
                          QUICK ACTIONS
                        </CardTitle>
                        <CardDescription className="text-cyan-300/60">Run common data management operations</CardDescription>
                      </CardHeader>
                      <CardContent className="relative grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Button 
                          onClick={() => handleRunOperation("Archive Old Records")}
                          className="bg-slate-900/50 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 h-auto py-3 flex flex-col items-center gap-2"
                        >
                          <Archive className="h-5 w-5" />
                          <span className="text-xs">Archive Old</span>
                        </Button>
                        <Button 
                          onClick={() => createBackup("full")}
                          className="bg-slate-900/50 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 h-auto py-3 flex flex-col items-center gap-2"
                        >
                          <Download className="h-5 w-5" />
                          <span className="text-xs">Backup Now</span>
                        </Button>
                        <Button 
                          onClick={() => handleRunOperation("Integrity Check")}
                          className="bg-slate-900/50 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 h-auto py-3 flex flex-col items-center gap-2"
                        >
                          <Shield className="h-5 w-5" />
                          <span className="text-xs">Check Integrity</span>
                        </Button>
                        <Button 
                          onClick={() => handleRunOperation("Scan Anomalies")}
                          className="bg-slate-900/50 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 h-auto py-3 flex flex-col items-center gap-2"
                        >
                          <BrainCircuit className="h-5 w-5" />
                          <span className="text-xs">Scan Anomalies</span>
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Backup Tab */}
                  <TabsContent value="backup" className="mt-4 space-y-4">
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardHeader className="relative flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-white tracking-wider flex items-center gap-2">
                            <History className="h-5 w-5 text-cyan-400" />
                            BACKUP HISTORY
                          </CardTitle>
                          <CardDescription className="text-cyan-300/60">Manage and restore backups</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => createBackup("full")}
                            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Create Backup
                          </Button>
                          <Button 
                            variant="outline"
                            className="bg-slate-900/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Restore
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="relative">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-cyan-500/20">
                              <TableHead className="text-cyan-300">Name</TableHead>
                              <TableHead className="text-cyan-300">Date</TableHead>
                              <TableHead className="text-cyan-300">Size</TableHead>
                              <TableHead className="text-cyan-300">Type</TableHead>
                              <TableHead className="text-cyan-300">Status</TableHead>
                              <TableHead className="text-cyan-300 text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {backups.map((backup) => (
                              <TableRow 
                                key={backup.id} 
                                className="border-b border-cyan-500/10 cursor-pointer hover:bg-cyan-500/10"
                                onClick={() => {
                                  setSelectedBackup(backup);
                                  setShowBackupDetail(true);
                                }}
                              >
                                <TableCell className="text-cyan-100">{backup.name}</TableCell>
                                <TableCell className="text-cyan-300/70">{backup.date}</TableCell>
                                <TableCell className="text-cyan-300/70">{backup.size}</TableCell>
                                <TableCell>
                                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                                    {backup.type}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={backup.status === "completed" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-amber-500/20 text-amber-400 border-amber-500/50"}>
                                    {backup.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-cyan-400 hover:text-cyan-300"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadBackup(backup);
                                    }}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Automation Tab */}
                  <TabsContent value="automation" className="mt-4 space-y-4">
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardHeader className="relative">
                        <CardTitle className="text-white tracking-wider flex items-center gap-2">
                          <Zap className="h-5 w-5 text-cyan-400" />
                          AUTOMATION RULES
                        </CardTitle>
                        <CardDescription className="text-cyan-300/60">Configure automated data management tasks</CardDescription>
                      </CardHeader>
                      <CardContent className="relative">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-cyan-500/20">
                              <TableHead className="text-cyan-300">Rule Name</TableHead>
                              <TableHead className="text-cyan-300">Condition</TableHead>
                              <TableHead className="text-cyan-300">Action</TableHead>
                              <TableHead className="text-cyan-300">Status</TableHead>
                              <TableHead className="text-cyan-300">Last Run</TableHead>
                              <TableHead className="text-cyan-300 text-right">Enable</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {automationRules.map((rule) => (
                              <TableRow key={rule.id} className="border-b border-cyan-500/10">
                                <TableCell className="text-cyan-100 font-medium">{rule.name}</TableCell>
                                <TableCell className="text-cyan-300/70">{rule.condition}</TableCell>
                                <TableCell className="text-cyan-300/70">{rule.action}</TableCell>
                                <TableCell>
                                  <Badge className={rule.enabled ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-slate-500/20 text-slate-400 border-slate-500/50"}>
                                    {rule.enabled ? "Active" : "Disabled"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-cyan-300/70">{rule.lastRun}</TableCell>
                                <TableCell className="text-right">
                                  <Switch 
                                    checked={rule.enabled}
                                    onCheckedChange={() => toggleAutomationRule(rule.id)}
                                    className="data-[state=checked]:bg-cyan-500"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Anomalies Tab */}
                  <TabsContent value="anomalies" className="mt-4 space-y-4">
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardHeader className="relative flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-white tracking-wider flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-400" />
                            DETECTED ANOMALIES
                          </CardTitle>
                          <CardDescription className="text-cyan-300/60">Review and resolve data anomalies</CardDescription>
                        </div>
                        <Button 
                          onClick={() => handleRunOperation("Scan for Anomalies")}
                          className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0"
                        >
                          <BrainCircuit className="h-4 w-4 mr-2" />
                          Scan Now
                        </Button>
                      </CardHeader>
                      <CardContent className="relative">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-cyan-500/20">
                              <TableHead className="text-cyan-300">Type</TableHead>
                              <TableHead className="text-cyan-300">Severity</TableHead>
                              <TableHead className="text-cyan-300">Detected</TableHead>
                              <TableHead className="text-cyan-300">Details</TableHead>
                              <TableHead className="text-cyan-300">Status</TableHead>
                              <TableHead className="text-cyan-300 text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {anomalies.map((anomaly) => (
                              <TableRow 
                                key={anomaly.id} 
                                className="border-b border-cyan-500/10 cursor-pointer hover:bg-cyan-500/10"
                                onClick={() => {
                                  setSelectedAnomaly(anomaly);
                                  setShowAnomalyDetail(true);
                                }}
                              >
                                <TableCell className="text-cyan-100">{anomaly.type}</TableCell>
                                <TableCell>
                                  <Badge className={getSeverityColor(anomaly.severity)}>
                                    {anomaly.severity}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-cyan-300/70">{anomaly.detectedAt}</TableCell>
                                <TableCell className="text-cyan-300/70 max-w-xs truncate">{anomaly.details}</TableCell>
                                <TableCell>
                                  <Badge className={anomaly.resolved ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-red-500/20 text-red-400 border-red-500/50"}>
                                    {anomaly.resolved ? "Resolved" : "Open"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {!anomaly.resolved && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        resolveAnomaly(anomaly.id);
                                      }}
                                      className="text-emerald-400 hover:text-emerald-300"
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-1" />
                                      Resolve
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Performance Tab */}
                  <TabsContent value="performance" className="mt-4 space-y-4">
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardHeader className="relative">
                        <CardTitle className="text-white tracking-wider flex items-center gap-2">
                          <Activity className="h-5 w-5 text-cyan-400" />
                          PERFORMANCE METRICS
                        </CardTitle>
                        <CardDescription className="text-cyan-300/60">Monitor database and system performance</CardDescription>
                      </CardHeader>
                      <CardContent className="relative">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-cyan-500/20">
                              <TableHead className="text-cyan-300">Metric</TableHead>
                              <TableHead className="text-cyan-300">Value</TableHead>
                              <TableHead className="text-cyan-300">Status</TableHead>
                              <TableHead className="text-cyan-300">Trend</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {performanceMetrics.map((metric, idx) => (
                              <TableRow key={idx} className="border-b border-cyan-500/10">
                                <TableCell className="text-cyan-100">{metric.metric}</TableCell>
                                <TableCell className="text-cyan-300/70 font-mono">{metric.value}</TableCell>
                                <TableCell>
                                  <Badge className={getStatusColor(metric.status)}>
                                    {metric.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={metric.trend === "up" ? "bg-emerald-500/20 text-emerald-400" : metric.trend === "down" ? "bg-amber-500/20 text-amber-400" : "bg-slate-500/20 text-slate-400"}>
                                    {metric.trend === "up" ? "↑" : metric.trend === "down" ? "↓" : "→"} {metric.trend}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="mt-4 space-y-4">
                    <Card className="relative group bg-slate-900/90 border-cyan-500/30">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-20 transition-opacity" />
                      <CardHeader className="relative">
                        <CardTitle className="text-white tracking-wider flex items-center gap-2">
                          <Settings className="h-5 w-5 text-cyan-400" />
                          DATA MANAGEMENT SETTINGS
                        </CardTitle>
                        <CardDescription className="text-cyan-300/60">Configure retention, backup, and automation policies</CardDescription>
                      </CardHeader>
                      <CardContent className="relative space-y-6">
                        {/* Retention Policy */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Archive className="h-5 w-5 text-cyan-400" />
                              <div>
                                <p className="text-sm font-medium text-cyan-100">Auto-Archive Old Logs</p>
                                <p className="text-xs text-cyan-300/60">Automatically archive logs older than specified days</p>
                              </div>
                            </div>
                            <Switch 
                              checked={autoArchiveEnabled}
                              onCheckedChange={setAutoArchiveEnabled}
                              className="data-[state=checked]:bg-cyan-500"
                            />
                          </div>
                          {autoArchiveEnabled && (
                            <div className="pl-7">
                              <label className="text-xs text-cyan-300/80 mb-1 block">Retention Period (days)</label>
                              <Input 
                                type="number"
                                value={retentionDays}
                                onChange={(e) => setRetentionDays(Number(e.target.value))}
                                className="w-32 bg-slate-900/50 border-cyan-500/30 text-cyan-100"
                              />
                            </div>
                          )}
                        </div>

                        <Separator className="bg-cyan-500/20" />

                        {/* Auto Backup */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Download className="h-5 w-5 text-cyan-400" />
                              <div>
                                <p className="text-sm font-medium text-cyan-100">Auto-Backup</p>
                                <p className="text-xs text-cyan-300/60">Create automated backups on schedule</p>
                              </div>
                            </div>
                            <Switch 
                              checked={autoBackupEnabled}
                              onCheckedChange={setAutoBackupEnabled}
                              className="data-[state=checked]:bg-cyan-500"
                            />
                          </div>
                          {autoBackupEnabled && (
                            <div className="pl-7">
                              <label className="text-xs text-cyan-300/80 mb-1 block">Backup Frequency</label>
                              <Select value={backupFrequency} onValueChange={setBackupFrequency}>
                                <SelectTrigger className="w-48 bg-slate-900/50 border-cyan-500/30 text-cyan-100">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-cyan-500/30">
                                  <SelectItem value="hourly" className="text-cyan-100">Every hour</SelectItem>
                                  <SelectItem value="daily" className="text-cyan-100">Daily</SelectItem>
                                  <SelectItem value="weekly" className="text-cyan-100">Weekly</SelectItem>
                                  <SelectItem value="monthly" className="text-cyan-100">Monthly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        <Separator className="bg-cyan-500/20" />

                        {/* Integrity Check */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-cyan-400" />
                            <div>
                              <p className="text-sm font-medium text-cyan-100">Data Integrity Checks</p>
                              <p className="text-xs text-cyan-300/60">Regularly scan for data corruption or inconsistencies</p>
                            </div>
                          </div>
                          <Switch 
                            checked={integrityCheckEnabled}
                            onCheckedChange={setIntegrityCheckEnabled}
                            className="data-[state=checked]:bg-cyan-500"
                          />
                        </div>

                        <Separator className="bg-cyan-500/20" />

                        {/* Anomaly Detection */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BrainCircuit className="h-5 w-5 text-cyan-400" />
                            <div>
                              <p className="text-sm font-medium text-cyan-100">Anomaly Detection</p>
                              <p className="text-xs text-cyan-300/60">AI-powered detection of unusual patterns</p>
                            </div>
                          </div>
                          <Switch 
                            checked={anomalyDetectionEnabled}
                            onCheckedChange={setAnomalyDetectionEnabled}
                            className="data-[state=checked]:bg-cyan-500"
                          />
                        </div>

                        <div className="flex justify-end pt-4">
                          <Button 
                            onClick={() => toast.success("Settings saved successfully!")}
                            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Settings
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>

          {/* Backup Detail Dialog */}
          <Dialog open={showBackupDetail} onOpenChange={setShowBackupDetail}>
            <DialogContent className="bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
                  <History className="h-5 w-5 text-cyan-400" />
                  BACKUP DETAILS
                </DialogTitle>
              </DialogHeader>
              {selectedBackup && (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-cyan-300/60 uppercase">Name</p>
                      <p className="text-sm text-cyan-100">{selectedBackup.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-cyan-300/60 uppercase">Date</p>
                      <p className="text-sm text-cyan-100">{selectedBackup.date}</p>
                    </div>
                    <div>
                      <p className="text-xs text-cyan-300/60 uppercase">Size</p>
                      <p className="text-sm text-cyan-100">{selectedBackup.size}</p>
                    </div>
                    <div>
                      <p className="text-xs text-cyan-300/60 uppercase">Type</p>
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">{selectedBackup.type}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-cyan-300/60 uppercase">Status</p>
                      <Badge className={selectedBackup.status === "completed" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-amber-500/20 text-amber-400 border-amber-500/50"}>
                        {selectedBackup.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button 
                  onClick={() => setShowBackupDetail(false)}
                  className="bg-slate-900/50 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Anomaly Detail Dialog */}
          <Dialog open={showAnomalyDetail} onOpenChange={setShowAnomalyDetail}>
            <DialogContent className="bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  ANOMALY DETAILS
                </DialogTitle>
              </DialogHeader>
              {selectedAnomaly && (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <p className="text-xs text-cyan-300/60 uppercase">Type</p>
                      <p className="text-sm text-cyan-100">{selectedAnomaly.type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-cyan-300/60 uppercase">Severity</p>
                      <Badge className={getSeverityColor(selectedAnomaly.severity)}>{selectedAnomaly.severity}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-cyan-300/60 uppercase">Status</p>
                      <Badge className={selectedAnomaly.resolved ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-red-500/20 text-red-400 border-red-500/50"}>
                        {selectedAnomaly.resolved ? "Resolved" : "Open"}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-cyan-300/60 uppercase">Detected At</p>
                      <p className="text-sm text-cyan-100">{selectedAnomaly.detectedAt}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-cyan-300/60 uppercase">Details</p>
                      <p className="text-sm text-cyan-100">{selectedAnomaly.details}</p>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter className="flex justify-between">
                <Button 
                  onClick={() => setShowAnomalyDetail(false)}
                  className="bg-slate-900/50 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                >
                  Close
                </Button>
                {selectedAnomaly && !selectedAnomaly.resolved && (
                  <Button 
                    onClick={() => {
                      resolveAnomaly(selectedAnomaly.id);
                      setShowAnomalyDetail(false);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Resolve
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Operation Progress Dialog */}
          <Dialog open={showRunDialog} onOpenChange={setShowRunDialog}>
            <DialogContent className="bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] max-w-md">
              <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
                <div 
                  className="absolute inset-0 opacity-[0.02]"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                  }}
                />
              </div>
              <DialogHeader className="relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                    {isOperationRunning ? <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" /> : <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                  </div>
                  <DialogTitle className="text-xl font-bold text-white tracking-wider">
                    {isOperationRunning ? "PROCESSING..." : "COMPLETED"}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-cyan-300/70 mt-2">
                  {selectedOperation}
                </DialogDescription>
              </DialogHeader>
              <div className="relative z-10 py-4">
                <Progress value={operationProgress} className="h-2 bg-slate-800 [&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-blue-500" />
                <p className="text-center text-cyan-300/60 mt-2 text-sm">{operationProgress}% complete</p>
              </div>
            </DialogContent>
          </Dialog>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
