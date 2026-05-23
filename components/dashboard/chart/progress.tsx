"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { TrendingUp, CalendarRange, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgressRecord {
  _id: string;
  referenceid: string;
  date: string;
}

interface ActivityRecord {
  _id: string;
  date_created: string;
}

// ─── Chart config ─────────────────────────────────────────────────────────────

const chartConfig = {
  progress: { label: "Progress", color: "#f97316" },   // orange-500
  activity: { label: "Activity", color: "#fb923c" },   // orange-400
} satisfies ChartConfig;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countDistinctIdsByDate<T>(
  records: T[],
  getDate: (r: T) => string,
  getId: (r: T) => string,
): Record<string, number> {
  const map: Record<string, Set<string>> = {};
  records.forEach((record) => {
    const raw = getDate(record);
    const dateStr = typeof raw === "string" ? raw.slice(0, 10) : "";
    if (!dateStr) return;
    if (!map[dateStr]) map[dateStr] = new Set();
    map[dateStr].add(getId(record));
  });
  const result: Record<string, number> = {};
  for (const date in map) result[date] = map[date].size;
  return result;
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ─── Preset buttons ───────────────────────────────────────────────────────────

const PRESETS = [
  { label: "7D",  value: "7" },
  { label: "30D", value: "30" },
  { label: "90D", value: "90" },
];

// ─── Corner brackets ──────────────────────────────────────────────────────────

function CornerBrackets() {
  return (
    <>
      <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-orange-500/40" />
      <div className="absolute top-0 right-0 w-3 h-3 border-r border-t border-orange-500/40" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-orange-500/40" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-orange-500/40" />
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const { data, loading, errors, dateRange, setDateRange } = useDashboardData();

  // Custom date range state
  const [useCustom, setUseCustom] = React.useState(false);
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");

  // On mobile default to 7 days
  React.useEffect(() => {
    if (isMobile && dateRange !== "7") setDateRange("7");
  }, [isMobile]);

  // Apply custom date range — triggers refetch via context
  const applyCustomRange = () => {
    if (!customFrom || !customTo) return;
    const from = new Date(customFrom);
    const to = new Date(customTo);
    const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return;
    setDateRange(String(diffDays));
    setUseCustom(false);
  };

  const loadingCombined = loading.progress || loading.activity;
  const errorCombined = errors.progress || errors.activity;

  // Build chart data
  const progressCountByDate = countDistinctIdsByDate(
    data.progressRecords as ProgressRecord[],
    (r) => (r as any).date_created || (r as any).date || "",
    (r) => (r as any)._id || "",
  );
  const activityCountByDate = countDistinctIdsByDate(
    data.activityRecords as ActivityRecord[],
    (r) => (r as any).date_created || (r as any).date || "",
    (r) => (r as any)._id || "",
  );

  const allDates = Array.from(
    new Set([...Object.keys(progressCountByDate), ...Object.keys(activityCountByDate)]),
  ).sort();

  const days = parseInt(dateRange) || 7;
  const refDate = allDates.length
    ? new Date(allDates[allDates.length - 1])
    : new Date();
  const startDate = new Date(refDate);
  startDate.setDate(refDate.getDate() - days);

  const filteredData = allDates
    .filter((d) => {
      const dt = new Date(d);
      return dt >= startDate && dt <= refDate;
    })
    .map((d) => ({
      date: d,
      progress: progressCountByDate[d] || 0,
      activity: activityCountByDate[d] || 0,
    }));

  const totalProgress = filteredData.reduce((s, r) => s + r.progress, 0);
  const totalActivity = filteredData.reduce((s, r) => s + r.activity, 0);

  return (
    <div className="relative group">
      {/* Glow border */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/30 to-orange-400/10 blur opacity-30 group-hover:opacity-50 transition duration-500" />

      <Card className="relative bg-[#0d1117]/95 border border-orange-500/20 rounded-none overflow-hidden">
        <CornerBrackets />

        {/* Header */}
        <CardHeader className="pb-0 pt-4 px-4 sm:px-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            {/* Title */}
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-orange-500/10 border border-orange-500/30">
                <TrendingUp className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-orange-400 font-mono text-sm tracking-widest uppercase">
                  Mission Telemetry
                </CardTitle>
                <p className="text-[10px] text-slate-600 font-mono mt-0.5 tracking-wider uppercase">
                  Progress &amp; Activity · Unique Records / Day
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-2 items-start sm:items-end">
              {/* Preset buttons */}
              <div className="flex items-center gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => { setUseCustom(false); setDateRange(p.value); }}
                    className={`px-3 py-1 text-[10px] font-mono tracking-widest uppercase border transition-colors ${
                      dateRange === p.value && !useCustom
                        ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                        : "bg-transparent border-slate-700 text-slate-500 hover:border-orange-500/30 hover:text-orange-400/70"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setUseCustom((v) => !v)}
                  className={`flex items-center gap-1 px-3 py-1 text-[10px] font-mono tracking-widest uppercase border transition-colors ${
                    useCustom
                      ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                      : "bg-transparent border-slate-700 text-slate-500 hover:border-orange-500/30 hover:text-orange-400/70"
                  }`}
                >
                  <CalendarRange className="h-3 w-3" />
                  Custom
                </button>
              </div>

              {/* Custom date range inputs */}
              {useCustom && (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-7 px-2 text-[10px] font-mono bg-slate-900 border border-slate-700 text-slate-300 focus:border-orange-500/50 focus:outline-none"
                  />
                  <span className="text-slate-600 text-[10px] font-mono">→</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-7 px-2 text-[10px] font-mono bg-slate-900 border border-slate-700 text-slate-300 focus:border-orange-500/50 focus:outline-none"
                  />
                  <button
                    onClick={applyCustomRange}
                    disabled={!customFrom || !customTo}
                    className="h-7 px-3 text-[10px] font-mono uppercase tracking-widest bg-orange-500/20 border border-orange-500/40 text-orange-300 hover:bg-orange-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Summary stats */}
          {!loadingCombined && !errorCombined && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/60">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.8)]" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Progress</span>
                <span className="text-[11px] font-mono text-orange-300 font-bold">{totalProgress.toLocaleString()}</span>
              </div>
              <div className="w-px h-3 bg-slate-700" />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Activity</span>
                <span className="text-[11px] font-mono text-orange-300 font-bold">{totalActivity.toLocaleString()}</span>
              </div>
              <div className="w-px h-3 bg-slate-700" />
              <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                Last {dateRange}d · {filteredData.length} days
              </span>
            </div>
          )}
        </CardHeader>

        {/* Chart body */}
        <CardContent className="px-2 pt-4 pb-4 sm:px-4">
          {loadingCombined ? (
            <div className="flex items-center justify-center h-[220px] gap-2 text-orange-400/60 text-xs font-mono">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="uppercase tracking-widest">Loading telemetry…</span>
            </div>
          ) : errorCombined ? (
            <div className="flex items-center justify-center h-[220px] text-red-400/70 text-xs font-mono uppercase tracking-widest">
              Error: {errorCombined}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-slate-600 text-xs font-mono uppercase tracking-widest">
              No data for selected range
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
              <AreaChart data={filteredData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillProgress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fillActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#fb923c" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#fb923c" stopOpacity={0.02} />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <CartesianGrid
                  vertical={false}
                  stroke="rgba(251,146,60,0.08)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: "rgba(251,146,60,0.2)" }}
                  tickMargin={8}
                  minTickGap={28}
                  tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
                  width={32}
                />
                <ChartTooltip
                  cursor={{ stroke: "rgba(251,146,60,0.3)", strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(v) =>
                        new Date(v).toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric",
                        })
                      }
                      indicator="dot"
                      style={{
                        backgroundColor: "rgba(13,17,23,0.97)",
                        border: "1px solid rgba(251,146,60,0.25)",
                        borderRadius: 0,
                        color: "#e2e8f0",
                        fontSize: 11,
                        fontFamily: "monospace",
                      }}
                    />
                  }
                />
                <Area
                  dataKey="progress"
                  type="monotone"
                  fill="url(#fillProgress)"
                  stroke="#f97316"
                  strokeWidth={1.5}
                  filter="url(#glow)"
                  dot={false}
                  activeDot={{ r: 3, fill: "#f97316", stroke: "#f97316" }}
                />
                <Area
                  dataKey="activity"
                  type="monotone"
                  fill="url(#fillActivity)"
                  stroke="#fb923c"
                  strokeWidth={1.5}
                  filter="url(#glow)"
                  dot={false}
                  activeDot={{ r: 3, fill: "#fb923c", stroke: "#fb923c" }}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
