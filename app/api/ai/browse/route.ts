/**
 * /api/ai/browse
 *
 * Allows browsing and reading files from ANY directory on the host machine.
 * Unlike /api/ai/files which is locked to project root, this endpoint
 * accepts absolute paths so the user can open external folders.
 *
 * GET ?path=<absolute>   — list directory entries or read file content
 * GET ?path=<absolute>&drives=1  — list available drive roots (Windows)
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";

export const dynamic = "force-dynamic";

// Dirs to skip for cleaner browsing
const SKIP = new Set([
  "node_modules", ".next", ".git", ".vercel", ".turbo",
  "dist", "build", "coverage",
  "$Recycle.Bin", "System Volume Information",
  "DumpStack.log.tmp", "hiberfil.sys", "pagefile.sys", "swapfile.sys",
]);

// Dotfiles that ARE useful to show
const ALLOWED_DOTFILES = new Set([
  ".env", ".env.local", ".env.development", ".env.development.local",
  ".env.production", ".env.production.local", ".env.test", ".env.test.local",
  ".env.example", ".env.sample", ".env.template",
  ".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json", ".eslintrc.yml",
  ".prettierrc", ".prettierrc.js", ".prettierrc.json", ".prettierrc.yml",
  ".babelrc", ".babelrc.js", ".babelrc.json",
  ".editorconfig", ".nvmrc", ".node-version",
  ".gitignore", ".gitattributes",
  ".dockerignore",
]);

function shouldShow(name: string): boolean {
  if (SKIP.has(name)) return false;
  if (!name.startsWith(".")) return true;
  return ALLOWED_DOTFILES.has(name);
}

function ext2lang(filename: string): string {
  const e = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescriptreact", js: "javascript",
    jsx: "javascriptreact", json: "json", css: "css", scss: "scss",
    html: "html", md: "markdown", mdx: "mdx", py: "python",
    sh: "bash", yaml: "yaml", yml: "yaml", env: "dotenv",
    prisma: "prisma", sql: "sql", graphql: "graphql", txt: "plaintext",
  };
  return map[e] ?? "plaintext";
}

/** Return available drive letters on Windows, or filesystem roots on Unix */
function getRoots(): { name: string; path: string; type: "dir" }[] {
  if (process.platform === "win32") {
    const drives: { name: string; path: string; type: "dir" }[] = [];
    // Check A–Z
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const drive  = `${letter}:\\`;
      try {
        fs.accessSync(drive);
        drives.push({ name: `${letter}:`, path: drive, type: "dir" });
      } catch { /* drive not available */ }
    }
    return drives;
  }
  // Unix — just return filesystem root and home
  return [
    { name: "/", path: "/", type: "dir" },
    { name: "~", path: os.homedir(), type: "dir" },
  ];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const reqPath  = searchParams.get("path") ?? "";
    const drives   = searchParams.get("drives");

    // Special: list drive roots
    if (drives === "1" || reqPath === "") {
      return NextResponse.json({ type: "roots", entries: getRoots() });
    }

    const absPath = reqPath;

    let stat: fs.Stats;
    try {
      stat = fs.statSync(absPath);
    } catch {
      return NextResponse.json({ error: "Path not found." }, { status: 404 });
    }

    // ── Directory listing ────────────────────────────────────────────
    if (stat.isDirectory()) {
      let names: string[];
      try {
        names = fs.readdirSync(absPath);
      } catch {
        return NextResponse.json({ error: "Permission denied." }, { status: 403 });
      }

      const entries = names
        .filter(name => shouldShow(name))
        .map(name => {
          const childAbs = path.join(absPath, name);
          try {
            const childStat = fs.statSync(childAbs);
            return {
              name,
              type: childStat.isDirectory() ? "dir" : "file",
              path: childAbs,
              size: childStat.isDirectory() ? undefined : childStat.size,
            };
          } catch {
            return null; // skip inaccessible entries
          }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return NextResponse.json({ type: "dir", path: absPath, entries });
    }

    // ── File read ────────────────────────────────────────────────────
    if (stat.isFile()) {
      if (stat.size > 500 * 1024) {
        return NextResponse.json({
          type: "file",
          content: `// File too large to display (${(stat.size / 1024).toFixed(0)} KB)`,
          language: ext2lang(path.basename(absPath)),
          truncated: true,
        });
      }
      try {
        const content = fs.readFileSync(absPath, "utf-8");
        return NextResponse.json({
          type:     "file",
          content,
          language: ext2lang(path.basename(absPath)),
          size:     stat.size,
          path:     absPath,
        });
      } catch {
        return NextResponse.json({ error: "Cannot read file (binary or permission denied)." }, { status: 403 });
      }
    }

    return NextResponse.json({ error: "Unsupported path type." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Save content to an external (absolute-path) file */
export async function POST(req: NextRequest) {
  try {
    const { path: filePath, content } = await req.json();
    if (!filePath || typeof content !== "string") {
      return NextResponse.json({ error: "path and content are required." }, { status: 400 });
    }
    fs.writeFileSync(filePath, content, "utf-8");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
