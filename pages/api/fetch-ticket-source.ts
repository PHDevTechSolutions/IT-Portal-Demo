import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000; // Supabase max limit per request

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { ticket_reference_number } = req.query;

    console.log("[fetch-ticket-source] Request with ticket_reference_number:", ticket_reference_number);

    if (!ticket_reference_number || typeof ticket_reference_number !== 'string') {
      return res.status(400).json({ message: "ticket_reference_number is required" });
    }

    // Fetch from endorsed-ticket table
    let allData: any[] = [];
    let hasMore = true;
    let start = 0;
    const maxBatches = 100; // Safety limit (100k rows max)
    let batchCount = 0;

    while (hasMore && batchCount < maxBatches) {
      let query = supabase
        .from("endorsed-ticket")
        .select("*")
        .eq('ticket_reference_number', ticket_reference_number)
        .order('date_created', { ascending: false })
        .range(start, start + BATCH_SIZE - 1);

      const { data, error } = await query;

      if (error) {
        console.error("[fetch-ticket-source] Supabase error:", error);
        return res.status(500).json({ message: error.message, details: error });
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        console.log(`[fetch-ticket-source] Batch ${batchCount + 1}: Fetched ${data.length} records (total: ${allData.length})`);

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

    console.log("[fetch-ticket-source] Total fetched:", allData.length, "records in", batchCount + 1, "batches");
    return res.status(200).json({ ticketSource: allData, count: allData.length });
  } catch (err) {
    console.error("[fetch-ticket-source] Server error:", err);
    return res.status(500).json({ message: "Server error", error: String(err) });
  }
}
