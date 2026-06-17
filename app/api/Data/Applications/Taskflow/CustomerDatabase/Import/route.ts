/**
 * POST /api/Data/Applications/Taskflow/CustomerDatabase/Import
 *
 * Bulk-inserts accounts into the Neon PostgreSQL `accounts` table.
 * Supports all columns: referenceid, tsm, manager, company_name,
 * contact_person, contact_number, email_address, address,
 * delivery_address, region, industry, remarks, status,
 * date_created, date_updated, next_available_date, gender, type,
 * account_reference_number, type_client, company_group,
 * date_transferred, province, city, date_approved, date_removed,
 * transfer_to, tin_number, reason, it_approved_date
 */

import { NextResponse }              from "next/server";
import { neon }                      from "@neondatabase/serverless";
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit";

export const dynamic = "force-dynamic";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const sql = neon(Xchire_databaseUrl);

function getActorFromRequest(req: Request): AuditActor {
  const h = req.headers;
  return {
    uid:   h.get("x-user-id")    || null,
    email: h.get("x-user-email") || "system",
    role:  h.get("x-user-role")  || "unknown",
    name:  h.get("x-user-name")  || null,
  };
}

/** Generate account_reference_number like EC-NCR-0012345 */
function generateAccountRef(companyName: string, region: string): string {
  const words = (companyName ?? "").trim().split(/\s+/).filter(Boolean);
  const initials = words.length >= 2
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : words.length === 1
      ? (words[0][0] + (words[0].slice(-1) || words[0][0])).toUpperCase()
      : "XX";
  const regionCode = (region ?? "").trim().toUpperCase().replace(/\s/g, "").slice(0, 4) || "XX";
  const num = (1 + Math.floor(Math.random() * 9_999_999)).toString().padStart(7, "0");
  return `${initials}-${regionCode}-${num}`;
}

/** Safe string — trim + null-coerce */
const s = (v: any): string | null => {
  if (v === undefined || v === null || v === "") return null;
  return String(v).trim() || null;
};

/** Safe date — accept string/Date/ExcelJS serial, return ISO or null */
function d(v: any): string | null {
  if (!v) return null;
  // ExcelJS returns Date objects for date cells
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  const parsed = new Date(String(v));
  return !isNaN(parsed.getTime()) ? parsed.toISOString() : null;
}

export async function POST(req: Request) {
  try {
    const body  = await req.json();
    const rows: any[] = body.data ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: "No data provided." }, { status: 400 });
    }

    let insertedCount = 0;
    const failed: any[] = [];

    for (const row of rows) {
      try {
        const acctRef = s(row.account_reference_number)
          || generateAccountRef(row.company_name ?? "", row.region ?? "");

        await sql`
          INSERT INTO accounts (
            referenceid, tsm, manager,
            company_name, contact_person, contact_number, email_address,
            address, delivery_address, region,
            industry, remarks, status,
            date_created, date_updated, next_available_date,
            gender, type, account_reference_number, type_client, company_group,
            date_transferred, province, city, date_approved, date_removed,
            transfer_to, tin_number, reason, it_approved_date
          ) VALUES (
            ${s(row.referenceid)},      ${s(row.tsm)},             ${s(row.manager)},
            ${s(row.company_name)},     ${s(row.contact_person)},  ${s(row.contact_number)},  ${s(row.email_address)},
            ${s(row.address)},          ${s(row.delivery_address)}, ${s(row.region)},
            ${s(row.industry)},         ${s(row.remarks)},          ${s(row.status) ?? "Active"},
            ${d(row.date_created) ?? new Date().toISOString()},
            ${d(row.date_updated) ?? new Date().toISOString()},
            ${d(row.next_available_date)},
            ${s(row.gender)},           ${s(row.type)},             ${acctRef},
            ${s(row.type_client) ?? "Prospect"},
            ${s(row.company_group)},
            ${d(row.date_transferred)}, ${s(row.province)},         ${s(row.city)},
            ${d(row.date_approved)},    ${d(row.date_removed)},
            ${s(row.transfer_to)},      ${s(row.tin_number)},       ${s(row.reason)},
            ${d(row.it_approved_date)}
          )
        `;
        insertedCount++;
      } catch (rowErr: any) {
        console.error("[Import row error]", rowErr.message, row.company_name);
        failed.push({ ...row, _error: rowErr.message });
      }
    }

    // Audit log
    try {
      const actor = getActorFromRequest(req);
      await logSystemAudit({
        action:        "import",
        module:        "CustomerDatabase",
        page:          "/taskflow/customer-database",
        resourceType:  "customer",
        resourceId:    null,
        resourceName:  `${insertedCount} customers imported`,
        actor,
        affectedCount: insertedCount,
        source:        "CustomerDatabaseImportAPI",
        metadata:      { totalRecords: rows.length, successfulImports: insertedCount, failedCount: failed.length },
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success:       insertedCount > 0,
      insertedCount,
      failedCount:   failed.length,
      failed,
      message:       `${insertedCount} of ${rows.length} records imported.`,
    });
  } catch (err: any) {
    console.error("[CustomerDatabase Import]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
