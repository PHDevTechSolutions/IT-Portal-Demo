import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000; // Supabase max limit per request

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { days } = req.query;
    
    console.log("[fetch-activity] Request with days:", days);
    
    // Calculate date range
    let cutoffDate: Date | null = null;
    if (days && typeof days === 'string') {
      const daysNum = parseInt(days);
      if (!isNaN(daysNum) && daysNum > 0) {
        cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysNum);
        console.log("[fetch-activity] Filtering from date:", cutoffDate.toISOString());
      }
    }
    
    // Batch fetch all records
    let allData: any[] = [];
    let hasMore = true;
    let start = 0;
    const maxBatches = 100; // Safety limit (100k rows max)
    let batchCount = 0;
    
    while (hasMore && batchCount < maxBatches) {
      let query = supabase
        .from("activity")
        .select("*")
        .order('date_created', { ascending: true })
        .range(start, start + BATCH_SIZE - 1);
      
      // Apply date filter if specified
      if (cutoffDate) {
        query = query.gte('date_created', cutoffDate.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("[fetch-activity] Supabase error:", error);
        return res.status(500).json({ message: error.message, details: error });
      }
      
      if (data && data.length > 0) {
        allData = allData.concat(data);
        console.log(`[fetch-activity] Batch ${batchCount + 1}: Fetched ${data.length} records (total: ${allData.length})`);
        
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
    
    console.log("[fetch-activity] Total fetched:", allData.length, "records in", batchCount + 1, "batches");
    return res.status(200).json({ activities: allData, cached: false, count: allData.length });
  } catch (err) {
    console.error("[fetch-activity] Server error:", err);
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
}
