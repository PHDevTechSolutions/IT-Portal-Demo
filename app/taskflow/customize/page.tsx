"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Settings2, Save, Loader2, CheckCircle2, Check,
    AlertTriangle, Info, XCircle, Wrench,
} from "lucide-react"
import { toast } from "sonner"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TableStyles {
    table_bg: string; table_border: string; table_border_radius: string; table_shadow: string; table_font_family: string
    th_bg: string; th_text: string; th_font_size: string; th_font_weight: string; th_padding: string; th_border: string; th_letter_spacing: string
    tr_hover_bg: string; tr_border: string; td_text: string; td_font_size: string; td_padding: string; td_border: string
    tfoot_bg: string; tfoot_text: string; tfoot_font_size: string; tfoot_padding: string; tfoot_border: string
    toolbar_bg: string; toolbar_border: string; toolbar_input_bg: string; toolbar_input_text: string; toolbar_input_border: string
    toolbar_btn_bg: string; toolbar_btn_text: string; toolbar_btn_border: string
    pagination_bg: string; pagination_text: string; pagination_border: string
    pagination_active_bg: string; pagination_active_text: string; pagination_radius: string
    layout?: "toolbar-top" | "datatable"
}

interface MaintenanceStyles {
    bg: string; border: string; title_color: string; message_color: string; icon_color: string
}

interface LoginFormStyles {
    card_bg: string; card_border: string; card_shadow: string
    left_bg: string; divider: string
    title_color: string; subtitle_color: string; label_color: string
    input_bg: string; input_border: string; input_text: string
    btn_bg: string; btn_text: string
    tab_active: string; link_color: string
}

// ─── Table Presets ────────────────────────────────────────────────────────────

const TABLE_PRESETS: { id: string; name: string; description: string; fontLabel: string; styles: TableStyles }[] = [
    {
        id: "cloud-card", name: "Cloud Card",
        description: "Clean blue tones with a modern sans-serif — crisp SaaS enterprise look",
        fontLabel: "DM Sans · Modern",
        styles: {
            table_bg: "#ffffff", table_border: "#bfdbfe", table_border_radius: "16",
            table_shadow: "0 4px 24px 0 rgba(59,130,246,0.10), 0 1.5px 6px 0 rgba(59,130,246,0.06)",
            table_font_family: "'DM Sans', 'Inter', 'Segoe UI', Arial, sans-serif",
            th_bg: "#eff6ff", th_text: "#1e40af", th_font_size: "12", th_font_weight: "700",
            th_padding: "14", th_border: "#bfdbfe", th_letter_spacing: "0.08em",
            tr_hover_bg: "#eff6ff", tr_border: "#dbeafe", td_text: "#1e3a8a", td_font_size: "14",
            td_padding: "14", td_border: "#dbeafe",
            tfoot_bg: "#eff6ff", tfoot_text: "#3b82f6", tfoot_font_size: "13", tfoot_padding: "12", tfoot_border: "#bfdbfe",
            toolbar_bg: "#dbeafe", toolbar_border: "#bfdbfe",
            toolbar_input_bg: "rgba(255,255,255,0.70)", toolbar_input_text: "#1e40af", toolbar_input_border: "#93c5fd",
            toolbar_btn_bg: "rgba(255,255,255,0.55)", toolbar_btn_text: "#1e40af", toolbar_btn_border: "#93c5fd",
            pagination_bg: "#eff6ff", pagination_text: "#3b82f6", pagination_border: "#bfdbfe",
            pagination_active_bg: "#1e40af", pagination_active_text: "#ffffff", pagination_radius: "8",
        },
    },
    {
        id: "soft-mono-dark", name: "Soft Mono Dark",
        description: "Minimal black borders with gray surfaces, white panels, soft shadows, and clean sharp edges",
        fontLabel: "Nunito · Clean Modern",
        styles: {
            table_bg: "#ffffff", table_border: "#111111", table_border_radius: "0",
            table_shadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
            table_font_family: "'Nunito', 'Trebuchet MS', 'Gill Sans', sans-serif",
            th_bg: "#1f1f1f", th_text: "#ffffff", th_font_size: "11", th_font_weight: "900",
            th_padding: "14", th_border: "#111111", th_letter_spacing: "0.05em",
            tr_hover_bg: "#f3f4f6", tr_border: "#d1d5db", td_text: "#111827", td_font_size: "12",
            td_padding: "14", td_border: "#e5e7eb",
            tfoot_bg: "#1f1f1f", tfoot_text: "#ffffff", tfoot_font_size: "12", tfoot_padding: "12", tfoot_border: "#111111",
            toolbar_bg: "#1f1f1f", toolbar_border: "#111111",
            toolbar_input_bg: "rgba(255,255,255,0.08)", toolbar_input_text: "#ffffff", toolbar_input_border: "#3f3f3f",
            toolbar_btn_bg: "rgba(255,255,255,0.08)", toolbar_btn_text: "#ffffff", toolbar_btn_border: "#3f3f3f",
            pagination_bg: "#1f1f1f", pagination_text: "#d1d5db", pagination_border: "#3f3f3f",
            pagination_active_bg: "#ffffff", pagination_active_text: "#111111", pagination_radius: "0",
        },
    },
    {
        id: "classic-mono", name: "Classic Mono",
        description: "Rounded white card with soft shadow, light gray header, show-entries control, and split footer pagination",
        fontLabel: "Inter · Clean",
        styles: {
            table_bg: "#ffffff", table_border: "#e5e7eb", table_border_radius: "16",
            table_shadow: "0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 15px -3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)",
            table_font_family: "'Inter', 'Segoe UI', Arial, sans-serif",
            th_bg: "#f9fafb", th_text: "#374151", th_font_size: "12", th_font_weight: "600",
            th_padding: "12", th_border: "#e5e7eb", th_letter_spacing: "0.01em",
            tr_hover_bg: "#f9fafb", tr_border: "#f3f4f6", td_text: "#111827", td_font_size: "13",
            td_padding: "12", td_border: "#f3f4f6",
            tfoot_bg: "#ffffff", tfoot_text: "#6b7280", tfoot_font_size: "12", tfoot_padding: "12", tfoot_border: "#e5e7eb",
            toolbar_bg: "#f9fafb", toolbar_border: "#e5e7eb",
            toolbar_input_bg: "#ffffff", toolbar_input_text: "#374151", toolbar_input_border: "#d1d5db",
            toolbar_btn_bg: "#ffffff", toolbar_btn_text: "#374151", toolbar_btn_border: "#d1d5db",
            pagination_bg: "#ffffff", pagination_text: "#374151", pagination_border: "#d1d5db",
            pagination_active_bg: "#3b82f6", pagination_active_text: "#ffffff", pagination_radius: "8",
            layout: "datatable",
        },
    },
]

// ─── Banner Presets ───────────────────────────────────────────────────────────

const BANNER_PRESETS: {
    id: string; name: string; description: string; icon: "warning" | "info" | "critical" | "maintenance"
    styles: MaintenanceStyles
}[] = [
        {
            id: "warning", name: "Warning", icon: "warning",
            description: "Amber tone — ideal for scheduled maintenance windows",
            styles: { bg: "#fffbeb", border: "#f59e0b", title_color: "#92400e", message_color: "#78350f", icon_color: "#f59e0b" },
        },
        {
            id: "info", name: "Informational", icon: "info",
            description: "Blue tone — perfect for planned updates and notices",
            styles: { bg: "#eff6ff", border: "#3b82f6", title_color: "#1e40af", message_color: "#1d4ed8", icon_color: "#3b82f6" },
        },
        {
            id: "critical", name: "Critical", icon: "critical",
            description: "Red alert — for urgent outages or service disruptions",
            styles: { bg: "#fef2f2", border: "#ef4444", title_color: "#991b1b", message_color: "#b91c1c", icon_color: "#ef4444" },
        },
        {
            id: "dark", name: "Night Ops", icon: "maintenance",
            description: "Dark slate — minimal disruption to the reading experience",
            styles: { bg: "#0f172a", border: "#334155", title_color: "#e2e8f0", message_color: "#94a3b8", icon_color: "#64748b" },
        },
    ]

// ─── Login Form Presets ───────────────────────────────────────────────────────

const LOGIN_FORM_PRESETS: {
    id: string; name: string; description: string; fontLabel: string
    styles: LoginFormStyles
}[] = [
        {
            id: "classic-indigo", name: "Classic Indigo",
            description: "Clean white card, indigo CTA, slate inputs — the default professional look",
            fontLabel: "Inter · Modern",
            styles: {
                card_bg: "#ffffff", card_border: "#e2e8f0",
                card_shadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                left_bg: "#ffffff", divider: "#e2e8f0",
                title_color: "#1e293b", subtitle_color: "#94a3b8", label_color: "#334155",
                input_bg: "#f8fafc", input_border: "#e2e8f0", input_text: "#1e293b",
                btn_bg: "#4f46e5", btn_text: "#ffffff",
                tab_active: "#4f46e5", link_color: "#4f46e5",
            },
        },
        {
            id: "dark-obsidian", name: "Dark Obsidian",
            description: "Deep dark background, cyan highlights — sleek and minimal for night users",
            fontLabel: "Nunito · Sleek",
            styles: {
                card_bg: "#0f172a", card_border: "#1e293b",
                card_shadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
                left_bg: "#0f172a", divider: "#1e293b",
                title_color: "#f1f5f9", subtitle_color: "#64748b", label_color: "#94a3b8",
                input_bg: "#1e293b", input_border: "#334155", input_text: "#e2e8f0",
                btn_bg: "#06b6d4", btn_text: "#ffffff",
                tab_active: "#06b6d4", link_color: "#06b6d4",
            },
        },
        {
            id: "emerald-fresh", name: "Emerald Fresh",
            description: "Crisp white with vibrant emerald accents — fresh and energetic for daytime",
            fontLabel: "DM Sans · Fresh",
            styles: {
                card_bg: "#ffffff", card_border: "#d1fae5",
                card_shadow: "0 25px 50px -12px rgba(16,185,129,0.15)",
                left_bg: "#f0fdf4", divider: "#d1fae5",
                title_color: "#064e3b", subtitle_color: "#6b7280", label_color: "#065f46",
                input_bg: "#f9fafb", input_border: "#d1fae5", input_text: "#064e3b",
                btn_bg: "#10b981", btn_text: "#ffffff",
                tab_active: "#10b981", link_color: "#10b981",
            },
        },
    ]

// ─── Preview data ─────────────────────────────────────────────────────────────

const ALL_PREVIEW_ROWS = [
    ["Acme Corp", "Juan dela Cruz", "Active", "NCR", "May 15, 2026"],
    ["Beta Inc", "Maria Santos", "Non-Buying", "Region 3", "May 14, 2026"],
    ["Gamma Ltd", "Pedro Reyes", "On Hold", "Region 7", "May 13, 2026"],
    ["Delta Co", "Ana Villanueva", "Active", "Region 4", "May 12, 2026"],
    ["Epsilon PH", "Rico Mendoza", "Non-Buying", "NCR", "May 11, 2026"],
    ["Zeta Systems", "Liza Bautista", "Active", "Region 1", "May 10, 2026"],
    ["Eta Global", "Marco Cruz", "On Hold", "Region 5", "May 9, 2026"],
    ["Theta Corp", "Celine Aquino", "Active", "Region 6", "May 8, 2026"],
    ["Iota Ltd", "Ferdie Gomez", "Non-Buying", "NCR", "May 7, 2026"],
    ["Kappa Inc", "Rosa Torres", "Active", "Region 2", "May 6, 2026"],
    ["Lambda Co", "Ben Ocampo", "On Hold", "Region 8", "May 5, 2026"],
    ["Mu Systems", "Diana Lim", "Active", "NCR", "May 4, 2026"],
    ["Nu Global", "Carlo Ramos", "Non-Buying", "Region 9", "May 3, 2026"],
    ["Xi Corp", "Paula Navarro", "Active", "Region 3", "May 2, 2026"],
    ["Omicron Ltd", "Jerome Castro", "On Hold", "NCR", "May 1, 2026"],
]
const PREVIEW_HEADERS = ["Company", "Contact", "Status", "Area", "Date"]
const PAGE_SIZE = 3

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <div style={{ border: "1px solid #1a2535" }}>
            {/* Card header — same dark as page bg, orange accent */}
            <div style={{ borderBottom: "1px solid #1a2535", backgroundColor: "#080d12", padding: "8px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#e8630a", fontSize: "10px", fontWeight: 700, lineHeight: 1 }}>$</span>
                    <p style={{ color: "#e8630a", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>{title}</p>
                </div>
                {description && (
                    <p style={{ color: "#253040", fontSize: "10px", marginTop: "2px", marginLeft: "14px" }}>{description}</p>
                )}
            </div>
            {/* Card body — slightly lighter than page bg */}
            <div style={{ backgroundColor: "#0d1117", padding: "16px 14px" }}>{children}</div>
        </div>
    )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <label style={{ color: "#4a6070", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            // {children}
        </label>
    )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="relative inline-flex h-5 w-9 items-center transition-colors border"
            style={{
                borderRadius: "2px",
                backgroundColor: checked ? "#e8630a" : "#0f1923",
                borderColor: checked ? "#e8630a" : "#1a2535",
            }}
        >
            <span
                className="inline-block h-3.5 w-3.5 transform transition-transform"
                style={{
                    backgroundColor: "#080d12",
                    borderRadius: "1px",
                    transform: checked ? "translateX(18px)" : "translateX(2px)",
                }}
            />
        </button>
    )
}

// ─── Slash divider ────────────────────────────────────────────────────────────

function SlashDivider({ color }: { color: string }) {
    return (
        <div style={{ width: "1.5px", alignSelf: "stretch", backgroundColor: color, transform: "skewX(-18deg)", flexShrink: 0 }} />
    )
}

// ─── Pagination Bar ───────────────────────────────────────────────────────────

function PaginationBar({ currentPage, totalPages, onPage, styles }: {
    currentPage: number; totalPages: number; onPage: (p: number) => void; styles: TableStyles
}) {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    const barStyle: React.CSSProperties = {
        display: "inline-flex", alignItems: "stretch",
        border: `1.5px solid ${styles.pagination_border}`,
        borderRadius: `${styles.pagination_radius}px`,
        overflow: "hidden", fontFamily: styles.table_font_family,
        fontSize: "11px", userSelect: "none", height: "28px",
    }
    const baseBtn: React.CSSProperties = {
        display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
        padding: "0 10px", backgroundColor: styles.pagination_bg, color: styles.pagination_text,
        border: "none", outline: "none", cursor: "pointer", fontFamily: styles.table_font_family,
        fontSize: "11px", whiteSpace: "nowrap", transition: "opacity 0.12s",
    }
    const disabledBtn: React.CSSProperties = { ...baseBtn, opacity: 0.3, cursor: "default" }
    const activeBtn: React.CSSProperties = {
        ...baseBtn, backgroundColor: styles.pagination_active_bg, color: styles.pagination_active_text,
        fontWeight: 700, cursor: "default", minWidth: "28px", padding: "0 8px",
    }
    const numBtn: React.CSSProperties = { ...baseBtn, minWidth: "28px", padding: "0 8px" }
    const ChevL = () => (<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>)
    const ChevR = () => (<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>)
    return (
        <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={barStyle}>
                <button onClick={() => currentPage > 1 && onPage(currentPage - 1)} style={currentPage === 1 ? disabledBtn : baseBtn}><ChevL /> Previous</button>
                <SlashDivider color={styles.pagination_border} />
                {pages.map((p, idx) => (
                    <React.Fragment key={p}>
                        <button onClick={() => p !== currentPage && onPage(p)} style={p === currentPage ? activeBtn : numBtn}>{p}</button>
                        {idx < pages.length - 1 && <SlashDivider color={styles.pagination_border} />}
                    </React.Fragment>
                ))}
                <SlashDivider color={styles.pagination_border} />
                <button onClick={() => currentPage < totalPages && onPage(currentPage + 1)} style={currentPage === totalPages ? disabledBtn : baseBtn}>Next <ChevR /></button>
            </div>
        </div>
    )
}

// ─── Datatable Pagination ─────────────────────────────────────────────────────

function DatatablePagination({ currentPage, totalPages, onPage, styles }: {
    currentPage: number; totalPages: number; onPage: (p: number) => void; styles: TableStyles
}) {
    const radius = Number(styles.pagination_radius)
    const base: React.CSSProperties = {
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: "32px", height: "32px", padding: "0 10px", fontSize: "12px",
        fontFamily: styles.table_font_family, cursor: "pointer",
        border: `1px solid ${styles.pagination_border}`,
        backgroundColor: styles.pagination_bg, color: styles.pagination_text,
        borderRadius: `${radius}px`, transition: "background-color 0.12s", userSelect: "none" as const,
    }
    const active: React.CSSProperties = { ...base, backgroundColor: styles.pagination_active_bg, color: styles.pagination_active_text, borderColor: styles.pagination_active_bg, fontWeight: 700, cursor: "default" }
    const disabled: React.CSSProperties = { ...base, opacity: 0.4, cursor: "default" }
    const getPages = (): (number | string)[] => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
        if (currentPage <= 3) return [1, 2, 3, "…", totalPages]
        if (currentPage >= totalPages - 2) return [1, "…", totalPages - 2, totalPages - 1, totalPages]
        return [1, "…", currentPage, "…", totalPages]
    }
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button onClick={() => currentPage > 1 && onPage(currentPage - 1)} style={currentPage === 1 ? disabled : base}>Previous</button>
            {getPages().map((p, i) =>
                p === "…" ? (
                    <span key={`e-${i}`} style={{ ...base, cursor: "default", border: "none", backgroundColor: "transparent" }}>…</span>
                ) : (
                    <button key={p} onClick={() => typeof p === "number" && p !== currentPage && onPage(p)} style={p === currentPage ? active : base}>{p}</button>
                )
            )}
            <button onClick={() => currentPage < totalPages && onPage(currentPage + 1)} style={currentPage === totalPages ? disabled : base}>Next</button>
        </div>
    )
}

// ─── Preview Table ─────────────────────────────────────────────────────────────

function PreviewTable({ styles }: { styles: TableStyles }) {
    const [hoveredRow, setHoveredRow] = useState<number | null>(null)
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(PAGE_SIZE)
    const isDatatable = styles.layout === "datatable"
    const filtered = ALL_PREVIEW_ROWS.filter((row) => row.some((c) => c.toLowerCase().includes(search.toLowerCase())))
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const currentPage = Math.min(page, totalPages)
    const visibleRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    useEffect(() => { setPage(1) }, [search])
    const radius = Number(styles.table_border_radius)
    const wrapperStyle: React.CSSProperties = { borderRadius: `${radius}px`, boxShadow: styles.table_shadow, overflow: "hidden", border: `1px solid ${styles.table_border}`, fontFamily: styles.table_font_family, backgroundColor: styles.table_bg }
    const searchRadius = Math.min(radius / 2, 8)
    const tableStyle: React.CSSProperties = { width: "100%", backgroundColor: styles.table_bg, borderCollapse: "collapse" }
    const thStyle: React.CSSProperties = { backgroundColor: styles.th_bg, color: styles.th_text, fontSize: `${styles.th_font_size}px`, padding: `${styles.th_padding}px`, borderBottom: `1px solid ${styles.th_border}`, textAlign: "left", textTransform: isDatatable ? "none" : "uppercase", letterSpacing: styles.th_letter_spacing, fontWeight: Number(styles.th_font_weight), fontFamily: styles.table_font_family, whiteSpace: "nowrap" as const }
    const tdStyle: React.CSSProperties = { color: styles.td_text, fontSize: `${styles.td_font_size}px`, padding: `${styles.td_padding}px`, borderBottom: `1px solid ${styles.td_border}`, fontWeight: 400, fontFamily: styles.table_font_family }
    const SortIcon = () => (<svg width="8" height="12" viewBox="0 0 8 12" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}><path d="M4 0L7 4H1L4 0Z" fill="currentColor" /><path d="M4 12L1 8H7L4 12Z" fill="currentColor" /></svg>)
    const CheckboxCell = () => (<td style={{ ...tdStyle, width: "36px", paddingRight: "4px" }}><div style={{ width: "14px", height: "14px", border: `1.5px solid ${styles.th_border}`, borderRadius: "3px", backgroundColor: styles.table_bg }} /></td>)
    const ActionCell = () => (<td style={{ ...tdStyle, width: "56px", whiteSpace: "nowrap" as const }}><div style={{ display: "flex", gap: "8px", alignItems: "center" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={styles.td_text} strokeWidth="1.8" style={{ opacity: 0.4, cursor: "pointer" }}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={styles.td_text} strokeWidth="1.8" style={{ opacity: 0.4, cursor: "pointer" }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></div></td>)

    if (isDatatable) {
        const pageSizeOptions = [3, 5, 10]
        return (
            <div style={wrapperStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: styles.toolbar_bg, borderBottom: `1px solid ${styles.toolbar_border}`, gap: "8px", flexWrap: "wrap" as const }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: styles.toolbar_input_text, fontFamily: styles.table_font_family }}>
                        <span>Show</span>
                        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ padding: "3px 6px", fontSize: "12px", fontFamily: styles.table_font_family, color: styles.toolbar_input_text, backgroundColor: styles.toolbar_input_bg, border: `1px solid ${styles.toolbar_input_border}`, borderRadius: `${searchRadius}px`, outline: "none", cursor: "pointer" }}>
                            {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <span>entries</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ position: "relative" }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", width: "12px", height: "12px", color: styles.toolbar_input_text, opacity: 0.45, pointerEvents: "none" }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: "28px", paddingRight: "8px", paddingTop: "5px", paddingBottom: "5px", fontSize: "12px", fontFamily: styles.table_font_family, color: styles.toolbar_input_text, backgroundColor: styles.toolbar_input_bg, border: `1px solid ${styles.toolbar_input_border}`, borderRadius: `${searchRadius}px`, outline: "none", width: "160px" }} />
                        </div>
                        <button style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", fontSize: "12px", fontFamily: styles.table_font_family, fontWeight: 600, color: styles.toolbar_btn_text, backgroundColor: styles.toolbar_btn_bg, border: `1px solid ${styles.toolbar_btn_border}`, borderRadius: `${searchRadius}px`, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            Download
                        </button>
                    </div>
                </div>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, width: "36px", paddingRight: "4px" }}><div style={{ width: "14px", height: "14px", border: `1.5px solid ${styles.th_border}`, borderRadius: "3px", backgroundColor: styles.table_bg }} /></th>
                            {PREVIEW_HEADERS.map((h) => (<th key={h} style={thStyle}><div style={{ display: "flex", alignItems: "center", gap: "5px" }}>{h} <SortIcon /></div></th>))}
                            <th style={{ ...thStyle, width: "56px" }}><div style={{ display: "flex", alignItems: "center", gap: "5px" }}>Action <SortIcon /></div></th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleRows.length > 0 ? visibleRows.map((row, i) => (
                            <tr key={i} style={{ backgroundColor: hoveredRow === i ? styles.tr_hover_bg : "transparent", transition: "background-color 0.15s" }} onMouseEnter={() => setHoveredRow(i)} onMouseLeave={() => setHoveredRow(null)}>
                                <CheckboxCell />
                                {row.map((cell, j) => (<td key={j} style={tdStyle}>{cell}</td>))}
                                <ActionCell />
                            </tr>
                        )) : (<tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: "20px", opacity: 0.45 }}>No results found</td></tr>)}
                    </tbody>
                </table>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${styles.tfoot_padding}px 14px`, backgroundColor: styles.tfoot_bg, borderTop: `1px solid ${styles.tfoot_border}`, fontFamily: styles.table_font_family, flexWrap: "wrap" as const, gap: "8px" }}>
                    <span style={{ fontSize: `${styles.tfoot_font_size}px`, color: styles.tfoot_text }}>Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} entries</span>
                    <DatatablePagination currentPage={currentPage} totalPages={totalPages} onPage={setPage} styles={styles} />
                </div>
            </div>
        )
    }

    const origSearchInputStyle: React.CSSProperties = { flex: 1, minWidth: 0, paddingLeft: "26px", paddingRight: "8px", paddingTop: "5px", paddingBottom: "5px", fontSize: "11px", fontFamily: styles.table_font_family, color: styles.toolbar_input_text, backgroundColor: styles.toolbar_input_bg, border: `1px solid ${styles.toolbar_input_border}`, borderRadius: `${searchRadius}px`, outline: "none" }
    const origIconBtnStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "4px", padding: "4px 9px", fontSize: "10px", fontFamily: styles.table_font_family, fontWeight: 700, letterSpacing: "0.04em", color: styles.toolbar_btn_text, backgroundColor: styles.toolbar_btn_bg, border: `1px solid ${styles.toolbar_btn_border}`, borderRadius: `${searchRadius}px`, cursor: "pointer", whiteSpace: "nowrap" as const, textTransform: "uppercase" as const }
    const tfootCountStyle: React.CSSProperties = { backgroundColor: styles.tfoot_bg, color: styles.tfoot_text, fontSize: `${styles.tfoot_font_size}px`, padding: `${styles.tfoot_padding}px ${styles.tfoot_padding}px 6px`, borderTop: `1px solid ${styles.tfoot_border}`, fontFamily: styles.table_font_family, textAlign: "center" }
    const tfootPagStyle: React.CSSProperties = { backgroundColor: styles.tfoot_bg, padding: `6px ${styles.tfoot_padding}px ${styles.tfoot_padding}px` }

    return (
        <div style={wrapperStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", backgroundColor: styles.toolbar_bg, borderBottom: `1px solid ${styles.toolbar_border}` }}>
                <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", width: "11px", height: "11px", color: styles.toolbar_input_text, opacity: 0.5, pointerEvents: "none" }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={origSearchInputStyle} />
                </div>
                <button style={origIconBtnStyle}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>Filter</button>
                <button style={origIconBtnStyle}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>Export</button>
            </div>
            <table style={tableStyle}>
                <thead><tr>{PREVIEW_HEADERS.map((h) => (<th key={h} style={thStyle}>{h}</th>))}</tr></thead>
                <tbody>
                    {visibleRows.length > 0 ? visibleRows.map((row, i) => (
                        <tr key={i} style={{ backgroundColor: hoveredRow === i ? styles.tr_hover_bg : "transparent", transition: "background-color 0.15s" }} onMouseEnter={() => setHoveredRow(i)} onMouseLeave={() => setHoveredRow(null)}>
                            {row.map((cell, j) => (<td key={j} style={tdStyle}>{cell}</td>))}
                        </tr>
                    )) : (<tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", padding: "20px", opacity: 0.45 }}>No results found</td></tr>)}
                </tbody>
                <tfoot>
                    <tr><td colSpan={5} style={tfootCountStyle}>Showing {visibleRows.length} of {filtered.length} record{filtered.length !== 1 ? "s" : ""}</td></tr>
                    <tr><td colSpan={5} style={tfootPagStyle}><PaginationBar currentPage={currentPage} totalPages={totalPages} onPage={setPage} styles={styles} /></td></tr>
                </tfoot>
            </table>
        </div>
    )
}

// ─── Banner Preview ───────────────────────────────────────────────────────────

function BannerPreview({ enabled, title, message, presetId }: {
    enabled: boolean; title: string; message: string; presetId: string
}) {
    const preset = BANNER_PRESETS.find(p => p.id === presetId) ?? BANNER_PRESETS[0]
    const s = preset.styles

    const iconMap = {
        warning: <AlertTriangle style={{ color: s.icon_color, width: 18, height: 18, flexShrink: 0 }} />,
        info: <Info style={{ color: s.icon_color, width: 18, height: 18, flexShrink: 0 }} />,
        critical: <XCircle style={{ color: s.icon_color, width: 18, height: 18, flexShrink: 0 }} />,
        maintenance: <Wrench style={{ color: s.icon_color, width: 18, height: 18, flexShrink: 0 }} />,
    }

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", background: "#f1f5f9", padding: "14px", borderRadius: "10px" }}>
            {/* Fake nav bar */}
            <div style={{ background: "#1e293b", height: "34px", borderRadius: "6px", marginBottom: "10px", display: "flex", alignItems: "center", padding: "0 14px", gap: "8px" }}>
                <div style={{ width: "64px", height: "8px", background: "#334155", borderRadius: "4px" }} />
                <div style={{ flex: 1 }} />
                {["48px", "48px", "32px"].map((w, i) => (
                    <div key={i} style={{ width: w, height: "8px", background: "#334155", borderRadius: "4px" }} />
                ))}
            </div>

            {/* Banner (conditional) */}
            {enabled ? (
                <div style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: "8px", padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
                    {iconMap[preset.icon as keyof typeof iconMap]}
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "13px", color: s.title_color, marginBottom: "3px" }}>
                            {title || "System Maintenance"}
                        </div>
                        <div style={{ fontSize: "12px", color: s.message_color, lineHeight: 1.5 }}>
                            {message || "We are currently performing scheduled maintenance. Please check back shortly."}
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ background: "#e2e8f0", border: "1.5px dashed #cbd5e1", borderRadius: "8px", padding: "12px 16px", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>Banner hidden — enable maintenance mode to show</span>
                </div>
            )}

            {/* Fake content blocks */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {[1, 2, 3].map(i => (
                    <div key={i} style={{ background: "#ffffff", borderRadius: "6px", height: "44px", border: "1px solid #e2e8f0" }} />
                ))}
            </div>
        </div>
    )
}

// ─── Login Form Mini Preview ───────────────────────────────────────────────────

function LoginFormMiniPreview({ styles, compact = false }: { styles: LoginFormStyles; compact?: boolean }) {
    const s = styles
    const isDark = s.card_bg === "#0f172a"

    return (
        <div style={{ background: isDark ? "#020617" : "#f1f5f9", padding: compact ? "10px" : "16px", borderRadius: "10px", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: s.card_bg, border: `1px solid ${s.card_border}`, borderRadius: "10px", padding: compact ? "12px" : "18px", width: compact ? "130px" : "160px", fontFamily: "'Inter', sans-serif", boxShadow: s.card_shadow }}>
                {/* Tab bar */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px", borderBottom: `1px solid ${s.divider}`, paddingBottom: "4px" }}>
                    <div style={{ fontSize: "7px", fontWeight: 700, color: s.tab_active, borderBottom: `1.5px solid ${s.tab_active}`, paddingBottom: "1px", display: "flex", alignItems: "center", gap: "2px" }}>
                        <span style={{ width: "6px", height: "6px", background: s.tab_active, borderRadius: "1px", display: "inline-block", opacity: 0.6 }} />
                        Password
                    </div>
                    <div style={{ fontSize: "7px", color: s.label_color, opacity: 0.4, display: "flex", alignItems: "center", gap: "2px" }}>
                        <span style={{ width: "6px", height: "6px", background: s.label_color, borderRadius: "1px", display: "inline-block", opacity: 0.4 }} />
                        PIN
                    </div>
                </div>
                {/* Title */}
                <div style={{ fontSize: compact ? "9px" : "11px", fontWeight: 900, color: s.title_color, marginBottom: "2px" }}>Welcome back</div>
                <div style={{ fontSize: "6px", color: s.subtitle_color, marginBottom: compact ? "7px" : "10px" }}>Sign in to your account</div>
                {/* Fields */}
                {["Email", "Password"].map(lbl => (
                    <div key={lbl} style={{ marginBottom: "5px" }}>
                        <div style={{ fontSize: "6px", fontWeight: 600, color: s.label_color, marginBottom: "2px" }}>{lbl}</div>
                        <div style={{ height: compact ? "10px" : "12px", background: s.input_bg, border: `1px solid ${s.input_border}`, borderRadius: "4px" }} />
                    </div>
                ))}
                {/* Button */}
                <div style={{ marginTop: compact ? "7px" : "10px", height: compact ? "14px" : "18px", background: s.btn_bg, borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "6px", fontWeight: 700, color: s.btn_text }}>Sign In</span>
                </div>
                {/* Footer hint */}
                <div style={{ marginTop: "6px", display: "flex", justifyContent: "center" }}>
                    <div style={{ fontSize: "5px", color: s.link_color, opacity: 0.7 }}>ecoshiftcorp.com · Acculog</div>
                </div>
            </div>
        </div>
    )
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = "quota" | "table-layout" | "maintenance" | "login-form" | "reminder"

const TABS: { id: TabId; label: string; description: string; icon: React.ReactNode }[] = [
    {
        id: "quota", label: "Quota Settings", description: "Activity targets",
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
            </svg>
        ),
    },
    {
        id: "table-layout", label: "Table Layout", description: "Preset & preview",
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="0" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="9" x2="9" y2="21" />
            </svg>
        ),
    },
    {
        id: "maintenance", label: "Maintenance", description: "Banner & mode",
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
        ),
    },
    {
        id: "login-form", label: "Login Form", description: "Login appearance",
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="0" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        ),
    },
    {
        id: "reminder", label: "Reminder", description: "Logout schedule",
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
        ),
    },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomizePage() {
    const router = useRouter()

    const [activeTab, setActiveTab] = useState<TabId>("quota")
    const [outboundQuota, setOutboundQuota] = useState("")
    const [selectedPreset, setSelectedPreset] = useState<string>("cloud-card")
    const [isFetching, setIsFetching] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Maintenance state
    const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
    const [maintenanceTitle, setMaintenanceTitle] = useState("System Maintenance")
    const [maintenanceMessage, setMaintenanceMessage] = useState("We are currently performing scheduled maintenance. Please check back shortly.")
    const [maintenanceBannerPreset, setMaintenanceBannerPreset] = useState("warning")

    // Login form state
    const [loginFormPreset, setLoginFormPreset] = useState("classic-indigo")

    // Reminder state
    const [logoutReminderHour, setLogoutReminderHour] = useState("16")
    const [logoutReminderMinute, setLogoutReminderMinute] = useState("30")
    const [logoutWindowEnd, setLogoutWindowEnd] = useState("17")
    const [snoozeDuration, setSnoozeDuration] = useState("15")
    const [logoutReminderTitle, setLogoutReminderTitle] = useState("Logout Reminder")
    const [logoutReminderMessage, setLogoutReminderMessage] = useState("Understood, will sign off before leaving.")
    const [logoutSnoozeLabel, setLogoutSnoozeLabel] = useState("Snooze (15m)")
    const [logoutDismissLabel, setLogoutDismissLabel] = useState("Got it")

    useEffect(() => {
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Nunito:wght@400;700;800&display=swap"
        document.head.appendChild(link)
        return () => { document.head.removeChild(link) }
    }, [])

    useEffect(() => {
        const fetchSettings = async () => {
            setIsFetching(true)
            try {
                const res = await fetch("/api/Data/Applications/Taskflow/Settings")
                const json = await res.json()
                if (json.success && json.data) {
                    setOutboundQuota(json.data["outbound_quota"] ?? "")
                    if (json.data.table_preset) setSelectedPreset(json.data.table_preset)
                    if (json.data.maintenance_enabled !== undefined) setMaintenanceEnabled(json.data.maintenance_enabled)
                    if (json.data.maintenance_title) setMaintenanceTitle(json.data.maintenance_title)
                    if (json.data.maintenance_message) setMaintenanceMessage(json.data.maintenance_message)
                    if (json.data.maintenance_banner_preset) setMaintenanceBannerPreset(json.data.maintenance_banner_preset)
                    if (json.data.login_form_preset) setLoginFormPreset(json.data.login_form_preset)
                    if (json.data.logout_reminder_hour != null) setLogoutReminderHour(String(json.data.logout_reminder_hour))
                    if (json.data.logout_reminder_minute != null) setLogoutReminderMinute(String(json.data.logout_reminder_minute))
                    if (json.data.logout_window_end != null) setLogoutWindowEnd(String(json.data.logout_window_end))
                    if (json.data.snooze_duration != null) setSnoozeDuration(String(json.data.snooze_duration))
                    if (json.data.logout_reminder_title) setLogoutReminderTitle(json.data.logout_reminder_title)
                    if (json.data.logout_reminder_message) setLogoutReminderMessage(json.data.logout_reminder_message)
                    if (json.data.logout_snooze_label) setLogoutSnoozeLabel(json.data.logout_snooze_label)
                    if (json.data.logout_dismiss_label) setLogoutDismissLabel(json.data.logout_dismiss_label)
                }
            } catch (err) {
                console.error("Failed to load settings:", err)
            } finally {
                setIsFetching(false)
            }
        }
        fetchSettings()
    }, [])

    const handleSave = async () => {
        if (!outboundQuota.trim()) {
            toast.error("Outbound - Touchbase Quota cannot be empty.")
            return
        }
        setIsSaving(true)
        try {
            const tablePresetObj = TABLE_PRESETS.find((p) => p.id === selectedPreset)
            const bannerPresetObj = BANNER_PRESETS.find((p) => p.id === maintenanceBannerPreset)
            const loginPresetObj = LOGIN_FORM_PRESETS.find((p) => p.id === loginFormPreset)

            const res = await fetch("/api/Data/Applications/Taskflow/Settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    outbound_quota: outboundQuota.trim(),
                    table_preset: selectedPreset,
                    table_styles: tablePresetObj?.styles ?? null,
                    maintenance_enabled: maintenanceEnabled,
                    maintenance_title: maintenanceTitle.trim(),
                    maintenance_message: maintenanceMessage.trim(),
                    maintenance_banner_preset: maintenanceBannerPreset,
                    maintenance_styles: bannerPresetObj?.styles ?? null,
                    login_form_preset: loginFormPreset,
                    login_form_styles: loginPresetObj?.styles ?? null,
                    logout_reminder_hour: Number(logoutReminderHour),
                    logout_reminder_minute: Number(logoutReminderMinute),
                    logout_window_end: Number(logoutWindowEnd),
                    snooze_duration: Number(snoozeDuration),
                    logout_reminder_title: logoutReminderTitle.trim(),
                    logout_reminder_message: logoutReminderMessage.trim(),
                    logout_snooze_label: logoutSnoozeLabel.trim(),
                    logout_dismiss_label: logoutDismissLabel.trim(),
                }),
            })
            const json = await res.json()
            if (json.success) {
                toast.success("Settings saved successfully.")
            } else {
                toast.error(json.error || "Failed to save settings.")
            }
        } catch (err) {
            console.error("Save error:", err)
            toast.error("An error occurred while saving.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <ProtectedPageWrapper>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset
                    className="flex flex-col h-svh overflow-hidden text-slate-100"
                    style={{ backgroundColor: "#080d12", fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" }}
                >
                    {/* Dot-grid texture */}
                    <div
                        className="fixed inset-0 pointer-events-none"
                        style={{ backgroundImage: `radial-gradient(circle, #1a2535 1px, transparent 1px)`, backgroundSize: "24px 24px", opacity: 0.18, zIndex: 0 }}
                    />

                    {/* Header */}
                    <header className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 border-b" style={{ backgroundColor: "#080d12", borderColor: "#1a2535" }}>
                        <SidebarTrigger className="-ml-1 hover:bg-transparent" style={{ color: "#4a6070" }} />
                        <div className="w-px h-4" style={{ backgroundColor: "#1a2535" }} />
                        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}
                            className="hidden sm:flex h-7 px-2 text-[10px] uppercase tracking-widest rounded-none hover:bg-transparent"
                            style={{ color: "#4a6070" }}>
                            Home
                        </Button>
                        <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: "#1a2535" }} />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbLink href="#" className="text-[10px] uppercase tracking-widest hidden sm:block" style={{ color: "#4a6070" }}>Taskflow</BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden sm:block" style={{ color: "#253040" }} />
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "#e8630a" }}>Customize</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                        <div className="ml-auto flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] uppercase tracking-wider hidden sm:block" style={{ color: "#4a6070" }}>Online</span>
                        </div>
                    </header>

                    {/* Page title bar */}
                    <div className="relative z-10 shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "#1a2535", backgroundColor: "#0d1117" }}>
                        <div className="flex h-8 w-8 items-center justify-center border" style={{ borderColor: "#1a2535", backgroundColor: "#0f1923" }}>
                            <Settings2 className="size-4" style={{ color: "#e8630a" }} />
                        </div>
                        <div>
                            <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#e8630a" }}>Customize</h1>
                            <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "#253040" }}>Configure Taskflow settings and preferences</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-[10px]" style={{ color: "#253040" }}>$ taskflow --config</span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="relative z-10 flex-1 overflow-hidden">
                        {isFetching ? (
                            <div className="flex items-center justify-center h-full gap-3 text-xs">
                                <Loader2 className="size-4 animate-spin" style={{ color: "#e8630a" }} />
                                <span className="uppercase tracking-widest" style={{ color: "#253040" }}>Loading settings…</span>
                            </div>
                        ) : (
                            <div className="flex h-full">

                                {/* Left tab rail */}
                                <nav className="w-52 shrink-0 flex flex-col overflow-y-auto border-r" style={{ backgroundColor: "#080d12", borderColor: "#1a2535" }}>
                                    {/* Rail header */}
                                    <div className="px-4 py-3 border-b" style={{ borderColor: "#1a2535" }}>
                                        <div className="flex items-center gap-2">
                                            <span style={{ color: "#e8630a", fontSize: "10px", fontWeight: 700 }}>$</span>
                                            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "#e8630a" }}>Config Modules</p>
                                        </div>
                                    </div>
                                    {/* Tab items */}
                                    <div className="flex-1">
                                        {TABS.map((tab, idx) => {
                                            const isActive = activeTab === tab.id
                                            return (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActiveTab(tab.id)}
                                                    className="w-full text-left transition-all"
                                                    style={{
                                                        borderLeft: `2px solid ${isActive ? "#e8630a" : "transparent"}`,
                                                        borderBottom: "1px solid #1a2535",
                                                        backgroundColor: isActive ? "rgba(232,99,10,0.07)" : "transparent",
                                                        padding: "10px 14px",
                                                    }}
                                                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.025)" }}
                                                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent" }}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span style={{ color: isActive ? "#e8630a" : "#253040", flexShrink: 0 }}>
                                                                {tab.icon}
                                                            </span>
                                                            <p
                                                                className="text-[10px] font-bold uppercase tracking-widest leading-tight truncate"
                                                                style={{ color: isActive ? "#e8630a" : "#4a6070" }}
                                                            >
                                                                {tab.label}
                                                            </p>
                                                        </div>
                                                        {isActive && (
                                                            <span className="text-[8px] font-bold shrink-0" style={{ color: "#e8630a" }}>●</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "#253040", paddingLeft: "20px" }}>
                                                        {tab.description}
                                                    </p>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {/* Save button */}
                                    <div className="px-4 pt-4 pb-4 border-t" style={{ borderColor: "#1a2535" }}>
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="w-full h-9 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                            style={{ backgroundColor: "#e8630a", color: "#080d12", border: "1px solid #e8630a" }}
                                            onMouseEnter={(e) => { if (!isSaving) e.currentTarget.style.backgroundColor = "#ff7a1a" }}
                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#e8630a" }}
                                        >
                                            {isSaving
                                                ? <><Loader2 className="size-3 animate-spin" />Saving…</>
                                                : <><Save className="size-3" />Save Settings</>
                                            }
                                        </button>
                                        {!isSaving && outboundQuota && (
                                            <p className="text-[10px] flex items-center gap-1 mt-2" style={{ color: "#253040" }}>
                                                <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                                                Quota: <span style={{ color: "#c8d8e8" }}>{outboundQuota}</span>
                                            </p>
                                        )}
                                    </div>
                                </nav>

                                {/* Right content panel */}
                                <div className="flex-1 overflow-auto" style={{ backgroundColor: "#060b0f" }}>

                                    {/* Quota Settings */}
                                    {activeTab === "quota" && (
                                        <div className="p-6 max-w-xl">
                                            <SectionCard title="Quota Settings" description="Define activity targets for the sales team">
                                                <div className="space-y-1.5">
                                                    <FieldLabel>Outbound — Touchbase Quota</FieldLabel>
                                                    <p className="text-[11px]" style={{ color: "#253040" }}>Daily outbound touchbase target per TSA</p>
                                                    <Input type="number" min={0} placeholder="e.g. 10"
                                                        value={outboundQuota} onChange={(e) => setOutboundQuota(e.target.value)}
                                                        className="h-9 text-xs rounded-none w-48 focus-visible:ring-0 focus-visible:ring-offset-0"
                                                        style={{ backgroundColor: "#080d12", borderColor: "#1a2535", color: "#c8d8e8" }}
                                                        onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                                                        onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2535")}
                                                    />
                                                </div>
                                            </SectionCard>
                                        </div>
                                    )}

                                    {/* Table Layout */}
                                    {activeTab === "table-layout" && (
                                        <div className="p-6 space-y-6">
                                            <SectionCard title="Table Layout" description="Choose a table design preset — includes toolbar & pagination styles">
                                                <div className="space-y-2">
                                                    {TABLE_PRESETS.map((preset) => {
                                                        const isSelected = selectedPreset === preset.id
                                                        return (
                                                            <button key={preset.id} onClick={() => setSelectedPreset(preset.id)}
                                                                className="w-full text-left px-3 py-2.5 border transition-all flex items-start gap-3"
                                                                style={{ borderColor: isSelected ? "#e8630a" : "#1a2535", backgroundColor: isSelected ? "rgba(232,99,10,0.05)" : "#0d1117" }}
                                                            >
                                                                <div className="flex flex-col gap-0.5 mt-0.5 shrink-0 overflow-hidden" style={{ borderRadius: `${Math.min(Number(preset.styles.table_border_radius), 4)}px` }}>
                                                                    <div className="w-5 h-2" style={{ backgroundColor: preset.styles.toolbar_bg, border: `1px solid ${preset.styles.toolbar_border}` }} />
                                                                    <div className="w-5 h-2" style={{ backgroundColor: preset.styles.table_bg, border: `1px solid ${preset.styles.tr_border}` }} />
                                                                    <div className="w-5 h-2" style={{ backgroundColor: preset.styles.pagination_bg, border: `1px solid ${preset.styles.pagination_border}` }} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: isSelected ? "#e8630a" : "#c8d8e8" }}>{preset.name}</p>
                                                                        <span className="text-[9px] px-1.5 py-0.5 border" style={{ color: "#4a6070", borderColor: "#1a2535", backgroundColor: "#080d12" }}>{preset.fontLabel}</span>
                                                                    </div>
                                                                    <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "#4a6070" }}>{preset.description}</p>
                                                                </div>
                                                                {isSelected && <div className="shrink-0 mt-0.5 flex items-center gap-1" style={{ color: "#e8630a" }}><Check className="size-3" /><span className="text-[9px] font-bold uppercase">Active</span></div>}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </SectionCard>
                                            <SectionCard title="Preview All Layouts" description="Search, filter, export, and pagination are all styled per preset and saved with it">
                                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                                    {TABLE_PRESETS.map((preset) => {
                                                        const isSelected = selectedPreset === preset.id
                                                        return (
                                                            <div key={preset.id} className="overflow-hidden border transition-all" style={{ borderColor: isSelected ? "#e8630a" : "#1a2535" }}>
                                                                <div onClick={() => setSelectedPreset(preset.id)}
                                                                    className="px-3 py-1.5 flex items-center justify-between gap-2 border-b cursor-pointer select-none"
                                                                    style={{ borderColor: isSelected ? "#e8630a" : "#1a2535", backgroundColor: isSelected ? "rgba(232,99,10,0.05)" : "#0d1117" }}
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span className="text-[10px] font-bold uppercase tracking-widest shrink-0" style={{ color: isSelected ? "#e8630a" : "#4a6070" }}>{preset.name}</span>
                                                                        <span className="text-[9px] truncate" style={{ color: "#253040" }}>{preset.fontLabel}</span>
                                                                    </div>
                                                                    {isSelected && <span className="text-[10px] flex items-center gap-1 shrink-0 font-bold" style={{ color: "#e8630a" }}><Check className="size-3" /> Selected</span>}
                                                                </div>
                                                                <div className="p-4 overflow-auto" style={{ backgroundColor: "#1a1a12" }} onClick={(e) => e.stopPropagation()}>
                                                                    <PreviewTable styles={preset.styles} />
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </SectionCard>
                                        </div>
                                    )}

                                    {/* Maintenance */}
                                    {activeTab === "maintenance" && (
                                        <div className="p-6 space-y-6 max-w-4xl">
                                            <SectionCard title="Maintenance Mode" description="Show a maintenance banner across the application">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div>
                                                        <p className="text-xs font-bold" style={{ color: "#c8d8e8" }}>Enable Maintenance Banner</p>
                                                        <p className="text-[11px] mt-0.5" style={{ color: "#253040" }}>When enabled, a banner will appear at the top of every page</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <Toggle checked={maintenanceEnabled} onChange={setMaintenanceEnabled} />
                                                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: maintenanceEnabled ? "#e8630a" : "#253040" }}>
                                                            {maintenanceEnabled ? "On" : "Off"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </SectionCard>
                                            <SectionCard title="Banner Style" description="Choose a visual style for the maintenance banner">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {BANNER_PRESETS.map((preset) => {
                                                        const isSelected = maintenanceBannerPreset === preset.id
                                                        const s = preset.styles
                                                        const iconMap = {
                                                            warning:     <AlertTriangle className="size-4" style={{ color: s.icon_color }} />,
                                                            info:        <Info className="size-4" style={{ color: s.icon_color }} />,
                                                            critical:    <XCircle className="size-4" style={{ color: s.icon_color }} />,
                                                            maintenance: <Wrench className="size-4" style={{ color: s.icon_color }} />,
                                                        }
                                                        return (
                                                            <button key={preset.id} onClick={() => setMaintenanceBannerPreset(preset.id)}
                                                                className="text-left px-3 py-2.5 border transition-all flex items-start gap-3"
                                                                style={{ borderColor: isSelected ? "#e8630a" : "#1a2535", backgroundColor: isSelected ? "rgba(232,99,10,0.05)" : "#0d1117" }}
                                                            >
                                                                <div className="mt-0.5 shrink-0 w-8 h-8 flex items-center justify-center" style={{ background: s.bg, border: `1.5px solid ${s.border}` }}>
                                                                    {iconMap[preset.icon as keyof typeof iconMap]}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: isSelected ? "#e8630a" : "#c8d8e8" }}>{preset.name}</p>
                                                                    <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "#4a6070" }}>{preset.description}</p>
                                                                </div>
                                                                {isSelected && <Check className="size-3 shrink-0 mt-0.5" style={{ color: "#e8630a" }} />}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </SectionCard>
                                            <SectionCard title="Banner Content" description="Customize the title and message displayed in the banner">
                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <FieldLabel>Banner Title</FieldLabel>
                                                        <Input placeholder="e.g. System Maintenance" value={maintenanceTitle} onChange={(e) => setMaintenanceTitle(e.target.value)}
                                                            className="h-9 text-xs rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                                            style={{ backgroundColor: "#080d12", borderColor: "#1a2535", color: "#c8d8e8" }}
                                                            onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                                                            onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2535")} />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <FieldLabel>Banner Message</FieldLabel>
                                                        <Textarea placeholder="e.g. We are currently performing scheduled maintenance." value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} rows={3}
                                                            className="text-xs rounded-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                                            style={{ backgroundColor: "#080d12", borderColor: "#1a2535", color: "#c8d8e8" }}
                                                            onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                                                            onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2535")} />
                                                    </div>
                                                </div>
                                            </SectionCard>
                                            <SectionCard title="Live Preview" description="How the banner appears to users — updates instantly as you type">
                                                <BannerPreview enabled={maintenanceEnabled} title={maintenanceTitle} message={maintenanceMessage} presetId={maintenanceBannerPreset} />
                                            </SectionCard>
                                        </div>
                                    )}

                                    {/* Login Form */}
                                    {activeTab === "login-form" && (
                                        <div className="p-6 space-y-6">
                                            <SectionCard title="Login Form Style" description="Select a visual theme for the login page — applied globally to all users">
                                                <div className="space-y-2">
                                                    {LOGIN_FORM_PRESETS.map((preset) => {
                                                        const isSelected = loginFormPreset === preset.id
                                                        const s = preset.styles
                                                        return (
                                                            <button key={preset.id} onClick={() => setLoginFormPreset(preset.id)}
                                                                className="w-full text-left px-3 py-2.5 border transition-all flex items-start gap-3"
                                                                style={{ borderColor: isSelected ? "#e8630a" : "#1a2535", backgroundColor: isSelected ? "rgba(232,99,10,0.05)" : "#0d1117" }}
                                                            >
                                                                <div className="flex flex-col gap-0.5 mt-0.5 shrink-0 overflow-hidden" style={{ border: `1px solid ${s.card_border}` }}>
                                                                    <div className="w-5 h-2" style={{ backgroundColor: s.card_bg }} />
                                                                    <div className="w-5 h-2" style={{ backgroundColor: s.input_bg }} />
                                                                    <div className="w-5 h-2" style={{ backgroundColor: s.btn_bg }} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: isSelected ? "#e8630a" : "#c8d8e8" }}>{preset.name}</p>
                                                                        <span className="text-[9px] px-1.5 py-0.5 border" style={{ color: "#4a6070", borderColor: "#1a2535", backgroundColor: "#080d12" }}>{preset.fontLabel}</span>
                                                                    </div>
                                                                    <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "#4a6070" }}>{preset.description}</p>
                                                                </div>
                                                                {isSelected && <div className="shrink-0 mt-0.5 flex items-center gap-1" style={{ color: "#e8630a" }}><Check className="size-3" /><span className="text-[9px] font-bold uppercase">Active</span></div>}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </SectionCard>
                                            <SectionCard title="Preview All Login Styles" description="Click any preview to select it">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {LOGIN_FORM_PRESETS.map((preset) => {
                                                        const isSelected = loginFormPreset === preset.id
                                                        return (
                                                            <div key={preset.id} className="overflow-hidden border transition-all cursor-pointer"
                                                                style={{ borderColor: isSelected ? "#e8630a" : "#1a2535" }}
                                                                onClick={() => setLoginFormPreset(preset.id)}
                                                            >
                                                                <div className="px-3 py-1.5 flex items-center justify-between gap-2 border-b"
                                                                    style={{ borderColor: isSelected ? "#e8630a" : "#1a2535", backgroundColor: isSelected ? "rgba(232,99,10,0.05)" : "#0d1117" }}
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span className="text-[10px] font-bold uppercase tracking-widest shrink-0" style={{ color: isSelected ? "#e8630a" : "#4a6070" }}>{preset.name}</span>
                                                                        <span className="text-[9px] truncate" style={{ color: "#253040" }}>{preset.fontLabel}</span>
                                                                    </div>
                                                                    {isSelected && <span className="text-[10px] flex items-center gap-1 shrink-0 font-bold" style={{ color: "#e8630a" }}><Check className="size-3" /> Active</span>}
                                                                </div>
                                                                <div className="p-3" style={{ backgroundColor: "#1a1a12" }}>
                                                                    <LoginFormMiniPreview styles={preset.styles} compact />
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </SectionCard>
                                            <SectionCard
                                                title="Selected Style Preview"
                                                description={`${LOGIN_FORM_PRESETS.find(p => p.id === loginFormPreset)?.name} — ${LOGIN_FORM_PRESETS.find(p => p.id === loginFormPreset)?.description}`}
                                            >
                                                <div className="flex justify-center">
                                                    <div style={{ width: "100%", maxWidth: "220px" }}>
                                                        <LoginFormMiniPreview styles={LOGIN_FORM_PRESETS.find(p => p.id === loginFormPreset)!.styles} />
                                                    </div>
                                                </div>
                                            </SectionCard>
                                        </div>
                                    )}

                                    {/* Reminder */}
                                    {activeTab === "reminder" && (
                                        <div className="p-6 max-w-xl space-y-6">
                                            <SectionCard title="Logout Reminder" description="Configure when the logout reminder dialog appears and how long users can snooze it">
                                                <div className="space-y-5">
                                                    <div className="space-y-1.5">
                                                        <FieldLabel>Reminder Start Time</FieldLabel>
                                                        <p className="text-[11px]" style={{ color: "#253040" }}>
                                                            Currently set to{" "}
                                                            <span style={{ color: "#c8d8e8" }}>
                                                                {(() => { const h = Number(logoutReminderHour); const m = logoutReminderMinute.padStart(2,"0"); const ap = h >= 12 ? "PM" : "AM"; return `${h%12||12}:${m} ${ap}` })()}
                                                            </span>
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <div className="space-y-1">
                                                                <p className="text-[10px] uppercase tracking-widest" style={{ color: "#253040" }}>Hour</p>
                                                                <select value={logoutReminderHour} onChange={(e) => setLogoutReminderHour(e.target.value)}
                                                                    className="h-9 text-xs rounded-none px-2 focus:outline-none"
                                                                    style={{ backgroundColor: "#080d12", border: "1px solid #1a2535", color: "#c8d8e8" }}
                                                                    onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                                                                    onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2535")}
                                                                >
                                                                    {Array.from({ length: 24 }, (_, i) => { const ap = i >= 12 ? "PM" : "AM"; const h12 = i%12||12; return <option key={i} value={String(i)}>{h12} {ap} ({String(i).padStart(2,"0")}:00)</option> })}
                                                                </select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-[10px] uppercase tracking-widest" style={{ color: "#253040" }}>Minute</p>
                                                                <select value={logoutReminderMinute} onChange={(e) => setLogoutReminderMinute(e.target.value)}
                                                                    className="h-9 text-xs rounded-none px-2 focus:outline-none"
                                                                    style={{ backgroundColor: "#080d12", border: "1px solid #1a2535", color: "#c8d8e8" }}
                                                                    onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                                                                    onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2535")}
                                                                >
                                                                    {["00","05","10","15","20","25","30","35","40","45","50","55"].map((m) => <option key={m} value={m}>:{m}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <FieldLabel>Reminder End Time (Hour)</FieldLabel>
                                                        <p className="text-[11px]" style={{ color: "#253040" }}>
                                                            Stop after{" "}
                                                            <span style={{ color: "#c8d8e8" }}>
                                                                {(() => { const h = Number(logoutWindowEnd); const ap = h >= 12 ? "PM" : "AM"; return `${h%12||12}:00 ${ap}` })()}
                                                            </span>
                                                        </p>
                                                        <select value={logoutWindowEnd} onChange={(e) => setLogoutWindowEnd(e.target.value)}
                                                            className="h-9 text-xs rounded-none px-2 focus:outline-none"
                                                            style={{ backgroundColor: "#080d12", border: "1px solid #1a2535", color: "#c8d8e8" }}
                                                            onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                                                            onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2535")}
                                                        >
                                                            {Array.from({ length: 24 }, (_, i) => { const ap = i >= 12 ? "PM" : "AM"; const h12 = i%12||12; return <option key={i} value={String(i)}>{h12}:00 {ap}</option> })}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <FieldLabel>Snooze Duration (minutes)</FieldLabel>
                                                        <div className="flex items-center gap-2">
                                                            <Input type="number" min={1} max={60} value={snoozeDuration} onChange={(e) => setSnoozeDuration(e.target.value)}
                                                                className="h-9 text-xs rounded-none w-24 focus-visible:ring-0 focus-visible:ring-offset-0"
                                                                style={{ backgroundColor: "#080d12", borderColor: "#1a2535", color: "#c8d8e8" }}
                                                                onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                                                                onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2535")} />
                                                            <span className="text-[11px]" style={{ color: "#253040" }}>minutes</span>
                                                        </div>
                                                    </div>
                                                    <div className="border px-4 py-3 space-y-1" style={{ borderColor: "#1a2535", backgroundColor: "#0d1117" }}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] font-bold" style={{ color: "#e8630a" }}>$</span>
                                                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#e8630a" }}>Current Schedule</p>
                                                        </div>
                                                        <p className="text-[11px]" style={{ color: "#4a6070" }}>
                                                            Shows at <span style={{ color: "#c8d8e8" }}>{(() => { const h = Number(logoutReminderHour); const m = logoutReminderMinute.padStart(2,"0"); const ap = h >= 12 ? "PM" : "AM"; return `${h%12||12}:${m} ${ap}` })()}</span>
                                                            {" "}until <span style={{ color: "#c8d8e8" }}>{(() => { const h = Number(logoutWindowEnd); const ap = h >= 12 ? "PM" : "AM"; return `${h%12||12}:00 ${ap}` })()}</span>
                                                            {" "}· Snooze: <span style={{ color: "#c8d8e8" }}>{snoozeDuration} min</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </SectionCard>
                                            <SectionCard title="Message Content" description="Customize the text shown inside the logout reminder dialog">
                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <FieldLabel>Dialog Title</FieldLabel>
                                                        <Input placeholder="e.g. Logout Reminder" value={logoutReminderTitle} onChange={(e) => setLogoutReminderTitle(e.target.value)}
                                                            className="h-9 text-xs rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                                            style={{ backgroundColor: "#080d12", borderColor: "#1a2535", color: "#c8d8e8" }}
                                                            onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                                                            onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2535")} />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <FieldLabel>Dialog Message</FieldLabel>
                                                        <Textarea placeholder="e.g. Please remember to log out before leaving." value={logoutReminderMessage} onChange={(e) => setLogoutReminderMessage(e.target.value)} rows={3}
                                                            className="text-xs rounded-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                                            style={{ backgroundColor: "#080d12", borderColor: "#1a2535", color: "#c8d8e8" }}
                                                            onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                                                            onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2535")} />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <FieldLabel>Snooze Button Label</FieldLabel>
                                                        <Input placeholder="e.g. Snooze (15m)" value={logoutSnoozeLabel} onChange={(e) => setLogoutSnoozeLabel(e.target.value)}
                                                            className="h-9 text-xs rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                                            style={{ backgroundColor: "#080d12", borderColor: "#1a2535", color: "#c8d8e8" }}
                                                            onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                                                            onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2535")} />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <FieldLabel>Dismiss Button Label</FieldLabel>
                                                        <Input placeholder="e.g. Got it" value={logoutDismissLabel} onChange={(e) => setLogoutDismissLabel(e.target.value)}
                                                            className="h-9 text-xs rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                                            style={{ backgroundColor: "#080d12", borderColor: "#1a2535", color: "#c8d8e8" }}
                                                            onFocus={(e) => (e.currentTarget.style.borderColor = "#e8630a")}
                                                            onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2535")} />
                                                    </div>
                                                </div>
                                            </SectionCard>
                                        </div>
                                    )}

                                </div>
                            </div>
                        )}
                    </div>

                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    )
}
