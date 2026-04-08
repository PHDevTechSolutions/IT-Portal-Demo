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
  Users,
  UserPlus,
  UserMinus,
  X,
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

interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: string;
  addedAt: any;
  addedBy: string;
  status?: "pending" | "accepted" | "rejected";
  profilePicture?: string;
  department?: string;
  position?: string;
}

interface CollaborationRequest {
  id: string;
  taskId: string;
  taskTitle: string;
  requesterId: string;
  requesterName: string;
  collaboratorId: string; // Changed from email to userId
  collaboratorName: string;
  collaboratorEmail: string;
  role: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: any;
  message?: string;
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
  collaborators?: Collaborator[];
  isCollaborative?: boolean;
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

  // State for enhanced collaborator data
  const [enhancedCollaborators, setEnhancedCollaborators] = useState<Map<string, Collaborator>>(new Map());
  const [viewTaskEnhancedCollaborators, setViewTaskEnhancedCollaborators] = useState<Collaborator[]>([]);
  const [isCollaborationDialogOpen, setIsCollaborationDialogOpen] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [collaboratorRole, setCollaboratorRole] = useState("viewer");
  const [collaboratingTask, setCollaboratingTask] = useState<Task | null>(null);
  const [collaborationMessage, setCollaborationMessage] = useState("");
  const [pendingRequests, setPendingRequests] = useState<CollaborationRequest[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const tasksRef = collection(db, "user_tasks");
    
    // Super Admin can see all tasks, regular users see their own + collaborative tasks
    const q = userRole === "SuperAdmin" 
      ? query(tasksRef) // No where clause for Super Admin
      : query(tasksRef, 
          where("userId", "==", userId) // User's own tasks
        ); // We'll filter collaborative tasks client-side for now

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
      
      // For non-Super Admin, also fetch collaborative tasks
      if (userRole !== "SuperAdmin") {
        // Use fallback method as primary since array-contains with objects is unreliable
        const allTasksRef = collection(db, "user_tasks");
        getDocs(allTasksRef).then((allSnapshot: QuerySnapshot<DocumentData>) => {
          const collaborativeTasks: Task[] = [];
          allSnapshot.forEach((doc: any) => {
            const data = doc.data();
            if (data.collaborators && Array.isArray(data.collaborators)) {
              const userIsCollaborator = data.collaborators.some((collab: any) => 
                collab.id === userId || collab.id === userId.toString()
              );
              if (userIsCollaborator) {
                collaborativeTasks.push({
                  id: doc.id,
                  ...data,
                  dueDate: data.dueDate?.toDate?.(),
                  createdAt: data.createdAt?.toDate?.(),
                  updatedAt: data.updatedAt?.toDate?.(),
                  completedAt: data.completedAt?.toDate?.(),
                } as Task);
              }
            }
          });
          mergeAndSetTasks(tasksData, collaborativeTasks);
        }).catch(error => {
          console.error("Error fetching collaborative tasks:", error);
        });
      } else {
        // Super Admin: just sort the tasks
        tasksData.sort((a, b) => {
          const priorityWeight = { high: 3, medium: 2, low: 1 };
          const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          const dateA = a.dueDate || new Date(9999, 0, 1);
          const dateB = b.dueDate || new Date(9999, 0, 1);
          return dateA.getTime() - dateB.getTime();
        });
        setTasks(tasksData);
      }
    });

    return () => unsubscribe();
  }, [userId, userRole]);

  // Function to fetch enhanced collaborator data
  const fetchEnhancedCollaboratorData = async (collaborator: Collaborator): Promise<Collaborator> => {
    // Check if we already have enhanced data
    if (enhancedCollaborators.has(collaborator.id)) {
      return enhancedCollaborators.get(collaborator.id)!;
    }

    try {
      const response = await fetch(`/api/users/${collaborator.id}`);
      
      if (response.ok) {
        const userData = await response.json();
        
        const enhancedCollab: Collaborator = {
          ...collaborator,
          profilePicture: userData.profilePicture || `/avatars/${userData.firstName?.toLowerCase()}-${userData.lastName?.toLowerCase()}.jpg`,
          department: userData.department,
          position: userData.position,
          email: userData.email || collaborator.email,
          name: userData.fullName || `${userData.firstName} ${userData.lastName}` || collaborator.name,
        };
        
        // Cache the enhanced data
        setEnhancedCollaborators(prev => new Map(prev.set(collaborator.id, enhancedCollab)));
        
        return enhancedCollab;
      }
    } catch (error) {
      console.warn("Could not fetch enhanced data for collaborator:", collaborator.id, error);
    }
    
    return collaborator;
  };

  // Helper function to merge and set tasks
  const mergeAndSetTasks = (ownTasks: Task[], collaborativeTasks: Task[]) => {
    // Combine own tasks and collaborative tasks, remove duplicates
    const allTasks = [...ownTasks, ...collaborativeTasks];
    const uniqueTasks = allTasks.filter((task, index, self) => 
      index === self.findIndex(t => t.id === task.id)
    );
    
    uniqueTasks.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const dateA = a.dueDate || new Date(9999, 0, 1);
      const dateB = b.dueDate || new Date(9999, 0, 1);
      return dateA.getTime() - dateB.getTime();
    });
    
    setTasks(uniqueTasks);
  };

  // Listen for collaboration requests
  useEffect(() => {
    if (!userId) return;

    const requestsRef = collection(db, "collaboration_requests");
    const q = query(requestsRef, where("collaboratorId", "==", userId), where("status", "==", "pending"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestsData: CollaborationRequest[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        requestsData.push({
          id: doc.id, // Use Firestore document ID
          taskId: data.taskId,
          taskTitle: data.taskTitle,
          requesterId: data.requesterId,
          requesterName: data.requesterName,
          collaboratorId: data.collaboratorId,
          collaboratorName: data.collaboratorName,
          collaboratorEmail: data.collaboratorEmail,
          role: data.role,
          status: data.status,
          createdAt: data.createdAt?.toDate?.(),
          message: data.message,
        } as CollaborationRequest);
      });
      
      // Sort by creation date (newest first)
      requestsData.sort((a, b) => {
        const dateA = a.createdAt || new Date(0);
        const dateB = b.createdAt || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      
      // Check for new requests and show notification
      const previousRequestIds = pendingRequests.map(r => r.id);
      const newRequests = requestsData.filter(r => !previousRequestIds.includes(r.id));
      
      if (newRequests.length > 0) {
        newRequests.forEach(request => {
          toast.info(`New collaboration request from ${request.requesterName} for "${request.taskTitle}"`, {
            duration: 5000,
            action: {
              label: "View",
              onClick: () => {
                // Scroll to notification section
                const element = document.querySelector('[data-collaboration-notifications]');
                element?.scrollIntoView({ behavior: 'smooth' });
              }
            }
          });
        });
      }
      
      setPendingRequests(requestsData);
    });

    return () => unsubscribe();
  }, [userId, pendingRequests]);

  // Fetch available users
  useEffect(() => {
    const fetchUsers = async (searchQuery = "") => {
      try {
        setIsSearchingUsers(true);
        const response = await fetch(`/api/users?currentUserId=${userId}&search=${encodeURIComponent(searchQuery)}`);
        
        if (response.ok) {
          const data = await response.json();
          setAvailableUsers(data.users || []);
        } else {
          // Fallback to mock users if API fails
          const mockUsers = [
            { id: "user1", referenceId: "EMP001", firstName: "John", lastName: "Doe", fullName: "John Doe", email: "john.doe@company.com", role: "user", department: "IT", position: "Developer" },
            { id: "user2", referenceId: "EMP002", firstName: "Jane", lastName: "Smith", fullName: "Jane Smith", email: "jane.smith@company.com", role: "user", department: "HR", position: "Manager" },
            { id: "user3", referenceId: "EMP003", firstName: "Mike", lastName: "Johnson", fullName: "Mike Johnson", email: "mike.johnson@company.com", role: "admin", department: "IT", position: "Team Lead" },
            { id: "user4", referenceId: "EMP004", firstName: "Sarah", lastName: "Wilson", fullName: "Sarah Wilson", email: "sarah.wilson@company.com", role: "user", department: "Finance", position: "Accountant" },
            { id: "user5", referenceId: "EMP005", firstName: "Alex", lastName: "Turner", fullName: "Alex Turner", email: "alex.turner@company.com", role: "user", department: "IT", position: "Senior Developer" },
            { id: "user6", referenceId: "EMP006", firstName: "Lisa", lastName: "Anderson", fullName: "Lisa Anderson", email: "lisa.anderson@company.com", role: "user", department: "IT", position: "DevOps Engineer" },
          ];
          
          // Filter out current user and apply search (only by department)
          const filteredUsers = mockUsers.filter(user => {
            if (user.id === userId) return false;
            
            if (searchQuery.trim()) {
              const query = searchQuery.toLowerCase();
              return user.department && user.department.toLowerCase().includes(query);
            }
            return true;
          });
          
          setAvailableUsers(filteredUsers);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
        setAvailableUsers([]);
      } finally {
        setIsSearchingUsers(false);
      }
    };

    if (userId) {
      fetchUsers(userSearchQuery);
    }
  }, [userId, userSearchQuery]);

  // Fetch enhanced collaborator data when viewing a task
  useEffect(() => {
    if (!viewingTask?.collaborators || viewingTask.collaborators.length === 0) {
      setViewTaskEnhancedCollaborators([]);
      return;
    }

    const fetchEnhancedData = async () => {
      const enhancedCollabs = await Promise.all(
        viewingTask.collaborators!.map(collab => fetchEnhancedCollaboratorData(collab))
      );
      setViewTaskEnhancedCollaborators(enhancedCollabs);
    };

    fetchEnhancedData();
  }, [viewingTask?.collaborators]);

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
    return userRole === "SuperAdmin" || 
           task.userId === userId || 
           (task.collaborators && task.collaborators.some(collab => collab.id === userId));
  };

  // Check if user can view task
  const canViewTask = (task: Task) => {
    return userRole === "SuperAdmin" || 
           task.userId === userId || 
           (task.collaborators && task.collaborators.some(collab => collab.id === userId));
  };

  // Check if user is owner
  const isOwner = (task: Task) => {
    return task.userId === userId || userRole === "SuperAdmin";
  };

  // Open collaboration dialog
  const openCollaborationDialog = (task: Task) => {
    setCollaboratingTask(task);
    setCollaboratorEmail("");
    setCollaboratorRole("viewer");
    setUserSearchQuery("");
    setSelectedUser(null);
    setCollaborationMessage("");
    setIsCollaborationDialogOpen(true);
  };

  // Add collaborator
  const addCollaborator = async () => {
    if (!collaboratingTask || !selectedUser) {
      toast.error("Please select a collaborator");
      return;
    }

    setIsLoading(true);
    try {
      // Create collaboration request for specific user
      const requestRef = collection(db, "collaboration_requests");
      const requestData = {
        taskId: collaboratingTask.id,
        taskTitle: collaboratingTask.title,
        requesterId: userId,
        requesterName: userName,
        collaboratorId: selectedUser.id,
        collaboratorName: selectedUser.fullName,
        collaboratorEmail: selectedUser.email,
        role: collaboratorRole,
        status: "pending",
        createdAt: serverTimestamp(),
        message: collaborationMessage.trim() || undefined,
      };

      // Add document to Firestore and get the actual document reference
      const docRef = await addDoc(requestRef, requestData);
      const actualRequestId = docRef.id;

      // Notify the selected user
      toast.success(`Collaboration request sent to ${selectedUser.fullName} (${selectedUser.referenceId})`, {
        description: "They will receive a notification about your collaboration request"
      });

      // Add to task history
      const historyEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        action: "updated",
        field: "collaboration_request",
        oldValue: "No pending requests",
        newValue: `Request sent to ${selectedUser.fullName} (${selectedUser.referenceId})`,
        performedBy: userName,
        timestamp: new Date().toISOString(),
      };

      const taskRef = doc(db, "user_tasks", collaboratingTask.id);
      const existingHistory = collaboratingTask.history || [];
      await updateDoc(taskRef, {
        history: [historyEntry, ...existingHistory],
      });

      toast.success(`Collaboration request sent to ${selectedUser.fullName}`);
      setIsCollaborationDialogOpen(false);
      setCollaboratingTask(null);
      setSelectedUser(null);
      setUserSearchQuery("");
      setCollaboratorRole("viewer");
      setCollaborationMessage("");
    } catch (error) {
      console.error("Error sending collaboration request:", error);
      toast.error("Failed to send collaboration request");
    } finally {
      setIsLoading(false);
    }
  };

  // Remove collaborator
  const removeCollaborator = async (taskId: string, collaboratorId: string) => {
    try {
      const taskRef = doc(db, "user_tasks", taskId);
      const task = tasks.find(t => t.id === taskId);
      
      if (!task) return;

      const updatedCollaborators = task.collaborators?.filter(c => c.id !== collaboratorId) || [];
      
      await updateDoc(taskRef, {
        collaborators: updatedCollaborators,
        isCollaborative: updatedCollaborators.length > 0,
        updatedAt: serverTimestamp(),
      });

      toast.success("Collaborator removed successfully");
    } catch (error) {
      console.error("Error removing collaborator:", error);
      toast.error("Failed to remove collaborator");
    }
  };

  // Accept collaboration request
  const acceptCollaborationRequest = async (requestId: string) => {
    try {
      const requestRef = doc(db, "collaboration_requests", requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        toast.error("Collaboration request not found");
        return;
      }
      
      const requestData = requestDoc.data();
      
      // Update request status
      await updateDoc(requestRef, { status: "accepted" });

      // Add collaborator to task
      const request = pendingRequests.find(r => r.id === requestId);
      
      if (request) {
        const taskRef = doc(db, "user_tasks", request.taskId);
        const taskDoc = await getDoc(taskRef);
        
        if (!taskDoc.exists()) {
          toast.error("Task not found");
          return;
        }
        
        const taskData = taskDoc.data();
        
        // Fetch user profile FIRST before creating collaborator
        let userProfileData = null;
        try {
          const userResponse = await fetch(`/api/users/${userId}`);
          if (userResponse.ok) {
            userProfileData = await userResponse.json();
          }
        } catch (profileError) {
          console.warn("Could not fetch user profile:", profileError);
        }
        
        // Create collaborator with real profile data or fallback to basic info
        const newCollaborator: Collaborator = {
          id: userId,
          name: userProfileData?.fullName || 
                (userProfileData?.firstName && userProfileData?.lastName 
                  ? `${userProfileData.firstName} ${userProfileData.lastName}` 
                  : userName),
          email: userProfileData?.email || `${userName}@company.com`,
          role: request.role,
          addedAt: new Date().toISOString(),
          addedBy: request.requesterName,
          status: "accepted",
          profilePicture: userProfileData?.profilePicture || 
            (userProfileData?.firstName && userProfileData?.lastName 
              ? `/avatars/${userProfileData.firstName.toLowerCase()}-${userProfileData.lastName.toLowerCase()}.jpg`
              : undefined),
          department: userProfileData?.department,
          position: userProfileData?.position,
        };

        // Get task data directly from Firestore instead of local state
        const existingCollaborators = taskData.collaborators || [];
        
        // Check if user is already a collaborator
        const isAlreadyCollaborator = existingCollaborators.some((collab: Collaborator) => collab.id === userId);
        if (isAlreadyCollaborator) {
          toast.info("You are already a collaborator on this task");
          return;
        }
        
        const updatedCollaborators = [...existingCollaborators, newCollaborator];
        
        const updateData = {
          collaborators: updatedCollaborators,
          isCollaborative: true,
          updatedAt: serverTimestamp(),
        };
        
        try {
          await updateDoc(taskRef, updateData);
          
          // Verify the update
          const updatedTaskDoc = await getDoc(taskRef);
          const updatedTaskData = updatedTaskDoc.data();
          
          if (updatedTaskData) {
            // Show success message with option to view task
            toast.success(`You can now access "${request.taskTitle}"`, {
              description: `You have been added as ${request.role}`,
              duration: 5000,
              action: {
                label: "View Task",
                onClick: () => {
                  // Create task object for viewing from Firestore data
                  const taskForView: Task = {
                    id: request.taskId,
                    userId: updatedTaskData.userId,
                    userName: updatedTaskData.userName,
                    title: updatedTaskData.title,
                    status: updatedTaskData.status,
                    priority: updatedTaskData.priority,
                    description: updatedTaskData.description,
                    dueDate: updatedTaskData.dueDate?.toDate?.(),
                    createdAt: updatedTaskData.createdAt?.toDate?.(),
                    updatedAt: updatedTaskData.updatedAt?.toDate?.(),
                    completedAt: updatedTaskData.completedAt?.toDate?.(),
                    category: updatedTaskData.category,
                    tags: updatedTaskData.tags,
                    notes: updatedTaskData.notes,
                    subtasks: updatedTaskData.subtasks,
                    history: updatedTaskData.history,
                    pinned: updatedTaskData.pinned,
                    collaborators: updatedTaskData.collaborators,
                    isCollaborative: updatedTaskData.isCollaborative,
                  };
                  setViewingTask(taskForView);
                  setIsViewDialogOpen(true);
                }
              }
            });
          }
          
        } catch (updateError) {
          console.error("Error updating task:", updateError);
          toast.error("Failed to update task with collaborator");
          return;
        }
      }

      toast.success("Collaboration request accepted");
      setPendingRequests(pendingRequests.filter(r => r.id !== requestId));
    } catch (error) {
      console.error("Error accepting collaboration request:", error);
      toast.error("Failed to accept collaboration request");
    }
  };

  // Reject collaboration request
  const rejectCollaborationRequest = async (requestId: string) => {
    try {
      const requestRef = doc(db, "collaboration_requests", requestId);
      
      await updateDoc(requestRef, {
        status: "rejected",
      });

      toast.success("Collaboration request rejected");
      setPendingRequests(pendingRequests.filter(r => r.id !== requestId));
    } catch (error) {
      console.error("Error rejecting collaboration request:", error);
      toast.error("Failed to reject collaboration request");
    }
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
    <div className="min-h-screen w-full bg-[#050a14] relative overflow-hidden p-4">
      {/* Animated background grid */}
      <div className="absolute inset-0 h-full w-full">
        <div 
          className="h-full w-full opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            backgroundRepeat: 'repeat'
          }}
        />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/40 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${5 + Math.random() * 10}s linear infinite`,
              animationDelay: `${Math.random() * 5}s` 
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-wider text-white uppercase">
              <span className="text-cyan-400">TASK</span> COMMAND
            </h1>
            <p className="text-white/80 text-xs tracking-[0.3em] uppercase mt-1">
              Mission Control Center
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-cyan-300/80 font-mono">SYSTEM ONLINE</span>
            </div>
            <span className="text-cyan-500/50">|</span>
            <span className="text-cyan-300/80 font-mono">V.2.0.6</span>
          </div>
        </div>

        {/* Collaboration Notifications */}
        {pendingRequests.length > 0 && (
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl blur opacity-30" />
            <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
              <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
              <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
              
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400 tracking-wider uppercase">
                  <Users className="h-5 w-5" />
                  Collaboration Requests ({pendingRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-cyan-500/20">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-cyan-100">{request.requesterName} wants to collaborate</p>
                        <p className="text-xs text-white/70">Task: {request.taskTitle}</p>
                        <p className="text-xs text-white/70">Role: {request.role}</p>
                        {request.message && (
                          <p className="text-xs text-white/50 mt-1 italic">"{request.message}"</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => acceptCollaborationRequest(request.id)}
                          className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectCollaborationRequest(request.id)}
                          className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:border-red-400/50"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
          <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl p-4 overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-cyan-500/50" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-cyan-500/50" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                <ListTodo className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-white/80 uppercase tracking-wider">Total Tasks</p>
              </div>
            </div>
          </Card>
        </div>
        
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
          <Card className="relative bg-slate-900/90 backdrop-blur-xl border-emerald-500/30 rounded-xl p-4 overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-emerald-500/50" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-emerald-500/50" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.completed}</p>
                <p className="text-xs text-emerald-400/60 uppercase tracking-wider">Completed</p>
              </div>
            </div>
          </Card>
        </div>
        
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-blue-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
          <Card className="relative bg-slate-900/90 backdrop-blur-xl border-blue-500/30 rounded-xl p-4 overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-blue-500/50" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-blue-500/50" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                <PlayCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.inProgress}</p>
                <p className="text-xs text-white/80 uppercase tracking-wider">In Progress</p>
              </div>
            </div>
          </Card>
        </div>
        
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
          <Card className="relative bg-slate-900/90 backdrop-blur-xl border-yellow-500/30 rounded-xl p-4 overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-yellow-500/50" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-yellow-500/50" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                <Clock className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.pending}</p>
                <p className="text-xs text-yellow-400/60 uppercase tracking-wider">Pending</p>
              </div>
            </div>
          </Card>
        </div>
        
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-red-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
          <Card className="relative bg-slate-900/90 backdrop-blur-xl border-red-500/30 rounded-xl p-4 overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-red-500/50" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-red-500/50" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.overdue}</p>
                <p className="text-xs text-red-400/60 uppercase tracking-wider">Overdue</p>
              </div>
            </div>
          </Card>
        </div>
        
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-orange-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
          <Card className="relative bg-slate-900/90 backdrop-blur-xl border-orange-500/30 rounded-xl p-4 overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-orange-500/50" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-orange-500/50" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20 border border-orange-500/30">
                <ArrowUpCircle className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.highPriority}</p>
                <p className="text-xs text-orange-400/60 uppercase tracking-wider">High Priority</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl blur opacity-20" />
        <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl p-4 overflow-hidden">
          <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-cyan-500/50" />
          <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-cyan-500/50" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-cyan-100 uppercase tracking-wider">Completion Rate</span>
            <span className="text-sm font-bold text-cyan-400">{stats.completionRate}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-cyan-500/20">
            <div 
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-500"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/50 to-purple-500/50 rounded-xl blur opacity-20" />
        <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl p-4 overflow-hidden">
          <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-cyan-500/50" />
          <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-cyan-500/50" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-l border-b border-cyan-500/50" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-r border-b border-cyan-500/50" />
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex flex-1 gap-2 items-center">
                <div className="relative flex-1 max-w-md group/input">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 group-focus-within/input:text-cyan-400 transition-colors" />
                  <Input
                    placeholder="Search missions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-800/50 border-cyan-500/30 text-white placeholder:text-white/50 rounded-lg focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
                  className="bg-slate-800/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400/50"
                >
                  {viewMode === "list" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex gap-2">
                {selectedTasks.size > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setIsBulkActionsOpen(true)}
                    className="gap-2 bg-slate-800/50 border-cyan-500/30 text-white hover:bg-cyan-500/20 hover:border-cyan-400/50"
                  >
                    <CheckSquare className="h-4 w-4 text-cyan-400" />
                    {selectedTasks.size} selected
                  </Button>
                )}
                <Button 
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="gap-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  <Plus className="h-4 w-4" />
                  New Mission
                </Button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap gap-2 items-center">
              <Filter className="h-4 w-4 text-white/70" />
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                <SelectTrigger className="w-[140px] h-8 bg-slate-800/50 border-cyan-500/30 text-white focus:ring-cyan-400/50">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-cyan-500/30">
                  <SelectItem value="all" className="text-white focus:bg-cyan-500/20">All Status</SelectItem>
                  <SelectItem value="pending" className="text-white focus:bg-cyan-500/20">Pending</SelectItem>
                  <SelectItem value="in-progress" className="text-white focus:bg-cyan-500/20">In Progress</SelectItem>
                  <SelectItem value="completed" className="text-white focus:bg-cyan-500/20">Completed</SelectItem>
                  <SelectItem value="on-hold" className="text-white focus:bg-cyan-500/20">On Hold</SelectItem>
                  <SelectItem value="cancelled" className="text-white focus:bg-cyan-500/20">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as any)}>
                <SelectTrigger className="w-[140px] h-8 bg-slate-800/50 border-cyan-500/30 text-white focus:ring-cyan-400/50">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-cyan-500/30">
                  <SelectItem value="all" className="text-white focus:bg-cyan-500/20">All Priorities</SelectItem>
                  <SelectItem value="high" className="text-white focus:bg-cyan-500/20">High</SelectItem>
                  <SelectItem value="medium" className="text-white focus:bg-cyan-500/20">Medium</SelectItem>
                  <SelectItem value="low" className="text-white focus:bg-cyan-500/20">Low</SelectItem>
                </SelectContent>
              </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[140px] h-8 bg-slate-800/50 border-cyan-500/30 text-white focus:ring-cyan-400/50">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-cyan-500/30">
              <SelectItem className="text-white focus:bg-cyan-500/20" value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem className="text-white focus:bg-cyan-500/20" key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={showOverdueOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOverdueOnly(!showOverdueOnly)}
            className="w-[140px] h-8 bg-slate-800/50 border-cyan-500/30 text-white focus:ring-cyan-400/50"
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
      </Card>
      </div>

      {/* GRID LAYOUT: My Tasks (Left) | Collaborative Tasks (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT SIDE: My Tasks */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-500" />
          <Card className="relative h-full bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
            <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
            <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
            
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400 tracking-wider uppercase">
                  <ListTodo className="h-5 w-5" />
                  My Tasks ({sortedTasks.filter(task => !task.isCollaborative).length})
                </CardTitle>
                {sortedTasks.filter(task => !task.isCollaborative).length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                      id="select-all"
                      className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                    />
                    <Label htmlFor="select-all" className="text-sm cursor-pointer text-white">
                      Select All
                    </Label>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {sortedTasks.filter(task => !task.isCollaborative).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-cyan-300/70">
                    <ListTodo className="h-8 w-8 mb-2 opacity-70" />
                    <p className="text-sm text-white">No missions found</p>
                    <p className="text-xs text-white/70">Initialize new mission</p>
                  </div>
                ) : (
                  <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-2"}>
                    {sortedTasks.filter(task => !task.isCollaborative).map((task) => {
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
                          "group flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer bg-slate-800/50 border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-400/40",
                          isSelected && "border-cyan-400 bg-cyan-500/20",
                          task.pinned && "border-yellow-400/50 bg-yellow-500/10",
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
                            <CheckSquare className="h-5 w-5 text-cyan-400" />
                          ) : (
                            <Square className="h-5 w-5 text-cyan-400/40" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {task.pinned && <Pin className="h-4 w-4 text-yellow-400 fill-yellow-400" />}
                                {task.isCollaborative && (
                                  <div className="flex items-center gap-1 bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full text-xs font-medium border border-cyan-400/30">
                                    <Users className="h-3 w-3" />
                                    Team
                                  </div>
                                )}
                                <p className="font-medium leading-tight text-cyan-100">{task.title}</p>
                              </div>
                              {task.description && (
                                <p className="text-sm text-white/80 mt-1 line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400/50"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-slate-900 border-cyan-500/30 text-cyan-100">
                                {canEditTask(task) && (
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    openEditDialog(task);
                                  }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {isOwner(task) && (
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    openCollaborationDialog(task);
                                  }}>
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Add Collaborator
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
                              <Badge className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {task.category}
                              </Badge>
                            )}

                            {task.dueDate && (
                              <Badge
                                
                                className={cn(
                                  "text-xs",
                                  dueStatus?.color || "bg-gray-500/10 text-white"
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
        </div>

        {/* RIGHT SIDE: Collaborative Tasks */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-500" />
          <Card className="relative h-full bg-slate-900/90 backdrop-blur-xl border-blue-500/30 rounded-xl overflow-hidden">
            <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-blue-500/50" />
            <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-blue-500/50" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-blue-500/50" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-blue-500/50" />
            
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-blue-400 tracking-wider uppercase">
                <Users className="h-5 w-5" />
                Collaborative Tasks ({sortedTasks.filter(task => task.isCollaborative).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {sortedTasks.filter(task => task.isCollaborative).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-blue-300/70">
                    <Users className="h-8 w-8 mb-2 opacity-70" />
                    <p className="text-sm text-white">No collaborative missions</p>
                    <p className="text-xs text-white/70">Add collaborators to missions</p>
                  </div>
                ) : (
                <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-2"}>
                  {sortedTasks.filter(task => task.isCollaborative).map((task) => {
                    const statusConfigItem = statusConfig[task.status];
                    const StatusIcon = statusConfigItem.icon;
                    const priorityConfigItem = priorityConfig[task.priority];
                    const PriorityIcon = priorityConfigItem.icon;
                    const dueStatus = getDueDateStatus(task.dueDate, task.status);

                    return (
                      <div
                        key={task.id}
                        onClick={() => openViewDialog(task)}
                        className={cn(
                          "group flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer bg-white",
                          task.pinned && "border-yellow-400 bg-yellow-50/30",
                          task.priority === "high" && task.status !== "completed" && "border-l-4 border-l-red-500"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {task.pinned && <Pin className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                                <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                                  <Users className="h-3 w-3" />
                                  Collaborative
                                </div>
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
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  openViewDialog(task);
                                }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {isOwner(task) && (
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    openCollaborationDialog(task);
                                  }}>
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Add Collaborator
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

                          {task.userName && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <div className="h-5 w-5 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white font-semibold text-[8px]">
                                  {task.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </div>
                                <span>Owner: {task.userName}</span>
                              </div>
                              {task.collaborators && task.collaborators.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3 text-blue-500" />
                                  <span>{task.collaborators.length} collaborator{task.collaborators.length > 1 ? 's' : ''}</span>
                                </div>
                              )}
                              {dueStatus && (
                                <div className={dueStatus.color}>
                                  {dueStatus.label}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      </div>

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
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-slate-900/95 backdrop-blur-xl border-cyan-500/30 rounded-xl">
          <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
          <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
          
          <DialogHeader>
            <DialogTitle className="text-cyan-400 tracking-wider uppercase">{editingTask ? "Edit Mission" : "Create New Mission"}</DialogTitle>
            <DialogDescription className="text-white/80">
              {editingTask ? "Update mission parameters." : "Initialize new mission for tracking."}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border border-cyan-500/30">
              <TabsTrigger value="basic" className="text-white data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">Basic Info</TabsTrigger>
              <TabsTrigger value="subtasks" className="text-white data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">Subtasks ({subtasks.length})</TabsTrigger>
              <TabsTrigger value="details" className="text-white data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title" className="text-white uppercase tracking-wider text-xs font-medium">Mission Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter mission designation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-slate-800/50 border-cyan-500/30 text-white placeholder:text-white/50 rounded-lg focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description" className="text-white uppercase tracking-wider text-xs font-medium">Mission Brief</Label>
                <Textarea
                  id="description"
                  placeholder="Describe mission parameters..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="bg-slate-800/50 border-cyan-500/30 text-white placeholder:text-white/50 rounded-lg focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status" className="text-white uppercase tracking-wider text-xs font-medium">Mission Status</Label>
                  <Select value={status} onValueChange={(v: Task["status"]) => setStatus(v)}>
                    <SelectTrigger id="status" className="bg-slate-800/50 border-cyan-500/30 text-white focus:ring-cyan-400/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-cyan-500/30">
                      <SelectItem value="pending" className="text-white focus:bg-cyan-500/20">Pending</SelectItem>
                      <SelectItem value="in-progress" className="text-white focus:bg-cyan-500/20">In Progress</SelectItem>
                      <SelectItem value="completed" className="text-white focus:bg-cyan-500/20">Completed</SelectItem>
                      <SelectItem value="on-hold" className="text-white focus:bg-cyan-500/20">On Hold</SelectItem>
                      <SelectItem value="cancelled" className="text-white focus:bg-cyan-500/20">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="priority" className="text-white uppercase tracking-wider text-xs font-medium">Priority Level</Label>
                  <Select value={priority} onValueChange={(v: Task["priority"]) => setPriority(v)}>
                    <SelectTrigger id="priority" className="bg-slate-800/50 border-cyan-500/30 text-white focus:ring-cyan-400/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-cyan-500/30">
                      <SelectItem value="low" className="text-white focus:bg-cyan-500/20">Low</SelectItem>
                      <SelectItem value="medium" className="text-white focus:bg-cyan-500/20">Medium</SelectItem>
                      <SelectItem value="high" className="text-white focus:bg-cyan-500/20">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-white uppercase tracking-wider text-xs font-medium">Due Date</Label>
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
                  <Label htmlFor="category" className="text-white uppercase tracking-wider text-xs font-medium">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category" className="bg-slate-800/50 border-cyan-500/30 text-white focus:ring-cyan-400/50">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-cyan-500/30">
                      <SelectItem value="none">No Category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem className="text-white focus:bg-cyan-500/20" key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-white uppercase tracking-wider text-xs font-medium">Tags</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    className="text-white uppercase"
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 uppercase">
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
                <Label className="text-white uppercase tracking-wider text-xs font-medium">Subtasks ({subtasks.filter(st => st.completed).length}/{subtasks.length} completed)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a subtask..."
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addSubtask())}
                    className="text-white"
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
                        className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 text-white"
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
                <Label htmlFor="notes" className="text-white uppercase tracking-wider text-xs font-medium">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes, links, or references..."
                  value={notes}
                  className="text-white"
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-slate-900/95 backdrop-blur-xl border-cyan-500/30 rounded-xl">
          <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
          <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
          
          <DialogHeader>
            <DialogTitle className="text-cyan-400 tracking-wider uppercase">Mission Details</DialogTitle>
          </DialogHeader>
          {viewingTask && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{viewingTask.title}</h3>
                {viewingTask.description && (
                  <p className="text-white/70 mt-2">{viewingTask.description}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className={statusConfig[viewingTask.status].color}>
                  {statusConfig[viewingTask.status].label}
                </Badge>
                <Badge className={cn(priorityConfig[viewingTask.priority].bgColor, priorityConfig[viewingTask.priority].color)}>
                  {priorityConfig[viewingTask.priority].label} Priority
                </Badge>
                {viewingTask.category && <Badge>{viewingTask.category}</Badge>}
              </div>

              <div className="space-y-2 text-sm">
                {viewingTask.dueDate && (
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-white/70">Due: {format(viewingTask.dueDate, "PPP")}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-white/70">Created: {viewingTask.createdAt ? format(viewingTask.createdAt, "PPp") : "Just now"}</span>
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
                  <Label className="text-xs text-white mb-2 block">
                    Subtasks ({viewingTask.subtasks.filter(st => st.completed).length}/{viewingTask.subtasks.length})
                  </Label>
                  <div className="space-y-1 text-white/70">
                    {viewingTask.subtasks.map((subtask) => (
                      <div key={subtask.id} className="flex items-center gap-2 text-sm">
                        {subtask.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-white" />
                        )}
                        <span className={cn(subtask.completed && "line-through text-white")}>
                          {subtask.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Collaborators Section */}
              {viewingTask.collaborators && viewingTask.collaborators.length > 0 && (
                <div className="border rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Collaborators ({viewingTask.collaborators.length})
                  </Label>
                  <div className="space-y-2">
                    {viewTaskEnhancedCollaborators.map((collaborator) => (
                      <div key={collaborator.id} className="flex items-center justify-between p-3 bg-muted/10 rounded-md">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={collaborator.profilePicture || `/avatars/default.jpg`}
                              alt={collaborator.name}
                              className="h-10 w-10 rounded-full object-cover border-2 border-background"
                              onError={(e) => {
                                // Fallback to initials if image fails
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLDivElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm hidden">
                              {collaborator.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            {collaborator.status === 'accepted' && (
                              <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-background"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{collaborator.name}</p>
                              <Badge className="text-xs uppercase">
                                {collaborator.role}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {collaborator.department && (
                                <span>{collaborator.department}</span>
                              )}
                              {collaborator.position && (
                                <>
                                  {collaborator.department && <span>·</span>}
                                  <span>{collaborator.position}</span>
                                </>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{collaborator.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {collaborator.addedBy && (
                            <div className="text-xs text-muted-foreground text-right">
                              Added by {collaborator.addedBy}
                            </div>
                          )}
                          {isOwner(viewingTask) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeCollaborator(viewingTask.id, collaborator.id)}
                            >
                              <UserMinus className="h-3 w-3 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* History/Timeline Section */}
              {viewingTask.history && viewingTask.history.length > 0 && (
                <div className="border rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground mb-2 block">Activity History</Label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto text-white">
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
                {isOwner(viewingTask) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      openCollaborationDialog(viewingTask);
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Collaborator
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

      {/* Collaboration Dialog */}
      <Dialog open={isCollaborationDialogOpen} onOpenChange={setIsCollaborationDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-slate-900/95 backdrop-blur-xl border-cyan-500/30 rounded-xl">
          <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
          <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
          
          <DialogHeader>
            <DialogTitle className="text-cyan-400 tracking-wider uppercase">Transmit Collaboration Request</DialogTitle>
            <DialogDescription className="text-white/80">
              Transmit collaboration request for "{collaboratingTask?.title}". The recipient will receive notification and can accept or decline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="collaborator-select" className="text-white uppercase tracking-wider text-xs font-medium">Select Operative</Label>
              <div className="relative group/input">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 group-focus-within/input:text-cyan-400 transition-colors z-10" />
                <Input
                  id="collaborator-search"
                  placeholder="Search operative..."
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setSelectedUser(null);
                  }}
                  className="pl-10 bg-slate-800/50 border-cyan-500/30 text-white placeholder:text-white/50 rounded-lg focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
                />
                {isSearchingUsers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              
              {/* User List */}
              {availableUsers.length > 0 && (
                <div className="border rounded-lg max-h-60 overflow-y-auto text-white hover:text-black">
                  {availableUsers.map((user) => (
                    <div
                      key={user.id}
                      className={cn(
                        "flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0",
                        selectedUser?.id === user.id && "bg-blue-50"
                      )}
                      onClick={() => {
                        setSelectedUser(user);
                        setUserSearchQuery(user.fullName);
                      }}
                    >
                      {user.avatar ? (
                        <img 
                          src={user.avatar} 
                          alt={user.fullName} 
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {user.firstName?.charAt(0).toUpperCase()}{user.lastName?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{user.fullName}</div>
                        <div className="text-xs text-blue-600 font-semibold">ID: {user.referenceId}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                        {user.department && user.position && (
                          <div className="text-xs text-blue-600">
                            {user.department} - {user.position}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <Badge className="text-xs uppercase">
                          {user.role}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* No results message */}
              {userSearchQuery && availableUsers.length === 0 && !isSearchingUsers && (
                <div className="p-3 text-center text-muted-foreground border rounded-lg">
                  No users found
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="collaborator-role" className="text-white uppercase tracking-wider text-xs font-medium">Role</Label>
              <Select value={collaboratorRole} onValueChange={setCollaboratorRole} >
                <SelectTrigger id="collaborator-role" className="w-full h-8 bg-slate-800/50 border-cyan-500/30 text-white focus:ring-cyan-400/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-cyan-500/30">
                  <SelectItem className="text-white focus:bg-cyan-500/20" value="viewer">Viewer (Can view only)</SelectItem>
                  <SelectItem className="text-white focus:bg-cyan-500/20" value="editor">Editor (Can view and edit)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="collaboration-message" className="text-white uppercase tracking-wider text-xs font-medium">Message (Optional)</Label>
              <Textarea
                id="collaboration-message"
                className="text-white"
                placeholder="Add a message to the collaborator..."
                value={collaborationMessage}
                onChange={(e) => setCollaborationMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCollaborationDialogOpen(false);
                setCollaboratingTask(null);
                setSelectedUser(null);
                setUserSearchQuery("");
                setCollaboratorRole("viewer");
                setCollaborationMessage("");
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={addCollaborator}
              disabled={isLoading || !selectedUser}
            >
              {isLoading ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Actions Dialog */}
      <Dialog open={isBulkActionsOpen} onOpenChange={setIsBulkActionsOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-slate-900/95 backdrop-blur-xl border-cyan-500/30 rounded-xl">
          <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
          <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
          
          <DialogHeader>
            <DialogTitle className="text-cyan-400 tracking-wider uppercase">Bulk Operations ({selectedTasks.size} selected)</DialogTitle>
            <DialogDescription className="text-white/80">
              Select operation to apply to all selected missions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Change Status</Label>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleBulkStatusUpdate("pending")}
                  className="bg-slate-800/50 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-400/50"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Pending
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleBulkStatusUpdate("in-progress")}
                  className="bg-slate-800/50 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-400/50"
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  In Progress
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleBulkStatusUpdate("completed")}
                  className="bg-slate-800/50 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400/50"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Completed
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleBulkStatusUpdate("on-hold")}
                  className="bg-slate-800/50 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 hover:border-orange-400/50"
                >
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
    </div>
  );
}