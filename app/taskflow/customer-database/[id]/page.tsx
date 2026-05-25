"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import { logCustomerAudit, type AuditActor } from "@/lib/audit/customer-audit";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Save, Loader2, Building2, User, MapPin,
  ShieldCheck, Users, CalendarDays, ChevronRight, Hash,
  AlertCircle,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────── */

interface Customer {
  id: number;
  account_reference_number: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  delivery_address?: string;
  region: string;
  province?: string;
  city?: string;
  type_client: string;
  type?: string;
  referenceid: string;
  tsm: string;
  manager: string;
  status: string;
  remarks: string;
  industry?: string;
  gender?: string;
  company_group?: string;
  date_created: string;
  date_updated: string;
  next_available_date?: string;
  date_transferred?: string;
  date_approved?: string;
  date_removed?: string;
  transfer_to?: string;
}

/* ─── Tab config ─────────────────────────────────────────────────── */

type TabId = "company" | "contact" | "location" | "status" | "assignment" | "dates";

const TABS: { id: TabId; label: string; icon: any; description: string }[] = [
  { id: "company",    label: "Company Info",    icon: Building2,    description: "Name, type, group, industry" },
  { id: "contact",    label: "Contact Details", icon: User,         description: "Person, number, email, gender" },
  { id: "location",   label: "Location",        icon: MapPin,       description: "Address, region, province, city" },
  { id: "status",     label: "Status & Notes",  icon: ShieldCheck,  description: "Status, remarks, availability" },
  { id: "assignment", label: "Assignment",      icon: Users,        description: "TSA, TSM, manager, transfer" },
  { id: "dates",      label: "Dates",           icon: CalendarDays, description: "Created, updated, transferred…" },
];

/* ─── Field sections per tab ────────────────────────────────────── */

type FieldDef = { key: keyof Customer; label: string; readOnly?: boolean };

const TAB_FIELDS: Record<TabId, FieldDef[]> = {
  company: [
    { key: "account_reference_number", label: "Account Reference No.", readOnly: false },
    { key: "company_name",   label: "Company Name"   },
    { key: "company_group",  label: "Company Group"  },
    { key: "industry",       label: "Industry"       },
    { key: "type_client",    label: "Type Client"    },
    { key: "type",           label: "Type"           },
  ],
  contact: [
    { key: "contact_person", label: "Contact Person" },
    { key: "contact_number", label: "Contact Number" },
    { key: "email_address",  label: "Email Address"  },
    { key: "gender",         label: "Gender"         },
  ],
  location: [
    { key: "address",          label: "Address"          },
    { key: "delivery_address", label: "Delivery Address" },
    { key: "region",           label: "Region"           },
    { key: "province",         label: "Province"         },
    { key: "city",             label: "City"             },
  ],
  status: [
    { key: "status",              label: "Status"              },
    { key: "remarks",             label: "Remarks"             },
    { key: "next_available_date", label: "Next Available Date" },
  ],
  assignment: [
    { key: "referenceid",  label: "Reference ID (TSA)" },
    { key: "tsm",          label: "TSM"                },
    { key: "manager",      label: "Manager"            },
    { key: "transfer_to",  label: "Transfer To"        },
  ],
  dates: [
    { key: "date_created",     label: "Date Created",     readOnly: true },
    { key: "date_updated",     label: "Date Updated",     readOnly: true },
    { key: "date_transferred", label: "Date Transferred"               },
    { key: "date_approved",    label: "Date Approved"                  },
    { key: "date_removed",     label: "Date Removed"                   },
  ],
};

/* ─── Helper: safe JSON ──────────────────────────────────────────── */

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

/* ─── OpsInput ───────────────────────────────────────────────────── */

function OpsInput({ label, value, onChange, readOnly, hint }: {
  label: string; value: string; onChange?: (v: string) => void;
  readOnly?: boolean; hint?: string;
}) {
  return (
    <div className="group">
      <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-600 mb-1.5 group-focus-within:text-orange-400/70 transition-colors">
        {label}
      </label>
      <input
        value={value}
        readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        className={cn(
          "w-full bg-[#0a0d14] border text-slate-300 font-mono text-xs px-3 py-2.5",
          "focus:outline-none focus:border-orange-500/50 rounded-none transition-colors",
          "placeholder:text-slate-700",
          readOnly
            ? "border-slate-800 text-slate-600 cursor-default bg-[#080b11]"
            : "border-orange-500/15 hover:border-orange-500/25",
        )}
      />
      {hint && <p className="text-[9px] font-mono text-slate-700 mt-1">{hint}</p>}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */

export default function CustomerEditPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router  = useRouter();

  const [customer,     setCustomer]     = useState<Customer | null>(null);
  const [form,         setForm]         = useState<Customer | null>(null);
  const [activeTab,    setActiveTab]    = useState<TabId>("company");
  const [isFetching,   setIsFetching]   = useState(true);
  const [isSaving,     setIsSaving]     = useState(false);
  const [isDirty,      setIsDirty]      = useState(false);

  const actorRef = useRef<AuditActor>({ uid: null, name: null, email: null, role: null, referenceId: null });

  /* Load actor */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("currentUser");
      if (!stored) return;
      const p = JSON.parse(stored);
      actorRef.current = { uid: p.uid ?? null, name: p.name ?? null, email: p.email ?? null, role: p.role ?? null, referenceId: p.referenceId ?? null };
    } catch {}
  }, []);

  /* Fetch customer */
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/Data/Applications/Taskflow/CustomerDatabase/FetchById?id=${id}`);
        const data = await safeJson(res);
        if (!res.ok || !data?.success) { toast.error("Customer not found"); router.back(); return; }
        setCustomer(data.data);
        setForm({ ...data.data });
      } catch { toast.error("Failed to load customer"); router.back(); }
      finally { setIsFetching(false); }
    };
    load();
  }, [id]);

  /* Dirty tracking */
  useEffect(() => {
    if (!customer || !form) return;
    const dirty = (Object.keys(form) as (keyof Customer)[]).some(k => form[k] !== customer[k]);
    setIsDirty(dirty);
  }, [form, customer]);

  const handleChange = (key: keyof Customer, value: string) => {
    setForm(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const handleSave = async () => {
    if (!form || !customer) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Edit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await safeJson(res) ?? {};
      if (!res.ok || !result.success) { toast.error(result.error || "Update failed"); return; }

      /* Audit */
      const TRACKED: (keyof Customer)[] = [
        "company_name","contact_person","contact_number","email_address","address",
        "delivery_address","region","province","city","type_client","type","status",
        "remarks","industry","gender","company_group","next_available_date",
        "date_transferred","date_approved","date_removed","transfer_to",
        "referenceid","tsm","manager",
      ];
      const changes: Record<string, { before: unknown; after: unknown }> = {};
      for (const key of TRACKED) {
        if (customer[key] !== form[key]) changes[key] = { before: customer[key] ?? null, after: form[key] ?? null };
      }
      if (Object.keys(changes).length) {
        await logCustomerAudit({
          action: "update", affectedCount: 1,
          customerId: String(form.id), customerName: form.company_name,
          changes, actor: actorRef.current,
          context: { page: "Customer Database", source: "EditPage", bulk: false },
        });
      }

      setCustomer({ ...form });
      setIsDirty(false);
      toast.success("Customer saved");
    } catch { toast.error("Something went wrong"); }
    finally { setIsSaving(false); }
  };

  /* Completed field count per tab (for progress indicator) */
  const tabCompleteness = (tabId: TabId): number => {
    if (!form) return 0;
    const fields = TAB_FIELDS[tabId];
    const filled = fields.filter(f => String(form[f.key] ?? "").trim() !== "").length;
    return Math.round((filled / fields.length) * 100);
  };

  /* ─── Loading ── */
  if (isFetching) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-[#0a0d14] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={20} className="animate-spin text-orange-400/40" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-700">Loading record…</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!form) return null;

  /* ─── Render ── */
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-[#0a0d14] text-slate-300 flex flex-col h-svh overflow-hidden">

        {/* ── Header ── */}
        <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-orange-500/15 bg-[#0d1117]/95 backdrop-blur-sm">
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/40" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/40" />

          <div className="flex items-center gap-2 px-4 relative z-10">
            <SidebarTrigger className="-ml-1 text-orange-400/60 hover:text-orange-300 hover:bg-orange-500/10" />
            <Separator orientation="vertical" className="h-4 bg-orange-500/15 hidden sm:block" />
            <Breadcrumb className="hidden sm:flex">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard" className="text-slate-600 hover:text-orange-400 font-mono text-[10px] uppercase tracking-widest">Taskflow</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator><ChevronRight size={10} className="text-slate-700" /></BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/taskflow/customer-database" className="text-slate-600 hover:text-orange-400 font-mono text-[10px] uppercase tracking-widest">Customer DB</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator><ChevronRight size={10} className="text-slate-700" /></BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-orange-400 font-mono text-[10px] uppercase tracking-widest truncate max-w-[180px]">
                    {form.company_name || id}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Right: save + back */}
          <div className="flex items-center gap-2 px-4">
            {isDirty && (
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-amber-400/70">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Unsaved changes
              </span>
            )}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide text-slate-500 border border-slate-800 hover:border-slate-600 hover:text-slate-300 transition-colors">
              <ArrowLeft size={10} /> Back
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400 border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              {isSaving ? <><Loader2 size={10} className="animate-spin" /> Saving…</> : <><Save size={10} /> Save</>}
            </button>
          </div>
        </header>

        {/* ── Body: title + two-column layout ── */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* Page title strip */}
          <div className="shrink-0 px-6 py-4 border-b border-orange-500/10 bg-[#0d1117]/40">
            <div className="flex items-start gap-4">
              <div className="relative p-2.5 bg-orange-500/10 border border-orange-500/25 shrink-0">
                <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-orange-500/50" />
                <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-orange-500/50" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/50" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/50" />
                <Building2 size={16} className="text-orange-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold font-mono uppercase tracking-widest text-slate-100 leading-tight truncate">
                  {form.company_name || "—"}
                </h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {form.account_reference_number && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-orange-500/50">
                      <Hash size={9} /> {form.account_reference_number}
                    </span>
                  )}
                  {form.status && (
                    <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest border border-orange-500/15 px-2 py-0.5">
                      {form.status}
                    </span>
                  )}
                  {form.region && (
                    <span className="text-[10px] font-mono text-slate-700">{form.region}</span>
                  )}
                </div>
              </div>

              {/* Dirty warning on mobile */}
              {isDirty && (
                <div className="sm:hidden ml-auto flex items-center gap-1 text-[10px] font-mono text-amber-400/70">
                  <AlertCircle size={10} /> Unsaved
                </div>
              )}
            </div>
          </div>

          {/* ── Two-column: LEFT tabs | RIGHT fields ── */}
          <div className="flex-1 overflow-hidden flex">

            {/* LEFT: Tab list */}
            <aside className="w-56 shrink-0 border-r border-orange-500/10 bg-[#0d1117]/50 flex flex-col overflow-y-auto">
              <div className="px-4 py-3 border-b border-orange-500/10">
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-700">Edit Sections</p>
              </div>
              <nav className="flex-1 py-2">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  const pct = tabCompleteness(tab.id);
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 transition-all duration-100 group relative",
                        "flex items-start gap-3 border-b border-orange-500/5",
                        active
                          ? "bg-orange-500/10 border-l-2 border-l-orange-500/60"
                          : "border-l-2 border-l-transparent hover:bg-orange-500/5 hover:border-l-orange-500/20",
                      )}>
                      {/* Icon */}
                      <div className={cn(
                        "mt-0.5 w-6 h-6 flex items-center justify-center border shrink-0",
                        active
                          ? "border-orange-500/40 bg-orange-500/10"
                          : "border-slate-800 bg-[#0a0d14] group-hover:border-orange-500/20",
                      )}>
                        <Icon size={11} className={active ? "text-orange-400" : "text-slate-600"} />
                      </div>
                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-[11px] font-mono font-semibold leading-snug",
                          active ? "text-orange-400" : "text-slate-500 group-hover:text-slate-400",
                        )}>
                          {tab.label}
                        </p>
                        <p className="text-[9px] font-mono text-slate-700 mt-0.5 truncate">{tab.description}</p>
                        {/* Completeness bar */}
                        <div className="mt-1.5 h-0.5 bg-slate-800 overflow-hidden">
                          <div
                            className={cn("h-full transition-all duration-500", active ? "bg-orange-500/60" : "bg-slate-700")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      {/* Arrow indicator */}
                      {active && (
                        <ChevronRight size={12} className="text-orange-500/40 mt-0.5 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Bottom: quick stats */}
              <div className="shrink-0 px-4 py-3 border-t border-orange-500/10 space-y-1.5">
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-700">Record</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-600">ID</span>
                  <span className="text-[10px] font-mono text-slate-500">{form.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-600">Created</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {form.date_created ? new Date(form.date_created).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>
            </aside>

            {/* RIGHT: Fields panel */}
            <main className="flex-1 overflow-y-auto">
              {TABS.map(tab => {
                if (tab.id !== activeTab) return null;
                const Icon = tab.icon;
                return (
                  <div key={tab.id} className="p-6 sm:p-8 w-full">
                    {/* Section header */}
                    <div className="flex items-center gap-3 mb-7">
                      <div className="relative p-2 border border-orange-500/20 bg-orange-500/5">
                        <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-orange-500/40" />
                        <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/40" />
                        <Icon size={14} className="text-orange-400" />
                      </div>
                      <div>
                        <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-orange-400">
                          {tab.label}
                        </h2>
                        <p className="text-[10px] font-mono text-slate-700 mt-0.5">{tab.description}</p>
                      </div>
                      <div className="ml-auto text-[9px] font-mono text-slate-700 tabular-nums">
                        {tabCompleteness(tab.id)}% complete
                      </div>
                    </div>

                    {/* Field grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {TAB_FIELDS[tab.id].map(field => (
                        <OpsInput
                          key={field.key}
                          label={field.label}
                          value={String(form[field.key] ?? "")}
                          readOnly={field.readOnly}
                          onChange={v => handleChange(field.key, v)}
                          hint={field.readOnly ? "Auto-managed — read only" : undefined}
                        />
                      ))}
                    </div>

                    {/* Bottom save bar (within panel) */}
                    <div className="mt-10 pt-5 border-t border-orange-500/10 flex items-center justify-between">
                      <p className="text-[10px] font-mono text-slate-700">
                        {isDirty
                          ? "You have unsaved changes across all sections."
                          : "All changes are saved."}
                      </p>
                      <button
                        onClick={handleSave}
                        disabled={isSaving || !isDirty}
                        className="flex items-center gap-2 px-5 py-2 text-[11px] font-mono font-bold uppercase tracking-widest text-orange-400 border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        {isSaving
                          ? <><Loader2 size={11} className="animate-spin" /> Saving…</>
                          : <><Save size={11} /> Save Changes</>
                        }
                      </button>
                    </div>
                  </div>
                );
              })}
            </main>
          </div>
        </div>

      </SidebarInset>
    </SidebarProvider>
  );
}