import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// GET /api/crm/leads/fetch
// ?search=xxx        → search by company name or email
// ?page=1&pageSize=30
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const search   = searchParams.get("search")?.trim() ?? "";
    const page     = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "30", 10);
    const from     = (page - 1) * pageSize;
    const to       = from + pageSize - 1;

    let q = supabase
      .from("leads")
      .select("*", { count: "exact" })
      .order("date_created", { ascending: false })
      .range(from, to);

    if (search) {
      q = q.or(`company_name.ilike.%${search}%,email_address.ilike.%${search}%,contact_person.ilike.%${search}%`);
    }

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0, page, pageSize });
  } catch (err: any) {
    console.error("[Leads Fetch]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
