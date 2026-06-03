/**
 * POST /api/ai/chat  — Ollama only (pure local)
 * GET  /api/ai/chat  — list available Ollama models
 */

import { NextRequest } from "next/server";

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

const OLLAMA_BASE   = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL    || "llama3.2";
const OLLAMA_KEY    = process.env.OLLAMA_API_KEY  || "";

/* ── Model-aware message trimming and context sizing ────────────────── */

/** Returns true if model is a cloud model or has a large context window */
function isLargeModel(modelName: string): boolean {
  return modelName.includes(":cloud") ||
    modelName.includes("kimi")     ||
    modelName.includes("minimax")  ||
    modelName.includes("gemma4")   ||
    modelName.includes("qwen")     ||
    modelName.includes("glm")      ||
    modelName.includes("llama3")   ||
    modelName.includes("llama-3");
}

function pickCtxSize(messages: any[], modelName: string): number {
  const totalChars = messages.reduce((s, m) => s + (m.content?.length ?? 0), 0);

  // Cloud models — always full context
  if (modelName.includes(":cloud") || modelName.includes("kimi") ||
      modelName.includes("minimax") || modelName.includes("gemma4")) {
    return 131072;
  }
  // Qwen / GLM — large context
  if (modelName.includes("qwen") || modelName.includes("glm")) {
    return 131072;
  }
  // LLaMA 3.x — scale dynamically (has 128k context but uses more RAM at full)
  if (modelName.includes("llama3") || modelName.includes("llama-3")) {
    if (totalChars < 500)   return 8192;    // short chat — still much faster than 131k
    if (totalChars < 4000)  return 32768;   // normal conversation
    if (totalChars < 16000) return 65536;   // code + file context
    return 131072;                          // full context when actually needed
  }
  // Other local models — conservative
  if (totalChars < 500)   return 2048;
  if (totalChars < 2000)  return 4096;
  if (totalChars < 8000)  return 8192;
  return 16384;
}

/** Trim messages — large/cloud models get much bigger limits */
function trimMessagesForModel(messages: any[], modelName: string): any[] {
  const large      = isLargeModel(modelName);
  const maxSysChar = large ? 64000  : 6000;
  const maxMsgChar = large ? 64000  : 8000;
  const maxTotal   = large ? 400000 : 24000;
  const keepLast   = large ? 50     : 10;

  const system = messages.filter(m => m.role === "system")
    .map(m => ({ ...m, content: m.content.slice(0, maxSysChar) }));
  const convo = messages.filter(m => m.role !== "system").slice(-keepLast)
    .map(m => ({ ...m, content: typeof m.content === "string" ? m.content.slice(0, maxMsgChar) : m.content }));

  let total = system.reduce((s, m) => s + m.content.length, 0);
  const trimmedConvo: any[] = [];
  for (const m of convo) {
    total += m.content.length;
    trimmedConvo.push(m);
    if (total > maxTotal) break;
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

  const messages = trimMessagesForModel(raw, model);

  let ollamaRes: Response;
  try {
    ollamaRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        ...(OLLAMA_KEY ? { "Authorization": `Bearer ${OLLAMA_KEY}` } : {}),
      },
      body:    JSON.stringify({
        model,
        messages,
        stream:  true,
        options: {
          num_ctx:     pickCtxSize(messages, model),
          temperature: 0.1,
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
    const res  = await fetch(`${OLLAMA_BASE}/api/tags`, {
      headers: { ...(OLLAMA_KEY ? { "Authorization": `Bearer ${OLLAMA_KEY}` } : {}) },
      signal: AbortSignal.timeout(3000),
    });
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
