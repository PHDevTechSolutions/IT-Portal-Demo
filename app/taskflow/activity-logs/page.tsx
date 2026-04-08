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
  referenceid: string;
  tsm: string;
  manager: string;
  status: string;
  date_created: string | null;
  ticket_reference_number: string;
  scheduled_date: string | null;
  agent: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  type_client: string;
  activity_reference_number: string;
  ticket_remarks: string;
  cancellation_remarks: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture?: string;
}

// Ticket Source data from endorsed-ticket
interface TicketSourceData {
  referenceid: string;
  date_created: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  inquiry: string;
  agent: string;
  wrap_up: string;
  status: string;
}

// History record from progress/history
interface HistoryRecord {
  id: string;
  company_name: string;
  status: string;
  date_created: string;
  ticket_reference_number: string;
}

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

  // Date range filtering
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Reference ID filter
  const [referenceIdFilter, setReferenceIdFilter] = useState("");
  const [referenceIdOptions, setReferenceIdOptions] = useState<string[]>([]);

  // Status filter
  const [statusFilter, setStatusFilter] = useState("");
  const [statusOptions, setStatusOptions] = useState<string[]>([]);

  // Page length (rows per page)
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Combined filter dialog
  const [showFilterDialog, setShowFilterDialog] = useState(false);

  // Column sorting
  const [sortColumn, setSortColumn] = useState<string>("date_created");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    referenceid: true,
    tsm: true,
    manager: true,
    company_name: true,
    contact_person: true,
    contact_number: true,
    email_address: true,
    address: true,
    type_client: true,
    agent: true,
    status: true,
    ticket_reference_number: true,
    scheduled_date: true,
    ticket_remarks: true,
    cancellation_remarks: true,
    activity_reference_number: true,
    date_created: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Keyboard navigation
  const [focusedCell, setFocusedCell] = useState<{rowId: string, field: string} | null>(null);

  // Bulk edit
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<string>("");
  const [bulkEditValue, setBulkEditValue] = useState("");

  // Save indicator
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());

  // Agent list and user details states
  const [agents, setAgents] = useState<Agent[]>([]);

  // Edit dialog states
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Activity>>({});
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Ticket source data (from endorsed-ticket)
  const [ticketSourceData, setTicketSourceData] = useState<TicketSourceData | null>(null);
  const [isLoadingTicketSource, setIsLoadingTicketSource] = useState(false);

  // History records (from progress/history)
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Audit panel state
  const [auditErrors, setAuditErrors] = useState<string[]>([]);
  const [showAuditPanel, setShowAuditPanel] = useState(true);

  // Filter incomplete records only
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);

  // Hold to delete states
  const [deleteHoldProgress, setDeleteHoldProgress] = useState(0);
  const [isHoldingDelete, setIsHoldingDelete] = useState(false);
  const deleteHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const DELETE_HOLD_DURATION = 2000; // 2 seconds to hold

  // Progressive fetching states
  const [fetchLimit, setFetchLimit] = useState(100); // Default fetch 100 rows
  const [totalDbRows, setTotalDbRows] = useState(0); // Total rows in database
  const [showFetchMoreAlert, setShowFetchMoreAlert] = useState(false);

  // Fetch activities from supabase with batch fetching (progressive)
  const BATCH_SIZE = 1000; // Supabase max limit per request

  // Get total count first
  const fetchTotalCount = async () => {
    let countQuery = supabase.from("activity").select("*", { count: "exact", head: true });

    // Apply date range filter if set
    if (dateFrom) {
      countQuery = countQuery.gte("date_created", dateFrom);
    }
    if (dateTo) {
      countQuery = countQuery.lte("date_created", dateTo);
    }

    const { count, error } = await countQuery;
    if (!error && count !== null) {
      setTotalDbRows(count);
    }
  };

  const fetchActivities = async (limit?: number) => {
    const maxRows = limit || fetchLimit;
    setIsFetching(true);

    // First get total count
    await fetchTotalCount();

    let allData: any[] = [];
    let hasMore = true;
    let start = 0;
    let batchCount = 0;

    while (hasMore && allData.length < maxRows) {
      let query = supabase
        .from("activity")
        .select(
          `
        id,
        referenceid,
        tsm,
        manager,
        status,
        date_created,
        ticket_reference_number,
        scheduled_date,
        agent,
        company_name,
        contact_person,
        contact_number,
        email_address,
        address,
        type_client,
        activity_reference_number,
        ticket_remarks,
        cancellation_remarks
      `
        );

      // Apply date range filter if set
      if (dateFrom) {
        query = query.gte("date_created", dateFrom);
      }
      if (dateTo) {
        query = query.lte("date_created", dateTo);
      }

      // Calculate remaining rows to fetch
      const remainingRows = maxRows - allData.length;
      const currentBatchSize = Math.min(BATCH_SIZE, remainingRows);

      const { data, error } = await query
        .order("date_created", { ascending: false })
        .range(start, start + currentBatchSize - 1);

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
        if (data.length < currentBatchSize) {
          hasMore = false;
        } else if (allData.length >= maxRows) {
          hasMore = false;
        } else {
          start += currentBatchSize;
          batchCount++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`[fetchActivities] Total fetched: ${allData.length} records`);
    setActivities(allData);
    setIsFetching(false);

    // Show alert if there are more rows to fetch
    setShowFetchMoreAlert(allData.length < totalDbRows);
  };

  // Handle fetch more button click
  const handleFetchMore = () => {
    let nextLimit: number;

    if (fetchLimit === 100) {
      nextLimit = 2100; // 100 + 2000
    } else if (fetchLimit === 2100) {
      nextLimit = 7100; // 2100 + 5000
    } else {
      // After 7100, keep adding 5000
      nextLimit = fetchLimit + 5000;
    }

    setFetchLimit(nextLimit);
    fetchActivities(nextLimit);
    toast.success(`Fetching up to ${nextLimit.toLocaleString()} rows...`);
  };

  useEffect(() => {
    fetchActivities(100); // Initial fetch only 100 rows
  }, []);

  useEffect(() => {
    setFetchLimit(100); // Reset limit when date range changes
    fetchActivities(100);
  }, [dateFrom, dateTo]);

  // Create a map from agent ReferenceID to agent info for quick lookup
  const agentMap = useMemo(() => {
    const map: Record<string, { name: string; profilePicture?: string }> = {};
    agents.forEach((agent) => {
      if (agent.ReferenceID && agent.Firstname && agent.Lastname) {
        map[agent.ReferenceID.toLowerCase()] = {
          name: `${agent.Firstname} ${agent.Lastname}`,
          profilePicture: agent.profilePicture,
        };
      }
    });
    return map;
  }, [agents]);

  // Populate reference ID and status options when activities change
  useEffect(() => {
    const uniqueRefIds = [...new Set(activities.map(act => act.referenceid).filter(Boolean))];
    setReferenceIdOptions(uniqueRefIds.sort());

    const uniqueStatuses = [...new Set(activities.map(act => act.status).filter(Boolean))];
    setStatusOptions(uniqueStatuses.sort());
  }, [activities]);

  const filteredActivities = useMemo(() => {
    let result = activities;

    // Apply referenceid filter
    if (referenceIdFilter) {
      result = result.filter(act => act.referenceid === referenceIdFilter);
    }

    // Apply status filter
    if (statusFilter) {
      result = result.filter(act => act.status?.toLowerCase() === statusFilter.toLowerCase());
    }

    // Apply search filter - searches all fields
    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      result = result.filter((act) =>
        [
          act.id,
          act.referenceid,
          act.tsm,
          act.manager,
          act.ticket_reference_number,
          act.agent,
          act.company_name,
          act.contact_person,
          act.contact_number,
          act.email_address,
          act.address,
          act.type_client,
          act.activity_reference_number,
          act.ticket_remarks,
          act.cancellation_remarks,
          act.status,
          act.scheduled_date,
          act.date_created,
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(lowerSearch))
      );
    }

    return result;
  }, [activities, search, referenceIdFilter, statusFilter]);

  // Get sorted activities
  const sortedActivities = useMemo(() => {
    if (!sortColumn) return filteredActivities;
    
    return [...filteredActivities].sort((a, b) => {
      const aVal = a[sortColumn as keyof Activity] || '';
      const bVal = b[sortColumn as keyof Activity] || '';
      
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredActivities, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedActivities.length / rowsPerPage));
  const paginatedActivities = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedActivities.slice(start, start + rowsPerPage);
  }, [sortedActivities, page, rowsPerPage]);

  const goToPrevious = () => setPage((p) => Math.max(1, p - 1));
  const goToNext = () => setPage((p) => Math.min(totalPages, p + 1));

  useEffect(() => {
    setPage(1);
  }, [search, referenceIdFilter, statusFilter, rowsPerPage]);

  // Keyboard navigation
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

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : "N/A";

  const handleInlineUpdate = async (id: string, field: keyof Activity, value: string) => {
    const { error } = await supabase
      .from("activity")
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

  // Check if field is empty or invalid
  const isFieldIncomplete = (field: keyof Activity, value: string | null | number | undefined): boolean => {
    const strValue = value != null ? String(value) : '';

    if (!strValue || strValue.trim() === '' || strValue === 'null' || strValue === 'undefined') return true;

    switch (field) {
      case 'email_address':
        const emails = strValue.split(',').map(e => e.trim()).filter(e => e.length > 0);
        if (emails.length === 0) return true;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !emails.every(email => emailRegex.test(email));
      case 'contact_number':
        // Allow both comma and slash as separators - normalize to slash then split
        const normalizedNumbers = strValue.replace(/,/g, '/');
        const numbers = normalizedNumbers.split('/').map(n => n.trim()).filter(n => n.length > 0);
        if (numbers.length === 0) return true;
        return !numbers.every(num => num.length >= 7 && /^[0-9+\-\s()]*$/.test(num));
      case 'company_name':
        return strValue.trim().length < 2;
      case 'contact_person':
        const persons = strValue.split('/').map(p => p.trim()).filter(p => p.length > 0);
        if (persons.length === 0) return true;
        return !persons.every(person => person.length >= 2);
      default:
        return false;
    }
  };

  // Fetch ticket source data from endorsed-ticket
  const fetchTicketSourceData = async (ticketReferenceNumber: string) => {
    if (!ticketReferenceNumber || ticketReferenceNumber.trim() === '') {
      console.log('[fetchTicketSourceData] No ticket reference number provided');
      setTicketSourceData(null);
      return;
    }

    setIsLoadingTicketSource(true);
    console.log(`[fetchTicketSourceData] Fetching for: ${ticketReferenceNumber}`);

    try {
      const response = await fetch(`/api/fetch-ticket-source?ticket_reference_number=${encodeURIComponent(ticketReferenceNumber)}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fetchTicketSourceData] HTTP error ${response.status}: ${errorText}`);
        setTicketSourceData(null);
        return;
      }

      const result = await response.json();
      console.log(`[fetchTicketSourceData] Response:`, result);

      if (result.ticketSource && Array.isArray(result.ticketSource) && result.ticketSource.length > 0) {
        const matchingTicket = result.ticketSource[0];
        console.log(`[fetchTicketSourceData] Found ticket:`, matchingTicket);
        setTicketSourceData({
          referenceid: matchingTicket.referenceid || '',
          date_created: matchingTicket.date_created || '',
          company_name: matchingTicket.company_name || '',
          contact_person: matchingTicket.contact_person || '',
          contact_number: matchingTicket.contact_number || '',
          email_address: matchingTicket.email_address || '',
          address: matchingTicket.address || '',
          inquiry: matchingTicket.inquiry || '',
          agent: matchingTicket.agent || '',
          wrap_up: matchingTicket.wrap_up || '',
          status: matchingTicket.status || ''
        });
      } else {
        console.log('[fetchTicketSourceData] No ticket source found');
        setTicketSourceData(null);
      }
    } catch (error) {
      console.error("[fetchTicketSourceData] Error:", error);
      setTicketSourceData(null);
    } finally {
      setIsLoadingTicketSource(false);
    }
  };

  // Fetch history records
  const fetchHistoryData = async (activityReferenceNumber: string) => {
    if (!activityReferenceNumber || activityReferenceNumber.trim() === '') {
      console.log('[fetchHistoryData] No activity reference number provided');
      setHistoryRecords([]);
      return;
    }

    setIsLoadingHistory(true);
    console.log(`[fetchHistoryData] Fetching for: ${activityReferenceNumber}`);

    try {
      const response = await fetch(`/api/fetch-history?activity_reference_number=${encodeURIComponent(activityReferenceNumber)}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fetchHistoryData] HTTP error ${response.status}: ${errorText}`);
        setHistoryRecords([]);
        return;
      }

      const result = await response.json();
      console.log(`[fetchHistoryData] Response:`, result);

      if (result.history && Array.isArray(result.history)) {
        const mappedHistory = result.history.map((h: any) => ({
          id: h.id || '',
          company_name: h.company_name || '',
          status: h.status || '',
          date_created: h.date_created || '',
          ticket_reference_number: h.ticket_reference_number || ''
        }));
        console.log(`[fetchHistoryData] Mapped ${mappedHistory.length} records`);
        setHistoryRecords(mappedHistory);
      } else {
        console.log('[fetchHistoryData] No history records found');
        setHistoryRecords([]);
      }
    } catch (error) {
      console.error("[fetchHistoryData] Error:", error);
      setHistoryRecords([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Open card-style edit dialog
  const handleEditClick = (activity: Activity) => {
    setEditingActivity(activity);
    setEditFormData({ ...activity });
    setTicketSourceData(null);
    setHistoryRecords([]);
    setShowEditDialog(true);

    if (activity.ticket_reference_number) {
      fetchTicketSourceData(activity.ticket_reference_number);
    }
    if (activity.activity_reference_number) {
      fetchHistoryData(activity.activity_reference_number);
    }
  };

  // Handle edit form change
  const handleEditFormChange = (field: keyof Activity, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  // Save edited activity
  const handleSaveEdit = async () => {
    if (!editingActivity || !editFormData) return;

    const { error } = await supabase
      .from("activity")
      .update(editFormData)
      .eq("id", editingActivity.id);

    if (error) {
      toast.error("Failed to update activity");
      return;
    }

    toast.success("Activity updated successfully");
    setShowEditDialog(false);
    setEditingActivity(null);
    await fetchActivities();
  };

  // Activity statistics for audit panel
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
        isFieldIncomplete('agent', act.agent),
        isFieldIncomplete('status', act.status),
      ].filter(Boolean).length;
      return incompleteFields > 0;
    }).length;

    return { total, received, endorsed, completed, incomplete };
  }, [activities]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = Object.keys(columnVisibility).filter(key => columnVisibility[key]);
    const csvContent = [
      headers.join(','),
      ...paginatedActivities.map(row => 
        headers.map(header => {
          const value = row[header as keyof Activity] || '';
          const stringValue = String(value);
          // Escape quotes and wrap in quotes if contains comma
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
    link.setAttribute('download', `activity-logs-${new Date().toISOString().split('T')[0]}.csv`);
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
      .from("activity")
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
    if (!value) return true; // Allow empty values
    
    switch (field) {
      case 'email_address':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'contact_number':
        return /^[0-9+\-\s()]*$/.test(value);
      default:
        return true;
    }
  };

  // Handle cell change with validation
  const handleCellChange = (id: string, field: string, value: string) => {
    if (!validateCell(field, value)) {
      toast.error(`Invalid ${field.replace(/_/g, ' ')}`);
      return;
    }
    
    setUnsavedChanges(prev => new Set([...prev, `${id}-${field}`]));
  };

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

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const { error } = await supabase
      .from("activity")
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
        if (deleteHoldTimerRef.current) {
          clearInterval(deleteHoldTimerRef.current);
          deleteHoldTimerRef.current = null;
        }
        handleBulkDelete();
      }
    }, 50);
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
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-4 bg-slate-700" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#" className="text-slate-400 hover:text-cyan-400">Taskflow</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-slate-600" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-cyan-400 font-medium">Activity Logs</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          {/* Toolbar */}
          <div className="flex flex-col gap-3 px-4 py-3 bg-slate-950">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              {/* Left: Search + Pagination */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search all fields..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-full bg-slate-900 border-slate-700 text-slate-300 focus:border-cyan-500/50 rounded-none h-9"
                  />
                  {isFetching && (
                    <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-cyan-400" />
                  )}
                </div>

                {/* Pagination */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPrevious}
                    disabled={page === 1}
                    className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 rounded-none h-8 px-2"
                  >
                    ←
                  </Button>
                  <span className="text-sm text-slate-400 min-w-[80px] text-center">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNext}
                    disabled={page === totalPages}
                    className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 rounded-none h-8 px-2"
                  >
                    →
                  </Button>
                </div>
              </div>

              {/* Right: Date Range + Filter + Actions */}
              <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
                {/* Date Range */}
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-32 bg-slate-900 border-slate-700 text-slate-300 focus:border-cyan-500/50 rounded-none h-9"
                    placeholder="From"
                  />
                  <span className="text-slate-500">-</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-32 bg-slate-900 border-slate-700 text-slate-300 focus:border-cyan-500/50 rounded-none h-9"
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

                <Separator orientation="vertical" className="h-6 bg-slate-700 hidden sm:block" />

                {/* Combined Filter Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilterDialog(true)}
                  className={`text-xs uppercase tracking-wider rounded-none h-9 ${showFilterDialog || referenceIdFilter || statusFilter ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400'}`}
                >
                  Filters {(referenceIdFilter || statusFilter) && '•'}
                </Button>

                {/* Export */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 text-xs uppercase tracking-wider rounded-none h-9"
                >
                  Export
                </Button>

                {selectedIds.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBulkEditDialog(true)}
                      className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20 text-xs uppercase tracking-wider rounded-none h-9"
                    >
                      Bulk Edit ({selectedIds.length})
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 text-xs uppercase tracking-wider rounded-none h-9"
                    >
                      Delete ({selectedIds.length})
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Card Grid */}
          <div className="overflow-hidden bg-slate-950 h-full">
            {isFetching ? (
              <div className="py-20 text-center flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                <span className="text-xs uppercase tracking-wider">Loading activities...</span>
              </div>
            ) : (
              <div className="max-h-[calc(100vh-300px)]">
                {/* Grid Header */}
                <div className="grid grid-cols-[40px_40px_1fr] gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
                  <div className="text-slate-300 font-medium text-xs">#</div>
                  <div className="text-slate-300 font-medium text-xs">
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
                  <div className="text-slate-300 font-medium text-xs">Activity Details</div>
                </div>

                {/* Grid Cards - 4 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
                  {paginatedActivities.length === 0 ? (
                    <div className="py-20 text-center text-slate-500 text-sm">
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
                              <span className="text-xs text-slate-500">#{(page - 1) * rowsPerPage + index + 1}</span>
                            </div>
                            {incompleteCount > 0 && (
                              <div className="flex items-center gap-1 text-red-400 text-xs">
                                <AlertCircle className="h-3 w-3" />
                                <span>{incompleteCount}</span>
                              </div>
                            )}
                          </div>

                          {/* Card Body */}
                          <div className="p-3 space-y-2">
                            {/* Activity Ref */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500 uppercase">Activity Ref</span>
                              <span className="text-xs text-cyan-400 font-medium">{act.activity_reference_number || '-'}</span>
                            </div>

                            {/* Ticket Ref */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500 uppercase">Ticket Ref</span>
                              <span className="text-xs text-slate-300">{act.ticket_reference_number || '-'}</span>
                            </div>

                            {/* Company */}
                            {columnVisibility.company_name && (
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs text-slate-500 uppercase">Company</span>
                                <span className={`text-xs text-right ${isFieldIncomplete('company_name', act.company_name) ? 'text-red-400' : 'text-slate-300'}`}>
                                  {act.company_name || '-'}
                                </span>
                              </div>
                            )}

                            {/* Contact */}
                            {columnVisibility.contact_person && (
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs text-slate-500 uppercase">Contact</span>
                                <span className={`text-xs text-right ${isFieldIncomplete('contact_person', act.contact_person) ? 'text-red-400' : 'text-slate-300'}`}>
                                  {act.contact_person || '-'}
                                </span>
                              </div>
                            )}

                            {/* Phone */}
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

                            {/* Address */}
                            {columnVisibility.address && (
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs text-slate-500 uppercase">Address</span>
                                <span className={`text-xs text-right ${isFieldIncomplete('address', act.address) ? 'text-red-400' : 'text-slate-300'}`}>
                                  {act.address || '-'}
                                </span>
                              </div>
                            )}

                            {/* Type Client */}
                            {columnVisibility.type_client && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 uppercase">Type</span>
                                <span className="text-xs text-slate-300">{act.type_client || '-'}</span>
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
                                <span className={`text-xs ${isFieldIncomplete('agent', act.agent) ? 'text-red-400' : 'text-slate-300'}`} title={agentMap[act.agent]?.name || act.agent}>
                                  {act.agent || '-'}
                                </span>
                              </div>
                            )}

                            {/* Date Created */}
                            {columnVisibility.date_created && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 uppercase">Date</span>
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
          </div>
          

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

          {/* Hold to Delete Dialog */}
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

          {/* 4-Column Edit Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-8xl w-[95vw] bg-slate-950 border-slate-800 rounded-none max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white uppercase tracking-wider text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-cyan-400" />
                  Edit Activity
                </DialogTitle>
              </DialogHeader>

              {editingActivity && (
                <div className="grid grid-cols-4 gap-6">
                  {/* COLUMN 1 - Counter Checking (Incomplete Data) */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-red-500/30 pb-2">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                      <h3 className="text-red-400 font-medium uppercase tracking-wider text-sm">Counter Checking</h3>
                      <span className="text-xs text-slate-500 ml-auto">
                        {[
                          'company_name', 'contact_person', 'contact_number', 'email_address',
                          'address', 'ticket_reference_number', 'agent', 'status'
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
                            Ticket Reference <span className="text-red-500">*</span>
                          </label>
                          <Input
                            value={editFormData.ticket_reference_number || ''}
                            onChange={(e) => handleEditFormChange('ticket_reference_number', e.target.value)}
                            className="bg-slate-900 border-red-500/30 text-slate-200 focus:border-red-400 rounded-none h-9"
                            placeholder="Enter ticket reference"
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

                      {!isFieldIncomplete('company_name', editingActivity.company_name) &&
                        !isFieldIncomplete('contact_person', editingActivity.contact_person) &&
                        !isFieldIncomplete('contact_number', editingActivity.contact_number) &&
                        !isFieldIncomplete('email_address', editingActivity.email_address) &&
                        !isFieldIncomplete('address', editingActivity.address) &&
                        !isFieldIncomplete('ticket_reference_number', editingActivity.ticket_reference_number) &&
                        !isFieldIncomplete('agent', editingActivity.agent) &&
                        !isFieldIncomplete('status', editingActivity.status) && (
                        <div className="text-emerald-400 text-sm flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          All fields are complete
                        </div>
                      )}
                    </div>
                  </div>

                  {/* COLUMN 2 - Complete Data */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-emerald-500/30 pb-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <h3 className="text-emerald-400 font-medium uppercase tracking-wider text-sm">Complete Data</h3>
                    </div>

                    <div className="space-y-3">
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
                            Ticket Reference <CheckCircle2 className="h-3 w-3" />
                          </label>
                          <Input
                            value={editFormData.ticket_reference_number || ''}
                            onChange={(e) => handleEditFormChange('ticket_reference_number', e.target.value)}
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
                    </div>
                  </div>

                  {/* COLUMN 3 - Ticket Source */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-cyan-500/30 pb-2">
                      <AlertCircle className="h-5 w-5 text-cyan-400" />
                      <h3 className="text-cyan-400 font-medium uppercase tracking-wider text-sm">Ticket Source</h3>
                    </div>

                    <div className="space-y-3">
                      {isLoadingTicketSource ? (
                        <div className="flex items-center gap-2 text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-xs">Loading ticket source...</span>
                        </div>
                      ) : ticketSourceData ? (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Reference ID</label>
                            <Input value={ticketSourceData.referenceid} disabled className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Date Created</label>
                            <Input value={new Date(ticketSourceData.date_created).toLocaleString()} disabled className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Company Name</label>
                            <Input value={ticketSourceData.company_name} disabled className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Contact Person</label>
                            <Input value={ticketSourceData.contact_person} disabled className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Contact Number</label>
                            <Input value={ticketSourceData.contact_number} disabled className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Email Address</label>
                            <Input value={ticketSourceData.email_address} disabled className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Address</label>
                            <Input value={ticketSourceData.address} disabled className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Inquiry</label>
                            <Input value={ticketSourceData.inquiry} disabled className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Agent</label>
                            <Input value={ticketSourceData.agent} disabled className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Wrap Up</label>
                            <Input value={ticketSourceData.wrap_up} disabled className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Status</label>
                            <Input value={ticketSourceData.status} disabled className="bg-slate-900/50 border-slate-700 text-slate-300 rounded-none h-9" />
                          </div>
                        </>
                      ) : (
                        <div className="text-slate-500 text-sm">No ticket source found</div>
                      )}
                    </div>
                  </div>

                  {/* COLUMN 4 - History Records */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-purple-500/30 pb-2">
                      <AlertCircle className="h-5 w-5 text-purple-400" />
                      <h3 className="text-purple-400 font-medium uppercase tracking-wider text-sm">History Records</h3>
                      <span className="text-xs text-slate-500 ml-auto">{historyRecords.length} records</span>
                    </div>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {isLoadingHistory ? (
                        <div className="flex items-center gap-2 text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-xs">Loading history...</span>
                        </div>
                      ) : historyRecords.length > 0 ? (
                        historyRecords.map((record) => (
                          <div key={record.id} className="bg-slate-900 border border-slate-800 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500 uppercase">Company</span>
                              <span className="text-xs text-slate-300">{record.company_name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500 uppercase">Status</span>
                              <span className={`text-xs px-2 py-0.5 ${record.status?.toLowerCase() === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : record.status?.toLowerCase() === 'pending'
                                    ? 'bg-yellow-500/10 text-yellow-400'
                                    : 'bg-slate-800 text-slate-300'
                                }`}>
                                {record.status || 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500 uppercase">Date</span>
                              <span className="text-xs text-slate-300">{new Date(record.date_created).toLocaleString()}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500 text-sm">No history records found</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 mt-6">
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

          {/* Bulk Edit Dialog */}
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
                    className="w-full mt-1 p-2 border border-slate-700 bg-slate-900 text-slate-300 rounded-none"
                  >
                    <option value="">Select a field</option>
                    <option value="tsm">TSM</option>
                    <option value="manager">Manager</option>
                    <option value="status">Status</option>
                    <option value="agent">Agent</option>
                    <option value="type_client">Type Client</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300">New Value</label>
                  <Input
                    value={bulkEditValue}
                    onChange={(e) => setBulkEditValue(e.target.value)}
                    className="mt-1 bg-slate-900 border-slate-700 text-slate-300 rounded-none"
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

          {/* Combined Filter Dialog */}
          <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
            <DialogContent className="max-w-2xl bg-slate-950 border-slate-800 rounded-none max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white uppercase tracking-wider text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-cyan-400" />
                  Filters & Options
                </DialogTitle>
              </DialogHeader>

              {/* Fetch More Alert Banner - Inside Dialog */}
              {activities.length < totalDbRows && (
                <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-cyan-400" />
                      <div>
                        <p className="text-sm text-cyan-400 font-medium">
                          Showing {activities.length.toLocaleString()} of {totalDbRows.toLocaleString()} records
                        </p>
                        <p className="text-xs text-slate-400">
                          {activities.length === 100
                            ? "Initial load: 100 records"
                            : `Fetched ${fetchLimit.toLocaleString()} rows`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleFetchMore();
                        setShowFilterDialog(false);
                      }}
                      className="bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-none"
                    >
                      {activities.length === 100
                        ? "Fetch more 2K"
                        : "Fetch more 5K"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6 py-4">
                {/* Left Column - Filters */}
                <div className="space-y-4">
                  <h3 className="text-xs font-medium text-cyan-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                    Filters
                  </h3>

                  {/* Reference ID Filter */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 uppercase tracking-wider">Filter by Reference ID</label>
                    <select
                      value={referenceIdFilter}
                      onChange={(e) => setReferenceIdFilter(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-300 rounded-none h-9 px-2 text-sm"
                    >
                      <option value="">All Reference IDs</option>
                      {referenceIdOptions.map((refId) => (
                        <option key={refId} value={refId}>{refId}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 uppercase tracking-wider">Filter by Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-300 rounded-none h-9 px-2 text-sm"
                    >
                      <option value="">All Statuses</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>

                  {/* Clear Filters */}
                  {(referenceIdFilter || statusFilter) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReferenceIdFilter("");
                        setStatusFilter("");
                      }}
                      className="w-full bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 rounded-none h-9"
                    >
                      Clear All Filters
                    </Button>
                  )}
                </div>

                {/* Right Column - Sorting & Page Length */}
                <div className="space-y-4">
                  <h3 className="text-xs font-medium text-cyan-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                    Sorting & Display
                  </h3>

                  {/* Sort Column */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 uppercase tracking-wider">Sort By</label>
                    <select
                      value={sortColumn}
                      onChange={(e) => setSortColumn(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-300 rounded-none h-9 px-2 text-sm"
                    >
                      <option value="date_created">Date Created</option>
                      <option value="referenceid">Reference ID</option>
                      <option value="company_name">Company Name</option>
                      <option value="contact_person">Contact Person</option>
                      <option value="status">Status</option>
                      <option value="agent">Agent</option>
                      <option value="ticket_reference_number">Ticket Reference</option>
                      <option value="activity_reference_number">Activity Reference</option>
                    </select>
                  </div>

                  {/* Sort Direction */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 uppercase tracking-wider">Sort Direction</label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSortDirection('asc')}
                        className={`flex-1 rounded-none h-9 ${sortDirection === 'asc' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                      >
                        ASC ↑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSortDirection('desc')}
                        className={`flex-1 rounded-none h-9 ${sortDirection === 'desc' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                      >
                        DESC ↓
                      </Button>
                    </div>
                  </div>

                  {/* Page Length */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 uppercase tracking-wider">Rows Per Page</label>
                    <div className="flex gap-2">
                      {[10, 20, 100, 500].map((num) => (
                        <Button
                          key={num}
                          variant="outline"
                          size="sm"
                          onClick={() => setRowsPerPage(num)}
                          className={`flex-1 rounded-none h-9 ${rowsPerPage === num ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                        >
                          {num}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Column Visibility Section */}
              <div className="space-y-3 border-t border-slate-800 pt-4">
                <h3 className="text-xs font-medium text-cyan-400 uppercase tracking-wider">
                  Column Visibility
                </h3>
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

              <DialogFooter className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowFilterDialog(false)}
                  className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400 rounded-none"
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
