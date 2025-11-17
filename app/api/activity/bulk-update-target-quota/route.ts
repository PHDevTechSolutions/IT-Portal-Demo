// app/api/activity/bulk-update-targetquota/route.ts (Next.js 13 app router style)

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set");
}
const Xchire_sql = neon(Xchire_databaseUrl);

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { ids, targetquota } = data;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "No IDs provided for update" },
        { status: 400 }
      );
    }

    if (typeof targetquota !== "string" || targetquota.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Invalid targetquota value" },
        { status: 400 }
      );
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    const targetquotaPlaceholder = `$${ids.length + 1}`;

    const updateQuery = `
      UPDATE activity
      SET targetquota = ${targetquotaPlaceholder}
      WHERE id IN (${placeholders})
      RETURNING id, targetquota;
    `;

    let updateResult;
    try {
      // Params: all ids + targetquota as last param
      updateResult = await Xchire_sql(updateQuery, [...ids, targetquota.trim()]);
    } catch (dbError: any) {
      console.error("DB error:", dbError);
      return NextResponse.json(
        { success: false, error: dbError.message || "Database error" },
        { status: 500 }
      );
    }

    if (updateResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "No records updated" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        updated: updateResult.map((row: any) => ({
          id: row.id,
          targetquota: row.targetquota,
        })),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating targetquota:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update targetquota." },
      { status: 500 }
    );
  }
}
