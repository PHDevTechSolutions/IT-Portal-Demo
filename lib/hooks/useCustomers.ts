"use client";

/**
 * Customer Database Hooks with React Query
 * 
 * Provides automatic caching and background refetching for customer data.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Query keys for caching
export const customerKeys = {
  all: ["customers"] as const,
  lists: () => [...customerKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...customerKeys.lists(), filters] as const,
  details: () => [...customerKeys.all, "detail"] as const,
  detail: (id: number) => [...customerKeys.details(), id] as const,
  stats: () => [...customerKeys.all, "stats"] as const,
};

// Types
interface Customer {
  id: number;
  account_reference_number: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  region: string;
  type_client: string;
  referenceid: string;
  tsm: string;
  manager: string;
  status: string;
  remarks: string;
  date_created: string;
  date_updated: string;
  next_available_date?: string;
}

// Fetch customers with caching - only Active status
async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch(
    "/api/Data/Applications/Taskflow/CustomerDatabase/Fetch",
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch customers");
  const data = await res.json();
  const allCustomers = Array.isArray(data) ? data : data.data ?? [];
  
  // Filter only Active customers (case-insensitive)
  return allCustomers.filter((c: Customer) => 
    c.status?.toLowerCase() === "active"
  );
}

// Hook to get customers with automatic caching
export function useCustomers() {
  return useQuery({
    queryKey: customerKeys.lists(),
    queryFn: fetchCustomers,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

// Hook for bulk delete with cache invalidation
export function useBulkDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch(
        "/api/Data/Applications/Taskflow/CustomerDatabase/BulkDelete",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: ids.map(String) }),
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Delete failed");
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch customers after delete
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success("Customers deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete customers");
    },
  });
}

// Hook for bulk transfer with cache invalidation
export function useBulkTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userIds,
      type,
      targetId,
    }: {
      userIds: string[];
      type: string;
      targetId: string;
    }) => {
      const res = await fetch(
        "/api/Data/Applications/Taskflow/CustomerDatabase/BulkTransfer",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds, type, targetId }),
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Transfer failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success("Transfer completed successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to transfer customers");
    },
  });
}

// Hook for update reference numbers with cache invalidation
export function useUpdateReferenceNumbers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updates: { id: number; account_reference_number: string }[]
    ) => {
      const res = await fetch(
        "/api/Data/Applications/Taskflow/CustomerDatabase/UpdateReferenceNumber",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Update failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success("Reference numbers updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update reference numbers");
    },
  });
}

// Hook for importing customers with cache invalidation
export function useImportCustomers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      referenceid,
      tsm,
      data,
    }: {
      referenceid: string;
      tsm: string;
      data: unknown[];
    }) => {
      const res = await fetch(
        "/api/Data/Applications/Taskflow/CustomerDatabase/Import",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referenceid, tsm, data }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Import failed");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success("Import completed successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to import customers");
    },
  });
}
