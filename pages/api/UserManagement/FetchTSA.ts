import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { Role, managerReferenceID } = req.query;

    if (!Role || typeof Role !== "string") {
      return res.status(400).json({ error: "Role query param is required" });
    }

    let query = supabase
      .from('users')
      .select('Firstname, Lastname, ReferenceID, Status')
      .eq('Role', Role);

    if (managerReferenceID && typeof managerReferenceID === "string") {
      query = query.eq('TSM', managerReferenceID);
    }

    const { data: users, error } = await query;

    if (error) throw error;

    // Always return an array so the client's Array.isArray() guard works
    return res.status(200).json(users || []);
  } catch (error: any) {
    console.error("[FetchTSA] Error:", error.message);
    return res.status(500).json({ error: "Server error" });
  }
}
