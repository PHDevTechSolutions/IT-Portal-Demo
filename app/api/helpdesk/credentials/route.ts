/**
 * /api/helpdesk/credentials
 *
 * GET    ?search= &page= &limit=   — list users (no Password)
 * PATCH  { _id, fields... }        — update user fields
 *        { _id, resetPassword: "newpass" } — hash & set new password
 * DELETE { _id }                   — delete user
 */

import { NextRequest, NextResponse } from "next/server";
import { MongoClient, ObjectId }     from "mongodb";
import bcrypt                        from "bcrypt";

export const dynamic = "force-dynamic";

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB  = process.env.MONGODB_DB_Assets ?? "Asset";

let _client: MongoClient | null = null;
async function getClient(): Promise<MongoClient> {
  if (!_client) { _client = new MongoClient(MONGODB_URI); await _client.connect(); }
  return _client;
}
async function getCol() {
  const db = (await getClient()).db(MONGODB_DB);
  return db.collection("users");
}

/* ── GET ─────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search")?.trim()  ?? "";
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit  = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const skip   = (page - 1) * limit;

  try {
    const col = await getCol();
    const filter: Record<string, any> = search ? {
      $or: [
        { Firstname:     { $regex: search, $options: "i" } },
        { Lastname:      { $regex: search, $options: "i" } },
        { Email:         { $regex: search, $options: "i" } },
        { ReferenceID:   { $regex: search, $options: "i" } },
        { Department:    { $regex: search, $options: "i" } },
        { Role:          { $regex: search, $options: "i" } },
        { ContactNumber: { $regex: search, $options: "i" } },
      ],
    } : {};

    const [users, total] = await Promise.all([
      col.find(filter).project({ Password: 0 })
        .sort({ Lastname: 1, Firstname: 1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: users.map(u => ({ ...u, _id: u._id.toString() })),
      total, page, limit,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/* ── PATCH: edit or reset password ──────────────────────────────────────── */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { _id, resetPassword, ...fields } = body;

  if (!_id) return NextResponse.json({ success: false, error: "_id is required." }, { status: 400 });

  try {
    const col    = await getCol();
    const oid    = new ObjectId(_id as string);
    const update: Record<string, any> = { updatedAt: new Date() };

    if (resetPassword) {
      // Hash the new password with bcrypt (10 salt rounds)
      update.Password      = await bcrypt.hash(String(resetPassword), 10);
      update.LoginAttempts = 0;
      update.LockUntil     = null;
    }

    // Apply any other editable fields (whitelist to avoid injections)
    const EDITABLE = ["Firstname", "Lastname", "Email", "Role", "Department",
                      "ContactNumber", "Status", "ReferenceID"];
    for (const key of EDITABLE) {
      if (key in fields && fields[key] !== undefined) {
        update[key] = String(fields[key]).trim();
      }
    }

    const result = await col.updateOne({ _id: oid }, { $set: update });
    if (result.matchedCount === 0)
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });

    return NextResponse.json({ success: true, modified: result.modifiedCount });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/* ── DELETE ──────────────────────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { _id } = body;

  if (!_id) return NextResponse.json({ success: false, error: "_id is required." }, { status: 400 });

  try {
    const col    = await getCol();
    const result = await col.deleteOne({ _id: new ObjectId(_id as string) });
    if (result.deletedCount === 0)
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
