import { supabase } from "@/utils/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const referenceid = url.searchParams.get("referenceid");

  if (!referenceid) {
    return new Response(JSON.stringify({ message: "Missing or invalid referenceid" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { data, error } = await supabase
      .from("endorsed-ticket")
      .select("*")
      .eq("referenceid", referenceid)
      .eq("status", "Endorsed");

    if (error) {
      console.error("Supabase fetch error:", error);
      return new Response(JSON.stringify({ message: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        activities: data ?? [],
        cached: false,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Server error:", err);
    return new Response(JSON.stringify({ message: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
