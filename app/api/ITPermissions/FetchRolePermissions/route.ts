import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { requireSuperAdmin } from "@/lib/auth/session";

// Default permissions for IT roles
const DEFAULT_ROLE_PERMISSIONS = [
  {
    role: "IT Admin",
    department: "IT",
    modules: ["applications", "taskflow", "stash", "help-desk", "cloudflare", "user-accounts", "settings", "acculog"],
    submodules: [
      "applications:Modules",
      "taskflow:Customer Database",
      "taskflow:Removal Accounts",
      "taskflow:Customer Audits",
      "taskflow:Audit Logs",
      "taskflow:Approval of Accounts",
      "taskflow:Activity Logs",
      "taskflow:Progress Logs",
      "taskflow:Endorsed Tickets",
      "stash:Inventory",
      "stash:Assigned Assets",
      "stash:License",
      "help-desk:Tickets",
      "help-desk:Service Catalogue",
      "cloudflare:DNS",
      "user-accounts:Roles",
      "user-accounts:Resigned and Terminated",
      "user-accounts:Sessions",
      "user-accounts:IT Permissions",
      "settings:General",
      "acculog:Activity Logs",
    ],
  },
  {
    role: "IT Manager",
    department: "IT",
    modules: ["applications", "taskflow", "stash", "help-desk", "cloudflare", "user-accounts", "settings", "acculog"],
    submodules: [
      "applications:Modules",
      "taskflow:Customer Database",
      "taskflow:Removal Accounts",
      "taskflow:Customer Audits",
      "taskflow:Audit Logs",
      "taskflow:Approval of Accounts",
      "taskflow:Activity Logs",
      "taskflow:Progress Logs",
      "taskflow:Endorsed Tickets",
      "stash:Inventory",
      "stash:Assigned Assets",
      "stash:License",
      "help-desk:Tickets",
      "help-desk:Service Catalogue",
      "cloudflare:DNS",
      "user-accounts:Roles",
      "user-accounts:Resigned and Terminated",
      "user-accounts:Sessions",
      "user-accounts:IT Permissions",
      "settings:General",
      "acculog:Activity Logs",
    ],
  },
  {
    role: "IT Staff",
    department: "IT",
    modules: ["stash", "help-desk", "settings", "acculog"],
    submodules: [
      "stash:Inventory",
      "stash:Assigned Assets",
      "help-desk:Tickets",
      "help-desk:Service Catalogue",
      "settings:General",
      "acculog:Activity Logs",
    ],
  },
  {
    role: "IT Support",
    department: "IT",
    modules: ["help-desk", "settings", "acculog"],
    submodules: [
      "help-desk:Tickets",
      "help-desk:Service Catalogue",
      "settings:General",
      "acculog:Activity Logs",
    ],
  },
  {
    role: "Developer",
    department: "IT",
    modules: ["applications", "cloudflare", "user-accounts", "settings", "acculog"],
    submodules: [
      "applications:Modules",
      "cloudflare:DNS",
      "user-accounts:Roles",
      "user-accounts:Sessions",
      "user-accounts:IT Permissions",
      "settings:General",
      "acculog:Activity Logs",
    ],
  },
];

interface RolePermission {
  role: string;
  department: string;
  modules: string[];
  submodules: string[];
  _id?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function GET(req: NextRequest) {
  try {
    // Verify Super Admin access
    await requireSuperAdmin();
    
    const db = await connectToDatabase();
    
    // Try to fetch from database first
    let permissions = await db
      .collection("role_permissions")
      .find({ department: "IT" })
      .toArray() as RolePermission[];

    // If no permissions found, use defaults
    if (!permissions || permissions.length === 0) {
      permissions = DEFAULT_ROLE_PERMISSIONS;
      
      // Insert defaults into database for future customization
      await db.collection("role_permissions").insertMany(
        DEFAULT_ROLE_PERMISSIONS.map((p: RolePermission) => ({
          ...p,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        { ordered: false }
      );
    }

    return NextResponse.json({
      success: true,
      permissions: permissions.map((p: RolePermission) => ({
        ...p,
        _id: p._id?.toString(),
      })),
    });
  } catch (error: any) {
    console.error("Error fetching role permissions:", error);
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
    // Return defaults on error
    return NextResponse.json({
      success: true,
      permissions: DEFAULT_ROLE_PERMISSIONS,
    });
  }
}
