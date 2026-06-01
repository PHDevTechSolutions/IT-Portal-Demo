import { NextRequest, NextResponse } from "next/server";
import { getTaskLogCollection } from "@/lib/mongo/Collections/PantsIn";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

// PATCH /api/hr/attendance/update
// Updates account_reference_number (and optionally other fields) on a TaskLog record
export async function PATCH(req: NextRequest) {
  try {
    const { _id, account_reference_number } = await req.json();

    if (!_id) {
      return NextResponse.json({ success: false, error: "Record ID required" }, { status: 400 });
    }

    const collection = await getTaskLogCollection();

    const result = await collection.updateOne(
      { _id: new ObjectId(_id) },
      { $set: { account_reference_number: account_reference_number ?? "" } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Attendance Update]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
