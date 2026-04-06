import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";

// POST - Lookup user by email for biometric authentication
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const usersCollection = db.collection("users");
    const credentialsCollection = db.collection("biometric_credentials");

    // Find user by email
    const user = await usersCollection.findOne({ Email: email });
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const userId = user._id.toString();

    // Check if user has biometric credentials registered
    const credentialsCount = await credentialsCollection.countDocuments({ userId });
    if (credentialsCount === 0) {
      return NextResponse.json(
        { success: false, message: "No biometric credentials registered. Please register in your account settings first." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      userId,
      email: user.Email,
      firstName: user.Firstname,
      lastName: user.Lastname,
    });
  } catch (error: any) {
    console.error("[Biometric Lookup] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
