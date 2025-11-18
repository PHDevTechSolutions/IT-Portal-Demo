import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const TASKFLOW_DB_URL = process.env.TASKFLOW_DB_URL;
if (!TASKFLOW_DB_URL) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}

const sql = neon(TASKFLOW_DB_URL);

type TransferType = "TSA" | "TSM" | "Manager";

async function bulkTransfer(userIds: string[], type: TransferType, targetId: string) {
  if (!userIds.length || !type || !targetId) {
    throw new Error("User IDs, type, and target ID are required.");
  }

  const intIds = userIds.map((id) => {
    const parsed = parseInt(id, 10);
    if (isNaN(parsed)) throw new Error(`Invalid user ID: ${id}`);
    return parsed;
  });

  let query;
  switch (type) {
    case "TSA":
      query = sql`
        UPDATE accounts
        SET referenceid = ${targetId}
        WHERE id = ANY(${intIds}::int[])
        RETURNING *;
      `;
      break;
    case "TSM":
      query = sql`
        UPDATE accounts
        SET tsm = ${targetId}
        WHERE id = ANY(${intIds}::int[])
        RETURNING *;
      `;
      break;
    case "Manager":
      query = sql`
        UPDATE accounts
        SET manager = ${targetId}
        WHERE id = ANY(${intIds}::int[])
        RETURNING *;
      `;
      break;
    default:
      throw new Error(`Unsupported transfer type: ${type}`);
  }

  const result = await query;
  return result;
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { userIds, type, targetId } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing userIds" },
        { status: 400 }
      );
    }

    const validTypes: TransferType[] = ["TSA", "TSM", "Manager"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing transfer type" },
        { status: 400 }
      );
    }

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: "Missing targetId" },
        { status: 400 }
      );
    }

    const updatedRows = await bulkTransfer(userIds, type, targetId);
    return NextResponse.json({ success: true, data: updatedRows });
  } catch (error: any) {
    console.error("Error in PUT /api/Data/Applications/CustomerDatabase/BulkTransfer:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
