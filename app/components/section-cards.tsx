"use client";

import { useEffect, useState } from "react";
import { IconTrendingUp } from "@tabler/icons-react";

import { toast } from "react-toastify";
import { Spinner } from "@/components/ui/spinner";

import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

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
    // add fields if needed
}

export function SectionCards() {
    const [allRecords, setAllRecords] = useState<CustomerRecord[]>([]);
    const [userRecords, setUserRecords] = useState<UserRecord[]>([]);
    const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
    const [activityRecords, setActivityRecords] = useState<ActivityRecord[]>([]);

    const [loadingRecords, setLoadingRecords] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(false);
    const [loadingActivity, setLoadingActivity] = useState(false);

    const [errorRecords, setErrorRecords] = useState<string | null>(null);
    const [errorUsers, setErrorUsers] = useState<string | null>(null);
    const [errorProgress, setErrorProgress] = useState<string | null>(null);
    const [errorActivity, setErrorActivity] = useState<string | null>(null);

    const NEW_RECORDS_DAYS = 7;

    // Fetch customer records
    useEffect(() => {
        async function fetchData() {
            setLoadingRecords(true);
            setErrorRecords(null);
            try {
                const res = await fetch(
                    "/api/Data/Applications/Taskflow/CustomerDatabase/Fetch"
                );
                if (!res.ok) throw new Error("Failed to fetch customer records");
                const data = await res.json();
                setAllRecords(Array.isArray(data) ? data : data.data ?? []);
            } catch (err: any) {
                setErrorRecords(err.message || "Error fetching customer records");
                toast.error(`Customer Records Error: ${err.message || err}`);
                setAllRecords([]);
            } finally {
                setLoadingRecords(false);
            }
        }
        fetchData();
    }, []);

    // Fetch user records
    useEffect(() => {
        async function fetchUsers() {
            setLoadingUsers(true);
            setErrorUsers(null);
            try {
                const res = await fetch("/api/Dashboard/FetchUser");
                if (!res.ok) throw new Error("Failed to fetch users");
                const data = await res.json();
                setUserRecords(Array.isArray(data) ? data : data.data ?? []);
            } catch (err: any) {
                setErrorUsers(err.message || "Error fetching users");
                toast.error(`Users Error: ${err.message || err}`);
                setUserRecords([]);
            } finally {
                setLoadingUsers(false);
            }
        }
        fetchUsers();
    }, []);

    // Fetch progress records
    useEffect(() => {
        async function fetchProgress() {
            setLoadingProgress(true);
            setErrorProgress(null);
            try {
                const res = await fetch("/api/Data/Applications/Taskflow/Progress/Fetch");
                if (!res.ok) throw new Error("Failed to fetch progress records");
                const data = await res.json();
                setProgressRecords(Array.isArray(data) ? data : data.data ?? []);
            } catch (err: any) {
                setErrorProgress(err.message || "Error fetching progress records");
                toast.error(`Progress Records Error: ${err.message || err}`);
                setProgressRecords([]);
            } finally {
                setLoadingProgress(false);
            }
        }
        fetchProgress();
    }, []);

    // Fetch activity records
    useEffect(() => {
        async function fetchActivity() {
            setLoadingActivity(true);
            setErrorActivity(null);
            try {
                const res = await fetch("/api/Data/Applications/Taskflow/Activity/Fetch");
                if (!res.ok) throw new Error("Failed to fetch activity records");
                const data = await res.json();
                setActivityRecords(Array.isArray(data) ? data : data.data ?? []);
            } catch (err: any) {
                setErrorActivity(err.message || "Error fetching activity records");
                toast.error(`Activity Records Error: ${err.message || err}`);
                setActivityRecords([]);
            } finally {
                setLoadingActivity(false);
            }
        }
        fetchActivity();
    }, []);

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

    // Flatten for table rows
    const ramTableData = Object.entries(ramConsumptionByRefAndDate).flatMap(
        ([referenceid, dayObj]) =>
            Object.entries(dayObj).map(([date, ramConsumed]) => ({
                referenceid,
                date,
                ramConsumed,
            }))
    );

    return (
        <>
            <div className="grid grid-cols-1 gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
                {/* Total Customer Records */}
                <Card className="@container/card flex flex-col rounded-xl">
                    <CardHeader className="flex flex-col gap-2">
                        <CardDescription>Total Customer Records</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {renderTitle(loadingRecords, errorRecords, allRecords.length)}
                        </CardTitle>
                        {!loadingRecords && !errorRecords && (
                            <Badge variant="outline" className="flex items-center gap-1 w-max">
                                <IconTrendingUp />
                                {totalRecordsTrend}
                            </Badge>
                        )}
                    </CardHeader>
                    <CardFooter className="mt-auto flex flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium">
                            Trending up this month <IconTrendingUp className="size-4" />
                        </div>
                        <div className="text-muted-foreground">
                            Total customer records in the database
                        </div>
                    </CardFooter>
                </Card>

                {/* New Customer Records */}
                <Card className="@container/card flex flex-col rounded-xl">
                    <CardHeader className="flex flex-col gap-2">
                        <CardDescription>
                            New Customer Records (Last {NEW_RECORDS_DAYS} Days)
                        </CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {renderTitle(loadingRecords, errorRecords, newRecordsCount)}
                        </CardTitle>
                        {!loadingRecords && !errorRecords && (
                            <Badge variant="outline" className="flex items-center gap-1 w-max">
                                <IconTrendingUp />
                                {newRecordsTrend}
                            </Badge>
                        )}
                    </CardHeader>
                    <CardFooter className="mt-auto flex flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium">
                            Trending up this period <IconTrendingUp className="size-4" />
                        </div>
                        <div className="text-muted-foreground">
                            Recently added customer records
                        </div>
                    </CardFooter>
                </Card>

                {/* Total Users */}
                <Card className="@container/card flex flex-col rounded-xl">
                    <CardHeader className="flex flex-col gap-2">
                        <CardDescription>Total Users</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {renderTitle(loadingUsers, errorUsers, userRecords.length)}
                        </CardTitle>
                        {!loadingUsers && !errorUsers && (
                            <Badge variant="outline" className="flex items-center gap-1 w-max">
                                <IconTrendingUp />
                                {totalUsersTrend}
                            </Badge>
                        )}
                    </CardHeader>
                    <CardFooter className="mt-auto flex flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium">
                            Stable growth <IconTrendingUp className="size-4" />
                        </div>
                        <div className="text-muted-foreground">Total registered users</div>
                    </CardFooter>
                </Card>

                {/* New Users */}
                <Card className="@container/card flex flex-col rounded-xl">
                    <CardHeader className="flex flex-col gap-2">
                        <CardDescription>New Users (Last {NEW_RECORDS_DAYS} Days)</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {renderTitle(loadingUsers, errorUsers, newUsersCount)}
                        </CardTitle>
                        {!loadingUsers && !errorUsers && (
                            <Badge variant="outline" className="flex items-center gap-1 w-max">
                                <IconTrendingUp />
                                {newUsersTrend}
                            </Badge>
                        )}
                    </CardHeader>
                    <CardFooter className="mt-auto flex flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium">
                            Trending up this period <IconTrendingUp className="size-4" />
                        </div>
                        <div className="text-muted-foreground">Recently registered users</div>
                    </CardFooter>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 px-4 sm:grid-cols-2 lg:grid-cols-2 lg:px-6">
                {/* Total Progress Records */}
                <Card className="@container/card flex flex-col rounded-xl">
                    <CardHeader className="flex flex-col gap-2">
                        <CardDescription>Total Progress Records</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {renderTitle(loadingProgress, errorProgress, progressRecords.length)}
                        </CardTitle>
                        {!loadingProgress && !errorProgress && (
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
                <Card className="@container/card flex flex-col rounded-xl">
                    <CardHeader className="flex flex-col gap-2">
                        <CardDescription>Total Activity Records</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {renderTitle(loadingActivity, errorActivity, activityRecords.length)}
                        </CardTitle>
                        {!loadingActivity && !errorActivity && (
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
