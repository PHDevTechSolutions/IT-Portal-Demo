import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

// GET - Get user's biometric credentials
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const credentialsCollection = db.collection("biometric_credentials");

    // Find all credentials for the user
    const credentials = await credentialsCollection
      .find({ userId })
      .project({
        credentialId: 1,
        createdAt: 1,
        lastUsedAt: 1,
        deviceInfo: 1,
        counter: 1,
      })
      .toArray();

    const formattedCredentials = credentials.map((cred) => ({
      id: cred.credentialId,
      createdAt: cred.createdAt?.toISOString() || new Date().toISOString(),
      lastUsedAt: cred.lastUsedAt?.toISOString() || null,
      deviceInfo: cred.deviceInfo || "Biometric Device",
      counter: cred.counter || 0,
    }));

    return NextResponse.json({
      success: true,
      credentials: formattedCredentials,
    });
  } catch (error: any) {
    console.error("[Biometric Credentials] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
