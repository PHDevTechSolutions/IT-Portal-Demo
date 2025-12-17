import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("activity") // Adjust table name accordingly
      .select("id, date_created")
      .order("date_created", { ascending: true });

    if (error) {
      console.error("Supabase activity fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error("Unexpected error fetching activity:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
