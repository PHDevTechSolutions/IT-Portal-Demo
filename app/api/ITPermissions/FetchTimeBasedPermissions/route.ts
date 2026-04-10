import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const includeExpired = searchParams.get("includeExpired") === "true";
    
    const db = await connectToDatabase();
    const timeBasedCollection = db.collection("TimeBasedPermissions");
    
    const query: any = {};
    if (userId) query.userId = userId;
    if (!includeExpired) {
      query.endDate = { $gte: new Date().toISOString() };
      query.isActive = true;
    }
    
    const permissions = await timeBasedCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    
    // Deactivate expired permissions
    const now = new Date().toISOString();
    const expiredPermissions = permissions.filter(
      (p: any) => p.endDate < now && p.isActive
    );
    
    for (const expired of expiredPermissions) {
      await timeBasedCollection.updateOne(
        { _id: expired._id },
        { $set: { isActive: false } }
      );
    }
    
    return NextResponse.json({
      success: true,
      permissions: permissions.map((p: any) => ({
        id: p.id || p._id.toString(),
        userId: p.userId,
        permission: p.permission,
        startDate: p.startDate,
        endDate: p.endDate,
        isActive: p.endDate >= now ? p.isActive : false,
        createdBy: p.createdBy,
        createdAt: p.createdAt,
      }))
    });
    
  } catch (error: any) {
    console.error("[FetchTimeBasedPermissions] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
