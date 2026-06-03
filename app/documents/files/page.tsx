"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Pagination } from "@/components/app-pagination";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { toast } from "sonner";
import {
  FileText, Image, Video, File, Upload, Trash2,
  Download, Search, Loader2, ChevronRight, ChevronDown,
  X, ExternalLink, FolderOpen, Folder, RefreshCw, Plus,
} from "lucide-react";

/* ─── Tokens ──────────────────────────────────────────────────────── */
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

/* ─── Types ───────────────────────────────────────────────────────── */
interface CloudFile {
  public_id:     string;
  secure_url:    string;
  format:        string;
  resource_type: string;
  bytes:         number;
  width?:        number;
  height?:       number;
  created_at:    string;
}

interface FolderNode {
  name: string;
  path: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */
const ROWS = 20;

function fmtBytes(b: number) {
  if (b < 1024)       return `${b} B`;
  if (b < 1024 ** 2)  return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3)  return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function getIcon(format: string, rt: string) {
  if (rt === "video")  return <Video    className="size-4" style={{ color: "#a78bfa" }} />;
  if (rt === "image")  return <Image    className="size-4" style={{ color: "#60a5fa" }} />;
  if (format === "pdf") return <FileText className="size-4" style={{ color: "#f87171" }} />;
  if (["doc","docx","xls","xlsx","csv","ppt","pptx"].includes(format))
                       return <FileText className="size-4" style={{ color: "#fbbf24" }} />;
  return               <File className="size-4" style={{ color: C.dim }} />;
}

function getTypeColor(rt: string, format: string) {
  if (rt === "video")   return "#a78bfa";
  if (rt === "image")   return "#60a5fa";
  if (format === "pdf") return "#f87171";
  return C.dim;
}

/* ─── FolderRow ───────────────────────────────────────────────────── */
function FolderRow({
  folder, selected, expanded, subFolders, onSelect, onToggle, depth,
}: {
  folder:     FolderNode;
  selected:   string;
  expanded:   Set<string>;
  subFolders: Record<string, FolderNode[]>;
  onSelect:   (path: string) => void;
  onToggle:   (path: string) => void;
  depth:      number;
}) {
  const isExpanded = expanded.has(folder.path);
  const isSelected = selected === folder.path;
  const children   = subFolders[folder.path] ?? [];

  return (
    <>
      <button
        onClick={() => { onSelect(folder.path); onToggle(folder.path); }}
        className="w-full flex items-center gap-1.5 py-1.5 text-left transition-colors"
        style={{
          paddingLeft:     `${12 + depth * 12}px`,
          paddingRight:    8,
          backgroundColor: isSelected ? "rgba(232,99,10,0.08)" : "transparent",
          color:           isSelected ? C.accent : C.dim,
          borderBottom:    `1px solid ${C.border}`,
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)"; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <span className="flex items-center justify-center w-3 h-3 shrink-0">
          {isExpanded
            ? <ChevronDown className="size-2.5" />
            : <ChevronRight className="size-2.5" />}
        </span>
        {isExpanded
          ? <FolderOpen className="size-3 shrink-0" style={{ color: C.accent }} />
          : <Folder     className="size-3 shrink-0" />}
        <span className="text-[10px] truncate">{folder.name}</span>
      </button>
      {isExpanded && children.map(child => (
        <FolderRow key={child.path} folder={child}
          selected={selected} expanded={expanded} subFolders={subFolders}
          onSelect={onSelect} onToggle={onToggle} depth={depth + 1} />
      ))}
    </>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */
export default function FilesPage() {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // Files
  const [files,      setFiles]      = useState<CloudFile[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page,       setPage]       = useState(1);
  const [uploading,  setUploading]  = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [preview,    setPreview]    = useState<CloudFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Date range — default to last 30 days
  const today    = new Date();
  const last30   = new Date(today); last30.setDate(today.getDate() - 30);
  const fmt      = (d: Date) => d.toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(fmt(last30));
  const [dateTo,   setDateTo]   = useState(fmt(today));

  // Folders
  const [folders,        setFolders]        = useState<FolderNode[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set());
  const [subFolders,     setSubFolders]     = useState<Record<string, FolderNode[]>>({});
  const [showNewFolder,  setShowNewFolder]  = useState(false);
  const [newFolderName,  setNewFolderName]  = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Load files
  const load = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ type: typeFilter });
      if (selectedFolder) params.set("folder",   selectedFolder);
      if (dateFrom)        params.set("dateFrom", dateFrom);
      if (dateTo)          params.set("dateTo",   dateTo);
      const res  = await fetch(`/api/documents/files?${params}`);
      const json = await res.json();
      if (json.success) setFiles(json.data ?? []);
      else toast.error(json.error ?? "Failed to load files.");
    } catch { toast.error("Failed to load files."); }
    finally { setIsLoading(false); }
  };

  // Load folders
  const loadFolders = async (parent = "") => {
    try {
      const url = parent
        ? `/api/documents/folders?parent=${encodeURIComponent(parent)}`
        : "/api/documents/folders";
      const res  = await fetch(url);
      const json = await res.json();
      return json.success ? (json.folders as FolderNode[]) : [];
    } catch { return []; }
  };

  const loadRootFolders = async () => {
    setFoldersLoading(true);
    const roots = await loadFolders();
    setFolders(roots);
    setFoldersLoading(false);
  };

  const toggleFolder = async (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) { next.delete(path); }
    else {
      next.add(path);
      if (!subFolders[path]) {
        const subs = await loadFolders(path);
        setSubFolders(prev => ({ ...prev, [path]: subs }));
      }
    }
    setExpanded(next);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const path = selectedFolder
        ? `${selectedFolder}/${newFolderName.trim()}`
        : newFolderName.trim();
      const res  = await fetch("/api/documents/folders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`Folder "${path}" created.`);
      setNewFolderName(""); setShowNewFolder(false);
      loadRootFolders();
    } catch (err: any) { toast.error(err.message ?? "Create failed."); }
    finally { setCreatingFolder(false); }
  };

  useEffect(() => { loadRootFolders(); }, []);
  useEffect(() => { load(); }, [typeFilter, selectedFolder, dateFrom, dateTo]);
  useEffect(() => setPage(1), [search, typeFilter, selectedFolder, dateFrom, dateTo]);

  // Upload
  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setUploading(true);
    const tid = toast.loading(`Uploading ${fileList.length} file${fileList.length > 1 ? "s" : ""}…`);
    try {
      for (const file of Array.from(fileList)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", selectedFolder || "it-portal");
        const res  = await fetch("/api/documents/files", { method: "POST", body: fd });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setFiles(prev => [json.data, ...prev]);
      }
      toast.success("Upload complete.", { id: tid });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed.", { id: tid });
    } finally { setUploading(false); }
  };

  // Delete
  const handleDelete = async (f: CloudFile) => {
    setDeleting(f.public_id);
    try {
      const res  = await fetch("/api/documents/files", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: f.public_id, resource_type: f.resource_type }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setFiles(prev => prev.filter(x => x.public_id !== f.public_id));
      if (preview?.public_id === f.public_id) setPreview(null);
      toast.success("File deleted.");
    } catch (err: any) { toast.error(err.message ?? "Delete failed."); }
    finally { setDeleting(null); }
  };

  const filtered = files.filter(f => {
    const q = search.trim().toLowerCase();
    return !q || f.public_id.toLowerCase().includes(q) || f.format.toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS));
  const current    = filtered.slice((page - 1) * ROWS, page * ROWS);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden"
          style={{ backgroundColor: C.bg, color: C.text, fontFamily: C.font }}>

          <div className="fixed inset-0 pointer-events-none"
            style={{ backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`, backgroundSize: "24px 24px", opacity: 0.12, zIndex: 0 }} />

          {/* Header */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b"
            style={{ backgroundColor: C.bg, borderColor: C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <button onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest"
              style={{ color: C.dim }}
              onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>Home</button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Documents</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator><ChevronRight size={10} style={{ color: C.muted }} /></BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>
                    {selectedFolder || "File Manager"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          {/* Title bar */}
          <div className="relative z-10 shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
                <FolderOpen className="size-4" style={{ color: C.accent }} />
              </div>
              <div>
                <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>File Manager</h1>
                <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                  {isLoading ? "Loading…" : `${files.length} file${files.length !== 1 ? "s" : ""} · Cloudinary`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load} disabled={isLoading}
                className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                {isLoading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />} Refresh
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                style={{ backgroundColor: "rgba(232,99,10,0.1)", borderColor: C.accent, color: C.accent }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.2)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)")}>
                {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                {uploading ? "Uploading…" : "Upload"}
              </button>
              <input ref={fileRef} type="file" multiple className="hidden"
                onChange={e => handleUpload(e.target.files)} />
            </div>
          </div>

          {/* Toolbar */}
          <div className="relative z-10 shrink-0 flex items-center gap-2 px-4 py-2.5 border-b flex-wrap"
            style={{ borderColor: C.border, backgroundColor: C.bg }}>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 size-3.5" style={{ color: C.dim }} />
              <input placeholder="Search files…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 h-8 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
            </div>

            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-widest" style={{ color: C.dim }}>From</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="h-8 px-2 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font, colorScheme: "dark" }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
              <span className="text-[9px] uppercase tracking-widest" style={{ color: C.dim }}>To</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="h-8 px-2 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font, colorScheme: "dark" }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
              {/* Quick range presets */}
              <div className="flex items-center gap-1 ml-1">
                {[
                  { label: "7d",  days: 7  },
                  { label: "30d", days: 30 },
                  { label: "90d", days: 90 },
                  { label: "All", days: 0  },
                ].map(({ label, days }) => (
                  <button key={label}
                    onClick={() => {
                      const to  = new Date();
                      const from = new Date(to);
                      if (days > 0) from.setDate(to.getDate() - days);
                      else from.setFullYear(2020, 0, 1); // "All" = from 2020
                      setDateFrom(from.toISOString().slice(0, 10));
                      setDateTo(to.toISOString().slice(0, 10));
                    }}
                    className="h-7 px-2 text-[9px] font-bold uppercase tracking-wider border transition-colors"
                    style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {[{ val: "all", label: "All" }, { val: "image", label: "Images" }, { val: "video", label: "Video" }, { val: "raw", label: "Files" }].map(({ val, label }) => (
                <button key={val} onClick={() => setTypeFilter(val)}
                  className="h-7 px-3 text-[9px] font-bold uppercase tracking-wider border transition-colors"
                  style={{ borderColor: typeFilter === val ? C.accent : C.border, color: typeFilter === val ? C.accent : C.dim, backgroundColor: typeFilter === val ? "rgba(232,99,10,0.1)" : "transparent" }}>
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-mono" style={{ color: C.dim }}>{filtered.length} file{filtered.length !== 1 ? "s" : ""}</span>
              <Pagination page={page} totalPages={totalPages} onPageChangeAction={setPage} />
            </div>
          </div>

          {/* Body: folder sidebar + file table */}
          <div className="relative z-10 flex flex-1 overflow-hidden min-h-0">

            {/* ── Folder sidebar ── */}
            <div className="w-52 shrink-0 flex flex-col border-r overflow-hidden"
              style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
                style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>Folders</span>
                <button onClick={() => setShowNewFolder(v => !v)}
                  className="flex items-center justify-center h-5 w-5 border transition-colors"
                  style={{ borderColor: showNewFolder ? C.accent : C.border, color: showNewFolder ? C.accent : C.dim }}>
                  <Plus className="size-2.5" />
                </button>
              </div>

              {/* New folder input */}
              {showNewFolder && (
                <form onSubmit={handleCreateFolder} className="px-2 py-1.5 border-b flex gap-1"
                  style={{ borderColor: C.border, backgroundColor: C.bg }}>
                  <input autoFocus placeholder="folder-name" value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    className="flex-1 h-6 px-2 text-[10px] focus:outline-none min-w-0"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
                  <button type="submit" disabled={creatingFolder || !newFolderName.trim()}
                    className="flex items-center justify-center h-6 w-6 border disabled:opacity-40"
                    style={{ borderColor: C.accent, color: C.accent }}>
                    {creatingFolder ? <Loader2 className="size-2.5 animate-spin" /> : <Plus className="size-2.5" />}
                  </button>
                </form>
              )}

              {/* Folder tree */}
              <div className="flex-1 overflow-y-auto">
                {foldersLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-3.5 animate-spin" style={{ color: C.accent }} />
                  </div>
                ) : (
                  <>
                    {/* All files button */}
                    <button onClick={() => setSelectedFolder("")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-b"
                      style={{ borderColor: C.border, backgroundColor: selectedFolder === "" ? "rgba(232,99,10,0.08)" : "transparent", color: selectedFolder === "" ? C.accent : C.dim }}>
                      <FolderOpen className="size-3.5 shrink-0" />
                      <span className="text-[10px] font-bold">All Files</span>
                    </button>
                    {folders.map(f => (
                      <FolderRow key={f.path} folder={f}
                        selected={selectedFolder} expanded={expanded}
                        subFolders={subFolders}
                        onSelect={setSelectedFolder}
                        onToggle={toggleFolder}
                        depth={0} />
                    ))}
                    {folders.length === 0 && (
                      <p className="text-[10px] px-3 py-4 text-center" style={{ color: C.muted }}>No folders yet</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── File table ── */}
            <div className="flex-1 overflow-auto relative"
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files); }}>

              {isDragging && (
                <div className="absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed"
                  style={{ borderColor: C.accent, backgroundColor: "rgba(232,99,10,0.05)" }}>
                  <div className="text-center">
                    <Upload className="size-10 mx-auto mb-2" style={{ color: C.accent }} />
                    <p className="text-sm font-bold uppercase tracking-widest" style={{ color: C.accent }}>Drop files to upload</p>
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center h-full gap-2">
                  <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                  <span className="text-[11px] uppercase tracking-widest" style={{ color: C.dim }}>Loading…</span>
                </div>
              ) : current.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <FolderOpen className="size-10 opacity-10" style={{ color: C.accent }} />
                  <div className="text-center">
                    <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: C.dim }}>
                      {search ? "No files match" : "No files in this folder"}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: C.muted }}>Drag & drop or click Upload</p>
                  </div>
                </div>
              ) : (
                <table className="w-full border-collapse text-[11px]" style={{ fontFamily: C.font }}>
                  <thead className="sticky top-0 z-10">
                    <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                      {["","File","Type","Size","Dimensions","Uploaded","Actions"].map((h, i) => (
                        <th key={i} className={`px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest ${i === 0 ? "w-12" : i === 6 ? "text-right" : "text-left"}`}
                          style={{ color: `${C.accent}99`, borderRight: i < 6 ? `1px solid ${C.border}` : undefined }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.map((f, i) => {
                      const name  = f.public_id.split("/").pop() ?? f.public_id;
                      const color = getTypeColor(f.resource_type, f.format);
                      const isImg = f.resource_type === "image";
                      return (
                        <tr key={f.public_id} onClick={() => setPreview(f)}
                          style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel, borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>
                          <td className="px-3 py-2" style={{ borderRight: `1px solid ${C.border}` }}>
                            {isImg
                              ? <img src={f.secure_url} alt={name} className="w-9 h-9 object-cover" style={{ border: `1px solid ${C.border}` }} />
                              : <div className="flex h-9 w-9 items-center justify-center border"
                                  style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}>
                                  {getIcon(f.format, f.resource_type)}
                                </div>}
                          </td>
                          <td className="px-4 py-2.5" style={{ borderRight: `1px solid ${C.border}` }}>
                            <p className="font-bold truncate max-w-[200px]" style={{ color: C.text }}>{name}</p>
                            <p className="text-[9px] font-mono mt-0.5 truncate max-w-[200px]" style={{ color: C.dim }}>{f.public_id}</p>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase border"
                              style={{ borderColor: `${color}40`, color, backgroundColor: `${color}10` }}>
                              {f.format || f.resource_type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-mono" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{fmtBytes(f.bytes)}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-mono" style={{ borderRight: `1px solid ${C.border}`, color: C.muted }}>
                            {f.width && f.height ? `${f.width}×${f.height}` : "—"}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[10px]" style={{ borderRight: `1px solid ${C.border}`, color: C.muted }}>{fmtDate(f.created_at)}</td>
                          <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <a href={f.secure_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-center h-6 w-6 border transition-colors"
                                style={{ borderColor: C.border, color: C.dim }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                                <ExternalLink className="size-3" />
                              </a>
                              <a href={f.secure_url} download
                                className="flex items-center justify-center h-6 w-6 border transition-colors"
                                style={{ borderColor: C.border, color: C.dim }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#34d399"; e.currentTarget.style.color = "#34d399"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                                <Download className="size-3" />
                              </a>
                              <button onClick={() => handleDelete(f)} disabled={deleting === f.public_id}
                                className="flex items-center justify-center h-6 w-6 border transition-colors disabled:opacity-40"
                                style={{ borderColor: C.border, color: C.dim }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                                {deleting === f.public_id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
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

        </SidebarInset>
      </SidebarProvider>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(8,13,18,0.92)" }} onClick={() => setPreview(null)}>
          <div className="relative w-full max-w-4xl mx-4 border overflow-hidden"
            style={{ borderColor: C.border, backgroundColor: C.panel, fontFamily: C.font }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <div className="flex items-center gap-2 min-w-0">
                {getIcon(preview.format, preview.resource_type)}
                <p className="text-[11px] font-bold truncate" style={{ color: C.text }}>
                  {preview.public_id.split("/").pop()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={preview.secure_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 h-6 px-2 text-[9px] uppercase border transition-colors"
                  style={{ borderColor: C.border, color: C.dim }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                  <ExternalLink className="size-3" /> Open
                </a>
                <button onClick={() => setPreview(null)} style={{ color: C.dim }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                  onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center min-h-[240px] max-h-[60vh] p-4"
              style={{ backgroundColor: "#06090d" }}>
              {preview.resource_type === "image"
                ? <img src={preview.secure_url} alt="" className="max-w-full max-h-[55vh] object-contain" />
                : preview.resource_type === "video"
                ? <video src={preview.secure_url} controls className="max-w-full max-h-[55vh]" />
                : preview.format === "pdf"
                ? <div className="w-full flex flex-col" style={{ height: "55vh" }}>
                    {/* Try Google Docs viewer — works for any public PDF URL */}
                    <iframe
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(preview.secure_url)}&embedded=true`}
                      className="w-full flex-1"
                      style={{ border: "none", backgroundColor: "#fff" }}
                      title={preview.public_id}
                      sandbox="allow-scripts allow-same-origin allow-popups"
                    />
                    {/* Fallback link in case Google Docs viewer is slow */}
                    <div className="flex items-center justify-center gap-3 py-2 border-t"
                      style={{ borderColor: C.border, backgroundColor: C.bg }}>
                      <span className="text-[9px] font-mono" style={{ color: C.dim }}>
                        If PDF doesn't load →
                      </span>
                      <a href={preview.secure_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 h-6 px-3 text-[9px] font-bold uppercase border transition-colors"
                        style={{ borderColor: C.accent, color: C.accent }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                        <ExternalLink className="size-2.5" /> Open in New Tab
                      </a>
                      <a href={preview.secure_url} download
                        className="flex items-center gap-1.5 h-6 px-3 text-[9px] font-bold uppercase border transition-colors"
                        style={{ borderColor: C.border, color: C.dim }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#34d399"; e.currentTarget.style.color = "#34d399"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                        <Download className="size-2.5" /> Download
                      </a>
                    </div>
                  </div>
                : <div className="flex flex-col items-center gap-3">
                    <File className="size-14 opacity-20" style={{ color: C.accent }} />
                    <p className="text-[11px] font-mono" style={{ color: C.dim }}>Preview not available</p>
                    <a href={preview.secure_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                      style={{ borderColor: C.accent, color: C.accent }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <Download className="size-3" /> Download File
                    </a>
                  </div>}
            </div>
            <div className="grid grid-cols-4 divide-x border-t" style={{ borderColor: C.border }}>
              {[
                { label: "Format",     value: preview.format || preview.resource_type },
                { label: "Size",       value: fmtBytes(preview.bytes) },
                { label: "Dimensions", value: preview.width ? `${preview.width}×${preview.height}` : "—" },
                { label: "Uploaded",   value: fmtDate(preview.created_at) },
              ].map(({ label, value }) => (
                <div key={label} className="px-3 py-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>{label}</p>
                  <p className="text-[11px] font-bold mt-0.5 font-mono" style={{ color: C.text }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ProtectedPageWrapper>
  );
}
