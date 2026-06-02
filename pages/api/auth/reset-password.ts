/**
 * POST /api/auth/reset-password
 *
 * Body: { token: string; password: string }
 *
 * Validates the signed JWT reset token, hashes the new password,
 * updates the user in MongoDB, and returns 200 on success.
 */

import { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/MongoDB";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const SECRET = process.env.SECRET_KEY ?? process.env.API_KEY ?? "reset-secret";

interface ResetPayload {
  userId:   string;
  email:    string;
  purpose:  string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, password } = req.body as { token?: string; password?: string };

  if (!token?.trim()) {
    return res.status(400).json({ message: "Token is required." });
  }
  if (!password?.trim() || password.trim().length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  // Verify JWT
  let payload: ResetPayload;
  try {
    payload = jwt.verify(token.trim(), SECRET) as ResetPayload;
  } catch {
    return res.status(401).json({ message: "Reset link is invalid or has expired. Please request a new one." });
  }

  if (payload.purpose !== "password-reset") {
    return res.status(401).json({ message: "Invalid reset token." });
  }

  try {
    const db   = await connectToDatabase();
    const user = await db.collection("users").findOne({ _id: new ObjectId(payload.userId) });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (["Resigned", "Terminated", "Locked"].includes(user.Status ?? "")) {
      return res.status(403).json({ message: `Account is ${user.Status}. Cannot reset password.` });
    }

    const hashed = await bcrypt.hash(password.trim(), 10);

    await db.collection("users").updateOne(
      { _id: new ObjectId(payload.userId) },
      {
        $set: {
          Password:      hashed,
          LoginAttempts: 0,
          Status:        user.Status === "Locked" ? "Active" : user.Status,
          updatedAt:     new Date(),
        },
      },
    );

    return res.status(200).json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (err: any) {
    console.error("[reset-password]", err.message);
    return res.status(500).json({ message: "Internal server error." });
  }
}
