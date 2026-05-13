/**
 * lib/services/tsaTransfer.ts
 *
 * Centralised business logic for transferring a TSA to a new TSM or Manager.
 *
 * Update order (fail-fast with rollback):
 *   1. Validate  — TSA and supervisor must exist in MongoDB
 *   2. MongoDB   — update user doc (primary source of truth)
 *   3. Neon      — update accounts table (Neon failure → rollback MongoDB)
 *   4. Supabase  — update selected tables (best-effort; partial failures logged)
 *
 * New in this version:
 *   • selectedTables  — caller chooses which Supabase tables to update
 *   • historyDateRange — optional date filter applied only to the "history" table
 */

import { ObjectId } from "mongodb";
import { neon } from "@neondatabase/serverless";
import { createClient } from "@supabase/supabase-js";
import { connectToDatabase } from "@/lib/MongoDB";

// ─── Config ──────────────────────────────────────────────────────────────────

/** All Supabase tables that carry referenceid + tsm/manager columns */
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
export type TransferField = "tsm" | "manager";

// ─── DB client factories ──────────────────────────────────────────────────────

function getNeon() {
  const url = process.env.TASKFLOW_DB_URL;
  if (!url) throw new Error("DATABASE_URL env var is not set.");
  return neon(url);
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_IT;
  if (!url || !key)
    throw new Error(
      "Supabase IT env vars (NEXT_PUBLIC_SUPABASE_URL_IT / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_IT) are not set.",
    );
  return createClient(url, key);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HistoryDateRange {
  /** ISO date string  YYYY-MM-DD  — inclusive start */
  from: string;
  /** ISO date string  YYYY-MM-DD  — inclusive end (treated as end-of-day) */
  to: string;
}

export interface TransferInput {
  tsaReferenceId: string;
  field: TransferField;
  newSupervisorReferenceId: string;
  /**
   * Which Supabase tables to update.
   * Defaults to ALL tables when omitted.
   */
  selectedTables?: string[];
  /**
   * Date range filter applied to the "history" table only.
   * Ignored for all other tables.
   */
  historyDateRange?: HistoryDateRange;
}

export interface TableResult {
  updated: number;
  skipped?: boolean;
  error?: string;
}

export interface TransferResult {
  success: boolean;
  error?: string;
  log: {
    tsaReferenceId: string;
    field: TransferField;
    previousValue: string | null;
    newValue: string;
    mongodb: "ok" | "failed" | "rolled_back";
    neon: TableResult;
    supabase: Record<string, TableResult>;
  };
}

// ─── Validation helpers ───────────────────────────────────────────────────────

async function findUserByReferenceId(referenceId: string) {
  const db = await connectToDatabase();
  return db.collection("users").findOne({
    ReferenceID: { $regex: new RegExp(`^${referenceId}$`, "i") },
  });
}

// ─── Individual DB updaters ───────────────────────────────────────────────────

async function updateMongoDB(
  tsaMongoId: string,
  field: TransferField,
  newSupervisorReferenceId: string,
): Promise<void> {
  const db = await connectToDatabase();
  const fieldKey = field === "tsm" ? "TSM" : "Manager";
  const result = await db
    .collection("users")
    .updateOne(
      { _id: new ObjectId(tsaMongoId) },
      { $set: { [fieldKey]: newSupervisorReferenceId, updatedAt: new Date() } },
    );
  if (result.matchedCount === 0) {
    throw new Error(`MongoDB: user ${tsaMongoId} not found during update.`);
  }
}

async function rollbackMongoDB(
  tsaMongoId: string,
  field: TransferField,
  previousValue: string | null,
): Promise<void> {
  const db = await connectToDatabase();
  const fieldKey = field === "tsm" ? "TSM" : "Manager";
  await db
    .collection("users")
    .updateOne(
      { _id: new ObjectId(tsaMongoId) },
      { $set: { [fieldKey]: previousValue ?? "", updatedAt: new Date() } },
    );
}

/** Neon: update accounts table. Uses explicit branches — column names cannot
 *  be interpolated with Neon's tagged-template client. */
async function updateNeon(
  tsaReferenceId: string,
  field: TransferField,
  newSupervisorReferenceId: string,
): Promise<TableResult> {
  const sql = getNeon();
  const rows =
    field === "tsm"
      ? await sql`
          UPDATE accounts
          SET    tsm          = ${newSupervisorReferenceId},
                 date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
          WHERE  LOWER(referenceid) = LOWER(${tsaReferenceId})
          RETURNING id
        `
      : await sql`
          UPDATE accounts
          SET    manager      = ${newSupervisorReferenceId},
                 date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
          WHERE  LOWER(referenceid) = LOWER(${tsaReferenceId})
          RETURNING id
        `;
  return { updated: rows.length };
}

/**
 * Update a single Supabase table.
 *
 * Special case — "history":
 *   When historyDateRange is provided, only rows whose date_created falls
 *   within [from, to] (inclusive, end-of-day) are updated. This prevents
 *   accidentally overwriting historical records outside the intended window.
 */
async function updateSupabaseTable(
  table: string,
  tsaReferenceId: string,
  field: TransferField,
  newSupervisorReferenceId: string,
  historyDateRange?: HistoryDateRange,
): Promise<TableResult> {
  const supabase = getSupabase();
  
  // Use lowercase column names directly since user confirmed all columns are lowercase
  const refCol = "referenceid";
  const fieldCol = field; // "tsm" or "manager"
  
  console.log(`[tsaTransfer] Updating ${table}: refId=${tsaReferenceId}, field=${fieldCol}, newValue=${newSupervisorReferenceId}`);
  
  try {
    // First check if any rows match
    const { count: rowCount, error: countError } = await supabase
      .from(table)
      .select(refCol, { count: "exact", head: true })
      .eq(refCol, tsaReferenceId);
    
    if (countError) {
      console.error(`[tsaTransfer] Error counting rows in ${table}:`, countError.message);
      return { updated: 0, error: `Cannot query ${table}: ${countError.message}` };
    }
    
    if (!rowCount || rowCount === 0) {
      console.warn(`[tsaTransfer] No rows in ${table} with ${refCol}=${tsaReferenceId}`);
      return { updated: 0, error: `No rows match reference ID "${tsaReferenceId}"` };
    }
    
    console.log(`[tsaTransfer] Found ${rowCount} rows in ${table} to update`);
    
    // Build and execute update query
    let query = supabase
      .from(table)
      .update({ [fieldCol]: newSupervisorReferenceId })
      .eq(refCol, tsaReferenceId);
    
    // Apply date range filter only for the history table
    if (table === "history" && historyDateRange?.from && historyDateRange?.to) {
      query = (query as any)
        .gte("date_created", `${historyDateRange.from}T00:00:00`)
        .lte("date_created", `${historyDateRange.to}T23:59:59`);
    }
    
    const { error: updateError } = await query;
    
    if (updateError) {
      console.error(`[tsaTransfer] Update error in ${table}:`, updateError.message);
      return { updated: 0, error: updateError.message };
    }
    
    // Verify the update by counting rows with new value
    const { count: updatedCount, error: verifyError } = await supabase
      .from(table)
      .select(refCol, { count: "exact", head: true })
      .eq(refCol, tsaReferenceId)
      .eq(fieldCol, newSupervisorReferenceId);
    
    if (verifyError) {
      console.log(`[tsaTransfer] Update succeeded but verification failed: ${verifyError.message}`);
      return { updated: rowCount }; // Assume all were updated if we can't verify
    }
    
    console.log(`[tsaTransfer] SUCCESS: Updated ${updatedCount}/${rowCount} rows in ${table}`);
    return { updated: updatedCount || 0 };
    
  } catch (err: any) {
    console.error(`[tsaTransfer] Exception in ${table}:`, err.message);
    return { updated: 0, error: err.message };
  }
}

/**
 * Update selected Supabase tables sequentially so the caller can stream
 * per-table results back to the client as each resolves.
 * Returns a map of table → result.
 */
async function updateSupabase(
  tsaReferenceId: string,
  field: TransferField,
  newSupervisorReferenceId: string,
  selectedTables?: string[],
  historyDateRange?: HistoryDateRange,
): Promise<Record<string, TableResult>> {
  // Determine which tables to update
  console.log(`[tsaTransfer] RAW selectedTables:`, JSON.stringify(selectedTables));
  console.log(`[tsaTransfer] selectedTables type:`, typeof selectedTables);
  console.log(`[tsaTransfer] selectedTables isArray:`, Array.isArray(selectedTables));
  console.log(`[tsaTransfer] selectedTables length:`, selectedTables?.length);
  
  let tablesToUpdate: string[];
  
  if (!selectedTables || selectedTables.length === 0) {
    console.log(`[tsaTransfer] No selectedTables provided, updating ALL tables`);
    tablesToUpdate = [...SUPABASE_TABLES];
  } else {
    // Use selectedTables directly - just normalize case
    const normalizedInput = selectedTables.map(t => String(t).trim().toLowerCase());
    const normalizedSupabase = SUPABASE_TABLES.map(t => t.toLowerCase());
    
    console.log(`[tsaTransfer] normalizedInput:`, JSON.stringify(normalizedInput));
    console.log(`[tsaTransfer] normalizedSupabase:`, JSON.stringify(normalizedSupabase));
    
    // Find intersection: tables that are both in SUPABASE_TABLES and selectedTables
    tablesToUpdate = SUPABASE_TABLES.filter((t) => {
      const tLower = t.toLowerCase();
      const isSelected = normalizedInput.includes(tLower);
      const isValidTable = normalizedSupabase.includes(tLower);
      console.log(`[tsaTransfer] Table "${t}" - isSelected: ${isSelected}, isValidTable: ${isValidTable}`);
      return isSelected && isValidTable;
    });
    
    // If after filtering we get empty array, try accepting selectedTables as-is
    if (tablesToUpdate.length === 0 && selectedTables.length > 0) {
      console.log(`[tsaTransfer] WARNING: No tables matched after filtering. Trying direct match...`);
      const validTables = SUPABASE_TABLES.map(t => t.toLowerCase());
      tablesToUpdate = selectedTables.filter(t => {
        const tLower = t.toLowerCase();
        return validTables.includes(tLower as any) || SUPABASE_TABLES.includes(t as any);
      });
    }
  }
  
  console.log(`[tsaTransfer] FINAL tablesToUpdate:`, JSON.stringify(tablesToUpdate));

  const out: Record<string, TableResult> = {};

  // Mark skipped tables so the client can show them greyed out
  for (const t of SUPABASE_TABLES) {
    if (!tablesToUpdate.includes(t)) {
      out[t] = { updated: 0, skipped: true };
    }
  }

  // Run selected tables in parallel (best-effort — failures never throw)
  const results = await Promise.allSettled(
    tablesToUpdate.map((table) =>
      updateSupabaseTable(
        table,
        tsaReferenceId,
        field,
        newSupervisorReferenceId,
        historyDateRange,
      ).then((r) => ({ table, result: r })),
    ),
  );

  for (const settled of results) {
    if (settled.status === "fulfilled") {
      out[settled.value.table] = settled.value.result;
    } else {
      // Promise-level rejection (shouldn't happen — updateSupabaseTable never throws)
      out["__error__"] = {
        updated: 0,
        error: settled.reason?.message ?? "Unknown error",
      };
    }
  }

  return out;
}

// ─── Main transfer service ────────────────────────────────────────────────────

export async function transferTSA(
  input: TransferInput,
): Promise<TransferResult> {
  const {
    tsaReferenceId,
    field,
    newSupervisorReferenceId,
    selectedTables,
    historyDateRange,
  } = input;

  console.log(`[transferTSA] START - received selectedTables:`, JSON.stringify(selectedTables));

  const emptyLog = (mongodb: TransferResult["log"]["mongodb"] = "failed") => ({
    tsaReferenceId,
    field,
    previousValue: null as string | null,
    newValue: newSupervisorReferenceId,
    mongodb,
    neon: { updated: 0 },
    supabase: {} as Record<string, TableResult>,
  });

  // ── 1. Validate inputs ───────────────────────────────────────────────────────
  if (!tsaReferenceId?.trim()) {
    return {
      success: false,
      error: "tsaReferenceId is required.",
      log: emptyLog(),
    };
  }
  if (!newSupervisorReferenceId?.trim()) {
    return {
      success: false,
      error: "newSupervisorReferenceId is required.",
      log: emptyLog(),
    };
  }

  // ── 2. Look up TSA in MongoDB ────────────────────────────────────────────────
  const tsaDoc = await findUserByReferenceId(tsaReferenceId);
  if (!tsaDoc) {
    return {
      success: false,
      error: `TSA with referenceId "${tsaReferenceId}" not found in MongoDB.`,
      log: emptyLog(),
    };
  }

  // ── 3. Look up supervisor in MongoDB ────────────────────────────────────────
  const supervisorDoc = await findUserByReferenceId(newSupervisorReferenceId);
  if (!supervisorDoc) {
    return {
      success: false,
      error: `Supervisor with referenceId "${newSupervisorReferenceId}" not found in MongoDB.`,
      log: emptyLog(),
    };
  }

  const fieldKey = field === "tsm" ? "TSM" : "Manager";
  const previousValue: string | null = tsaDoc[fieldKey] ?? null;

  // Short-circuit if already assigned to the same supervisor
  if (
    previousValue &&
    previousValue.toLowerCase() === newSupervisorReferenceId.toLowerCase()
  ) {
    return {
      success: true,
      log: {
        tsaReferenceId,
        field,
        previousValue,
        newValue: newSupervisorReferenceId,
        mongodb: "ok",
        neon: { updated: 0 },
        supabase: Object.fromEntries(
          SUPABASE_TABLES.map((t) => [t, { updated: 0, skipped: true }]),
        ),
      },
    };
  }

  const tsaMongoId = tsaDoc._id.toString();

  // ── 4. Update MongoDB (primary source of truth) ──────────────────────────────
  try {
    await updateMongoDB(tsaMongoId, field, newSupervisorReferenceId);
  } catch (err: any) {
    return {
      success: false,
      error: `MongoDB update failed: ${err.message}`,
      log: { ...emptyLog("failed"), previousValue },
    };
  }

  // ── 5. Update Neon (rollback MongoDB on failure) ─────────────────────────────
  let neonResult: TableResult;
  try {
    neonResult = await updateNeon(
      tsaReferenceId,
      field,
      newSupervisorReferenceId,
    );
  } catch (err: any) {
    try {
      await rollbackMongoDB(tsaMongoId, field, previousValue);
    } catch (rollbackErr: any) {
      console.error(
        `[tsaTransfer] CRITICAL: Neon failed AND MongoDB rollback failed. ` +
          `TSA=${tsaReferenceId} field=${field} mongoId=${tsaMongoId} prev=${previousValue}`,
      );
    }
    return {
      success: false,
      error: `Neon update failed (MongoDB rolled back): ${err.message}`,
      log: {
        tsaReferenceId,
        field,
        previousValue,
        newValue: newSupervisorReferenceId,
        mongodb: "rolled_back",
        neon: { updated: 0, error: err.message },
        supabase: {},
      },
    };
  }

  // ── 6. Update Supabase (best-effort) ─────────────────────────────────────────
  const supabaseResults = await updateSupabase(
    tsaReferenceId,
    field,
    newSupervisorReferenceId,
    selectedTables,
    historyDateRange,
  );

  const supabaseErrors = Object.entries(supabaseResults).filter(
    ([, r]) => r.error,
  );
  if (supabaseErrors.length > 0) {
    console.warn(
      `[tsaTransfer] Supabase partial failure for TSA=${tsaReferenceId}:`,
      supabaseErrors,
    );
  }

  return {
    success: true,
    log: {
      tsaReferenceId,
      field,
      previousValue,
      newValue: newSupervisorReferenceId,
      mongodb: "ok",
      neon: neonResult,
      supabase: supabaseResults,
    },
  };
}
