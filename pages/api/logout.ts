/**
 * POST /api/logout
 *
 * Destroys the session by clearing the HTTP-only cookie.
 * Business logic (validation, user state) is unchanged.
 */

import { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Expire the session cookie immediately
  res.setHeader(
    "Set-Cookie",
    serialize("session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      path: "/",
      maxAge: -1, // instruct browser to delete
    }),
  );

  return res.status(200).json({ message: "Logout successful" });
}
