import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { getSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { email } = await req.json();
    
    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    // Only allow users to check their own permissions (or Super Admin)
    if (session.email !== email && session.role !== "SuperAdmin") {
      return NextResponse.json(
        { success: false, message: "Access denied" },
        { status: 403 }
      );
    }

    const db = await connectToDatabase();
    
    // Get user's custom permissions from database
    let userPermissions = await db
      .collection("user_permissions")
      .findOne({ email: email });

    // If no custom permissions, get role-based permissions
    if (!userPermissions) {
      const rolePermissions = await db
        .collection("role_permissions")
        .findOne({ 
          role: session.role, 
          department: session.department 
        });

      if (rolePermissions) {
        userPermissions = {
          modules: rolePermissions.modules || [],
          submodules: rolePermissions.submodules || []
        };
      } else {
        userPermissions = { modules: [], submodules: [] };
      }
    } else {
      userPermissions = {
        modules: userPermissions.modules || [],
        submodules: userPermissions.submodules || []
      };
    }

    return NextResponse.json({
      success: true,
      permissions: userPermissions
    });
  } catch (error: any) {
    console.error("Error fetching user permissions:", error);
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
