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

export default async function bulkTransfer(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const { userIds, tsmReferenceID } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "Invalid request: userIds must be a non-empty array." });
    }

    if (!tsmReferenceID) {
      return res.status(400).json({ error: "Invalid request: tsmReferenceID must be provided." });
    }

    const db = await connectToDatabase();
    const userCollection = db.collection("users");

    const objectIds = userIds.map(id => new ObjectId(id));

    // Update only the TSM field for the selected users
    const result = await userCollection.updateMany(
      { _id: { $in: objectIds } },
      { $set: { TSM: tsmReferenceID } }  // Using TSM instead of TSMReferenceID
    );

    // Log audit after successful bulk transfer
    const actor = getActorFromRequest(req);
    const { ipAddress, userAgent } = getRequestContext(req);
    const actorName = actor.name || actor.email || 'Unknown';
    await logSystemAudit({
      action: "transfer",
      module: "UserManagement",
      page: "/admin/roles",
      resourceType: "user",
      resourceId: null,
      resourceName: `${result.modifiedCount} users transferred (by: ${actorName})`,
      actor,
      ipAddress,
      userAgent,
      affectedCount: result.modifiedCount,
      source: "UserManagementBulkTransferAPI",
      metadata: {
        userIds,
        tsmReferenceID,
      },
    });

    res.status(200).json({
      success: true,
      message: `Transferred ${result.modifiedCount} users to TSM with ReferenceID ${tsmReferenceID}`,
    });
  } catch (error) {
    console.error("Error transferring users:", error);
    res.status(500).json({ error: "Failed to transfer users" });
  }
}
