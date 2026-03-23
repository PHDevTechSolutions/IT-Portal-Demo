import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { createClient } from "@supabase/supabase-js";

// ─── DB clients ──────────────────────────────────────────────────────────────

const getNeonSql = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return neon(url);
};

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL_IT;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_IT;
  if (!url || !key)
    throw new Error(
      "Supabase IT credentials (NEXT_PUBLIC_SUPABASE_URL_IT / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_IT) are not set.",
    );
  return createClient(url, key);
};

// Tables in Supabase that carry tsm / manager columns keyed by referenceid
const SUPABASE_TABLES = [
  "activity",
  "documentation",
  "history",
  "revised_quotations",
  "meetings",
  "signatories",
  "spf_request",
] as const;

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { referenceId, field, newValue } = body as {
      referenceId?: string;
      field?: string;
      newValue?: string;
    };

    // Validate
    if (!referenceId?.trim()) {
      return NextResponse.json(
        { success: false, error: "referenceId is required." },
        { status: 400 },
      );
    }
    if (field !== "tsm" && field !== "manager") {
      return NextResponse.json(
        { success: false, error: "field must be 'tsm' or 'manager'." },
        { status: 400 },
      );
    }
    if (!newValue?.trim()) {
      return NextResponse.json(
        { success: false, error: "newValue is required." },
        { status: 400 },
      );
    }

    const refId = referenceId.trim();
    const val = newValue.trim();

    const results: Record<string, { updated: number; error?: string }> = {};

    // ── 1. Neon: accounts table ───────────────────────────────────────────────
    try {
      const sql = getNeonSql();

      // ILIKE for case-insensitive match on referenceid
      if (field === "tsm") {
        const rows = await sql`
          UPDATE accounts
          SET    tsm          = ${val},
                 date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
          WHERE  LOWER(referenceid) = LOWER(${refId})
          RETURNING id
        `;
        results["neon:accounts:tsm"] = { updated: rows.length };
      } else {
        const rows = await sql`
          UPDATE accounts
          SET    manager      = ${val},
                 date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
          WHERE  LOWER(referenceid) = LOWER(${refId})
          RETURNING id
        `;
        results["neon:accounts:manager"] = { updated: rows.length };
      }
    } catch (err: any) {
      results["neon:accounts"] = { updated: 0, error: err.message };
    }

    // ── 2. Supabase: iterate all target tables ────────────────────────────────
    try {
      const supabase = getSupabase();

      for (const table of SUPABASE_TABLES) {
        try {
          // Supabase JS uses ilike for case-insensitive filter
          const { data, error } = await supabase
            .from(table)
            .update({ [field]: val })
            .ilike("referenceid", refId); // ilike with exact string = case-insensitive equality

          if (error) {
            results[`supabase:${table}`] = { updated: 0, error: error.message };
          } else {
            // Supabase doesn't return count by default; use data length when available
            results[`supabase:${table}`] = {
              updated: (data as any[] | null)?.length ?? -1,
            };
          }
        } catch (tableErr: any) {
          results[`supabase:${table}`] = {
            updated: 0,
            error: tableErr.message,
          };
        }
      }
    } catch (err: any) {
      // Client init failed
      for (const table of SUPABASE_TABLES) {
        results[`supabase:${table}`] = { updated: 0, error: err.message };
      }
    }

    // Determine overall success (Neon must succeed; Supabase partial is acceptable)
    const neonKey =
      field === "tsm" ? "neon:accounts:tsm" : "neon:accounts:manager";
    const neonOk = !results[neonKey]?.error;

    return NextResponse.json({
      success: neonOk,
      referenceId: refId,
      field,
      newValue: val,
      results,
    });
  } catch (err: any) {
    console.error("[SyncTsmManager]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error." },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
