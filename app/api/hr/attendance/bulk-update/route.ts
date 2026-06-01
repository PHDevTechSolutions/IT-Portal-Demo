import { NextRequest, NextResponse } from "next/server";
import { getTaskLogCollection } from "@/lib/mongo/Collections/PantsIn";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

// POST /api/hr/attendance/bulk-update
// Body: { updates: [{ attendanceId, account_reference_number }] }
export async function POST(req: NextRequest) {
  try {
    const { updates } = await req.json() as {
      updates: { attendanceId: string; account_reference_number: string }[];
    };

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ success: false, error: "No updates provided" }, { status: 400 });
    }

    const collection = await getTaskLogCollection();
    let updated = 0;

    for (const u of updates) {
      try {
        const result = await collection.updateOne(
          { _id: new ObjectId(u.attendanceId) },
          { $set: { account_reference_number: u.account_reference_number } }
        );
        if (result.modifiedCount > 0) updated++;
      } catch { /* skip invalid IDs */ }
    }

    return NextResponse.json({ success: true, updated, total: updates.length });
  } catch (err: any) {
    console.error("[Attendance Bulk Update]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
