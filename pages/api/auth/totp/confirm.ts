/**
 * POST /api/auth/totp/confirm
 *
 * Confirms the pending TOTP setup by verifying the first code.
 * Moves `totpPending` → `totpSecret` and sets `totpEnabled: true`.
 *
 * Body: { code: string }
 * Requires: session cookie
 */

import { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { parse } from "cookie";
import { connectToDatabase } from "@/lib/MongoDB";
import { verifyTOTPCode } from "@/lib/auth/totp";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { code } = req.body as { code?: string };
  if (!code) return res.status(400).json({ message: "code is required." });

  const cookies   = parse(req.headers.cookie ?? "");
  const sessionId = cookies.session;
  if (!sessionId) return res.status(401).json({ message: "Not authenticated." });

  const db   = await connectToDatabase();
  const user = await db.collection("users").findOne({ _id: new ObjectId(sessionId) });

  if (!user)             return res.status(401).json({ message: "User not found." });
  if (!user.totpPending) return res.status(400).json({ message: "No pending TOTP setup. Call /setup first." });

  const valid = verifyTOTPCode(code.trim(), user.totpPending);
  if (!valid) return res.status(401).json({ message: "Invalid code. Please try again." });

  // Activate TOTP
  const updateResult = await db.collection("users").updateOne(
    { _id: new ObjectId(sessionId) },
    {
      $set:   { totpSecret: user.totpPending, totpEnabled: true },
      $unset: { totpPending: "" },
    }
  );

  console.log(`[TOTP Confirm] userId=${sessionId} modifiedCount=${updateResult.modifiedCount}`);

  if (updateResult.modifiedCount === 0) {
    return res.status(500).json({ message: "Failed to save 2FA settings. Please try again." });
  }

  return res.status(200).json({ success: true, message: "2FA enabled successfully." });
}
