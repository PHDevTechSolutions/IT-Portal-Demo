import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit";

// Helper to get actor from session/request
function getActorFromRequest(req: NextApiRequest): AuditActor {
  const userEmail = req.headers["x-user-email"] as string || "system";
  const userRole = req.headers["x-user-role"] as string || "unknown";
  const userId = req.headers["x-user-id"] as string || null;
  
  return {
    uid: userId,
    email: userEmail,
    role: userRole,
  };
}

export default async function createAsset(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection("Inventory");

    const newAsset = req.body;
    const result = await collection.insertOne(newAsset);

    // Log audit
    const actor = getActorFromRequest(req);
    await logSystemAudit({
      action: "create",
      module: "ITAssets",
      page: "/stash/inventory",
      resourceType: "asset",
      resourceId: result.insertedId?.toString() || null,
      resourceName: newAsset.brand || newAsset.model || newAsset.serialNumber || "Unknown Asset",
      actor,
      source: "CreateAssetAPI",
      metadata: {
        type: newAsset.type,
        serialNumber: newAsset.serialNumber,
        designation: newAsset.designation,
      },
    });

    res.status(201).json({ message: "Asset created successfully", insertedId: result.insertedId });
  } catch (error) {
    console.error("Error creating asset:", error);
    res.status(500).json({ error: "Failed to create asset" });
  }
}
