import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";
import crypto from "crypto";

// RP configuration
const RP_ID = process.env.NODE_ENV === "production" 
  ? "it-portal.devtech-erp-solutions.cloud"
  : "localhost";

// Generate a random challenge
function generateChallenge(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// Get challenge expiration (5 minutes)
function getChallengeExpiration(): Date {
  return new Date(Date.now() + 5 * 60 * 1000);
}

// POST - Start biometric authentication
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    const db = await connectToDatabase();
    const challengesCollection = db.collection("biometric_challenges");
    const credentialsCollection = db.collection("biometric_credentials");

    // Get user's credentials
    let credentials;
    if (userId) {
      credentials = await credentialsCollection
        .find({ userId })
        .project({ credentialId: 1 })
        .toArray();
    } else {
      // If no userId provided, we can't look up specific credentials
      // The client should provide a way to identify the user
      return NextResponse.json(
        { success: false, message: "User identification required" },
        { status: 400 }
      );
    }

    if (!credentials || credentials.length === 0) {
      return NextResponse.json(
        { success: false, message: "No biometric credentials found" },
        { status: 404 }
      );
    }

    // Generate challenge
    const challenge = generateChallenge();

    // Store challenge with expiration
    await challengesCollection.insertOne({
      userId,
      challenge,
      type: "authentication",
      expiresAt: getChallengeExpiration(),
      createdAt: new Date(),
    });

    // Clean up old challenges
    await challengesCollection.deleteMany({
      userId,
      type: "authentication",
      expiresAt: { $lt: new Date() },
    });

    // Create authentication options
    const options = {
      challenge,
      rpId: RP_ID,
      allowCredentials: credentials.map((cred: any) => ({
        id: cred.credentialId,
        type: "public-key",
      })),
      userVerification: "required",
      timeout: 60000,
    };

    return NextResponse.json(options);
  } catch (error: any) {
    console.error("[Biometric Authenticate] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
