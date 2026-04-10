import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const skip = parseInt(searchParams.get("skip") || "0");
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");
    
    const db = await connectToDatabase();
    const auditLogCollection = db.collection("PermissionAuditLog");
    
    const query: any = {};
    if (userId) query.userId = userId;
    if (action && action !== "all") query.action = action;
    
    const logs = await auditLogCollection
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    const total = await auditLogCollection.countDocuments(query);
    
    return NextResponse.json({
      success: true,
      logs: logs.map((log: any) => ({
        id: log._id.toString(),
        userId: log.userId,
        userName: log.userName,
        action: log.action,
        targetUserId: log.targetUserId,
        targetUserName: log.targetUserName,
        changes: log.changes,
        timestamp: log.timestamp,
        performedBy: log.performedBy,
        reason: log.reason,
        sourceUserId: log.sourceUserId,
        sourceUserName: log.sourceUserName,
      })),
      total,
      hasMore: skip + logs.length < total
    });
    
  } catch (error: any) {
    console.error("[FetchAuditLog] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
