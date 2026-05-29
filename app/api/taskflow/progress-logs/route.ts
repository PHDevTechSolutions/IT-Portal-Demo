import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// ── Column → status values mapping ───────────────────────────────────────────
export const COLUMN_PATTERNS: Record<string, string[]> = {
  open:        ["Open", "Pending", "New", "Received", "Endorsed", "For Follow-up", "Follow-up"],
  in_progress: ["In Progress", "On Progress", "On-Progress", "Ongoing", "Processing"],
  approval:    ["Approval for TSM", "For Approval", "Waiting Approval", "For TSM Approval"],
  done:        ["Completed", "Delivered / Closed Transaction", "Quote-Done", "SO-Done", "Resolved", "Closed", "Done"],
  cancelled:   ["Cancelled", "Canceled", "Rejected", "Declined"],
};

export const COLUMN_LABELS: Record<string, string> = {
  open:        "Open / Pending",
  in_progress: "In Progress",
  approval:    "For Approval",
  done:        "Completed / Done",
  cancelled:   "Cancelled",
};

const COLS = [
  "id", "activity_reference_number", "referenceid", "tsm", "manager",
  "type_client", "project_name", "product_category", "project_type", "source",
  "target_quota", "type_activity", "callback", "call_status", "call_type",
  "quotation_number", "quotation_amount", "so_number", "so_amount", "actual_sales",
  "delivery_date", "dr_number", "ticket_reference_number", "remarks", "status",
  "start_date", "end_date", "date_followup", "date_site_visit", "date_created",
  "date_updated", "account_reference_number", "payment_terms", "scheduled_status",
  "product_quantity", "product_amount", "product_description", "product_sku",
  "product_title", "quotation_type", "si_date", "agent", "tsm_approved_status",
  "tsm_approved_remarks", "tsm_approved_date", "company_name", "contact_person",
  "contact_number", "email_address", "address", "vat_type",
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const column   = searchParams.get("column");
    const page     = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "10", 10);
    const search   = searchParams.get("search")?.trim() ?? "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo   = searchParams.get("dateTo");

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    // ── Search mode ───────────────────────────────────────────────────────────
    if (search) {
      let q = supabase
        .from("history")
        .select(COLS.join(","), { count: "exact" })
        .or(`activity_reference_number.ilike.%${search}%,company_name.ilike.%${search}%,ticket_reference_number.ilike.%${search}%`)
        .order("date_created", { ascending: false })
        .range(from, to);

      if (dateFrom) q = q.gte("date_created", dateFrom);
      if (dateTo)   q = q.lte("date_created", dateTo);

      const { data, error, count } = await q;
      if (error) throw new Error(error.message);

      return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0, page, pageSize, mode: "search" });
    }

    // ── Column mode ───────────────────────────────────────────────────────────
    if (!column || !COLUMN_PATTERNS[column]) {
      return NextResponse.json({ success: false, error: "Invalid column" }, { status: 400 });
    }

    const patterns  = COLUMN_PATTERNS[column];
    const orFilter  = patterns.map(p => `status.ilike.${p}`).join(",");

    let q = supabase
      .from("history")
      .select(COLS.join(","), { count: "exact" })
      .or(orFilter)
      .order("date_created", { ascending: false })
      .range(from, to);

    if (dateFrom) q = q.gte("date_created", dateFrom);
    if (dateTo)   q = q.lte("date_created", dateTo);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0, page, pageSize, column, mode: "column" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
