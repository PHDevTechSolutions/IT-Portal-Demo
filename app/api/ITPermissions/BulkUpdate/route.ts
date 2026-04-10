import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userIds, action, permissions } = body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "userIds array is required" },
        { status: 400 }
      );
    }
    
    if (!action || !["grant", "revoke", "template"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Valid action is required (grant, revoke, or template)" },
        { status: 400 }
      );
    }
    
    const db = await connectToDatabase();
    const usersCollection = db.collection("Login");
    const auditLogCollection = db.collection("PermissionAuditLog");
    
    // Get current user from session/token (simplified - adjust based on your auth)
    const performedBy = "admin"; // TODO: Get from session
    
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    for (const userId of userIds) {
      try {
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!user) {
          results.failed++;
          results.errors.push(`User ${userId} not found`);
          continue;
        }
        
        let newPermissions: string[] = [];
        const currentPermissions = user.Directories || [];
        
        if (action === "grant") {
          // Grant all modules - get all from sidebar modules
          const modules = await db.collection("SidebarModules").find({}).toArray();
          newPermissions = modules.flatMap((m: any) => [
            m.key,
            ...(m.items?.map((item: any) => `${m.key}:${item.title}`) || [])
          ]);
        } else if (action === "revoke") {
          // Revoke all - empty permissions
          newPermissions = [];
        } else if (action === "template" && permissions) {
          // Apply template permissions
          newPermissions = permissions;
        }
        
        // Update user
        await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { 
            $set: { 
              Directories: newPermissions,
              updatedAt: new Date()
            } 
          }
        );
        
        // Log to audit
        await auditLogCollection.insertOne({
          userId,
          userName: `${user.Firstname} ${user.Lastname}`,
          action: action === "template" ? "template_apply" : action,
          targetUserId: userId,
          targetUserName: `${user.Firstname} ${user.Lastname}`,
          changes: newPermissions.map(p => ({
            module: p,
            oldValue: currentPermissions.includes(p),
            newValue: newPermissions.includes(p)
          })),
          timestamp: new Date().toISOString(),
          performedBy,
          reason: action === "template" ? "Bulk template apply" : `Bulk ${action}`
        });
        
        results.updated++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`User ${userId}: ${err.message}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Updated ${results.updated} users, ${results.failed} failed`,
      results
    });
    
  } catch (error: any) {
    console.error("[BulkUpdate] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
