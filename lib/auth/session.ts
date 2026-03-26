/**
 * lib/auth/session.ts
 *
 * Centralized session utilities.
 * All identity is derived from the HTTP-only session cookie — never from
 * URL params, localStorage, or client-supplied values.
 *
 * Usage (App Router server components / route handlers):
 *   const session = await getSession();      // null if unauthenticated
 *   const session = await requireSession();  // throws if unauthenticated
 */

import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/MongoDB";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionUser {
  userId: string;
  referenceId: string | null;
  email: string;
  firstname: string;
  lastname: string;
  role: string;
  department: string;
  status: string;
  profilePicture: string | null;
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Read the session cookie, look up the user in MongoDB, and return a typed
 * SessionUser.  Returns null if there is no valid session.
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie?.value) return null;

    const rawId = sessionCookie.value.trim();

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(rawId);
    } catch {
      // Cookie value is malformed — treat as unauthenticated
      return null;
    }

    const db = await connectToDatabase();
    const user = await db.collection("users").findOne({ _id: objectId });

    if (!user) return null;

    // Honour the same account-status gates applied during login
    if (["Resigned", "Terminated", "Locked"].includes(user.Status ?? "")) {
      return null;
    }

    return {
      userId: rawId,
      referenceId: user.ReferenceID ?? null,
      email: user.Email ?? "",
      firstname: user.Firstname ?? "",
      lastname: user.Lastname ?? "",
      role: user.Role ?? "",
      department: user.Department ?? "",
      status: user.Status ?? "",
      profilePicture: user.profilePicture ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Like getSession() but throws a 401-style error when there is no session.
 * Use inside route handlers that must be authenticated.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

/**
 * Convenience helper — returns true when a valid session exists.
 * Suitable for lightweight middleware / guard checks.
 */
export async function hasSession(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

/** Standard cookie options shared by set / clear. */
export const SESSION_COOKIE_OPTIONS = {
  name: "session",
  httpOnly: true,
  secure: process.env.NODE_ENV !== "development",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24, // 24 hours
} as const;
