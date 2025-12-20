import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Kunin lahat ng records mula sa "history" table, walang filter na referenceid
    const { data, error } = await supabase
      .from("activity")
      .select("*");

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    return res.status(200).json({ activities: data, cached: false });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
