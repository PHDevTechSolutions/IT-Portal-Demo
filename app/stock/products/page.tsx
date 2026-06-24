"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import {
  Loader2, Search, X, RefreshCw, Package,
  ChevronDown, ChevronUp, Eye, Edit, Trash2, Save,
} from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

const C = {
  bg:     "#080d12",
  panel:  "#0d1117",
  border: "#1a2535",
  muted:  "#253040",
  dim:    "#4a6070",
  text:   "#c8d8e8",
  accent: "#e8630a",
  danger: "#ef4444",
  font:   "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

function formatValue(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

function formatInputValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

const PAGE_SIZE = 10;

function ProductDetailDialog({ product, onClose }: { product: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-4xl border flex flex-col"
        style={{ backgroundColor: C.panel, borderColor: C.border, fontFamily: C.font, maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <div>
            <p className="text-[13px] font-bold" style={{ color: C.accent }}>Product Details</p>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: C.muted }}>{product.id}</p>
          </div>
          <button onClick={onClose}><X className="size-5" style={{ color: C.dim }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            {Object.entries(product).map(([key, value]) => (
              <div key={key} className="border" style={{ borderColor: C.border }}>
                <div className="px-4 py-2.5 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.accent }}>{key}</p>
                </div>
                <div className="px-4 py-3">
                  <pre className="text-[10px] whitespace-pre-wrap overflow-x-auto" style={{ color: C.text, fontFamily: C.font }}>
                    {formatValue(value)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductEditDialog({ 
  product, 
  fields, 
  onClose, 
  onSave 
}: { 
  product: any; 
  fields: string[]; 
  onClose: () => void; 
  onSave: (data: any) => void; 
}) {
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Initialize edit data
    const initialData: any = {};
    fields.forEach(field => {
      if (field !== "id") {
        initialData[field] = product[field];
      }
    });
    setEditData(initialData);
  }, [product, fields]);

  const handleChange = (field: string, value: string) => {
    setEditData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Parse JSON strings to objects
      const parsedData: any = {};
      Object.entries(editData).forEach(([key, value]) => {
        if (typeof value === "string") {
          try {
            parsedData[key] = JSON.parse(value);
          } catch {
            parsedData[key] = value;
          }
        } else {
          parsedData[key] = value;
        }
      });

      await onSave(parsedData);
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl border flex flex-col"
        style={{ backgroundColor: C.panel, borderColor: C.border, fontFamily: C.font, maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <div>
            <p className="text-[13px] font-bold" style={{ color: C.accent }}>Edit Product</p>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: C.muted }}>{product.id}</p>
          </div>
          <button onClick={onClose}><X className="size-5" style={{ color: C.dim }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            {fields.filter(f => f !== "id").map(field => (
              <div key={field} className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>
                  {field}
                </label>
                <textarea
                  value={formatInputValue(editData[field])}
                  onChange={(e) => handleChange(field, e.target.value)}
                  className="w-full px-3 py-2 text-[11px] focus:outline-none resize-y min-h-[60px]"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                  onFocus={(e) => (e.target.style.borderColor = C.accent)}
                  onBlur={(e) => (e.target.style.borderColor = C.border)}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <button onClick={onClose}
            className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
            style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.muted; e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-50"
            style={{ borderColor: C.accent, color: C.accent, backgroundColor: "rgba(232,99,10,0.1)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.1)"; }}>
            {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({ 
  product, 
  onClose, 
  onDelete 
}: { 
  product: any; 
  onClose: () => void; 
  onDelete: () => void; 
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md border"
        style={{ backgroundColor: C.panel, borderColor: C.border, fontFamily: C.font }}>
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <p className="text-[13px] font-bold" style={{ color: C.danger }}>Delete Product</p>
          <button onClick={onClose}><X className="size-5" style={{ color: C.dim }} /></button>
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px]" style={{ color: C.text }}>
            Are you sure you want to delete this product? This action cannot be undone.
          </p>
          <p className="text-[10px] font-mono mt-2" style={{ color: C.muted }}>
            ID: {product.id}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <button onClick={onClose}
            className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
            style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.muted; e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-50"
            style={{ borderColor: C.danger, color: C.danger, backgroundColor: "rgba(239,68,68,0.1)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)"; }}>
            {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AllProductsPage() {
  const router = useRouter();

  const [products,    setProducts]    = useState<any[]>([]);
  const [filtered,    setFiltered]    = useState<any[]>([]);
  const [fields,      setFields]      = useState<string[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [search,      setSearch]      = useState("");
  const [page,        setPage]        = useState(1);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [dialogProduct, setDialogProduct] = useState<any | null>(null);
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<any | null>(null);
  const [visibleFields, setVisibleFields] = useState<string[]>([]);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/stock/products", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setProducts(json.data ?? []);
      setFields(json.fields ?? []);
      setVisibleFields(json.fields ?? []);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    let r = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(p => 
        Object.values(p).some(val => 
          String(val).toLowerCase().includes(q)
        )
      );
    }
    setFiltered(r); setPage(1);
  }, [products, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleField = (field: string) => {
    setVisibleFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field) 
        : [...prev, field]
    );
  };

  const handleEdit = async (data: any) => {
    if (!editProduct) return;
    
    const res = await fetch("/api/stock/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editProduct.id, data }),
    });
    const json = await res.json();
    
    if (!json.success) throw new Error(json.error);
    
    toast.success("Product updated successfully");
    fetchProducts();
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;
    
    const res = await fetch(`/api/stock/products?id=${encodeURIComponent(deleteProduct.id)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    
    if (!json.success) throw new Error(json.error);
    
    toast.success("Product deleted successfully");
    fetchProducts();
  };

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col h-svh overflow-hidden bg-[#080d12]" style={{ fontFamily: C.font, color: C.text }}>
          <div className="fixed inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`,
            backgroundSize: "24px 24px", opacity: 0.15, zIndex: 0,
          }} />

          {/* Header */}
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
                  <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>All Products</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Firebase</span>
            </div>
          </header>

          {/* Title bar */}
          <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: C.border, backgroundColor: C.panel }}>
            <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <Package className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>All Products</h1>
              <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Firebase · products · {products.length} total · {fields.length} fields
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <button onClick={() => setExpandedId(expandedId ? null : "fields")}
                  className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                  style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                  {expandedId === "fields" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />} Fields
                </button>
                {expandedId === "fields" && (
                  <div className="absolute right-0 top-full mt-1 w-64 max-h-64 overflow-y-auto border z-20"
                    style={{ backgroundColor: C.panel, borderColor: C.border }}>
                    {fields.map(field => (
                      <label key={field} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-orange-500/5"
                        style={{ borderBottom: `1px solid ${C.muted}30` }}>
                        <input
                          type="checkbox"
                          checked={visibleFields.includes(field)}
                          onChange={() => toggleField(field)}
                          className="w-3 h-3"
                        />
                        <span className="text-[10px]" style={{ color: C.text }}>{field}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={fetchProducts}
                className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
                <RefreshCw className="size-3" /> Refresh
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="relative z-10 shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
              <input placeholder="Search all fields…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)} />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-3" style={{ color: C.dim }} /></button>}
            </div>
            <div className="ml-auto text-[10px]" style={{ color: C.muted }}>
              <span style={{ color: C.text }}>{filtered.length}</span> products
            </div>
          </div>

          {/* Table */}
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
                    <th className="text-left px-4 py-2.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: C.accent, borderRight: `1px solid ${C.border}` }}>Actions</th>
                    {visibleFields.map(field => (
                      <th key={field} className="text-left px-4 py-2.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-widest"
                        style={{ color: C.accent, borderRight: `1px solid ${C.border}` }}>{field}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p, i) => (
                    <tr key={p.id} className="border-b transition-colors"
                      style={{ borderColor: C.muted + "30", backgroundColor: i % 2 === 0 ? C.bg : C.panel }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.03)")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}>
                      <td className="px-3 py-2.5" style={{ borderRight: `1px solid ${C.border}` }}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setDialogProduct(p)}
                            className="flex items-center gap-1 text-[10px] transition-colors"
                            style={{ color: "#60a5fa" }}
                            onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                            onMouseLeave={e => (e.currentTarget.style.color = "#60a5fa")}>
                            <Eye className="size-3" /> View
                          </button>
                          <button onClick={() => setEditProduct(p)}
                            className="flex items-center gap-1 text-[10px] transition-colors"
                            style={{ color: C.muted }}
                            onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                            onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
                            <Edit className="size-3" /> Edit
                          </button>
                          <button onClick={() => setDeleteProduct(p)}
                            className="flex items-center gap-1 text-[10px] transition-colors"
                            style={{ color: C.muted }}
                            onMouseEnter={e => (e.currentTarget.style.color = C.danger)}
                            onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
                            <Trash2 className="size-3" /> Delete
                          </button>
                        </div>
                      </td>
                      {visibleFields.map(field => (
                        <td key={field} className="px-4 py-2.5" style={{ borderRight: `1px solid ${C.border}` }}>
                          <div className="max-w-xs max-h-20 overflow-hidden text-[10px]" style={{ color: C.text }} title={formatValue(p[field])}>
                            {typeof p[field] === "object" ? (
                              <span style={{ color: C.dim }}>[Object]</span>
                            ) : (
                              String(p[field] ?? "—")
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
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

      {dialogProduct && (
        <ProductDetailDialog product={dialogProduct} onClose={() => setDialogProduct(null)} />
      )}

      {editProduct && (
        <ProductEditDialog 
          product={editProduct} 
          fields={fields}
          onClose={() => setEditProduct(null)} 
          onSave={handleEdit} 
        />
      )}

      {deleteProduct && (
        <DeleteConfirmDialog 
          product={deleteProduct} 
          onClose={() => setDeleteProduct(null)} 
          onDelete={handleDelete} 
        />
      )}
    </ProtectedPageWrapper>
  );
}
