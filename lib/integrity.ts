import { connectToDatabase } from "./MongoDB";
import { TaskLog } from "./mongo/Collections/PantsIn";
import { Archive } from "./mongo/Collections/Archive";

export interface IntegrityCheckResult {
  totalChecked: number;
  issuesFound: number;
  score: number;
  issues: IntegrityIssue[];
}

export interface IntegrityIssue {
  type: string;
  severity: "low" | "medium" | "high";
  collection: string;
  recordId?: string;
  details: string;
}

export async function runIntegrityCheck(): Promise<IntegrityCheckResult> {
  const issues: IntegrityIssue[] = [];
  let totalChecked = 0;
  
  try {
    // Check TaskLog collection
    const taskLogRecords = await TaskLog.find({});
    totalChecked += taskLogRecords.length;
    
    for (const record of taskLogRecords) {
      // Check for missing required fields
      if (!record.ReferenceID) {
        issues.push({
          type: "Missing ReferenceID",
          severity: "high",
          collection: "TaskLog",
          recordId: record._id?.toString(),
          details: "Record has no ReferenceID"
        });
      }
      
      if (!record.Email) {
        issues.push({
          type: "Missing Email",
          severity: "medium",
          collection: "TaskLog",
          recordId: record._id?.toString(),
          details: "Record has no Email"
        });
      }
      
      if (!record.date_created) {
        issues.push({
          type: "Missing Timestamp",
          severity: "low",
          collection: "TaskLog",
          recordId: record._id?.toString(),
          details: "Record has no date_created"
        });
      }
      
      // Check for invalid coordinates
      if (record.Latitude && (record.Latitude < -90 || record.Latitude > 90)) {
        issues.push({
          type: "Invalid Latitude",
          severity: "medium",
          collection: "TaskLog",
          recordId: record._id?.toString(),
          details: `Latitude ${record.Latitude} is out of valid range (-90 to 90)`
        });
      }
      
      if (record.Longitude && (record.Longitude < -180 || record.Longitude > 180)) {
        issues.push({
          type: "Invalid Longitude",
          severity: "medium",
          collection: "TaskLog",
          recordId: record._id?.toString(),
          details: `Longitude ${record.Longitude} is out of valid range (-180 to 180)`
        });
      }
    }
    
    // Check Archive collection
    const archiveRecords = await Archive.find({});
    totalChecked += archiveRecords.length;
    
    for (const record of archiveRecords) {
      if (!record.archivedAt) {
        issues.push({
          type: "Missing Archive Timestamp",
          severity: "low",
          collection: "archive",
          recordId: record._id?.toString(),
          details: "Archived record has no archivedAt timestamp"
        });
      }
    }
    
    // Check for orphaned records (records in archive that don't exist in main)
    // This is a simplified check - full implementation would need to track original IDs
    
  } catch (error) {
    console.error("Integrity check error:", error);
    issues.push({
      type: "Check Error",
      severity: "high",
      collection: "system",
      details: `Error during integrity check: ${error}`
    });
  }
  
  // Calculate score (100 - (issues per 1000 records * 10))
  const issueRate = totalChecked > 0 ? (issues.length / totalChecked) * 1000 : 0;
  const score = Math.max(0, Math.min(100, Math.round(100 - (issueRate * 10))));
  
  return {
    totalChecked,
    issuesFound: issues.length,
    score,
    issues
  };
}

export async function calculateIntegrityScore(): Promise<number> {
  const result = await runIntegrityCheck();
  return result.score;
}

export async function fixIntegrityIssue(issue: IntegrityIssue): Promise<boolean> {
  try {
    const { TaskLog } = await import("./mongo/Collections/PantsIn");
    const { Archive } = await import("./mongo/Collections/Archive");
    
    switch (issue.type) {
      case "Missing Timestamp":
        if (issue.collection === "TaskLog" && issue.recordId) {
          await TaskLog.updateOne(
            { _id: issue.recordId } as any,
            { date_created: new Date() }
          );
          return true;
        }
        break;
        
      case "Missing Archive Timestamp":
        if (issue.collection === "archive" && issue.recordId) {
          await Archive.updateOne(
            // @ts-expect-error MongoDB ObjectId can accept string
            { _id: issue.recordId },
            { archivedAt: new Date() }
          );
          return true;
        }
        break;
        
      default:
        console.log(`Auto-fix not implemented for issue type: ${issue.type}`);
        return false;
    }
    
    return false;
  } catch (error) {
    console.error("Error fixing integrity issue:", error);
    return false;
  }
}
