"use client";

import {
  IconTrendingUp, IconUsers, IconDatabase,
  IconActivity, IconChartBar, IconFileAnalytics,
} from "@tabler/icons-react";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Spinner } from "@/components/ui/spinner";

// ─── Corner brackets ──────────────────────────────────────────────────────────

function CornerBrackets({ color }: { color: string }) {
  return (
    <>
      <div className={`absolute top-0 left-0 w-2.5 h-2.5 border-l border-t ${color}`} />
      <div className={`absolute top-0 right-0 w-2.5 h-2.5 border-r border-t ${color}`} />
      <div className={`absolute bottom-0 left-0 w-2.5 h-2.5 border-l border-b ${color}`} />
      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-r border-b ${color}`} />
    </>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  sublabel?: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  trend?: string;
  accentClass: string;       // e.g. "border-orange-500/20"
  bracketClass: string;      // e.g. "border-orange-500/40"
  iconBgClass: string;       // e.g. "bg-orange-500/10 border-orange-500/30"
  iconColorClass: string;    // e.g. "text-orange-400"
  glowClass: string;         // e.g. "from-orange-500/20 to-orange-400/5"
  trendColorClass: string;   // e.g. "text-orange-400"
}

function StatCard({
  label, sublabel, value, icon, trend,
  accentClass, bracketClass, iconBgClass, iconColorClass, glowClass, trendColorClass,
}: StatCardProps) {
  return (
    <div className="relative group">
      {/* Glow */}
      <div className={`absolute -inset-0.5 bg-gradient-to-br ${glowClass} blur opacity-20 group-hover:opacity-40 transition duration-500`} />

      <div className={`relative bg-[#0d1117]/95 border ${accentClass} overflow-hidden h-full p-4`}>
        <CornerBrackets color={bracketClass} />

        {/* Icon + value row */}
        <div className="flex items-start gap-3">
          <div className={`p-2 border ${iconBgClass} shrink-0`}>
            <div className={iconColorClass}>{icon}</div>
          </div>
          <div className="min-w-0">
            <p className={`text-xl font-bold font-mono tabular-nums ${trendColorClass}`}>
              {value}
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mt-0.5 leading-tight">
              {label}
            </p>
            {sublabel && (
              <p className="text-[9px] text-slate-700 uppercase tracking-widest font-mono mt-0.5">
                {sublabel}
              </p>
            )}
          </div>
        </div>

        {/* Trend */}
        {trend && (
          <div className={`mt-3 flex items-center gap-1 text-[10px] font-mono ${trendColorClass} opacity-70`}>
            <IconTrendingUp className="h-3 w-3" />
            <span>{trend}</span>
          </div>
        )}

        {/* Bottom accent line */}
        <div className={`absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-10 ${trendColorClass}`} />
      </div>
    </div>
  );
}

// ─── Section cards ────────────────────────────────────────────────────────────

export function SectionCards() {
  const { data, loading, errors } = useDashboardData();
  const { allRecords, userRecords, progressRecords, activityRecords } = data;
  const NEW_RECORDS_DAYS = 7;

  const newRecordsCount = allRecords.filter((r) => {
    const d = new Date(r.date_created);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - NEW_RECORDS_DAYS);
    return d >= cutoff;
  }).length;

  const newUsersCount = userRecords.filter((u) => {
    const d = new Date(u.createdAt);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - NEW_RECORDS_DAYS);
    return d >= cutoff;
  }).length;

  function renderValue(isLoading: boolean, error: string | null, count: number) {
    if (isLoading) return <Spinner className="h-5 w-5" />;
    if (error) return <span className="text-red-400 text-sm">ERR</span>;
    return count.toLocaleString();
  }

  const cards: StatCardProps[] = [
    {
      label: "Total Records",
      sublabel: "Customer Database",
      value: renderValue(loading.records, errors.records, allRecords.length),
      icon: <IconDatabase className="h-5 w-5" />,
      trend: "+8.3%",
      accentClass: "border-orange-500/20",
      bracketClass: "border-orange-500/40",
      iconBgClass: "bg-orange-500/10 border-orange-500/30",
      iconColorClass: "text-orange-400",
      glowClass: "from-orange-500/20 to-orange-400/5",
      trendColorClass: "text-orange-400",
    },
    {
      label: "New Records",
      sublabel: "Last 7 Days",
      value: renderValue(loading.records, errors.records, newRecordsCount),
      icon: <IconFileAnalytics className="h-5 w-5" />,
      trend: "+15.2%",
      accentClass: "border-orange-400/20",
      bracketClass: "border-orange-400/40",
      iconBgClass: "bg-orange-400/10 border-orange-400/30",
      iconColorClass: "text-orange-300",
      glowClass: "from-orange-400/20 to-orange-300/5",
      trendColorClass: "text-orange-300",
    },
    {
      label: "Total Users",
      sublabel: "Registered Accounts",
      value: renderValue(loading.users, errors.users, userRecords.length),
      icon: <IconUsers className="h-5 w-5" />,
      trend: "+5.1%",
      accentClass: "border-amber-500/20",
      bracketClass: "border-amber-500/40",
      iconBgClass: "bg-amber-500/10 border-amber-500/30",
      iconColorClass: "text-amber-400",
      glowClass: "from-amber-500/20 to-amber-400/5",
      trendColorClass: "text-amber-400",
    },
    {
      label: "New Users",
      sublabel: "Last 7 Days",
      value: renderValue(loading.users, errors.users, newUsersCount),
      icon: <IconUsers className="h-5 w-5" />,
      trend: "+10.7%",
      accentClass: "border-yellow-500/20",
      bracketClass: "border-yellow-500/40",
      iconBgClass: "bg-yellow-500/10 border-yellow-500/30",
      iconColorClass: "text-yellow-400",
      glowClass: "from-yellow-500/20 to-yellow-400/5",
      trendColorClass: "text-yellow-400",
    },
    {
      label: "Progress Records",
      sublabel: "Selected Range",
      value: renderValue(loading.progress, errors.progress, progressRecords.length),
      icon: <IconChartBar className="h-5 w-5" />,
      trend: "+6.0%",
      accentClass: "border-orange-600/20",
      bracketClass: "border-orange-600/40",
      iconBgClass: "bg-orange-600/10 border-orange-600/30",
      iconColorClass: "text-orange-500",
      glowClass: "from-orange-600/20 to-orange-500/5",
      trendColorClass: "text-orange-500",
    },
    {
      label: "Activity Records",
      sublabel: "Selected Range",
      value: renderValue(loading.activity, errors.activity, activityRecords.length),
      icon: <IconActivity className="h-5 w-5" />,
      trend: "+7.5%",
      accentClass: "border-red-500/20",
      bracketClass: "border-red-500/40",
      iconBgClass: "bg-red-500/10 border-red-500/30",
      iconColorClass: "text-red-400",
      glowClass: "from-red-500/20 to-red-400/5",
      trendColorClass: "text-red-400",
    },
  ];

  return (
    <div className="px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
