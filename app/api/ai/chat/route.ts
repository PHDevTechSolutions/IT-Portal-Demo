/**
 * POST /api/ai/chat  — Ollama only (pure local)
 * GET  /api/ai/chat  — list available Ollama models
 */

import { NextRequest } from "next/server";

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

const OLLAMA_BASE   = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL    || "llama3.2";

/* ── Trim messages to fit Ollama context ─────────────────────────────── */
function trimMessages(messages: any[], maxChars = 24000): any[] {
  const system = messages.filter(m => m.role === "system")
    .map(m => ({ ...m, content: m.content.slice(0, 6000) }));
  const convo  = messages.filter(m => m.role !== "system").slice(-10)
    .map(m => ({ ...m, content: typeof m.content === "string" ? m.content.slice(0, 8000) : m.content }));

  let total = system.reduce((s, m) => s + m.content.length, 0);
  const trimmedConvo: any[] = [];
  for (const m of convo) {
    total += m.content.length;
    trimmedConvo.push(m);
    if (total > maxChars) break;
  }
  return [...system, ...trimmedConvo];
}

/* ── POST ────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const { messages: raw, model = DEFAULT_MODEL } = await req.json();

  if (!Array.isArray(raw) || raw.length === 0) {
    return new Response(JSON.stringify({ error: "messages array is required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const messages = trimMessages(raw);

  let ollamaRes: Response;
  try {
    ollamaRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        model,
        messages,
        stream:  true,
        options: {
          num_ctx:     16384, // larger context window
          temperature: 0.1,   // more deterministic for code
          top_p:       0.9,
        },
      }),
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Ollama unreachable at ${OLLAMA_BASE}. Run: ollama serve (${err.message})` }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!ollamaRes.ok || !ollamaRes.body) {
    const txt = await ollamaRes.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: `Ollama error ${ollamaRes.status}: ${txt.slice(0, 200)}` }),
      { status: ollamaRes.status, headers: { "Content-Type": "application/json" } },
    );
  }

  // Stream Ollama NDJSON → SSE
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const reader  = ollamaRes.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line);
              const token = chunk.message?.content ?? "";
              if (token) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token, source: "ollama", model })}\n\n`));
              if (chunk.done) controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            } catch { /* skip */ }
          }
        }
      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no", "X-AI-Source": "ollama", "X-AI-Model": model,
    },
  });
}

/* ── GET: list Ollama models ─────────────────────────────────────────── */
export async function GET() {
  try {
    const res  = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data   = await res.json();
    const models = (data.models ?? []).map((m: any) => ({ name: m.name, size: m.size }));
    return new Response(
      JSON.stringify({ success: true, models, source: "ollama" }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: `Ollama not running: ${err.message}`, models: [] }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}
