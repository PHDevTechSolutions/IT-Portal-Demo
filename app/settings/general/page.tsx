"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider, useFormat } from "@/contexts/FormatContext";

import { AppSidebar } from "@/components/app-sidebar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger, } from "@/components/ui/sidebar";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { type DateRange } from "react-day-picker";

import { useTheme } from "next-themes";
import { toast } from "sonner";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";

function SettingsContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  // Get userId from URL query param and sync to context
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
    return (
      <></>
    );
  }

  return (
    <>
      <ProtectedPageWrapper>
        <AppSidebar />
        <SidebarInset>
          {/* Header */}
          <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
            <div className="flex flex-1 items-center gap-2 px-3">
              <SidebarTrigger />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-base font-semibold">
                      Settings
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          {/* Main Content */}
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="mx-auto w-full max-w-3xl space-y-6">
              {/* Theme Settings */}
              <Card className="border border-muted shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Theme Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="theme">Select Theme</Label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger id="theme" className="w-[160px]">
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Time & Date Format Settings */}
              <Card className="border border-muted shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Time & Date Format</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Time Format */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="time-format">Time Format</Label>
                    <Select
                      value={timeFormat}
                      onValueChange={onTimeFormatChange}
                    >
                      <SelectTrigger id="time-format" className="w-[160px]">
                        <SelectValue placeholder="Select time format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12h">12-Hour</SelectItem>
                        <SelectItem value="24h">24-Hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Format */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="date-format">Date Format</Label>
                    <Select
                      value={dateFormat}
                      onValueChange={onDateFormatChange}
                    >
                      <SelectTrigger id="date-format" className="w-[160px]">
                        <SelectValue placeholder="Select date format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">MM/DD/YYYY</SelectItem>
                        <SelectItem value="long">Monday, November 11, 2025</SelectItem>
                        <SelectItem value="iso">2025-11-11</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </SidebarInset>
      </ProtectedPageWrapper>
    </>
  );
}

export default function SettingsPage() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <SettingsContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
