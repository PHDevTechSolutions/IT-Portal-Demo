import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
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
    // Get existing user
    let fetchQuery = supabase.from('users').select('*');
    if (!isNaN(Number(id))) {
      fetchQuery = fetchQuery.or(`id.eq.${id},ReferenceID.eq.${id}`);
    } else {
      fetchQuery = fetchQuery.eq('ReferenceID', id);
    }

    const { data: users, error: fetchError } = await fetchQuery;

    if (fetchError) throw fetchError;
    const existingUser = users && users.length > 0 ? users[0] : null;

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prepare updated fields
    const updatedUser: any = {
      UserId, Firstname, Lastname, Email, userName, Role, Position, Department, Location, Company, Status, LoginAttempts, LockUntil, updatedAt: new Date(),
    };

    // Hash the password only if it is provided and not empty
    if (Password?.trim()) {
      const hashedPassword = await bcrypt.hash(Password, 10);
      updatedUser.Password = hashedPassword;
    }

    // Update user data in Supabase
    const { error: updateError } = await supabase
      .from('users')
      .update(updatedUser)
      .eq('id', existingUser.id);

    if (updateError) throw updateError;

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
  } catch (error: any) {
    console.error("Error updating account:", error.message);
    res.status(500).json({ error: "Failed to update user" });
  }
}
