"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  getDoc,
  writeBatch,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Plus, CheckCircle2, Clock, PlayCircle, PauseCircle, XCircle,
  MoreVertical, Edit, Trash2, ListTodo, Search, Filter,
  Calendar as CalendarIcon, Tag, AlertTriangle, CheckSquare,
  Square, ArrowUpCircle, ArrowDownCircle, AlertCircle,
  LayoutGrid, List, Circle, Pin, Download, Users,
  UserPlus, UserMinus, X, Activity, Zap, Shield, Target,
  ChevronRight, Terminal, Radio,
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

/* ─── Types ──────────────────────────────────────────────────────── */

interface Subtask {
  id: string; title: string; completed: boolean;
  createdAt: any; completedAt?: any;
}

interface HistoryEntry {
  id: string; action: string; field?: string;
  oldValue?: string; newValue?: string;
  performedBy: string; timestamp: any;
}

interface Collaborator {
  id: string; name: string; email: string; role: string;
  addedAt: any; addedBy: string; status?: "pending" | "accepted" | "rejected";
  profilePicture?: string; department?: string; position?: string;
}

interface CollaborationRequest {
  id: string; taskId: string; taskTitle: string;
  requesterId: string; requesterName: string;
  collaboratorId: string; collaboratorName: string;
  collaboratorEmail: string; role: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: any; message?: string;
}

interface Task {
  id: string; userId: string; userName: string; title: string;
  description?: string;
  status: "pending" | "in-progress" | "completed" | "on-hold" | "cancelled";
  priority: "low" | "medium" | "high";
  dueDate?: Date; category?: string; tags?: string[];
  notes?: string; subtasks?: Subtask[]; history?: HistoryEntry[];
  pinned?: boolean; createdAt: any; updatedAt: any; completedAt?: any;
  collaborators?: Collaborator[]; isCollaborative?: boolean;
}

interface MyTaskDashboardProps {
  userId: string; userName: string; userRole?: string;
}

/* ─── Config ─────────────────────────────────────────────────────── */

const statusConfig = {
  pending:     { icon: Clock,        label: "Pending",     color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",   bar: "#f59e0b" },
  "in-progress":{ icon: PlayCircle,  label: "In Progress", color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20", bar: "#f97316" },
  completed:   { icon: CheckCircle2, label: "Completed",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20",bar: "#10b981" },
  "on-hold":   { icon: PauseCircle,  label: "On Hold",     color: "text-slate-400",   bg: "bg-slate-500/10 border-slate-500/20",   bar: "#64748b" },
  cancelled:   { icon: XCircle,      label: "Cancelled",   color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",       bar: "#ef4444" },
};

const priorityConfig = {
  low:    { icon: ArrowDownCircle, color: "text-sky-400",    bg: "bg-sky-500/10",    label: "LOW",    accent: "#38bdf8" },
  medium: { icon: AlertCircle,     color: "text-amber-400",  bg: "bg-amber-500/10",  label: "MEDIUM", accent: "#f59e0b" },
  high:   { icon: ArrowUpCircle,   color: "text-red-400",    bg: "bg-red-500/10",    label: "HIGH",   accent: "#ef4444" },
};

const categories = [
  "Development","Design","Meeting","Research",
  "Documentation","Testing","Bug Fix","Feature","Other",
];

/* ─── Small UI helpers ───────────────────────────────────────────── */

function Corner({ pos }: { pos: "tl"|"tr"|"bl"|"br" }) {
  const cls = {
    tl: "top-0 left-0 border-l border-t",
    tr: "top-0 right-0 border-r border-t",
    bl: "bottom-0 left-0 border-l border-b",
    br: "bottom-0 right-0 border-r border-b",
  }[pos];
  return <div className={`absolute w-3 h-3 ${cls} border-orange-500/40`} />;
}

function Panel({ children, className = "", glow = false }: {
  children: React.ReactNode; className?: string; glow?: boolean;
}) {
  return (
    <div className={`relative bg-[#0d1117]/90 border border-orange-500/15 overflow-hidden ${className}`}>
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      {glow && (
        <div className="pointer-events-none absolute -inset-px rounded-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ boxShadow: "inset 0 0 40px rgba(251,146,60,0.04)" }} />
      )}
      {children}
    </div>
  );
}

function StatTile({ label, value, icon: Icon, accent, sub }: {
  label: string; value: number; icon: any; accent: string; sub?: string;
}) {
  return (
    <Panel className="group px-4 py-3 flex items-center gap-3">
      <div className="shrink-0 w-8 h-8 flex items-center justify-center border border-orange-500/20 bg-orange-500/5">
        <Icon size={14} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">{label}</p>
        <p className="text-xl font-bold tabular-nums text-slate-100 leading-none mt-0.5">{value}</p>
        {sub && <p className="text-[9px] text-slate-700 font-mono mt-0.5">{sub}</p>}
      </div>
      <div className="ml-auto w-px self-stretch" style={{ background: accent, opacity: 0.15 }} />
    </Panel>
  );
}

function StatusBadge({ status }: { status: Task["status"] }) {
  const c = statusConfig[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wide border ${c.bg} ${c.color}`}>
      <Icon size={9} /> {c.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Task["priority"] }) {
  const c = priorityConfig[priority];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wide border border-current/20 ${c.bg} ${c.color}`}>
      <Icon size={9} /> {c.label}
    </span>
  );
}

function SectionHeader({ label, count, icon: Icon, color = "text-orange-400" }: {
  label: string; count: number; icon: any; color?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-orange-500/10 bg-[#0a0d14]/60">
      <div className="w-px h-4 bg-orange-500/40" />
      <Icon size={12} className={color} />
      <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${color}`}>{label}</span>
      <span className="ml-auto text-[10px] font-mono text-slate-600">[{count}]</span>
    </div>
  );
}

/* ─── Task Card ──────────────────────────────────────────────────── */

function TaskCard({ task, isSelected, onSelect, onView, onEdit, onDelete, onPin, onCollaborate, canEdit, isOwner }: {
  task: Task; isSelected: boolean;
  onSelect: () => void; onView: () => void; onEdit: () => void;
  onDelete: () => void; onPin: () => void; onCollaborate: () => void;
  canEdit: boolean; isOwner: boolean;
}) {
  const dueStatus = getDueDateStatus(task.dueDate, task.status);
  const subtasksDone = task.subtasks?.filter(s => s.completed).length ?? 0;
  const subtasksTotal = task.subtasks?.length ?? 0;

  return (
    <div
      onClick={onView}
      className={cn(
        "group relative border cursor-pointer transition-all duration-150 overflow-hidden",
        "bg-[#0d1117]/60 hover:bg-[#0d1117]/90 border-orange-500/10 hover:border-orange-500/25",
        isSelected && "border-orange-500/50 bg-orange-500/5",
        task.pinned && "border-amber-500/30 bg-amber-500/5",
        task.priority === "high" && task.status !== "completed" && "border-l-2 border-l-red-500/60",
      )}
    >
      {/* Priority bar top */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: priorityConfig[task.priority].accent, opacity: 0.3 }} />

      <div className="flex items-start gap-2.5 p-3">
        {/* Select checkbox */}
        <div onClick={e => { e.stopPropagation(); onSelect(); }} className="mt-0.5 shrink-0">
          {isSelected
            ? <CheckSquare size={14} className="text-orange-400" />
            : <Square size={14} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
          }
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {task.pinned && <Pin size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
                {task.isCollaborative && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide border border-sky-500/30 text-sky-400 bg-sky-500/10 px-1.5 py-0.5">
                    <Users size={8} /> TEAM
                  </span>
                )}
                <p className={cn(
                  "text-sm font-semibold text-slate-200 leading-snug truncate",
                  task.status === "completed" && "line-through text-slate-500"
                )}>
                  {task.title}
                </p>
              </div>
              {task.description && (
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 font-mono">{task.description}</p>
              )}
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={e => e.stopPropagation()}
                  className="shrink-0 w-6 h-6 flex items-center justify-center border border-orange-500/0 hover:border-orange-500/30 hover:bg-orange-500/10 transition-all opacity-0 group-hover:opacity-100 text-slate-500 hover:text-orange-400"
                >
                  <MoreVertical size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#0d1117] border-orange-500/20 text-slate-300 min-w-[140px]">
                {canEdit && (
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(); }}
                    className="text-[11px] font-mono hover:bg-orange-500/10 hover:text-orange-400 focus:bg-orange-500/10 focus:text-orange-400">
                    <Edit size={11} className="mr-2" /> Edit
                  </DropdownMenuItem>
                )}
                {isOwner && (
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); onCollaborate(); }}
                    className="text-[11px] font-mono hover:bg-orange-500/10 hover:text-orange-400 focus:bg-orange-500/10 focus:text-orange-400">
                    <UserPlus size={11} className="mr-2" /> Collaborate
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); onPin(); }}
                    className="text-[11px] font-mono hover:bg-orange-500/10 hover:text-orange-400 focus:bg-orange-500/10 focus:text-orange-400">
                    <Pin size={11} className={cn("mr-2", task.pinned && "fill-current")} />
                    {task.pinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                )}
                {canEdit && <DropdownMenuSeparator className="bg-orange-500/10" />}
                {canEdit && (
                  <DropdownMenuItem onClick={e => { e.stopPropagation(); onDelete(); }}
                    className="text-[11px] font-mono text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400">
                    <Trash2 size={11} className="mr-2" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.category && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide border border-slate-700/60 text-slate-500 bg-slate-800/40">
                <Tag size={8} /> {task.category}
              </span>
            )}
            {task.dueDate && (
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono border",
                dueStatus
                  ? dueStatus.label === "Overdue"
                    ? "text-red-400 border-red-500/30 bg-red-500/10"
                    : dueStatus.label === "Due Today"
                    ? "text-orange-400 border-orange-500/30 bg-orange-500/10"
                    : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                  : "text-slate-600 border-slate-700/40 bg-slate-800/30"
              )}>
                <CalendarIcon size={8} />
                {dueStatus?.label ?? format(task.dueDate, "MMM d")}
              </span>
            )}
          </div>

          {/* Subtask progress */}
          {subtasksTotal > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-0.5 bg-slate-800 overflow-hidden">
                <div className="h-full bg-orange-500/60 transition-all"
                  style={{ width: `${Math.round((subtasksDone / subtasksTotal) * 100)}%` }} />
              </div>
              <span className="text-[9px] font-mono text-slate-600 tabular-nums shrink-0">
                {subtasksDone}/{subtasksTotal}
              </span>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {task.tags.map(tag => (
                <span key={tag} className="text-[9px] font-mono text-orange-500/50">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Due date helper ────────────────────────────────────────────── */

function getDueDateStatus(dueDate?: Date, taskStatus?: string) {
  if (!dueDate || taskStatus === "completed") return null;
  if (isPast(dueDate) && !isToday(dueDate)) return { label: "Overdue" };
  if (isToday(dueDate)) return { label: "Due Today" };
  if (isTomorrow(dueDate)) return { label: "Due Tomorrow" };
  return null;
}

/* ─── Ops Input / Textarea ───────────────────────────────────────── */

const opsInput = "w-full bg-[#0a0d14] border border-orange-500/20 text-slate-300 placeholder:text-slate-700 font-mono text-xs px-3 py-2 focus:outline-none focus:border-orange-500/50 focus:ring-0 rounded-none";
const opsTextarea = `${opsInput} resize-none`;
const opsLabel = "text-[10px] font-mono font-bold uppercase tracking-widest text-slate-600";

/* ─── Main Component ─────────────────────────────────────────────── */

export function MyTaskDashboard({ userId, userName, userRole }: MyTaskDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Task["status"]>("pending");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [dueDate, setDueDate] = useState<Date>();
  const [category, setCategory] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [notes, setNotes] = useState("");

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<Task["status"] | "all">("all");
  const [filterPriority, setFilterPriority] = useState<Task["priority"] | "all">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [activeTab, setActiveTab] = useState<"mine" | "collab">("mine");

  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const [enhancedCollaborators, setEnhancedCollaborators] = useState<Map<string, Collaborator>>(new Map());
  const [viewTaskEnhancedCollaborators, setViewTaskEnhancedCollaborators] = useState<Collaborator[]>([]);
  const [isCollaborationDialogOpen, setIsCollaborationDialogOpen] = useState(false);
  const [collaboratorRole, setCollaboratorRole] = useState("viewer");
  const [collaboratingTask, setCollaboratingTask] = useState<Task | null>(null);
  const [collaborationMessage, setCollaborationMessage] = useState("");
  const [pendingRequests, setPendingRequests] = useState<CollaborationRequest[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  /* ── Firestore listeners ── */

  useEffect(() => {
    if (!userId) return;
    const tasksRef = collection(db, "user_tasks");
    const q = userRole === "SuperAdmin"
      ? query(tasksRef)
      : query(tasksRef, where("userId", "==", userId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData: Task[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        tasksData.push({ id: doc.id, ...d, dueDate: d.dueDate?.toDate?.(), createdAt: d.createdAt?.toDate?.(), updatedAt: d.updatedAt?.toDate?.(), completedAt: d.completedAt?.toDate?.() } as Task);
      });
      if (userRole !== "SuperAdmin") {
        getDocs(collection(db, "user_tasks")).then((all: QuerySnapshot<DocumentData>) => {
          const collabTasks: Task[] = [];
          all.forEach((doc: any) => {
            const d = doc.data();
            if (d.collaborators?.some((c: any) => c.id === userId)) {
              collabTasks.push({ id: doc.id, ...d, dueDate: d.dueDate?.toDate?.(), createdAt: d.createdAt?.toDate?.(), updatedAt: d.updatedAt?.toDate?.(), completedAt: d.completedAt?.toDate?.() } as Task);
            }
          });
          mergeAndSetTasks(tasksData, collabTasks);
        }).catch(() => {});
      } else {
        sortAndSet(tasksData);
      }
    });
    return () => unsubscribe();
  }, [userId, userRole]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, "collaboration_requests"), where("collaboratorId", "==", userId), where("status", "==", "pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: CollaborationRequest[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        data.push({ id: doc.id, ...d, createdAt: d.createdAt?.toDate?.() } as CollaborationRequest);
      });
      data.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));
      setPendingRequests(data);
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const fetchUsers = async () => {
      setIsSearchingUsers(true);
      try {
        const res = await fetch(`/api/users?currentUserId=${userId}&search=${encodeURIComponent(userSearchQuery)}`);
        if (res.ok) { const d = await res.json(); setAvailableUsers(d.users || []); }
        else setAvailableUsers([]);
      } catch { setAvailableUsers([]); }
      finally { setIsSearchingUsers(false); }
    };
    fetchUsers();
  }, [userId, userSearchQuery]);

  useEffect(() => {
    if (!viewingTask?.collaborators?.length) { setViewTaskEnhancedCollaborators([]); return; }
    Promise.all(viewingTask.collaborators.map(fetchEnhancedCollaboratorData)).then(setViewTaskEnhancedCollaborators);
  }, [viewingTask?.collaborators]);

  /* ── Helpers ── */

  const sortAndSet = (arr: Task[]) => {
    const w = { high: 3, medium: 2, low: 1 };
    arr.sort((a, b) => {
      const pd = w[b.priority] - w[a.priority];
      if (pd) return pd;
      return ((a.dueDate?.getTime() ?? 9e15) - (b.dueDate?.getTime() ?? 9e15));
    });
    setTasks(arr);
  };

  const mergeAndSetTasks = (own: Task[], collab: Task[]) => {
    const all = [...own, ...collab];
    const unique = all.filter((t, i, s) => i === s.findIndex(x => x.id === t.id));
    sortAndSet(unique);
  };

  const fetchEnhancedCollaboratorData = async (c: Collaborator): Promise<Collaborator> => {
    if (enhancedCollaborators.has(c.id)) return enhancedCollaborators.get(c.id)!;
    try {
      const res = await fetch(`/api/users/${c.id}`);
      if (res.ok) {
        const u = await res.json();
        const enhanced = { ...c, profilePicture: u.profilePicture, department: u.department, position: u.position, email: u.email || c.email, name: u.fullName || c.name };
        setEnhancedCollaborators(prev => new Map(prev.set(c.id, enhanced)));
        return enhanced;
      }
    } catch {}
    return c;
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setStatus("pending"); setPriority("medium");
    setDueDate(undefined); setCategory(""); setTags([]); setTagInput("");
    setSubtasks([]); setSubtaskInput(""); setNotes(""); setEditingTask(null); setViewingTask(null);
  };

  /* ── CRUD ── */

  const handleCreateTask = async () => {
    if (!title.trim()) { toast.error("Mission title required"); return; }
    setIsLoading(true);
    try {
      await addDoc(collection(db, "user_tasks"), {
        userId, userName, title: title.trim(),
        description: description.trim() || null, status, priority,
        dueDate: dueDate || null, category: category === "none" ? null : category || null,
        tags: tags.length ? tags : null, notes: notes.trim() || null,
        subtasks: subtasks.length ? subtasks : null,
        history: [{ id: crypto.randomUUID(), action: "created", performedBy: userName, timestamp: new Date().toISOString() }],
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        completedAt: status === "completed" ? serverTimestamp() : null,
      });
      toast.success("Mission created");
      resetForm(); setIsCreateDialogOpen(false);
    } catch { toast.error("Failed to create mission"); }
    finally { setIsLoading(false); }
  };

  const handleUpdateTask = async () => {
    if (!editingTask || !title.trim()) { toast.error("Mission title required"); return; }
    setIsLoading(true);
    try {
      const historyEntries: HistoryEntry[] = [];
      const track = (field: string, oldV: string, newV: string) => {
        if (oldV !== newV) historyEntries.push({ id: crypto.randomUUID(), action: "updated", field, oldValue: oldV, newValue: newV, performedBy: userName, timestamp: new Date().toISOString() });
      };
      track("title", editingTask.title, title.trim());
      track("status", editingTask.status, status);
      track("priority", editingTask.priority, priority);

      const updates: any = {
        title: title.trim(), description: description.trim() || null, status, priority,
        dueDate: dueDate || null, category: category === "none" ? null : category || null,
        tags: tags.length ? tags : null, notes: notes.trim() || null,
        subtasks: subtasks.length ? subtasks : null, updatedAt: serverTimestamp(),
        completedAt: status === "completed" && editingTask.status !== "completed"
          ? serverTimestamp() : status !== "completed" ? null : editingTask.completedAt,
      };
      if (historyEntries.length) updates.history = [...historyEntries, ...(editingTask.history || [])];
      await updateDoc(doc(db, "user_tasks", editingTask.id), updates);
      toast.success("Mission updated"); resetForm(); setIsEditDialogOpen(false);
    } catch { toast.error("Failed to update mission"); }
    finally { setIsLoading(false); }
  };

  const handleDeleteTask = async (taskId: string) => {
    try { await deleteDoc(doc(db, "user_tasks", taskId)); toast.success("Mission deleted"); }
    catch { toast.error("Failed to delete mission"); }
  };

  const handleBulkDelete = async () => {
    if (!selectedTasks.size) return;
    try {
      const batch = writeBatch(db);
      selectedTasks.forEach(id => batch.delete(doc(db, "user_tasks", id)));
      await batch.commit();
      toast.success(`${selectedTasks.size} missions deleted`);
      setSelectedTasks(new Set()); setSelectAll(false); setIsBulkActionsOpen(false);
    } catch { toast.error("Bulk delete failed"); }
  };

  const handleBulkStatusUpdate = async (newStatus: Task["status"]) => {
    if (!selectedTasks.size) return;
    try {
      const batch = writeBatch(db);
      selectedTasks.forEach(id => {
        const u: any = { status: newStatus, updatedAt: serverTimestamp() };
        if (newStatus === "completed") u.completedAt = serverTimestamp();
        batch.update(doc(db, "user_tasks", id), u);
      });
      await batch.commit();
      toast.success(`${selectedTasks.size} missions updated`);
      setSelectedTasks(new Set()); setSelectAll(false); setIsBulkActionsOpen(false);
    } catch { toast.error("Bulk update failed"); }
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task); setTitle(task.title); setDescription(task.description || "");
    setStatus(task.status); setPriority(task.priority); setDueDate(task.dueDate);
    setCategory(task.category || "none"); setTags(task.tags || []);
    setSubtasks(task.subtasks || []); setSubtaskInput(""); setNotes(task.notes || "");
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (task: Task) => { setViewingTask(task); setIsViewDialogOpen(true); };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) { setTags([...tags, tagInput.trim()]); setTagInput(""); }
  };

  const addSubtask = () => {
    if (subtaskInput.trim()) {
      setSubtasks([...subtasks, { id: crypto.randomUUID(), title: subtaskInput.trim(), completed: false, createdAt: new Date().toISOString() }]);
      setSubtaskInput("");
    }
  };

  const toggleSubtask = (id: string) => setSubtasks(subtasks.map(st =>
    st.id === id ? { ...st, completed: !st.completed, completedAt: !st.completed ? new Date().toISOString() : null } : st
  ));

  const openCollaborationDialog = (task: Task) => {
    setCollaboratingTask(task); setCollaboratorRole("viewer");
    setUserSearchQuery(""); setSelectedUser(null); setCollaborationMessage("");
    setIsCollaborationDialogOpen(true);
  };

  const addCollaborator = async () => {
    if (!collaboratingTask || !selectedUser) { toast.error("Select an operative"); return; }
    setIsLoading(true);
    try {
      const docRef = await addDoc(collection(db, "collaboration_requests"), {
        taskId: collaboratingTask.id, taskTitle: collaboratingTask.title,
        requesterId: userId, requesterName: userName,
        collaboratorId: selectedUser.id, collaboratorName: selectedUser.fullName,
        collaboratorEmail: selectedUser.email, role: collaboratorRole,
        status: "pending", createdAt: serverTimestamp(),
        message: collaborationMessage.trim() || undefined,
      });
      await updateDoc(doc(db, "user_tasks", collaboratingTask.id), {
        history: [{ id: crypto.randomUUID(), action: "updated", field: "collaboration_request", oldValue: "none", newValue: `Request to ${selectedUser.fullName}`, performedBy: userName, timestamp: new Date().toISOString() }, ...(collaboratingTask.history || [])],
      });
      toast.success(`Request transmitted to ${selectedUser.fullName}`);
      setIsCollaborationDialogOpen(false); setCollaboratingTask(null);
      setSelectedUser(null); setUserSearchQuery(""); setCollaboratorRole("viewer"); setCollaborationMessage("");
    } catch { toast.error("Transmission failed"); }
    finally { setIsLoading(false); }
  };

  const removeCollaborator = async (taskId: string, collaboratorId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      const updated = task.collaborators?.filter(c => c.id !== collaboratorId) || [];
      await updateDoc(doc(db, "user_tasks", taskId), { collaborators: updated, isCollaborative: updated.length > 0, updatedAt: serverTimestamp() });
      toast.success("Collaborator removed");
    } catch { toast.error("Failed to remove collaborator"); }
  };

  const acceptCollaborationRequest = async (requestId: string) => {
    try {
      const requestRef = doc(db, "collaboration_requests", requestId);
      const requestDoc = await getDoc(requestRef);
      if (!requestDoc.exists()) { toast.error("Request not found"); return; }
      await updateDoc(requestRef, { status: "accepted" });
      const request = pendingRequests.find(r => r.id === requestId);
      if (request) {
        const taskDoc = await getDoc(doc(db, "user_tasks", request.taskId));
        if (!taskDoc.exists()) { toast.error("Task not found"); return; }
        const taskData = taskDoc.data();
        let profileData: any = null;
        try { const r = await fetch(`/api/users/${userId}`); if (r.ok) profileData = await r.json(); } catch {}
        const newCollab: Collaborator = {
          id: userId, name: profileData?.fullName || userName,
          email: profileData?.email || `${userName}@company.com`,
          role: request.role, addedAt: new Date().toISOString(), addedBy: request.requesterName,
          status: "accepted", profilePicture: profileData?.profilePicture,
          department: profileData?.department, position: profileData?.position,
        };
        const existing = taskData.collaborators || [];
        if (existing.some((c: Collaborator) => c.id === userId)) { toast.info("Already a collaborator"); return; }
        await updateDoc(doc(db, "user_tasks", request.taskId), {
          collaborators: [...existing, newCollab], isCollaborative: true, updatedAt: serverTimestamp(),
        });
        toast.success(`Access granted to "${request.taskTitle}"`);
      }
      setPendingRequests(pendingRequests.filter(r => r.id !== requestId));
    } catch { toast.error("Failed to accept request"); }
  };

  const rejectCollaborationRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, "collaboration_requests", requestId), { status: "rejected" });
      toast.success("Request declined");
      setPendingRequests(pendingRequests.filter(r => r.id !== requestId));
    } catch { toast.error("Failed to decline request"); }
  };

  const togglePin = async (taskId: string, pinned: boolean) => {
    try {
      await updateDoc(doc(db, "user_tasks", taskId), { pinned: !pinned, updatedAt: serverTimestamp() });
      toast.success(!pinned ? "Mission pinned" : "Mission unpinned");
    } catch { toast.error("Failed"); }
  };

  const exportTaskToPDF = (task: Task) => {
    try {
      const pdf = new jsPDF();
      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();
      let y = 30; const m = 20; const cw = W - m * 2;
      const checkPage = (h: number) => { if (y + h > H - 20) { pdf.addPage(); y = 30; } };
      pdf.setFontSize(18); pdf.setFont("helvetica", "bold");
      pdf.splitTextToSize(task.title, cw).forEach((l: string) => { pdf.text(l, m, y); y += 8; });
      y += 8;
      pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
      [`Status: ${statusConfig[task.status].label}`, `Priority: ${priorityConfig[task.priority].label}`,
       task.category ? `Category: ${task.category}` : null, task.dueDate ? `Due: ${format(task.dueDate, "PPP")}` : null,
      ].filter(Boolean).forEach(info => { checkPage(8); pdf.text(info!, m, y); y += 8; });
      if (task.description) {
        y += 8; pdf.setFontSize(14); pdf.setFont("helvetica", "bold"); pdf.text("Description", m, y); y += 10;
        pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
        pdf.splitTextToSize(task.description, cw).forEach((l: string) => { checkPage(8); pdf.text(l, m, y); y += 6; });
      }
      const fn = `task-${task.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      pdf.save(fn); toast.success("PDF exported");
    } catch { toast.error("Export failed"); }
  };

  /* ── Computed ── */

  const canEditTask = (task: Task) =>
    userRole === "SuperAdmin" || task.userId === userId || task.collaborators?.some(c => c.id === userId);
  const isOwner = (task: Task) => task.userId === userId || userRole === "SuperAdmin";

  const filteredTasks = useMemo(() => tasks.filter(task => {
    const q = searchQuery.toLowerCase();
    return (
      (!q || task.title.toLowerCase().includes(q) || task.description?.toLowerCase().includes(q) || task.tags?.some(t => t.toLowerCase().includes(q))) &&
      (filterStatus === "all" || task.status === filterStatus) &&
      (filterPriority === "all" || task.priority === filterPriority) &&
      (filterCategory === "all" || task.category === filterCategory) &&
      (!showOverdueOnly || (task.dueDate && isPast(task.dueDate) && task.status !== "completed"))
    );
  }), [tasks, searchQuery, filterStatus, filterPriority, filterCategory, showOverdueOnly]);

  const sortedTasks = useMemo(() => [...filteredTasks].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const w = { high: 3, medium: 2, low: 1 };
    const pd = w[b.priority] - w[a.priority];
    if (pd) return pd;
    return ((a.dueDate?.getTime() ?? 9e15) - (b.dueDate?.getTime() ?? 9e15));
  }), [filteredTasks]);

  const myTasks = sortedTasks.filter(t => !t.isCollaborative);
  const collabTasks = sortedTasks.filter(t => t.isCollaborative);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const inProgress = tasks.filter(t => t.status === "in-progress").length;
    const pending = tasks.filter(t => t.status === "pending").length;
    const overdue = tasks.filter(t => t.dueDate && isPast(t.dueDate) && t.status !== "completed").length;
    const highPriority = tasks.filter(t => t.priority === "high" && t.status !== "completed").length;
    return { total, completed, inProgress, pending, overdue, highPriority, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [tasks]);

  const hasFilters = filterStatus !== "all" || filterPriority !== "all" || filterCategory !== "all" || showOverdueOnly || !!searchQuery;

  /* ── Select ops select styling ── */
  const selectTriggerCls = "h-8 rounded-none bg-[#0a0d14] border border-orange-500/20 text-slate-400 text-[11px] font-mono focus:ring-0 focus:border-orange-500/40 hover:border-orange-500/30 [&>span]:truncate";
  const selectContentCls = "rounded-none bg-[#0d1117] border border-orange-500/20 text-[11px] font-mono";
  const selectItemCls = "text-slate-400 hover:bg-orange-500/10 hover:text-orange-400 focus:bg-orange-500/10 focus:text-orange-400 font-mono text-[11px] rounded-none cursor-pointer";

  /* ── Form dialog shared content ── */
  const TaskFormContent = () => (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-3 rounded-none bg-[#0a0d14] border border-orange-500/15 p-0 h-8">
        {["basic","subtasks","notes"].map(v => (
          <TabsTrigger key={v} value={v}
            className="rounded-none text-[10px] font-mono uppercase tracking-widest text-slate-600 data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 data-[state=active]:shadow-none h-full border-r border-orange-500/10 last:border-r-0">
            {v === "basic" ? "Parameters" : v === "subtasks" ? `Subtasks (${subtasks.length})` : "Notes"}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="basic" className="space-y-4 mt-4">
        <div>
          <label className={opsLabel}>Mission Title *</label>
          <input className={`${opsInput} mt-1`} placeholder="Enter designation..." value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={opsLabel}>Mission Brief</label>
          <textarea className={`${opsTextarea} mt-1`} rows={3} placeholder="Describe mission parameters..." value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={opsLabel}>Status</label>
            <Select value={status} onValueChange={v => setStatus(v as Task["status"])}>
              <SelectTrigger className={`${selectTriggerCls} mt-1`}><SelectValue /></SelectTrigger>
              <SelectContent className={selectContentCls}>
                {Object.entries(statusConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k} className={selectItemCls}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={opsLabel}>Priority</label>
            <Select value={priority} onValueChange={v => setPriority(v as Task["priority"])}>
              <SelectTrigger className={`${selectTriggerCls} mt-1`}><SelectValue /></SelectTrigger>
              <SelectContent className={selectContentCls}>
                {Object.entries(priorityConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k} className={selectItemCls}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={opsLabel}>Due Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <button className={`${opsInput} mt-1 flex items-center gap-2 w-full text-left ${!dueDate ? "text-slate-700" : ""}`}>
                  <CalendarIcon size={11} className="text-orange-500/50 shrink-0" />
                  {dueDate ? format(dueDate, "PP") : "Select date"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-none bg-[#0d1117] border border-orange-500/20" align="start">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus
                  className="bg-[#0d1117] text-slate-300 [&_.rdp-day_button:hover]:bg-orange-500/20 [&_.rdp-day_button.rdp-day_selected]:bg-orange-500/30" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className={opsLabel}>Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className={`${selectTriggerCls} mt-1`}><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value="none" className={selectItemCls}>None</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c} className={selectItemCls}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className={opsLabel}>Tags</label>
          <div className="flex gap-2 mt-1">
            <input className={opsInput} placeholder="Add tag..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} />
            <button onClick={addTag} className="shrink-0 px-3 text-[10px] font-mono text-orange-400 border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-colors">ADD</button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-mono text-orange-500/70 border border-orange-500/20 px-2 py-0.5">
                #{tag}
                <button onClick={() => setTags(tags.filter(t => t !== tag))} className="text-slate-600 hover:text-red-400 transition-colors ml-0.5">×</button>
              </span>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="subtasks" className="space-y-3 mt-4">
        <label className={opsLabel}>Subtasks — {subtasks.filter(s => s.completed).length}/{subtasks.length} complete</label>
        <div className="flex gap-2">
          <input className={opsInput} placeholder="Add subtask..." value={subtaskInput} onChange={e => setSubtaskInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSubtask())} />
          <button onClick={addSubtask} className="shrink-0 px-3 text-[10px] font-mono text-orange-400 border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-colors"><Plus size={12} /></button>
        </div>
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {subtasks.length === 0 ? (
            <p className="text-[11px] font-mono text-slate-700 py-4 text-center">No subtasks defined</p>
          ) : subtasks.map(st => (
            <div key={st.id} className="flex items-center gap-2 px-3 py-2 border border-orange-500/10 bg-[#0a0d14]/60">
              <Checkbox checked={st.completed} onCheckedChange={() => toggleSubtask(st.id)}
                className="border-orange-500/30 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 rounded-none h-3.5 w-3.5" />
              <span className={cn("flex-1 text-[11px] font-mono text-white", st.completed && "line-through text-white")}>{st.title}</span>
              <button onClick={() => setSubtasks(subtasks.filter(s => s.id !== st.id))} className="text-slate-700 hover:text-red-400 transition-colors"><Trash2 size={10} /></button>
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="notes" className="mt-4">
        <label className={opsLabel}>Notes & References</label>
        <textarea className={`${opsTextarea} mt-1`} rows={10} placeholder="Additional notes, links, references..." value={notes} onChange={e => setNotes(e.target.value)} />
      </TabsContent>
    </Tabs>
  );

  /* ─────────────────────────────── RENDER ──────────────────────── */

  return (
    <div className="p-4 space-y-4">

      {/* ── Collaboration Requests ── */}
      {pendingRequests.length > 0 && (
        <Panel className="overflow-hidden">
          <SectionHeader label="Incoming Collaboration Requests" count={pendingRequests.length} icon={Radio} color="text-sky-400" />
          <div className="p-3 space-y-2">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between gap-4 px-3 py-2.5 border border-sky-500/15 bg-sky-500/5">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono font-semibold text-slate-300 truncate">
                    <span className="text-sky-400">{req.requesterName}</span> · {req.taskTitle}
                  </p>
                  <p className="text-[10px] font-mono text-slate-600 mt-0.5">Role: {req.role}{req.message ? ` · "${req.message}"` : ""}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => acceptCollaborationRequest(req.id)}
                    className="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wide text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                    Accept
                  </button>
                  <button onClick={() => rejectCollaborationRequest(req.id)}
                    className="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wide text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatTile label="Total"       value={stats.total}       icon={Target}       accent="#f97316" />
        <StatTile label="Completed"   value={stats.completed}   icon={CheckCircle2} accent="#10b981" />
        <StatTile label="In Progress" value={stats.inProgress}  icon={Activity}     accent="#f97316" />
        <StatTile label="Pending"     value={stats.pending}     icon={Clock}        accent="#f59e0b" />
        <StatTile label="Overdue"     value={stats.overdue}     icon={AlertTriangle}accent="#ef4444" />
        <StatTile label="High Pri."   value={stats.highPriority}icon={Zap}          accent="#f87171" />
      </div>

      {/* ── Completion bar ── */}
      <Panel className="px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Completion Rate</span>
          <span className="text-[10px] font-mono font-bold text-orange-400 tabular-nums">{stats.rate}%</span>
        </div>
        <div className="h-1 bg-slate-800/80 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-700"
            style={{ width: `${stats.rate}%` }} />
        </div>
      </Panel>

      {/* ── Filter bar ── */}
      <Panel className="px-4 py-3">
        <div className="flex flex-col gap-3">
          {/* Top row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              <input className={`${opsInput} pl-8`} placeholder="Search missions..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <button onClick={() => setViewMode(m => m === "list" ? "grid" : "list")}
              className="shrink-0 w-8 h-8 flex items-center justify-center border border-orange-500/20 bg-[#0a0d14] text-slate-500 hover:text-orange-400 hover:border-orange-500/40 transition-colors">
              {viewMode === "list" ? <LayoutGrid size={13} /> : <List size={13} />}
            </button>
            {selectedTasks.size > 0 && (
              <button onClick={() => setIsBulkActionsOpen(true)}
                className="flex items-center gap-1.5 px-3 h-8 text-[10px] font-mono font-bold uppercase tracking-wide text-orange-400 border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-colors">
                <CheckSquare size={11} /> {selectedTasks.size} selected
              </button>
            )}
            <button onClick={() => setIsCreateDialogOpen(true)}
              className="flex items-center gap-1.5 px-4 h-8 text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400 border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-colors shrink-0">
              <Plus size={11} /> New Mission
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={10} className="text-slate-700 shrink-0" />
            <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
              <SelectTrigger className={`${selectTriggerCls} w-32`}><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value="all" className={selectItemCls}>All Status</SelectItem>
                {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k} className={selectItemCls}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={v => setFilterPriority(v as any)}>
              <SelectTrigger className={`${selectTriggerCls} w-32`}><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value="all" className={selectItemCls}>All Priority</SelectItem>
                {Object.entries(priorityConfig).map(([k, v]) => <SelectItem key={k} value={k} className={selectItemCls}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className={`${selectTriggerCls} w-36`}><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value="all" className={selectItemCls}>All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c} className={selectItemCls}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <button
              onClick={() => setShowOverdueOnly(!showOverdueOnly)}
              className={cn(
                "flex items-center gap-1.5 px-3 h-8 text-[10px] font-mono font-bold uppercase tracking-wide border transition-colors",
                showOverdueOnly
                  ? "text-red-400 border-red-500/40 bg-red-500/10"
                  : "text-slate-600 border-orange-500/15 bg-[#0a0d14] hover:border-orange-500/30 hover:text-slate-400"
              )}>
              <AlertTriangle size={10} /> Overdue
            </button>

            {hasFilters && (
              <button
                onClick={() => { setFilterStatus("all"); setFilterPriority("all"); setFilterCategory("all"); setShowOverdueOnly(false); setSearchQuery(""); }}
                className="flex items-center gap-1 text-[10px] font-mono text-slate-700 hover:text-red-400 transition-colors">
                <X size={10} /> Clear
              </button>
            )}
          </div>
        </div>
      </Panel>

      {/* ── Task Columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* My Tasks */}
        <div className="flex flex-col">
          <Panel className="flex flex-col flex-1">
            <SectionHeader label="My Missions" count={myTasks.length} icon={Shield} />
            <div className="px-3 py-2 border-b border-orange-500/10 flex items-center gap-2">
              <Checkbox
                checked={selectAll}
                onCheckedChange={() => { if (selectAll) { setSelectedTasks(new Set()); } else { setSelectedTasks(new Set(myTasks.map(t => t.id))); } setSelectAll(!selectAll); }}
                className="border-orange-500/30 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 rounded-none h-3 w-3"
              />
              <span className="text-[9px] font-mono text-slate-700 uppercase tracking-widest">Select all</span>
            </div>
            <ScrollArea className="flex-1" style={{ maxHeight: 540 }}>
              <div className={cn("p-2", viewMode === "grid" ? "grid grid-cols-2 gap-2" : "space-y-1.5")}>
                {myTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <Terminal size={24} className="text-slate-800" />
                    <p className="text-[11px] font-mono text-slate-700 uppercase tracking-widest">No missions found</p>
                  </div>
                ) : myTasks.map(task => (
                  <TaskCard key={task.id} task={task}
                    isSelected={selectedTasks.has(task.id)}
                    onSelect={() => { const n = new Set(selectedTasks); n.has(task.id) ? n.delete(task.id) : n.add(task.id); setSelectedTasks(n); }}
                    onView={() => openViewDialog(task)}
                    onEdit={() => openEditDialog(task)}
                    onDelete={() => handleDeleteTask(task.id)}
                    onPin={() => togglePin(task.id, task.pinned || false)}
                    onCollaborate={() => openCollaborationDialog(task)}
                    canEdit={!!canEditTask(task)} isOwner={isOwner(task)}
                  />
                ))}
              </div>
            </ScrollArea>
          </Panel>
        </div>

        {/* Collaborative Tasks */}
        <div className="flex flex-col">
          <Panel className="flex flex-col flex-1">
            <SectionHeader label="Collaborative Missions" count={collabTasks.length} icon={Users} color="text-sky-400" />
            <ScrollArea className="flex-1" style={{ maxHeight: 572 }}>
              <div className={cn("p-2", viewMode === "grid" ? "grid grid-cols-2 gap-2" : "space-y-1.5")}>
                {collabTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <Users size={24} className="text-slate-800" />
                    <p className="text-[11px] font-mono text-slate-700 uppercase tracking-widest">No collaborative missions</p>
                  </div>
                ) : collabTasks.map(task => (
                  <TaskCard key={task.id} task={task}
                    isSelected={selectedTasks.has(task.id)}
                    onSelect={() => { const n = new Set(selectedTasks); n.has(task.id) ? n.delete(task.id) : n.add(task.id); setSelectedTasks(n); }}
                    onView={() => openViewDialog(task)}
                    onEdit={() => openEditDialog(task)}
                    onDelete={() => handleDeleteTask(task.id)}
                    onPin={() => togglePin(task.id, task.pinned || false)}
                    onCollaborate={() => openCollaborationDialog(task)}
                    canEdit={!!canEditTask(task)} isOwner={isOwner(task)}
                  />
                ))}
              </div>
            </ScrollArea>
          </Panel>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* ── Create / Edit Dialog ── */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={open => { if (!open) { setIsCreateDialogOpen(false); setIsEditDialogOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto rounded-none bg-[#0d1117] border border-orange-500/20 p-0 gap-0">
          <div className="px-5 py-3.5 border-b border-orange-500/15 bg-[#0a0d14]">
            <DialogTitle className="text-[11px] font-mono font-bold uppercase tracking-widest text-orange-400 flex items-center gap-2">
              <div className="w-1 h-4 bg-orange-500" />
              {editingTask ? "Edit Mission Parameters" : "Initialize New Mission"}
            </DialogTitle>
            <DialogDescription className="text-[10px] font-mono text-slate-600 mt-0.5 ml-3">
              {editingTask ? "Update existing mission record" : "Create new mission entry in the log"}
            </DialogDescription>
          </div>
          <div className="p-5"><TaskFormContent /></div>
          <div className="px-5 py-3 border-t border-orange-500/15 bg-[#0a0d14] flex justify-end gap-2">
            <button onClick={() => { setIsCreateDialogOpen(false); setIsEditDialogOpen(false); resetForm(); }}
              className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-500 border border-slate-700/60 hover:border-slate-600 hover:text-slate-400 transition-colors">
              Cancel
            </button>
            <button onClick={editingTask ? handleUpdateTask : handleCreateTask} disabled={isLoading}
              className="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400 border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-colors disabled:opacity-40">
              {isLoading ? "Saving…" : editingTask ? "Update Mission" : "Create Mission"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View Dialog ── */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto rounded-none bg-[#0d1117] border border-orange-500/20 p-0 gap-0">
          {viewingTask && (
            <>
              <div className="px-5 py-3.5 border-b border-orange-500/15 bg-[#0a0d14]">
                <DialogTitle className="text-[11px] font-mono font-bold uppercase tracking-widest text-orange-400 flex items-center gap-2">
                  <div className="w-1 h-4 bg-orange-500" />Mission Details
                </DialogTitle>
                <DialogDescription className="text-[10px] font-mono text-slate-600 mt-0.5 ml-3 truncate">{viewingTask.title}</DialogDescription>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 leading-snug">{viewingTask.title}</h3>
                  {viewingTask.description && <p className="text-[11px] font-mono text-slate-500 mt-1.5 leading-relaxed">{viewingTask.description}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status={viewingTask.status} />
                  <PriorityBadge priority={viewingTask.priority} />
                  {viewingTask.category && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono border border-slate-700/60 text-slate-500">{viewingTask.category}</span>
                  )}
                </div>
                <div className="space-y-1.5 text-[10px] font-mono text-slate-600">
                  {viewingTask.dueDate && <div className="flex items-center gap-2"><CalendarIcon size={10} className="text-orange-500/50" />Due: {format(viewingTask.dueDate, "PPP")}</div>}
                  <div className="flex items-center gap-2"><Clock size={10} className="text-orange-500/50" />Created: {viewingTask.createdAt ? format(viewingTask.createdAt, "PPp") : "—"}</div>
                </div>
                {viewingTask.notes && (
                  <div className="px-3 py-2.5 border border-orange-500/10 bg-[#0a0d14]/60">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-slate-700 mb-1.5">Notes</p>
                    <p className="text-[11px] font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">{viewingTask.notes}</p>
                  </div>
                )}
                {viewingTask.tags && viewingTask.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {viewingTask.tags.map(t => <span key={t} className="text-[10px] font-mono text-orange-500/50">#{t}</span>)}
                  </div>
                )}
                {/* Subtasks */}
                {viewingTask.subtasks && viewingTask.subtasks.length > 0 && (
                  <div className="border border-orange-500/10">
                    <div className="px-3 py-1.5 border-b border-orange-500/10 bg-[#0a0d14]/60">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-700">Subtasks — {viewingTask.subtasks.filter(s => s.completed).length}/{viewingTask.subtasks.length}</span>
                    </div>
                    <div className="p-2 space-y-1">
                      {viewingTask.subtasks.map(st => (
                        <div key={st.id} className="flex items-center gap-2 text-[11px] font-mono">
                          {st.completed ? <CheckCircle2 size={11} className="text-emerald-400 shrink-0" /> : <Circle size={11} className="text-slate-700 shrink-0" />}
                          <span className={cn("text-slate-400", st.completed && "line-through text-slate-700")}>{st.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Collaborators */}
                {viewTaskEnhancedCollaborators.length > 0 && (
                  <div className="border border-orange-500/10">
                    <div className="px-3 py-1.5 border-b border-orange-500/10 bg-[#0a0d14]/60">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-700">Collaborators ({viewTaskEnhancedCollaborators.length})</span>
                    </div>
                    <div className="p-2 space-y-1.5">
                      {viewTaskEnhancedCollaborators.map(c => (
                        <div key={c.id} className="flex items-center justify-between gap-2 px-2 py-1.5 border border-orange-500/5 bg-[#0a0d14]/40">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 flex items-center justify-center bg-gradient-to-br from-orange-500/20 to-orange-400/10 border border-orange-500/20 text-[9px] font-mono text-orange-400 shrink-0">
                              {c.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-mono text-slate-300 truncate">{c.name}</p>
                              <p className="text-[9px] font-mono text-slate-700 truncate">{c.position || c.role}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] font-mono uppercase tracking-wide text-orange-500/50 border border-orange-500/20 px-1.5 py-0.5">{c.role}</span>
                            {isOwner(viewingTask) && (
                              <button onClick={() => removeCollaborator(viewingTask.id, c.id)} className="text-slate-700 hover:text-red-400 transition-colors"><UserMinus size={11} /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* History */}
                {viewingTask.history && viewingTask.history.length > 0 && (
                  <div className="border border-orange-500/10">
                    <div className="px-3 py-1.5 border-b border-orange-500/10 bg-[#0a0d14]/60">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-700">Activity Log</span>
                    </div>
                    <div className="p-2 space-y-1.5 max-h-40 overflow-y-auto">
                      {viewingTask.history.map((entry, i) => (
                        <div key={entry.id || i} className="flex items-start gap-2 text-[10px] font-mono">
                          <div className="w-3 h-3 mt-0.5 flex items-center justify-center shrink-0">
                            {entry.action === "created" ? <Plus size={9} className="text-emerald-400" /> : <Edit size={9} className="text-orange-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-slate-400">{entry.action === "created" ? "Created" : entry.field ? `Updated ${entry.field}` : "Updated"}</span>
                            {entry.oldValue && entry.newValue && <span className="text-slate-700"> · {entry.oldValue} → {entry.newValue}</span>}
                            <p className="text-slate-700 mt-0.5">by {entry.performedBy} · {entry.timestamp ? format(typeof entry.timestamp === "string" ? new Date(entry.timestamp) : entry.timestamp.toDate?.() ?? new Date(), "MMM d, h:mm a") : "—"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-5 py-3 border-t border-orange-500/15 bg-[#0a0d14] flex flex-wrap gap-2">
                {canEditTask(viewingTask) && (
                  <button onClick={() => { setIsViewDialogOpen(false); openEditDialog(viewingTask); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide text-orange-400 border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-colors">
                    <Edit size={10} /> Edit
                  </button>
                )}
                {isOwner(viewingTask) && (
                  <button onClick={() => { setIsViewDialogOpen(false); openCollaborationDialog(viewingTask); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide text-sky-400 border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 transition-colors">
                    <UserPlus size={10} /> Collaborate
                  </button>
                )}
                {canEditTask(viewingTask) && (
                  <button onClick={() => exportTaskToPDF(viewingTask)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-400 border border-slate-700/60 hover:border-slate-600 hover:text-slate-300 transition-colors">
                    <Download size={10} /> Export PDF
                  </button>
                )}
                {canEditTask(viewingTask) && (
                  <button onClick={() => { handleDeleteTask(viewingTask.id); setIsViewDialogOpen(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors ml-auto">
                    <Trash2 size={10} /> Delete
                  </button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Collaboration Dialog ── */}
      <Dialog open={isCollaborationDialogOpen} onOpenChange={setIsCollaborationDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto rounded-none bg-[#0d1117] border border-orange-500/20 p-0 gap-0">
          <div className="px-5 py-3.5 border-b border-orange-500/15 bg-[#0a0d14]">
            <DialogTitle className="text-[11px] font-mono font-bold uppercase tracking-widest text-orange-400 flex items-center gap-2">
              <div className="w-1 h-4 bg-orange-500" />Transmit Collaboration Request
            </DialogTitle>
            <DialogDescription className="text-[10px] font-mono text-slate-600 mt-0.5 ml-3 truncate">
              Mission: {collaboratingTask?.title}
            </DialogDescription>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className={opsLabel}>Select Operative</label>
              <div className="relative mt-1">
                <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input className={`${opsInput} pl-8`} placeholder="Search by name or department..."
                  value={userSearchQuery} onChange={e => { setUserSearchQuery(e.target.value); setSelectedUser(null); }} />
              </div>
              {availableUsers.length > 0 && (
                <div className="mt-1 border border-orange-500/15 max-h-52 overflow-y-auto">
                  {availableUsers.map(u => (
                    <div key={u.id} onClick={() => { setSelectedUser(u); setUserSearchQuery(u.fullName); }}
                      className={cn("flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-orange-500/10 last:border-b-0 transition-colors",
                        selectedUser?.id === u.id ? "bg-orange-500/10" : "hover:bg-orange-500/5")}>
                      <div className="w-7 h-7 shrink-0 flex items-center justify-center bg-orange-500/10 border border-orange-500/20 text-[9px] font-mono text-orange-400">
                        {u.firstName?.[0]}{u.lastName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-mono text-slate-300">{u.fullName}</p>
                        <p className="text-[9px] font-mono text-slate-700">{u.referenceId} · {u.department}</p>
                      </div>
                      <span className="text-[9px] font-mono text-orange-500/40 uppercase">{u.role}</span>
                    </div>
                  ))}
                </div>
              )}
              {userSearchQuery && !availableUsers.length && !isSearchingUsers && (
                <p className="mt-2 text-[10px] font-mono text-slate-700 text-center py-3 border border-orange-500/10">No operatives found</p>
              )}
            </div>
            <div>
              <label className={opsLabel}>Role</label>
              <Select value={collaboratorRole} onValueChange={setCollaboratorRole}>
                <SelectTrigger className={`${selectTriggerCls} mt-1 w-full`}><SelectValue /></SelectTrigger>
                <SelectContent className={selectContentCls}>
                  <SelectItem value="viewer" className={selectItemCls}>Viewer — view only</SelectItem>
                  <SelectItem value="editor" className={selectItemCls}>Editor — view & edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={opsLabel}>Message (Optional)</label>
              <textarea className={`${opsTextarea} mt-1`} rows={3} placeholder="Add a message to the operative..."
                value={collaborationMessage} onChange={e => setCollaborationMessage(e.target.value)} />
            </div>
          </div>
          <div className="px-5 py-3 border-t border-orange-500/15 bg-[#0a0d14] flex justify-end gap-2">
            <button onClick={() => { setIsCollaborationDialogOpen(false); setCollaboratingTask(null); setSelectedUser(null); setUserSearchQuery(""); setCollaboratorRole("viewer"); setCollaborationMessage(""); }}
              className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-500 border border-slate-700/60 hover:border-slate-600 hover:text-slate-400 transition-colors">
              Cancel
            </button>
            <button onClick={addCollaborator} disabled={isLoading || !selectedUser}
              className="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400 border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-colors disabled:opacity-40">
              {isLoading ? "Transmitting…" : "Transmit Request"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Actions Dialog ── */}
      <Dialog open={isBulkActionsOpen} onOpenChange={setIsBulkActionsOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-none bg-[#0d1117] border border-orange-500/20 p-0 gap-0">
          <div className="px-5 py-3.5 border-b border-orange-500/15 bg-[#0a0d14]">
            <DialogTitle className="text-[11px] font-mono font-bold uppercase tracking-widest text-orange-400 flex items-center gap-2">
              <div className="w-1 h-4 bg-orange-500" />Bulk Operations
            </DialogTitle>
            <DialogDescription className="text-[10px] font-mono text-slate-600 mt-0.5 ml-3">{selectedTasks.size} missions selected</DialogDescription>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className={`${opsLabel} mb-2`}>Change Status</p>
              <div className="grid grid-cols-2 gap-1.5">
                {([["pending", "Pending", "#f59e0b"], ["in-progress", "In Progress", "#f97316"], ["completed", "Completed", "#10b981"], ["on-hold", "On Hold", "#64748b"]] as const).map(([s, label, color]) => (
                  <button key={s} onClick={() => handleBulkStatusUpdate(s)}
                    className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide border border-orange-500/15 bg-[#0a0d14] hover:border-orange-500/30 hover:bg-orange-500/5 transition-colors text-left"
                    style={{ color }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={`${opsLabel} mb-2`}>Danger Zone</p>
              <button onClick={handleBulkDelete}
                className="w-full px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
                <Trash2 size={11} /> Delete {selectedTasks.size} Missions
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}