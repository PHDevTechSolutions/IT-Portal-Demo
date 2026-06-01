import { NextRequest, NextResponse } from "next/server";
import { getGroqKey } from "@/lib/ai/getGroqKey";
import { launchBrowser } from "@/lib/browser/launcher";

export const dynamic     = "force-dynamic";
export const maxDuration = 120;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

interface ScrapeTarget {
  type:    "businesslist" | "yellowpages" | "google" | "direct";
  url:     string;
  reason?: string; // AI's explanation why it picked this URL
}

interface AIPlan {
  search_queries: string[];   // targeted keyword queries
  scrape_targets: ScrapeTarget[];
  reasoning:      string;
}

interface AIRefinePlan {
  additional_queries: string[];
  additional_targets: ScrapeTarget[];
  reasoning:          string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Groq helpers
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// AI helpers — Ollama (local, no rate limits) with Groq fallback
// ─────────────────────────────────────────────────────────────────────────────

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

async function ollamaCall(
  prompt:      string,
  temperature = 0.1,
): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model:  OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature, num_predict: 2048 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama call failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.response ?? "";
}

async function groqCall(
  groqKey:    string,
  prompt:     string,
  temperature = 0.1,
  maxTokens   = 2048,
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
    body: JSON.stringify({
      model:       "llama-3.3-70b-versatile",
      messages:    [{ role: "user", content: prompt }],
      temperature,
      max_tokens:  maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`Groq call failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Try Ollama first, fall back to Groq if Ollama is not running
async function aiCall(
  prompt:      string,
  temperature = 0.1,
  maxTokens   = 2048,
  groqKey?:    string,
): Promise<string> {
  try {
    return await ollamaCall(prompt, temperature);
  } catch (ollamaErr: any) {
    console.warn("[AI] Ollama unavailable, falling back to Groq:", ollamaErr.message);
    if (!groqKey) throw new Error("Ollama unavailable and no Groq key provided");
    return await groqCall(groqKey, prompt, temperature, maxTokens);
  }
}

function parseJson<T>(content: string): T | null {
  const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(cleaned) as T; } catch { /* try extracting array/object */ }
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return JSON.parse(arrMatch[0]) as T; } catch {} }
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]) as T; } catch {} }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — AI Query Planner
// Groq decides WHAT to scrape and WHERE based on the user's request
// ─────────────────────────────────────────────────────────────────────────────

async function aiPlanScraping(
  groqKey:  string,
  query:    string,
  industry: string,
  location: string,
  limit:    number,
): Promise<AIPlan> {
  const prompt = `You are an expert lead researcher for the Philippine B2B market.

A user wants to find ${limit} real business leads with the following criteria:
- Query: "${query}"
- Industry: "${industry || "any"}"
- Location: "${location || "Philippines"}"

Your job is to plan a web scraping strategy to find REAL businesses with real contact info.

Generate a JSON plan with:
1. "search_queries": 4-6 targeted Google search queries (strings) that would surface real PH business listings with contact details. Be specific — include city, industry terms, and contact-intent words like "contact", "email", "phone number", "address".
2. "scrape_targets": 4-8 direct URLs to scrape. Use these PH business directories:
   - BusinessList.ph: use format https://www.businesslist.ph/companies/{keyword} or https://www.businesslist.ph/companies/{keyword}/location/{city-slug}
   - Yellow Pages PH: use format https://www.yellowpages.com.ph/search?q={keyword}+{location}
   - Google search: use https://www.google.com/search?q={encoded+query}&num=20
   - If you know of a specific industry association or directory site in PH relevant to the query, include it as "direct" type
   Each target has: { "type": "businesslist"|"yellowpages"|"google"|"direct", "url": "...", "reason": "why this URL" }
3. "reasoning": brief explanation of your strategy

Return ONLY valid JSON. No markdown, no extra text.

Example output shape:
{
  "search_queries": ["query 1", "query 2"],
  "scrape_targets": [
    { "type": "businesslist", "url": "https://www.businesslist.ph/companies/...", "reason": "..." }
  ],
  "reasoning": "..."
}`;

  const raw  = await aiCall(prompt, 0.2, 1500, groqKey);
  const plan = parseJson<AIPlan>(raw);

  // Fallback plan if AI fails to parse
  if (!plan || !Array.isArray(plan.scrape_targets)) {
    const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const kw   = slug(industry || query);
    const loc  = location ? slug(location.replace(/^metro\s+/i, "")) : "";
    return {
      search_queries: [
        `${industry || query} ${location || "Philippines"} contact email phone`,
        `${industry || query} company ${location || "Philippines"} address`,
      ],
      scrape_targets: [
        {
          type:   "businesslist",
          url:    loc
            ? `https://www.businesslist.ph/companies/${kw}/location/${loc}`
            : `https://www.businesslist.ph/companies/${kw}`,
          reason: "fallback",
        },
        {
          type:   "yellowpages",
          url:    `https://www.yellowpages.com.ph/search?q=${encodeURIComponent((industry || query) + " " + (location || ""))}`,
          reason: "fallback",
        },
        {
          type:   "google",
          url:    `https://www.google.com/search?q=${encodeURIComponent(`${industry || query} ${location || "Philippines"} contact email phone`)}&num=20`,
          reason: "fallback",
        },
      ],
      reasoning: "Fallback plan — AI plan parsing failed",
    };
  }

  return plan;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Playwright scraper (executes AI's plan)
// ─────────────────────────────────────────────────────────────────────────────

type RawLead = {
  name: string; phone: string; email: string;
  address: string; website: string; source: string;
};

async function executeScrapePlan(
  targets:  ScrapeTarget[],
  industry: string,
  limit:    number,
): Promise<ScrapedLead[]> {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-PH",
  });
  const page  = await context.newPage();
  const leads: ScrapedLead[] = [];
  const seen  = new Set<string>();

  const addLead = (r: RawLead) => {
    const key = r.name.toLowerCase().trim();
    if (key.length < 3 || seen.has(key) || leads.length >= limit) return;
    seen.add(key);
    const filled = [r.phone, r.email, r.address, r.website].filter(Boolean).length;
    leads.push({
      company_name:   r.name,
      contact_person: "",
      contact_number: r.phone,
      email_address:  r.email,
      address:        r.address,
      website:        r.website,
      industry:       industry || "",
      source:         r.source,
      confidence:     filled >= 3 ? "high" : filled >= 1 ? "medium" : "low",
    });
  };

  for (const target of targets) {
    if (leads.length >= limit) break;

    try {
      if (target.type === "businesslist") {
        // ── BusinessList.ph ────────────────────────────────────────────────
        // Step 1: Get company list + profile URLs from the listing page
        await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 25000 });
        const listRows = await page.evaluate(() => {
          const results: any[] = [];
          document.querySelectorAll("h3").forEach(h3 => {
            const name = h3.textContent?.trim() ?? "";
            if (!name || name.length < 3) return;
            const block = (
              h3.closest("article") ??
              h3.closest("[class*='company']") ??
              h3.closest("[class*='listing']") ??
              h3.parentElement?.parentElement
            ) as HTMLElement | null;
            if (!block) return;
            const lines = (block.innerText ?? "").split("\n").map((l: string) => l.trim()).filter(Boolean);
            const phoneLine = lines.find((l: string) =>
              /(\+63|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10}|\d{3,4}[-\s]\d{4})/.test(l)
            ) ?? "";
            const phone = phoneLine.match(
              /(\+63[\d\s\-]{9,12}|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10}|[\d]{3,4}[-\s][\d]{4})/
            )?.[0]?.trim() ?? "";
            const address = lines.find((l: string) =>
              /philippines|manila|cebu|davao|quezon|makati|pasig|taguig|iloilo|street|st\.|avenue|ave\.|road|rd\.|blvd/i.test(l) && l !== name
            ) ?? "";
            const websiteEl = block.querySelector("a[href^='http']:not([href*='businesslist'])") as HTMLAnchorElement | null;
            const profileEl = block.querySelector("a[href*='/company/']") as HTMLAnchorElement | null;
            const profileHref = profileEl?.getAttribute("href") ?? "";
            results.push({
              name, phone, email: "", address,
              website: websiteEl?.href ?? "",
              profileUrl: profileHref ? `https://www.businesslist.ph${profileHref}` : "",
              source: profileHref ? `https://www.businesslist.ph${profileHref}` : target.url,
            });
          });
          return results;
        });

        // Step 2: Visit each profile page to get email, contact person, phone
        for (const row of listRows.slice(0, Math.min(listRows.length, limit - leads.length + 3))) {
          if (leads.length >= limit) break;
          if (row.profileUrl) {
            try {
              await page.goto(row.profileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
              const profile = await page.evaluate(() => {
                const text = document.body.innerText;
                // Email — look for mailto links first, then regex
                const emailEl = document.querySelector("a[href^='mailto:']") as HTMLAnchorElement | null;
                const email   = emailEl?.href?.replace("mailto:", "")
                  ?? text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)
                       ?.find(e => !e.includes("example") && !e.includes("noreply") && !e.includes("test"))
                  ?? "";
                // Phone — look for tel links first
                const telEl = document.querySelector("a[href^='tel:']") as HTMLAnchorElement | null;
                const phone = telEl?.href?.replace("tel:", "").replace(/\s/g, "")
                  ?? text.match(/(\+63[\d\s\-]{9,12}|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10}|[\d]{3,4}[-\s][\d]{4})/)?.[0]?.trim()
                  ?? "";
                // Contact person — look for "Manager", "Owner", "Contact" labels
                const contactMatch = text.match(/(?:Manager|Owner|Contact Person|Director|President)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/);
                const contactPerson = contactMatch?.[1] ?? "";
                // Website
                const websiteEl = document.querySelector("a[href^='http']:not([href*='businesslist'])") as HTMLAnchorElement | null;
                const website   = websiteEl?.href ?? "";
                return { email, phone, contactPerson, website };
              });
              addLead({
                name:    row.name,
                phone:   profile.phone || row.phone,
                email:   profile.email,
                address: row.address,
                website: profile.website || row.website,
                source:  row.profileUrl,
              });
              // Attach contact person if found
              if (profile.contactPerson && leads.length > 0) {
                leads[leads.length - 1].contact_person = profile.contactPerson;
              }
            } catch {
              // Profile visit failed — use listing data
              addLead(row);
            }
          } else {
            addLead(row);
          }
        }

      } else if (target.type === "yellowpages") {
        // ── Yellow Pages PH ────────────────────────────────────────────────
        await page.goto(target.url, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(2500);
        const rows = await page.evaluate((sourceUrl: string) => {
          const results: any[] = [];
          const candidates = [
            ...Array.from(document.querySelectorAll(".listing")),
            ...Array.from(document.querySelectorAll(".business-listing")),
            ...Array.from(document.querySelectorAll("[class*='listing-item']")),
            ...Array.from(document.querySelectorAll("[class*='business-card']")),
            ...Array.from(document.querySelectorAll("article")),
          ];
          const unique = [...new Set(candidates)];
          unique.forEach(item => {
            const el   = item as HTMLElement;
            const name = (
              el.querySelector("h2, h3, .business-name, [class*='name']") ??
              el.querySelector("a[href*='/business/']")
            )?.textContent?.trim() ?? "";
            if (!name || name.length < 3) return;
            const text  = el.innerText ?? "";
            const phone = text.match(/(\+63|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10})/)?.[0] ?? "";
            const email = (
              el.querySelector("a[href^='mailto:']")?.getAttribute("href")?.replace("mailto:", "") ??
              text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0] ?? ""
            );
            const address = el.querySelector(".address, [class*='address'], [class*='location']")?.textContent?.trim() ?? "";
            const website = (el.querySelector("a[href^='http']:not([href*='yellowpages'])") as HTMLAnchorElement)?.href ?? "";
            results.push({ name, phone, email, address, website, source: sourceUrl });
          });
          return results;
        }, target.url);
        rows.forEach(addLead);

      } else if (target.type === "google") {
        // ── Google Search — get URLs then visit each for contact details ───
        await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 20000 });

        // Extract local pack cards (have phone/address inline)
        const localCards = await page.evaluate((sourceUrl: string) => {
          const results: any[] = [];
          document.querySelectorAll(".VkpGBb, .rllt__details, [data-cid]").forEach(card => {
            const el   = card as HTMLElement;
            const text = el.innerText ?? "";
            const name = el.querySelector(".dbg0pd, [class*='title'], h3")?.textContent?.trim() ?? "";
            const phone = text.match(/(\+63|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10})/)?.[0] ?? "";
            const addr  = el.querySelector("[data-dtype='d3adr'], .rllt__wrapped-text")?.textContent?.trim() ?? "";
            if (name) results.push({ name, phone, email: "", address: addr, website: "", source: sourceUrl });
          });
          return results;
        }, target.url);
        localCards.forEach(r => addLead({ ...r, name: r.name.replace(/ [-|–].*$/, "").trim() }));

        // Extract organic result URLs and visit them for contact details
        const resultUrls = await page.$$eval("a[href]", (anchors: any[]) =>
          anchors.map(a => a.href as string)
            .filter(href =>
              href.startsWith("http") &&
              !href.includes("google.com") &&
              !href.includes("youtube.com") &&
              !href.includes("facebook.com") &&
              !href.includes("wikipedia.org") &&
              !href.includes("businesslist.ph") &&
              !href.includes("yellowpages.com.ph")
            ).slice(0, 5)
        );

        for (const url of resultUrls) {
          if (leads.length >= limit) break;
          try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
            const data = await page.evaluate(() => {
              const text = document.body.innerText.slice(0, 5000);
              const title = document.title;
              const emailEl = document.querySelector("a[href^='mailto:']") as HTMLAnchorElement | null;
              const email   = emailEl?.href?.replace("mailto:", "")
                ?? text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)
                     ?.find(e => !e.includes("example") && !e.includes("noreply") && !e.includes("test"))
                ?? "";
              const telEl = document.querySelector("a[href^='tel:']") as HTMLAnchorElement | null;
              const phone = telEl?.href?.replace("tel:", "").replace(/\s/g, "")
                ?? text.match(/(\+63[\d\s\-]{9,12}|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10})/)?.[0]?.trim()
                ?? "";
              const contactMatch = text.match(/(?:Manager|Owner|Contact Person|Director|President)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/);
              const contactPerson = contactMatch?.[1] ?? "";
              const addrMatch = text.match(/\d+\s+[A-Z][a-z]+.*(?:Street|St\.|Avenue|Ave\.|Road|Rd\.|Blvd|Drive|Dr\.)[^,\n]*/i);
              const address = addrMatch?.[0]?.trim() ?? "";
              return { title, email, phone, contactPerson, address };
            });
            if (data.title && (data.email || data.phone)) {
              const lead: RawLead = {
                name:    data.title.replace(/ [-|–].*$/, "").trim(),
                phone:   data.phone,
                email:   data.email,
                address: data.address,
                website: url,
                source:  url,
              };
              addLead(lead);
              if (data.contactPerson && leads.length > 0) {
                leads[leads.length - 1].contact_person = data.contactPerson;
              }
            }
          } catch { /* skip */ }
        }

      } else if (target.type === "direct") {
        // ── Direct page visit ──────────────────────────────────────────────
        await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 15000 });
        const raw = await page.evaluate(() => {
          const text  = document.body.innerText.slice(0, 5000);
          const title = document.title;
          const emailEl = document.querySelector("a[href^='mailto:']") as HTMLAnchorElement | null;
          const email   = emailEl?.href?.replace("mailto:", "")
            ?? text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)
                 ?.find(e => !e.includes("example") && !e.includes("noreply") && !e.includes("test"))
            ?? "";
          const telEl = document.querySelector("a[href^='tel:']") as HTMLAnchorElement | null;
          const phone = telEl?.href?.replace("tel:", "").replace(/\s/g, "")
            ?? text.match(/(\+63[\d\s\-]{9,12}|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10})/)?.[0]?.trim()
            ?? "";
          const contactMatch = text.match(/(?:Manager|Owner|Contact Person|Director|President)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/);
          const contactPerson = contactMatch?.[1] ?? "";
          const addrMatch = text.match(/\d+\s+[A-Z][a-z]+.*(?:Street|St\.|Avenue|Ave\.|Road|Rd\.|Blvd|Drive|Dr\.)[^,\n]*/i);
          const address = addrMatch?.[0]?.trim() ?? "";
          return { title, email, phone, contactPerson, address };
        });
        if (raw.title && (raw.email || raw.phone)) {
          addLead({
            name:    raw.title.replace(/ [-|–].*$/, "").trim(),
            phone:   raw.phone,
            email:   raw.email,
            address: raw.address,
            website: target.url,
            source:  target.url,
          });
          if (raw.contactPerson && leads.length > 0) {
            leads[leads.length - 1].contact_person = raw.contactPerson;
          }
        }
      }
    } catch (e: any) {
      console.warn(`[Playwright] ${target.type} @ ${target.url}:`, e.message);
    }
  }

  await browser.close();
  return leads;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — AI Lead Extractor
// Groq analyzes all raw scraped text, returns only real verified leads
// ─────────────────────────────────────────────────────────────────────────────

async function aiExtractLeads(
  groqKey:     string,
  scrapedData: { source: string; text: string }[],
  industry:    string,
  location:    string,
  limit:       number,
  existing:    ScrapedLead[],
): Promise<ScrapedLead[]> {
  const existingNames = existing.map(l => l.company_name).join(", ");
  const rawBlock = scrapedData
    .map(d => `\n=== SOURCE: ${d.source} ===\n${d.text.slice(0, 3000)}`)
    .join("\n");

  const prompt = `You are a business lead extraction specialist for the Philippine market.

Analyze the scraped website content below and extract up to ${limit} REAL, distinct business leads.
Industry focus: "${industry || "any"}"
Location focus: "${location || "Philippines"}"
${existingNames ? `Already found (skip these): ${existingNames}` : ""}

Rules:
- Only extract businesses that are EXPLICITLY mentioned in the text — do NOT invent or hallucinate
- If a field is not found in the text, use "" — never guess
- Assign confidence: "high" if phone + email + address all found, "medium" if any 2, "low" if name only
- source = the URL/site where this specific lead came from

Return ONLY a valid JSON array of objects with these fields:
company_name, contact_person, contact_number, email_address, address, website, industry, source, confidence

Scraped content:
${rawBlock.slice(0, 14000)}`;

  const raw   = await aiCall(prompt, 0.05, 4096, groqKey);
  const leads = parseJson<ScrapedLead[]>(raw);
  return Array.isArray(leads) ? leads.slice(0, limit) : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — AI Refine (2nd loop)
// If first loop didn't hit the target, AI generates NEW queries based on what
// was already found and what's still missing
// ─────────────────────────────────────────────────────────────────────────────

async function aiRefinePlan(
  groqKey:   string,
  query:     string,
  industry:  string,
  location:  string,
  found:     ScrapedLead[],
  stillNeed: number,
): Promise<AIRefinePlan> {
  const foundSummary = found.map(l =>
    `- ${l.company_name} (${l.confidence}) from ${l.source}`
  ).join("\n");

  const prompt = `You are a lead research expert for the Philippine B2B market.

First scraping loop found only ${found.length} leads but we need ${stillNeed} more.
Original query: "${query}", Industry: "${industry || "any"}", Location: "${location || "Philippines"}"

What was already found:
${foundSummary || "(nothing yet)"}

Generate a refined plan to find more leads. Focus on:
- Different directories or sites not yet tried
- More specific search terms based on what was found
- Niche PH industry associations or chambers of commerce if relevant

Return ONLY valid JSON:
{
  "additional_queries": ["query1", "query2", "query3"],
  "additional_targets": [
    { "type": "businesslist"|"yellowpages"|"google"|"direct", "url": "...", "reason": "..." }
  ],
  "reasoning": "..."
}`;

  const raw  = await aiCall(prompt, 0.2, 1200, groqKey);
  const plan = parseJson<AIRefinePlan>(raw);
  return plan ?? { additional_queries: [], additional_targets: [], reasoning: "parse failed" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dedup helper
// ─────────────────────────────────────────────────────────────────────────────

function dedup(leads: ScrapedLead[]): ScrapedLead[] {
  const seen = new Set<string>();
  return leads.filter(l => {
    const key = l.company_name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { query, industry = "", location = "", limit = 10 } = await req.json();

    if (!query?.trim()) {
      return NextResponse.json({ success: false, error: "Query is required" }, { status: 400 });
    }

    const cap      = Math.min(Number(limit), 50);
    // Try to get Groq key for fallback — non-fatal if missing
    let groqKey: string | undefined;
    try { groqKey = await getGroqKey(); } catch { /* Ollama will be used */ }
    let allLeads: ScrapedLead[] = [];

    // ── Loop 1 ───────────────────────────────────────────────────────────────
    console.log("[Agentic] Loop 1 — AI planning scrape...");
    const plan1   = await aiPlanScraping(groqKey ?? "", query, industry, location, cap);
    console.log(`[Agentic] Plan: ${plan1.scrape_targets.length} targets. Reasoning: ${plan1.reasoning}`);

    const raw1    = await executeScrapePlan(plan1.scrape_targets, industry, cap);
    console.log(`[Agentic] Playwright found ${raw1.length} leads from targets`);

    // Collect raw text per source for AI extraction
    // (we pass the scraped leads themselves as structured text for AI to re-validate)
    const structuredText1 = raw1.map(l => ({
      source: l.source ?? "unknown",
      text: `Company: ${l.company_name} | Phone: ${l.contact_number} | Email: ${l.email_address} | Address: ${l.address} | Website: ${l.website}`,
    }));

    const extracted1 = await aiExtractLeads(groqKey ?? "", structuredText1, industry, location, cap, []);
    allLeads = dedup([...raw1, ...extracted1]);
    console.log(`[Agentic] After loop 1 extraction: ${allLeads.length} leads`);

    // ── Loop 2 (if needed) ───────────────────────────────────────────────────
    if (allLeads.length < cap) {
      const stillNeed = cap - allLeads.length;
      console.log(`[Agentic] Loop 2 — need ${stillNeed} more leads, refining plan...`);

      const plan2   = await aiRefinePlan(groqKey ?? "", query, industry, location, allLeads, stillNeed);
      console.log(`[Agentic] Refined plan: ${plan2.additional_targets.length} new targets. Reasoning: ${plan2.reasoning}`);

      if (plan2.additional_targets.length > 0) {
        const raw2 = await executeScrapePlan(plan2.additional_targets, industry, stillNeed);
        console.log(`[Agentic] Playwright loop 2 found ${raw2.length} new leads`);

        const existingNames = new Set(allLeads.map(l => l.company_name.toLowerCase().trim()));
        const newRaw2 = raw2.filter(l => !existingNames.has(l.company_name.toLowerCase().trim()));

        const structuredText2 = newRaw2.map(l => ({
          source: l.source ?? "unknown",
          text: `Company: ${l.company_name} | Phone: ${l.contact_number} | Email: ${l.email_address} | Address: ${l.address} | Website: ${l.website}`,
        }));

        const extracted2 = await aiExtractLeads(groqKey ?? "", structuredText2, industry, location, stillNeed, allLeads);
        allLeads = dedup([...allLeads, ...newRaw2, ...extracted2]);
        console.log(`[Agentic] After loop 2: ${allLeads.length} leads total`);
      }
    }

    // Final slice to cap
    const finalLeads = allLeads.slice(0, cap);

    return NextResponse.json({
      success: true,
      leads:   finalLeads,
      count:   finalLeads.length,
      mode:    "agentic",
    });

  } catch (err: any) {
    console.error("[Agentic Leads API]", err.message);
    return NextResponse.json(
      { success: false, error: err.message ?? "Internal Server Error" },
      { status: 500 },
    );
  }
}