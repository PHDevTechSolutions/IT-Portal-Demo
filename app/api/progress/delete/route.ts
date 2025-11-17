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
    const { ids } = data;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "No IDs provided for deletion" },
        { status: 400 }
      );
    }

    // Prepare the parameter placeholders like $1, $2, ...
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");

    const deleteQuery = `
      DELETE FROM progress
      WHERE id IN (${placeholders})
      RETURNING id;
    `;

    let deleteResult;
    try {
      deleteResult = await Xchire_sql(deleteQuery, ids);
    } catch (dbError: any) {
      console.error("DB error:", dbError);
      return NextResponse.json(
        { success: false, error: dbError.message || "Database error" },
        { status: 500 }
      );
    }

    if (deleteResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "No records deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, deletedIds: deleteResult.map((row: any) => row.id) },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting activities:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete activities." },
      { status: 500 }
    );
  }
}
