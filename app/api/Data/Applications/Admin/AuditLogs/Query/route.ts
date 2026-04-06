/**
 * app/api/Data/Applications/Admin/AuditLogs/Query/route.ts
 * 
 * API endpoint for programmatic access to audit logs
 * Supports querying, filtering, and exporting logs
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  startAfter,
} from "firebase/firestore";

const MAX_RESULTS = 1000;

/**
 * GET /api/Data/Applications/Admin/AuditLogs/Query
 * Query audit logs with filters
 * 
 * Query params:
 * - action: Filter by action type (create, update, delete, etc.)
 * - module: Filter by module (UserManagement, CustomerDatabase, etc.)
 * - actor: Filter by actor email
 * - from: Start date (ISO format)
 * - to: End date (ISO format)
 * - source: Filter by source collection (system_audit, activity_logs, customer_audit)
 * - limit: Max results (default 100, max 1000)
 * - offset: Pagination offset
 * - format: Response format (json, csv)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Parse query parameters
    const action = searchParams.get("action");
    const module = searchParams.get("module");
    const actor = searchParams.get("actor");
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const source = searchParams.get("source") || "all";
    const resultLimit = Math.min(
      parseInt(searchParams.get("limit") || "100"),
      MAX_RESULTS
    );
    const format = searchParams.get("format") || "json";

    // Validate API key (simple implementation - use proper auth in production)
    const apiKey = req.headers.get("x-api-key");
    if (!validateApiKey(apiKey)) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid or missing API key" },
        { status: 401 }
      );
    }

    // Build queries for each collection
    const collections = source === "all" 
      ? ["systemAudits", "activity_logs", "taskflow_customer_audit_logs"]
      : [source];

    const results: Array<{
      id: string;
      source: string;
      action: string;
      actor: Record<string, unknown>;
      timestamp: string;
      module?: string;
      resourceName?: string;
      resourceType?: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, unknown>;
    }> = [];

    for (const coll of collections) {
      try {
        let q = query(
          collection(db, coll),
          orderBy("timestamp", "desc"),
          limit(resultLimit)
        );

        // Apply filters
        if (fromDate && toDate) {
          const from = new Date(fromDate);
          const to = new Date(toDate);
          q = query(q, where("timestamp", ">=", Timestamp.fromDate(from)));
          q = query(q, where("timestamp", "<=", Timestamp.fromDate(to)));
        }

        if (action) {
          q = query(q, where("action", "==", action));
        }

        if (module) {
          q = query(q, where("module", "==", module));
        }

        const snapshot = await getDocs(q);
        
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          
          // Actor filter (post-query since it might be in nested fields)
          if (actor) {
            const actorEmail = data.actorEmail || data.actor?.email;
            const actorName = data.actorName || data.actor?.name;
            if (!actorEmail?.includes(actor) && !actorName?.includes(actor)) {
              return;
            }
          }

          results.push({
            id: doc.id,
            source: coll,
            action: data.action || "unknown",
            actor: {
              name: data.actorName || data.actor?.name || null,
              email: data.actorEmail || data.actor?.email || null,
              role: data.actorRole || data.actor?.role || null,
            },
            timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
            module: data.module || null,
            resourceName: data.resourceName || null,
            resourceType: data.resourceType || null,
            ipAddress: data.ipAddress || null,
            userAgent: data.userAgent || null,
            metadata: data.metadata || null,
          });
        });
      } catch (err) {
        console.warn(`[AuditQuery] Error querying ${coll}:`, err);
      }
    }

    // Sort by timestamp descending
    results.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });

    // Limit total results
    const limitedResults = results.slice(0, resultLimit);

    // Return in requested format
    if (format === "csv") {
      const csv = convertToCSV(limitedResults);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      count: limitedResults.length,
      total: results.length,
      data: limitedResults,
    });
  } catch (error) {
    console.error("[AuditQuery] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/Data/Applications/Admin/AuditLogs/Query
 * Advanced query with body parameters
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      filters = {},
      sort = { field: "timestamp", direction: "desc" },
      pagination = { limit: 100, offset: 0 },
      format = "json",
    } = body;

    // Validate API key
    const apiKey = req.headers.get("x-api-key");
    if (!validateApiKey(apiKey)) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid or missing API key" },
        { status: 401 }
      );
    }

    // Similar logic to GET but with more complex filtering
    // Implementation would support complex AND/OR filters
    
    return NextResponse.json({
      success: true,
      message: "Advanced query endpoint - implement complex filtering logic",
      filters,
      sort,
      pagination,
    });
  } catch (error) {
    console.error("[AuditQuery POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Validate API key
 */
function validateApiKey(apiKey: string | null): boolean {
  // Simple validation - replace with proper key validation
  // In production, check against database or environment variable
  if (!apiKey) return false;
  
  // Example: Check if key starts with "ecoshift_" and has min length
  return apiKey.startsWith("ecoshift_") && apiKey.length > 20;
}

/**
 * Convert results to CSV
 */
function convertToCSV(results: unknown[]): string {
  if (results.length === 0) return "";

  const headers = [
    "id",
    "source",
    "action",
    "actor_name",
    "actor_email",
    "module",
    "resource_name",
    "resource_type",
    "timestamp",
    "ip_address",
    "user_agent",
  ];

  const rows = results.map((row: any) => [
    row.id,
    row.source,
    row.action,
    row.actor?.name || "",
    row.actor?.email || "",
    row.module || "",
    row.resourceName || "",
    row.resourceType || "",
    row.timestamp || "",
    row.ipAddress || "",
    row.userAgent || "",
  ]);

  return [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
}

/**
 * Escape CSV value
 */
function escapeCsv(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
