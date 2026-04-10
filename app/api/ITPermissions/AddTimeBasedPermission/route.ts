import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, permission, startDate, endDate } = body;
    
    if (!userId || !permission || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, message: "userId, permission, startDate, and endDate are required" },
        { status: 400 }
      );
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end <= start) {
      return NextResponse.json(
        { success: false, message: "End date must be after start date" },
        { status: 400 }
      );
    }
    
    const db = await connectToDatabase();
    const timeBasedCollection = db.collection("TimeBasedPermissions");
    const usersCollection = db.collection("Login");
    
    // Verify user exists
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }
    
    const timeBasedPermission = {
      _id: new ObjectId(),
      id: new ObjectId().toString(),
      userId,
      permission,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      isActive: true,
      createdBy: "admin", // TODO: Get from session
      createdAt: new Date().toISOString(),
    };
    
    await timeBasedCollection.insertOne(timeBasedPermission);
    
    return NextResponse.json({
      success: true,
      message: "Time-based permission added successfully",
      permission: timeBasedPermission
    });
    
  } catch (error: any) {
    console.error("[AddTimeBasedPermission] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
