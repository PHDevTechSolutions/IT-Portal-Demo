/**
 * POST /api/ai/patch
 *
 * Applies a structured line-level patch to a file.
 * Supports both:
 *   1. Full file replacement (type: "full")
 *   2. Line-range replacement (type: "patch", startLine, endLine)
 *   3. Line insertion (type: "insert", afterLine)
 *   4. Line deletion (type: "delete", startLine, endLine)
 *
 * Body:
 * {
 *   path:      string        — relative file path
 *   type:      "full" | "patch" | "insert" | "delete"
 *   content:   string        — new content (for full/patch/insert)
 *   startLine: number        — 1-indexed (for patch/delete)
 *   endLine:   number        — 1-indexed inclusive (for patch/delete)
 *   afterLine: number        — insert after this line (for insert)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

const ROOT = path.resolve(process.cwd());

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Patching disabled in production." }, { status: 403 });
  }

  try {
    const { path: relPath, type, content, startLine, endLine, afterLine } = await req.json();

    if (!relPath) return NextResponse.json({ error: "path required" }, { status: 400 });

    const absPath = path.resolve(ROOT, relPath);
    if (!absPath.startsWith(ROOT)) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    // Read current file
    let original = "";
    try { original = fs.readFileSync(absPath, "utf-8"); } catch {}
    const lines = original.split("\n");

    let newLines: string[];

    if (type === "full") {
      // Replace entire file
      newLines = (content ?? "").split("\n");

    } else if (type === "patch") {
      // Replace lines startLine..endLine (1-indexed)
      const s = Math.max(1, startLine ?? 1) - 1;
      const e = Math.min(lines.length, endLine ?? lines.length);
      const newChunk = (content ?? "").split("\n");
      newLines = [...lines.slice(0, s), ...newChunk, ...lines.slice(e)];

    } else if (type === "insert") {
      // Insert after afterLine (1-indexed), 0 = prepend
      const at = Math.min(lines.length, Math.max(0, afterLine ?? lines.length));
      const newChunk = (content ?? "").split("\n");
      newLines = [...lines.slice(0, at), ...newChunk, ...lines.slice(at)];

    } else if (type === "delete") {
      // Delete lines startLine..endLine (1-indexed)
      const s = Math.max(1, startLine ?? 1) - 1;
      const e = Math.min(lines.length, endLine ?? lines.length);
      newLines = [...lines.slice(0, s), ...lines.slice(e)];

    } else {
      return NextResponse.json({ error: `Unknown patch type: ${type}` }, { status: 400 });
    }

    const newContent = newLines.join("\n");

    // Write
    fs.writeFileSync(absPath, newContent, "utf-8");

    return NextResponse.json({
      success:       true,
      path:          relPath,
      originalLines: lines.length,
      newLines:      newLines.length,
      backup:        original,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
