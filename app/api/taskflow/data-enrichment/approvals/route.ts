/**
 * /api/taskflow/data-enrichment/approvals
 *
 * POST — submit enriched fields for approval (one row per customer per field)
 * GET  — fetch pending approvals
 * PUT  — approve or reject a suggestion
 *
 * Supabase table: enrichment_approvals
 * Schema (run once in Supabase SQL editor):
 *
 * CREATE TABLE IF NOT EXISTS enrichment_approvals (
 *   id               BIGSERIAL PRIMARY KEY,
 *   account_id       INTEGER       NOT NULL,
 *   company_name     TEXT          NOT NULL,
 *   field_name       TEXT          NOT NULL,   -- 'contact_person' | 'contact_number' | 'email_address' | 'address'
 *   current_value    TEXT          NOT NULL DEFAULT '',
 *   suggested_value  TEXT          NOT NULL,
 *   source_url       TEXT          NOT NULL DEFAULT '',
 *   status           TEXT          NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
 *   submitted_by     TEXT,
 *   reviewed_by      TEXT,
 *   reviewed_at      TIMESTAMPTZ,
 *   created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
 * );
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!;
  return createClient(url, key);
}

function getNeon() {
  const url = process.env.TASKFLOW_DB_URL;
  if (!url) throw new Error("TASKFLOW_DB_URL is not set.");
  return neon(url);
}

// ─── POST — submit suggestions for approval ───────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      submissions: {
        account_id:      number;
        company_name:    string;
        field_name:      string;
        current_value:   string;
        suggested_value: string;
        source_url:      string;
      }[];
      submitted_by?: string;
    };

    const { submissions, submitted_by = "" } = body;

    if (!Array.isArray(submissions) || submissions.length === 0) {
      return NextResponse.json({ success: false, error: "No submissions provided." }, { status: 400 });
    }

    const supabase = getSupabase();

    const rows = submissions.map(s => ({
      account_id:      s.account_id,
      company_name:    s.company_name,
      field_name:      s.field_name,
      current_value:   s.current_value  ?? "",
      suggested_value: s.suggested_value,
      source_url:      s.source_url     ?? "",
      status:          "pending",
      submitted_by,
    }));

    const { data, error } = await supabase
      .from("enrichment_approvals")
      .insert(rows)
      .select("id, field_name, company_name");

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, inserted: data?.length ?? 0 });
  } catch (err: any) {
    console.error("[Enrichment Approvals POST]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── GET — fetch approvals (optionally filter by status) ─────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status     = searchParams.get("status") ?? "pending";
    const account_id = searchParams.get("account_id");

    const supabase = getSupabase();
    let q = supabase
      .from("enrichment_approvals")
      .select("*")
      .order("created_at", { ascending: false });

    if (status !== "all") q = q.eq("status", status);
    if (account_id)       q = q.eq("account_id", Number(account_id));

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err: any) {
    console.error("[Enrichment Approvals GET]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── PUT — approve or reject ──────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const { id, action, reviewed_by = "" } = await req.json() as {
      id:          number;
      action:      "approve" | "reject";
      reviewed_by?: string;
    };

    if (!id || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ success: false, error: "id and action (approve|reject) are required." }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch the approval row first
    const { data: row, error: fetchErr } = await supabase
      .from("enrichment_approvals")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json({ success: false, error: "Approval not found." }, { status: 404 });
    }

    // Update status
    const { error: updateErr } = await supabase
      .from("enrichment_approvals")
      .update({
        status:      action === "approve" ? "approved" : "rejected",
        reviewed_by,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) throw new Error(updateErr.message);

    // If approved — write the suggested value back to the Neon accounts table
    if (action === "approve") {
      const sql = getNeon();
      const field = row.field_name as string;
      const value = row.suggested_value as string;

      // Only allow known safe field names to prevent SQL injection
      const ALLOWED_FIELDS = ["contact_person", "contact_number", "email_address", "address"];
      if (!ALLOWED_FIELDS.includes(field)) {
        return NextResponse.json({ success: false, error: `Unknown field: ${field}` }, { status: 400 });
      }

      // Dynamic column update using tagged template per field
      if (field === "contact_person") {
        await sql`UPDATE accounts SET contact_person = ${value}, date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila' WHERE id = ${row.account_id}`;
      } else if (field === "contact_number") {
        await sql`UPDATE accounts SET contact_number = ${value}, date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila' WHERE id = ${row.account_id}`;
      } else if (field === "email_address") {
        await sql`UPDATE accounts SET email_address = ${value}, date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila' WHERE id = ${row.account_id}`;
      } else if (field === "address") {
        await sql`UPDATE accounts SET address = ${value}, date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila' WHERE id = ${row.account_id}`;
      }
    }

    return NextResponse.json({ success: true, action, id });
  } catch (err: any) {
    console.error("[Enrichment Approvals PUT]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
