/**
 * GET /api/UserManagement/SecurityStatus
 *
 * Returns biometric + 2FA status for a batch of users.
 * Query: ?userIds=id1,id2,id3
 *
 * Response: { [userId]: { biometricEnabled: boolean, totpEnabled: boolean } }
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const raw = searchParams.get("userIds") ?? "";
    const userIds = raw.split(",").map(s => s.trim()).filter(Boolean);

    if (!userIds.length) {
      return NextResponse.json({});
    }

    const db = await connectToDatabase();

    // 1. Fetch totpEnabled from users collection
    const objectIds = userIds.flatMap(id => {
      try { return [new ObjectId(id)]; } catch { return []; }
    });

    const users = await db
      .collection("users")
      .find({ _id: { $in: objectIds } })
      .project({ _id: 1, totpEnabled: 1 })
      .toArray();

    const totpMap: Record<string, boolean> = {};
    for (const u of users) {
      totpMap[u._id.toString()] = !!u.totpEnabled;
    }

    // 2. Fetch biometric credentials count per userId
    const bioCursor = await db
      .collection("biometric_credentials")
      .aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: "$userId", count: { $sum: 1 } } },
      ])
      .toArray();

    const bioMap: Record<string, boolean> = {};
    for (const b of bioCursor) {
      bioMap[b._id as string] = b.count > 0;
    }

    // 3. Merge results
    const result: Record<string, { biometricEnabled: boolean; totpEnabled: boolean }> = {};
    for (const id of userIds) {
      result[id] = {
        biometricEnabled: bioMap[id] ?? false,
        totpEnabled:      totpMap[id] ?? false,
      };
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[SecurityStatus]", err.message);
    return NextResponse.json({}, { status: 500 });
  }
}
