import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL_IT!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_IT!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
    const dateFrom = searchParams.get("dateFrom"); // ISO string or null
    const dateTo   = searchParams.get("dateTo");   // ISO string or null
    const status   = searchParams.get("status");   // exact match or null
    const priority = searchParams.get("priority"); // exact match or null
    const search   = searchParams.get("search");   // free-text or null

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    // ── Build query ──────────────────────────────────────────────────────────
    let query = supabase
      .from("tickets")
      .select("*", { count: "exact" })
      .order("date_created", { ascending: false })
      .range(from, to);

    if (dateFrom) query = query.gte("date_created", dateFrom);
    if (dateTo)   query = query.lte("date_created", dateTo);
    if (status && status !== "all")   query = query.ilike("status",   status);
    if (priority && priority !== "all") query = query.ilike("priority", priority);

    // Free-text search across key columns using Postgres full-text or ilike OR
    if (search) {
      const like = `%${search}%`;
      query = query.or(
        [
          "ticket_id",
          "referenceid",
          "requestor_name",
          "department",
          "request_type",
          "type_concern",
          "technician_name",
          "site",
          "ticket_subject",
        ]
          .map((col) => `${col}.ilike.${like}`)
          .join(",")
      );
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
