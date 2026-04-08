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
import { Activity, TrendingUp } from "lucide-react";

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
    color: "#22d3ee", // cyan-400
  },
  activity: {
    label: "Activity Count",
    color: "#a855f7", // purple-500
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
  const { data, loading, errors, dateRange, setDateRange } = useDashboardData();
  
  // Format timeRange for display (add 'd' suffix)
  const timeRange = dateRange ? `${dateRange}d` : "90d";
  
  // Handle time range change
  const handleTimeRangeChange = (value: string) => {
    // Remove 'd' suffix and set as dateRange
    const days = value.replace('d', '');
    setDateRange(days);
  };
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
      setDateRange("7");
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

  // Sci-fi color scheme - always dark theme
  const chartColors = React.useMemo(
    () => ({
      axisLine: "#22d3ee",        // cyan-400
      tickColor: "#94a3b8",       // slate-400
      gridLine: "rgba(6, 182, 212, 0.2)",  // cyan with opacity
      tooltipBg: "rgba(15, 23, 42, 0.95)",  // slate-900 with opacity
      tooltipColor: "#ffffff",
      background: "transparent",
      progressColor: "#22d3ee",   // cyan-400
      activityColor: "#a855f7",   // purple-500
    }),
    []
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
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
      
      <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl overflow-hidden">
        {/* Corner brackets - single border like section cards */}
        <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-cyan-500/50" />
        <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-cyan-500/50" />
        
        <CardHeader className="relative z-10 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white tracking-wider uppercase text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
                Mission Analytics
              </CardTitle>
              <CardDescription className="text-white/60 mt-1">
                <span className="hidden @[540px]/card:block">
                  Progress and Activity telemetry data (Unique IDs)
                </span>
                <span className="@[540px]/card:hidden">Combined telemetry</span>
              </CardDescription>
            </div>
            {/* Legend */}
            <div className="hidden sm:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                <span className="text-white/80 uppercase tracking-wider">Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                <span className="text-white/80 uppercase tracking-wider">Activity</span>
              </div>
            </div>
          </div>
        </CardHeader>
        
        {/* Controls row - outside CardHeader */}
        <div className="px-6 pb-4 flex items-center justify-between gap-4">
          <ToggleGroup
            type="single"
            value={dateRange}
            onValueChange={handleTimeRangeChange}
            variant="outline"
            className="hidden @[767px]/card:flex bg-slate-800/50 border border-cyan-500/30 rounded-lg p-1"
          >
            <ToggleGroupItem value="90" className="text-white/70 data-[state=on]:bg-cyan-500/20 data-[state=on]:text-cyan-300 data-[state=on]:border-cyan-400/50 border-transparent uppercase text-xs tracking-wider px-4">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30" className="text-white/70 data-[state=on]:bg-cyan-500/20 data-[state=on]:text-cyan-300 data-[state=on]:border-cyan-400/50 border-transparent uppercase text-xs tracking-wider px-4">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7" className="text-white/70 data-[state=on]:bg-cyan-500/20 data-[state=on]:text-cyan-300 data-[state=on]:border-cyan-400/50 border-transparent uppercase text-xs tracking-wider px-4">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger
              className="flex w-40 bg-slate-800/50 border-cyan-500/30 text-white focus:ring-cyan-400/50 @[767px]/card:hidden"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-cyan-500/30 rounded-xl">
              <SelectItem value="90d" className="text-white focus:bg-cyan-500/20 rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="text-white focus:bg-cyan-500/20 rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="text-white focus:bg-cyan-500/20 rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillProgress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.progressColor} stopOpacity={0.8} />
                <stop offset="95%" stopColor={chartColors.progressColor} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillActivity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.activityColor} stopOpacity={0.6} />
                <stop offset="95%" stopColor={chartColors.activityColor} stopOpacity={0.05} />
              </linearGradient>
              {/* Glow filter */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
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
              type="monotone"
              fill="url(#fillProgress)"
              stroke={chartColors.progressColor}
              strokeWidth={2}
              filter="url(#glow)"
              stackId="a"
            />
            <Area
              dataKey="activity"
              type="monotone"
              fill="url(#fillActivity)"
              stroke={chartColors.activityColor}
              strokeWidth={2}
              filter="url(#glow)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      </Card>
    </div>
  );
}
