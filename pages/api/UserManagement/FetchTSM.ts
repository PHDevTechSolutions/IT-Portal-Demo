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

      if (managerReferenceID) {
        const users = await db.collection("users")
          .find({ ...baseQuery, Manager: managerReferenceID })
          .project({ Firstname: 1, Lastname: 1, ReferenceID: 1, _id: 0 })
          .toArray();

        if (users.length > 0) {
          return res.status(200).json(users);
        } else {
          const manager = await db.collection("users")
            .find({ ReferenceID: managerReferenceID })
            .project({ Firstname: 1, Lastname: 1, ReferenceID: 1, _id: 0 })
            .toArray();

          if (manager.length > 0) {
            return res.status(200).json(manager);
          } else {
            return res.status(404).json({ error: "No users or manager found with this role and filter" });
          }
        }
      } else {
        const users = await db.collection("users")
          .find(baseQuery)
          .project({ Firstname: 1, Lastname: 1, ReferenceID: 1, _id: 0 })
          .toArray();

        if (users.length === 0) {
          return res.status(404).json({ error: "No users found with this role" });
        }
        return res.status(200).json(users);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ error: "Server error" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}