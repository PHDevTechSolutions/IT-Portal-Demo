import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sourceUserId, targetUserIds, permissions } = body;
    
    if (!sourceUserId || !targetUserIds || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "Source user and target users are required" },
        { status: 400 }
      );
    }
    
    const db = await connectToDatabase();
    const usersCollection = db.collection("Login");
    const auditLogCollection = db.collection("PermissionAuditLog");
    
    const performedBy = "admin"; // TODO: Get from session
    
    // Get source user info
    const sourceUser = await usersCollection.findOne({ _id: new ObjectId(sourceUserId) });
    if (!sourceUser) {
      return NextResponse.json(
        { success: false, message: "Source user not found" },
        { status: 404 }
      );
    }
    
    const permissionsToCopy = permissions || sourceUser.Directories || [];
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    for (const targetUserId of targetUserIds) {
      try {
        const targetUser = await usersCollection.findOne({ _id: new ObjectId(targetUserId) });
        if (!targetUser) {
          results.failed++;
          results.errors.push(`Target user ${targetUserId} not found`);
          continue;
        }
        
        const oldPermissions = targetUser.Directories || [];
        
        // Update target user with copied permissions
        await usersCollection.updateOne(
          { _id: new ObjectId(targetUserId) },
          { 
            $set: { 
              Directories: permissionsToCopy,
              updatedAt: new Date()
            } 
          }
        );
        
        // Log to audit
        await auditLogCollection.insertOne({
          userId: targetUserId,
          userName: `${targetUser.Firstname} ${targetUser.Lastname}`,
          action: "copy",
          targetUserId,
          targetUserName: `${targetUser.Firstname} ${targetUser.Lastname}`,
          changes: permissionsToCopy.map((p: string) => ({
            module: p,
            oldValue: oldPermissions.includes(p),
            newValue: permissionsToCopy.includes(p)
          })),
          timestamp: new Date().toISOString(),
          performedBy,
          sourceUserId,
          sourceUserName: `${sourceUser.Firstname} ${sourceUser.Lastname}`,
          reason: `Copied from ${sourceUser.Firstname} ${sourceUser.Lastname}`
        });
        
        results.updated++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`User ${targetUserId}: ${err.message}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Copied permissions to ${results.updated} users, ${results.failed} failed`,
      results
    });
    
  } catch (error: any) {
    console.error("[CopyPermissions] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
