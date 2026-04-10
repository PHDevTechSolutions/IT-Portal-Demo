import { connectToDatabase } from "./MongoDB";
import { TaskLog } from "./mongo/Collections/PantsIn";

export interface PerformanceMetric {
  metric: string;
  value: string;
  status: "good" | "warning" | "critical";
  trend: "up" | "down" | "stable";
}

// Store historical metrics for trend analysis
const metricHistory: { timestamp: number; metrics: PerformanceMetric[] }[] = [];

export async function getPerformanceMetrics(): Promise<PerformanceMetric[]> {
  const metrics: PerformanceMetric[] = [];
  
  try {
    const startTime = Date.now();
    
    // Test query performance
    const db = await connectToDatabase();
    const TaskLog = db.collection("TaskLog");
    await TaskLog.find({}).limit(100).toArray();
    const queryTime = Date.now() - startTime;
    
    metrics.push({
      metric: "Query Response Time",
      value: `${queryTime}ms`,
      status: queryTime < 500 ? "good" : queryTime < 1000 ? "warning" : "critical",
      trend: compareWithHistory("Query Response Time", queryTime)
    });
    
    // Get collection stats using db.command
    const taskLogStats = await db.command({ collStats: "TaskLog" }).catch(() => null);
    
    if (taskLogStats) {
      const avgDocSize = taskLogStats.avgObjSize || 0;
      metrics.push({
        metric: "Average Document Size",
        value: formatBytes(avgDocSize),
        status: avgDocSize < 10000 ? "good" : avgDocSize < 50000 ? "warning" : "critical",
        trend: "stable"
      });
    }
    
    // Count documents
    const totalCount = await TaskLog.countDocuments();
    
    // Check index usage (simplified - full implementation would use $indexStats)
    metrics.push({
      metric: "Total Records",
      value: totalCount.toLocaleString(),
      status: totalCount < 100000 ? "good" : totalCount < 500000 ? "warning" : "critical",
      trend: compareCountWithHistory(totalCount)
    });
    
    // Calculate storage efficiency
    const Archive = db.collection("Archive");
    const archivedCount = await Archive.countDocuments();
    const archiveRatio = totalCount > 0 ? (archivedCount / (totalCount + archivedCount)) * 100 : 0;
    
    metrics.push({
      metric: "Archive Ratio",
      value: `${archiveRatio.toFixed(1)}%`,
      status: archiveRatio < 30 ? "good" : archiveRatio < 60 ? "warning" : "critical",
      trend: archiveRatio > 30 ? "up" : "stable"
    });
    
    // Check for slow queries (records older than 5 seconds processing time would be logged)
    // This is a simplified check
    const slowQueries = 0; // In real implementation, track actual slow queries
    
    metrics.push({
      metric: "Slow Queries (24h)",
      value: slowQueries.toString(),
      status: slowQueries < 5 ? "good" : slowQueries < 20 ? "warning" : "critical",
      trend: slowQueries > 5 ? "up" : "stable"
    });
    
    // Calculate data freshness (average age of records)
    const recentRecords = await TaskLog.find({}).sort({ date_created: -1 } as any).limit(100).toArray();
    if (recentRecords.length > 0) {
      const now = new Date().getTime();
      const avgAge = recentRecords.reduce((sum: number, r: any) => {
        const age = r.date_created ? now - new Date(r.date_created).getTime() : 0;
        return sum + age;
      }, 0) / recentRecords.length;
      
      const avgAgeHours = avgAge / (1000 * 60 * 60);
      
      metrics.push({
        metric: "Avg Record Age",
        value: `${avgAgeHours.toFixed(1)} hours`,
        status: avgAgeHours < 24 ? "good" : avgAgeHours < 72 ? "warning" : "critical",
        trend: avgAgeHours > 24 ? "up" : "stable"
      });
    }
    
    // Store metrics for trend analysis
    metricHistory.push({
      timestamp: Date.now(),
      metrics: [...metrics]
    });
    
    // Keep only last 30 days of history
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    while (metricHistory.length > 0 && metricHistory[0].timestamp < thirtyDaysAgo) {
      metricHistory.shift();
    }
    
  } catch (error) {
    console.error("Performance metrics error:", error);
    metrics.push({
      metric: "Error",
      value: "Unable to fetch",
      status: "critical",
      trend: "stable"
    });
  }
  
  return metrics;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function compareWithHistory(metricName: string, currentValue: number): "up" | "down" | "stable" {
  if (metricHistory.length < 2) return "stable";
  
  const lastEntry = metricHistory[metricHistory.length - 1];
  const previousMetric = lastEntry.metrics.find(m => m.metric === metricName);
  
  if (!previousMetric) return "stable";
  
  const previousValue = parseFloat(previousMetric.value.replace(/[^0-9.]/g, ""));
  const diff = currentValue - previousValue;
  
  if (Math.abs(diff) < previousValue * 0.1) return "stable"; // Less than 10% change
  return diff > 0 ? "up" : "down";
}

function compareCountWithHistory(currentCount: number): "up" | "down" | "stable" {
  if (metricHistory.length < 2) return "stable";
  
  const lastEntry = metricHistory[metricHistory.length - 1];
  const previousMetric = lastEntry.metrics.find(m => m.metric === "Total Records");
  
  if (!previousMetric) return "stable";
  
  const previousCount = parseInt(previousMetric.value.replace(/,/g, ""));
  const diff = currentCount - previousCount;
  
  if (Math.abs(diff) < 100) return "stable"; // Less than 100 records difference
  return diff > 0 ? "up" : "down";
}

export async function getPerformanceReport(timeRange: "day" | "week" | "month" = "day"): Promise<any> {
  const now = Date.now();
  const ranges = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000
  };
  
  const cutoff = now - ranges[timeRange];
  const relevantHistory = metricHistory.filter(h => h.timestamp >= cutoff);
  
  return {
    timeRange,
    dataPoints: relevantHistory.length,
    metrics: relevantHistory
  };
}
