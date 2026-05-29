import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// GET /api/crm/communications/fetch
// ?email=xxx           → all threads for a specific email
// ?company=xxx         → all threads for a company
// ?thread_id=xxx       → all messages in a thread
// ?page=1&pageSize=20  → pagination
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const email     = searchParams.get("email");
    const company   = searchParams.get("company");
    const thread_id = searchParams.get("thread_id");
    const page      = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize  = parseInt(searchParams.get("pageSize") ?? "20", 10);
    const from      = (page - 1) * pageSize;
    const to        = from + pageSize - 1;

    let q = supabase
      .from("communications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: thread_id ? true : false })
      .range(from, to);

    if (thread_id) {
      q = q.eq("thread_id", thread_id);
    } else if (email) {
      q = q.eq("email_address", email);
    } else if (company) {
      q = q.ilike("company_name", `%${company}%`);
    }

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0, page, pageSize });
  } catch (err: any) {
    console.error("[Communications Fetch]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
