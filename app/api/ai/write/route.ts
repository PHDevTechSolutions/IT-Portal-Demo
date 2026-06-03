/**
 * POST /api/ai/write
 *
 * Writes AI-revised content back to a project file.
 * Only works in development (localhost) for safety.
 *
 * Body: { path: string; content: string }
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

const ROOT = path.resolve(process.cwd());

// Only allow writing in development
const ALLOWED_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".json", ".css",
  ".scss", ".md", ".mdx", ".env.local", ".yaml", ".yml",
]);

export async function POST(req: NextRequest) {
  // Block on production/Vercel
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "File writing disabled in production." }, { status: 403 });
  }

  try {
    const { path: relPath, content } = await req.json();

    if (!relPath || typeof content !== "string") {
      return NextResponse.json({ error: "path and content are required." }, { status: 400 });
    }

    const absPath = path.resolve(ROOT, relPath);

    // Security: must stay within project root
    if (!absPath.startsWith(ROOT)) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const ext = path.extname(absPath).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: `Writing .${ext} files is not allowed.` }, { status: 400 });
    }

    // Backup original content
    let backup = "";
    try { backup = fs.readFileSync(absPath, "utf-8"); } catch {}

    fs.writeFileSync(absPath, content, "utf-8");

    return NextResponse.json({
      success: true,
      path:    relPath,
      backup,  // return original so client can undo
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
