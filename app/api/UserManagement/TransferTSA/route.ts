/**
 * POST /api/UserManagement/TransferTSA
 *
 * Body:
 * {
 *   tsaReferenceId           : string
 *   field                    : "tsm" | "manager"
 *   newSupervisorReferenceId : string
 *   selectedTables?          : string[]          // which Supabase tables to update
 *   historyDateRange?        : { from: string; to: string }  // YYYY-MM-DD, history table only
 * }
 */

import { NextResponse } from "next/server";
import {
  transferTSA,
  type TransferField,
  type HistoryDateRange,
} from "@/lib/services/tsaTransfer";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      tsaReferenceId,
      field,
      newSupervisorReferenceId,
      selectedTables,
      historyDateRange,
    } = body as {
      tsaReferenceId?: string;
      field?: string;
      newSupervisorReferenceId?: string;
      selectedTables?: string[];
      historyDateRange?: HistoryDateRange;
    };

    if (!tsaReferenceId?.trim()) {
      return NextResponse.json(
        { success: false, error: "tsaReferenceId is required." },
        { status: 400 },
      );
    }
    if (field !== "tsm" && field !== "manager") {
      return NextResponse.json(
        { success: false, error: "field must be 'tsm' or 'manager'." },
        { status: 400 },
      );
    }
    if (!newSupervisorReferenceId?.trim()) {
      return NextResponse.json(
        { success: false, error: "newSupervisorReferenceId is required." },
        { status: 400 },
      );
    }

    const result = await transferTSA({
      tsaReferenceId: tsaReferenceId.trim(),
      field: field as TransferField,
      newSupervisorReferenceId: newSupervisorReferenceId.trim(),
      selectedTables,
      historyDateRange,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (err: any) {
    console.error("[TransferTSA route]", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Internal server error." },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
