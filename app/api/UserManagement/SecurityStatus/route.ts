/**
 * GET /api/UserManagement/SecurityStatus
 *
 * Returns biometric + 2FA status for a batch of users.
 * Query: ?userIds=id1,id2,id3
 *
 * Response: { [userId]: { biometricEnabled: boolean, totpEnabled: boolean } }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const raw = searchParams.get("userIds") ?? "";
    const userIds = raw.split(",").map(s => s.trim()).filter(Boolean);

    if (!userIds.length) {
      return NextResponse.json({});
    }

    // 1. Fetch totpEnabled from users table
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('ReferenceID, twoFactorEnabled')
      .in('ReferenceID', userIds);

    if (userError) throw userError;

    const totpMap: Record<string, boolean> = {};
    for (const u of users || []) {
      const refId = u.ReferenceID;
      totpMap[refId] = !!u.twoFactorEnabled;
    }

    // 2. Fetch biometric credentials count per userId (ReferenceID)
    let bioMap: Record<string, boolean> = {};
    try {
      const { data: bioCounts, error: bioError } = await supabase
        .from('biometric_credentials')
        .select('ReferenceID')
        .in('ReferenceID', userIds);

      if (bioError) throw bioError;

      // Group by ReferenceID manually since supabase client doesn't support GROUP BY easily in simple select
      const counts: Record<string, number> = {};
      for (const b of bioCounts || []) {
        counts[b.ReferenceID] = (counts[b.ReferenceID] || 0) + 1;
      }
      
      for (const [refId, count] of Object.entries(counts)) {
        bioMap[refId] = count > 0;
      }
    } catch (e: any) {
      console.error("[SecurityStatus] Biometric check failed:", e.message);
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
