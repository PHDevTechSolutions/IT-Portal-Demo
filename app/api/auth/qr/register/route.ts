import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { clientPromise } from "@/lib/MongoDB";

/**
 * QR Code Registration API
 * Generates a QR code for mobile app biometric registration
 */

// Store pending QR registrations (in production, use Redis)
const pendingRegistrations = new Map<string, {
  userId: string;
  userName: string;
  userDisplayName: string;
  createdAt: number;
  status: "pending" | "scanned" | "completed" | "expired";
}>();

// Cleanup expired registrations every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingRegistrations.entries()) {
    if (now - value.createdAt > 5 * 60 * 1000) { // 5 minutes
      pendingRegistrations.delete(key);
    }
  }
}, 60000);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, userName, userDisplayName } = body;

    if (!userId || !userName) {
      return NextResponse.json(
        { error: "Missing required fields: userId, userName" },
        { status: 400 }
      );
    }

    // Generate unique session ID for QR code
    const sessionId = uuidv4();
    
    // Store pending registration
    pendingRegistrations.set(sessionId, {
      userId,
      userName,
      userDisplayName: userDisplayName || userName,
      createdAt: Date.now(),
      status: "pending",
    });

    // Create QR code data - use URL format instead of raw JSON
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "http://localhost:3000";
    
    // Create a URL that can be opened by mobile app or browser
    // Using a universal link format that mobile apps can handle
    const qrData = `${baseUrl}/mobile-register?sessionId=${sessionId}&userId=${userId}&action=biometric_register&expires=${Date.now() + 5 * 60 * 1000}`;

    return NextResponse.json({
      success: true,
      sessionId,
      qrData,
      expiresIn: 300, // 5 minutes in seconds
    });
  } catch (error) {
    console.error("[QR Register] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}

// Check registration status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const registration = pendingRegistrations.get(sessionId);

    if (!registration) {
      return NextResponse.json(
        { error: "Session not found or expired" },
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

    return NextResponse.json({
      success: true,
      status: registration.status,
      userId: registration.userId,
    });
  } catch (error) {
    console.error("[QR Register] Status check error:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}

// Export for use in verify endpoint
export { pendingRegistrations };
