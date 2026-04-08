"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider, useFormat } from "@/contexts/FormatContext";

import { AppSidebar } from "@/components/app-sidebar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbLink, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { type DateRange } from "react-day-picker";

import { useTheme } from "next-themes";
import { toast } from "sonner";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";

import { 
  Settings, 
  Palette, 
  Clock, 
  Calendar, 
  Monitor, 
  CheckCircle2,
  AlertCircle,
  Shield,
  Bell,
  Globe
} from "lucide-react";

function SettingsContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const queryUserId = searchParams?.get("id") ?? "";
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] =
    useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { theme, setTheme } = useTheme();
  const { timeFormat, setTimeFormat, dateFormat, setDateFormat } = useFormat();

  const onTimeFormatChange = (val: string) => {
    setTimeFormat(val);
    toast.success(`Time format set to ${val}`);
  };

  const onDateFormatChange = (val: string) => {
    setDateFormat(val);
    toast.success(`Date format set to ${val}`);
  };

  if (!mounted) {
    return <></>;
  }

  return (
    <>
      <ProtectedPageWrapper>
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
                        <BreadcrumbLink href="#" className="text-slate-400 hover:text-cyan-400">Settings</BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="text-cyan-500/50" />
                      <BreadcrumbItem>
                        <BreadcrumbPage className="text-cyan-400 font-medium uppercase tracking-wider text-sm">
                          General
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
                  <span className="text-cyan-300/80 font-mono">V.1.0.0</span>
                </div>
              </header>

              {/* Page Content */}
              <div className="px-4 py-6">
                <div className="mx-auto w-full max-w-4xl space-y-6">
                  {/* Page Title */}
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-wider text-white uppercase">
                      <span className="text-cyan-400">SYSTEM</span> SETTINGS
                    </h1>
                    <p className="text-white/60 text-xs tracking-[0.3em] uppercase mt-1">
                      Configuration Control Center
                    </p>
                  </div>

                  {/* Settings Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Theme Settings Card */}
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                      <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
                        
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400 tracking-wider uppercase">
                            <Palette className="h-5 w-5" />
                            Theme Settings
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                            <div className="flex items-center gap-3">
                              <Monitor className="h-4 w-4 text-cyan-400" />
                              <Label htmlFor="theme" className="text-cyan-100">Display Theme</Label>
                            </div>
                            <Select value={theme} onValueChange={setTheme}>
                              <SelectTrigger id="theme" className="w-[160px] bg-slate-900 border-cyan-500/30 text-cyan-100">
                                <SelectValue placeholder="Select theme" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-cyan-500/30">
                                <SelectItem value="light" className="text-cyan-100 focus:bg-cyan-500/20">Light</SelectItem>
                                <SelectItem value="dark" className="text-cyan-100 focus:bg-cyan-500/20">Dark</SelectItem>
                                <SelectItem value="system" className="text-cyan-100 focus:bg-cyan-500/20">System</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-cyan-300/60">
                            <AlertCircle className="h-3 w-3" />
                            <span>Changes apply immediately across all modules</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Time Format Card */}
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
                            Time Format
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                            <div className="flex items-center gap-3">
                              <Clock className="h-4 w-4 text-cyan-400" />
                              <Label htmlFor="time-format" className="text-cyan-100">Time Display</Label>
                            </div>
                            <Select value={timeFormat} onValueChange={onTimeFormatChange}>
                              <SelectTrigger id="time-format" className="w-[160px] bg-slate-900 border-cyan-500/30 text-cyan-100">
                                <SelectValue placeholder="Select time format" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-cyan-500/30">
                                <SelectItem value="12h" className="text-cyan-100 focus:bg-cyan-500/20">12-Hour (AM/PM)</SelectItem>
                                <SelectItem value="24h" className="text-cyan-100 focus:bg-cyan-500/20">24-Hour (Military)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-cyan-300/60">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Current: {timeFormat === '12h' ? '02:30 PM' : '14:30'}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Date Format Card */}
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                      <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
                        
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400 tracking-wider uppercase">
                            <Calendar className="h-5 w-5" />
                            Date Format
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                            <div className="flex items-center gap-3">
                              <Calendar className="h-4 w-4 text-cyan-400" />
                              <Label htmlFor="date-format" className="text-cyan-100">Date Display</Label>
                            </div>
                            <Select value={dateFormat} onValueChange={onDateFormatChange}>
                              <SelectTrigger id="date-format" className="w-[160px] bg-slate-900 border-cyan-500/30 text-cyan-100">
                                <SelectValue placeholder="Select date format" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-cyan-500/30">
                                <SelectItem value="short" className="text-cyan-100 focus:bg-cyan-500/20">MM/DD/YYYY</SelectItem>
                                <SelectItem value="long" className="text-cyan-100 focus:bg-cyan-500/20">Monday, Nov 11, 2025</SelectItem>
                                <SelectItem value="iso" className="text-cyan-100 focus:bg-cyan-500/20">2025-11-11</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-cyan-300/60">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Preview: {dateFormat === 'short' ? '11/11/2025' : dateFormat === 'long' ? 'Monday, November 11, 2025' : '2025-11-11'}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* System Info Card */}
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                      <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
                        
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400 tracking-wider uppercase">
                            <Shield className="h-5 w-5" />
                            System Status
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                              <p className="text-xs text-cyan-300/60 uppercase tracking-wider">Version</p>
                              <p className="text-sm text-cyan-100 font-mono">v2.0.6-stable</p>
                            </div>
                            <div className="p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                              <p className="text-xs text-cyan-300/60 uppercase tracking-wider">Environment</p>
                              <p className="text-sm text-cyan-100 font-mono">Production</p>
                            </div>
                            <div className="p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                              <p className="text-xs text-cyan-300/60 uppercase tracking-wider">Last Sync</p>
                              <p className="text-sm text-cyan-100 font-mono">{new Date().toLocaleTimeString()}</p>
                            </div>
                            <div className="p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                              <p className="text-xs text-cyan-300/60 uppercase tracking-wider">Status</p>
                              <p className="text-sm text-emerald-400 font-mono flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Online
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </ProtectedPageWrapper>
    </>
  );
}

export default function SettingsPage() {
  return (
    <FormatProvider>
      <SidebarProvider>
        <Suspense fallback={<div>Loading...</div>}>
          <SettingsContent />
        </Suspense>
      </SidebarProvider>
    </FormatProvider>
  );
}
