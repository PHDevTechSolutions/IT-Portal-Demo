import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";
import crypto from "crypto";

// COSE algorithm identifiers
const COSE_ALG_ES256 = -7;
const COSE_ALG_RS256 = -257;

// Verify registration response
export async function POST(req: NextRequest) {
  try {
    const { userId, credentialId, clientDataJSON, attestationObject } = await req.json();

    if (!userId || !credentialId || !clientDataJSON || !attestationObject) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const challengesCollection = db.collection("biometric_challenges");
    const credentialsCollection = db.collection("biometric_credentials");

    // Verify challenge exists and is valid
    const challengeDoc = await challengesCollection.findOne({
      userId,
      type: "registration",
      expiresAt: { $gt: new Date() },
    });

    if (!challengeDoc) {
      return NextResponse.json(
        { success: false, message: "Challenge expired or invalid" },
        { status: 400 }
      );
    }

    // Parse client data
    const clientData = JSON.parse(
      Buffer.from(clientDataJSON, "base64url").toString("utf-8")
    );

    // Verify challenge matches
    const expectedChallenge = challengeDoc.challenge;
    if (clientData.challenge !== expectedChallenge) {
      return NextResponse.json(
        { success: false, message: "Challenge mismatch" },
        { status: 400 }
      );
    }

    // Verify origin
    const expectedOrigin = process.env.NODE_ENV === "production"
      ? `https://${process.env.VERCEL_URL || "your-domain.com"}`
      : "http://localhost:3000";
    
    if (clientData.origin !== expectedOrigin) {
      return NextResponse.json(
        { success: false, message: "Origin mismatch" },
        { status: 400 }
      );
    }

    // Verify type is webauthn.create
    if (clientData.type !== "webauthn.create") {
      return NextResponse.json(
        { success: false, message: "Invalid type" },
        { status: 400 }
      );
    }

    // Parse attestation object (simplified - in production, use a library like @simplewebauthn/server)
    const attestationBuffer = Buffer.from(attestationObject, "base64url");
    
    // For simplicity, we'll store the credential and trust the browser's attestation
    // In production, you should properly verify the attestation statement

    // Check if credential already exists
    const existingCredential = await credentialsCollection.findOne({ credentialId });
    if (existingCredential) {
      return NextResponse.json(
        { success: false, message: "Credential already registered" },
        { status: 409 }
      );
    }

    // Store the credential
    await credentialsCollection.insertOne({
      userId,
      credentialId,
      clientDataJSON,
      attestationObject,
      counter: 0,
      createdAt: new Date(),
      lastUsedAt: null,
      deviceInfo: "Biometric Device", // Could be enhanced with user agent parsing
    });

    // Clean up the challenge
    await challengesCollection.deleteOne({ _id: challengeDoc._id });

    return NextResponse.json({
      success: true,
      message: "Biometric credential registered successfully",
      credentialId,
    });
  } catch (error: any) {
    console.error("[Biometric Verify Registration] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
