"use client";

import { IconTrendingUp, IconUsers, IconDatabase, IconActivity, IconChartBar, IconFileAnalytics } from "@tabler/icons-react";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Spinner } from "@/components/ui/spinner";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface CustomerRecord {
    _id: string;
    date_created: string; // ISO string
}

interface UserRecord {
    _id: string;
    createdAt: string; // ISO string
}

interface ProgressRecord {
    _id: string;
    referenceid: string;
    date: string; // ISO string or date string representing the day
    ramConsumed: number; // amount of RAM consumed in MB or appropriate unit
}

interface ActivityRecord {
    _id: string;
}

export function SectionCards() {
    const { data, loading, errors } = useDashboardData();
    const { allRecords, userRecords, progressRecords, activityRecords } = data;
    const NEW_RECORDS_DAYS = 7;

    // Calculate new customer records within last 7 days
    const newRecordsCount = allRecords.filter((record) => {
        const createdDate = new Date(record.date_created);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - NEW_RECORDS_DAYS);
        return createdDate >= cutoffDate;
    }).length;

    // Calculate new users within last 7 days
    const newUsersCount = userRecords.filter((user) => {
        const createdDate = new Date(user.createdAt);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - NEW_RECORDS_DAYS);
        return createdDate >= cutoffDate;
    }).length;

    // Dummy trend data (replace with real trend logic)
    const totalRecordsTrend = "+8.3%";
    const newRecordsTrend = "+15.2%";
    const totalUsersTrend = "+5.1%";
    const newUsersTrend = "+10.7%";
    const totalProgressTrend = "+6.0%";
    const totalActivityTrend = "+7.5%";

    // Helper to render card title with spinner or error
    function renderTitle(
        loading: boolean,
        error: string | null,
        count: number
    ) {
        if (loading) return <Spinner className="mx-auto" />;
        if (error) return <span className="text-destructive">{error}</span>;
        return count.toLocaleString();
    }

    // Compute RAM consumed per referenceid per day
    const ramConsumptionByRefAndDate: Record<string, Record<string, number>> = {};

    progressRecords.forEach(({ referenceid, date, ramConsumed }) => {
        if (!ramConsumptionByRefAndDate[referenceid]) {
            ramConsumptionByRefAndDate[referenceid] = {};
        }
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) return; // skip invalid dates
        const day = parsedDate.toISOString().slice(0, 10);
        ramConsumptionByRefAndDate[referenceid][day] =
            (ramConsumptionByRefAndDate[referenceid][day] || 0) + ramConsumed;
    });

    return (
        <>
            <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
                {/* Total Customer Records */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                    <Card className="relative bg-slate-900/90 backdrop-blur-xl border-cyan-500/30 rounded-xl p-4 overflow-hidden h-full">
                        <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-cyan-500/50" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-cyan-500/50" />
                        
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                                <IconDatabase className="h-6 w-6 text-cyan-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white tabular-nums">{renderTitle(loading.records, errors.records, allRecords.length)}</p>
                                <p className="text-xs text-white/80 uppercase tracking-wider">Total Records</p>
                            </div>
                        </div>
                        {!loading.records && !errors.records && (
                            <Badge variant="outline" className="mt-3 flex items-center gap-1 w-max text-cyan-400 border-cyan-400/50 bg-cyan-500/10 text-xs">
                                <IconTrendingUp className="h-3 w-3" />
                                {totalRecordsTrend}
                            </Badge>
                        )}
                    </Card>
                </div>

                {/* New Customer Records */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                    <Card className="relative bg-slate-900/90 backdrop-blur-xl border-emerald-500/30 rounded-xl p-4 overflow-hidden h-full">
                        <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-emerald-500/50" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-emerald-500/50" />
                        
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                                <IconFileAnalytics className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white tabular-nums">{renderTitle(loading.records, errors.records, newRecordsCount)}</p>
                                <p className="text-xs text-white/80 uppercase tracking-wider">New (7 Days)</p>
                            </div>
                        </div>
                        {!loading.records && !errors.records && (
                            <Badge variant="outline" className="mt-3 flex items-center gap-1 w-max text-emerald-400 border-emerald-400/50 bg-emerald-500/10 text-xs">
                                <IconTrendingUp className="h-3 w-3" />
                                {newRecordsTrend}
                            </Badge>
                        )}
                    </Card>
                </div>

                {/* Total Users */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-blue-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                    <Card className="relative bg-slate-900/90 backdrop-blur-xl border-blue-500/30 rounded-xl p-4 overflow-hidden h-full">
                        <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-blue-500/50" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-blue-500/50" />
                        
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-blue-500/20 border border-blue-500/30">
                                <IconUsers className="h-6 w-6 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white tabular-nums">{renderTitle(loading.users, errors.users, userRecords.length)}</p>
                                <p className="text-xs text-white/80 uppercase tracking-wider">Total Users</p>
                            </div>
                        </div>
                        {!loading.users && !errors.users && (
                            <Badge variant="outline" className="mt-3 flex items-center gap-1 w-max text-blue-400 border-blue-400/50 bg-blue-500/10 text-xs">
                                <IconTrendingUp className="h-3 w-3" />
                                {totalUsersTrend}
                            </Badge>
                        )}
                    </Card>
                </div>

                {/* New Users */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-purple-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                    <Card className="relative bg-slate-900/90 backdrop-blur-xl border-purple-500/30 rounded-xl p-4 overflow-hidden h-full">
                        <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-purple-500/50" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-purple-500/50" />
                        
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-purple-500/20 border border-purple-500/30">
                                <IconUsers className="h-6 w-6 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white tabular-nums">{renderTitle(loading.users, errors.users, newUsersCount)}</p>
                                <p className="text-xs text-white/80 uppercase tracking-wider">New Users (7 Days)</p>
                            </div>
                        </div>
                        {!loading.users && !errors.users && (
                            <Badge variant="outline" className="mt-3 flex items-center gap-1 w-max text-purple-400 border-purple-400/50 bg-purple-500/10 text-xs">
                                <IconTrendingUp className="h-3 w-3" />
                                {newUsersTrend}
                            </Badge>
                        )}
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 lg:grid-cols-2 lg:px-6">
                {/* Total Progress Records */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-orange-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                    <Card className="relative bg-slate-900/90 backdrop-blur-xl border-orange-500/30 rounded-xl p-4 overflow-hidden h-full">
                        <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-orange-500/50" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-orange-500/50" />
                        
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-orange-500/20 border border-orange-500/30">
                                <IconChartBar className="h-6 w-6 text-orange-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white tabular-nums">{renderTitle(loading.progress, errors.progress, progressRecords.length)}</p>
                                <p className="text-xs text-white/80 uppercase tracking-wider">Progress Records</p>
                            </div>
                        </div>
                        {!loading.progress && !errors.progress && (
                            <Badge variant="outline" className="mt-3 flex items-center gap-1 w-max text-orange-400 border-orange-400/50 bg-orange-500/10 text-xs">
                                <IconTrendingUp className="h-3 w-3" />
                                {totalProgressTrend}
                            </Badge>
                        )}
                    </Card>
                </div>

                {/* Total Activity Records */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                    <Card className="relative bg-slate-900/90 backdrop-blur-xl border-yellow-500/30 rounded-xl p-4 overflow-hidden h-full">
                        <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-yellow-500/50" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-yellow-500/50" />
                        
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                                <IconActivity className="h-6 w-6 text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white tabular-nums">{renderTitle(loading.activity, errors.activity, activityRecords.length)}</p>
                                <p className="text-xs text-white/80 uppercase tracking-wider">Activity Records</p>
                            </div>
                        </div>
                        {!loading.activity && !errors.activity && (
                            <Badge variant="outline" className="mt-3 flex items-center gap-1 w-max text-yellow-400 border-yellow-400/50 bg-yellow-500/10 text-xs">
                                <IconTrendingUp className="h-3 w-3" />
                                {totalActivityTrend}
                            </Badge>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}
