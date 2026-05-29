"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, Briefcase,
  MapPin, ChevronDown, ChevronUp, Plus, Pencil, Trash2, ArrowRightLeft,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import type { JobPosting } from "@/app/api/recruitment/jobs/route";

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
  if (s === "active" || s === "open")
    return { color: "#34d399", border: "#34d39940", bg: "rgba(52,211,153,0.08)" };
  if (s === "closed" || s === "inactive")
    return { color: "#f87171", border: "#f8717140", bg: "rgba(248,113,113,0.08)" };
  if (s === "draft")
    return { color: "#fbbf24", border: "#fbbf2440", bg: "rgba(251,191,36,0.08)" };
  return { color: C.dim, border: C.muted, bg: "transparent" };
}

const JOB_TYPE_COLOR: Record<string, string> = {
  "full-time":  "#60a5fa",
  "part-time":  "#a78bfa",
  "contract":   "#fbbf24",
  "freelance":  "#f59e0b",
  "internship": "#34d399",
  "remote":     "#818cf8",
};

const STATUS_OPTIONS = ["Active", "Draft", "Closed", "Inactive"];
const JOB_TYPE_OPTIONS = ["Full-Time", "Part-Time", "Contract", "Freelance", "Internship", "Remote"];
const PAGE_SIZE = 15;

// ─── Empty form ───────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title:          "",
  category:       "",
  jobType:        "",
  location:       "",
  qualifications: [""],
  status:         "Draft",
};

// ─── Job Form Dialog ──────────────────────────────────────────────────────────
function JobFormDialog({
  open, onClose, onSaved, editJob,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editJob: JobPosting | null;
}) {
  const [form,    setForm]    = useState({ ...EMPTY_FORM });
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editJob) {
      setForm({
        title:          editJob.title,
        category:       editJob.category,
        jobType:        editJob.jobType,
        location:       editJob.location,
        qualifications: editJob.qualifications.length > 0 ? editJob.qualifications : [""],
        status:         editJob.status,
      });
    } else {
      setForm({ ...EMPTY_FORM, qualifications: [""] });
    }
  }, [open, editJob]);

  const setField = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const setQual = (i: number, val: string) =>
    setForm(p => { const q = [...p.qualifications]; q[i] = val; return { ...p, qualifications: q }; });

  const addQual    = () => setForm(p => ({ ...p, qualifications: [...p.qualifications, ""] }));
  const removeQual = (i: number) =>
    setForm(p => ({ ...p, qualifications: p.qualifications.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        qualifications: form.qualifications.filter(q => q.trim()),
        ...(editJob ? { id: editJob.id } : {}),
      };
      const url    = editJob ? "/api/recruitment/jobs/update" : "/api/recruitment/jobs/create";
      const method = editJob ? "PATCH" : "POST";
      const res    = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(editJob ? "Job updated" : "Job created");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl border flex flex-col"
        style={{ backgroundColor: C.panel, borderColor: C.border, fontFamily: C.font, maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
          style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <div className="flex items-center gap-2">
            <Briefcase className="size-3.5" style={{ color: C.accent }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
              {editJob ? "Edit Job Posting" : "New Job Posting"}
            </span>
          </div>
          <button onClick={onClose}><X className="size-4" style={{ color: C.dim }} /></button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">

          {/* Title */}
          <Field label="Job Title *" value={form.title} onChange={v => setField("title", v)} placeholder="e.g. Senior Software Engineer" />

          {/* Category + Job Type */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" value={form.category} onChange={v => setField("category", v)} placeholder="e.g. Engineering" />
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Job Type</label>
              <select value={form.jobType} onChange={e => setField("jobType", e.target.value)}
                className="w-full h-8 px-2 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: form.jobType ? C.text : C.dim, fontFamily: C.font }}>
                <option value="">Select type…</option>
                {JOB_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Location + Status */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location" value={form.location} onChange={v => setField("location", v)} placeholder="e.g. Cebu City, Philippines" />
            <div className="space-y-1">
              <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>Status</label>
              <select value={form.status} onChange={e => setField("status", e.target.value)}
                className="w-full h-8 px-2 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Qualifications */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>
                Qualifications
              </label>
              <button onClick={addQual}
                className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors"
                style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                <Plus className="size-3" /> Add
              </button>
            </div>
            <div className="space-y-1.5">
              {form.qualifications.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[9px] shrink-0 w-4 text-right" style={{ color: C.muted }}>{i + 1}.</span>
                  <input
                    value={q} onChange={e => setQual(i, e.target.value)}
                    placeholder={`Qualification ${i + 1}`}
                    className="flex-1 h-7 px-2 text-[10px] focus:outline-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                  {form.qualifications.length > 1 && (
                    <button onClick={() => removeQual(i)}>
                      <X className="size-3.5" style={{ color: C.dim }}
                        onMouseEnter={(e: any) => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={(e: any) => (e.currentTarget.style.color = C.dim)} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t shrink-0 flex items-center justify-end gap-2"
          style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <button onClick={onClose}
            className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors"
            style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors disabled:opacity-40"
            style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
            {saving ? <Loader2 className="size-3 animate-spin" /> : null}
            {saving ? "Saving…" : editJob ? "Save Changes" : "Create Job"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-8 px-2 text-[11px] focus:outline-none"
        style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
        onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
        onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RecruitmentJobsPage() {
  const router = useRouter();

  const [jobs,         setJobs]         = useState<JobPosting[]>([]);
  const [filtered,     setFiltered]     = useState<JobPosting[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter,   setTypeFilter]   = useState("");
  const [page,         setPage]         = useState(1);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // Form dialog
  const [formOpen,  setFormOpen]  = useState(false);
  const [editJob,   setEditJob]   = useState<JobPosting | null>(null);

  // Delete confirm
  const [deleteJob,    setDeleteJob]    = useState<JobPosting | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // Migrate
  const [migrateOpen,    setMigrateOpen]    = useState(false);
  const [migrating,      setMigrating]      = useState(false);
  const [migrateResult,  setMigrateResult]  = useState<{ migrated: number; total: number; errors?: string[] } | null>(null);

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrateResult(null);
    try {
      const res  = await fetch("/api/recruitment/jobs/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMigrateResult({ migrated: json.migrated, total: json.total, errors: json.errors });
      toast.success(json.message);
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message ?? "Migration failed");
    } finally {
      setMigrating(false);
    }
  };

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/recruitment/jobs", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setJobs(json.data ?? []);
    } catch (err: any) {
      toast.error("Failed to load jobs: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // ── Client-side filter ───────────────────────────────────────────────────
  useEffect(() => {
    let r = [...jobs];
    if (statusFilter) r = r.filter(j => j.status.toLowerCase() === statusFilter.toLowerCase());
    if (typeFilter)   r = r.filter(j => j.jobType.toLowerCase() === typeFilter.toLowerCase());
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.category.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        j.jobType.toLowerCase().includes(q) ||
        j.qualifications.some(qf => qf.toLowerCase().includes(q))
      );
    }
    setFiltered(r);
    setPage(1);
  }, [jobs, search, statusFilter, typeFilter]);

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteJob) return;
    setDeleting(true);
    try {
      const res  = await fetch("/api/recruitment/jobs/delete", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteJob.id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Job deleted");
      setDeleteJob(null);
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allStatuses = [...new Set(jobs.map(j => j.status).filter(Boolean))].sort();
  const allTypes    = [...new Set(jobs.map(j => j.jobType).filter(Boolean))].sort();
  const activeCount = jobs.filter(j => ["active","open"].includes(j.status.toLowerCase())).length;
  const closedCount = jobs.filter(j => ["closed","inactive"].includes(j.status.toLowerCase())).length;
  const draftCount  = jobs.filter(j => j.status.toLowerCase() === "draft").length;

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
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Recruitment</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Job Postings</BreadcrumbPage>
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
              <Briefcase className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Job Postings</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Firebase · careers · {jobs.length} total
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={fetchJobs}
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
              <button onClick={() => { setEditJob(null); setFormOpen(true); }}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.accent, color: C.accent, backgroundColor: "rgba(232,99,10,0.1)" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)"; }}>
                <Plus className="size-3" /> New Job
              </button>
            </div>
          </div>

          {/* ── Stats bar ── */}
          <div className="relative z-10 shrink-0 grid grid-cols-4 border-b" style={{ borderColor: C.border }}>
            {[
              { label: "Total",  value: jobs.length,   color: C.accent },
              { label: "Active", value: activeCount,   color: "#34d399" },
              { label: "Closed", value: closedCount,   color: "#f87171" },
              { label: "Draft",  value: draftCount,    color: "#fbbf24" },
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
              <input placeholder="Search title, category, location…" value={search}
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
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: typeFilter ? C.text : C.dim, fontFamily: C.font }}>
              <option value="">All Types</option>
              {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(statusFilter || typeFilter) && (
              <button onClick={() => { setStatusFilter(""); setTypeFilter(""); }}
                className="flex items-center gap-1 h-8 px-2 text-[10px] transition-colors" style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                <X className="size-3" /> Clear
              </button>
            )}
            <div className="ml-auto text-[10px]" style={{ color: C.muted }}>
              <span style={{ color: C.text }}>{filtered.length}</span> jobs
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
                <Briefcase className="size-8 opacity-20" style={{ color: C.accent }} />
                <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No job postings found</p>
                <button onClick={() => { setEditJob(null); setFormOpen(true); }}
                  className="flex items-center gap-2 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                  style={{ borderColor: C.accent, color: C.accent, backgroundColor: "rgba(232,99,10,0.1)" }}>
                  <Plus className="size-3" /> Create First Job
                </button>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b sticky top-0 z-10" style={{ borderColor: C.border, backgroundColor: C.panel }}>
                    {["Title", "Category", "Job Type", "Location", "Status", "Qualifications", "Created", "Updated", ""].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest whitespace-nowrap"
                        style={{ color: C.accent }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((job, i) => {
                    const st         = statusStyle(job.status);
                    const typeColor  = JOB_TYPE_COLOR[job.jobType.toLowerCase()] ?? C.dim;
                    const isExpanded = expandedId === job.id;
                    return (
                      <React.Fragment key={job.id}>
                        <tr className="border-b transition-colors"
                          style={{ borderColor: C.muted + "30", backgroundColor: i % 2 === 0 ? C.bg : C.panel }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.03)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>

                          {/* Title — click to expand */}
                          <td className="px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : job.id)}>
                            <div className="flex items-center gap-2">
                              {isExpanded
                                ? <ChevronUp className="size-3 shrink-0" style={{ color: C.accent }} />
                                : <ChevronDown className="size-3 shrink-0" style={{ color: C.dim }} />}
                              <span className="text-[11px] font-bold" style={{ color: C.text }}>{job.title || "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className="text-[10px]" style={{ color: C.dim }}>{job.category || "—"}</span></td>
                          <td className="px-4 py-3">
                            {job.jobType
                              ? <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 border"
                                  style={{ borderColor: typeColor + "40", color: typeColor, backgroundColor: typeColor + "10" }}>{job.jobType}</span>
                              : <span style={{ color: C.muted }}>—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {job.location && <MapPin className="size-3 shrink-0" style={{ color: C.dim }} />}
                              <span className="text-[10px]" style={{ color: C.dim }}>{job.location || "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 border"
                              style={{ borderColor: st.border, color: st.color, backgroundColor: st.bg }}>{job.status || "—"}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-mono" style={{ color: C.dim }}>
                              {job.qualifications.length > 0 ? `${job.qualifications.length} item${job.qualifications.length !== 1 ? "s" : ""}` : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3"><span className="text-[10px] font-mono whitespace-nowrap" style={{ color: C.muted }}>{formatDate(job.createdAt)}</span></td>
                          <td className="px-4 py-3"><span className="text-[10px] font-mono whitespace-nowrap" style={{ color: C.muted }}>{formatDate(job.updatedAt)}</span></td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={e => { e.stopPropagation(); setEditJob(job); setFormOpen(true); }}
                                className="flex items-center justify-center h-6 w-6 border transition-colors"
                                style={{ borderColor: C.border, backgroundColor: "transparent" }}
                                title="Edit"
                                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <Pencil className="size-3" style={{ color: C.accent }} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setDeleteJob(job); }}
                                className="flex items-center justify-center h-6 w-6 border transition-colors"
                                style={{ borderColor: C.border, backgroundColor: "transparent" }}
                                title="Delete"
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.1)"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <Trash2 className="size-3" style={{ color: "#f87171" }} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded qualifications */}
                        {isExpanded && (
                          <tr key={`${job.id}-exp`} style={{ backgroundColor: "rgba(232,99,10,0.03)" }}>
                            <td colSpan={9} className="px-8 py-3 border-b" style={{ borderColor: C.muted + "30" }}>
                              <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.accent }}>Qualifications</p>
                              {job.qualifications.length === 0
                                ? <p className="text-[10px]" style={{ color: C.muted }}>No qualifications listed</p>
                                : <ul className="space-y-1">
                                    {job.qualifications.map((q, qi) => (
                                      <li key={qi} className="flex items-start gap-2">
                                        <span className="text-[9px] mt-0.5 shrink-0" style={{ color: C.accent }}>▸</span>
                                        <span className="text-[10px]" style={{ color: C.text }}>{q}</span>
                                      </li>
                                    ))}
                                  </ul>}
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

      {/* ── Create / Edit Dialog ── */}
      <JobFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditJob(null); }}
        onSaved={fetchJobs}
        editJob={editJob}
      />

      {/* ── Delete Confirm ── */}
      {deleteJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="w-full max-w-sm border" style={{ backgroundColor: C.panel, borderColor: "#f8717140", fontFamily: C.font }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <div className="flex items-center gap-2">
                <Trash2 className="size-4" style={{ color: "#f87171" }} />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#f87171" }}>Delete Job</span>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px]" style={{ color: C.text }}>
                Delete <span className="font-bold" style={{ color: "#f87171" }}>{deleteJob.title}</span>?
              </p>
              <p className="text-[10px] mt-1" style={{ color: C.muted }}>This cannot be undone.</p>
            </div>
            <div className="px-5 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <button onClick={() => setDeleteJob(null)}
                className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors disabled:opacity-40"
                style={{ borderColor: "#f87171", color: "#fff", backgroundColor: "#f87171" }}>
                {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Migrate Alert Dialog ── */}
      {migrateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="w-full max-w-md border flex flex-col" style={{ backgroundColor: C.panel, borderColor: "#60a5fa40", fontFamily: C.font }}>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <ArrowRightLeft className="size-4 shrink-0" style={{ color: "#60a5fa" }} />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#60a5fa" }}>Migrate Previous Data</p>
                <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>Copy jobs from old Firebase to new credentials</p>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              {/* Warning */}
              <div className="flex items-start gap-2 px-3 py-2.5 border" style={{ borderColor: "#fbbf2440", backgroundColor: "rgba(251,191,36,0.05)" }}>
                <span className="text-[10px] font-bold shrink-0" style={{ color: "#fbbf24" }}>⚠</span>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold" style={{ color: "#fbbf24" }}>This will copy all jobs from the old Firebase project</p>
                  <p className="text-[9px]" style={{ color: C.dim }}>
                    Source: <span className="font-mono" style={{ color: C.text }}>taskflow-4605f</span> → careers
                  </p>
                  <p className="text-[9px]" style={{ color: C.dim }}>
                    Destination: your currently saved Firebase credentials
                  </p>
                  <p className="text-[9px] mt-1" style={{ color: C.muted }}>
                    Existing jobs in the destination will NOT be deleted. Duplicates may appear if you run this multiple times.
                  </p>
                </div>
              </div>

              {/* Result */}
              {migrateResult && (
                <div className="px-3 py-2.5 border" style={{
                  borderColor: migrateResult.errors?.length ? "#f8717140" : "#34d39940",
                  backgroundColor: migrateResult.errors?.length ? "rgba(248,113,113,0.05)" : "rgba(52,211,153,0.05)",
                }}>
                  <p className="text-[10px] font-bold" style={{ color: migrateResult.errors?.length ? "#f87171" : "#34d399" }}>
                    ✓ Migrated {migrateResult.migrated} of {migrateResult.total} job(s)
                  </p>
                  {migrateResult.errors && migrateResult.errors.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {migrateResult.errors.map((e, i) => (
                        <li key={i} className="text-[9px] font-mono" style={{ color: "#f87171" }}>✗ {e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <button
                onClick={() => { setMigrateOpen(false); setMigrateResult(null); }}
                className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                {migrateResult ? "Close" : "Cancel"}
              </button>
              {!migrateResult && (
                <button
                  onClick={handleMigrate}
                  disabled={migrating}
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
