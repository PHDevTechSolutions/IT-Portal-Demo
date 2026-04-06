import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/MongoDB';
import { ObjectId } from 'mongodb';
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

export default async function DeleteUser(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'DELETE') {
        res.setHeader('Allow', ['DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    const { id } = req.body;

    try {
        const db = await connectToDatabase();
        const UserCollection = db.collection('Inventory');

        // Get asset info before deletion for audit log
        const assetToDelete = await UserCollection.findOne({ _id: new ObjectId(id) });

        await UserCollection.deleteOne({ _id: new ObjectId(id) });
        
        // Log audit
        if (assetToDelete) {
          const actor = getActorFromRequest(req);
          await logSystemAudit({
            action: "delete",
            module: "ITAssets",
            page: "/stash/inventory",
            resourceType: "asset",
            resourceId: assetToDelete._id?.toString() || id,
            resourceName: assetToDelete.brand || assetToDelete.model || assetToDelete.serialNumber || "Unknown Asset",
            actor,
            source: "DeleteAssetAPI",
            metadata: {
              type: assetToDelete.type,
              serialNumber: assetToDelete.serialNumber,
              designation: assetToDelete.designation,
            },
          });
        }
        
        res.status(200).json({ success: true, message: 'Asset deleted successfully' });
    } catch (error) {
        console.error('Error deleting data:', error);
        res.status(500).json({ error: 'Failed to delete data' });
    }
}
