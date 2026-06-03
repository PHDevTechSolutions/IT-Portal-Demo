/**
 * /api/ai/rag
 *
 * Simple in-memory RAG (Retrieval Augmented Generation) for project files.
 * No external vector DB needed — uses TF-IDF-style keyword scoring.
 *
 * POST { action: "index",  path: string }          — index a folder
 * POST { action: "search", query: string, k?: number } — search indexed chunks
 * POST { action: "clear" }                          — clear the index
 * GET                                               — return index stats
 */

import { NextRequest, NextResponse } from "next/server";
import fs   from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/* ── Types ─────────────────────────────────────────────────────────── */
interface Chunk {
  id:       string;
  filePath: string;
  fileName: string;
  ext:      string;
  content:  string;
  lines:    [number, number]; // [start, end] 1-indexed
  tokens:   Map<string, number>; // term → frequency (TF)
}

interface IndexStats {
  totalFiles:  number;
  totalChunks: number;
  indexedAt:   string;
  rootPath:    string;
}

/* ── In-memory index ────────────────────────────────────────────────── */
let CHUNKS: Chunk[]       = [];
let STATS:  IndexStats   | null = null;
let IDF:    Map<string, number> = new Map(); // inverse document frequency

/* ── Constants ─────────────────────────────────────────────────────── */
const CHUNK_LINES     = 60;   // lines per chunk
const CHUNK_OVERLAP   = 10;   // overlap between chunks
const MAX_FILE_SIZE   = 200 * 1024; // 200 KB
const MAX_FILES       = 500;

const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", ".vercel", ".turbo",
  "dist", "build", "coverage", ".cache",
]);

const INDEXABLE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".css", ".scss", ".html", ".json", ".md", ".mdx",
  ".prisma", ".graphql", ".sql", ".env", ".yaml", ".yml",
  ".py", ".sh", ".txt",
]);

/* ── Tokenizer ─────────────────────────────────────────────────────── */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // split on whitespace, punctuation, camelCase boundaries
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-z0-9_]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && t.length < 40);
}

function termFreq(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  // Normalize by document length
  for (const [k, v] of freq) freq.set(k, v / tokens.length);
  return freq;
}

function buildIDF(chunks: Chunk[]): Map<string, number> {
  const docCount = chunks.length;
  const df       = new Map<string, number>();
  for (const c of chunks) {
    for (const term of c.tokens.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log((docCount + 1) / (count + 1)) + 1);
  }
  return idf;
}

/* ── TF-IDF cosine similarity ──────────────────────────────────────── */
function tfidfScore(queryTokens: string[], chunk: Chunk, idf: Map<string, number>): number {
  const qFreq = termFreq(queryTokens);
  let score = 0;
  let qNorm = 0;
  let cNorm = 0;

  for (const [term, qtf] of qFreq) {
    const idfVal = idf.get(term) ?? 0;
    const qWeight = qtf * idfVal;
    const cWeight = (chunk.tokens.get(term) ?? 0) * idfVal;
    score += qWeight * cWeight;
    qNorm += qWeight ** 2;
  }
  for (const [term, ctf] of chunk.tokens) {
    const idfVal = idf.get(term) ?? 0;
    cNorm += (ctf * idfVal) ** 2;
  }

  const denom = Math.sqrt(qNorm) * Math.sqrt(cNorm);
  return denom === 0 ? 0 : score / denom;
}

/* ── File walker ───────────────────────────────────────────────────── */
function walkDir(dir: string, results: string[], depth = 0): void {
  if (depth > 10 || results.length >= MAX_FILES) return;
  let entries: string[];
  try { entries = fs.readdirSync(dir); } catch { return; }

  for (const name of entries) {
    if (SKIP_DIRS.has(name) || name.startsWith(".")) {
      // Allow .env files
      if (!name.startsWith(".env")) continue;
    }
    const full = path.join(dir, name);
    let stat: fs.Stats;
    try { stat = fs.statSync(full); } catch { continue; }

    if (stat.isDirectory()) {
      walkDir(full, results, depth + 1);
    } else if (INDEXABLE_EXTS.has(path.extname(name).toLowerCase())) {
      if (stat.size <= MAX_FILE_SIZE) results.push(full);
    }
  }
}

/* ── Chunker ───────────────────────────────────────────────────────── */
function chunkFile(filePath: string, rootPath: string): Chunk[] {
  let content: string;
  try { content = fs.readFileSync(filePath, "utf-8"); } catch { return []; }

  const lines  = content.split("\n");
  const relPath = path.relative(rootPath, filePath).replace(/\\/g, "/");
  const ext    = path.extname(filePath).toLowerCase().slice(1);
  const chunks: Chunk[] = [];

  for (let start = 0; start < lines.length; start += CHUNK_LINES - CHUNK_OVERLAP) {
    const end        = Math.min(start + CHUNK_LINES, lines.length);
    const chunkText  = lines.slice(start, end).join("\n");
    if (chunkText.trim().length < 20) continue; // skip near-empty chunks

    const tokens = tokenize(chunkText);
    chunks.push({
      id:       `${relPath}:${start + 1}-${end}`,
      filePath: relPath,
      fileName: path.basename(filePath),
      ext,
      content:  chunkText,
      lines:    [start + 1, end],
      tokens:   termFreq(tokens),
    });
  }
  return chunks;
}

/* ── Index builder ─────────────────────────────────────────────────── */
function buildIndex(rootPath: string): { chunks: number; files: number } {
  const files: string[] = [];
  walkDir(rootPath, files);

  const newChunks: Chunk[] = [];
  for (const f of files) {
    newChunks.push(...chunkFile(f, rootPath));
  }

  CHUNKS = newChunks;
  IDF    = buildIDF(newChunks);
  STATS  = {
    totalFiles:  files.length,
    totalChunks: newChunks.length,
    indexedAt:   new Date().toISOString(),
    rootPath,
  };

  return { chunks: newChunks.length, files: files.length };
}

/* ── Search ────────────────────────────────────────────────────────── */
function search(query: string, k = 5): { chunk: Chunk; score: number }[] {
  if (CHUNKS.length === 0) return [];
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  const scored = CHUNKS.map(c => ({ chunk: c, score: tfidfScore(qTokens, c, IDF) }));
  scored.sort((a, b) => b.score - a.score);

  // Return top-k with score > 0
  return scored.filter(s => s.score > 0).slice(0, k);
}

/* ── Route handlers ────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "index") {
      const rootPath = String(body.path ?? "").trim();
      if (!rootPath || !fs.existsSync(rootPath)) {
        return NextResponse.json({ error: "Invalid path." }, { status: 400 });
      }
      const result = buildIndex(rootPath);
      return NextResponse.json({ success: true, ...result, stats: STATS });
    }

    if (action === "search") {
      const query = String(body.query ?? "").trim();
      const k     = Math.min(Number(body.k ?? 5), 15);
      if (!query) return NextResponse.json({ results: [] });

      const results = search(query, k);
      return NextResponse.json({
        results: results.map(r => ({
          filePath: r.chunk.filePath,
          fileName: r.chunk.fileName,
          lines:    r.chunk.lines,
          score:    Math.round(r.score * 1000) / 1000,
          content:  r.chunk.content.slice(0, 800), // truncate for response size
        })),
        query,
        totalIndexed: CHUNKS.length,
      });
    }

    if (action === "clear") {
      CHUNKS = []; IDF = new Map(); STATS = null;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    indexed: CHUNKS.length > 0,
    stats:   STATS,
  });
}
