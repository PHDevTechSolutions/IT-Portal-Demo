/**
 * /api/documents/files
 *
 * GET    — fetch all Cloudinary resources (images + raw files)
 *          ?type=image|video|raw|all  (default: all)
 *          ?folder=<folder>           (optional filter)
 *          ?search=<query>            (optional search)
 * POST   — upload a file to Cloudinary (multipart/form-data)
 *          form fields: file, folder (optional), tags (optional)
 * DELETE — delete a resource by public_id
 *          body: { public_id: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const dynamic = "force-dynamic";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const type      = searchParams.get("type")      ?? "all";
    const folder    = searchParams.get("folder")    ?? "";
    const search    = searchParams.get("search")    ?? "";
    const dateFrom  = searchParams.get("dateFrom")  ?? "";  // YYYY-MM-DD
    const dateTo    = searchParams.get("dateTo")    ?? "";  // YYYY-MM-DD

    const resourceTypes = type === "all" ? ["image", "video", "raw"] : [type];
    let allResources: any[] = [];

    for (const rt of resourceTypes) {
      try {
        const opts: any = {
          resource_type:  rt,
          max_results:    500,
          type:           "upload",
          direction:      "desc",   // newest first
        };

        if (folder) opts.prefix = folder;

        const result = await cloudinary.api.resources(opts);
        let resources = result.resources as any[];

        // Filter by date range client-side (Cloudinary API doesn't support true date filtering)
        if (dateFrom) {
          const start = new Date(dateFrom);
          start.setHours(0, 0, 0, 0);
          resources = resources.filter(r => new Date(r.created_at) >= start);
        }

        // Filter by dateTo on our side (Cloudinary has no end_at param)
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          resources = resources.filter(r => new Date(r.created_at) <= end);
        }

        allResources = [...allResources, ...resources];
      } catch { /* some resource types may not exist — skip */ }
    }

    // Client-side search filter
    if (search) {
      const q = search.toLowerCase();
      allResources = allResources.filter(r =>
        r.public_id.toLowerCase().includes(q) ||
        r.format?.toLowerCase().includes(q)
      );
    }

    // Sort by created_at desc
    allResources.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ success: true, data: allResources, total: allResources.length });
  } catch (err: any) {
    console.error("[documents/files GET]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST — upload ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const folder   = (formData.get("folder") as string) || "it-portal";
    const tags     = (formData.get("tags")   as string) || "";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64, {
      folder,
      resource_type: "auto",
      tags:          tags ? tags.split(",").map(t => t.trim()) : [],
      use_filename:  true,
      unique_filename: true,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error("[documents/files POST]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { public_id, resource_type = "image" } = await req.json();
    if (!public_id) {
      return NextResponse.json({ success: false, error: "public_id is required." }, { status: 400 });
    }

    await cloudinary.uploader.destroy(public_id, { resource_type });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[documents/files DELETE]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
