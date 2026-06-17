/**
 * /api/workflows/diagrams/[id]
 *
 * GET    — fetch a single diagram (with full nodes + edges)
 * PUT    — update name and/or nodes+edges
 * DELETE — delete a diagram
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

const COLLECTION = "workflow_diagrams";

function toObjectId(id: string) {
  try { return new ObjectId(id); }
  catch { return null; }
}

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const oid = toObjectId(params.id);
  if (!oid) return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });

  try {
    const db  = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne({ _id: oid });
    if (!doc) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({
      success: true,
      diagram: {
        id:        doc._id.toString(),
        name:      doc.name,
        nodes:     doc.nodes  ?? [],
        edges:     doc.edges  ?? [],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── PUT ────────────────────────────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const oid = toObjectId(params.id);
  if (!oid) return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });

  try {
    const body  = await req.json();
    const patch: Record<string, any> = { updatedAt: new Date() };

    if (body.name  !== undefined) patch.name      = body.name.trim();
    if (body.nodes !== undefined) { patch.nodes = body.nodes; patch.nodeCount = body.nodes.length; }
    if (body.edges !== undefined) { patch.edges = body.edges; patch.edgeCount = body.edges.length; }

    const db = await connectToDatabase();
    const result = await db.collection(COLLECTION).updateOne({ _id: oid }, { $set: patch });

    if (result.matchedCount === 0)
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const oid = toObjectId(params.id);
  if (!oid) return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });

  try {
    const db     = await connectToDatabase();
    const result = await db.collection(COLLECTION).deleteOne({ _id: oid });

    if (result.deletedCount === 0)
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
