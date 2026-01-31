import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import { serialize } from "cookie";
import crypto from "crypto";
import { ObjectId } from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: "Missing user id." });
  }

  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ _id: new ObjectId(id) });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const deviceId = crypto.randomUUID();

    res.setHeader(
      "Set-Cookie",
      serialize("session", id, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== "development",
        sameSite: "strict",
        maxAge: 60 * 60 * 24,
        path: "/",
      })
    );

    return res.status(200).json({ message: "Auto-login successful", deviceId });
  } catch (error) {
    console.error("Auto-login error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
}
