/**
 * /api/ai/files
 *
 * GET ?path=<relative>  — list directory or read file content
 *
 * Returns:
 *   type: "dir"  → { entries: { name, type: "file"|"dir", path }[] }
 *   type: "file" → { content: string, language: string }
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

const ROOT = path.resolve(process.cwd());

// Dirs/files to always skip — build artifacts and VCS internals
const SKIP = new Set([
  "node_modules", ".next", ".git", ".vercel", ".turbo",
  "dist", "build", "coverage",
]);

// Dotfiles that ARE useful to show (env files, config dotfiles)
const ALLOWED_DOTFILES = new Set([
  ".env", ".env.local", ".env.development", ".env.development.local",
  ".env.production", ".env.production.local", ".env.test", ".env.test.local",
  ".env.example", ".env.sample", ".env.template",
  ".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json", ".eslintrc.yml",
  ".prettierrc", ".prettierrc.js", ".prettierrc.json", ".prettierrc.yml",
  ".babelrc", ".babelrc.js", ".babelrc.json",
  ".editorconfig", ".nvmrc", ".node-version",
  ".gitignore", ".gitattributes",
  ".dockerignore", "Dockerfile",
]);

/** Returns true if this name should be shown in the file tree */
function shouldShow(name: string): boolean {
  if (SKIP.has(name)) return false;
  if (!name.startsWith(".")) return true;       // normal files always shown
  return ALLOWED_DOTFILES.has(name);            // dotfiles: only whitelisted ones
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const rel     = searchParams.get("path") ?? "";
    const action  = searchParams.get("action") ?? "list"; // list | read
    const absPath = rel ? path.resolve(ROOT, rel) : ROOT;

    // Security: must stay within project root
    if (!absPath.startsWith(ROOT)) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const stat = fs.statSync(absPath);

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(absPath)
        .filter(name => shouldShow(name))
        .map(name => {
          const childAbs  = path.join(absPath, name);
          const childRel  = path.relative(ROOT, childAbs);
          const childStat = fs.statSync(childAbs);
          const isDir     = childStat.isDirectory();
          return {
            name,
            type: isDir ? "dir" : "file",
            path: childRel,
            size: isDir ? undefined : childStat.size,
          };
        })
        .sort((a, b) => {
          // Dirs first, then files, then alphabetical
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return NextResponse.json({ type: "dir", entries });
    }

    if (stat.isFile()) {
      // Limit file size to 500KB to avoid huge responses
      if (stat.size > 500 * 1024) {
        return NextResponse.json({
          type: "file",
          content: `// File too large to display (${(stat.size / 1024).toFixed(0)} KB)`,
          language: ext2lang(absPath),
          truncated: true,
        });
      }
      const content = fs.readFileSync(absPath, "utf-8");
      return NextResponse.json({
        type:     "file",
        content,
        language: ext2lang(path.basename(absPath)),
        size:     stat.size,
      });
    }

    return NextResponse.json({ error: "Not found." }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
