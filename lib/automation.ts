import { TaskLog } from "./mongo/Collections/PantsIn";
import { Archive } from "./mongo/Collections/Archive";

export interface AutomationRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
  lastRun: string;
  config?: Record<string, any>;
}

// Store automation rules (in production, use database)
let automationRules: AutomationRule[] = [
  {
    id: "1",
    name: "Auto-archive old logs",
    condition: "Age > 90 days",
    action: "Archive to cold storage",
    enabled: true,
    lastRun: "2 hours ago",
    config: { retentionDays: 90 }
  },
  {
    id: "2",
    name: "Delete temporary files",
    condition: "Age > 7 days AND Status = 'Temp'",
    action: "Permanent delete",
    enabled: true,
    lastRun: "1 day ago",
    config: { retentionDays: 7, statusFilter: "Temp" }
  },
  {
    id: "3",
    name: "Backup on low activity",
    condition: "System load < 20%",
    action: "Create incremental backup",
    enabled: false,
    lastRun: "Never",
    config: { loadThreshold: 20, backupType: "incremental" }
  },
  {
    id: "4",
    name: "Clean orphan photos",
    condition: "Daily at 02:00",
    action: "Remove unused photos",
    enabled: true,
    lastRun: "Never",
    config: { schedule: "0 2 * * *" }
  },
  {
    id: "5",
    name: "Auto-resolve old anomalies",
    condition: "Anomaly age > 30 days AND Severity = 'low'",
    action: "Mark as resolved",
    enabled: false,
    lastRun: "Never",
    config: { anomalyAge: 30, severity: "low" }
  }
];

export async function getAutomationRules(): Promise<AutomationRule[]> {
  return automationRules;
}

export async function updateAutomationRule(
  ruleId: string, 
  updates: Partial<AutomationRule>
): Promise<boolean> {
  const ruleIndex = automationRules.findIndex(r => r.id === ruleId);
  if (ruleIndex === -1) return false;
  
  automationRules[ruleIndex] = {
    ...automationRules[ruleIndex],
    ...updates
  };
  
  return true;
}

export async function runAutomationRule(ruleId: string): Promise<{ 
  success: boolean; 
  message: string; 
  affectedCount?: number 
}> {
  const rule = automationRules.find(r => r.id === ruleId);
  if (!rule) {
    return { success: false, message: "Rule not found" };
  }
  
  if (!rule.enabled) {
    return { success: false, message: "Rule is disabled" };
  }
  
  try {
    let affectedCount = 0;
    
    switch (rule.id) {
      case "1": // Auto-archive old logs
        affectedCount = await runArchiveRule(rule.config?.retentionDays || 90);
        break;
        
      case "2": // Delete temporary files
        affectedCount = await runDeleteTempRule(
          rule.config?.retentionDays || 7,
          rule.config?.statusFilter || "Temp"
        );
        break;
        
      case "3": // Backup on low activity
        // This would trigger a backup via the backup system
        affectedCount = 0;
        break;
        
      case "4": // Clean orphan photos
        affectedCount = await runCleanOrphanPhotosRule();
        break;
        
      case "5": // Auto-resolve old anomalies
        affectedCount = await runResolveOldAnomalies(
          rule.config?.anomalyAge || 30,
          rule.config?.severity || "low"
        );
        break;
        
      default:
        return { success: false, message: "Unknown rule action" };
    }
    
    // Update last run time
    rule.lastRun = "Just now";
    
    return {
      success: true,
      message: `Rule executed successfully`,
      affectedCount
    };
    
  } catch (error) {
    console.error(`Error running automation rule ${ruleId}:`, error);
    return {
      success: false,
      message: `Error: ${error}`
    };
  }
}

async function runArchiveRule(retentionDays: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  // Find old records
  const oldRecords = await TaskLog.find({
    date_created: { $lt: cutoffDate } as any,
    archived: { $ne: true } as any
  } as any);
  
  let archivedCount = 0;
  
  for (const record of oldRecords) {
    try {
      // Archive the record
      await Archive.create({
        originalId: record._id,
        ReferenceID: record.ReferenceID,
        Email: record.Email,
        Type: record.Type,
        Status: record.Status,
        Location: record.Location,
        Latitude: record.Latitude,
        Longitude: record.Longitude,
        PhotoURL: record.PhotoURL,
        date_created: record.date_created,
        archivedAt: new Date(),
        source: "pantsin"
      });
      
      // Mark as archived in original
      await TaskLog.updateOne(
        { _id: record._id },
        { archived: true }
      );
      
      archivedCount++;
    } catch (error) {
      console.error(`Error archiving record ${record._id}:`, error);
    }
  }
  
  return archivedCount;
}

async function runDeleteTempRule(retentionDays: number, statusFilter: string): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const tempRecords = await TaskLog.find({
    date_created: { $lt: cutoffDate } as any,
    Status: statusFilter,
    archived: { $ne: true } as any
  } as any);
  
  const result = await TaskLog.deleteMany({
    date_created: { $lt: cutoffDate } as any,
    Status: statusFilter,
    archived: { $ne: true } as any
  } as any);
  
  return result.deletedCount || 0;
}

async function runCleanOrphanPhotosRule(): Promise<number> {
  // Get all photo URLs from database
  const allRecords = await TaskLog.find({ 
    PhotoURL: { 
      $exists: true, 
      $ne: null 
    } as any
  } as any);
  const validPhotoUrls = new Set(allRecords.map(r => r.PhotoURL));
  
  // This would check storage and delete unused photos
  // Implementation depends on your storage provider (Supabase, S3, etc.)
  
  // Placeholder - return 0 as we can't actually check storage here
  return 0;
}

async function runResolveOldAnomalies(age: number, severity: string): Promise<number> {
  // This would integrate with the anomaly system
  // For now, placeholder implementation
  
  const { getAllAnomalies, clearResolvedAnomalies } = await import("./anomaly");
  const anomalies = await getAllAnomalies(true);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - age);
  
  let resolvedCount = 0;
  
  for (const anomaly of anomalies) {
    const anomalyDate = new Date(anomaly.detectedAt);
    if (anomalyDate < cutoffDate && anomaly.severity === severity && !anomaly.resolved) {
      // Resolve the anomaly
      const { resolveAnomaly } = await import("./anomaly");
      await resolveAnomaly(anomaly.id);
      resolvedCount++;
    }
  }
  
  return resolvedCount;
}

export async function addAutomationRule(rule: Omit<AutomationRule, "id">): Promise<AutomationRule> {
  const newRule: AutomationRule = {
    ...rule,
    id: (automationRules.length + 1).toString()
  };
  
  automationRules.push(newRule);
  return newRule;
}

export async function deleteAutomationRule(ruleId: string): Promise<boolean> {
  const initialLength = automationRules.length;
  automationRules = automationRules.filter(r => r.id !== ruleId);
  return automationRules.length < initialLength;
}

// Run all enabled automation rules
export async function runAllEnabledRules(): Promise<{ 
  executed: number; 
  results: { ruleId: string; success: boolean; message: string }[] 
}> {
  const enabledRules = automationRules.filter(r => r.enabled);
  const results: { ruleId: string; success: boolean; message: string }[] = [];
  
  for (const rule of enabledRules) {
    const result = await runAutomationRule(rule.id);
    results.push({
      ruleId: rule.id,
      success: result.success,
      message: result.message
    });
  }
  
  return {
    executed: enabledRules.length,
    results
  };
}
