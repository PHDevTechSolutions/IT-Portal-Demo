"use client"
import React, { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { DateRange } from "react-day-picker"
import {
  SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Loader2, Search, RefreshCw, Download, TicketCheck,
  ChevronLeft, ChevronRight, X, CalendarRange,
} from "lucide-react"
import { toast } from "sonner"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Ticket {
  id: number
  referenceid: string | null
  requestor_name: string | null
  department: string | null
  request_type: string | null
  type_concern: string | null
  mode: string | null
  group_services: string | null
  technician_name: string | null
  site: string | null
  priority: string | null
  status: string | null
  date_scheduled: string | null
  remarks: string | null
  ticket_id: string | null
  processed_by: string | null
  closed_by: string | null
  date_closed: string | null
  date_created: string | null
  date_updated: string | null
  ticket_subject: string | null
  proof_of_completion: string | null
}

interface FetchResult {
  data: Ticket[]
  total: number
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border border-red-500/30",
  high:     "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  medium:   "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  low:      "bg-sky-500/15 text-sky-400 border border-sky-500/30",
}
const STATUS_STYLES: Record<string, string> = {
  open:          "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  "in-progress": "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  resolved:      "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  closed:        "bg-slate-500/15 text-slate-400 border border-slate-500/30",
  pending:       "bg-purple-500/15 text-purple-400 border border-purple-500/30",
}

function getBadgeClass(map: Record<string, string>, value: string | null) {
  if (!value) return "bg-slate-500/10 text-slate-500 border border-slate-500/20"
  return map[value.toLowerCase()] ?? "bg-slate-500/10 text-slate-500 border border-slate-500/20"
}

function formatDate(val: string | null) {
  if (!val) return "—"
  try {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
      timeZone: "Asia/Manila",
    }).format(new Date(val))
  } catch { return val }
}

function cell(val: string | null) {
  return val ?? <span style={{ color: "#253040" }}>—</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TicketsPage() {
  const router = useRouter()

  // ── Filter state (server-side) ─────────────────────────────────────────────
  const [search,         setSearch]         = useState("")
  const [statusFilter,   setStatusFilter]   = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [dateRange,      setDateRange]      = useState<DateRange | undefined>(undefined)
  const [calOpen,        setCalOpen]        = useState(false)
  const [page,           setPage]           = useState(1)

  // ── Data state ─────────────────────────────────────────────────────────────
  const [tickets,    setTickets]    = useState<Ticket[]>([])
  const [total,      setTotal]      = useState(0)
  const [isFetching, setIsFetching] = useState(true)

  // Debounce search so we don't fire on every keystroke
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => setDebouncedSearch(search), 400)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [search])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter, priorityFilter, dateRange])

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTickets = useCallback(async (silent = false) => {
    if (!silent) setIsFetching(true)
    try {
      const params = new URLSearchParams({
        page:     String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (debouncedSearch)          params.set("search",   debouncedSearch)
      if (statusFilter   !== "all") params.set("status",   statusFilter)
      if (priorityFilter !== "all") params.set("priority", priorityFilter)
      if (dateRange?.from)          params.set("dateFrom", dateRange.from.toISOString())
      if (dateRange?.to) {
        const end = new Date(dateRange.to)
        end.setHours(23, 59, 59, 999)
        params.set("dateTo", end.toISOString())
      }

      const res  = await fetch(`/api/ticketing/tickets?${params}`, { cache: "no-store" })
      const json = await res.json() as { success: boolean; data: Ticket[]; total: number; error?: string }

      if (json.success) {
        setTickets(json.data)
        setTotal(json.total)
      } else {
        toast.error(json.error ?? "Failed to load tickets.")
      }
    } catch {
      toast.error("Network error — could not load tickets.")
    } finally {
      setIsFetching(false)
    }
  }, [page, debouncedSearch, statusFilter, priorityFilter, dateRange])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // ── CSV Export (current page) ──────────────────────────────────────────────
  const handleExport = () => {
    const headers = [
      "Ticket ID","Reference ID","Requestor","Department","Request Type",
      "Concern","Mode","Group/Services","Technician","Site","Priority",
      "Status","Scheduled","Subject","Processed By","Date Created",
    ]
    const rows = tickets.map(t =>
      [
        t.ticket_id, t.referenceid, t.requestor_name, t.department,
        t.request_type, t.type_concern, t.mode, t.group_services,
        t.technician_name, t.site, t.priority, t.status,
        t.date_scheduled, t.ticket_subject, t.processed_by, t.date_created,
      ].map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")
    )
    const csv  = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url
    a.download = `tickets_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported successfully.")
  }

  const clearDateRange = () => { setDateRange(undefined) }

  // ── Date label helper ──────────────────────────────────────────────────────
  const dateLabel = (() => {
    if (!dateRange?.from) return "Pick date range"
    const fmt = (d: Date) => d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    if (!dateRange.to) return fmt(dateRange.from)
    return `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`
  })()

  // ── Color tokens ───────────────────────────────────────────────────────────
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

  const startRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endRow   = Math.min(page * PAGE_SIZE, total)

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset
          className="flex flex-col h-svh overflow-hidden"
          style={{ backgroundColor: C.bg, fontFamily: C.font, color: C.text }}
        >
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
              style={{ color: C.dim }}>
              Home
            </Button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>
                    Ticketing
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>
                    Tickets
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Live</span>
            </div>
          </header>

          {/* ── Page title bar ── */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex h-8 w-8 items-center justify-center border"
              style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <TicketCheck className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Tickets</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                IT Support Ticket Management
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px]" style={{ color: C.muted }}>$ tickets --list</span>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="relative z-10 shrink-0 flex items-center gap-2 px-4 py-2 border-b flex-wrap"
            style={{ borderColor: C.border, backgroundColor: C.bg }}>

            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
              <Input
                placeholder="Search tickets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-[11px] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ backgroundColor: C.panel, borderColor: C.border, color: C.text }}
                onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={(e)  => (e.currentTarget.style.borderColor = C.border)}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="size-3" style={{ color: C.dim }} />
                </button>
              )}
            </div>

            {/* Status filter */}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text }}>
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="pending">Pending</option>
            </select>

            {/* Priority filter */}
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text }}>
              <option value="all">All Priority</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Date range */}
            <div className="flex items-center gap-1">
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center gap-2 h-8 px-3 text-[11px] border transition-colors"
                    style={{
                      backgroundColor: C.panel,
                      borderColor: calOpen ? C.accent : (dateRange ? C.accent : C.border),
                      color: dateRange ? C.text : C.dim,
                    }}
                  >
                    <CalendarRange className="size-3 shrink-0" style={{ color: dateRange ? C.accent : C.dim }} />
                    <span>{dateLabel}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-auto p-0 border"
                  style={{ backgroundColor: C.panel, borderColor: C.border, fontFamily: C.font }}
                >
                  <style>{`
                    .dark-cal { color: ${C.text}; background: ${C.panel}; }
                    .dark-cal .rdp-month_caption,
                    .dark-cal .rdp-caption_label { color: ${C.accent}; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
                    .dark-cal .rdp-weekday { color: ${C.dim}; font-size: 10px; }
                    .dark-cal .rdp-day_button { color: ${C.text}; font-size: 11px; border-radius: 0; }
                    .dark-cal .rdp-day_button:hover { background: rgba(232,99,10,0.15) !important; color: ${C.accent} !important; }
                    .dark-cal [data-selected-single=true] .rdp-day_button,
                    .dark-cal [data-range-start=true] .rdp-day_button,
                    .dark-cal [data-range-end=true] .rdp-day_button { background: ${C.accent} !important; color: #080d12 !important; font-weight: 700; }
                    .dark-cal [data-range-middle=true] .rdp-day_button { background: rgba(232,99,10,0.18) !important; color: ${C.accent} !important; border-radius: 0 !important; }
                    .dark-cal .rdp-outside .rdp-day_button { color: ${C.muted}; }
                    .dark-cal .rdp-disabled .rdp-day_button { color: ${C.muted}; opacity: 0.3; }
                    .dark-cal .rdp-today .rdp-day_button { border: 1px solid ${C.accent}; color: ${C.accent}; }
                    .dark-cal button[class*="button_previous"],
                    .dark-cal button[class*="button_next"] { color: ${C.dim}; background: transparent; border: 1px solid ${C.border}; border-radius: 0; }
                    .dark-cal button[class*="button_previous"]:hover,
                    .dark-cal button[class*="button_next"]:hover { border-color: ${C.accent}; color: ${C.accent}; }
                  `}</style>
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range)
                      if (range?.from && range?.to) setCalOpen(false)
                    }}
                    numberOfMonths={2}
                    initialFocus
                    className="dark-cal p-3"
                  />
                </PopoverContent>
              </Popover>
              {dateRange && (
                <button onClick={clearDateRange} title="Clear date range">
                  <X className="size-3" style={{ color: C.dim }} />
                </button>
              )}
            </div>

            <div className="flex-1" />

            {/* Actions */}
            <button
              onClick={() => fetchTickets(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}
            >
              <RefreshCw className="size-3" /> Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}
            >
              <Download className="size-3" /> Export
            </button>
          </div>

          {/* ── Table ── */}
          <div className="relative z-10 flex-1 overflow-auto">
            {isFetching ? (
              <div className="flex items-center justify-center h-full gap-3">
                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                <span className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>Loading tickets…</span>
              </div>
            ) : (
              <table className="w-full border-collapse" style={{ fontSize: "11px", fontFamily: C.font }}>
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                    {[
                      "Ticket ID","Reference ID","Requestor","Department","Request Type",
                      "Concern","Mode","Group / Services","Technician","Site","Priority",
                      "Status","Scheduled","Subject","Processed By","Date Created",
                    ].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 whitespace-nowrap font-bold uppercase tracking-widest"
                        style={{ color: C.accent, fontSize: "9px", borderRight: `1px solid ${C.border}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="text-center py-16" style={{ color: C.muted, fontSize: "11px" }}>
                        No tickets match your filters.
                      </td>
                    </tr>
                  ) : tickets.map((t, i) => (
                    <tr key={t.id}
                      style={{
                        backgroundColor: i % 2 === 0 ? C.bg : C.panel,
                        borderBottom: `1px solid ${C.border}`,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}
                    >
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.accent, fontWeight: 700 }}>
                        {t.ticket_id ?? <span style={{ color: C.muted }}>—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(t.referenceid)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.text }}>{cell(t.requestor_name)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(t.department)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(t.request_type)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(t.type_concern)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(t.mode)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(t.group_services)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.text }}>{cell(t.technician_name)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(t.site)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                        {t.priority ? (
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getBadgeClass(PRIORITY_STYLES, t.priority)}`}>
                            {t.priority}
                          </span>
                        ) : <span style={{ color: C.muted }}>—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                        {t.status ? (
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getBadgeClass(STATUS_STYLES, t.status)}`}>
                            {t.status}
                          </span>
                        ) : <span style={{ color: C.muted }}>—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(t.date_scheduled)}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate" style={{ borderRight: `1px solid ${C.border}`, color: C.text }}>{cell(t.ticket_subject)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(t.processed_by)}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: C.muted }}>{formatDate(t.date_created)}</td>
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
              {" "}tickets
            </span>

            <div className="flex items-center gap-1" style={{ fontSize: "11px" }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                onMouseEnter={(e) => { if (page > 1) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}
              >
                <ChevronLeft className="size-3" /> Prev
              </button>

              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number
                if (totalPages <= 7)          { p = i + 1 }
                else if (page <= 4)           { p = i + 1 }
                else if (page >= totalPages - 3) { p = totalPages - 6 + i }
                else                          { p = page - 3 + i }
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="h-7 w-7 border text-[10px] font-bold transition-colors"
                    style={{
                      backgroundColor: p === page ? C.accent : "transparent",
                      borderColor:     p === page ? C.accent : C.border,
                      color:           p === page ? "#080d12" : C.dim,
                    }}>
                    {p}
                  </button>
                )
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                onMouseEnter={(e) => { if (page < totalPages) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}
              >
                Next <ChevronRight className="size-3" />
              </button>
            </div>
          </div>

        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  )
}
