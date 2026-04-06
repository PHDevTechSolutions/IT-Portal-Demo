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

    // Fetch all data in parallel
    const [recordsRes, usersRes, progressRes, activityRes] = await Promise.allSettled([
      fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Fetch"),
      fetch("/api/Dashboard/FetchUser"),
      fetch("/api/fetch-progress"),
      fetch("/api/fetch-activity"),
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
    if (progressRes.status === "fulfilled" && progressRes.value.ok) {
      try {
        const json = await progressRes.value.json();
        setData((prev) => ({
          ...prev,
          progressRecords: Array.isArray(json.activities) ? json.activities : [],
        }));
      } catch (err) {
        setErrors((prev) => ({ ...prev, progress: "Failed to parse data" }));
      }
    } else {
      setErrors((prev) => ({ ...prev, progress: "Failed to fetch progress" }));
    }
    setLoading((prev) => ({ ...prev, progress: false }));

    // Process activity
    if (activityRes.status === "fulfilled" && activityRes.value.ok) {
      try {
        const json = await activityRes.value.json();
        setData((prev) => ({
          ...prev,
          activityRecords: Array.isArray(json.activities) ? json.activities : [],
        }));
      } catch (err) {
        setErrors((prev) => ({ ...prev, activity: "Failed to parse data" }));
      }
    } else {
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

  return (
    <DashboardDataContext.Provider value={{ data, loading, errors, refetch }}>
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
