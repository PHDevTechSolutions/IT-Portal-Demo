"use client";

import { useEffect, useCallback, useRef } from "react";
import {
  notifyNewCustomer,
  notifyBulkActivities,
  notifyBulkProgress,
} from "@/lib/services/notifications";

// Hook to monitor customer database changes and send notifications
export function useCustomerNotifications() {
  const lastChecked = useRef<Date>(new Date());

  const checkNewCustomers = useCallback(async () => {
    try {
      // Fetch recent customers from API using GET
      const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/FetchNonActive", {
        method: "GET",
        cache: "no-store",
      });
      
      // Handle non-OK responses gracefully
      if (!res.ok) {
        console.warn("[useCustomerNotifications] API returned non-OK status:", res.status);
        return;
      }
      
      // Check if response has content before parsing
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("[useCustomerNotifications] Response is not JSON");
        return;
      }
      
      const text = await res.text();
      if (!text || text.trim() === "") {
        console.warn("[useCustomerNotifications] Empty response");
        return;
      }
      
      const data = JSON.parse(text);
      
      if (data.success && data.data && data.data.length > 0) {
        // Notify about the most recent customer added
        const newestCustomer = data.data[0];
        await notifyNewCustomer({
          id: newestCustomer._id || newestCustomer.id || "unknown",
          companyName: newestCustomer.companyname || newestCustomer.CompanyName || "Unknown",
          createdBy: newestCustomer.created_by || newestCustomer.Created_By || "System",
          createdAt: newestCustomer.date_created || new Date().toISOString(),
        });
      }
      
      lastChecked.current = new Date();
    } catch (error) {
      console.error("[useCustomerNotifications] Error checking new customers:", error);
    }
  }, []);

  // Check every 5 minutes
  useEffect(() => {
    checkNewCustomers();
    const interval = setInterval(checkNewCustomers, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkNewCustomers]);

  return { checkNewCustomers };
}

// Hook to monitor taskflow activity logs
export function useActivityNotifications() {
  const lastBatchRef = useRef<any[]>([]);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addToBatch = useCallback((activity: any) => {
    lastBatchRef.current.push(activity);
    
    // Clear existing timer
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }
    
    // Set new timer to send batch notification after 30 seconds
    batchTimerRef.current = setTimeout(() => {
      if (lastBatchRef.current.length > 0) {
        const batch = [...lastBatchRef.current];
        lastBatchRef.current = [];
        
        // Send bulk notification
        notifyBulkActivities(
          batch.map((a) => ({
            id: a._id || a.id,
            type: a.type || a.activity_type || "Activity",
            companyName: a.companyname || a.CompanyName || "Unknown",
            createdBy: a.created_by || a.Created_By || "System",
          }))
        ).catch(console.error);
      }
    }, 30000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  return { addToBatch };
}

// Hook to monitor taskflow progress updates
export function useProgressNotifications() {
  const lastBatchRef = useRef<any[]>([]);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addToBatch = useCallback((progress: any) => {
    lastBatchRef.current.push(progress);
    
    // Clear existing timer
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }
    
    // Set new timer to send batch notification after 30 seconds
    batchTimerRef.current = setTimeout(() => {
      if (lastBatchRef.current.length > 0) {
        const batch = [...lastBatchRef.current];
        lastBatchRef.current = [];
        
        // Send bulk notification
        notifyBulkProgress(
          batch.map((p) => ({
            id: p._id || p.id,
            companyName: p.companyname || p.CompanyName || "Unknown",
            status: p.status || p.progress_status || "Updated",
            updatedBy: p.updated_by || p.Updated_By || "System",
          }))
        ).catch(console.error);
      }
    }, 30000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  return { addToBatch };
}

// Combined hook that starts all notification monitoring
export function useGlobalNotifications() {
  const { checkNewCustomers } = useCustomerNotifications();
  
  useEffect(() => {
    // Initial check
    checkNewCustomers();
    
    // Set up interval for customer monitoring
    const customerInterval = setInterval(checkNewCustomers, 5 * 60 * 1000);
    
    return () => {
      clearInterval(customerInterval);
    };
  }, [checkNewCustomers]);

  return {
    useCustomerNotifications,
    useActivityNotifications,
    useProgressNotifications,
  };
}
