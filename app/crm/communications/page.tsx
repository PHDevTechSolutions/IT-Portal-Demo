"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, Mail, Send, Inbox,
  Building2, User, Clock, MessageSquare, ArrowUpRight,
  ArrowDownLeft, Plus, Reply, Phone, MapPin, Globe,
  CheckCircle2, AlertTriangle, Eye, Ban,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  website: string;
  industry: string;
  region: string;
  source: string;
  confidence: string;
  status: string;
  date_created: string;
}

interface Communication {
  id: string;
  company_name: string;
  contact_person: string;
  email_address: string;
  thread_id: string;
  direction: "outbound" | "inbound";
  subject: string;
  body_html: string | null;
  body_text: string | null;
  resend_email_id: string | null;
  from_address: string;
  reply_to: string | null;
  status: string;
  sent_by_name: string | null;
  sent_by_email: string | null;
  created_at: string;
}

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
  const dt   = new Date(d);
  const now  = new Date();
  const diff = now.getTime() - dt.getTime();
  if (diff < 60000)    return "just now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return dt.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function statusColor(status: string) {
  if (["sent", "delivered"].includes(status)) return "#34d399";
  if (status === "opened")   return "#a78bfa";
  if (status === "clicked")  return "#f59e0b";
  if (status === "received") return "#60a5fa";
  if (["bounced", "failed", "complained"].includes(status)) return "#f87171";
  return C.dim;
}

const EMAIL_STATUS_ICON: Record<string, any> = {
  sent:       Send,
  delivered:  CheckCircle2,
  opened:     Eye,
  clicked:    Eye,
  bounced:    Ban,
  failed:     Ban,
  received:   ArrowDownLeft,
  complained: AlertTriangle,
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   "#34d399",
  medium: "#fbbf24",
  low:    "#f87171",
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CommunicationsPage() {
  const router = useRouter();

  // ── Leads (left panel) ────────────────────────────────────────────────────
  const [leads,         setLeads]         = useState<Lead[]>([]);
  const [leadsTotal,    setLeadsTotal]    = useState(0);
  const [leadsLoading,  setLeadsLoading]  = useState(false);
  const [leadsSearch,   setLeadsSearch]   = useState("");
  const [selectedLead,  setSelectedLead]  = useState<Lead | null>(null);

  // ── Communications (right panel) ─────────────────────────────────────────
  const [threads,       setThreads]       = useState<Communication[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [viewThread,    setViewThread]    = useState<Communication[]>([]);
  const [viewThreadId,  setViewThreadId]  = useState("");
  const [threadMsgLoad, setThreadMsgLoad] = useState(false);

  // ── Compose ───────────────────────────────────────────────────────────────
  const [composeOpen,   setComposeOpen]   = useState(false);
  const [composeTo,     setComposeTo]     = useState("");
  const [composeSubj,   setComposeSubj]   = useState("");
  const [composeBody,   setComposeBody]   = useState("");
  const [composeThread, setComposeThread] = useState("");
  const [sending,       setSending]       = useState(false);

  // ── Free compose (anyone, not just leads) ────────────────────────────────
  const [freeComposeOpen,    setFreeComposeOpen]    = useState(false);
  const [freeComposeTo,      setFreeComposeTo]      = useState("");
  const [freeComposeCompany, setFreeComposeCompany] = useState("");
  const [freeComposeContact, setFreeComposeContact] = useState("");
  const [freeComposeSubj,    setFreeComposeSubj]    = useState("");
  const [freeComposeBody,    setFreeComposeBody]    = useState("");
  const [freeSending,        setFreeSending]        = useState(false);

  const handleFreeSend = async () => {
    if (!freeComposeTo.trim() || !freeComposeSubj.trim() || !freeComposeBody.trim()) {
      toast.error("To, Subject, and Message are required"); return;
    }
    setFreeSending(true);
    try {
      const res  = await fetch("/api/crm/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to:             freeComposeTo.trim(),
          subject:        freeComposeSubj.trim(),
          body_html:      `<div style="font-family:sans-serif;font-size:14px;line-height:1.7">${freeComposeBody.replace(/\n/g, "<br/>")}</div>`,
          body_text:      freeComposeBody,
          company_name:   freeComposeCompany,
          contact_person: freeComposeContact,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`Email sent to ${freeComposeTo}`);
      setFreeComposeOpen(false);
      setFreeComposeTo(""); setFreeComposeCompany(""); setFreeComposeContact("");
      setFreeComposeSubj(""); setFreeComposeBody("");
      if (selectedLead) fetchThreadsForLead(selectedLead);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send");
    } finally {
      setFreeSending(false);
    }
  };

  const leadsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch leads ───────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async (q = "") => {
    setLeadsLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50" });
      if (q.trim()) params.set("search", q.trim());
      const res  = await fetch(`/api/crm/leads/fetch?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setLeads(json.data ?? []);
      setLeadsTotal(json.total ?? 0);
    } catch (err: any) {
      toast.error("Failed to load leads: " + err.message);
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleLeadsSearch = (val: string) => {
    setLeadsSearch(val);
    if (leadsDebounce.current) clearTimeout(leadsDebounce.current);
    leadsDebounce.current = setTimeout(() => fetchLeads(val), 400);
  };

  // ── Fetch threads for selected lead ──────────────────────────────────────
  const fetchThreadsForLead = useCallback(async (lead: Lead) => {
    if (!lead.email_address) { setThreads([]); return; }
    setThreadLoading(true);
    try {
      const res  = await fetch(
        `/api/crm/communications/fetch?email=${encodeURIComponent(lead.email_address)}&pageSize=50`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // Deduplicate by thread_id — keep latest per thread
      const seen = new Map<string, Communication>();
      (json.data ?? []).forEach((c: Communication) => {
        const ex = seen.get(c.thread_id);
        if (!ex || new Date(c.created_at) > new Date(ex.created_at)) seen.set(c.thread_id, c);
      });
      setThreads(Array.from(seen.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (err: any) {
      toast.error("Failed to load threads: " + err.message);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const selectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setViewThreadId("");
    setViewThread([]);
    fetchThreadsForLead(lead);
    // Pre-fill compose
    setComposeTo(lead.email_address ?? "");
    setComposeSubj("");
    setComposeBody("");
    setComposeThread("");
  };

  // ── Fetch full thread messages ────────────────────────────────────────────
  const openThread = async (threadId: string) => {
    setViewThreadId(threadId);
    setThreadMsgLoad(true);
    try {
      const res  = await fetch(
        `/api/crm/communications/fetch?thread_id=${encodeURIComponent(threadId)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      setViewThread(json.data ?? []);
    } catch {
      toast.error("Failed to load thread");
    } finally {
      setThreadMsgLoad(false);
    }
  };

  const closeThread = () => { setViewThreadId(""); setViewThread([]); };

  // ── Reply ─────────────────────────────────────────────────────────────────
  const handleReply = (comm: Communication) => {
    setComposeSubj(comm.subject.startsWith("Re:") ? comm.subject : `Re: ${comm.subject}`);
    setComposeThread(comm.thread_id);
    setComposeOpen(true);
    closeThread();
  };

  // ── Send email ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!composeTo.trim() || !composeSubj.trim() || !composeBody.trim()) {
      toast.error("To, Subject, and Message are required"); return;
    }
    setSending(true);
    try {
      const res  = await fetch("/api/crm/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to:             composeTo.trim(),
          subject:        composeSubj.trim(),
          body_html:      `<div style="font-family:sans-serif;font-size:14px;line-height:1.7">${composeBody.replace(/\n/g, "<br/>")}</div>`,
          body_text:      composeBody,
          company_name:   selectedLead?.company_name ?? "",
          contact_person: selectedLead?.contact_person ?? "",
          thread_id:      composeThread || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Email sent");
      setComposeOpen(false);
      setComposeSubj(""); setComposeBody(""); setComposeThread("");
      if (selectedLead) fetchThreadsForLead(selectedLead);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset
          className="flex flex-col h-svh overflow-hidden bg-[#080d12]"
          style={{ fontFamily: C.font, color: C.text }}
        >
          {/* Dot grid */}
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
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>CRM</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Communications</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Resend</span>
            </div>
          </header>

          {/* ── Title bar ── */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <Mail className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Communications</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                {leadsTotal} leads · select a lead to compose or view threads
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => { fetchLeads(leadsSearch); if (selectedLead) fetchThreadsForLead(selectedLead); }}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                <RefreshCw className="size-3" /> Refresh
              </button>
              <button
                onClick={() => { setFreeComposeOpen(true); setFreeComposeTo(""); setFreeComposeCompany(""); setFreeComposeContact(""); setFreeComposeSubj(""); setFreeComposeBody(""); }}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.accent, color: C.accent, backgroundColor: "rgba(232,99,10,0.1)" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)"; }}>
                <Plus className="size-3" /> Compose
              </button>
            </div>
          </div>

          {/* ── Split layout ── */}
          <div className="relative z-10 flex-1 flex overflow-hidden">

            {/* ══ LEFT PANEL — Leads list ══ */}
            <div className="flex flex-col w-72 shrink-0 border-r overflow-hidden" style={{ borderColor: C.border, backgroundColor: C.panel }}>
              {/* Search */}
              <div className="shrink-0 px-3 py-2 border-b" style={{ borderColor: C.border }}>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
                  <input
                    placeholder="Search leads…"
                    value={leadsSearch}
                    onChange={e => handleLeadsSearch(e.target.value)}
                    className="w-full pl-7 pr-7 h-7 text-[10px] focus:outline-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                  {leadsSearch && (
                    <button onClick={() => { setLeadsSearch(""); fetchLeads(""); }} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X className="size-3" style={{ color: C.dim }} />
                    </button>
                  )}
                </div>
              </div>

              {/* Leads list */}
              <div className="flex-1 overflow-y-auto">
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <Loader2 className="size-3.5 animate-spin" style={{ color: C.accent }} />
                    <span className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>Loading…</span>
                  </div>
                ) : leads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 px-4 text-center">
                    <Inbox className="size-6 opacity-20" style={{ color: C.accent }} />
                    <p className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>No leads found</p>
                    <p className="text-[9px]" style={{ color: C.dim }}>Import leads from Leads Generation first</p>
                  </div>
                ) : (
                  leads.map(lead => {
                    const isSelected = selectedLead?.id === lead.id;
                    const confColor  = CONFIDENCE_COLOR[lead.confidence] ?? C.dim;
                    return (
                      <div
                        key={lead.id}
                        onClick={() => selectLead(lead)}
                        className="px-3 py-2.5 border-b cursor-pointer transition-colors"
                        style={{
                          borderColor:     C.muted + "30",
                          backgroundColor: isSelected ? "rgba(232,99,10,0.1)" : "transparent",
                          borderLeft:      isSelected ? `2px solid ${C.accent}` : "2px solid transparent",
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)"; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-[10px] font-bold truncate" style={{ color: isSelected ? C.accent : C.text }}>
                            {lead.company_name || "—"}
                          </p>
                          <span className="text-[7px] font-bold uppercase px-1 py-0.5 border shrink-0"
                            style={{ borderColor: confColor + "40", color: confColor, backgroundColor: confColor + "10" }}>
                            {lead.confidence}
                          </span>
                        </div>
                        {lead.contact_person && (
                          <p className="text-[9px] mt-0.5 truncate" style={{ color: C.dim }}>{lead.contact_person}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          {lead.email_address
                            ? <span className="text-[8px] font-mono truncate" style={{ color: C.muted }}>{lead.email_address}</span>
                            : <span className="text-[8px]" style={{ color: "#f87171" }}>No email</span>}
                        </div>
                        {lead.industry && (
                          <p className="text-[8px] mt-0.5 truncate" style={{ color: C.dim }}>{lead.industry}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Leads count */}
              <div className="shrink-0 px-3 py-1.5 border-t" style={{ borderColor: C.border }}>
                <span className="text-[9px]" style={{ color: C.muted }}>
                  <span style={{ color: C.text }}>{leads.length}</span> of {leadsTotal} leads
                </span>
              </div>
            </div>

            {/* ══ RIGHT PANEL — Compose + Threads ══ */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {!selectedLead ? (
                /* Empty state */
                <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "rgba(232,99,10,0.05)" }}>
                    <Mail className="size-6 opacity-30" style={{ color: C.accent }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.text }}>Select a lead</p>
                    <p className="text-[10px] mt-1" style={{ color: C.muted }}>Click a lead on the left to compose an email or view communication history</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Lead info bar ── */}
                  <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: C.border, backgroundColor: C.panel }}>
                    <div className="flex h-8 w-8 items-center justify-center border shrink-0" style={{ borderColor: C.border }}>
                      <Building2 className="size-4" style={{ color: C.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold uppercase truncate" style={{ color: C.accent }}>{selectedLead.company_name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {selectedLead.contact_person && (
                          <span className="flex items-center gap-1 text-[9px]" style={{ color: C.dim }}>
                            <User className="size-2.5" />{selectedLead.contact_person}
                          </span>
                        )}
                        {selectedLead.contact_number && (
                          <span className="flex items-center gap-1 text-[9px]" style={{ color: C.dim }}>
                            <Phone className="size-2.5" />{selectedLead.contact_number}
                          </span>
                        )}
                        {selectedLead.email_address && (
                          <span className="flex items-center gap-1 text-[9px] font-mono" style={{ color: C.dim }}>
                            <Mail className="size-2.5" />{selectedLead.email_address}
                          </span>
                        )}
                        {selectedLead.industry && (
                          <span className="text-[9px]" style={{ color: C.muted }}>{selectedLead.industry}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setComposeOpen(true); setComposeThread(""); setComposeSubj(""); setComposeBody(""); }}
                      disabled={!selectedLead.email_address}
                      className="flex items-center gap-1.5 h-7 px-3 text-[9px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-30"
                      style={{ borderColor: C.accent, color: C.accent, backgroundColor: "rgba(232,99,10,0.1)" }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)"; }}>
                      <Plus className="size-3" /> New Email
                    </button>
                  </div>

                  {/* ── Thread view OR thread list ── */}
                  {viewThreadId ? (
                    /* Full thread messages */
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                        <button onClick={closeThread}
                          className="text-[9px] font-bold uppercase tracking-wider transition-colors"
                          style={{ color: C.dim }}
                          onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                          onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                          ← Back
                        </button>
                        <span className="text-[9px]" style={{ color: C.muted }}>
                          {viewThread[0]?.subject || "Thread"}
                        </span>
                        <div className="ml-auto">
                          {viewThread[0] && (
                            <button onClick={() => handleReply(viewThread[0])}
                              className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase border transition-colors"
                              style={{ borderColor: C.accent, color: C.accent, backgroundColor: "rgba(232,99,10,0.1)" }}>
                              <Reply className="size-2.5" /> Reply
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                        {threadMsgLoad ? (
                          <div className="flex items-center justify-center py-8 gap-2">
                            <Loader2 className="size-3.5 animate-spin" style={{ color: C.accent }} />
                          </div>
                        ) : viewThread.map(msg => (
                          <div key={msg.id} className="border p-3 space-y-2"
                            style={{
                              borderColor:     msg.direction === "outbound" ? C.accent + "30" : "#60a5fa30",
                              backgroundColor: msg.direction === "outbound" ? "rgba(232,99,10,0.04)" : "rgba(96,165,250,0.04)",
                            }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                {msg.direction === "outbound"
                                  ? <ArrowUpRight className="size-3" style={{ color: C.accent }} />
                                  : <ArrowDownLeft className="size-3" style={{ color: "#60a5fa" }} />}
                                <span className="text-[9px] font-bold" style={{ color: msg.direction === "outbound" ? C.accent : "#60a5fa" }}>
                                  {msg.direction === "outbound" ? `Sent by ${msg.sent_by_name || "You"}` : `From ${msg.email_address}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                                  style={{ borderColor: statusColor(msg.status) + "40", color: statusColor(msg.status), backgroundColor: statusColor(msg.status) + "10" }}>
                                  {msg.status}
                                </span>
                                <span className="text-[9px] font-mono" style={{ color: C.muted }}>{formatDate(msg.created_at)}</span>
                              </div>
                            </div>
                            <p className="text-[10px] font-bold" style={{ color: C.text }}>{msg.subject}</p>
                            <div className="text-[10px] leading-relaxed pt-1.5 border-t" style={{ borderColor: C.border, color: C.dim }}>
                              {msg.body_html
                                ? <div dangerouslySetInnerHTML={{ __html: msg.body_html }} />
                                : <p className="whitespace-pre-wrap">{msg.body_text || "—"}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Thread list for selected lead */
                    <div className="flex-1 overflow-y-auto">
                      {threadLoading ? (
                        <div className="flex items-center justify-center py-12 gap-2">
                          <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                          <span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Loading threads…</span>
                        </div>
                      ) : threads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                          <div className="flex h-12 w-12 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "rgba(232,99,10,0.05)" }}>
                            <MessageSquare className="size-5 opacity-30" style={{ color: C.accent }} />
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.text }}>No emails yet</p>
                            <p className="text-[9px] mt-1" style={{ color: C.muted }}>Click "New Email" to start a conversation</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="px-4 py-2 border-b" style={{ borderColor: C.border }}>
                            <span className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>
                              {threads.length} thread{threads.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {threads.map((comm, i) => {
                            const StatusIcon = EMAIL_STATUS_ICON[comm.status] ?? Mail;
                            return (
                              <div key={comm.thread_id}
                                onClick={() => openThread(comm.thread_id)}
                                className="flex items-start gap-3 px-4 py-3 border-b cursor-pointer transition-colors"
                                style={{ borderColor: C.muted + "30", backgroundColor: i % 2 === 0 ? C.bg : C.panel }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>
                                {/* Direction icon */}
                                <div className="shrink-0 flex h-7 w-7 items-center justify-center border mt-0.5"
                                  style={{
                                    borderColor:     comm.direction === "outbound" ? C.accent + "40" : "#60a5fa40",
                                    backgroundColor: comm.direction === "outbound" ? "rgba(232,99,10,0.08)" : "rgba(96,165,250,0.08)",
                                  }}>
                                  {comm.direction === "outbound"
                                    ? <ArrowUpRight className="size-3" style={{ color: C.accent }} />
                                    : <ArrowDownLeft className="size-3" style={{ color: "#60a5fa" }} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-bold truncate" style={{ color: C.text }}>{comm.subject}</p>
                                    <span className="text-[9px] font-mono shrink-0" style={{ color: C.muted }}>{formatDate(comm.created_at)}</span>
                                  </div>
                                  <p className="text-[9px] mt-0.5 truncate" style={{ color: C.dim }}>{comm.body_text || "—"}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="flex items-center gap-1 text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                                      style={{ borderColor: statusColor(comm.status) + "40", color: statusColor(comm.status), backgroundColor: statusColor(comm.status) + "10" }}>
                                      <StatusIcon className="size-2.5" />{comm.status}
                                    </span>
                                    <button onClick={e => { e.stopPropagation(); handleReply(comm); }}
                                      className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider transition-colors"
                                      style={{ color: C.dim }}
                                      onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                                      onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                                      <Reply className="size-2.5" /> Reply
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Compose panel (inline, bottom) ── */}
                  {composeOpen && (
                    <div className="shrink-0 border-t" style={{ borderColor: C.border, backgroundColor: C.panel }}>
                      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                          {composeThread ? "Reply" : "New Email"}
                        </span>
                        <button onClick={() => setComposeOpen(false)}>
                          <X className="size-3.5" style={{ color: C.dim }} />
                        </button>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        {/* To (read-only from selected lead) */}
                        <div className="flex items-center gap-2 h-7 px-2 border" style={{ borderColor: C.muted, backgroundColor: C.bg }}>
                          <span className="text-[9px] uppercase tracking-widest shrink-0" style={{ color: C.accent + "80" }}>To</span>
                          <span className="text-[10px] font-mono truncate" style={{ color: C.dim }}>{composeTo}</span>
                        </div>
                        {/* Subject */}
                        <input
                          value={composeSubj} onChange={e => setComposeSubj(e.target.value)}
                          placeholder="Subject…"
                          className="w-full h-7 px-2 text-[10px] focus:outline-none"
                          style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                          onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                          onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                        />
                        {/* Body */}
                        <textarea
                          value={composeBody} onChange={e => setComposeBody(e.target.value)}
                          placeholder="Write your message…"
                          rows={5}
                          className="w-full px-2 py-1.5 text-[10px] focus:outline-none resize-none"
                          style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                          onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                          onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                        />
                        {/* Footer */}
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-mono" style={{ color: C.dim }}>crm@elev8solutions.cloud</span>
                          <div className="flex gap-2">
                            <button onClick={() => setComposeOpen(false)}
                              className="px-3 py-1 text-[9px] font-mono uppercase tracking-widest border transition-colors"
                              style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                              Cancel
                            </button>
                            <button onClick={handleSend} disabled={sending}
                              className="flex items-center gap-1.5 px-4 py-1 text-[9px] font-mono uppercase tracking-widest border transition-colors disabled:opacity-40"
                              style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
                              {sending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                              {sending ? "Sending…" : "Send"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* ── Free Compose Modal (anyone, not just leads) ── */}
      {freeComposeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={e => { if (e.target === e.currentTarget) setFreeComposeOpen(false); }}
        >
          <div
            className="w-full max-w-xl rounded-none border flex flex-col"
            style={{ backgroundColor: C.panel, borderColor: C.border, fontFamily: C.font, maxHeight: "90vh" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <div className="flex items-center gap-2">
                <Mail className="size-3.5" style={{ color: C.accent }} />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                  New Email
                </span>
                <span className="text-[9px] px-1.5 py-0.5 border" style={{ borderColor: C.muted, color: C.dim }}>
                  to anyone
                </span>
              </div>
              <button onClick={() => setFreeComposeOpen(false)}>
                <X className="size-4" style={{ color: C.dim }} />
              </button>
            </div>

            {/* Fields */}
            <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
              {/* To */}
              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>To *</label>
                <input
                  value={freeComposeTo} onChange={e => setFreeComposeTo(e.target.value)}
                  placeholder="recipient@email.com"
                  className="w-full h-8 px-2 text-[11px] focus:outline-none"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                  onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                  onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>

              {/* Company + Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Company</label>
                  <input
                    value={freeComposeCompany} onChange={e => setFreeComposeCompany(e.target.value)}
                    placeholder="Company name"
                    className="w-full h-8 px-2 text-[11px] focus:outline-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Contact Person</label>
                  <input
                    value={freeComposeContact} onChange={e => setFreeComposeContact(e.target.value)}
                    placeholder="Contact name"
                    className="w-full h-8 px-2 text-[11px] focus:outline-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Subject *</label>
                <input
                  value={freeComposeSubj} onChange={e => setFreeComposeSubj(e.target.value)}
                  placeholder="Email subject"
                  className="w-full h-8 px-2 text-[11px] focus:outline-none"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                  onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                  onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>

              {/* Body */}
              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Message *</label>
                <textarea
                  value={freeComposeBody} onChange={e => setFreeComposeBody(e.target.value)}
                  placeholder="Write your message here…"
                  rows={8}
                  className="w-full px-2 py-2 text-[11px] focus:outline-none resize-none"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                  onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                  onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t shrink-0 flex items-center justify-between" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <span className="text-[9px] font-mono" style={{ color: C.dim }}>
                crm@elev8solutions.cloud
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFreeComposeOpen(false)}
                  className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleFreeSend}
                  disabled={freeSending || !freeComposeTo.trim() || !freeComposeSubj.trim() || !freeComposeBody.trim()}
                  className="flex items-center gap-1.5 px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors disabled:opacity-40"
                  style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}
                >
                  {freeSending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                  {freeSending ? "Sending…" : "Send Email"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedPageWrapper>
  );
}
