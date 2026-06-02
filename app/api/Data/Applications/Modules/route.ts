/**
 * /api/Data/Applications/Modules
 *
 * GET    — fetch all modules (sorted by order asc, then title)
 * POST   — create a new module
 * PUT    — update an existing module  { _id, ...fields }
 * DELETE — delete a module            { _id }
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

const COL = "app_modules";

// ─── Seed defaults (inserted once if collection is empty) ─────────────────────
const SEED = [
  { title: "Taskflow",                    category: "Internal",   description: "Manage and track activity time and motion efficiently.",           url: "https://taskflow-crm.vercel.app/auth/login",           order: 1  },
  { title: "Taskflow (Demo)",             category: "Internal",   description: "Demo environment for Taskflow ERP system.",                        url: "https://ecoshift-erp-system.vercel.app/Login",          order: 2  },
  { title: "Taskflow V2 (Internal Demo)", category: "Internal",   description: "Internal demo server for Taskflow V2.",                            url: "https://taskflow-demo-v2.vercel.app/auth/login",         order: 3  },
  { title: "Ecodesk",                     category: "Internal",   description: "Customer support ticketing system for seamless issue tracking.",   url: "https://ecodesk-erp.vercel.app/login",                   order: 4  },
  { title: "Ecodesk (OLD)",               category: "Internal",   description: "Legacy version of Ecodesk ticketing system.",                      url: "https://ecodesk-erp.vercel.app/login",                   order: 5  },
  { title: "Acculog (Sales Only)",        category: "Internal",   description: "Attendance tracking system for sales employees.",                  url: "https://acculog-hris.vercel.app/Login",                  order: 6  },
  { title: "Acculog (Regular User)",      category: "Internal",   description: "Attendance tracking for all regular employees.",                   url: "https://acculog.vercel.app/",                            order: 7  },
  { title: "Room Reservation",            category: "Internal",   description: "Reserve rooms and manage shift schedules easily.",                 url: "https://shift-reservation.vercel.app/Book",              order: 8  },
  { title: "Stash IT Asset",              category: "Internal",   description: "IT asset management system to track company equipment.",           url: "https://stash-demo.vercel.app/auth/login",               order: 9  },
  { title: "Know My Employee",            category: "Internal",   description: "Employee analytics and HR insights platform.",                     url: "https://kme-orcin.vercel.app/Home",                      order: 10 },
  { title: "Linker X",                    category: "Internal",   description: "Platform to store and share links securely.",                      url: "https://linker-x-delta.vercel.app/",                     order: 11 },
  { title: "IT Ticketing",                category: "Internal",   description: "IT support ticketing system for infrastructure issues.",           url: "https://ticketing-demo-dusky.vercel.app/auth/login",     order: 12 },
  { title: "Ecoshift Corporation",        category: "Company",    description: "Official website of Ecoshift Corporation.",                        url: "https://www.ecoshiftcorp.com/",                          order: 13 },
  { title: "Disruptive Solutions Inc",    category: "Company",    description: "Disruptive Solutions Inc official site.",                          url: "https://disruptivesolutionsinc.com/",                     order: 14 },
  { title: "VAH / Buildchem",             category: "Company",    description: "Buildchem official site.",                                         url: "https://buildchem-nu.vercel.app/",                       order: 15 },
  { title: "Ecoshift Shopify Admin",      category: "E-Commerce", description: "Shopify admin panel for Ecoshift store management.",               url: "https://admin.shopify.com/login",                        order: 16 },
  { title: "Ecoshift Shopify Website",    category: "E-Commerce", description: "Ecoshift customer-facing Shopify storefront.",                     url: "https://eshome.ph/",                                     order: 17 },
  { title: "Elementor Pro",               category: "E-Commerce", description: "Elementor Pro website builder and management.",                    url: "https://my.elementor.com/login/",                        order: 18 },
  { title: "Nitropack",                   category: "E-Commerce", description: "Website speed optimization dashboard.",                            url: "https://app.nitropack.io/dashboard",                     order: 19 },
  { title: "Vercel",                      category: "DevOps",     description: "Deployment and hosting platform for all projects.",                url: "https://vercel.com/login",                               order: 20 },
  { title: "Neon PostgreSQL",             category: "Database",   description: "Neon cloud Postgres database console and management.",             url: "https://console.neon.tech/",                             order: 21 },
  { title: "MongoDB",                     category: "Database",   description: "MongoDB Atlas cloud database management.",                         url: "https://account.mongodb.com/account/login",              order: 22 },
  { title: "Supabase",                    category: "Database",   description: "Supabase backend database and authentication dashboard.",          url: "https://supabase.com/dashboard/sign-in",                 order: 23 },
  { title: "Redis",                       category: "Database",   description: "Redis Cloud subscription and metrics dashboard.",                  url: "https://cloud.redis.io/",                                order: 24 },
  { title: "Firebase",                    category: "Database",   description: "Firebase console for Firestore and project management.",           url: "https://console.firebase.google.com/",                   order: 25 },
];

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const db  = await connectToDatabase();
    const col = db.collection(COL);

    // Seed on first run
    const count = await col.countDocuments();
    if (count === 0) {
      await col.insertMany(SEED.map(s => ({ ...s, createdAt: new Date(), updatedAt: new Date() })));
    }

    const docs = await col.find({}).sort({ order: 1, title: 1 }).toArray();
    return NextResponse.json({ success: true, data: docs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { title, description, url, category, order } = await req.json();
    if (!title?.trim() || !url?.trim()) {
      return NextResponse.json({ success: false, error: "title and url are required." }, { status: 400 });
    }

    const db  = await connectToDatabase();
    const res = await db.collection(COL).insertOne({
      title:       title.trim(),
      description: description?.trim() ?? "",
      url:         url.trim(),
      category:    category?.trim() || "Internal",
      order:       typeof order === "number" ? order : 99,
      createdAt:   new Date(),
      updatedAt:   new Date(),
    });

    return NextResponse.json({ success: true, id: res.insertedId });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const { _id, title, description, url, category, order } = await req.json();
    if (!_id) return NextResponse.json({ success: false, error: "_id is required." }, { status: 400 });
    if (!title?.trim() || !url?.trim()) {
      return NextResponse.json({ success: false, error: "title and url are required." }, { status: 400 });
    }

    const db = await connectToDatabase();
    await db.collection(COL).updateOne(
      { _id: new ObjectId(_id) },
      { $set: {
        title:       title.trim(),
        description: description?.trim() ?? "",
        url:         url.trim(),
        category:    category?.trim() || "Internal",
        order:       typeof order === "number" ? order : 99,
        updatedAt:   new Date(),
      }},
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
