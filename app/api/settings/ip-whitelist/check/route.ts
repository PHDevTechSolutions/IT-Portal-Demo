/**
 * GET /api/settings/ip-whitelist/check
 *
 * Fast check used at login time and by middleware.
 * Returns { allowed: boolean, reason?: string }
 *
 * Query params:
 *   ip       — the client IP to check
 *   deviceId — optional device fingerprint for additional validation
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const ip       = searchParams.get("ip")       ?? "";
    const deviceId = searchParams.get("deviceId") ?? "";

    const db   = await connectToDatabase();
    const meta = await db.collection("ip_whitelist_meta").findOne({ key: "global" });

    // If whitelist is disabled globally — everyone allowed
    if (!meta?.enabled) {
      return NextResponse.json({ allowed: true, reason: "Whitelist disabled" });
    }

    // Find a matching enabled entry
    const query: any[] = [{ ip, enabled: true }];
    if (deviceId) query.push({ deviceId, enabled: true });

    const match = await db.collection("ip_whitelist").findOne({
      $or: query,
    });

    if (match) {
      return NextResponse.json({ allowed: true, reason: "IP/Device whitelisted" });
    }

    return NextResponse.json({
      allowed: false,
      reason:  "Your IP or device is not whitelisted. Contact IT.",
    });
  } catch (err: any) {
    // On DB error — fail open (don't lock everyone out)
    console.error("[ip-whitelist/check]", err.message);
    return NextResponse.json({ allowed: true, reason: "Check failed — fail open" });
  }
}
