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
      // PostgREST's .or() parser breaks on commas inside values (e.g. "Company, Inc.").
      // Fix: run each column as a separate parallel query then merge server-side.
      // This fully avoids the PostgREST comma-in-value parsing bug.
      const cols = [
        "activity_reference_number",
        "company_name",
        "ticket_reference_number",
        "contact_person",
        "contact_number",
        "referenceid",
      ];

      // Run each column as a separate query then merge — avoids the comma parsing bug
      const promises = cols.map(col =>
        supabase
          .from("history")
          .select(COLS.join(","), { count: "exact" })
          .ilike(col, `%${search}%`)
          .order("date_created", { ascending: false })
          .range(0, 999), // fetch up to 1000 per column, dedupe after
      );

      const results = await Promise.all(promises);
      const errors  = results.filter(r => r.error);
      if (errors.length === cols.length) throw new Error(errors[0].error!.message);

      // Merge, dedupe by id, sort by date_created desc
      const seen = new Set<string>();
      const merged: any[] = [];
      for (const r of results) {
        for (const row of r.data ?? []) {
          if (!seen.has(row.id)) { seen.add(row.id); merged.push(row); }
        }
      }
      merged.sort((a, b) =>
        new Date(b.date_created ?? 0).getTime() - new Date(a.date_created ?? 0).getTime(),
      );

      // Apply date filters client-side after merge
      let filtered = merged;
      if (dateFrom) filtered = filtered.filter(r => r.date_created >= dateFrom);
      if (dateTo)   filtered = filtered.filter(r => r.date_created <= dateTo);

      const total  = filtered.length;
      const paged  = filtered.slice(from, to + 1);

      return NextResponse.json({ success: true, data: paged, total, page, pageSize, mode: "search" });
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
