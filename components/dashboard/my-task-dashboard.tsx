"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Plus,
  CheckCircle2,
  Clock,
  PlayCircle,
  PauseCircle,
  XCircle,
  MoreVertical,
  Edit,
  Trash2,
  ListTodo,
  Search,
  Filter,
  Calendar as CalendarIcon,
  Tag,
  AlertTriangle,
  CheckSquare,
  Square,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertCircle,
  LayoutGrid,
  List,
  Circle,
  Pin,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: any;
  completedAt?: any;
}

interface HistoryEntry {
  id: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  performedBy: string;
  timestamp: any;
}

interface Task {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description?: string;
  status: "pending" | "in-progress" | "completed" | "on-hold" | "cancelled";
  priority: "low" | "medium" | "high";
  dueDate?: Date;
  category?: string;
  tags?: string[];
  notes?: string;
  subtasks?: Subtask[];
  history?: HistoryEntry[];
  pinned?: boolean;
  createdAt: any;
  updatedAt: any;
  completedAt?: any;
}

const statusConfig = {
  pending: { icon: Clock, label: "Pending", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", progress: 0 },
  "in-progress": { icon: PlayCircle, label: "In Progress", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", progress: 50 },
  completed: { icon: CheckCircle2, label: "Completed", color: "bg-green-500/10 text-green-600 border-green-500/20", progress: 100 },
  "on-hold": { icon: PauseCircle, label: "On Hold", color: "bg-orange-500/10 text-orange-600 border-orange-500/20", progress: 25 },
  cancelled: { icon: XCircle, label: "Cancelled", color: "bg-red-500/10 text-red-600 border-red-500/20", progress: 0 },
};

const priorityConfig = {
  low: { icon: ArrowDownCircle, color: "text-blue-500", bgColor: "bg-blue-500/10", label: "Low" },
  medium: { icon: AlertCircle, color: "text-yellow-500", bgColor: "bg-yellow-500/10", label: "Medium" },
  high: { icon: ArrowUpCircle, color: "text-red-500", bgColor: "bg-red-500/10", label: "High" },
};

const categories = [
  "Development",
  "Design",
  "Meeting",
  "Research",
  "Documentation",
  "Testing",
  "Bug Fix",
  "Feature",
  "Other",
];

interface MyTaskDashboardProps {
  userId: string;
  userName: string;
  userRole?: string;
}

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

  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const tasksRef = collection(db, "user_tasks");
    
    // Super Admin can see all tasks, regular users only see their own
    const q = userRole === "SuperAdmin" 
      ? query(tasksRef) // No where clause for Super Admin
      : query(tasksRef, where("userId", "==", userId)); // Regular users only see their tasks

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData: Task[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        tasksData.push({
          id: doc.id,
          ...data,
          dueDate: data.dueDate?.toDate?.(),
          createdAt: data.createdAt?.toDate?.(),
          updatedAt: data.updatedAt?.toDate?.(),
          completedAt: data.completedAt?.toDate?.(),
        } as Task);
      });
      tasksData.sort((a, b) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        const dateA = a.dueDate || new Date(9999, 0, 1);
        const dateB = b.dueDate || new Date(9999, 0, 1);
        return dateA.getTime() - dateB.getTime();
      });
      setTasks(tasksData);
    });

    return () => unsubscribe();
  }, [userId, userRole]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = filterStatus === "all" || task.status === filterStatus;
      const matchesPriority = filterPriority === "all" || task.priority === filterPriority;
      const matchesCategory = filterCategory === "all" || task.category === filterCategory;
      const matchesOverdue = !showOverdueOnly || (task.dueDate && isPast(task.dueDate) && task.status !== "completed");

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory && matchesOverdue;
    });
  }, [tasks, searchQuery, filterStatus, filterPriority, filterCategory, showOverdueOnly]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const inProgress = tasks.filter((t) => t.status === "in-progress").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const overdue = tasks.filter((t) => t.dueDate && isPast(t.dueDate) && t.status !== "completed").length;
    const highPriority = tasks.filter((t) => t.priority === "high" && t.status !== "completed").length;

    return {
      total,
      completed,
      inProgress,
      pending,
      overdue,
      highPriority,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [tasks]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("pending");
    setPriority("medium");
    setDueDate(undefined);
    setCategory("");
    setTags([]);
    setTagInput("");
    setSubtasks([]);
    setSubtaskInput("");
    setNotes("");
    setEditingTask(null);
    setViewingTask(null);
  };

  const handleCreateTask = async () => {
    if (!title.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    setIsLoading(true);
    try {
      // Create initial history entry
      const initialHistory: HistoryEntry[] = [{
        id: crypto.randomUUID(),
        action: "created",
        performedBy: userName,
        timestamp: new Date().toISOString(),
      }];

      await addDoc(collection(db, "user_tasks"), {
        userId,
        userName,
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        dueDate: dueDate || null,
        category: category === "none" ? null : category || null,
        tags: tags.length > 0 ? tags : null,
        notes: notes.trim() || null,
        subtasks: subtasks.length > 0 ? subtasks : null,
        history: initialHistory,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        completedAt: status === "completed" ? serverTimestamp() : null,
      });

      toast.success("Task created successfully");
      resetForm();
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTask = async () => {
    if (!editingTask || !title.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    setIsLoading(true);
    try {
      const taskRef = doc(db, "user_tasks", editingTask.id);
      
      // Build history of changes
      const historyEntries: HistoryEntry[] = [];
      
      if (editingTask.title !== title.trim()) {
        historyEntries.push({
          id: crypto.randomUUID(),
          action: "updated",
          field: "title",
          oldValue: editingTask.title,
          newValue: title.trim(),
          performedBy: userName,
          timestamp: new Date().toISOString(),
        });
      }
      if (editingTask.status !== status) {
        historyEntries.push({
          id: crypto.randomUUID(),
          action: "updated",
          field: "status",
          oldValue: editingTask.status,
          newValue: status,
          performedBy: userName,
          timestamp: new Date().toISOString(),
        });
      }
      if (editingTask.priority !== priority) {
        historyEntries.push({
          id: crypto.randomUUID(),
          action: "updated",
          field: "priority",
          oldValue: editingTask.priority,
          newValue: priority,
          performedBy: userName,
          timestamp: new Date().toISOString(),
        });
      }
      if ((editingTask.subtasks?.length || 0) !== subtasks.length) {
        historyEntries.push({
          id: crypto.randomUUID(),
          action: "updated",
          field: "subtasks",
          oldValue: `${editingTask.subtasks?.length || 0} subtasks`,
          newValue: `${subtasks.length} subtasks`,
          performedBy: userName,
          timestamp: new Date().toISOString(),
        });
      }

      const updates: any = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        dueDate: dueDate || null,
        category: category === "none" ? null : category || null,
        tags: tags.length > 0 ? tags : null,
        notes: notes.trim() || null,
        subtasks: subtasks.length > 0 ? subtasks : null,
        updatedAt: serverTimestamp(),
        completedAt: status === "completed" && editingTask.status !== "completed"
          ? serverTimestamp()
          : status !== "completed"
          ? null
          : editingTask.completedAt,
      };

      // Append new history entries to existing history
      if (historyEntries.length > 0) {
        const existingHistory = editingTask.history || [];
        updates.history = [...historyEntries, ...existingHistory];
      }

      await updateDoc(taskRef, updates);

      toast.success("Task updated successfully");
      resetForm();
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, "user_tasks", taskId));
      toast.success("Task deleted successfully");
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return;

    try {
      const batch = writeBatch(db);
      selectedTasks.forEach((taskId) => {
        const taskRef = doc(db, "user_tasks", taskId);
        batch.delete(taskRef);
      });
      await batch.commit();

      toast.success(`${selectedTasks.size} tasks deleted successfully`);
      setSelectedTasks(new Set());
      setSelectAll(false);
      setIsBulkActionsOpen(false);
    } catch (error) {
      console.error("Error bulk deleting tasks:", error);
      toast.error("Failed to delete tasks");
    }
  };

  const handleBulkStatusUpdate = async (newStatus: Task["status"]) => {
    if (selectedTasks.size === 0) return;

    try {
      const batch = writeBatch(db);
      selectedTasks.forEach((taskId) => {
        const taskRef = doc(db, "user_tasks", taskId);
        const updates: any = {
          status: newStatus,
          updatedAt: serverTimestamp(),
        };
        if (newStatus === "completed") {
          updates.completedAt = serverTimestamp();
        }
        batch.update(taskRef, updates);
      });
      await batch.commit();

      toast.success(`${selectedTasks.size} tasks updated to ${newStatus}`);
      setSelectedTasks(new Set());
      setSelectAll(false);
      setIsBulkActionsOpen(false);
    } catch (error) {
      console.error("Error bulk updating tasks:", error);
      toast.error("Failed to update tasks");
    }
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.dueDate);
    setCategory(task.category || "none");
    setTags(task.tags || []);
    setSubtasks(task.subtasks || []);
    setSubtaskInput("");
    setNotes(task.notes || "");
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (task: Task) => {
    try {
      console.log("Opening view dialog for task:", task);
      setViewingTask(task);
      setIsViewDialogOpen(true);
    } catch (error) {
      console.error("Error opening view dialog:", error);
      toast.error("Failed to open task details");
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  // Subtask management functions
  const addSubtask = () => {
    if (subtaskInput.trim()) {
      const newSubtask: Subtask = {
        id: crypto.randomUUID(),
        title: subtaskInput.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      setSubtasks([...subtasks, newSubtask]);
      setSubtaskInput("");
    }
  };

  const toggleSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.map((st) =>
      st.id === subtaskId
        ? { ...st, completed: !st.completed, completedAt: !st.completed ? new Date().toISOString() : null }
        : st
    ));
  };

  const deleteSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.filter((st) => st.id !== subtaskId));
  };

  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map((t) => t.id)));
    }
    setSelectAll(!selectAll);
  };

  const getDueDateStatus = (dueDate?: Date, taskStatus?: string) => {
    if (!dueDate || taskStatus === "completed") return null;
    if (isPast(dueDate) && !isToday(dueDate)) {
      return { label: "Overdue", color: "text-red-500 bg-red-500/10" };
    }
    if (isToday(dueDate)) {
      return { label: "Due Today", color: "text-orange-500 bg-orange-500/10" };
    }
    if (isTomorrow(dueDate)) {
      return { label: "Due Tomorrow", color: "text-yellow-500 bg-yellow-500/10" };
    }
    return null;
  };

  // Check if user can edit/delete task
  const canEditTask = (task: Task) => {
    return userRole === "SuperAdmin" || task.userId === userId;
  };

  // Check if user can view task
  const canViewTask = (task: Task) => {
    return userRole === "SuperAdmin" || task.userId === userId;
  };

  // Toggle pin status for a task
  const togglePin = async (taskId: string, currentPinned: boolean) => {
    try {
      const taskRef = doc(db, "user_tasks", taskId);
      await updateDoc(taskRef, {
        pinned: !currentPinned,
        updatedAt: serverTimestamp(),
      });
      toast.success(!currentPinned ? "Task pinned" : "Task unpinned");
    } catch (error) {
      console.error("Error toggling pin:", error);
      toast.error("Failed to pin/unpin task");
    }
  };

  // Export task to PDF
  const exportTaskToPDF = (task: Task) => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 30;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Helper function to check if we need a new page
      const checkPageBreak = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - 20) {
          pdf.addPage();
          yPosition = 30;
          return true;
        }
        return false;
      };
      
      // Title
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      const titleLines = pdf.splitTextToSize(task.title, contentWidth);
      titleLines.forEach((line: string) => {
        pdf.text(line, margin, yPosition);
        yPosition += 8;
      });
      yPosition += 10;
      
      // Basic Info Section
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Task Information", margin, yPosition);
      yPosition += 12;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      
      const basicInfo = [
        `Status: ${statusConfig[task.status].label}`,
        `Priority: ${priorityConfig[task.priority].label}`,
        task.category ? `Category: ${task.category}` : null,
        task.dueDate ? `Due Date: ${format(task.dueDate, "PPP")}` : null,
        task.userName ? `Assigned to: ${task.userName}` : null,
        task.createdAt ? `Created: ${format(task.createdAt, "PPP")}` : null
      ].filter(Boolean);
      
      basicInfo.forEach((info) => {
        if (info) {
          checkPageBreak(8);
          pdf.text(info, margin, yPosition);
          yPosition += 8;
        }
      });
      
      // Description
      if (task.description) {
        yPosition += 10;
        checkPageBreak(20);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Description", margin, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const descLines = pdf.splitTextToSize(task.description, contentWidth);
        descLines.forEach((line: string) => {
          checkPageBreak(8);
          pdf.text(line, margin, yPosition);
          yPosition += 6;
        });
      }
      
      // Notes
      if (task.notes) {
        yPosition += 10;
        checkPageBreak(20);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Notes", margin, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const notesLines = pdf.splitTextToSize(task.notes, contentWidth);
        notesLines.forEach((line: string) => {
          checkPageBreak(8);
          pdf.text(line, margin, yPosition);
          yPosition += 6;
        });
      }
      
      // Subtasks Table
      if (task.subtasks && task.subtasks.length > 0) {
        yPosition += 10;
        checkPageBreak(30);
        
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Subtasks", margin, yPosition);
        yPosition += 12;
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        
        // Table header
        pdf.text("Status", margin, yPosition);
        pdf.text("Subtask Title", margin + 25, yPosition);
        yPosition += 8;
        
        // Draw line under header
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
        
        // Subtasks
        task.subtasks.forEach((subtask) => {
          checkPageBreak(10);
          
          const checkbox = subtask.completed ? "[-]" : "[ ]";
          const status = subtask.completed ? "Completed" : "Pending";
          
          pdf.text(checkbox, margin, yPosition);
          pdf.text(status, margin + 25, yPosition);
          
          // Word wrap for subtask title
          const subtaskLines = pdf.splitTextToSize(subtask.title, contentWidth - 80);
          subtaskLines.forEach((line: string, index: number) => {
            const xPos = index === 0 ? margin + 80 : margin + 25;
            pdf.text(line, xPos, yPosition);
            yPosition += 6;
          });
          
          yPosition += 2; // Space between subtasks
        });
        
        // Summary
        const completedCount = task.subtasks.filter(st => st.completed).length;
        yPosition += 5;
        checkPageBreak(10);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Progress: ${completedCount}/${task.subtasks.length} completed`, margin, yPosition);
      }
      
      // Tags
      if (task.tags && task.tags.length > 0) {
        yPosition += 10;
        checkPageBreak(20);
        
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Tags", margin, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const tagText = task.tags.map(tag => `#${tag}`).join(", ");
        const tagLines = pdf.splitTextToSize(tagText, contentWidth);
        tagLines.forEach((line: string) => {
          checkPageBreak(8);
          pdf.text(line, margin, yPosition);
          yPosition += 6;
        });
      }
      
      // Footer
      const footerY = pageHeight - 15;
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "italic");
      pdf.text(`Generated on ${format(new Date(), "PPP 'at' p")}`, margin, footerY);
      pdf.text(`Page 1`, pageWidth - margin - 20, footerY);
      
      // Save PDF
      const fileName = `task-${task.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      pdf.save(fileName);
      toast.success("Task exported to PDF successfully");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export task to PDF");
    }
  };

  // Sort tasks: pinned first, then by priority and due date
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      // Pinned tasks always come first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      
      // Then sort by priority
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then sort by due date
      const dateA = a.dueDate || new Date(9999, 0, 1);
      const dateB = b.dueDate || new Date(9999, 0, 1);
      return dateA.getTime() - dateB.getTime();
    });
  }, [filteredTasks]);

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Tasks</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats.overdue}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-orange-200">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats.highPriority}</p>
              <p className="text-xs text-muted-foreground">High Priority</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Completion Rate</span>
          <span className="text-sm font-medium">{stats.completionRate}%</span>
        </div>
        <Progress value={stats.completionRate} className="h-2" />
      </Card>

      {/* Filters & Actions */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
            >
              {viewMode === "list" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-2">
            {selectedTasks.size > 0 && (
              <Button
                variant="outline"
                onClick={() => setIsBulkActionsOpen(true)}
                className="gap-2"
              >
                <CheckSquare className="h-4 w-4" />
                {selectedTasks.size} selected
              </Button>
            )}
            <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on-hold">On Hold</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as any)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={showOverdueOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOverdueOnly(!showOverdueOnly)}
            className="h-8"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Overdue Only
          </Button>

          {(filterStatus !== "all" || filterPriority !== "all" || filterCategory !== "all" || showOverdueOnly || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterStatus("all");
                setFilterPriority("all");
                setFilterCategory("all");
                setShowOverdueOnly(false);
                setSearchQuery("");
              }}
              className="h-8"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Task List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Tasks ({filteredTasks.length})
            </CardTitle>
            {filteredTasks.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                  id="select-all"
                />
                <Label htmlFor="select-all" className="text-sm cursor-pointer">
                  Select All
                </Label>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {sortedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <ListTodo className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No tasks found</p>
                <p className="text-xs">Create a new task to get started</p>
              </div>
            ) : (
              <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-2"}>
                {sortedTasks.map((task) => {
                  const statusConfigItem = statusConfig[task.status];
                  const StatusIcon = statusConfigItem.icon;
                  const priorityConfigItem = priorityConfig[task.priority];
                  const PriorityIcon = priorityConfigItem.icon;
                  const dueStatus = getDueDateStatus(task.dueDate, task.status);
                  const isSelected = selectedTasks.has(task.id);

                  return (
                    <div
                      key={task.id}
                      onClick={() => openViewDialog(task)}
                      className={cn(
                        "group flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer",
                        isSelected && "border-primary bg-primary/5",
                        task.pinned && "border-yellow-400 bg-yellow-50/30",
                        task.priority === "high" && task.status !== "completed" && "border-l-4 border-l-red-500"
                      )}
                    >
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskSelection(task.id);
                        }}
                        className="mt-1"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {task.pinned && <Pin className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                              <p className="font-medium leading-tight">{task.title}</p>
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEditTask(task) && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(task);
                                }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canEditTask(task) && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  togglePin(task.id, task.pinned || false);
                                }}>
                                  <Pin className={cn("h-4 w-4 mr-2", task.pinned && "fill-current")} />
                                  {task.pinned ? "Unpin" : "Pin"}
                                </DropdownMenuItem>
                              )}
                              {canEditTask(task) && <DropdownMenuSeparator />}
                              {canEditTask(task) && (
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask(task.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="outline" className={cn("text-xs", statusConfigItem.color)}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfigItem.label}
                          </Badge>

                          <Badge variant="outline" className={cn("text-xs", priorityConfigItem.bgColor, priorityConfigItem.color)}>
                            <PriorityIcon className="h-3 w-3 mr-1" />
                            {priorityConfigItem.label}
                          </Badge>

                          {task.category && (
                            <Badge variant="outline" className="text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              {task.category}
                            </Badge>
                          )}

                          {task.dueDate && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                dueStatus?.color || "bg-gray-500/10 text-gray-600"
                              )}
                            >
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              {dueStatus?.label || format(task.dueDate, "MMM d")}
                            </Badge>
                          )}

                          {task.tags?.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setIsEditDialogOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Create New Task"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Update your task details." : "Add a new task to track your work progress."}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="subtasks">Subtasks ({subtasks.length})</TabsTrigger>
              <TabsTrigger value="details">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter task title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your task..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(v: Task["status"]) => setStatus(v)}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on-hold">On Hold</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={priority} onValueChange={(v: Task["priority"]) => setPriority(v)}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      #{tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-red-500"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="subtasks" className="space-y-4">
              <div className="grid gap-2">
                <Label>Subtasks ({subtasks.filter(st => st.completed).length}/{subtasks.length} completed)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a subtask..."
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addSubtask())}
                  />
                  <Button type="button" variant="outline" onClick={addSubtask}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {subtasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No subtasks yet. Add some to break down this task.</p>
                  ) : (
                    subtasks.map((subtask) => (
                      <div
                        key={subtask.id}
                        className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={subtask.completed}
                          onCheckedChange={() => toggleSubtask(subtask.id)}
                        />
                        <span className={cn("flex-1 text-sm", subtask.completed && "line-through text-muted-foreground")}>
                          {subtask.title}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteSubtask(subtask.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes, links, or references..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={10}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setIsEditDialogOpen(false);
                resetForm();
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={editingTask ? handleUpdateTask : handleCreateTask}
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Task Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {viewingTask && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{viewingTask.title}</h3>
                {viewingTask.description && (
                  <p className="text-muted-foreground mt-2">{viewingTask.description}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className={statusConfig[viewingTask.status].color}>
                  {statusConfig[viewingTask.status].label}
                </Badge>
                <Badge className={cn(priorityConfig[viewingTask.priority].bgColor, priorityConfig[viewingTask.priority].color)}>
                  {priorityConfig[viewingTask.priority].label} Priority
                </Badge>
                {viewingTask.category && <Badge variant="outline">{viewingTask.category}</Badge>}
              </div>

              <div className="space-y-2 text-sm">
                {viewingTask.dueDate && (
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>Due: {format(viewingTask.dueDate, "PPP")}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Created: {viewingTask.createdAt ? format(viewingTask.createdAt, "PPp") : "Just now"}</span>
                </div>
              </div>

              {viewingTask.tags && viewingTask.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {viewingTask.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">#{tag}</Badge>
                  ))}
                </div>
              )}

              {viewingTask.notes && (
                <div className="bg-muted p-3 rounded-md">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{viewingTask.notes}</p>
                </div>
              )}

              {/* Subtasks Section */}
              {viewingTask.subtasks && viewingTask.subtasks.length > 0 && (
                <div className="border rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Subtasks ({viewingTask.subtasks.filter(st => st.completed).length}/{viewingTask.subtasks.length})
                  </Label>
                  <div className="space-y-1">
                    {viewingTask.subtasks.map((subtask) => (
                      <div key={subtask.id} className="flex items-center gap-2 text-sm">
                        {subtask.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={cn(subtask.completed && "line-through text-muted-foreground")}>
                          {subtask.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* History/Timeline Section */}
              {viewingTask.history && viewingTask.history.length > 0 && (
                <div className="border rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground mb-2 block">Activity History</Label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {viewingTask.history.map((entry, index) => (
                      <div key={entry.id || index} className="flex items-start gap-2 text-sm">
                        <div className="mt-1">
                          {entry.action === "created" && <Plus className="h-3 w-3 text-green-500" />}
                          {entry.action === "updated" && <Edit className="h-3 w-3 text-blue-500" />}
                          {entry.action === "completed" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                          {entry.action === "deleted" && <Trash2 className="h-3 w-3 text-red-500" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">
                            {entry.action === "created" && "Task created"}
                            {entry.action === "updated" && entry.field && `Updated ${entry.field}`}
                            {entry.action === "completed" && "Task completed"}
                            {entry.action === "deleted" && "Task deleted"}
                          </p>
                          {entry.oldValue && entry.newValue && (
                            <p className="text-xs text-muted-foreground">
                              {entry.oldValue} → {entry.newValue}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            by {entry.performedBy} • {entry.timestamp ? (typeof entry.timestamp === 'string' ? format(new Date(entry.timestamp), "MMM d, h:mm a") : format(entry.timestamp.toDate(), "MMM d, h:mm a")) : "Just now"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {canEditTask(viewingTask) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      openEditDialog(viewingTask);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
                {canEditTask(viewingTask) && (
                  <Button
                    variant="outline"
                    onClick={() => exportTaskToPDF(viewingTask)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                )}
                {canEditTask(viewingTask) && (
                  <Button
                    variant="outline"
                    className="text-red-600"
                    onClick={() => {
                      handleDeleteTask(viewingTask.id);
                      setIsViewDialogOpen(false);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Actions Dialog */}
      <Dialog open={isBulkActionsOpen} onOpenChange={setIsBulkActionsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Actions ({selectedTasks.size} selected)</DialogTitle>
            <DialogDescription>Choose an action to apply to all selected tasks.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Change Status</Label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusUpdate("pending")}>
                  <Clock className="h-4 w-4 mr-2" />
                  Pending
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusUpdate("in-progress")}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  In Progress
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusUpdate("completed")}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Completed
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusUpdate("on-hold")}>
                  <PauseCircle className="h-4 w-4 mr-2" />
                  On Hold
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Danger Zone</Label>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {selectedTasks.size} Tasks
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
