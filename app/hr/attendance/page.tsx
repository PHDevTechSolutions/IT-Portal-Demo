"use client"
import React, { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { DateRange } from "react-day-picker"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Loader2, Search, RefreshCw, Download, ClipboardList,
  ChevronLeft, ChevronRight, X, CalendarRange, Users,
  CheckCircle2, XCircle, Clock, MapPin,
} from "lucide-react"
import { toast } from "sonner"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"

// ─── Types ────────────────────────────────────────────────────────────────────
interface AttendanceRecord {
  _id: string
  ReferenceID: string
  Email: string
  Type: string
  Status: string
  Location?: string
  Latitude?: number
  Longitude?: number
  PhotoURL?: string
  date_created?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20

const STATUS_STYLES: Record<string, string> = {
  active:   "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  success:  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  inactive: "bg-red-500/15 text-red-400 border border-red-500/30",
  failed:   "bg-red-500/15 text-red-400 border border-red-500/30",
  pending:  "bg-amber-500/15 text-amber-400 border border-amber-500/30",
}

const TYPE_STYLES: Record<string, string> = {
  "time-in":      "bg-sky-500/15 text-sky-400 border border-sky-500/30",
  "time-out":     "bg-violet-500/15 text-violet-400 border border-violet-500/30",
  "site-visit":   "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  "client-visit": "bg-pink-500/15 text-pink-400 border border-pink-500/30",
}

function getBadge(map: Record<string, string>, val: string | null) {
  if (!val) return "bg-slate-500/10 text-slate-500 border border-slate-500/20"
  return map[val.toLowerCase()] ?? "bg-slate-500/10 text-slate-500 border border-slate-500/20"
}

function formatDate(val: string | null | undefined) {
  if (!val) return "—"
  try {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
      timeZone: "Asia/Manila",
    }).format(new Date(val))
  } catch { return val }
}

function cell(val: string | number | null | undefined) {
  return val ?? <span style={{ color: "#253040" }}>—</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const router = useRouter()

  // ── Color tokens ──────────────────────────────────────────────────────────
  const C = {
    bg:     "#080d12",
    panel:  "#0d1117",
    border: "#1a2535",
    muted:  "#253040",
    dim:    "#4a6070",
    text:   "#c8d8e8",
    accent: "#e8630a",
    font:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
  }

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter,   setTypeFilter]   = useState("all")
  const [dateRange,    setDateRange]    = useState<DateRange | undefined>(undefined)
  const [calOpen,      setCalOpen]      = useState(false)
  const [page,         setPage]         = useState(1)

  // ── Data state ────────────────────────────────────────────────────────────
  const [records,    setRecords]    = useState<AttendanceRecord[]>([])
  const [total,      setTotal]      = useState(0)
  const [isFetching, setIsFetching] = useState(true)

  // ── Stats (from current full result set) ──────────────────────────────────
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, timeIn: 0, timeOut: 0 })

  // ── Debounce search ───────────────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter, typeFilter, dateRange])

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async (silent = false) => {
    if (!silent) setIsFetching(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debouncedSearch)          params.set("search",   debouncedSearch)
      if (statusFilter !== "all")   params.set("status",   statusFilter)
      if (typeFilter   !== "all")   params.set("type",     typeFilter)
      if (dateRange?.from)          params.set("dateFrom", dateRange.from.toISOString())
      if (dateRange?.to) {
        const end = new Date(dateRange.to); end.setHours(23, 59, 59, 999)
        params.set("dateTo", end.toISOString())
      }

      const res  = await fetch(`/api/hr/attendance?${params}`, { cache: "no-store" })
      const json = await res.json() as {
        success: boolean; data: AttendanceRecord[]; total: number; error?: string
      }
      if (json.success) {
        setRecords(json.data)
        setTotal(json.total)
      } else {
        toast.error(json.error ?? "Failed to load attendance records.")
      }
    } catch {
      toast.error("Network error — could not load attendance.")
    } finally {
      setIsFetching(false)
    }
  }, [page, debouncedSearch, statusFilter, typeFilter, dateRange])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // ── Stats fetch (no filters, just counts) ─────────────────────────────────
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res  = await fetch("/api/hr/attendance?page=1&pageSize=1", { cache: "no-store" })
        const json = await res.json()
        if (!json.success) return
        // fetch a larger batch for stats
        const res2  = await fetch(`/api/hr/attendance?page=1&pageSize=200`, { cache: "no-store" })
        const json2 = await res2.json()
        if (!json2.success) return
        const all: AttendanceRecord[] = json2.data
        setStats({
          total:    json.total,
          active:   all.filter(r => r.Status?.toLowerCase() === "active" || r.Status?.toLowerCase() === "success").length,
          inactive: all.filter(r => r.Status?.toLowerCase() === "inactive" || r.Status?.toLowerCase() === "failed").length,
          timeIn:   all.filter(r => r.Type?.toLowerCase() === "time-in").length,
          timeOut:  all.filter(r => r.Type?.toLowerCase() === "time-out").length,
        })
      } catch {}
    }
    fetchStats()
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startRow   = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endRow     = Math.min(page * PAGE_SIZE, total)

  // ── Date label ────────────────────────────────────────────────────────────
  const dateLabel = (() => {
    if (!dateRange?.from) return "Pick date range"
    const fmt = (d: Date) => d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    if (!dateRange.to) return fmt(dateRange.from)
    return `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`
  })()

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleExport = () => {
    const headers = ["Reference ID","Email","Type","Status","Location","Latitude","Longitude","Date Created"]
    const rows = records.map(r =>
      [r.ReferenceID, r.Email, r.Type, r.Status, r.Location ?? "",
       r.Latitude ?? "", r.Longitude ?? "", r.date_created ?? ""]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    )
    const csv  = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = `attendance_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success("Exported successfully.")
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden"
          style={{ backgroundColor: C.bg, fontFamily: C.font, color: C.text }}>

          {/* Dot-grid texture */}
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
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>HR</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Attendance</BreadcrumbPage>
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
              <ClipboardList className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Attendance</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>HR · Time & Attendance Logs</p>
            </div>
            <div className="ml-auto hidden md:flex items-center gap-3 text-[10px] uppercase tracking-widest">
              <span style={{ color: C.muted }}>{total.toLocaleString()} total records</span>
            </div>
          </div>

          {/* ── Stats bar ── */}
          <div className="relative z-10 shrink-0 grid grid-cols-5 border-b" style={{ borderColor: C.border }}>
            {[
              { label: "Total",    value: stats.total,    color: C.text,    icon: Users },
              { label: "Active",   value: stats.active,   color: "#34d399", icon: CheckCircle2 },
              { label: "Inactive", value: stats.inactive, color: "#f87171", icon: XCircle },
              { label: "Time In",  value: stats.timeIn,   color: "#60a5fa", icon: Clock },
              { label: "Time Out", value: stats.timeOut,  color: "#a78bfa", icon: MapPin },
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
              <input placeholder="Search ref ID, email, type…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="size-3" style={{ color: C.dim }} />
                </button>
              )}
            </div>

            {/* Status filter */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Success">Success</option>
              <option value="Failed">Failed</option>
              <option value="Pending">Pending</option>
            </select>

            {/* Type filter */}
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
              <option value="all">All Types</option>
              <option value="Time-In">Time In</option>
              <option value="Time-Out">Time Out</option>
              <option value="Site-Visit">Site Visit</option>
              <option value="Client-Visit">Client Visit</option>
            </select>

            {/* Date range */}
            <div className="flex items-center gap-1">
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 h-8 px-3 text-[11px] border transition-colors"
                    style={{
                      backgroundColor: C.panel,
                      borderColor: calOpen ? C.accent : (dateRange ? C.accent : C.border),
                      color: dateRange ? C.text : C.dim,
                    }}>
                    <CalendarRange className="size-3 shrink-0" style={{ color: dateRange ? C.accent : C.dim }} />
                    <span>{dateLabel}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0 border"
                  style={{ backgroundColor: C.panel, borderColor: C.border, fontFamily: C.font }}>
                  <style>{`
                    .att-cal { color:${C.text}; background:${C.panel}; }
                    .att-cal .rdp-month_caption,.att-cal .rdp-caption_label{color:${C.accent};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
                    .att-cal .rdp-weekday{color:${C.dim};font-size:10px}
                    .att-cal .rdp-day_button{color:${C.text};font-size:11px;border-radius:0}
                    .att-cal .rdp-day_button:hover{background:rgba(232,99,10,.15)!important;color:${C.accent}!important}
                    .att-cal [data-selected-single=true] .rdp-day_button,.att-cal [data-range-start=true] .rdp-day_button,.att-cal [data-range-end=true] .rdp-day_button{background:${C.accent}!important;color:#080d12!important;font-weight:700}
                    .att-cal [data-range-middle=true] .rdp-day_button{background:rgba(232,99,10,.18)!important;color:${C.accent}!important;border-radius:0!important}
                    .att-cal .rdp-outside .rdp-day_button{color:${C.muted}}
                    .att-cal .rdp-today .rdp-day_button{border:1px solid ${C.accent};color:${C.accent}}
                    .att-cal button[class*="button_previous"],.att-cal button[class*="button_next"]{color:${C.dim};background:transparent;border:1px solid ${C.border};border-radius:0}
                    .att-cal button[class*="button_previous"]:hover,.att-cal button[class*="button_next"]:hover{border-color:${C.accent};color:${C.accent}}
                  `}</style>
                  <Calendar mode="range" selected={dateRange}
                    onSelect={r => { setDateRange(r); if (r?.from && r?.to) setCalOpen(false) }}
                    numberOfMonths={2} initialFocus className="att-cal p-3" />
                </PopoverContent>
              </Popover>
              {dateRange && (
                <button onClick={() => setDateRange(undefined)} title="Clear date range">
                  <X className="size-3" style={{ color: C.dim }} />
                </button>
              )}
            </div>

            <div className="flex-1" />

            <button onClick={() => fetchRecords(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
              <RefreshCw className="size-3" /> Refresh
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
              <Download className="size-3" /> Export
            </button>
          </div>

          {/* ── Table ── */}
          <div className="relative z-10 flex-1 overflow-auto">
            {isFetching ? (
              <div className="flex items-center justify-center h-full gap-3">
                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                <span className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>Loading records…</span>
              </div>
            ) : (
              <table className="w-full border-collapse" style={{ fontSize: "11px", fontFamily: C.font }}>
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                    {["Reference ID","Email","Type","Status","Location","Latitude","Longitude","Photo","Date Created"].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 whitespace-nowrap font-bold uppercase tracking-widest"
                        style={{ color: C.accent, fontSize: "9px", borderRight: `1px solid ${C.border}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16" style={{ color: C.muted }}>
                        No attendance records match your filters.
                      </td>
                    </tr>
                  ) : records.map((r, i) => (
                    <tr key={r._id}
                      style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel, borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>

                      <td className="px-3 py-2 whitespace-nowrap font-bold" style={{ borderRight: `1px solid ${C.border}`, color: C.accent }}>
                        {cell(r.ReferenceID)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>
                        {cell(r.Email)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                        {r.Type ? (
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getBadge(TYPE_STYLES, r.Type)}`}>
                            {r.Type}
                          </span>
                        ) : <span style={{ color: C.muted }}>—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                        {r.Status ? (
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getBadge(STATUS_STYLES, r.Status)}`}>
                            {r.Status}
                          </span>
                        ) : <span style={{ color: C.muted }}>—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap max-w-[160px] truncate" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>
                        {cell(r.Location)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono" style={{ borderRight: `1px solid ${C.border}`, color: C.muted }}>
                        {r.Latitude != null ? r.Latitude.toFixed(6) : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono" style={{ borderRight: `1px solid ${C.border}`, color: C.muted }}>
                        {r.Longitude != null ? r.Longitude.toFixed(6) : "—"}
                      </td>
                      <td className="px-3 py-2" style={{ borderRight: `1px solid ${C.border}` }}>
                        {r.PhotoURL ? (
                          <a href={r.PhotoURL} target="_blank" rel="noopener noreferrer">
                            <img src={r.PhotoURL} alt="proof"
                              className="w-8 h-8 object-cover"
                              style={{ border: `1px solid ${C.border}` }} />
                          </a>
                        ) : <span style={{ color: C.muted }}>—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: C.muted }}>
                        {formatDate(r.date_created)}
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
              <span style={{ color: C.text }}>{total}</span>
              {" "}records
            </span>

            <div className="flex items-center gap-1" style={{ fontSize: "11px" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                onMouseEnter={e => { if (page > 1) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                <ChevronLeft className="size-3" /> Prev
              </button>

              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number
                if (totalPages <= 7)             p = i + 1
                else if (page <= 4)              p = i + 1
                else if (page >= totalPages - 3) p = totalPages - 6 + i
                else                             p = page - 3 + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="h-7 w-7 border text-[10px] font-bold transition-colors"
                    style={{
                      backgroundColor: p === page ? C.accent : "transparent",
                      borderColor:     p === page ? C.accent : C.border,
                      color:           p === page ? "#080d12" : C.dim,
                    }}>{p}</button>
                )
              })}

              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                onMouseEnter={e => { if (page < totalPages) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                Next <ChevronRight className="size-3" />
              </button>
            </div>
          </div>

        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  )
}
