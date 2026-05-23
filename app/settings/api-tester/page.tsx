"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Play, Save, Trash2, Copy, CheckCircle2, Terminal, Send, Clock,
  AlertCircle, Database, Code, History, Plus, X, Download, FileJson,
  LayoutGrid, Globe, RefreshCw, ChevronDown, ChevronRight, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApiRequest  { id: string; name: string; method: string; url: string; headers: Record<string,string>; body: string; timestamp: string; }
interface ApiResponse { status: number; statusText: string; headers: Record<string,string>; body: any; time: number; size: string; }
interface SavedRequest{ id: string; name: string; method: string; url: string; headers: Record<string,string>; body: string; createdAt: string; }

const METHODS = ["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"];
const DEFAULT_TOKEN = "esp_feb14de9263c84b53a5293464ed277c4207c2e4e9678761d3abc4f12679f0714";

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

const METHOD_COLOR: Record<string,string> = {
  GET:     "text-sky-400 border-sky-500/40 bg-sky-500/10",
  POST:    "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  PUT:     "text-amber-400 border-amber-500/40 bg-amber-500/10",
  PATCH:   "text-orange-400 border-orange-500/40 bg-orange-500/10",
  DELETE:  "text-red-400 border-red-500/40 bg-red-500/10",
  HEAD:    "text-violet-400 border-violet-500/40 bg-violet-500/10",
  OPTIONS: "text-pink-400 border-pink-500/40 bg-pink-500/10",
};

function statusColor(s: number) {
  if (s >= 200 && s < 300) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (s >= 300 && s < 400) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  if (s >= 400)            return "text-red-400 border-red-500/30 bg-red-500/10";
  return "text-slate-400 border-slate-500/30 bg-slate-500/10";
}

export default function ApiTesterPage() {
  const router = useRouter();

  // ── Request state ─────────────────────────────────────────────────────────
  const [method,   setMethod]   = useState("POST");
  const [url,      setUrl]      = useState("/api/Data/Applications/Acculog/DataManagement");
  const [headers,  setHeaders]  = useState<Record<string,string>>({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${DEFAULT_TOKEN}`,
  });
  const [body,     setBody]     = useState(JSON.stringify({ action: "stats" }, null, 2));
  const [useProxy, setUseProxy] = useState(false);

  // ── Response state ────────────────────────────────────────────────────────
  const [response,   setResponse]   = useState<ApiResponse | null>(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const [activeTab,  setActiveTab]  = useState<"body"|"headers"|"table">("body");

  // ── Sidebar state ─────────────────────────────────────────────────────────
  const [history,       setHistory]       = useState<ApiRequest[]>([]);
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>([]);
  const [showSaveDialog,setShowSaveDialog]= useState(false);
  const [requestName,   setRequestName]   = useState("");
  const [selectedHistId,setSelectedHistId]= useState<string|null>(null);
  const [histOpen,      setHistOpen]      = useState(true);
  const [savedOpen,     setSavedOpen]     = useState(true);

  // ── Load from localStorage ────────────────────────────────────────────────
  useEffect(() => {
    try {
      const s = localStorage.getItem("apiTester_savedRequests");
      if (s) setSavedRequests(JSON.parse(s));
      const h = localStorage.getItem("apiTester_history");
      if (h) setHistory(JSON.parse(h));
    } catch {}
  }, []);

  const persistSaved = (reqs: SavedRequest[]) => {
    localStorage.setItem("apiTester_savedRequests", JSON.stringify(reqs));
    setSavedRequests(reqs);
  };
  const persistHistory = (hist: ApiRequest[]) => {
    localStorage.setItem("apiTester_history", JSON.stringify(hist.slice(0, 50)));
    setHistory(hist.slice(0, 50));
  };

  // ── Send request ──────────────────────────────────────────────────────────
  const sendRequest = async () => {
    setIsLoading(true);
    setResponse(null);
    const t0 = performance.now();
    try {
      let res: Response;
      if (useProxy) {
        const pr = await fetch("/api/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUrl: url, method, headers,
            payload: method !== "GET" && method !== "HEAD" ? JSON.parse(body || "{}") : undefined,
          }),
        });
        const pd = await pr.json();
        if (!pd.success) throw new Error(pd.message || "Proxy failed");
        res = { status: pd.status, statusText: pd.statusText,
          headers: new Headers(pd.headers),
          json: async () => pd.data,
          text: async () => typeof pd.data === "string" ? pd.data : JSON.stringify(pd.data),
        } as unknown as Response;
      } else {
        const opts: RequestInit = { method, headers };
        if (method !== "GET" && method !== "HEAD" && body) opts.body = body;
        res = await fetch(url, opts);
      }
      const elapsed = Math.round(performance.now() - t0);
      const resHeaders: Record<string,string> = {};
      res.headers.forEach((v, k) => { resHeaders[k] = v; });
      const ct = res.headers.get("content-type") ?? "";
      const resBody = ct.includes("application/json") ? await res.json() : await res.text();
      const bytes = JSON.stringify(resBody).length;
      const size  = bytes > 1024 ? `${(bytes/1024).toFixed(1)} KB` : `${bytes} B`;
      setResponse({ status: res.status, statusText: res.statusText, headers: resHeaders, body: resBody, time: elapsed, size });
      setActiveTab("body");
      persistHistory([{ id: Date.now().toString(), name: `${method} ${url}`, method, url, headers, body, timestamp: new Date().toLocaleString() }, ...history]);
      toast.success(`${res.status} · ${elapsed}ms`);
    } catch (err: any) {
      toast.error("Request failed: " + err.message);
      setResponse({ status: 0, statusText: "Error", headers: {}, body: { error: err.message }, time: 0, size: "0 B" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Header helpers ────────────────────────────────────────────────────────
  const addHeader    = () => setHeaders(h => ({ ...h, "": "" }));
  const removeHeader = (k: string) => setHeaders(h => { const n = { ...h }; delete n[k]; return n; });
  const updateHeader = (old: string, nk: string, nv: string) =>
    setHeaders(h => { const n = { ...h }; delete n[old]; if (nk) n[nk] = nv; return n; });

  // ── Misc helpers ──────────────────────────────────────────────────────────
  const formatJson = () => {
    try { setBody(JSON.stringify(JSON.parse(body), null, 2)); toast.success("Formatted"); }
    catch { toast.error("Invalid JSON"); }
  };
  const copyResponse = () => {
    navigator.clipboard.writeText(JSON.stringify(response?.body, null, 2));
    toast.success("Copied to clipboard");
  };
  const downloadResponse = () => {
    const blob = new Blob([JSON.stringify(response?.body, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `response_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Downloaded");
  };
  const saveCurrentRequest = () => {
    if (!requestName.trim()) { toast.error("Enter a name"); return; }
    const r: SavedRequest = { id: Date.now().toString(), name: requestName, method, url, headers, body, createdAt: new Date().toLocaleString() };
    persistSaved([r, ...savedRequests]);
    setShowSaveDialog(false); setRequestName("");
    toast.success("Saved");
  };
  const loadRequest = (r: SavedRequest | ApiRequest) => {
    setMethod(r.method); setUrl(r.url); setHeaders(r.headers); setBody(r.body);
    if ("id" in r) setSelectedHistId(r.id);
    toast.success("Loaded");
  };

  // ── Table view helpers ────────────────────────────────────────────────────
  const tableData: any[] | null = (() => {
    if (!response) return null;
    if (Array.isArray(response.body)) return response.body;
    if (Array.isArray(response.body?.data)) return response.body.data;
    return null;
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-svh overflow-hidden"
        style={{ backgroundColor: C.bg, fontFamily: C.font, color: C.text }}>

        {/* Dot-grid */}
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
          backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
        }} />

        {/* ── Header ── */}
        <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b"
          style={{ backgroundColor: C.bg, borderColor: C.border }}>
          <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: C.dim }} />
          <div className="w-px h-4" style={{ backgroundColor: C.border }} />
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}
            className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest rounded-none hover:bg-transparent"
            style={{ color: C.dim }}>Home</Button>
          <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Settings</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>API Tester</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Ready</span>
          </div>
        </header>

        {/* ── Title bar ── */}
        <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: C.border, backgroundColor: C.panel }}>
          <div className="flex h-8 w-8 items-center justify-center border"
            style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
            <Terminal className="size-4" style={{ color: C.accent }} />
          </div>
          <div>
            <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>API Tester</h1>
            <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>Test and debug API endpoints</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px]" style={{ color: C.muted }}>$ curl --request {method}</span>
          </div>
        </div>

        {/* ── Body: 3-column layout ── */}
        <div className="relative z-10 flex flex-1 overflow-hidden">

          {/* ── LEFT: Saved + History ── */}
          <div className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
            style={{ borderColor: C.border, backgroundColor: C.panel }}>

            {/* Saved */}
            <div className="border-b" style={{ borderColor: C.border }}>
              <button onClick={() => setSavedOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: C.accent }}>
                <span className="flex items-center gap-1.5"><Save className="size-3" /> Saved ({savedRequests.length})</span>
                {savedOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              </button>
              {savedOpen && (
                <div className="pb-1">
                  {savedRequests.length === 0 ? (
                    <p className="px-3 py-2 text-[10px]" style={{ color: C.muted }}>No saved requests</p>
                  ) : savedRequests.map(r => (
                    <div key={r.id} className="group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors"
                      style={{ borderBottom: `1px solid ${C.muted}20` }}
                      onClick={() => loadRequest(r)}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.06)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <span className={`text-[8px] font-bold px-1 py-0.5 border ${METHOD_COLOR[r.method] ?? ""}`}>{r.method}</span>
                      <span className="flex-1 text-[10px] truncate" style={{ color: C.text }}>{r.name}</span>
                      <button onClick={e => { e.stopPropagation(); persistSaved(savedRequests.filter(x => x.id !== r.id)); toast.success("Deleted"); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="size-3" style={{ color: "#f87171" }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
            <div>
              <button onClick={() => setHistOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: C.accent }}>
                <span className="flex items-center gap-1.5"><History className="size-3" /> History ({history.length})</span>
                {histOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              </button>
              {histOpen && (
                <div className="pb-1">
                  {history.length > 0 && (
                    <button onClick={() => { persistHistory([]); toast.success("Cleared"); }}
                      className="w-full text-left px-3 py-1 text-[9px] uppercase tracking-wider transition-colors"
                      style={{ color: C.dim }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                      onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                      Clear all
                    </button>
                  )}
                  {history.length === 0 ? (
                    <p className="px-3 py-2 text-[10px]" style={{ color: C.muted }}>No history yet</p>
                  ) : history.map(r => (
                    <div key={r.id}
                      className="flex items-start gap-1.5 px-3 py-1.5 cursor-pointer transition-colors"
                      style={{
                        borderBottom: `1px solid ${C.muted}20`,
                        backgroundColor: selectedHistId === r.id ? "rgba(232,99,10,0.08)" : "transparent",
                      }}
                      onClick={() => { loadRequest(r); setSelectedHistId(r.id); }}
                      onMouseEnter={e => { if (selectedHistId !== r.id) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)"; }}
                      onMouseLeave={e => { if (selectedHistId !== r.id) e.currentTarget.style.backgroundColor = "transparent"; }}>
                      <span className={`text-[8px] font-bold px-1 py-0.5 border mt-0.5 shrink-0 ${METHOD_COLOR[r.method] ?? ""}`}>{r.method}</span>
                      <div className="min-w-0">
                        <p className="text-[10px] truncate" style={{ color: C.text }}>{r.url}</p>
                        <p className="text-[9px]" style={{ color: C.muted }}>{r.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── CENTER: Request builder ── */}
          <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: C.border }}>

            {/* URL bar */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              {/* Method selector */}
              <div className="relative">
                <select value={method} onChange={e => setMethod(e.target.value)}
                  className={`h-8 px-2 pr-6 text-[11px] font-bold uppercase focus:outline-none border appearance-none ${METHOD_COLOR[method] ?? ""}`}
                  style={{ backgroundColor: "transparent", fontFamily: C.font }}>
                  {METHODS.map(m => <option key={m} value={m} style={{ backgroundColor: C.panel, color: C.text }}>{m}</option>)}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 pointer-events-none" style={{ color: C.dim }} />
              </div>

              {/* URL input */}
              <input value={url} onChange={e => setUrl(e.target.value)}
                placeholder="Enter API URL…"
                onKeyDown={e => { if (e.key === "Enter") sendRequest(); }}
                className="flex-1 h-8 px-3 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
              />

              {/* Proxy toggle */}
              <button onClick={() => setUseProxy(p => !p)} title={useProxy ? "Proxy ON" : "Proxy OFF"}
                className="flex items-center gap-1.5 h-8 px-2 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{
                  borderColor: useProxy ? "#60a5fa" : C.border,
                  color:       useProxy ? "#60a5fa" : C.dim,
                  backgroundColor: useProxy ? "rgba(96,165,250,0.1)" : "transparent",
                }}>
                <Globe className="size-3" />
                <span className="hidden sm:inline">Proxy</span>
              </button>

              {/* Send */}
              <button onClick={sendRequest} disabled={isLoading}
                className="flex items-center gap-1.5 h-8 px-4 text-[11px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-50"
                style={{ backgroundColor: "rgba(232,99,10,0.15)", borderColor: C.accent, color: C.accent }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.25)"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.15)"; }}>
                {isLoading
                  ? <><RefreshCw className="size-3 animate-spin" /> Sending…</>
                  : <><Play className="size-3" /> Send</>}
              </button>
            </div>

            {/* Tab bar */}
            <div className="shrink-0 flex items-center border-b" style={{ borderColor: C.border, backgroundColor: C.panel }}>
              {(["body","headers"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t as any)}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors"
                  style={{
                    borderBottomColor: activeTab === t ? C.accent : "transparent",
                    color: activeTab === t ? C.accent : C.dim,
                  }}>
                  {t === "body" ? <><FileJson className="size-3 inline mr-1" />Body</> : <><LayoutGrid className="size-3 inline mr-1" />Headers ({Object.keys(headers).length})</>}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1 px-3">
                <button onClick={formatJson}
                  className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase tracking-wider border transition-colors"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                  <Code className="size-3" /> Format
                </button>
                <button onClick={() => setShowSaveDialog(true)}
                  className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase tracking-wider border transition-colors"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                  <Save className="size-3" /> Save
                </button>
              </div>
            </div>

            {/* Body / Headers editor */}
            <div className="flex-1 overflow-auto">
              {activeTab === "body" ? (
                <textarea value={body} onChange={e => setBody(e.target.value)}
                  placeholder="Request body (JSON)…"
                  spellCheck={false}
                  className="w-full h-full p-4 text-[12px] resize-none focus:outline-none"
                  style={{ backgroundColor: C.bg, color: C.text, fontFamily: C.font, border: "none" }}
                />
              ) : (
                <div className="p-4 space-y-2">
                  {Object.entries(headers).map(([k, v], i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={k} onChange={e => updateHeader(k, e.target.value, v)}
                        placeholder="Header name"
                        className="flex-1 h-8 px-3 text-[11px] focus:outline-none"
                        style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                        onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                        onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                      />
                      <input value={v} onChange={e => updateHeader(k, k, e.target.value)}
                        placeholder="Value"
                        className="flex-1 h-8 px-3 text-[11px] focus:outline-none"
                        style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                        onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                        onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                      />
                      <button onClick={() => removeHeader(k)}
                        className="h-8 w-8 flex items-center justify-center border transition-colors"
                        style={{ borderColor: C.border, color: C.dim }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={addHeader}
                    className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors mt-2"
                    style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                    <Plus className="size-3" /> Add Header
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Response ── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Response status bar */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b"
              style={{ borderColor: C.border, backgroundColor: C.panel }}>
              {response ? (
                <>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${statusColor(response.status)}`}>
                    {response.status} {response.statusText}
                  </span>
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: C.dim }}>
                    <Clock className="size-3" />{response.time}ms
                  </span>
                  <span className="text-[10px]" style={{ color: C.dim }}>{response.size}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={copyResponse}
                      className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase tracking-wider border transition-colors"
                      style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                      <Copy className="size-3" /> Copy
                    </button>
                    <button onClick={downloadResponse}
                      className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase tracking-wider border transition-colors"
                      style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                      <Download className="size-3" /> JSON
                    </button>
                  </div>
                </>
              ) : (
                <span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>
                  {isLoading ? "Waiting for response…" : "No response yet"}
                </span>
              )}
            </div>

            {/* Response tab bar */}
            {response && (
              <div className="shrink-0 flex items-center border-b" style={{ borderColor: C.border, backgroundColor: C.panel }}>
                {(["body","headers","table"] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors"
                    style={{
                      borderBottomColor: activeTab === t ? C.accent : "transparent",
                      color: activeTab === t ? C.accent : C.dim,
                    }}>
                    {t}
                    {t === "table" && tableData && <span className="ml-1 text-[9px]" style={{ color: C.muted }}>({tableData.length})</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Response content */}
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full gap-3">
                  <RefreshCw className="size-4 animate-spin" style={{ color: C.accent }} />
                  <span className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>Sending request…</span>
                </div>
              ) : !response ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Terminal className="size-10 opacity-20" style={{ color: C.accent }} />
                  <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Send a request to see the response</p>
                  <p className="text-[10px]" style={{ color: C.muted }}>Press Enter in the URL bar or click Send</p>
                </div>
              ) : activeTab === "body" ? (
                <pre className="p-4 text-[12px] leading-relaxed whitespace-pre-wrap break-all"
                  style={{ color: C.text, fontFamily: C.font }}>
                  {JSON.stringify(response.body, null, 2)}
                </pre>
              ) : activeTab === "headers" ? (
                <table className="w-full border-collapse" style={{ fontSize: "11px", fontFamily: C.font }}>
                  <thead className="sticky top-0">
                    <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                      <th className="text-left px-4 py-2 font-bold uppercase tracking-widest text-[9px]" style={{ color: C.accent, borderRight: `1px solid ${C.border}` }}>Header</th>
                      <th className="text-left px-4 py-2 font-bold uppercase tracking-widest text-[9px]" style={{ color: C.accent }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(response.headers).map(([k, v], i) => (
                      <tr key={k} style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel, borderBottom: `1px solid ${C.border}` }}>
                        <td className="px-4 py-2 font-bold" style={{ color: C.accent, borderRight: `1px solid ${C.border}` }}>{k}</td>
                        <td className="px-4 py-2 break-all" style={{ color: C.dim }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : tableData ? (
                <table className="w-full border-collapse" style={{ fontSize: "11px", fontFamily: C.font }}>
                  <thead className="sticky top-0">
                    <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                      {Object.keys(tableData[0] ?? {}).map(k => (
                        <th key={k} className="text-left px-3 py-2.5 whitespace-nowrap font-bold uppercase tracking-widest text-[9px]"
                          style={{ color: C.accent, borderRight: `1px solid ${C.border}` }}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row: any, i: number) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel, borderBottom: `1px solid ${C.border}` }}>
                        {Object.values(row).map((val: any, j: number) => (
                          <td key={j} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate"
                            style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>
                            {typeof val === "object" ? JSON.stringify(val) : String(val ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <AlertCircle className="size-8 opacity-30" style={{ color: C.dim }} />
                  <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Response is not an array</p>
                  <p className="text-[10px]" style={{ color: C.muted }}>Switch to Body tab to view</p>
                </div>
              )}
            </div>
          </div>

        </div>{/* end 3-col */}

        {/* ── Save dialog ── */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent className="rounded-none p-0 gap-0 max-w-sm"
            style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}>
            <DialogHeader className="px-5 py-4 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
              <DialogTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: C.accent }}>
                <Save className="size-3" /> Save Request
              </DialogTitle>
              <DialogDescription className="text-[10px] uppercase tracking-wider mt-1" style={{ color: C.muted }}>
                Give this request a name
              </DialogDescription>
            </DialogHeader>
            <div className="px-5 py-4">
              <input value={requestName} onChange={e => setRequestName(e.target.value)}
                placeholder="e.g., Get Data Stats"
                onKeyDown={e => { if (e.key === "Enter") saveCurrentRequest(); }}
                className="w-full h-8 px-3 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                autoFocus
              />
            </div>
            <div className="px-5 pb-4 flex justify-end gap-2">
              <button onClick={() => setShowSaveDialog(false)}
                className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                Cancel
              </button>
              <button onClick={saveCurrentRequest}
                className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ backgroundColor: "rgba(232,99,10,0.15)", borderColor: C.accent, color: C.accent }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.25)"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.15)"; }}>
                <Save className="size-3 inline mr-1" /> Save
              </button>
            </div>
          </DialogContent>
        </Dialog>

      </SidebarInset>
    </SidebarProvider>
  );
}
