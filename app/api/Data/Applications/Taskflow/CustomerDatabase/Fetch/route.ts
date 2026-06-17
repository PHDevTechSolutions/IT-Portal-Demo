import { NextResponse } from "next/server";
import { neon }         from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const Xchire_sql = neon(Xchire_databaseUrl);

/**
 * Only fetch the columns actually used in the customer-database page.
 * Dropping unused heavy columns (e.g. large text blobs) reduces payload size
 * and query time significantly on large tables.
 */
const SELECTED_COLUMNS = `
  id,
  account_reference_number,
  company_name,
  contact_person,
  contact_number,
  email_address,
  address,
  delivery_address,
  region,
  province,
  city,
  type_client,
  type,
  referenceid,
  tsm,
  manager,
  status,
  remarks,
  industry,
  gender,
  company_group,
  transfer_to,
  tin_number,
  reason,
  date_created,
  date_updated,
  next_available_date,
  date_transferred,
  date_approved,
  date_removed,
  it_approved_date
`.trim();

export async function GET() {
  try {
    // Use raw SQL with explicit column list — avoids SELECT * overhead
    const rows = await Xchire_sql(
      `SELECT ${SELECTED_COLUMNS} FROM accounts ORDER BY date_created DESC`
    );

    return NextResponse.json(
      { success: true, data: rows, count: rows.length },
      {
        status: 200,
        headers: {
          // Allow CDN/proxy caching for 30s, then revalidate in background
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
        },
      }
    );
  } catch (err: any) {
    console.error("[CustomerDatabase Fetch]", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch accounts." },
      { status: 500 }
    );
  }
}
