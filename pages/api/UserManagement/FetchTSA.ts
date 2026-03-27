// pages/api/UserManagement/FetchTSA.ts
//
// Returns TSAs filtered by Role.
// Optional query params:
//   managerReferenceID — when provided, filters TSAs whose TSM field matches
//                        (i.e., only TSAs that belong to the selected TSM)
//
import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const db = await connectToDatabase();
    const { Role, managerReferenceID } = req.query;

    if (!Role || typeof Role !== "string") {
      return res.status(400).json({ error: "Role query param is required" });
    }

    // Base query — role is always required
    const query: Record<string, any> = { Role };

    // When a TSM's ReferenceID is passed, scope TSAs to only those
    // whose TSM field matches — mirrors FetchTSM's Manager filter logic
    if (managerReferenceID && typeof managerReferenceID === "string") {
      query.TSM = managerReferenceID;
    }

    const users = await db
      .collection("users")
      .find(query)
      .project({
        Firstname: 1,
        Lastname: 1,
        ReferenceID: 1,
        Status: 1,
        _id: 0,
      })
      .toArray();

    // Always return an array so the client's Array.isArray() guard works
    return res.status(200).json(users);
  } catch (error) {
    console.error("[FetchTSA] Error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
