import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit";
import type { NextRequest } from "next/server";

// Helper to get actor from request headers
function getActorFromRequest(req: NextRequest): AuditActor {
  return {
    uid: req.headers.get("x-user-id") || null,
    email: req.headers.get("x-user-email") || "system",
    role: req.headers.get("x-user-role") || "unknown",
    name: req.headers.get("x-user-name") || null,
  };
}

// Helper to extract IP and User Agent from request
function getRequestContext(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded 
    ? forwarded.split(",")[0].trim() 
    : "unknown"
  
  return {
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") || null,
  }
}

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
    throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const Xchire_sql = neon(Xchire_databaseUrl);

async function bulkdelete(userIds: string[]) {
    try {
        if (!userIds || userIds.length === 0) {
            throw new Error("No user IDs provided.");
        }

        const Xchire_delete = await Xchire_sql`
            DELETE FROM accounts 
            WHERE id = ANY(${userIds})
            RETURNING *;
        `;

        return { success: true, data: Xchire_delete };
    } catch (error: any) {
        console.error("Error deleting users:", error);
        return { success: false, error: error.message || "Failed to delete users." };
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const Xchire_body = await req.json();
        const { userIds } = Xchire_body;

        const Xchire_result = await bulkdelete(userIds);

        // Log audit after successful bulk delete
        if (Xchire_result.success) {
            const actor = getActorFromRequest(req);
            const { ipAddress, userAgent } = getRequestContext(req);
            const deletedCount = Xchire_result.data?.length || userIds.length;
            await logSystemAudit({
                action: "bulk_delete",
                module: "CustomerDatabase",
                page: "/taskflow/customer-database",
                resourceType: "customer",
                resourceId: null,
                resourceName: `${deletedCount} customers deleted`,
                actor,
                ipAddress,
                userAgent,
                affectedCount: deletedCount,
                source: "CustomerDatabaseBulkDeleteAPI",
                metadata: {
                    deletedIds: userIds,
                },
            });
        }

        return NextResponse.json(Xchire_result);
    } catch (Xchire_error: any) {
        console.error("Error in DELETE /api/bulk-delete:", Xchire_error);
        return NextResponse.json(
            { success: false, error: Xchire_error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
