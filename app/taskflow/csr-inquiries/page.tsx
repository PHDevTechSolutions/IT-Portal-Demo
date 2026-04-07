"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
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
  const [focusedCell, setFocusedCell] = useState<{rowId: string, field: string} | null>(null);

  // Bulk edit
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<string>("");
  const [bulkEditValue, setBulkEditValue] = useState("");

  // Save indicator
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());

  // Agent list and user details states
  const [agents, setAgents] = useState<Agent[]>([]);

  // Fetch activities from supabase
  const fetchActivities = async () => {
    setIsFetching(true);

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

    // Order by date_created descending (latest first) and limit to 1000
    const { data, error } = await query
      .order("date_created", { ascending: false })
      .limit(1000);

    if (error) {
      toast.error(`Error fetching activities: ${error.message}`);
      setActivities([]);
    } else {
      setActivities(data || []);
    }
    setIsFetching(false);
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [dateFrom, dateTo]);

  const filteredActivities = useMemo(() => {
    if (!search.trim()) return activities;

    const lowerSearch = search.toLowerCase();

    return activities.filter((act) =>
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
  }, [activities, search]);

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
    fetchActivities();
  };

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {/* Header */}
          <header className="flex h-auto min-h-[56px] items-center gap-2 px-2 md:px-4 py-2 flex-wrap">
            <SidebarTrigger className="-ml-1 touch-button" />
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
              Home
            </Button>
            <Separator orientation="vertical" className="h-4 hidden sm:block" />
            <Breadcrumb className="hidden sm:flex">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Taskflow</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Endorsed Ticket</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
            {/* Search */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-full"
              />
              {isFetching && (
                <Loader2 className="absolute right-2 top-2.5 size-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full sm:w-auto"
                placeholder="From"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full sm:w-auto"
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
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="flex items-center gap-2"
              >
                Export CSV
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="flex items-center gap-2"
              >
                Columns
              </Button>

              {selectedIds.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkEditDialog(true)}
                >
                  Bulk Edit ({selectedIds.length})
                </Button>
              )}

              {selectedIds.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete ({selectedIds.length})
                </Button>
              )}
            </div>
          </div>

          {/* Column Visibility Menu */}
          {showColumnMenu && (
            <div className="mx-4 p-4 border border-border rounded-lg bg-background shadow-sm">
              <div className="grid grid-cols-4 gap-2">
                {Object.keys(columnVisibility).map(column => (
                  <label key={column} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={columnVisibility[column]}
                      onChange={() => toggleColumnVisibility(column)}
                    />
                    <span className="capitalize">{column.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="mx-4 border border-border shadow-sm rounded-lg overflow-hidden">
            {isFetching ? (
              <div className="py-10 text-center flex flex-col items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="size-6 animate-spin" />
                <span>Loading activities...</span>
              </div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-300px)]">
                <Table className="min-w-[2000px] w-full text-sm whitespace-nowrap">
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-10 bg-background sticky left-0 z-20">#</TableHead>
                      <TableHead className="w-10 bg-background sticky left-10 z-20">
                        <input
                          type="checkbox"
                          checked={
                            paginatedActivities.length > 0 &&
                            paginatedActivities.every((a) => selectedIds.includes(a.id))
                          }
                          onChange={toggleSelectAll}
                        />
                      </TableHead>
                      {columnVisibility.referenceid && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted sticky left-20 z-20"
                          onClick={() => handleSort('referenceid')}
                        >
                          Ref ID {sortColumn === 'referenceid' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.tsm && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('tsm')}
                        >
                          TSM {sortColumn === 'tsm' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.company_name && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('company_name')}
                        >
                          Company Name {sortColumn === 'company_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.contact_person && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('contact_person')}
                        >
                          Contact Person {sortColumn === 'contact_person' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.contact_number && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('contact_number')}
                        >
                          Contact Number {sortColumn === 'contact_number' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.email_address && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('email_address')}
                        >
                          Email {sortColumn === 'email_address' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.address && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('address')}
                        >
                          Address {sortColumn === 'address' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.ticket_reference_number && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('ticket_reference_number')}
                        >
                          Ticket Ref # {sortColumn === 'ticket_reference_number' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.wrap_up && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('wrap_up')}
                        >
                          Wrap Up {sortColumn === 'wrap_up' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.inquiry && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('inquiry')}
                        >
                          Inquiry {sortColumn === 'inquiry' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.agent && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('agent')}
                        >
                          Agent {sortColumn === 'agent' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.status && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('status')}
                        >
                          Status {sortColumn === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.date_created && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('date_created')}
                        >
                          Date Created {sortColumn === 'date_created' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                      {columnVisibility.date_updated && (
                        <TableHead 
                          className="bg-background cursor-pointer hover:bg-muted"
                          onClick={() => handleSort('date_updated')}
                        >
                          Date Updated {sortColumn === 'date_updated' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>

                <TableBody>
                  {paginatedActivities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={16} className="text-center">
                        No activities found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedActivities.map((act, index) => (
                      <TableRow 
                        key={act.id}
                        className={`
                          ${act.status === 'completed' || act.status === 'resolved' ? 'bg-green-50' : ''}
                          ${act.status === 'pending' || act.status === 'open' ? 'bg-yellow-50' : ''}
                          ${act.status === 'cancelled' || act.status === 'closed' ? 'bg-red-50' : ''}
                        `}
                      >
                        <TableCell className="sticky left-0 bg-background z-20">
                          {(page - 1) * ROWS_PER_PAGE + index + 1}
                        </TableCell>
                        <TableCell className="sticky left-10 bg-background z-20">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(act.id)}
                            onChange={() => toggleSelect(act.id)}
                          />
                        </TableCell>

                        {columnVisibility.referenceid && (
                          <TableCell className="sticky left-20 bg-background z-20">
                            <Input
                              defaultValue={act.referenceid || ""}
                              onBlur={(e) => handleInlineUpdate(act.id, "referenceid", e.target.value)}
                              onChange={(e) => handleCellChange(act.id, "referenceid", e.target.value)}
                              className={`h-8 text-xs ${unsavedChanges.has(`${act.id}-referenceid`) ? 'border-yellow-500 bg-yellow-50' : ''}`}
                            />
                          </TableCell>
                        )}

                        {columnVisibility.tsm && (
                          <TableCell>
                            <Input
                              defaultValue={act.tsm || ""}
                              onBlur={(e) => handleInlineUpdate(act.id, "tsm", e.target.value)}
                              onChange={(e) => handleCellChange(act.id, "tsm", e.target.value)}
                              className={`h-8 text-xs ${unsavedChanges.has(`${act.id}-tsm`) ? 'border-yellow-500 bg-yellow-50' : ''}`}
                            />
                          </TableCell>
                        )}

                        {columnVisibility.company_name && (
                          <TableCell>
                            <Input
                              defaultValue={act.company_name || ""}
                              onBlur={(e) => handleInlineUpdate(act.id, "company_name", e.target.value)}
                              onChange={(e) => handleCellChange(act.id, "company_name", e.target.value)}
                              className={`h-8 text-xs ${unsavedChanges.has(`${act.id}-company_name`) ? 'border-yellow-500 bg-yellow-50' : ''}`}
                            />
                          </TableCell>
                        )}

                        {columnVisibility.contact_person && (
                          <TableCell>
                            <Input
                              defaultValue={act.contact_person || ""}
                              onBlur={(e) => handleInlineUpdate(act.id, "contact_person", e.target.value)}
                              onChange={(e) => handleCellChange(act.id, "contact_person", e.target.value)}
                              className={`h-8 text-xs ${unsavedChanges.has(`${act.id}-contact_person`) ? 'border-yellow-500 bg-yellow-50' : ''}`}
                            />
                          </TableCell>
                        )}

                        {columnVisibility.contact_number && (
                          <TableCell>
                            <Input
                              defaultValue={act.contact_number || ""}
                              onBlur={(e) => handleInlineUpdate(act.id, "contact_number", e.target.value)}
                              onChange={(e) => handleCellChange(act.id, "contact_number", e.target.value)}
                              className={`h-8 text-xs ${unsavedChanges.has(`${act.id}-contact_number`) ? 'border-yellow-500 bg-yellow-50' : ''}`}
                            />
                          </TableCell>
                        )}

                        {columnVisibility.email_address && (
                          <TableCell>
                            <Input
                              defaultValue={act.email_address || ""}
                              onBlur={(e) => handleInlineUpdate(act.id, "email_address", e.target.value)}
                              onChange={(e) => handleCellChange(act.id, "email_address", e.target.value)}
                              className={`h-8 text-xs ${unsavedChanges.has(`${act.id}-email_address`) ? 'border-yellow-500 bg-yellow-50' : ''}`}
                            />
                          </TableCell>
                        )}

                        {columnVisibility.address && (
                          <TableCell>
                            <Input
                              defaultValue={act.address || ""}
                              onBlur={(e) => handleInlineUpdate(act.id, "address", e.target.value)}
                              onChange={(e) => handleCellChange(act.id, "address", e.target.value)}
                              className={`h-8 text-xs ${unsavedChanges.has(`${act.id}-address`) ? 'border-yellow-500 bg-yellow-50' : ''}`}
                            />
                          </TableCell>
                        )}

                        {columnVisibility.ticket_reference_number && (
                          <TableCell>
                            <Input
                              defaultValue={act.ticket_reference_number || ""}
                              onBlur={(e) => handleInlineUpdate(act.id, "ticket_reference_number", e.target.value)}
                              onChange={(e) => handleCellChange(act.id, "ticket_reference_number", e.target.value)}
                              className={`h-8 text-xs ${unsavedChanges.has(`${act.id}-ticket_reference_number`) ? 'border-yellow-500 bg-yellow-50' : ''}`}
                            />
                          </TableCell>
                        )}

                        {columnVisibility.wrap_up && (
                          <TableCell>
                            <Input
                              defaultValue={act.wrap_up || ""}
                              onBlur={(e) => handleInlineUpdate(act.id, "wrap_up", e.target.value)}
                              onChange={(e) => handleCellChange(act.id, "wrap_up", e.target.value)}
                              className={`h-8 text-xs ${unsavedChanges.has(`${act.id}-wrap_up`) ? 'border-yellow-500 bg-yellow-50' : ''}`}
                            />
                          </TableCell>
                        )}

                        {columnVisibility.inquiry && (
                          <TableCell>
                            <Input
                              defaultValue={act.inquiry || ""}
                              onBlur={(e) => handleInlineUpdate(act.id, "inquiry", e.target.value)}
                              onChange={(e) => handleCellChange(act.id, "inquiry", e.target.value)}
                              className={`h-8 text-xs ${unsavedChanges.has(`${act.id}-inquiry`) ? 'border-yellow-500 bg-yellow-50' : ''}`}
                            />
                          </TableCell>
                        )}

                        {columnVisibility.agent && (
                          <TableCell>
                            <Input
                              defaultValue={act.agent || ""}
                              onBlur={(e) => handleInlineUpdate(act.id, "agent", e.target.value)}
                              onChange={(e) => handleCellChange(act.id, "agent", e.target.value)}
                              className={`h-8 text-xs ${unsavedChanges.has(`${act.id}-agent`) ? 'border-yellow-500 bg-yellow-50' : ''}`}
                            />
                          </TableCell>
                        )}

                        {columnVisibility.status && (
                          <TableCell>
                            <Input
                              defaultValue={act.status || ""}
                              onBlur={(e) => handleInlineUpdate(act.id, "status", e.target.value)}
                              onChange={(e) => handleCellChange(act.id, "status", e.target.value)}
                              className={`h-8 text-xs ${unsavedChanges.has(`${act.id}-status`) ? 'border-yellow-500 bg-yellow-50' : ''}`}
                            />
                          </TableCell>
                        )}

                        {columnVisibility.date_created && (
                          <TableCell>{formatDate(act.date_created)}</TableCell>
                        )}

                        {columnVisibility.date_updated && (
                          <TableCell>{formatDate(act.date_updated)}</TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center gap-4 my-4">
            <Button variant="outline" onClick={goToPrevious} disabled={page === 1}>
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" onClick={goToNext} disabled={page === totalPages}>
              Next
            </Button>
          </div>

          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Confirm Delete</DialogTitle>
              </DialogHeader>

              <p className="text-sm">
                Are you sure you want to delete{" "}
                <strong>{selectedIds.length}</strong> selected activities?
                This action cannot be undone.
              </p>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleBulkDelete}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Bulk Edit</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Field to Edit</label>
                  <select
                    value={bulkEditField}
                    onChange={(e) => setBulkEditField(e.target.value)}
                    className="w-full mt-1 p-2 border rounded"
                  >
                    <option value="">Select a field</option>
                    <option value="tsm">TSM</option>
                    <option value="status">Status</option>
                    <option value="agent">Agent</option>
                    <option value="wrap_up">Wrap Up</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">New Value</label>
                  <Input
                    value={bulkEditValue}
                    onChange={(e) => setBulkEditValue(e.target.value)}
                    className="mt-1"
                    placeholder="Enter new value"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBulkEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkEdit} disabled={!bulkEditField || !bulkEditValue}>
                  Update {selectedIds.length} Rows
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}
