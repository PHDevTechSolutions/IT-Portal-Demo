import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    
    const db = await connectToDatabase();
    const templatesCollection = db.collection("PermissionTemplates");
    
    const query = role && role !== "all" ? { role: { $in: [role, "all"] } } : {};
    
    const templates = await templatesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    
    return NextResponse.json({
      success: true,
      templates: templates.map(t => ({
        id: t.id || t._id.toString(),
        name: t.name,
        description: t.description,
        permissions: t.permissions,
        role: t.role,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }))
    });
    
  } catch (error: any) {
    console.error("[FetchTemplates] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
