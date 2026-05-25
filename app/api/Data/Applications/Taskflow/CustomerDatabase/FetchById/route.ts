import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const Xchire_sql = neon(Xchire_databaseUrl);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing id parameter." },
        { status: 400 }
      );
    }

    const rows = await Xchire_sql`
      SELECT * FROM accounts WHERE id = ${Number(id)} LIMIT 1;
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Customer not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: rows[0] }, { status: 200 });
  } catch (err: any) {
    console.error("[FetchById] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch customer." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
