"use client";

/**
 * DashboardDataContext
 * 
 * Provides shared data fetching for dashboard components to avoid redundant API calls.
 * Fetches all dashboard data once and shares it with SectionCards and ChartAreaInteractive.
 */

import React, { createContext, useContext, useState, useEffect } from "react";

interface CustomerRecord {
  _id: string;
  date_created: string;
}

interface UserRecord {
  _id: string;
  createdAt: string;
}

interface ProgressRecord {
  _id: string;
  referenceid: string;
  date: string;
  ramConsumed: number;
}

interface ActivityRecord {
  _id: string;
  date_created: string;
}

interface DashboardData {
  allRecords: CustomerRecord[];
  userRecords: UserRecord[];
  progressRecords: ProgressRecord[];
  activityRecords: ActivityRecord[];
}

interface DashboardDataContextType {
  data: DashboardData;
  loading: {
    records: boolean;
    users: boolean;
    progress: boolean;
    activity: boolean;
  };
  errors: {
    records: string | null;
    users: string | null;
    progress: string | null;
    activity: string | null;
  };
  refetch: () => void;
  dateRange: string;
  setDateRange: (range: string) => void;
}

const defaultData: DashboardData = {
  allRecords: [],
  userRecords: [],
  progressRecords: [],
  activityRecords: [],
};

const DashboardDataContext = createContext<DashboardDataContextType | undefined>(undefined);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DashboardData>(defaultData);
  const [loading, setLoading] = useState({
    records: true,
    users: true,
    progress: true,
    activity: true,
  });
  const [errors, setErrors] = useState({
    records: null as string | null,
    users: null as string | null,
    progress: null as string | null,
    activity: null as string | null,
  });
  const [dateRange, setDateRange] = useState<string>("90"); // Default: last 90 days (3 months)

  const fetchAllData = async () => {
    // Reset loading states
    setLoading({
      records: true,
      users: true,
      progress: true,
      activity: true,
    });
    setErrors({
      records: null,
      users: null,
      progress: null,
      activity: null,
    });

    // Convert dateRange (90d, 30d, 7d) to days number
    const days = parseInt(dateRange) || 90;
    
    // Fetch all data in parallel with date range filtering for chart data
    const [recordsRes, usersRes, progressRes, activityRes] = await Promise.allSettled([
      fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Fetch"),
      fetch("/api/Dashboard/FetchUser"),
      fetch(`/api/fetch-progress?days=${days}`),
      fetch(`/api/fetch-activity?days=${days}`),
    ]);

    // Process records
    if (recordsRes.status === "fulfilled" && recordsRes.value.ok) {
      try {
        const json = await recordsRes.value.json();
        setData((prev) => ({
          ...prev,
          allRecords: Array.isArray(json) ? json : json.data ?? [],
        }));
      } catch (err) {
        setErrors((prev) => ({ ...prev, records: "Failed to parse data" }));
      }
    } else {
      setErrors((prev) => ({ ...prev, records: "Failed to fetch records" }));
    }
    setLoading((prev) => ({ ...prev, records: false }));

    // Process users
    if (usersRes.status === "fulfilled" && usersRes.value.ok) {
      try {
        const json = await usersRes.value.json();
        setData((prev) => ({
          ...prev,
          userRecords: Array.isArray(json) ? json : json.data ?? [],
        }));
      } catch (err) {
        setErrors((prev) => ({ ...prev, users: "Failed to parse data" }));
      }
    } else {
      setErrors((prev) => ({ ...prev, users: "Failed to fetch users" }));
    }
    setLoading((prev) => ({ ...prev, users: false }));

    // Process progress
    if (progressRes.status === "fulfilled") {
      if (progressRes.value.ok) {
        try {
          const json = await progressRes.value.json();
          console.log("[DashboardDataContext] Progress fetched:", json.activities?.length || 0, "records");
          setData((prev) => ({
            ...prev,
            progressRecords: Array.isArray(json.activities) ? json.activities : [],
          }));
          setErrors((prev) => ({ ...prev, progress: null }));
        } catch (err) {
          console.error("[DashboardDataContext] Failed to parse progress data:", err);
          setErrors((prev) => ({ ...prev, progress: "Failed to parse progress data" }));
        }
      } else {
        try {
          const errorJson = await progressRes.value.json();
          console.error("[DashboardDataContext] Progress API error:", errorJson);
          setErrors((prev) => ({ ...prev, progress: errorJson.message || "Failed to fetch progress" }));
        } catch {
          setErrors((prev) => ({ ...prev, progress: "Failed to fetch progress" }));
        }
      }
    } else {
      console.error("[DashboardDataContext] Progress fetch rejected:", progressRes.reason);
      setErrors((prev) => ({ ...prev, progress: "Failed to fetch progress" }));
    }
    setLoading((prev) => ({ ...prev, progress: false }));

    // Process activity
    if (activityRes.status === "fulfilled") {
      if (activityRes.value.ok) {
        try {
          const json = await activityRes.value.json();
          console.log("[DashboardDataContext] Activity fetched:", json.activities?.length || 0, "records");
          setData((prev) => ({
            ...prev,
            activityRecords: Array.isArray(json.activities) ? json.activities : [],
          }));
          setErrors((prev) => ({ ...prev, activity: null }));
        } catch (err) {
          console.error("[DashboardDataContext] Failed to parse activity data:", err);
          setErrors((prev) => ({ ...prev, activity: "Failed to parse activity data" }));
        }
      } else {
        try {
          const errorJson = await activityRes.value.json();
          console.error("[DashboardDataContext] Activity API error:", errorJson);
          setErrors((prev) => ({ ...prev, activity: errorJson.message || "Failed to fetch activity" }));
        } catch {
          setErrors((prev) => ({ ...prev, activity: "Failed to fetch activity" }));
        }
      }
    } else {
      console.error("[DashboardDataContext] Activity fetch rejected:", activityRes.reason);
      setErrors((prev) => ({ ...prev, activity: "Failed to fetch activity" }));
    }
    setLoading((prev) => ({ ...prev, activity: false }));
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const refetch = () => {
    fetchAllData();
  };

  // Refetch when dateRange changes (for progress/activity chart data)
  useEffect(() => {
    // Only refetch if not initial load (data already exists)
    if (data.progressRecords.length > 0 || data.activityRecords.length > 0) {
      fetchAllData();
    }
  }, [dateRange]);

  return (
    <DashboardDataContext.Provider value={{ data, loading, errors, refetch, dateRange, setDateRange }}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (context === undefined) {
    throw new Error("useDashboardData must be used within a DashboardDataProvider");
  }
  return context;
}
