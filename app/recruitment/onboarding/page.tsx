"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, ClipboardList,
  Mail, Briefcase, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Upload, FileText, ExternalLink, Paperclip,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import type { OnboardingRecord, ChecklistItem, DocumentAttachment } from "@/app/api/recruitment/onboarding/route";

// ─── Cloudinary config ────────────────────────────────────────────────────────
const CLOUD_NAME    = "dxnk3mexu";
const UPLOAD_PRESET = "linkerx_unsigned";

async function uploadToCloudinary(
  file: File,
  folder: string
): Promise<{ url: string; publicId: string; fileName: string }> {
  const isImage  = file.type.startsWith("image/");
  const endpoint = isImage ? "image" : "raw";
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${endpoint}/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Upload failed");
  }
  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id, fileName: file.name };
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

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function statusStyle(s: string) {
  if (s === "completed")   return { color: "#34d399", border: "#34d39940", bg: "rgba(52,211,153,0.08)",  label: "Completed" };
  if (s === "in_progress") return { color: "#fbbf24", border: "#fbbf2440", bg: "rgba(251,191,36,0.08)",  label: "In Progress" };
  return                          { color: "#60a5fa", border: "#60a5fa40", bg: "rgba(96,165,250,0.08)",  label: "Pending" };
}

const PAGE_SIZE = 15;

export default function OnboardingPage() {
  const router = useRouter();

  const [records,       setRecords]       = useState<OnboardingRecord[]>([]);
  const [filtered,      setFiltered]      = useState<OnboardingRecord[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [page,          setPage]          = useState(1);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [savingId,      setSavingId]      = useState<string | null>(null);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null); // "recordId::itemName"

  // Local checklist edits keyed by record id
  const [localChecklists, setLocalChecklists] = useState<Record<string, ChecklistItem[]>>({});
  // Local documents keyed by record id
  const [localDocs, setLocalDocs] = useState<Record<string, DocumentAttachment[]>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUpload = useRef<{ recordId: string; itemName: string } | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/recruitment/onboarding", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRecords(json.data ?? []);
      const initCL: Record<string, ChecklistItem[]>     = {};
      const initDocs: Record<string, DocumentAttachment[]> = {};
      (json.data ?? []).forEach((r: OnboardingRecord) => {
        initCL[r.id]   = [...r.checklist];
        initDocs[r.id] = [...(r.documents ?? [])];
      });
      setLocalChecklists(initCL);
      setLocalDocs(initDocs);
    } catch (err: any) {
      toast.error("Failed to load: " + err.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    let r = [...records];
    if (statusFilter) r = r.filter(x => x.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(x =>
        x.applicantName.toLowerCase().includes(q) ||
        x.jobTitle.toLowerCase().includes(q) ||
        x.applicantEmail.toLowerCase().includes(q)
      );
    }
    setFiltered(r); setPage(1);
  }, [records, search, statusFilter]);

  const toggleItem = (recordId: string, idx: number) => {
    setLocalChecklists(prev => {
      const list = [...(prev[recordId] ?? [])];
      list[idx] = { ...list[idx], completed: !list[idx].completed };
      return { ...prev, [recordId]: list };
    });
  };

  const saveChecklist = async (recordId: string) => {
    setSavingId(recordId);
    try {
      const res  = await fetch("/api/recruitment/onboarding", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, checklist: localChecklists[recordId] }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Checklist saved");
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally { setSavingId(null); }
  };

  // ── Cloudinary upload ─────────────────────────────────────────────────────
  const triggerUpload = (recordId: string, itemName: string) => {
    pendingUpload.current = { recordId, itemName };
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUpload.current) return;
    const { recordId, itemName } = pendingUpload.current;
    pendingUpload.current = null;
    e.target.value = "";

    // Find applicant name for folder
    const record = records.find(r => r.id === recordId);
    const folderName = (record?.applicantName ?? "unknown")
      .toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const folder = `documents/${folderName}`;

    setUploadingItem(`${recordId}::${itemName}`);
    try {
      const { url, publicId, fileName } = await uploadToCloudinary(file, folder);

      const doc: DocumentAttachment = {
        item:       itemName,
        url,
        publicId,
        fileName,
        uploadedAt: new Date().toISOString(),
      };

      // Save to Firebase via API
      const res  = await fetch("/api/recruitment/onboarding", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, document: doc }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // Update local docs
      setLocalDocs(prev => ({
        ...prev,
        [recordId]: [...(prev[recordId] ?? []), doc],
      }));

      // Auto-mark checklist item as completed
      setLocalChecklists(prev => {
        const list = [...(prev[recordId] ?? [])];
        const idx  = list.findIndex(c => c.item === itemName);
        if (idx >= 0) list[idx] = { ...list[idx], completed: true };
        return { ...prev, [recordId]: list };
      });

      toast.success(`${fileName} uploaded`);
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploadingItem(null);
    }
  };

  const getDocForItem = (recordId: string, itemName: string): DocumentAttachment | undefined =>
    (localDocs[recordId] ?? []).find(d => d.item === itemName);

  const totalPages      = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated       = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const completedCount  = records.filter(r => r.status === "completed").length;
  const inProgressCount = records.filter(r => r.status === "in_progress").length;
  const pendingCount    = records.filter(r => r.status === "pending").length;

  return (
    <ProtectedPageWrapper>
      {/* Hidden file input for Cloudinary uploads */}
      <input ref={fileInputRef} type="file" className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic"
        onChange={handleFileChange} />

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
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Onboarding</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Firebase · Cloudinary</span>
            </div>
          </header>

          {/* ── Title bar ── */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <ClipboardList className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Onboarding Checklist</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Documents stored in Cloudinary · documents/&#123;applicant_name&#125;/
              </p>
            </div>
            <div className="ml-auto">
              <button onClick={fetchRecords}
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
              { label: "Total",       value: records.length,  color: C.accent },
              { label: "Pending",     value: pendingCount,    color: "#60a5fa" },
              { label: "In Progress", value: inProgressCount, color: "#fbbf24" },
              { label: "Completed",   value: completedCount,  color: "#34d399" },
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
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: statusFilter ? C.text : C.dim, fontFamily: C.font }}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
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
              <span style={{ color: C.text }}>{filtered.length}</span> records
            </div>
          </div>

          {/* ── List ── */}
          <div className="relative z-10 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full gap-3">
                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                <span className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Loading…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <ClipboardList className="size-8 opacity-20" style={{ color: C.accent }} />
                <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No onboarding records yet</p>
                <p className="text-[10px]" style={{ color: C.dim }}>Records appear here when a candidate is marked as Hired</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: C.border }}>
                {paginated.map((record, i) => {
                  const st         = statusStyle(record.status);
                  const isExpanded = expandedId === record.id;
                  const localList  = localChecklists[record.id] ?? record.checklist;
                  const docs       = localDocs[record.id] ?? [];
                  const doneCount  = localList.filter(c => c.completed).length;
                  const pct        = localList.length > 0 ? Math.round((doneCount / localList.length) * 100) : 0;

                  return (
                    <div key={record.id} style={{ borderColor: C.muted + "30" }}>
                      {/* Row header */}
                      <div
                        className="flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors"
                        style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel }}
                        onClick={() => setExpandedId(isExpanded ? null : record.id)}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>

                        {isExpanded
                          ? <ChevronUp className="size-3 shrink-0" style={{ color: C.accent }} />
                          : <ChevronDown className="size-3 shrink-0" style={{ color: C.dim }} />}

                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold" style={{ color: C.text }}>{record.applicantName}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 text-[9px]" style={{ color: C.dim }}>
                              <Briefcase className="size-2.5" />{record.jobTitle}
                            </span>
                            {record.applicantEmail && (
                              <span className="flex items-center gap-1 text-[9px] font-mono" style={{ color: C.dim }}>
                                <Mail className="size-2.5" />{record.applicantEmail}
                              </span>
                            )}
                            {docs.length > 0 && (
                              <span className="flex items-center gap-1 text-[9px]" style={{ color: "#60a5fa" }}>
                                <Paperclip className="size-2.5" />{docs.length} doc{docs.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="relative h-5 w-24 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                            <div className="absolute inset-y-0 left-0 transition-all"
                              style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#34d39930" : "#fbbf2430" }} />
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
                              style={{ color: pct === 100 ? "#34d399" : "#fbbf24" }}>
                              {doneCount}/{localList.length}
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                            style={{ borderColor: st.border, color: st.color, backgroundColor: st.bg }}>
                            {st.label}
                          </span>
                          <span className="text-[9px] font-mono" style={{ color: C.muted }}>{formatDate(record.createdAt)}</span>
                        </div>
                      </div>

                      {/* Expanded checklist with upload */}
                      {isExpanded && (
                        <div className="px-6 py-4 border-t" style={{ borderColor: C.muted + "30", backgroundColor: "rgba(232,99,10,0.02)" }}>
                          <div className="space-y-2 mb-4">
                            {localList.map((item, idx) => {
                              const attachedDoc  = getDocForItem(record.id, item.item);
                              const isUploading  = uploadingItem === `${record.id}::${item.item}`;
                              return (
                                <div key={idx}
                                  className="flex items-center gap-3 px-3 py-2.5 border transition-colors"
                                  style={{
                                    borderColor:     item.completed ? "#34d39940" : C.border,
                                    backgroundColor: item.completed ? "rgba(52,211,153,0.04)" : "transparent",
                                  }}>
                                  {/* Checkbox */}
                                  <input type="checkbox" checked={item.completed}
                                    onChange={() => toggleItem(record.id, idx)}
                                    className="accent-emerald-500 h-3.5 w-3.5 shrink-0 cursor-pointer" />

                                  {/* Item name */}
                                  <span className="flex-1 text-[10px]"
                                    style={{ color: item.completed ? "#34d399" : C.text,
                                             textDecoration: item.completed ? "line-through" : "none" }}>
                                    {item.item}
                                  </span>

                                  {/* Attached doc link */}
                                  {attachedDoc && (
                                    <a href={attachedDoc.url} target="_blank" rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="flex items-center gap-1 text-[9px] font-mono transition-colors"
                                      style={{ color: "#60a5fa" }}
                                      title={attachedDoc.fileName}>
                                      <FileText className="size-3" />
                                      <span className="max-w-[120px] truncate">{attachedDoc.fileName}</span>
                                      <ExternalLink className="size-2.5" />
                                    </a>
                                  )}

                                  {/* Upload button */}
                                  <button
                                    onClick={e => { e.stopPropagation(); triggerUpload(record.id, item.item); }}
                                    disabled={isUploading}
                                    title={attachedDoc ? "Replace document" : "Upload document"}
                                    className="flex items-center gap-1 h-6 px-2 text-[8px] font-bold uppercase border transition-colors disabled:opacity-40 shrink-0"
                                    style={{
                                      borderColor:     attachedDoc ? "#34d39940" : C.border,
                                      color:           attachedDoc ? "#34d399"   : C.dim,
                                      backgroundColor: "transparent",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = attachedDoc ? "#34d39940" : C.border; e.currentTarget.style.color = attachedDoc ? "#34d399" : C.dim; }}>
                                    {isUploading
                                      ? <Loader2 className="size-2.5 animate-spin" />
                                      : <Upload className="size-2.5" />}
                                    {isUploading ? "Uploading…" : attachedDoc ? "Replace" : "Upload"}
                                  </button>

                                  {item.completed && !isUploading && (
                                    <CheckCircle2 className="size-3.5 shrink-0" style={{ color: "#34d399" }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: C.border }}>
                            <p className="text-[9px]" style={{ color: C.muted }}>
                              {doneCount} of {localList.length} completed ·{" "}
                              <span style={{ color: "#60a5fa" }}>{docs.length} document{docs.length !== 1 ? "s" : ""} uploaded</span>
                            </p>
                            <button onClick={() => saveChecklist(record.id)} disabled={savingId === record.id}
                              className="flex items-center gap-1.5 h-7 px-4 text-[9px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                              style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
                              {savingId === record.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                              {savingId === record.id ? "Saving…" : "Save Progress"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
    </ProtectedPageWrapper>
  );
}
