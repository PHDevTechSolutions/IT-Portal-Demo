import { NextRequest, NextResponse } from "next/server";
import { compareSync } from "bcryptjs";
import jwt from "jsonwebtoken";
import clientPromise from "@/lib/MongoDB";

/**
 * Mobile Biometric Authentication API
 * Mobile app calls this to authenticate with fingerprint
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      credentialId,
      fingerprintHash,
      deviceInfo,
      pinCode, // Optional PIN for extra security
    } = body;

    if (!credentialId) {
      return NextResponse.json(
        { error: "Missing credentialId" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("it_portal");

    // Find the biometric credential
    const credential = await db.collection("biometric_credentials").findOne({
      credentialId,
    });

    if (!credential) {
      return NextResponse.json(
        { error: "Biometric credential not found" },
        { status: 404 }
      );
    }

    // Check if credential is linked to a valid user
    const user = await db.collection("users").findOne({
      _id: credential.userId,
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify optional PIN if set
    if (credential.pinCode && pinCode) {
      const pinMatch = compareSync(pinCode, credential.pinCode);
      if (!pinMatch) {
        return NextResponse.json(
          { error: "Invalid PIN code" },
          { status: 401 }
        );
      }
    }

    // Update last used timestamp
    await db.collection("biometric_credentials").updateOne(
      { _id: credential._id },
      { $set: { lastUsed: new Date() } }
    );

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.Email,
        role: user.Role,
        type: "biometric_mobile",
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.Email,
        firstname: user.Firstname,
        lastname: user.Lastname,
        role: user.Role,
      },
    });
  } catch (error) {
    console.error("[Mobile Auth] Error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
