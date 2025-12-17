import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const Xchire_sql = neon(Xchire_databaseUrl);

async function bulkCancelTransfer(userIds: string[], status: string) {
  try {
    if (!userIds || userIds.length === 0 || !status) {
      throw new Error("User IDs and status are required.");
    }

    // Cancel transfer means update status, and optionally clear transfer_to reference (if you want)
    // Adjust query to reset transfer_to if needed or keep it

    const Xchire_update = await Xchire_sql`
      UPDATE accounts
      SET
        status = ${status},
        date_updated = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
      WHERE id = ANY(${userIds})
      RETURNING *;
    `;

    return { success: true, data: Xchire_update };
  } catch (Xchire_error: any) {
    console.error("Error cancelling transfers:", Xchire_error);
    return { success: false, error: Xchire_error.message || "Failed to cancel transfers." };
  }
}

export async function PUT(req: Request) {
  try {
    const Xchire_body = await req.json();
    const { userIds, status } = Xchire_body;

    const Xchire_result = await bulkCancelTransfer(userIds, status);

    return NextResponse.json(Xchire_result);
  } catch (Xchire_error: any) {
    console.error("Error in PUT /api/Data/Applications/Taskflow/CustomerDatabase/BulkCancelTransfer:", Xchire_error);
    return NextResponse.json(
      { success: false, error: Xchire_error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
