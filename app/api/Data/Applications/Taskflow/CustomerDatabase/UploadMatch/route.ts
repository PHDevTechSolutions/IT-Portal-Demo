import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const TASKFLOW_DB_URL = process.env.TASKFLOW_DB_URL;
if (!TASKFLOW_DB_URL) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const sql = neon(TASKFLOW_DB_URL);

type UploadRow = {
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  delivery_address: string;
  type_client: string;
};

type MatchedRecord = {
  id: number;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  delivery_address: string | null;
  type_client: string;
  status: string;
  referenceid: string;
  tsm: string;
  manager: string;
};

type RowMatchResult = {
  rowIndex: number;
  source: UploadRow;
  matched: boolean;
  matchedAccountIds: number[];
  matchedAccounts: MatchedRecord[];
};

const normalize = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const keyFor = (row: UploadRow): string =>
  [
    normalize(row.company_name),
    normalize(row.contact_person),
    normalize(row.contact_number),
    normalize(row.email_address),
    normalize(row.address),
    normalize(row.delivery_address),
    normalize(row.type_client),
  ].join("|");

// Fallback key for "force to one record" behavior.
// Intentionally looser than strict key so rows can still be mapped to one existing record.
const looseKeyFor = (row: UploadRow): string =>
  [
    normalize(row.company_name),
    normalize(row.contact_person),
    normalize(row.email_address),
  ].join("|");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows: UploadRow[] = Array.isArray(body?.rows) ? body.rows : [];

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "rows is required and must be a non-empty array." },
        { status: 400 },
      );
    }

    const accounts = (await sql`
      SELECT
        id,
        company_name,
        contact_person,
        contact_number,
        email_address,
        address,
        delivery_address,
        type_client,
        status,
        referenceid,
        tsm,
        manager
      FROM accounts;
    `) as MatchedRecord[];

    const accountKeyMap = new Map<string, MatchedRecord[]>();
    for (const account of accounts) {
      const key = keyFor({
        company_name: account.company_name,
        contact_person: account.contact_person,
        contact_number: account.contact_number,
        email_address: account.email_address,
        address: account.address,
        delivery_address: account.delivery_address ?? "",
        type_client: account.type_client,
      });

      const existing = accountKeyMap.get(key);
      if (existing) {
        existing.push(account);
      } else {
        accountKeyMap.set(key, [account]);
      }
    }

    const looseAccountKeyMap = new Map<string, MatchedRecord[]>();
    for (const account of accounts) {
      const looseKey = looseKeyFor({
        company_name: account.company_name,
        contact_person: account.contact_person,
        contact_number: account.contact_number,
        email_address: account.email_address,
        address: account.address,
        delivery_address: account.delivery_address ?? "",
        type_client: account.type_client,
      });

      const existing = looseAccountKeyMap.get(looseKey);
      if (existing) {
        existing.push(account);
      } else {
        looseAccountKeyMap.set(looseKey, [account]);
      }
    }

    // Deterministic one-to-one matching:
    // for each key, assign one DB row per Excel row (highest id first).
    const accountQueueMap = new Map<string, MatchedRecord[]>();
    for (const [key, groupedAccounts] of accountKeyMap.entries()) {
      const sorted = [...groupedAccounts].sort((a, b) => b.id - a.id);
      accountQueueMap.set(key, sorted);
    }
    const looseAccountQueueMap = new Map<string, MatchedRecord[]>();
    for (const [key, groupedAccounts] of looseAccountKeyMap.entries()) {
      const sorted = [...groupedAccounts].sort((a, b) => b.id - a.id);
      looseAccountQueueMap.set(key, sorted);
    }

    const uniqueMatchedMap = new Map<number, MatchedRecord>();
    const rowResults: RowMatchResult[] = [];
    let matchedRows = 0;
    const assignedIds = new Set<number>();

    const takeNextUnassigned = (queue: MatchedRecord[]): MatchedRecord | null => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next && !assignedIds.has(next.id)) return next;
      }
      return null;
    };

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const strictKey = keyFor({
        company_name: row.company_name,
        contact_person: row.contact_person,
        contact_number: row.contact_number,
        email_address: row.email_address,
        address: row.address,
        delivery_address: row.delivery_address,
        type_client: row.type_client,
      });
      const looseKey = looseKeyFor({
        company_name: row.company_name,
        contact_person: row.contact_person,
        contact_number: row.contact_number,
        email_address: row.email_address,
        address: row.address,
        delivery_address: row.delivery_address,
        type_client: row.type_client,
      });

      const strictQueue = accountQueueMap.get(strictKey) ?? [];
      const looseQueue = looseAccountQueueMap.get(looseKey) ?? [];

      // 1) strict match first
      // 2) fallback loose match for "force to one record"
      const picked =
        takeNextUnassigned(strictQueue) ?? takeNextUnassigned(looseQueue);
      if (picked) {
        matchedRows += 1;
        uniqueMatchedMap.set(picked.id, picked);
        assignedIds.add(picked.id);
      }

      rowResults.push({
        rowIndex: index + 1,
        source: row,
        matched: Boolean(picked),
        matchedAccountIds: picked ? [picked.id] : [],
        matchedAccounts: picked ? [picked] : [],
      });
    }

    const matchedRecords = Array.from(uniqueMatchedMap.values());

    return NextResponse.json({
      success: true,
      matchedRows,
      unmatchedRows: rows.length - matchedRows,
      matchedRecordsCount: matchedRecords.length,
      matchedRecords,
      rowResults,
    });
  } catch (error: any) {
    console.error(
      "Error in POST /api/Data/Applications/Taskflow/CustomerDatabase/UploadMatch:",
      error,
    );
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
