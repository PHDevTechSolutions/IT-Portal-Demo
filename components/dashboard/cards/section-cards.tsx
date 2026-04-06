"use client";

import { IconTrendingUp } from "@tabler/icons-react";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { Spinner } from "@/components/ui/spinner";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle, } from "@/components/ui/card";

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
            <div className="grid grid-cols-1 gap-2 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
                {/* Total Customer Records */}
                <Card className="@container/card flex flex-col rounded-3xl p-1 ">
                    <Card className="flex rounded-3xl p-6 bg-black/80 shadow-xl border-none">
                        {/* Left side: Vertical stack (title + count) */}
                        <div className="flex flex-1 flex-col justify-center gap-2">
                            <CardDescription className="text-cyan-300">Total Customer Records</CardDescription>
                            <CardTitle className="text-3xl font-extrabold text-white tabular-nums">
                                {renderTitle(loading.records, errors.records, allRecords.length)}
                            </CardTitle>
                            {!loading.records && !errors.records && (
                                <Badge variant="outline" className="flex items-center gap-1 w-max text-cyan-400 border-cyan-400">
                                    <IconTrendingUp />
                                    {totalRecordsTrend}
                                </Badge>
                            )}
                        </div>

                        {/* Right side: Vertical Battery Bar */}
                        <div className="relative w-8 h-24 bg-gray-900 rounded-lg border border-cyan-600 flex flex-col justify-end p-1 shadow-[0_0_8px_cyan]">
                            {/* Battery level with animation */}
                            <div
                                className="w-6 mx-auto rounded-md bg-gradient-to-t from-cyan-500 via-cyan-400 to-cyan-300 shadow-lg transition-all duration-1000 ease-in-out"
                                style={{ height: "75%" }} // Adjust based on newRecordsCount or trend if you want dynamic height
                            ></div>

                            {/* Battery tip */}
                            <div className="absolute left-1/2 top-[-6px] -translate-x-1/2 w-4 h-2 bg-cyan-400 rounded-t-md"></div>
                        </div>
                    </Card>
                    {/* Footer below the row */}
                    <CardFooter className="mt-4 flex flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium items-center">
                            Trending up this month <IconTrendingUp className="size-4 text-cyan-400" />
                        </div>
                        <div>Total customer records in the database</div>
                    </CardFooter>
                </Card>

                {/* New Customer Records */}
                <Card className="@container/card flex flex-col rounded-3xl p-1">
                    <Card className="flex rounded-3xl p-6 bg-black/80 shadow-xl border-none">
                        {/* Left side: Vertical stack (title + count) */}
                        <div className="flex flex-1 flex-col justify-center gap-2">
                            <CardDescription className="text-cyan-300">
                                New Customer Records (Last {NEW_RECORDS_DAYS} Days)
                            </CardDescription>
                            <CardTitle className="text-3xl font-extrabold text-white tabular-nums">
                                {renderTitle(loading.records, errors.records, newRecordsCount)}
                            </CardTitle>
                            {!loading.records && !errors.records && (
                                <Badge variant="outline" className="flex items-center gap-1 w-max text-cyan-400 border-cyan-400">
                                    <IconTrendingUp />
                                    {newRecordsTrend}
                                </Badge>
                            )}
                        </div>

                        {/* Right side: Vertical Battery Bar */}
                        <div className="relative w-8 h-24 bg-gray-900 rounded-lg border border-cyan-600 flex flex-col justify-end p-1 shadow-[0_0_8px_cyan]">
                            {/* Battery level with animation */}
                            <div
                                className="w-6 mx-auto rounded-md bg-gradient-to-t from-cyan-500 via-cyan-400 to-cyan-300 shadow-lg transition-all duration-1000 ease-in-out"
                                style={{ height: "75%" }} // Adjust based on newRecordsCount or trend if you want dynamic height
                            ></div>

                            {/* Battery tip */}
                            <div className="absolute left-1/2 top-[-6px] -translate-x-1/2 w-4 h-2 bg-cyan-400 rounded-t-md"></div>
                        </div>
                    </Card>

                    {/* Footer below the row */}
                    <CardFooter className="mt-4 flex flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium items-center">
                            Trending up this period <IconTrendingUp className="size-4 text-cyan-400" />
                        </div>
                        <div>Recently added customer records</div>
                    </CardFooter>
                </Card>

                {/* Total Users */}
                <Card className="@container/card flex flex-col rounded-3xl p-1">
                    <Card className="flex rounded-3xl p-6 bg-black/80 shadow-xl border-none">
                        {/* Left side: Vertical stack (title + count) */}
                        <div className="flex flex-1 flex-col justify-center gap-2">
                            <CardDescription className="text-cyan-300">Total Users</CardDescription>
                            <CardTitle className="text-3xl font-extrabold text-white tabular-nums">
                                {renderTitle(loading.users, errors.users, userRecords.length)}
                            </CardTitle>
                            {!loading.users && !errors.users && (
                                <Badge variant="outline" className="flex items-center gap-1 w-max text-cyan-400 border-cyan-400">
                                    <IconTrendingUp />
                                    {totalUsersTrend}
                                </Badge>
                            )}
                        </div>

                        {/* Right side: Vertical Battery Bar */}
                        <div className="relative w-8 h-24 bg-gray-900 rounded-lg border border-cyan-600 flex flex-col justify-end p-1 shadow-[0_0_8px_cyan]">
                            {/* Battery level with animation */}
                            <div
                                className="w-6 mx-auto rounded-md bg-gradient-to-t from-cyan-500 via-cyan-400 to-cyan-300 shadow-lg transition-all duration-1000 ease-in-out"
                                style={{ height: "75%" }} // Adjust based on newRecordsCount or trend if you want dynamic height
                            ></div>

                            {/* Battery tip */}
                            <div className="absolute left-1/2 top-[-6px] -translate-x-1/2 w-4 h-2 bg-cyan-400 rounded-t-md"></div>
                        </div>
                    </Card>

                    {/* Footer below the row */}
                    <CardFooter className="mt-4 flex flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium items-center">
                            Trending up this period <IconTrendingUp className="size-4 text-cyan-400" />
                        </div>
                        <div>total user records</div>
                    </CardFooter>
                </Card>

                {/* New Users */}
                <Card className="@container/card flex flex-col rounded-3xl p-1">
                    <Card className="flex rounded-3xl p-6 bg-black/80 shadow-xl border-none">
                        {/* Left side: Vertical stack (title + count) */}
                        <div className="flex flex-1 flex-col justify-center gap-2">
                            <CardDescription className="text-cyan-300">New Users (Last {NEW_RECORDS_DAYS} Days)</CardDescription>
                            <CardTitle className="text-3xl font-extrabold text-white tabular-nums">
                                {renderTitle(loading.users, errors.users, newUsersCount)}
                            </CardTitle>
                            {!loading.users && !errors.users && (
                                <Badge variant="outline" className="flex items-center gap-1 w-max text-cyan-400 border-cyan-400">
                                    <IconTrendingUp />
                                    {newUsersTrend}
                                </Badge>
                            )}
                        </div>

                        {/* Right side: Vertical Battery Bar */}
                        <div className="relative w-8 h-24 bg-gray-900 rounded-lg border border-cyan-600 flex flex-col justify-end p-1 shadow-[0_0_8px_cyan]">
                            {/* Battery level with animation */}
                            <div
                                className="w-6 mx-auto rounded-md bg-gradient-to-t from-cyan-500 via-cyan-400 to-cyan-300 shadow-lg transition-all duration-1000 ease-in-out"
                                style={{ height: "75%" }} // Adjust based on newRecordsCount or trend if you want dynamic height
                            ></div>

                            {/* Battery tip */}
                            <div className="absolute left-1/2 top-[-6px] -translate-x-1/2 w-4 h-2 bg-cyan-400 rounded-t-md"></div>
                        </div>
                    </Card>

                    {/* Footer below the row */}
                    <CardFooter className="mt-4 flex flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium items-center">
                            Trending up this period <IconTrendingUp className="size-4 text-cyan-400" />
                        </div>
                        <div>Recently registered users</div>
                    </CardFooter>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-2 px-4 sm:grid-cols-2 lg:grid-cols-2 lg:px-6">
                {/* Total Progress Records */}
                <Card className="@container/card flex flex-col rounded-3xl">
                    <CardHeader className="flex flex-col gap-2">
                        <CardDescription>Total Progress Records</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {renderTitle(loading.progress, errors.progress, progressRecords.length)}
                        </CardTitle>
                        {!loading.progress && !errors.progress && (
                            <Badge variant="outline" className="flex items-center gap-1 w-max">
                                <IconTrendingUp />
                                {totalProgressTrend}
                            </Badge>
                        )}
                    </CardHeader>
                    <CardFooter className="mt-auto flex flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium">
                            Progress updates this month <IconTrendingUp className="size-4" />
                        </div>
                        <div className="text-muted-foreground">Total progress entries in database</div>
                    </CardFooter>
                </Card>

                {/* Total Activity Records */}
                <Card className="@container/card flex flex-col rounded-3xl">
                    <CardHeader className="flex flex-col gap-2">
                        <CardDescription>Total Activity Records</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {renderTitle(loading.activity, errors.activity, activityRecords.length)}
                        </CardTitle>
                        {!loading.activity && !errors.activity && (
                            <Badge variant="outline" className="flex items-center gap-1 w-max">
                                <IconTrendingUp />
                                {totalActivityTrend}
                            </Badge>
                        )}
                    </CardHeader>
                    <CardFooter className="mt-auto flex flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium">
                            Activity logs this month <IconTrendingUp className="size-4" />
                        </div>
                        <div className="text-muted-foreground">Total activity logs in database</div>
                    </CardFooter>
                </Card>
            </div>
        </>
    );
}
