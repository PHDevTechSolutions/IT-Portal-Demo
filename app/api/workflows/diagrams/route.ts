/**
 * /api/workflows/diagrams
 *
 * GET  — list all diagrams (id, name, updatedAt, nodeCount, edgeCount)
 * POST — create a new diagram { name, nodes, edges }
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

const COLLECTION = "workflow_diagrams";

// ── GET — list all diagrams ────────────────────────────────────────────────────
export async function GET() {
  try {
    const db   = await connectToDatabase();
    const docs  = await db
      .collection(COLLECTION)
      .find({}, { projection: { nodes: 0, edges: 0 } })  // exclude heavy data for list
      .sort({ updatedAt: -1 })
      .toArray();

    const diagrams = docs.map((d: any) => ({
      id:        d._id.toString(),
      name:      d.name ?? "Untitled",
      nodeCount: d.nodeCount ?? 0,
      edgeCount: d.edgeCount ?? 0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    return NextResponse.json({ success: true, diagrams });
  } catch (err: any) {
    console.error("[workflows/diagrams GET]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── POST — create new diagram ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { name, nodes, edges } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
    }

    const now = new Date();
    const db  = await connectToDatabase();
    const result = await db.collection(COLLECTION).insertOne({
      name:      name.trim(),
      nodes:     nodes  ?? [],
      edges:     edges  ?? [],
      nodeCount: (nodes  ?? []).length,
      edgeCount: (edges  ?? []).length,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      id: result.insertedId.toString(),
    });
  } catch (err: any) {
    console.error("[workflows/diagrams POST]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
