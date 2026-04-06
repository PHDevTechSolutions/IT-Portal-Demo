import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { requireSuperAdmin } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    // Verify Super Admin access
    await requireSuperAdmin();
    
    const db = await connectToDatabase();
    
    // Fetch users from IT department or with IT-related roles
    const users = await db
      .collection("users")
      .find({
        $or: [
          { Department: "IT" },
          { Department: "Dev-Team" },
          { Role: { $in: ["IT Staff", "IT Admin", "IT Manager", "IT Support", "Developer"] } },
        ],
      })
      .project({
        _id: 1,
        ReferenceID: 1,
        Firstname: 1,
        Lastname: 1,
        Email: 1,
        Department: 1,
        Company: 1,
        Position: 1,
        Role: 1,
        Status: 1,
        Directories: 1,
      })
      .toArray();

    return NextResponse.json({
      success: true,
      users: users.map((user: any) => ({
        ...user,
        _id: user._id.toString(),
      })),
    });
  } catch (error: any) {
    console.error("Error fetching IT users:", error);
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    if (error.message === "Forbidden: Super Admin access required") {
      return NextResponse.json(
        { success: false, message: "Forbidden: Super Admin access required" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Failed to fetch IT users" },
      { status: 500 }
    );
  }
}
