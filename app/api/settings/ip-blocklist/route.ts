/**
 * /api/settings/ip-blocklist
 *
 * GET    — fetch all blocked access attempts (paginated)
 *          ?page=1&pageSize=50&search=<ip>
 * POST   — log a new blocked attempt (called internally by middleware check)
 *          { ip, path, userAgent, deviceId? }
 * DELETE — clear all logs  { action: "clear-all" }
 *          or remove one   { _id }
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

const COL = "ip_blocklist_log";

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") ?? "50"));
    const search   = searchParams.get("search")?.trim() ?? "";

    const db    = await connectToDatabase();
    const query = search
      ? { $or: [
          { ip:        { $regex: search, $options: "i" } },
          { path:      { $regex: search, $options: "i" } },
          { userAgent: { $regex: search, $options: "i" } },
        ]}
      : {};

    const [logs, total] = await Promise.all([
      db.collection(COL)
        .find(query)
        .sort({ blockedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      db.collection(COL).countDocuments(query),
    ]);

    // Aggregate unique IPs with attempt counts
    const topIps = await db.collection(COL).aggregate([
      { $group: { _id: "$ip", count: { $sum: 1 }, lastSeen: { $max: "$blockedAt" } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).toArray();

    return NextResponse.json({ success: true, logs, total, page, pageSize, topIps });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST — log a blocked attempt ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { ip, path, userAgent, deviceId } = await req.json();
    if (!ip) return NextResponse.json({ success: false, error: "ip required" }, { status: 400 });

    const db = await connectToDatabase();
    await db.collection(COL).insertOne({
      ip:        ip.trim(),
      path:      path ?? "/",
      userAgent: userAgent ?? "",
      deviceId:  deviceId ?? "",
      blockedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { _id, action } = await req.json();
    const db = await connectToDatabase();

    if (action === "clear-all") {
      await db.collection(COL).deleteMany({});
      return NextResponse.json({ success: true, message: "All logs cleared." });
    }

    if (!_id) return NextResponse.json({ success: false, error: "_id required" }, { status: 400 });
    await db.collection(COL).deleteOne({ _id: new ObjectId(_id) });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
