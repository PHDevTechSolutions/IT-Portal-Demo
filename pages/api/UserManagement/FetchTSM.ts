import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const { Role, managerReferenceID } = req.query;

      if (!Role) {
        return res.status(400).json({ error: "Role is required" });
      }

      if (managerReferenceID) {
        const { data: users, error: userError } = await supabase
          .from('users')
          .select('Firstname, Lastname, ReferenceID')
          .eq('Role', Role)
          .eq('Status', 'Active')
          .eq('Manager', managerReferenceID);

        if (userError) throw userError;

        if (users && users.length > 0) {
          return res.status(200).json(users);
        } else {
          const { data: manager, error: managerError } = await supabase
            .from('users')
            .select('Firstname, Lastname, ReferenceID')
            .eq('ReferenceID', managerReferenceID);

          if (managerError) throw managerError;

          if (manager && manager.length > 0) {
            return res.status(200).json(manager);
          } else {
            return res.status(404).json({ error: "No users or manager found with this role and filter" });
          }
        }
      } else {
        const { data: users, error: userError } = await supabase
          .from('users')
          .select('Firstname, Lastname, ReferenceID')
          .eq('Role', Role)
          .eq('Status', 'Active');

        if (userError) throw userError;

        if (!users || users.length === 0) {
          return res.status(404).json({ error: "No users found with this role" });
        }
        return res.status(200).json(users);
      }
    } catch (error: any) {
      console.error("Error fetching users:", error.message);
      return res.status(500).json({ error: "Server error" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}