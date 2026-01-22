import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const db = await connectToDatabase();

    try {
      const { Role, managerReferenceID } = req.query;

      if (!Role) {
        return res.status(400).json({ error: "Role is required" });
      }

      const baseQuery: any = { Role, Status: "Active" };
      let users;

      if (managerReferenceID) {
        users = await db.collection("users")
          .find({
            ...baseQuery,
            $or: [
              { TSM: managerReferenceID },
              { MANAGER: managerReferenceID }
            ]
          })
          .project({ Firstname: 1, Lastname: 1, ReferenceID: 1, _id: 0 })
          .toArray();
      } else {
        users = await db.collection("users")
          .find(baseQuery)
          .project({ Firstname: 1, Lastname: 1, ReferenceID: 1, _id: 0 })
          .toArray();
      }
      return res.status(200).json(users);

    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ error: "Server error" });
    }
  }
}