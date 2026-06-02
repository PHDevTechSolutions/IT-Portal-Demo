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
    const ip        = searchParams.get("ip")        ?? "";
    const deviceId  = searchParams.get("deviceId")  ?? "";
    const sessionId = searchParams.get("sessionId") ?? "";

    const db   = await connectToDatabase();
    const meta = await db.collection("ip_whitelist_meta").findOne({ key: "global" });

    // If whitelist is disabled globally — everyone allowed
    if (!meta?.enabled) {
      return NextResponse.json({ allowed: true, reason: "Whitelist disabled" });
    }

    // Localhost always allowed in development — never lock yourself out of dev
    if (
      process.env.NODE_ENV === "development" ||
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip === "localhost"
    ) {
      return NextResponse.json({ allowed: true, reason: "Localhost bypass" });
    }

    // SuperAdmin bypass — check if this session belongs to a SuperAdmin
    // We look up the session cookie value (userId) and check their Role
    if (sessionId) {
      try {
        const { ObjectId } = await import("mongodb");
        const user = await db.collection("users").findOne(
          { _id: new ObjectId(sessionId) },
          { projection: { Role: 1 } },
        );
        if (user?.Role === "SuperAdmin") {
          return NextResponse.json({ allowed: true, reason: "SuperAdmin bypass" });
        }
      } catch { /* ignore — fall through to normal check */ }
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
