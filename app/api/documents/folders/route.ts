/**
 * /api/documents/folders
 *
 * GET  — fetch folder tree from Cloudinary
 *         ?parent=<path>   (root folders if omitted)
 * POST — create a folder   { path: string }
 * DELETE — delete a folder  { path: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const dynamic = "force-dynamic";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// ─── GET — list folders ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const parent = searchParams.get("parent") ?? "";

    let result: any;
    if (!parent || parent === "/") {
      result = await cloudinary.api.root_folders();
    } else {
      result = await cloudinary.api.sub_folders(parent);
    }

    const folders = (result.folders ?? []).map((f: any) => ({
      name: f.name,
      path: f.path,
    }));

    return NextResponse.json({ success: true, folders });
  } catch (err: any) {
    console.error("[documents/folders GET]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST — create folder ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json();
    if (!path?.trim()) {
      return NextResponse.json({ success: false, error: "path is required." }, { status: 400 });
    }
    await cloudinary.api.create_folder(path.trim());
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE — delete folder ───────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { path } = await req.json();
    if (!path?.trim()) {
      return NextResponse.json({ success: false, error: "path is required." }, { status: 400 });
    }
    await cloudinary.api.delete_folder(path.trim());
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
