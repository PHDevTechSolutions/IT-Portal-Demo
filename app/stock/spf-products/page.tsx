"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, Package,
  ChevronDown, ChevronUp, ExternalLink, Building2,
  Tag, Globe, Image as ImageIcon, FileText,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import type { SPFProduct, TechSpec } from "@/app/api/stock/spf-products/route";

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

// ─── Product Detail Dialog ────────────────────────────────────────────────────
function ProductDialog({ product, onClose }: { product: SPFProduct; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "specs" | "drawings">("overview");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-4xl border flex flex-col"
        style={{ backgroundColor: C.panel, borderColor: C.border, fontFamily: C.font, maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <div className="flex items-start gap-4">
            {product.mainImageUrl ? (
              <img src={product.mainImageUrl} alt={product.productName}
                className="h-16 w-16 object-contain border shrink-0"
                style={{ borderColor: C.border, backgroundColor: C.bg }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="h-16 w-16 flex items-center justify-center border shrink-0"
                style={{ borderColor: C.border, backgroundColor: C.bg }}>
                <ImageIcon className="size-6 opacity-20" style={{ color: C.dim }} />
              </div>
            )}
            <div>
              <p className="text-[13px] font-bold" style={{ color: C.accent }}>{product.productName || "—"}</p>
              <p className="text-[10px] font-mono mt-0.5" style={{ color: C.muted }}>{product.productReferenceID}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {product.productClass && (
                  <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                    style={{ borderColor: "#60a5fa40", color: "#60a5fa", backgroundColor: "rgba(96,165,250,0.08)" }}>
                    {product.productClass}
                  </span>
                )}
                {product.pricePoint && (
                  <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 border"
                    style={{ borderColor: "#fbbf2440", color: "#fbbf24", backgroundColor: "rgba(251,191,36,0.08)" }}>
                    {product.pricePoint}
                  </span>
                )}
                {product.brandOrigin && (
                  <span className="text-[8px] uppercase px-1.5 py-0.5 border"
                    style={{ borderColor: C.border, color: C.dim }}>
                    {product.brandOrigin}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose}><X className="size-5" style={{ color: C.dim }} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0" style={{ borderColor: C.border, backgroundColor: C.bg }}>
          {(["overview", "specs", "drawings"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-colors"
              style={{
                borderBottomColor: activeTab === tab ? C.accent : "transparent",
                color:             activeTab === tab ? C.accent : C.dim,
                backgroundColor:   "transparent",
              }}>
              {tab === "overview" ? "Overview" : tab === "specs" ? "Technical Specs" : "Drawings"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* Supplier */}
              {product.supplier && (
                <div className="border p-4" style={{ borderColor: C.border }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.accent }}>Supplier</p>
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4" style={{ color: C.dim }} />
                    <div>
                      <p className="text-[11px] font-bold" style={{ color: C.text }}>{product.supplier.company}</p>
                      <p className="text-[9px]" style={{ color: C.dim }}>{product.supplier.supplierBrand}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Product Families */}
              {product.productFamilies.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.accent }}>Product Families</p>
                  <div className="flex flex-wrap gap-2">
                    {product.productFamilies.map((f, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 border"
                        style={{ borderColor: C.border, color: C.text, backgroundColor: C.bg }}>
                        {f.productFamilyName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Types */}
              {product.categoryTypes.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.accent }}>Categories</p>
                  <div className="flex flex-wrap gap-1">
                    {product.categoryTypes.map((c, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 border"
                        style={{ borderColor: C.border, color: C.dim }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Countries */}
              {product.countries.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.accent }}>Countries</p>
                  <div className="flex flex-wrap gap-1">
                    {product.countries.map((c, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 border"
                        style={{ borderColor: C.border, color: C.dim }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Commercial Details */}
              {product.commercialDetails.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.accent }}>Commercial Details</p>
                  <div className="space-y-1">
                    {product.commercialDetails.map((cd: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 border"
                        style={{ borderColor: C.border, backgroundColor: C.bg }}>
                        <span className="text-[10px]" style={{ color: C.dim }}>{cd.label ?? cd.key ?? JSON.stringify(cd)}</span>
                        <span className="text-[10px] font-bold" style={{ color: C.text }}>{cd.value ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Technical Specs ── */}
          {activeTab === "specs" && (
            <div className="space-y-4">
              {product.technicalSpecifications.length === 0 ? (
                <p className="text-[11px]" style={{ color: C.muted }}>No technical specifications available.</p>
              ) : product.technicalSpecifications.map((spec: TechSpec, si: number) => (
                <div key={si} className="border" style={{ borderColor: C.border }}>
                  <div className="px-4 py-2.5 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>{spec.title}</p>
                  </div>
                  <table className="w-full border-collapse">
                    <tbody>
                      {spec.specs.filter(s => s.value || s.specId).map((s, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.muted}30`, backgroundColor: i % 2 === 0 ? C.bg : C.panel }}>
                          <td className="px-4 py-2 text-[10px] w-1/2" style={{ color: C.dim, borderRight: `1px solid ${C.border}` }}>
                            {s.specId || "—"}
                          </td>
                          <td className="px-4 py-2 text-[10px] font-bold" style={{ color: s.value ? C.text : C.muted }}>
                            {s.value || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* ── Drawings ── */}
          {activeTab === "drawings" && (
            <div className="space-y-6">
              {[
                { label: "Dimensional Drawing", url: product.dimensionalDrawing },
                { label: "Illuminance Drawing",  url: product.illuminanceDrawing },
              ].map(({ label, url }) => (
                <div key={label}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: C.accent }}>{label}</p>
                  {url ? (
                    <div className="border p-2" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                      <img src={url} alt={label} className="max-w-full max-h-80 object-contain mx-auto"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <div className="flex justify-end mt-2">
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[9px] transition-colors"
                          style={{ color: "#60a5fa" }}>
                          <ExternalLink className="size-3" /> Open full size
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px]" style={{ color: C.muted }}>No drawing available.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SPFProductsPage() {
  const router = useRouter();

  const [products,     setProducts]     = useState<SPFProduct[]>([]);
  const [filtered,     setFiltered]     = useState<SPFProduct[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [search,       setSearch]       = useState("");
  const [classFilter,  setClassFilter]  = useState("");
  const [priceFilter,  setPriceFilter]  = useState("");
  const [page,         setPage]         = useState(1);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [dialogProduct,setDialogProduct]= useState<SPFProduct | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/stock/spf-products", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setProducts(json.data ?? []);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    let r = [...products];
    if (classFilter) r = r.filter(p => p.productClass.toLowerCase() === classFilter.toLowerCase());
    if (priceFilter) r = r.filter(p => p.pricePoint.toLowerCase() === priceFilter.toLowerCase());
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(p =>
        p.productName.toLowerCase().includes(q) ||
        p.productReferenceID.toLowerCase().includes(q) ||
        p.brandOrigin.toLowerCase().includes(q) ||
        p.supplier?.company.toLowerCase().includes(q) ||
        p.productFamilies.some(f => f.productFamilyName.toLowerCase().includes(q))
      );
    }
    setFiltered(r); setPage(1);
  }, [products, search, classFilter, priceFilter]);

  const allClasses = [...new Set(products.map(p => p.productClass).filter(Boolean))].sort();
  const allPrices  = [...new Set(products.map(p => p.pricePoint).filter(Boolean))].sort();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
                  <BreadcrumbLink href="/stock/suppliers" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>Stock</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>SPF Products</BreadcrumbPage>
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
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>SPF Products</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Firebase · products · {products.length} total
              </p>
            </div>
            <div className="ml-auto">
              <button onClick={fetchProducts}
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
              <input placeholder="Search product name, ref ID, supplier…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-3" style={{ color: C.dim }} /></button>}
            </div>
            <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: classFilter ? C.text : C.dim, fontFamily: C.font }}>
              <option value="">All Classes</option>
              {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={priceFilter} onChange={e => setPriceFilter(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: priceFilter ? C.text : C.dim, fontFamily: C.font }}>
              <option value="">All Price Points</option>
              {allPrices.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {(classFilter || priceFilter) && (
              <button onClick={() => { setClassFilter(""); setPriceFilter(""); }}
                className="flex items-center gap-1 h-8 px-2 text-[10px] transition-colors" style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                <X className="size-3" /> Clear
              </button>
            )}
            <div className="ml-auto text-[10px]" style={{ color: C.muted }}>
              <span style={{ color: C.text }}>{filtered.length}</span> products
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
                <p className="text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>No products found</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                    {["", "Image", "Product Name", "Ref ID", "Class", "Price Point", "Brand Origin", "Supplier", "Families", "Updated"].map((h, i) => (
                      <th key={i} className="text-left px-4 py-2.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-widest"
                        style={{ color: C.accent, borderRight: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p, i) => {
                    const isExpanded = expandedId === p.id;
                    return (
                      <React.Fragment key={p.id}>
                        <tr className="border-b transition-colors"
                          style={{ borderColor: C.muted + "30", backgroundColor: i % 2 === 0 ? C.bg : C.panel }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.03)")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>

                          {/* Expand */}
                          <td className="px-3 py-2.5 cursor-pointer w-8" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                            {isExpanded ? <ChevronUp className="size-3" style={{ color: C.accent }} /> : <ChevronDown className="size-3" style={{ color: C.dim }} />}
                          </td>

                          {/* Image */}
                          <td className="px-3 py-2.5" style={{ borderRight: `1px solid ${C.border}`, width: "56px" }}>
                            {p.mainImageUrl ? (
                              <img src={p.mainImageUrl} alt={p.productName}
                                className="h-10 w-10 object-contain border cursor-pointer"
                                style={{ borderColor: C.border }}
                                onClick={() => setDialogProduct(p)}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="h-10 w-10 flex items-center justify-center border"
                                style={{ borderColor: C.border }}>
                                <ImageIcon className="size-4 opacity-20" style={{ color: C.dim }} />
                              </div>
                            )}
                          </td>

                          {/* Product Name */}
                          <td className="px-4 py-2.5" style={{ borderRight: `1px solid ${C.border}`, minWidth: "200px" }}>
                            <button onClick={() => setDialogProduct(p)}
                              className="text-left text-[11px] font-bold hover:underline"
                              style={{ color: C.accent }}>
                              {p.productName || "—"}
                            </button>
                          </td>

                          {/* Ref ID */}
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                            <span className="text-[10px] font-mono" style={{ color: C.muted }}>{p.productReferenceID || "—"}</span>
                          </td>

                          {/* Class */}
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                            {p.productClass ? (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 border"
                                style={{ borderColor: "#60a5fa40", color: "#60a5fa", backgroundColor: "rgba(96,165,250,0.08)" }}>
                                {p.productClass}
                              </span>
                            ) : <span style={{ color: C.muted }}>—</span>}
                          </td>

                          {/* Price Point */}
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                            {p.pricePoint ? (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 border"
                                style={{ borderColor: "#fbbf2440", color: "#fbbf24", backgroundColor: "rgba(251,191,36,0.08)" }}>
                                {p.pricePoint}
                              </span>
                            ) : <span style={{ color: C.muted }}>—</span>}
                          </td>

                          {/* Brand Origin */}
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                            <span className="text-[10px]" style={{ color: C.dim }}>{p.brandOrigin || "—"}</span>
                          </td>

                          {/* Supplier */}
                          <td className="px-4 py-2.5 max-w-[140px]" style={{ borderRight: `1px solid ${C.border}` }}>
                            {p.supplier ? (
                              <div>
                                <p className="text-[10px] font-bold truncate" style={{ color: C.text }}>{p.supplier.company}</p>
                                <p className="text-[9px] truncate" style={{ color: C.dim }}>{p.supplier.supplierBrand}</p>
                              </div>
                            ) : <span style={{ color: C.muted }}>—</span>}
                          </td>

                          {/* Families */}
                          <td className="px-4 py-2.5 max-w-[160px]" style={{ borderRight: `1px solid ${C.border}` }}>
                            {p.productFamilies.length === 0 ? <span style={{ color: C.muted }}>—</span> : (
                              <div className="flex flex-wrap gap-1">
                                {p.productFamilies.slice(0, 2).map((f, fi) => (
                                  <span key={fi} className="text-[8px] px-1.5 py-0.5 border"
                                    style={{ borderColor: C.border, color: C.dim }}>{f.productFamilyName}</span>
                                ))}
                                {p.productFamilies.length > 2 && <span className="text-[8px]" style={{ color: C.muted }}>+{p.productFamilies.length - 2}</span>}
                              </div>
                            )}
                          </td>

                          {/* Updated */}
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="text-[9px] font-mono" style={{ color: C.muted }}>{formatDate(p.date_updated)}</span>
                          </td>
                        </tr>

                        {/* Expanded — quick specs preview */}
                        {isExpanded && (
                          <tr style={{ backgroundColor: "rgba(232,99,10,0.02)" }}>
                            <td colSpan={10} className="px-8 py-4 border-b" style={{ borderColor: C.muted + "30" }}>
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                                  Quick Specs Preview
                                </p>
                                <button onClick={() => setDialogProduct(p)}
                                  className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors"
                                  style={{ color: "#60a5fa" }}
                                  onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                                  onMouseLeave={e => (e.currentTarget.style.color = "#60a5fa")}>
                                  <FileText className="size-3" /> View Full Details
                                </button>
                              </div>
                              {p.technicalSpecifications.length === 0 ? (
                                <p className="text-[10px]" style={{ color: C.muted }}>No specs available — click View Full Details</p>
                              ) : (
                                <div className="grid grid-cols-2 gap-4">
                                  {p.technicalSpecifications.slice(0, 2).map((spec, si) => (
                                    <div key={si}>
                                      <p className="text-[9px] font-bold uppercase mb-1" style={{ color: C.dim }}>{spec.title}</p>
                                      <div className="space-y-0.5">
                                        {spec.specs.filter(s => s.value).slice(0, 5).map((s, i) => (
                                          <div key={i} className="flex items-center justify-between">
                                            <span className="text-[9px]" style={{ color: C.muted }}>{s.specId}</span>
                                            <span className="text-[9px] font-bold" style={{ color: C.text }}>{s.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
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

      {/* ── Product Detail Dialog ── */}
      {dialogProduct && (
        <ProductDialog product={dialogProduct} onClose={() => setDialogProduct(null)} />
      )}
    </ProtectedPageWrapper>
  );
}
