import { NextApiRequest, NextApiResponse } from "next"
import { connectToDatabase } from "@/lib/MongoDB"
import { ObjectId } from "mongodb"
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

    const db = await connectToDatabase()
    const UserCollection = db.collection("users")

    const objectIds = ids.map((id) => new ObjectId(id))
    const result = await UserCollection.deleteMany({ _id: { $in: objectIds } })

    // Log audit after successful deletion
    if (result.deletedCount > 0) {
      const actor = getActorFromRequest(req)
      const { ipAddress, userAgent } = getRequestContext(req)
      const actorName = actor.name || actor.email || 'Unknown'
      await logSystemAudit({
        action: "bulk_delete",
        module: "UserManagement",
        page: "/admin/roles",
        resourceType: "user",
        resourceId: null,
        resourceName: `${result.deletedCount} users deleted (by: ${actorName})`,
        actor,
        ipAddress,
        userAgent,
        affectedCount: result.deletedCount,
        source: "UserDeleteAPI",
        metadata: {
          deletedIds: ids,
        },
      })
    }

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found to delete.",
      })
    }

    return res.status(200).json({
      success: true,
      message: "Users deleted successfully.",
      deletedCount: result.deletedCount,
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
