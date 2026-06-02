/**
 * GET /api/auth/totp/status
 *
 * Returns the real-time TOTP status directly from MongoDB.
 * Used by TwoFactorSetup to show the correct enabled/disabled state,
 * bypassing the session cache which may be stale.
 *
 * Requires: session cookie
 */

import { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { parse } from "cookie";
import { connectToDatabase } from "@/lib/MongoDB";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const cookies   = parse(req.headers.cookie ?? "");
  const sessionId = cookies.session;
  if (!sessionId) return res.status(401).json({ message: "Not authenticated." });

  try {
    const db   = await connectToDatabase();
    const user = await db.collection("users").findOne(
      { _id: new ObjectId(sessionId) },
      { projection: { totpEnabled: 1 } },
    );

    if (!user) return res.status(401).json({ message: "User not found." });

    return res.status(200).json({ totpEnabled: !!user.totpEnabled });
  } catch {
    return res.status(500).json({ message: "Internal server error." });
  }
}
