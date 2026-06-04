/**
 * GET /api/taskflow/user-lookup?ids=REF001,REF002,REF003
 *
 * Batch-lookup users by ReferenceID and return their Firstname + Lastname.
 * Used by progress-logs kanban to show user names instead of raw IDs.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") ?? "";
  const ids  = raw.split(",").map(s => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ users: {} });
  }

  try {
    const db    = await connectToDatabase();
    const users = await db
      .collection("users")
      .find({ ReferenceID: { $in: ids } })
      .project({ ReferenceID: 1, Firstname: 1, Lastname: 1, _id: 0 })
      .toArray();

    // Build a { [ReferenceID]: "Firstname Lastname" } map
    const map: Record<string, string> = {};
    for (const u of users) {
      if (u.ReferenceID) {
        map[u.ReferenceID] = `${u.Firstname ?? ""} ${u.Lastname ?? ""}`.trim();
      }
    }

    return NextResponse.json({ users: map });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
