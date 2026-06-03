/**
 * /api/ai/history
 *
 * GET    — list all chat sessions  ?limit=20&skip=0
 * POST   — create a new session    { title?, messages }
 * PUT    — update session messages { _id, messages, title? }
 * DELETE — delete a session        { _id }
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

const COL = "ai_chat_history";

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const limit = parseInt(searchParams.get("limit") ?? "30");
    const skip  = parseInt(searchParams.get("skip")  ?? "0");

    const db      = await connectToDatabase();
    const sessions = await db.collection(COL)
      .find({})
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .project({ _id: 1, title: 1, messageCount: 1, createdAt: 1, updatedAt: 1, model: 1 })
      .toArray();

    const total = await db.collection(COL).countDocuments();

    return NextResponse.json({ success: true, sessions, total });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST — create new session ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { title, messages, model } = await req.json();

    const db  = await connectToDatabase();
    const res = await db.collection(COL).insertOne({
      title:        title?.trim() || generateTitle(messages),
      messages:     messages ?? [],
      messageCount: (messages ?? []).length,
      model:        model ?? "",
      createdAt:    new Date(),
      updatedAt:    new Date(),
    });

    return NextResponse.json({ success: true, id: res.insertedId });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── PUT — update session ─────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const { _id, messages, title, model } = await req.json();
    if (!_id) return NextResponse.json({ success: false, error: "_id required" }, { status: 400 });

    const db = await connectToDatabase();
    await db.collection(COL).updateOne(
      { _id: new ObjectId(_id) },
      {
        $set: {
          ...(messages !== undefined ? { messages, messageCount: messages.length } : {}),
          ...(title    !== undefined ? { title } : {}),
          ...(model    !== undefined ? { model } : {}),
          updatedAt: new Date(),
        },
      }
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
    if (!_id) return NextResponse.json({ success: false, error: "_id required" }, { status: 400 });

    const db = await connectToDatabase();
    await db.collection(COL).deleteOne({ _id: new ObjectId(_id) });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── GET single session with full messages ────────────────────────────────────
// Called as GET /api/ai/history?id=<_id>
function generateTitle(messages: any[]): string {
  const first = messages?.find(m => m.role === "user")?.content ?? "";
  return first.slice(0, 60) || "New Chat";
}
