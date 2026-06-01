"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, Package,
  MapPin, Globe, Mail, Phone, ChevronDown, ChevronUp,
  Award, ShoppingBag, Star,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import type { Supplier } from "@/app/api/stock/suppliers/route";

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

const PAGE_SIZE = 20;

export default function SuppliersPage() {
  const router = useRouter();

  const [suppliers,     setSuppliers]     = useState<Supplier[]>([]);
  const [filtered,      setFiltered]      = useState<Supplier[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [search,        setSearch]        = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [page,          setPage]          = useState(1);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/stock/suppliers", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuppliers(json.data ?? []);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  useEffect(() => {
    let r = [...suppliers];
    if (countryFilter) r = r.filter(s => s.country.toLowerCase().includes(countryFilter.toLowerCase()));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(s =>
        s.company.toLowerCase().includes(q) ||
        s.supplierBrand.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.products.some(p => p.toLowerCase().includes(q)) ||
        s.contacts.some(c => c.name.toLowerCase().includes(q))
      );
    }
    setFiltered(r);
    setPage(1);
  }, [suppliers, search, countryFilter]);

  const allCountries = [...new Set(suppliers.map(s => s.country).filter(Boolean))].sort();
  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>Home</button>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Stock</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>Suppliers</BreadcrumbPage>
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
              <Package className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Suppliers</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Firebase · {suppliers.length} total
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => router.push("/stock/credentials")}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                Credentials
              </button>
              <button onClick={fetchSuppliers}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                <RefreshCw className="size-3" /> Refresh
              </button>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="relative z-10 shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
              <input placeholder="Search company, brand, product, contact…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-3" style={{ color: C.dim }} /></button>}
            </div>
            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: countryFilter ? C.text : C.dim, fontFamily: C.font }}>
              <option value="">All Countries</option>
              {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {countryFilter && (
              <button onClick={() => setCountryFilter("")}
                className="flex items-center gap-1 h-8 px-2 text-[10px] transition-colors" style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                <X className="size-3" /> Clear
              </button>
            )}
            <div className="ml-auto text-[10px]" style={{ color: C.muted }}>
              <span style={{ color: C.text }}>{filtered.length}</span> suppliers
            </div>
          </div>

          {/* ── Table ── */}
          <div className="relative z-10 flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full gap-3">
                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                <span className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Loading from Firebase…</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
                <Package className="size-8 opacity-20" style={{ color: "#f87171" }} />
                <p className="text-[11px] font-bold" style={{ color: "#f87171" }}>{error}</p>
                <button onClick={() => router.push("/stock/credentials")}
                  className="flex items-center gap-2 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                  style={{ borderColor: C.accent, color: C.accent, backgroundColor: "rgba(232,99,10,0.1)" }}>
                  Configure Firebase Credentials
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Package className="size-8 opacity-20" style={{ color: C.accent }} />
                <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No suppliers found</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                    {["", "Company / Brand", "Country", "Address", "Contacts", "Emails", "Products", "Certificates", "Website", "Updated"].map((h, i) => (
                      <th key={i} className="text-left px-4 py-2.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-widest"
                        style={{ color: C.accent, borderRight: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s, i) => {
                    const isExpanded = expandedId === s.id;
                    return (
                      <React.Fragment key={s.id}>
                        <tr className="border-b transition-colors"
                          style={{ borderColor: C.muted + "30", backgroundColor: i % 2 === 0 ? C.bg : C.panel }}
                          suppressHydrationWarning
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.03)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>

                          {/* Expand */}
                          <td className="px-3 py-3 cursor-pointer w-8" onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                            {isExpanded ? <ChevronUp className="size-3" style={{ color: C.accent }} /> : <ChevronDown className="size-3" style={{ color: C.dim }} />}
                          </td>

                          {/* Company / Brand */}
                          <td className="px-4 py-3" style={{ borderRight: `1px solid ${C.border}`, minWidth: "180px" }}>
                            <p className="text-[11px] font-bold" style={{ color: C.text }}>{s.company || "—"}</p>
                            {s.supplierBrand && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Star className="size-2.5 shrink-0" style={{ color: C.accent }} />
                                <span className="text-[9px]" style={{ color: C.accent }}>{s.supplierBrand}</span>
                              </div>
                            )}
                          </td>

                          {/* Country */}
                          <td className="px-4 py-3 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                            <span className="text-[10px]" style={{ color: C.dim }}>{s.country || "—"}</span>
                          </td>

                          {/* Address */}
                          <td className="px-4 py-3 max-w-[180px]" style={{ borderRight: `1px solid ${C.border}` }}>
                            {s.address ? (
                              <div className="flex items-start gap-1">
                                <MapPin className="size-3 shrink-0 mt-0.5" style={{ color: C.dim }} />
                                <span className="text-[10px] line-clamp-2" style={{ color: C.dim }}>{s.address}</span>
                              </div>
                            ) : <span style={{ color: C.muted }}>—</span>}
                          </td>

                          {/* Contacts */}
                          <td className="px-4 py-3" style={{ borderRight: `1px solid ${C.border}`, minWidth: "160px" }}>
                            {s.contacts.length === 0 ? <span style={{ color: C.muted }}>—</span> : (
                              <div className="space-y-1">
                                {s.contacts.slice(0, 2).map((c, ci) => (
                                  <div key={ci} className="flex items-center gap-1">
                                    <Phone className="size-2.5 shrink-0" style={{ color: C.dim }} />
                                    <span className="text-[9px] font-mono" style={{ color: C.text }}>{c.phone}</span>
                                    {c.name && <span className="text-[9px]" style={{ color: C.dim }}>· {c.name}</span>}
                                  </div>
                                ))}
                                {s.contacts.length > 2 && (
                                  <span className="text-[8px]" style={{ color: C.muted }}>+{s.contacts.length - 2} more</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Emails */}
                          <td className="px-4 py-3 max-w-[160px]" style={{ borderRight: `1px solid ${C.border}` }}>
                            {s.emails.length === 0 ? <span style={{ color: C.muted }}>—</span> : (
                              <div className="space-y-0.5">
                                {s.emails.slice(0, 2).map((e, ei) => (
                                  <div key={ei} className="flex items-center gap-1">
                                    <Mail className="size-2.5 shrink-0" style={{ color: C.dim }} />
                                    <span className="text-[9px] font-mono truncate" style={{ color: C.dim }}>{e}</span>
                                  </div>
                                ))}
                                {s.emails.length > 2 && <span className="text-[8px]" style={{ color: C.muted }}>+{s.emails.length - 2} more</span>}
                              </div>
                            )}
                          </td>

                          {/* Products */}
                          <td className="px-4 py-3 max-w-[160px]" style={{ borderRight: `1px solid ${C.border}` }}>
                            {s.products.length === 0 ? <span style={{ color: C.muted }}>—</span> : (
                              <div className="flex flex-wrap gap-1">
                                {s.products.slice(0, 3).map((p, pi) => (
                                  <span key={pi} className="text-[8px] px-1.5 py-0.5 border"
                                    style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}>{p}</span>
                                ))}
                                {s.products.length > 3 && <span className="text-[8px]" style={{ color: C.muted }}>+{s.products.length - 3}</span>}
                              </div>
                            )}
                          </td>

                          {/* Certificates */}
                          <td className="px-4 py-3 max-w-[140px]" style={{ borderRight: `1px solid ${C.border}` }}>
                            {s.certificates.length === 0 ? <span style={{ color: C.muted }}>—</span> : (
                              <div className="flex flex-wrap gap-1">
                                {s.certificates.slice(0, 2).map((c, ci) => (
                                  <span key={ci} className="text-[8px] px-1.5 py-0.5 border"
                                    style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "rgba(52,211,153,0.06)" }}>{c}</span>
                                ))}
                                {s.certificates.length > 2 && <span className="text-[8px]" style={{ color: C.muted }}>+{s.certificates.length - 2}</span>}
                              </div>
                            )}
                          </td>

                          {/* Website */}
                          <td className="px-4 py-3" style={{ borderRight: `1px solid ${C.border}` }}>
                            {s.website ? (
                              <a href={s.website.startsWith("http") ? s.website : `https://${s.website}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[9px] transition-colors"
                                style={{ color: "#60a5fa" }}
                                onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                                onMouseLeave={e => (e.currentTarget.style.color = "#60a5fa")}>
                                <Globe className="size-3" /> Visit
                              </a>
                            ) : <span style={{ color: C.muted }}>—</span>}
                          </td>
                          {/* Updated */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-[9px] font-mono" style={{ color: C.muted }}>{formatDate(s.date_updated)}</span>
                          </td>
                        </tr>

                        {/* Expanded — full details */}
                        {isExpanded && (
                          <tr style={{ backgroundColor: "rgba(232,99,10,0.02)" }}>
                            <td colSpan={10} className="px-8 py-4 border-b" style={{ borderColor: C.muted + "30" }}>
                              <div className="grid grid-cols-3 gap-6">
                                {/* All contacts */}
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.accent }}>All Contacts</p>
                                  {s.contacts.length === 0 ? <p className="text-[10px]" style={{ color: C.muted }}>—</p> : (
                                    <div className="space-y-1.5">
                                      {s.contacts.map((c, ci) => (
                                        <div key={ci} className="flex items-center gap-2">
                                          <Phone className="size-3 shrink-0" style={{ color: C.dim }} />
                                          <span className="text-[10px] font-mono" style={{ color: C.text }}>{c.phone}</span>
                                          {c.name && <span className="text-[10px]" style={{ color: C.dim }}>{c.name}</span>}
                                          {c.type && <span className="text-[8px] px-1 border" style={{ borderColor: C.border, color: C.muted }}>{c.type}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* All products + forte */}
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.accent }}>Products</p>
                                  {s.products.length === 0 ? <p className="text-[10px]" style={{ color: C.muted }}>—</p> : (
                                    <div className="flex flex-wrap gap-1">
                                      {s.products.map((p, pi) => (
                                        <span key={pi} className="text-[9px] px-1.5 py-0.5 border"
                                          style={{ borderColor: C.border, color: C.dim }}>{p}</span>
                                      ))}
                                    </div>
                                  )}
                                  {s.forteProducts.length > 0 && (
                                    <>
                                      <p className="text-[9px] font-bold uppercase tracking-widest mt-3 mb-1" style={{ color: "#fbbf24" }}>
                                        <Star className="size-2.5 inline mr-1" />Forte Products
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {s.forteProducts.map((p, pi) => (
                                          <span key={pi} className="text-[9px] px-1.5 py-0.5 border"
                                            style={{ borderColor: "#fbbf2440", color: "#fbbf24", backgroundColor: "rgba(251,191,36,0.06)" }}>{p}</span>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* Certificates + emails */}
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.accent }}>Certificates</p>
                                  {s.certificates.length === 0 ? <p className="text-[10px]" style={{ color: C.muted }}>—</p> : (
                                    <div className="flex flex-wrap gap-1">
                                      {s.certificates.map((c, ci) => (
                                        <span key={ci} className="text-[9px] px-1.5 py-0.5 border"
                                          style={{ borderColor: "#34d39940", color: "#34d399", backgroundColor: "rgba(52,211,153,0.06)" }}>
                                          <Award className="size-2.5 inline mr-1" />{c}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {s.emails.length > 0 && (
                                    <>
                                      <p className="text-[9px] font-bold uppercase tracking-widest mt-3 mb-1" style={{ color: C.accent }}>Emails</p>
                                      <div className="space-y-0.5">
                                        {s.emails.map((e, ei) => (
                                          <div key={ei} className="flex items-center gap-1">
                                            <Mail className="size-2.5 shrink-0" style={{ color: C.dim }} />
                                            <a href={`mailto:${e}`} className="text-[9px] font-mono hover:underline" style={{ color: "#60a5fa" }}>{e}</a>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
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
    </ProtectedPageWrapper>
  );
}
