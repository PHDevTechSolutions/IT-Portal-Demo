import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Template ID is required" },
        { status: 400 }
      );
    }
    
    const db = await connectToDatabase();
    const templatesCollection = db.collection("PermissionTemplates");
    
    const result = await templatesCollection.deleteOne({
      $or: [{ id }, { _id: new ObjectId(id) }]
    });
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Template not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "Template deleted successfully"
    });
    
  } catch (error: any) {
    console.error("[DeleteTemplate] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
