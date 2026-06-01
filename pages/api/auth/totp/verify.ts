/**
 * POST /api/auth/totp/verify
 *
 * Step 2 of login when TOTP is enabled.
 * Validates the 6-digit code against the user's stored secret,
 * then sets the session cookie.
 *
 * Body: { tempToken: string; code: string }
 */

import { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/MongoDB";
import { consumeTempToken } from "@/lib/auth/tempToken";
import { verifyTOTPCode } from "@/lib/auth/totp";
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { tempToken, code } = req.body as { tempToken?: string; code?: string };

  if (!tempToken || !code) {
    return res.status(400).json({ message: "tempToken and code are required." });
  }

  // Consume the temp token (single-use, 5-min TTL)
  const entry = consumeTempToken(tempToken);
  if (!entry) {
    return res.status(401).json({ message: "Invalid or expired verification session. Please log in again." });
  }

  // Load user from MongoDB
  const db   = await connectToDatabase();
  const user = await db.collection("users").findOne({ _id: new ObjectId(entry.userId) });

  if (!user || !user.totpSecret) {
    return res.status(401).json({ message: "TOTP not configured for this account." });
  }

  // Verify the code
  const valid = verifyTOTPCode(code.trim(), user.totpSecret);
  if (!valid) {
    return res.status(401).json({ message: "Invalid authenticator code. Please try again." });
  }

  // Code is valid — set session cookie
  const actor: AuditActor = {
    uid:        entry.userId,
    email:      user.Email,
    role:       user.Role,
    department: user.Department,
  };

  await logSystemAudit({
    action:       "login",
    module:       "Authentication",
    page:         "/login",
    resourceType: "session",
    resourceId:   entry.userId,
    resourceName: user.Email,
    actor,
    ipAddress:    req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || null,
    userAgent:    req.headers["user-agent"] || null,
    source:       "TOTPVerifyAPI",
    metadata:     { method: "totp" },
  });

  res.setHeader(
    "Set-Cookie",
    serialize("session", entry.userId, {
      httpOnly: true,
      secure:   process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge:   60 * 60 * 24,
      path:     "/",
    })
  );

  return res.status(200).json({
    message:     "Login successful",
    userId:      entry.userId,
    Role:        user.Role,
    Department:  user.Department,
    Status:      user.Status,
    ReferenceID: user.ReferenceID,
  });
}
