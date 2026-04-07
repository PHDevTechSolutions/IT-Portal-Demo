import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";

export default async function fetchAccounts(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const db = await connectToDatabase();
    const UserCollection = db.collection("users");
    
    // ✅ Fetch ALL users including resigned ones - no status filter
    const users = await UserCollection.find({}).toArray();

    // ✅ Normalize all reference IDs and quotas
    const normalized = users.map((u: any) => ({
      ...u, // Include all user data including roles and permissions
      referenceid:
        (u.ReferenceID || u.referenceid || "").toString().trim().toLowerCase(),
      targetquota: u.targetquota || "",
    }));

    res.status(200).json(normalized);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
}
