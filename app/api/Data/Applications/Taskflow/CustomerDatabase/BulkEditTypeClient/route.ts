import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const Xchire_sql = neon(Xchire_databaseUrl);

async function bulkUpdateTypeClient(userIds: number[], type_client: string) {
  try {
    if (!userIds || userIds.length === 0 || !type_client) {
      throw new Error("User IDs and type_client are required.");
    }

    const Xchire_update = await Xchire_sql`
      UPDATE accounts
      SET
        type_client = ${type_client},
        date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
      WHERE id = ANY(${userIds})
      RETURNING *;
    `;

    return { success: true, data: Xchire_update };
  } catch (error: any) {
    console.error("Error updating type_client:", error);
    return { success: false, error: error.message || "Failed to update type_client." };
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { userIds, type_client } = body;

    const result = await bulkUpdateTypeClient(userIds, type_client);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in PUT /BulkEditTypeClient:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
