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
  SmilePlus, Brain, Network, Workflow, Settings2,
  FolderPlus, HardDrive, ArrowLeft, Home,
  TerminalSquare, ChevronUp, StopCircle,
} from "lucide-react";

const C = {
  bg:      "#080d12",
  panel:   "#0d1117",
  border:  "#1a2535",
  muted:   "#253040",
  dim:     "#4a6070",
  text:    "#c8d8e8",
  accent:  "#e8630a",
  font:    "'JetBrains Mono','Fira Code',monospace",
  success: "#34d399",
  warn:    "#fbbf24",
  error:   "#f87171",
  info:    "#60a5fa",
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

/** Detected intent from user input */
type Intent =
  | "question"
  | "code_change"
  | "review"
  | "debug"
  | "explain"
  | "general";

/** Named entities detected in the user's message */
interface Entities {
  files:    string[];
  features: string[];
  errors:   string[];
}

/** Per-message sentiment */
type Sentiment = "positive" | "negative" | "neutral";

interface Message {
  id:        string;
  role:      "user" | "assistant" | "system";
  content:   string;
  source?:   string;
  tasks?:    Task[];
  recs?:     Recommendation[];
  intent?:   Intent;
  sentiment?: Sentiment;
  entities?: Entities;
}

/** User preference profile for personalisation */
interface UserPrefs {
  preferredLanguage: "TypeScript" | "JavaScript";
  verbosity:         "concise" | "detailed";
  autoApply:         boolean;
}

interface FolderNode { name: string; path: string; }
interface OllamaModel { name: string; size?: number; }

/* ─── NLP helpers (client-side, zero-dependency) ─────────────────── */

/**
 * Lightweight intent recognition.
 * Analyses keywords and question patterns to classify what the user wants.
 */
function detectIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (/\b(fix|bug|error|issue|broken|crash|exception|fail)\b/.test(t)) return "debug";
  if (/\b(explain|what is|how does|describe|tell me|clarify)\b/.test(t)) return "explain";
  if (/\b(review|check|look at|audit|improve|refactor|optimize)\b/.test(t)) return "review";
  if (/\b(add|create|generate|write|build|implement|update|change|modify|delete|remove)\b/.test(t)) return "code_change";
  if (/\?$/.test(t.trim()) || /\b(how|what|why|when|where|who|can you|could you)\b/.test(t)) return "question";
  return "general";
}

/**
 * Simple named-entity recognition — pulls file paths, known feature names,
 * and error patterns from raw text.
 */
function extractEntities(text: string): Entities {
  const files    = Array.from(new Set(text.match(/[\w\-./]+\.(tsx?|jsx?|json|css|md)/g) ?? []));
  const features = Array.from(new Set(
    (text.match(/\b(auth(?:entication)?|dashboard|sidebar|modal|form|table|chart|api|route|component|hook|util)\b/gi) ?? [])
      .map(s => s.toLowerCase()),
  ));
  const errors = Array.from(new Set(
    (text.match(/\b(?:TypeError|ReferenceError|SyntaxError|Error|undefined is not|cannot read|null|NaN)\b/g) ?? [])
      .map(s => s.trim()),
  ));
  return { files, features, errors };
}

/**
 * Keyword-based sentiment analysis.
 * Returns "positive", "negative", or "neutral".
 */
function analyseSentiment(text: string): Sentiment {
  const t = text.toLowerCase();
  const pos = (t.match(/\b(great|thanks|awesome|perfect|nice|good|love|excellent|helpful|works)\b/g) ?? []).length;
  const neg = (t.match(/\b(bad|wrong|broken|terrible|useless|hate|annoying|frustrating|doesn't work|not working)\b/g) ?? []).length;
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

/** Badge colour per sentiment */
function sentimentColor(s: Sentiment): string {
  if (s === "positive") return C.success;
  if (s === "negative") return C.error;
  return C.dim;
}

/** Human-readable intent labels */
const INTENT_LABELS: Record<Intent, string> = {
  question:    "Question",
  code_change: "Code Change",
  review:      "Review",
  debug:       "Debug",
  explain:     "Explain",
  general:     "General",
};

const INTENT_COLORS: Record<Intent, string> = {
  question:    C.info,
  code_change: C.accent,
  review:      C.warn,
  debug:       C.error,
  explain:     "#c084fc",
  general:     C.dim,
};

/* ─── Context-aware greeting helper ─────────────────────────────── */
function buildContextGreeting(
  messages: Message[],
  intent: Intent,
  entities: Entities,
  prefs: UserPrefs,
): string {
  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
  const parts: string[] = [];

  // Reference previous context if available
  if (lastAssistant && messages.length > 2) {
    parts.push("Continuing from our previous exchange.");
  }

  // Inject relevant file context
  if (entities.files.length > 0) {
    parts.push(`Referring to: ${entities.files.join(", ")}.`);
  }

  // Error context
  if (entities.errors.length > 0) {
    parts.push(`Detected error references: ${entities.errors.join(", ")}.`);
  }

  // Verbosity hint
  if (prefs.verbosity === "concise") {
    parts.push("Be concise — bullet points preferred.");
  } else {
    parts.push("Provide a detailed explanation with examples.");
  }

  // Language preference
  parts.push(`Use ${prefs.preferredLanguage} syntax in all code examples.`);

  return parts.join(" ");
}

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

CAPABILITIES:
- Intent-aware: understand whether the user wants to ask, debug, review, or build.
- Entity-aware: identify files, component names, and error types in requests.
- Context-aware: reference the current conversation history and open file.
- Sentiment-aware: if the user expresses frustration, acknowledge it briefly before answering.
- Personalised: adapt explanation depth based on stated preferences.

When modifying code, respond with a STRUCTURED TASK LIST using EXACTLY this format:

### Tasks

**Task 1: [title]**
Description: [what and why]
\`\`\`patch
FILE: relative/path/to/file.tsx
LINES: FULL
---
complete new file content here
\`\`\`

### Feature Recommendations
1. [name] — description
2. [name] — description

CRITICAL RULES:
- ALWAYS use LINES: FULL — never use line numbers (they cause duplication bugs)
- Each task = one file. If multiple changes to same file, combine into ONE task
- Return the COMPLETE file content after the --- separator. Never truncate.
- No placeholders like "// ... rest of code"
- For questions (no code change), respond normally without the task format.
- If the user seems frustrated (negative sentiment), start with a brief empathetic acknowledgment.
- When the user references a specific file or entity, address it directly.`;

/* ─── Default user prefs ─────────────────────────────────────────── */
const DEFAULT_PREFS: UserPrefs = {
  preferredLanguage: "TypeScript",
  verbosity:         "detailed",
  autoApply:         false,
};

/* ─── FolderRow ───────────────────────────────────────────────────── */
function FolderRow({ entry, depth, onSelect, selectedPath, onLoadDir, dirCache }: {
  entry: FolderNode & { type: "file" | "dir" }; depth: number;
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
  const color = entry.type === "dir" ? (expanded ? C.accent : C.warn) : getFileColor(entry.name);

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
            {loading
              ? <Loader2 className="size-3 shrink-0 animate-spin" style={{ color: C.accent }} />
              : expanded
                ? <ChevronDown className="size-2.5 shrink-0" />
                : <ChevronRight className="size-2.5 shrink-0" />}
            {expanded
              ? <FolderOpen className="size-3 shrink-0" style={{ color }} />
              : <Folder    className="size-3 shrink-0" style={{ color }} />}
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
  // .env, .env.local, .env.development, etc.
  if (name === ".env" || name.startsWith(".env.") || e === "env") return C.error;
  if (["tsx", "jsx"].includes(e ?? "")) return C.info;
  if (["ts",  "js" ].includes(e ?? "")) return C.warn;
  if (e === "json") return C.success;
  if (e === "css")  return "#c084fc";
  if (e === "md")   return "#94a3b8";
  if (e === "env")  return C.error;
  return C.dim;
}

/* ─── Preferences Panel ─────────────────────────────────────────── */
function PrefsPanel({ prefs, onChange }: { prefs: UserPrefs; onChange: (p: UserPrefs) => void }) {
  return (
    <div className="border-t" style={{ borderColor: C.border }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: C.panel }}>
        <Settings2 className="size-3" style={{ color: C.accent }} />
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>Preferences</span>
      </div>
      <div className="px-3 py-2 space-y-2">
        {/* Language */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px]" style={{ color: C.dim }}>Language</span>
          <select
            value={prefs.preferredLanguage}
            onChange={e => onChange({ ...prefs, preferredLanguage: e.target.value as UserPrefs["preferredLanguage"] })}
            className="text-[9px] px-1.5 py-0.5 border outline-none"
            style={{ backgroundColor: C.bg, borderColor: C.border, color: C.text }}>
            <option value="TypeScript">TypeScript</option>
            <option value="JavaScript">JavaScript</option>
          </select>
        </div>
        {/* Verbosity */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px]" style={{ color: C.dim }}>Verbosity</span>
          <select
            value={prefs.verbosity}
            onChange={e => onChange({ ...prefs, verbosity: e.target.value as UserPrefs["verbosity"] })}
            className="text-[9px] px-1.5 py-0.5 border outline-none"
            style={{ backgroundColor: C.bg, borderColor: C.border, color: C.text }}>
            <option value="concise">Concise</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
        {/* Auto-apply */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px]" style={{ color: C.dim }}>Auto-apply tasks</span>
          <button
            onClick={() => onChange({ ...prefs, autoApply: !prefs.autoApply })}
            className="text-[9px] px-1.5 py-0.5 border transition-colors"
            style={{
              borderColor: prefs.autoApply ? C.accent : C.border,
              color: prefs.autoApply ? C.accent : C.dim,
              backgroundColor: prefs.autoApply ? "rgba(232,99,10,0.1)" : "transparent",
            }}>
            {prefs.autoApply ? "ON" : "OFF"}
          </button>
        </div>
      </div>
    </div>
  );
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
          {done > 0 && <span className="text-[9px]" style={{ color: C.success }}>({done} done)</span>}
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
                <div className="shrink-0 mt-0.5">
                  {task.status === "done"     && <CheckCircle2 className="size-3.5" style={{ color: C.success }} />}
                  {task.status === "error"    && <AlertCircle  className="size-3.5" style={{ color: C.error  }} />}
                  {task.status === "applying" && <Loader2      className="size-3.5 animate-spin" style={{ color: C.accent }} />}
                  {task.status === "pending"  && (
                    <span className="flex h-3.5 w-3.5 items-center justify-center border text-[8px] font-bold"
                      style={{ borderColor: C.border, color: C.muted }}>{task.num}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold"
                    style={{ color: task.status === "done" ? C.success : C.text }}>
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
                    <p className="text-[9px] mt-1" style={{ color: C.error }}>{task.error}</p>
                  )}
                </div>
              </div>
              {task.status === "pending" && (
                <button onClick={() => onApplyTask(task)}
                  className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase border shrink-0 transition-colors"
                  style={{ borderColor: `${C.success}40`, color: C.success, backgroundColor: "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${C.success}10`)}
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
            <Lightbulb className="size-3.5" style={{ color: C.warn }} />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.warn }}>
              Feature Recommendations
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: C.border }}>
            {recs.map(rec => (
              <div key={rec.n} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="text-[9px] font-bold shrink-0 mt-0.5" style={{ color: C.warn }}>{rec.n}.</span>
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

/* ─── Message metadata badges ───────────────────────────────────── */
function MessageMeta({ intent, sentiment, entities }: {
  intent?: Intent; sentiment?: Sentiment; entities?: Entities;
}) {
  if (!intent && !sentiment) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {intent && intent !== "general" && (
        <span className="text-[8px] px-1.5 py-0.5 border font-bold uppercase"
          style={{ borderColor: `${INTENT_COLORS[intent]}40`, color: INTENT_COLORS[intent], backgroundColor: `${INTENT_COLORS[intent]}10` }}>
          {INTENT_LABELS[intent]}
        </span>
      )}
      {sentiment && sentiment !== "neutral" && (
        <span className="text-[8px] px-1.5 py-0.5 border"
          style={{ borderColor: `${sentimentColor(sentiment)}40`, color: sentimentColor(sentiment), backgroundColor: `${sentimentColor(sentiment)}10` }}>
          {sentiment}
        </span>
      )}
      {entities && entities.files.length > 0 && entities.files.slice(0, 2).map(f => (
        <span key={f} className="text-[8px] px-1.5 py-0.5 border font-mono"
          style={{ borderColor: `${C.info}30`, color: C.info, backgroundColor: `${C.info}08` }}>
          {f.split("/").pop()}
        </span>
      ))}
    </div>
  );
}

/* ─── Terminal Panel ─────────────────────────────────────────────── */

/** ANSI SGR color map → CSS color */
const ANSI_COLORS: Record<number, string> = {
  30: "#4a5568", 31: "#f87171", 32: "#34d399", 33: "#fbbf24",
  34: "#60a5fa", 35: "#c084fc", 36: "#22d3ee", 37: "#c8d8e8",
  90: "#4a6070", 91: "#ff8080", 92: "#50e0a0", 93: "#fcd34d",
  94: "#93c5fd", 95: "#d8b4fe", 96: "#67e8f9", 97: "#ffffff",
};
const ANSI_BG: Record<number, string> = {
  40: "#1a2535", 41: "#450a0a", 42: "#064e3b", 43: "#451a03",
  44: "#1e3a5f", 45: "#3b0764", 46: "#164e63", 47: "#374151",
};

interface AnsiSpan { text: string; color?: string; bg?: string; bold?: boolean; dim?: boolean; }

/** Parse an ANSI-escaped string into styled spans */
function parseAnsi(raw: string): AnsiSpan[] {
  // Strip carriage returns
  const s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const spans: AnsiSpan[] = [];
  // Regex matches ESC[ ... m sequences
  const re = /\x1b\[([0-9;]*)m/g;
  let pos = 0;
  let cur: Omit<AnsiSpan, "text"> = {};

  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > pos) spans.push({ ...cur, text: s.slice(pos, m.index) });
    pos = m.index + m[0].length;
    const codes = m[1].split(";").map(Number);
    for (const code of codes) {
      if (code === 0)  { cur = {}; continue; }
      if (code === 1)  { cur = { ...cur, bold: true }; continue; }
      if (code === 2)  { cur = { ...cur, dim: true }; continue; }
      if (code === 22) { cur = { ...cur, bold: false, dim: false }; continue; }
      if (code === 39) { const { color: _, ...rest } = cur as any; cur = rest; continue; }
      if (code === 49) { const { bg: _, ...rest } = cur as any; cur = rest; continue; }
      if (ANSI_COLORS[code]) { cur = { ...cur, color: ANSI_COLORS[code] }; continue; }
      if (ANSI_BG[code])     { cur = { ...cur, bg:    ANSI_BG[code]     }; continue; }
    }
  }
  if (pos < s.length) spans.push({ ...cur, text: s.slice(pos) });
  return spans.filter(sp => sp.text.length > 0);
}

/** Strip all ANSI codes — used for plain-text copy to AI */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "");
}

interface TermLine {
  id:     string;
  raw:    string;            // original text with ANSI
  type:   "stdout" | "stderr" | "input" | "info";
}
function TerminalPanel({
  initialCwd,
  onSendToAI,
}: {
  initialCwd: string;
  onSendToAI: (text: string) => void;
}) {
  const [lines,   setLines]   = useState<TermLine[]>([]);
  const [input,   setInput]   = useState("");
  const [running, setRunning] = useState(false);
  const [cwd,     setCwd]     = useState(initialCwd || "");
  const [cmdHist, setCmdHist] = useState<string[]>([]);
  const [lastCmd, setLastCmd] = useState("");                          // for Fix & Restart
  const [needsFix, setNeedsFix] = useState(false);                    // workspace mismatch detected
  const [fixing,   setFixing]   = useState(false);                    // patching in progress
  const [devUrl,   setDevUrl]   = useState<string | null>(null);      // detected dev server URL
  const [customPort,    setCustomPort]    = useState(() => {
    try { return localStorage.getItem("ai-terminal-port") ?? ""; } catch { return ""; }
  });
  const [showPortInput, setShowPortInput] = useState(false);

  // Persist custom port
  useEffect(() => {
    try {
      if (customPort) localStorage.setItem("ai-terminal-port", customPort);
      else localStorage.removeItem("ai-terminal-port");
    } catch { /* ignore */ }
  }, [customPort]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);
  const abortRef              = useRef<AbortController | null>(null);
  const sessionRef            = useRef<string | null>(null); // server-side session id for kill

  // Sync cwd when prop changes (e.g. user selects a folder)
  useEffect(() => { if (initialCwd) setCwd(initialCwd); }, [initialCwd]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const pushLine = (raw: string, type: TermLine["type"]) =>
    setLines(prev => [...prev, { id: crypto.randomUUID(), raw, type }]);

  /** Append chunk to the last line if same type, otherwise create new line */
  const appendOrPush = (chunk: string, type: "stdout" | "stderr") => {
    setLines(prev => {
      if (prev.length > 0 && prev[prev.length - 1].type === type) {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, raw: last.raw + chunk }];
      }
      return [...prev, { id: crypto.randomUUID(), raw: chunk, type }];
    });
  };

  const run = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    // Built-in clear
    if (trimmed === "clear" || trimmed === "cls") { setLines([]); return; }

    pushLine(`$ ${trimmed}`, "input");
    setCmdHist(h => [trimmed, ...h.filter(x => x !== trimmed)].slice(0, 200));
    setLastCmd(trimmed);
    setHistIdx(-1);
    setNeedsFix(false);
    setDevUrl(null);
    setRunning(true);
    sessionRef.current = null;

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // For `cd`, resolve the new cwd and update state without printing output
      const isCD = /^cd(\s|$)/i.test(trimmed);

      // Port injection:
      // - Direct binaries (next dev, vite, astro dev): append --port N
      // - npm/yarn/pnpm scripts WITH custom port set: prepend `set PORT=N &&` (Windows)
      //   This avoids the `-- --port N` issue while still overriding the port cleanly.
      // - npm/yarn/pnpm scripts WITHOUT custom port: run as-is, Next.js auto-increments
      const isDevCmd = !isCD && /\b(dev|start|preview)\b/.test(trimmed);
      const portAlreadySet = /--port\s+\d+|-p\s+\d+|PORT=\d+/i.test(trimmed);
      const isNpmScript = /^(npm(\s+run)?|yarn|pnpm)\s+\S/.test(trimmed);
      let portSuffix = "";
      let portPrefix = "";
      if (customPort && isDevCmd && !portAlreadySet) {
        if (isNpmScript) {
          // Use env var prefix — works on Windows cmd, doesn't break dotenv loading
          portPrefix = `set PORT=${customPort} && `;
        } else {
          // Direct binary — safe to use --port flag
          portSuffix = ` --port ${customPort}`;
        }
      }

      const command = isCD
        ? `cd /d ${trimmed.slice(2).trim() || "%USERPROFILE%"} && cd`
        : `${portPrefix}${trimmed}${portSuffix}`;

      // Show the effective command when port was injected
      if (portPrefix || portSuffix) {
        pushLine(`  → port override: ${portPrefix}${trimmed}${portSuffix}\n`, "info");
      }

      const res = await fetch("/api/ai/terminal", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ command, cwd: cwd || undefined }),
        signal:  ac.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        pushLine(err.error ?? "Request failed", "stderr");
        return;
      }

      const reader = res.body!.getReader();
      const dec    = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const d = JSON.parse(part.slice(6).trim());

            // Store session id so Kill button can send DELETE to server
            if (d.type === "session") {
              sessionRef.current = d.id;
              continue;
            }

            // Port-reassignment notice from server
            if (d.type === "info") {
              pushLine(d.text ?? "", "info");
              // If the server detected a workspace root mismatch, show Fix button
              if ((d.text ?? "").includes("Workspace Root Mismatch") ||
                  (d.text ?? "").includes("inferred your workspace root") ||
                  (d.text ?? "").includes("AUTO-FIXED")) {
                setNeedsFix(true);
              }
              continue;
            }

            if (d.type === "stdout") {
              if (isCD) {
                const newCwd = stripAnsi(d.text).trim();
                if (newCwd) setCwd(newCwd);
              } else {
                const plain = stripAnsi(d.text);
                // Detect workspace root mismatch from raw Next.js stdout
                if (plain.includes("inferred your workspace root")) {
                  setNeedsFix(true);
                }
                // Detect actual running URL from dev server output
                // Matches: "Local:   http://localhost:3001" or "- Local: http://localhost:3001"
                const urlMatch = plain.match(/Local:\s+(https?:\/\/localhost:\d+)/i);
                if (urlMatch) setDevUrl(urlMatch[1]);
                appendOrPush(d.text, "stdout");
              }
              continue;
            }

            if (d.type === "stderr") {
              appendOrPush(d.text, "stderr");
              continue;
            }

            if (d.type === "exit") {
              // Show exit code only on failure; success exits are silent
              if (d.code !== 0 && d.code !== null) {
                pushLine(`[exited with code ${d.code}]\n`, "info");
              }
            }
          } catch { /* skip malformed SSE chunk */ }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") pushLine(`Error: ${e.message}\n`, "stderr");
    } finally {
      sessionRef.current = null;
      setRunning(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  /** Kill the running process — sends DELETE to server so the OS tree is killed */
  const killRunning = async () => {
    // First abort the fetch stream so the client disconnects
    abortRef.current?.abort();

    // Then ask the server to taskkill the process tree
    const sid = sessionRef.current;
    if (sid) {
      try {
        await fetch("/api/ai/terminal", {
          method:  "DELETE",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ sessionId: sid }),
        });
      } catch { /* ignore — process may have already exited */ }
      sessionRef.current = null;
    }

    setRunning(false);
    pushLine("^C\n", "info");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { run(input); setInput(""); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const i = Math.min(histIdx + 1, cmdHist.length - 1);
      setHistIdx(i); setInput(cmdHist[i] ?? "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const i = Math.max(histIdx - 1, -1);
      setHistIdx(i); setInput(i === -1 ? "" : cmdHist[i]);
    }
    if (e.key === "c" && e.ctrlKey) { e.preventDefault(); killRunning(); }
    if (e.key === "l" && e.ctrlKey) { e.preventDefault(); setLines([]); }
  };

  const getLastOutputPlain = () =>
    lines.map(l => stripAnsi(l.raw)).join("").slice(-6000);

  const baseColor = (type: TermLine["type"]) => {
    if (type === "stderr") return C.error;
    if (type === "input")  return C.accent;
    if (type === "info")   return C.warn;   // amber — visible for port notices & warnings
    return C.text;
  };

  /** Linkify http/https URLs inside a plain text string */
  const linkify = (text: string, baseColor: string) => {
    const urlRe = /(https?:\/\/[^\s\])"']+)/g;
    const parts = text.split(urlRe);
    if (parts.length === 1) return <span style={{ color: baseColor }}>{text}</span>;
    return (
      <>
        {parts.map((part, i) =>
          urlRe.test(part) ? (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer"
              style={{ color: C.info, textDecoration: "underline", cursor: "pointer" }}>
              {part}
            </a>
          ) : (
            <span key={i} style={{ color: baseColor }}>{part}</span>
          )
        )}
      </>
    );
  };

  /** Render a line: ANSI-parse stdout/stderr, plain for others */
  const renderLine = (line: TermLine) => {
    if (line.type === "stdout" || line.type === "stderr") {
      const spans = parseAnsi(line.raw);
      const fallbackColor = baseColor(line.type);
      if (spans.length === 1 && !spans[0].color && !spans[0].bg && !spans[0].bold) {
        return linkify(spans[0].text, fallbackColor);
      }
      return (
        <>
          {spans.map((sp, i) => {
            const col = sp.color ?? fallbackColor;
            // Linkify within each span
            return <span key={i} style={{
              color:      col,
              background: sp.bg,
              fontWeight: sp.bold ? "bold"  : undefined,
              opacity:    sp.dim  ? 0.6     : undefined,
            }}>{sp.text}</span>;
          })}
        </>
      );
    }
    return linkify(line.raw, baseColor(line.type));
  };

  const shortCwd = cwd
    ? cwd.replace(/\\/g, "/").split("/").slice(-2).join("/")
    : "~";

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: C.font, backgroundColor: "#0a0f16" }}>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-1 border-b shrink-0"
        style={{ borderColor: C.border, backgroundColor: C.panel }}>
        <TerminalSquare className="size-3 shrink-0" style={{ color: C.success }} />
        <span className="text-[9px] font-mono truncate flex-1" style={{ color: C.dim }} title={cwd}>
          {cwd || "~"}
        </span>
        {/* Detected dev server URL — clickable pill */}
        {devUrl && (
          <a
            href={devUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-1.5 h-5 text-[8px] font-bold border shrink-0 transition-colors"
            style={{ borderColor: `${C.success}50`, color: C.success, backgroundColor: `${C.success}10`, textDecoration: "none" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${C.success}25`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = `${C.success}10`; }}>
            <Zap className="size-2.5" />
            {devUrl.replace("http://", "")}
          </a>
        )}
        {/* Custom port picker — only applies to direct binaries (next dev, vite), not npm scripts */}
        {showPortInput ? (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[8px]" style={{ color: C.dim }}>port:</span>
            <input
              type="number"
              min={1024}
              max={65535}
              value={customPort}
              onChange={e => setCustomPort(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setShowPortInput(false); }}
              placeholder="3001"
              className="w-14 px-1 text-[9px] font-mono focus:outline-none"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.accent}`, color: C.text, height: 20 }}
              autoFocus
            />
            <button
              onClick={() => { setCustomPort(""); setShowPortInput(false); }}
              className="text-[8px] px-1 border"
              style={{ borderColor: C.border, color: C.dim, height: 20 }}
              title="Clear port override">
              <X className="size-2.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowPortInput(true)}
            className="flex items-center gap-1 h-5 px-1.5 text-[8px] border shrink-0 transition-colors"
            style={{
              borderColor: customPort ? C.accent : C.border,
              color:       customPort ? C.accent : C.dim,
              backgroundColor: customPort ? `${C.accent}10` : "transparent",
            }}
            title={customPort
              ? `Port override: ${customPort} — npm scripts use set PORT=${customPort}`
              : "Set port (works for npm run dev, next dev, vite, etc.)"}>
            <span style={{ fontFamily: C.font }}>{customPort ? `:${customPort}` : ":port"}</span>
          </button>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {/* Fix next.config button — shown any time workspace mismatch detected (even while running) */}
          {needsFix && (
            <button
              onClick={async () => {
                setFixing(true);
                // 1. Kill the running process first if still alive
                if (running) {
                  pushLine("⚡ Stopping server to apply fix…\n", "info");
                  await killRunning();
                  // Small pause to let process tree die
                  await new Promise(r => setTimeout(r, 500));
                }
                pushLine("⚡ Patching next.config.ts…\n", "info");
                try {
                  const res  = await fetch("/api/ai/terminal", {
                    method:  "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ cwd }),
                  });
                  const json = await res.json();
                  if (json.patched) {
                    pushLine(`✓ Patched ${json.file.split(/[\\/]/).pop()} — restarting…\n`, "info");
                    setNeedsFix(false);
                    setFixing(false);
                    setTimeout(() => run(lastCmd), 400);
                  } else if (json.error === "already set") {
                    // Config already has turbopack.root — problem must be the stray lockfile
                    pushLine("⚠ turbopack.root already set in config.\n", "info");
                    pushLine("  The stray C:\\Users\\VICTUS\\package-lock.json is causing this.\n", "info");
                    pushLine("  Run: del C:\\Users\\VICTUS\\package-lock.json\n  then restart.\n", "info");
                    setNeedsFix(false);
                    setFixing(false);
                  } else {
                    pushLine(`✗ Auto-patch failed: ${json.error}\n`, "stderr");
                    pushLine("  Manually add to next.config.ts:\n  turbopack: { root: __dirname }\n", "info");
                    setFixing(false);
                  }
                } catch (e: any) {
                  pushLine(`✗ ${e.message}\n`, "stderr");
                  setFixing(false);
                }
              }}
              disabled={fixing}
              className="flex items-center gap-1 h-5 px-2 text-[8px] font-bold uppercase border animate-pulse"
              style={{ borderColor: C.warn, color: "#000", backgroundColor: C.warn }}>
              {fixing
                ? <><Loader2 className="size-2.5 animate-spin" /> Fixing…</>
                : <><Zap className="size-2.5" /> Fix &amp; Restart</>}
            </button>
          )}
          {lines.length > 0 && !running && (
            <button
              onClick={() => onSendToAI(`Analyze this terminal output:\n\`\`\`\n${getLastOutputPlain()}\n\`\`\`\nExplain what happened and suggest fixes for any errors.`)}
              className="flex items-center gap-1 h-5 px-1.5 text-[8px] uppercase border transition-colors"
              style={{ borderColor: C.border, color: C.dim }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
              <Bot className="size-2.5" /> Ask AI
            </button>
          )}
          {running && (
            <button
              onClick={() => killRunning()}
              className="flex items-center gap-1 h-5 px-1.5 text-[8px] uppercase border"
              style={{ borderColor: `${C.error}60`, color: C.error, backgroundColor: `${C.error}10` }}>
              <StopCircle className="size-2.5" /> Kill
            </button>
          )}
          {/* Restart — kill + re-run last command. Useful after env/config changes */}
          {lastCmd && (
            <button
              onClick={async () => {
                if (running) {
                  await killRunning();
                  await new Promise(r => setTimeout(r, 400));
                }
                run(lastCmd);
              }}
              className="flex items-center gap-1 h-5 px-1.5 text-[8px] uppercase border transition-colors"
              style={{ borderColor: `${C.info}60`, color: C.info, backgroundColor: `${C.info}08` }}
              title={`Restart: ${lastCmd}`}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${C.info}18`; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${C.info}08`; }}>
              <RefreshCw className="size-2.5" /> Restart
            </button>
          )}
          <button
            onClick={() => setLines([])}
            className="flex items-center justify-center h-5 w-5 border transition-colors"
            style={{ borderColor: C.border, color: C.dim }}
            title="Clear (Ctrl+L)"
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.error; e.currentTarget.style.color = C.error; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
            <Trash2 className="size-2.5" />
          </button>
        </div>
      </div>

      {/* ── Output area ── */}
      <div
        className="flex-1 overflow-y-auto px-3 pt-2 pb-1"
        style={{ fontSize: 11, lineHeight: "19px" }}
        onClick={() => inputRef.current?.focus()}>
        {lines.length === 0 && (
          <p style={{ color: C.muted, fontSize: 10, fontFamily: C.font }}>
            Ready. Type a command below — e.g. <span style={{ color: C.accent }}>npm run dev</span>, <span style={{ color: C.accent }}>git status</span>, <span style={{ color: C.accent }}>dir</span>
            <br />↑↓ history · Ctrl+C interrupt · Ctrl+L clear
          </p>
        )}
        {lines.map(line => (
          <pre key={line.id} style={{
            margin: 0, padding: 0,
            whiteSpace: "pre-wrap", wordBreak: "break-all",
            fontFamily: C.font, fontSize: 11, lineHeight: "19px",
          }}>
            {renderLine(line)}
          </pre>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Input row ── */}
      <div className="shrink-0 flex items-center border-t"
        style={{ borderColor: C.border, backgroundColor: C.panel, minHeight: 34 }}>
        <span className="pl-3 pr-1 text-[10px] font-mono whitespace-nowrap select-none shrink-0"
          style={{ color: C.success }}>
          {shortCwd} $
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          className="flex-1 py-2 pr-3 text-[11px] focus:outline-none bg-transparent"
          style={{ color: C.text, fontFamily: C.font, border: "none", opacity: running ? 0.5 : 1 }}
          placeholder={running ? "running…" : ""}
        />
        {running && <Loader2 className="size-3 animate-spin mr-2 shrink-0" style={{ color: C.accent }} />}
      </div>
    </div>
  );
}

/* ─── External Folder Browser ────────────────────────────────────── */
interface BrowseEntry {
  name: string;
  type: "file" | "dir";
  path: string;
  size?: number;
}

function ExternalBrowser({
  onOpenFile,
  onSelectFolder,
  onClose,
}: {
  onOpenFile:     (entry: BrowseEntry) => void;
  onSelectFolder: (path: string) => void;
  onClose:        () => void;
}) {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [entries,     setEntries]     = useState<BrowseEntry[]>([]);
  const [history,     setHistory]     = useState<string[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [manualPath,  setManualPath]  = useState("");
  const [showInput,   setShowInput]   = useState(false);

  const navigate = async (p: string, pushHistory = true) => {
    setLoading(true); setError("");
    try {
      const url = p === ""
        ? "/api/ai/browse?drives=1"
        : `/api/ai/browse?path=${encodeURIComponent(p)}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      const next = json.entries ?? [];
      if (pushHistory && currentPath !== "") {
        setHistory(h => [...h, currentPath]);
      }
      setCurrentPath(p);
      setEntries(next);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Load drive roots on mount
  useEffect(() => { navigate("", false); }, []);

  const goBack = () => {
    if (history.length === 0) { navigate("", false); setHistory([]); return; }
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    navigate(prev, false);
  };

  const goHome = () => { setHistory([]); navigate("", false); };

  const handleManualGo = () => {
    if (!manualPath.trim()) return;
    setHistory([]);
    navigate(manualPath.trim(), false);
    setShowInput(false);
    setManualPath("");
  };

  const fmtSize = (b?: number) => {
    if (!b) return "";
    if (b < 1024) return `${b}B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
    return `${(b / 1024 / 1024).toFixed(1)}MB`;
  };

  // Breadcrumb segments from currentPath
  const segments = currentPath
    ? currentPath.replace(/\\/g, "/").split("/").filter(Boolean)
    : [];

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: C.font }}>
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b shrink-0"
        style={{ borderColor: C.border, backgroundColor: C.panel }}>
        <FolderPlus className="size-3.5 shrink-0" style={{ color: C.accent }} />
        <span className="text-[9px] font-bold uppercase tracking-widest flex-1" style={{ color: C.accent }}>
          Open Folder
        </span>
        <button onClick={onClose} style={{ color: C.dim }}
          onMouseEnter={e => (e.currentTarget.style.color = C.error)}
          onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
          <X className="size-3.5" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b shrink-0"
        style={{ borderColor: C.border, backgroundColor: C.bg }}>
        <button onClick={goBack} disabled={history.length === 0 && currentPath === ""}
          className="flex items-center justify-center h-5 w-5 border disabled:opacity-30 transition-colors"
          style={{ borderColor: C.border, color: C.dim }}
          title="Back"
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
          <ArrowLeft className="size-2.5" />
        </button>
        <button onClick={goHome}
          className="flex items-center justify-center h-5 w-5 border transition-colors"
          style={{ borderColor: C.border, color: C.dim }}
          title="Drive roots"
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
          <HardDrive className="size-2.5" />
        </button>

        {/* Breadcrumb / manual path */}
        <div className="flex-1 min-w-0">
          {showInput ? (
            <div className="flex gap-1">
              <input
                autoFocus
                value={manualPath}
                onChange={e => setManualPath(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleManualGo(); if (e.key === "Escape") setShowInput(false); }}
                placeholder="Paste an absolute path…"
                className="flex-1 px-1.5 text-[9px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.accent}`, color: C.text, height: 20 }} />
              <button onClick={handleManualGo}
                className="text-[8px] px-1.5 border"
                style={{ borderColor: C.accent, color: C.accent, backgroundColor: "rgba(232,99,10,0.1)" }}>
                Go
              </button>
            </div>
          ) : (
            <button onClick={() => { setShowInput(true); setManualPath(currentPath); }}
              className="w-full text-left px-1.5 text-[9px] truncate transition-colors"
              style={{ color: C.muted, height: 20 }}
              title={currentPath || "Drive roots"}
              onMouseEnter={e => (e.currentTarget.style.color = C.text)}
              onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
              {currentPath || "/ Drives"}
            </button>
          )}
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
          </div>
        )}
        {error && (
          <div className="px-3 py-2">
            <p className="text-[9px]" style={{ color: C.error }}>{error}</p>
          </div>
        )}
        {!loading && !error && entries.length === 0 && (
          <p className="text-[9px] px-3 py-4 text-center" style={{ color: C.muted }}>Empty directory</p>
        )}
        {!loading && entries.map((entry: any) => {
          const color = entry.type === "dir" ? C.warn : getFileColor(entry.name);
          return (
            <button key={entry.path}
              onClick={() => {
                if (entry.type === "dir") navigate(entry.path);
                else onOpenFile(entry);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors border-b"
              style={{ borderColor: `${C.border}60`, backgroundColor: "transparent", color: C.dim }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.05)")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
              {entry.type === "dir"
                ? <Folder  className="size-3 shrink-0" style={{ color }} />
                : <File    className="size-3 shrink-0" style={{ color }} />}
              <span className="flex-1 truncate text-[10px]" style={{ color: C.text }}>{entry.name}</span>
              {entry.size != null && (
                <span className="text-[8px] shrink-0" style={{ color: C.muted }}>{fmtSize(entry.size)}</span>
              )}
              {entry.type === "dir" && (
                <ChevronRight className="size-2.5 shrink-0" style={{ color: C.muted }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Select This Folder footer ── */}
      {currentPath !== "" && (
        <div className="shrink-0 border-t px-2 py-2 flex flex-col gap-1"
          style={{ borderColor: C.border, backgroundColor: C.panel }}>
          {/* Current folder name pill */}
          <div className="flex items-center gap-1.5 px-2 py-1 border"
            style={{ borderColor: `${C.warn}40`, backgroundColor: `${C.warn}08` }}>
            <FolderOpen className="size-3 shrink-0" style={{ color: C.warn }} />
            <span className="text-[9px] font-mono truncate flex-1" style={{ color: C.warn }}
              title={currentPath}>
              {currentPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? currentPath}
            </span>
          </div>
          <button
            onClick={() => { onSelectFolder(currentPath); onClose(); }}
            className="w-full flex items-center justify-center gap-1.5 h-7 text-[9px] font-bold uppercase border transition-colors"
            style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#ff7a1a")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = C.accent)}>
            <FolderOpen className="size-3" />
            Use This Folder
          </button>
          <p className="text-[8px] text-center" style={{ color: C.muted }}>
            AI will read all files in this directory as context
          </p>
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
  const modelDropRef = useRef<HTMLDivElement>(null);

  // Chat history
  const [sessionId,   setSessionId]   = useState<string | null>(null);
  const [sessions,    setSessions]    = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [histLoading, setHistLoading] = useState(false);

  // External folder browser
  const [showBrowser,    setShowBrowser]    = useState(false);
  const [browserMode,    setBrowserMode]    = useState<"project" | "external">("project");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(() => {
    try { return localStorage.getItem("ai-selected-folder") ?? null; } catch { return null; }
  });
  const [folderContext,  setFolderContext]  = useState<string>("");

  // Restore folder context on mount if a folder was previously selected
  useEffect(() => {
    const saved = selectedFolder;
    if (!saved) return;
    fetch(`/api/ai/browse?path=${encodeURIComponent(saved)}`)
      .then(r => r.json())
      .then(json => {
        const fileNames = (json.entries ?? [])
          .map((e: any) => `${e.type === "dir" ? "📁" : "📄"} ${e.name}`)
          .join("\n");
        setFolderContext(`Active working folder: ${saved}\nContents:\n${fileNames || "(empty)"}`);
      })
      .catch(() => setFolderContext(`Active working folder: ${saved}`));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // Terminal — persist open/height state across refreshes
  const [showTerminal,   setShowTerminal]   = useState(() => {
    try { return localStorage.getItem("ai-terminal-open") === "1"; } catch { return false; }
  });
  const [terminalHeight, setTerminalHeight] = useState(() => {
    try { return parseInt(localStorage.getItem("ai-terminal-height") ?? "220", 10) || 220; } catch { return 220; }
  });
  const termDragRef = useRef<{ startY: number; startH: number } | null>(null);

  // Persist terminal visibility and height
  useEffect(() => {
    try { localStorage.setItem("ai-terminal-open", showTerminal ? "1" : "0"); } catch { /* ignore */ }
  }, [showTerminal]);

  useEffect(() => {
    try { localStorage.setItem("ai-terminal-height", String(terminalHeight)); } catch { /* ignore */ }
  }, [terminalHeight]);

  // User preferences (personalisation)
  const [userPrefs,    setUserPrefs]    = useState<UserPrefs>(DEFAULT_PREFS);
  const [showPrefs,    setShowPrefs]    = useState(false);

  // Persist prefs to localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ai-chat-prefs");
      if (stored) setUserPrefs(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const handlePrefsChange = useCallback((p: UserPrefs) => {
    setUserPrefs(p);
    try { localStorage.setItem("ai-chat-prefs", JSON.stringify(p)); } catch { /* ignore */ }
  }, []);

  // Close model dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelDropRef.current && !modelDropRef.current.contains(e.target as Node)) {
        setShowModels(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [rootEntries,  setRootEntries]  = useState<any[]>([]);
  const [dirCache,     setDirCache]     = useState<Record<string, any[]>>({});
  const [treeLoading,  setTreeLoading]  = useState(true);
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
      .then(d => {
        if (d.success) {
          projectTreeRef.current = `Project (${d.stats?.totalFiles} files):\n\`\`\`\n${d.tree}\n\`\`\``;
        }
      });

    fetch("/api/ai/chat").then(r => r.json()).then(d => {
      setModels(d.models ?? []);
      setSelectedModel(d.models?.[0]?.name ?? "");
      setAiSource(d.source ?? "");
      if (!d.success) setOllamaOffline(true);
    });

    loadHistory();
  }, []);

  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const res  = await fetch("/api/ai/history?limit=30");
      const json = await res.json();
      if (json.success) setSessions(json.sessions ?? []);
    } catch { /* silent */ }
    finally { setHistLoading(false); }
  };

  const loadSession = async (id: string) => {
    try {
      const res  = await fetch(`/api/ai/history/${id}`);
      const json = await res.json();
      if (json.success) {
        setMessages(json.session.messages ?? []);
        setSessionId(id);
        setShowHistory(false);
      }
    } catch { toast.error("Failed to load session."); }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch("/api/ai/history", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: id }),
      });
      setSessions(prev => prev.filter(s => s._id?.toString() !== id));
      if (sessionId === id) { setMessages([]); setSessionId(null); }
    } catch { toast.error("Delete failed."); }
  };

  const newChat = () => {
    setMessages([]); setSessionId(null); setShowHistory(false);
  };

  // Auto-save after every complete AI response
  const saveSession = useCallback(async (msgs: Message[]) => {
    if (msgs.length === 0) return;
    const toSave = msgs.map(m => ({
      id: m.id, role: m.role, content: m.content, source: m.source ?? "",
    }));
    try {
      if (sessionId) {
        await fetch("/api/ai/history", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ _id: sessionId, messages: toSave, model: selectedModel }),
        });
      } else {
        const res  = await fetch("/api/ai/history", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: toSave, model: selectedModel }),
        });
        const json = await res.json();
        if (json.success) setSessionId(json.id?.toString() ?? null);
        loadHistory();
      }
    } catch { /* silent — don't interrupt UX */ }
  }, [sessionId, selectedModel]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadDir = useCallback(async (p: string): Promise<any[]> => {
    if (dirCache[p]) return dirCache[p];
    const res  = await fetch(`/api/ai/files?path=${encodeURIComponent(p)}`);
    const d    = await res.json();
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

  /** Open a file from the external browser (absolute path via /api/ai/browse) */
  const handleOpenExternalFile = async (entry: BrowseEntry) => {
    setShowBrowser(false);
    setSelectedFile({ name: entry.name, path: entry.path, type: "file", external: true });
    setFileLoading(true);
    try {
      const res = await fetch(`/api/ai/browse?path=${encodeURIComponent(entry.path)}`);
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to read file");
      setFileContent(d.content ?? "");
      setFilePath(entry.path);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to read file.");
      setSelectedFile(null);
    } finally {
      setFileLoading(false);
    }
  };

  /**
   * Called when the user clicks "Use This Folder" in the ExternalBrowser.
   * Fetches a recursive file listing of the chosen directory and stores it
   * as a context string that gets injected into every AI message.
   */
  const handleSelectFolder = async (folderPath: string) => {
    setSelectedFolder(folderPath);
    try { localStorage.setItem("ai-selected-folder", folderPath); } catch { /* ignore */ }
    setBrowserMode("project");
    setShowBrowser(false);
    toast.success(`Folder set: ${folderPath.replace(/\\/g, "/").split("/").pop()}`);
    try {
      // Fetch the top-2 levels of the folder so the AI knows its structure
      const res  = await fetch(`/api/ai/browse?path=${encodeURIComponent(folderPath)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const fileNames = (json.entries ?? [])
        .map((e: BrowseEntry) => `${e.type === "dir" ? "📁" : "📄"} ${e.name}`)
        .join("\n");
      setFolderContext(
        `Active working folder: ${folderPath}\nContents:\n${fileNames || "(empty)"}`,
      );
    } catch {
      // Context fetch failed — still set the folder, just without listing
      setFolderContext(`Active working folder: ${folderPath}`);
    }
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

      const res  = await fetch("/api/ai/patch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // Refresh viewer if it's the open file
      if (selectedFile?.path === task.file || filePath === task.file) {
        const fr = await fetch(`/api/ai/files?path=${encodeURIComponent(task.file)}`);
        const fd = await fr.json();
        setFileContent(fd.content ?? "");
        setFilePath(task.file);
      }

      updateTask({ status: "done" });
      return true;
    } catch (err: any) {
      updateTask({ status: "error", error: err.message });
      toast.error(`Task ${task.num} failed: ${err.message}`);
      return false;
    }
  };

  const handleApplyTask = (task: Task, messageId: string) => {
    applyTask(task, messageId);
  };

  const handleApplyAll = async (tasks: Task[], messageId: string) => {
    const byFile = new Map<string, Task[]>();
    for (const t of tasks.filter(t => t.status === "pending")) {
      if (!byFile.has(t.file)) byFile.set(t.file, []);
      byFile.get(t.file)!.push(t);
    }
    for (const [, fileTasks] of byFile) {
      for (const task of fileTasks) {
        const ok = await applyTask(task, messageId);
        if (!ok) { toast.error(`Task ${task.num} failed — stopping.`); return; }
        await new Promise(r => setTimeout(r, 100));
      }
    }
    toast.success("All tasks applied.");
  };

  /* ── Send ── */
  const handleSend = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isStreaming) return;

    // ── NLP Analysis ──────────────────────────────────────────────
    const intent    = detectIntent(text);
    const entities  = extractEntities(text);
    const sentiment = analyseSentiment(text);
    const ctxNote   = buildContextGreeting(messages, intent, entities, userPrefs);

    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user", content: text,
      intent, entities, sentiment,
    };
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput(""); setIsStreaming(true);

    // Build context with NLP annotations injected as a system hint
    const ctx = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(projectTreeRef.current ? [{ role: "system", content: projectTreeRef.current }] : []),
      ...(folderContext ? [{ role: "system", content: folderContext }] : []),
      ...(fileContent ? [{ role: "system", content: `Open file (${filePath}):\n\`\`\`\n${fileContent.slice(0, 8000)}\n\`\`\`` }] : []),
      // Context-aware injection: intent + entities + prefs + conversation continuity
      {
        role: "system",
        content: [
          `User intent: ${INTENT_LABELS[intent]}.`,
          ctxNote,
          entities.errors.length > 0 ? `Errors mentioned: ${entities.errors.join(", ")}.` : "",
          entities.features.length > 0 ? `Features mentioned: ${entities.features.join(", ")}.` : "",
          sentiment === "negative" ? "The user seems frustrated — acknowledge briefly before answering." : "",
        ].filter(Boolean).join(" "),
      },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, messages: ctx }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error ?? `HTTP ${res.status}`);
      }

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
          } catch { /* skip malformed chunk */ }
        }
      }

      // Parse tasks + recs from completed response
      const { tasks, recs } = parseTasks(full);
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, tasks: tasks.length ? tasks : undefined, recs: recs.length ? recs : undefined }
        : m,
      ));

      // Auto-apply if preference is set
      if (userPrefs.autoApply && tasks.length > 0) {
        await handleApplyAll(tasks, assistantId);
      }

      const finalMsgs = [
        ...messages, userMsg,
        { id: assistantId, role: "assistant" as const, content: full, source },
      ];
      saveSession(finalMsgs);
    } catch (err: any) {
      toast.error(err.message ?? "AI error");
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const lineCount = fileContent.split("\n").length;
  const fmtBytes  = (b?: number) =>
    b ? (b < 1024 ** 3 ? `${(b / 1024 ** 2).toFixed(0)}MB` : `${(b / 1024 ** 3).toFixed(1)}GB`) : "";

  // Quick-prompt suggestions based on detected intent of last user message
  const lastUserMsg  = [...messages].reverse().find(m => m.role === "user");
  const intentSuggestions: Record<Intent, string[]> = {
    debug:       ["Show the full stack trace", "Suggest a fix", "Explain why this happens"],
    review:      ["Check for performance issues", "Suggest TypeScript improvements", "Find security issues"],
    explain:     ["Give a simpler explanation", "Show a code example", "Explain in bullet points"],
    code_change: ["Preview the diff first", "Apply to all related files", "Add unit tests for this"],
    question:    ["Show me the code", "Give me a practical example", "Link related files"],
    general:     ["Explain this file", "Find potential bugs", "How can this be improved?", "Add TypeScript types"],
  };
  const suggestions = fileContent
    ? (intentSuggestions[lastUserMsg?.intent ?? "general"] ?? intentSuggestions.general)
    : intentSuggestions.general;

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden"
          style={{ backgroundColor: C.bg, color: C.text, fontFamily: C.font }}>

          <div className="fixed inset-0 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
              backgroundSize: "24px 24px", opacity: 0.12, zIndex: 0,
            }} />

          {/* Header */}
          <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b"
            style={{ backgroundColor: C.bg, borderColor: C.border }}>
            <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
            <div className="w-px h-4" style={{ backgroundColor: C.border }} />
            <button onClick={() => router.push("/dashboard")}
              className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest"
              style={{ color: C.dim }}
              onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
              Home
            </button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block"
                    style={{ color: C.dim }}>AI Model</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator><ChevronRight size={10} style={{ color: C.muted }} /></BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold"
                    style={{ color: C.accent }}>Training Ground</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
              {/* NLP badges */}
              <span className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-[8px] border"
                style={{ borderColor: `${C.info}30`, color: C.info, backgroundColor: `${C.info}08` }}>
                <Brain className="size-2.5" /> NLP
              </span>
              <span className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-[8px] border"
                style={{ borderColor: `${C.success}30`, color: C.success, backgroundColor: `${C.success}08` }}>
                <Network className="size-2.5" /> Context
              </span>
              {aiSource && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase border"
                  style={{ borderColor: `${C.success}40`, color: C.success, backgroundColor: `${C.success}10` }}>
                  <Zap className="size-2.5" />{aiSource === "ollama" ? "Local · Ollama" : "Groq · Cloud"}
                </span>
              )}
              {ollamaOffline && !aiSource && (
                <span className="text-[9px] px-2 py-0.5 border"
                  style={{ borderColor: `${C.error}40`, color: C.error }}>
                  Ollama Offline
                </span>
              )}
              {messages.length > 0 && (
                <button onClick={() => setMessages([])}
                  className="flex items-center gap-1 h-7 px-2 text-[10px] uppercase border transition-colors"
                  style={{ borderColor: C.border, color: C.dim }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.error; e.currentTarget.style.color = C.error; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                  <Trash2 className="size-3" /> Clear
                </button>
              )}
            </div>
          </header>

          {/* 3-column body */}
          <div className="relative z-10 flex flex-1 overflow-hidden min-h-0">

            {/* ── Col 1: File tree + history + prefs ── */}
            <div className="w-52 shrink-0 flex flex-col border-r" style={{ borderColor: C.border, backgroundColor: C.panel }}>
              {/* Tab bar: Project / Open Folder */}
              <div className="flex items-stretch border-b shrink-0" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <button
                  onClick={() => { setBrowserMode("project"); setShowBrowser(false); }}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    color: browserMode === "project" ? C.accent : C.dim,
                    borderBottom: browserMode === "project" ? `2px solid ${C.accent}` : "2px solid transparent",
                    backgroundColor: "transparent",
                  }}>
                  <Code2 className="size-3" /> Project
                </button>
                <button
                  onClick={() => { setBrowserMode("external"); setShowBrowser(true); }}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    color: browserMode === "external" ? C.accent : C.dim,
                    borderBottom: browserMode === "external" ? `2px solid ${C.accent}` : "2px solid transparent",
                    backgroundColor: "transparent",
                  }}>
                  <FolderPlus className="size-3" /> Open
                </button>
              </div>

              {/* External browser panel */}
              {browserMode === "external" && showBrowser ? (
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  <ExternalBrowser
                    onOpenFile={handleOpenExternalFile}
                    onSelectFolder={handleSelectFolder}
                    onClose={() => { setBrowserMode("project"); setShowBrowser(false); }}
                  />
                </div>
              ) : (
                <>
                  {/* Active folder badge — shown when a folder is selected */}
                  {selectedFolder && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b"
                      style={{ borderColor: C.border, backgroundColor: `${C.warn}08` }}>
                      <FolderOpen className="size-3 shrink-0" style={{ color: C.warn }} />
                      <span className="text-[9px] font-mono truncate flex-1" style={{ color: C.warn }}
                        title={selectedFolder}>
                        {selectedFolder.replace(/\\/g, "/").split("/").filter(Boolean).pop()}
                      </span>
                      <button
                        onClick={() => { setSelectedFolder(null); setFolderContext(""); try { localStorage.removeItem("ai-selected-folder"); } catch { /* ignore */ } }}
                        title="Clear selected folder"
                        style={{ color: C.dim }}
                        onMouseEnter={e => (e.currentTarget.style.color = C.error)}
                        onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                        <X className="size-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto py-1">
                    {treeLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="size-3.5 animate-spin" style={{ color: C.accent }} />
                      </div>
                    ) : rootEntries.map((entry: any) => (
                      <FolderRow key={entry.path} entry={entry} depth={0}
                        onSelect={handleSelectFile} selectedPath={selectedFile?.path ?? ""}
                        onLoadDir={loadDir} dirCache={dirCache} />
                    ))}
                  </div>

                  {/* Chat history */}
                  <div className="shrink-0 border-t" style={{ borderColor: C.border }}>
                    <button onClick={() => setShowHistory(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors"
                      style={{ backgroundColor: showHistory ? "rgba(232,99,10,0.06)" : "transparent" }}
                      onMouseEnter={e => { if (!showHistory) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)"; }}
                      onMouseLeave={e => { if (!showHistory) e.currentTarget.style.backgroundColor = "transparent"; }}>
                      <div className="flex items-center gap-1.5">
                        <RefreshCw className="size-3" style={{ color: C.accent }} />
                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                          History ({sessions.length})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={e => { e.stopPropagation(); newChat(); }}
                          className="text-[8px] px-1.5 py-0.5 border transition-colors"
                          style={{ borderColor: C.border, color: C.dim }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                          + New
                        </button>
                        <ChevronDown className="size-3" style={{
                          color: C.dim,
                          transform: showHistory ? "rotate(180deg)" : "none",
                          transition: "transform 0.15s",
                        }} />
                      </div>
                    </button>
                    {showHistory && (
                      <div className="max-h-48 overflow-y-auto border-t" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                        {histLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="size-3.5 animate-spin" style={{ color: C.accent }} />
                          </div>
                        ) : sessions.length === 0 ? (
                          <p className="text-[9px] px-3 py-3 text-center" style={{ color: C.muted }}>No saved chats yet</p>
                        ) : sessions.map(s => (
                          <button key={s._id} onClick={() => loadSession(s._id?.toString())}
                            className="w-full flex items-start justify-between gap-1.5 px-3 py-2 text-left border-b transition-colors group"
                            style={{
                              borderColor: C.border,
                              backgroundColor: sessionId === s._id?.toString() ? "rgba(232,99,10,0.08)" : "transparent",
                            }}
                            onMouseEnter={e => { if (sessionId !== s._id?.toString()) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)"; }}
                            onMouseLeave={e => { if (sessionId !== s._id?.toString()) e.currentTarget.style.backgroundColor = "transparent"; }}>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold truncate"
                                style={{ color: sessionId === s._id?.toString() ? C.accent : C.text }}>
                                {s.title}
                              </p>
                              <p className="text-[8px] mt-0.5" style={{ color: C.muted }}>
                                {s.messageCount} msg · {new Date(s.updatedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                            <button onClick={e => deleteSession(s._id?.toString(), e)}
                              className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-4 w-4 transition-opacity"
                              style={{ color: C.dim }}
                              onMouseEnter={e => (e.currentTarget.style.color = C.error)}
                              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                              <X className="size-3" />
                            </button>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Preferences panel */}
                  <div className="shrink-0 border-t" style={{ borderColor: C.border }}>
                    <button onClick={() => setShowPrefs(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors"
                      style={{ backgroundColor: showPrefs ? "rgba(232,99,10,0.06)" : "transparent" }}
                      onMouseEnter={e => { if (!showPrefs) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)"; }}
                      onMouseLeave={e => { if (!showPrefs) e.currentTarget.style.backgroundColor = "transparent"; }}>
                      <div className="flex items-center gap-1.5">
                        <Settings2 className="size-3" style={{ color: C.accent }} />
                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>Prefs</span>
                      </div>
                      <ChevronDown className="size-3" style={{
                        color: C.dim,
                        transform: showPrefs ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s",
                      }} />
                    </button>
                    {showPrefs && <PrefsPanel prefs={userPrefs} onChange={handlePrefsChange} />}
                  </div>
                </>
              )}
            </div>

            {/* ── Col 2: Code viewer ── */}
            <div className="flex-1 flex flex-col border-r overflow-hidden min-w-0"
              style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
                style={{ borderColor: C.border, backgroundColor: C.panel }}>
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode className="size-3.5 shrink-0" style={{ color: C.accent }} />
                  <span className="text-[10px] font-mono truncate"
                    style={{ color: selectedFile ? C.text : C.muted }}>
                    {selectedFile ? selectedFile.path : "Select a file →"}
                  </span>
                  {selectedFile?.external && (
                    <span className="text-[8px] px-1.5 py-0.5 border shrink-0"
                      style={{ borderColor: `${C.info}40`, color: C.info, backgroundColor: `${C.info}08` }}>
                      external
                    </span>
                  )}
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-mono" style={{ color: C.muted }}>{lineCount} lines</span>
                    <button
                      onClick={() => handleSend(`Review and suggest improvements for: ${filePath}`)}
                      disabled={isStreaming}
                      className="flex items-center gap-1 h-6 px-2 text-[9px] uppercase border disabled:opacity-40"
                      style={{ borderColor: C.accent, color: C.accent }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <Bot className="size-2.5" /> Ask AI
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(fileContent); toast.success("Copied."); }}
                      className="flex items-center justify-center h-6 w-6 border transition-colors"
                      style={{ borderColor: C.border, color: C.dim }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                      <Copy className="size-3" />
                    </button>
                    <button
                      onClick={() => { setSelectedFile(null); setFileContent(""); setFilePath(""); }}
                      style={{ color: C.dim }}
                      onMouseEnter={e => (e.currentTarget.style.color = C.error)}
                      onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                      <X className="size-4" />
                    </button>
                  </div>
                )}
                {/* Terminal toggle — always visible in header */}
                <button
                  onClick={() => setShowTerminal(v => !v)}
                  className="ml-auto flex items-center gap-1 h-6 px-2 text-[9px] uppercase border transition-colors shrink-0"
                  style={{
                    borderColor: showTerminal ? C.success : C.border,
                    color:       showTerminal ? C.success : C.dim,
                    backgroundColor: showTerminal ? `${C.success}10` : "transparent",
                    marginLeft: selectedFile ? 0 : "auto",
                  }}
                  title="Toggle terminal">
                  <TerminalSquare className="size-3" />
                  Terminal
                  <ChevronUp className="size-2.5" style={{ transform: showTerminal ? "none" : "rotate(180deg)", transition: "transform 0.15s" }} />
                </button>
              </div>
              {/* Code viewer body + resizable terminal */}
              <div className="flex-1 overflow-auto min-h-0">
                {fileLoading ? (
                  <div className="flex items-center justify-center h-full gap-2">
                    <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                  </div>
                ) : fileContent ? (
                  <div className="relative h-full flex">
                    {/* Line numbers */}
                    <div className="select-none text-right pt-4 pb-4 pr-2 pl-3 shrink-0 overflow-hidden"
                      style={{ color: C.muted, fontSize: 10, fontFamily: C.font, lineHeight: "20px", minWidth: 44, backgroundColor: C.panel }}>
                      {fileContent.split("\n").map((_, i) => (
                        <div key={i} style={{ height: 20 }}>{i + 1}</div>
                      ))}
                    </div>
                    {/* Editable textarea */}
                    <textarea
                      value={fileContent}
                      onChange={e => setFileContent(e.target.value)}
                      spellCheck={false}
                      className="flex-1 p-4 pl-2 text-[11px] focus:outline-none resize-none w-full"
                      style={{
                        backgroundColor: C.bg, border: "none",
                        color: C.text, fontFamily: C.font,
                        lineHeight: "20px", whiteSpace: "pre",
                        overflowWrap: "normal", overflowX: "auto",
                      }} />
                    {/* Save button */}
                    <button
                      onClick={async () => {
                        try {
                          // External files use the browse API (absolute path); project files use write API
                          const endpoint = selectedFile?.external ? "/api/ai/browse" : "/api/ai/write";
                          const res  = await fetch(endpoint, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ path: filePath, content: fileContent }),
                          });
                          const json = await res.json();
                          if (!json.success) throw new Error(json.error);
                          toast.success("Saved.");
                        } catch (err: any) { toast.error(err.message); }
                      }}
                      className="absolute bottom-3 right-3 flex items-center gap-1.5 h-7 px-3 text-[9px] font-bold uppercase border transition-colors"
                      style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                    <FileCode className="size-10 opacity-10" style={{ color: C.accent }} />
                    <p className="text-[11px]" style={{ color: C.dim }}>Click a file to view and edit its code</p>
                  </div>
                )}
              </div>

              {/* ── Resizable Terminal ── */}
              {showTerminal && (
                <>
                  {/* Drag handle */}
                  <div
                    className="shrink-0 flex items-center justify-center border-t border-b cursor-row-resize select-none"
                    style={{ height: 6, borderColor: C.border, backgroundColor: C.panel }}
                    onMouseDown={e => {
                      termDragRef.current = { startY: e.clientY, startH: terminalHeight };
                      const onMove = (ev: MouseEvent) => {
                        if (!termDragRef.current) return;
                        const delta = termDragRef.current.startY - ev.clientY;
                        setTerminalHeight(Math.max(100, Math.min(600, termDragRef.current.startH + delta)));
                      };
                      const onUp = () => {
                        termDragRef.current = null;
                        window.removeEventListener("mousemove", onMove);
                        window.removeEventListener("mouseup", onUp);
                      };
                      window.addEventListener("mousemove", onMove);
                      window.addEventListener("mouseup", onUp);
                    }}>
                    <div className="w-8 h-0.5 rounded-full" style={{ backgroundColor: C.border }} />
                  </div>
                  <div className="shrink-0 overflow-hidden" style={{ height: terminalHeight }}>
                    <TerminalPanel
                      initialCwd={selectedFolder ?? ""}
                      onSendToAI={handleSend}
                    />
                  </div>
                </>
              )}
            </div>

            {/* ── Col 3: Chat ── */}
            <div className="w-96 shrink-0 flex flex-col overflow-hidden" style={{ backgroundColor: C.panel }}>
              {/* Chat header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
                style={{ borderColor: C.border, backgroundColor: C.bg, position: "relative", zIndex: 20 }}>
                <Bot className="size-3.5" style={{ color: C.accent }} />
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>AI Chat</span>
                <div className="ml-auto flex items-center gap-1.5">
                  {aiSource && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase border"
                      style={{ borderColor: `${C.success}40`, color: C.success, backgroundColor: `${C.success}10` }}>
                      <Zap className="size-2" />{aiSource === "ollama" ? "Ollama" : "Groq"}
                    </span>
                  )}
                  {/* Auto-apply badge */}
                  {userPrefs.autoApply && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] border"
                      style={{ borderColor: `${C.warn}40`, color: C.warn, backgroundColor: `${C.warn}08` }}>
                      <Workflow className="size-2" /> Auto
                    </span>
                  )}
                  {/* Model selector */}
                  {models.length > 0 && (
                    <div className="relative" ref={modelDropRef}>
                      <button onClick={() => setShowModels(v => !v)}
                        className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase border"
                        style={{ borderColor: showModels ? C.accent : C.border, color: showModels ? C.accent : C.dim }}>
                        <Sparkles className="size-2.5" />
                        <span className="max-w-[80px] truncate">{selectedModel.split(":")[0]}</span>
                        <ChevronDown className="size-2" />
                      </button>
                      {showModels && (
                        <div className="absolute right-0 top-full mt-1 z-[200] min-w-[180px] border shadow-xl"
                          style={{ borderColor: C.border, backgroundColor: C.panel }}>
                          {models.map(m => (
                            <button key={m.name} onClick={() => { setSelectedModel(m.name); setShowModels(false); }}
                              className="w-full flex items-center justify-between px-3 py-2 border-b last:border-b-0 transition-colors"
                              style={{
                                borderColor: C.border,
                                backgroundColor: selectedModel === m.name ? "rgba(232,99,10,0.08)" : "transparent",
                                color: selectedModel === m.name ? C.accent : C.text,
                              }}
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
                    <button onClick={() => setMessages([])} title="Clear chat"
                      className="flex items-center justify-center h-6 w-6 border transition-colors"
                      style={{ borderColor: C.border, color: C.dim }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.error; e.currentTarget.style.color = C.error; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                      <Trash2 className="size-3" />
                    </button>
                  )}
                  {fileContent && (
                    <span className="text-[8px] px-1.5 py-0.5 border"
                      style={{ borderColor: `${C.success}40`, color: C.success, backgroundColor: `${C.success}10` }}>
                      ctx
                    </span>
                  )}
                  {selectedFolder && (
                    <span className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 border max-w-[80px]"
                      style={{ borderColor: `${C.warn}40`, color: C.warn, backgroundColor: `${C.warn}08` }}
                      title={selectedFolder}>
                      <FolderOpen className="size-2.5 shrink-0" />
                      <span className="truncate">
                        {selectedFolder.replace(/\\/g, "/").split("/").filter(Boolean).pop()}
                      </span>
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
                      {fileContent ? `Open: ${selectedFile?.name}` : "Open a file and ask the AI"}
                    </p>
                    <div className="space-y-1.5 w-full">
                      {suggestions.map(p => (
                        <button key={p} onClick={() => handleSend(p)}
                          className="w-full px-2 py-1.5 text-left text-[10px] border transition-colors"
                          style={{ borderColor: C.border, color: C.dim }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                          {p}
                        </button>
                      ))}
                    </div>
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
                        style={{
                          backgroundColor: msg.role === "user" ? "rgba(232,99,10,0.08)" : C.bg,
                          borderColor: msg.role === "user" ? `${C.accent}40` : C.border,
                          color: C.text, whiteSpace: "pre-wrap",
                          wordBreak: "break-word", fontFamily: C.font,
                        }}>
                        {msg.content || (isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 bg-orange-400 animate-pulse align-middle" />
                        ))}
                      </div>

                      {/* NLP metadata badges for user messages */}
                      {msg.role === "user" && (
                        <MessageMeta intent={msg.intent} sentiment={msg.sentiment} entities={msg.entities} />
                      )}

                      {/* Copy button */}
                      {msg.content && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            setCopied(msg.id);
                            setTimeout(() => setCopied(null), 2000);
                          }}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 mt-0.5 text-[8px] transition-opacity"
                          style={{ color: C.muted }}>
                          {copied === msg.id
                            ? <><Check className="size-2.5" style={{ color: C.success }} /> Copied</>
                            : <><Copy className="size-2.5" /> Copy</>}
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
                {/* Live intent preview while typing */}
                {input.trim().length > 3 && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <SmilePlus className="size-2.5" style={{ color: C.dim }} />
                    <span className="text-[8px]" style={{ color: C.dim }}>
                      Intent:
                    </span>
                    {(() => {
                      const liveIntent = detectIntent(input);
                      return (
                        <span className="text-[8px] px-1.5 py-0 border font-bold"
                          style={{
                            borderColor: `${INTENT_COLORS[liveIntent]}40`,
                            color: INTENT_COLORS[liveIntent],
                            backgroundColor: `${INTENT_COLORS[liveIntent]}10`,
                          }}>
                          {INTENT_LABELS[liveIntent]}
                        </span>
                      );
                    })()}
                    {(() => {
                      const s = analyseSentiment(input);
                      if (s === "neutral") return null;
                      return (
                        <span className="text-[8px] px-1.5 py-0 border"
                          style={{
                            borderColor: `${sentimentColor(s)}40`,
                            color: sentimentColor(s),
                          }}>
                          {s}
                        </span>
                      );
                    })()}
                  </div>
                )}
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
                    style={{
                      backgroundColor: C.panel, border: `1px solid ${C.border}`,
                      color: C.text, fontFamily: C.font, minHeight: 36, maxHeight: 120,
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                    onInput={e => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 120) + "px";
                    }} />
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
