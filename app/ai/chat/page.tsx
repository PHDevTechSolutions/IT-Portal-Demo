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
  FolderOpen, X, Code2, FileCode,
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
interface Message {
  id:      string;
  role:    "user" | "assistant" | "system";
  content: string;
  source?: "ollama" | "groq";
}

interface FsEntry { name: string; type: "file" | "dir"; path: string; }
interface OllamaModel { name: string; size?: number; }

const SYSTEM_PROMPT = `You are an expert software engineer with FULL READ AND WRITE access to this Next.js/TypeScript project.

CRITICAL RULES — ALWAYS FOLLOW:
1. When asked to revise, fix, refactor, or improve ANY file — return the COMPLETE file content. Never truncate.
2. Never use "// ... rest of code", "// ... existing code", or any placeholder. Write every single line.
3. Always wrap your code in a single fenced code block with the language tag.
4. Always end your response with: [APPLY: <relative/path/to/file.tsx>]
5. If the file is large, still return ALL of it — do not skip sections.
6. Match the exact coding style, imports, and patterns of the original file.

RESPONSE FORMAT:
\`\`\`tsx
// COMPLETE file content — every line
\`\`\`
[APPLY: path/to/file.tsx]

If you are only answering a question (not modifying a file), respond normally without a code block.`;

/* ─── FileTree node ───────────────────────────────────────────────── */
function TreeNode({
  entry, depth, onSelect, selectedPath, onLoadDir, dirCache,
}: {
  entry:        FsEntry;
  depth:        number;
  onSelect:     (e: FsEntry) => void;
  selectedPath: string;
  onLoadDir:    (path: string) => Promise<FsEntry[]>;
  dirCache:     Record<string, FsEntry[]>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FsEntry[]>([]);
  const [loading,  setLoading]  = useState(false);

  const toggle = async () => {
    if (entry.type === "file") { onSelect(entry); return; }
    if (!expanded) {
      setLoading(true);
      const kids = dirCache[entry.path] ?? await onLoadDir(entry.path);
      setChildren(kids);
      setLoading(false);
    }
    setExpanded(v => !v);
  };

  const isSelected = selectedPath === entry.path;
  const isDir      = entry.type === "dir";

  const iconColor = isDir
    ? expanded ? C.accent : "#fbbf24"
    : getFileColor(entry.name);

  return (
    <>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-1.5 py-1 text-left transition-colors truncate"
        style={{
          paddingLeft:     `${8 + depth * 12}px`,
          paddingRight:    8,
          backgroundColor: isSelected ? "rgba(232,99,10,0.1)" : "transparent",
          color:           isSelected ? C.accent : C.dim,
          fontSize:        10,
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)"; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        {isDir ? (
          <>
            {loading
              ? <Loader2 className="size-3 shrink-0 animate-spin" style={{ color: C.accent }} />
              : expanded
              ? <ChevronDown className="size-2.5 shrink-0" />
              : <ChevronRight className="size-2.5 shrink-0" />}
            {expanded
              ? <FolderOpen className="size-3 shrink-0" style={{ color: iconColor }} />
              : <Folder     className="size-3 shrink-0" style={{ color: iconColor }} />}
          </>
        ) : (
          <>
            <span className="w-2.5 shrink-0" />
            <File className="size-3 shrink-0" style={{ color: iconColor }} />
          </>
        )}
        <span className="truncate font-mono" style={{ fontSize: 10 }}>{entry.name}</span>
      </button>
      {isDir && expanded && children.map(child => (
        <TreeNode key={child.path} entry={child} depth={depth + 1}
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

/* ─── Main Page ───────────────────────────────────────────────────── */
export default function TrainingGroundPage() {
  const router    = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Chat
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [input,         setInput]         = useState("");
  const [isStreaming,   setIsStreaming]    = useState(false);
  const [models,        setModels]        = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [aiSource,      setAiSource]      = useState<"ollama" | "groq" | "">("");
  const [copied,        setCopied]        = useState<string | null>(null);
  const [showModels,    setShowModels]    = useState(false);
  const [ollamaOffline, setOllamaOffline] = useState(false);

  // File tree
  const [rootEntries, setRootEntries] = useState<FsEntry[]>([]);
  const [dirCache,    setDirCache]    = useState<Record<string, FsEntry[]>>({});
  const [treeLoading, setTreeLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FsEntry | null>(null);

  // Code viewer
  const [fileContent,  setFileContent]  = useState("");
  const [fileLoading,  setFileLoading]  = useState(false);
  const [filePath,     setFilePath]     = useState("");

  /* ── Load root file tree ── */
  useEffect(() => {
    fetch("/api/ai/files")
      .then(r => r.json())
      .then(d => { if (d.entries) setRootEntries(d.entries); })
      .catch(() => {})
      .finally(() => setTreeLoading(false));
  }, []);

  // Project tree summary for AI context (loaded once)
  const projectTreeRef = useRef<string>("");

  useEffect(() => {
    fetch("/api/ai/context?depth=3")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          projectTreeRef.current = `Project structure (${d.stats.totalFiles} files):\n\`\`\`\n${d.tree}\n\`\`\``;
        }
      })
      .catch(() => {});
  }, []);

  /* ── Load subdir ── */
  const loadDir = useCallback(async (path: string): Promise<FsEntry[]> => {
    if (dirCache[path]) return dirCache[path];
    const res  = await fetch(`/api/ai/files?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    const kids = data.entries ?? [];
    setDirCache(prev => ({ ...prev, [path]: kids }));
    return kids;
  }, [dirCache]);

  /* ── Load file content ── */
  const handleSelectFile = async (entry: FsEntry) => {
    if (entry.type !== "file") return;
    setSelectedFile(entry);
    setFileLoading(true);
    try {
      const res  = await fetch(`/api/ai/files?path=${encodeURIComponent(entry.path)}`);
      const data = await res.json();
      setFileContent(data.content ?? "");
      setFilePath(entry.path);
    } catch { toast.error("Failed to read file."); }
    finally { setFileLoading(false); }
  };

  /* ── Load AI models ── */
  useEffect(() => {
    fetch("/api/ai/chat")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setModels(d.models);
          setSelectedModel(d.models[0]?.name ?? "");
          setAiSource(d.source === "ollama" ? "ollama" : "groq");
          if (d.source !== "ollama") setOllamaOffline(true);
        } else {
          setOllamaOffline(true);
        }
      }).catch(() => setOllamaOffline(true));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Send chat ── */
  const handleSend = async (customInput?: string) => {
    const text = (customInput ?? input).trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();

    setMessages(prev => [...prev, userMsg,
      { id: assistantId, role: "assistant", content: "", source: undefined }]);
    setInput("");
    setIsStreaming(true);

    const contextMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      // Always inject project tree so AI knows the codebase structure
      ...(projectTreeRef.current ? [{
        role: "system",
        content: projectTreeRef.current,
      }] : []),
      // If a file is open, include its content
      ...(fileContent ? [{
        role: "system",
        content: `Currently open file: ${filePath}\n\`\`\`\n${fileContent.slice(0, 8000)}\n\`\`\``,
      }] : []),
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    // If the message seems to ask about a specific directory, fetch deeper context
    const dirMatch = text.match(/(?:show|list|explain|read|look at|what's in|files in)\s+(?:the\s+)?[`"']?([\w\/\-\.]+)[`"']?/i);
    if (dirMatch) {
      try {
        const dirPath = dirMatch[1].replace(/^\//, "");
        const ctxRes  = await fetch(`/api/ai/context?path=${encodeURIComponent(dirPath)}&depth=2`);
        const ctxData = await ctxRes.json();
        if (ctxData.success && ctxData.tree) {
          contextMessages.splice(2, 0, {
            role: "system",
            content: `Detailed structure of "${dirPath}":\n\`\`\`\n${ctxData.tree}\n\`\`\``,
          });
        }
      } catch { /* ignore — not critical */ }
    }

    try {
      const res = await fetch("/api/ai/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ model: selectedModel, messages: contextMessages }),
      });

      if (!res.ok) throw new Error((await res.json()).error ?? "AI error");

      const source  = (res.headers.get("X-AI-Source") ?? "") as "ollama" | "groq";
      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const chunk = JSON.parse(data);
            if (chunk.token) {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + chunk.token, source } : m
              ));
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      toast.error(err.message ?? "AI error");
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  };

  // Apply AI code suggestion to open file
  const applyToFile = async (content: string, forcePath?: string) => {
    // Auto-detect [APPLY: path] tag from AI response
    const applyMatch = content.match(/\[APPLY:\s*([^\]]+)\]/);
    const targetPath = forcePath ?? applyMatch?.[1]?.trim() ?? selectedFile?.path;

    if (!targetPath) { toast.error("No target file. Open a file first or ask AI to specify one."); return; }

    // Extract code block
    const codeMatch = content.match(/```(?:tsx?|jsx?|json|css|scss|md|yaml|[a-z]+)?\n([\s\S]+?)\n```/);
    const code = codeMatch ? codeMatch[1] : content.replace(/\[APPLY:[^\]]*\]/g, "").trim();

    if (!code) { toast.error("No code block found in the response."); return; }

    try {
      const res  = await fetch("/api/ai/write", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ path: targetPath, content: code }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      // Refresh the code viewer if it's the open file
      if (selectedFile?.path === targetPath) setFileContent(code);
      toast.success(`✓ Applied to ${targetPath.split("/").pop()}`);
    } catch (err: any) {
      toast.error(err.message ?? "Apply failed.");
    }
  };

  const fmtBytes = (b?: number) => {
    if (!b) return "";
    if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(0)} MB`;
    return `${(b / 1024 ** 3).toFixed(1)} GB`;
  };

  const lineCount = fileContent.split("\n").length;

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
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>AI Model</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator><ChevronRight size={10} style={{ color: C.muted }} /></BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Training Ground</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
              {aiSource && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase border"
                  style={{
                    borderColor:     aiSource === "ollama" ? "#34d39940" : "#fbbf2440",
                    color:           aiSource === "ollama" ? "#34d399"   : "#fbbf24",
                    backgroundColor: aiSource === "ollama" ? "#34d39910" : "#fbbf2410",
                  }}>
                  <Zap className="size-2.5" />
                  {aiSource === "ollama" ? "Local · Ollama" : "Groq · Llama 3.3"}
                </span>
              )}
              {ollamaOffline && !aiSource && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase border"
                  style={{ borderColor: "#f8717140", color: "#f87171", backgroundColor: "#f8717110" }}>
                  Ollama Offline
                </span>
              )}
              {/* Model selector */}
              {models.length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowModels(v => !v)}
                    className="flex items-center gap-1.5 h-7 px-2 text-[10px] font-bold uppercase border transition-colors"
                    style={{ borderColor: showModels ? C.accent : C.border, color: showModels ? C.accent : C.dim }}>
                    <Sparkles className="size-3" />
                    <span className="max-w-[120px] truncate">{selectedModel}</span>
                    <ChevronDown className="size-2.5 shrink-0" />
                  </button>
                  {showModels && (
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] border overflow-hidden"
                      style={{ borderColor: C.border, backgroundColor: C.panel }}>
                      {models.map(m => (
                        <button key={m.name} onClick={() => { setSelectedModel(m.name); setShowModels(false); }}
                          className="w-full flex items-center justify-between px-3 py-2 border-b last:border-b-0 transition-colors"
                          style={{ borderColor: C.border, backgroundColor: selectedModel === m.name ? "rgba(232,99,10,0.08)" : "transparent", color: selectedModel === m.name ? C.accent : C.text }}
                          onMouseEnter={e => { if (selectedModel !== m.name) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)"; }}
                          onMouseLeave={e => { if (selectedModel !== m.name) e.currentTarget.style.backgroundColor = "transparent"; }}>
                          <span className="text-[10px] font-mono">{m.name}</span>
                          {m.size && <span className="text-[9px] font-mono ml-2" style={{ color: C.muted }}>{fmtBytes(m.size)}</span>}
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

            {/* ── Col 1: File Tree ── */}
            <div className="w-52 shrink-0 flex flex-col border-r overflow-hidden"
              style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
                style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <Code2 className="size-3.5" style={{ color: C.accent }} />
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>Project Files</span>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {treeLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-3.5 animate-spin" style={{ color: C.accent }} />
                  </div>
                ) : rootEntries.map(entry => (
                  <TreeNode key={entry.path} entry={entry} depth={0}
                    onSelect={handleSelectFile}
                    selectedPath={selectedFile?.path ?? ""}
                    onLoadDir={loadDir} dirCache={dirCache} />
                ))}
              </div>
            </div>

            {/* ── Col 2: Code Viewer ── */}
            <div className="flex-1 flex flex-col border-r overflow-hidden min-w-0"
              style={{ borderColor: C.border, backgroundColor: C.bg }}>
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
                    <button
                      onClick={() => handleSend(`Please review and explain this file: ${filePath}\n\`\`\`\n${fileContent.slice(0, 6000)}\n\`\`\``)}
                      disabled={isStreaming}
                      className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase border transition-colors disabled:opacity-40"
                      style={{ borderColor: C.accent, color: C.accent, backgroundColor: "transparent" }}
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
                      className="flex items-center justify-center h-6 w-6 border transition-colors"
                      style={{ borderColor: C.border, color: C.dim }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                      <X className="size-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {fileLoading ? (
                  <div className="flex items-center justify-center h-full gap-2">
                    <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                    <span className="text-[10px] uppercase tracking-widest" style={{ color: C.dim }}>Loading…</span>
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
                    <p className="text-[11px]" style={{ color: C.dim }}>Click a file in the tree to view its code</p>
                    <p className="text-[10px]" style={{ color: C.muted }}>The AI will automatically have context about the open file</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Col 3: Chat ── */}
            <div className="w-96 shrink-0 flex flex-col overflow-hidden"
              style={{ backgroundColor: C.panel }}>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
                style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <Bot className="size-3.5" style={{ color: C.accent }} />
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>AI Chat</span>
                <div className="ml-auto flex items-center gap-1.5">
                  {fileContent && (
                    <span className="text-[8px] px-1.5 py-0.5 border"
                      style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "#34d39910" }}>
                      File context active
                    </span>
                  )}
                  {projectTreeRef.current && (
                    <span className="text-[8px] px-1.5 py-0.5 border"
                      style={{ borderColor: "#60a5fa40", color: "#60a5fa", backgroundColor: "#60a5fa10" }}>
                      Tree loaded
                    </span>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-2">
                    <Bot className="size-8 opacity-10" style={{ color: C.accent }} />
                    <p className="text-[10px]" style={{ color: C.dim }}>
                      {fileContent
                        ? `Ask anything about ${selectedFile?.name}`
                        : "Open a file and ask the AI to explain, review, or improve it"}
                    </p>
                    {fileContent && (
                      <div className="space-y-1.5 w-full">
                        {[
                          "Explain this file",
                          "Find potential bugs",
                          "How can this be improved?",
                          "Write tests for this",
                        ].map(p => (
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
                    <div className="group relative max-w-[85%]">
                      <div className="px-3 py-2 border text-[11px] leading-relaxed"
                        style={{
                          backgroundColor: msg.role === "user" ? "rgba(232,99,10,0.08)" : C.bg,
                          borderColor:     msg.role === "user" ? `${C.accent}40` : C.border,
                          color:           C.text,
                          whiteSpace:      "pre-wrap",
                          wordBreak:       "break-word",
                          fontFamily:      C.font,
                        }}>
                        {msg.content || (
                          isStreaming && <span className="inline-block w-1.5 h-3.5 bg-orange-400 animate-pulse align-middle" />
                        )}
                      </div>
                      {msg.content && (
                        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => copyMessage(msg.id, msg.content)}
                            className="flex items-center gap-1 h-5 px-1.5 text-[8px] border transition-colors"
                            style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                            {copied === msg.id ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                            {copied === msg.id ? "Copied" : "Copy"}
                          </button>
                          {/* Show "Apply to File" when message has code block */}
                          {msg.role === "assistant" && msg.content.includes("```") && (
                            <button onClick={() => applyToFile(msg.content)}
                              className="flex items-center gap-1 h-5 px-1.5 text-[8px] border transition-colors"
                              style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "transparent" }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#34d39910")}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                              <FileCode className="size-2.5" />
                              {msg.content.match(/\[APPLY:\s*([^\]]+)\]/)?.[1]?.split("/").pop()
                                ?? selectedFile?.name
                                ?? "Apply to File"}
                            </button>
                          )}
                        </div>
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
                  <textarea
                    ref={inputRef}
                    placeholder={isStreaming ? "Waiting…" : "Ask about the code…"}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    disabled={isStreaming}
                    rows={1}
                    className="flex-1 px-2.5 py-2 text-[11px] focus:outline-none resize-none disabled:opacity-50"
                    style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font, minHeight: 36, maxHeight: 120 }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                    onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }}
                  />
                  <button onClick={() => handleSend()} disabled={isStreaming || !input.trim()}
                    className="flex items-center justify-center h-9 w-9 border transition-colors disabled:opacity-40 shrink-0"
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
