import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
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

export default async function editAccount(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const { id, UserId, Firstname, Lastname, Email, userName, Password, Role, Position, Department, Location, Company, Status, LoginAttempts, LockUntil } = req.body;

  try {
    const db = await connectToDatabase();
    const userCollection = db.collection("users");

    // Prepare updated fields
    const updatedUser: any = {
      UserId, Firstname, Lastname, Email, userName, Role, Position, Department, Location, Company, Status, LoginAttempts, LockUntil, updatedAt: new Date(),
    };

    // Hash the password only if it is provided and not empty
    if (Password?.trim()) {
      const hashedPassword = await bcrypt.hash(Password, 10);
      updatedUser.Password = hashedPassword; // Make sure it matches the original field name in your DB
    }

    // Update user data
    const result = await userCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedUser }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Log audit
    const actor = getActorFromRequest(req);
    await logSystemAudit({
      action: "update",
      module: "UserManagement",
      page: "/admin/roles",
      resourceType: "user",
      resourceId: UserId || id,
      resourceName: `${Firstname} ${Lastname}`,
      actor,
      source: "EditUserAPI",
      metadata: {
        email: Email,
        role: Role,
        department: Department,
        position: Position,
        changedFields: Object.keys(updatedUser).filter(k => !['updatedAt'].includes(k)),
      },
    });

    res.status(200).json({ success: true, message: "Account updated successfully" });
  } catch (error) {
    console.error("Error updating account:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
}
