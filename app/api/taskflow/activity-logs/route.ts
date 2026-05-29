import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// ── Column → status values mapping ───────────────────────────────────────────
// Exact status values from the database (case-insensitive ilike match)
export const COLUMN_PATTERNS: Record<string, string[]> = {
  open:        ["Open","Pending","New","Received","Endorsed","For Follow-up","Follow-up"],
  in_progress: ["In Progress","On Progress","On-Progress","Ongoing","Processing"],
  approval:    ["Approval for TSM","For Approval","Waiting Approval","For TSM Approval"],
  done:        ["Completed","Delivered / Closed Transaction","Quote-Done","SO-Done","Resolved","Closed"],
  cancelled:   ["Cancelled","Canceled","Rejected","Declined"],
};

export const COLUMN_LABELS: Record<string, string> = {
  open:        "Open / Pending",
  in_progress: "In Progress",
  approval:    "For Approval",
  done:        "Completed / Done",
  cancelled:   "Cancelled",
};

// ── GET: fetch activities for a specific column with pagination ───────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const column   = searchParams.get("column");   // e.g. "open"
    const page     = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "10", 10);
    const search   = searchParams.get("search")?.trim() ?? "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo   = searchParams.get("dateTo");

    const COLS = ["id","referenceid","tsm","manager","status","date_created",
      "ticket_reference_number","scheduled_date","agent","company_name",
      "contact_person","contact_number","email_address","address","type_client",
      "activity_reference_number","ticket_remarks","cancellation_remarks"];

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    // ── Search mode: search across all columns ────────────────────────────────
    if (search) {
      let q = supabase
        .from("activity")
        .select(COLS.join(","), { count: "exact" })
        .or(`activity_reference_number.ilike.%${search}%,company_name.ilike.%${search}%`)
        .order("date_created", { ascending: false })
        .range(from, to);

      if (dateFrom) q = q.gte("date_created", dateFrom);
      if (dateTo)   q = q.lte("date_created", dateTo);

      const { data, error, count } = await q;
      if (error) throw new Error(error.message);

      return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0, page, pageSize, mode: "search" });
    }

    // ── Column mode: fetch for a specific kanban column ───────────────────────
    if (!column || !COLUMN_PATTERNS[column]) {
      return NextResponse.json({ success: false, error: "Invalid column" }, { status: 400 });
    }

    const patterns = COLUMN_PATTERNS[column];
    // Build case-insensitive OR filter: status.ilike.open,status.ilike.pending,...
    const orFilter = patterns.map(p => `status.ilike.${p}`).join(",");

    let q = supabase
      .from("activity")
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
