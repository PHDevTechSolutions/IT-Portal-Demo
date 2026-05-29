"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, Users, Mail, Phone,
  Briefcase, ExternalLink, ArrowRightLeft, ChevronDown, ChevronUp,
  FileText, Globe, CheckCircle2, XCircle, Clock, AlertTriangle, CalendarPlus,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import type { Applicant } from "@/app/api/recruitment/applicants/route";

// ─── Design tokens ────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function statusStyle(status: string) {
  const s = status.toLowerCase();
  if (["hired", "accepted", "approved"].includes(s))
    return { color: "#34d399", border: "#34d39940", bg: "rgba(52,211,153,0.08)", icon: CheckCircle2 };
  if (["rejected", "declined", "failed"].includes(s))
    return { color: "#f87171", border: "#f8717140", bg: "rgba(248,113,113,0.08)", icon: XCircle };
  if (["interview", "shortlisted", "reviewing"].includes(s))
    return { color: "#a78bfa", border: "#a78bfa40", bg: "rgba(167,139,250,0.08)", icon: Clock };
  if (["pending", "applied", "new"].includes(s))
    return { color: "#fbbf24", border: "#fbbf2440", bg: "rgba(251,191,36,0.08)", icon: Clock };
  return { color: C.dim, border: C.muted, bg: "transparent", icon: Clock };
}

const PAGE_SIZE = 15;

// ─── SchedField helper ────────────────────────────────────────────────────────
function SchedField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#e8630a80" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-8 px-2 text-[11px] focus:outline-none"
        style={{ backgroundColor: "#080d12", border: "1px solid #1a2535", color: "#c8d8e8", fontFamily: "'JetBrains Mono', monospace" }}
        onFocus={e => (e.currentTarget.style.borderColor = "#e8630a")}
        onBlur={e  => (e.currentTarget.style.borderColor = "#1a2535")} />
    </div>
  );
}

export default function RecruitmentApplicantsPage() {
  const router = useRouter();

  const [applicants,   setApplicants]   = useState<Applicant[]>([]);
  const [filtered,     setFiltered]     = useState<Applicant[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [jobFilter,    setJobFilter]    = useState("");
  const [page,         setPage]         = useState(1);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // Migrate
  const [migrateOpen,   setMigrateOpen]   = useState(false);
  const [migrating,     setMigrating]     = useState(false);
  const [migrateResult, setMigrateResult] = useState<{ migrated: number; total: number; errors?: string[] } | null>(null);

  // Schedule Interview
  const [scheduleApplicant, setScheduleApplicant] = useState<Applicant | null>(null);
  const [schedForm, setSchedForm] = useState({
    scheduledDate:   "",
    scheduledTime:   "09:00",
    interviewType:   "onsite",
    interviewerName: "",
    location:        "",
    notes:           "",
    examEnabled:     false,
    emailSubject:    "",
    emailBody:       "",
  });
  const [scheduling, setScheduling] = useState(false);
  const [schedResult, setSchedResult] = useState<{ examLink: string; emailSent: boolean; emailError?: string } | null>(null);

  const openSchedule = (app: Applicant) => {
    setScheduleApplicant(app);
    setSchedForm({
      scheduledDate:   "",
      scheduledTime:   "09:00",
      interviewType:   "onsite",
      interviewerName: "",
      location:        "",
      notes:           "",
      examEnabled:     false,
      emailSubject:    `Interview Invitation — ${app.jobTitle || "Position"}`,
      emailBody:       `Dear ${app.fullName || "Applicant"},\n\nWe are pleased to inform you that you have been selected for an interview for the ${app.jobTitle || "position"} role at Ecoshift Corporation.\n\nPlease see the interview details below. Kindly confirm your availability by replying to this email.\n\nWe look forward to speaking with you.\n\nBest regards,\nEcoshift HR Team`,
    });
    setSchedResult(null);
  };

  const handleSchedule = async () => {
    if (!scheduleApplicant || !schedForm.scheduledDate) {
      toast.error("Scheduled date is required"); return;
    }
    setScheduling(true);
    try {
      const res  = await fetch("/api/recruitment/interviews/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId:    scheduleApplicant.id,
          applicantName:  scheduleApplicant.fullName,
          applicantEmail: scheduleApplicant.email,
          jobId:          scheduleApplicant.jobId,
          jobTitle:       scheduleApplicant.jobTitle,
          ...schedForm,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`Interview scheduled for ${scheduleApplicant.fullName}`);
      setSchedResult({ examLink: json.examLink, emailSent: json.emailSent, emailError: json.emailError });
      fetchApplicants();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to schedule");
    } finally {
      setScheduling(false);
    }
  };

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchApplicants = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/recruitment/applicants", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setApplicants(json.data ?? []);
    } catch (err: any) {
      toast.error("Failed to load applicants: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApplicants(); }, [fetchApplicants]);

  // ── Client-side filter ───────────────────────────────────────────────────
  useEffect(() => {
    let r = [...applicants];
    if (statusFilter) r = r.filter(a => a.status.toLowerCase() === statusFilter.toLowerCase());
    if (jobFilter)    r = r.filter(a => a.jobTitle.toLowerCase().includes(jobFilter.toLowerCase()));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(a =>
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.jobTitle.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q)
      );
    }
    setFiltered(r);
    setPage(1);
  }, [applicants, search, statusFilter, jobFilter]);

  // ── Migrate ──────────────────────────────────────────────────────────────
  const handleMigrate = async () => {
    setMigrating(true);
    setMigrateResult(null);
    try {
      const res  = await fetch("/api/recruitment/applicants/migrate", {
        method: "POST", headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMigrateResult({ migrated: json.migrated, total: json.total, errors: json.errors });
      toast.success(json.message);
      fetchApplicants();
    } catch (err: any) {
      toast.error(err.message ?? "Migration failed");
    } finally {
      setMigrating(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allStatuses  = [...new Set(applicants.map(a => a.status).filter(Boolean))].sort();
  const allJobTitles = [...new Set(applicants.map(a => a.jobTitle).filter(Boolean))].sort();

  const hiredCount    = applicants.filter(a => ["hired","accepted","approved"].includes(a.status.toLowerCase())).length;
  const rejectedCount = applicants.filter(a => ["rejected","declined","failed"].includes(a.status.toLowerCase())).length;
  const pendingCount  = applicants.filter(a => ["pending","applied","new"].includes(a.status.toLowerCase())).length;
  const interviewCount = applicants.filter(a => ["interview","shortlisted","reviewing"].includes(a.status.toLowerCase())).length;

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
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Applicants</BreadcrumbPage>
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
              <Users className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Applicants</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Firebase · applications · {applicants.length} total
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={fetchApplicants}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                <RefreshCw className="size-3" /> Refresh
              </button>
              <button onClick={() => { setMigrateOpen(true); setMigrateResult(null); }}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: "#60a5fa40", color: "#60a5fa", backgroundColor: "rgba(96,165,250,0.08)" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(96,165,250,0.08)"; }}>
                <ArrowRightLeft className="size-3" /> Migrate
              </button>
            </div>
          </div>

          {/* ── Stats bar ── */}
          <div className="relative z-10 shrink-0 grid grid-cols-5 border-b" style={{ borderColor: C.border }}>
            {[
              { label: "Total",     value: applicants.length,  color: C.accent },
              { label: "Hired",     value: hiredCount,         color: "#34d399" },
              { label: "Interview", value: interviewCount,     color: "#a78bfa" },
              { label: "Pending",   value: pendingCount,       color: "#fbbf24" },
              { label: "Rejected",  value: rejectedCount,      color: "#f87171" },
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
              <input placeholder="Search name, email, job title…" value={search}
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
              {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={jobFilter} onChange={e => setJobFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none max-w-[200px]"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: jobFilter ? C.text : C.dim, fontFamily: C.font }}>
              <option value="">All Jobs</option>
              {allJobTitles.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(statusFilter || jobFilter) && (
              <button onClick={() => { setStatusFilter(""); setJobFilter(""); }}
                className="flex items-center gap-1 h-8 px-2 text-[10px] transition-colors" style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                <X className="size-3" /> Clear
              </button>
            )}
            <div className="ml-auto text-[10px]" style={{ color: C.muted }}>
              <span style={{ color: C.text }}>{filtered.length}</span> applicants
            </div>
          </div>

          {/* ── Table ── */}
          <div className="relative z-10 flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full gap-3">
                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                <span className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Loading from Firebase…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Users className="size-8 opacity-20" style={{ color: C.accent }} />
                <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No applicants found</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b sticky top-0 z-10" style={{ borderColor: C.border, backgroundColor: C.panel }}>
                    {["", "Applicant", "Job Applied", "Contact", "Status", "Resume", "Applied", "", ""].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
                        style={{ color: C.accent }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((app, i) => {
                    const st         = statusStyle(app.status);
                    const StatusIcon = st.icon;
                    const isExpanded = expandedId === app.id;
                    return (
                      <React.Fragment key={app.id}>
                        <tr className="border-b transition-colors"
                          style={{ borderColor: C.muted + "30", backgroundColor: i % 2 === 0 ? C.bg : C.panel }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.03)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>

                          {/* Expand toggle */}
                          <td className="px-3 py-3 cursor-pointer w-8" onClick={() => setExpandedId(isExpanded ? null : app.id)}>
                            {isExpanded
                              ? <ChevronUp className="size-3" style={{ color: C.accent }} />
                              : <ChevronDown className="size-3" style={{ color: C.dim }} />}
                          </td>

                          {/* Applicant */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {app.imageUrl ? (
                                <img src={app.imageUrl} alt={app.fullName}
                                  className="h-7 w-7 rounded-full object-cover shrink-0"
                                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              ) : (
                                <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                                  style={{ backgroundColor: C.muted, color: C.text }}>
                                  {app.fullName?.[0]?.toUpperCase() ?? "?"}
                                </div>
                              )}
                              <div>
                                <p className="text-[11px] font-bold" style={{ color: C.text }}>{app.fullName || "—"}</p>
                                {app.title && <p className="text-[9px]" style={{ color: C.dim }}>{app.title}</p>}
                              </div>
                            </div>
                          </td>

                          {/* Job */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Briefcase className="size-3 shrink-0" style={{ color: C.dim }} />
                              <span className="text-[10px]" style={{ color: C.dim }}>{app.jobTitle || "—"}</span>
                            </div>
                          </td>

                          {/* Contact */}
                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              {app.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="size-2.5 shrink-0" style={{ color: C.dim }} />
                                  <span className="text-[9px] font-mono truncate max-w-[160px]" style={{ color: C.dim }}>{app.email}</span>
                                </div>
                              )}
                              {app.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="size-2.5 shrink-0" style={{ color: C.dim }} />
                                  <span className="text-[9px] font-mono" style={{ color: C.dim }}>{app.phone}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 border"
                              style={{ borderColor: st.border, color: st.color, backgroundColor: st.bg }}>
                              <StatusIcon className="size-2.5" />{app.status || "—"}
                            </span>
                          </td>

                          {/* Resume */}
                          <td className="px-4 py-3">
                            {app.resumeUrl ? (
                              <a href={app.resumeUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors"
                                style={{ color: "#60a5fa" }}
                                onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                                onMouseLeave={e => (e.currentTarget.style.color = "#60a5fa")}>
                                <FileText className="size-3" /> View
                              </a>
                            ) : <span className="text-[9px]" style={{ color: C.muted }}>—</span>}
                          </td>

                          {/* Applied date */}
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-mono whitespace-nowrap" style={{ color: C.muted }}>
                              {formatDate(app.appliedAt)}
                            </span>
                          </td>

                          {/* Website */}
                          <td className="px-4 py-3">
                            {app.website ? (
                              <a href={app.website.startsWith("http") ? app.website : `https://${app.website}`}
                                target="_blank" rel="noopener noreferrer"
                                title={app.website}>
                                <Globe className="size-3" style={{ color: C.dim }} />
                              </a>
                            ) : <span />}
                          </td>
                          {/* For Interview action */}
                          <td className="px-3 py-3">
                            <button
                              onClick={e => { e.stopPropagation(); openSchedule(app); }}
                              title="Schedule Interview"
                              className="flex items-center gap-1 h-6 px-2 text-[8px] font-bold uppercase tracking-wider border transition-colors whitespace-nowrap"
                              style={{ borderColor: "#a78bfa40", color: "#a78bfa", backgroundColor: "rgba(167,139,250,0.08)" }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(167,139,250,0.18)"; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(167,139,250,0.08)"; }}>
                              <CalendarPlus className="size-2.5" /> Interview
                            </button>
                          </td>
                        </tr>

                        {/* Expanded row — description + websites */}
                        {isExpanded && (
                          <tr style={{ backgroundColor: "rgba(232,99,10,0.03)" }}>
                            <td colSpan={9} className="px-8 py-3 border-b" style={{ borderColor: C.muted + "30" }}>
                              <div className="grid grid-cols-2 gap-6">
                                {/* Description */}
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: C.accent }}>Description</p>
                                  {app.description
                                    ? <p className="text-[10px] leading-relaxed" style={{ color: C.dim }}>{app.description}</p>
                                    : <p className="text-[10px]" style={{ color: C.muted }}>No description</p>}
                                </div>
                                {/* Websites */}
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: C.accent }}>Links</p>
                                  {app.websites.length === 0 && !app.website
                                    ? <p className="text-[10px]" style={{ color: C.muted }}>No links</p>
                                    : <div className="space-y-1">
                                        {[app.website, ...app.websites].filter(Boolean).map((url, wi) => (
                                          <a key={wi} href={url.startsWith("http") ? url : `https://${url}`}
                                            target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-[9px] hover:underline truncate"
                                            style={{ color: "#60a5fa" }}>
                                            <ExternalLink className="size-2.5 shrink-0" />{url}
                                          </a>
                                        ))}
                                      </div>}
                                </div>
                              </div>
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

      {/* ── Schedule Interview Dialog ── */}
      {scheduleApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
          onClick={e => { if (e.target === e.currentTarget && !schedResult) setScheduleApplicant(null); }}>
          <div className="w-full max-w-lg border flex flex-col" style={{ backgroundColor: C.panel, borderColor: "#a78bfa40", fontFamily: C.font, maxHeight: "90vh" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <div className="flex items-center gap-2">
                <CalendarPlus className="size-4" style={{ color: "#a78bfa" }} />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#a78bfa" }}>Schedule Interview</p>
                  <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>{scheduleApplicant.fullName} · {scheduleApplicant.jobTitle}</p>
                </div>
              </div>
              {!schedResult && <button onClick={() => setScheduleApplicant(null)}><X className="size-4" style={{ color: C.dim }} /></button>}
            </div>

            {/* Body */}
            {schedResult ? (
              /* Success state */
              <div className="px-5 py-6 space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5" style={{ color: "#34d399" }} />
                  <p className="text-[11px] font-bold" style={{ color: "#34d399" }}>Interview scheduled successfully</p>
                </div>
                {/* Email status */}
                <div className="flex items-center gap-2 px-3 py-2 border" style={{
                  borderColor: schedResult.emailSent ? "#34d39940" : "#fbbf2440",
                  backgroundColor: schedResult.emailSent ? "rgba(52,211,153,0.05)" : "rgba(251,191,36,0.05)",
                }}>
                  <Mail className="size-3.5 shrink-0" style={{ color: schedResult.emailSent ? "#34d399" : "#fbbf24" }} />
                  <div>
                    <p className="text-[10px] font-bold" style={{ color: schedResult.emailSent ? "#34d399" : "#fbbf24" }}>
                      {schedResult.emailSent ? `Email sent to ${scheduleApplicant?.email}` : "Email not sent"}
                    </p>
                    {schedResult.emailError && (
                      <p className="text-[9px]" style={{ color: "#f87171" }}>{schedResult.emailError}</p>
                    )}
                  </div>
                </div>
                {schedResult.examLink && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent + "80" }}>Exam Link (share with applicant)</p>
                    <div className="flex items-center gap-2 px-3 py-2 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                      <span className="text-[10px] font-mono flex-1 truncate" style={{ color: "#60a5fa" }}>{schedResult.examLink}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(schedResult.examLink); toast.success("Link copied"); }}
                        className="text-[9px] font-bold uppercase px-2 py-1 border transition-colors shrink-0"
                        style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
                {/* Date + Time */}
                <div className="grid grid-cols-2 gap-3">
                  <SchedField label="Scheduled Date *" type="date"
                    value={schedForm.scheduledDate} onChange={v => setSchedForm(p => ({ ...p, scheduledDate: v }))} />
                  <SchedField label="Time" type="time"
                    value={schedForm.scheduledTime} onChange={v => setSchedForm(p => ({ ...p, scheduledTime: v }))} />
                </div>

                {/* Type + Interviewer */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Interview Type</label>
                    <select value={schedForm.interviewType} onChange={e => setSchedForm(p => ({ ...p, interviewType: e.target.value }))}
                      className="w-full h-8 px-2 text-[11px] focus:outline-none"
                      style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                      <option value="onsite">On-site</option>
                      <option value="online">Online</option>
                      <option value="phone">Phone</option>
                    </select>
                  </div>
                  <SchedField label="Interviewer Name"
                    value={schedForm.interviewerName} onChange={v => setSchedForm(p => ({ ...p, interviewerName: v }))}
                    placeholder="e.g. HR Manager" />
                </div>

                {/* Location */}
                <SchedField label="Location / Meeting Link"
                  value={schedForm.location} onChange={v => setSchedForm(p => ({ ...p, location: v }))}
                  placeholder="e.g. Office Room 2 or https://meet.google.com/..." />

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Notes</label>
                  <textarea value={schedForm.notes} onChange={e => setSchedForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Additional instructions for the applicant…" rows={3}
                    className="w-full px-2 py-1.5 text-[10px] focus:outline-none resize-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                </div>

                {/* Exam toggle */}
                <div className="flex items-center gap-3 px-3 py-2.5 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                  <input type="checkbox" id="examEnabled" checked={schedForm.examEnabled}
                    onChange={e => setSchedForm(p => ({ ...p, examEnabled: e.target.checked }))}
                    className="accent-orange-500 h-3.5 w-3.5" />
                  <div>
                    <label htmlFor="examEnabled" className="text-[10px] font-bold cursor-pointer" style={{ color: C.text }}>
                      Include Exam Link
                    </label>
                    <p className="text-[9px]" style={{ color: C.muted }}>Generate a unique exam link to send to the applicant</p>
                  </div>
                </div>

                {/* ── Email Compose ── */}
                <div className="border-t pt-3 space-y-3" style={{ borderColor: C.border }}>
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5" style={{ color: C.accent }} />
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                      Email Notification
                    </p>
                    <span className="text-[8px] px-1.5 py-0.5 border" style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "rgba(52,211,153,0.08)" }}>
                      Auto-send via Resend
                    </span>
                  </div>
                  {/* To (read-only) */}
                  <div className="flex items-center gap-2 h-7 px-2 border" style={{ borderColor: C.muted, backgroundColor: C.bg }}>
                    <span className="text-[9px] uppercase tracking-widest shrink-0" style={{ color: C.accent + "80" }}>To</span>
                    <span className="text-[10px] font-mono truncate" style={{ color: C.dim }}>
                      {scheduleApplicant?.email || "No email address"}
                    </span>
                  </div>
                  {/* Subject */}
                  <SchedField label="Subject"
                    value={schedForm.emailSubject}
                    onChange={v => setSchedForm(p => ({ ...p, emailSubject: v }))}
                    placeholder="Email subject…" />
                  {/* Body */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Message</label>
                    <textarea
                      value={schedForm.emailBody}
                      onChange={e => setSchedForm(p => ({ ...p, emailBody: e.target.value }))}
                      rows={5}
                      className="w-full px-2 py-1.5 text-[10px] focus:outline-none resize-none"
                      style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                    />
                    <p className="text-[8px]" style={{ color: C.muted }}>
                      Interview details, exam link (if enabled), and notes will be appended automatically.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-3 border-t shrink-0 flex items-center justify-end gap-2" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <button onClick={() => setScheduleApplicant(null)}
                className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                {schedResult ? "Close" : "Cancel"}
              </button>
              {!schedResult && (
                <button onClick={handleSchedule} disabled={scheduling}
                  className="flex items-center gap-1.5 px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors disabled:opacity-40"
                  style={{ borderColor: "#a78bfa", color: "#fff", backgroundColor: "#a78bfa" }}>
                  {scheduling ? <Loader2 className="size-3 animate-spin" /> : <CalendarPlus className="size-3" />}
                  {scheduling ? "Scheduling…" : "Schedule Interview"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Migrate Dialog ── */}
      {migrateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="w-full max-w-md border flex flex-col" style={{ backgroundColor: C.panel, borderColor: "#60a5fa40", fontFamily: C.font }}>
            <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <ArrowRightLeft className="size-4 shrink-0" style={{ color: "#60a5fa" }} />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#60a5fa" }}>Migrate Applicants</p>
                <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>Copy applicants from old Firebase to new credentials</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-start gap-2 px-3 py-2.5 border" style={{ borderColor: "#fbbf2440", backgroundColor: "rgba(251,191,36,0.05)" }}>
                <AlertTriangle className="size-4 shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold" style={{ color: "#fbbf24" }}>This will copy all applicants from the old Firebase project</p>
                  <p className="text-[9px]" style={{ color: C.dim }}>
                    Source: <span className="font-mono" style={{ color: C.text }}>taskflow-4605f</span> → applications
                  </p>
                  <p className="text-[9px]" style={{ color: C.dim }}>Destination: your currently saved Firebase credentials</p>
                  <p className="text-[9px] mt-1" style={{ color: C.muted }}>Duplicates may appear if run multiple times.</p>
                </div>
              </div>
              {migrateResult && (
                <div className="px-3 py-2.5 border" style={{
                  borderColor: migrateResult.errors?.length ? "#f8717140" : "#34d39940",
                  backgroundColor: migrateResult.errors?.length ? "rgba(248,113,113,0.05)" : "rgba(52,211,153,0.05)",
                }}>
                  <p className="text-[10px] font-bold" style={{ color: migrateResult.errors?.length ? "#f87171" : "#34d399" }}>
                    ✓ Migrated {migrateResult.migrated} of {migrateResult.total} applicant(s)
                  </p>
                  {migrateResult.errors?.map((e, i) => (
                    <p key={i} className="text-[9px] font-mono mt-0.5" style={{ color: "#f87171" }}>✗ {e}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <button onClick={() => { setMigrateOpen(false); setMigrateResult(null); }}
                className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                {migrateResult ? "Close" : "Cancel"}
              </button>
              {!migrateResult && (
                <button onClick={handleMigrate} disabled={migrating}
                  className="flex items-center gap-1.5 px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors disabled:opacity-40"
                  style={{ borderColor: "#60a5fa", color: "#fff", backgroundColor: "#60a5fa" }}>
                  {migrating ? <Loader2 className="size-3 animate-spin" /> : <ArrowRightLeft className="size-3" />}
                  {migrating ? "Migrating…" : "Start Migration"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ProtectedPageWrapper>
  );
}
