import { NextRequest, NextResponse } from "next/server";
import { getTaskLogCollection } from "@/lib/mongo/Collections/PantsIn";
import { createClient } from "@supabase/supabase-js";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// ── Available databases ───────────────────────────────────────────────────────
export const LOOKUP_DATABASES = [
  {
    id:          "supabase_accounts",
    label:       "Supabase — accounts",
    description: "Taskflow customer accounts (account_reference_number, company_name)",
  },
  {
    id:          "neon_accounts",
    label:       "Neon (PostgreSQL) — accounts",
    description: "Taskflow Neon DB accounts table",
  },
] as const;

export type LookupDbId = typeof LOOKUP_DATABASES[number]["id"];

export interface LookupMatch {
  attendanceId:            string;   // MongoDB _id
  referenceId:             string;   // ReferenceID from attendance
  siteVisitAccount:        string;   // what we searched for
  foundAccountRef:         string;   // account_reference_number found
  foundCompanyName:        string;   // company_name found
  confidence:              "exact" | "partial";
}

// ── Search a single account name in the selected DB ───────────────────────────
async function searchInSupabase(name: string): Promise<{ accountRef: string; companyName: string } | null> {
  const { data } = await supabase
    .from("accounts")
    .select("account_reference_number, company_name")
    .ilike("company_name", `%${name}%`)
    .limit(1)
    .single();
  if (!data) return null;
  return { accountRef: data.account_reference_number ?? "", companyName: data.company_name ?? "" };
}

async function searchInNeon(name: string): Promise<{ accountRef: string; companyName: string } | null> {
  try {
    const sql = neon(process.env.TASKFLOW_DB_URL!);
    const rows = await sql`
      SELECT account_reference_number, company_name
      FROM accounts
      WHERE LOWER(company_name) LIKE LOWER(${"%" + name + "%"})
      LIMIT 1
    `;
    if (!rows.length) return null;
    return { accountRef: rows[0].account_reference_number ?? "", companyName: rows[0].company_name ?? "" };
  } catch { return null; }
}

// POST /api/hr/attendance/lookup
// Body: { database: "supabase_accounts" | "neon_accounts" }
// Finds all attendance records with empty account_reference_number
// and tries to match them via SiteVisitAccount in the selected DB
export async function POST(req: NextRequest) {
  try {
    const { database } = await req.json() as { database: LookupDbId };

    if (!database) {
      return NextResponse.json({ success: false, error: "Database selection required" }, { status: 400 });
    }

    const collection = await getTaskLogCollection();

    // Fetch attendance records where account_reference_number is empty/missing
    // and Type is Client-Visit and SiteVisitAccount is not empty
    const emptyRecords = await collection
      .find({
        Type:    { $regex: /^client.visit$/i },
        $or: [
          { account_reference_number: { $exists: false } },
          { account_reference_number: "" },
          { account_reference_number: null },
        ],
        SiteVisitAccount: { $exists: true, $ne: "" },
      })
      .limit(200)
      .toArray();

    if (emptyRecords.length === 0) {
      return NextResponse.json({
        success: true,
        matches: [],
        message: "All client visit records already have account reference numbers.",
        total: 0,
      });
    }

    // For each record, search the selected database
    const matches: LookupMatch[] = [];
    const searchFn = database === "supabase_accounts" ? searchInSupabase : searchInNeon;

    // Deduplicate by SiteVisitAccount to avoid redundant DB calls
    const uniqueNames = [...new Set(emptyRecords.map(r => (r as any).SiteVisitAccount as string).filter(Boolean))];
    const cache = new Map<string, { accountRef: string; companyName: string } | null>();

    for (const name of uniqueNames) {
      const result = await searchFn(name);
      cache.set(name, result);
    }

    for (const rec of emptyRecords) {
      const siteAccount = (rec as any).SiteVisitAccount as string;
      if (!siteAccount) continue;

      const found = cache.get(siteAccount);
      if (!found || !found.accountRef) continue;

      // Determine confidence: exact match vs partial
      const confidence: "exact" | "partial" =
        found.companyName.toLowerCase() === siteAccount.toLowerCase() ? "exact" : "partial";

      matches.push({
        attendanceId:     rec._id!.toString(),
        referenceId:      rec.ReferenceID ?? "",
        siteVisitAccount: siteAccount,
        foundAccountRef:  found.accountRef,
        foundCompanyName: found.companyName,
        confidence,
      });
    }

    return NextResponse.json({
      success:      true,
      matches,
      total:        emptyRecords.length,
      matched:      matches.length,
      unmatched:    emptyRecords.length - matches.length,
      database,
    });
  } catch (err: any) {
    console.error("[Attendance Lookup]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
