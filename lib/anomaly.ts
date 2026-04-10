import { connectToDatabase } from "./MongoDB";
import { TaskLog } from "./mongo/Collections/PantsIn";

export interface AnomalyRecord {
  id: string;
  type: string;
  severity: "low" | "medium" | "high";
  detectedAt: string;
  details: string;
  resolved: boolean;
}

// Store anomalies in memory (in production, use a database collection)
let detectedAnomalies: AnomalyRecord[] = [];

export async function detectAnomalies(): Promise<AnomalyRecord[]> {
  const anomalies: AnomalyRecord[] = [];
  
  try {
    // Get recent data for analysis
    const last24Hours = new Date();
    last24Hours.setDate(last24Hours.getDate() - 1);
    
    const recentRecords = await TaskLog.find({
      date_created: { $gte: last24Hours } as any
    } as any);
    
    // Check for data volume anomalies
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    
    const dayBeforeRecords = await TaskLog.find({
      date_created: { $gte: yesterday, $lt: last24Hours } as any
    } as any);
    
    const volumeChange = dayBeforeRecords.length > 0 
      ? ((recentRecords.length - dayBeforeRecords.length) / dayBeforeRecords.length) * 100 
      : 0;
    
    // Alert if volume increased by more than 200%
    if (volumeChange > 200) {
      anomalies.push({
        id: `anomaly_${Date.now()}_1`,
        type: "Unusual data volume spike",
        severity: "medium",
        detectedAt: new Date().toISOString(),
        details: `Data volume increased by ${volumeChange.toFixed(1)}% compared to previous day`,
        resolved: false
      });
    }
    
    // Check for status distribution anomalies
    const failedRecords = recentRecords.filter((r: any) => r.Status === "Failed" || r.Status === "Error");
    const failureRate = recentRecords.length > 0 ? (failedRecords.length / recentRecords.length) * 100 : 0;
    
    // Alert if failure rate is above 20%
    if (failureRate > 20) {
      anomalies.push({
        id: `anomaly_${Date.now()}_2`,
        type: "High failure rate detected",
        severity: "high",
        detectedAt: new Date().toISOString(),
        details: `${failureRate.toFixed(1)}% of recent records have failed status`,
        resolved: false
      });
    }
    
    // Check for duplicate ReferenceIDs
    const referenceIds = recentRecords.map((r: any) => r.ReferenceID);
    const duplicates = referenceIds.filter((item: any, index: any) => referenceIds.indexOf(item) !== index);
    
    if (duplicates.length > 0) {
      anomalies.push({
        id: `anomaly_${Date.now()}_3`,
        type: "Duplicate ReferenceIDs detected",
        severity: "medium",
        detectedAt: new Date().toISOString(),
        details: `Found ${duplicates.length} duplicate ReferenceIDs in recent records`,
        resolved: false
      });
    }
    
    // Check for geographic anomalies (records with impossible coordinates)
    const suspiciousCoords = recentRecords.filter((r: any) => {
      if (!r.Latitude || !r.Longitude) return false;
      // Check for coordinates at 0,0 (likely default/error values)
      return r.Latitude === 0 && r.Longitude === 0;
    });
    
    if (suspiciousCoords.length > 5) {
      anomalies.push({
        id: `anomaly_${Date.now()}_4`,
        type: "Suspicious coordinate patterns",
        severity: "low",
        detectedAt: new Date().toISOString(),
        details: `${suspiciousCoords.length} records have coordinates at 0,0`,
        resolved: false
      });
    }
    
    // Check for missing photo URLs
    const missingPhotos = recentRecords.filter((r: any) => !r.PhotoURL || r.PhotoURL === "");
    const missingPhotoRate = recentRecords.length > 0 ? (missingPhotos.length / recentRecords.length) * 100 : 0;
    
    if (missingPhotoRate > 50 && recentRecords.length > 10) {
      anomalies.push({
        id: `anomaly_${Date.now()}_5`,
        type: "High rate of missing photos",
        severity: "low",
        detectedAt: new Date().toISOString(),
        details: `${missingPhotoRate.toFixed(1)}% of recent records are missing photos`,
        resolved: false
      });
    }
    
  } catch (error) {
    console.error("Anomaly detection error:", error);
    anomalies.push({
      id: `anomaly_${Date.now()}_error`,
      type: "Detection error",
      severity: "medium",
      detectedAt: new Date().toISOString(),
      details: `Error during anomaly detection: ${error}`,
      resolved: false
    });
  }
  
  // Merge with existing anomalies, avoiding duplicates
  const existingIds = new Set(detectedAnomalies.map(a => a.id));
  const newAnomalies = anomalies.filter(a => !existingIds.has(a.id));
  detectedAnomalies = [...detectedAnomalies, ...newAnomalies];
  
  // Return only unresolved anomalies from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return detectedAnomalies.filter(a => {
    const anomalyDate = new Date(a.detectedAt);
    return !a.resolved && anomalyDate >= sevenDaysAgo;
  });
}

export async function getActiveAnomalyCount(): Promise<number> {
  const anomalies = await detectAnomalies();
  return anomalies.filter(a => !a.resolved).length;
}

export async function resolveAnomaly(anomalyId: string): Promise<boolean> {
  const anomaly = detectedAnomalies.find(a => a.id === anomalyId);
  if (anomaly) {
    anomaly.resolved = true;
    return true;
  }
  return false;
}

export async function getAllAnomalies(includeResolved: boolean = false): Promise<AnomalyRecord[]> {
  if (includeResolved) {
    return detectedAnomalies;
  }
  return detectedAnomalies.filter(a => !a.resolved);
}

export async function clearResolvedAnomalies(): Promise<number> {
  const beforeCount = detectedAnomalies.length;
  detectedAnomalies = detectedAnomalies.filter(a => !a.resolved);
  return beforeCount - detectedAnomalies.length;
}
