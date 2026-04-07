import { NextRequest, NextResponse } from "next/server";
import { clientPromise } from "@/lib/MongoDB";
import { pendingRegistrations } from "../register/route";

/**
 * QR Code Verification API
 * Mobile app calls this after scanning QR and capturing fingerprint
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      sessionId, 
      credentialId, 
      publicKey,
      deviceInfo,
      fingerprintHash, // Optional: hash of fingerprint data
    } = body;

    if (!sessionId || !credentialId) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, credentialId" },
        { status: 400 }
      );
    }

    // Check if session exists
    const registration = pendingRegistrations.get(sessionId);
    
    if (!registration) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 404 }
      );
    }

    // Check if expired
    if (Date.now() - registration.createdAt > 5 * 60 * 1000) {
      pendingRegistrations.delete(sessionId);
      return NextResponse.json(
        { error: "Session expired" },
        { status: 410 }
      );
    }

    // Check if already completed
    if (registration.status === "completed") {
      return NextResponse.json(
        { error: "Session already used" },
        { status: 409 }
      );
    }

    const client = await clientPromise;
    const db = client.db("it_portal");

    // Check if credential already exists
    const existingCredential = await db.collection("biometric_credentials").findOne({
      credentialId,
    });

    if (existingCredential) {
      return NextResponse.json(
        { error: "Credential already registered" },
        { status: 409 }
      );
    }

    // Store the biometric credential
    await db.collection("biometric_credentials").insertOne({
      userId: registration.userId,
      credentialId,
      publicKey: publicKey || null,
      fingerprintHash: fingerprintHash || null,
      deviceInfo: deviceInfo || "Mobile Device",
      type: "qr_mobile",
      createdAt: new Date(),
      lastUsed: null,
    });

    // Update session status
    registration.status = "completed";
    pendingRegistrations.set(sessionId, registration);

    return NextResponse.json({
      success: true,
      message: "Biometric credential registered successfully",
      userId: registration.userId,
    });
  } catch (error) {
    console.error("[QR Verify] Error:", error);
    return NextResponse.json(
      { error: "Failed to verify registration" },
      { status: 500 }
    );
  }
}
