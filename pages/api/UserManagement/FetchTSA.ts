// pages/api/UserManagement/FetchAllTSA.ts
//
// Deploy path: pages/api/UserManagement/FetchAllTSA.ts
//
// Returns every TSA regardless of Status (Active, Inactive, Terminated, Resigned)
// so that /taskflow/customer-database can still show and badge every account owner.
//
import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const db = await connectToDatabase();

    const { Role } = req.query;

    if (!Role || typeof Role !== "string") {
      return res.status(400).json({ error: "Role query param is required" });
    }

    // ⚠ No Status filter — intentionally returns ALL TSAs (including Terminated/Resigned)
    const users = await db
      .collection("users")
      .find({ Role })
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
    console.error("[FetchAllTSA] Error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}