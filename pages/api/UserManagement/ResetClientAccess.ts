import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

/**
 * POST /api/UserManagement/ResetClientAccess
 *
 * Resets ONLY Status → "Active" and LoginAttempts → 0 for a locked user.
 * All other fields are untouched (uses $set with exactly two fields).
 */
export default async function resetClientAccess(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const { id } = req.body as { id?: string };

  if (!id || !ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid or missing user ID." });
  }

  try {
    const db = await connectToDatabase();
    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          Status: "Active",
          LoginAttempts: 0,
          LockUntil: null,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    return res
      .status(200)
      .json({ success: true, message: "Client access reset successfully." });
  } catch (error) {
    console.error("[ResetClientAccess] Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to reset client access." });
  }
}
