import { NextApiRequest, NextApiResponse } from "next";
import { validateUser, connectToDatabase } from "@/lib/ModuleGlobal/mongodb";
import { serialize } from "cookie";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { Email, Password, deviceId } = req.body;

  if (!Email || !Password || !deviceId) {
    return res.status(400).json({
      message: "Email, Password, and deviceId are required.",
    });
  }

  const db = await connectToDatabase();
  const usersCollection = db.collection("users");

  // 🔍 Find user
  const user = await usersCollection.findOne({ Email });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  // 🔐 IT Department only
  if (user.Department !== "IT") {
    return res.status(403).json({
      message: "Access denied. Only IT Department accounts are allowed.",
    });
  }

  // 🔑 Validate password
  const result = await validateUser({ Email, Password });

  if (!result.success || !result.user) {
    return res.status(401).json({
      message: "Invalid credentials.",
    });
  }

  // ✅ Save deviceId on successful login
  await usersCollection.updateOne(
    { Email },
    {
      $set: {
        DeviceId: deviceId,
        LastLoginAt: new Date(),
      },
    }
  );

  const userId = result.user._id.toString();

  // 🍪 Set session cookie
  res.setHeader(
    "Set-Cookie",
    serialize("session", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    })
  );

  return res.status(200).json({
    message: "Login successful",
    userId,
  });
}
