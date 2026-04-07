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
    
    // Get user's permissions from the users collection (Directories field)
    const user = await db
      .collection("users")
      .findOne({ Email: email });

    let userPermissions: { modules: string[]; submodules: string[] };

    if (user && user.Directories && Array.isArray(user.Directories)) {
      // Parse Directories array to extract modules and submodules
      const directories: string[] = user.Directories;
      
      const modules: string[] = [];
      const submodules: string[] = [];
      
      directories.forEach((dir) => {
        if (dir.includes(':')) {
          // It's a submodule (e.g., "taskflow:Activity Logs")
          submodules.push(dir);
          // Also add the parent module if not already present
          const moduleKey = dir.split(':')[0];
          if (!modules.includes(moduleKey)) {
            modules.push(moduleKey);
          }
        } else {
          // It's a module (e.g., "dashboard", "taskflow")
          if (!modules.includes(dir)) {
            modules.push(dir);
          }
        }
      });
      
      userPermissions = { modules, submodules };
    } else {
      // No explicit permissions = no access
      userPermissions = { 
        modules: [], 
        submodules: []
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
