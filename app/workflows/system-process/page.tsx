"use client";

/**
 * System Process — Visual Flowchart Builder
 * Shapes, conditions, connectors — all saved to MongoDB.
 * Supports multiple named diagrams (files) with auto-save.
 */

import React, {
  useCallback, useRef, useState, useEffect,
} from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow,
  BackgroundVariant,
  type Node, type Edge, type Connection, type NodeTypes,
  MarkerType, ConnectionMode,
  EdgeLabelRenderer, BaseEdge, type EdgeProps, getBezierPath,
  Handle, Position, type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AppSidebar }          from "@/components/app-sidebar";
import { PageShell }           from "@/components/page-shell";
import { SidebarProvider }     from "@/components/ui/sidebar";
import ProtectedPageWrapper    from "@/components/protected-page-wrapper";
import { NotificationBell }    from "@/components/notifications/NotificationBell";
import {
  GitBranch, Trash2, Download, Upload, ZoomIn, ZoomOut, Maximize2,
  X, Square, Diamond, Circle, FileText, Database as DatabaseIcon,
  Users, Layers, Type, Copy, Plus, File, FolderOpen,
  Pencil, Check, Loader2, Triangle, Server, Router, Wifi,
  Shield, Cloud, Monitor, HardDrive, Network, Table2, Key,
  Link, Cpu, GitMerge,
} from "lucide-react";
import { toast } from "react-toastify";
import html2canvas from "html2canvas";

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
interface DiagramMeta {
  id: string; name: string;
  nodeCount: number; edgeCount: number;
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════
   SHAPE PALETTE
═══════════════════════════════════════════════════════════ */
interface ShapeDef { type: string; label: string; icon: React.ReactNode; description: string; category: string; }

const SHAPE_PALETTE: ShapeDef[] = [
  // ── Flowchart ──────────────────────────────────────────
  { type: "startEnd",       label: "Start / End",    icon: <Circle      className="w-3.5 h-3.5" />, description: "Terminal node",       category: "Flowchart" },
  { type: "process",        label: "Process",         icon: <Square      className="w-3.5 h-3.5" />, description: "Action or step",      category: "Flowchart" },
  { type: "decision",       label: "Decision",        icon: <Diamond     className="w-3.5 h-3.5" />, description: "Yes/No condition",    category: "Flowchart" },
  { type: "document",       label: "Document",        icon: <FileText    className="w-3.5 h-3.5" />, description: "Document/report",     category: "Flowchart" },
  { type: "database",       label: "Database",        icon: <DatabaseIcon className="w-3.5 h-3.5" />, description: "Data store",         category: "Flowchart" },
  { type: "parallelogram",  label: "Input / Output",  icon: <Triangle    className="w-3.5 h-3.5" />, description: "I/O operation",      category: "Flowchart" },
  { type: "actor",          label: "Actor / Role",    icon: <Users       className="w-3.5 h-3.5" />, description: "Person or system",    category: "Flowchart" },
  { type: "module",         label: "ERP Module",      icon: <Layers      className="w-3.5 h-3.5" />, description: "System module",       category: "Flowchart" },
  { type: "annotation",     label: "Note",            icon: <Type        className="w-3.5 h-3.5" />, description: "Annotation/note",     category: "Flowchart" },
  // ── Network / IT ──────────────────────────────────────
  { type: "itServer",       label: "Server",          icon: <Server      className="w-3.5 h-3.5" />, description: "Physical/virtual server",  category: "Network / IT" },
  { type: "itRouter",       label: "Router",          icon: <Router      className="w-3.5 h-3.5" />, description: "Network router",           category: "Network / IT" },
  { type: "itSwitch",       label: "Switch",          icon: <Network     className="w-3.5 h-3.5" />, description: "Network switch",           category: "Network / IT" },
  { type: "itFirewall",     label: "Firewall",        icon: <Shield      className="w-3.5 h-3.5" />, description: "Firewall / security",      category: "Network / IT" },
  { type: "itCloud",        label: "Cloud",           icon: <Cloud       className="w-3.5 h-3.5" />, description: "Cloud service / provider", category: "Network / IT" },
  { type: "itClient",       label: "Client / PC",     icon: <Monitor     className="w-3.5 h-3.5" />, description: "Workstation / endpoint",   category: "Network / IT" },
  { type: "itNas",          label: "Storage / NAS",   icon: <HardDrive   className="w-3.5 h-3.5" />, description: "Storage device / NAS",     category: "Network / IT" },
  { type: "itWifi",         label: "Access Point",    icon: <Wifi        className="w-3.5 h-3.5" />, description: "Wireless access point",    category: "Network / IT" },
  { type: "itIsp",          label: "ISP / Internet",  icon: <GitMerge    className="w-3.5 h-3.5" />, description: "ISP or internet cloud",    category: "Network / IT" },
  { type: "annotation",     label: "Note",            icon: <Type        className="w-3.5 h-3.5" />, description: "Label / note",             category: "Network / IT" },
  // ── Database Diagram ──────────────────────────────────
  { type: "dbTable",        label: "Table / Entity",  icon: <Table2      className="w-3.5 h-3.5" />, description: "DB table or entity",       category: "Database" },
  { type: "dbView",         label: "View",            icon: <Layers      className="w-3.5 h-3.5" />, description: "Database view",            category: "Database" },
  { type: "dbIndex",        label: "Index",           icon: <Cpu         className="w-3.5 h-3.5" />, description: "Table index",              category: "Database" },
  { type: "annotation",     label: "Note",            icon: <Type        className="w-3.5 h-3.5" />, description: "Label / note",             category: "Database" },
];

/* ═══════════════════════════════════════════════════════════
   HANDLE HELPERS
   Every node gets 4 handles (top/right/bottom/left), each
   acting as BOTH source and target so edges always land on
   the exact dot you drag to/from.
═══════════════════════════════════════════════════════════ */
const HS: React.CSSProperties = {
  width: 10, height: 10,
  background: "#fb923c",
  border: "2px solid #0d1117",
};

/** Drop-in set of 4 bidirectional handles for rectangular nodes */
function AllHandles({ opacity = 1 }: { opacity?: number }) {
  const s = { ...HS, opacity };
  return (
    <>
      <Handle id="t"  type="source" position={Position.Top}    style={s} />
      <Handle id="t"  type="target" position={Position.Top}    style={{ ...s, pointerEvents: "none" }} />
      <Handle id="r"  type="source" position={Position.Right}  style={s} />
      <Handle id="r"  type="target" position={Position.Right}  style={{ ...s, pointerEvents: "none" }} />
      <Handle id="b"  type="source" position={Position.Bottom} style={s} />
      <Handle id="b"  type="target" position={Position.Bottom} style={{ ...s, pointerEvents: "none" }} />
      <Handle id="l"  type="source" position={Position.Left}   style={s} />
      <Handle id="l"  type="target" position={Position.Left}   style={{ ...s, pointerEvents: "none" }} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   CUSTOM NODES
═══════════════════════════════════════════════════════════ */
function StartEndNode({ data, selected }: any) {
  return (
    <div className={`relative flex items-center justify-center rounded-full px-5 py-2 min-w-[100px] text-center font-mono text-xs font-bold tracking-wider uppercase border-2 transition-all ${selected ? "border-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.5)]" : "border-orange-500/60"}`}
      style={{ background: data.bg ?? "#0d1117", color: data.textColor ?? "#fb923c" }}>
      <AllHandles />
      <span>{data.label}</span>
    </div>
  );
}

function ProcessNode({ data, selected }: any) {
  return (
    <div className={`relative flex items-center justify-center px-4 py-3 min-w-[120px] min-h-[50px] text-center font-mono text-xs tracking-wide border-2 transition-all ${selected ? "border-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.5)]" : "border-slate-600"}`}
      style={{ background: data.bg ?? "#111827", color: data.textColor ?? "#e2e8f0" }}>
      <AllHandles />
      <span className="break-words max-w-[140px]">{data.label}</span>
    </div>
  );
}

function DecisionNode({ data, selected }: any) {
  const s = 120;
  const half = s / 2;
  const hs = { ...HS };
  return (
    <div className="relative" style={{ width: s, height: s }}>
      {/* Handles pinned to the 4 tips of the diamond */}
      <Handle id="t" type="source" position={Position.Top}    style={{ ...hs, left: half - 5, top: -5 }} />
      <Handle id="t" type="target" position={Position.Top}    style={{ ...hs, left: half - 5, top: -5, pointerEvents: "none" }} />
      <Handle id="l" type="source" position={Position.Left}   style={{ ...hs, top: half - 5, left: -5 }} />
      <Handle id="l" type="target" position={Position.Left}   style={{ ...hs, top: half - 5, left: -5, pointerEvents: "none" }} />
      <Handle id="b" type="source" position={Position.Bottom} style={{ ...hs, left: half - 5, bottom: -5 }} />
      <Handle id="b" type="target" position={Position.Bottom} style={{ ...hs, left: half - 5, bottom: -5, pointerEvents: "none" }} />
      <Handle id="r" type="source" position={Position.Right}  style={{ ...hs, top: half - 5, right: -5 }} />
      <Handle id="r" type="target" position={Position.Right}  style={{ ...hs, top: half - 5, right: -5, pointerEvents: "none" }} />
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="absolute inset-0">
        <polygon points={`${half},2 ${s-2},${half} ${half},${s-2} 2,${half}`}
          fill={data.bg ?? "#1e1b4b"}
          stroke={selected ? "#fb923c" : "#6366f1"}
          strokeWidth={selected ? 2.5 : 1.5}
          filter={selected ? "drop-shadow(0 0 6px rgba(251,146,60,0.6))" : "none"} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-center px-5 font-semibold"
        style={{ color: data.textColor ?? "#a5b4fc" }}>{data.label}</div>
    </div>
  );
}

function DocumentNode({ data, selected }: any) {
  return (
    <div className="relative" style={{ minWidth: 120, minHeight: 60 }}>
      <AllHandles />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 120 64" preserveAspectRatio="none">
        <path d="M4,4 H116 V52 Q90,68 60,52 Q30,36 4,52 Z"
          fill={data.bg ?? "#052e16"} stroke={selected ? "#fb923c" : "#22c55e"} strokeWidth={selected ? 2 : 1.5} />
      </svg>
      <div className="relative z-10 flex items-center justify-center h-[52px] font-mono text-[11px] text-center px-3"
        style={{ color: data.textColor ?? "#86efac" }}>{data.label}</div>
    </div>
  );
}

function DatabaseNode({ data, selected }: any) {
  return (
    <div className="relative" style={{ minWidth: 100, minHeight: 70 }}>
      <AllHandles />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 72" preserveAspectRatio="none">
        <ellipse cx="50" cy="12" rx="46" ry="10" fill={data.bg ?? "#0c1a2e"} stroke={selected ? "#fb923c" : "#38bdf8"} strokeWidth={selected ? 2 : 1.5} />
        <rect    x="4"  y="12" width="92" height="48" fill={data.bg ?? "#0c1a2e"} stroke={selected ? "#fb923c" : "#38bdf8"} strokeWidth={selected ? 2 : 1.5} />
        <ellipse cx="50" cy="60" rx="46" ry="10" fill={data.bg ?? "#0c1a2e"} stroke={selected ? "#fb923c" : "#38bdf8"} strokeWidth={selected ? 2 : 1.5} />
      </svg>
      <div className="relative z-10 flex items-center justify-center h-[70px] font-mono text-[11px] text-center px-3"
        style={{ color: data.textColor ?? "#7dd3fc" }}>{data.label}</div>
    </div>
  );
}

function ParallelogramNode({ data, selected }: any) {
  return (
    <div className="relative" style={{ minWidth: 130, minHeight: 50 }}>
      <AllHandles />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 130 50" preserveAspectRatio="none">
        <polygon points="20,4 126,4 110,46 4,46"
          fill={data.bg ?? "#1c1917"} stroke={selected ? "#fb923c" : "#f59e0b"} strokeWidth={selected ? 2 : 1.5} />
      </svg>
      <div className="relative z-10 flex items-center justify-center h-[50px] font-mono text-[11px] text-center px-6"
        style={{ color: data.textColor ?? "#fcd34d" }}>{data.label}</div>
    </div>
  );
}

function ActorNode({ data, selected }: any) {
  return (
    <div className={`relative flex flex-col items-center gap-1.5 p-3 font-mono text-[11px] tracking-wide border-2 rounded-lg transition-all ${selected ? "border-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.4)]" : "border-slate-600"}`}
      style={{ background: data.bg ?? "#0f172a", color: data.textColor ?? "#94a3b8" }}>
      <AllHandles />
      <svg width="32" height="40" viewBox="0 0 32 40">
        <circle cx="16" cy="6"  r="5"  fill="none" stroke="#fb923c" strokeWidth="1.5" />
        <line x1="16" y1="11" x2="16" y2="26" stroke="#fb923c" strokeWidth="1.5" />
        <line x1="6"  y1="17" x2="26" y2="17" stroke="#fb923c" strokeWidth="1.5" />
        <line x1="16" y1="26" x2="8"  y2="38" stroke="#fb923c" strokeWidth="1.5" />
        <line x1="16" y1="26" x2="24" y2="38" stroke="#fb923c" strokeWidth="1.5" />
      </svg>
      <span>{data.label}</span>
    </div>
  );
}

function ModuleNode({ data, selected }: any) {
  return (
    <div className={`relative flex flex-col px-4 py-2 min-w-[130px] font-mono text-[11px] tracking-wide border-2 transition-all ${selected ? "border-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.4)]" : "border-violet-500/60"}`}
      style={{ background: data.bg ?? "#1a0533", color: data.textColor ?? "#c4b5fd" }}>
      <AllHandles />
      <div className="text-[9px] text-violet-400/60 uppercase tracking-widest mb-0.5">ERP Module</div>
      <div className="font-semibold text-xs text-center">{data.label}</div>
    </div>
  );
}

function AnnotationNode({ data, selected }: any) {
  return (
    <div className={`relative px-3 py-2 max-w-[180px] rounded font-mono text-[11px] leading-relaxed italic border border-dashed transition-all ${selected ? "border-orange-400 bg-orange-500/10" : "border-slate-600 bg-slate-900/60"}`}
      style={{ color: data.textColor ?? "#94a3b8" }}>
      <AllHandles opacity={0.4} />
      <span>{data.label}</span>
    </div>
  );
}

const NODE_TYPES: NodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  decision: DecisionNode,
  document: DocumentNode,
  database: DatabaseNode,
  parallelogram: ParallelogramNode,
  actor: ActorNode,
  module: ModuleNode,
  annotation: AnnotationNode,
  // Network / IT
  itServer: ItServerNode,
  itRouter: ItRouterNode,
  itSwitch: ItSwitchNode,
  itFirewall: ItFirewallNode,
  itCloud: ItCloudNode,
  itClient: ItClientNode,
  itNas: ItNasNode,
  itWifi: ItWifiNode,
  itIsp: ItIspNode,
  // Database Diagram
  dbTable: DbTableNode,
  dbView: DbViewNode,
  dbIndex: DbIndexNode,
};
/* ═══════════════════════════════════════════════════════════
   CUSTOM EDGE
═══════════════════════════════════════════════════════════ */
function LabeledEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd, style }: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd}
        style={{ ...style, stroke: selected ? "#fb923c" : (style?.stroke ?? "#475569"), strokeWidth: selected ? 2.5 : 1.5, filter: selected ? "drop-shadow(0 0 4px rgba(251,146,60,0.5))" : "none" }} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div className="absolute pointer-events-all font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#0d1117] border border-slate-700 text-slate-400"
            style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}>
            {String(data.label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
const EDGE_TYPES = { labeled: LabeledEdge };

/* ═══════════════════════════════════════════════════════════
   NETWORK / IT NODES
═══════════════════════════════════════════════════════════ */
function itIconBox(icon: React.ReactNode, accentColor: string, bg: string, selected: boolean, data: any) {
  return (
    <div className="relative flex flex-col items-center gap-1.5 px-4 py-3 min-w-[90px] border-2 rounded transition-all font-mono text-[11px] tracking-wide text-center"
      style={{ background: data.bg ?? bg, borderColor: selected ? "#fb923c" : accentColor, boxShadow: selected ? "0 0 12px rgba(251,146,60,0.4)" : "none", color: data.textColor ?? accentColor }}>
      <Handle type="target" position={Position.Top}    style={HS} />
      <Handle type="target" position={Position.Left}   style={HS} />
      <div style={{ color: selected ? "#fb923c" : accentColor }}>{icon}</div>
      <span className="break-words max-w-[100px]">{data.label}</span>
      <Handle type="source" position={Position.Bottom} style={HS} />
      <Handle type="source" position={Position.Right}  style={HS} />
    </div>
  );
}
function ItServerNode({ data, selected }: any)   { return itIconBox(<Server    className="w-6 h-6"/>, "#34d399", "#0a1f18", selected, data); }
function ItRouterNode({ data, selected }: any)   { return itIconBox(<Router    className="w-6 h-6"/>, "#60a5fa", "#0a1428", selected, data); }
function ItSwitchNode({ data, selected }: any)   { return itIconBox(<Network   className="w-6 h-6"/>, "#a78bfa", "#130a28", selected, data); }
function ItFirewallNode({ data, selected }: any) { return itIconBox(<Shield    className="w-6 h-6"/>, "#f87171", "#280a0a", selected, data); }
function ItCloudNode({ data, selected }: any)    { return itIconBox(<Cloud     className="w-6 h-6"/>, "#67e8f9", "#031f22", selected, data); }
function ItClientNode({ data, selected }: any)   { return itIconBox(<Monitor   className="w-6 h-6"/>, "#e2e8f0", "#1e293b", selected, data); }
function ItNasNode({ data, selected }: any)      { return itIconBox(<HardDrive className="w-6 h-6"/>, "#fbbf24", "#1c1200", selected, data); }
function ItWifiNode({ data, selected }: any)     { return itIconBox(<Wifi      className="w-6 h-6"/>, "#4ade80", "#0a1f0a", selected, data); }
function ItIspNode({ data, selected }: any) {
  return (
    <div className="relative flex flex-col items-center gap-1 px-5 py-3 border-2 rounded-full font-mono text-[11px] text-center transition-all"
      style={{ background: data.bg ?? "#0a1628", borderColor: selected ? "#fb923c" : "#60a5fa", boxShadow: selected ? "0 0 12px rgba(251,146,60,0.4)" : "none", color: data.textColor ?? "#93c5fd" }}>
      <Handle type="target" position={Position.Top}  style={HS} />
      <Handle type="target" position={Position.Left} style={HS} />
      <GitMerge className="w-5 h-5" />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Bottom} style={HS} />
      <Handle type="source" position={Position.Right}  style={HS} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DATABASE DIAGRAM NODES
═══════════════════════════════════════════════════════════ */
type DbCol = { name: string; type: string; pk?: boolean; fk?: boolean; nullable?: boolean };

function DbTableNode({ data, selected }: any) {
  const cols: DbCol[] = Array.isArray(data.columns) ? data.columns : [];
  return (
    <div className="relative border-2 rounded overflow-hidden font-mono text-[11px] min-w-[180px] transition-all"
      style={{ borderColor: selected ? "#fb923c" : "#38bdf8", boxShadow: selected ? "0 0 12px rgba(251,146,60,0.5)" : "0 0 0 1px rgba(56,189,248,0.1)", background: data.bg ?? "#0c1a2e" }}>
      <Handle type="target" position={Position.Top}  style={HS} />
      <Handle type="target" position={Position.Left} style={HS} />
      <div className="flex items-center gap-2 px-3 py-1.5 border-b"
        style={{ background: selected ? "rgba(251,146,60,0.12)" : "rgba(56,189,248,0.1)", borderColor: selected ? "#fb923c" : "#1e3a4a" }}>
        <Table2 className="w-3 h-3 shrink-0" style={{ color: selected ? "#fb923c" : "#38bdf8" }} />
        <span className="font-bold tracking-wide truncate" style={{ color: selected ? "#fb923c" : "#7dd3fc" }}>{data.label}</span>
      </div>
      {cols.length > 0 ? (
        <div className="divide-y divide-slate-800/50">
          {cols.map((col, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1 hover:bg-slate-800/30">
              <span className="w-3.5 shrink-0 flex justify-center">
                {col.pk  && <Key  className="w-3 h-3 text-yellow-400" />}
                {!col.pk && col.fk && <Link className="w-3 h-3 text-blue-400" />}
              </span>
              <span className="flex-1 truncate" style={{ color: col.pk ? "#fbbf24" : "#cbd5e1" }}>{col.name}</span>
              <span className="text-slate-600 text-[10px] shrink-0">{col.type}{col.nullable ? "?" : ""}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 py-2 text-slate-600 italic text-[10px]">+ add columns in props panel</div>
      )}
      <Handle type="source" position={Position.Bottom} style={HS} />
      <Handle type="source" position={Position.Right}  style={HS} />
    </div>
  );
}

function DbViewNode({ data, selected }: any) {
  const cols: { name: string; type: string }[] = Array.isArray(data.columns) ? data.columns : [];
  return (
    <div className="relative border-2 rounded overflow-hidden font-mono text-[11px] min-w-[160px] transition-all"
      style={{ borderColor: selected ? "#fb923c" : "#a78bfa", boxShadow: selected ? "0 0 12px rgba(251,146,60,0.5)" : "none", background: data.bg ?? "#13002e" }}>
      <Handle type="target" position={Position.Top}  style={HS} />
      <Handle type="target" position={Position.Left} style={HS} />
      <div className="flex items-center gap-2 px-3 py-1.5 border-b"
        style={{ background: "rgba(167,139,250,0.1)", borderColor: selected ? "#fb923c" : "#3b1f5e" }}>
        <Layers className="w-3 h-3 shrink-0 text-violet-400" />
        <span className="font-bold tracking-wide truncate text-violet-300">{data.label}</span>
        <span className="ml-auto text-[9px] text-violet-600 uppercase tracking-widest">view</span>
      </div>
      {cols.map((col, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-1 border-b border-slate-800/40 last:border-0">
          <span className="flex-1 truncate text-slate-300">{col.name}</span>
          <span className="text-slate-600 text-[10px]">{col.type}</span>
        </div>
      ))}
      {cols.length === 0 && <div className="px-3 py-2 text-slate-600 italic text-[10px]">+ add columns in props panel</div>}
      <Handle type="source" position={Position.Bottom} style={HS} />
      <Handle type="source" position={Position.Right}  style={HS} />
    </div>
  );
}

function DbIndexNode({ data, selected }: any) {
  return (
    <div className="relative flex flex-col px-3 py-2 min-w-[130px] border-2 rounded font-mono text-[11px] transition-all"
      style={{ background: data.bg ?? "#1a1200", borderColor: selected ? "#fb923c" : "#fbbf24", boxShadow: selected ? "0 0 10px rgba(251,146,60,0.4)" : "none", color: data.textColor ?? "#fcd34d" }}>
      <Handle type="target" position={Position.Top}  style={HS} />
      <Handle type="target" position={Position.Left} style={HS} />
      <div className="flex items-center gap-1.5 mb-1">
        <Cpu className="w-3 h-3 text-yellow-400" />
        <span className="text-[9px] text-yellow-600 uppercase tracking-widest">Index</span>
      </div>
      <span className="font-semibold truncate">{data.label}</span>
      <Handle type="source" position={Position.Bottom} style={HS} />
      <Handle type="source" position={Position.Right}  style={HS} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NODE COUNTER
═══════════════════════════════════════════════════════════ */
let _nc = 100;
const nextId = (prefix = "node") => `${prefix}-${++_nc}`;

/* ═══════════════════════════════════════════════════════════
   DEFAULT STARTER NODES
═══════════════════════════════════════════════════════════ */
const STARTER_NODES: Node[] = [
  { id: "s1", type: "startEnd", position: { x: 280, y: 40  }, data: { label: "START" } },
  { id: "p1", type: "process",  position: { x: 240, y: 140 }, data: { label: "Process Step" } },
  { id: "d1", type: "decision", position: { x: 235, y: 250 }, data: { label: "Condition?" } },
  { id: "p2", type: "process",  position: { x: 100, y: 390 }, data: { label: "Handle No" } },
  { id: "p3", type: "process",  position: { x: 370, y: 390 }, data: { label: "Handle Yes" } },
  { id: "e1", type: "startEnd", position: { x: 280, y: 520 }, data: { label: "END", bg: "#1a0a00", textColor: "#f97316" } },
];
const STARTER_EDGES: Edge[] = [
  { id: "se1", source: "s1", target: "p1", type: "labeled", markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" }, data: { label: "" } },
  { id: "se2", source: "p1", target: "d1", type: "labeled", markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" }, data: { label: "" } },
  { id: "se3", source: "d1", target: "p2", type: "labeled", markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" }, data: { label: "No"  } },
  { id: "se4", source: "d1", target: "p3", type: "labeled", markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" }, data: { label: "Yes" } },
  { id: "se5", source: "p2", target: "e1", type: "labeled", markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" }, data: { label: "" } },
  { id: "se6", source: "p3", target: "e1", type: "labeled", markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" }, data: { label: "" } },
];

/* ═══════════════════════════════════════════════════════════
   PROPERTIES PANEL
═══════════════════════════════════════════════════════════ */
const DB_NODES = new Set(["dbTable", "dbView"]);

function PropertiesPanel({ node, edge, onUpdateNode, onUpdateEdge, onDelete, onClose }: {
  node: Node | null; edge: Edge | null;
  onUpdateNode: (id: string, data: any) => void;
  onUpdateEdge: (id: string, data: any) => void;
  onDelete: () => void; onClose: () => void;
}) {
  const [label, setLabel]         = useState("");
  const [bg, setBg]               = useState("#111827");
  const [textColor, setTextColor] = useState("#e2e8f0");
  const [edgeLabel, setEdgeLabel] = useState("");
  // DB columns
  const [columns, setColumns]     = useState<DbCol[]>([]);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("VARCHAR");

  const isDbNode = node ? DB_NODES.has(node.type ?? "") : false;

  useEffect(() => {
    if (node) {
      setLabel(String(node.data?.label ?? ""));
      setBg(String(node.data?.bg ?? "#111827"));
      setTextColor(String(node.data?.textColor ?? "#e2e8f0"));
      setColumns(Array.isArray(node.data?.columns) ? node.data.columns : []);
    }
    if (edge) setEdgeLabel(String(edge.data?.label ?? ""));
  }, [node, edge]);

  const pushColumns = (cols: DbCol[]) => {
    setColumns(cols);
    if (node) onUpdateNode(node.id, { columns: cols });
  };
  const addCol = () => {
    if (!newColName.trim()) return;
    pushColumns([...columns, { name: newColName.trim(), type: newColType, pk: false, fk: false, nullable: false }]);
    setNewColName(""); setNewColType("VARCHAR");
  };
  const toggleColProp = (i: number, prop: "pk" | "fk" | "nullable") => {
    const updated = columns.map((c, idx) => idx === i ? { ...c, [prop]: !c[prop] } : c);
    pushColumns(updated);
  };
  const removeCol = (i: number) => pushColumns(columns.filter((_, idx) => idx !== i));

  if (!node && !edge) return null;

  return (
    <div className="absolute top-14 right-3 z-50 w-64 max-h-[calc(100%-4rem)] overflow-y-auto custom-scrollbar bg-[#0d1117] border border-orange-500/20 rounded shadow-xl font-mono text-xs text-slate-300">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 sticky top-0 bg-[#0d1117] z-10">
        <span className="text-orange-400 text-[10px] uppercase tracking-widest">{node ? "Node Props" : "Edge Props"}</span>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="p-3 flex flex-col gap-3">
        {node && (
          <>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 block">Label</label>
              <textarea className="w-full bg-[#111827] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500/60 resize-none" rows={2}
                value={label} onChange={e => setLabel(e.target.value)} onBlur={() => onUpdateNode(node.id, { label })} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 block">Fill</label>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={bg} onChange={e => { setBg(e.target.value); onUpdateNode(node.id, { bg: e.target.value }); }}
                    className="w-6 h-6 rounded cursor-pointer border border-slate-700" />
                  <span className="text-slate-600 text-[10px]">{bg}</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 block">Text</label>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={textColor} onChange={e => { setTextColor(e.target.value); onUpdateNode(node.id, { textColor: e.target.value }); }}
                    className="w-6 h-6 rounded cursor-pointer border border-slate-700" />
                  <span className="text-slate-600 text-[10px]">{textColor}</span>
                </div>
              </div>
            </div>

            {/* DB Column editor */}
            {isDbNode && (
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                  <span>Columns</span>
                  <span className="text-slate-700">{columns.length} cols</span>
                </div>

                {/* Column list */}
                {columns.length > 0 && (
                  <div className="flex flex-col gap-0.5 mb-2">
                    {columns.map((col, i) => (
                      <div key={i} className="flex items-center gap-1 bg-[#111827] border border-slate-800 rounded px-2 py-1 group">
                        <span className="flex-1 truncate text-[11px]" style={{ color: col.pk ? "#fbbf24" : "#94a3b8" }}>
                          {col.pk ? "🔑 " : col.fk ? "🔗 " : ""}{col.name}
                          <span className="text-slate-600 ml-1">{col.type}{col.nullable ? "?" : ""}</span>
                        </span>
                        <div className="hidden group-hover:flex items-center gap-0.5">
                          <button onClick={() => toggleColProp(i, "pk")} title="Toggle PK"
                            className={`px-1 text-[9px] rounded ${col.pk ? "text-yellow-400 bg-yellow-900/30" : "text-slate-600 hover:text-yellow-400"}`}>PK</button>
                          <button onClick={() => toggleColProp(i, "fk")} title="Toggle FK"
                            className={`px-1 text-[9px] rounded ${col.fk ? "text-blue-400 bg-blue-900/30" : "text-slate-600 hover:text-blue-400"}`}>FK</button>
                          <button onClick={() => toggleColProp(i, "nullable")} title="Toggle nullable"
                            className={`px-1 text-[9px] rounded ${col.nullable ? "text-slate-400 bg-slate-800" : "text-slate-600"}`}>?</button>
                          <button onClick={() => removeCol(i)} className="p-0.5 text-red-600 hover:text-red-400 rounded">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add column */}
                <div className="flex gap-1">
                  <input value={newColName} onChange={e => setNewColName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCol()}
                    placeholder="col_name"
                    className="flex-1 bg-[#111827] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500/60" />
                  <select value={newColType} onChange={e => setNewColType(e.target.value)}
                    className="bg-[#111827] border border-slate-700 rounded px-1 text-[10px] text-slate-400 focus:outline-none">
                    {["INT","BIGINT","VARCHAR","TEXT","BOOLEAN","DATE","DATETIME","DECIMAL","UUID","JSON"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <button onClick={addCol} className="p-1.5 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 rounded transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[9px] text-slate-700 mt-1">Hover a column → toggle PK / FK / nullable</p>
              </div>
            )}
          </>
        )}

        {edge && (
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 block">Edge Label</label>
            <input className="w-full bg-[#111827] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500/60"
              value={edgeLabel} onChange={e => setEdgeLabel(e.target.value)} onBlur={() => onUpdateEdge(edge.id, { label: edgeLabel })} placeholder="Yes / No / 1:N / …" />
          </div>
        )}

        <button onClick={onDelete}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-red-900/30 border border-red-800/40 text-red-400 hover:bg-red-900/50 rounded transition-colors text-[11px] uppercase tracking-wider">
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FILE MANAGER (left panel — diagram list)
═══════════════════════════════════════════════════════════ */
function FileManager({
  diagrams, activeDiagramId, loading, saving,
  onSelect, onCreate, onRename, onDelete,
}: {
  diagrams: DiagramMeta[];
  activeDiagramId: string | null;
  loading: boolean; saving: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName]     = useState("");
  const [creating, setCreating]   = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const handleCreate = () => {
    const n = newName.trim();
    if (!n) return;
    onCreate(n);
    setNewName("");
    setCreating(false);
  };

  const handleRenameSubmit = (id: string) => {
    const n = renameVal.trim();
    if (n) onRename(id, n);
    setRenamingId(null);
  };

  return (
    <aside className="w-52 shrink-0 bg-[#0d1117] border-r border-slate-800/60 flex flex-col overflow-hidden">
      {/* ── Fixed header (Diagrams + new button) ── */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <span className="text-[9px] font-mono text-orange-400/50 uppercase tracking-[0.2em]">◈ Diagrams</span>
          <button onClick={() => setCreating(v => !v)} title="New Diagram"
            className="p-1 text-slate-600 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {creating && (
          <div className="px-2 pb-2">
            <div className="flex gap-1">
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                placeholder="Diagram name…"
                className="flex-1 bg-[#111827] border border-orange-500/40 rounded px-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-orange-500" />
              <button onClick={handleCreate} className="p-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded transition-colors">
                <Check className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {saving && (
          <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono text-orange-400/60">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving…
          </div>
        )}
      </div>

      {/* ── Single unified scroll area: diagram list + shape palette ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* Diagram list */}
        <div className="py-1">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-slate-600 font-mono text-[11px]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          ) : diagrams.length === 0 ? (
            <div className="px-3 py-3 text-slate-700 font-mono text-[11px]">No diagrams yet.</div>
          ) : (
            diagrams.map(d => (
              <div key={d.id}
                className={`group relative flex items-center gap-2 px-2 py-2 mx-1 rounded cursor-pointer transition-all
                  ${activeDiagramId === d.id
                    ? "bg-orange-500/15 border border-orange-500/30 text-orange-300"
                    : "hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent"}`}
                onClick={() => { if (renamingId !== d.id) onSelect(d.id); }}
              >
                <File className="w-3.5 h-3.5 shrink-0 text-orange-500/50" />
                <div className="flex-1 min-w-0">
                  {renamingId === d.id ? (
                    <input autoFocus value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleRenameSubmit(d.id); if (e.key === "Escape") setRenamingId(null); }}
                      onBlur={() => handleRenameSubmit(d.id)}
                      className="w-full bg-transparent border-b border-orange-500/50 text-[11px] font-mono text-slate-200 focus:outline-none"
                      onClick={e => e.stopPropagation()} />
                  ) : (
                    <span className="truncate text-[11px] font-mono block">{d.name}</span>
                  )}
                  <span className="text-[9px] text-slate-700 font-mono">{d.nodeCount}n · {d.edgeCount}e</span>
                </div>
                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setRenamingId(d.id); setRenameVal(d.name); }}
                    className="p-1 text-slate-600 hover:text-orange-400 rounded transition-colors" title="Rename">
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                  <button onClick={() => onDelete(d.id)}
                    className="p-1 text-slate-600 hover:text-red-400 rounded transition-colors" title="Delete">
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Shape palette — scrolls together with diagrams */}
        <div className="border-t border-slate-800/60 pt-2">
          <div className="px-3 pb-1">
            <span className="text-[9px] font-mono text-orange-400/50 uppercase tracking-[0.2em]">◈ Shapes</span>
          </div>
          {["Flowchart", "Network / IT", "Database"].map(cat => (
            <div key={cat} className="px-2 pb-2">
              <div className="text-[9px] font-mono text-slate-700 uppercase tracking-widest px-1 py-0.5">{cat}</div>
              <div className="flex flex-col gap-0.5">
                {SHAPE_PALETTE.filter(s => s.category === cat).map((shape, si) => (
                  <div key={`${shape.type}-${si}`} draggable
                    onDragStart={e => { e.dataTransfer.setData("application/reactflow", shape.type); e.dataTransfer.effectAllowed = "move"; }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing bg-[#111827] border border-slate-800 hover:border-orange-500/40 hover:bg-orange-500/5 text-slate-400 hover:text-orange-300 font-mono text-[11px] transition-all select-none"
                    title={shape.description}>
                    <span className="text-orange-500/60 shrink-0">{shape.icon}</span>
                    <span className="truncate">{shape.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="px-3 pb-3">
            <p className="text-[9px] font-mono text-slate-700 leading-relaxed">Drag onto canvas. Del to remove.</p>
          </div>
        </div>

      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════
   FLOW CANVAS (inner — has access to ReactFlow hooks)
═══════════════════════════════════════════════════════════ */
const AUTO_SAVE_MS = 1500; // debounce

function FlowCanvas({
  initialNodes, initialEdges, diagramId, onFlowChange,
}: {
  initialNodes: Node[]; initialEdges: Edge[]; diagramId: string | null;
  onFlowChange: (nodes: Node[], edges: Edge[]) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Track selection via React Flow's own selection system — no stale closures
  const [selNode, setSelNode] = useState<Node | null>(null);
  const [selEdge, setSelEdge] = useState<Edge | null>(null);
  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId?: string; edgeId?: string } | null>(null);

  const [showGrid, setShowGrid]       = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);

  // Notify parent on change (debounced)
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onFlowChange(nodes, edges), AUTO_SAVE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [nodes, edges]); // eslint-disable-line

  // Track last diagram ID to only reset when diagram actually changes
  const lastDiagramIdRef = useRef<string | null>(null);
  
  // Reset only when diagram switches (not on every node/edge update)
  useEffect(() => {
    if (lastDiagramIdRef.current !== diagramId) {
      lastDiagramIdRef.current = diagramId;
      setNodes(initialNodes);
      setEdges(initialEdges);
      setSelNode(null);
      setSelEdge(null);
      setTimeout(() => fitView({ padding: 0.15 }), 80);
    }
  }, [diagramId, initialNodes, initialEdges, setNodes, setEdges, fitView]);

  // ── Sync React Flow's own selection into our state ──
  const onSelectionChange = useCallback(({ nodes: sn, edges: se }: OnSelectionChangeParams) => {
    setSelNode(sn.length === 1 ? sn[0] : null);
    setSelEdge(se.length === 1 ? se[0] : null);
  }, []);

  // ── React Flow native delete callbacks — fired by Delete/Backspace key ──
  const onNodesDelete = useCallback((deleted: Node[]) => {
    const ids = new Set(deleted.map(n => n.id));
    setEdges(eds => eds.filter(e => !ids.has(e.source) && !ids.has(e.target)));
    setSelNode(null);
  }, [setEdges]);

  const onEdgesDelete = useCallback((_deleted: Edge[]) => {
    setSelEdge(null);
  }, []);

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({
      ...params, type: "labeled",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
      data: { label: "" },
    }, eds));
  }, [setEdges]);

  const onPaneClick = useCallback(() => {
    setSelNode(null);
    setSelEdge(null);
    setCtxMenu(null);
  }, []);

  // ── Manual delete (toolbar button + properties panel) ──
  const handleDelete = useCallback(() => {
    if (selNode) {
      setNodes(nds => nds.filter(n => n.id !== selNode.id));
      setEdges(eds => eds.filter(e => e.source !== selNode.id && e.target !== selNode.id));
      setSelNode(null);
    } else if (selEdge) {
      setEdges(eds => eds.filter(e => e.id !== selEdge.id));
      setSelEdge(null);
    }
    setCtxMenu(null);
  }, [selNode, selEdge, setNodes, setEdges]);

  // ── Update node data (from properties panel) ──
  const handleUpdateNode = useCallback((id: string, patch: any) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
    setSelNode(prev => prev?.id === id ? { ...prev, data: { ...prev.data, ...patch } } : prev);
  }, [setNodes]);

  const handleUpdateEdge = useCallback((id: string, patch: any) => {
    setEdges(eds => eds.map(e => e.id === id ? { ...e, data: { ...e.data, ...patch } } : e));
    setSelEdge(prev => prev?.id === id ? { ...prev, data: { ...prev.data, ...patch } } : prev);
  }, [setEdges]);

  // ── Duplicate ──
  const handleDuplicate = useCallback(() => {
    if (!selNode) return;
    const dup: Node = {
      ...selNode,
      id: nextId(selNode.type ?? "node"),
      position: { x: selNode.position.x + 30, y: selNode.position.y + 30 },
      selected: false,
    };
    setNodes(nds => [...nds, dup]);
    setCtxMenu(null);
  }, [selNode, setNodes]);

  // ── Right-click context menu ──
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setSelNode(node);
    setSelEdge(null);
    setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    setSelEdge(edge);
    setSelNode(null);
    setCtxMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id });
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [ctxMenu]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/reactflow");
    if (!type || !wrapperRef.current) return;
    const bounds = wrapperRef.current.getBoundingClientRect();
    const position = screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    const shape = SHAPE_PALETTE.find(s => s.type === type);
    setNodes(nds => [...nds, { id: nextId(type), type, position, data: { label: shape?.label ?? type } }]);
  }, [screenToFlowPosition, setNodes]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleExportPng = useCallback(async () => {
    if (!wrapperRef.current) return;
    try {
      const c = await html2canvas(wrapperRef.current, { backgroundColor: "#0a0d14", useCORS: true, scale: 2 });
      const a = document.createElement("a"); a.download = "diagram.png"; a.href = c.toDataURL(); a.click();
      toast.success("Exported as PNG");
    } catch { toast.error("Export failed"); }
  }, []);
  const handleExportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.download = "diagram.json"; a.href = URL.createObjectURL(blob); a.click();
    toast.success("Exported as JSON");
  }, [nodes, edges]);
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const p = JSON.parse(ev.target?.result as string);
        if (p.nodes && p.edges) { setNodes(p.nodes); setEdges(p.edges); toast.success("Imported"); }
        else toast.error("Invalid file format");
      } catch { toast.error("Parse error"); }
    };
    r.readAsText(file); e.target.value = "";
  }, [setNodes, setEdges]);

  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ minHeight: 0 }}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-[#0d1117] border-b border-slate-800/60 shrink-0 overflow-x-auto">
        <button onClick={() => zoomIn()}  title="Zoom In (+)"  className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors shrink-0"><ZoomIn  className="w-3.5 h-3.5" /></button>
        <button onClick={() => zoomOut()} title="Zoom Out (-)" className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors shrink-0"><ZoomOut className="w-3.5 h-3.5" /></button>
        <button onClick={() => fitView({ padding: 0.15 })} title="Fit View" className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors shrink-0"><Maximize2 className="w-3.5 h-3.5" /></button>
        <div className="w-px h-4 bg-slate-800 mx-1 shrink-0" />
        <button onClick={handleDuplicate} disabled={!selNode} title="Duplicate" className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"><Copy   className="w-3.5 h-3.5" /></button>
        <button onClick={handleDelete} disabled={!selNode && !selEdge} title="Delete (Del)" className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
        <div className="w-px h-4 bg-slate-800 mx-1 shrink-0" />
        <button onClick={() => setShowGrid(v => !v)} className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors shrink-0 ${showGrid ? "bg-orange-500/15 text-orange-400 border border-orange-500/30" : "text-slate-600 hover:text-slate-400"}`}>Grid</button>
        <button onClick={() => setShowMinimap(v => !v)} className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors shrink-0 ${showMinimap ? "bg-orange-500/15 text-orange-400 border border-orange-500/30" : "text-slate-600 hover:text-slate-400"}`}>Map</button>
        <div className="w-px h-4 bg-slate-800 mx-1 shrink-0" />
        <button onClick={handleExportPng}  className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors shrink-0"><Download className="w-3 h-3" /> PNG</button>
        <button onClick={handleExportJson} className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors shrink-0"><Download className="w-3 h-3" /> JSON</button>
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors shrink-0"><Upload className="w-3 h-3" /> Import</button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        <span className="ml-auto pl-2 text-[10px] font-mono text-slate-700 shrink-0">{nodes.length}n · {edges.length}e</span>
      </div>

      {/* ── Canvas — takes all remaining space, overflow visible so Controls show ── */}
      <div ref={wrapperRef} className="flex-1 relative" style={{ minHeight: 0 }} onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneClick={onPaneClick}
          nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES}
          connectionMode={ConnectionMode.Strict}
          deleteKeyCode={["Delete", "Backspace"]}
          defaultEdgeOptions={{ type: "labeled", markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" }, data: { label: "" } }}
          fitView fitViewOptions={{ padding: 0.15 }}
          style={{ background: "#0a0d14", width: "100%", height: "100%" }}
          proOptions={{ hideAttribution: true }}
        >
          {showGrid && <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(251,146,60,0.08)" />}
          <Controls
            style={{ bottom: 16, left: 16 }}
            showInteractive={false}
          />
          {showMinimap && (
            <MiniMap
              style={{ background: "#0d1117", border: "1px solid rgba(251,146,60,0.15)", bottom: 16, right: 16 }}
              nodeColor={n => ({ decision: "#6366f1", startEnd: "#fb923c", database: "#38bdf8", document: "#22c55e" }[n.type ?? ""] ?? "#475569")}
              maskColor="rgba(0,0,0,0.6)"
            />
          )}
        </ReactFlow>

        {/* Right-click context menu */}
        {ctxMenu && (
          <div
            className="fixed z-[200] min-w-[160px] bg-[#0d1117] border border-orange-500/20 rounded shadow-2xl font-mono text-xs text-slate-300 overflow-hidden"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
            onClick={e => e.stopPropagation()}
          >
            {ctxMenu.nodeId && (
              <button onClick={handleDuplicate}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-orange-500/10 hover:text-orange-300 transition-colors text-left">
                <Copy className="w-3.5 h-3.5 text-orange-500/50" /> Duplicate
              </button>
            )}
            <button onClick={handleDelete}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-500/10 hover:text-red-400 transition-colors text-left">
              <Trash2 className="w-3.5 h-3.5 text-red-500/50" /> Delete
            </button>
          </div>
        )}

        <PropertiesPanel
          node={selNode} edge={selEdge}
          onUpdateNode={handleUpdateNode} onUpdateEdge={handleUpdateEdge}
          onDelete={handleDelete}
          onClose={() => { setSelNode(null); setSelEdge(null); }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN SYSTEM PROCESS COMPONENT (orchestrates everything)
═══════════════════════════════════════════════════════════ */
function SystemProcessInner() {
  const [diagrams, setDiagrams]               = useState<DiagramMeta[]>([]);
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  const [activeNodes, setActiveNodes]         = useState<Node[]>(STARTER_NODES);
  const [activeEdges, setActiveEdges]         = useState<Edge[]>(STARTER_EDGES);
  const [loadingList, setLoadingList]         = useState(true);
  const [loadingDiagram, setLoadingDiagram]   = useState(false);
  const [saving, setSaving]                   = useState(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Fetch diagram list ── */
  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/workflows/diagrams");
      const json = await res.json();
      if (json.success) setDiagrams(json.diagrams);
    } catch { toast.error("Failed to load diagrams"); }
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  /* ── Load a specific diagram ── */
  const handleSelect = useCallback(async (id: string) => {
    if (id === activeDiagramId) return;
    setLoadingDiagram(true);
    setActiveDiagramId(id);
    try {
      const res = await fetch(`/api/workflows/diagrams/${id}`);
      const json = await res.json();
      if (json.success) {
        setActiveNodes(json.diagram.nodes ?? []);
        setActiveEdges(json.diagram.edges ?? []);
      } else { toast.error("Failed to load diagram"); }
    } catch { toast.error("Failed to load diagram"); }
    finally { setLoadingDiagram(false); }
  }, [activeDiagramId]);

  /* ── Create new diagram ── */
  const handleCreate = useCallback(async (name: string) => {
    try {
      const res = await fetch("/api/workflows/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nodes: STARTER_NODES, edges: STARTER_EDGES }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchList();
        await handleSelect(json.id);
        toast.success(`"${name}" created`);
      } else { toast.error("Create failed"); }
    } catch { toast.error("Create failed"); }
  }, [fetchList, handleSelect]);

  /* ── Rename ── */
  const handleRename = useCallback(async (id: string, name: string) => {
    try {
      await fetch(`/api/workflows/diagrams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setDiagrams(prev => prev.map(d => d.id === id ? { ...d, name } : d));
    } catch { toast.error("Rename failed"); }
  }, []);

  /* ── Delete ── */
  const handleDeleteDiagram = useCallback(async (id: string) => {
    if (!window.confirm("Delete this diagram? This cannot be undone.")) return;
    try {
      await fetch(`/api/workflows/diagrams/${id}`, { method: "DELETE" });
      setDiagrams(prev => prev.filter(d => d.id !== id));
      if (activeDiagramId === id) {
        setActiveDiagramId(null);
        setActiveNodes(STARTER_NODES);
        setActiveEdges(STARTER_EDGES);
      }
      toast.success("Diagram deleted");
    } catch { toast.error("Delete failed"); }
  }, [activeDiagramId]);

  /* ── Auto-save on canvas change (debounced 1.5s) ── */
  const handleFlowChange = useCallback((nodes: Node[], edges: Edge[]) => {
    if (!activeDiagramId) return;
    setActiveNodes(nodes); setActiveEdges(edges);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/workflows/diagrams/${activeDiagramId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodes, edges }),
        });
        const json = await res.json();
        if (json.success) {
          setDiagrams(prev => prev.map(d => d.id === activeDiagramId
            ? { ...d, nodeCount: nodes.length, edgeCount: edges.length, updatedAt: new Date().toISOString() }
            : d));
        }
      } catch { /* silent — will retry on next change */ }
      finally { setSaving(false); }
    }, 1500);
  }, [activeDiagramId]);

  const activeName = diagrams.find(d => d.id === activeDiagramId)?.name;

  return (
    <div className="flex h-full w-full" style={{ minHeight: 0 }}>
      <FileManager
        diagrams={diagrams}
        activeDiagramId={activeDiagramId}
        loading={loadingList}
        saving={saving}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onRename={handleRename}
        onDelete={handleDeleteDiagram}
      />

      {/* Canvas area */}
      <div className="flex-1 flex flex-col min-w-0" style={{ minHeight: 0 }}>
        {/* Active diagram name bar */}
        <div className="flex items-center gap-2 px-4 py-1.5 bg-[#0d1117] border-b border-slate-800/40 shrink-0">
          {activeName ? (
            <>
              <FolderOpen className="w-3.5 h-3.5 text-orange-500/50 shrink-0" />
              <span className="font-mono text-[11px] text-orange-300/70 truncate">{activeName}</span>
              {saving && <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-orange-400/50"><Loader2 className="w-3 h-3 animate-spin" /> saving…</span>}
              {!saving && activeDiagramId && <span className="ml-auto text-[10px] font-mono text-green-500/40">● saved</span>}
            </>
          ) : (
            <span className="font-mono text-[11px] text-slate-700 italic">
              {loadingList ? "Loading…" : "← Select or create a diagram"}
            </span>
          )}
        </div>

        {loadingDiagram ? (
          <div className="flex-1 flex items-center justify-center text-slate-700 font-mono text-sm gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading diagram…
          </div>
        ) : (
          <ReactFlowProvider>
            <FlowCanvas
              initialNodes={activeNodes}
              initialEdges={activeEdges}
              diagramId={activeDiagramId}
              onFlowChange={handleFlowChange}
            />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE EXPORT
═══════════════════════════════════════════════════════════ */
export default function SystemProcessPage() {
  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <ProtectedPageWrapper>
        <AppSidebar />
        <PageShell
          breadcrumbs={[
            { label: "Workflows", href: "/workflows/system-process" },
            { label: "System Process" },
          ]}
          title="System Process"
          subtitle="FLOWCHART · BUILDER · ERP PROCESS"
          icon={<GitBranch className="w-4 h-4 text-orange-400" />}
          statusItems={["Visual Builder", "MongoDB"]}
          headerRight={<NotificationBell />}
          bodyClassName="!overflow-hidden !p-0"
        >
          <div className="flex flex-col" style={{ height: "calc(100vh - 88px)" }}>
            <SystemProcessInner />
          </div>
        </PageShell>
      </ProtectedPageWrapper>
    </SidebarProvider>
  );
}
