import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logSystemAudit, type AuditActor } from "@/lib/audit/system-audit";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

function getActorFromRequest(req: Request): AuditActor {
  const headers = req.headers;
  return {
    uid:   headers.get("x-user-id")    || null,
    email: headers.get("x-user-email") || "system",
    role:  headers.get("x-user-role")  || "unknown",
    name:  headers.get("x-user-name")  || null,
  };
}

function getCompanyInitials(companyName: string): string {
  const words = companyName.trim().split(/\s+/);
  if (words.length === 0) return "XX";
  if (words.length === 1) {
    const first = words[0][0] || "X";
    const last  = words[0].slice(-1) || first;
    return (first + last).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function generateAccountRef(companyName: string, region: string): string {
  const initials    = getCompanyInitials(companyName);
  const regionCode  = region?.trim() ? region.trim().toUpperCase().replace(/\s/g, "").slice(0, 4) : "XX";
  const paddedNum   = (1 + Math.floor(Math.random() * 9999999)).toString().padStart(7, "0");
  return `${initials}-${regionCode}-${paddedNum}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data } = body;

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ success: false, error: "Missing data." }, { status: 400 });
    }

    const rows = data.map((account: any) => ({
      account_reference_number: generateAccountRef(account.company_name || "XX", account.region || ""),
      referenceid:      account.referenceid    || "",
      manager:          account.manager        || "",
      tsm:              account.tsm            || "",
      company_name:     account.company_name   || "",
      contact_person:   account.contact_person || "",
      contact_number:   account.contact_number || "",
      email_address:    account.email_address  || "",
      type_client:      account.type_client    || "Prospect",
      address:          account.address        || "",
      delivery_address: account.delivery_address || "",
      region:           account.region         || "",
      status:           account.status         || "Active",
      industry:         account.industry       || "",
      remarks:          account.remarks        || "",
      date_created:     new Date().toISOString(),
    }));

    const { data: inserted, error } = await supabase
      .from("accounts")
      .insert(rows)
      .select("id");

    if (error) throw new Error(error.message);

    const insertedCount = inserted?.length ?? 0;

    await logImportAudit(req, insertedCount, data.length);

    return NextResponse.json({
      success:       insertedCount === data.length,
      insertedCount,
      message:       `${insertedCount} records imported successfully!`,
      failed:        insertedCount < data.length ? data.slice(insertedCount) : [],
    });
  } catch (err: any) {
    console.error("[CustomerDatabase Import]", err.message);
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function logImportAudit(req: Request, insertedCount: number, totalCount: number) {
  const actor = getActorFromRequest(req);
  await logSystemAudit({
    action:       "import",
    module:       "CustomerDatabase",
    page:         "/taskflow/customer-database",
    resourceType: "customer",
    resourceId:   null,
    resourceName: `${insertedCount} customers imported`,
    actor,
    affectedCount: insertedCount,
    source:       "CustomerDatabaseImportAPI",
    metadata:     { totalRecords: totalCount, successfulImports: insertedCount },
  });
}
