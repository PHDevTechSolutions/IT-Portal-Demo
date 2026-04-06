/**
 * POST /api/auto-login
 *
 * Called by ProtectedPageWrapper when the primary cookie check fails but a
 * session cookie may still exist.  Validates the cookie against MongoDB,
 * refreshes it, and returns the userId so the client can update context.
 *
 * No external id param is accepted — the cookie is the only credential.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";

export async function POST(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { success: false, error: "No active session." },
        { status: 401 },
      );
    }

    const sessionUserId = sessionCookie.value.trim();

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(sessionUserId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Malformed session." },
        { status: 401 },
      );
    }

    const db = await connectToDatabase();
    const user = await db.collection("users").findOne({ _id: objectId });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 401 },
      );
    }

    if (["Resigned", "Terminated", "Locked"].includes(user.Status ?? "")) {
      return NextResponse.json(
        { success: false, error: `Account is ${user.Status}.` },
        { status: 403 },
      );
    }

    // Refresh the cookie TTL
    const response = NextResponse.json({
      success: true,
      userId: sessionUserId,
    });

    response.cookies.set(SESSION_COOKIE_OPTIONS.name, sessionUserId, {
      httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
      secure: SESSION_COOKIE_OPTIONS.secure,
      sameSite: SESSION_COOKIE_OPTIONS.sameSite,
      path: SESSION_COOKIE_OPTIONS.path,
      maxAge: SESSION_COOKIE_OPTIONS.maxAge,
    });

    return response;
  } catch (err: any) {
    console.error("[auto-login]", err);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 },
    );
  }
}
