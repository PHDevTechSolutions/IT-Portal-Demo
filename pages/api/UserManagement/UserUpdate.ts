import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
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
      ContactNumber,
      profilePicture,
      Address,
      AnotherNumber,
      Birthday,
      Gender,
      OtherEmail,
      Connection,
      signatureImage,
      SecondaryEmail,
      pin,
      registrationMethod,
      twoFactorEnabled,
      otp,
      otpExpiry,
      permissions,
      credentials,
      faceDescriptors,
      faceVerificationEnabled,
      DeviceId,
    } = req.body;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing user ID." });
    }

    if (Directories && !Array.isArray(Directories)) {
      return res
        .status(400)
        .json({ success: false, message: "Directories must be an array." });
    }

    // Get existing user data first from Supabase
    // id could be the numeric primary key 'id' or the custom 'ReferenceID' string
    let fetchQuery = supabase.from('users').select('*');
    if (!isNaN(Number(id))) {
      fetchQuery = fetchQuery.or(`id.eq.${id},ReferenceID.eq.${id}`);
    } else {
      fetchQuery = fetchQuery.eq('ReferenceID', id);
    }

    const { data: existingUsers, error: fetchError } = await fetchQuery;

    if (fetchError) throw fetchError;

    if (!existingUsers || existingUsers.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: `User not found for ID: ${id}` });
    }
    const existingUser = existingUsers[0] as any;

    // Build the updates
    const updates: any = {
      Firstname: Firstname ?? existingUser.Firstname,
      Lastname: Lastname ?? existingUser.Lastname,
      Email: Email ?? existingUser.Email,
      Department: Department ?? existingUser.Department,
      Company: Company ?? existingUser.Company,
      Position: Position ?? existingUser.Position,
      Role: Role ?? existingUser.Role,
      Status: Status ?? existingUser.Status,
      Manager: Manager ?? existingUser.Manager,
      ManagerName: ManagerName ?? existingUser.ManagerName,
      TSM: TSM ?? existingUser.TSM,
      TSMName: TSMName ?? existingUser.TSMName,
      TargetQuota: TargetQuota ?? existingUser.TargetQuota,
      LoginAttempts: LoginAttempts ?? existingUser.LoginAttempts,
      LockUntil: LockUntil ?? existingUser.LockUntil,
      ContactNumber: ContactNumber ?? existingUser.ContactNumber,
      profilePicture: profilePicture ?? existingUser.profilePicture,
      Address: Address ?? existingUser.Address,
      AnotherNumber: AnotherNumber ?? existingUser.AnotherNumber,
      Birthday: Birthday ?? existingUser.Birthday,
      Gender: Gender ?? existingUser.Gender,
      OtherEmail: OtherEmail ?? existingUser.OtherEmail,
      Connection: Connection ?? existingUser.Connection,
      signatureImage: signatureImage ?? existingUser.signatureImage,
      SecondaryEmail: SecondaryEmail ?? existingUser.SecondaryEmail,
      pin: pin ?? existingUser.pin,
      registrationMethod: registrationMethod ?? existingUser.registrationMethod,
      twoFactorEnabled: twoFactorEnabled ?? existingUser.twoFactorEnabled,
      otp: otp ?? existingUser.otp,
      otpExpiry: otpExpiry ? new Date(otpExpiry) : existingUser.otpExpiry,
      permissions: permissions !== undefined ? permissions : existingUser.permissions,
      credentials: credentials !== undefined ? credentials : existingUser.credentials,
      faceDescriptors: faceDescriptors !== undefined ? faceDescriptors : existingUser.faceDescriptors,
      faceVerificationEnabled: faceVerificationEnabled ?? existingUser.faceVerificationEnabled,
      DeviceId: DeviceId ?? existingUser.DeviceId,
      Directories: Directories !== undefined ? Directories : existingUser.Directories,
      updatedAt: new Date()
    };

    if (Password?.trim()) {
      updates.Password = await bcrypt.hash(Password, 10);
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', existingUser.id); // Use the actual numeric ID for the update to be safe

    if (updateError) throw updateError;

    // Build changes object with before/after values
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    // Create a comparison object
    const updateFields = {
      Firstname, Lastname, Email, Department, Company, Position, Role, Status,
      Manager, ManagerName, TSM, TSMName, TargetQuota, LoginAttempts, LockUntil,
      Directories, ContactNumber, profilePicture, Address, AnotherNumber,
      Birthday, Gender, OtherEmail, Connection, signatureImage, SecondaryEmail,
      pin, registrationMethod, twoFactorEnabled, otp, otpExpiry, permissions,
      credentials, faceDescriptors, faceVerificationEnabled, DeviceId
    };
    for (const [key, afterValue] of Object.entries(updateFields)) {
      if (afterValue === undefined) continue;
      // Handle JSON fields
      let beforeValue = existingUser[key];
      let afterCompare = afterValue;
      if (['permissions', 'credentials', 'faceDescriptors', 'Directories'].includes(key)) {
        if (typeof beforeValue === 'string') {
          try { beforeValue = JSON.parse(beforeValue); } catch { /* keep as string */ }
        }
        if (typeof afterCompare !== 'string') {
          afterCompare = JSON.stringify(afterCompare);
        }
      }
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
