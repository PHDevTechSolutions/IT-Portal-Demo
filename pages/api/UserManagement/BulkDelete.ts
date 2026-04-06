import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit";

// Helper to get actor from request
function getActorFromRequest(req: NextApiRequest): AuditActor {
  return {
    uid: req.headers["x-user-id"] as string || null,
    email: req.headers["x-user-email"] as string || "system",
    role: req.headers["x-user-role"] as string || "unknown",
    name: req.headers["x-user-name"] as string || null,
  };
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

export default async function bulkDelete(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", ["DELETE"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "Invalid request: userIds must be a non-empty array." });
    }

    const db = await connectToDatabase();
    const userCollection = db.collection("users");

    const objectIds = userIds.map(id => new ObjectId(id));
    const result = await userCollection.deleteMany({ _id: { $in: objectIds } });

    // Log audit after successful bulk delete
    const actor = getActorFromRequest(req);
    const { ipAddress, userAgent } = getRequestContext(req);
    const actorName = actor.name || actor.email || 'Unknown';
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
      source: "UserManagementBulkDeleteAPI",
      metadata: {
        deletedIds: userIds,
      },
    });

    res.status(200).json({ success: true, message: "Users deleted successfully", deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Error deleting users:", error);
    res.status(500).json({ error: "Failed to delete users" });
  }
}
