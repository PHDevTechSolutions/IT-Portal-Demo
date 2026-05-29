"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Key, Save, RefreshCw, CheckCircle2,
  Eye, EyeOff, AlertTriangle, Database,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

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

const EMPTY = {
  api_key:             "",
  auth_domain:         "",
  project_id:          "",
  storage_bucket:      "",
  messaging_sender_id: "",
  app_id:              "",
  measurement_id:      "",
  collection_name:     "careers",
  label:               "Default",
};

function Field({
  label, value, onChange, placeholder, secret = false, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; secret?: boolean; hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-mono uppercase tracking-widest" style={{ color: C.accent + "80" }}>{label}</label>
        {hint && <span className="text-[8px]" style={{ color: C.dim }}>{hint}</span>}
      </div>
      <div className="relative">
        <input
          type={secret && !show ? "password" : "text"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-8 px-2 pr-8 text-[11px] focus:outline-none font-mono"
          style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
          onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
          onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            {show
              ? <EyeOff className="size-3" style={{ color: C.dim }} />
              : <Eye    className="size-3" style={{ color: C.dim }} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RecruitmentCredentialsPage() {
  const router = useRouter();
  const [form,    setForm]    = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "ok" | "fail">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const setField = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  // ── Fetch existing credentials ──────────────────────────────────────────
  const fetchCreds = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/recruitment/credentials", { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.credentials) {
        const c = json.credentials;
        setForm({
          api_key:             c.api_key             ?? "",
          auth_domain:         c.auth_domain         ?? "",
          project_id:          c.project_id          ?? "",
          storage_bucket:      c.storage_bucket      ?? "",
          messaging_sender_id: c.messaging_sender_id ?? "",
          app_id:              c.app_id              ?? "",
          measurement_id:      c.measurement_id      ?? "",
          collection_name:     c.collection_name     ?? "careers",
          label:               c.label               ?? "Default",
        });
        setSavedAt(c.updated_at ?? c.created_at ?? null);
      }
    } catch (err: any) {
      toast.error("Failed to load credentials: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCreds(); }, []);

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.api_key.trim() || !form.auth_domain.trim() || !form.project_id.trim()) {
      toast.error("API Key, Auth Domain, and Project ID are required");
      return;
    }
    setSaving(true);
    try {
      const res  = await fetch("/api/recruitment/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success("Firebase credentials saved");
      setSavedAt(new Date().toISOString());
      setTestResult("idle");
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Test connection ─────────────────────────────────────────────────────
  const handleTest = async () => {
    if (!form.project_id.trim()) { toast.error("Fill in credentials first"); return; }
    setTesting(true);
    setTestResult("idle");
    try {
      // Save first so the jobs API picks up the new config
      await fetch("/api/recruitment/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      // Then try fetching jobs — if it works, connection is good
      const res  = await fetch("/api/recruitment/jobs", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setTestResult("ok");
        toast.success(`Connection OK — found ${json.total} job(s) in "${form.collection_name}"`);
      } else {
        throw new Error(json.error);
      }
    } catch (err: any) {
      setTestResult("fail");
      toast.error("Connection failed: " + err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset
          className="flex flex-col h-svh overflow-hidden bg-[#080d12]"
          style={{ fontFamily: C.font, color: C.text }}
        >
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
                  <BreadcrumbLink href="/recruitment/jobs" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>
                    Recruitment
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>
                    Firebase Credentials
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Supabase</span>
            </div>
          </header>

          {/* ── Title bar ── */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <Key className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Firebase Credentials</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Used by Recruitment · Job Postings · Saved to Supabase
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={fetchCreds}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                <RefreshCw className="size-3" /> Reload
              </button>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="relative z-10 flex-1 overflow-y-auto px-4 py-6">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                <span className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Loading…</span>
              </div>
            ) : (
              <div className="max-w-xl mx-auto space-y-6">

                {/* Info banner */}
                <div className="flex items-start gap-3 px-4 py-3 border" style={{ borderColor: "#fbbf2440", backgroundColor: "rgba(251,191,36,0.05)" }}>
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
                  <div>
                    <p className="text-[10px] font-bold" style={{ color: "#fbbf24" }}>These credentials are used only by the Recruitment module</p>
                    <p className="text-[9px] mt-0.5" style={{ color: C.dim }}>
                      Job Postings page reads from the Firebase project configured here.
                      Changes take effect immediately on the next data fetch.
                    </p>
                  </div>
                </div>

                {/* Label */}
                <div className="space-y-4">
                  <h2 className="text-[9px] font-bold uppercase tracking-widest pb-1 border-b" style={{ color: C.accent + "80", borderColor: C.border }}>
                    Configuration Label
                  </h2>
                  <Field label="Label" value={form.label} onChange={v => setField("label", v)}
                    placeholder="e.g. Production, Staging" hint="For your reference only" />
                </div>

                {/* Firebase config */}
                <div className="space-y-4">
                  <h2 className="text-[9px] font-bold uppercase tracking-widest pb-1 border-b" style={{ color: C.accent + "80", borderColor: C.border }}>
                    Firebase Project Config
                  </h2>
                  <Field label="API Key *" value={form.api_key} onChange={v => setField("api_key", v)}
                    placeholder="AIzaSy..." secret hint="From Firebase Console → Project Settings" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Auth Domain *" value={form.auth_domain} onChange={v => setField("auth_domain", v)}
                      placeholder="project-id.firebaseapp.com" />
                    <Field label="Project ID *" value={form.project_id} onChange={v => setField("project_id", v)}
                      placeholder="your-project-id" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Storage Bucket" value={form.storage_bucket} onChange={v => setField("storage_bucket", v)}
                      placeholder="project-id.appspot.com" />
                    <Field label="Messaging Sender ID" value={form.messaging_sender_id} onChange={v => setField("messaging_sender_id", v)}
                      placeholder="123456789" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="App ID" value={form.app_id} onChange={v => setField("app_id", v)}
                      placeholder="1:xxx:web:xxx" />
                    <Field label="Measurement ID" value={form.measurement_id} onChange={v => setField("measurement_id", v)}
                      placeholder="G-XXXXXXXXXX" hint="Optional" />
                  </div>
                </div>

                {/* Firestore collection */}
                <div className="space-y-4">
                  <h2 className="text-[9px] font-bold uppercase tracking-widest pb-1 border-b" style={{ color: C.accent + "80", borderColor: C.border }}>
                    Firestore Collection
                  </h2>
                  <Field label="Collection Name *" value={form.collection_name} onChange={v => setField("collection_name", v)}
                    placeholder="careers" hint="The Firestore collection for job postings" />
                  <div className="flex items-center gap-2 px-3 py-2 border" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                    <Database className="size-3.5 shrink-0" style={{ color: C.dim }} />
                    <span className="text-[10px] font-mono" style={{ color: C.dim }}>
                      firestore → <span style={{ color: C.accent }}>{form.project_id || "project-id"}</span>
                      {" "}→ <span style={{ color: "#60a5fa" }}>{form.collection_name || "careers"}</span>
                    </span>
                  </div>
                </div>

                {/* Last saved */}
                {savedAt && (
                  <p className="text-[9px] font-mono" style={{ color: C.muted }}>
                    Last saved: {new Date(savedAt).toLocaleString("en-PH")}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  {/* Test connection */}
                  <button onClick={handleTest} disabled={testing || saving}
                    className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                    style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#60a5fa"; e.currentTarget.style.color = "#60a5fa"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                    {testing
                      ? <Loader2 className="size-3 animate-spin" />
                      : testResult === "ok"
                        ? <CheckCircle2 className="size-3" style={{ color: "#34d399" }} />
                        : testResult === "fail"
                          ? <AlertTriangle className="size-3" style={{ color: "#f87171" }} />
                          : <Database className="size-3" />}
                    {testing ? "Testing…" : "Test Connection"}
                  </button>

                  {/* Test result badge */}
                  {testResult !== "idle" && (
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 border"
                      style={{
                        borderColor: testResult === "ok" ? "#34d39940" : "#f8717140",
                        color:       testResult === "ok" ? "#34d399"   : "#f87171",
                        backgroundColor: testResult === "ok" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                      }}>
                      {testResult === "ok" ? "✓ Connected" : "✗ Failed"}
                    </span>
                  )}

                  <div className="flex-1" />

                  {/* Save */}
                  <button onClick={handleSave} disabled={saving || testing}
                    className="flex items-center gap-1.5 h-8 px-5 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
                    style={{ borderColor: C.accent, color: "#fff", backgroundColor: C.accent }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
                    {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                    {saving ? "Saving…" : "Save Credentials"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
