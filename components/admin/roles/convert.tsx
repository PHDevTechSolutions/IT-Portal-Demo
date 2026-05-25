"use client";
import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, Mail, ArrowRight, RotateCcw, X, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Account {
  _id: string; Email: string; Department?: string;
  Firstname?: string; Lastname?: string;
}
interface ConvertEmailDialogProps {
  open: boolean; onOpenChangeAction: (open: boolean) => void;
  accounts: Account[]; setAccountsAction: React.Dispatch<React.SetStateAction<any[]>>;
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
};

const DOMAINS = [
  { value: "disruptivesolutionsinc.com", label: "Disruptive Solutions Inc", badge: "DSI",   color: "#60a5fa" },
  { value: "ecoshiftcorp.com",           label: "Ecoshift Corporation",     badge: "ECO",   color: "#34d399" },
  { value: "gmail.com",                  label: "Gmail",                    badge: "Gmail", color: "#f87171" },
];

function getLocalPart(email: string) { return email.split("@")[0] ?? email; }
function getDomain(email: string)    { return email.split("@")[1] ?? ""; }

export function ConvertEmailDialog({ open, onOpenChangeAction, accounts, setAccountsAction }: ConvertEmailDialogProps) {
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [targetDomain, setTargetDomain] = useState("");
  const [filterDomain, setFilterDomain] = useState("all");
  const [filterDept,   setFilterDept]   = useState("all");
  const [search,       setSearch]       = useState("");
  const [converting,   setConverting]   = useState(false);

  const departments = useMemo(() => {
    const s = new Set(accounts.map(a => a.Department).filter(Boolean) as string[]);
    return ["all", ...Array.from(s).sort()];
  }, [accounts]);

  const filtered = useMemo(() => accounts.filter(a => {
    const domain = getDomain(a.Email ?? "");
    const name   = `${a.Firstname ?? ""} ${a.Lastname ?? ""} ${a.Email ?? ""}`.toLowerCase();
    if (filterDomain !== "all" && domain !== filterDomain) return false;
    if (filterDept   !== "all" && a.Department !== filterDept) return false;
    if (search.trim() && !name.includes(search.toLowerCase())) return false;
    return true;
  }), [accounts, filterDomain, filterDept, search]);

  const allSelected  = filtered.length > 0 && filtered.every(a => selectedIds.has(a._id));

  const toggleOne = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleAll = () => {
    if (allSelected) setSelectedIds(prev => { const n = new Set(prev); filtered.forEach(a => n.delete(a._id)); return n; });
    else             setSelectedIds(prev => { const n = new Set(prev); filtered.forEach(a => n.add(a._id));    return n; });
  };

  const reset = () => { setFilterDomain("all"); setFilterDept("all"); setSearch(""); };
  const close = () => { setSelectedIds(new Set()); reset(); setTargetDomain(""); onOpenChangeAction(false); };

  const handleConvert = async () => {
    if (!targetDomain)       return toast.error("Select a target domain first.");
    if (selectedIds.size===0) return toast.error("Select at least one account.");
    setConverting(true);
    const tid = toast.loading("Converting emails…");
    try {
      const res    = await fetch("/api/UserManagement/ConvertEmail", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), targetDomain }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Conversion failed");
      setAccountsAction(prev => prev.map(acc =>
        selectedIds.has(acc._id)
          ? { ...acc, Email: getLocalPart(acc.Email ?? "") + "@" + targetDomain }
          : acc
      ));
      toast.success(`${selectedIds.size} email${selectedIds.size>1?"s":""} converted.`, { id: tid });
      close();
    } catch (err) {
      toast.error((err as Error).message, { id: tid });
    } finally {
      setConverting(false);
    }
  };

  const hasFilters = filterDomain !== "all" || filterDept !== "all" || !!search.trim();

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="max-w-2xl rounded-none p-0 gap-0"
        style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, fontFamily: C.font }}
      >
        {/* ── Header ── */}
        <DialogHeader className="px-5 py-4 border-b" style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border"
              style={{ borderColor: C.border, backgroundColor: "#0f1923" }}>
              <Mail className="size-4" style={{ color: C.accent }} />
            </div>
            <div>
              <DialogTitle className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accent }}>
                Email Domain Conversion
              </DialogTitle>
              <DialogDescription className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>
                Filter and select accounts to convert email domains
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">

          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3" style={{ color: C.dim }} />
              <input placeholder="Search name or email…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 h-8 text-[11px] focus:outline-none"
                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
              />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="size-3" style={{ color: C.dim }} /></button>}
            </div>

            {/* Domain filter */}
            <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
              <option value="all">All Domains</option>
              {DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>

            {/* Dept filter */}
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
              className="h-8 text-[11px] px-2 focus:outline-none"
              style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.font }}>
              {departments.map(d => <option key={d} value={d}>{d === "all" ? "All Departments" : d}</option>)}
            </select>

            {hasFilters && (
              <button onClick={reset}
                className="flex items-center gap-1 h-8 px-2 text-[10px] font-bold uppercase tracking-wider transition-colors"
                style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                <RotateCcw className="size-3" /> Reset
              </button>
            )}
          </div>

          {/* ── Select all bar ── */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none text-[11px]"
              style={{ color: C.dim }}>
              <Checkbox checked={allSelected} onCheckedChange={toggleAll}
                className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 h-3.5 w-3.5" />
              {selectedIds.size > 0
                ? <><span className="font-bold" style={{ color: C.text }}>{selectedIds.size}</span> selected</>
                : `Select all visible (${filtered.length})`}
            </label>
            {selectedIds.size > 0 && (
              <button onClick={() => setSelectedIds(new Set())}
                className="text-[10px] font-bold uppercase tracking-wider transition-colors"
                style={{ color: C.dim }}
                onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
                Clear
              </button>
            )}
          </div>

          {/* ── Account list ── */}
          <div className="max-h-56 overflow-y-auto border" style={{ borderColor: C.border }}>
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>
                No accounts match your filters.
              </p>
            ) : filtered.map((acc, i) => {
              const selected    = selectedIds.has(acc._id);
              const currentDom  = getDomain(acc.Email ?? "");
              const domOpt      = DOMAINS.find(d => d.value === currentDom);
              const willChange  = selected && targetDomain && targetDomain !== currentDom;
              return (
                <div key={acc._id}
                  onClick={() => toggleOne(acc._id)}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b last:border-b-0 transition-colors"
                  style={{
                    borderColor: C.muted + "30",
                    backgroundColor: selected ? "rgba(232,99,10,0.06)" : i%2===0 ? C.bg : C.panel,
                  }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.03)"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = selected ? "rgba(232,99,10,0.06)" : i%2===0 ? C.bg : C.panel; }}>
                  <Checkbox checked={selected} onCheckedChange={() => toggleOne(acc._id)}
                    onClick={e => e.stopPropagation()}
                    className="rounded-none border-orange-500/40 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 h-3.5 w-3.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold" style={{ color: C.text }}>
                        {acc.Firstname} {acc.Lastname}
                      </span>
                      {acc.Department && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 border"
                          style={{ borderColor: C.border, color: C.dim }}>
                          {acc.Department}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px]" style={{ color: C.muted }}>{acc.Email}</span>
                      {willChange && (
                        <>
                          <ArrowRight className="size-2.5 shrink-0" style={{ color: C.dim }} />
                          <span className="text-[10px] font-bold" style={{ color: C.accent }}>
                            {getLocalPart(acc.Email ?? "")}@{targetDomain}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {domOpt && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 border shrink-0"
                      style={{ borderColor: domOpt.color + "40", color: domOpt.color, backgroundColor: domOpt.color + "10" }}>
                      {domOpt.badge}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Target domain selector ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.dim }}>
              Convert selected to
            </p>
            <div className="flex flex-wrap gap-2">
              {DOMAINS.map(d => (
                <button key={d.value} onClick={() => setTargetDomain(d.value)}
                  className="flex items-center gap-2 px-3 py-2 border text-[11px] font-bold transition-colors"
                  style={{
                    borderColor: targetDomain === d.value ? C.accent : C.border,
                    backgroundColor: targetDomain === d.value ? "rgba(232,99,10,0.1)" : "transparent",
                    color: targetDomain === d.value ? C.accent : C.dim,
                  }}
                  onMouseEnter={e => { if (targetDomain !== d.value) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}}
                  onMouseLeave={e => { if (targetDomain !== d.value) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}}>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 border"
                    style={{ borderColor: d.color + "40", color: d.color, backgroundColor: d.color + "10" }}>
                    {d.badge}
                  </span>
                  {d.label}
                  <span className="text-[9px]" style={{ color: C.muted }}>@{d.value}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t"
          style={{ borderColor: C.border, backgroundColor: C.bg }}>
          <p className="text-[10px]" style={{ color: C.muted }}>
            {selectedIds.size > 0 && targetDomain
              ? <><span style={{ color: C.text }}>{selectedIds.size}</span> account{selectedIds.size>1?"s":""} → <span style={{ color: C.accent }}>@{targetDomain}</span></>
              : "Select accounts and target domain"}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={close}
              className="h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors"
              style={{ borderColor: C.border, color: C.dim, backgroundColor: "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.dim; }}>
              Cancel
            </button>
            <button onClick={handleConvert} disabled={converting || selectedIds.size===0 || !targetDomain}
              className="flex items-center gap-1.5 h-8 px-4 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-40"
              style={{ backgroundColor: "rgba(232,99,10,0.15)", borderColor: C.accent, color: C.accent }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.25)"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(232,99,10,0.15)"; }}>
              {converting ? <Loader2 className="size-3 animate-spin" /> : null}
              {converting ? "Converting…" : `Convert${selectedIds.size>0 ? ` (${selectedIds.size})` : ""}`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
