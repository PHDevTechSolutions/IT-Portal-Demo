"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider, useFormat } from "@/contexts/FormatContext";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
  BreadcrumbLink, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import {
  Palette, Clock, Calendar, Monitor, CheckCircle2,
  AlertCircle, Shield, Settings,
} from "lucide-react";

// ─── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  muted:  "#253040",
  dim:    "#4a6070",
  text:   "#c8d8e8",
  accent: "#e8630a",
  font:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

// ─── Setting card ─────────────────────────────────────────────────────────────
function SettingCard({ icon: Icon, title, children }: {
  icon: any; title: string; children: React.ReactNode;
}) {
  return (
    <div className="border" style={{ borderColor: C.border, backgroundColor: C.panel }}>
      {/* Card header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
        <div className="flex h-6 w-6 items-center justify-center border"
          style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
          <Icon className="size-3" style={{ color: C.accent }} />
        </div>
        <h2 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>{title}</h2>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

// ─── Setting row ──────────────────────────────────────────────────────────────
function SettingRow({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b last:border-b-0"
      style={{ borderColor: C.muted + "30" }}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.text }}>{label}</p>
        {hint && <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0"
      style={{ borderColor: C.muted + "30" }}>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: C.dim }}>{label}</span>
      <span className="text-[11px] font-bold font-mono" style={{ color: accent ? "#34d399" : C.text }}>{value}</span>
    </div>
  );
}

// ─── Ops Select ───────────────────────────────────────────────────────────────
function OpsSelect({ value, onValueChange, children }: {
  value: string; onValueChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 w-44 rounded-none text-[11px] focus:ring-0"
        style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-none"
        style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>
        {children}
      </SelectContent>
    </Select>
  );
}

function OpsSelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <SelectItem value={value}
      className="text-[11px] rounded-none focus:bg-orange-500/10 focus:text-orange-400"
      style={{ color: C.text, fontFamily: C.font }}>
      {children}
    </SelectItem>
  );
}

// ─── Inner content (needs hooks) ──────────────────────────────────────────────
function SettingsContent() {
  const searchParams  = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId   = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { theme, setTheme }                   = useTheme();
  const { timeFormat, setTimeFormat, dateFormat, setDateFormat } = useFormat();

  const onTimeChange = (v: string) => { setTimeFormat(v); toast.success(`Time format → ${v}`); };
  const onDateChange = (v: string) => { setDateFormat(v); toast.success(`Date format → ${v}`); };

  const timePreview = timeFormat === "12h" ? "02:30 PM" : "14:30";
  const datePreview = dateFormat === "short" ? "11/11/2025"
    : dateFormat === "long" ? "Monday, November 11, 2025"
    : "2025-11-11";

  // Don't render selects until theme is mounted (avoids hydration mismatch)
  if (!mounted) return null;

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto space-y-4">

      {/* Theme */}
      <SettingCard icon={Palette} title="Theme">
        <SettingRow label="Display Theme" hint="Applies immediately across all modules">
          <OpsSelect value={theme ?? "system"} onValueChange={setTheme}>
            <OpsSelectItem value="light">Light</OpsSelectItem>
            <OpsSelectItem value="dark">Dark</OpsSelectItem>
            <OpsSelectItem value="system">System</OpsSelectItem>
          </OpsSelect>
        </SettingRow>
      </SettingCard>

      {/* Time format */}
      <SettingCard icon={Clock} title="Time Format">
        <SettingRow label="Time Display" hint={`Preview: ${timePreview}`}>
          <OpsSelect value={timeFormat} onValueChange={onTimeChange}>
            <OpsSelectItem value="12h">12-Hour (AM/PM)</OpsSelectItem>
            <OpsSelectItem value="24h">24-Hour (Military)</OpsSelectItem>
          </OpsSelect>
        </SettingRow>
      </SettingCard>

      {/* Date format */}
      <SettingCard icon={Calendar} title="Date Format">
        <SettingRow label="Date Display" hint={`Preview: ${datePreview}`}>
          <OpsSelect value={dateFormat} onValueChange={onDateChange}>
            <OpsSelectItem value="short">MM/DD/YYYY</OpsSelectItem>
            <OpsSelectItem value="long">Monday, Nov 11, 2025</OpsSelectItem>
            <OpsSelectItem value="iso">2025-11-11 (ISO)</OpsSelectItem>
          </OpsSelect>
        </SettingRow>
      </SettingCard>

      {/* System status */}
      <SettingCard icon={Shield} title="System Status">
        <InfoRow label="Version"     value="v2.0.6-stable" />
        <InfoRow label="Environment" value="Production" />
        <InfoRow label="Last Sync"   value={new Date().toLocaleTimeString()} />
        <InfoRow label="Status"      value="● Online" accent />
      </SettingCard>

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <UserProvider>
      <FormatProvider>
        <ProtectedPageWrapper>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex flex-col h-svh overflow-hidden bg-[#080d12]"
              style={{ fontFamily: C.font, color: C.text }}>

              {/* Dot-grid */}
              <div className="fixed inset-0 pointer-events-none" style={{
                backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
                backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
              }} />

              {/* ── Header ── */}
              <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b bg-[#080d12]"
                style={{ borderColor: C.border }}>
                <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
                <div className="w-px h-4" style={{ backgroundColor: C.border }} />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block"
                        style={{ color: C.dim }}>Settings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold"
                        style={{ color: C.accent }}>General</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Online</span>
                </div>
              </header>

              {/* ── Title bar ── */}
              <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b bg-[#0d1117]"
                style={{ borderColor: C.border }}>
                <div className="flex h-8 w-8 items-center justify-center border"
                  style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
                  <Settings className="size-4" style={{ color: C.accent }} />
                </div>
                <div>
                  <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>General Settings</h1>
                  <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                    Theme · Time · Date · System
                  </p>
                </div>
              </div>

              {/* ── Content ── */}
              <div className="relative z-10 flex-1 overflow-y-auto">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full gap-3">
                    <div className="size-4 border-2 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: C.accent, borderTopColor: "transparent" }} />
                    <span className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Loading…</span>
                  </div>
                }>
                  <SettingsContent />
                </Suspense>
              </div>

            </SidebarInset>
          </SidebarProvider>
        </ProtectedPageWrapper>
      </FormatProvider>
    </UserProvider>
  );
}
