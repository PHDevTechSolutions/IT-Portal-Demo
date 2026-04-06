/**
 * GET /api/check-session  (pages/api — kept in Pages Router for compatibility)
 *
 * Validates the HTTP-only session cookie via the shared getSession() utility.
 * Device-ID checking has been removed; session validity is determined entirely
 * by the cookie + the user record in MongoDB.
 */

import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";
import { parse } from "cookie";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const rawCookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  const sessionUserId = rawCookies.session;

  if (!sessionUserId) {
    return res.status(401).json({ error: "No active session." });
  }

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(sessionUserId.trim());
  } catch {
    return res.status(401).json({ error: "Malformed session." });
  }

  try {
    const db = await connectToDatabase();
    const user = await db.collection("users").findOne({ _id: objectId });

    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    if (["Resigned", "Terminated", "Locked"].includes(user.Status ?? "")) {
      return res.status(403).json({ error: `Account is ${user.Status}.` });
    }

    return res.status(200).json({
      message: "Session valid",
      userId: sessionUserId,
      referenceId: user.ReferenceID ?? null,
    });
  } catch (err) {
    console.error("[check-session] DB error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
