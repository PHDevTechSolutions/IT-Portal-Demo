import { connectToDatabase } from "./MongoDB";
import { TaskLog } from "./mongo/Collections/PantsIn";
import { Archive } from "./mongo/Collections/Archive";
import { createWriteStream } from "fs";
import { promisify } from "util";
import { pipeline } from "stream";
import * as fs from "fs/promises";
import * as path from "path";

const pump = promisify(pipeline);

// Backup storage path
const BACKUP_DIR = process.env.BACKUP_DIR || "./backups";

export interface BackupRecord {
  id: string;
  name: string;
  date: string;
  size: string;
  type: "full" | "incremental";
  status: "completed" | "failed" | "in_progress";
  filePath?: string;
}

// Ensure backup directory exists
async function ensureBackupDir(): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    console.error("Error creating backup directory:", error);
  }
}

// Generate backup filename
function generateBackupFilename(type: string, name?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = name || `${type}_backup_${timestamp}`;
  return path.join(BACKUP_DIR, `${backupName}.json`);
}

// Create backup
export async function createBackup(
  type: "full" | "incremental" = "full",
  name?: string
): Promise<BackupRecord> {
  await ensureBackupDir();
  
  const id = `backup_${Date.now()}`;
  const filePath = generateBackupFilename(type, name);
  
  try {
    // Fetch data based on backup type
    let data: any = {};
    
    if (type === "full") {
      const taskLogData = await TaskLog.find({});
      const archiveData = await Archive.find({});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data = {
        tasklog: taskLogData,
        archive: archiveData,
        metadata: {
          createdAt: new Date().toISOString(),
          type: "full",
          version: "1.0"
        }
      };
    } else {
      // Incremental - only backup recent changes (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const last24Hours = new Date();
      last24Hours.setDate(last24Hours.getDate() - 1);
      last24Hours.setHours(23, 59, 59);
      
      const recentTaskLog = await TaskLog.find({
        date_created: { $gte: yesterday, $lt: last24Hours } as any
      } as any);
      
      data = {
        tasklog: recentTaskLog,
        metadata: {
          createdAt: new Date().toISOString(),
          type: "incremental",
          since: yesterday.toISOString(),
          version: "1.0"
        }
      };
    }
    
    // Write to file
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    
    // Get file size
    const stats = await fs.stat(filePath);
    const size = formatBytes(stats.size);
    
    return {
      id,
      name: name || `${type} Backup - ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString().split("T")[0],
      size,
      type,
      status: "completed",
      filePath
    };
  } catch (error) {
    console.error("Backup creation failed:", error);
    return {
      id,
      name: name || `${type} Backup - Failed`,
      date: new Date().toISOString().split("T")[0],
      size: "0 B",
      type,
      status: "failed"
    };
  }
}

// List all backups
export async function listBackups(): Promise<BackupRecord[]> {
  await ensureBackupDir();
  
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups: BackupRecord[] = [];
    
    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = await fs.stat(filePath);
        
        // Try to read metadata from backup file
        let type: "full" | "incremental" = "full";
        let name = file.replace(".json", "").replace(/_/g, " ");
        
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const data = JSON.parse(content);
          if (data.metadata) {
            type = data.metadata.type || "full";
            name = `${type} Backup - ${new Date(stats.mtime).toLocaleDateString()}`;
          }
        } catch (e) {
          // Use file info if parsing fails
        }
        
        backups.push({
          id: file.replace(".json", ""),
          name,
          date: stats.mtime.toISOString().split("T")[0],
          size: formatBytes(stats.size),
          type,
          status: "completed",
          filePath
        });
      }
    }
    
    // Sort by date descending
    return backups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error("Error listing backups:", error);
    return [];
  }
}

// Restore backup
export async function restoreBackup(backupId: string): Promise<{ success: boolean; message: string; restoredCount?: number }> {
  try {
    const filePath = path.join(BACKUP_DIR, `${backupId}.json`);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return { success: false, message: "Backup file not found" };
    }
    
    // Read backup file
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    
    let restoredCount = 0;
    
    // Restore tasklog collection
    if (data.tasklog && Array.isArray(data.tasklog)) {
      for (const item of data.tasklog) {
        const { _id, ...rest } = item;
        await TaskLog.create(rest);
        restoredCount++;
      }
    }
    
    // Legacy support: also check for old pantsin key
    if (data.pantsin && Array.isArray(data.pantsin)) {
      for (const item of data.pantsin) {
        const { _id, ...rest } = item;
        await TaskLog.create(rest);
        restoredCount++;
      }
    }
    
    // Restore archive collection
    if (data.archive && Array.isArray(data.archive)) {
      for (const item of data.archive) {
        const { _id, ...rest } = item;
        await Archive.create(rest);
        restoredCount++;
      }
    }
    
    return {
      success: true,
      message: `Successfully restored ${restoredCount} records`,
      restoredCount
    };
  } catch (error: any) {
    console.error("Restore failed:", error);
    return { success: false, message: `Restore failed: ${error.message}` };
  }
}

// Delete backup
export async function deleteBackup(backupId: string): Promise<void> {
  const filePath = path.join(BACKUP_DIR, `${backupId}.json`);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error("Error deleting backup:", error);
    throw error;
  }
}

// Download backup
export async function getBackupFilePath(backupId: string): Promise<string | null> {
  const filePath = path.join(BACKUP_DIR, `${backupId}.json`);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

// Utility function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
