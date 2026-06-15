import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import bcrypt from "bcrypt";
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit";

// Helper to get actor from request headers
function getActorFromRequest(req: NextApiRequest): AuditActor {
  return {
    uid:   (req.headers["x-user-id"]    as string) || null,
    email: (req.headers["x-user-email"] as string) || "system",
    role:  (req.headers["x-user-role"]  as string) || "unknown",
    name:  (req.headers["x-user-name"]  as string) || null,
  };
}

async function AddUser(userData: any) {
  const { Email, userName, Password } = userData;

  // Check if email or username already exists
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('Email, userName')
    .or(`Email.eq.${Email},userName.eq.${userName}`);

  if (fetchError) throw fetchError;
  if (existingUser && existingUser.length > 0) {
    throw new Error("Email or username already in use");
  }

  // Hash the password using bcrypt
  const hashedPassword = await bcrypt.hash(Password, 10);

  const newUser = {
    ...userData,
    Password: hashedPassword,
    createdAt: new Date(),
  };

  // Insert new user into the database
  const { error: insertError } = await supabase
    .from('users')
    .insert([newUser]);

  if (insertError) throw insertError;

  return { success: true, message: "User created successfully", user: { UserId: userData.UserId, Firstname: userData.Firstname, Lastname: userData.Lastname, Email: userData.Email, Role: userData.Role, Department: userData.Department, Position: userData.Position } };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const { ReferenceID, UserId, Firstname, Lastname, Email, userName, Password, Role, Position, Department, Location, Company, Status, LoginAttempts, LockUntil } =
      req.body;

    // Validate required fields
    if (!ReferenceID || !Firstname || !Lastname || !Email || !userName || !Password || !Role || !Position || !Department || !Location || !Company || !Status || !LoginAttempts || !LockUntil) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    try {
      const result = await AddUser(req.body);
      
      // Log audit
      const actor = getActorFromRequest(req);
      await logSystemAudit({
        action: "create",
        module: "UserManagement",
        page: "/admin/roles",
        resourceType: "user",
        resourceId: UserId,
        resourceName: `${Firstname} ${Lastname}`,
        actor,
        source: "CreateUserAPI",
        metadata: {
          email: Email,
          role: Role,
          department: Department,
          position: Position,
        },
      });
      
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error:", error.message);
      res.status(400).json({
        success: false,
        message: error.message || "An error occurred while creating the user",
      });
    }
  } else {
    res.status(405).json({
      success: false,
      message: "Method Not Allowed",
    });
  }
}
