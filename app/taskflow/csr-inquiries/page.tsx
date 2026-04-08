"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import { Loader2, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, } from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";

import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

interface Activity {
  id: string;
  company_name: string;
  contact_person: string;
  contact_number: string | null;
  email_address: string;
  address: string;
  ticket_reference_number: string;
  wrap_up: string;
  inquiry: string;
  tsm: string;
  agent: string;
  status: string;
  date_created: string;
  date_updated: string;
  referenceid: string;
}

interface ActivityData {
  activity_reference_number: string;
  scheduled_date: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  type_client: string;
  cancellation_remarks: string;
  ticket_remarks: string;
  status: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture?: string;
}

const ROWS_PER_PAGE = 10;

export default function ActivityLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId] = useState<string | null>(searchParams?.get("userId") ?? null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Hold to delete states
  const [deleteHoldProgress, setDeleteHoldProgress] = useState(0);
  const [isHoldingDelete, setIsHoldingDelete] = useState(false);
  const deleteHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const DELETE_HOLD_DURATION = 2000; // 2 seconds to hold

  // Date range filtering
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Column sorting
  const [sortColumn, setSortColumn] = useState<string>("date_created");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    referenceid: true,
    tsm: true,
    company_name: true,
    contact_person: true,
    contact_number: true,
    email_address: true,
    address: true,
    ticket_reference_number: true,
    wrap_up: true,
    inquiry: true,
    agent: true,
    status: true,
    date_created: true,
    date_updated: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Keyboard navigation
  const [focusedCell, setFocusedCell] = useState<{ rowId: string, field: string } | null>(null);

  // Bulk edit
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<string>("");
  const [bulkEditValue, setBulkEditValue] = useState("");

  // Card-style edit dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Activity>>({});

  // Activity data for ticket creation column
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // Save indicator
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());

  // Audit panel state
  const [auditErrors, setAuditErrors] = useState<string[]>([]);
  const [showAuditPanel, setShowAuditPanel] = useState(true);

  // Filter incomplete records only
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);

  // Agent list and user details states
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  // Fetch users from MongoDB to get agent names
  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/Dashboard/FetchUser");
      const result = await response.json();

      if (result.success && result.data) {
        setAgents(result.data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Create agent mapping (ReferenceID -> Full Name)
  const agentMap = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((agent) => {
      const fullName = `${agent.Firstname || ""} ${agent.Lastname || ""}`.trim();
      map[agent.ReferenceID] = fullName || agent.ReferenceID;
    });
    return map;
  }, [agents]);

  // Get unique agents from activities
  const uniqueAgents = useMemo(() => {
    const agentIds = new Set(activities.map((act) => act.agent).filter(Boolean));
    return Array.from(agentIds).map((id) => ({
      id,
      name: agentMap[id] || id,
    }));
  }, [activities, agentMap]);

  // Fetch activities from supabase with batch fetching (no 1k limit)
  const BATCH_SIZE = 1000; // Supabase max limit per request

  const fetchActivities = async () => {
    setIsFetching(true);

    let allData: any[] = [];
    let hasMore = true;
    let start = 0;
    const maxBatches = 100; // Safety limit (100k rows max)
    let batchCount = 0;

    while (hasMore && batchCount < maxBatches) {
      let query = supabase
        .from("endorsed-ticket")
        .select(`*`);

      // Apply date range filter if set
      if (dateFrom) {
        query = query.gte("date_created", dateFrom);
      }
      if (dateTo) {
        query = query.lte("date_created", dateTo);
      }

      // Apply agent filter if selected
      if (selectedAgent) {
        query = query.eq("agent", selectedAgent);
      }

      const { data, error } = await query
        .order("date_created", { ascending: false })
        .range(start, start + BATCH_SIZE - 1);

      if (error) {
        toast.error(`Error fetching activities: ${error.message}`);
        setActivities([]);
        setIsFetching(false);
        return;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        console.log(`[fetchActivities] Batch ${batchCount + 1}: Fetched ${data.length} records (total: ${allData.length})`);

        // Check if we got less than batch size (means we're done)
        if (data.length < BATCH_SIZE) {
          hasMore = false;
        } else {
          start += BATCH_SIZE;
          batchCount++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`[fetchActivities] Total fetched: ${allData.length} records in ${batchCount + 1} batches`);
    setActivities(allData);
    setIsFetching(false);
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [dateFrom, dateTo, selectedAgent]);


  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : "N/A";

  const handleInlineUpdate = async (id: string, field: keyof Activity, value: string) => {
    const { error } = await supabase
      .from("endorsed-ticket")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      toast.error(`Failed to update ${field}`);
      return;
    }

    toast.success(`${field} updated successfully`);
    setUnsavedChanges(prev => {
      const newSet = new Set(prev);
      newSet.delete(`${id}-${field}`);
      return newSet;
    });
    await fetchActivities();
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = Object.keys(columnVisibility).filter(key => columnVisibility[key]);
    const csvContent = [
      headers.join(','),
      ...paginatedActivities.map(row =>
        headers.map(header => {
          const value = row[header as keyof Activity] || '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `endorsed-tickets-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle column sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Toggle column visibility
  const toggleColumnVisibility = (column: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  // Handle bulk edit
  const handleBulkEdit = async () => {
    if (selectedIds.length === 0 || !bulkEditField) return;

    const { error } = await supabase
      .from("endorsed-ticket")
      .update({ [bulkEditField]: bulkEditValue })
      .in("id", selectedIds);

    if (error) {
      toast.error("Failed to bulk update");
      return;
    }

    toast.success(`Updated ${selectedIds.length} rows`);
    setShowBulkEditDialog(false);
    setBulkEditField("");
    setBulkEditValue("");
    setSelectedIds([]);
    await fetchActivities();
  };

  // Cell validation
  const validateCell = (field: string, value: string): boolean => {
    if (!value) return true;

    switch (field) {
      case 'email_address':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'contact_number':
        return /^[0-9+\-\s()]*$/.test(value);
      default:
        return true;
    }
  };

  // Check if field is empty or invalid
  const isFieldIncomplete = (field: keyof Activity, value: string | null | number | undefined): boolean => {
    // Convert to string safely
    const strValue = value != null ? String(value) : '';

    if (!strValue || strValue.trim() === '' || strValue === 'null' || strValue === 'undefined') return true;

    switch (field) {
      case 'email_address':
        // Allow comma-separated emails (arrays) - split and validate each
        const emails = strValue.split(',').map(e => e.trim()).filter(e => e.length > 0);
        if (emails.length === 0) return true; // No valid emails
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !emails.every(email => emailRegex.test(email));
      case 'contact_number':
        // Allow both comma and slash as separators - normalize to slash then split and validate each
        const normalizedNumbers = strValue.replace(/,/g, '/');
        const numbers = normalizedNumbers.split('/').map(n => n.trim()).filter(n => n.length > 0);
        if (numbers.length === 0) return true;
        return !numbers.every(num => num.length >= 7 && /^[0-9+\-\s()]*$/.test(num));
      case 'company_name':
        return strValue.trim().length < 2;
      case 'contact_person':
        // Allow slash-separated contact persons (arrays) - split and validate each
        const persons = strValue.split('/').map(p => p.trim()).filter(p => p.length > 0);
        if (persons.length === 0) return true;
        return !persons.every(person => person.length >= 2);
      default:
        return false;
    }
  };

  // Filtered activities (must be after isFieldIncomplete)
  const filteredActivities = useMemo(() => {
    let result = activities;

    // Filter incomplete only if enabled
    if (showIncompleteOnly) {
      result = result.filter(act => {
        const incompleteFields = [
          isFieldIncomplete('company_name', act.company_name),
          isFieldIncomplete('contact_person', act.contact_person),
          isFieldIncomplete('contact_number', act.contact_number),
          isFieldIncomplete('email_address', act.email_address),
          isFieldIncomplete('address', act.address),
          isFieldIncomplete('ticket_reference_number', act.ticket_reference_number),
          isFieldIncomplete('wrap_up', act.wrap_up),
          isFieldIncomplete('inquiry', act.inquiry),
          isFieldIncomplete('agent', act.agent),
          isFieldIncomplete('status', act.status),
        ].filter(Boolean).length;
        return incompleteFields > 0;
      });
    }

    // Apply search filter
    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      result = result.filter((act) =>
        [
          act.company_name,
          act.ticket_reference_number,
          act.wrap_up,
          act.inquiry,
          act.tsm,
          act.agent,
          act.status,
          act.date_created,
          act.date_updated,
          act.referenceid,
        ]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(lowerSearch))
      );
    }

    return result;
  }, [activities, search, showIncompleteOnly]);

  // Get sorted activities (must be after filteredActivities)
  const sortedActivities = useMemo(() => {
    if (!sortColumn) return filteredActivities;

    return [...filteredActivities].sort((a, b) => {
      const aVal = a[sortColumn as keyof Activity] || '';
      const bVal = b[sortColumn as keyof Activity] || '';

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredActivities, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedActivities.length / ROWS_PER_PAGE));
  const paginatedActivities = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return sortedActivities.slice(start, start + ROWS_PER_PAGE);
  }, [sortedActivities, page]);

  const goToPrevious = () => setPage((p) => Math.max(1, p - 1));
  const goToNext = () => setPage((p) => Math.min(totalPages, p + 1));

  useEffect(() => {
    setPage(1);
  }, [search]);

  // Keyboard navigation (must be after paginatedActivities)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedCell) return;

      const currentIndex = paginatedActivities.findIndex(a => a.id === focusedCell.rowId);
      const fields = Object.keys(columnVisibility).filter(key => columnVisibility[key]);
      const currentFieldIndex = fields.indexOf(focusedCell.field);

      if (e.key === 'ArrowDown' && currentIndex < paginatedActivities.length - 1) {
        e.preventDefault();
        setFocusedCell({
          rowId: paginatedActivities[currentIndex + 1].id,
          field: focusedCell.field
        });
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault();
        setFocusedCell({
          rowId: paginatedActivities[currentIndex - 1].id,
          field: focusedCell.field
        });
      } else if (e.key === 'ArrowRight' && currentFieldIndex < fields.length - 1) {
        e.preventDefault();
        setFocusedCell({
          rowId: focusedCell.rowId,
          field: fields[currentFieldIndex + 1]
        });
      } else if (e.key === 'ArrowLeft' && currentFieldIndex > 0) {
        e.preventDefault();
        setFocusedCell({
          rowId: focusedCell.rowId,
          field: fields[currentFieldIndex - 1]
        });
      } else if (e.key === 'Escape') {
        setFocusedCell(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCell, paginatedActivities, columnVisibility]);

  // Handle cell change with validation
  const handleCellChange = (id: string, field: string, value: string) => {
    if (!validateCell(field, value)) {
      toast.error(`Invalid ${field.replace(/_/g, ' ')}`);
      return;
    }

    setUnsavedChanges(prev => new Set([...prev, `${id}-${field}`]));
  };

  // Activity statistics for audit panel (must be after isFieldIncomplete)
  const activityStats = useMemo(() => {
    const total = activities.length;
    const received = activities.filter(act =>
      act.status?.toLowerCase() === 'received' ||
      act.status?.toLowerCase() === 'pending' ||
      act.status?.toLowerCase() === 'new'
    ).length;
    const endorsed = activities.filter(act =>
      act.status?.toLowerCase() === 'endorsed' ||
      act.status?.toLowerCase() === 'in_progress'
    ).length;
    const completed = activities.filter(act =>
      act.status?.toLowerCase() === 'completed' ||
      act.status?.toLowerCase() === 'resolved' ||
      act.status?.toLowerCase() === 'done'
    ).length;
    const incomplete = activities.filter(act => {
      const incompleteFields = [
        isFieldIncomplete('company_name', act.company_name),
        isFieldIncomplete('contact_person', act.contact_person),
        isFieldIncomplete('contact_number', act.contact_number),
        isFieldIncomplete('email_address', act.email_address),
        isFieldIncomplete('address', act.address),
        isFieldIncomplete('ticket_reference_number', act.ticket_reference_number),
        isFieldIncomplete('wrap_up', act.wrap_up),
        isFieldIncomplete('inquiry', act.inquiry),
        isFieldIncomplete('agent', act.agent),
        isFieldIncomplete('status', act.status),
      ].filter(Boolean).length;
      return incompleteFields > 0;
    }).length;

    return { total, received, endorsed, completed, incomplete };
  }, [activities]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedActivities.map((a) => a.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));

    setSelectedIds(allSelected
      ? selectedIds.filter((id) => !pageIds.includes(id))
      : [...new Set([...selectedIds, ...pageIds])]
    );
  };

  // Fetch activity data from fetch-activity endpoint
  const fetchActivityData = async (ticketRefNumber: string) => {
    if (!ticketRefNumber) {
      setActivityData(null);
      return;
    }

    setIsLoadingActivity(true);
    try {
      const response = await fetch("/api/fetch-activity");
      const result = await response.json();

      // API returns { activities: [...], count: number }
      const activities = result.activities || [];

      // Find activity with matching ticket_reference_number
      const matchingActivity = activities.find(
        (act: any) => act.ticket_reference_number === ticketRefNumber
      );

      if (matchingActivity) {
        setActivityData({
          activity_reference_number: matchingActivity.activity_reference_number || '',
          scheduled_date: matchingActivity.scheduled_date || '',
          company_name: matchingActivity.company_name || '',
          contact_person: matchingActivity.contact_person || '',
          contact_number: matchingActivity.contact_number || '',
          email_address: matchingActivity.email_address || '',
          address: matchingActivity.address || '',
          type_client: matchingActivity.type_client || '',
          cancellation_remarks: matchingActivity.cancellation_remarks || '',
          ticket_remarks: matchingActivity.ticket_remarks || '',
          status: matchingActivity.status || '',
        });
      } else {
        console.log("[fetchActivityData] No matching activity found for ticket:", ticketRefNumber);
        console.log("[fetchActivityData] Total activities fetched:", activities.length);
        setActivityData(null);
      }
    } catch (error) {
      console.error("Error fetching activity data:", error);
      setActivityData(null);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  // Open card-style edit dialog
  const handleEditClick = (activity: Activity) => {
    setEditingActivity(activity);
    setEditFormData({ ...activity });
    setActivityData(null); // Reset activity data
    setShowEditDialog(true);
    // Fetch activity data for this ticket
    fetchActivityData(activity.ticket_reference_number);
  };

  // Handle card edit form change
  const handleEditFormChange = (field: keyof Activity, value: string) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Save card edit
  const handleSaveEdit = async () => {
    if (!editingActivity || !editFormData) return;

    const updates: Partial<Activity> = {};
    Object.keys(editFormData).forEach((key) => {
      const field = key as keyof Activity;
      if (editFormData[field] !== editingActivity[field]) {
        updates[field] = editFormData[field] as any;
      }
    });

    if (Object.keys(updates).length === 0) {
      toast.info("No changes to save");
      setShowEditDialog(false);
      return;
    }

    const { error } = await supabase
      .from("endorsed-ticket")
      .update(updates)
      .eq("id", editingActivity.id);

    if (error) {
      toast.error(`Failed to update: ${error.message}`);
      return;
    }

    toast.success("Activity updated successfully");
    setShowEditDialog(false);
    setEditingActivity(null);
    await fetchActivities();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const { error } = await supabase
      .from("endorsed-ticket")
      .delete()
      .in("id", selectedIds);

    if (error) {
      toast.error("Failed to delete selected activities");
      return;
    }

    toast.success(`${selectedIds.length} activity deleted`);
    setSelectedIds([]);
    setShowDeleteConfirm(false);
    setDeleteHoldProgress(0);
    setIsHoldingDelete(false);
    fetchActivities();
  };

  // Hold to delete handlers
  const startDeleteHold = () => {
    setIsHoldingDelete(true);
    setDeleteHoldProgress(0);

    const startTime = Date.now();
    deleteHoldTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / DELETE_HOLD_DURATION) * 100, 100);
      setDeleteHoldProgress(progress);

      if (elapsed >= DELETE_HOLD_DURATION) {
        // Hold complete - execute delete
        if (deleteHoldTimerRef.current) {
          clearInterval(deleteHoldTimerRef.current);
          deleteHoldTimerRef.current = null;
        }
        handleBulkDelete();
      }
    }, 50); // Update every 50ms for smooth progress
  };

  const stopDeleteHold = () => {
    setIsHoldingDelete(false);
    setDeleteHoldProgress(0);
    if (deleteHoldTimerRef.current) {
      clearInterval(deleteHoldTimerRef.current);
      deleteHoldTimerRef.current = null;
    }
  };

  const handleDeleteDialogClose = (open: boolean) => {
    if (!open) {
      stopDeleteHold();
    }
    setShowDeleteConfirm(open);
  };

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Clean Header */}
          <header className="flex h-14 shrink-0 items-center gap-2 px-4 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-900" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 text-xs uppercase tracking-wider rounded-none"
              >
                Home
              </Button>
              <Separator orientation="vertical" className="h-4 bg-slate-700 hidden sm:block" />
              <Breadcrumb className="hidden sm:flex">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#" className="text-slate-400 hover:text-cyan-400">Taskflow</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-slate-600" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-cyan-400">Endorsed Ticket</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          {/* Clean Toolbar */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 px-4 py-3 bg-slate-950 border-b border-slate-800">
            {/* LEFT SIDE - Search and Agent Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 size-4 text-slate-500" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-full bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 rounded-none h-9"
                />
                {isFetching && (
                  <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-cyan-500" />
                )}
              </div>

              {/* Agent Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full sm:w-48 bg-slate-900 border border-slate-700 text-slate-200 focus:border-cyan-500/50 rounded-none h-9 px-2 text-sm"
                >
                  <option value="">All Agents</option>
                  {uniqueAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                {selectedAgent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAgent("")}
                    className="text-slate-400 hover:text-cyan-400 hover:bg-slate-900 rounded-none h-9"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* RIGHT SIDE - Date Range, Export, Columns */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
              {/* Date Range Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-slate-900 border-slate-700 text-slate-300 focus:border-cyan-500/50 rounded-none h-9"
                  placeholder="From"
                />
                <span className="text-slate-500">-</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-slate-900 border-slate-700 text-slate-300 focus:border-cyan-500/50 rounded-none h-9"
                  placeholder="To"
                />
                {(dateFrom || dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="text-slate-400 hover:text-cyan-400 hover:bg-slate-900 rounded-none h-9 px-2"
                  >
                    ×
                  </Button>
                )}
              </div>

              {/* Action Buttons Group */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 text-xs uppercase tracking-wider rounded-none h-9"
                >
                  Export
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColumnMenu(!showColumnMenu)}
                  className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 text-xs uppercase tracking-wider rounded-none h-9"
                >
                  Columns
                </Button>
              </div>

              {selectedIds.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkEditDialog(true)}
                  className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20 text-xs uppercase tracking-wider rounded-none h-9"
                >
                  Bulk Edit ({selectedIds.length})
                </Button>
              )}

              {selectedIds.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 text-xs uppercase tracking-wider rounded-none h-9"
                >
                  Delete ({selectedIds.length})
                </Button>
              )}
            </div>
          </div>

          {/* Column Visibility Menu */}
          {showColumnMenu && (
            <div className="p-4 border border-slate-800 bg-slate-900">
              <div className="grid grid-cols-4 gap-2">
                {Object.keys(columnVisibility).map(column => (
                  <label key={column} className="flex items-center gap-2 text-sm cursor-pointer text-slate-300 hover:text-cyan-400">
                    <input
                      type="checkbox"
                      checked={columnVisibility[column]}
                      onChange={() => toggleColumnVisibility(column)}
                      className="accent-cyan-500"
                    />
                    <span className="capitalize">{column.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Card Grid */}
          <div className="overflow-hidden bg-slate-950 h-full">
            {isFetching ? (
              <div className="py-10 text-center flex flex-col items-center gap-2 text-slate-400 text-xs bg-slate-900">
                <Loader2 className="size-6 animate-spin text-cyan-500" />
                <span>Loading activities...</span>
              </div>
            ) : (
              <div className="max-h-[calc(100vh-300px)]">
                {/* Grid Header */}
                <div className="grid grid-cols-[40px_40px_1fr] gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
                  <div className="text-slate-300 font-medium text-xs">#</div>
                  <div>
                    <input
                      type="checkbox"
                      checked={
                        paginatedActivities.length > 0 &&
                        paginatedActivities.every((a) => selectedIds.includes(a.id))
                      }
                      onChange={toggleSelectAll}
                      className="accent-cyan-500"
                    />
                  </div>
                  <div className="text-slate-300 font-medium text-xs">Records</div>
                </div>
                {/* Card Grid Body */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {paginatedActivities.length === 0 ? (
                    <div className="col-span-full text-center text-slate-400 py-8">
                      No activities found.
                    </div>
                  ) : (
                    paginatedActivities.map((act, index) => {
                      const incompleteCount = [
                        isFieldIncomplete('company_name', act.company_name),
                        isFieldIncomplete('contact_person', act.contact_person),
                        isFieldIncomplete('contact_number', act.contact_number),
                        isFieldIncomplete('email_address', act.email_address),
                        isFieldIncomplete('address', act.address),
                        isFieldIncomplete('ticket_reference_number', act.ticket_reference_number),
                        isFieldIncomplete('wrap_up', act.wrap_up),
                        isFieldIncomplete('inquiry', act.inquiry),
                        isFieldIncomplete('agent', act.agent),
                        isFieldIncomplete('status', act.status),
                      ].filter(Boolean).length;

                      return (
                        <div
                          key={act.id}
                          className="bg-slate-900 border border-slate-800 hover:border-cyan-500/30 transition-colors cursor-pointer group"
                          onClick={() => handleEditClick(act)}
                        >
                          {/* Card Header */}
                          <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(act.id)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleSelect(act.id);
                                }}
                                className="accent-cyan-500"
                              />
                              <span className="text-xs text-slate-500">#{(page - 1) * ROWS_PER_PAGE + index + 1}</span>
                            </div>
                            {incompleteCount > 0 && (
                              <div className="flex items-center gap-1 text-red-400 text-xs">
                                <AlertCircle className="h-3 w-3" />
                                <span>{incompleteCount}</span>
                              </div>
                            )}
                            {incompleteCount === 0 && (
                              <div className="flex items-center gap-1 text-emerald-400 text-xs">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Complete</span>
                              </div>
                            )}
                          </div>

                          {/* Card Body */}
                          <div className="p-3 space-y-2">
                            {/* Reference ID */}
                            {columnVisibility.referenceid && act.referenceid && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 uppercase">Ref ID</span>
                                <span className="text-xs text-cyan-400 font-medium">{act.referenceid}</span>
                              </div>
                            )}

                            {/* Company Name */}
                            {columnVisibility.company_name && (
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs text-slate-500 uppercase">Company</span>
                                <span className={`text-xs text-right ${isFieldIncomplete('company_name', act.company_name) ? 'text-red-400' : 'text-slate-300'}`}>
                                  {act.company_name || '-'}
                                </span>
                              </div>
                            )}

                            {/* Contact Person */}
                            {columnVisibility.contact_person && (
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs text-slate-500 uppercase">Contact</span>
                                <span className={`text-xs text-right ${isFieldIncomplete('contact_person', act.contact_person) ? 'text-red-400' : 'text-slate-300'}`}>
                                  {act.contact_person || '-'}
                                </span>
                              </div>
                            )}

                            {/* Contact Number */}
                            {columnVisibility.contact_number && (
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs text-slate-500 uppercase">Phone</span>
                                <span className={`text-xs text-right ${isFieldIncomplete('contact_number', act.contact_number) ? 'text-red-400' : 'text-slate-300'}`}>
                                  {act.contact_number || '-'}
                                </span>
                              </div>
                            )}

                            {/* Email */}
                            {columnVisibility.email_address && (
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs text-slate-500 uppercase">Email</span>
                                <span className={`text-xs text-right truncate max-w-[150px] ${isFieldIncomplete('email_address', act.email_address) ? 'text-red-400' : 'text-slate-300'}`}>
                                  {act.email_address || '-'}
                                </span>
                              </div>
                            )}

                            {/* Ticket Ref */}
                            {columnVisibility.ticket_reference_number && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 uppercase">Ticket</span>
                                <span className={`text-xs ${isFieldIncomplete('ticket_reference_number', act.ticket_reference_number) ? 'text-red-400' : 'text-slate-300'}`}>
                                  {act.ticket_reference_number || '-'}
                                </span>
                              </div>
                            )}

                            {/* Status */}
                            {columnVisibility.status && (
                              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                                <span className="text-xs text-slate-500 uppercase">Status</span>
                                <span className={`text-xs px-2 py-0.5 ${act.status?.toLowerCase() === 'completed' || act.status?.toLowerCase() === 'resolved'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : act.status?.toLowerCase() === 'pending' || act.status?.toLowerCase() === 'open'
                                    ? 'bg-yellow-500/10 text-yellow-400'
                                    : act.status?.toLowerCase() === 'cancelled' || act.status?.toLowerCase() === 'closed'
                                      ? 'bg-red-500/10 text-red-400'
                                      : 'bg-slate-800 text-slate-300'
                                  }`}>
                                  {act.status || 'N/A'}
                                </span>
                              </div>
                            )}

                            {/* Agent */}
                            {columnVisibility.agent && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 uppercase">Agent</span>
                                <span className={`text-xs ${isFieldIncomplete('agent', act.agent) ? 'text-red-400' : 'text-slate-300'}`} title={agentMap[act.agent] || act.agent}>
                                  {act.agent || '-'}
                                </span>
                              </div>
                            )}

                            {/* Date */}
                            {columnVisibility.date_created && (
                              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                                <span className="text-xs text-slate-500 uppercase">Created</span>
                                <span className="text-xs text-slate-400">{formatDate(act.date_created)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Floating Audit Panel - Bottom Right */}
            {showAuditPanel ? (
              <div className="fixed right-4 bottom-4 z-50 w-64 bg-slate-950 border border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Audit Panel</span>
                  </div>
                  <button
                    onClick={() => setShowAuditPanel(false)}
                    className="text-slate-500 hover:text-red-400"
                  >
                    ×
                  </button>
                </div>

                <div className="p-3 space-y-3">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-900 border border-slate-800 p-2 text-center">
                      <div className="text-lg font-bold text-cyan-400">{activityStats.total}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-2 text-center">
                      <div className="text-lg font-bold text-emerald-400">{activityStats.completed}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Completed</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-2 text-center">
                      <div className="text-lg font-bold text-yellow-400">{activityStats.received}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Received</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-2 text-center">
                      <div className="text-lg font-bold text-blue-400">{activityStats.endorsed}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Endorsed</div>
                    </div>
                  </div>

                  {/* Incomplete Count - Clickable Filter */}
                  {activityStats.incomplete > 0 && (
                    <button
                      onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
                      className={`w-full p-2 text-left transition-colors ${showIncompleteOnly
                          ? 'bg-red-500/30 border border-red-500/50'
                          : 'bg-red-500/10 border border-red-500/30 hover:bg-red-500/20'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">Incomplete Records</span>
                          {showIncompleteOnly && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">ACTIVE</span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-red-400">{activityStats.incomplete}</span>
                      </div>
                      <div className="text-[10px] text-red-400/70 mt-1">
                        {showIncompleteOnly ? 'Click to show all records' : 'Click to filter incomplete only'}
                      </div>
                    </button>
                  )}

                  {/* Audit Log */}
                  <div className="border-t border-slate-800 pt-2">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Activity Log</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {auditErrors.length > 0 ? (
                        auditErrors.map((error, idx) => (
                          <div key={idx} className="text-xs text-red-400 flex items-start gap-1">
                            <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                            <span>{error}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-600 italic">No errors logged</div>
                      )}
                    </div>
                  </div>

                  {/* Last Updated */}
                  <div className="text-[10px] text-slate-600 text-center border-t border-slate-800 pt-2">
                    Last updated: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ) : (
              /* Collapsed Icon Button */
              <button
                onClick={() => setShowAuditPanel(true)}
                className="fixed right-4 bottom-4 z-50 w-12 h-12 bg-slate-900 border border-slate-700 hover:border-cyan-500/50 shadow-lg flex items-center justify-center group"
                title="Open Audit Panel"
              >
                <AlertCircle className="h-5 w-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                {activityStats.incomplete > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                    {activityStats.incomplete > 9 ? '9+' : activityStats.incomplete}
                  </span>
                )}
              </button>
            )}

            {/* Pagination */}
            <div className="flex justify-center items-center gap-4 my-4">
              <Button
                variant="outline"
                onClick={goToPrevious}
                disabled={page === 1}
                className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 disabled:opacity-50 text-xs uppercase tracking-wider rounded-none"
              >
                Previous
              </Button>
              <span className="text-slate-300 text-sm">
                Page <span className="text-cyan-400 font-semibold">{page}</span> of <span className="text-cyan-400 font-semibold">{totalPages}</span>
              </span>
              <Button
                variant="outline"
                onClick={goToNext}
                disabled={page === totalPages}
                className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 disabled:opacity-50 text-xs uppercase tracking-wider rounded-none"
              >
                Next
              </Button>
            </div>
          </div>

          <Dialog open={showDeleteConfirm} onOpenChange={handleDeleteDialogClose}>
            <DialogContent className="max-w-md bg-slate-950 border-slate-800 rounded-none">
              <DialogHeader>
                <DialogTitle className="text-white uppercase tracking-wider text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  Hold to Delete
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  You are about to delete{" "}
                  <strong className="text-red-400">{selectedIds.length}</strong> selected activities.
                  This action cannot be undone.
                </p>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-75 ease-linear"
                      style={{ width: `${deleteHoldProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 text-center">
                    {isHoldingDelete
                      ? `Hold for ${(DELETE_HOLD_DURATION / 1000).toFixed(1)}s to confirm...`
                      : `Press and hold the button below for ${DELETE_HOLD_DURATION / 1000}s to delete`
                    }
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleDeleteDialogClose(false)}
                  className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 rounded-none"
                >
                  Cancel
                </Button>

                {/* Hold to Delete Button */}
                <button
                  onMouseDown={startDeleteHold}
                  onMouseUp={stopDeleteHold}
                  onMouseLeave={stopDeleteHold}
                  onTouchStart={startDeleteHold}
                  onTouchEnd={stopDeleteHold}
                  onTouchCancel={stopDeleteHold}
                  className={`
                    relative overflow-hidden px-4 py-2 text-xs uppercase tracking-wider font-medium
                    border rounded-none transition-colors select-none
                    ${isHoldingDelete
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                    }
                  `}
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isHoldingDelete ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Deleting... {Math.round(deleteHoldProgress)}%
                      </>
                    ) : (
                      <>
                        Hold to Delete ({selectedIds.length})
                      </>
                    )}
                  </span>
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
            <DialogContent className="max-w-md bg-slate-950 border-slate-800 rounded-none">
              <DialogHeader>
                <DialogTitle className="text-white uppercase tracking-wider text-sm">Bulk Edit</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-300">Field to Edit</label>
                  <select
                    value={bulkEditField}
                    onChange={(e) => setBulkEditField(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-700 bg-slate-900 text-slate-200 focus:border-cyan-500/50 focus:outline-none rounded-none"
                  >
                    <option value="" className="bg-slate-900">Select a field</option>
                    <option value="tsm" className="bg-slate-900">TSM</option>
                    <option value="status" className="bg-slate-900">Status</option>
                    <option value="agent" className="bg-slate-900">Agent</option>
                    <option value="wrap_up" className="bg-slate-900">Wrap Up</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300">New Value</label>
                  <Input
                    value={bulkEditValue}
                    onChange={(e) => setBulkEditValue(e.target.value)}
                    className="mt-1 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 rounded-none"
                    placeholder="Enter new value"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowBulkEditDialog(false)}
                  className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 rounded-none"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkEdit}
                  disabled={!bulkEditField || !bulkEditValue}
                  className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20 disabled:opacity-50 rounded-none"
                >
                  Update {selectedIds.length} Rows
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Card-Style Edit Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-7xl w-[95vw] bg-slate-950 border-slate-800 rounded-none max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white uppercase tracking-wider text-sm flex items-center gap-2">
                  Edit Record - {editingActivity?.referenceid || "New Record"}
                </DialogTitle>
              </DialogHeader>

              {editingActivity && (
                <div className="grid grid-cols-3 gap-6">
                  {/* LEFT COLUMN - Counter Checking (Incomplete Data) */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-red-500/30 pb-2">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                      <h3 className="text-red-400 font-medium uppercase tracking-wider text-sm">Counter Checking</h3>
                      <span className="text-xs text-slate-500 ml-auto">
                        {[
                          'company_name',
                          'contact_person',
                          'contact_number',
                          'email_address',
                          'address',
                          'ticket_reference_number',
                          'wrap_up',
                          'inquiry',
                          'agent',
                          'status'
                        ].filter(field => isFieldIncomplete(field as keyof Activity, editingActivity[field as keyof Activity] as string)).length} fields need attention
                      </span>
                    </div>

                    <div className="space-y-3">
                      {/* Incomplete Fields */}
                      {isFieldIncomplete('company_name', editingActivity.company_name) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1">
                            Company Name <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={editFormData.company_name || ''}
                            onChange={(e) => handleEditFormChange('company_name', e.target.value)}
                            className="bg-slate-900 border-red-500/30 text-slate-200 focus:border-red-400 rounded-none h-9"
                            placeholder="Enter company name"
                          />
                        </div>
                      )}

                      {isFieldIncomplete('contact_person', editingActivity.contact_person) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1">
                            Contact Person <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={editFormData.contact_person || ''}
                            onChange={(e) => handleEditFormChange('contact_person', e.target.value)}
                            className="bg-slate-900 border-red-500/30 text-slate-200 focus:border-red-400 rounded-none h-9"
                            placeholder="Enter contact person"
                          />
                        </div>
                      )}

                      {isFieldIncomplete('contact_number', editingActivity.contact_number) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1">
                            Contact Number <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={editFormData.contact_number || ''}
                            onChange={(e) => handleEditFormChange('contact_number', e.target.value)}
                            className="bg-slate-900 border-red-500/30 text-slate-200 focus:border-red-400 rounded-none h-9"
                            placeholder="Enter contact number"
                          />
                        </div>
                      )}

                      {isFieldIncomplete('email_address', editingActivity.email_address) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1">
                            Email Address <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={editFormData.email_address || ''}
                            onChange={(e) => handleEditFormChange('email_address', e.target.value)}
                            className="bg-slate-900 border-red-500/30 text-slate-200 focus:border-red-400 rounded-none h-9"
                            placeholder="Enter email address"
                          />
                        </div>
                      )}

                      {isFieldIncomplete('address', editingActivity.address) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1">
                            Address <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={editFormData.address || ''}
                            onChange={(e) => handleEditFormChange('address', e.target.value)}
                            className="bg-slate-900 border-red-500/30 text-slate-200 focus:border-red-400 rounded-none h-9"
                            placeholder="Enter address"
                          />
                        </div>
                      )}

                      {isFieldIncomplete('ticket_reference_number', editingActivity.ticket_reference_number) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1">
                            Ticket Ref # <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={editFormData.ticket_reference_number || ''}
                            onChange={(e) => handleEditFormChange('ticket_reference_number', e.target.value)}
                            className="bg-slate-900 border-red-500/30 text-slate-200 focus:border-red-400 rounded-none h-9"
                            placeholder="Enter ticket reference"
                          />
                        </div>
                      )}

                      {isFieldIncomplete('wrap_up', editingActivity.wrap_up) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1">
                            Wrap Up <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={editFormData.wrap_up || ''}
                            onChange={(e) => handleEditFormChange('wrap_up', e.target.value)}
                            className="bg-slate-900 border-red-500/30 text-slate-200 focus:border-red-400 rounded-none h-9"
                            placeholder="Enter wrap up"
                          />
                        </div>
                      )}

                      {isFieldIncomplete('inquiry', editingActivity.inquiry) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1">
                            Inquiry <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={editFormData.inquiry || ''}
                            onChange={(e) => handleEditFormChange('inquiry', e.target.value)}
                            className="bg-slate-900 border-red-500/30 text-slate-200 focus:border-red-400 rounded-none h-9"
                            placeholder="Enter inquiry"
                          />
                        </div>
                      )}

                      {isFieldIncomplete('agent', editingActivity.agent) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1">
                            Agent <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={editFormData.agent || ''}
                            onChange={(e) => handleEditFormChange('agent', e.target.value)}
                            className="bg-slate-900 border-red-500/30 text-slate-200 focus:border-red-400 rounded-none h-9"
                            placeholder="Enter agent"
                          />
                        </div>
                      )}

                      {isFieldIncomplete('status', editingActivity.status) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1">
                            Status <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={editFormData.status || ''}
                            onChange={(e) => handleEditFormChange('status', e.target.value)}
                            className="bg-slate-900 border-red-500/30 text-slate-200 focus:border-red-400 rounded-none h-9"
                            placeholder="Enter status"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN - Complete Data */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-emerald-500/30 pb-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <h3 className="text-emerald-400 font-medium uppercase tracking-wider text-sm">Complete Data</h3>
                      <span className="text-xs text-slate-500 ml-auto">
                        {Object.keys(editingActivity).filter(key => !isFieldIncomplete(key as keyof Activity, editingActivity[key as keyof Activity] as string)).length} fields verified
                      </span>
                    </div>

                    <div className="space-y-3">
                      {/* Complete Fields */}
                      {!isFieldIncomplete('company_name', editingActivity.company_name) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            Company Name <CheckCircle2 className="h-3 w-3" />
                          </label>
                          <Input
                            value={editFormData.company_name || ''}
                            onChange={(e) => handleEditFormChange('company_name', e.target.value)}
                            className="bg-slate-900 border-emerald-500/30 text-slate-200 focus:border-emerald-400 rounded-none h-9"
                          />
                        </div>
                      )}

                      {!isFieldIncomplete('contact_person', editingActivity.contact_person) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            Contact Person <CheckCircle2 className="h-3 w-3" />
                          </label>
                          <Input
                            value={editFormData.contact_person || ''}
                            onChange={(e) => handleEditFormChange('contact_person', e.target.value)}
                            className="bg-slate-900 border-emerald-500/30 text-slate-200 focus:border-emerald-400 rounded-none h-9"
                          />
                        </div>
                      )}

                      {!isFieldIncomplete('contact_number', editingActivity.contact_number) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            Contact Number <CheckCircle2 className="h-3 w-3" />
                          </label>
                          <Input
                            value={editFormData.contact_number || ''}
                            onChange={(e) => handleEditFormChange('contact_number', e.target.value)}
                            className="bg-slate-900 border-emerald-500/30 text-slate-200 focus:border-emerald-400 rounded-none h-9"
                          />
                        </div>
                      )}

                      {!isFieldIncomplete('email_address', editingActivity.email_address) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            Email Address <CheckCircle2 className="h-3 w-3" />
                          </label>
                          <Input
                            value={editFormData.email_address || ''}
                            onChange={(e) => handleEditFormChange('email_address', e.target.value)}
                            className="bg-slate-900 border-emerald-500/30 text-slate-200 focus:border-emerald-400 rounded-none h-9"
                          />
                        </div>
                      )}

                      {!isFieldIncomplete('address', editingActivity.address) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            Address <CheckCircle2 className="h-3 w-3" />
                          </label>
                          <Input
                            value={editFormData.address || ''}
                            onChange={(e) => handleEditFormChange('address', e.target.value)}
                            className="bg-slate-900 border-emerald-500/30 text-slate-200 focus:border-emerald-400 rounded-none h-9"
                          />
                        </div>
                      )}

                      {!isFieldIncomplete('ticket_reference_number', editingActivity.ticket_reference_number) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            Ticket Ref # <CheckCircle2 className="h-3 w-3" />
                          </label>
                          <Input
                            value={editFormData.ticket_reference_number || ''}
                            onChange={(e) => handleEditFormChange('ticket_reference_number', e.target.value)}
                            className="bg-slate-900 border-emerald-500/30 text-slate-200 focus:border-emerald-400 rounded-none h-9"
                          />
                        </div>
                      )}

                      {!isFieldIncomplete('wrap_up', editingActivity.wrap_up) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            Wrap Up <CheckCircle2 className="h-3 w-3" />
                          </label>
                          <Input
                            value={editFormData.wrap_up || ''}
                            onChange={(e) => handleEditFormChange('wrap_up', e.target.value)}
                            className="bg-slate-900 border-emerald-500/30 text-slate-200 focus:border-emerald-400 rounded-none h-9"
                          />
                        </div>
                      )}

                      {!isFieldIncomplete('inquiry', editingActivity.inquiry) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            Inquiry <CheckCircle2 className="h-3 w-3" />
                          </label>
                          <Input
                            value={editFormData.inquiry || ''}
                            onChange={(e) => handleEditFormChange('inquiry', e.target.value)}
                            className="bg-slate-900 border-emerald-500/30 text-slate-200 focus:border-emerald-400 rounded-none h-9"
                          />
                        </div>
                      )}

                      {!isFieldIncomplete('agent', editingActivity.agent) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            Agent <CheckCircle2 className="h-3 w-3" />
                          </label>
                          <Input
                            value={editFormData.agent || ''}
                            onChange={(e) => handleEditFormChange('agent', e.target.value)}
                            className="bg-slate-900 border-emerald-500/30 text-slate-200 focus:border-emerald-400 rounded-none h-9"
                          />
                        </div>
                      )}

                      {!isFieldIncomplete('status', editingActivity.status) && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            Status <CheckCircle2 className="h-3 w-3" />
                          </label>
                          <Input
                            value={editFormData.status || ''}
                            onChange={(e) => handleEditFormChange('status', e.target.value)}
                            className="bg-slate-900 border-emerald-500/30 text-slate-200 focus:border-emerald-400 rounded-none h-9"
                          />
                        </div>
                      )}

                      {/* Read-only fields */}
                      <div className="pt-4 border-t border-slate-800 space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Reference ID</label>
                          <Input
                            value={editFormData.referenceid || ''}
                            disabled
                            className="bg-slate-900/50 border-slate-800 text-slate-500 rounded-none h-9"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">TSM</label>
                          <Input
                            value={editFormData.tsm || ''}
                            onChange={(e) => handleEditFormChange('tsm', e.target.value)}
                            className="bg-slate-900 border-slate-700 text-slate-200 focus:border-cyan-500/50 rounded-none h-9"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Date Created</label>
                            <Input
                              value={formatDate(editFormData.date_created || '')}
                              disabled
                              className="bg-slate-900/50 border-slate-800 text-slate-500 rounded-none h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Date Updated</label>
                            <Input
                              value={formatDate(editFormData.date_updated || '')}
                              disabled
                              className="bg-slate-900/50 border-slate-800 text-slate-500 rounded-none h-9"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* THIRD COLUMN - Ticket Creation (Activity Data) */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-cyan-500/30 pb-2">
                      <Loader2 className={`h-5 w-5 text-cyan-400 ${isLoadingActivity ? 'animate-spin' : ''}`} />
                      <h3 className="text-cyan-400 font-medium uppercase tracking-wider text-sm">Ticket Creation</h3>
                      <span className="text-xs text-slate-500 ml-auto">
                        {activityData ? 'Found' : 'Not Found'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {isLoadingActivity ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
                        </div>
                      ) : activityData ? (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Activity Ref #</label>
                            <Input
                              value={activityData.activity_reference_number}
                              disabled
                              className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Scheduled Date</label>
                            <Input
                              value={activityData.scheduled_date ? new Date(activityData.scheduled_date).toLocaleDateString() : 'N/A'}
                              disabled
                              className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Company Name</label>
                            <Input
                              value={activityData.company_name}
                              disabled
                              className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Contact Person</label>
                            <Input
                              value={activityData.contact_person}
                              disabled
                              className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Contact Number</label>
                            <Input
                              value={activityData.contact_number}
                              disabled
                              className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Email Address</label>
                            <Input
                              value={activityData.email_address}
                              disabled
                              className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Address</label>
                            <Input
                              value={activityData.address}
                              disabled
                              className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Type Client</label>
                            <Input
                              value={activityData.type_client}
                              disabled
                              className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Status</label>
                            <Input
                              value={activityData.status}
                              disabled
                              className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9"
                            />
                          </div>

                          {activityData.cancellation_remarks && (
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-red-400 uppercase tracking-wider">Cancellation Remarks</label>
                              <Input
                                value={activityData.cancellation_remarks}
                                disabled
                                className="bg-slate-900/50 border-red-500/30 text-red-300 rounded-none h-9"
                              />
                            </div>
                          )}

                          {activityData.ticket_remarks && (
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-yellow-400 uppercase tracking-wider">Ticket Remarks</label>
                              <Input
                                value={activityData.ticket_remarks}
                                disabled
                                className="bg-slate-900/50 border-yellow-500/30 text-yellow-300 rounded-none h-9"
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <AlertCircle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">No activity found for this ticket</p>
                          <p className="text-xs text-slate-600 mt-1">
                            Ticket Ref: {editingActivity.ticket_reference_number || 'N/A'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="border-t border-slate-800 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 rounded-none"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20 rounded-none"
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
