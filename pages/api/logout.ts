/**
 * POST /api/logout
 *
 * Destroys the session by clearing the HTTP-only cookie.
 * Business logic (validation, user state) is unchanged.
 */

import { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit";

// Helper to get actor from session/request
function getActorFromRequest(req: NextApiRequest): AuditActor {
  const userEmail = req.headers["x-user-email"] as string || null;
  const userRole = req.headers["x-user-role"] as string || null;
  const userId = req.headers["x-user-id"] as string || null;
  
  return {
    uid: userId,
    email: userEmail,
    role: userRole,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Expire the session cookie immediately
  res.setHeader(
    "Set-Cookie",
    serialize("session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      path: "/",
      maxAge: -1, // instruct browser to delete
    }),
  );

  // Log logout audit
  const actor = getActorFromRequest(req);
  if (actor.uid || actor.email) {
    await logSystemAudit({
      action: "logout",
      module: "Authentication",
      page: "/login",
      resourceType: "session",
      resourceId: actor.uid,
      resourceName: actor.email ?? "Unknown",
      actor,
      ipAddress: req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || null,
      userAgent: req.headers["user-agent"] || null,
      source: "LogoutAPI",
    });
  }

  return res.status(200).json({ message: "Logout successful" });
}
