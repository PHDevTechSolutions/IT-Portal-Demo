import { NextApiRequest, NextApiResponse } from "next";
import { validateUser, connectToDatabase } from "@/lib/MongoDB";
import { serialize } from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { Email, Password } = req.body;

  if (!Email || !Password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  const db = await connectToDatabase();
  const usersCollection = db.collection("users");

  // Find the user by email
  const user = await usersCollection.findOne({ Email });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  // Block users if Status is one of these
  const blockedStatuses = ["Resigned", "Terminated", "Closed"];
  if (blockedStatuses.includes(user.Status)) {
    return res.status(403).json({ message: `Access denied due to account status: ${user.Status}.` });
  }

  // Allow only Department "IT"
  if (user.Department !== "IT") {
    return res.status(403).json({ message: "Access denied. Only IT Department allowed." });
  }

  // Validate user credentials with Department required by type
  const result = await validateUser({ Email, Password, Department: "IT" });

  if (!result.success || !result.user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  // Reset login attempts on successful login
  await usersCollection.updateOne(
    { Email },
    {
      $set: {
        LoginAttempts: 0,
        Status: "Active",
        LockUntil: null,
      },
    }
  );

  const userId = result.user._id.toString();

  // Set session cookie
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
    Department: result.user.Department,
  });
}
