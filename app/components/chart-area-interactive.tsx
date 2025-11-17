"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

interface ProgressRecord {
  id: string;
  referenceid: string;
  date_created: string; // ISO date string
  // ramConsumed removed because not used now
}

interface ActivityRecord {
  id: string;
  date_created: string; // ISO date string
  // count removed because not used now
}

const chartConfig = {
  progress: {
    label: "Progress Count",
    color: "var(--color-desktop)",
  },
  activity: {
    label: "Activity Count",
    color: "var(--color-mobile)",
  },
} satisfies ChartConfig;

// Helper to count unique IDs per day
function countDistinctIdsByDate<T>(
  records: T[],
  getDate: (r: T) => string,
  getId: (r: T) => string
): Record<string, number> {
  const map: Record<string, Set<string>> = {};

  records.forEach((record) => {
    const dateStrRaw = getDate(record);
    const dateStr = typeof dateStrRaw === "string" ? dateStrRaw.slice(0, 10) : "";
    if (!dateStr) return;

    if (!map[dateStr]) map[dateStr] = new Set();
    map[dateStr].add(getId(record));
  });

  const result: Record<string, number> = {};
  for (const date in map) {
    result[date] = map[date].size;
  }
  return result;
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("90d");

  const [progressRecords, setProgressRecords] = React.useState<ProgressRecord[]>([]);
  const [activityRecords, setActivityRecords] = React.useState<ActivityRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  React.useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [progressRes, activityRes] = await Promise.all([
          fetch("/api/Data/Applications/Taskflow/Progress/Fetch"),
          fetch("/api/Data/Applications/Taskflow/Activity/Fetch"),
        ]);
        if (!progressRes.ok) throw new Error("Failed to fetch progress data");
        if (!activityRes.ok) throw new Error("Failed to fetch activity data");

        const progressData: ProgressRecord[] = await progressRes.json();
        const activityData: ActivityRecord[] = await activityRes.json();

        setProgressRecords(
          Array.isArray(progressData)
            ? progressData
            : (progressData && Array.isArray((progressData as any).data))
            ? (progressData as any).data
            : []
        );
        setActivityRecords(
          Array.isArray(activityData)
            ? activityData
            : (activityData && typeof activityData === "object" && "data" in activityData && Array.isArray((activityData as any).data))
            ? (activityData as any).data
            : []
        );
      } catch (err: any) {
        setError(err.message || "Error fetching data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Count unique IDs per day for progress and activity
  const progressCountByDate = countDistinctIdsByDate(
    progressRecords,
    (r) => r.date_created,
    (r) => r.id
  );

  const activityCountByDate = countDistinctIdsByDate(
    activityRecords,
    (r) => r.date_created,
    (r) => r.id
  );

  // Combine all dates found in either dataset to form full timeline
  const allDatesSet = new Set<string>([
    ...Object.keys(progressCountByDate),
    ...Object.keys(activityCountByDate),
  ]);
  const allDates = Array.from(allDatesSet).sort();

  // Filter by timeRange
  const referenceDate = new Date(allDates[allDates.length - 1] || new Date().toISOString());
  let daysToSubtract = 90;
  if (timeRange === "30d") daysToSubtract = 30;
  else if (timeRange === "7d") daysToSubtract = 7;

  const startDate = new Date(referenceDate);
  startDate.setDate(referenceDate.getDate() - daysToSubtract);

  // Filter dates in range
  const filteredDates = allDates.filter((dateStr) => {
    const d = new Date(dateStr);
    return d >= startDate && d <= referenceDate;
  });

  // Prepare chart data array
  const filteredData = filteredDates.map((dateStr) => ({
    date: dateStr,
    progress: progressCountByDate[dateStr] || 0,
    activity: activityCountByDate[dateStr] || 0,
  }));

  if (loading) {
    return <div className="p-4 text-center">Loading chart data...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-600">Error: {error}</div>;
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Taskflow Progress & Activity</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Combined Progress and Activity counts (Unique IDs)
          </span>
          <span className="@[540px]/card:hidden">Combined counts</span>
        </CardDescription>
        <ToggleGroup
          type="single"
          value={timeRange}
          onValueChange={setTimeRange}
          variant="outline"
          className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
        >
          <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
          <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
          <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
        </ToggleGroup>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Last 3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              Last 3 months
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillProgress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-desktop)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-desktop)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillActivity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-mobile)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-mobile)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="progress"
              type="natural"
              fill="url(#fillProgress)"
              stroke="var(--color-desktop)"
              stackId="a"
            />
            <Area
              dataKey="activity"
              type="natural"
              fill="url(#fillActivity)"
              stroke="var(--color-mobile)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
