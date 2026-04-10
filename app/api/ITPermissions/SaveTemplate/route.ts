import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, permissions, role } = body;
    
    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, message: "Name and permissions array are required" },
        { status: 400 }
      );
    }
    
    const db = await connectToDatabase();
    const templatesCollection = db.collection("PermissionTemplates");
    
    const template = {
      _id: new ObjectId(),
      id: new ObjectId().toString(),
      name,
      description: description || "",
      permissions,
      role: role || "all",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await templatesCollection.insertOne(template);
    
    return NextResponse.json({
      success: true,
      message: "Template saved successfully",
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        permissions: template.permissions,
        role: template.role,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      }
    });
    
  } catch (error: any) {
    console.error("[SaveTemplate] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
