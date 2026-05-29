import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function POST(req: NextRequest) {
  try {
    const { leads, search_query, search_mode, region } = await req.json();

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ success: false, error: "No leads provided" }, { status: 400 });
    }

    const rows = leads.map((l: any) => ({
      company_name:   l.company_name   || "",
      contact_person: l.contact_person || "",
      contact_number: l.contact_number || "",
      email_address:  l.email_address  || "",
      address:        l.address        || "",
      website:        l.website        || "",
      industry:       l.industry       || "",
      region:         region           || "",
      source:         l.source         || "",
      search_query:   search_query     || "",
      search_mode:    search_mode      || "web",
      confidence:     ["high","medium","low"].includes(l.confidence) ? l.confidence : "low",
      status:         "New",
      remarks:        `Discovered via ${search_mode || "web"} · Confidence: ${l.confidence}`,
    }));

    const { data: inserted, error } = await supabase
      .from("leads")
      .insert(rows)
      .select("id, company_name");

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success:       true,
      insertedCount: inserted?.length ?? 0,
      message:       `${inserted?.length ?? 0} leads saved to Supabase`,
    });
  } catch (err: any) {
    console.error("[Leads Import]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
