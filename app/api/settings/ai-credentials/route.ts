import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

const COL = "ai_credentials";

// ── GET: list all credentials (keys masked) ───────────────────────────────────
export async function GET() {
  try {
    const db   = await connectToDatabase();
    const docs = await db.collection(COL).find({}).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      credentials: docs.map(d => ({
        _id:       d._id.toString(),
        label:     d.label,
        provider:  d.provider,
        keyMasked: maskKey(d.apiKey ?? ""),
        isActive:  d.isActive ?? false,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── POST: create a new credential ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { label, provider, apiKey } = await req.json();
    if (!label?.trim() || !provider?.trim() || !apiKey?.trim()) {
      return NextResponse.json({ success: false, error: "label, provider, and apiKey are required" }, { status: 400 });
    }

    const db  = await connectToDatabase();
    const now = new Date();

    const result = await db.collection(COL).insertOne({
      label:     label.trim(),
      provider:  provider.trim(),
      apiKey:    apiKey.trim(),
      isActive:  false,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, id: result.insertedId.toString() });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── PUT: update label/key OR set as active ────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const { id, label, apiKey, setActive } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    const db  = await connectToDatabase();
    const oid = new ObjectId(id);

    if (setActive) {
      // Deactivate all, then activate this one
      await db.collection(COL).updateMany({}, { $set: { isActive: false } });
      await db.collection(COL).updateOne({ _id: oid }, { $set: { isActive: true, updatedAt: new Date() } });
      return NextResponse.json({ success: true, message: "Active key updated" });
    }

    const patch: Record<string, any> = { updatedAt: new Date() };
    if (label?.trim())  patch.label  = label.trim();
    if (apiKey?.trim()) patch.apiKey = apiKey.trim();

    await db.collection(COL).updateOne({ _id: oid }, { $set: patch });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── DELETE: remove a credential ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    const db = await connectToDatabase();
    await db.collection(COL).deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── Helper: get active key for a provider (used by AI routes) ─────────────────
export async function getActiveKey(provider: string): Promise<string | null> {
  try {
    const db  = await connectToDatabase();
    const doc = await db.collection(COL).findOne({ provider, isActive: true });
    return doc?.apiKey ?? null;
  } catch {
    return null;
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 6) + "••••••••••••" + key.slice(-4);
}
