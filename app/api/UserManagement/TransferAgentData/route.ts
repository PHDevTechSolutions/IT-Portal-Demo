/**
 * POST /api/UserManagement/TransferAgentData
 *
 * Reassigns all data records (Neon accounts + selected Supabase tables) from
 * one TSA to another by updating the `referenceid` column on every matching row.
 * MongoDB user documents are NOT modified — only data rows are transferred.
 *
 * Body:
 * {
 *   fromReferenceId   : string               // source agent
 *   toReferenceId     : string               // destination agent
 *   selectedTables?   : string[]             // Supabase tables to update (defaults to all)
 *   historyDateRange? : { from: string; to: string }  // YYYY-MM-DD, history table only
 * }
 */

import { NextResponse } from "next/server";
import {
  transferAgentData,
  type HistoryDateRange,
} from "@/lib/services/agentDataTransfer";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      fromReferenceId,
      toReferenceId,
      selectedTables,
      historyDateRange,
    } = body as {
      fromReferenceId?: string;
      toReferenceId?: string;
      selectedTables?: string[];
      historyDateRange?: HistoryDateRange;
    };

    if (!fromReferenceId?.trim()) {
      return NextResponse.json(
        { success: false, error: "fromReferenceId is required." },
        { status: 400 },
      );
    }
    if (!toReferenceId?.trim()) {
      return NextResponse.json(
        { success: false, error: "toReferenceId is required." },
        { status: 400 },
      );
    }
    if (fromReferenceId.trim().toLowerCase() === toReferenceId.trim().toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Source and destination agents must be different." },
        { status: 400 },
      );
    }

    const result = await transferAgentData({
      fromReferenceId: fromReferenceId.trim(),
      toReferenceId:   toReferenceId.trim(),
      selectedTables,
      historyDateRange,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (err: any) {
    console.error("[TransferAgentData route]", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Internal server error." },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
