import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import bcrypt from "bcrypt";
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit";

// Helper to get actor from session/request
function getActorFromRequest(req: NextApiRequest): AuditActor {
  // Extract user info from session cookie or headers
  const userEmail = req.headers["x-user-email"] as string || "system";
  const userRole = req.headers["x-user-role"] as string || "unknown";
  const userId = req.headers["x-user-id"] as string || null;
  
  return {
    uid: userId,
    email: userEmail,
    role: userRole,
  };
}

async function AddUser({ ReferenceID, UserId, Firstname, Lastname, Email, userName, Password, Role, Position, Department, Location, Company, Status, LoginAttempts, LockUntil,
}: {
  ReferenceID: string;
  UserId: string;
  Firstname: string;
  Lastname: string;
  Email: string;
  userName: string;
  Password: string;
  Role: string;
  Position: string;
  Department: string;
  Location: string;
  Company: string;
  Status: string;
  LoginAttempts: string;
  LockUntil: string;
}) {
  const db = await connectToDatabase();
  const userCollection = db.collection("users");

  // Check if email or username already exists
  const existingUser = await userCollection.findOne({
    $or: [{ Email }, { userName }],
  });
  if (existingUser) {
    throw new Error("Email or username already in use");
  }

  // Hash the password using bcrypt
  const hashedPassword = await bcrypt.hash(Password, 10);

  const newUser = {
    ReferenceID,
    UserId,
    Firstname,
    Lastname,
    Email,
    userName,
    Password: hashedPassword,
    Role,
    Position,
    Department,
    Location,
    Company,
    Status,
    LoginAttempts,
    LockUntil,
    createdAt: new Date(),
  };

  // Insert new user into the database
  await userCollection.insertOne(newUser);

  return { success: true, message: "User created successfully", user: { UserId, Firstname, Lastname, Email, Role, Department, Position } };
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
      const result = await AddUser({
        ReferenceID,
        UserId,
        Firstname,
        Lastname,
        Email,
        userName,
        Password,
        Role,
        Position,
        Department,
        Location,
        Company,
        Status,
        LoginAttempts,
        LockUntil,
      });
      
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
