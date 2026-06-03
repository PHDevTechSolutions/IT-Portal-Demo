"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { toast } from "sonner";
import {
  Send, Loader2, ChevronRight, ChevronDown, Bot, User,
  Sparkles, Trash2, Copy, Check, Zap, File, Folder,
  FolderOpen, X, Code2, FileCode, Play, CheckCircle2,
  AlertCircle, ListTodo, Lightbulb, RefreshCw,
} from "lucide-react";

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
interface Task {
  id:          string;
  num:         number;
  title:       string;
  description: string;
  file:        string;
  lines:       string;
  code:        string;
  status:      "pending" | "applying" | "done" | "error";
  error?:      string;
}

interface Recommendation {
  n: number; text: string;
}

interface Message {
  id:      string;
  role:    "user" | "assistant" | "system";
  content: string;
  source?: string;
  tasks?:  Task[];
  recs?:   Recommendation[];
}

interface FolderNode { name: string; path: string; }
interface OllamaModel { name: string; size?: number; }

/* ─── Task parser ─────────────────────────────────────────────────── */
function parseTasks(content: string): { tasks: Task[]; recs: Recommendation[] } {
  const tasks: Task[] = [];
  const recs:  Recommendation[] = [];

  const taskRe = /\*\*Task\s+(\d+):\s*([^\n*]+)\*\*\n(?:[Dd]escription:\s*([^\n]+)\n)?```patch\nFILE:\s*([^\n]+)\nLINES:\s*([^\n]+)\n---\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = taskRe.exec(content)) !== null) {
    tasks.push({
      id: crypto.randomUUID(), num: parseInt(m[1]),
      title: m[2].trim(), description: (m[3] ?? "").trim(),
      file: m[4].trim(), lines: m[5].trim(), code: m[6].trim(),
      status: "pending",
    });
  }

  const recSection = content.match(/###?\s*(?:Feature\s+)?Recommendations[\s\S]*?(?=###|$)/i);
  if (recSection) {
    const recRe = /(\d+)\.\s+([^\n]+)/g;
    let r: RegExpExecArray | null;
    while ((r = recRe.exec(recSection[0])) !== null) {
      recs.push({ n: parseInt(r[1]), text: r[2].trim() });
    }
  }
  return { tasks, recs };
}

/* ─── System prompt ───────────────────────────────────────────────── */
const SYSTEM_PROMPT = `You are an expert software engineer with full read/write access to this Next.js/TypeScript project.

When modifying code, respond with a STRUCTURED TASK LIST using EXACTLY this format:

### Tasks

**Task 1: [title]**
Description: [what and why]
\`\`\`patch
FILE: relative/path/to/file.tsx
LINES: 12-15
---
replacement code for lines 12-15 only
\`\`\`

**Task 2: [title]**
Description: [what and why]
\`\`\`patch
FILE: relative/path/to/file.tsx
LINES: FULL
---
complete file content
\`\`\`

### Feature Recommendations
1. [name] — description
2. [name] — description
3. [name] — description

LINES format:
- "12-15" = replace lines 12 to 15
- "FULL" = replace entire file  
- "INSERT_AFTER:42" = insert after line 42
- "DELETE:12-15" = delete lines 12-15

Rules: Be surgical. Only change what needs changing. No placeholders. Accurate line numbers.
For questions (no code change), respond normally without the task format.`;

/* ─── FolderRow ───────────────────────────────────────────────────── */
function FolderRow({ entry, depth, onSelect, selectedPath, onLoadDir, dirCache }: {
  entry: FolderNode & { type: "file"|"dir" }; depth: number;
  onSelect: (e: any) => void; selectedPath: string;
  onLoadDir: (p: string) => Promise<any[]>; dirCache: Record<string, any[]>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(false);

  const toggle = async () => {
    if (entry.type === "file") { onSelect(entry); return; }
    if (!expanded) {
      setLoading(true);
      const kids = dirCache[entry.path] ?? await onLoadDir(entry.path);
      setChildren(kids); setLoading(false);
    }
    setExpanded(v => !v);
  };

  const isSelected = selectedPath === entry.path;
  const color = entry.type === "dir" ? (expanded ? C.accent : "#fbbf24") : getFileColor(entry.name);

  return (
    <>
      <button onClick={toggle}
        className="w-full flex items-center gap-1.5 py-1 text-left transition-colors truncate"
        style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: 8,
          backgroundColor: isSelected ? "rgba(232,99,10,0.1)" : "transparent",
          color: isSelected ? C.accent : C.dim, fontSize: 10 }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)"; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}>
        {entry.type === "dir" ? (
          <>
            {loading ? <Loader2 className="size-3 shrink-0 animate-spin" style={{ color: C.accent }} />
              : expanded ? <ChevronDown className="size-2.5 shrink-0" /> : <ChevronRight className="size-2.5 shrink-0" />}
            {expanded ? <FolderOpen className="size-3 shrink-0" style={{ color }} /> : <Folder className="size-3 shrink-0" style={{ color }} />}
          </>
        ) : (
          <><span className="w-2.5 shrink-0" /><File className="size-3 shrink-0" style={{ color }} /></>
        )}
        <span className="truncate font-mono" style={{ fontSize: 10 }}>{entry.name}</span>
      </button>
      {entry.type === "dir" && expanded && children.map((child: any) => (
        <FolderRow key={child.path} entry={child} depth={depth + 1}
          onSelect={onSelect} selectedPath={selectedPath}
          onLoadDir={onLoadDir} dirCache={dirCache} />
      ))}
    </>
  );
}

function getFileColor(name: string) {
  const e = name.split(".").pop()?.toLowerCase();
  if (["tsx","jsx"].includes(e ?? "")) return "#60a5fa";
  if (["ts","js"].includes(e ?? ""))   return "#fbbf24";
  if (e === "json")  return "#34d399";
  if (e === "css")   return "#c084fc";
  if (e === "md")    return "#94a3b8";
  if (e === "env")   return "#f87171";
  return C.dim;
}

/* ─── TaskPanel ───────────────────────────────────────────────────── */
function TaskPanel({ tasks, recs, onApplyTask, onApplyAll, onAskRec }: {
  tasks:       Task[];
  recs:        Recommendation[];
  onApplyTask: (task: Task) => void;
  onApplyAll:  () => void;
  onAskRec:    (rec: Recommendation) => void;
}) {
  const pending = tasks.filter(t => t.status === "pending").length;
  const done    = tasks.filter(t => t.status === "done").length;

  return (
    <div className="border mt-2" style={{ borderColor: C.border, backgroundColor: C.bg, fontFamily: C.font }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: C.border, backgroundColor: C.panel }}>
        <div className="flex items-center gap-2">
          <ListTodo className="size-3.5" style={{ color: C.accent }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
            {tasks.length} Task{tasks.length !== 1 ? "s" : ""}
          </span>
          {done > 0 && <span className="text-[9px]" style={{ color: "#34d399" }}>({done} done)</span>}
        </div>
        {pending > 0 && (
          <button onClick={onApplyAll}
            className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase border transition-colors"
            style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#ff7a1a")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = C.accent)}>
            <Play className="size-2.5" /> Apply All ({pending})
          </button>
        )}
      </div>

      {/* Task list */}
      <div className="divide-y" style={{ borderColor: C.border }}>
        {tasks.map(task => (
          <div key={task.id} className="px-3 py-2.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                {/* Status icon */}
                <div className="shrink-0 mt-0.5">
                  {task.status === "done"     && <CheckCircle2 className="size-3.5" style={{ color: "#34d399" }} />}
                  {task.status === "error"    && <AlertCircle  className="size-3.5" style={{ color: "#f87171" }} />}
                  {task.status === "applying" && <Loader2      className="size-3.5 animate-spin" style={{ color: C.accent }} />}
                  {task.status === "pending"  && (
                    <span className="flex h-3.5 w-3.5 items-center justify-center border text-[8px] font-bold"
                      style={{ borderColor: C.border, color: C.muted }}>{task.num}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold" style={{ color: task.status === "done" ? "#34d399" : C.text }}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-[10px] mt-0.5" style={{ color: C.dim }}>{task.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-mono truncate max-w-[140px]" style={{ color: C.muted }}>
                      {task.file.split("/").pop()}
                    </span>
                    <span className="text-[9px] px-1 border" style={{ borderColor: C.border, color: C.dim }}>
                      {task.lines}
                    </span>
                  </div>
                  {task.error && (
                    <p className="text-[9px] mt-1" style={{ color: "#f87171" }}>{task.error}</p>
                  )}
                </div>
              </div>
              {task.status === "pending" && (
                <button onClick={() => onApplyTask(task)}
                  className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase border shrink-0 transition-colors"
                  style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#34d39910")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                  <Play className="size-2.5" /> Apply
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="border-t" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <Lightbulb className="size-3.5" style={{ color: "#fbbf24" }} />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#fbbf24" }}>
              Feature Recommendations
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: C.border }}>
            {recs.map(rec => (
              <div key={rec.n} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="text-[9px] font-bold shrink-0 mt-0.5" style={{ color: "#fbbf24" }}>{rec.n}.</span>
                  <p className="text-[10px]" style={{ color: C.dim }}>{rec.text}</p>
                </div>
                <button onClick={() => onAskRec(rec)}
                  className="flex items-center gap-1 h-6 px-2 text-[9px] uppercase border shrink-0 transition-colors"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                  Implement
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────── */
export default function TrainingGroundPage() {
  const router    = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const [messages,      setMessages]      = useState<Message[]>([]);
  const [input,         setInput]         = useState("");
  const [isStreaming,   setIsStreaming]    = useState(false);
  const [models,        setModels]        = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [aiSource,      setAiSource]      = useState("");
  const [ollamaOffline, setOllamaOffline] = useState(false);
  const [copied,        setCopied]        = useState<string | null>(null);
  const [showModels,    setShowModels]    = useState(false);

  const [rootEntries, setRootEntries] = useState<any[]>([]);
  const [dirCache,    setDirCache]    = useState<Record<string, any[]>>({});
  const [treeLoading, setTreeLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileContent,  setFileContent]  = useState("");
  const [fileLoading,  setFileLoading]  = useState(false);
  const [filePath,     setFilePath]     = useState("");
  const projectTreeRef = useRef<string>("");

  /* ── Init ── */
  useEffect(() => {
    fetch("/api/ai/files").then(r => r.json())
      .then(d => { if (d.entries) setRootEntries(d.entries); })
      .finally(() => setTreeLoading(false));

    fetch("/api/ai/context?depth=3").then(r => r.json())
      .then(d => { if (d.success) projectTreeRef.current = `Project (${d.stats?.totalFiles} files):\n\`\`\`\n${d.tree}\n\`\`\``; });

    fetch("/api/ai/chat").then(r => r.json()).then(d => {
      setModels(d.models ?? []);
      setSelectedModel(d.models?.[0]?.name ?? "");
      setAiSource(d.source ?? "");
      if (!d.success) setOllamaOffline(true);
    });
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadDir = useCallback(async (p: string): Promise<any[]> => {
    if (dirCache[p]) return dirCache[p];
    const res = await fetch(`/api/ai/files?path=${encodeURIComponent(p)}`);
    const d   = await res.json();
    const kids = d.entries ?? [];
    setDirCache(prev => ({ ...prev, [p]: kids }));
    return kids;
  }, [dirCache]);

  const handleSelectFile = async (entry: any) => {
    if (entry.type !== "file") return;
    setSelectedFile(entry); setFileLoading(true);
    try {
      const res = await fetch(`/api/ai/files?path=${encodeURIComponent(entry.path)}`);
      const d   = await res.json();
      setFileContent(d.content ?? ""); setFilePath(entry.path);
    } catch { toast.error("Failed to read file."); }
    finally { setFileLoading(false); }
  };

  /* ── Apply a single task ── */
  const applyTask = async (task: Task, messageId: string): Promise<boolean> => {
    const updateTask = (update: Partial<Task>) =>
      setMessages(prev => prev.map(m => m.id !== messageId ? m : {
        ...m, tasks: m.tasks?.map(t => t.id === task.id ? { ...t, ...update } : t),
      }));

    updateTask({ status: "applying" });
    try {
      const lines = task.lines;
      let body: any = { path: task.file, content: task.code };

      if (lines === "FULL") {
        body.type = "full";
      } else if (lines.startsWith("INSERT_AFTER:")) {
        body.type = "insert"; body.afterLine = parseInt(lines.split(":")[1]);
      } else if (lines.startsWith("DELETE:")) {
        const [s, e] = lines.split(":")[1].split("-").map(Number);
        body.type = "delete"; body.startLine = s; body.endLine = e ?? s;
      } else {
        const [s, e] = lines.split("-").map(Number);
        body.type = "patch"; body.startLine = s; body.endLine = e ?? s;
      }

      const res  = await fetch("/api/ai/patch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // Refresh viewer if it's the open file
      if (selectedFile?.path === task.file || filePath === task.file) {
        const fr = await fetch(`/api/ai/files?path=${encodeURIComponent(task.file)}`);
        const fd = await fr.json();
        setFileContent(fd.content ?? "");
      }

      updateTask({ status: "done" });
      return true;
    } catch (err: any) {
      updateTask({ status: "error", error: err.message });
      return false;
    }
  };

  const handleApplyTask = (task: Task, messageId: string) => {
    applyTask(task, messageId);
  };

  const handleApplyAll = async (tasks: Task[], messageId: string) => {
    for (const task of tasks.filter(t => t.status === "pending")) {
      const ok = await applyTask(task, messageId);
      if (!ok) { toast.error(`Task ${task.num} failed — stopping.`); break; }
    }
    toast.success("All tasks applied.");
  };

  /* ── Send ── */
  const handleSend = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput(""); setIsStreaming(true);

    const ctx = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(projectTreeRef.current ? [{ role: "system", content: projectTreeRef.current }] : []),
      ...(fileContent ? [{ role: "system", content: `Open file (${filePath}):\n\`\`\`\n${fileContent.slice(0, 8000)}\n\`\`\`` }] : []),
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, messages: ctx }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "AI error");

      const source = res.headers.get("X-AI-Source") ?? "";
      const reader = res.body!.getReader();
      const dec    = new TextDecoder();
      let buf = "", full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const chunk = JSON.parse(data);
            if (chunk.token) {
              full += chunk.token;
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: full, source } : m));
            }
          } catch { /* skip */ }
        }
      }

      // Parse tasks from completed response
      const { tasks, recs } = parseTasks(full);
      if (tasks.length > 0 || recs.length > 0) {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, tasks, recs } : m));
      }
    } catch (err: any) {
      toast.error(err.message ?? "AI error");
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const lineCount = fileContent.split("\n").length;
  const fmtBytes  = (b?: number) => b ? (b < 1024**3 ? `${(b/1024**2).toFixed(0)}MB` : `${(b/1024**3).toFixed(1)}GB`) : "";

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
                <BreadcrumbItem><BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>AI Model</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator><ChevronRight size={10} style={{ color: C.muted }} /></BreadcrumbSeparator>
                <BreadcrumbItem><BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Training Ground</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
              {aiSource && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase border"
                  style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "#34d39910" }}>
                  <Zap className="size-2.5" />{aiSource === "ollama" ? "Local · Ollama" : "Groq · Cloud"}
                </span>
              )}
              {ollamaOffline && !aiSource && (
                <span className="text-[9px] px-2 py-0.5 border" style={{ borderColor: "#f8717140", color: "#f87171" }}>Ollama Offline</span>
              )}
              {models.length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowModels(v => !v)}
                    className="flex items-center gap-1.5 h-7 px-2 text-[10px] font-bold uppercase border"
                    style={{ borderColor: showModels ? C.accent : C.border, color: showModels ? C.accent : C.dim }}>
                    <Sparkles className="size-3" />
                    <span className="max-w-[120px] truncate">{selectedModel}</span>
                    <ChevronDown className="size-2.5" />
                  </button>
                  {showModels && (
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] border"
                      style={{ borderColor: C.border, backgroundColor: C.panel }}>
                      {models.map(m => (
                        <button key={m.name} onClick={() => { setSelectedModel(m.name); setShowModels(false); }}
                          className="w-full flex items-center justify-between px-3 py-2 border-b last:border-b-0 transition-colors"
                          style={{ borderColor: C.border, backgroundColor: selectedModel === m.name ? "rgba(232,99,10,0.08)" : "transparent", color: selectedModel === m.name ? C.accent : C.text }}
                          onMouseEnter={e => { if (selectedModel !== m.name) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)"; }}
                          onMouseLeave={e => { if (selectedModel !== m.name) e.currentTarget.style.backgroundColor = "transparent"; }}>
                          <span className="text-[10px] font-mono">{m.name}</span>
                          {m.size && <span className="text-[9px] ml-2" style={{ color: C.muted }}>{fmtBytes(m.size)}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {messages.length > 0 && (
                <button onClick={() => setMessages([])}
                  className="flex items-center gap-1 h-7 px-2 text-[10px] uppercase border transition-colors"
                  style={{ borderColor: C.border, color: C.dim }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                  <Trash2 className="size-3" /> Clear
                </button>
              )}
            </div>
          </header>

          {/* 3-column body */}
          <div className="relative z-10 flex flex-1 overflow-hidden min-h-0">

            {/* Col 1: File tree */}
            <div className="w-52 shrink-0 flex flex-col border-r" style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
                style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <Code2 className="size-3.5" style={{ color: C.accent }} />
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>Project Files</span>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {treeLoading ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="size-3.5 animate-spin" style={{ color: C.accent }} /></div>
                ) : rootEntries.map((entry: any) => (
                  <FolderRow key={entry.path} entry={entry} depth={0}
                    onSelect={handleSelectFile} selectedPath={selectedFile?.path ?? ""}
                    onLoadDir={loadDir} dirCache={dirCache} />
                ))}
              </div>
            </div>

            {/* Col 2: Code viewer */}
            <div className="flex-1 flex flex-col border-r overflow-hidden min-w-0" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
                style={{ borderColor: C.border, backgroundColor: C.panel }}>
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode className="size-3.5 shrink-0" style={{ color: C.accent }} />
                  <span className="text-[10px] font-mono truncate" style={{ color: selectedFile ? C.text : C.muted }}>
                    {selectedFile ? selectedFile.path : "Select a file →"}
                  </span>
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-mono" style={{ color: C.muted }}>{lineCount} lines</span>
                    <button onClick={() => handleSend(`Review and suggest improvements for: ${filePath}`)} disabled={isStreaming}
                      className="flex items-center gap-1 h-6 px-2 text-[9px] uppercase border disabled:opacity-40"
                      style={{ borderColor: C.accent, color: C.accent }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <Bot className="size-2.5" /> Ask AI
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(fileContent); toast.success("Copied."); }}
                      className="flex items-center justify-center h-6 w-6 border transition-colors"
                      style={{ borderColor: C.border, color: C.dim }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                      <Copy className="size-3" />
                    </button>
                    <button onClick={() => { setSelectedFile(null); setFileContent(""); setFilePath(""); }}
                      style={{ color: C.dim }} onMouseEnter={e => (e.currentTarget.style.color = "#f87171")} onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {fileLoading ? (
                  <div className="flex items-center justify-center h-full gap-2">
                    <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                  </div>
                ) : fileContent ? (
                  <pre className="text-[11px] p-4 leading-5 min-h-full"
                    style={{ color: C.text, fontFamily: C.font, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {fileContent.split("\n").map((line, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="select-none w-8 text-right shrink-0" style={{ color: C.muted, fontSize: 10 }}>{i + 1}</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                    <FileCode className="size-10 opacity-10" style={{ color: C.accent }} />
                    <p className="text-[11px]" style={{ color: C.dim }}>Click a file to view its code</p>
                  </div>
                )}
              </div>
            </div>

            {/* Col 3: Chat */}
            <div className="w-96 shrink-0 flex flex-col overflow-hidden" style={{ backgroundColor: C.panel }}>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
                style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <Bot className="size-3.5" style={{ color: C.accent }} />
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>AI Chat</span>
                {fileContent && <span className="ml-auto text-[8px] px-1.5 py-0.5 border" style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "#34d39910" }}>File context active</span>}
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-2">
                    <Bot className="size-8 opacity-10" style={{ color: C.accent }} />
                    <p className="text-[10px]" style={{ color: C.dim }}>
                      {fileContent ? `Open: ${selectedFile?.name}` : "Open a file and ask the AI"}
                    </p>
                    {fileContent && (
                      <div className="space-y-1.5 w-full">
                        {["Explain this file","Find potential bugs","How can this be improved?","Add TypeScript types"].map(p => (
                          <button key={p} onClick={() => handleSend(p)}
                            className="w-full px-2 py-1.5 text-left text-[10px] border transition-colors"
                            style={{ borderColor: C.border, color: C.dim }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center border mt-0.5"
                        style={{ borderColor: `${C.accent}40`, backgroundColor: `${C.accent}10` }}>
                        <Bot className="size-3" style={{ color: C.accent }} />
                      </div>
                    )}
                    <div className="group max-w-[85%]">
                      <div className="px-3 py-2 border text-[11px] leading-relaxed"
                        style={{ backgroundColor: msg.role === "user" ? "rgba(232,99,10,0.08)" : C.bg,
                          borderColor: msg.role === "user" ? `${C.accent}40` : C.border,
                          color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: C.font }}>
                        {msg.content || (isStreaming && <span className="inline-block w-1.5 h-3.5 bg-orange-400 animate-pulse align-middle" />)}
                      </div>
                      {/* Copy */}
                      {msg.content && (
                        <button onClick={() => { navigator.clipboard.writeText(msg.content); setCopied(msg.id); setTimeout(() => setCopied(null), 2000); }}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 mt-0.5 text-[8px] transition-opacity"
                          style={{ color: C.muted }}>
                          {copied === msg.id ? <><Check className="size-2.5" style={{ color: "#34d399" }} /> Copied</> : <><Copy className="size-2.5" /> Copy</>}
                        </button>
                      )}
                      {/* Task panel */}
                      {msg.tasks && msg.tasks.length > 0 && (
                        <TaskPanel
                          tasks={msg.tasks}
                          recs={msg.recs ?? []}
                          onApplyTask={task => handleApplyTask(task, msg.id)}
                          onApplyAll={() => handleApplyAll(msg.tasks!, msg.id)}
                          onAskRec={rec => handleSend(`Implement recommendation ${rec.n}: ${rec.text}`)}
                        />
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center border mt-0.5"
                        style={{ borderColor: C.border, backgroundColor: C.bg }}>
                        <User className="size-3" style={{ color: C.dim }} />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t p-3" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <div className="flex items-end gap-2">
                  <textarea ref={inputRef} placeholder={isStreaming ? "Waiting…" : "Ask about the code…"}
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    disabled={isStreaming} rows={1}
                    className="flex-1 px-2.5 py-2 text-[11px] focus:outline-none resize-none disabled:opacity-50"
                    style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font, minHeight: 36, maxHeight: 120 }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                    onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }} />
                  <button onClick={() => handleSend()} disabled={isStreaming || !input.trim()}
                    className="flex items-center justify-center h-9 w-9 border disabled:opacity-40"
                    style={{ backgroundColor: C.accent, borderColor: C.accent, color: "#fff" }}>
                    {isStreaming ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
