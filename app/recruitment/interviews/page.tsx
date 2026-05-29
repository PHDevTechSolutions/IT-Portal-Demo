"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, CalendarCheck,
  Mail, MapPin, User, Briefcase, Clock, CheckCircle2,
  XCircle, AlertTriangle, Copy, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import type { Interview } from "@/app/api/recruitment/interviews/route";

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

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(date: string | null, time: string) {
  if (!date) return "—";
  const d = new Date(date);
  const dateStr = d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  return time ? `${dateStr} · ${time}` : dateStr;
}

function statusStyle(status: string) {
  const s = status.toLowerCase();
  if (s === "scheduled")  return { color: "#60a5fa",  border: "#60a5fa40",  bg: "rgba(96,165,250,0.08)",  icon: Clock };
  if (s === "completed")  return { color: "#34d399",  border: "#34d39940",  bg: "rgba(52,211,153,0.08)",  icon: CheckCircle2 };
  if (s === "cancelled")  return { color: "#f87171",  border: "#f8717140",  bg: "rgba(248,113,113,0.08)", icon: XCircle };
  if (s === "no-show")    return { color: "#fbbf24",  border: "#fbbf2440",  bg: "rgba(251,191,36,0.08)",  icon: AlertTriangle };
  return { color: C.dim, border: C.muted, bg: "transparent", icon: Clock };
}

function typeStyle(type: string) {
  if (type === "online")  return { color: "#34d399", label: "Online" };
  if (type === "phone")   return { color: "#fbbf24", label: "Phone" };
  return { color: "#a78bfa", label: "On-site" };
}

const STATUS_OPTIONS = ["scheduled", "completed", "cancelled", "no-show"];
const PAGE_SIZE = 15;

export default function InterviewsPage() {
  const router = useRouter();

  const [interviews,   setInterviews]   = useState<Interview[]>([]);
  const [filtered,     setFiltered]     = useState<Interview[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page,         setPage]         = useState(1);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // Status update
  const [updatingId,  setUpdatingId]  = useState<string | null>(null);

  const fetchInterviews = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/recruitment/interviews", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setInterviews(json.data ?? []);
    } catch (err: any) {
      toast.error("Failed to load interviews: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInterviews(); }, [fetchInterviews]);

  useEffect(() => {
    let r = [...interviews];
    if (statusFilter) r = r.filter(i => i.status.toLowerCase() === statusFilter.toLowerCase());
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(i =>
        i.applicantName.toLowerCase().includes(q) ||
        i.jobTitle.toLowerCase().includes(q) ||
        i.applicantEmail.toLowerCase().includes(q) ||
        i.interviewerName.toLowerCase().includes(q)
      );
    }
    setFiltered(r);
    setPage(1);
  }, [interviews, search, statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      const res  = await fetch("/api/recruitment/interviews/update", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`Status updated to ${status}`);
      fetchInterviews();
    } catch (err: any) {
      toast.error(err.message ?? "Update failed");
    } finally {
      setUpdatingId(null);
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Exam link copied");
  };

  const totalPages     = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const scheduledCount = interviews.filter(i => i.status === "scheduled").length;
  const completedCount = interviews.filter(i => i.status === "completed").length;
  const cancelledCount = interviews.filter(i => i.status === "cancelled").length;
  const noShowCount    = interviews.filter(i => i.status === "no-show").length;

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden bg-[#080d12]" style={{ fontFamily: C.font, color: C.text }}>
          <div className="fixed inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
            backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
          }} />

          {/* ── Header ── */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b bg-[#080d12]" style={{ borderColor: C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <button onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest"
              style={{ color: C.dim, background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
              Home
            </button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/recruitment/jobs" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Recruitment</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Interviews</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Firebase</span>
            </div>
          </header>

          {/* ── Title bar ── */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <CalendarCheck className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Interviews</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Firebase · interviews · {interviews.length} total
              </p>
            </div>
            <div className="ml-auto">
              <button onClick={fetchInterviews}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                <RefreshCw className="size-3" /> Refresh
              </button>
            </div>
          </div>

          {/* ── Stats bar ── */}
          <div className="relative z-10 shrink-0 grid grid-cols-5 border-b" style={{ borderColor: C.border }}>
            {[
              { label: "Total",     value: interviews.length, color: C.accent },
              { label: "Scheduled", value: scheduledCount,    color: "#60a5fa" },
              { label: "Completed", value: completedCount,    color: "#34d399" },
              { label: "Cancelled", value: cancelledCount,    color: "#f87171" },
              { label: "No-Show",   value: noShowCount,       color: "#fbbf24" },
            ].map((s, i) => (
              <div key={s.label} className="flex flex-col items-center justify-center py-2.5"
                style={{ backgroundColor: C.panel, borderRight: i < 4 ? `1px solid ${C.border}` : "none" }}>
                <span className="text-base font-bold leading-none" style={{ color: s.color }}>{s.value}</span>
                <span className="text-[9px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* ── Toolbar ── */}
          <div className="relative z-10 shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
              <input placeholder="Search applicant, job, interviewer…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-3" style={{ color: C.dim }} /></button>}
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: statusFilter ? C.text : C.dim, fontFamily: C.font }}>
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {statusFilter && (
              <button onClick={() => setStatusFilter("")}
                className="flex items-center gap-1 h-8 px-2 text-[10px] transition-colors" style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                <X className="size-3" /> Clear
              </button>
            )}
            <div className="ml-auto text-[10px]" style={{ color: C.muted }}>
              <span style={{ color: C.text }}>{filtered.length}</span> interviews
            </div>
          </div>

          {/* ── Table ── */}
          <div className="relative z-10 flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full gap-3">
                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                <span className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Loading…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <CalendarCheck className="size-8 opacity-20" style={{ color: C.accent }} />
                <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No interviews scheduled</p>
                <p className="text-[10px]" style={{ color: C.dim }}>Use the "Interview" button on the Applicants page to schedule one</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b sticky top-0 z-10" style={{ borderColor: C.border, backgroundColor: C.panel }}>
                    {["", "Applicant", "Job", "Schedule", "Type", "Interviewer", "Status", "Exam", "Actions"].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
                        style={{ color: C.accent }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((iv, i) => {
                    const st         = statusStyle(iv.status);
                    const tp         = typeStyle(iv.interviewType);
                    const StatusIcon = st.icon;
                    const isExpanded = expandedId === iv.id;
                    return (
                      <React.Fragment key={iv.id}>
                        <tr className="border-b transition-colors"
                          style={{ borderColor: C.muted + "30", backgroundColor: i % 2 === 0 ? C.bg : C.panel }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.03)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>

                          {/* Expand */}
                          <td className="px-3 py-3 cursor-pointer w-8" onClick={() => setExpandedId(isExpanded ? null : iv.id)}>
                            {isExpanded ? <ChevronUp className="size-3" style={{ color: C.accent }} /> : <ChevronDown className="size-3" style={{ color: C.dim }} />}
                          </td>

                          {/* Applicant */}
                          <td className="px-4 py-3">
                            <p className="text-[11px] font-bold" style={{ color: C.text }}>{iv.applicantName || "—"}</p>
                            {iv.applicantEmail && (
                              <p className="text-[9px] font-mono" style={{ color: C.dim }}>{iv.applicantEmail}</p>
                            )}
                          </td>

                          {/* Job */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Briefcase className="size-3 shrink-0" style={{ color: C.dim }} />
                              <span className="text-[10px]" style={{ color: C.dim }}>{iv.jobTitle || "—"}</span>
                            </div>
                          </td>

                          {/* Schedule */}
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-mono whitespace-nowrap" style={{ color: C.text }}>
                              {formatDateTime(iv.scheduledDate, iv.scheduledTime)}
                            </span>
                          </td>

                          {/* Type */}
                          <td className="px-4 py-3">
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 border"
                              style={{ borderColor: tp.color + "40", color: tp.color, backgroundColor: tp.color + "10" }}>
                              {tp.label}
                            </span>
                          </td>

                          {/* Interviewer */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {iv.interviewerName && <User className="size-3 shrink-0" style={{ color: C.dim }} />}
                              <span className="text-[10px]" style={{ color: C.dim }}>{iv.interviewerName || "—"}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 border"
                              style={{ borderColor: st.border, color: st.color, backgroundColor: st.bg }}>
                              <StatusIcon className="size-2.5" />{iv.status}
                            </span>
                          </td>

                          {/* Exam link */}
                          <td className="px-4 py-3">
                            {iv.examEnabled && iv.examLink ? (
                              <div className="flex items-center gap-1.5">
                                <a href={iv.examLink} target="_blank" rel="noopener noreferrer"
                                  className="text-[9px] font-bold uppercase tracking-wider transition-colors"
                                  style={{ color: "#60a5fa" }}
                                  onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                                  onMouseLeave={e => (e.currentTarget.style.color = "#60a5fa")}>
                                  <ExternalLink className="size-3" />
                                </a>
                                <button onClick={() => copyLink(iv.examLink)} title="Copy exam link">
                                  <Copy className="size-3" style={{ color: C.dim }} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[9px]" style={{ color: C.muted }}>—</span>
                            )}
                          </td>

                          {/* Actions — update status */}
                          <td className="px-4 py-3">
                            <select
                              value={iv.status}
                              onChange={e => updateStatus(iv.id, e.target.value)}
                              disabled={updatingId === iv.id}
                              className="h-7 text-[9px] px-1.5 focus:outline-none disabled:opacity-40"
                              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.dim, fontFamily: C.font }}>
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                        </tr>

                        {/* Expanded — location + notes */}
                        {isExpanded && (
                          <tr style={{ backgroundColor: "rgba(232,99,10,0.03)" }}>
                            <td colSpan={9} className="px-8 py-3 border-b" style={{ borderColor: C.muted + "30" }}>
                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: C.accent }}>Location / Link</p>
                                  {iv.location ? (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="size-3 shrink-0" style={{ color: C.dim }} />
                                      <span className="text-[10px]" style={{ color: C.dim }}>{iv.location}</span>
                                    </div>
                                  ) : <p className="text-[10px]" style={{ color: C.muted }}>—</p>}
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: C.accent }}>Notes</p>
                                  <p className="text-[10px] leading-relaxed" style={{ color: C.dim }}>{iv.notes || "—"}</p>
                                </div>
                              </div>
                              {iv.examEnabled && iv.examLink && (
                                <div className="mt-3 pt-3 border-t" style={{ borderColor: C.border }}>
                                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: C.accent }}>Exam Link</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-mono" style={{ color: "#60a5fa" }}>{iv.examLink}</span>
                                    <button onClick={() => copyLink(iv.examLink)}
                                      className="flex items-center gap-1 text-[8px] font-bold uppercase px-2 py-0.5 border transition-colors"
                                      style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                                      <Copy className="size-2.5" /> Copy
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Pagination ── */}
          {filtered.length > PAGE_SIZE && (
            <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-2 border-t" style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <span className="text-[10px]" style={{ color: C.muted }}>
                Page <span style={{ color: C.text }}>{page}</span> of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="h-7 px-3 text-[10px] border transition-colors disabled:opacity-30"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}>← Prev</button>
                <span className="text-[10px] font-mono px-2" style={{ color: C.muted }}>{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="h-7 px-3 text-[10px] border transition-colors disabled:opacity-30"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}>Next →</button>
              </div>
            </div>
          )}
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
