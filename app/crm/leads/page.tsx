"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Search, Download, X, ChevronLeft, ChevronRight,
  Globe, Building2, Phone, Mail, MapPin, User,
  ExternalLink, CheckCircle2, AlertTriangle, Info,
  Import, Sparkles, Send, Eye, MousePointerClick, Ban, Clock,
} from "lucide-react";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import type { ScrapedLead } from "@/app/api/taskflow/leads-generation/route";

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

const INDUSTRIES = [
  "Construction", "Manufacturing", "Retail", "Food & Beverage",
  "Healthcare", "Education", "IT & Technology", "Real Estate",
  "Logistics & Shipping", "Finance & Banking", "Hospitality",
  "Agriculture", "Automotive", "Electrical Supply", "Hardware",
];

const LOCATIONS = [
  "Metro Manila", "NCR", "Cebu", "Davao", "Quezon City",
  "Makati", "Pasig", "Taguig", "Mandaluyong", "Caloocan",
  "Laguna", "Cavite", "Batangas", "Pampanga", "Bulacan",
  "Iloilo", "Cagayan de Oro", "Zamboanga", "General Santos",
];

const CONFIDENCE_STYLE: Record<string, { color: string; icon: any }> = {
  high:   { color: "#34d399", icon: CheckCircle2 },
  medium: { color: "#fbbf24", icon: AlertTriangle },
  low:    { color: "#f87171", icon: Info },
};

function ConfidenceBadge({ level }: { level: string }) {
  const cfg  = CONFIDENCE_STYLE[level] ?? CONFIDENCE_STYLE.low;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border"
      style={{ borderColor: cfg.color + "40", color: cfg.color, backgroundColor: cfg.color + "10" }}
    >
      <Icon className="size-2.5" />{level}
    </span>
  );
}

const PAGE_SIZE = 10;

// ─── Email status config ──────────────────────────────────────────────────────
const EMAIL_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  sent:       { label: "Sent",       color: "#60a5fa", icon: Send },
  delivered:  { label: "Delivered",  color: "#34d399", icon: CheckCircle2 },
  opened:     { label: "Opened",     color: "#a78bfa", icon: Eye },
  clicked:    { label: "Clicked",    color: "#f59e0b", icon: MousePointerClick },
  bounced:    { label: "Bounced",    color: "#f87171", icon: Ban },
  delayed:    { label: "Delayed",    color: "#fbbf24", icon: Clock },
  complained: { label: "Complained", color: "#f87171", icon: AlertTriangle },
};

function EmailStatusBadge({ status }: { status: string }) {
  const cfg  = EMAIL_STATUS[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border"
      style={{ borderColor: cfg.color + "40", color: cfg.color, backgroundColor: cfg.color + "10" }}
    >
      <Icon className="size-2.5" />{cfg.label}
    </span>
  );
}

// ─── Compose Dialog ───────────────────────────────────────────────────────────
function ComposeDialog({ open, onClose, onSent, prefillTo, prefillCompany, prefillContact }: {
  open: boolean; onClose: () => void; onSent: () => void;
  prefillTo: string; prefillCompany: string; prefillContact: string;
}) {
  const [subject, setSubject] = useState("");
  const [body,    setBody]    = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!prefillTo || !subject.trim() || !body.trim()) { toast.error("Subject and message are required"); return; }
    setSending(true);
    try {
      const res  = await fetch("/api/crm/communications/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: prefillTo, subject: subject.trim(),
          body_html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.7">${body.replace(/\n/g, "<br/>")}</div>`,
          body_text: body, company_name: prefillCompany, contact_person: prefillContact,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`Email sent to ${prefillTo}`);
      onSent(); onClose();
    } catch (err: any) { toast.error(err.message ?? "Failed to send"); }
    finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl w-full rounded-none p-0 gap-0"
        style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>
        <DialogHeader className="px-5 py-3.5 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <div className="flex items-center gap-2">
            <Mail className="size-3.5" style={{ color: C.accent }} />
            <DialogTitle className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>Email Prospect</DialogTitle>
          </div>
        </DialogHeader>
        <div className="px-5 py-4 space-y-3">
          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>To</label>
            <div className="flex items-center gap-2 h-8 px-2 border" style={{ borderColor: C.muted, backgroundColor: C.bg }}>
              <Building2 className="size-3 shrink-0" style={{ color: C.dim }} />
              <span className="text-[11px]" style={{ color: C.text }}>{prefillCompany}</span>
              <span className="text-[10px]" style={{ color: C.dim }}>·</span>
              <span className="text-[11px] font-mono" style={{ color: C.dim }}>{prefillTo}</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject…"
              className="w-full h-8 px-2 text-[11px] focus:outline-none"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
              onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message here…" rows={7}
              className="w-full px-2 py-2 text-[11px] focus:outline-none resize-none"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
              onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
          </div>
        </div>
        <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <span className="text-[9px] font-mono" style={{ color: C.dim }}>crm@elev8solutions.cloud</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors"
              style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>Cancel</button>
            <button onClick={handleSend} disabled={sending}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors disabled:opacity-40"
              style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
              {sending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LeadsGenerationPage() {
  const router = useRouter();

  const [query,    setQuery]    = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [limit,    setLimit]    = useState(10);

  const [leads,       setLeads]       = useState<ScrapedLead[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page,        setPage]        = useState(1);

  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  const [composeOpen,   setComposeOpen]   = useState(false);
  const [composeLead,   setComposeLead]   = useState<ScrapedLead | null>(null);
  const [emailStatuses, setEmailStatuses] = useState<Record<string, string>>({});

  const paginated  = leads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));

  const openCompose = (e: React.MouseEvent, lead: ScrapedLead) => {
    e.stopPropagation();
    if (!lead.email_address) { toast.error("No email address for this prospect"); return; }
    setComposeLead(lead); setComposeOpen(true);
  };

  const fetchEmailStatuses = useCallback(async (leadList: ScrapedLead[]) => {
    const emails = leadList.map(l => l.email_address).filter(Boolean);
    if (!emails.length) return;
    try {
      const results: Record<string, string> = {};
      await Promise.all(emails.map(async (email) => {
        const res  = await fetch(`/api/crm/communications/fetch?email=${encodeURIComponent(email)}&pageSize=1`);
        const json = await res.json();
        if (json.success && json.data?.length) results[email] = json.data[0].status;
      }));
      setEmailStatuses(results);
    } catch { /* silent */ }
  }, []);

  const toggleSelect = (i: number) =>
    setSelectedIdx(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const toggleAll = () => {
    const idxs = paginated.map((_, i) => (page - 1) * PAGE_SIZE + i);
    const all  = idxs.every(i => selectedIdx.has(i));
    setSelectedIdx(prev => { const n = new Set(prev); idxs.forEach(i => all ? n.delete(i) : n.add(i)); return n; });
  };

  const handleSearch = async () => {
    if (!query.trim()) { toast.error("Enter a search query"); return; }
    setIsSearching(true); setLeads([]); setSelectedIdx(new Set()); setPage(1); setHasSearched(false);
    const tid = toast.loading("AI planning scrape targets… (may take up to 90s)");
    try {
      const res  = await fetch("/api/taskflow/leads-generation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, industry, location, limit }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Search failed");
      setLeads(json.leads ?? []);
      setHasSearched(true);
      toast.success(`Found ${json.leads?.length ?? 0} real prospects`, { id: tid });
      fetchEmailStatuses(json.leads ?? []);
    } catch (err: any) {
      toast.error(err.message ?? "Search failed", { id: tid });
    } finally { setIsSearching(false); }
  };

  // ── Import to Supabase leads table ───────────────────────────────────────
  const handleImport = async () => {
    const toImport = Array.from(selectedIdx).map(i => leads[i]).filter(Boolean);
    if (!toImport.length) { toast.error("Select at least one prospect"); return; }
    setIsImporting(true);
    const tid = toast.loading(`Saving ${toImport.length} leads to Supabase…`);
    try {
      const res  = await fetch("/api/crm/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads:        toImport,
          search_query: query,
          search_mode:  "agentic",
          region:       location || "",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Import failed");
      toast.success(`${json.insertedCount} leads saved to Supabase leads table`, { id: tid });
      setSelectedIdx(new Set());
    } catch (err: any) { toast.error(err.message ?? "Import failed", { id: tid }); }
    finally { setIsImporting(false); }
  };

  const handleExport = () => {
    const headers = ["Company", "Contact Person", "Phone", "Email", "Address", "Industry", "Website", "Source", "Confidence"];
    const rows    = leads.map(l =>
      [l.company_name, l.contact_person, l.contact_number, l.email_address,
       l.address, l.industry, l.website, l.source, l.confidence]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prospects_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    toast.success("Exported");
  };

  const pageIdxs    = paginated.map((_, i) => (page - 1) * PAGE_SIZE + i);
  const allSelected = pageIdxs.length > 0 && pageIdxs.every(i => selectedIdx.has(i));

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden bg-[#080d12]" style={{ fontFamily: C.font, color: C.text }}>
          <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`, backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0 }} />

          {/* ── Header ── */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b bg-[#080d12]" style={{ borderColor: C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest rounded-none hover:bg-transparent" style={{ color: C.dim }}>
              Home
            </Button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>CRM</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem><BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Leads Generation</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Agentic AI</span>
            </div>
          </header>

          {/* ── Title bar ── */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b bg-[#0d1117]" style={{ borderColor: C.border }}>
            <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <Sparkles className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Leads Generation / Prospects</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                AI plans scrape targets · Browser fetches real data · Import to Customer Database
              </p>
            </div>
            {/* Agentic flow badge */}
            <div className="ml-auto hidden sm:flex items-center gap-2">
              {(["AI Planner", "→", "Browser Scrape", "→", "AI Extract"] as const).map((step, i) => (
                <span key={i} className="text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: step === "→" ? C.muted : C.dim }}>
                  {step === "→" ? step : (
                    <span className="px-1.5 py-0.5 border" style={{ borderColor: C.border }}>{step}</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* ── Search panel ── */}
          <div className="relative z-10 shrink-0 border-b" style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="px-4 py-4 space-y-3">

              {/* ── Query + Search button ── */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
                  <input
                    placeholder='e.g. "electrical supply companies in Cebu" or "construction firms Davao"'
                    value={query} onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                    className="w-full pl-8 pr-4 h-9 text-[12px] focus:outline-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                </div>
                <button onClick={handleSearch} disabled={isSearching || !query.trim()}
                  className="flex items-center gap-2 h-9 px-5 text-[11px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "rgba(232,99,10,0.15)", borderColor: C.accent, color: C.accent }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.25)"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.15)"; }}>
                  {isSearching ? <><Loader2 className="size-3 animate-spin" /> Searching…</> : <><Search className="size-3" /> Search</>}
                </button>
              </div>

              {/* ── Filters ── */}
              <div className="flex flex-wrap items-center gap-2">
                <select value={industry} onChange={e => setIndustry(e.target.value)}
                  className="h-8 text-[11px] px-2 focus:outline-none"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: industry ? C.text : C.dim, fontFamily: C.font }}>
                  <option value="">All Industries</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <select value={location} onChange={e => setLocation(e.target.value)}
                  className="h-8 text-[11px] px-2 focus:outline-none"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: location ? C.text : C.dim, fontFamily: C.font }}>
                  <option value="">All Locations</option>
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={limit} onChange={e => setLimit(+e.target.value)}
                  className="h-8 text-[11px] px-2 focus:outline-none"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                  {[5, 10, 15, 20, 25, 30, 40, 50].map(n => <option key={n} value={n}>{n} results</option>)}
                </select>
                {(industry || location) && (
                  <button onClick={() => { setIndustry(""); setLocation(""); }}
                    className="flex items-center gap-1 h-8 px-2 text-[10px] transition-colors" style={{ color: C.dim }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                    onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                    <X className="size-3" /> Clear filters
                  </button>
                )}
                <div className="flex-1" />
                {leads.length > 0 && (
                  <>
                    {selectedIdx.size > 0 && (
                      <button onClick={handleImport} disabled={isImporting}
                        className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                        style={{ backgroundColor: "rgba(52,211,153,0.1)", borderColor: "#34d39940", color: "#34d399" }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(52,211,153,0.2)"; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(52,211,153,0.1)"; }}>
                        {isImporting ? <Loader2 className="size-3 animate-spin" /> : <Import className="size-3" />}
                        Import to Leads ({selectedIdx.size})
                      </button>
                    )}
                    <button onClick={handleExport}
                      className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                      style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                      <Download className="size-3" /> Export CSV
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Results ── */}
          <div className="relative z-10 flex-1 overflow-auto">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: C.accent, borderTopColor: "transparent" }} />
                  <Globe className="absolute inset-0 m-auto size-5" style={{ color: C.accent }} />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest animate-pulse" style={{ color: C.accent }}>
                    Agentic AI scraping in progress…
                  </p>
                  <p className="text-[10px]" style={{ color: C.muted }}>Step 1 — AI planning scrape targets</p>
                  <p className="text-[10px]" style={{ color: C.muted }}>Step 2 — Playwright browser fetching real data</p>
                  <p className="text-[10px]" style={{ color: C.muted }}>Step 3 — AI extracting &amp; validating leads</p>
                  <p className="text-[10px] mt-2" style={{ color: C.dim }}>May take up to 90s · No hallucinations · Real businesses only</p>
                </div>
              </div>
            ) : !hasSearched ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "rgba(232,99,10,0.05)" }}>
                  <Sparkles className="size-8 opacity-40" style={{ color: C.accent }} />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest" style={{ color: C.text }}>Agentic AI Leads Discovery</p>
                  <p className="text-[11px] mt-2 max-w-md" style={{ color: C.muted }}>
                    AI decides where to look → Playwright scrapes real PH business directories → AI validates and structures the results. No hallucinations.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]" style={{ color: C.dim }}>
                  {["electrical supply companies in Cebu", "construction firms in Davao", "hardware stores Metro Manila", "food manufacturers Laguna"].map(ex => (
                    <button key={ex} onClick={() => setQuery(ex)}
                      className="px-3 py-2 border text-left transition-colors"
                      style={{ borderColor: C.border, backgroundColor: "transparent" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                      &ldquo;{ex}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Search className="size-8 opacity-20" style={{ color: C.dim }} />
                <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No prospects found. Try a different query or broaden your filters.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {/* Table header */}
                <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2 border-b text-[9px] font-bold uppercase tracking-widest"
                  style={{ backgroundColor: C.panel, borderColor: C.border, color: C.accent }}>
                  <div className="w-5">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll}
                      className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 h-3.5 w-3.5" />
                  </div>
                  <div className="w-5 text-center">#</div>
                  <div className="flex-1 min-w-[160px]">Company / Prospect</div>
                  <div className="w-36 hidden md:block">Contact Person</div>
                  <div className="w-36 hidden lg:block">Phone</div>
                  <div className="w-44 hidden lg:block">Email</div>
                  <div className="flex-1 hidden xl:block">Address</div>
                  <div className="w-24 hidden md:block">Industry</div>
                  <div className="w-20">Confidence</div>
                  <div className="w-20 hidden md:block">Email Status</div>
                  <div className="w-28 hidden lg:block">Source</div>
                  <div className="w-8" />
                </div>

                {/* Rows */}
                {paginated.map((lead, pi) => {
                  const globalIdx = (page - 1) * PAGE_SIZE + pi;
                  const selected  = selectedIdx.has(globalIdx);
                  return (
                    <div key={globalIdx}
                      className="flex items-start gap-3 px-4 py-3 border-b cursor-pointer transition-colors"
                      style={{ borderColor: C.muted + "30", backgroundColor: selected ? "rgba(232,99,10,0.06)" : pi % 2 === 0 ? C.bg : C.panel }}
                      onClick={() => toggleSelect(globalIdx)}
                      onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.03)"; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = selected ? "rgba(232,99,10,0.06)" : pi % 2 === 0 ? C.bg : C.panel; }}>
                      <div className="w-5 mt-0.5" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selected} onCheckedChange={() => toggleSelect(globalIdx)}
                          className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 h-3.5 w-3.5" />
                      </div>
                      <div className="w-5 text-center text-[10px] mt-0.5" style={{ color: C.muted }}>{globalIdx + 1}</div>
                      <div className="flex-1 min-w-[160px]">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="size-3 shrink-0" style={{ color: C.accent }} />
                          <span className="text-[11px] font-bold" style={{ color: C.text }}>{lead.company_name || "—"}</span>
                        </div>
                        {lead.website && (
                          <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                            target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-[9px] mt-0.5 hover:underline" style={{ color: C.dim }}>
                            <ExternalLink className="size-2.5" />{lead.website}
                          </a>
                        )}
                      </div>
                      <div className="w-36 hidden md:block">
                        {lead.contact_person
                          ? <div className="flex items-center gap-1"><User className="size-3 shrink-0" style={{ color: C.dim }} /><span className="text-[11px]" style={{ color: C.text }}>{lead.contact_person}</span></div>
                          : <span style={{ color: C.muted }}>—</span>}
                      </div>
                      <div className="w-36 hidden lg:block">
                        {lead.contact_number
                          ? <div className="flex items-center gap-1"><Phone className="size-3 shrink-0" style={{ color: C.dim }} /><span className="text-[11px] font-mono" style={{ color: C.text }}>{lead.contact_number}</span></div>
                          : <span style={{ color: C.muted }}>—</span>}
                      </div>
                      <div className="w-44 hidden lg:block">
                        {lead.email_address
                          ? <div className="flex items-center gap-1"><Mail className="size-3 shrink-0" style={{ color: C.dim }} /><span className="text-[11px] truncate" style={{ color: C.text }}>{lead.email_address}</span></div>
                          : <span style={{ color: C.muted }}>—</span>}
                      </div>
                      <div className="flex-1 hidden xl:block">
                        {lead.address
                          ? <div className="flex items-start gap-1"><MapPin className="size-3 shrink-0 mt-0.5" style={{ color: C.dim }} /><span className="text-[11px]" style={{ color: C.dim }}>{lead.address}</span></div>
                          : <span style={{ color: C.muted }}>—</span>}
                      </div>
                      <div className="w-24 hidden md:block"><span className="text-[10px]" style={{ color: C.dim }}>{lead.industry || "—"}</span></div>
                      <div className="w-20"><ConfidenceBadge level={lead.confidence} /></div>
                      <div className="w-20 hidden md:flex items-center">
                        {lead.email_address && emailStatuses[lead.email_address]
                          ? <EmailStatusBadge status={emailStatuses[lead.email_address]} />
                          : lead.email_address
                            ? <span className="text-[9px]" style={{ color: C.muted }}>Not sent</span>
                            : <span className="text-[9px]" style={{ color: C.muted }}>No email</span>}
                      </div>
                      {/* Source */}
                      <div className="w-28 hidden lg:flex items-center">
                        {lead.source ? (
                          <span
                            className="text-[8px] font-mono px-1.5 py-0.5 border truncate max-w-full"
                            title={lead.source}
                            style={{
                              borderColor: lead.source.includes("businesslist") ? "#34d39940"
                                : lead.source.includes("yellowpages") ? "#fbbf2440"
                                : lead.source.includes("companyhouse") ? "#a78bfa40"
                                : lead.source.includes("google") ? "#60a5fa40"
                                : C.border,
                              color: lead.source.includes("businesslist") ? "#34d399"
                                : lead.source.includes("yellowpages") ? "#fbbf24"
                                : lead.source.includes("companyhouse") ? "#a78bfa"
                                : lead.source.includes("google") ? "#60a5fa"
                                : C.dim,
                              backgroundColor: "transparent",
                            }}
                          >
                            {lead.source.includes("businesslist") ? "BusinessList.ph"
                              : lead.source.includes("yellowpages") ? "Yellow Pages"
                              : lead.source.includes("companyhouse") ? "SEC/CompanyHouse"
                              : lead.source.includes("google") ? "Google"
                              : lead.source.startsWith("http") ? new URL(lead.source).hostname.replace("www.", "")
                              : lead.source.slice(0, 18)}
                          </span>
                        ) : <span className="text-[9px]" style={{ color: C.muted }}>—</span>}
                      </div>
                      <div className="w-8 flex flex-col items-center gap-1.5">
                        {lead.email_address && (
                          <button onClick={e => openCompose(e, lead)} title={`Email ${lead.email_address}`}
                            className="flex items-center justify-center h-6 w-6 border transition-colors"
                            style={{ borderColor: C.border, backgroundColor: "transparent" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.backgroundColor = "transparent"; }}>
                            <Mail className="size-3" style={{ color: C.accent }} />
                          </button>
                        )}
                        {lead.source && lead.source.startsWith("http") && (
                          <a href={lead.source} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title={lead.source}>
                            <ExternalLink className="size-3" style={{ color: C.dim }} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Pagination ── */}
          {leads.length > 0 && (
            <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-2 border-t" style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <span className="text-[10px]" style={{ color: C.muted }}>
                <span style={{ color: C.text }}>{leads.length}</span>
                {leads.length < limit
                  ? <span> of <span style={{ color: C.accent }}>{limit}</span> requested</span>
                  : <span style={{ color: "#34d399" }}> / {limit} ✓</span>}
                {selectedIdx.size > 0 && <span style={{ color: C.accent }}> · {selectedIdx.size} selected</span>}
              </span>
              <div className="flex items-center gap-1" style={{ fontSize: "11px" }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                  style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                  onMouseEnter={e => { if (page > 1) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                  <ChevronLeft className="size-3" /> Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)} className="h-7 w-7 border text-[10px] font-bold transition-colors"
                      style={{ backgroundColor: p === page ? C.accent : "transparent", borderColor: p === page ? C.accent : C.border, color: p === page ? "#080d12" : C.dim }}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                  style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                  onMouseEnter={e => { if (page < totalPages) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                  Next <ChevronRight className="size-3" />
                </button>
              </div>
            </div>
          )}
        </SidebarInset>
      </SidebarProvider>

      {composeLead && (
        <ComposeDialog
          open={composeOpen}
          onClose={() => { setComposeOpen(false); setComposeLead(null); }}
          onSent={() => fetchEmailStatuses(leads)}
          prefillTo={composeLead.email_address ?? ""}
          prefillCompany={composeLead.company_name ?? ""}
          prefillContact={composeLead.contact_person ?? ""}
        />
      )}
    </ProtectedPageWrapper>
  );
}