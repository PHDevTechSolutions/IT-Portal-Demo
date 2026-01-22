// pages/api/check-session.ts

import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import { parse } from "cookie";
import { ObjectId } from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  const sessionUserId = cookies.session;
  const deviceId = req.headers["x-device-id"];

  if (!sessionUserId || !deviceId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = await connectToDatabase();
  const users = db.collection("users");

  const user = await users.findOne({ _id: new ObjectId(sessionUserId) });
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (user.DeviceId !== deviceId) {
    return res.status(401).json({ error: "Device mismatch. Please login again." });
  }

  return res.status(200).json({ message: "Session valid", user });
}
