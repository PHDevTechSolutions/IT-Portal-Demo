/**
 * GET /api/taskflow/account-edit-history?account_reference_number=LC-NCR-XXXXX
 *
 * Fetches rows from the `account_edit_history` table in Neon (PostgreSQL)
 * filtered by account_reference_number, ordered by changed_at desc.
 */

import { NextRequest, NextResponse } from "next/server";
import { neon }                       from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("account_reference_number")?.trim();

  if (!ref) {
    return NextResponse.json({ error: "account_reference_number is required." }, { status: 400 });
  }

  try {
    const sql = neon(process.env.TASKFLOW_DB_URL!);

    const rows = await sql`
      SELECT
        id,
        field_name,
        old_value,
        new_value,
        changed_at,
        changed_by,
        reason,
        account_reference_number
      FROM account_edit_history
      WHERE account_reference_number = ${ref}
      ORDER BY changed_at DESC
    `;

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
