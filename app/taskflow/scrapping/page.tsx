"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Loader2, Search, Download, X, ChevronLeft, ChevronRight,
  Zap, Globe, Building2, Phone, Mail, MapPin, User,
  ExternalLink, CheckCircle2, AlertTriangle, Info,
  Import, Sparkles,
} from "lucide-react";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import type { ScrapedLead } from "@/app/api/taskflow/scrapping/route";

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
  const cfg = CONFIDENCE_STYLE[level] ?? CONFIDENCE_STYLE.low;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border"
      style={{ borderColor: cfg.color + "40", color: cfg.color, backgroundColor: cfg.color + "10" }}>
      <Icon className="size-2.5" />{level}
    </span>
  );
}

const PAGE_SIZE = 10;

export default function ScrappingPage() {
  const router = useRouter();

  // ── Search form ────────────────────────────────────────────────────────────
  const [query,    setQuery]    = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [limit,    setLimit]    = useState(10);
  const [mode,     setMode]     = useState<"web"|"ai">("web");

  // ── Results ────────────────────────────────────────────────────────────────
  const [leads,      setLeads]      = useState<ScrapedLead[]>([]);
  const [isSearching,setIsSearching]= useState(false);
  const [hasSearched,setHasSearched]= useState(false);
  const [page,       setPage]       = useState(1);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  const paginated  = leads.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));

  const toggleSelect = (i: number) => setSelectedIdx(prev => {
    const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n;
  });
  const toggleAll = () => {
    const pageIdxs = paginated.map((_, i) => (page-1)*PAGE_SIZE + i);
    const allSelected = pageIdxs.every(i => selectedIdx.has(i));
    setSelectedIdx(prev => {
      const n = new Set(prev);
      pageIdxs.forEach(i => allSelected ? n.delete(i) : n.add(i));
      return n;
    });
  };

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!query.trim()) { toast.error("Enter a search query"); return; }
    setIsSearching(true);
    setLeads([]);
    setSelectedIdx(new Set());
    setPage(1);
    setHasSearched(false);
    const tid = toast.loading(mode === "web" ? "Searching the web…" : "Generating leads with AI…");
    try {
      const res  = await fetch("/api/taskflow/scrapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, industry, location, limit, mode }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Search failed");
      setLeads(json.leads ?? []);
      setHasSearched(true);
      toast.success(`Found ${json.leads?.length ?? 0} leads`, { id: tid });
    } catch (err: any) {
      toast.error(err.message ?? "Search failed", { id: tid });
    } finally {
      setIsSearching(false);
    }
  };

  // ── Import selected to Customer Database ──────────────────────────────────
  const handleImport = async () => {
    const toImport = Array.from(selectedIdx).map(i => leads[i]).filter(Boolean);
    if (toImport.length === 0) { toast.error("Select at least one lead"); return; }
    setIsImporting(true);
    const tid = toast.loading(`Importing ${toImport.length} leads…`);
    try {
      const payload = toImport.map(l => ({
        company_name:    l.company_name,
        contact_person:  l.contact_person,
        contact_number:  l.contact_number,
        email_address:   l.email_address,
        address:         l.address,
        type_client:     l.industry || "Lead",
        status:          "Active",
        region:          location || "",
        remarks:         `Scraped via AI · Source: ${l.source || "web"} · Confidence: ${l.confidence}`,
        referenceid:     "",
        tsm:             "",
        manager:         "",
      }));

      const res  = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceid: "", tsm: "", data: payload }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Import failed");
      toast.success(`Imported ${toImport.length} leads to Customer Database`, { id: tid });
      setSelectedIdx(new Set());
    } catch (err: any) {
      toast.error(err.message ?? "Import failed", { id: tid });
    } finally {
      setIsImporting(false);
    }
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExport = () => {
    const headers = ["Company","Contact Person","Phone","Email","Address","Industry","Website","Source","Confidence"];
    const rows = leads.map(l =>
      [l.company_name, l.contact_person, l.contact_number, l.email_address,
       l.address, l.industry, l.website, l.source, l.confidence]
        .map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    toast.success("Exported");
  };

  const pageIdxs    = paginated.map((_, i) => (page-1)*PAGE_SIZE + i);
  const allSelected = pageIdxs.length > 0 && pageIdxs.every(i => selectedIdx.has(i));

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden bg-[#080d12]"
          style={{ fontFamily: C.font, color: C.text }}>

          {/* Dot-grid */}
          <div className="fixed inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
            backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
          }} />

          {/* ── Header ── */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b bg-[#080d12]"
            style={{ borderColor: C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest rounded-none hover:bg-transparent"
              style={{ color: C.dim }}>Home</Button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Taskflow</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Lead Scrapping</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>AI Powered</span>
            </div>
          </header>

          {/* ── Title bar ── */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b bg-[#0d1117]"
            style={{ borderColor: C.border }}>
            <div className="flex h-8 w-8 items-center justify-center border"
              style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <Sparkles className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Lead Scrapping</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                AI-powered business lead discovery · Import directly to Customer Database
              </p>
            </div>
          </div>

          {/* ── Search panel ── */}
          <div className="relative z-10 shrink-0 border-b" style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="px-4 py-4 space-y-3">

              {/* Mode toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.dim }}>Mode:</span>
                {[
                  { value: "web", label: "Web Search", icon: Globe, hint: "Serper (Google) searches, Groq extracts" },
                  { value: "ai",  label: "AI Generate", icon: Zap,   hint: "Groq generates from knowledge base" },
                ].map(m => (
                  <button key={m.value} onClick={() => setMode(m.value as any)}
                    title={m.hint}
                    className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                    style={{
                      borderColor: mode === m.value ? C.accent : C.border,
                      backgroundColor: mode === m.value ? "rgba(232,99,10,0.1)" : "transparent",
                      color: mode === m.value ? C.accent : C.dim,
                    }}>
                    <m.icon className="size-3" />{m.label}
                  </button>
                ))}
                {mode === "ai" && (
                  <span className="text-[9px] px-2 py-0.5 border" style={{ borderColor: "#fbbf2440", color: "#fbbf24", backgroundColor: "rgba(251,191,36,0.08)" }}>
                    AI-generated — verify before use
                  </span>
                )}
              </div>

              {/* Main query */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
                  <input
                    placeholder='e.g. "electrical supply companies in Cebu" or "construction firms Davao"'
                    value={query}
                    onChange={e => setQuery(e.target.value)}
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
                  {isSearching
                    ? <><Loader2 className="size-3 animate-spin" /> Searching…</>
                    : <><Search className="size-3" /> Search</>}
                </button>
              </div>

              {/* Filters row */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Industry */}
                <select value={industry} onChange={e => setIndustry(e.target.value)}
                  className="h-8 text-[11px] px-2 focus:outline-none"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: industry ? C.text : C.dim, fontFamily: C.font }}>
                  <option value="">All Industries</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>

                {/* Location */}
                <select value={location} onChange={e => setLocation(e.target.value)}
                  className="h-8 text-[11px] px-2 focus:outline-none"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: location ? C.text : C.dim, fontFamily: C.font }}>
                  <option value="">All Locations</option>
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>

                {/* Limit */}
                <select value={limit} onChange={e => setLimit(+e.target.value)}
                  className="h-8 text-[11px] px-2 focus:outline-none"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                  {[5,10,15,20,30].map(n => <option key={n} value={n}>{n} results</option>)}
                </select>

                {(industry || location) && (
                  <button onClick={() => { setIndustry(""); setLocation(""); }}
                    className="flex items-center gap-1 h-8 px-2 text-[10px] transition-colors"
                    style={{ color: C.dim }}
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
                        Import ({selectedIdx.size})
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
                  <div className="h-12 w-12 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: C.accent, borderTopColor: "transparent" }} />
                  <Sparkles className="absolute inset-0 m-auto size-5" style={{ color: C.accent }} />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest animate-pulse" style={{ color: C.accent }}>
                    {mode === "web" ? "Searching the web…" : "Generating leads with AI…"}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: C.muted }}>
                    {mode === "web" ? "Serper (Google) searching · Groq extracting" : "Groq llama-3.3-70b generating"}
                  </p>
                </div>
              </div>
            ) : !hasSearched ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center border"
                  style={{ borderColor: C.border, backgroundColor: "rgba(232,99,10,0.05)" }}>
                  <Sparkles className="size-8 opacity-40" style={{ color: C.accent }} />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest" style={{ color: C.text }}>AI Lead Discovery</p>
                  <p className="text-[11px] mt-2 max-w-md" style={{ color: C.muted }}>
                    Search for businesses by industry and location. The AI will find company names, contact persons, phone numbers, emails, and addresses.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]" style={{ color: C.dim }}>
                  {[
                    "electrical supply companies in Cebu",
                    "construction firms in Davao",
                    "hardware stores Metro Manila",
                    "food manufacturers Laguna",
                  ].map(ex => (
                    <button key={ex} onClick={() => setQuery(ex)}
                      className="px-3 py-2 border text-left transition-colors"
                      style={{ borderColor: C.border, backgroundColor: "transparent" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                      "{ex}"
                    </button>
                  ))}
                </div>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Search className="size-8 opacity-20" style={{ color: C.dim }} />
                <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No leads found. Try a different query.</p>
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
                  <div className="flex-1 min-w-[160px]">Company</div>
                  <div className="w-36 hidden md:block">Contact Person</div>
                  <div className="w-36 hidden lg:block">Phone</div>
                  <div className="w-44 hidden lg:block">Email</div>
                  <div className="flex-1 hidden xl:block">Address</div>
                  <div className="w-24 hidden md:block">Industry</div>
                  <div className="w-20">Confidence</div>
                  <div className="w-8" />
                </div>

                {/* Rows */}
                {paginated.map((lead, pi) => {
                  const globalIdx = (page-1)*PAGE_SIZE + pi;
                  const selected  = selectedIdx.has(globalIdx);
                  return (
                    <div key={globalIdx}
                      className="flex items-start gap-3 px-4 py-3 border-b cursor-pointer transition-colors"
                      style={{
                        borderColor: C.muted + "30",
                        backgroundColor: selected ? "rgba(232,99,10,0.06)" : pi%2===0 ? C.bg : C.panel,
                      }}
                      onClick={() => toggleSelect(globalIdx)}
                      onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.03)"; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = selected ? "rgba(232,99,10,0.06)" : pi%2===0 ? C.bg : C.panel; }}>

                      <div className="w-5 mt-0.5" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selected} onCheckedChange={() => toggleSelect(globalIdx)}
                          className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 h-3.5 w-3.5" />
                      </div>

                      <div className="w-5 text-center text-[10px] mt-0.5" style={{ color: C.muted }}>
                        {globalIdx + 1}
                      </div>

                      {/* Company */}
                      <div className="flex-1 min-w-[160px]">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="size-3 shrink-0" style={{ color: C.accent }} />
                          <span className="text-[11px] font-bold" style={{ color: C.text }}>{lead.company_name || "—"}</span>
                        </div>
                        {lead.website && (
                          <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-[9px] mt-0.5 hover:underline"
                            style={{ color: C.dim }}>
                            <ExternalLink className="size-2.5" />{lead.website}
                          </a>
                        )}
                      </div>

                      {/* Contact person */}
                      <div className="w-36 hidden md:block">
                        {lead.contact_person ? (
                          <div className="flex items-center gap-1">
                            <User className="size-3 shrink-0" style={{ color: C.dim }} />
                            <span className="text-[11px]" style={{ color: C.text }}>{lead.contact_person}</span>
                          </div>
                        ) : <span style={{ color: C.muted }}>—</span>}
                      </div>

                      {/* Phone */}
                      <div className="w-36 hidden lg:block">
                        {lead.contact_number ? (
                          <div className="flex items-center gap-1">
                            <Phone className="size-3 shrink-0" style={{ color: C.dim }} />
                            <span className="text-[11px] font-mono" style={{ color: C.text }}>{lead.contact_number}</span>
                          </div>
                        ) : <span style={{ color: C.muted }}>—</span>}
                      </div>

                      {/* Email */}
                      <div className="w-44 hidden lg:block">
                        {lead.email_address ? (
                          <div className="flex items-center gap-1">
                            <Mail className="size-3 shrink-0" style={{ color: C.dim }} />
                            <span className="text-[11px] truncate" style={{ color: C.text }}>{lead.email_address}</span>
                          </div>
                        ) : <span style={{ color: C.muted }}>—</span>}
                      </div>

                      {/* Address */}
                      <div className="flex-1 hidden xl:block">
                        {lead.address ? (
                          <div className="flex items-start gap-1">
                            <MapPin className="size-3 shrink-0 mt-0.5" style={{ color: C.dim }} />
                            <span className="text-[11px]" style={{ color: C.dim }}>{lead.address}</span>
                          </div>
                        ) : <span style={{ color: C.muted }}>—</span>}
                      </div>

                      {/* Industry */}
                      <div className="w-24 hidden md:block">
                        <span className="text-[10px]" style={{ color: C.dim }}>{lead.industry || "—"}</span>
                      </div>

                      {/* Confidence */}
                      <div className="w-20">
                        <ConfidenceBadge level={lead.confidence} />
                      </div>

                      {/* Source link */}
                      <div className="w-8 flex items-center justify-center">
                        {lead.source && lead.source.startsWith("http") && (
                          <a href={lead.source} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            title={lead.source}>
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

          {/* ── Footer / Pagination ── */}
          {leads.length > 0 && (
            <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-2 border-t"
              style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <span className="text-[10px]" style={{ color: C.muted }}>
                <span style={{ color: C.text }}>{leads.length}</span> leads found
                {selectedIdx.size > 0 && <span style={{ color: C.accent }}> · {selectedIdx.size} selected</span>}
              </span>
              <div className="flex items-center gap-1" style={{ fontSize: "11px" }}>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                  className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                  style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                  onMouseEnter={e => { if (page>1) { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent; }}}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.dim; }}>
                  <ChevronLeft className="size-3" /> Prev
                </button>
                {Array.from({length: Math.min(totalPages,7)}, (_,i) => {
                  let p: number;
                  if (totalPages<=7)           p = i+1;
                  else if (page<=4)            p = i+1;
                  else if (page>=totalPages-3) p = totalPages-6+i;
                  else                         p = page-3+i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className="h-7 w-7 border text-[10px] font-bold transition-colors"
                      style={{ backgroundColor: p===page?C.accent:"transparent", borderColor: p===page?C.accent:C.border, color: p===page?"#080d12":C.dim }}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                  className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                  style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                  onMouseEnter={e => { if (page<totalPages) { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent; }}}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.dim; }}>
                  Next <ChevronRight className="size-3" />
                </button>
              </div>
            </div>
          )}

        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
