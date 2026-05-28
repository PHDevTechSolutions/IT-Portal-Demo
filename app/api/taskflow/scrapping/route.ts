import { NextRequest, NextResponse } from "next/server";

export const dynamic    = "force-dynamic";
export const maxDuration = 60;

const GROQ_API_KEY   = process.env.GROQ_API_KEY!;
const SERPER_API_KEY = process.env.SERPER_API_KEY!;

export interface ScrapedLead {
  company_name:   string;
  contact_person: string;
  contact_number: string;
  email_address:  string;
  address:        string;
  website?:       string;
  industry?:      string;
  source?:        string;
  confidence:     "high" | "medium" | "low";
}

// ── Serper: Google Search ─────────────────────────────────────────────────────
async function serperSearch(query: string, num = 10): Promise<string> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERPER_API_KEY,
    },
    body: JSON.stringify({ q: query, num, gl: "ph", hl: "en" }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Serper search failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();

  // Build a rich text blob from organic results + knowledge graph
  const parts: string[] = [];

  if (data.knowledgeGraph) {
    const kg = data.knowledgeGraph;
    parts.push(`[Knowledge Graph] ${kg.title ?? ""} — ${kg.description ?? ""}`);
    if (kg.attributes) {
      Object.entries(kg.attributes).forEach(([k, v]) =>
        parts.push(`  ${k}: ${v}`)
      );
    }
  }

  (data.organic ?? []).forEach((r: any, i: number) => {
    parts.push(`\n[Result ${i + 1}] ${r.title}`);
    parts.push(`URL: ${r.link}`);
    parts.push(`Snippet: ${r.snippet ?? ""}`);
    if (r.sitelinks) {
      r.sitelinks.forEach((s: any) => parts.push(`  - ${s.title}: ${s.link}`));
    }
  });

  (data.peopleAlsoAsk ?? []).forEach((q: any) => {
    parts.push(`\n[Q&A] ${q.question}: ${q.snippet ?? ""}`);
  });

  return parts.join("\n") || "No results found.";
}

// ── Groq: extract structured leads from raw search text ──────────────────────
async function extractLeads(
  rawText: string,
  industry: string,
  location: string,
  limit: number
): Promise<ScrapedLead[]> {
  const prompt = `You are a business lead extraction specialist for the Philippine market.

From the Google search results below, extract up to ${limit} distinct business leads.
Industry focus: ${industry || "any"}
Location focus: ${location || "Philippines"}

For each business found, extract:
- company_name   (required — the business name)
- contact_person (owner/manager/contact name, or "" if not found)
- contact_number (Philippine phone: 09XX-XXX-XXXX or +63X-XXX-XXXX, or "" if not found)
- email_address  (business email, or "" if not found)
- address        (full Philippine address with city/province, or "" if not found)
- website        (URL if available, or "")
- industry       (specific business type/industry)
- source         (the URL where this info came from)
- confidence     "high" if 3+ fields filled, "medium" if 2 fields, "low" if only company name

Rules:
- Only include REAL businesses from the search results
- Do NOT invent or hallucinate contact details
- If a field is not in the search results, leave it as ""
- Return ONLY a valid JSON array, no markdown, no explanation

Search results:
${rawText.slice(0, 10000)}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq extraction failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data    = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "[]";
  return parseJsonLeads(content, limit);
}

// ── Groq: generate leads from knowledge (no web search) ──────────────────────
async function generateLeads(
  query: string,
  industry: string,
  location: string,
  limit: number
): Promise<ScrapedLead[]> {
  const prompt = `You are a business intelligence specialist with knowledge of Philippine businesses.

Generate ${limit} realistic business leads based on:
Query: "${query}"
Industry: ${industry || "any"}
Location: ${location || "Philippines"}

Use your knowledge of real or plausible Philippine businesses.
Include a mix of well-known and smaller local businesses.

For each lead:
- company_name   (required)
- contact_person (typical owner/manager name)
- contact_number (Philippine format: 09XX-XXX-XXXX)
- email_address  (typical business email)
- address        (specific Philippine address with city/province)
- website        (if known, else "")
- industry       (specific business type)
- source         ("AI Generated — verify before use")
- confidence     always "low" for AI-generated data

Return ONLY a valid JSON array, no other text.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) throw new Error("Groq generation failed");

  const data    = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "[]";
  return parseJsonLeads(content, limit);
}

// ── Helper: safely parse JSON array from LLM output ──────────────────────────
function parseJsonLeads(content: string, limit: number): ScrapedLead[] {
  const cleaned = content
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  try {
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr.slice(0, limit) : [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]).slice(0, limit); } catch {}
    }
    return [];
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { query, industry, location, limit = 10, mode = "web" } = await req.json();

    if (!query?.trim()) {
      return NextResponse.json({ success: false, error: "Query is required" }, { status: 400 });
    }

    const cap = Math.min(Number(limit), 30);
    let leads: ScrapedLead[] = [];

    if (mode === "ai") {
      leads = await generateLeads(query, industry, location, cap);
    } else {
      // Build a targeted Google search query
      const searchQuery = [
        query,
        industry ? `${industry} company` : "",
        location ? `in ${location}` : "Philippines",
        "contact email phone address",
      ].filter(Boolean).join(" ");

      const rawText = await serperSearch(searchQuery, Math.min(cap * 2, 20));
      leads = await extractLeads(rawText, industry, location, cap);

      // If Groq found nothing from snippets, fall back to AI generation
      if (leads.length === 0) {
        leads = await generateLeads(query, industry, location, cap);
        leads = leads.map(l => ({ ...l, confidence: "low" as const, source: "AI fallback — no web results extracted" }));
      }
    }

    return NextResponse.json({ success: true, leads, count: leads.length, mode });
  } catch (err: any) {
    console.error("[Scrapping API]", err.message);
    return NextResponse.json(
      { success: false, error: err.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
