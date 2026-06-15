import { NextApiRequest, NextApiResponse } from "next"
import { supabase } from "@/utils/supabase"
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit"

// Helper to get actor from request
function getActorFromRequest(req: NextApiRequest): AuditActor {
  return {
    uid: req.headers["x-user-id"] as string || null,
    email: req.headers["x-user-email"] as string || "system",
    role: req.headers["x-user-role"] as string || "unknown",
    name: req.headers["x-user-name"] as string || null,
  }
}

// Helper to extract IP and User Agent from request
function getRequestContext(req: NextApiRequest) {
  const forwarded = req.headers["x-forwarded-for"]
  const ip = typeof forwarded === "string" 
    ? forwarded.split(",")[0].trim() 
    : req.socket.remoteAddress || "unknown"
  
  return {
    ipAddress: ip,
    userAgent: req.headers["user-agent"] || null,
  }
}

export default async function deleteAccounts(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    })
  }

  try {
    const { ids } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing 'ids' array.",
      })
    }

    // Delete from Supabase
    const numericIds = ids.filter((id: any) => !isNaN(Number(id))).map(Number);
    const stringIds = ids.filter((id: any) => isNaN(Number(id)));

    let deleteQuery = supabase.from('users').delete({ count: 'exact' });
    
    if (numericIds.length > 0 && stringIds.length > 0) {
      deleteQuery = deleteQuery.or(`id.in.(${numericIds.join(',')}),ReferenceID.in.(${stringIds.map(s => `"${s}"`).join(',')})`);
    } else if (numericIds.length > 0) {
      deleteQuery = deleteQuery.in('id', numericIds);
    } else {
      deleteQuery = deleteQuery.in('ReferenceID', stringIds);
    }

    const { error: deleteError, count: deletedCount } = await deleteQuery;
    const safeDeletedCount = deletedCount ?? 0;

    if (deleteError) throw deleteError;

    // Log audit after successful deletion
    if (safeDeletedCount > 0) {
      const actor = getActorFromRequest(req)
      const { ipAddress, userAgent } = getRequestContext(req)
      const actorName = actor.name || actor.email || 'Unknown'
      await logSystemAudit({
        action: "bulk_delete",
        module: "UserManagement",
        page: "/admin/roles",
        resourceType: "user",
        resourceId: null,
        resourceName: `${safeDeletedCount} users deleted (by: ${actorName})`,
        actor,
        ipAddress,
        userAgent,
        affectedCount: safeDeletedCount,
        source: "UserDeleteAPI",
        metadata: {
          deletedIds: ids,
        },
      })
    }

    if (safeDeletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found to delete.",
      })
    }

    return res.status(200).json({
      success: true,
      message: "Users deleted successfully.",
      deletedCount: safeDeletedCount,
    })
  } catch (error) {
    console.error("Error deleting users:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to delete users.",
      error: error instanceof Error ? error.message : String(error),
    })
  }
}