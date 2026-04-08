import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import JSZip from "jszip";
import * as ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { neon } from "@neondatabase/serverless";
import { sendBackupNotification, sendGlobalNotification } from "@/lib/services/notifications";
import nodemailer from "nodemailer";

// Initialize clients
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL_IT;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_IT;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

function getNeon() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

// Get settings collection
async function getSettingsCollection() {
  const db = await connectToDatabase();
  return db.collection("backup_settings");
}

// Get history collection
async function getHistoryCollection() {
  const db = await connectToDatabase();
  return db.collection("backup_history");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "get_settings":
        return await getSettings();
      case "save_settings":
        return await saveSettings(body.settings);
      case "get_history":
        return await getHistory();
      case "run_backup":
        return await runBackup(body.settings);
      case "download":
        return await getDownloadUrl(body.backupId);
      case "download_zip":
        return await downloadZipWithSeparateExcels(body.backupId);
      case "delete_backup":
        return await deleteBackup(body.backupId);
      case "get_preview":
        return await getBackupPreview(body.backupId);
      case "restore_backup":
        return await restoreBackup(body.backupId, body.options);
      case "verify_backup":
        return await verifyBackupChecksum(body.backupId);
      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[BackupSettings] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

async function getSettings() {
  try {
    const collection = await getSettingsCollection();
    const settings = await collection.findOne({ _id: new ObjectId("000000000000000000000001") });
    
    if (!settings) {
      // Return default settings
      return NextResponse.json({
        success: true,
        settings: {
          enabled: true,
          frequency: "weekly",
          dayOfWeek: 0,
          dayOfMonth: 1,
          monthOfYear: 1,
          time: "02:00",
          dateRangeFrom: "",
          dateRangeTo: "",
          includeTables: ["activity", "history", "users", "customer_database"],
          notifyOnSuccess: true,
          notifyOnFailure: true,
          retentionCount: 10,
        },
      });
    }

    // Remove _id from response
    const { _id, ...settingsWithoutId } = settings;
    return NextResponse.json({ success: true, settings: settingsWithoutId });
  } catch (error) {
    console.error("[BackupSettings] Get settings error:", error);
    return NextResponse.json({ success: false, error: "Failed to get settings" });
  }
}

async function saveSettings(settings: any) {
  try {
    const collection = await getSettingsCollection();
    
    await collection.updateOne(
      { _id: new ObjectId("000000000000000000000001") },
      {
        $set: {
          ...settings,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Send notification about settings update
    await sendGlobalNotification({
      title: "Backup Settings Updated",
      message: `Database backup settings have been updated. Next backup: ${settings.frequency}`,
      type: "info",
      category: "system",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[BackupSettings] Save settings error:", error);
    return NextResponse.json({ success: false, error: "Failed to save settings" });
  }
}

async function getHistory() {
  try {
    const collection = await getHistoryCollection();
    const history = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    const formattedHistory = history.map((h) => ({
      id: h._id.toString(),
      timestamp: h.timestamp,
      status: h.status,
      size: h.size || "Unknown",
      frequency: h.frequency || "manual",
      recordsCount: h.recordsCount || 0,
      downloadUrl: h.downloadUrl,
    }));

    return NextResponse.json({ success: true, history: formattedHistory });
  } catch (error) {
    console.error("[BackupSettings] Get history error:", error);
    return NextResponse.json({ success: false, error: "Failed to get history" });
  }
}

async function runBackup(settings: any) {
  const backupId = new ObjectId();
  const timestamp = new Date();
  
  try {
    const historyCollection = await getHistoryCollection();
    
    // Insert initial record
    await historyCollection.insertOne({
      _id: backupId,
      timestamp,
      status: "in_progress",
      frequency: settings.frequency,
      startedAt: timestamp,
    });

    const workbook = new ExcelJS.Workbook();
    let totalRecords = 0;

    // Process each selected table
    for (const tableId of settings.includeTables) {
      const tableConfig = getTableConfig(tableId);
      if (!tableConfig) continue;

      const worksheet = workbook.addWorksheet(tableConfig.sheetName);
      const data = await fetchTableData(tableConfig, settings);
      
      if (data.length > 0) {
        // Add headers
        worksheet.columns = Object.keys(data[0]).map((key) => ({
          header: key,
          key: key,
          width: 20,
        }));

        // Add data
        data.forEach((row: any) => {
          worksheet.addRow(row);
        });

        totalRecords += data.length;
      }
    }

    // Generate Excel buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();
    const base64Data: string = Buffer.from(excelBuffer).toString("base64");

    // Generate ZIP file containing both Excel and additional data
    const zip = new JSZip();
    zip.file(`backup-${timestamp.toISOString().split('T')[0]}.xlsx`, excelBuffer);
    
    // Add metadata file to ZIP
    const metadata = {
      backupId: backupId.toString(),
      timestamp: timestamp.toISOString(),
      recordsCount: totalRecords,
      tables: settings.includeTables,
      frequency: settings.frequency,
      generatedAt: new Date().toISOString(),
    };
    zip.file("backup-metadata.json", JSON.stringify(metadata, null, 2));

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipDataBase64: string = Buffer.from(zipBuffer).toString("base64");
    const size = formatBytes(zipBuffer.byteLength);

    // Update history record
    await historyCollection.updateOne(
      { _id: backupId },
      {
        $set: {
          status: "success",
          recordsCount: totalRecords,
          size,
          completedAt: new Date(),
          data: base64Data,
          zipData: zipDataBase64,
          tables: settings.includeTables, // Save tables for ZIP download
          settings: settings, // Save settings for reference
        },
      }
    );

    // Clean up old backups based on retention
    await cleanupOldBackups(settings.retentionCount);

    // Send success notification
    if (settings.notifyOnSuccess) {
      await sendBackupNotification({
        status: "success",
        message: `Database backup completed successfully! ${totalRecords} records backed up. Size: ${size}`,
        timestamp: new Date().toISOString(),
        backupId: backupId.toString(),
      });
      
      // Send email notification if enabled
      if (settings.emailNotifications && settings.notificationEmail) {
        await sendEmailNotification({
          to: settings.notificationEmail,
          subject: "✅ Database Backup Successful",
          text: `Database backup completed successfully!\n\nRecords: ${totalRecords}\nSize: ${size}\nTimestamp: ${new Date().toLocaleString()}`,
          html: `
            <h2 style="color: #10b981;">Database Backup Successful</h2>
            <p>Your database backup has been completed successfully.</p>
            <ul>
              <li><strong>Records:</strong> ${totalRecords.toLocaleString()}</li>
              <li><strong>Size:</strong> ${size}</li>
              <li><strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
              <li><strong>Tables:</strong> ${settings.includeTables.join(", ")}</li>
            </ul>
          `
        });
      }
    }

    return NextResponse.json({
      success: true,
      backupId: backupId.toString(),
      recordsCount: totalRecords,
      size,
    });
  } catch (error: any) {
    console.error("[BackupSettings] Run backup error:", error);
    
    // Update history with failure
    const historyCollection = await getHistoryCollection();
    await historyCollection.updateOne(
      { _id: backupId },
      {
        $set: {
          status: "failed",
          error: error.message,
          completedAt: new Date(),
        },
      }
    );

    // Send failure notification
    if (settings.notifyOnFailure) {
      await sendBackupNotification({
        status: "failed",
        message: `Database backup failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        backupId: backupId.toString(),
      });
    }

    return NextResponse.json({ success: false, error: error.message });
  }
}

async function getDownloadUrl(backupId: string) {
  try {
    const collection = await getHistoryCollection();
    const backup = await collection.findOne({ _id: new ObjectId(backupId) });

    if (!backup || !backup.data) {
      return NextResponse.json({ success: false, error: "Backup not found" });
    }

    // Create a data URL for download (ZIP)
    const dataUrl = `data:application/zip;base64,${backup.zipData || backup.data}`;

    return NextResponse.json({ success: true, downloadUrl: dataUrl });
  } catch (error) {
    console.error("[BackupSettings] Download error:", error);
    return NextResponse.json({ success: false, error: "Failed to get download URL" });
  }
}

async function downloadZipWithSeparateExcels(backupId: string) {
  try {
    const collection = await getHistoryCollection();
    const backup = await collection.findOne({ _id: new ObjectId(backupId) });

    if (!backup) {
      return NextResponse.json({ success: false, error: "Backup not found" });
    }

    // Get the tables that were backed up
    const tables = backup.tables || backup.includeTables || [];
    
    if (tables.length === 0) {
      return NextResponse.json({ success: false, error: "No tables found in backup" });
    }

    // Create a new ZIP with separate Excel files per table
    const zip = new JSZip();
    
    // Process each table and create separate Excel file
    for (const tableId of tables) {
      const tableConfig = getTableConfig(tableId);
      if (!tableConfig) continue;

      // Create new workbook for each table
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(tableConfig.sheetName);
      
      // Fetch fresh data for this table
      const data = await fetchTableData(tableConfig, backup.settings || {});
      
      if (data.length > 0) {
        // Add headers
        worksheet.columns = Object.keys(data[0]).map((key) => ({
          header: key,
          key: key,
          width: 20,
        }));

        // Add data
        data.forEach((row: any) => {
          worksheet.addRow(row);
        });
      }

      // Generate Excel buffer for this table
      const excelBuffer = await workbook.xlsx.writeBuffer();
      
      // Add to ZIP with filename: table_name.xlsx
      const filename = `${tableConfig.sheetName}.xlsx`;
      zip.file(filename, excelBuffer);
    }

    // Add metadata file
    const metadata = {
      backupId: backupId,
      timestamp: backup.timestamp,
      recordsCount: backup.recordsCount || 0,
      tables: tables,
      frequency: backup.frequency || "manual",
      generatedAt: new Date().toISOString(),
      note: "Each table is in a separate Excel file",
    };
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipBase64 = Buffer.from(zipBuffer).toString("base64");
    const dataUrl = `data:application/zip;base64,${zipBase64}`;

    return NextResponse.json({ 
      success: true, 
      downloadUrl: dataUrl,
      message: "ZIP generated with separate Excel files per table"
    });
  } catch (error: any) {
    console.error("[BackupSettings] Download ZIP error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to generate ZIP" });
  }
}

// Helper functions
function getTableConfig(tableId: string) {
  const configs: Record<string, any> = {
    activity: { sheetName: "Activity", db: "supabase", table: "activity" },
    documentation: { sheetName: "Documentation", db: "supabase", table: "documentation" },
    history: { sheetName: "History", db: "supabase", table: "history" },
    revised_quotations: { sheetName: "RevisedQuotations", db: "supabase", table: "revised_quotations" },
    meetings: { sheetName: "Meetings", db: "supabase", table: "meetings" },
    signatories: { sheetName: "Signatories", db: "supabase", table: "signatories" },
    spf_request: { sheetName: "SPFRequests", db: "supabase", table: "spf_request" },
    users: { sheetName: "Users", db: "mongodb", collection: "users" },
    system_audits: { sheetName: "SystemAudits", db: "mongodb", collection: "system_audits" },
    customer_database: { sheetName: "CustomerDatabase", db: "mongodb", collection: "customers" },
  };
  return configs[tableId];
}

async function fetchTableData(config: any, settings: any) {
  const { dateRangeFrom, dateRangeTo } = settings;

  try {
    if (config.db === "supabase") {
      const supabase = getSupabase();
      let query = supabase.from(config.table).select("*");

      if (dateRangeFrom && dateRangeTo) {
        query = query
          .gte("date_created", `${dateRangeFrom}T00:00:00`)
          .lte("date_created", `${dateRangeTo}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } else if (config.db === "mongodb") {
      const db = await connectToDatabase();
      const collection = db.collection(config.collection);
      
      const filter: any = {};
      if (dateRangeFrom && dateRangeTo) {
        filter.createdAt = {
          $gte: new Date(dateRangeFrom),
          $lte: new Date(dateRangeTo + "T23:59:59"),
        };
      }

      const data = await collection.find(filter).toArray();
      // Convert ObjectIds and Dates to strings
      return data.map((doc: any) => {
        const flattened: any = {};
        Object.keys(doc).forEach((key) => {
          const value = doc[key];
          if (value instanceof ObjectId) {
            flattened[key] = value.toString();
          } else if (value instanceof Date) {
            flattened[key] = value.toISOString();
          } else if (typeof value === "object" && value !== null) {
            flattened[key] = JSON.stringify(value);
          } else {
            flattened[key] = value;
          }
        });
        return flattened;
      });
    }
    return [];
  } catch (error) {
    console.error(`[BackupSettings] Error fetching ${config.table || config.collection}:`, error);
    return [];
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function cleanupOldBackups(retentionCount: number) {
  try {
    const collection = await getHistoryCollection();
    const backups = await collection
      .find({ status: "success" })
      .sort({ timestamp: -1 })
      .toArray();

    if (backups.length > retentionCount) {
      const toDelete = backups.slice(retentionCount);
      const idsToDelete = toDelete.map((b) => b._id);
      await collection.deleteMany({ _id: { $in: idsToDelete } });
    }
  } catch (error) {
    console.error("[BackupSettings] Cleanup error:", error);
  }
}

// Email notification function
async function restoreBackup(backupId: string, options: any) {
  try {
    const collection = await getHistoryCollection();
    const backup = await collection.findOne({ _id: new ObjectId(backupId) });

    if (!backup) {
      return NextResponse.json({ success: false, error: "Backup not found" });
    }

    if (!backup.zipData && !backup.data) {
      return NextResponse.json({ success: false, error: "No backup data available" });
    }

    // Decode the backup data
    const zipBuffer = Buffer.from(backup.zipData || backup.data, 'base64');
    const zip = await JSZip.loadAsync(zipBuffer);

    const results: any[] = [];

    // Restore each table
    for (const [filename, file] of Object.entries(zip.files)) {
      if (filename.endsWith('.xlsx') && !file.dir) {
        const tableName = filename.replace('.xlsx', '');
        const excelBufferRaw = await file.async('uint8array');
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(excelBufferRaw as any);
        const worksheet = workbook.getWorksheet(1);
        
        if (!worksheet) continue;
        
        const rows: any[] = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) { // Skip header
            const rowData: any = {};
            row.eachCell((cell, colNumber) => {
              const headerRow = worksheet!.getRow(1);
              const headerCell = headerRow.getCell(colNumber);
              const header = headerCell.value as string;
              rowData[header] = cell.value;
            });
            rows.push(rowData);
          }
        });

        // Find table config and restore to database
        const tableConfig = getTableConfigBySheetName(tableName);
        if (tableConfig && options?.restoreTables?.includes(tableConfig.id)) {
          const restoredCount = await restoreTableData(tableConfig, rows, options);
          results.push({
            table: tableName,
            restored: restoredCount,
            total: rows.length
          });
        }
      }
    }

    // Send notification
    if (options?.notifyOnRestore) {
      await sendGlobalNotification({
        title: "Backup Restored",
        message: `Backup restored successfully. ${results.reduce((acc, r) => acc + r.restored, 0)} records restored.`,
        type: "success",
        category: "system",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Backup restored successfully",
      results,
    });
  } catch (error: any) {
    console.error("[BackupSettings] Restore error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to restore backup" });
  }
}

async function verifyBackupChecksum(backupId: string) {
  try {
    const collection = await getHistoryCollection();
    const backup = await collection.findOne({ _id: new ObjectId(backupId) });

    if (!backup) {
      return NextResponse.json({ success: false, error: "Backup not found" });
    }

    if (!backup.zipData) {
      return NextResponse.json({ success: false, error: "No backup data to verify" });
    }

    // Calculate checksum of backup data
    const checksum = crypto
      .createHash('sha256')
      .update(backup.zipData)
      .digest('hex');

    // Verify stored checksum matches (if exists)
    const isValid = !backup.checksum || backup.checksum === checksum;

    // Update backup with checksum if not stored
    if (!backup.checksum) {
      await collection.updateOne(
        { _id: new ObjectId(backupId) },
        { $set: { checksum } }
      );
    }

    return NextResponse.json({
      success: true,
      verified: isValid,
      checksum,
      storedChecksum: backup.checksum || null,
      message: isValid ? "Backup verified successfully" : "Backup checksum mismatch - data may be corrupted",
    });
  } catch (error: any) {
    console.error("[BackupSettings] Verify error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to verify backup" });
  }
}

// Helper function to get table config by sheet name
function getTableConfigBySheetName(sheetName: string) {
  const configs: Record<string, any> = {
    Activity: { id: "activity", sheetName: "Activity", db: "supabase", table: "activity" },
    Documentation: { id: "documentation", sheetName: "Documentation", db: "supabase", table: "documentation" },
    History: { id: "history", sheetName: "History", db: "supabase", table: "history" },
    RevisedQuotations: { id: "revised_quotations", sheetName: "RevisedQuotations", db: "supabase", table: "revised_quotations" },
    Meetings: { id: "meetings", sheetName: "Meetings", db: "supabase", table: "meetings" },
    Signatories: { id: "signatories", sheetName: "Signatories", db: "supabase", table: "signatories" },
    SPFRequests: { id: "spf_request", sheetName: "SPFRequests", db: "supabase", table: "spf_request" },
    Users: { id: "users", sheetName: "Users", db: "mongodb", collection: "users" },
    SystemAudits: { id: "system_audits", sheetName: "SystemAudits", db: "mongodb", collection: "system_audits" },
    CustomerDatabase: { id: "customer_database", sheetName: "CustomerDatabase", db: "mongodb", collection: "customers" },
  };
  return configs[sheetName];
}

// Helper function to restore table data
async function restoreTableData(config: any, data: any[], options: any) {
  if (data.length === 0) return 0;

  try {
    if (config.db === "supabase") {
      const supabase = getSupabase();
      
      // Delete existing data if overwrite option is set
      if (options?.overwrite) {
        await supabase.from(config.table).delete().neq('id', '0');
      }

      // Insert data in batches
      const batchSize = 100;
      let inserted = 0;
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const { error } = await supabase.from(config.table).insert(batch);
        if (error) {
          console.error(`[BackupSettings] Restore error for ${config.table}:`, error);
        } else {
          inserted += batch.length;
        }
      }
      
      return inserted;
    } else if (config.db === "mongodb") {
      const db = await connectToDatabase();
      const collection = db.collection(config.collection);

      // Delete existing data if overwrite option is set
      if (options?.overwrite) {
        await collection.deleteMany({});
      }

      // Insert data
      if (data.length > 0) {
        await collection.insertMany(data);
      }
      
      return data.length;
    }
    return 0;
  } catch (error) {
    console.error(`[BackupSettings] Restore error for ${config.table}:`, error);
    return 0;
  }
}

async function sendEmailNotification({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  try {
    // Create transporter using SMTP credentials from env
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || "backup@ecoshift.com",
      to,
      subject,
      text,
      html,
    });

    console.log("[BackupSettings] Email notification sent to:", to);
  } catch (error) {
    console.error("[BackupSettings] Email notification failed:", error);
    // Don't throw - backup should succeed even if email fails
  }
}

async function deleteBackup(backupId: string) {
  try {
    const collection = await getHistoryCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(backupId) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: "Backup not found" });
    }

    return NextResponse.json({ success: true, message: "Backup deleted successfully" });
  } catch (error) {
    console.error("[BackupSettings] Delete error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete backup" });
  }
}

async function getBackupPreview(backupId: string) {
  try {
    const collection = await getHistoryCollection();
    const backup = await collection.findOne({ _id: new ObjectId(backupId) });

    if (!backup) {
      return NextResponse.json({ success: false, error: "Backup not found" });
    }

    // Get preview data for each table (first 5 rows only)
    const tables = backup.tables || [];
    const previewData: Record<string, any[]> = {};

    for (const tableId of tables.slice(0, 3)) { // Preview max 3 tables
      const tableConfig = getTableConfig(tableId);
      if (!tableConfig) continue;

      const data = await fetchTableData(tableConfig, backup.settings || {});
      previewData[tableConfig.sheetName] = data.slice(0, 5); // First 5 rows
    }

    return NextResponse.json({
      success: true,
      preview: {
        backupId: backupId,
        timestamp: backup.timestamp,
        tables: tables,
        recordsCount: backup.recordsCount,
        size: backup.size,
        previewData: previewData,
      },
    });
  } catch (error) {
    console.error("[BackupSettings] Preview error:", error);
    return NextResponse.json({ success: false, error: "Failed to get preview" });
  }
}
