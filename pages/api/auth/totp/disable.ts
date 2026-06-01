/**
 * POST /api/auth/totp/disable
 *
 * Disables TOTP for the authenticated user.
 * Requires the current TOTP code as confirmation.
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
  if (!code) return res.status(400).json({ message: "code is required to disable 2FA." });

  const cookies   = parse(req.headers.cookie ?? "");
  const sessionId = cookies.session;
  if (!sessionId) return res.status(401).json({ message: "Not authenticated." });

  const db   = await connectToDatabase();
  const user = await db.collection("users").findOne({ _id: new ObjectId(sessionId) });

  if (!user)            return res.status(401).json({ message: "User not found." });
  if (!user.totpEnabled) return res.status(400).json({ message: "2FA is not enabled." });

  const valid = verifyTOTPCode(code.trim(), user.totpSecret);
  if (!valid) return res.status(401).json({ message: "Invalid code." });

  await db.collection("users").updateOne(
    { _id: new ObjectId(sessionId) },
    { $unset: { totpSecret: "", totpEnabled: "", totpPending: "" } }
  );

  return res.status(200).json({ success: true, message: "2FA disabled." });
}
