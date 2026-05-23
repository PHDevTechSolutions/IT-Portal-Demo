"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, Copy, X, RefreshCw, Download,
  Globe, Shield, Clock, Database, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DNSItem {
  id?: string; type?: string; name?: string; content?: string;
  ttl?: number; status?: string; lastModified?: string; zoneName?: string;
}

const PAGE_SIZE = 20;

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

const TYPE_COLOR: Record<string, string> = {
  A:     "text-sky-400 border-sky-500/30 bg-sky-500/10",
  AAAA:  "text-blue-400 border-blue-500/30 bg-blue-500/10",
  CNAME: "text-violet-400 border-violet-500/30 bg-violet-500/10",
  MX:    "text-amber-400 border-amber-500/30 bg-amber-500/10",
  TXT:   "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  NS:    "text-pink-400 border-pink-500/30 bg-pink-500/10",
  SRV:   "text-orange-400 border-orange-500/30 bg-orange-500/10",
  CAA:   "text-red-400 border-red-500/30 bg-red-500/10",
};
const typeColor = (t?: string) => TYPE_COLOR[t?.toUpperCase() ?? ""] ?? "text-slate-400 border-slate-500/30 bg-slate-500/10";

function formatDate(val?: string) {
  if (!val) return "—";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
      timeZone: "Asia/Manila",
    }).format(new Date(val));
  } catch { return val; }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DNSRecordsPage() {
  const router = useRouter();

  const [dnsData,    setDnsData]    = useState<DNSItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page,       setPage]       = useState(1);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchDNS = async (silent = false) => {
    if (!silent) setIsFetching(true);
    try {
      const res  = await fetch("/api/Data/Applications/Cloudflare/DNS/Fetch");
      const json = await res.json();
      if (json.success === false) throw new Error(json.error || "Failed");
      if (!Array.isArray(json.data)) throw new Error("Invalid data format");
      setDnsData(json.data);
    } catch (err: any) {
      toast.error("Error fetching DNS: " + err.message);
      setDnsData([]);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => { fetchDNS(); }, []);
  useEffect(() => { setPage(1); }, [search, typeFilter]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const typeOptions = useMemo(() =>
    ["all", ...Array.from(new Set(dnsData.map(d => d.type).filter(Boolean)))],
    [dnsData]);

  const filtered = useMemo(() =>
    dnsData
      .filter(d => {
        if (typeFilter !== "all" && d.type !== typeFilter) return false;
        if (!search) return true;
        const s = search.toLowerCase();
        return d.name?.toLowerCase().includes(s) ||
               d.content?.toLowerCase().includes(s) ||
               d.id?.toLowerCase().includes(s) ||
               d.zoneName?.toLowerCase().includes(s);
      })
      .sort((a, b) => new Date(b.lastModified ?? 0).getTime() - new Date(a.lastModified ?? 0).getTime()),
    [dnsData, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startRow   = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow     = Math.min(page * PAGE_SIZE, filtered.length);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const types = dnsData.reduce<Record<string,number>>((acc, d) => {
      if (d.type) acc[d.type] = (acc[d.type] ?? 0) + 1;
      return acc;
    }, {});
    return {
      total:  dnsData.length,
      active: dnsData.filter(d => d.status?.toLowerCase() === "active").length,
      types:  Object.keys(types).length,
      topType: Object.entries(types).sort((a,b) => b[1]-a[1])[0]?.[0] ?? "—",
    };
  }, [dnsData]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const headers = ["ID","Type","Name","Content","TTL","Status","Last Modified","Zone"];
    const rows = filtered.map(d =>
      [d.id, d.type, d.name, d.content, d.ttl, d.status, d.lastModified, d.zoneName]
        .map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dns_records_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    toast.success("Exported");
  };

  const handleCopy = (content?: string) => {
    if (!content) { toast.error("Nothing to copy"); return; }
    navigator.clipboard.writeText(content);
    toast.success("Copied");
  };

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden"
          style={{ backgroundColor: C.bg, fontFamily: C.font, color: C.text }}>

          {/* Dot-grid */}
          <div className="fixed inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
            backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
          }} />

          {/* ── Header ── */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b"
            style={{ backgroundColor: C.bg, borderColor: C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest rounded-none hover:bg-transparent"
              style={{ color: C.dim }}>Home</Button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Cloudflare</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>DNS Records</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              {isFetching && <Loader2 className="size-3 animate-spin" style={{ color: C.accent }} />}
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Live</span>
            </div>
          </header>

          {/* ── Title bar ── */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex h-8 w-8 items-center justify-center border"
              style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <Globe className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>DNS Records</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>Cloudflare · Zone DNS Management</p>
            </div>
            <div className="ml-auto hidden md:flex items-center gap-3 text-[10px] uppercase tracking-widest">
              <span style={{ color: C.muted }}>{dnsData.length} total</span>
              <div className="w-px h-3" style={{ backgroundColor: C.border }} />
              <span style={{ color: C.dim }}>{filtered.length} matching</span>
            </div>
          </div>

          {/* ── Stats bar ── */}
          <div className="relative z-10 shrink-0 grid grid-cols-4 border-b" style={{ borderColor: C.border }}>
            {[
              { label: "Total Records", value: stats.total,   color: C.text,    icon: Database },
              { label: "Active",        value: stats.active,  color: "#34d399", icon: Shield },
              { label: "Record Types",  value: stats.types,   color: "#60a5fa", icon: Globe },
              { label: "Top Type",      value: stats.topType, color: C.accent,  icon: Clock },
            ].map(({ label, value, color, icon: Icon }, i) => (
              <div key={i} className="flex flex-col items-center justify-center py-3 border-r last:border-r-0"
                style={{ borderColor: C.border, backgroundColor: C.panel }}>
                <span className="text-lg font-bold leading-none" style={{ color }}>{value}</span>
                <span className="text-[9px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>{label}</span>
              </div>
            ))}
          </div>

          {/* ── Toolbar ── */}
          <div className="relative z-10 shrink-0 flex items-center gap-2 px-4 py-2 border-b flex-wrap"
            style={{ borderColor: C.border, backgroundColor: C.bg }}>

            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
              <input placeholder="Search name, content, ID…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="size-3" style={{ color: C.dim }} />
                </button>
              )}
            </div>

            {/* Type filter */}
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
              {typeOptions.map(t => (
                <option key={t} value={t}>{t === "all" ? "All Types" : t}</option>
              ))}
            </select>

            <div className="flex-1" />

            <button onClick={() => fetchDNS(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
              <RefreshCw className="size-3" /> Refresh
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
              <Download className="size-3" /> Export
            </button>
          </div>

          {/* ── Table ── */}
          <div className="relative z-10 flex-1 overflow-auto">
            {isFetching ? (
              <div className="flex items-center justify-center h-full gap-3">
                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                <span className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>Loading DNS records…</span>
              </div>
            ) : (
              <table className="w-full border-collapse" style={{ fontSize: "11px", fontFamily: C.font }}>
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                    {["ID","Type","Name","Content","TTL","Status","Last Modified","Zone",""].map((h, i) => (
                      <th key={i} className="text-left px-3 py-2.5 whitespace-nowrap font-bold uppercase tracking-widest text-[9px]"
                        style={{ color: C.accent, borderRight: i < 8 ? `1px solid ${C.border}` : "none" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16" style={{ color: C.muted }}>
                        No DNS records match your filters.
                      </td>
                    </tr>
                  ) : current.map((item, i) => (
                    <tr key={item.id ?? i}
                      style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel, borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>

                      {/* ID */}
                      <td className="px-3 py-2 font-mono max-w-[140px]" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>
                        <span className="truncate block max-w-[130px]" title={item.id}>{item.id ?? "—"}</span>
                      </td>

                      {/* Type */}
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                        {item.type ? (
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${typeColor(item.type)}`}>
                            {item.type}
                          </span>
                        ) : <span style={{ color: C.muted }}>—</span>}
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2 whitespace-nowrap max-w-[200px]" style={{ borderRight: `1px solid ${C.border}`, color: C.text }}>
                        <span className="truncate block max-w-[190px]" title={item.name}>{item.name ?? "—"}</span>
                      </td>

                      {/* Content */}
                      <td className="px-3 py-2 max-w-[220px]" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>
                        <span className="truncate block max-w-[210px]" title={item.content}>{item.content ?? "—"}</span>
                      </td>

                      {/* TTL */}
                      <td className="px-3 py-2 whitespace-nowrap font-mono" style={{ borderRight: `1px solid ${C.border}`, color: C.muted }}>
                        {item.ttl === 1 ? "Auto" : (item.ttl ?? "—")}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                        {item.status ? (
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                            item.status.toLowerCase() === "active"
                              ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                              : "text-slate-400 border-slate-500/30 bg-slate-500/10"
                          }`}>{item.status}</span>
                        ) : <span style={{ color: C.muted }}>—</span>}
                      </td>

                      {/* Last Modified */}
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.muted }}>
                        {formatDate(item.lastModified)}
                      </td>

                      {/* Zone */}
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>
                        {item.zoneName ?? "—"}
                      </td>

                      {/* Copy action */}
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => handleCopy(item.content)}
                          title="Copy content"
                          className="h-6 w-6 flex items-center justify-center border transition-all mx-auto"
                          style={{ borderColor: C.border, color: C.dim }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                          <Copy className="size-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Footer / Pagination ── */}
          <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-2 border-t"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <span className="text-[10px]" style={{ color: C.muted }}>
              Showing{" "}
              <span style={{ color: C.text }}>{startRow}–{endRow}</span>
              {" "}of{" "}
              <span style={{ color: C.text }}>{filtered.length}</span>
              {" "}records
            </span>

            <div className="flex items-center gap-1" style={{ fontSize: "11px" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                onMouseEnter={e => { if (page > 1) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                <ChevronLeft className="size-3" /> Prev
              </button>

              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number;
                if (totalPages <= 7)             p = i + 1;
                else if (page <= 4)              p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else                             p = page - 3 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="h-7 w-7 border text-[10px] font-bold transition-colors"
                    style={{
                      backgroundColor: p === page ? C.accent : "transparent",
                      borderColor:     p === page ? C.accent : C.border,
                      color:           p === page ? "#080d12" : C.dim,
                    }}>{p}</button>
                );
              })}

              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                onMouseEnter={e => { if (page < totalPages) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                Next <ChevronRight className="size-3" />
              </button>
            </div>
          </div>

        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
