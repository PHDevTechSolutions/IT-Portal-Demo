/**
 * /api/settings/ip-whitelist
 *
 * GET    — fetch all whitelist entries + global enabled flag
 * POST   — add an entry         { ip, label, deviceId? }
 * PUT    — update an entry      { _id, ip?, label?, deviceId?, enabled? }
 *          also handles { action: "toggle-global", enabled: boolean }
 * DELETE — remove an entry      { _id }
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

const COL      = "ip_whitelist";
const META_COL = "ip_whitelist_meta";

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const db      = await connectToDatabase();
    const entries = await db.collection(COL).find({}).sort({ createdAt: -1 }).toArray();
    const meta    = await db.collection(META_COL).findOne({ key: "global" });
    return NextResponse.json({
      success: true,
      entries,
      enabled: meta?.enabled ?? false,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { ip, label, deviceId } = await req.json();
    if (!ip?.trim()) {
      return NextResponse.json({ success: false, error: "IP address is required." }, { status: 400 });
    }

    const db  = await connectToDatabase();

    // Prevent duplicates
    const existing = await db.collection(COL).findOne({ ip: ip.trim() });
    if (existing) {
      return NextResponse.json({ success: false, error: "This IP is already whitelisted." }, { status: 409 });
    }

    const res = await db.collection(COL).insertOne({
      ip:        ip.trim(),
      label:     label?.trim() || "",
      deviceId:  deviceId?.trim() || "",
      enabled:   true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, id: res.insertedId });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const db   = await connectToDatabase();

    // Toggle global whitelist on/off
    if (body.action === "toggle-global") {
      await db.collection(META_COL).updateOne(
        { key: "global" },
        { $set: { key: "global", enabled: !!body.enabled, updatedAt: new Date() } },
        { upsert: true },
      );
      return NextResponse.json({ success: true });
    }

    const { _id, ...fields } = body;
    if (!_id) return NextResponse.json({ success: false, error: "_id is required." }, { status: 400 });

    await db.collection(COL).updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...fields, updatedAt: new Date() } },
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { _id } = await req.json();
    if (!_id) return NextResponse.json({ success: false, error: "_id is required." }, { status: 400 });

    const db = await connectToDatabase();
    await db.collection(COL).deleteOne({ _id: new ObjectId(_id) });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
