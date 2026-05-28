"use client"
import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { UserProvider, useUser } from "@/contexts/UserContext"
import { FormatProvider } from "@/contexts/FormatContext"
import { DashboardDataProvider } from "@/contexts/DashboardDataContext"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import {
  Sparkles, RefreshCw, Loader2, AlertTriangle, CheckCircle2,
  Info, TrendingUp, TrendingDown, Minus, Shield, Zap,
  TicketCheck, Users, BarChart3, ChevronDown, ChevronUp,
  Clock, Target, Activity,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
interface KPI {
  label: string; value: string; trend: "up"|"down"|"stable";
  status: "good"|"warning"|"critical"; description: string;
}
interface Insight {
  category: string; title: string; detail: string;
  severity: "info"|"warning"|"critical"; icon: string;
}
interface Strategy {
  title: string; description: string;
  impact: "high"|"medium"|"low"; timeframe: string; department: string;
}
interface AuditFinding {
  finding: string; risk: "high"|"medium"|"low"; recommendation: string;
}
interface PerformanceMetric { score: number; label: string; }
interface Alert { message: string; severity: "critical"|"warning"|"info"; source: string; }
interface DashboardAnalysis {
  executiveSummary: string;
  overallHealthScore: number;
  healthLabel: string;
  kpis: KPI[];
  insights: Insight[];
  strategies: Strategy[];
  auditFindings: AuditFinding[];
  performanceMetrics: {
    itSupport: PerformanceMetric;
    hrCompliance: PerformanceMetric;
    salesHealth: PerformanceMetric;
    systemSecurity: PerformanceMetric;
  };
  alerts: Alert[];
}

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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatusDot({ active = true }: { active?: boolean }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${active ? "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]" : "bg-slate-600"}`} />
}

function healthColor(score: number) {
  if (score >= 80) return "#34d399"
  if (score >= 60) return "#fbbf24"
  if (score >= 40) return "#fb923c"
  return "#f87171"
}

function severityStyle(s: string) {
  if (s === "critical") return { color:"#f87171", bg:"rgba(248,113,113,0.1)", border:"#f8717140" }
  if (s === "warning")  return { color:"#fbbf24", bg:"rgba(251,191,36,0.1)",  border:"#fbbf2440" }
  return                       { color:"#60a5fa", bg:"rgba(96,165,250,0.1)",  border:"#60a5fa40" }
}

function impactStyle(i: string) {
  if (i === "high")   return "#f87171"
  if (i === "medium") return "#fbbf24"
  return "#34d399"
}

function trendIcon(t: string) {
  if (t === "up")   return <TrendingUp className="size-3" style={{ color:"#34d399" }} />
  if (t === "down") return <TrendingDown className="size-3" style={{ color:"#f87171" }} />
  return <Minus className="size-3" style={{ color:"#60a5fa" }} />
}

function statusColor(s: string) {
  if (s === "good")     return "#34d399"
  if (s === "warning")  return "#fbbf24"
  if (s === "critical") return "#f87171"
  return C.dim
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: C.muted }}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, score)}%`, backgroundColor: color }} />
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, color = C.accent, children }: {
  title: string; icon: any; color?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border" style={{ borderColor: C.border, backgroundColor: C.panel }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: C.border, backgroundColor: C.bg }}>
        <div className="flex items-center gap-2">
          <Icon className="size-3.5" style={{ color }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color, fontFamily: C.font }}>{title}</span>
        </div>
        {open ? <ChevronUp className="size-3" style={{ color: C.dim }} /> : <ChevronDown className="size-3" style={{ color: C.dim }} />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}

// ─── Dashboard content ────────────────────────────────────────────────────────
function DashboardContent() {
  const searchParams = useSearchParams()
  const { userId, setUserId } = useUser()
  const queryUserId = searchParams?.get("id") ?? ""

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId)
  }, [queryUserId, userId, setUserId])

  const [analysis,     setAnalysis]     = useState<DashboardAnalysis | null>(null)
  const [isLoading,    setIsLoading]    = useState(false)
  const [generatedAt,  setGeneratedAt]  = useState<string | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [autoLoaded,   setAutoLoaded]   = useState(false)

  // Date range — default: today
  const todayStr = new Date().toISOString().split("T")[0]
  const [dateFrom, setDateFrom] = useState(todayStr)
  const [dateTo,   setDateTo]   = useState(todayStr)

  const STORAGE_KEY = "ai_dashboard_cache"

  // Load from localStorage on mount
  useEffect(() => {
    if (autoLoaded) return
    setAutoLoaded(true)
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const { analysis: a, generatedAt: g, dateFrom: df, dateTo: dt } = JSON.parse(cached)
        if (a && g) {
          setAnalysis(a)
          setGeneratedAt(g)
          if (df) setDateFrom(df)
          if (dt) setDateTo(dt)
          return // Use cache, don't auto-fetch
        }
      }
    } catch {}
    // No valid cache — fetch fresh
    fetchInsights()
  }, [autoLoaded])

  const fetchInsights = async (from?: string, to?: string) => {
    const df = from ?? dateFrom
    const dt = to   ?? dateTo
    setIsLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ dateFrom: df, dateTo: dt })
      const res  = await fetch(`/api/dashboard/ai-insights?${params}`, { cache: "no-store" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Analysis failed")
      setAnalysis(json.analysis)
      setGeneratedAt(json.generatedAt)
      // Save to localStorage — replace previous (only 1 entry kept)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          analysis: json.analysis,
          generatedAt: json.generatedAt,
          dateFrom: df,
          dateTo: dt,
        }))
      } catch {}
    } catch (err: any) {
      setError(err.message ?? "Failed to generate insights")
    } finally {
      setIsLoading(false)
    }
  }

  const hScore = analysis?.overallHealthScore ?? 0
  const hColor = healthColor(hScore)

  return (
    <ProtectedPageWrapper>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-svh overflow-hidden"
        style={{ backgroundColor: C.bg, fontFamily: C.font, color: C.text }}>

        {/* Dot-grid */}
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
          backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
        }} />

        {/* ── Header ── */}
        <header className="relative z-10 flex h-11 shrink-0 items-center justify-between border-b"
          style={{ backgroundColor: C.bg, borderColor: C.border }}>
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <Separator orientation="vertical" className="h-4" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#" className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.dim }}>Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] font-mono tracking-widest uppercase font-bold" style={{ color: C.accent }}>Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-3 px-4">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest" style={{ color: C.dim }}>
              <StatusDot /><span style={{ color: "#e8630a80" }}>Live</span>
            </div>
            <NotificationBell />
          </div>
        </header>

        {/* ── Title bar ── */}
        <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: C.border, backgroundColor: C.panel }}>
          <div className="flex h-8 w-8 items-center justify-center border"
            style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
            <Sparkles className="size-4" style={{ color: C.accent }} />
          </div>
          <div>
            <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>AI Command Center</h1>
            <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
              {generatedAt
                ? `Generated: ${new Date(generatedAt).toLocaleString("en-PH", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", hour12:true })}`
                : "Powered by Groq · llama-3.3-70b"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {analysis && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 border"
                style={{ borderColor: hColor + "40", backgroundColor: hColor + "10" }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: hColor }}>
                  {analysis.healthLabel}
                </span>
                <span className="text-lg font-bold" style={{ color: hColor }}>{hScore}</span>
                <span className="text-[9px]" style={{ color: C.muted }}>/100</span>
              </div>
            )}
            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="h-7 px-2 text-[10px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
              />
              <span className="text-[10px]" style={{ color: C.muted }}>–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="h-7 px-2 text-[10px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
              />
              <button onClick={() => { const t = new Date().toISOString().split("T")[0]; setDateFrom(t); setDateTo(t); }}
                className="h-7 px-2 text-[9px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                Today
              </button>
            </div>
            <button onClick={() => fetchInsights(dateFrom, dateTo)} disabled={isLoading}
              className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
              style={{ backgroundColor: "rgba(232,99,10,0.1)", borderColor: C.accent, color: C.accent }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)"; }}>
              {isLoading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              {isLoading ? "Analyzing…" : "Refresh AI"}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Loading state */}
          {isLoading && !analysis && (
            <div className="flex flex-col items-center justify-center py-20 gap-5">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: C.accent, borderTopColor: "transparent" }} />
                <Sparkles className="absolute inset-0 m-auto size-6" style={{ color: C.accent }} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest animate-pulse" style={{ color: C.accent }}>
                  Groq is analyzing your systems…
                </p>
                <p className="text-[10px]" style={{ color: C.muted }}>
                  Tickets · Sales History · Customers · Attendance · Audit Logs
                </p>
                <p className="text-[10px]" style={{ color: C.muted }}>
                  Period: {dateFrom} → {dateTo} · Batching all records…
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertTriangle className="size-8" style={{ color: "#f87171" }} />
              <p className="text-[11px] uppercase tracking-widest" style={{ color: "#f87171" }}>{error}</p>
              <button onClick={() => fetchInsights()}
                className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}>
                <RefreshCw className="size-3" /> Retry
              </button>
            </div>
          )}

          {/* Dashboard content */}
          {analysis && (
            <div className="space-y-4 max-w-6xl mx-auto">

              {/* Alerts bar */}
              {(analysis.alerts?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  {analysis.alerts.map((a, i) => {
                    const s = severityStyle(a.severity)
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 border"
                        style={{ borderColor: s.border, backgroundColor: s.bg }}>
                        <AlertTriangle className="size-3.5 shrink-0" style={{ color: s.color }} />
                        <span className="text-[11px] font-bold flex-1" style={{ color: s.color }}>{a.message}</span>
                        <span className="text-[9px] uppercase tracking-wider" style={{ color: s.color + "80" }}>{a.source}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Executive Summary */}
              <div className="p-4 border" style={{ borderColor: "#a78bfa40", backgroundColor: "rgba(167,139,250,0.05)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="size-3.5" style={{ color: "#a78bfa" }} />
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#a78bfa" }}>Executive Summary</span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: C.text }}>{analysis.executiveSummary}</p>
              </div>

              {/* KPIs */}
              <Section title="Key Performance Indicators" icon={BarChart3} color="#60a5fa">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {(analysis.kpis ?? []).map((kpi, i) => (
                    <div key={i} className="p-3 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] uppercase tracking-wider" style={{ color: C.muted }}>{kpi.label}</span>
                        {trendIcon(kpi.trend)}
                      </div>
                      <p className="text-xl font-bold" style={{ color: statusColor(kpi.status) }}>{kpi.value}</p>
                      <p className="text-[10px] mt-1" style={{ color: C.dim }}>{kpi.description}</p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Performance Scores */}
              {analysis.performanceMetrics && (
                <Section title="Performance Scores" icon={Activity} color="#34d399">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(analysis.performanceMetrics).map(([key, metric]) => {
                      const m = metric as PerformanceMetric
                      const c = healthColor(m.score)
                      const label = key.replace(/([A-Z])/g,' $1').trim()
                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider capitalize" style={{ color: C.dim }}>{label}</span>
                            <span className="text-[11px] font-bold" style={{ color: c }}>{m.score}</span>
                          </div>
                          <ScoreBar score={m.score} color={c} />
                          <p className="text-[10px]" style={{ color: C.muted }}>{m.label}</p>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* Insights + Strategies side by side on large screens */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Insights */}
                <Section title="AI Insights" icon={Sparkles} color="#a78bfa">
                  <div className="space-y-3">
                    {(analysis.insights ?? []).map((ins, i) => {
                      const s = severityStyle(ins.severity)
                      return (
                        <div key={i} className="p-3 border" style={{ borderColor: s.border, backgroundColor: s.bg }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                              style={{ borderColor: s.border, color: s.color }}>{ins.category}</span>
                          </div>
                          <p className="text-[11px] font-bold" style={{ color: C.text }}>{ins.title}</p>
                          <p className="text-[10px] mt-1 leading-relaxed" style={{ color: C.dim }}>{ins.detail}</p>
                        </div>
                      )
                    })}
                  </div>
                </Section>

                {/* Strategies */}
                <Section title="Strategic Recommendations" icon={Target} color="#34d399">
                  <div className="space-y-3">
                    {(analysis.strategies ?? []).map((s, i) => {
                      const ic = impactStyle(s.impact)
                      return (
                        <div key={i} className="p-3 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                              style={{ borderColor: ic+"40", color: ic, backgroundColor: ic+"10" }}>{s.impact} impact</span>
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                              style={{ borderColor: C.border, color: C.dim }}>{s.timeframe}</span>
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                              style={{ borderColor: "#60a5fa40", color: "#60a5fa" }}>{s.department}</span>
                          </div>
                          <p className="text-[11px] font-bold" style={{ color: C.text }}>{s.title}</p>
                          <p className="text-[10px] mt-1 leading-relaxed" style={{ color: C.dim }}>{s.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              </div>

              {/* Audit Findings */}
              {(analysis.auditFindings?.length ?? 0) > 0 && (
                <Section title="Audit Findings" icon={Shield} color="#fbbf24">
                  <div className="space-y-3">
                    {analysis.auditFindings.map((f, i) => {
                      const rc = f.risk === "high" ? "#f87171" : f.risk === "medium" ? "#fbbf24" : "#34d399"
                      return (
                        <div key={i} className="p-3 border" style={{ borderColor: rc+"40", backgroundColor: rc+"08" }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                              style={{ borderColor: rc+"40", color: rc }}>{f.risk} risk</span>
                          </div>
                          <p className="text-[11px] font-bold" style={{ color: C.text }}>{f.finding}</p>
                          <p className="text-[10px] mt-1" style={{ color: C.dim }}>
                            <span style={{ color: "#34d399" }}>→ </span>{f.recommendation}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* Footer */}
              <p className="text-[9px] text-center pb-4" style={{ color: C.muted }}>
                Generated by Groq · llama-3.3-70b · {new Date(generatedAt!).toLocaleString("en-PH")}
              </p>
            </div>
          )}
        </div>

      </SidebarInset>
    </ProtectedPageWrapper>
  )
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <DashboardDataProvider>
          <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
            <Suspense fallback={
              <div className="flex h-screen items-center justify-center bg-[#080d12] text-orange-400 font-mono text-xs tracking-widest">
                INITIALIZING…
              </div>
            }>
              <DashboardContent />
            </Suspense>
          </SidebarProvider>
        </DashboardDataProvider>
      </FormatProvider>
    </UserProvider>
  )
}
