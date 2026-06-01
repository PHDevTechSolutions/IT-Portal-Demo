/**
 * lib/services/agentDataTransfer.ts
 *
 * Transfers all data records that belong to one TSA (fromReferenceId) to
 * another TSA (toReferenceId) across Neon and selected Supabase tables.
 *
 * Unlike transferTSA, this does NOT touch MongoDB user documents — it only
 * reassigns the `referenceid` column on data rows so the destination agent
 * inherits all accounts, activity, history, etc.
 *
 * Update order:
 *   1. Validate  — both agents must exist in MongoDB
 *   2. Neon      — update accounts.referenceid
 *   3. Supabase  — update referenceid on selected tables (best-effort)
 */

import { neon } from "@neondatabase/serverless";
import { createClient } from "@supabase/supabase-js";
import { connectToDatabase } from "@/lib/MongoDB";

// ─── Re-use the same table list as tsaTransfer ────────────────────────────────

export const SUPABASE_TABLES = [
  "activity",
  "documentation",
  "history",
  "revised_quotations",
  "meetings",
  "signatories",
  "spf_request",
] as const;

export type SupabaseTable = (typeof SUPABASE_TABLES)[number];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HistoryDateRange {
  from: string; // YYYY-MM-DD inclusive start
  to: string;   // YYYY-MM-DD inclusive end (treated as end-of-day)
}

export interface AgentTransferInput {
  fromReferenceId: string;
  toReferenceId: string;
  /** Which Supabase tables to update. Defaults to ALL when omitted. */
  selectedTables?: string[];
  /** Date range filter applied only to the "history" table. */
  historyDateRange?: HistoryDateRange;
}

export interface TableResult {
  updated: number;
  skipped?: boolean;
  error?: string;
}

export interface AgentTransferResult {
  success: boolean;
  error?: string;
  log: {
    fromReferenceId: string;
    toReferenceId: string;
    neon: TableResult;
    supabase: Record<string, TableResult>;
  };
}

// ─── DB client factories ──────────────────────────────────────────────────────

function getNeon() {
  const url = process.env.TASKFLOW_DB_URL;
  if (!url) throw new Error("TASKFLOW_DB_URL env var is not set.");
  return neon(url);
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_IT;
  if (!url || !key)
    throw new Error(
      "Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_IT) are not set.",
    );
  return createClient(url, key);
}

// ─── Validation helper ────────────────────────────────────────────────────────

async function findUserByReferenceId(referenceId: string) {
  const db = await connectToDatabase();
  return db.collection("users").findOne({
    ReferenceID: { $regex: new RegExp(`^${referenceId}$`, "i") },
  });
}

// ─── Neon updater ─────────────────────────────────────────────────────────────

async function updateNeon(
  fromReferenceId: string,
  toReferenceId: string,
): Promise<TableResult> {
  const sql = getNeon();
  try {
    const rows = await sql`
      UPDATE accounts
      SET    referenceid  = ${toReferenceId},
             date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
      WHERE  LOWER(referenceid) = LOWER(${fromReferenceId})
      RETURNING id
    `;
    return { updated: rows.length };
  } catch (err: any) {
    console.error("[agentDataTransfer] Neon error:", err.message);
    return { updated: 0, error: err.message };
  }
}

// ─── Supabase table updater ───────────────────────────────────────────────────

async function updateSupabaseTable(
  table: string,
  fromReferenceId: string,
  toReferenceId: string,
  historyDateRange?: HistoryDateRange,
): Promise<TableResult> {
  const supabase = getSupabase();
  const refCol = "referenceid";

  console.log(
    `[agentDataTransfer] Updating ${table}: from=${fromReferenceId} → to=${toReferenceId}`,
  );

  try {
    // Count matching rows first
    const { count: rowCount, error: countError } = await supabase
      .from(table)
      .select(refCol, { count: "exact", head: true })
      .eq(refCol, fromReferenceId);

    if (countError) {
      console.error(
        `[agentDataTransfer] Count error in ${table}:`,
        countError.message,
      );
      return { updated: 0, error: `Cannot query ${table}: ${countError.message}` };
    }

    if (!rowCount || rowCount === 0) {
      console.warn(
        `[agentDataTransfer] No rows in ${table} with ${refCol}=${fromReferenceId}`,
      );
      return { updated: 0 };
    }

    // Build update query — reassign referenceid to the destination agent
    let query = supabase
      .from(table)
      .update({ [refCol]: toReferenceId })
      .eq(refCol, fromReferenceId);

    // Apply date range filter only for the history table
    if (table === "history" && historyDateRange?.from && historyDateRange?.to) {
      query = (query as any)
        .gte("date_created", `${historyDateRange.from}T00:00:00`)
        .lte("date_created", `${historyDateRange.to}T23:59:59`);
    }

    const { error: updateError } = await query;

    if (updateError) {
      console.error(
        `[agentDataTransfer] Update error in ${table}:`,
        updateError.message,
      );
      return { updated: 0, error: updateError.message };
    }

    // Verify by counting rows now owned by the destination agent
    const { count: updatedCount, error: verifyError } = await supabase
      .from(table)
      .select(refCol, { count: "exact", head: true })
      .eq(refCol, toReferenceId);

    if (verifyError) {
      // Update succeeded but we can't verify — assume all rows transferred
      return { updated: rowCount };
    }

    console.log(
      `[agentDataTransfer] SUCCESS: ${table} — ${updatedCount} row(s) now owned by ${toReferenceId}`,
    );
    return { updated: updatedCount ?? 0 };
  } catch (err: any) {
    console.error(`[agentDataTransfer] Exception in ${table}:`, err.message);
    return { updated: 0, error: err.message };
  }
}

// ─── Supabase orchestrator ────────────────────────────────────────────────────

async function updateSupabase(
  fromReferenceId: string,
  toReferenceId: string,
  selectedTables?: string[],
  historyDateRange?: HistoryDateRange,
): Promise<Record<string, TableResult>> {
  // Determine which tables to update
  let tablesToUpdate: string[];

  if (!selectedTables || selectedTables.length === 0) {
    tablesToUpdate = [...SUPABASE_TABLES];
  } else {
    const normalizedInput = selectedTables.map((t) =>
      String(t).trim().toLowerCase(),
    );
    tablesToUpdate = SUPABASE_TABLES.filter((t) =>
      normalizedInput.includes(t.toLowerCase()),
    );

    // Fallback: accept as-is if nothing matched after normalisation
    if (tablesToUpdate.length === 0) {
      const valid = new Set(SUPABASE_TABLES as readonly string[]);
      tablesToUpdate = selectedTables.filter((t) => valid.has(t));
    }
  }

  const out: Record<string, TableResult> = {};

  // Mark skipped tables
  for (const t of SUPABASE_TABLES) {
    if (!tablesToUpdate.includes(t)) {
      out[t] = { updated: 0, skipped: true };
    }
  }

  // Run selected tables in parallel (best-effort)
  const results = await Promise.allSettled(
    tablesToUpdate.map((table) =>
      updateSupabaseTable(
        table,
        fromReferenceId,
        toReferenceId,
        historyDateRange,
      ).then((r) => ({ table, result: r })),
    ),
  );

  for (const settled of results) {
    if (settled.status === "fulfilled") {
      out[settled.value.table] = settled.value.result;
    } else {
      console.error(
        "[agentDataTransfer] Unexpected rejection:",
        settled.reason,
      );
    }
  }

  return out;
}

// ─── Main service ─────────────────────────────────────────────────────────────

export async function transferAgentData(
  input: AgentTransferInput,
): Promise<AgentTransferResult> {
  const { fromReferenceId, toReferenceId, selectedTables, historyDateRange } =
    input;

  const emptyLog = () => ({
    fromReferenceId,
    toReferenceId,
    neon: { updated: 0 },
    supabase: {} as Record<string, TableResult>,
  });

  // ── 1. Validate inputs ───────────────────────────────────────────────────────
  if (!fromReferenceId?.trim()) {
    return { success: false, error: "fromReferenceId is required.", log: emptyLog() };
  }
  if (!toReferenceId?.trim()) {
    return { success: false, error: "toReferenceId is required.", log: emptyLog() };
  }
  if (fromReferenceId.toLowerCase() === toReferenceId.toLowerCase()) {
    return {
      success: false,
      error: "Source and destination agents must be different.",
      log: emptyLog(),
    };
  }

  // ── 2. Validate both agents exist in MongoDB ─────────────────────────────────
  const [fromDoc, toDoc] = await Promise.all([
    findUserByReferenceId(fromReferenceId),
    findUserByReferenceId(toReferenceId),
  ]);

  if (!fromDoc) {
    return {
      success: false,
      error: `Source agent "${fromReferenceId}" not found in MongoDB.`,
      log: emptyLog(),
    };
  }
  if (!toDoc) {
    return {
      success: false,
      error: `Destination agent "${toReferenceId}" not found in MongoDB.`,
      log: emptyLog(),
    };
  }

  // ── 3. Update Neon accounts ──────────────────────────────────────────────────
  const neonResult = await updateNeon(fromReferenceId, toReferenceId);

  // ── 4. Update Supabase tables (best-effort) ──────────────────────────────────
  const supabaseResults = await updateSupabase(
    fromReferenceId,
    toReferenceId,
    selectedTables,
    historyDateRange,
  );

  const supabaseErrors = Object.entries(supabaseResults).filter(
    ([, r]) => r.error,
  );
  if (supabaseErrors.length > 0) {
    console.warn(
      `[agentDataTransfer] Supabase partial failure from=${fromReferenceId}:`,
      supabaseErrors,
    );
  }

  return {
    success: true,
    log: {
      fromReferenceId,
      toReferenceId,
      neon: neonResult,
      supabase: supabaseResults,
    },
  };
}
