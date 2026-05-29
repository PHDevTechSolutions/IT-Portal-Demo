"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, ClipboardList,
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  Mail, Briefcase, Star, UserPlus,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import type { TestResult, GradedAnswer } from "@/app/api/recruitment/test-results/route";

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
  return new Date(d).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function scoreColor(pct: number) {
  if (pct >= 80) return "#34d399";
  if (pct >= 60) return "#fbbf24";
  return "#f87171";
}

function scoreLabel(pct: number) {
  if (pct >= 80) return "Excellent";
  if (pct >= 70) return "Good";
  if (pct >= 60) return "Average";
  if (pct >= 50) return "Below Average";
  return "Poor";
}

const PAGE_SIZE = 15;

export default function TestResultsPage() {
  const router = useRouter();

  const [results,      setResults]      = useState<TestResult[]>([]);
  const [filtered,     setFiltered]     = useState<TestResult[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page,         setPage]         = useState(1);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // ── Add to Candidates dialog ──────────────────────────────────────────────
  const [candidateResult,  setCandidateResult]  = useState<TestResult | null>(null);
  const [aiRemarks,        setAiRemarks]        = useState("");
  const [manualRemarks,    setManualRemarks]    = useState("");
  const [emailSubject,     setEmailSubject]     = useState("");
  const [emailBody,        setEmailBody]        = useState("");
  const [generatingRemark, setGeneratingRemark] = useState(false);
  const [addingCandidate,  setAddingCandidate]  = useState(false);
  const [addResult,        setAddResult]        = useState<{ rating: string; emailSent: boolean } | null>(null);

  const openCandidateDialog = async (result: TestResult) => {
    setCandidateResult(result);
    setManualRemarks("");
    setAddResult(null);
    setEmailSubject(`Final Interview Invitation — ${result.jobTitle}`);
    setEmailBody(`Dear ${result.applicantName},\n\nCongratulations! Based on your exam performance, we are pleased to invite you for a final interview for the ${result.jobTitle} position at Ecoshift Corporation.\n\nOur HR team will reach out shortly with the schedule details.\n\nThank you for your interest in joining our team.\n\nBest regards,\nEcoshift HR Team`);
    // Auto-generate AI remarks
    setGeneratingRemark(true);
    setAiRemarks("");
    try {
      const res  = await fetch("/api/recruitment/candidates/remarks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantName: result.applicantName,
          jobTitle:      result.jobTitle,
          examScore:     result.percentage,
          examPoints:    result.earnedPoints,
          examTotal:     result.autoScoredTotal,
          answers:       result.answers,
        }),
      });
      const json = await res.json();
      if (json.success) setAiRemarks(json.remarks);
    } catch { /* silent */ }
    finally { setGeneratingRemark(false); }
  };

  const handleAddCandidate = async () => {
    if (!candidateResult) return;
    setAddingCandidate(true);
    try {
      const res  = await fetch("/api/recruitment/candidates/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantName:  candidateResult.applicantName,
          applicantEmail: candidateResult.applicantEmail,
          jobTitle:       candidateResult.jobTitle,
          examToken:      candidateResult.examToken,
          examScore:      candidateResult.percentage,
          examPoints:     candidateResult.earnedPoints,
          examTotal:      candidateResult.autoScoredTotal,
          aiRemarks, manualRemarks, emailSubject, emailBody,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setAddResult({ rating: json.rating, emailSent: json.emailSent });
      toast.success(`${candidateResult.applicantName} added to candidates`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add candidate");
    } finally {
      setAddingCandidate(false);
    }
  };

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/recruitment/test-results", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setResults(json.data ?? []);
    } catch (err: any) {
      toast.error("Failed to load results: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  useEffect(() => {
    let r = [...results];
    if (statusFilter) r = r.filter(x => x.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(x =>
        x.applicantName.toLowerCase().includes(q) ||
        x.jobTitle.toLowerCase().includes(q) ||
        x.applicantEmail.toLowerCase().includes(q)
      );
    }
    setFiltered(r);
    setPage(1);
  }, [results, search, statusFilter]);

  const totalPages     = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const completedCount = results.filter(r => r.status === "completed").length;
  const pendingCount   = results.filter(r => r.status === "pending_review").length;
  const avgScore       = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)
    : 0;

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
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Test Results</BreadcrumbPage>
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
              <ClipboardList className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Test Results</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Firebase · testResults · {results.length} total
              </p>
            </div>
            <div className="ml-auto">
              <button onClick={fetchResults}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                <RefreshCw className="size-3" /> Refresh
              </button>
            </div>
          </div>

          {/* ── Stats bar ── */}
          <div className="relative z-10 shrink-0 grid grid-cols-4 border-b" style={{ borderColor: C.border }}>
            {[
              { label: "Total",          value: results.length, color: C.accent },
              { label: "Completed",      value: completedCount, color: "#34d399" },
              { label: "Pending Review", value: pendingCount,   color: "#fbbf24" },
              { label: "Avg Score",      value: `${avgScore}%`, color: scoreColor(avgScore) },
            ].map((s, i) => (
              <div key={s.label} className="flex flex-col items-center justify-center py-2.5"
                style={{ backgroundColor: C.panel, borderRight: i < 3 ? `1px solid ${C.border}` : "none" }}>
                <span className="text-base font-bold leading-none" style={{ color: s.color }}>{s.value}</span>
                <span className="text-[9px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* ── Toolbar ── */}
          <div className="relative z-10 shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
              <input placeholder="Search applicant, job title, email…" value={search}
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
              <option value="completed">Completed</option>
              <option value="pending_review">Pending Review</option>
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
              <span style={{ color: C.text }}>{filtered.length}</span> results
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
                <ClipboardList className="size-8 opacity-20" style={{ color: C.accent }} />
                <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No test results yet</p>
                <p className="text-[10px]" style={{ color: C.dim }}>Results appear here after applicants complete their exam</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b sticky top-0 z-10" style={{ borderColor: C.border, backgroundColor: C.panel }}>
                    {["", "Applicant", "Job Title", "Score", "Points", "Status", "Short Answers", "Submitted", ""].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
                        style={{ color: C.accent }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((result, i) => {
                    const isExpanded = expandedId === result.id;
                    const pct        = result.percentage;
                    const col        = scoreColor(pct);
                    return (
                      <React.Fragment key={result.id}>
                        <tr className="border-b transition-colors"
                          style={{ borderColor: C.muted + "30", backgroundColor: i % 2 === 0 ? C.bg : C.panel }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.03)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>

                          {/* Expand */}
                          <td className="px-3 py-3 cursor-pointer w-8" onClick={() => setExpandedId(isExpanded ? null : result.id)}>
                            {isExpanded ? <ChevronUp className="size-3" style={{ color: C.accent }} /> : <ChevronDown className="size-3" style={{ color: C.dim }} />}
                          </td>

                          {/* Applicant */}
                          <td className="px-4 py-3">
                            <p className="text-[11px] font-bold" style={{ color: C.text }}>{result.applicantName || "—"}</p>
                            {result.applicantEmail && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Mail className="size-2.5" style={{ color: C.dim }} />
                                <span className="text-[9px] font-mono" style={{ color: C.dim }}>{result.applicantEmail}</span>
                              </div>
                            )}
                          </td>

                          {/* Job */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Briefcase className="size-3 shrink-0" style={{ color: C.dim }} />
                              <span className="text-[10px]" style={{ color: C.dim }}>{result.jobTitle || "—"}</span>
                            </div>
                          </td>

                          {/* Score % */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="relative h-6 w-16 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                                <div className="absolute inset-y-0 left-0 transition-all" style={{ width: `${pct}%`, backgroundColor: col + "30" }} />
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: col }}>
                                  {pct}%
                                </span>
                              </div>
                              <span className="text-[9px]" style={{ color: col }}>{scoreLabel(pct)}</span>
                            </div>
                          </td>

                          {/* Points */}
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-mono" style={{ color: C.text }}>
                              {result.earnedPoints}
                              <span style={{ color: C.muted }}> / {result.autoScoredTotal}</span>
                            </span>
                            {result.shortAnswerCount > 0 && (
                              <p className="text-[8px]" style={{ color: C.muted }}>+{result.shortAnswerCount} manual</p>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 border"
                              style={{
                                borderColor: result.status === "completed" ? "#34d39940" : "#fbbf2440",
                                color:       result.status === "completed" ? "#34d399"   : "#fbbf24",
                                backgroundColor: result.status === "completed" ? "rgba(52,211,153,0.08)" : "rgba(251,191,36,0.08)",
                              }}>
                              {result.status === "completed"
                                ? <><CheckCircle2 className="size-2.5" /> Completed</>
                                : <><Clock className="size-2.5" /> Pending Review</>}
                            </span>
                          </td>

                          {/* Short answer count */}
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-mono" style={{ color: result.shortAnswerCount > 0 ? "#fbbf24" : C.muted }}>
                              {result.shortAnswerCount > 0 ? `${result.shortAnswerCount} to review` : "—"}
                            </span>
                          </td>

                          {/* Submitted */}
                          <td className="px-4 py-3">
                            <span className="text-[9px] font-mono whitespace-nowrap" style={{ color: C.muted }}>
                              {formatDate(result.submittedAt)}
                            </span>
                          </td>

                          {/* Star rating + Add to Candidates */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5">
                                {[1,2,3,4,5].map(star => (
                                  <Star key={star} className="size-3"
                                    style={{ color: star <= Math.round(pct / 20) ? col : C.muted,
                                             fill:  star <= Math.round(pct / 20) ? col : "transparent" }} />
                                ))}
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); openCandidateDialog(result); }}
                                className="flex items-center gap-1 h-6 px-2 text-[8px] font-bold uppercase tracking-wider border transition-colors whitespace-nowrap"
                                style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "rgba(52,211,153,0.08)" }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(52,211,153,0.18)"; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(52,211,153,0.08)"; }}>
                                <UserPlus className="size-2.5" /> Add
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded — full answer breakdown */}
                        {isExpanded && (
                          <tr style={{ backgroundColor: "rgba(232,99,10,0.02)" }}>
                            <td colSpan={9} className="px-6 py-4 border-b" style={{ borderColor: C.muted + "30" }}>
                              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: C.accent }}>
                                Answer Breakdown — {result.applicantName}
                              </p>
                              <div className="space-y-2">
                                {result.answers.map((ans: GradedAnswer, ai: number) => (
                                  <div key={ai} className="border p-3" style={{
                                    borderColor: ans.isCorrect === true ? "#34d39930"
                                      : ans.isCorrect === false ? "#f8717130"
                                      : "#fbbf2430",
                                    backgroundColor: ans.isCorrect === true ? "rgba(52,211,153,0.03)"
                                      : ans.isCorrect === false ? "rgba(248,113,113,0.03)"
                                      : "rgba(251,191,36,0.03)",
                                  }}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                                            style={{ borderColor: C.border, color: C.dim }}>
                                            Q{ans.questionId} · {ans.type.replace("_", " ")}
                                          </span>
                                          <span className="text-[8px] font-bold" style={{ color: C.muted }}>{ans.maxPoints} pts</span>
                                        </div>
                                        <p className="text-[10px] font-medium mb-2" style={{ color: C.text }}>{ans.question}</p>
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <p className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: C.dim }}>Applicant's Answer</p>
                                            <p className="text-[10px]" style={{ color: ans.isCorrect === false ? "#f87171" : C.text }}>
                                              {ans.applicantAnswer || <span style={{ color: C.muted }}>No answer</span>}
                                            </p>
                                          </div>
                                          {ans.type !== "short_answer" && (
                                            <div>
                                              <p className="text-[8px] uppercase tracking-widest mb-0.5" style={{ color: C.dim }}>Correct Answer</p>
                                              <p className="text-[10px]" style={{ color: "#34d399" }}>{ans.correctAnswer}</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        {ans.isCorrect === true && <CheckCircle2 className="size-4" style={{ color: "#34d399" }} />}
                                        {ans.isCorrect === false && <XCircle className="size-4" style={{ color: "#f87171" }} />}
                                        {ans.isCorrect === null && <Clock className="size-4" style={{ color: "#fbbf24" }} />}
                                        <p className="text-[9px] font-bold mt-1" style={{ color: ans.isCorrect === true ? "#34d399" : ans.isCorrect === false ? "#f87171" : "#fbbf24" }}>
                                          {ans.isCorrect === null ? "Review" : `${ans.pointsEarned}/${ans.maxPoints}`}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
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

      {/* ── Add to Candidates Dialog ── */}
      {candidateResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
          onClick={e => { if (e.target === e.currentTarget && !addResult) setCandidateResult(null); }}>
          <div className="w-full max-w-xl border flex flex-col"
            style={{ backgroundColor: C.panel, borderColor: "#34d39940", fontFamily: C.font, maxHeight: "90vh" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
              style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <div className="flex items-center gap-2">
                <UserPlus className="size-4" style={{ color: "#34d399" }} />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#34d399" }}>Add to Candidates</p>
                  <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>{candidateResult.applicantName} · {candidateResult.jobTitle}</p>
                </div>
              </div>
              {!addResult && <button onClick={() => setCandidateResult(null)}><X className="size-4" style={{ color: C.dim }} /></button>}
            </div>

            {/* Body */}
            {addResult ? (
              <div className="px-5 py-6 space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5" style={{ color: "#34d399" }} />
                  <p className="text-[11px] font-bold" style={{ color: "#34d399" }}>Added to candidates queue</p>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 border" style={{
                  borderColor: addResult.rating === "high" ? "#34d39940" : addResult.rating === "medium" ? "#fbbf2440" : "#f8717140",
                  backgroundColor: addResult.rating === "high" ? "rgba(52,211,153,0.06)" : addResult.rating === "medium" ? "rgba(251,191,36,0.06)" : "rgba(248,113,113,0.06)",
                }}>
                  <span className="text-[10px] font-bold uppercase px-2 py-1 border"
                    style={{
                      borderColor: addResult.rating === "high" ? "#34d39940" : addResult.rating === "medium" ? "#fbbf2440" : "#f8717140",
                      color: addResult.rating === "high" ? "#34d399" : addResult.rating === "medium" ? "#fbbf24" : "#f87171",
                    }}>
                    {addResult.rating.toUpperCase()} POTENTIAL
                  </span>
                  <p className="text-[10px]" style={{ color: C.dim }}>
                    {addResult.rating === "high" ? "Excellent — highly recommended for final interview"
                      : addResult.rating === "medium" ? "Good — recommended for final interview"
                      : "Below average — consider carefully"}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 border" style={{
                  borderColor: addResult.emailSent ? "#34d39940" : "#fbbf2440",
                  backgroundColor: addResult.emailSent ? "rgba(52,211,153,0.05)" : "rgba(251,191,36,0.05)",
                }}>
                  <Mail className="size-3.5 shrink-0" style={{ color: addResult.emailSent ? "#34d399" : "#fbbf24" }} />
                  <p className="text-[10px] font-bold" style={{ color: addResult.emailSent ? "#34d399" : "#fbbf24" }}>
                    {addResult.emailSent ? `Invitation email sent to ${candidateResult.applicantEmail}` : "Email not sent"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
                {/* Score summary */}
                <div className="flex items-center gap-4 px-4 py-3 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                  <div className="text-center">
                    <p className="text-2xl font-bold" style={{ color: scoreColor(candidateResult.percentage) }}>{candidateResult.percentage}%</p>
                    <p className="text-[9px] uppercase" style={{ color: C.muted }}>{scoreLabel(candidateResult.percentage)}</p>
                  </div>
                  <div className="w-px h-10" style={{ backgroundColor: C.border }} />
                  <div>
                    <p className="text-[10px]" style={{ color: C.dim }}>
                      Points: <span style={{ color: C.text }}>{candidateResult.earnedPoints}/{candidateResult.autoScoredTotal}</span>
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: C.dim }}>
                      Rating: <span className="font-bold" style={{ color: candidateResult.percentage >= 80 ? "#34d399" : candidateResult.percentage >= 60 ? "#fbbf24" : "#f87171" }}>
                        {candidateResult.percentage >= 80 ? "High" : candidateResult.percentage >= 60 ? "Medium" : "Low"} Potential
                      </span>
                    </p>
                  </div>
                </div>

                {/* AI Remarks */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>AI Performance Remarks</label>
                    {generatingRemark && <Loader2 className="size-3 animate-spin" style={{ color: C.accent }} />}
                  </div>
                  <div className="px-3 py-2.5 border min-h-[60px]" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                    {generatingRemark
                      ? <p className="text-[10px] animate-pulse" style={{ color: C.muted }}>Generating AI remarks…</p>
                      : <p className="text-[10px] leading-relaxed" style={{ color: C.text }}>{aiRemarks || "—"}</p>}
                  </div>
                </div>

                {/* Manual Remarks */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Additional Remarks (Optional)</label>
                  <textarea value={manualRemarks} onChange={e => setManualRemarks(e.target.value)}
                    placeholder="Add your own notes or observations…" rows={3}
                    className="w-full px-2 py-1.5 text-[10px] focus:outline-none resize-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                </div>

                {/* Email compose */}
                <div className="border-t pt-3 space-y-3" style={{ borderColor: C.border }}>
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5" style={{ color: C.accent }} />
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>Email Notification</p>
                    <span className="text-[8px] px-1.5 py-0.5 border" style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "rgba(52,211,153,0.08)" }}>
                      Auto-send via Resend
                    </span>
                  </div>
                  <div className="flex items-center gap-2 h-7 px-2 border" style={{ borderColor: C.muted, backgroundColor: C.bg }}>
                    <span className="text-[9px] uppercase tracking-widest shrink-0" style={{ color: C.accent + "80" }}>To</span>
                    <span className="text-[10px] font-mono truncate" style={{ color: C.dim }}>{candidateResult.applicantEmail || "No email"}</span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Subject</label>
                    <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                      className="w-full h-8 px-2 text-[10px] focus:outline-none"
                      style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Message</label>
                    <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={4}
                      className="w-full px-2 py-1.5 text-[10px] focus:outline-none resize-none"
                      style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                    <p className="text-[8px]" style={{ color: C.muted }}>Exam results and remarks will be included automatically.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-3 border-t shrink-0 flex items-center justify-end gap-2"
              style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <button onClick={() => setCandidateResult(null)}
                className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                {addResult ? "Close" : "Cancel"}
              </button>
              {!addResult && (
                <button onClick={handleAddCandidate} disabled={addingCandidate || generatingRemark}
                  className="flex items-center gap-1.5 px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors disabled:opacity-40"
                  style={{ borderColor: "#34d399", color: "#fff", backgroundColor: "#34d399" }}>
                  {addingCandidate ? <Loader2 className="size-3 animate-spin" /> : <UserPlus className="size-3" />}
                  {addingCandidate ? "Adding…" : "Add to Candidates"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ProtectedPageWrapper>
  );
}
