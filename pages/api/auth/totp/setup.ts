/**
 * POST /api/auth/totp/setup
 *
 * Generates a new TOTP secret + QR code URI for the authenticated user.
 * The secret is stored as `totpPending` (not yet active) until the user
 * confirms with a valid code via /api/auth/totp/confirm.
 *
 * Requires: session cookie
 */

import { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { parse } from "cookie";
import { connectToDatabase } from "@/lib/MongoDB";
import { generateTOTPSecret, generateTOTPUri } from "@/lib/auth/totp";
import QRCode from "qrcode";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const cookies     = parse(req.headers.cookie ?? "");
  const sessionId   = cookies.session;
  if (!sessionId) return res.status(401).json({ message: "Not authenticated." });

  const db   = await connectToDatabase();
  const user = await db.collection("users").findOne({ _id: new ObjectId(sessionId) });
  if (!user)  return res.status(401).json({ message: "User not found." });

  // Generate a new secret and store it as pending (not active yet)
  const secret = generateTOTPSecret();
  const uri    = generateTOTPUri(user.Email, secret);
  const qrCode = await QRCode.toDataURL(uri); // base64 PNG

  await db.collection("users").updateOne(
    { _id: new ObjectId(sessionId) },
    { $set: { totpPending: secret } }
  );

  return res.status(200).json({
    secret,  // show to user as backup code
    qrCode,  // base64 PNG — render as <img src={qrCode} />
  });
}
