import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

// POST - Remove a biometric credential
export async function POST(req: NextRequest) {
  try {
    const { credentialId } = await req.json();

    if (!credentialId) {
      return NextResponse.json(
        { success: false, message: "Credential ID is required" },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const credentialsCollection = db.collection("biometric_credentials");

    // Delete the credential
    const result = await credentialsCollection.deleteOne({ credentialId });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "Credential not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Credential removed successfully",
    });
  } catch (error: any) {
    console.error("[Biometric Remove] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
