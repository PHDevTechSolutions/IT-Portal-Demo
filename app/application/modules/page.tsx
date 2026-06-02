"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { Pagination } from "@/components/app-pagination";
import { toast } from "sonner";
import {
  Star, ExternalLink, Search, ChevronRight,
  Globe, Database, Server, ShoppingCart, Zap,
  Plus, Pencil, Trash2, Loader2, X, Save,
} from "lucide-react";

/* ─── Tokens ─────────────────────────────────────────────────────── */
const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  muted:  "#253040",
  dim:    "#4a6070",
  text:   "#c8d8e8",
  accent: "#e8630a",
  font:   "'JetBrains Mono','Fira Code',monospace",
};

/* ─── Types ──────────────────────────────────────────────────────── */
interface Module {
  _id:         string;
  title:       string;
  description: string;
  url:         string;
  category:    string;
  order:       number;
}

type FormData = Omit<Module, "_id" | "order"> & { order: string };

const EMPTY_FORM: FormData = {
  title: "", description: "", url: "", category: "Internal", order: "99",
};

const CATEGORIES = ["Internal","Company","E-Commerce","DevOps","Database"];

const CAT_ICON: Record<string, React.ElementType> = {
  Internal: Zap, Company: Globe, "E-Commerce": ShoppingCart,
  DevOps: Server, Database: Database,
};
const CAT_COLOR: Record<string, string> = {
  Internal: "#e8630a", Company: "#34d399", "E-Commerce": "#f59e0b",
  DevOps: "#60a5fa", Database: "#a78bfa",
};

const ROWS = 12;
const API  = "/api/Data/Applications/Modules";

/* ─── Form Dialog ────────────────────────────────────────────────── */
function ModuleForm({
  open, onClose, initial, onSaved,
}: {
  open:     boolean;
  onClose:  () => void;
  initial:  (Module & { _id: string }) | null; // null = create
  onSaved:  (m: Module) => void;
}) {
  const [form,    setForm]    = useState<FormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial
      ? { title: initial.title, description: initial.description,
          url: initial.url, category: initial.category,
          order: String(initial.order) }
      : EMPTY_FORM
    );
  }, [open, initial]);

  const set = (k: keyof FormData, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) {
      toast.error("Title and URL are required."); return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        order: Number(form.order) || 99,
        ...(initial ? { _id: initial._id } : {}),
      };
      const res  = await fetch(API, {
        method:  initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(initial ? "Module updated." : "Module created.");
      onSaved({ ...payload, _id: initial?._id ?? json.id, order: Number(form.order) || 99 } as Module);
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Save failed.");
    } finally { setLoading(false); }
  };

  if (!open) return null;

  const inp = (label: string, k: keyof FormData, type = "text", ph = "") => (
    <div className="space-y-1">
      <label className="text-[9px] font-bold uppercase tracking-widest"
        style={{ color: C.dim, fontFamily: C.font }}>{label}</label>
      <input type={type} placeholder={ph} value={form[k] as string}
        onChange={e => set(k, e.target.value)} required={k === "title" || k === "url"}
        className="w-full h-8 px-3 text-[11px] focus:outline-none"
        style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
        onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
        onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(8,13,18,0.85)" }}>
      <div className="w-full max-w-md border overflow-hidden"
        style={{ borderColor: C.border, backgroundColor: C.panel, fontFamily: C.font }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <div className="flex items-center gap-2">
            {initial ? <Pencil className="size-3.5" style={{ color: C.accent }} />
                     : <Plus   className="size-3.5" style={{ color: C.accent }} />}
            <span className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: C.accent }}>
              {initial ? "Edit Module" : "New Module"}
            </span>
          </div>
          <button onClick={onClose} disabled={loading}
            className="flex items-center justify-center h-5 w-5 transition-colors"
            style={{ color: C.dim }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
            <X className="size-3" />
          </button>
        </div>
        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {inp("Title *",       "title",       "text",   "e.g. Taskflow")}
          {inp("URL *",         "url",         "url",    "https://")}
          {inp("Description",   "description", "text",   "Short description")}
          {inp("Order",         "order",       "number", "1")}
          {/* Category */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: C.dim }}>Category</label>
            <select value={form.category} onChange={e => set("category", e.target.value)}
              className="w-full h-8 px-3 text-[11px] focus:outline-none"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-1.5 h-8 px-5 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
              style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
              {loading ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {loading ? "Saving…" : initial ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function ModulesPage() {
  const router = useRouter();

  const [modules,       setModules]       = useState<Module[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [visitCounts,   setVisitCounts]   = useState<Record<string, number>>({});
  const [lastVisitedUrl,setLastVisitedUrl] = useState<string | null>(null);
  const [search,        setSearch]        = useState("");
  const [category,      setCategory]      = useState("All");
  const [page,          setPage]          = useState(1);
  const [formOpen,      setFormOpen]      = useState(false);
  const [editing,       setEditing]       = useState<Module | null>(null);
  const [deleting,      setDeleting]      = useState<string | null>(null);

  /* ── Load ── */
  useEffect(() => {
    const counts  = localStorage.getItem("visitCounts");
    const lastUrl = localStorage.getItem("lastVisitedUrl");
    if (counts)  setVisitCounts(JSON.parse(counts));
    if (lastUrl) setLastVisitedUrl(lastUrl);

    fetch(API).then(r => r.json()).then(d => {
      if (d.success) setModules(d.data);
    }).catch(() => toast.error("Failed to load modules."))
      .finally(() => setIsLoading(false));
  }, []);

  /* ── Visit ── */
  const handleVisit = (url: string) => {
    window.open(url, "_blank", "noopener noreferrer");
    setVisitCounts(prev => {
      const next = { ...prev, [url]: (prev[url] || 0) + 1 };
      localStorage.setItem("visitCounts", JSON.stringify(next));
      return next;
    });
    setLastVisitedUrl(url);
    localStorage.setItem("lastVisitedUrl", url);
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res  = await fetch(API, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _id: id }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setModules(prev => prev.filter(m => m._id !== id));
      toast.success("Module deleted.");
    } catch (err: any) { toast.error(err.message ?? "Delete failed."); }
    finally { setDeleting(null); }
  };

  /* ── After save ── */
  const handleSaved = (saved: Module) => {
    setModules(prev => {
      const idx = prev.findIndex(m => m._id === saved._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
      }
      return [...prev, saved].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    });
  };

  /* ── Top 5 ── */
  const topVisited = useMemo(() =>
    Object.entries(visitCounts)
      .sort(([,a],[,b]) => b - a).slice(0, 5)
      .map(([url]) => modules.find(m => m.url === url))
      .filter((m): m is Module => !!m),
    [visitCounts, modules]);

  /* ── Filter ── */
  const allCats = ["All", ...Array.from(new Set(modules.map(m => m.category)))];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return modules
      .filter(m => category === "All" || m.category === category)
      .filter(m => !q || m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
  }, [modules, search, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS));
  const paginated  = filtered.slice((page - 1) * ROWS, page * ROWS);
  useEffect(() => setPage(1), [search, category]);

  return (
    <UserProvider><FormatProvider><ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden"
          style={{ backgroundColor: C.bg, color: C.text, fontFamily: C.font }}>

          {/* Header */}
          <header className="relative flex h-12 shrink-0 items-center border-b overflow-hidden"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="absolute bottom-0 left-0 w-full h-px"
              style={{ background: `linear-gradient(to right,transparent,${C.accent}50,transparent)` }} />
            <div className="flex items-center gap-2 px-4 relative z-10">
              <SidebarTrigger className="-ml-1" style={{ color: C.dim }} />
              <button onClick={() => router.push("/dashboard")}
                className="text-xs hidden sm:flex font-mono px-2 py-1 transition-colors" style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>Home</button>
              <Separator orientation="vertical" className="h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#" className="text-xs hidden sm:block font-mono uppercase tracking-wider" style={{ color: C.dim }}>
                      Applications
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator><ChevronRight size={10} style={{ color: C.muted }} /></BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-mono tracking-widest uppercase" style={{ color: C.accent }}>
                      Modules
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex gap-3 px-4 py-4 min-h-0">

            {/* Left: Top 5 */}
            <div className="w-60 shrink-0 flex flex-col border overflow-hidden"
              style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
                style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <Star className="size-3.5" style={{ color: "#fbbf24" }} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                  Top 5 Visited
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {topVisited.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
                    <Star className="size-7 opacity-10" style={{ color: C.accent }} />
                    <p className="text-[10px] font-mono" style={{ color: C.dim }}>No visits yet.</p>
                  </div>
                ) : topVisited.map((m, i) => {
                  const Icon  = CAT_ICON[m.category] ?? Globe;
                  const color = CAT_COLOR[m.category] ?? C.accent;
                  return (
                    <button key={m._id} onClick={() => handleVisit(m.url)}
                      className="w-full flex items-start gap-2 px-3 py-2.5 border-b text-left transition-colors"
                      style={{ borderColor: C.border, backgroundColor: "transparent" }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center border mt-0.5"
                        style={{ borderColor: color + "40", backgroundColor: color + "10" }}>
                        <Icon className="size-3" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold truncate" style={{ color: C.text }}>{m.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="size-2.5" style={{ color: "#fbbf24" }} />
                          <span className="text-[9px] font-mono" style={{ color: C.dim }}>
                            {visitCounts[m.url] ?? 0} visit{(visitCounts[m.url] ?? 0) !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono shrink-0 mt-1" style={{ color: C.muted }}>#{i + 1}</span>
                    </button>
                  );
                })}
              </div>
              {lastVisitedUrl && (
                <div className="shrink-0 border-t px-3 py-2" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                  <p className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>Last visited</p>
                  <p className="text-[9px] font-mono truncate mt-0.5" style={{ color: C.dim }}>
                    {modules.find(m => m.url === lastVisitedUrl)?.title ?? lastVisitedUrl}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Table */}
            <div className="flex-1 flex flex-col border overflow-hidden min-w-0"
              style={{ borderColor: C.border, backgroundColor: C.panel }}>

              {/* Toolbar */}
              <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b flex-wrap"
                style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 size-3.5" style={{ color: C.dim }} />
                  <input placeholder="Search modules…" value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 h-8 text-[11px] focus:outline-none"
                    style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {allCats.map(cat => {
                    const active = category === cat;
                    const color  = cat === "All" ? C.accent : (CAT_COLOR[cat] ?? C.accent);
                    return (
                      <button key={cat} onClick={() => setCategory(cat)}
                        className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border transition-colors"
                        style={{ borderColor: active ? color : C.border, color: active ? color : C.dim, backgroundColor: active ? color + "15" : "transparent" }}>
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-[9px] font-mono" style={{ color: C.dim }}>{filtered.length} modules</span>
                  <button onClick={() => { setEditing(null); setFormOpen(true); }}
                    className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                    style={{ backgroundColor: "rgba(232,99,10,0.1)", borderColor: C.accent, color: C.accent }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.2)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)")}>
                    <Plus className="size-3" /> New Module
                  </button>
                  <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full gap-2">
                    <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                    <span className="text-[10px] uppercase tracking-widest" style={{ color: C.dim }}>Loading…</span>
                  </div>
                ) : paginated.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <Search className="size-7 opacity-10" style={{ color: C.accent }} />
                    <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.dim }}>No results found</p>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-[11px]" style={{ fontFamily: C.font }}>
                    <thead className="sticky top-0 z-10">
                      <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                        {["#","Module","Category","Description","Visits","Actions"].map((h, i) => (
                          <th key={h} className={`px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest ${i === 5 ? "text-right" : "text-left"}`}
                            style={{ color: `${C.accent}99`, borderRight: i < 5 ? `1px solid ${C.border}` : undefined }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((m, i) => {
                        const Icon  = CAT_ICON[m.category] ?? Globe;
                        const color = CAT_COLOR[m.category] ?? C.accent;
                        const visits = visitCounts[m.url] ?? 0;
                        const rowIdx = (page - 1) * ROWS + i + 1;
                        return (
                          <tr key={m._id}
                            style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel, borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                            onClick={() => handleVisit(m.url)}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>
                            <td className="px-4 py-2.5 text-center" style={{ borderRight: `1px solid ${C.border}`, color: C.muted }}>{rowIdx}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              <p className="font-bold" style={{ color: C.text }}>{m.title}</p>
                              <p className="text-[9px] font-mono mt-0.5 truncate max-w-[160px]" style={{ color: C.dim }}>
                                {m.url.replace(/^https?:\/\//, "").split("/")[0]}
                              </p>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase border"
                                style={{ borderColor: color + "40", color, backgroundColor: color + "10" }}>
                                <Icon className="size-2.5" />{m.category}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 max-w-[220px]" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>
                              <p className="truncate">{m.description}</p>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                              {visits > 0
                                ? <span className="inline-flex items-center gap-1 text-[10px] font-mono" style={{ color: "#fbbf24" }}><Star className="size-3" />{visits}</span>
                                : <span className="text-[10px] font-mono" style={{ color: C.muted }}>—</span>}
                            </td>
                            <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button onClick={() => handleVisit(m.url)}
                                  className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase border transition-colors"
                                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                                  <ExternalLink className="size-2.5" /> Open
                                </button>
                                <button onClick={() => { setEditing(m); setFormOpen(true); }}
                                  className="flex items-center justify-center h-6 w-6 border transition-colors"
                                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                                  <Pencil className="size-3" />
                                </button>
                                <button onClick={() => handleDelete(m._id)} disabled={deleting === m._id}
                                  className="flex items-center justify-center h-6 w-6 border transition-colors disabled:opacity-40"
                                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                                  {deleting === m._id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

        </SidebarInset>
      </SidebarProvider>

      <ModuleForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        initial={editing}
        onSaved={handleSaved}
      />
    </ProtectedPageWrapper></FormatProvider></UserProvider>
  );
}
