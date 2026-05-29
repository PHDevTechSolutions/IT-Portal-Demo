"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, Users2, Mail, Briefcase,
  Star, ChevronDown, ChevronUp, CheckCircle2, Clock, XCircle,
  CalendarCheck, Send, ClipboardList, Plus,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import type { Candidate } from "@/app/api/recruitment/candidates/route";

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
function ratingStyle(r: string) {
  if (r === "high")   return { color: "#34d399", border: "#34d39940", bg: "rgba(52,211,153,0.08)",  label: "High" };
  if (r === "medium") return { color: "#fbbf24", border: "#fbbf2440", bg: "rgba(251,191,36,0.08)",  label: "Medium" };
  return                     { color: "#f87171", border: "#f8717140", bg: "rgba(248,113,113,0.08)", label: "Low" };
}
function statusStyle(s: string) {
  if (s === "queued")          return { color: "#60a5fa", icon: Clock };
  if (s === "final_interview") return { color: "#a78bfa", icon: Clock };
  if (s === "hired")           return { color: "#34d399", icon: CheckCircle2 };
  if (s === "rejected")        return { color: "#f87171", icon: XCircle };
  return                              { color: C.dim,     icon: Clock };
}

const DEFAULT_CHECKLIST = [
  "Valid Government ID (2 copies)",
  "NBI Clearance",
  "Police Clearance",
  "Barangay Clearance",
  "SSS / PhilHealth / Pag-IBIG numbers",
  "TIN number",
  "Birth Certificate (PSA)",
  "Diploma / Transcript of Records",
  "2x2 ID Photos (4 pieces)",
  "Medical Certificate",
  "Pre-employment Medical Exam",
  "Bank Account (for payroll)",
];

const PAGE_SIZE = 15;

export default function CandidatesPage() {
  const router = useRouter();

  const [candidates,   setCandidates]   = useState<Candidate[]>([]);
  const [filtered,     setFiltered]     = useState<Candidate[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page,         setPage]         = useState(1);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [dialogCandidate, setDialogCandidate] = useState<Candidate | null>(null);
  const [dialogType,      setDialogType]      = useState<"final_interview" | "rejected" | "hired" | null>(null);

  // Final Interview fields
  const [fiDate,    setFiDate]    = useState("");
  const [fiTime,    setFiTime]    = useState("09:00");
  const [fiType,    setFiType]    = useState("onsite");
  const [fiLoc,     setFiLoc]     = useState("");
  const [fiNotes,   setFiNotes]   = useState("");

  // Hired checklist
  const [checklist, setChecklist] = useState<string[]>([...DEFAULT_CHECKLIST]);
  const [newItem,   setNewItem]   = useState("");

  // Email compose (shared)
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody,    setEmailBody]    = useState("");
  const [sending,      setSending]      = useState(false);
  const [done,         setDone]         = useState(false);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/recruitment/candidates", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setCandidates(json.data ?? []);
    } catch (err: any) {
      toast.error("Failed to load candidates: " + err.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  useEffect(() => {
    let r = [...candidates];
    if (ratingFilter) r = r.filter(c => c.rating === ratingFilter);
    if (statusFilter) r = r.filter(c => c.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(c =>
        c.applicantName.toLowerCase().includes(q) ||
        c.jobTitle.toLowerCase().includes(q) ||
        c.applicantEmail.toLowerCase().includes(q)
      );
    }
    setFiltered(r); setPage(1);
  }, [candidates, search, ratingFilter, statusFilter]);

  // ── Open dialog ───────────────────────────────────────────────────────────
  const openDialog = (c: Candidate, type: "final_interview" | "rejected" | "hired") => {
    setDialogCandidate(c);
    setDialogType(type);
    setDone(false);
    setFiDate(""); setFiTime("09:00"); setFiType("onsite"); setFiLoc(""); setFiNotes("");
    setChecklist([...DEFAULT_CHECKLIST]); setNewItem("");

    if (type === "final_interview") {
      setEmailSubject(`Final Interview Schedule — ${c.jobTitle}`);
      setEmailBody(`Dear ${c.applicantName},\n\nWe are pleased to inform you that you have been selected for a Final Interview for the ${c.jobTitle} position at Ecoshift Corporation.\n\nPlease see the schedule details below. Kindly confirm your availability by replying to this email.\n\nWe look forward to meeting you.\n\nBest regards,\nEcoshift HR Team`);
    } else if (type === "rejected") {
      setEmailSubject(`Application Update — ${c.jobTitle}`);
      setEmailBody(`Dear ${c.applicantName},\n\nThank you for your time and effort in applying for the ${c.jobTitle} position at Ecoshift Corporation.\n\nAfter careful consideration, we regret to inform you that we will not be moving forward with your application at this time. Please know that this was a difficult decision, as we received many strong applications.\n\nWe encourage you to continue developing your skills and to apply again in the future. We wish you all the best in your career journey.\n\nThank you again for your interest in Ecoshift Corporation.\n\nBest regards,\nEcoshift HR Team`);
    } else {
      setEmailSubject(`Congratulations! Job Offer — ${c.jobTitle}`);
      setEmailBody(`Dear ${c.applicantName},\n\nCongratulations! We are thrilled to offer you the ${c.jobTitle} position at Ecoshift Corporation.\n\nPlease prepare the following pre-employment requirements before your onboarding date. Our HR team will contact you shortly with further details.\n\nWelcome to the Ecoshift family!\n\nBest regards,\nEcoshift HR Team`);
    }
  };

  const closeDialog = () => { setDialogCandidate(null); setDialogType(null); setDone(false); };

  // ── Update Firebase status ────────────────────────────────────────────────
  const updateFirebaseStatus = async (id: string, status: string) => {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getFirestore, doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
    const res  = await fetch("/api/recruitment/credentials", { cache: "no-store" });
    const json = await res.json();
    const creds = json.credentials;
    const config = !creds ? {
      apiKey: "AIzaSyCNonSOohWCFdgL052XUFFZTH1orbP2dH4", authDomain: "taskflow-4605f.firebaseapp.com",
      projectId: "taskflow-4605f", storageBucket: "taskflow-4605f.firebasestorage.app",
      messagingSenderId: "558742255762", appId: "1:558742255762:web:5725b5c26f1c6fae9e8e4b",
    } : { apiKey: creds.api_key, authDomain: creds.auth_domain, projectId: creds.project_id,
          storageBucket: creds.storage_bucket || "", messagingSenderId: creds.messaging_sender_id || "", appId: creds.app_id || "" };
    const appName = `recruitment-${config.projectId}`;
    const app = getApps().find((a: any) => a.name === appName) ?? initializeApp(config, appName);
    await updateDoc(doc(getFirestore(app), "candidates", id), { status, updatedAt: serverTimestamp() });
  };

  // ── Send email + update status ────────────────────────────────────────────
  const handleSend = async () => {
    if (!dialogCandidate || !dialogType) return;
    if (!emailSubject.trim() || !emailBody.trim()) { toast.error("Subject and message required"); return; }
    setSending(true);
    try {
      // Build extra details for the email body
      let extraHtml = "";
      if (dialogType === "final_interview" && fiDate) {
        const typeLabel = fiType === "online" ? "Online" : fiType === "phone" ? "Phone" : "On-site";
        extraHtml = `
          <table style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:20px 0;width:100%">
            <tr><td style="color:#6b7280;font-size:13px;padding:4px 0;width:140px">📅 Date & Time</td><td style="color:#111827;font-size:13px;font-weight:600">${fiDate}${fiTime ? " at " + fiTime : ""}</td></tr>
            <tr><td style="color:#6b7280;font-size:13px;padding:4px 0">🎯 Format</td><td style="color:#111827;font-size:13px;font-weight:600">${typeLabel}</td></tr>
            ${fiLoc ? `<tr><td style="color:#6b7280;font-size:13px;padding:4px 0">📍 Location</td><td style="color:#111827;font-size:13px;font-weight:600">${fiLoc}</td></tr>` : ""}
            ${fiNotes ? `<tr><td style="color:#6b7280;font-size:13px;padding:4px 0">📝 Notes</td><td style="color:#111827;font-size:13px">${fiNotes}</td></tr>` : ""}
          </table>`;
      }
      if (dialogType === "hired") {
        extraHtml = `
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin:20px 0">
            <p style="margin:0 0 10px;color:#166534;font-size:13px;font-weight:700">📋 Pre-Employment Requirements</p>
            <ul style="margin:0;padding-left:20px">
              ${checklist.map(item => `<li style="color:#15803d;font-size:13px;padding:2px 0">${item}</li>`).join("")}
            </ul>
          </div>`;
      }

      const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
              <tr><td style="background:#e8630a;padding:28px 32px;">
                <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">${emailSubject}</h1>
                <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px">${dialogCandidate.jobTitle}</p>
              </td></tr>
              <tr><td style="padding:32px">
                <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">${emailBody.replace(/\n/g, "<br/>")}</p>
                ${extraHtml}
              </td></tr>
              <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px">
                <p style="margin:0;color:#9ca3af;font-size:12px">Sent by Ecoshift Corporation HR · crm@elev8solutions.cloud</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>`;

      // Send email via Resend
      const emailRes = await fetch("/api/crm/communications/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to:             dialogCandidate.applicantEmail,
          subject:        emailSubject,
          body_html:      html,
          body_text:      emailBody,
          company_name:   dialogCandidate.applicantName,
          contact_person: dialogCandidate.applicantName,
        }),
      });
      const emailJson = await emailRes.json();
      if (!emailJson.success) throw new Error(emailJson.error);

      // Update Firebase status
      await updateFirebaseStatus(dialogCandidate.id, dialogType);

      // If hired, save checklist via API (avoids nested dynamic imports)
      if (dialogType === "hired") {
        await fetch("/api/recruitment/onboarding/create", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidateId:    dialogCandidate.id,
            applicantName:  dialogCandidate.applicantName,
            applicantEmail: dialogCandidate.applicantEmail,
            jobTitle:       dialogCandidate.jobTitle,
            checklist,
          }),
        });
      }

      toast.success(`Email sent to ${dialogCandidate.applicantEmail}`);
      setDone(true);
      fetchCandidates();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setSending(false);
    }
  };

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const queuedCount = candidates.filter(c => c.status === "queued").length;
  const finalCount  = candidates.filter(c => c.status === "final_interview").length;
  const hiredCount  = candidates.filter(c => c.status === "hired").length;
  const highCount   = candidates.filter(c => c.rating === "high").length;

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
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>Home</button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/recruitment/jobs" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Recruitment</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Candidates</BreadcrumbPage>
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
              <Users2 className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Candidates for Final Interview</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Firebase · candidates · {candidates.length} total
              </p>
            </div>
            <div className="ml-auto">
              <button onClick={fetchCandidates}
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
              { label: "Total",           value: candidates.length, color: C.accent },
              { label: "Queued",          value: queuedCount,       color: "#60a5fa" },
              { label: "Final Interview", value: finalCount,        color: "#a78bfa" },
              { label: "Hired",           value: hiredCount,        color: "#34d399" },
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
              <input placeholder="Search name, job, email…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-3" style={{ color: C.dim }} /></button>}
            </div>
            <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: ratingFilter ? C.text : C.dim, fontFamily: C.font }}>
              <option value="">All Ratings</option>
              <option value="high">High Potential</option>
              <option value="medium">Medium Potential</option>
              <option value="low">Low Potential</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: statusFilter ? C.text : C.dim, fontFamily: C.font }}>
              <option value="">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="final_interview">Final Interview</option>
              <option value="hired">Hired</option>
              <option value="rejected">Rejected</option>
            </select>
            {(ratingFilter || statusFilter) && (
              <button onClick={() => { setRatingFilter(""); setStatusFilter(""); }}
                className="flex items-center gap-1 h-8 px-2 text-[10px] transition-colors" style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                <X className="size-3" /> Clear
              </button>
            )}
            <div className="ml-auto text-[10px]" style={{ color: C.muted }}>
              <span style={{ color: C.text }}>{filtered.length}</span> candidates
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
                <Users2 className="size-8 opacity-20" style={{ color: C.accent }} />
                <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No candidates yet</p>
                <p className="text-[10px]" style={{ color: C.dim }}>Add candidates from the Test Results page</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b sticky top-0 z-10" style={{ borderColor: C.border, backgroundColor: C.panel }}>
                    {["", "Candidate", "Job", "Score", "Rating", "Status", "Email", "Queued", "Actions"].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
                        style={{ color: C.accent }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c, i) => {
                    const rt         = ratingStyle(c.rating);
                    const st         = statusStyle(c.status);
                    const StatusIcon = st.icon;
                    const isExpanded = expandedId === c.id;
                    return (
                      <React.Fragment key={c.id}>
                        <tr className="border-b transition-colors"
                          style={{ borderColor: C.muted + "30", backgroundColor: i % 2 === 0 ? C.bg : C.panel }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.03)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>
                          <td className="px-3 py-3 cursor-pointer w-8" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                            {isExpanded ? <ChevronUp className="size-3" style={{ color: C.accent }} /> : <ChevronDown className="size-3" style={{ color: C.dim }} />}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[11px] font-bold" style={{ color: C.text }}>{c.applicantName || "—"}</p>
                            {c.applicantEmail && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Mail className="size-2.5" style={{ color: C.dim }} />
                                <span className="text-[9px] font-mono" style={{ color: C.dim }}>{c.applicantEmail}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Briefcase className="size-3 shrink-0" style={{ color: C.dim }} />
                              <span className="text-[10px]" style={{ color: C.dim }}>{c.jobTitle || "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-bold" style={{ color: c.examScore >= 80 ? "#34d399" : c.examScore >= 60 ? "#fbbf24" : "#f87171" }}>{c.examScore}%</span>
                            <p className="text-[9px] font-mono" style={{ color: C.muted }}>{c.examPoints}/{c.examTotal} pts</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 border"
                                style={{ borderColor: rt.border, color: rt.color, backgroundColor: rt.bg }}>{rt.label} Potential</span>
                              <div className="flex items-center gap-0.5">
                                {[1,2,3].map(s => (
                                  <Star key={s} className="size-2.5"
                                    style={{ color: (c.rating === "high" ? 3 : c.rating === "medium" ? 2 : 1) >= s ? rt.color : C.muted,
                                             fill:  (c.rating === "high" ? 3 : c.rating === "medium" ? 2 : 1) >= s ? rt.color : "transparent" }} />
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 border"
                              style={{ borderColor: st.color + "40", color: st.color, backgroundColor: st.color + "10" }}>
                              <StatusIcon className="size-2.5" />{c.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[9px]" style={{ color: c.emailSent ? "#34d399" : C.muted }}>{c.emailSent ? "✓ Sent" : "—"}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[9px] font-mono whitespace-nowrap" style={{ color: C.muted }}>{formatDate(c.createdAt)}</span>
                          </td>
                          {/* Action buttons */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openDialog(c, "final_interview")} title="Schedule Final Interview"
                                className="flex items-center gap-1 h-6 px-1.5 text-[8px] font-bold uppercase border transition-colors"
                                style={{ borderColor: "#a78bfa40", color: "#a78bfa", backgroundColor: "rgba(167,139,250,0.08)" }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(167,139,250,0.18)"; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(167,139,250,0.08)"; }}>
                                <CalendarCheck className="size-2.5" />
                              </button>
                              <button onClick={() => openDialog(c, "hired")} title="Mark as Hired"
                                className="flex items-center gap-1 h-6 px-1.5 text-[8px] font-bold uppercase border transition-colors"
                                style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "rgba(52,211,153,0.08)" }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(52,211,153,0.18)"; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(52,211,153,0.08)"; }}>
                                <CheckCircle2 className="size-2.5" />
                              </button>
                              <button onClick={() => openDialog(c, "rejected")} title="Reject"
                                className="flex items-center gap-1 h-6 px-1.5 text-[8px] font-bold uppercase border transition-colors"
                                style={{ borderColor: "#f8717140", color: "#f87171", backgroundColor: "rgba(248,113,113,0.08)" }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.18)"; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)"; }}>
                                <XCircle className="size-2.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ backgroundColor: "rgba(232,99,10,0.02)" }}>
                            <td colSpan={9} className="px-8 py-4 border-b" style={{ borderColor: C.muted + "30" }}>
                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: C.accent }}>AI Performance Remarks</p>
                                  <p className="text-[10px] leading-relaxed" style={{ color: C.dim }}>{c.aiRemarks || "—"}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: C.accent }}>Additional Remarks</p>
                                  <p className="text-[10px] leading-relaxed" style={{ color: C.dim }}>{c.manualRemarks || "—"}</p>
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
              <span className="text-[10px]" style={{ color: C.muted }}>Page <span style={{ color: C.text }}>{page}</span> of {totalPages}</span>
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

      {/* ── Status Dialog ── */}
      {dialogCandidate && dialogType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
          onClick={e => { if (e.target === e.currentTarget && !done) closeDialog(); }}>
          <div className="w-full max-w-xl border flex flex-col"
            style={{
              backgroundColor: C.panel, fontFamily: C.font, maxHeight: "90vh",
              borderColor: dialogType === "final_interview" ? "#a78bfa40" : dialogType === "hired" ? "#34d39940" : "#f8717140",
            }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
              style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <div className="flex items-center gap-2">
                {dialogType === "final_interview" && <CalendarCheck className="size-4" style={{ color: "#a78bfa" }} />}
                {dialogType === "hired"           && <CheckCircle2  className="size-4" style={{ color: "#34d399" }} />}
                {dialogType === "rejected"        && <XCircle       className="size-4" style={{ color: "#f87171" }} />}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: dialogType === "final_interview" ? "#a78bfa" : dialogType === "hired" ? "#34d399" : "#f87171" }}>
                    {dialogType === "final_interview" ? "Schedule Final Interview"
                      : dialogType === "hired" ? "Hired — Onboarding Checklist"
                      : "Reject Applicant"}
                  </p>
                  <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>{dialogCandidate.applicantName} · {dialogCandidate.jobTitle}</p>
                </div>
              </div>
              {!done && <button onClick={closeDialog}><X className="size-4" style={{ color: C.dim }} /></button>}
            </div>

            {done ? (
              /* Success */
              <div className="px-5 py-6 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5" style={{ color: "#34d399" }} />
                  <p className="text-[11px] font-bold" style={{ color: "#34d399" }}>
                    {dialogType === "final_interview" ? "Final interview scheduled & email sent"
                      : dialogType === "hired" ? "Candidate marked as hired & checklist saved"
                      : "Rejection email sent"}
                  </p>
                </div>
                {dialogType === "hired" && (
                  <button onClick={() => router.push("/recruitment/onboarding")}
                    className="flex items-center gap-2 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                    style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "rgba(52,211,153,0.08)" }}>
                    <ClipboardList className="size-3" /> View Onboarding Checklist
                  </button>
                )}
              </div>
            ) : (
              <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">

                {/* Final Interview — schedule fields */}
                {dialogType === "final_interview" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FField label="Date *" type="date" value={fiDate} onChange={setFiDate} />
                      <FField label="Time"   type="time" value={fiTime} onChange={setFiTime} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Type</label>
                        <select value={fiType} onChange={e => setFiType(e.target.value)}
                          className="w-full h-8 px-2 text-[11px] focus:outline-none"
                          style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                          <option value="onsite">On-site</option>
                          <option value="online">Online</option>
                          <option value="phone">Phone</option>
                        </select>
                      </div>
                      <FField label="Location / Link" value={fiLoc} onChange={setFiLoc} placeholder="Room 2 or meet.google.com/..." />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Notes</label>
                      <textarea value={fiNotes} onChange={e => setFiNotes(e.target.value)} rows={2}
                        className="w-full px-2 py-1.5 text-[10px] focus:outline-none resize-none"
                        style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                        onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                        onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                    </div>
                    <div className="border-t pt-2" style={{ borderColor: C.border }} />
                  </div>
                )}

                {/* Hired — checklist */}
                {dialogType === "hired" && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>Pre-Employment Requirements</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {checklist.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[9px] shrink-0" style={{ color: C.accent }}>▸</span>
                          <span className="text-[10px] flex-1" style={{ color: C.text }}>{item}</span>
                          <button onClick={() => setChecklist(p => p.filter((_, i) => i !== idx))}>
                            <X className="size-3" style={{ color: C.dim }} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input value={newItem} onChange={e => setNewItem(e.target.value)}
                        placeholder="Add requirement…"
                        className="flex-1 h-7 px-2 text-[10px] focus:outline-none"
                        style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                        onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                        onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                        onKeyDown={e => { if (e.key === "Enter" && newItem.trim()) { setChecklist(p => [...p, newItem.trim()]); setNewItem(""); } }} />
                      <button onClick={() => { if (newItem.trim()) { setChecklist(p => [...p, newItem.trim()]); setNewItem(""); } }}
                        className="flex items-center gap-1 h-7 px-2 text-[9px] border transition-colors"
                        style={{ borderColor: C.accent, color: C.accent, backgroundColor: "rgba(232,99,10,0.1)" }}>
                        <Plus className="size-3" /> Add
                      </button>
                    </div>
                    <div className="border-t pt-2" style={{ borderColor: C.border }} />
                  </div>
                )}

                {/* Email compose (all types) */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5" style={{ color: C.accent }} />
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>Email Notification</p>
                    <span className="text-[8px] px-1.5 py-0.5 border" style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "rgba(52,211,153,0.08)" }}>
                      Auto-send via Resend
                    </span>
                  </div>
                  <div className="flex items-center gap-2 h-7 px-2 border" style={{ borderColor: C.muted, backgroundColor: C.bg }}>
                    <span className="text-[9px] uppercase tracking-widest shrink-0" style={{ color: C.accent + "80" }}>To</span>
                    <span className="text-[10px] font-mono truncate" style={{ color: C.dim }}>{dialogCandidate.applicantEmail || "No email"}</span>
                  </div>
                  <FField label="Subject" value={emailSubject} onChange={setEmailSubject} />
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Message</label>
                    <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={5}
                      className="w-full px-2 py-1.5 text-[10px] focus:outline-none resize-none"
                      style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                      onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-3 border-t shrink-0 flex items-center justify-end gap-2"
              style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <button onClick={closeDialog}
                className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                {done ? "Close" : "Cancel"}
              </button>
              {!done && (
                <button onClick={handleSend} disabled={sending}
                  className="flex items-center gap-1.5 px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors disabled:opacity-40"
                  style={{
                    borderColor: dialogType === "final_interview" ? "#a78bfa" : dialogType === "hired" ? "#34d399" : "#f87171",
                    color: "#fff",
                    backgroundColor: dialogType === "final_interview" ? "#a78bfa" : dialogType === "hired" ? "#34d399" : "#f87171",
                  }}>
                  {sending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                  {sending ? "Sending…"
                    : dialogType === "final_interview" ? "Schedule & Send Email"
                    : dialogType === "hired" ? "Confirm Hired & Send"
                    : "Send Rejection Email"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ProtectedPageWrapper>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────
function FField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
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
