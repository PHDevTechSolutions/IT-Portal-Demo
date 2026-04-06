import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";
import { requireSuperAdmin } from "@/lib/auth/session";
import { logSystemAudit } from "@/lib/audit/system-audit";

export async function POST(req: NextRequest) {
  try {
    // Verify Super Admin access
    const session = await requireSuperAdmin();

    const { userId, permissions } = await req.json();

    if (!userId || !Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: userId and permissions" },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();

    // Update user permissions in the Directories field
    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          Directories: permissions,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Log the permission change for audit purposes (MongoDB internal log)
    await db.collection("permission_logs").insertOne({
      userId: userId,
      action: "update_permissions",
      permissions: permissions,
      performedBy: session.userId,
      performedByRole: session.role,
      timestamp: new Date(),
    });

    // Also log to Firebase system audits for centralized tracking
    await logSystemAudit({
      action: "update",
      module: "ITPermissions",
      page: "/admin/it-permissions",
      resourceType: "permissions",
      resourceId: userId,
      resourceName: `User ${userId}`,
      actor: {
        uid: session.userId,
        email: session.email,
        role: session.role,
      },
      source: "UpdatePermissionsAPI",
      metadata: {
        updatedPermissions: permissions,
        targetUserId: userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Permissions updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating permissions:", error);
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
      { success: false, message: "Failed to update permissions" },
      { status: 500 }
    );
  }
}
