/**
 * /api/ai/knowledge
 *
 * Persistent Q&A knowledge base stored as a JSON file.
 * Entries are injected into AI context on every message.
 *
 * GET                                    — list all entries
 * POST { question, answer, tags? }       — add entry
 * PUT  { id, question?, answer?, tags? } — update entry
 * DELETE { id }                          — remove entry
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs   from "fs";

export const dynamic = "force-dynamic";

interface KnowledgeEntry {
  id:        string;
  question:  string;
  answer:    string;
  tags:      string[];
  createdAt: string;
  updatedAt: string;
}

// Store in the project's .kiro folder so it persists across restarts
const STORE_PATH = path.join(process.cwd(), ".kiro", "knowledge.json");

function load(): KnowledgeEntry[] {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as KnowledgeEntry[];
  } catch { return []; }
}

function save(entries: KnowledgeEntry[]) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

export async function GET() {
  return NextResponse.json({ entries: load() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { question, answer, tags } = body;

  if (!question?.trim() || !answer?.trim()) {
    return NextResponse.json({ error: "question and answer are required." }, { status: 400 });
  }

  const entries = load();
  const entry: KnowledgeEntry = {
    id:        crypto.randomUUID(),
    question:  question.trim(),
    answer:    answer.trim(),
    tags:      Array.isArray(tags) ? tags : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  entries.push(entry);
  save(entries);

  return NextResponse.json({ success: true, entry });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, question, answer, tags } = body;

  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const entries = load();
  const idx     = entries.findIndex(e => e.id === id);
  if (idx === -1) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  entries[idx] = {
    ...entries[idx],
    ...(question ? { question: question.trim() } : {}),
    ...(answer   ? { answer:   answer.trim()   } : {}),
    ...(tags     ? { tags }                       : {}),
    updatedAt: new Date().toISOString(),
  };
  save(entries);

  return NextResponse.json({ success: true, entry: entries[idx] });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id } = body;

  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const entries = load().filter(e => e.id !== id);
  save(entries);

  return NextResponse.json({ success: true });
}
