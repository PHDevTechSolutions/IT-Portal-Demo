"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Pagination } from "@/components/app-pagination"
import { Calendar } from "@/components/taskflow/customer-database/calendar"
import { DeleteDialog } from "@/components/taskflow/customer-database/delete"
import { FilterDialog } from "@/components/taskflow/customer-database/filter-dialog"
import { toast } from "sonner"
import {
  Loader2, Search, Trash, FileDown, BadgeCheck, AlertTriangle,
  Clock, XCircle, PauseCircle, UserX, UserCheck, CheckCircle2,
  XOctagon, ChevronDown, ChevronUp, History, ArrowRight,
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  DndContext, closestCenter, MouseSensor, TouchSensor,
  KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id: number; company_name: string; contact_person: string; contact_number: string;
  email_address: string; address: string; region: string; type_client: string;
  referenceid: string; tsm: string; manager: string; status: string; remarks: string;
  date_created: string; date_updated: string; next_available_date?: string; transfer_to: string;
  account_reference_number?: string;
}

interface EditHistoryRow {
  id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by: string;
  reason: string | null;
  account_reference_number: string;
}

// ─── Changes Dialog ───────────────────────────────────────────────────────────
function ChangesDialog({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const [rows,    setRows]    = useState<EditHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")

  const ref = customer.account_reference_number || (customer as any).referenceid

  useEffect(() => {
    if (!ref) { setLoading(false); setError("No account reference number found."); return }
    setLoading(true); setError("")
    fetch(`/api/taskflow/account-edit-history?account_reference_number=${encodeURIComponent(ref)}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error)
        setRows(json.data ?? [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [ref])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div
        className="flex flex-col border border-violet-500/20 bg-[#0d1117] shadow-2xl"
        style={{ width: "min(900px, 96vw)", maxHeight: "88vh" }}>

        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-violet-500/20 bg-[#0a0d14] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/10 border border-violet-500/20">
              <History className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-violet-400 font-mono">
                Pending Changes
              </h2>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                <span className="text-slate-300">{customer.company_name}</span>
                {ref && <span className="text-violet-400/60"> · {ref}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors text-lg leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 className="size-5 animate-spin text-violet-400/40" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-slate-600">Loading changes…</span>
            </div>
          )}
          {!loading && error && (
            <div className="px-6 py-8 text-center">
              <p className="text-[11px] font-mono text-red-400">{error}</p>
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
                No change history found for this account.
              </p>
            </div>
          )}
          {!loading && !error && rows.length > 0 && (
            <table className="w-full text-[11px] font-mono" style={{ minWidth: 700 }}>
              <thead className="sticky top-0 bg-[#0a0d14] z-10">
                <tr className="border-b border-violet-500/15">
                  <th className="px-5 py-3 text-left text-[9px] uppercase tracking-widest text-violet-400/50 font-bold"
                    style={{ width: "22%" }}>Field</th>
                  <th className="px-5 py-3 text-left text-[9px] uppercase tracking-widest text-red-400/50 font-bold"
                    style={{ width: "28%" }}>Old Value</th>
                  <th className="px-2 py-3 text-center text-slate-700"
                    style={{ width: "4%" }}>→</th>
                  <th className="px-5 py-3 text-left text-[9px] uppercase tracking-widest text-emerald-400/50 font-bold"
                    style={{ width: "28%" }}>New Value</th>
                  <th className="px-5 py-3 text-left text-[9px] uppercase tracking-widest text-slate-600 font-bold whitespace-nowrap"
                    style={{ width: "18%" }}>Date Changed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-violet-500/5 transition-colors hover:bg-violet-500/[0.04]",
                      i % 2 === 0 ? "bg-transparent" : "bg-violet-500/[0.02]",
                    )}>
                    {/* Field */}
                    <td className="px-5 py-3 text-violet-300/70 capitalize whitespace-nowrap">
                      {row.field_name?.replace(/_/g, " ") ?? "—"}
                    </td>
                    {/* Old value */}
                    <td className="px-5 py-3 text-red-400/70 line-through decoration-red-500/30 max-w-[180px]">
                      <span className="block truncate" title={row.old_value ?? ""}>
                        {row.old_value || <span className="text-slate-600 no-underline not-italic">empty</span>}
                      </span>
                    </td>
                    {/* Arrow */}
                    <td className="px-2 py-3 text-center text-slate-600">
                      <ArrowRight className="size-3.5 mx-auto" />
                    </td>
                    {/* New value */}
                    <td className="px-5 py-3 text-emerald-400 font-semibold max-w-[180px]">
                      <span className="block truncate" title={row.new_value ?? ""}>
                        {row.new_value || <span className="text-slate-600 font-normal">empty</span>}
                      </span>
                    </td>
                    {/* Date — full format, no wrapping */}
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {row.changed_at
                        ? new Date(row.changed_at).toLocaleDateString("en-PH", {
                            month: "short", day: "numeric", year: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3 border-t border-violet-500/10 bg-[#0a0d14] flex items-center justify-between">
          <span className="text-[9px] font-mono text-slate-600">
            {rows.length > 0
              ? `${rows.length} change${rows.length !== 1 ? "s" : ""} pending review`
              : ""}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-slate-700 text-slate-400 hover:border-violet-500/50 hover:text-violet-400 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string | null }) {
  const s = (status ?? "").trim().toLowerCase()
  if (!s) return <span className="text-[9px] font-mono text-slate-600">—</span>
  if (s === "active") return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 uppercase tracking-widest"><BadgeCheck className="size-3" /> Active</span>
  if (s === "new client") return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-blue-500/30 bg-blue-500/10 text-blue-400 uppercase tracking-widest"><UserCheck className="size-3" /> New Client</span>
  if (s === "non-buying") return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 uppercase tracking-widest"><AlertTriangle className="size-3" /> Non-Buying</span>
  if (s === "inactive") return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-red-500/30 bg-red-500/10 text-red-400 uppercase tracking-widest"><XCircle className="size-3" /> Inactive</span>
  if (s === "on hold") return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-stone-500/30 bg-stone-500/10 text-stone-400 uppercase tracking-widest"><PauseCircle className="size-3" /> On Hold</span>
  if (s === "used") return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-blue-700/40 bg-blue-900/30 text-blue-300 uppercase tracking-widest"><Clock className="size-3" /> Used</span>
  if (s === "approval for transfer") return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-orange-500/30 bg-orange-500/10 text-orange-400 uppercase tracking-widest"><Clock className="size-3" /> Pending Transfer</span>
  if (s === "for approval") return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-violet-500/30 bg-violet-500/10 text-violet-400 uppercase tracking-widest"><Clock className="size-3" /> For Approval</span>
  if (s === "for deletion" || s === "remove") return <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-red-600/30 bg-red-600/10 text-red-400 uppercase tracking-widest"><UserX className="size-3" /> {status}</span>
  return <span className="text-[9px] font-mono text-slate-400 border border-slate-700 px-1.5 py-0.5">{status}</span>
}

// ─── DraggableRow ─────────────────────────────────────────────────────────────
function DraggableRow({ item, isSelected, children }: { item: Customer; isSelected: boolean; children: React.ReactNode }) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <TableRow ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={cn("border-b border-orange-500/5 transition-colors hover:bg-orange-500/[0.04]",
        isSelected && "bg-orange-500/[0.06] border-l-2 border-l-orange-500/50",
        !isSelected && "border-l-2 border-l-transparent")}>
      {children}
    </TableRow>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionDivider({ label, count, accent = "orange", collapsed, onToggle }: {
  label: string; count: number; accent?: "orange" | "violet"; collapsed: boolean; onToggle: () => void;
}) {
  const cls = accent === "violet"
    ? { dot: "bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.8)]", text: "text-violet-400", border: "border-violet-500/20", bg: "bg-violet-500/[0.03]" }
    : { dot: "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]", text: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/[0.03]" }
  return (
    <button onClick={onToggle}
      className={cn("w-full flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b transition-colors hover:bg-slate-800/30", cls.border, cls.bg)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cls.dot)} />
      <span className={cn("text-[10px] font-mono font-bold uppercase tracking-widest", cls.text)}>{label}</span>
      <span className="text-[9px] font-mono text-slate-600 ml-1">({count})</span>
      <div className="ml-auto text-slate-600">
        {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
      </div>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor), useSensor(KeyboardSensor))

  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [isFetching, setIsFetching] = useState(false)
  const [isFiltering, setIsFiltering] = useState(false)
  const [tsaList, setTsaList] = useState<{ value: string; label: string }[]>([])
  const [filterTSA, setFilterTSA] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // ── Selection — separate for each section ─────────────────────────────────
  const [selectedTransferIds, setSelectedTransferIds] = useState<Set<number>>(new Set())
  const [selectAllTransfer, setSelectAllTransfer] = useState(false)
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<Set<number>>(new Set())
  const [selectAllApproval, setSelectAllApproval] = useState(false)

  // ── Collapse state ─────────────────────────────────────────────────────────
  const [transferCollapsed, setTransferCollapsed] = useState(false)
  const [approvalCollapsed, setApprovalCollapsed] = useState(false)

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<"transfer" | "approval">("transfer")
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [hasExported, setHasExported] = useState(false)

  // Changes dialog
  const [changesTarget, setChangesTarget] = useState<Customer | null>(null)

  // ── Auto-refresh + duplicate detection + auto-approve ─────────────────────
  const [autoApproveLog, setAutoApproveLog] = useState<{ name: string; id: number }[]>([])
  const [pendingAutoApprove, setPendingAutoApprove] = useState<Set<number>>(new Set())
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [refreshCountdown, setRefreshCountdown] = useState(5)
  const AUTO_APPROVE_DELAY = 5_000 // 5 seconds

  /**
   * Returns true if `a` and `b` are "similar enough" company names to be
   * considered potential duplicates.
   * Examples: "Ecoshift Corp" ↔ "Ecoshift Corporation"
   */
  const isSimilarName = (a: string, b: string): boolean => {
    if (a === b) return true
    // Normalize: lowercase, strip punctuation, collapse spaces
    const norm = (s: string) => s.toLowerCase()
      .replace(/[.,]/g, "")
      .replace(/\b(corp|corporation|inc|incorporated|co|company|ltd|limited|ent|enterprise|enterprises)\b/g, "")
      .replace(/\s+/g, " ").trim()
    const na = norm(a), nb = norm(b)
    if (na === nb) return true
    // One starts with the other (e.g. "Ecoshift" vs "Ecoshift Corp")
    if (na.startsWith(nb) || nb.startsWith(na)) return true
    // Levenshtein distance ≤ 3 for similar short names
    const len = Math.max(na.length, nb.length)
    if (len === 0) return true
    const dist = levenshtein(na, nb)
    return dist <= Math.min(3, Math.floor(len * 0.25))
  }

  const levenshtein = (a: string, b: string): number => {
    const m = a.length, n = b.length
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
    for (let j = 0; j <= n; j++) dp[0][j] = j
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    return dp[m][n]
  }

  /**
   * For each "For Approval" record, check if its company_name matches any
   * OTHER non-"For Approval" customer.  If duplicate found → flag for manual.
   * If unique → schedule auto-approve after 30s.
   */
  const runDuplicateCheck = (allCustomers: Customer[], approvalList: Customer[]) => {
    const others = allCustomers.filter(c => c.status !== "For Approval")
    const autoIds = new Set<number>()

    for (const app of approvalList) {
      const name = (app.company_name ?? "").trim()
      if (!name) continue
      const hasDuplicate = others.some(o =>
        o.id !== app.id && isSimilarName(name, (o.company_name ?? "").trim()),
      ) || approvalList.filter(a => a.id !== app.id).some(a =>
        isSimilarName(name, (a.company_name ?? "").trim()),
      )
      if (!hasDuplicate) autoIds.add(app.id)
    }
    setPendingAutoApprove(autoIds)
    return autoIds
  }

  // Re-run duplicate check whenever approval list changes
  useEffect(() => {
    const approvalList = customers.filter(c => c.status === "For Approval")
    runDuplicateCheck(customers, approvalList)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers])

  // Schedule auto-approve for unique entries
  useEffect(() => {
    if (pendingAutoApprove.size === 0) return
    const timer = setTimeout(async () => {
      const ids = Array.from(pendingAutoApprove)
      if (ids.length === 0) return
      try {
        const res = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/BulkApproveTransfer",
          { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: ids, status: "Active", updateReferenceIdFromTransferTo: false }) },
        )
        const result = await res.json()
        if (result.success) {
          const approved = customers
            .filter(c => ids.includes(c.id))
            .map(c => ({ name: c.company_name, id: c.id }))
          setCustomers(prev => prev.map(c =>
            ids.includes(c.id) ? { ...c, status: "Active", date_updated: new Date().toISOString() } : c,
          ))
          setAutoApproveLog(prev => [...approved, ...prev].slice(0, 20))
          setPendingAutoApprove(new Set())
          toast.success(`Auto-approved ${ids.length} unique customer${ids.length !== 1 ? "s" : ""}.`)
        }
      } catch { /* silent — will retry on next refresh */ }
    }, AUTO_APPROVE_DELAY)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoApprove])

  // ── Auto-refresh every 30s ─────────────────────────────────────────────────
  const refreshApprovalData = async () => {
    try {
      const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Fetch", { cache: "no-store" })
      const json = await res.json()
      if (json.success) {
        setCustomers(json.data || [])
        setLastRefresh(new Date())
        setRefreshCountdown(5)
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    const interval = setInterval(refreshApprovalData, 5_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Countdown timer display
  useEffect(() => {
    const tick = setInterval(() => {
      setRefreshCountdown(prev => prev <= 1 ? 5 : prev - 1)
    }, 1_000)
    return () => clearInterval(tick)
  }, [])

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/UserManagement/FetchTSA?Role=Territory%20Sales%20Associate")
      .then((r) => r.json()).then((json) => {
        if (Array.isArray(json))
          setTsaList([{ value: "all", label: "All TSA" }, ...json.map((u: any) => ({ value: u.ReferenceID, label: `${u.Firstname} ${u.Lastname}` }))])
      }).catch(console.error)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setIsFetching(true)
      const tid = toast.loading("Fetching customer data…")
      try {
        const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Fetch")
        const json = await res.json()
        setCustomers(json.data || [])
        toast.success("Customer data loaded.", { id: tid })
      } catch { toast.error("Failed to load customer data.", { id: tid }) }
      finally { setIsFetching(false) }
    }
    fetchData()
  }, [])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oi = customers.findIndex((c) => c.id === active.id)
      const ni = customers.findIndex((c) => c.id === over?.id)
      setCustomers(arrayMove(customers, oi, ni))
    }
  }

  const typeOptions = useMemo(() => ["all", ...Array.from(new Set(customers.map((c) => c.type_client).filter(Boolean)))], [customers])
  const statusOptions = useMemo(() => ["all", ...Array.from(new Set(customers.map((c) => c.status).filter(Boolean)))], [customers])

  useEffect(() => {
    setIsFiltering(true)
    const t = setTimeout(() => { setIsFiltering(false); toast.info("Filter updated.") }, 600)
    return () => clearTimeout(t)
  }, [search, filterType, filterStatus])

  useEffect(() => setPage(1), [search, filterType, filterStatus])

  const tsaMap = useMemo(() => {
    const map: Record<string, string> = {}
    tsaList.forEach((t) => { map[t.value.toLowerCase()] = t.label })
    return map
  }, [tsaList])

  // ── Filtered data — split by status ───────────────────────────────────────
  const baseFilter = (c: Customer) => {
    const matchSearch = [c.company_name, c.contact_person, c.email_address, c.region, c.manager, c.tsm].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
    const matchType = filterType === "all" || c.type_client === filterType
    const matchTSA = filterTSA === "all" || c.referenceid?.trim().toLowerCase() === filterTSA.trim().toLowerCase()
    const matchDate = (() => {
      if (!startDate && !endDate) return true
      const d = new Date(c.date_created)
      if (startDate && d < new Date(startDate)) return false
      if (endDate && d > new Date(endDate)) return false
      return true
    })()
    return matchSearch && matchType && matchTSA && matchDate
  }

  // Section 1: "Approval for Transfer" — full transfer flow
  const transferFiltered = useMemo(() =>
    customers.filter((c) => c.status === "Approval for Transfer" && baseFilter(c))
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()),
    [customers, search, filterType, filterTSA, startDate, endDate])

  // Section 2: "For Approval" — status-only update
  const approvalFiltered = useMemo(() =>
    customers.filter((c) => c.status === "For Approval" && baseFilter(c))
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()),
    [customers, search, filterType, filterTSA, startDate, endDate])

  // Pagination per section
  const transferTotalPages = Math.max(1, Math.ceil(transferFiltered.length / rowsPerPage))
  const [transferPage, setTransferPage] = useState(1)
  const transferCurrent = transferFiltered.slice((transferPage - 1) * rowsPerPage, transferPage * rowsPerPage)

  const approvalTotalPages = Math.max(1, Math.ceil(approvalFiltered.length / rowsPerPage))
  const [approvalPage, setApprovalPage] = useState(1)
  const approvalCurrent = approvalFiltered.slice((approvalPage - 1) * rowsPerPage, approvalPage * rowsPerPage)

  const cellBase = "py-2 px-3 border-r border-orange-500/5 last:border-r-0"

  const TABLE_HEADERS = ["Company","Contact","Email","Type","Status","Area","Transfer From","Transfer To","TSM","Manager","Date Created","Date Updated","Next Available"]
  const APPROVAL_HEADERS = ["Company","Contact","Email","Type","Status","Area","TSM","Manager","Date Created","Date Updated"]

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleTransfer = (id: number) => {
    const s = new Set(selectedTransferIds); s.has(id) ? s.delete(id) : s.add(id)
    setSelectedTransferIds(s); setSelectAllTransfer(s.size === transferCurrent.length)
  }
  const handleSelectAllTransfer = () => {
    if (selectAllTransfer) { setSelectedTransferIds(new Set()); setSelectAllTransfer(false) }
    else { setSelectedTransferIds(new Set(transferCurrent.map((c) => c.id))); setSelectAllTransfer(true) }
  }
  const toggleApproval = (id: number) => {
    const s = new Set(selectedApprovalIds); s.has(id) ? s.delete(id) : s.add(id)
    setSelectedApprovalIds(s); setSelectAllApproval(s.size === approvalCurrent.length)
  }
  const handleSelectAllApproval = () => {
    if (selectAllApproval) { setSelectedApprovalIds(new Set()); setSelectAllApproval(false) }
    else { setSelectedApprovalIds(new Set(approvalCurrent.map((c) => c.id))); setSelectAllApproval(true) }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const activeDeleteIds = deleteTarget === "transfer" ? selectedTransferIds : selectedApprovalIds
  const executeBulkDelete = async (): Promise<void> => {
    if (activeDeleteIds.size === 0) { toast.error("No customers selected."); return }
    const ids = Array.from(activeDeleteIds); let count = 0
    let tid = toast.loading(`Deleting 0/${ids.length}…`)
    try {
      const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/BulkDelete", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: ids }) })
      const result = await res.json()
      if (result.success) {
        for (let i = 0; i < ids.length; i++) { count++; toast.dismiss(tid); tid = toast.loading(`Deleting ${count}/${ids.length}…`); await new Promise((r) => setTimeout(r, 30)) }
        toast.success(`Deleted ${count} customers.`)
        setCustomers((prev) => prev.filter((c) => !activeDeleteIds.has(c.id)))
        if (deleteTarget === "transfer") setSelectedTransferIds(new Set())
        else setSelectedApprovalIds(new Set())
      } else { toast.error(result.error || "Bulk delete failed.") }
    } catch { toast.error("Bulk delete failed.") }
  }

  // ── Transfer approval (export-gated) ──────────────────────────────────────
  const executeBulkApprove = async () => {
    if (selectedTransferIds.size === 0) { toast.error("No customers selected."); return }
    setIsApproving(true)
    try {
      const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/BulkApproveTransfer", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: Array.from(selectedTransferIds), status: "Active", updateReferenceIdFromTransferTo: true }) })
      const result = await res.json()
      if (result.success) {
        setCustomers((prev) => prev.map((c) => selectedTransferIds.has(c.id) ? { ...c, status: "Active", date_updated: new Date().toISOString(), referenceid: c.transfer_to || c.referenceid } : c))
        toast.success(`Approved ${selectedTransferIds.size} customers.`)
        setSelectedTransferIds(new Set()); setSelectAllTransfer(false); setShowApproveDialog(false); setHasExported(false)
      } else { toast.error(result.error || "Approval failed.") }
    } catch { toast.error("Approval failed due to network error.") }
    finally { setIsApproving(false) }
  }

  const executeBulkCancelTransfer = async () => {
    if (selectedTransferIds.size === 0) { toast.error("No customers selected."); return }
    setIsApproving(true)
    try {
      const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/BulkCancelTransfer", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: Array.from(selectedTransferIds), status: "Active" }) })
      const result = await res.json()
      if (result.success) {
        setCustomers((prev) => prev.map((c) => selectedTransferIds.has(c.id) ? { ...c, status: "Active", date_updated: new Date().toISOString() } : c))
        toast.success(`Cancelled transfer for ${selectedTransferIds.size} customers.`)
        setSelectedTransferIds(new Set()); setSelectAllTransfer(false)
      } else { toast.error(result.error || "Cancel transfer failed.") }
    } catch { toast.error("Cancel transfer failed due to a network error.") }
    finally { setIsApproving(false) }
  }

  // ── Status-only approval (For Approval section) ───────────────────────────
  const executeStatusApprove = async (newStatus: "Active" | "Inactive") => {
    if (selectedApprovalIds.size === 0) { toast.error("No customers selected."); return }
    setIsApproving(true)
    try {
      const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/BulkApproveTransfer", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: Array.from(selectedApprovalIds), status: newStatus, updateReferenceIdFromTransferTo: false }) })
      const result = await res.json()
      if (result.success) {
        setCustomers((prev) => prev.map((c) => selectedApprovalIds.has(c.id) ? { ...c, status: newStatus, date_updated: new Date().toISOString() } : c))
        toast.success(`${selectedApprovalIds.size} customers set to "${newStatus}".`)
        setSelectedApprovalIds(new Set()); setSelectAllApproval(false)
      } else { toast.error(result.error || "Status update failed.") }
    } catch { toast.error("Status update failed due to network error.") }
    finally { setIsApproving(false) }
  }

  // ── Export (transfer section) ──────────────────────────────────────────────
  const exportToExcel = async () => {
    const ExcelJS = (await import("exceljs")).default
    const { saveAs } = await import("file-saver")
    const wb = new ExcelJS.Workbook()
    const sheet = wb.addWorksheet("Customer Approval")
    sheet.columns = [
      { header: "Company", key: "company_name", width: 35 }, { header: "Contact Person", key: "contact_person", width: 25 },
      { header: "Email", key: "email_address", width: 30 }, { header: "Type", key: "type_client", width: 18 },
      { header: "Status", key: "status", width: 22 }, { header: "Area", key: "region", width: 20 },
      { header: "Transfer From", key: "transfer_from", width: 25 }, { header: "Transfer To", key: "transfer_to_name", width: 25 },
      { header: "TSM", key: "tsm", width: 20 }, { header: "Manager", key: "manager", width: 20 },
      { header: "Date Created", key: "date_created", width: 18 }, { header: "Date Updated", key: "date_updated", width: 18 },
      { header: "Next Available", key: "next_available_date", width: 18 },
    ]
    const hr = sheet.getRow(1)
    hr.eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } }; cell.alignment = { vertical: "middle", horizontal: "center" }; cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } })
    hr.height = 20
    const exportData = selectedTransferIds.size > 0 ? transferFiltered.filter((c) => selectedTransferIds.has(c.id)) : transferFiltered
    exportData.forEach((c, i) => {
      const row = sheet.addRow({ company_name: c.company_name?.toUpperCase() || "", contact_person: c.contact_person || "", email_address: c.email_address || "", type_client: c.type_client || "—", status: c.status || "—", region: c.region || "", transfer_from: tsaMap[c.referenceid?.trim().toLowerCase()] || c.referenceid || "-", transfer_to_name: tsaMap[c.transfer_to?.trim().toLowerCase()] || c.transfer_to || "-", tsm: c.tsm || "", manager: c.manager || "", date_created: c.date_created ? new Date(c.date_created).toLocaleDateString() : "", date_updated: c.date_updated ? new Date(c.date_updated).toLocaleDateString() : "", next_available_date: c.next_available_date ? new Date(c.next_available_date).toLocaleDateString() : "-" })
      const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF0F4FA"
      row.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }; cell.alignment = { vertical: "middle", wrapText: true }; cell.border = { top: { style: "thin", color: { argb: "FFD0D0D0" } }, left: { style: "thin", color: { argb: "FFD0D0D0" } }, bottom: { style: "thin", color: { argb: "FFD0D0D0" } }, right: { style: "thin", color: { argb: "FFD0D0D0" } } } })
    })
    const buf = await wb.xlsx.writeBuffer()
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `customer-approval-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success("Excel exported. Approval unlocked.")
    setHasExported(true)
  }

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-[#0a0d14] text-slate-100 flex flex-col h-svh overflow-hidden">

          {/* ── Header ── */}
          <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-orange-500/20 bg-[#0d1117]/90 backdrop-blur-sm overflow-hidden">
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/50" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/50" />
            <div className="flex items-center gap-2 px-4 relative z-10">
              <SidebarTrigger className="-ml-1 text-orange-400/70 hover:text-orange-300 hover:bg-orange-500/10" />
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 text-xs hidden sm:flex font-mono">Home</Button>
              <Separator orientation="vertical" className="h-4 bg-orange-500/20 hidden sm:block" />
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Taskflow</div>
              <span className="text-slate-700 text-xs">›</span>
              <div className="text-[10px] font-mono uppercase tracking-widest text-orange-400">Customer Approval</div>
            </div>
            <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-slate-600 uppercase tracking-widest px-4">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]" />
                <span className="text-orange-400/60">Live</span>
              </div>
              <div className="w-px h-3 bg-slate-700" />
              <span className="text-orange-400/60">{transferFiltered.length + approvalFiltered.length} total</span>
            </div>
          </header>

          {/* ── Page title bar ── */}
          <div className="shrink-0 px-4 sm:px-6 pt-3 pb-2 border-b border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="relative p-2 bg-orange-500/10 border border-orange-500/30">
                <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-orange-500/50" />
                <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-orange-500/50" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-orange-500/50" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-orange-500/50" />
                <CheckCircle2 className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-widest uppercase text-orange-400 font-mono leading-tight">Customer Approval</h1>
                <p className="text-[10px] text-slate-600 font-mono mt-0.5 tracking-wider">
                  {isFetching ? "Loading…" : (
                    <><span className="text-violet-400 font-semibold">{approvalFiltered.length}</span> for approval · <span className="text-orange-400 font-semibold">{transferFiltered.length}</span> pending transfer</>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* ── Shared toolbar ── */}
          <div className="shrink-0 px-4 sm:px-6 py-2 border-b border-slate-800/60">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                <div className="relative min-w-[160px] max-w-xs">
                  <Search className="absolute left-2 top-2.5 size-3.5 text-slate-600" />
                  <Input placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)}
                    className="pl-7 h-9 text-xs bg-[#0d1117] border-slate-800 text-slate-300 placeholder:text-slate-700 focus:border-orange-500/40 rounded-none font-mono" />
                  {isFiltering && <Loader2 className="absolute right-2 top-2.5 size-3.5 animate-spin text-slate-500" />}
                </div>
                <Calendar startDate={startDate} endDate={endDate} setStartDateAction={setStartDate} setEndDateAction={setEndDate} />
                <FilterDialog filterTSA={filterTSA} setFilterTSA={setFilterTSA} tsaList={tsaList} filterType={filterType} setFilterType={setFilterType} typeOptions={typeOptions} filterStatus={filterStatus} setFilterStatus={setFilterStatus} statusOptions={statusOptions} rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} setPage={setPage} />
              </div>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">

            {/* ════════════════════════════════════════════════════════════
                SECTION 1 — FOR APPROVAL (status-only update)
            ════════════════════════════════════════════════════════════ */}
            <SectionDivider label="For Approval" count={approvalFiltered.length} accent="violet"
              collapsed={approvalCollapsed} onToggle={() => setApprovalCollapsed((v) => !v)} />

            {!approvalCollapsed && (
              <div className="px-4 sm:px-6 py-3 space-y-3">
                {/* Auto-refresh + auto-approve status bar */}
                <div className="flex items-center gap-3 px-3 py-2 border border-violet-500/10 bg-violet-500/[0.03]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    <span className="text-[9px] font-mono text-violet-400/60 uppercase tracking-widest">
                      Auto-refresh in {refreshCountdown}s
                    </span>
                  </div>
                  {pendingAutoApprove.size > 0 && (
                    <>
                      <div className="w-px h-3 bg-slate-700" />
                      <span className="text-[9px] font-mono text-emerald-400/70 uppercase tracking-widest">
                        {pendingAutoApprove.size} unique → auto-approving in ~{refreshCountdown}s
                      </span>
                    </>
                  )}
                  {autoApproveLog.length > 0 && (
                    <>
                      <div className="w-px h-3 bg-slate-700" />
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                        Last: {autoApproveLog[0].name}
                      </span>
                    </>
                  )}
                  <button
                    onClick={refreshApprovalData}
                    className="ml-auto text-[9px] font-mono uppercase tracking-widest text-slate-600 hover:text-violet-400 transition-colors flex items-center gap-1">
                    <Loader2 className="size-2.5" /> Refresh now
                  </button>
                </div>
                {/* Section toolbar */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedApprovalIds.size > 0 && (<>
                    <button onClick={() => executeStatusApprove("Active")} disabled={isApproving}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[9px] font-mono uppercase tracking-widest border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors">
                      <CheckCircle2 className="size-3.5" /> Approve → Active ({selectedApprovalIds.size})
                    </button>
                    <button onClick={() => executeStatusApprove("Inactive")} disabled={isApproving}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[9px] font-mono uppercase tracking-widest border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors">
                      <XCircle className="size-3.5" /> Reject → Inactive ({selectedApprovalIds.size})
                    </button>
                    <button onClick={() => { setDeleteTarget("approval"); setShowDeleteDialog(true) }}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[9px] font-mono uppercase tracking-widest border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                      <Trash className="size-3.5" /> Delete ({selectedApprovalIds.size})
                    </button>
                  </>)}
                  <div className="ml-auto">
                    <Pagination page={approvalPage} totalPages={approvalTotalPages} onPageChangeAction={setApprovalPage} />
                  </div>
                </div>

                {/* Cards */}
                {isFetching ? (
                  <div className="py-8 flex flex-col items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-violet-500/40" />
                    <span className="text-[9px] font-mono uppercase tracking-widest text-violet-500/30">Loading…</span>
                  </div>
                ) : approvalCurrent.length === 0 ? (
                  <div className="py-8 flex flex-col items-center gap-2">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-violet-500/30">No records for approval.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {approvalCurrent.map((c) => {
                      const isSel = selectedApprovalIds.has(c.id)
                      const willAutoApprove = pendingAutoApprove.has(c.id)
                      // Check if this card has a duplicate company name
                      const hasDuplicate = !willAutoApprove
                      return (
                        <div key={c.id} className={cn("border transition-colors",
                          hasDuplicate ? "border-amber-500/20 bg-amber-500/[0.03]" :
                          willAutoApprove ? "border-emerald-500/20 bg-emerald-500/[0.03]" :
                          isSel ? "border-violet-500/40 bg-violet-500/[0.06]" :
                          "border-violet-500/10 bg-[#0d1117] hover:border-violet-500/30")}>
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-violet-500/10 bg-[#0a0d14]">
                            <input type="checkbox" checked={isSel} onChange={() => toggleApproval(c.id)} className="accent-violet-500" />
                            <span className="text-[9px] font-mono flex-1 truncate"
                              style={{ color: hasDuplicate ? "#fbbf24" : willAutoApprove ? "#34d399" : "rgba(167,139,250,0.3)" }}>
                              {c.company_name}
                            </span>
                            {/* Duplicate warning */}
                            {hasDuplicate && (
                              <span className="shrink-0 text-[8px] font-mono font-bold px-1.5 py-0.5 border border-amber-500/30 bg-amber-500/10 text-amber-400 uppercase">
                                ⚠ Duplicate
                              </span>
                            )}
                            {/* Auto-approve indicator */}
                            {willAutoApprove && (
                              <span className="shrink-0 text-[8px] font-mono font-bold px-1.5 py-0.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 uppercase">
                                ✓ Auto
                              </span>
                            )}
                            {/* Clickable badge → opens changes dialog */}
                            <button
                              onClick={() => setChangesTarget(c)}
                              title="View pending changes"
                              className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 border border-violet-500/30 bg-violet-500/10 text-violet-400 uppercase tracking-widest hover:bg-violet-500/20 hover:border-violet-400/60 transition-colors">
                              <Clock className="size-3" /> For Approval
                            </button>
                          </div>
                          <div className="p-3 space-y-1.5">
                            {[["Contact", c.contact_person], ["Phone", c.contact_number], ["Email", c.email_address], ["Type", c.type_client], ["Region", c.region], ["TSM", c.tsm], ["Manager", c.manager]].map(([label, value]) => (
                              <div key={label} className="flex items-start justify-between gap-2">
                                <span className="text-[9px] font-mono uppercase text-violet-500/40 shrink-0">{label}</span>
                                <span className="text-[10px] font-mono text-slate-300 text-right truncate max-w-[160px]">{value || "—"}</span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between pt-1.5 border-t border-violet-500/10">
                              <span className="text-[9px] font-mono uppercase text-violet-500/40">Created</span>
                              <span className="text-[10px] font-mono text-slate-500">{new Date(c.date_created).toLocaleDateString()}</span>
                            </div>
                            {/* View changes link */}
                            <button
                              onClick={() => setChangesTarget(c)}
                              className="w-full flex items-center justify-center gap-1.5 mt-1 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-violet-500/20 text-violet-400/60 hover:border-violet-500/50 hover:text-violet-400 transition-colors">
                              <History className="size-3" /> View Changes
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                SECTION 2 — APPROVAL FOR TRANSFER (export-gated)
            ════════════════════════════════════════════════════════════ */}
            <SectionDivider label="Approval for Transfer" count={transferFiltered.length} accent="orange"
              collapsed={transferCollapsed} onToggle={() => setTransferCollapsed((v) => !v)} />

            {!transferCollapsed && (
              <div className="px-4 sm:px-6 py-3 space-y-3">
                {/* Section toolbar */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedTransferIds.size > 0 && (<>
                    <button onClick={() => { setHasExported(false); setShowApproveDialog(true) }}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[9px] font-mono uppercase tracking-widest border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                      <CheckCircle2 className="size-3.5" /> Approve ({selectedTransferIds.size})
                    </button>
                    <button onClick={executeBulkCancelTransfer} disabled={isApproving}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[9px] font-mono uppercase tracking-widest border border-slate-700 bg-[#0d1117] text-slate-400 hover:border-orange-500/40 hover:text-orange-300 disabled:opacity-40 transition-colors">
                      <XOctagon className="size-3.5" /> Cancel ({selectedTransferIds.size})
                    </button>
                    <button onClick={() => { setDeleteTarget("transfer"); setShowDeleteDialog(true) }}
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-[9px] font-mono uppercase tracking-widest border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                      <Trash className="size-3.5" /> Delete ({selectedTransferIds.size})
                    </button>
                  </>)}
                  <div className="ml-auto">
                    <Pagination page={transferPage} totalPages={transferTotalPages} onPageChangeAction={setTransferPage} />
                  </div>
                </div>

                {/* Table */}
                <div className="border border-orange-500/10 bg-[#0a0d14] overflow-auto">
                  {isFetching ? (
                    <div className="py-12 flex flex-col items-center gap-2">
                      <Loader2 className="size-4 animate-spin text-orange-500/40" />
                      <span className="text-[9px] font-mono uppercase tracking-widest text-orange-500/30">Loading…</span>
                    </div>
                  ) : transferCurrent.length > 0 ? (
                    <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
                      <SortableContext items={transferCurrent.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        <Table className="whitespace-nowrap text-[11px] min-w-full">
                          <TableHeader className="sticky top-0 z-10">
                            <TableRow className="border-b border-orange-500/20 bg-[#0d1117] hover:bg-[#0d1117]">
                              <TableHead className="w-8 text-center py-2 px-3">
                                <input type="checkbox" checked={selectAllTransfer} onChange={handleSelectAllTransfer} className="accent-orange-500" />
                              </TableHead>
                              {TABLE_HEADERS.map((h) => (
                                <TableHead key={h} className="py-2 px-3 text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/60 border-r border-orange-500/5 last:border-r-0">{h}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transferCurrent.map((c) => {
                              const isSel = selectedTransferIds.has(c.id)
                              return (
                                <DraggableRow key={c.id} item={c} isSelected={isSel}>
                                  <TableCell className={cn(cellBase, "text-center w-8")}>
                                    <input type="checkbox" checked={isSel} onChange={() => toggleTransfer(c.id)} className="accent-orange-500" />
                                  </TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[200px]")}><p className="font-mono text-[11px] uppercase font-semibold text-slate-200 truncate max-w-[200px]">{c.company_name}</p></TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[140px] capitalize text-slate-300")}>{c.contact_person}</TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[180px] text-slate-500 font-mono text-[10px]")}>{c.email_address}</TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[100px] text-slate-300")}>{c.type_client || <span className="text-slate-600">—</span>}</TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[130px]")}><StatusBadge status={c.status} /></TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[100px] text-slate-300")}>{c.region}</TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[130px] text-slate-400 font-mono text-[10px]")}>{tsaMap[c.referenceid?.trim().toLowerCase()] || c.referenceid || <span className="text-slate-600">—</span>}</TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[130px] text-orange-400 font-mono text-[10px] font-semibold")}>{tsaMap[c.transfer_to?.trim().toLowerCase()] || c.transfer_to || <span className="text-slate-600">—</span>}</TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[100px] text-slate-400 font-mono text-[10px]")}>{c.tsm}</TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[100px] text-slate-400 font-mono text-[10px]")}>{c.manager}</TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[100px] text-slate-500 font-mono text-[10px]")}>{new Date(c.date_created).toLocaleDateString()}</TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[100px] text-slate-500 font-mono text-[10px]")}>{new Date(c.date_updated).toLocaleDateString()}</TableCell>
                                  <TableCell className={cn(cellBase, "min-w-[100px] text-slate-500 font-mono text-[10px]")}>{c.next_available_date ? new Date(c.next_available_date).toLocaleDateString() : <span className="text-slate-600">—</span>}</TableCell>
                                </DraggableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="py-12 flex flex-col items-center gap-2">
                      <p className="text-[9px] font-mono uppercase tracking-widest text-orange-500/30">No customers pending transfer approval.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Export-gate Approval Dialog (transfer section only) ── */}
          {showApproveDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="w-full max-w-md border border-orange-500/20 bg-[#0d1117] shadow-2xl">
                <div className="px-5 py-4 border-b border-slate-700/60 bg-slate-800/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 border border-orange-500/20"><CheckCircle2 className="w-4 h-4 text-orange-400" /></div>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-widest text-orange-400 font-mono">Transfer Approval</h2>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{selectedTransferIds.size} customer{selectedTransferIds.size !== 1 ? "s" : ""} selected</p>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <p className="text-[11px] text-slate-400 font-mono leading-relaxed">Export is required before approval can be confirmed. This creates an audit trail of the transfer.</p>
                  {/* Step 1 */}
                  <div className="border border-slate-700/60 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className={cn("mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center border text-[9px] font-mono font-bold", hasExported ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-orange-500/30 bg-orange-500/10 text-orange-400")}>{hasExported ? "✓" : "1"}</div>
                        <div>
                          <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-200">Export Excel</p>
                          <p className="text-[10px] text-slate-600 font-mono mt-0.5">{hasExported ? "Export complete — approval unlocked." : "Download approval report before confirming."}</p>
                        </div>
                      </div>
                      <button onClick={exportToExcel}
                        className={cn("shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors",
                          hasExported ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20")}>
                        <FileDown className="size-3.5" />{hasExported ? "Re-export" : "Export"}
                      </button>
                    </div>
                  </div>
                  {/* Step 2 */}
                  <div className={cn("border p-3 transition-all", hasExported ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-slate-800 bg-black/20 opacity-50")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className={cn("mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center border text-[9px] font-mono font-bold", hasExported ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-slate-700 bg-slate-800 text-slate-600")}>2</div>
                        <div>
                          <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-200">Final Approval</p>
                          <p className="text-[10px] text-slate-600 font-mono mt-0.5">{hasExported ? "Ready to approve transfer." : "Locked until export is completed."}</p>
                        </div>
                      </div>
                      <button disabled={!hasExported || isApproving} onClick={executeBulkApprove}
                        className={cn("shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest border transition-colors",
                          hasExported && !isApproving ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-slate-700 bg-slate-800 text-slate-600 cursor-not-allowed")}>
                        {isApproving ? <><Loader2 className="size-3.5 animate-spin" /> Approving…</> : <><CheckCircle2 className="size-3.5" /> Approve</>}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/60 flex justify-end">
                  <button onClick={() => setShowApproveDialog(false)}
                    className="px-4 py-1.5 text-[9px] font-mono uppercase tracking-widest border border-slate-700 bg-transparent text-slate-400 hover:border-orange-500/30 hover:text-orange-400 transition-colors">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          <DeleteDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} selectedCount={activeDeleteIds.size} onConfirm={executeBulkDelete} />

          {/* Changes dialog */}
          {changesTarget && (
            <ChangesDialog customer={changesTarget} onClose={() => setChangesTarget(null)} />
          )}

        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  )
}
