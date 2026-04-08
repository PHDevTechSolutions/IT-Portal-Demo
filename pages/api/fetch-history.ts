import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000; // Supabase max limit per request

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { activity_reference_number } = req.query;

    console.log("[fetch-history] Request with activity_reference_number:", activity_reference_number);

    if (!activity_reference_number || typeof activity_reference_number !== 'string') {
      return res.status(400).json({ message: "activity_reference_number is required" });
    }

    // Batch fetch all matching records
    let allData: any[] = [];
    let hasMore = true;
    let start = 0;
    const maxBatches = 100; // Safety limit (100k rows max)
    let batchCount = 0;

    while (hasMore && batchCount < maxBatches) {
      let query = supabase
        .from("history")
        .select("*")
        .eq('activity_reference_number', activity_reference_number)
        .order('date_created', { ascending: false })
        .range(start, start + BATCH_SIZE - 1);

      const { data, error } = await query;

      if (error) {
        console.error("[fetch-history] Supabase error:", error);
        return res.status(500).json({ message: error.message, details: error });
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        console.log(`[fetch-history] Batch ${batchCount + 1}: Fetched ${data.length} records (total: ${allData.length})`);

        // Check if we got less than batch size (means we're done)
        if (data.length < BATCH_SIZE) {
          hasMore = false;
        } else {
          start += BATCH_SIZE;
          batchCount++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log("[fetch-history] Total fetched:", allData.length, "records in", batchCount + 1, "batches");
    return res.status(200).json({ history: allData, count: allData.length });
  } catch (err) {
    console.error("[fetch-history] Server error:", err);
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
}
