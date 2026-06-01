import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("stock_firebase_credentials")
      .select("*").eq("is_active", true)
      .order("updated_at", { ascending: false }).limit(1).single();
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    return NextResponse.json({ success: true, credentials: data ?? null });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { api_key, auth_domain, project_id } = body;
    if (!api_key?.trim() || !auth_domain?.trim() || !project_id?.trim()) {
      return NextResponse.json({ success: false, error: "API Key, Auth Domain, and Project ID are required" }, { status: 400 });
    }
    await supabase.from("stock_firebase_credentials").update({ is_active: false }).eq("is_active", true);
    const { data, error } = await supabase.from("stock_firebase_credentials").insert({
      api_key:             api_key.trim(),
      auth_domain:         auth_domain.trim(),
      project_id:          project_id.trim(),
      storage_bucket:      body.storage_bucket?.trim()      ?? "",
      messaging_sender_id: body.messaging_sender_id?.trim() ?? "",
      app_id:              body.app_id?.trim()              ?? "",
      collection_name:     body.collection_name?.trim()     || "suppliers",
      label:               body.label?.trim()               || "Default",
      is_active:           true,
    }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, credentials: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
