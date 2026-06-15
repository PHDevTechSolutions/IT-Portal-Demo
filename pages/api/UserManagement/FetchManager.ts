import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const { Role } = req.query;

      if (!Role) {
        return res.status(400).json({ error: "Role is required" });
      }

      // Fetch users with the role "Manager" AND Department "Sales"
      const { data: users, error } = await supabase
        .from('users')
        .select('Firstname, Lastname, ReferenceID')
        .eq('Role', Role)
        .eq('Department', 'Sales');

      if (error) throw error;

      if (!users || users.length === 0) {
        return res.status(404).json({ error: "No users found with this role" });
      }

      return res.status(200).json(users);
    } catch (error: any) {
      console.error("Error fetching managers:", error.message);
      return res.status(500).json({ error: "Server error" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}