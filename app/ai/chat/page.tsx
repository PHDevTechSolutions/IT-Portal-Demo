"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  Download, GitCompare, Columns2,
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
const SYSTEM_PROMPT = `You are an expert Next.js and React developer. You write clean, complete, production-ready code using shadcn/ui, Tailwind CSS, and TypeScript.

=== HARD RULES — NEVER BREAK THESE ===
1. NEVER truncate code. ALWAYS write the full file from top to bottom. No "// ... rest of code" or "// add more here".
2. ALWAYS import shadcn components from "@/components/ui/..." — never from "shadcn" directly.
3. ALWAYS use Tailwind classes for spacing, color, layout. Never write inline styles unless absolutely necessary.
4. ALWAYS run "npx shadcn@latest add <component>" — never "npx shadcn-ui add".
5. ALWAYS write TypeScript. Never write plain JavaScript files (.js) unless asked.
6. NEVER skip error handling in server actions or API routes.
7. When writing a page or layout, ALWAYS include all imports at the top.
8. ALWAYS write "use client" at the top of client components.
9. NEVER use <a> tags for internal navigation — always use Next.js <Link> from "next/link".
10. ALWAYS complete every function body. Never leave TODOs or empty functions.

=== SHADCN SETUP (memorize this) ===
INSTALL shadcn in a new project:
\`\`\`bash
npx create-next-app@latest my-app --typescript --tailwind --eslint
cd my-app
npx shadcn@latest init
\`\`\`
During "npx shadcn@latest init" choose:
- Style: Default
- Base color: Slate (or as requested)
- CSS variables: Yes

ADD individual components:
\`\`\`bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add table
npx shadcn@latest add dialog
npx shadcn@latest add form
npx shadcn@latest add select
npx shadcn@latest add sidebar
npx shadcn@latest add navigation-menu
\`\`\`

CORRECT import paths (always use these):
\`\`\`typescript
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Calendar } from "@/components/ui/calendar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
\`\`\`

=== NEXT.JS ROUTING (memorize both) ===
APP ROUTER (app/) structure:
\`\`\`
app/
  layout.tsx          ← root layout, wraps everything
  page.tsx            ← home page "/"
  globals.css         ← global styles
  dashboard/
    page.tsx          ← "/dashboard"
    layout.tsx        ← dashboard-specific layout
  dashboard/users/
    page.tsx          ← "/dashboard/users"
  api/users/
    route.ts          ← API route GET/POST
\`\`\`

PAGES ROUTER (pages/) structure:
\`\`\`
pages/
  _app.tsx            ← wraps all pages
  _document.tsx       ← HTML document
  index.tsx           ← home page "/"
  dashboard.tsx       ← "/dashboard"
  dashboard/
    users.tsx         ← "/dashboard/users"
  api/
    users.ts          ← API route
\`\`\`

=== DESIGN RULES (always follow) ===
- Use shadcn's built-in variants: variant="default|destructive|outline|secondary|ghost|link"
- Dashboard layouts: use CSS grid or flexbox with a sidebar + main content pattern
- Always add hover states, focus rings, and transitions
- Use cn() from "@/lib/utils" to merge Tailwind classes conditionally
- Color tokens: use "bg-background", "text-foreground", "border", "muted", "accent", "primary"
- Spacing: always use Tailwind spacing scale (p-4, gap-6, space-y-4, etc.)
- Typography: use "text-sm", "text-muted-foreground", "font-semibold", "tracking-tight" etc.

=== HTML/CSS WEBSITES (when NOT using Next.js/React) ===
When the user asks for a plain HTML/CSS website:
- Use MODERN CSS: custom properties (--primary, --bg, etc.), flexbox/grid, smooth transitions, animations
- Use semantic HTML5: <header>, <nav>, <main>, <section>, <article>, <footer>
- Create ALL files needed: index.html, about.html, contact.html, style.css, script.js
- All HTML files MUST link to shared CSS: <link rel="stylesheet" href="style.css">
- Navigation links use relative paths: <a href="about.html">About</a>
- Add micro-interactions: hover states, focus rings, button press effects
- Include filename as first-line comment: <!-- index.html --> or /* style.css */
- Make it VISUALLY IMPRESSIVE with gradients, shadows, cards, animations — not plain/boring

=== OUTPUT FORMAT ===
For code tasks, use EXACTLY this structure — no deviations:
\`\`\`bash
npx shadcn@latest add <components>
\`\`\`
### Tasks
**Task 1: [title]**
Description: [one sentence]
\`\`\`patch
FILE: path/to/file.tsx
LINES: FULL
---
[COMPLETE FILE — never truncate, never use placeholders]
\`\`\`
### Feature Recommendations
1. name — description

=== CRITICAL RULES ===
- LINES: FULL always — never line numbers
- Write the FULL file. Never stop early. No "// ... rest of code".
- For questions only: answer normally, skip the task format.
- Include install commands before code tasks.
- "use client" at top of all client components.
- Use Next.js <Link> for navigation, never <a> for internal routes.`;

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

/* ─── 1. Token Counter ────────────────────────────────────────────── */
/** Rough GPT-style token estimator: ~4 chars per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function TokenBadge({ messages, systemPrompt, fileContent, folderContext, knowledgeCtx }: {
  messages: Message[]; systemPrompt: string; fileContent: string;
  folderContext: string; knowledgeCtx: string;
}) {
  const total = useMemo(() => {
    const parts = [
      systemPrompt,
      folderContext,
      knowledgeCtx,
      fileContent.slice(0, 8000),
      ...messages.map(m => m.content),
    ];
    return parts.reduce((s, p) => s + estimateTokens(p), 0);
  }, [messages, systemPrompt, fileContent, folderContext, knowledgeCtx]);

  const limit   = 8000; // conservative limit for local models
  const pct     = Math.min(100, Math.round((total / limit) * 100));
  const color   = pct > 90 ? C.error : pct > 70 ? C.warn : C.success;

  return (
    <span
      className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 border"
      style={{ borderColor: `${color}40`, color, backgroundColor: `${color}08` }}
      title={`~${total.toLocaleString()} tokens used (${pct}% of ~${limit.toLocaleString()} limit)`}>
      <span>{total.toLocaleString()}t</span>
      <span style={{ color: `${color}80` }}>{pct}%</span>
    </span>
  );
}

/* ─── 2. Chat Export ─────────────────────────────────────────────── */
function exportChat(messages: Message[], format: "md" | "txt") {
  if (messages.length === 0) return;

  let content = "";
  const date  = new Date().toISOString().slice(0, 10);

  if (format === "md") {
    content = `# AI Chat Export — ${date}\n\n`;
    for (const m of messages) {
      if (m.role === "system") continue;
      const role = m.role === "user" ? "**You**" : "**AI**";
      content += `### ${role}\n\n${m.content}\n\n---\n\n`;
    }
  } else {
    content = `AI Chat Export — ${date}\n${"=".repeat(40)}\n\n`;
    for (const m of messages) {
      if (m.role === "system") continue;
      const role = m.role === "user" ? "YOU" : "AI";
      content += `[${role}]\n${m.content}\n\n`;
    }
  }

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `chat-export-${date}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── 3. Diff Viewer ─────────────────────────────────────────────── */
interface DiffLine { type: "add" | "remove" | "context"; text: string; }

function computeDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split("\n");
  const afterLines  = after.split("\n");
  const result: DiffLine[] = [];

  // Simple line-by-line diff using LCS
  const m = beforeLines.length, n = afterLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = beforeLines[i] === afterLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);

  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && beforeLines[i] === afterLines[j]) {
      result.push({ type: "context", text: beforeLines[i] });
      i++; j++;
    } else if (j < n && (i >= m || dp[i + 1][j] <= dp[i][j + 1])) {
      result.push({ type: "add", text: afterLines[j] });
      j++;
    } else {
      result.push({ type: "remove", text: beforeLines[i] });
      i++;
    }
  }
  // Collapse long context runs
  const collapsed: DiffLine[] = [];
  let ctxRun = 0;
  for (const line of result) {
    if (line.type === "context") {
      ctxRun++;
      if (ctxRun <= 3) collapsed.push(line);
      else if (ctxRun === 4) collapsed.push({ type: "context", text: "..." });
    } else {
      ctxRun = 0;
      collapsed.push(line);
    }
  }
  return collapsed;
}

function DiffViewer({ before, after, onApply, onClose }: {
  before: string; after: string; onApply: () => void; onClose: () => void;
}) {
  const lines = useMemo(() => computeDiff(before, after), [before, after]);
  const adds    = lines.filter(l => l.type === "add").length;
  const removes = lines.filter(l => l.type === "remove").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="flex flex-col border shadow-2xl" style={{
        borderColor: C.border, backgroundColor: C.bg,
        width: "min(900px, 95vw)", maxHeight: "80vh", fontFamily: C.font,
      }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
          style={{ borderColor: C.border, backgroundColor: C.panel }}>
          <Code2 className="size-4" style={{ color: C.accent }} />
          <span className="text-[11px] font-bold uppercase tracking-widest flex-1" style={{ color: C.accent }}>
            Diff Preview
          </span>
          <span className="text-[9px] px-1.5 border" style={{ borderColor: `${C.success}40`, color: C.success }}>+{adds}</span>
          <span className="text-[9px] px-1.5 border" style={{ borderColor: `${C.error}40`, color: C.error }}>-{removes}</span>
          <button onClick={onClose} style={{ color: C.dim }}
            onMouseEnter={e => (e.currentTarget.style.color = C.error)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
            <X className="size-4" />
          </button>
        </div>
        {/* Diff content */}
        <div className="flex-1 overflow-auto">
          <pre className="text-[10px] leading-5 p-4" style={{ fontFamily: C.font, margin: 0 }}>
            {lines.map((line, i) => (
              <div key={i} style={{
                backgroundColor: line.type === "add" ? "#34d39918"
                  : line.type === "remove" ? "#f8717118"
                  : "transparent",
                color: line.type === "add" ? C.success
                  : line.type === "remove" ? C.error
                  : C.dim,
                paddingLeft: 8,
              }}>
                <span style={{ userSelect: "none", marginRight: 8, opacity: 0.5 }}>
                  {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                </span>
                {line.text === "..." ? (
                  <span style={{ color: C.muted, fontStyle: "italic" }}>... unchanged lines ...</span>
                ) : line.text}
              </div>
            ))}
          </pre>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t shrink-0"
          style={{ borderColor: C.border, backgroundColor: C.panel }}>
          <button onClick={onClose}
            className="h-8 px-4 text-[10px] uppercase border"
            style={{ borderColor: C.border, color: C.dim }}>
            Cancel
          </button>
          <button onClick={() => { onApply(); onClose(); }}
            className="flex items-center gap-2 h-8 px-4 text-[10px] font-bold uppercase border"
            style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
            <Play className="size-3" /> Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 4. Multi-model Comparison ──────────────────────────────────── */
// (State + logic wired in main component, UI shown in chat column)

/* ─── 5. Snippet Library ─────────────────────────────────────────── */
interface Snippet { id: string; title: string; code: string; lang: string; }

const SNIPPET_KEY = "ai-snippets";

function loadSnippets(): Snippet[] {
  try { return JSON.parse(localStorage.getItem(SNIPPET_KEY) ?? "[]"); } catch { return []; }
}
function saveSnippets(s: Snippet[]) {
  try { localStorage.setItem(SNIPPET_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function SnippetLibrary({ onInsert, onClose }: {
  onInsert: (code: string) => void; onClose: () => void;
}) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [adding,   setAdding]   = useState(false);
  const [title,    setTitle]    = useState("");
  const [code,     setCode]     = useState("");
  const [lang,     setLang]     = useState("tsx");
  const [search,   setSearch]   = useState("");

  useEffect(() => { setSnippets(loadSnippets()); }, []);

  const save = () => {
    if (!title.trim() || !code.trim()) return;
    const next = [...snippets, { id: crypto.randomUUID(), title, code, lang }];
    setSnippets(next); saveSnippets(next);
    setTitle(""); setCode(""); setAdding(false);
  };

  const del = (id: string) => {
    const next = snippets.filter(s => s.id !== id);
    setSnippets(next); saveSnippets(next);
  };

  const filtered = snippets.filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="flex flex-col border shadow-2xl"
        style={{ borderColor: C.border, backgroundColor: C.bg, width: "min(600px, 95vw)", maxHeight: "80vh", fontFamily: C.font }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
          style={{ borderColor: C.border, backgroundColor: C.panel }}>
          <Sparkles className="size-4" style={{ color: C.accent }} />
          <span className="text-[11px] font-bold uppercase tracking-widest flex-1" style={{ color: C.accent }}>
            Snippet Library
          </span>
          <button onClick={() => setAdding(v => !v)}
            className="flex items-center gap-1 h-6 px-2 text-[9px] uppercase border"
            style={{ borderColor: C.accent, color: C.accent }}>
            <Play className="size-2.5" /> {adding ? "Cancel" : "Add"}
          </button>
          <button onClick={onClose} style={{ color: C.dim }}
            onMouseEnter={e => (e.currentTarget.style.color = C.error)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
            <X className="size-4" />
          </button>
        </div>
        {/* Add form */}
        {adding && (
          <div className="shrink-0 border-b p-4 space-y-2"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex gap-2">
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Snippet title…"
                className="flex-1 px-2 py-1.5 text-[10px] focus:outline-none"
                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }} />
              <select value={lang} onChange={e => setLang(e.target.value)}
                className="px-2 py-1.5 text-[10px] focus:outline-none"
                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                {["tsx","ts","jsx","js","css","html","json","bash","py","sql"].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <textarea value={code} onChange={e => setCode(e.target.value)}
              placeholder="Paste your code here…" rows={6}
              className="w-full px-2 py-1.5 text-[10px] focus:outline-none resize-none"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }} />
            <button onClick={save}
              className="flex items-center gap-1.5 h-7 px-3 text-[9px] font-bold uppercase border"
              style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
              <CheckCircle2 className="size-3" /> Save Snippet
            </button>
          </div>
        )}
        {/* Search */}
        {snippets.length > 3 && (
          <div className="shrink-0 px-4 py-2 border-b" style={{ borderColor: C.border }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search snippets…"
              className="w-full px-2 py-1 text-[9px] focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font, height: 26 }} />
          </div>
        )}
        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Sparkles className="size-8 opacity-10" style={{ color: C.accent }} />
              <p className="text-[10px]" style={{ color: C.dim }}>No snippets yet. Add one above.</p>
            </div>
          )}
          {filtered.map(s => (
            <div key={s.id} className="border-b group" style={{ borderColor: C.border }}>
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="text-[8px] px-1 border shrink-0"
                  style={{ borderColor: `${C.info}30`, color: C.info }}>{s.lang}</span>
                <span className="flex-1 text-[10px] font-bold" style={{ color: C.text }}>{s.title}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { onInsert(s.code); onClose(); }}
                    className="flex items-center gap-1 h-5 px-2 text-[8px] uppercase border"
                    style={{ borderColor: `${C.success}50`, color: C.success }}
                    title="Insert into chat">
                    <Play className="size-2" /> Use
                  </button>
                  <button onClick={() => del(s.id)}
                    className="h-5 w-5 flex items-center justify-center"
                    style={{ color: C.dim }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.error)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
              <pre className="px-4 pb-2 text-[9px] leading-4 overflow-hidden max-h-16"
                style={{ color: C.dim, fontFamily: C.font, margin: 0, whiteSpace: "pre-wrap" }}>
                {s.code.split("\n").slice(0, 3).join("\n")}
                {s.code.split("\n").length > 3 && <span style={{ color: C.muted }}> …+{s.code.split("\n").length - 3} lines</span>}
              </pre>
            </div>
          ))}
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
  const [devUrl,        setDevUrl]        = useState<string | null>(null);
  const [customPort,    setCustomPort]    = useState("");
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

  /** Collapsible JSON value node — renders objects/arrays like DevTools */
  const JsonNode = ({ value, depth = 0 }: { value: unknown; depth?: number }) => {
    const [open, setOpen] = useState(depth < 2);
    const indent = depth * 12;

    if (value === null)      return <span style={{ color: "#94a3b8" }}>null</span>;
    if (value === undefined) return <span style={{ color: "#94a3b8" }}>undefined</span>;
    if (typeof value === "boolean") return <span style={{ color: "#c084fc" }}>{String(value)}</span>;
    if (typeof value === "number")  return <span style={{ color: "#34d399" }}>{String(value)}</span>;
    if (typeof value === "string")  return <span style={{ color: "#fbbf24" }}>"{value}"</span>;

    if (Array.isArray(value)) {
      if (value.length === 0) return <span style={{ color: C.dim }}>[]</span>;
      return (
        <span>
          <button onClick={() => setOpen(v => !v)}
            style={{ color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: C.font, fontSize: 11 }}>
            {open ? "▾" : "▸"}
          </button>
          {open ? (
            <span>
              {"[\n"}
              {value.map((item, i) => (
                <span key={i} style={{ display: "block", paddingLeft: indent + 14 }}>
                  <JsonNode value={item} depth={depth + 1} />
                  {i < value.length - 1 ? "," : ""}
                </span>
              ))}
              <span style={{ paddingLeft: indent }}>]</span>
            </span>
          ) : (
            <span style={{ color: C.dim }}> [{value.length}]</span>
          )}
        </span>
      );
    }

    if (typeof value === "object") {
      const keys = Object.keys(value as object);
      if (keys.length === 0) return <span style={{ color: C.dim }}>{"{}"}</span>;
      return (
        <span>
          <button onClick={() => setOpen(v => !v)}
            style={{ color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: C.font, fontSize: 11 }}>
            {open ? "▾" : "▸"}
          </button>
          {open ? (
            <span>
              {"{\n"}
              {keys.map((k, i) => (
                <span key={k} style={{ display: "block", paddingLeft: indent + 14 }}>
                  <span style={{ color: C.info }}>{k}</span>
                  <span style={{ color: C.dim }}>: </span>
                  <JsonNode value={(value as any)[k]} depth={depth + 1} />
                  {i < keys.length - 1 ? "," : ""}
                </span>
              ))}
              <span style={{ paddingLeft: indent }}>{"}"}</span>
            </span>
          ) : (
            <span style={{ color: C.dim }}>
              {" {"}
              {keys.slice(0, 3).map((k, i) => (
                <span key={k}>
                  <span style={{ color: C.info }}>{k}</span>
                  <span style={{ color: C.dim }}>: </span>
                  <span style={{ color: C.text }}>{String((value as any)[k])}</span>
                  {i < Math.min(3, keys.length) - 1 ? ", " : ""}
                </span>
              ))}
              {keys.length > 3 ? <span style={{ color: C.muted }}>, …+{keys.length - 3}</span> : ""}
              {"}"}
            </span>
          )}
        </span>
      );
    }

    return <span style={{ color: C.text }}>{String(value)}</span>;
  };

  /**
   * Try to extract and render JSON from a line of text.
   * Handles: pure JSON, "Label: {...}", console.log objects, etc.
   * Returns null if no JSON found.
   */
  const tryRenderJson = (text: string): React.ReactNode | null => {
    const stripped = stripAnsi(text).trim();
    if (!stripped.includes("{") && !stripped.includes("[")) return null;

    // Try to find a JSON object/array in the text
    const jsonRe = /(\{[\s\S]*\}|\[[\s\S]*\])/;
    const match = stripped.match(jsonRe);
    if (!match) return null;

    try {
      const parsed = JSON.parse(match[1]);
      // Only render as collapsible if it's an object/array with content
      if (typeof parsed !== "object" || parsed === null) return null;

      const prefix = stripped.slice(0, stripped.indexOf(match[1])).trim();
      return (
        <span>
          {prefix && <span style={{ color: C.dim }}>{prefix} </span>}
          <JsonNode value={parsed} depth={0} />
        </span>
      );
    } catch {
      return null;
    }
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

  /** Render a line: try JSON first, then ANSI-parse, then linkify */
  const renderLine = (line: TermLine) => {
    if (line.type === "stdout" || line.type === "stderr") {
      // Try collapsible JSON first
      const jsonNode = tryRenderJson(line.raw);
      if (jsonNode) return jsonNode;

      const spans = parseAnsi(line.raw);
      const fallbackColor = baseColor(line.type);
      if (spans.length === 1 && !spans[0].color && !spans[0].bg && !spans[0].bold) {
        return linkify(spans[0].text, fallbackColor);
      }
      return (
        <>
          {spans.map((sp, i) => {
            const col = sp.color ?? fallbackColor;
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

/* ─── Code Block Saver ───────────────────────────────────────────── */

interface CodeBlock { lang: string; code: string; suggestedName: string; }

/** Extract all fenced code blocks from markdown text */
function extractCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const lang = m[1].toLowerCase();
    const code = m[2];
    if (!code.trim()) continue;

    // Try to detect filename from first-line comment in code
    // e.g. <!-- index.html --> or /* style.css */ or // script.js
    let detectedName = "";
    const firstLine = code.trim().split("\n")[0];
    const commentNameRe = /(?:<!--|\/\*|\/\/)\s*([\w\-.]+\.[\w]+)\s*(?:-->|\*\/)?/;
    const commentMatch = firstLine.match(commentNameRe);
    if (commentMatch) detectedName = commentMatch[1];

    // Fall back to language-based suggestion
    let name = detectedName || (() => {
      if (lang === "html" || /<!doctype|<html/i.test(code))  return "index.html";
      if (lang === "css")                                     return "style.css";
      if (lang === "javascript" || lang === "js")             return "script.js";
      if (lang === "typescript" || lang === "ts")             return "index.ts";
      if (lang === "tsx")                                     return "component.tsx";
      if (lang === "jsx")                                     return "component.jsx";
      if (lang === "json")                                    return "data.json";
      if (lang === "python" || lang === "py")                 return "main.py";
      if (lang === "sql")                                     return "query.sql";
      if (lang === "bash" || lang === "sh")                   return "script.sh";
      if (lang === "markdown" || lang === "md")               return "README.md";
      if (lang)                                               return `file.${lang}`;
      return "file.txt";
    })();

    blocks.push({ lang, code, suggestedName: name });
  }
  return blocks;
}

function CodeBlockSaver({ content, targetFolder, onSaved }: {
  content: string; targetFolder: string | null; onSaved?: () => void;
}) {
  const blocks = extractCodeBlocks(content);
  if (blocks.length === 0 || !targetFolder) return null;

  const [savingAll, setSavingAll] = useState(false);
  const [savedAll,  setSavedAll]  = useState(false);
  const [saveAllErr, setSaveAllErr] = useState("");

  const saveAll = async () => {
    setSavingAll(true); setSaveAllErr("");
    let failed = 0;
    for (const block of blocks) {
      try {
        const filePath = `${targetFolder}\\${block.suggestedName}`;
        const res  = await fetch("/api/ai/browse", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ path: filePath, content: block.code }),
        });
        const json = await res.json();
        if (!json.success) failed++;
      } catch { failed++; }
    }
    setSavingAll(false);
    if (failed === 0) {
      setSavedAll(true);
      onSaved?.();
      setTimeout(() => setSavedAll(false), 3000);
    } else {
      setSaveAllErr(`${failed} file(s) failed to save`);
    }
  };

  const folderName = targetFolder.replace(/\\/g, "/").split("/").filter(Boolean).pop();

  return (
    <div className="mt-2 space-y-1.5">
      {/* Save All header — only show when multiple blocks */}
      {blocks.length > 1 && (
        <div className="flex items-center justify-between px-2 py-1.5 border"
          style={{ borderColor: `${C.accent}40`, backgroundColor: `${C.accent}05` }}>
          <div className="flex items-center gap-1.5">
            <FolderOpen className="size-3" style={{ color: C.warn }} />
            <span className="text-[9px] font-mono" style={{ color: C.warn }}>{folderName}/</span>
            <span className="text-[8px]" style={{ color: C.dim }}>{blocks.length} files ready</span>
          </div>
          <div className="flex items-center gap-1.5">
            {saveAllErr && <span className="text-[8px]" style={{ color: C.error }}>{saveAllErr}</span>}
            <button
              onClick={saveAll}
              disabled={savingAll || savedAll}
              className="flex items-center gap-1 h-5 px-2 text-[8px] font-bold uppercase border disabled:opacity-60"
              style={{
                borderColor: savedAll ? C.success : C.accent,
                color:       savedAll ? C.success : "#fff",
                backgroundColor: savedAll ? `${C.success}20` : C.accent,
              }}>
              {savingAll ? <><Loader2 className="size-2.5 animate-spin" /> Saving…</>
              : savedAll  ? <><CheckCircle2 className="size-2.5" /> All Saved</>
              : <><Play className="size-2.5" /> Save All ({blocks.length})</>}
            </button>
          </div>
        </div>
      )}
      {blocks.map((block, i) => (
        <SaveableBlock key={i} block={block} targetFolder={targetFolder}
          index={i} total={blocks.length} onSaved={onSaved} />
      ))}
    </div>
  );
}

function SaveableBlock({ block, targetFolder, index, total, onSaved }: {
  block: CodeBlock; targetFolder: string; index: number; total: number; onSaved?: () => void;
}) {
  const [filename,  setFilename]  = useState(block.suggestedName);
  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState("");

  const save = async () => {
    if (!filename.trim()) return;
    setSaving(true); setError("");
    try {
      const filePath = `${targetFolder}\\${filename.trim()}`;
      const res  = await fetch("/api/ai/browse", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ path: filePath, content: block.code }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Save failed");
      setSaved(true);
      onSaved?.();                          // ← refresh file tree
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const folderName = targetFolder.replace(/\\/g, "/").split("/").filter(Boolean).pop();
  const label = total > 1 ? `Block ${index + 1} · ${block.lang || "text"}` : (block.lang || "text");

  return (
    <div className="border" style={{ borderColor: C.border, backgroundColor: C.panel }}>
      {/* Header row */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b" style={{ borderColor: C.border }}>
        <FileCode className="size-3 shrink-0" style={{ color: getFileColor(filename) }} />
        <span className="text-[8px] uppercase font-bold shrink-0" style={{ color: C.dim }}>{label}</span>
        <span className="text-[8px] shrink-0" style={{ color: C.muted }}>→</span>
        <FolderOpen className="size-3 shrink-0" style={{ color: C.warn }} />
        <span className="text-[8px] font-mono shrink-0" style={{ color: C.warn }}>{folderName}/</span>

        {/* Filename — editable */}
        {editing ? (
          <input
            autoFocus
            value={filename}
            onChange={e => setFilename(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setEditing(false); } if (e.key === "Escape") setEditing(false); }}
            onBlur={() => setEditing(false)}
            className="flex-1 px-1 text-[9px] font-mono focus:outline-none"
            style={{ backgroundColor: C.bg, border: `1px solid ${C.accent}`, color: C.text, height: 18 }}
          />
        ) : (
          <button onClick={() => setEditing(true)}
            className="flex-1 text-left text-[9px] font-mono truncate transition-colors"
            style={{ color: C.text }}
            title="Click to rename"
            onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
            onMouseLeave={e => (e.currentTarget.style.color = C.text)}>
            {filename}
          </button>
        )}

        {/* Save button */}
        <button
          onClick={save}
          disabled={saving || saved}
          className="flex items-center gap-1 h-5 px-2 text-[8px] font-bold uppercase border shrink-0 transition-colors disabled:opacity-60"
          style={{
            borderColor: saved ? C.success : C.accent,
            color:       saved ? C.success : "#fff",
            backgroundColor: saved ? `${C.success}20` : C.accent,
          }}
          onMouseEnter={e => { if (!saved) (e.currentTarget as HTMLElement).style.backgroundColor = "#ff7a1a"; }}
          onMouseLeave={e => { if (!saved) (e.currentTarget as HTMLElement).style.backgroundColor = C.accent; }}>
          {saving ? <><Loader2 className="size-2.5 animate-spin" /> Saving…</>
          : saved  ? <><CheckCircle2 className="size-2.5" /> Saved</>
          : <><Play className="size-2.5" /> Save to Folder</>}
        </button>
      </div>

      {/* Code preview — first 4 lines */}
      <div className="px-2 py-1.5 overflow-hidden" style={{ maxHeight: 64 }}>
        <pre className="text-[9px] leading-4 overflow-hidden"
          style={{ color: C.dim, fontFamily: C.font, margin: 0, whiteSpace: "pre-wrap" }}>
          {block.code.split("\n").slice(0, 4).join("\n")}
          {block.code.split("\n").length > 4 && <span style={{ color: C.muted }}>{`\n… +${block.code.split("\n").length - 4} lines`}</span>}
        </pre>
      </div>

      {error && (
        <div className="px-2 py-1 border-t text-[8px]" style={{ borderColor: C.border, color: C.error }}>{error}</div>
      )}
    </div>
  );
}

/* ─── Dir Group (collapsible directory row in Read Dir checklist) ── */
function DirGroup({ dirName, files, allChecked, anyChecked, totalLines, readLines,
  doneCount, coverage, onToggleDir, onToggleFile, selectedFolder }: {
  dirName: string; files: DirFile[]; allChecked: boolean; anyChecked: boolean;
  totalLines: number; readLines: number; doneCount: number; coverage: number | null;
  onToggleDir: () => void; onToggleFile: (path: string) => void; selectedFolder: string | null;
}) {
  const [open, setOpen] = useState(true);
  const allDone   = doneCount === files.length && files.length > 0;
  const hasErrors = files.some(f => f.status === "error");

  return (
    <div className="border-b" style={{ borderColor: `${C.border}60` }}>
      {/* Directory header row */}
      <div className="flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none"
        style={{ backgroundColor: `${C.panel}` }}
        onClick={() => setOpen(v => !v)}>
        {/* Dir checkbox */}
        <input type="checkbox"
          checked={allChecked}
          ref={el => { if (el) el.indeterminate = anyChecked && !allChecked; }}
          onChange={e => { e.stopPropagation(); onToggleDir(); }}
          onClick={e => e.stopPropagation()}
          style={{ accentColor: C.accent, flexShrink: 0 }}
        />
        {/* Expand arrow */}
        <ChevronRight className="size-2.5 shrink-0 transition-transform"
          style={{ color: C.dim, transform: open ? "rotate(90deg)" : "none" }} />
        {/* Folder icon + name */}
        <Folder className="size-3 shrink-0" style={{ color: C.warn }} />
        <span className="flex-1 text-[9px] font-mono font-bold truncate" style={{ color: C.text }}>
          {dirName}
        </span>
        {/* Stats */}
        <span className="text-[8px] shrink-0" style={{ color: C.muted }}>
          {files.filter(f => f.checked).length}/{files.length}
        </span>
        {/* Coverage pill — shows after learning */}
        {coverage !== null && (
          <span className="text-[8px] px-1 border shrink-0"
            style={{
              borderColor: coverage === 100 ? `${C.success}40` : `${C.warn}40`,
              color:       coverage === 100 ? C.success : C.warn,
              backgroundColor: coverage === 100 ? `${C.success}08` : `${C.warn}08`,
            }}>
            {coverage}%
          </span>
        )}
        {/* Done indicator */}
        {allDone && !hasErrors && (
          <CheckCircle2 className="size-2.5 shrink-0" style={{ color: C.success }} />
        )}
        {hasErrors && (
          <AlertCircle className="size-2.5 shrink-0" style={{ color: C.error }} />
        )}
      </div>

      {/* File rows */}
      {open && files.map(f => {
        const isFullRead  = f.totalLines > 0 && f.readLines >= f.totalLines;
        const isSampled   = f.totalLines > 0 && f.readLines < f.totalLines;
        return (
          <label key={f.path}
            className="flex items-center gap-1.5 pl-8 pr-2 py-0.5 cursor-pointer transition-colors"
            style={{ borderTop: `1px solid ${C.border}20` }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${C.info}06`)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
            <input type="checkbox" checked={f.checked}
              onChange={() => onToggleFile(f.path)}
              style={{ accentColor: C.accent, flexShrink: 0 }} />
            {/* Status icon */}
            <span className="shrink-0 w-3 flex items-center justify-center">
              {f.status === "reading" && <Loader2 className="size-2.5 animate-spin" style={{ color: C.accent }} />}
              {f.status === "done"    && <CheckCircle2 className="size-2.5" style={{ color: C.success }} />}
              {f.status === "error"   && <AlertCircle  className="size-2.5" style={{ color: C.error   }} />}
              {f.status === "idle"    && <File className="size-2.5" style={{ color: getFileColor(f.name) }} />}
            </span>
            {/* Filename */}
            <span className="flex-1 text-[9px] font-mono truncate"
              style={{ color: f.checked ? C.text : C.muted }}>
              {f.name}
            </span>
            {/* Line count + coverage */}
            {f.totalLines > 0 ? (
              <span className="text-[8px] shrink-0 tabular-nums"
                style={{ color: isSampled ? C.warn : C.success }}
                title={isSampled
                  ? `Sampled: ${f.readLines} of ${f.totalLines} lines read`
                  : `Full: all ${f.totalLines} lines read`}>
                {f.readLines}/{f.totalLines}L
                {isSampled && " ~"}
              </span>
            ) : (
              <span className="text-[8px] shrink-0 tabular-nums" style={{ color: C.muted }}>
                {fmtFileSize(f.size)}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

function fmtFileSize(b: number) {
  if (b < 1024)        return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1024 / 1024).toFixed(1)}MB`;
}

/* ─── Knowledge Base Panel ───────────────────────────────────────── */
interface KnowledgeEntry { id: string; question: string; answer: string; tags: string[]; }

interface DirFile {
  path:       string;
  name:       string;
  dir:        string;   // parent directory (relative)
  size:       number;
  totalLines: number;   // total lines in file (0 = not yet read)
  readLines:  number;   // lines actually read (0 = not yet read)
  checked:    boolean;
  status:     "idle" | "reading" | "done" | "error";
}

function KnowledgePanel({
  onContextUpdate,
  selectedFolder,
}: {
  onContextUpdate: (ctx: string) => void;
  selectedFolder:  string | null;
}) {
  const [entries,  setEntries]  = useState<KnowledgeEntry[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [showAdd,  setShowAdd]  = useState(false);

  // ── Directory reader state ──────────────────────────────────────
  const [showDirReader, setShowDirReader] = useState(false);
  const [dirFiles,      setDirFiles]      = useState<DirFile[]>([]);
  const [dirLoading,    setDirLoading]    = useState(false);
  const [learnProgress, setLearnProgress] = useState<{ done: number; total: number; label?: string } | null>(null);
  const [learnedCtx,    setLearnedCtx]    = useState("");
  const [learnMode,     setLearnMode]     = useState<"raw" | "summary">("raw");
  const [editId,   setEditId]   = useState<string | null>(null);
  const [q,        setQ]        = useState("");
  const [a,        setA]        = useState("");
  const [tags,     setTags]     = useState("");
  const [search,   setSearch]   = useState("");
  const [saving,   setSaving]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/ai/knowledge");
      const json = await res.json();
      const list = json.entries ?? [];
      setEntries(list);
      // Build context string for AI injection
      if (list.length > 0) {
        const ctx = "=== KNOWLEDGE BASE (Q&A) ===\n" +
          list.map((e: KnowledgeEntry) => `Q: ${e.question}\nA: ${e.answer}`).join("\n\n") +
          "\n=== END KNOWLEDGE BASE ===";
        onContextUpdate(ctx);
      } else {
        onContextUpdate("");
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // ── Directory reader functions ────────────────────────────────────

  /** Walk the selected folder (or project root) and build a checklist of readable files */
  const loadDirFiles = async () => {
    setDirLoading(true); setDirFiles([]);

    // Decide which API and root to use
    const useExternal = !!selectedFolder;
    const rootPath    = selectedFolder ?? "";

    try {
      const collect = async (p: string, depth: number): Promise<DirFile[]> => {
        if (depth > 3) return [];
        const url = useExternal
          ? `/api/ai/browse?path=${encodeURIComponent(p)}`
          : p ? `/api/ai/files?path=${encodeURIComponent(p)}` : "/api/ai/files";
        const res  = await fetch(url);
        const json = await res.json();
        const entries: DirFile[] = [];
        for (const e of json.entries ?? []) {
          if (e.type === "file") {
            const ext = e.name.split(".").pop()?.toLowerCase() ?? "";
            const ok  = ["ts","tsx","js","jsx","css","html","json","md","mdx","py","txt","env","yaml","yml","sql","prisma","graphql"].includes(ext);
            if (ok) {
              // Calculate relative dir from root
              const relPath = e.path.replace(selectedFolder ?? "", "").replace(/^[/\\]/, "");
              const relDir  = relPath.includes("/") || relPath.includes("\\")
                ? relPath.replace(/[/\\][^/\\]+$/, "")
                : "(root)";
              entries.push({
                path: e.path, name: e.name, dir: relDir,
                size: e.size ?? 0, totalLines: 0, readLines: 0,
                checked: true, status: "idle",
              });
            }
          } else if (e.type === "dir" && depth < 3) {
            entries.push(...await collect(e.path, depth + 1));
          }
        }
        return entries;
      };

      const files = await collect(rootPath, 0);
      files.sort((a, b) => a.size - b.size);
      setDirFiles(files);
    } catch { /* silent */ }
    finally { setDirLoading(false); }
  };

  /** Read all checked files and inject their content into AI context */
  const learnSelected = async () => {
    const toRead = dirFiles.filter(f => f.checked);
    if (toRead.length === 0) return;
    setLearnProgress({ done: 0, total: toRead.length });

    const parts: string[] = [];
    for (let i = 0; i < toRead.length; i++) {
      const f = toRead[i];
      // Mark as reading
      setDirFiles(prev => prev.map(x => x.path === f.path ? { ...x, status: "reading" } : x));
      try {
        const useExternal = !!selectedFolder;
        const url = useExternal
          ? `/api/ai/browse?path=${encodeURIComponent(f.path)}`
          : `/api/ai/files?path=${encodeURIComponent(f.path)}`;
        const res  = await fetch(url);
        const json = await res.json();
        const content = json.content ?? "";
        if (content.trim()) {
          const allLines  = content.split("\n");
          const totalLines = allLines.length;
          const MAX_CHARS  = 6000;
          let extracted    = content;
          let readLines    = totalLines; // assume full unless sampled

          if (content.length > MAX_CHARS) {
            // Smart sampling: head + mid + tail
            const head    = content.slice(0, 2500);
            const tail    = content.slice(-1000);
            const midPos  = Math.floor(content.length / 2);
            const mid     = content.slice(midPos - 500, midPos + 1000);
            extracted     = `${head}\n\n// ... [${totalLines} lines total — sampled] ...\n\n${mid}\n\n// ... [tail] ...\n\n${tail}`;
            // Approximate lines read
            readLines = Math.round(
              (head.split("\n").length + mid.split("\n").length + tail.split("\n").length)
            );
          }

          const rel = f.path.replace(selectedFolder ?? "", "").replace(/^[/\\]/, "");
          parts.push(`// FILE: ${rel} (${totalLines} lines${readLines < totalLines ? `, ${readLines} read` : ", full"})\n${extracted}`);

          // Update file stats in checklist
          setDirFiles(prev => prev.map(x => x.path === f.path
            ? { ...x, status: "done", totalLines, readLines }
            : x,
          ));
        } else {
          setDirFiles(prev => prev.map(x => x.path === f.path ? { ...x, status: "done", totalLines: 0, readLines: 0 } : x));
        }
      } catch {
        setDirFiles(prev => prev.map(x => x.path === f.path ? { ...x, status: "error" } : x));
      }
      setLearnProgress({ done: i + 1, total: toRead.length });
      // Small yield to keep UI responsive
      await new Promise(r => setTimeout(r, 10));
    }

    const ctx = parts.length > 0
      ? `=== DIRECTORY KNOWLEDGE (${toRead.length} files read) ===\n\n${parts.join("\n\n---\n\n")}\n\n=== END DIRECTORY KNOWLEDGE ===`
      : "";
    setLearnedCtx(ctx);
    // Combine with Q&A context
    buildCombinedContext(entries, ctx);
    setLearnProgress(null);
  };

  /** Combine Q&A entries + learned file context into one context string */
  const buildCombinedContext = (qaEntries: KnowledgeEntry[], dirCtx: string) => {
    const parts: string[] = [];
    if (qaEntries.length > 0) {
      parts.push(
        "=== KNOWLEDGE BASE (Q&A) ===\n" +
        qaEntries.map(e => `Q: ${e.question}\nA: ${e.answer}`).join("\n\n") +
        "\n=== END KNOWLEDGE BASE ===",
      );
    }
    if (dirCtx) parts.push(dirCtx);
    onContextUpdate(parts.join("\n\n"));
  };

  /**
   * Summary mode: instead of injecting raw code, build a compact
   * structural map of each file (exports, functions, types, imports summary).
   * Much more context-efficient — 264 files → ~8KB instead of ~2MB.
   */
  const learnSummary = async () => {
    const toRead = dirFiles.filter(f => f.checked);
    if (toRead.length === 0) return;
    setLearnProgress({ done: 0, total: toRead.length, label: "Summarizing" });

    const summaries: string[] = [];
    for (let i = 0; i < toRead.length; i++) {
      const f = toRead[i];
      setDirFiles(prev => prev.map(x => x.path === f.path ? { ...x, status: "reading" } : x));
      try {
        const useExternal = !!selectedFolder;
        const url = useExternal
          ? `/api/ai/browse?path=${encodeURIComponent(f.path)}`
          : `/api/ai/files?path=${encodeURIComponent(f.path)}`;
        const res  = await fetch(url);
        const json = await res.json();
        const content: string = json.content ?? "";
        if (!content.trim()) { setDirFiles(prev => prev.map(x => x.path === f.path ? { ...x, status: "done" } : x)); continue; }

        const lines      = content.split("\n");
        const totalLines = lines.length;
        const rel        = f.path.replace(selectedFolder ?? "", "").replace(/^[/\\]/, "");

        // Extract structural info without sending to AI (pure regex)
        const exports   = lines.filter(l => /^export\s+(default\s+)?(function|class|const|interface|type|enum)\s+\w/.test(l.trim())).slice(0, 10).map(l => l.trim().slice(0, 80));
        const imports   = lines.filter(l => /^import\s+/.test(l.trim())).slice(0, 8).map(l => l.trim().slice(0, 80));
        const functions = lines.filter(l => /^(export\s+)?(async\s+)?function\s+\w/.test(l.trim())).slice(0, 8).map(l => l.trim().slice(0, 80));
        const hooks     = lines.filter(l => /const\s+\[.*\]\s*=\s*useState|useEffect|useCallback|useMemo|useRef/.test(l)).slice(0, 6).map(l => l.trim().slice(0, 80));

        const summary = [
          `FILE: ${rel} (${totalLines} lines)`,
          imports.length   ? `IMPORTS: ${imports.slice(0,3).join(" | ")}` : "",
          exports.length   ? `EXPORTS:\n  ${exports.join("\n  ")}` : "",
          functions.length ? `FUNCTIONS:\n  ${functions.join("\n  ")}` : "",
          hooks.length     ? `HOOKS: ${hooks.join(" | ")}` : "",
        ].filter(Boolean).join("\n");

        summaries.push(summary);
        setDirFiles(prev => prev.map(x => x.path === f.path ? { ...x, status: "done", totalLines, readLines: totalLines } : x));
      } catch {
        setDirFiles(prev => prev.map(x => x.path === f.path ? { ...x, status: "error" } : x));
      }
      setLearnProgress({ done: i + 1, total: toRead.length, label: "Summarizing" });
      await new Promise(r => setTimeout(r, 5));
    }

    const ctx = summaries.length > 0
      ? `=== PROJECT STRUCTURE SUMMARY (${toRead.length} files) ===\n\n${summaries.join("\n\n")}\n\n=== END SUMMARY ===`
      : "";
    setLearnedCtx(ctx);
    buildCombinedContext(entries, ctx);
    setLearnProgress(null);
  };

  const fmtSize = (b: number) => b < 1024 ? `${b}B` : b < 1024*1024 ? `${(b/1024).toFixed(0)}KB` : `${(b/1024/1024).toFixed(1)}MB`;
  const checkedCount = dirFiles.filter(f => f.checked).length;
  const totalSize    = dirFiles.filter(f => f.checked).reduce((s, f) => s + f.size, 0);

  const resetForm = () => { setQ(""); setA(""); setTags(""); setEditId(null); setShowAdd(false); };

  const handleSave = async () => {
    if (!q.trim() || !a.trim()) return;
    setSaving(true);
    try {
      const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
      if (editId) {
        await fetch("/api/ai/knowledge", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, question: q, answer: a, tags: tagList }),
        });
      } else {
        await fetch("/api/ai/knowledge", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, answer: a, tags: tagList }),
        });
      }
      resetForm();
      await load();
    } finally { setSaving(false); }
  };

  const handleEdit = (e: KnowledgeEntry) => {
    setEditId(e.id); setQ(e.question); setA(e.answer);
    setTags(e.tags.join(", ")); setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/ai/knowledge", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  };

  const filtered = entries.filter(e =>
    !search || e.question.toLowerCase().includes(search.toLowerCase()) ||
    e.answer.toLowerCase().includes(search.toLowerCase()) ||
    e.tags.some(t => t.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: C.font, backgroundColor: C.bg }}>
      {/* ── Header — two rows to avoid cramping ── */}
      <div className="shrink-0 border-b" style={{ borderColor: C.border, backgroundColor: C.panel }}>
        {/* Row 1: title + count */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <Brain className="size-3.5 shrink-0" style={{ color: C.accent }} />
          <span className="text-[9px] font-bold uppercase tracking-widest flex-1" style={{ color: C.accent }}>
            Knowledge Base
          </span>
          {entries.length > 0 && (
            <span className="text-[8px] px-1.5 border"
              style={{ borderColor: `${C.accent}30`, color: C.accent }}>
              {entries.length} Q&A
            </span>
          )}
          {learnedCtx && (
            <span className="text-[8px] px-1.5 border"
              style={{ borderColor: `${C.success}30`, color: C.success }}>
              ✓ learned
            </span>
          )}
        </div>
        {/* Row 2: action buttons */}
        <div className="flex items-center gap-1.5 px-3 pb-2">
          <button
            onClick={async () => {
              setShowDirReader(v => !v);
              setShowAdd(false);
              if (!showDirReader && dirFiles.length === 0) await loadDirFiles();
            }}
            className="flex items-center gap-1 h-6 px-2 text-[8px] uppercase border flex-1 justify-center transition-colors"
            style={{
              borderColor: showDirReader ? C.info : C.border,
              color:       showDirReader ? C.info : C.dim,
              backgroundColor: showDirReader ? `${C.info}10` : "transparent",
            }}>
            <Network className="size-2.5" />
            {showDirReader ? "Hide Dir" : "Read Dir"}
          </button>
          <button
            onClick={() => { setShowAdd(v => !v); resetForm(); setShowDirReader(false); }}
            className="flex items-center gap-1 h-6 px-2 text-[8px] uppercase border flex-1 justify-center transition-colors"
            style={{
              borderColor: showAdd ? C.accent : C.border,
              color:       showAdd ? C.accent : C.dim,
              backgroundColor: showAdd ? `${C.accent}10` : "transparent",
            }}>
            {showAdd ? <><X className="size-2.5" /> Cancel</> : <><Play className="size-2.5" /> + Add Q&A</>}
          </button>
        </div>
      </div>

      {/* ── Directory Reader Panel ── */}
      {showDirReader && (
        <div className="shrink-0 border-b flex flex-col" style={{ borderColor: C.border, maxHeight: 320 }}>
          {/* Dir reader header */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0"
            style={{ borderColor: C.border, backgroundColor: `${C.info}08` }}>
            <Network className="size-3 shrink-0" style={{ color: C.info }} />
            <span className="text-[9px] font-mono truncate flex-1" style={{ color: C.info }}>
              {selectedFolder
                ? selectedFolder.replace(/\\/g, "/").split("/").filter(Boolean).pop()
                : "project root"}
            </span>
            {dirLoading
              ? <span className="text-[8px]" style={{ color: C.dim }}><Loader2 className="size-2.5 animate-spin inline mr-1" />scanning…</span>
              : <span className="text-[8px]" style={{ color: C.muted }}>{dirFiles.length} files</span>
            }
            {/* Select all / none */}
            {dirFiles.length > 0 && (
              <button
                onClick={() => setDirFiles(prev => prev.map(f => ({ ...f, checked: !prev.every(x => x.checked) })))}
                className="text-[8px] px-1.5 border transition-colors"
                style={{ borderColor: C.border, color: C.dim, height: 18 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.info; e.currentTarget.style.color = C.info; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                {dirFiles.every(f => f.checked) ? "None" : "All"}
              </button>
            )}
            <button
              onClick={() => loadDirFiles()}
              className="flex items-center justify-center h-4 w-4 transition-colors"
              style={{ color: C.dim }}
              title="Refresh file list"
              onMouseEnter={e => (e.currentTarget.style.color = C.info)}
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
              <RefreshCw className="size-3" />
            </button>
          </div>

          {/* File checklist — grouped by directory, collapsible */}
          <div className="flex-1 overflow-y-auto" style={{ minHeight: 60 }}>
            {dirLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
              </div>
            )}
            {!dirLoading && dirFiles.length === 0 && (
              <p className="text-[9px] px-3 py-3 text-center" style={{ color: C.muted }}>No readable files found</p>
            )}
            {!dirLoading && (() => {
              // Group files by directory
              const groups = new Map<string, DirFile[]>();
              for (const f of dirFiles) {
                const g = groups.get(f.dir) ?? [];
                g.push(f);
                groups.set(f.dir, g);
              }

              return Array.from(groups.entries()).map(([dirName, files]) => {
                const allChecked  = files.every(f => f.checked);
                const anyChecked  = files.some(f => f.checked);
                const totalLines  = files.reduce((s, f) => s + f.totalLines, 0);
                const readLines   = files.reduce((s, f) => s + f.readLines, 0);
                const doneCount   = files.filter(f => f.status === "done").length;
                const coverage    = totalLines > 0 ? Math.round((readLines / totalLines) * 100) : null;

                return (
                  <DirGroup key={dirName} dirName={dirName} files={files}
                    allChecked={allChecked} anyChecked={anyChecked}
                    totalLines={totalLines} readLines={readLines}
                    doneCount={doneCount} coverage={coverage}
                    onToggleDir={() =>
                      setDirFiles(prev => prev.map(f =>
                        f.dir === dirName ? { ...f, checked: !allChecked } : f,
                      ))
                    }
                    onToggleFile={(path) =>
                      setDirFiles(prev => prev.map(f =>
                        f.path === path ? { ...f, checked: !f.checked } : f,
                      ))
                    }
                    selectedFolder={selectedFolder}
                  />
                );
              });
            })()}
          </div>

          {/* Learn footer */}
          {dirFiles.length > 0 && (
            <div className="shrink-0 border-t px-3 py-2 space-y-1.5"
              style={{ borderColor: C.border, backgroundColor: C.panel }}>
              {learnProgress ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: C.muted }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${(learnProgress.done / learnProgress.total) * 100}%`, backgroundColor: C.info }} />
                  </div>
                  <span className="text-[8px] shrink-0" style={{ color: C.dim }}>
                    {learnProgress.label ?? "Reading"} {learnProgress.done}/{learnProgress.total}
                  </span>
                </div>
              ) : (
                <>
                  {/* Mode toggle */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[8px]" style={{ color: C.muted }}>Mode:</span>
                    <button
                      onClick={() => setLearnMode("summary")}
                      className="text-[8px] px-1.5 border transition-colors"
                      style={{
                        borderColor: learnMode === "summary" ? C.success : C.border,
                        color:       learnMode === "summary" ? C.success : C.dim,
                        backgroundColor: learnMode === "summary" ? `${C.success}10` : "transparent",
                        height: 18,
                      }}
                      title="Extract exports, functions, types — compact. Works for 264 files.">
                      Summary
                    </button>
                    <button
                      onClick={() => setLearnMode("raw")}
                      className="text-[8px] px-1.5 border transition-colors"
                      style={{
                        borderColor: learnMode === "raw" ? C.warn : C.border,
                        color:       learnMode === "raw" ? C.warn : C.dim,
                        backgroundColor: learnMode === "raw" ? `${C.warn}10` : "transparent",
                        height: 18,
                      }}
                      title="Inject actual code — good for ≤20 files. Large selections will overflow context.">
                      Raw
                    </button>
                  </div>
                  {/* Warning on its own row */}
                  {learnMode === "raw" && checkedCount > 20 && (
                    <p className="text-[8px]" style={{ color: C.error }}>
                      ⚠ {checkedCount} files may overflow context window. Use Summary instead.
                    </p>
                  )}

                  {/* Mode description */}
                  <p className="text-[8px]" style={{ color: C.muted }}>
                    {learnMode === "summary"
                      ? `Summary: exports + functions per file → ~${Math.round(checkedCount * 0.2)}KB context`
                      : `Raw: actual code (sampled for large files) → ~${Math.round(totalSize / 1024)}KB context`}
                    {learnedCtx && <span style={{ color: C.success }}> · learned ✓</span>}
                  </p>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => learnMode === "summary" ? learnSummary() : learnSelected()}
                      disabled={checkedCount === 0}
                      className="flex items-center gap-1 h-6 px-2 text-[8px] font-bold uppercase border disabled:opacity-40 transition-colors flex-1 justify-center"
                      style={{ borderColor: C.info, color: "#fff", backgroundColor: C.info }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                      <Brain className="size-2.5" />
                      {learnMode === "summary" ? `Summarize (${checkedCount})` : `Learn Raw (${checkedCount})`}
                    </button>
                    {learnedCtx && (
                      <button
                        onClick={() => { setLearnedCtx(""); buildCombinedContext(entries, ""); }}
                        className="h-6 px-1.5 text-[8px] border"
                        style={{ borderColor: `${C.error}40`, color: C.error }}
                        title="Clear learned context">
                        <X className="size-2.5" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Q&A form ── */}
      {showAdd && (
        <div className="shrink-0 border-b px-3 py-2.5 space-y-2"
          style={{ borderColor: C.border, backgroundColor: C.panel }}>
          <p className="text-[9px] font-bold uppercase" style={{ color: C.accent }}>
            {editId ? "Edit Entry" : "New Q&A Entry"}
          </p>
          <div className="space-y-1.5">
            <label className="text-[8px] uppercase" style={{ color: C.dim }}>Question / Trigger</label>
            <textarea
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="e.g. How do I add authentication?"
              rows={2}
              className="w-full px-2 py-1.5 text-[10px] focus:outline-none resize-none"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
              onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={e => (e.currentTarget.style.borderColor = C.border)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[8px] uppercase" style={{ color: C.dim }}>Answer / Knowledge</label>
            <textarea
              value={a} onChange={e => setA(e.target.value)}
              placeholder="e.g. This project uses NextAuth.js with Supabase adapter..."
              rows={4}
              className="w-full px-2 py-1.5 text-[10px] focus:outline-none resize-none"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
              onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={e => (e.currentTarget.style.borderColor = C.border)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[8px] uppercase" style={{ color: C.dim }}>Tags (comma-separated)</label>
            <input
              value={tags} onChange={e => setTags(e.target.value)}
              placeholder="auth, nextjs, supabase"
              className="w-full px-2 py-1.5 text-[10px] focus:outline-none"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font, height: 28 }}
              onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={e => (e.currentTarget.style.borderColor = C.border)}
            />
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleSave} disabled={saving || !q.trim() || !a.trim()}
              className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase border disabled:opacity-50"
              style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}>
              {saving ? <Loader2 className="size-2.5 animate-spin" /> : <CheckCircle2 className="size-2.5" />}
              {editId ? "Update" : "Save"}
            </button>
            <button onClick={resetForm}
              className="h-6 px-2 text-[9px] uppercase border"
              style={{ borderColor: C.border, color: C.dim }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      {entries.length > 3 && (
        <div className="shrink-0 px-3 py-1.5 border-b" style={{ borderColor: C.border }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search knowledge…"
            className="w-full px-2 py-1 text-[9px] focus:outline-none"
            style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font, height: 24 }}
          />
        </div>
      )}

      {/* ── Q&A Entries list ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
          </div>
        )}
        {!loading && filtered.length === 0 && !showDirReader && (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-3">
            <Brain className="size-8 opacity-10" style={{ color: C.accent }} />
            <p className="text-[10px]" style={{ color: C.dim }}>
              {entries.length === 0
                ? "Add Q&A pairs to teach the AI about your project.\nOr use 'Read Dir' to learn from files."
                : "No results for your search."}
            </p>
          </div>
        )}
        {!loading && filtered.map(entry => (
          <div key={entry.id} className="border-b px-3 py-2.5 group"
            style={{ borderColor: C.border }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold flex-1" style={{ color: C.text }}>{entry.question}</p>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => handleEdit(entry)}
                  className="h-4 w-4 flex items-center justify-center"
                  style={{ color: C.dim }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                  <Lightbulb className="size-3" />
                </button>
                <button onClick={() => handleDelete(entry.id)}
                  className="h-4 w-4 flex items-center justify-center"
                  style={{ color: C.dim }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.error)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
            <p className="text-[9px] mt-1 line-clamp-2" style={{ color: C.dim }}>{entry.answer}</p>
            {entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {entry.tags.map(tag => (
                  <span key={tag} className="text-[8px] px-1 border"
                    style={{ borderColor: `${C.info}30`, color: C.info, backgroundColor: `${C.info}08` }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Runnable Bash Block ─────────────────────────────────────────── */
/**
 * Detects ```bash / ```sh code blocks in AI responses and renders them
 * with a "Run in Terminal" button that sends the command to the terminal.
 */
function RunnableBashBlock({ code, onRun }: { code: string; onRun: (cmd: string) => void }) {
  const [ran,    setRan]    = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = code.trim().split("\n").filter(l => l.trim());

  return (
    <div className="my-2 border overflow-hidden" style={{ borderColor: `${C.success}30`, backgroundColor: `${C.success}05` }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1 border-b"
        style={{ borderColor: `${C.success}20`, backgroundColor: `${C.success}08` }}>
        <TerminalSquare className="size-3 shrink-0" style={{ color: C.success }} />
        <span className="text-[8px] uppercase font-bold flex-1" style={{ color: C.success }}>bash</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1 text-[8px] transition-colors"
          style={{ color: C.dim }}
          onMouseEnter={e => (e.currentTarget.style.color = C.text)}
          onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
          {copied ? <><Check className="size-2.5" style={{ color: C.success }} /> Copied</> : <><Copy className="size-2.5" /> Copy</>}
        </button>
        {lines.length === 1 ? (
          // Single command — one Run button
          <button
            onClick={() => { onRun(lines[0]); setRan(true); setTimeout(() => setRan(false), 2000); }}
            className="flex items-center gap-1 h-5 px-2 text-[8px] font-bold uppercase border transition-colors"
            style={{
              borderColor: ran ? `${C.success}60` : C.accent,
              color:       ran ? C.success : "#fff",
              backgroundColor: ran ? `${C.success}10` : C.accent,
            }}>
            {ran ? <><Check className="size-2.5" /> Ran</> : <><Play className="size-2.5" /> Run</>}
          </button>
        ) : (
          // Multiple commands — run all sequentially
          <button
            onClick={() => {
              // Join with && for sequential execution
              onRun(lines.join(" && "));
              setRan(true);
              setTimeout(() => setRan(false), 2000);
            }}
            className="flex items-center gap-1 h-5 px-2 text-[8px] font-bold uppercase border transition-colors"
            style={{
              borderColor: ran ? `${C.success}60` : C.accent,
              color:       ran ? C.success : "#fff",
              backgroundColor: ran ? `${C.success}10` : C.accent,
            }}>
            {ran ? <><Check className="size-2.5" /> Ran</> : <><Play className="size-2.5" /> Run All</>}
          </button>
        )}
      </div>
      {/* Code */}
      <pre className="px-3 py-2 text-[10px] leading-5 overflow-x-auto"
        style={{ color: C.success, fontFamily: C.font, margin: 0, whiteSpace: "pre-wrap" }}>
        {code.trim()}
      </pre>
    </div>
  );
}

/**
 * Splits content into text + bash block segments and renders them.
 * Bash blocks get Run buttons; other code blocks stay plain.
 */
function ContentRenderer({ content, onRunCommand }: { content: string; onRunCommand: (cmd: string) => void }) {
  // Split on ```bash or ```sh blocks
  const parts = content.split(/(```(?:bash|sh)\n[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        const bashMatch = part.match(/^```(?:bash|sh)\n([\s\S]*?)```$/);
        if (bashMatch) {
          return <RunnableBashBlock key={i} code={bashMatch[1]} onRun={onRunCommand} />;
        }
        // Regular text — pass through ThinkRenderer for <think> handling
        return part ? <ThinkRenderer key={i} content={part} /> : null;
      })}
    </>
  );
}

/* ─── Think Renderer ────────────────────────────────────────────── */
/**
 * Renders AI responses that contain <think>...</think> blocks.
 * The thinking section is shown as a collapsible "Reasoning" panel,
 * keeping the final answer clean and readable.
 */
function ThinkRenderer({ content }: { content: string }) {
  const [thinkOpen, setThinkOpen] = useState(false);

  // Check if content has <think> blocks
  const hasThink = /<think>/i.test(content);
  if (!hasThink) return <>{content}</>;

  // Split into think blocks and answer
  const thinkRe = /<think>([\s\S]*?)<\/think>/gi;
  const thinks:  string[] = [];
  let   answer = content;

  let m: RegExpExecArray | null;
  while ((m = thinkRe.exec(content)) !== null) {
    thinks.push(m[1].trim());
  }
  // Remove think blocks from the displayed answer
  answer = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  return (
    <>
      {/* Collapsible reasoning section */}
      {thinks.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setThinkOpen(v => !v)}
            className="flex items-center gap-1.5 text-[9px] uppercase font-bold border px-2 py-1 transition-colors w-full"
            style={{
              borderColor: `${C.info}40`,
              color:       thinkOpen ? C.info : C.dim,
              backgroundColor: thinkOpen ? `${C.info}08` : "transparent",
            }}>
            <Brain className="size-3 shrink-0" style={{ color: C.info }} />
            <span className="flex-1 text-left">
              {thinkOpen ? "Hide reasoning" : "Show reasoning"}
              <span className="ml-1 font-normal" style={{ color: C.muted }}>
                ({thinks.reduce((s, t) => s + t.split(/\s+/).length, 0)} words)
              </span>
            </span>
            <ChevronDown className="size-3 shrink-0 transition-transform"
              style={{ transform: thinkOpen ? "rotate(180deg)" : "none" }} />
          </button>
          {thinkOpen && (
            <div className="border border-t-0 px-3 py-2"
              style={{ borderColor: `${C.info}30`, backgroundColor: `${C.info}04` }}>
              {thinks.map((t, i) => (
                <pre key={i} className="text-[10px] leading-relaxed whitespace-pre-wrap break-words"
                  style={{ color: `${C.text}80`, fontFamily: C.font, margin: 0 }}>
                  {t}
                </pre>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Final answer */}
      {answer && <span style={{ whiteSpace: "pre-wrap" }}>{answer}</span>}
    </>
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
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderContext,  setFolderContext]  = useState<string>("");

  // RAG index state (used by KB directory reader only, not injected into messages)
  const [ragIndexed,   setRagIndexed]   = useState(false);
  const [ragIndexing,  setRagIndexing]  = useState(false);
  const [ragStats,     setRagStats]     = useState<{ totalFiles: number; totalChunks: number } | null>(null);

  // Knowledge base context (injected into every AI message)
  const [knowledgeCtx,  setKnowledgeCtx]  = useState("");
  const [showKnowledge, setShowKnowledge] = useState(false);

  // Feature 3: Diff viewer
  const [diffTask,     setDiffTask]     = useState<{ task: Task; msgId: string; before: string } | null>(null);

  // Feature 4: Multi-model comparison
  const [compareMode,   setCompareMode]   = useState(false);
  const [compareModel,  setCompareModel]  = useState("");
  const [compareResult, setCompareResult] = useState<{ modelA: string; modelB: string; contentA: string; contentB: string } | null>(null);
  const [isComparing,   setIsComparing]   = useState(false);

  // Feature 5: Snippet library
  const [showSnippets, setShowSnippets] = useState(false);

  // Thinking mode
  type ThinkMode = "normal" | "think" | "deep_think" | "research" | "deep_research";
  const [thinkMode,     setThinkMode]     = useState<ThinkMode>("normal");
  const [searchStatus,  setSearchStatus]  = useState("");

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
    // Also restore RAG index (fire and forget)
    indexFolderForRag(saved); // intentionally not awaited
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // Terminal — default false/220, restored from localStorage in the client-only useEffect below
  const [showTerminal,   setShowTerminal]   = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(220);
  const termDragRef    = useRef<{ startY: number; startH: number } | null>(null);
  const terminalRunRef = useRef<((cmd: string) => void) | null>(null);

  // Multi-terminal tabs
  interface TermTab { id: string; label: string; cwd: string; }
  const [termTabs,      setTermTabs]      = useState<TermTab[]>([{ id: "t1", label: "Terminal 1", cwd: "" }]);
  const [activeTermTab, setActiveTermTab] = useState("t1");

  // Multi-chat tabs
  interface ChatTab { id: string; label: string; messages: Message[]; sessionId: string | null; }
  const [chatTabs,      setChatTabs]      = useState<ChatTab[]>([{ id: "c1", label: "Chat 1", messages: [], sessionId: null }]);
  const [activeChatTab, setActiveChatTab] = useState("c1");

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

  // ── Single client-only restore for all localStorage values ──────
  useEffect(() => {
    try {
      const folder = localStorage.getItem("ai-selected-folder");
      if (folder) setSelectedFolder(folder);
      setShowTerminal(localStorage.getItem("ai-terminal-open") === "1");
      const h = parseInt(localStorage.getItem("ai-terminal-height") ?? "0", 10);
      if (h > 0) setTerminalHeight(h);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const [rootEntries,         setRootEntries]         = useState<any[]>([]);
  const [externalEntries,     setExternalEntries]     = useState<any[]>([]);
  const [externalDirCache,    setExternalDirCache]    = useState<Record<string, any[]>>({});
  const [externalTreeLoading, setExternalTreeLoading] = useState(false);
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

  // Sync active messages back to the chat tab whenever they change
  useEffect(() => {
    setChatTabs(prev => prev.map(t =>
      t.id === activeChatTab ? { ...t, messages, sessionId } : t,
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, sessionId]);

  const loadDir = useCallback(async (p: string): Promise<any[]> => {
    if (dirCache[p]) return dirCache[p];
    const res  = await fetch(`/api/ai/files?path=${encodeURIComponent(p)}`);
    const d    = await res.json();
    const kids = d.entries ?? [];
    setDirCache(prev => ({ ...prev, [p]: kids }));
    return kids;
  }, [dirCache]);

  /** Load a directory via the external browse API (absolute paths) */
  const loadExternalDir = useCallback(async (p: string): Promise<any[]> => {
    if (externalDirCache[p]) return externalDirCache[p];
    const res  = await fetch(`/api/ai/browse?path=${encodeURIComponent(p)}`);
    const d    = await res.json();
    const kids = d.entries ?? [];
    setExternalDirCache(prev => ({ ...prev, [p]: kids }));
    return kids;
  }, [externalDirCache]);

  /** When selectedFolder changes, reload the external file tree */
  useEffect(() => {
    if (!selectedFolder) { setExternalEntries([]); return; }
    setExternalTreeLoading(true);
    fetch(`/api/ai/browse?path=${encodeURIComponent(selectedFolder)}`)
      .then(r => r.json())
      .then(d => setExternalEntries(d.entries ?? []))
      .catch(() => setExternalEntries([]))
      .finally(() => setExternalTreeLoading(false));
    // Clear dir cache so subdirs reload fresh
    setExternalDirCache({});
  }, [selectedFolder]);

  /** Re-fetch the root of the external folder — called after saving files */
  const refreshExternalTree = useCallback(() => {
    if (!selectedFolder) return;
    fetch(`/api/ai/browse?path=${encodeURIComponent(selectedFolder)}`)
      .then(r => r.json())
      .then(d => setExternalEntries(d.entries ?? []))
      .catch(() => {});
    // Also bust the dir cache so any open subdirs reload on next expand
    setExternalDirCache({});
  }, [selectedFolder]);

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

    // Auto-index the folder for RAG after selecting it (fire and forget)
    indexFolderForRag(folderPath); // intentionally not awaited
  };

  /** Index a folder into the RAG engine */
  const indexFolderForRag = async (folderPath: string) => {
    setRagIndexing(true); setRagIndexed(false);
    try {
      const res  = await fetch("/api/ai/rag", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "index", path: folderPath }),
      });
      const json = await res.json();
      if (json.success) {
        setRagIndexed(true);
        setRagStats({ totalFiles: json.files, totalChunks: json.chunks });
        toast.success(`RAG: indexed ${json.files} files (${json.chunks} chunks)`);
      }
    } catch { /* silent */ }
    finally { setRagIndexing(false); }
  };

  /** Search the RAG index — hard 1.5s timeout so it never blocks the AI response */
  const ragSearch = async (query: string): Promise<string> => {
    if (!ragIndexed) return "";
    try {
      const ac  = new AbortController();
      const tid = setTimeout(() => ac.abort(), 1500); // 1.5s max
      const res = await fetch("/api/ai/rag", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "search", query, k: 4 }),
        signal:  ac.signal,
      });
      clearTimeout(tid);
      const json = await res.json();
      if (!json.results?.length) return "";

      const snippets = json.results
        .map((r: any) =>
          `// ${r.filePath} (lines ${r.lines[0]}–${r.lines[1]})\n${r.content}`,
        )
        .join("\n\n---\n\n");

      return `=== RELEVANT CODE (RAG) ===\n${snippets}\n=== END ===`;
    } catch { return ""; } // timeout or error → continue without RAG
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

  /** Feature 3: Show diff before applying — reads current file first */
  const handleDiffApply = async (task: Task, messageId: string) => {
    if (task.lines !== "FULL") {
      // For non-FULL patches, apply directly
      applyTask(task, messageId);
      return;
    }
    // Read current file content
    const isExternal = task.file.startsWith("C:") || task.file.startsWith("/");
    const url = isExternal
      ? `/api/ai/browse?path=${encodeURIComponent(task.file)}`
      : `/api/ai/files?path=${encodeURIComponent(task.file)}`;
    try {
      const res  = await fetch(url);
      const json = await res.json();
      const before = json.content ?? "";
      setDiffTask({ task, msgId: messageId, before });
    } catch {
      // Fallback: apply directly if read fails
      applyTask(task, messageId);
    }
  };

  /** Feature 4: Send same prompt to a second model for comparison */
  const handleCompare = async (userText: string, modelA: string, modelB: string) => {
    if (!userText.trim() || !modelA || !modelB) return;
    setIsComparing(true);
    setCompareResult(null);

    const ctx = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(fileContent ? [{ role: "system", content: `Open file (${filePath}):\n\`\`\`\n${fileContent.slice(0, 4000)}\n\`\`\`` }] : []),
      { role: "user", content: userText },
    ];

    try {
      const [resA, resB] = await Promise.all([
        fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: modelA, messages: ctx }) }),
        fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: modelB, messages: ctx }) }),
      ]);

      const readStream = async (res: Response): Promise<string> => {
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "", full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
          for (const part of parts) {
            if (!part.startsWith("data: ")) continue;
            try { const d = JSON.parse(part.slice(6)); if (d.token) full += d.token; } catch { /* skip */ }
          }
        }
        return full;
      };

      const [contentA, contentB] = await Promise.all([readStream(resA), readStream(resB)]);
      setCompareResult({ modelA, modelB, contentA, contentB });
    } catch (e: any) {
      toast.error(`Compare failed: ${e.message}`);
    } finally {
      setIsComparing(false);
    }
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
  const handleSend = async (override?: string) => {    const text = (override ?? input).trim();
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

    // Web search for research modes
    let webContext = "";
    if (thinkMode === "research" || thinkMode === "deep_research") {
      setSearchStatus(`🔍 Searching: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`);
      try {
        const searchRes = await fetch("/api/ai/search", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ query: text, mode: thinkMode, maxPages: thinkMode === "deep_research" ? 5 : 2 }),
          signal:  AbortSignal.timeout(30000),
        });
        const searchJson = await searchRes.json();
        if (searchJson.results?.length > 0) {
          const parts = searchJson.results.map((r: any, i: number) =>
            `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}${r.content ? `\n\n${r.content.slice(0, 1500)}` : ""}`,
          );
          webContext = `=== WEB SEARCH RESULTS for "${text}" ===\n\n${parts.join("\n\n---\n\n")}\n\n=== END WEB RESULTS ===`;
          setSearchStatus(`✓ Found ${searchJson.results.length} pages`);
        } else {
          setSearchStatus("⚠ No results found");
        }
      } catch (e: any) {
        setSearchStatus(`⚠ Search failed: ${e.message}`);
      }
    }

    // Thinking mode system instructions
    const thinkInstructions: Record<string, string> = {
      normal:        "",
      think:         "Before answering, reason through this step by step inside <think>...</think> tags, then give your final answer.",
      deep_think:    "This requires deep analysis. Inside <think>...</think> tags: (1) break down the problem, (2) consider multiple approaches, (3) identify edge cases, (4) choose the best approach with justification. Then provide a comprehensive answer.",
      research:      "You have been provided web search results above. Use them to give an accurate, up-to-date answer. Cite sources with [1], [2], etc.",
      deep_research: "You have been provided comprehensive web research. Synthesize information from multiple sources, compare findings, identify consensus and contradictions, and provide a thorough research-backed answer with citations [1], [2], etc.",
    };

    // Build context with NLP annotations injected as a system hint
    const ctx = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(projectTreeRef.current ? [{ role: "system", content: projectTreeRef.current }] : []),
      ...(folderContext    ? [{ role: "system", content: folderContext }]    : []),
      ...(knowledgeCtx    ? [{ role: "system", content: knowledgeCtx }]    : []),
      ...(webContext       ? [{ role: "system", content: webContext }]       : []),
      ...(fileContent      ? [{ role: "system", content: `Open file (${filePath}):\n\`\`\`\n${fileContent.slice(0, 8000)}\n\`\`\`` }] : []),
      {
        role: "system",
        content: [
          `User intent: ${INTENT_LABELS[intent]}.`,
          ctxNote,
          thinkInstructions[thinkMode] ?? "",
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

      // Feature 4: trigger comparison if compare mode is active
      if (compareMode && compareModel && compareModel !== selectedModel) {
        handleCompare(text, selectedModel, compareModel);
      }
    } catch (err: any) {
      toast.error(err.message ?? "AI error");
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      setSearchStatus("");
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
                  onClick={() => { setBrowserMode("project"); setShowBrowser(false); setShowKnowledge(false); }}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    color: browserMode === "project" && !showKnowledge ? C.accent : C.dim,
                    borderBottom: browserMode === "project" && !showKnowledge ? `2px solid ${C.accent}` : "2px solid transparent",
                    backgroundColor: "transparent",
                  }}>
                  <Code2 className="size-3" /> Project
                </button>
                <button
                  onClick={() => { setBrowserMode("external"); setShowBrowser(true); setShowKnowledge(false); }}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    color: browserMode === "external" && !showKnowledge ? C.accent : C.dim,
                    borderBottom: browserMode === "external" && !showKnowledge ? `2px solid ${C.accent}` : "2px solid transparent",
                    backgroundColor: "transparent",
                  }}>
                  <FolderPlus className="size-3" /> Open
                </button>
                <button
                  onClick={() => { setShowKnowledge(v => !v); setShowBrowser(false); }}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    color: showKnowledge ? C.accent : C.dim,
                    borderBottom: showKnowledge ? `2px solid ${C.accent}` : "2px solid transparent",
                    backgroundColor: "transparent",
                  }}>
                  <Brain className="size-3" /> KB
                </button>
              </div>

              {/* Knowledge Base panel */}
              {showKnowledge ? (
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  <KnowledgePanel onContextUpdate={setKnowledgeCtx} selectedFolder={selectedFolder} />
                </div>
              ) : browserMode === "external" && showBrowser ? (
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
                      {/* Re-index button */}
                      <button
                        onClick={() => indexFolderForRag(selectedFolder)}
                        disabled={ragIndexing}
                        title={ragIndexed ? `Re-index RAG (${ragStats?.totalFiles} files)` : "Index for RAG"}
                        className="flex items-center justify-center h-4 w-4 transition-colors disabled:opacity-50"
                        style={{ color: ragIndexed ? C.info : C.muted }}
                        onMouseEnter={e => (e.currentTarget.style.color = C.info)}
                        onMouseLeave={e => (e.currentTarget.style.color = ragIndexed ? C.info : C.muted)}>
                        {ragIndexing
                          ? <Loader2 className="size-3 animate-spin" />
                          : <Brain className="size-3" />}
                      </button>
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
                    {(selectedFolder ? externalTreeLoading : treeLoading) ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="size-3.5 animate-spin" style={{ color: C.accent }} />
                      </div>
                    ) : selectedFolder ? (
                      // Show external folder contents
                      externalEntries.length === 0
                        ? <p className="text-[9px] px-3 py-4 text-center" style={{ color: C.muted }}>Empty folder</p>
                        : externalEntries.map((entry: any) => (
                          <FolderRow key={entry.path} entry={entry} depth={0}
                            onSelect={handleOpenExternalFile} selectedPath={selectedFile?.path ?? ""}
                            onLoadDir={loadExternalDir} dirCache={externalDirCache} />
                        ))
                    ) : (
                      // Show admin portal project files
                      rootEntries.map((entry: any) => (
                        <FolderRow key={entry.path} entry={entry} depth={0}
                          onSelect={handleSelectFile} selectedPath={selectedFile?.path ?? ""}
                          onLoadDir={loadDir} dirCache={dirCache} />
                      ))
                    )}
                  </div>

                  {/* Chat history */}
                  <div className="shrink-0 border-t" style={{ borderColor: C.border }}>
                    <div
                      className="w-full flex items-center justify-between px-3 py-2 cursor-pointer transition-colors"
                      style={{ backgroundColor: showHistory ? "rgba(232,99,10,0.06)" : "transparent" }}
                      onMouseEnter={e => { if (!showHistory) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(232,99,10,0.04)"; }}
                      onMouseLeave={e => { if (!showHistory) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                      onClick={() => setShowHistory(v => !v)}>
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
                    </div>
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
                    {showPrefs && <PrefsPanel prefs={userPrefs} onChange={handlePrefsChange} />}                  </div>
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
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {fileLoading ? (
                  <div className="flex items-center justify-center h-full gap-2">
                    <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                  </div>
                ) : fileContent ? (
                  <div className="relative flex-1 flex overflow-hidden min-h-0">
                    {/* Line numbers — synced with textarea scroll */}
                    {(() => {
                      const lineNumRef = { current: null as HTMLDivElement | null };
                      return (
                        <>
                          <div
                            ref={el => { lineNumRef.current = el; }}
                            className="select-none text-right pt-4 pb-4 pr-2 pl-3 shrink-0 overflow-hidden pointer-events-none"
                            style={{ color: C.muted, fontSize: 10, fontFamily: C.font, lineHeight: "20px", minWidth: 44, backgroundColor: C.panel }}>
                            {fileContent.split("\n").map((_, i) => (
                              <div key={i} style={{ height: 20 }}>{i + 1}</div>
                            ))}
                          </div>
                          {/* Editable textarea — fills remaining space and scrolls */}
                          <textarea
                            value={fileContent}
                            onChange={e => setFileContent(e.target.value)}
                            onScroll={e => {
                              // Sync line numbers scroll position
                              if (lineNumRef.current) {
                                lineNumRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
                              }
                            }}
                            spellCheck={false}
                            className="flex-1 p-4 pl-2 text-[11px] focus:outline-none resize-none"
                            style={{
                              backgroundColor: C.bg, border: "none",
                              color: C.text, fontFamily: C.font,
                              lineHeight: "20px", whiteSpace: "pre",
                              overflowWrap: "normal", overflowX: "auto", overflowY: "auto",
                              height: "100%",
                            }} />
                        </>
                      );
                    })()}
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

              {/* ── Resizable Terminal with tabs ── */}
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
                  <div className="shrink-0 flex flex-col overflow-hidden" style={{ height: terminalHeight }}>
                    {/* Terminal tab bar */}
                    <div className="flex items-center border-b shrink-0 overflow-x-auto"
                      style={{ borderColor: C.border, backgroundColor: C.panel, minHeight: 26 }}>
                      {termTabs.map(tab => (
                        <div key={tab.id}
                          className="flex items-center shrink-0 border-r"
                          style={{ borderColor: C.border }}>
                          <button
                            onClick={() => setActiveTermTab(tab.id)}
                            className="flex items-center gap-1 px-2 h-6 text-[8px] transition-colors"
                            style={{
                              color: activeTermTab === tab.id ? C.success : C.dim,
                              backgroundColor: activeTermTab === tab.id ? `${C.success}08` : "transparent",
                              borderBottom: activeTermTab === tab.id ? `2px solid ${C.success}` : "2px solid transparent",
                            }}>
                            <TerminalSquare className="size-2.5" />
                            {tab.label}
                          </button>
                          {termTabs.length > 1 && (
                            <button
                              onClick={() => {
                                const remaining = termTabs.filter(t => t.id !== tab.id);
                                setTermTabs(remaining);
                                if (activeTermTab === tab.id) setActiveTermTab(remaining[remaining.length - 1].id);
                              }}
                              className="px-1 h-6 flex items-center"
                              style={{ color: C.muted }}
                              onMouseEnter={e => (e.currentTarget.style.color = C.error)}
                              onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
                              <X className="size-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      {/* Add new terminal tab */}
                      <button
                        onClick={() => {
                          const id    = `t${Date.now()}`;
                          const label = `Terminal ${termTabs.length + 1}`;
                          setTermTabs(prev => [...prev, { id, label, cwd: selectedFolder ?? "" }]);
                          setActiveTermTab(id);
                        }}
                        className="flex items-center justify-center h-6 w-6 ml-0.5 transition-colors shrink-0"
                        style={{ color: C.muted }}
                        title="New terminal"
                        onMouseEnter={e => (e.currentTarget.style.color = C.success)}
                        onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
                        <Play className="size-2.5 rotate-90" />
                      </button>
                    </div>
                    {/* Active terminal panel */}
                    {termTabs.map(tab => (
                      <div key={tab.id}
                        className="flex-1 overflow-hidden"
                        style={{ display: activeTermTab === tab.id ? "flex" : "none", flexDirection: "column" }}>
                        <TerminalPanel
                          initialCwd={tab.cwd || (selectedFolder ?? "")}
                          onSendToAI={handleSend}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ── Col 3: Chat ── */}
            <div className="w-96 shrink-0 flex flex-col overflow-hidden" style={{ backgroundColor: C.panel }}>
              {/* Chat tab bar */}
              <div className="flex items-center border-b shrink-0 overflow-x-auto"
                style={{ borderColor: C.border, backgroundColor: C.bg, minHeight: 28 }}>
                {chatTabs.map(tab => (
                  <div key={tab.id} className="flex items-center shrink-0 border-r"
                    style={{ borderColor: C.border }}>
                    <button
                      onClick={() => {
                        setActiveChatTab(tab.id);
                        // Load this tab's messages
                        setMessages(tab.messages);
                        setSessionId(tab.sessionId);
                      }}
                      className="flex items-center gap-1 px-2 h-7 text-[8px] transition-colors"
                      style={{
                        color: activeChatTab === tab.id ? C.accent : C.dim,
                        backgroundColor: activeChatTab === tab.id ? `${C.accent}08` : "transparent",
                        borderBottom: activeChatTab === tab.id ? `2px solid ${C.accent}` : "2px solid transparent",
                      }}>
                      <Bot className="size-2.5" />
                      {tab.label}
                      {tab.messages.length > 0 && (
                        <span className="text-[7px] px-0.5" style={{ color: C.muted }}>
                          {tab.messages.filter(m => m.role !== "system").length}
                        </span>
                      )}
                    </button>
                    {chatTabs.length > 1 && (
                      <button
                        onClick={() => {
                          const remaining = chatTabs.filter(t => t.id !== tab.id);
                          setChatTabs(remaining);
                          if (activeChatTab === tab.id) {
                            const next = remaining[remaining.length - 1];
                            setActiveChatTab(next.id);
                            setMessages(next.messages);
                            setSessionId(next.sessionId);
                          }
                        }}
                        className="px-1 h-7 flex items-center"
                        style={{ color: C.muted }}
                        onMouseEnter={e => (e.currentTarget.style.color = C.error)}
                        onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
                        <X className="size-2.5" />
                      </button>
                    )}
                  </div>
                ))}
                {/* New chat tab button */}
                <button
                  onClick={() => {
                    // Save current messages to active tab first
                    setChatTabs(prev => prev.map(t =>
                      t.id === activeChatTab ? { ...t, messages, sessionId } : t,
                    ));
                    const id    = `c${Date.now()}`;
                    const label = `Chat ${chatTabs.length + 1}`;
                    const newTab = { id, label, messages: [], sessionId: null };
                    setChatTabs(prev => [...prev, newTab]);
                    setActiveChatTab(id);
                    setMessages([]);
                    setSessionId(null);
                  }}
                  className="flex items-center justify-center h-7 w-7 ml-0.5 transition-colors shrink-0"
                  style={{ color: C.muted }}
                  title="New chat tab"
                  onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
                  <Play className="size-2.5 rotate-90" />
                </button>
                {/* Refresh / reload current chat */}
                <button
                  onClick={() => {
                    setMessages([]);
                    setSessionId(null);
                    setChatTabs(prev => prev.map(t =>
                      t.id === activeChatTab ? { ...t, messages: [], sessionId: null } : t,
                    ));
                  }}
                  className="flex items-center justify-center h-7 w-7 transition-colors shrink-0"
                  style={{ color: C.muted }}
                  title="Clear this chat"
                  onMouseEnter={e => (e.currentTarget.style.color = C.warn)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
                  <RefreshCw className="size-2.5" />
                </button>
              </div>
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
                  {/* RAG status badge */}
                  {ragIndexing && (
                    <span className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 border"
                      style={{ borderColor: `${C.info}40`, color: C.info, backgroundColor: `${C.info}08` }}>
                      <Loader2 className="size-2 animate-spin" /> indexing…
                    </span>
                  )}
                  {ragIndexed && !ragIndexing && (
                    <button
                      onClick={() => selectedFolder && indexFolderForRag(selectedFolder)}
                      className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 border transition-colors"
                      style={{ borderColor: `${C.info}40`, color: C.info, backgroundColor: `${C.info}08` }}
                      title={ragStats ? `RAG: ${ragStats.totalFiles} files, ${ragStats.totalChunks} chunks — click to re-index` : "RAG active"}>
                      <Brain className="size-2.5 shrink-0" />
                      <span>RAG</span>
                      {ragStats && <span style={{ color: C.muted }}>{ragStats.totalFiles}f</span>}
                    </button>
                  )}
                </div>
              </div>

              {/* Feature 4: Compare model selector — shown when compare mode is on */}
              {compareMode && models.length > 1 && (
                <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
                  style={{ borderColor: C.border, backgroundColor: `${C.warn}08` }}>
                  <Columns2 className="size-3 shrink-0" style={{ color: C.warn }} />
                  <span className="text-[8px] uppercase font-bold shrink-0" style={{ color: C.warn }}>Compare:</span>
                  <select
                    value={compareModel}
                    onChange={e => setCompareModel(e.target.value)}
                    className="flex-1 text-[9px] px-1.5 py-0.5 focus:outline-none"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
                    <option value="">Select second model…</option>
                    {models.filter(m => m.name !== selectedModel).map(m => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                  {compareModel && isComparing && (
                    <span className="text-[8px] flex items-center gap-1" style={{ color: C.warn }}>
                      <Loader2 className="size-2.5 animate-spin" /> comparing…
                    </span>
                  )}
                  <button
                    onClick={() => setCompareMode(false)}
                    style={{ color: C.dim }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.error)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                    <X className="size-3" />
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-2">
                    <Bot className="size-8 opacity-10" style={{ color: C.accent }} />
                    <p className="text-[10px]" style={{ color: C.dim }}>
                      {fileContent ? `Open: ${selectedFile?.name}` : "Open a file and ask the AI"}
                    </p>

                    {/* Folder-aware quick actions */}
                    {selectedFolder && (
                      <div className="w-full space-y-1">
                        <p className="text-[8px] uppercase tracking-widest font-bold mb-1" style={{ color: C.muted }}>
                          Generate for: {selectedFolder.replace(/\\/g, "/").split("/").filter(Boolean).pop()}
                        </p>
                        {[
                          {
                            label: "⚡ Modern Website (HTML + CSS + JS)",
                            prompt: "Build a complete modern website with 3 pages: index.html (home), about.html, contact.html. Use a single style.css with CSS variables, flexbox/grid layout, a sticky navigation bar with links between pages, hero section, cards, footer. Make it visually impressive with gradients, shadows, hover animations. All pages link to each other via <a href>."
                          },
                          {
                            label: "🎨 Landing Page (single page)",
                            prompt: "Build a stunning single-page landing page in index.html + style.css. Include: sticky nav, hero with gradient background, features section with cards, testimonials, CTA section, footer. Use modern CSS: custom properties, flexbox, smooth scroll, hover effects, responsive design."
                          },
                          {
                            label: "📋 Dashboard UI (HTML + CSS)",
                            prompt: "Build a modern admin dashboard in index.html + style.css. Include: sidebar navigation, top header with user avatar, stat cards, a data table, charts placeholder. Use CSS grid for layout, dark color scheme with accent colors."
                          },
                          {
                            label: "🛒 E-commerce Page",
                            prompt: "Build a product listing page (index.html + style.css) for an e-commerce site. Include: navbar, search bar, product cards grid with images, price, add-to-cart button, footer. Modern CSS with hover effects on cards."
                          },
                        ].map(item => (
                          <button key={item.label} onClick={() => handleSend(item.prompt)}
                            className="w-full px-2 py-2 text-left text-[10px] border transition-colors"
                            style={{ borderColor: `${C.accent}40`, color: C.accent, backgroundColor: `${C.accent}05` }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${C.accent}12`; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${C.accent}05`; }}>
                            {item.label}
                          </button>
                        ))}
                        <div className="border-t my-1" style={{ borderColor: C.border }} />
                      </div>
                    )}

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
                        {msg.content
                          ? <ContentRenderer
                              content={msg.content}
                              onRunCommand={(cmd) => {
                                // Show terminal if hidden, then run command
                                setShowTerminal(true);
                                // Small delay to let terminal mount
                                setTimeout(() => {
                                  if (terminalRunRef.current) {
                                    terminalRunRef.current(cmd);
                                  } else {
                                    // Fallback: put in input of active terminal by toast hint
                                    toast.info(`Run in terminal: ${cmd}`);
                                  }
                                }, 150);
                              }}
                            />
                          : (isStreaming && (
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

                      {/* Save code blocks to selected folder */}
                      {msg.role === "assistant" && msg.content && selectedFolder && (
                        <CodeBlockSaver content={msg.content} targetFolder={selectedFolder}
                          onSaved={refreshExternalTree} />
                      )}

                      {/* Task panel */}
                      {msg.tasks && msg.tasks.length > 0 && (
                        <TaskPanel
                          tasks={msg.tasks}
                          recs={msg.recs ?? []}
                          onApplyTask={task => handleDiffApply(task, msg.id)}
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
                {/* Thinking mode selector */}
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                  {(["normal","think","deep_think","research","deep_research"] as const).map(mode => {
                    const labels: Record<string, string> = {
                      normal:        "Normal",
                      think:         "🤔 Think",
                      deep_think:    "🧠 Deep Think",
                      research:      "🔍 Research",
                      deep_research: "🔬 Deep Research",
                    };
                    const colors: Record<string, string> = {
                      normal:        C.dim,
                      think:         C.info,
                      deep_think:    "#c084fc",
                      research:      C.warn,
                      deep_research: C.accent,
                    };
                    const active = thinkMode === mode;
                    return (
                      <button key={mode}
                        onClick={() => setThinkMode(mode)}
                        className="text-[8px] px-1.5 border transition-colors"
                        style={{
                          height: 18,
                          borderColor: active ? colors[mode] : `${C.border}`,
                          color:       active ? colors[mode] : C.muted,
                          backgroundColor: active ? `${colors[mode]}15` : "transparent",
                          fontWeight: active ? "bold" : "normal",
                        }}>
                        {labels[mode]}
                      </button>
                    );
                  })}
                  {/* Search status indicator */}
                  {searchStatus && (
                    <span className="text-[8px] ml-1 flex items-center gap-1" style={{ color: C.warn }}>
                      {isStreaming && <Loader2 className="size-2.5 animate-spin" />}
                      {searchStatus}
                    </span>
                  )}
                </div>
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

                {/* ── Bottom toolbar: token count + feature shortcuts ── */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {/* Feature 1: Token counter */}
                  <TokenBadge
                    messages={messages}
                    systemPrompt={SYSTEM_PROMPT}
                    fileContent={fileContent}
                    folderContext={folderContext}
                    knowledgeCtx={knowledgeCtx}
                  />
                  <div className="flex-1" />
                  {/* Feature 2: Export */}
                  {messages.length > 0 && (
                    <div className="relative group/export">
                      <button
                        className="flex items-center gap-1 h-5 px-1.5 text-[8px] border transition-colors"
                        style={{ borderColor: C.border, color: C.dim }}
                        title="Export chat"
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.info; e.currentTarget.style.color = C.info; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                        <Download className="size-2.5" /> Export
                      </button>
                      <div className="absolute bottom-full right-0 mb-1 z-50 hidden group-hover/export:flex flex-col border shadow-lg"
                        style={{ borderColor: C.border, backgroundColor: C.panel, minWidth: 100 }}>
                        <button onClick={() => exportChat(messages, "md")}
                          className="px-3 py-1.5 text-[9px] text-left transition-colors"
                          style={{ color: C.text }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${C.info}10`)}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                          .md
                        </button>
                        <button onClick={() => exportChat(messages, "txt")}
                          className="px-3 py-1.5 text-[9px] text-left transition-colors"
                          style={{ color: C.text }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${C.info}10`)}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                          .txt
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Feature 4: Compare */}
                  {models.length > 1 && (
                    <button
                      onClick={() => setCompareMode(v => !v)}
                      className="flex items-center gap-1 h-5 px-1.5 text-[8px] border transition-colors"
                      style={{
                        borderColor: compareMode ? C.warn : C.border,
                        color:       compareMode ? C.warn : C.dim,
                        backgroundColor: compareMode ? `${C.warn}10` : "transparent",
                      }}
                      title="Compare two models side by side">
                      <Columns2 className="size-2.5" /> Compare
                    </button>
                  )}
                  {/* Feature 5: Snippets */}
                  <button
                    onClick={() => setShowSnippets(true)}
                    className="flex items-center gap-1 h-5 px-1.5 text-[8px] border transition-colors"
                    style={{ borderColor: C.border, color: C.dim }}
                    title="Snippet library"
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                    <Sparkles className="size-2.5" /> Snippets
                  </button>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* ── Feature 3: Diff Viewer Modal ── */}
      {diffTask && (
        <DiffViewer
          before={diffTask.before}
          after={diffTask.task.code}
          onApply={() => applyTask(diffTask.task, diffTask.msgId)}
          onClose={() => setDiffTask(null)}
        />
      )}

      {/* ── Feature 4: Compare Result Panel ── */}
      {compareResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="flex flex-col border shadow-2xl"
            style={{ borderColor: C.border, backgroundColor: C.bg, width: "min(1100px, 98vw)", maxHeight: "85vh", fontFamily: C.font }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
              style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <Columns2 className="size-4" style={{ color: C.warn }} />
              <span className="text-[11px] font-bold uppercase tracking-widest flex-1" style={{ color: C.warn }}>
                Model Comparison
              </span>
              <button onClick={() => setCompareResult(null)} style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = C.error)}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden min-h-0 divide-x"
              style={{ borderColor: C.border }}>
              {/* Model A */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="px-4 py-2 border-b shrink-0"
                  style={{ borderColor: C.border, backgroundColor: C.panel }}>
                  <span className="text-[9px] font-bold" style={{ color: C.accent }}>{compareResult.modelA}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words"
                    style={{ color: C.text, fontFamily: C.font, margin: 0 }}>
                    {compareResult.contentA}
                  </pre>
                </div>
              </div>
              {/* Model B */}
              <div className="flex-1 flex flex-col min-w-0" style={{ borderColor: C.border }}>
                <div className="px-4 py-2 border-b shrink-0"
                  style={{ borderColor: C.border, backgroundColor: C.panel }}>
                  <span className="text-[9px] font-bold" style={{ color: C.info }}>{compareResult.modelB}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words"
                    style={{ color: C.text, fontFamily: C.font, margin: 0 }}>
                    {compareResult.contentB}
                  </pre>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t shrink-0"
              style={{ borderColor: C.border, backgroundColor: C.panel }}>
              <span className="text-[9px]" style={{ color: C.dim }}>
                Click a response to use it in chat
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { handleSend(`Use the response from ${compareResult.modelA}: ${compareResult.contentA.slice(0, 200)}...`); setCompareResult(null); }}
                  className="h-7 px-3 text-[9px] uppercase border"
                  style={{ borderColor: C.accent, color: C.accent }}>
                  Use {compareResult.modelA.split(":")[0]}
                </button>
                <button
                  onClick={() => { handleSend(`Use the response from ${compareResult.modelB}: ${compareResult.contentB.slice(0, 200)}...`); setCompareResult(null); }}
                  className="h-7 px-3 text-[9px] uppercase border"
                  style={{ borderColor: C.info, color: C.info }}>
                  Use {compareResult.modelB.split(":")[0]}
                </button>
                <button onClick={() => setCompareResult(null)}
                  className="h-7 px-3 text-[9px] uppercase border"
                  style={{ borderColor: C.border, color: C.dim }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Feature 5: Snippet Library Modal ── */}
      {showSnippets && (
        <SnippetLibrary
          onInsert={(code) => setInput(prev => prev ? `${prev}\n\n${code}` : code)}
          onClose={() => setShowSnippets(false)}
        />
      )}
    </ProtectedPageWrapper>
  );
}
