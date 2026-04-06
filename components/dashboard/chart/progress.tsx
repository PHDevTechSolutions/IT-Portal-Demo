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

import { useDashboardData } from "@/contexts/DashboardDataContext";

interface ProgressRecord {
  _id: string;
  referenceid: string;
  date: string;
}

interface ActivityRecord {
  _id: string;
  date_created: string; // ISO date string
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
  const { data, loading, errors } = useDashboardData();
  const progressRecords = data.progressRecords;
  const activityRecords = data.activityRecords;
  const loadingCombined = loading.progress || loading.activity;
  const errorCombined = errors.progress || errors.activity;

  // Detect dark mode by observing class on <html>
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const htmlEl = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(htmlEl.classList.contains("dark"));
    });
    observer.observe(htmlEl, { attributes: true, attributeFilter: ["class"] });

    // Initial check
    setIsDark(htmlEl.classList.contains("dark"));

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  // Utility to get CSS variable value (H S L components)
  const getCssVar = (name: string) =>
    typeof window !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
      : "";

  // Convert CSS variable components to hsl(...) string or fallback
  const getCssVarHsl = (name: string, fallback: string) => {
    const val = getCssVar(name);
    return val ? `hsl(${val})` : fallback;
  };

  // Memoize colors so they update on dark mode toggle
  const chartColors = React.useMemo(
    () => ({
      axisLine: getCssVarHsl("--chart-axis-line", isDark ? "#ddd" : "#666"),
      tickColor: getCssVarHsl("--chart-tick-color", isDark ? "#ddd" : "#666"),
      gridLine: getCssVarHsl("--chart-grid-line", isDark ? "#444" : "#ddd"),
      tooltipBg: getCssVarHsl("--chart-tooltip-bg", isDark ? "#222" : "#fff"),
      tooltipColor: getCssVarHsl("--chart-tooltip-color", isDark ? "#eee" : "#000"),
      background: getCssVarHsl("--chart-background", isDark ? "#121212" : "#fff"),
      progressColor: getCssVarHsl("--color-desktop", isDark ? "#65def1" : "#1e40af"),
      activityColor: getCssVarHsl("--color-mobile", isDark ? "#65def1" : "#059669"),
    }),
    [isDark]
  );

  // Count unique IDs per day
  const progressCountByDate = countDistinctIdsByDate(
    progressRecords as ProgressRecord[],
    (r) => (r as any).date_created || (r as any).date || "",
    (r) => (r as any)._id || (r as any).id || ""
  );

  const activityCountByDate = countDistinctIdsByDate(
    activityRecords as ActivityRecord[],
    (r) => (r as any).date_created || (r as any).date || "",
    (r) => (r as any)._id || (r as any).id || ""
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

  if (loadingCombined) {
    return <div className="p-4 text-center">Loading chart data...</div>;
  }

  if (errorCombined) {
    return <div className="p-4 text-center text-red-600">Error: {errorCombined}</div>;
  }

  return (
    <Card className="@container/card" style={{ backgroundColor: chartColors.background }}>
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
                <stop offset="5%" stopColor={chartColors.progressColor} stopOpacity={1.0} />
                <stop offset="95%" stopColor={chartColors.progressColor} stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillActivity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.activityColor} stopOpacity={0.8} />
                <stop offset="95%" stopColor={chartColors.activityColor} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={chartColors.gridLine} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              stroke={chartColors.axisLine}
              tickMargin={8}
              minTickGap={32}
              tick={{ fill: chartColors.tickColor }}
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
                  style={{
                    backgroundColor: chartColors.tooltipBg,
                    color: chartColors.tooltipColor,
                    borderRadius: "8px",
                    padding: "8px",
                  }}
                />
              }
            />
            <Area
              dataKey="progress"
              type="natural"
              fill="url(#fillProgress)"
              stroke={chartColors.progressColor}
              stackId="a"
            />
            <Area
              dataKey="activity"
              type="natural"
              fill="url(#fillActivity)"
              stroke={chartColors.activityColor}
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
