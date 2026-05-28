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
  Sparkles, AlertTriangle, Lightbulb, TrendingUp, BarChart3,
  ChevronDown, ChevronUp,
} from "lucide-react"
import { toast } from "sonner"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"

// ─── Types ────────────────────────────────────────────────────────────────────
interface AttendanceRecord {
  _id: string; ReferenceID: string; Email: string; Type: string; Status: string;
  Location?: string; Latitude?: number; Longitude?: number;
  PhotoURL?: string; date_created?: string;
}
interface AnalysisProblem       { title: string; description: string; severity: string; count?: number }
interface AnalysisPattern       { title: string; description: string }
interface AnalysisRecommendation{ title: string; description: string; priority: string }
interface AttendanceAnalysis {
  overview: string
  problems: AnalysisProblem[]
  patterns: AnalysisPattern[]
  recommendations: AnalysisRecommendation[]
  metrics: Record<string, string>
}

const PAGE_SIZE = 20

const C = {
  bg:     "#080d12", panel:  "#0d1117", border: "#1a2535",
  muted:  "#253040", dim:    "#4a6070", text:   "#c8d8e8",
  accent: "#e8630a", font:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
}

const STATUS_STYLES: Record<string,string> = {
  active:   "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  success:  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  inactive: "bg-red-500/15 text-red-400 border border-red-500/30",
  failed:   "bg-red-500/15 text-red-400 border border-red-500/30",
  pending:  "bg-amber-500/15 text-amber-400 border border-amber-500/30",
}
const TYPE_STYLES: Record<string,string> = {
  "time-in":      "bg-sky-500/15 text-sky-400 border border-sky-500/30",
  "time-out":     "bg-violet-500/15 text-violet-400 border border-violet-500/30",
  "site-visit":   "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  "client-visit": "bg-pink-500/15 text-pink-400 border border-pink-500/30",
}
const SEVERITY_STYLE: Record<string,{color:string;bg:string}> = {
  critical: { color:"#f87171", bg:"rgba(248,113,113,0.1)" },
  high:     { color:"#fb923c", bg:"rgba(251,146,60,0.1)"  },
  medium:   { color:"#fbbf24", bg:"rgba(251,191,36,0.1)"  },
  low:      { color:"#34d399", bg:"rgba(52,211,153,0.1)"  },
}
const PRIORITY_COLOR: Record<string,string> = {
  immediate:    "#f87171",
  "short-term": "#fbbf24",
  "long-term":  "#60a5fa",
}

function getBadge(map: Record<string,string>, val: string|null) {
  if (!val) return "bg-slate-500/10 text-slate-500 border border-slate-500/20"
  return map[val.toLowerCase()] ?? "bg-slate-500/10 text-slate-500 border border-slate-500/20"
}
function formatDate(val?: string|null) {
  if (!val) return "—"
  try {
    return new Intl.DateTimeFormat("en-PH", {
      year:"numeric", month:"short", day:"2-digit",
      hour:"2-digit", minute:"2-digit", hour12:true, timeZone:"Asia/Manila",
    }).format(new Date(val))
  } catch { return val }
}
function cell(val: string|number|null|undefined) {
  return val ?? <span style={{ color:"#253040" }}>—</span>
}

export default function AttendancePage() {
  const router = useRouter()

  const [search,       setSearch]       = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter,   setTypeFilter]   = useState("all")
  const [dateRange,    setDateRange]    = useState<DateRange|undefined>(undefined)
  const [calOpen,      setCalOpen]      = useState(false)
  const [page,         setPage]         = useState(1)

  const [records,    setRecords]    = useState<AttendanceRecord[]>([])
  const [total,      setTotal]      = useState(0)
  const [isFetching, setIsFetching] = useState(true)
  const [stats, setStats] = useState({ total:0, active:0, inactive:0, timeIn:0, timeOut:0 })

  // AI Insights
  const [insightsOpen,    setInsightsOpen]    = useState(false)
  const [isAnalyzing,     setIsAnalyzing]     = useState(false)
  const [analysis,        setAnalysis]        = useState<AttendanceAnalysis|null>(null)
  const [analyzedCount,   setAnalyzedCount]   = useState(0)
  const [expandedSection, setExpandedSection] = useState<string|null>("problems")

  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter, typeFilter, dateRange])

  const fetchRecords = useCallback(async (silent = false) => {
    if (!silent) setIsFetching(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debouncedSearch)        params.set("search",   debouncedSearch)
      if (statusFilter !== "all") params.set("status",   statusFilter)
      if (typeFilter   !== "all") params.set("type",     typeFilter)
      if (dateRange?.from)        params.set("dateFrom", dateRange.from.toISOString())
      if (dateRange?.to) {
        const end = new Date(dateRange.to); end.setHours(23,59,59,999)
        params.set("dateTo", end.toISOString())
      }
      const res  = await fetch(`/api/hr/attendance?${params}`, { cache:"no-store" })
      const json = await res.json()
      if (json.success) { setRecords(json.data); setTotal(json.total) }
      else toast.error(json.error ?? "Failed to load attendance records.")
    } catch { toast.error("Network error.") }
    finally { setIsFetching(false) }
  }, [page, debouncedSearch, statusFilter, typeFilter, dateRange])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // Stats from a small sample
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const r1 = await fetch("/api/hr/attendance?page=1&pageSize=1", { cache:"no-store" })
        const j1 = await r1.json()
        if (!j1.success) return
        const r2 = await fetch("/api/hr/attendance?page=1&pageSize=200", { cache:"no-store" })
        const j2 = await r2.json()
        if (!j2.success) return
        const all: AttendanceRecord[] = j2.data
        setStats({
          total:    j1.total,
          active:   all.filter(r => ["active","success"].includes((r.Status??"").toLowerCase())).length,
          inactive: all.filter(r => ["inactive","failed"].includes((r.Status??"").toLowerCase())).length,
          timeIn:   all.filter(r => (r.Type??"").toLowerCase() === "time-in").length,
          timeOut:  all.filter(r => (r.Type??"").toLowerCase() === "time-out").length,
        })
      } catch {}
    }
    fetchStats()
  }, [])

  // AI Analyze — fetches ALL records matching current filters
  const handleAnalyze = async () => {
    if (total === 0) { toast.error("No records to analyze"); return }
    setIsAnalyzing(true); setInsightsOpen(true); setAnalysis(null)
    try {
      const params = new URLSearchParams({ page:"1", pageSize:"9999" })
      if (debouncedSearch)        params.set("search",   debouncedSearch)
      if (statusFilter !== "all") params.set("status",   statusFilter)
      if (typeFilter   !== "all") params.set("type",     typeFilter)
      if (dateRange?.from)        params.set("dateFrom", dateRange.from.toISOString())
      if (dateRange?.to) {
        const end = new Date(dateRange.to); end.setHours(23,59,59,999)
        params.set("dateTo", end.toISOString())
      }
      const allRes  = await fetch(`/api/hr/attendance?${params}`, { cache:"no-store" })
      const allJson = await allRes.json()
      const allRecords = allJson.success ? (allJson.data ?? []) : records

      const res  = await fetch("/api/hr/attendance/analyze", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ records: allRecords }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Analysis failed")
      setAnalysis(json.analysis)
      setAnalyzedCount(allRecords.length)
    } catch (err: any) {
      toast.error(err.message ?? "AI analysis failed")
      setInsightsOpen(false) 
    } finally { setIsAnalyzing(false) }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startRow   = total === 0 ? 0 : (page-1)*PAGE_SIZE + 1
  const endRow     = Math.min(page*PAGE_SIZE, total)

  const dateLabel = (() => {
    if (!dateRange?.from) return "Pick date range"
    const fmt = (d: Date) => d.toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" })
    if (!dateRange.to) return fmt(dateRange.from)
    return `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`
  })()

  const handleExport = () => {
    const headers = ["Reference ID","Email","Type","Status","Location","Latitude","Longitude","Date Created"]
    const rows = records.map(r =>
      [r.ReferenceID, r.Email, r.Type, r.Status, r.Location??"", r.Latitude??"", r.Longitude??"", r.date_created??""]
        .map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")
    )
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type:"text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `attendance_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(a.href)
    toast.success("Exported successfully.")
  }

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden"
          style={{ backgroundColor: C.bg, fontFamily: C.font, color: C.text }}>

          <div className="fixed inset-0 pointer-events-none" style={{
            backgroundImage:`radial-gradient(circle, #1a2535 1px, transparent 1px)`,
            backgroundSize:"24px 24px", opacity:0.15, zIndex:0,
          }} />

          {/* Header */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b"
            style={{ backgroundColor:C.bg, borderColor:C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color:C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor:C.border }} />
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest rounded-none hover:bg-transparent"
              style={{ color:C.dim }}>Home</Button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor:C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color:C.dim }}>HR</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color:C.muted }} />
                <BreadcrumbItem><BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color:C.accent }}>Attendance</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              {isFetching && <Loader2 className="size-3 animate-spin" style={{ color:C.accent }} />}
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color:C.dim }}>Live</span>
            </div>
          </header>

          {/* Title bar */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b"
            style={{ borderColor:C.border, backgroundColor:C.panel }}>
            <div className="flex h-8 w-8 items-center justify-center border"
              style={{ borderColor:C.border, backgroundColor:"#0f1923" }}>
              <ClipboardList className="size-4" style={{ color:C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color:C.accent }}>Attendance</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color:C.muted }}>HR · Time & Attendance Logs</p>
            </div>
            <div className="ml-auto hidden md:flex items-center gap-3 text-[10px] uppercase tracking-widest">
              <span style={{ color:C.muted }}>{total.toLocaleString()} total records</span>
            </div>
          </div>

          {/* Stats bar */}
          <div className="relative z-10 shrink-0 grid grid-cols-5 border-b" style={{ borderColor:C.border }}>
            {[
              { label:"Total",    value:stats.total,    color:C.text,    icon:Users },
              { label:"Active",   value:stats.active,   color:"#34d399", icon:CheckCircle2 },
              { label:"Inactive", value:stats.inactive, color:"#f87171", icon:XCircle },
              { label:"Time In",  value:stats.timeIn,   color:"#60a5fa", icon:Clock },
              { label:"Time Out", value:stats.timeOut,  color:"#a78bfa", icon:MapPin },
            ].map(({ label, value, color, icon:Icon }, i) => (
              <div key={i} className="flex flex-col items-center justify-center py-3 border-r last:border-r-0"
                style={{ borderColor:C.border, backgroundColor:C.panel }}>
                <span className="text-lg font-bold leading-none" style={{ color }}>{value}</span>
                <span className="text-[9px] uppercase tracking-widest mt-1" style={{ color:C.muted }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="relative z-10 shrink-0 flex items-center gap-2 px-4 py-2 border-b flex-wrap"
            style={{ borderColor:C.border, backgroundColor:C.bg }}>
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color:C.dim }} />
              <input placeholder="Search ref ID, email, type…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                style={{ backgroundColor:C.panel, border:`1px solid ${C.border}`, color:C.text, fontFamily:C.font }}
                onFocus={e => (e.currentTarget.style.borderColor=C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor=C.border)} />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-3" style={{ color:C.dim }} /></button>}
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor:C.panel, border:`1px solid ${C.border}`, color:C.text, fontFamily:C.font }}>
              <option value="all">All Status</option>
              <option value="Active">Active</option><option value="Inactive">Inactive</option>
              <option value="Success">Success</option><option value="Failed">Failed</option>
              <option value="Pending">Pending</option>
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor:C.panel, border:`1px solid ${C.border}`, color:C.text, fontFamily:C.font }}>
              <option value="all">All Types</option>
              <option value="Time-In">Time In</option><option value="Time-Out">Time Out</option>
              <option value="Site-Visit">Site Visit</option><option value="Client-Visit">Client Visit</option>
            </select>
            <div className="flex items-center gap-1">
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 h-8 px-3 text-[11px] border transition-colors"
                    style={{ backgroundColor:C.panel, borderColor:calOpen?C.accent:(dateRange?C.accent:C.border), color:dateRange?C.text:C.dim }}>
                    <CalendarRange className="size-3 shrink-0" style={{ color:dateRange?C.accent:C.dim }} />
                    <span>{dateLabel}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0 border"
                  style={{ backgroundColor:C.panel, borderColor:C.border, fontFamily:C.font }}>
                  <style>{`.att-cal{color:${C.text};background:${C.panel}}.att-cal .rdp-month_caption,.att-cal .rdp-caption_label{color:${C.accent};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.att-cal .rdp-weekday{color:${C.dim};font-size:10px}.att-cal .rdp-day_button{color:${C.text};font-size:11px;border-radius:0}.att-cal .rdp-day_button:hover{background:rgba(232,99,10,.15)!important;color:${C.accent}!important}.att-cal [data-selected-single=true] .rdp-day_button,.att-cal [data-range-start=true] .rdp-day_button,.att-cal [data-range-end=true] .rdp-day_button{background:${C.accent}!important;color:#080d12!important;font-weight:700}.att-cal [data-range-middle=true] .rdp-day_button{background:rgba(232,99,10,.18)!important;color:${C.accent}!important;border-radius:0!important}.att-cal .rdp-today .rdp-day_button{border:1px solid ${C.accent};color:${C.accent}}.att-cal button[class*="button_previous"],.att-cal button[class*="button_next"]{color:${C.dim};background:transparent;border:1px solid ${C.border};border-radius:0}.att-cal button[class*="button_previous"]:hover,.att-cal button[class*="button_next"]:hover{border-color:${C.accent};color:${C.accent}}`}</style>
                  <Calendar mode="range" selected={dateRange}
                    onSelect={r => { setDateRange(r); if (r?.from && r?.to) setCalOpen(false) }}
                    numberOfMonths={2} initialFocus className="att-cal p-3" />
                </PopoverContent>
              </Popover>
              {dateRange && <button onClick={() => setDateRange(undefined)} title="Clear"><X className="size-3" style={{ color:C.dim }} /></button>}
            </div>
            <div className="flex-1" />
            <button onClick={() => fetchRecords(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ backgroundColor:"transparent", borderColor:C.border, color:C.dim }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.dim }}>
              <RefreshCw className="size-3" /> Refresh
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ backgroundColor:"transparent", borderColor:C.border, color:C.dim }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.dim }}>
              <Download className="size-3" /> Export
            </button>
            {/* AI Insights button */}
            <button onClick={handleAnalyze} disabled={isAnalyzing || total === 0}
              className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
              style={{ backgroundColor:insightsOpen?"rgba(167,139,250,0.15)":"transparent", borderColor:insightsOpen?"#a78bfa":C.border, color:insightsOpen?"#a78bfa":C.dim }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="#a78bfa"; e.currentTarget.style.color="#a78bfa" }}
              onMouseLeave={e => { if (!insightsOpen) { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.dim } }}>
              {isAnalyzing ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              AI Insights
            </button>
          </div>

          {/* Table + AI Insights */}
          <div className="relative z-10 flex flex-1 overflow-hidden">

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {isFetching ? (
                <div className="flex items-center justify-center h-full gap-3">
                  <Loader2 className="size-4 animate-spin" style={{ color:C.accent }} />
                  <span className="text-xs uppercase tracking-widest" style={{ color:C.muted }}>Loading records…</span>
                </div>
              ) : (
                <table className="w-full border-collapse" style={{ fontSize:"11px", fontFamily:C.font }}>
                  <thead className="sticky top-0 z-10">
                    <tr style={{ backgroundColor:C.panel, borderBottom:`1px solid ${C.border}` }}>
                      {["Reference ID","Email","Type","Status","Location","Latitude","Longitude","Photo","Date Created"].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 whitespace-nowrap font-bold uppercase tracking-widest"
                          style={{ color:C.accent, fontSize:"9px", borderRight:`1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-16" style={{ color:C.muted }}>No attendance records match your filters.</td></tr>
                    ) : records.map((r, i) => (
                      <tr key={r._id}
                        style={{ backgroundColor:i%2===0?C.bg:C.panel, borderBottom:`1px solid ${C.border}` }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor="rgba(232,99,10,0.04)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor=i%2===0?C.bg:C.panel)}>
                        <td className="px-3 py-2 whitespace-nowrap font-bold" style={{ borderRight:`1px solid ${C.border}`, color:C.accent }}>{cell(r.ReferenceID)}</td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight:`1px solid ${C.border}`, color:C.dim }}>{cell(r.Email)}</td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight:`1px solid ${C.border}` }}>
                          {r.Type ? <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getBadge(TYPE_STYLES,r.Type)}`}>{r.Type}</span> : <span style={{ color:C.muted }}>—</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight:`1px solid ${C.border}` }}>
                          {r.Status ? <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getBadge(STATUS_STYLES,r.Status)}`}>{r.Status}</span> : <span style={{ color:C.muted }}>—</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap max-w-[160px] truncate" style={{ borderRight:`1px solid ${C.border}`, color:C.dim }}>{cell(r.Location)}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono" style={{ borderRight:`1px solid ${C.border}`, color:C.muted }}>{r.Latitude!=null?r.Latitude.toFixed(6):"—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono" style={{ borderRight:`1px solid ${C.border}`, color:C.muted }}>{r.Longitude!=null?r.Longitude.toFixed(6):"—"}</td>
                        <td className="px-3 py-2" style={{ borderRight:`1px solid ${C.border}` }}>
                          {r.PhotoURL ? (
                            <a href={r.PhotoURL} target="_blank" rel="noopener noreferrer">
                              <img src={r.PhotoURL} alt="proof" className="w-8 h-8 object-cover" style={{ border:`1px solid ${C.border}` }} />
                            </a>
                          ) : <span style={{ color:C.muted }}>—</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color:C.muted }}>{formatDate(r.date_created)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* AI Insights Panel */}
            {insightsOpen && (
              <div className="w-80 shrink-0 flex flex-col border-l overflow-hidden"
                style={{ borderColor:"#a78bfa40", backgroundColor:C.panel }}>
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor:"#a78bfa30", backgroundColor:"#0d0f1a" }}>
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-3.5" style={{ color:"#a78bfa" }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color:"#a78bfa" }}>AI Insights</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleAnalyze} disabled={isAnalyzing} title="Re-analyze"
                      className="h-5 w-5 flex items-center justify-center border transition-colors disabled:opacity-40"
                      style={{ borderColor:"#a78bfa40", color:"#a78bfa", backgroundColor:"transparent" }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor="rgba(167,139,250,0.1)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor="transparent")}>
                      <RefreshCw className="size-2.5" />
                    </button>
                    <button onClick={() => setInsightsOpen(false)}
                      className="h-5 w-5 flex items-center justify-center border transition-colors"
                      style={{ borderColor:C.border, color:C.dim, backgroundColor:"transparent" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor="#f87171"; e.currentTarget.style.color="#f87171" }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.dim }}>
                      <X className="size-2.5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin"
                          style={{ borderColor:"#a78bfa", borderTopColor:"transparent" }} />
                        <Sparkles className="absolute inset-0 m-auto size-4" style={{ color:"#a78bfa" }} />
                      </div>
                      <p className="text-[10px] uppercase tracking-widest animate-pulse text-center" style={{ color:"#a78bfa" }}>
                        Groq analyzing {total} records…
                      </p>
                    </div>
                  ) : !analysis ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
                      <Sparkles className="size-8 opacity-20" style={{ color:"#a78bfa" }} />
                      <p className="text-[10px]" style={{ color:C.muted }}>No analysis yet</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {/* Overview */}
                      <div className="p-3 border" style={{ borderColor:"#a78bfa30", backgroundColor:"rgba(167,139,250,0.05)" }}>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color:"#a78bfa" }}>Overview</p>
                        <p className="text-[11px] leading-relaxed" style={{ color:C.text }}>{analysis.overview}</p>
                      </div>
                      {/* Metrics */}
                      {analysis.metrics && Object.keys(analysis.metrics).length > 0 && (
                        <div className="border" style={{ borderColor:C.border }}>
                          <div className="px-3 py-2 border-b" style={{ borderColor:C.border, backgroundColor:C.bg }}>
                            <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color:C.accent }}>
                              <BarChart3 className="size-3" /> Metrics
                            </p>
                          </div>
                          <div className="divide-y" style={{ borderColor:C.muted+"30" }}>
                            {Object.entries(analysis.metrics).filter(([,v])=>v).map(([k,v]) => (
                              <div key={k} className="flex items-center justify-between px-3 py-1.5">
                                <span className="text-[10px] capitalize" style={{ color:C.dim }}>{k.replace(/([A-Z])/g,' $1').trim()}</span>
                                <span className="text-[10px] font-bold" style={{ color:C.text }}>{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Problems */}
                      {(analysis.problems?.length??0) > 0 && (
                        <div className="border" style={{ borderColor:"#f8717130" }}>
                          <button onClick={() => setExpandedSection(s => s==="problems"?null:"problems")}
                            className="w-full flex items-center justify-between px-3 py-2 border-b"
                            style={{ borderColor:"#f8717130", backgroundColor:"rgba(248,113,113,0.05)" }}>
                            <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color:"#f87171" }}>
                              <AlertTriangle className="size-3" /> Problems ({analysis.problems.length})
                            </p>
                            {expandedSection==="problems" ? <ChevronUp className="size-3" style={{ color:"#f87171" }}/> : <ChevronDown className="size-3" style={{ color:"#f87171" }}/>}
                          </button>
                          {expandedSection==="problems" && (
                            <div className="divide-y" style={{ borderColor:C.muted+"20" }}>
                              {analysis.problems.map((p,i) => {
                                const sev = SEVERITY_STYLE[p.severity] ?? SEVERITY_STYLE.medium
                                return (
                                  <div key={i} className="px-3 py-2.5">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                                        style={{ borderColor:sev.color+"40", color:sev.color, backgroundColor:sev.bg }}>{p.severity}</span>
                                      {p.count && <span className="text-[9px]" style={{ color:C.muted }}>×{p.count}</span>}
                                    </div>
                                    <p className="text-[10px] font-bold" style={{ color:C.text }}>{p.title}</p>
                                    <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color:C.dim }}>{p.description}</p>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Patterns */}
                      {(analysis.patterns?.length??0) > 0 && (
                        <div className="border" style={{ borderColor:"#60a5fa30" }}>
                          <button onClick={() => setExpandedSection(s => s==="patterns"?null:"patterns")}
                            className="w-full flex items-center justify-between px-3 py-2 border-b"
                            style={{ borderColor:"#60a5fa30", backgroundColor:"rgba(96,165,250,0.05)" }}>
                            <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color:"#60a5fa" }}>
                              <TrendingUp className="size-3" /> Patterns ({analysis.patterns.length})
                            </p>
                            {expandedSection==="patterns" ? <ChevronUp className="size-3" style={{ color:"#60a5fa" }}/> : <ChevronDown className="size-3" style={{ color:"#60a5fa" }}/>}
                          </button>
                          {expandedSection==="patterns" && (
                            <div className="divide-y" style={{ borderColor:C.muted+"20" }}>
                              {analysis.patterns.map((p,i) => (
                                <div key={i} className="px-3 py-2.5">
                                  <p className="text-[10px] font-bold" style={{ color:C.text }}>{p.title}</p>
                                  <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color:C.dim }}>{p.description}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Recommendations */}
                      {(analysis.recommendations?.length??0) > 0 && (
                        <div className="border" style={{ borderColor:"#34d39930" }}>
                          <button onClick={() => setExpandedSection(s => s==="recs"?null:"recs")}
                            className="w-full flex items-center justify-between px-3 py-2 border-b"
                            style={{ borderColor:"#34d39930", backgroundColor:"rgba(52,211,153,0.05)" }}>
                            <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color:"#34d399" }}>
                              <Lightbulb className="size-3" /> Recommendations ({analysis.recommendations.length})
                            </p>
                            {expandedSection==="recs" ? <ChevronUp className="size-3" style={{ color:"#34d399" }}/> : <ChevronDown className="size-3" style={{ color:"#34d399" }}/>}
                          </button>
                          {expandedSection==="recs" && (
                            <div className="divide-y" style={{ borderColor:C.muted+"20" }}>
                              {analysis.recommendations.map((r,i) => {
                                const pc = PRIORITY_COLOR[r.priority] ?? "#60a5fa"
                                return (
                                  <div key={i} className="px-3 py-2.5">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                                        style={{ borderColor:pc+"40", color:pc, backgroundColor:pc+"10" }}>{r.priority}</span>
                                    </div>
                                    <p className="text-[10px] font-bold" style={{ color:C.text }}>{r.title}</p>
                                    <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color:C.dim }}>{r.description}</p>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-[9px] text-center pb-2" style={{ color:C.muted }}>
                        Groq · llama-3.3-70b · {analyzedCount} records analyzed
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>{/* end flex row */}

          {/* Footer / Pagination */}
          <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-2 border-t"
            style={{ borderColor:C.border, backgroundColor:C.panel }}>
            <span className="text-[10px]" style={{ color:C.muted }}>
              Showing <span style={{ color:C.text }}>{startRow}–{endRow}</span> of <span style={{ color:C.text }}>{total}</span> records
            </span>
            <div className="flex items-center gap-1" style={{ fontSize:"11px" }}>
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                style={{ backgroundColor:"transparent", borderColor:C.border, color:C.dim }}
                onMouseEnter={e => { if(page>1){e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent} }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim }}>
                <ChevronLeft className="size-3" /> Prev
              </button>
              {Array.from({length:Math.min(totalPages,7)},(_,i) => {
                let p: number
                if(totalPages<=7) p=i+1
                else if(page<=4) p=i+1
                else if(page>=totalPages-3) p=totalPages-6+i
                else p=page-3+i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="h-7 w-7 border text-[10px] font-bold transition-colors"
                    style={{ backgroundColor:p===page?C.accent:"transparent", borderColor:p===page?C.accent:C.border, color:p===page?"#080d12":C.dim }}>
                    {p}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                style={{ backgroundColor:"transparent", borderColor:C.border, color:C.dim }}
                onMouseEnter={e => { if(page<totalPages){e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent} }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dim }}>
                Next <ChevronRight className="size-3" />
              </button>
            </div>
          </div>

        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  )
}
