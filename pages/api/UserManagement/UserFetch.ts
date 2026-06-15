import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function fetchAccounts(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    // ✅ Fetch ALL users including resigned ones - no status filter
    const { data: users, error } = await supabase
      .from('users')
      .select('*');

    if (error) throw error;

    // ✅ Normalize all reference IDs and quotas, add _id for frontend compatibility
    const normalized = (users || []).map((u: any) => ({
      ...u, // Include all user data including roles and permissions
      _id: u.ReferenceID || u.referenceid || u.id,
      referenceid:
        (u.ReferenceID || u.referenceid || "").toString().trim().toLowerCase(),
      targetquota: u.targetquota || u.TargetQuota || "",
    }));

    res.status(200).json(normalized);
  } catch (error: any) {
    console.error("Error fetching data:", error.message);
    res.status(200).json([]);
  }
}
