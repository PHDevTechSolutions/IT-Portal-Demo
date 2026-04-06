/**
 * app/api/Data/Applications/Admin/AuditLogs/Manage/route.ts
 * 
 * API for managing audit logs (archive, purge, retention settings)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
  limit,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { extractIPAddress, extractUserAgent } from "@/lib/utils/request-context";
import { logSystemAudit } from "@/lib/audit/system-audit";

const ARCHIVE_COLLECTION = "systemAudits_archive";
const RETENTION_DAYS_DEFAULT = 90;

/**
 * POST /api/Data/Applications/Admin/AuditLogs/Manage
 * Actions: archive, purge, get_stats
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, params } = body;

    const ipAddress = extractIPAddress(req);
    const userAgent = extractUserAgent(req);

    switch (action) {
      case "archive":
        return await archiveOldLogs(params, ipAddress, userAgent);
      case "purge":
        return await purgeLogs(params, ipAddress, userAgent);
      case "get_stats":
        return await getLogStats();
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[AuditLogs Manage] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Archive logs older than retention days
 */
async function archiveOldLogs(
  params: { retentionDays?: number; collection?: string },
  ipAddress: string | null,
  userAgent: string | null
) {
  const retentionDays = params?.retentionDays || RETENTION_DAYS_DEFAULT;
  const targetCollection = params?.collection || "systemAudits";
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    // Query old logs
    const q = query(
      collection(db, targetCollection),
      where("timestamp", "<", Timestamp.fromDate(cutoffDate)),
      limit(500) // Process in batches
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    let archivedCount = 0;

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      
      // Add to archive collection
      await addDoc(collection(db, ARCHIVE_COLLECTION), {
        ...data,
        archivedAt: serverTimestamp(),
        originalId: docSnapshot.id,
        originalCollection: targetCollection,
      });

      // Delete from original
      batch.delete(doc(db, targetCollection, docSnapshot.id));
      archivedCount++;
    }

    await batch.commit();

    // Log the archive action
    await logSystemAudit({
      action: "export",
      module: "AuditManagement",
      page: "/audit-logs",
      resourceType: "audit_logs",
      resourceName: `${targetCollection} archive`,
      affectedCount: archivedCount,
      actor: { uid: "system", name: "System", email: "system@ecoshiftcorp.com" },
      ipAddress,
      userAgent,
      metadata: {
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        collection: targetCollection,
      },
    });

    return NextResponse.json({
      success: true,
      archivedCount,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    console.error("[Archive Logs] Error:", error);
    return NextResponse.json(
      { error: "Failed to archive logs" },
      { status: 500 }
    );
  }
}

/**
 * Purge logs by date range or all logs
 */
async function purgeLogs(
  params: {
    fromDate?: string;
    toDate?: string;
    collection?: string;
    all?: boolean;
  },
  ipAddress: string | null,
  userAgent: string | null
) {
  const targetCollection = params?.collection || "systemAudits";

  try {
    let q;

    if (params?.all) {
      // Delete all logs
      q = query(collection(db, targetCollection), limit(500));
    } else if (params?.fromDate && params?.toDate) {
      // Delete by date range
      const from = new Date(params.fromDate);
      const to = new Date(params.toDate);
      q = query(
        collection(db, targetCollection),
        where("timestamp", ">=", Timestamp.fromDate(from)),
        where("timestamp", "<=", Timestamp.fromDate(to)),
        limit(500)
      );
    } else {
      return NextResponse.json(
        { error: "Invalid purge parameters" },
        { status: 400 }
      );
    }

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    let deletedCount = 0;

    for (const docSnapshot of snapshot.docs) {
      batch.delete(doc(db, targetCollection, docSnapshot.id));
      deletedCount++;
    }

    await batch.commit();

    // Log the purge action
    await logSystemAudit({
      action: "delete",
      module: "AuditManagement",
      page: "/audit-logs",
      resourceType: "audit_logs",
      resourceName: `${targetCollection} purge`,
      affectedCount: deletedCount,
      actor: { uid: "system", name: "System", email: "system@ecoshiftcorp.com" },
      ipAddress,
      userAgent,
      metadata: {
        fromDate: params?.fromDate,
        toDate: params?.toDate,
        all: params?.all,
        collection: targetCollection,
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount,
      collection: targetCollection,
    });
  } catch (error) {
    console.error("[Purge Logs] Error:", error);
    return NextResponse.json(
      { error: "Failed to purge logs" },
      { status: 500 }
    );
  }
}

/**
 * Get statistics for all log collections
 */
async function getLogStats() {
  try {
    const collections = [
      "systemAudits",
      "systemAudits_archive",
      "activity_logs",
      "taskflow_customer_audit_logs",
    ];

    const stats: Record<string, { count: number; oldest?: Date; newest?: Date }> = {};

    for (const coll of collections) {
      try {
        const q = query(collection(db, coll), limit(1));
        const snapshot = await getDocs(q);
        
        // Get approximate count (Firestore doesn't have an efficient count)
        const countSnapshot = await getDocs(query(collection(db, coll), limit(1000)));
        const count = countSnapshot.size;

        stats[coll] = {
          count,
        };
      } catch (err) {
        stats[coll] = { count: 0 };
      }
    }

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error("[Log Stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to get log stats" },
      { status: 500 }
    );
  }
}
