"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
    Loader2, Search, RefreshCw, Download, Package,
    ChevronLeft, ChevronRight, X, Pencil, Trash2, Eye,
} from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/utils/supabase-it"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
    id: string
    referenceid: string
    asset_tag: string
    asset_type: string
    status: string
    location: string
    new_user: string
    old_user: string
    department: string
    position: string
    brand: string
    model: string
    processor: string
    ram: string
    storage: string
    serial_number: string
    purchase_date: string
    warranty_date: string
    asset_age: string
    amount: string
    remarks: string
    mac_address: string
    date_created: string
    date_updated: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 15

const STATUS_STYLES: Record<string, string> = {
    active:      "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    inactive:    "bg-slate-500/15 text-slate-400 border border-slate-500/30",
    deployed:    "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    maintenance: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    retired:     "bg-red-500/15 text-red-400 border border-red-500/30",
    available:   "bg-teal-500/15 text-teal-400 border border-teal-500/30",
}

function getStatusClass(val: string | null) {
    if (!val) return "bg-slate-500/10 text-slate-500 border border-slate-500/20"
    return STATUS_STYLES[val.toLowerCase()] ?? "bg-slate-500/10 text-slate-500 border border-slate-500/20"
}

function cell(val: string | null | undefined, dim: string) {
    return val || <span style={{ color: dim }}>—</span>
}

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
}

// ─── Field row for detail modal ───────────────────────────────────────────────

function FieldRow({
    label, fieldKey, isEditing, value, onChange,
}: {
    label: string
    fieldKey: keyof Activity
    isEditing: boolean
    value: string
    onChange: (k: keyof Activity, v: string) => void
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim }}>
                {label}
            </label>
            {isEditing ? (
                <input
                    value={value}
                    onChange={(e) => onChange(fieldKey, e.target.value)}
                    style={{
                        backgroundColor: C.bg, border: `1px solid ${C.border}`,
                        color: C.text, fontSize: "11px", padding: "5px 8px",
                        fontFamily: C.font, outline: "none",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                />
            ) : (
                <span style={{ fontSize: "11px", color: value ? C.text : C.muted }}>
                    {value || "—"}
                </span>
            )}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [activities, setActivities] = useState<Activity[]>([])
    const [isFetching, setIsFetching] = useState(false)
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState<Partial<Activity>>({})
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchActivities = async (silent = false) => {
        if (!silent) setIsFetching(true)
        const { data, error } = await supabase
            .from("inventory")
            .select("*")
            .order("date_updated", { ascending: false })
        if (error) {
            toast.error(`Error fetching inventory: ${error.message}`)
            setActivities([])
        } else {
            setActivities(data || [])
        }
        setIsFetching(false)
    }

    useEffect(() => { fetchActivities() }, [])

    useEffect(() => {
        if (selectedActivity) { setFormData(selectedActivity); setIsEditing(false) }
    }, [selectedActivity])

    // ── Filter ─────────────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        if (!search.trim()) return activities
        const q = search.toLowerCase()
        return activities.filter((a) =>
            [a.referenceid, a.asset_tag, a.asset_type, a.new_user, a.department, a.location, a.brand, a.model]
                .some((f) => f?.toLowerCase().includes(q))
        )
    }, [activities, search])

    const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE))
    const paginated = useMemo(() => {
        const start = (page - 1) * ROWS_PER_PAGE
        return filtered.slice(start, start + ROWS_PER_PAGE)
    }, [filtered, page])

    useEffect(() => { setPage(1) }, [search])

    // ── Stats ──────────────────────────────────────────────────────────────────
    const stats = useMemo(() => ({
        total:       activities.length,
        deployed:    activities.filter(a => a.status?.toLowerCase() === "deployed").length,
        available:   activities.filter(a => a.status?.toLowerCase() === "available").length,
        maintenance: activities.filter(a => a.status?.toLowerCase() === "maintenance").length,
        retired:     activities.filter(a => a.status?.toLowerCase() === "retired").length,
    }), [activities])

    // ── Select ─────────────────────────────────────────────────────────────────
    const toggleSelect = (id: string) =>
        setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])

    const toggleSelectAll = () => {
        const ids = paginated.map((a) => a.id)
        const allSelected = ids.every((id) => selectedIds.includes(id))
        setSelectedIds(allSelected
            ? selectedIds.filter((id) => !ids.includes(id))
            : [...new Set([...selectedIds, ...ids])])
    }

    // ── Edit / Delete ──────────────────────────────────────────────────────────
    const handleChange = (key: keyof Activity, value: string) =>
        setFormData((p) => ({ ...p, [key]: value }))

    const handleUpdate = async () => {
        if (!selectedActivity?.id) return
        setIsSaving(true)
        const { error } = await supabase.from("inventory").update(formData).eq("id", selectedActivity.id)
        if (error) { toast.error("Failed to update record"); setIsSaving(false); return }
        toast.success("Record updated successfully")
        await fetchActivities(true)
        setIsEditing(false)
        setSelectedActivity(null)
        setIsSaving(false)
    }

    const handleBulkDelete = async () => {
        if (!selectedIds.length) return
        const { error } = await supabase.from("inventory").delete().in("id", selectedIds)
        if (error) { toast.error("Failed to delete selected records"); return }
        toast.success(`${selectedIds.length} record(s) deleted`)
        setSelectedIds([])
        setShowDeleteConfirm(false)
        fetchActivities(true)
    }

    // ── Export ─────────────────────────────────────────────────────────────────
    const handleExport = () => {
        const headers = ["Reference ID","Asset Tag","Type","Status","Location","New User","Old User","Department","Position","Brand","Model","Processor","RAM","Storage","Serial No","Purchase Date","Warranty Date","Age","Amount","Remarks","MAC Address","Date Created","Date Updated"]
        const rows = filtered.map(a => [
            a.referenceid, a.asset_tag, a.asset_type, a.status, a.location,
            a.new_user, a.old_user, a.department, a.position, a.brand, a.model,
            a.processor, a.ram, a.storage, a.serial_number, a.purchase_date,
            a.warranty_date, a.asset_age, a.amount, a.remarks, a.mac_address,
            a.date_created, a.date_updated,
        ].map(v => `"${(v ?? "").replace(/"/g, '""')}"`).join(","))
        const csv = [headers.join(","), ...rows].join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a"); a.href = url
        a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`
        a.click(); URL.revokeObjectURL(url)
        toast.success("Exported successfully.")
    }

    return (
        <ProtectedPageWrapper>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset
                    className="flex flex-col h-svh overflow-hidden"
                    style={{ backgroundColor: C.bg, fontFamily: C.font, color: C.text }}
                >
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
                            style={{ color: C.dim }}>
                            Home
                        </Button>
                        <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: C.border }} />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: C.dim }}>
                                        Stash
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden sm:block" style={{ color: C.muted }} />
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.accent }}>
                                        Inventory
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                        <div className="ml-auto flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: C.dim }}>Live</span>
                        </div>
                    </header>

                    {/* ── Title bar ── */}
                    <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b"
                        style={{ borderColor: C.border, backgroundColor: C.panel }}>
                        <div className="flex h-8 w-8 items-center justify-center border"
                            style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
                            <Package className="size-4" style={{ color: C.accent }} />
                        </div>
                        <div>
                            <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>Inventory</h1>
                            <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                                IT Asset Inventory Management
                            </p>
                        </div>
                        <div className="ml-auto">
                            <span className="text-[10px]" style={{ color: C.muted }}>$ inventory --list</span>
                        </div>
                    </div>

                    {/* ── Stats bar ── */}
                    <div className="relative z-10 shrink-0 grid grid-cols-5 border-b" style={{ borderColor: C.border }}>
                        {[
                            { label: "Total",       value: stats.total,       color: C.text },
                            { label: "Deployed",    value: stats.deployed,    color: "#60a5fa" },
                            { label: "Available",   value: stats.available,   color: "#34d399" },
                            { label: "Maintenance", value: stats.maintenance, color: "#fbbf24" },
                            { label: "Retired",     value: stats.retired,     color: "#f87171" },
                        ].map((s, i) => (
                            <div key={i} className="flex flex-col items-center justify-center py-3 border-r last:border-r-0"
                                style={{ borderColor: C.border, backgroundColor: C.panel }}>
                                <span className="text-lg font-bold leading-none" style={{ color: s.color }}>{s.value}</span>
                                <span className="text-[9px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>{s.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── Toolbar ── */}
                    <div className="relative z-10 shrink-0 flex items-center gap-2 px-4 py-2 border-b flex-wrap"
                        style={{ borderColor: C.border, backgroundColor: C.bg }}>
                        <div className="relative flex-1 min-w-[180px] max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
                            <Input
                                placeholder="Search inventory…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8 h-8 text-[11px] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                style={{ backgroundColor: C.panel, borderColor: C.border, color: C.text }}
                                onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                                onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                            />
                            {search && (
                                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <X className="size-3" style={{ color: C.dim }} />
                                </button>
                            )}
                        </div>

                        <div className="flex-1" />

                        {selectedIds.length > 0 && (
                            <button onClick={() => setShowDeleteConfirm(true)}
                                className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                                style={{ backgroundColor: "rgba(239,68,68,0.1)", borderColor: "#ef4444", color: "#f87171" }}>
                                <Trash2 className="size-3" /> Delete ({selectedIds.length})
                            </button>
                        )}
                        <button onClick={() => fetchActivities(true)}
                            className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                            style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                            <RefreshCw className="size-3" /> Refresh
                        </button>
                        <button onClick={handleExport}
                            className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                            style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                            <Download className="size-3" /> Export
                        </button>
                    </div>

                    {/* ── Table ── */}
                    <div className="relative z-10 flex-1 overflow-auto">
                        {isFetching ? (
                            <div className="flex items-center justify-center h-full gap-3">
                                <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} />
                                <span className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>Loading inventory…</span>
                            </div>
                        ) : (
                            <table className="w-full border-collapse" style={{ fontSize: "11px", fontFamily: C.font }}>
                                <thead className="sticky top-0 z-10">
                                    <tr style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.border}` }}>
                                        {/* Checkbox */}
                                        <th className="px-3 py-2.5" style={{ borderRight: `1px solid ${C.border}`, width: "36px" }}>
                                            <input type="checkbox"
                                                checked={paginated.length > 0 && paginated.every((a) => selectedIds.includes(a.id))}
                                                onChange={toggleSelectAll}
                                                style={{ accentColor: C.accent, cursor: "pointer" }}
                                            />
                                        </th>
                                        {["Reference ID","Asset Tag","Type","Location","New User","Old User","Department","Status","Actions"].map((h) => (
                                            <th key={h} className="text-left px-3 py-2.5 whitespace-nowrap font-bold uppercase tracking-widest"
                                                style={{ color: C.accent, fontSize: "9px", borderRight: `1px solid ${C.border}` }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="text-center py-16" style={{ color: C.muted, fontSize: "11px" }}>
                                                {search ? "No records match your search." : "No inventory records found."}
                                            </td>
                                        </tr>
                                    ) : paginated.map((act, i) => (
                                        <tr key={act.id}
                                            style={{ backgroundColor: i % 2 === 0 ? C.bg : C.panel, borderBottom: `1px solid ${C.border}` }}
                                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.04)")}
                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? C.bg : C.panel)}
                                        >
                                            <td className="px-3 py-2" style={{ borderRight: `1px solid ${C.border}` }}>
                                                <input type="checkbox" checked={selectedIds.includes(act.id)}
                                                    onChange={() => toggleSelect(act.id)}
                                                    style={{ accentColor: C.accent, cursor: "pointer" }} />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap font-bold" style={{ borderRight: `1px solid ${C.border}`, color: C.accent }}>{cell(act.referenceid, C.muted)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.text }}>{cell(act.asset_tag, C.muted)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(act.asset_type, C.muted)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(act.location, C.muted)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.text }}>{cell(act.new_user, C.muted)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(act.old_user, C.muted)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}`, color: C.dim }}>{cell(act.department, C.muted)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap" style={{ borderRight: `1px solid ${C.border}` }}>
                                                {act.status ? (
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getStatusClass(act.status)}`}>
                                                        {act.status}
                                                    </span>
                                                ) : <span style={{ color: C.muted }}>—</span>}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <button onClick={() => setSelectedActivity(act)}
                                                    className="flex items-center gap-1 h-6 px-2 text-[9px] font-bold uppercase tracking-wider border transition-colors"
                                                    style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                                                    <Eye className="size-3" /> View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* ── Pagination ── */}
                    <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-2 border-t"
                        style={{ borderColor: C.border, backgroundColor: C.panel }}>
                        <span className="text-[10px]" style={{ color: C.muted }}>
                            Showing{" "}
                            <span style={{ color: C.text }}>
                                {filtered.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, filtered.length)}
                            </span>
                            {" "}of <span style={{ color: C.text }}>{filtered.length}</span> records
                        </span>
                        <div className="flex items-center gap-1" style={{ fontSize: "11px" }}>
                            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                                className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                                style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                                onMouseEnter={(e) => { if (page > 1) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                                <ChevronLeft className="size-3" /> Prev
                            </button>
                            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                let p: number
                                if (totalPages <= 7) { p = i + 1 }
                                else if (page <= 4) { p = i + 1 }
                                else if (page >= totalPages - 3) { p = totalPages - 6 + i }
                                else { p = page - 3 + i }
                                return (
                                    <button key={p} onClick={() => setPage(p)}
                                        className="h-7 w-7 border text-[10px] font-bold transition-colors"
                                        style={{
                                            backgroundColor: p === page ? C.accent : "transparent",
                                            borderColor: p === page ? C.accent : C.border,
                                            color: p === page ? "#080d12" : C.dim,
                                        }}>
                                        {p}
                                    </button>
                                )
                            })}
                            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="flex items-center gap-1 h-7 px-2 border transition-colors disabled:opacity-30"
                                style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                                onMouseEnter={(e) => { if (page < totalPages) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                                Next <ChevronRight className="size-3" />
                            </button>
                        </div>
                    </div>

                    {/* ── Detail / Edit Modal ── */}
                    <Dialog open={!!selectedActivity} onOpenChange={(open) => { if (!open) setSelectedActivity(null) }}>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto border"
                            style={{ backgroundColor: C.panel, borderColor: C.border, fontFamily: C.font, color: C.text }}>
                            <DialogHeader className="border-b pb-3" style={{ borderColor: C.border }}>
                                <div className="flex items-center gap-2">
                                    <span style={{ color: C.accent, fontSize: "10px", fontWeight: 700 }}>$</span>
                                    <DialogTitle className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                                        {isEditing ? "Edit Record" : "Asset Details"}
                                    </DialogTitle>
                                    {selectedActivity?.asset_tag && (
                                        <span className="text-[10px] px-2 py-0.5 border ml-2"
                                            style={{ borderColor: C.border, color: C.dim }}>
                                            {selectedActivity.asset_tag}
                                        </span>
                                    )}
                                </div>
                            </DialogHeader>

                            {selectedActivity && (
                                <div className="grid grid-cols-2 gap-4 py-2">
                                    {([
                                        ["Reference ID",   "referenceid"],
                                        ["Asset Tag",      "asset_tag"],
                                        ["Asset Type",     "asset_type"],
                                        ["Status",         "status"],
                                        ["Location",       "location"],
                                        ["New User",       "new_user"],
                                        ["Old User",       "old_user"],
                                        ["Department",     "department"],
                                        ["Position",       "position"],
                                        ["Brand",          "brand"],
                                        ["Model",          "model"],
                                        ["Processor",      "processor"],
                                        ["RAM",            "ram"],
                                        ["Storage",        "storage"],
                                        ["Serial Number",  "serial_number"],
                                        ["Purchase Date",  "purchase_date"],
                                        ["Warranty Date",  "warranty_date"],
                                        ["Asset Age",      "asset_age"],
                                        ["Amount",         "amount"],
                                        ["Remarks",        "remarks"],
                                        ["MAC Address",    "mac_address"],
                                        ["Date Created",   "date_created"],
                                        ["Date Updated",   "date_updated"],
                                    ] as [string, keyof Activity][]).map(([label, key]) => (
                                        <FieldRow
                                            key={key}
                                            label={label}
                                            fieldKey={key}
                                            isEditing={isEditing}
                                            value={(formData[key] as string) ?? ""}
                                            onChange={handleChange}
                                        />
                                    ))}
                                </div>
                            )}

                            <DialogFooter className="border-t pt-3 flex gap-2" style={{ borderColor: C.border }}>
                                {!isEditing ? (
                                    <>
                                        <button onClick={() => setSelectedActivity(null)}
                                            className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                                            style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                                            Close
                                        </button>
                                        <button onClick={() => setIsEditing(true)}
                                            className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                                            style={{ backgroundColor: C.accent, borderColor: C.accent, color: "#080d12" }}
                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#ff7a1a" }}
                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = C.accent }}>
                                            <Pencil className="size-3" /> Edit
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => setIsEditing(false)}
                                            className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
                                            style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}
                                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim }}>
                                            Cancel
                                        </button>
                                        <button onClick={handleUpdate} disabled={isSaving}
                                            className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-50"
                                            style={{ backgroundColor: C.accent, borderColor: C.accent, color: "#080d12" }}
                                            onMouseEnter={(e) => { if (!isSaving) e.currentTarget.style.backgroundColor = "#ff7a1a" }}
                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = C.accent }}>
                                            {isSaving ? <><Loader2 className="size-3 animate-spin" /> Saving…</> : "Save Changes"}
                                        </button>
                                    </>
                                )}
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* ── Delete Confirm Modal ── */}
                    <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                        <DialogContent className="max-w-sm border"
                            style={{ backgroundColor: C.panel, borderColor: "#ef4444", fontFamily: C.font, color: C.text }}>
                            <div className="absolute top-0 left-0 w-3 h-3 border-l border-t" style={{ borderColor: "#ef4444" }} />
                            <div className="absolute top-0 right-0 w-3 h-3 border-r border-t" style={{ borderColor: "#ef4444" }} />
                            <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b" style={{ borderColor: "#ef4444" }} />
                            <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b" style={{ borderColor: "#ef4444" }} />
                            <DialogHeader>
                                <DialogTitle className="text-xs font-bold uppercase tracking-widest" style={{ color: "#f87171" }}>
                                    Confirm Delete
                                </DialogTitle>
                            </DialogHeader>
                            <p className="text-[11px] mt-2" style={{ color: C.dim }}>
                                Delete <span style={{ color: C.text, fontWeight: 700 }}>{selectedIds.length}</span> selected record(s)?
                                This action cannot be undone.
                            </p>
                            <DialogFooter className="flex gap-2 mt-4">
                                <button onClick={() => setShowDeleteConfirm(false)}
                                    className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border"
                                    style={{ backgroundColor: "transparent", borderColor: C.border, color: C.dim }}>
                                    Cancel
                                </button>
                                <button onClick={handleBulkDelete}
                                    className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border"
                                    style={{ backgroundColor: "rgba(239,68,68,0.15)", borderColor: "#ef4444", color: "#f87171" }}>
                                    Delete
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    )
}
