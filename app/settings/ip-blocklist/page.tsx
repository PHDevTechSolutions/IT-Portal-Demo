"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { Pagination } from "@/components/app-pagination";
import { toast } from "sonner";
import {
  ShieldOff, Search, Trash2, RefreshCw,
  Loader2, ChevronRight, AlertTriangle,
  Monitor, Globe, Clock, BarChart3,
} from "lucide-react";

const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  muted:  "#253040",
  dim:    "#4a6070",
  text:   "#c8d8e8",
  accent: "#e8630a",
  red:    "#f87171",
  font:   "'JetBrains Mono','Fira Code',monospace",
};

interface LogEntry {
  _id:       string;
  ip:        string;
  path:      string;
  userAgent: string;
  deviceId:  string;
  blockedAt: string;
}

interface TopIp {
  _id:      string;
  count:    number;
  lastSeen: string;
}

const PAGE_SIZE = 50;

export default function IPBlocklistPage() {
  const router = useRouter();

  const [logs,       setLogs]       = useState<LogEntry[]>([]);
  const [topIps,     setTopIps]     = useState<TopIp[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState("");
  const [isLoading,  setIsLoading]  = useState(true);
  const [clearing,   setClearing]   = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = async (p = page, q = search) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p), pageSize: String(PAGE_SIZE), search: q,
      });
      const res  = await fetch(`/api/settings/ip-blocklist?${params}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.logs);
        setTotal(json.total);
        setTopIps(json.topIps ?? []);
      }
    } catch { toast.error("Failed to load blocklist."); }
    finally  { setIsLoading(false); }
  };

  useEffect(() => { load(1, ""); }, []);

  const handleSearch = (q: string) => {
    setSearch(q); setPage(1); load(1, q);
  };

  const handlePageChange = (p: number) => {
    setPage(p); load(p, search);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res  = await fetch("/api/settings/ip-blocklist", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setLogs(prev => prev.filter(l => l._id !== id));
      setTotal(t => t - 1);
    } catch (err: any) { toast.error(err.message ?? "Delete failed."); }
    finally { setDeleting(null); }
  };

  const handleClearAll = async () => {
    if (!confirm("Clear all blocked IP logs? This cannot be undone.")) return;
    setClearing(true);
    try {
      const res  = await fetch("/api/settings/ip-blocklist", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-all" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("All logs cleared.");
      setLogs([]); setTotal(0); setTopIps([]);
    } catch (err: any) { toast.error(err.message ?? "Clear failed."); }
    finally { setClearing(false); }
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-PH", { timeZone: "Asia/Manila", hour12: false });
  };

  const parseUA = (ua: string) => {
    if (!ua) return "—";
    if (ua.includes("Chrome"))  return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari"))  return "Safari";
    if (ua.includes("Edge"))    return "Edge";
    return ua.slice(0, 30) + "…";
  };

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden"
          style={{ backgroundColor: C.bg, color: C.text, fontFamily: C.font }}>

          {/* Dot grid */}
          <div className="fixed inset-0 pointer-events-none"
            style={{ backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`, backgroundSize: "24px 24px", opacity: 0.12, zIndex: 0 }} />

          {/* Header */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b"
            style={{ backgroundColor: C.bg, borderColor: C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <button onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest transition-colors"
              style={{ color: C.dim }}
              onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
              Home
            </button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Settings</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator><ChevronRight size={10} style={{ color: C.muted }} /></BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.red }}>IP Blocklist</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Live</span>
            </div>
          </header>

          {/* Title bar */}
          <div className="relative z-10 shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center border"
                style={{ borderColor: `${C.red}40`, backgroundColor: `${C.red}08` }}>
                <ShieldOff className="size-4" style={{ color: C.red }} />
              </div>
              <div>
                <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.red }}>IP Blocklist</h1>
                <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                  Unauthorized access attempts · {total.toLocaleString()} total
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => load(page, search)} disabled={isLoading}
                className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                {isLoading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                Refresh
              </button>
              {total > 0 && (
                <button onClick={handleClearAll} disabled={clearing}
                  className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                  style={{ borderColor: `${C.red}40`, color: C.red, backgroundColor: "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${C.red}10`)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                  {clearing ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Top offenders */}
            {topIps.length > 0 && (
              <div className="border" style={{ borderColor: C.border, backgroundColor: C.panel }}>
                <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                  <BarChart3 className="size-3.5" style={{ color: C.red }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.red }}>
                    Top Blocked IPs
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: C.border }}>
                  {topIps.map((ip, i) => (
                    <div key={ip._id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold w-4 text-center" style={{ color: C.muted }}>
                          #{i + 1}
                        </span>
                        <Globe className="size-3.5 shrink-0" style={{ color: C.dim }} />
                        <span className="text-[11px] font-mono font-bold" style={{ color: C.text }}>
                          {ip._id}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-mono px-2 py-0.5 border"
                          style={{ borderColor: `${C.red}40`, color: C.red, backgroundColor: `${C.red}10` }}>
                          {ip.count} attempt{ip.count !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[9px] font-mono hidden sm:block" style={{ color: C.muted }}>
                          {fmtTime(ip.lastSeen)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search + pagination */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 size-3.5" style={{ color: C.dim }} />
                <input
                  placeholder="Search IP, path, browser…"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  className="w-full pl-8 pr-3 h-8 text-[11px] focus:outline-none"
                  style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                  onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                  onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>
              <span className="text-[10px] font-mono" style={{ color: C.dim }}>
                {total.toLocaleString()} log{total !== 1 ? "s" : ""}
              </span>
              <Pagination page={page} totalPages={totalPages} onPageChangeAction={handlePageChange} />
            </div>

            {/* Table */}
            <div className="border overflow-hidden" style={{ borderColor: C.border }}>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-2">
                  <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                  <span className="text-[11px] uppercase tracking-widest" style={{ color: C.dim }}>Loading…</span>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <ShieldOff className="size-8 opacity-10" style={{ color: C.red }} />
                  <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.dim }}>
                    {search ? "No results found" : "No blocked attempts yet"}
                  </p>
                </div>
              ) : (
                <table className="w-full border-collapse text-[11px]" style={{ fontFamily: C.font }}>
                  <thead className="sticky top-0 z-10">
                    <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                      {["IP Address","Path Attempted","Browser","Device ID","Time",""].map((h, i) => (
                        <th key={i} className={`px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest ${i === 5 ? "w-10" : "text-left"}`}
                          style={{ color: `${C.red}90`, borderRight: i < 5 ? `1px solid ${C.border}` : undefined }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => (
                      <tr key={log._id}
                        style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel, borderBottom: `1px solid ${C.border}` }}>

                        {/* IP */}
                        <td className="px-4 py-2.5 whitespace-nowrap font-mono"
                          style={{ borderRight: `1px solid ${C.border}` }}>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: C.red }} />
                            <span style={{ color: C.red }}>{log.ip}</span>
                          </div>
                        </td>

                        {/* Path */}
                        <td className="px-4 py-2.5 max-w-[200px]"
                          style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>
                          <p className="truncate font-mono text-[10px]">{log.path || "/"}</p>
                        </td>

                        {/* Browser */}
                        <td className="px-4 py-2.5 whitespace-nowrap"
                          style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>
                          <div className="flex items-center gap-1.5">
                            <Monitor className="size-3 shrink-0" style={{ color: C.muted }} />
                            <span className="text-[10px]">{parseUA(log.userAgent)}</span>
                          </div>
                        </td>

                        {/* Device ID */}
                        <td className="px-4 py-2.5 font-mono text-[10px]"
                          style={{ borderRight: `1px solid ${C.border}`, color: C.muted }}>
                          {log.deviceId ? log.deviceId.slice(0, 14) + "…" : "—"}
                        </td>

                        {/* Time */}
                        <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[10px]"
                          style={{ borderRight: `1px solid ${C.border}`, color: C.muted }}>
                          <div className="flex items-center gap-1.5">
                            <Clock className="size-3 shrink-0" style={{ color: C.muted }} />
                            {fmtTime(log.blockedAt)}
                          </div>
                        </td>

                        {/* Delete */}
                        <td className="px-3 py-2.5 text-center">
                          <button onClick={() => handleDelete(log._id)} disabled={deleting === log._id}
                            className="flex items-center justify-center h-6 w-6 border transition-colors disabled:opacity-40 mx-auto"
                            style={{ borderColor: C.border, color: C.dim }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                            {deleting === log._id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
