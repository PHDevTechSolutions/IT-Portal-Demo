import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
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

/**
 * PUT /api/UserManagement/UserUpdate
 *
 * Bug fix: only $set fields that are explicitly included in the request body.
 * Previously, undefined/missing fields like Manager, TSM, TargetQuota were
 * being passed as `undefined` inside $set, which overwrites existing values
 * in MongoDB with null/undefined.
 *
 * Fix: build the $set payload selectively — only include keys that are
 * present in the request body.
 */
export default async function updateAccount(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const {
      id,
      Firstname,
      Lastname,
      Email,
      Department,
      Company,
      Position,
      Role,
      Password,
      Status,
      Manager,
      ManagerName,
      TSM,
      TSMName,
      TargetQuota,
      LoginAttempts,
      LockUntil,
      Directories,
    } = req.body;

    if (!id || !ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing user ID." });
    }

    if (Directories && !Array.isArray(Directories)) {
      return res
        .status(400)
        .json({ success: false, message: "Directories must be an array." });
    }

    const db = await connectToDatabase();
    const userCollection = db.collection("users");

    // Get existing user data first to track changes
    const existingUser = await userCollection.findOne({ _id: new ObjectId(id) });
    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: `User not found for ID: ${id}` });
    }

    // Build $set payload selectively — only include fields present in the body.
    // This prevents overwriting existing DB values with undefined/null.
    const setPayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (Firstname !== undefined) setPayload.Firstname = Firstname;
    if (Lastname !== undefined) setPayload.Lastname = Lastname;
    if (Email !== undefined) setPayload.Email = Email;
    if (Department !== undefined) setPayload.Department = Department;
    if (Company !== undefined) setPayload.Company = Company;
    if (Position !== undefined) setPayload.Position = Position;
    if (Role !== undefined) setPayload.Role = Role;
    if (Status !== undefined) setPayload.Status = Status;
    if (Manager !== undefined) setPayload.Manager = Manager;
    if (ManagerName !== undefined) setPayload.ManagerName = ManagerName;
    if (TSM !== undefined) setPayload.TSM = TSM;
    if (TSMName !== undefined) setPayload.TSMName = TSMName;
    if (TargetQuota !== undefined) setPayload.TargetQuota = TargetQuota;
    if (LoginAttempts !== undefined) setPayload.LoginAttempts = LoginAttempts;
    if (LockUntil !== undefined) setPayload.LockUntil = LockUntil;
    if (Directories !== undefined) setPayload.Directories = Directories;

    // Only hash and include password if a non-empty value was sent
    if (Password?.trim()) {
      setPayload.Password = await bcrypt.hash(Password, 10);
    }

    const result = await userCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: setPayload },
    );

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: `User not found for ID: ${id}` });
    }

    // Build changes object with before/after values
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, afterValue] of Object.entries(setPayload)) {
      if (key === 'updatedAt') continue; // Skip timestamp
      const beforeValue = existingUser[key];
      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        changes[key] = { before: beforeValue, after: afterValue };
      }
    }

    // Log audit after successful update
    const actor = getActorFromRequest(req);
    const { ipAddress, userAgent } = getRequestContext(req);
    const targetUserName = `${Firstname || existingUser.Firstname || ''} ${Lastname || existingUser.Lastname || ''}`.trim() || 'Unknown';
    const actorName = actor.name || actor.email || 'Unknown';
    await logSystemAudit({
      action: "update",
      module: "UserManagement",
      page: "/admin/roles",
      resourceType: "user",
      resourceId: id,
      resourceName: `${targetUserName} (updated by: ${actorName})`,
      actor,
      ipAddress,
      userAgent,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
      source: "UserUpdateAPI",
      metadata: {
        targetUser: targetUserName,
        targetEmail: Email || existingUser.Email,
        targetRole: Role || existingUser.Role,
        targetDepartment: Department || existingUser.Department,
        targetStatus: Status || existingUser.Status,
        changedFields: Object.keys(changes),
        updateLocation: "/admin/roles",
      },
    });

    return res.status(200).json({
      success: true,
      message: "User account updated successfully.",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update user." });
  }
}
