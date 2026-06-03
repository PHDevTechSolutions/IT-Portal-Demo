/**
 * GET /api/ai/context
 *
 * Returns a compact project structure summary for AI context.
 * Recursively walks the project directory (skipping node_modules etc.)
 * and returns a tree string + list of key files.
 *
 * Query:
 *   ?path=<relative>  — scan from this path (default: project root)
 *   ?depth=<n>        — max depth (default: 4)
 *   ?includeContent=1 — also include file contents for small files
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

const ROOT = path.resolve(process.cwd());

const SKIP = new Set([
  "node_modules", ".next", ".git", ".vercel", "dist",
  "build", ".turbo", "coverage", ".cache", "out",
]);

const SKIP_EXT = new Set([
  ".ico", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mp3",
  ".zip", ".tar", ".gz", ".lock",
]);

function buildTree(dirPath: string, depth: number, maxDepth: number, prefix = ""): string {
  if (depth > maxDepth) return "";

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch { return ""; }

  const visible = entries
    .filter(e => !e.name.startsWith(".") && !SKIP.has(e.name))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return visible.map((e, i) => {
    const isLast    = i === visible.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const child     = isLast ? "    " : "│   ";
    const line      = prefix + connector + e.name + (e.isDirectory() ? "/" : "");

    if (e.isDirectory()) {
      const sub = buildTree(
        path.join(dirPath, e.name), depth + 1, maxDepth, prefix + child,
      );
      return sub ? line + "\n" + sub : line;
    }
    return line;
  }).join("\n");
}

function collectFiles(
  dirPath:    string,
  depth:      number,
  maxDepth:   number,
  relBase:    string,
  result:     { path: string; size: number; content?: string }[],
  includeContent: boolean,
) {
  if (depth > maxDepth) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch { return; }

  for (const e of entries) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const abs = path.join(dirPath, e.name);
    const rel = path.join(relBase, e.name);

    if (e.isDirectory()) {
      collectFiles(abs, depth + 1, maxDepth, rel, result, includeContent);
    } else {
      const ext = path.extname(e.name).toLowerCase();
      if (SKIP_EXT.has(ext)) continue;
      const stat = fs.statSync(abs);
      const entry: { path: string; size: number; content?: string } = {
        path: rel.replace(/\\/g, "/"),
        size: stat.size,
      };
      // Include content for small important files
      if (includeContent && stat.size < 50 * 1024) {
        try { entry.content = fs.readFileSync(abs, "utf-8"); } catch {}
      }
      result.push(entry);
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const relPath        = searchParams.get("path")           ?? "";
    const maxDepth       = parseInt(searchParams.get("depth") ?? "4");
    const includeContent = searchParams.get("includeContent") === "1";

    const scanPath = relPath ? path.resolve(ROOT, relPath) : ROOT;

    // Security check
    if (!scanPath.startsWith(ROOT)) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // Build tree string
    const baseName  = relPath ? path.basename(scanPath) + "/" : "project/";
    const treeStr   = baseName + "\n" + buildTree(scanPath, 0, maxDepth);

    // Collect file list
    const files: { path: string; size: number; content?: string }[] = [];
    collectFiles(scanPath, 0, maxDepth, relPath || "", files, includeContent);

    // Stats
    const totalFiles = files.length;
    const totalSize  = files.reduce((s, f) => s + f.size, 0);

    return NextResponse.json({
      success: true,
      tree:    treeStr,
      files:   files.map(f => ({ path: f.path, size: f.size, ...(f.content ? { content: f.content } : {}) })),
      stats:   { totalFiles, totalSize },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
