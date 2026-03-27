import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";

/**
 * GET /api/UserManagement/FetchTSA
 *
 * Query params:
 *   Role               – required; e.g. "Territory Sales Associate"
 *   managerReferenceID – optional; when provided, returns only TSAs whose
 *                        TSM field matches this value (i.e. TSAs under
 *                        the selected TSM).
 *
 * When no managerReferenceID is given all active TSAs for the Role are
 * returned (same behaviour as before – no breaking change).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { Role, managerReferenceID } = req.query;

  if (!Role || typeof Role !== "string") {
    return res.status(400).json({ error: "Role query param is required" });
  }

  try {
    const db = await connectToDatabase();

    const query: Record<string, unknown> = {
      Role,
      Status: { $nin: ["Resigned", "Terminated"] },
    };

    // When a TSM reference ID is supplied, scope the results to TSAs
    // whose TSM field matches that reference ID.
    if (managerReferenceID && typeof managerReferenceID === "string") {
      query.TSM = managerReferenceID;
    }

    const users = await db
      .collection("users")
      .find(query)
      .project({ Firstname: 1, Lastname: 1, ReferenceID: 1, Status: 1, _id: 0 })
      .toArray();

    // Return an empty array (not 404) so callers can show "no TSAs yet"
    // without crashing.
    return res.status(200).json(users);
  } catch (error) {
    console.error("[FetchTSA] Error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
