import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";
import crypto from "crypto";

// RP (Relying Party) configuration
const RP_NAME = "IT Portal ERP";
const RP_ID = process.env.NODE_ENV === "production" 
  ? process.env.VERCEL_URL || "your-domain.com"
  : "localhost";
const ORIGIN = process.env.NODE_ENV === "production"
  ? `https://${RP_ID}`
  : "http://localhost:3000";

// Generate a random challenge
function generateChallenge(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// Get challenge expiration (5 minutes)
function getChallengeExpiration(): Date {
  return new Date(Date.now() + 5 * 60 * 1000);
}

// POST - Start biometric registration
export async function POST(req: NextRequest) {
  try {
    const { userId, userName, userDisplayName } = await req.json();

    if (!userId || !userName) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const challengesCollection = db.collection("biometric_challenges");
    const credentialsCollection = db.collection("biometric_credentials");

    // Check if user already has credentials
    const existingCredentials = await credentialsCollection.countDocuments({ userId });
    
    // Generate challenge
    const challenge = generateChallenge();
    
    // Store challenge with expiration
    await challengesCollection.insertOne({
      userId,
      challenge,
      type: "registration",
      expiresAt: getChallengeExpiration(),
      createdAt: new Date(),
    });

    // Clean up old challenges
    await challengesCollection.deleteMany({
      userId,
      type: "registration",
      expiresAt: { $lt: new Date() },
    });

    // Create registration options
    const options = {
      challenge,
      rp: {
        name: RP_NAME,
        id: RP_ID,
      },
      user: {
        id: Buffer.from(userId).toString("base64url"),
        name: userName,
        displayName: userDisplayName || userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },   // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
      excludeCredentials: existingCredentials > 0 ? await credentialsCollection
        .find({ userId }, { projection: { credentialId: 1 } })
        .map((doc: any) => ({
          id: doc.credentialId,
          type: "public-key",
        }))
        .toArray() : [],
    };

    return NextResponse.json(options);
  } catch (error: any) {
    console.error("[Biometric Register] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
