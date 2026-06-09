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
  type:    "businesslist" | "yellowpages" | "google" | "direct" | "facebook" | "linkedin" | "sec" | "companyhouse";
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
// AI helpers — Cloud Models (Qwen, GLM, etc.) with Groq fallback
// ─────────────────────────────────────────────────────────────────────────────

const AI_BASE_URL  = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const AI_MODEL     = process.env.AI_MODEL        || "qwen3.5:cloud";
const AI_API_KEY   = process.env.OLLAMA_API_KEY  || "";

async function cloudCall(
  prompt:      string,
  model?:      string,
  temperature = 0.1,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for cloud models

  try {
    const res = await fetch(`${AI_BASE_URL}/api/chat`, {
      method:  "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(AI_API_KEY ? { "Authorization": `Bearer ${AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model:  model || AI_MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: { temperature, num_predict: 2048 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Cloud AI failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data.message?.content ?? data.response ?? "";
  } finally {
    clearTimeout(timeoutId);
  }
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

// Use Cloud AI first (Qwen/GLM), fall back to Groq if needed
async function aiCall(
  prompt:      string,
  temperature = 0.1,
  maxTokens   = 2048,
  groqKey?:    string,
  model?:      string,
): Promise<string> {
  try {
    return await cloudCall(prompt, model, temperature);
  } catch (err: any) {
    console.warn("[AI] Cloud provider failed, falling back to Groq:", err.message);
    if (!groqKey) throw new Error("Cloud provider failed and no Groq key provided");
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
  model?:   string,
): Promise<AIPlan> {
  const locationStr = location || "Philippines";
  const prompt = `You are an expert lead researcher for the Philippine B2B market.

A user wants to find ${limit} real business leads with the following criteria:
- Query: "${query}"
- Industry: "${industry || "any"}"
- Location: "${locationStr}" ← THIS IS CRITICAL. Only find businesses physically located in ${locationStr}.

IMPORTANT: The location filter is EXTREMELY STRICT. Every search query and scrape target MUST include "${locationStr}" to ensure results are from that specific area only. If the query implies a different city than ${locationStr}, IGNORE the other city and stick to ${locationStr}.

Generate a JSON plan with:
1. "search_queries": 4-6 targeted Google search queries that MUST include "${locationStr}" in every query. Format: "{industry/query} in ${locationStr} contact email phone"
2. "scrape_targets": 4-8 direct URLs. 
   - For BusinessList.ph use the location slug. 
   - For Yellow Pages include the location in the query param. 
   - For Google always include "${locationStr}" in the q param.
   - For Facebook/LinkedIn/SEC/CompanyHouse, provide the direct search result URL.
   Each target: { "type": "businesslist"|"yellowpages"|"google"|"direct"|"facebook"|"linkedin"|"sec"|"companyhouse", "url": "...", "reason": "..." }
3. "reasoning": brief explanation

Return ONLY valid JSON. No markdown.`;

  const raw  = await aiCall(prompt, 0.2, 1500, groqKey, model);
  const plan = parseJson<AIPlan>(raw);

  if (!plan || !Array.isArray(plan.scrape_targets)) {
    const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const kw   = slug(industry || query);
    const loc  = location ? slug(location.replace(/^metro\s+/i, "")) : "";
    const locQ = location || "Philippines";
    return {
      search_queries: [
        `${industry || query} in ${locQ} contact email phone`,
        `${industry || query} company ${locQ} address`,
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
          url:    `https://www.yellowpages.com.ph/search?q=${encodeURIComponent((industry || query) + " " + locQ)}`,
          reason: "fallback",
        },
        {
          type:   "google",
          url:    `https://www.google.com/search?q=${encodeURIComponent(`${industry || query} in ${locQ} contact email phone`)}&num=20`,
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
  
  const leads: ScrapedLead[] = [];
  const seen  = new Set<string>();

  const addLead = (r: RawLead & { contact_person?: string }) => {
    const key = r.name.toLowerCase().trim();
    if (key.length < 3 || seen.has(key) || leads.length >= limit) return;
    seen.add(key);
    const filled = [r.phone, r.email, r.address, r.website].filter(Boolean).length;
    leads.push({
      company_name:   r.name,
      contact_person: r.contact_person || "",
      contact_number: r.phone,
      email_address:  r.email,
      address:        r.address,
      website:        r.website,
      industry:       industry || "",
      source:         r.source,
      confidence:     filled >= 3 ? "high" : filled >= 1 ? "medium" : "low",
    });
  };

  // Helper for parallel page processing
  const processInParallel = async <T>(items: T[], processor: (item: T, p: any) => Promise<void>, concurrency = 3) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += concurrency) {
      chunks.push(items.slice(i, i + concurrency));
    }
    for (const chunk of chunks) {
      if (leads.length >= limit) break;
      await Promise.all(chunk.map(async (item) => {
        const p = await context.newPage();
        try {
          await processor(item, p);
        } catch (err: any) {
          console.warn(`[Playwright] Parallel process failed:`, err.message);
        } finally {
          await p.close();
        }
      }));
    }
  };

  const mainPage = await context.newPage();

  for (const target of targets) {
    if (leads.length >= limit) break;

    try {
      if (target.type === "businesslist") {
        // ── BusinessList.ph ────────────────────────────────────────────────
        await mainPage.goto(target.url, { waitUntil: "domcontentloaded", timeout: 20000 });
        const listRows = await mainPage.evaluate(() => {
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

        // Parallel visit profile pages
        const toProcess = listRows.slice(0, Math.min(listRows.length, (limit - leads.length) + 5));
        await processInParallel(toProcess, async (row, p) => {
          if (row.profileUrl) {
            await p.goto(row.profileUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
            const profile = await p.evaluate(() => {
              const text = document.body.innerText;
              const emailEl = document.querySelector("a[href^='mailto:']") as HTMLAnchorElement | null;
              const email = emailEl?.href?.replace("mailto:", "")
                ?? text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)
                     ?.find(e => !e.includes("example") && !e.includes("noreply") && !e.includes("test"))
                ?? "";
              const telEl = document.querySelector("a[href^='tel:']") as HTMLAnchorElement | null;
              const phone = telEl?.href?.replace("tel:", "").replace(/\s/g, "")
                ?? text.match(/(\+63[\d\s\-]{9,12}|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10}|[\d]{3,4}[-\s][\d]{4})/)?.[0]?.trim()
                ?? "";
              const contactMatch = text.match(/(?:Manager|Owner|Contact Person|Director|President)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/);
              const contactPerson = contactMatch?.[1] ?? "";
              const websiteEl = document.querySelector("a[href^='http']:not([href*='businesslist'])") as HTMLAnchorElement | null;
              const website = websiteEl?.href ?? "";
              return { email, phone, contactPerson, website };
            });
            addLead({
              name:           row.name,
              phone:          profile.phone || row.phone,
              email:          profile.email,
              address:        row.address,
              website:        profile.website || row.website,
              source:         row.profileUrl,
              contact_person: profile.contactPerson,
            });
          } else {
            addLead(row);
          }
        }, 4);

      } else if (target.type === "yellowpages") {
        // ── Yellow Pages PH ────────────────────────────────────────────────
        await mainPage.goto(target.url, { waitUntil: "domcontentloaded", timeout: 20000 });
        const rows = await mainPage.evaluate((sourceUrl: string) => {
          const results: any[] = [];
          const items = document.querySelectorAll(".listing, .business-listing, [class*='listing-item'], [class*='business-card'], article");
          items.forEach(item => {
            const el   = item as HTMLElement;
            const name = (el.querySelector("h2, h3, .business-name, [class*='name']") ?? el.querySelector("a[href*='/business/']"))?.textContent?.trim() ?? "";
            if (!name || name.length < 3) return;
            const text  = el.innerText ?? "";
            const phone = text.match(/(\+63|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10})/)?.[0] ?? "";
            const email = (el.querySelector("a[href^='mailto:']")?.getAttribute("href")?.replace("mailto:", "") ?? text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0] ?? "");
            const address = el.querySelector(".address, [class*='address'], [class*='location']")?.textContent?.trim() ?? "";
            const website = (el.querySelector("a[href^='http']:not([href*='yellowpages'])") as HTMLAnchorElement)?.href ?? "";
            results.push({ name, phone, email, address, website, source: sourceUrl });
          });
          return results;
        }, target.url);
        rows.forEach(addLead);

      } else if (target.type === "google") {
        // ── Google Search ──────────────────────────────────────────────────
        await mainPage.goto(target.url, { waitUntil: "domcontentloaded", timeout: 15000 });

        const localCards = await mainPage.evaluate((sourceUrl: string) => {
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

        const resultUrls = await mainPage.$$eval("a[href]", (anchors: any[]) =>
          anchors.map(a => a.href as string)
            .filter(href =>
              href.startsWith("http") &&
              !href.includes("google.com") &&
              !href.includes("youtube.com") &&
              !href.includes("facebook.com") &&
              !href.includes("wikipedia.org") &&
              !href.includes("businesslist.ph") &&
              !href.includes("yellowpages.com.ph")
            ).slice(0, 6)
        );

        await processInParallel(resultUrls, async (url, p) => {
          await p.goto(url, { waitUntil: "domcontentloaded", timeout: 8000 });
          const data = await p.evaluate(() => {
            const text = document.body.innerText.slice(0, 4000);
            const title = document.title;
            const emailEl = document.querySelector("a[href^='mailto:']") as HTMLAnchorElement | null;
            const email = emailEl?.href?.replace("mailto:", "")
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
            addLead({
              name:           data.title.replace(/ [-|–].*$/, "").trim(),
              phone:          data.phone,
              email:          data.email,
              address:        data.address,
              website:        url,
              source:         url,
              contact_person: data.contactPerson,
            });
          }
        }, 3);

      } else if (["direct", "facebook", "linkedin", "sec", "companyhouse"].includes(target.type)) {
        // ── Direct page visit (or social/sec) ──────────────────────────────
        await mainPage.goto(target.url, { waitUntil: "domcontentloaded", timeout: 12000 });
        const raw = await mainPage.evaluate(() => {
          const text  = document.body.innerText.slice(0, 4000);
          const title = document.title;
          const emailEl = document.querySelector("a[href^='mailto:']") as HTMLAnchorElement | null;
          const email = emailEl?.href?.replace("mailto:", "")
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
            name:           raw.title.replace(/ [-|–].*$/, "").trim(),
            phone:          raw.phone,
            email:          raw.email,
            address:        raw.address,
            website:        target.url,
            source:         target.url,
            contact_person: raw.contactPerson,
          });
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
  model?:      string,
): Promise<ScrapedLead[]> {
  const existingNames = existing.map(l => l.company_name).join(", ");
  const locationStr   = location || "Philippines";
  const rawBlock = scrapedData
    .map(d => `\n=== SOURCE: ${d.source} ===\n${d.text.slice(0, 3000)}`)
    .join("\n");

  const prompt = `You are a business lead extraction specialist for the Philippine market.

Analyze the scraped website content below and extract up to ${limit} REAL, distinct business leads.
Industry focus: "${industry || "any"}"
Location filter: "${locationStr}" — STRICT. Only include businesses whose address is in ${locationStr}. If the address is in a different city or region, SKIP that lead entirely.
${existingNames ? `Already found (skip these): ${existingNames}` : ""}

Rules:
- Only extract businesses EXPLICITLY mentioned in the text — do NOT invent or hallucinate
- SKIP any lead whose address does not mention "${locationStr}" or a known barangay/street within it
- If address field is empty, only include if the source URL or company name strongly implies ${locationStr}
- If a field is not found, use "" — never guess
- confidence: "high" if phone + email + address all found, "medium" if any 2, "low" if name only
- source = the URL where this lead came from

Return ONLY a valid JSON array:
company_name, contact_person, contact_number, email_address, address, website, industry, source, confidence

Scraped content:
${rawBlock.slice(0, 14000)}`;

  const raw   = await aiCall(prompt, 0.05, 4096, groqKey, model);
  const leads = parseJson<ScrapedLead[]>(raw);
  if (!Array.isArray(leads)) return [];

  // Hard post-filter: if location was detected/specified, drop leads whose address/name
  // doesn't contain the location string (case-insensitive)
  if (location) {
    return filterByLocation(leads, location).slice(0, limit);
  }

  return leads.slice(0, limit);
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
  model?:    string,
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

  const raw  = await aiCall(prompt, 0.2, 1200, groqKey, model);
  const plan = parseJson<AIRefinePlan>(raw);
  return plan ?? { additional_queries: [], additional_targets: [], reasoning: "parse failed" };
}

// ─── Location detection ──────────────────────────────────────────────────────
const PH_LOCATIONS = [
  "Metro Manila", "NCR", "Manila", "Quezon City", "Makati", "Pasig", "Taguig",
  "Mandaluyong", "Caloocan", "Marikina", "Las Piñas", "Muntinlupa", "Valenzuela",
  "Malabon", "Navotas", "San Juan", "Pateros", "Cebu", "Davao", "Iloilo",
  "Bacolod", "Cagayan de Oro", "Zamboanga", "General Santos", "Bagui", "Laguna",
  "Cavite", "Batangas", "Pampanga", "Bulacan", "Rizal", "Tacloban",
];

function detectLocation(query: string, industry: string, providedLocation: string): string {
  if (providedLocation && providedLocation.toLowerCase() !== "all") return providedLocation;
  
  const fullText = `${query} ${industry}`.toLowerCase();
  for (const loc of PH_LOCATIONS) {
    if (fullText.includes(loc.toLowerCase())) return loc;
  }
  return "";
}

// ─── Location filter ─────────────────────────────────────────────────────────
function filterByLocation(leads: ScrapedLead[], location: string): ScrapedLead[] {
  if (!location || location.toLowerCase() === "philippines") return leads;
  
  const locLower = location.toLowerCase();
  const locWords = locLower.split(/\s+/).filter(w => w.length > 3);
  
  // Stricter filtering: if address exists, it MUST contain the location or one of its major words
  return leads.filter(l => {
    const addr = (l.address ?? "").toLowerCase();
    const name = (l.company_name ?? "").toLowerCase();
    
    // If address is missing, we trust the source/name for now, but if address exists, we verify
    if (!addr) return true;
    
    const hasLocMatch = addr.includes(locLower) || locWords.some(w => addr.includes(w));
    const hasNameLocMatch = name.includes(locLower) || locWords.some(w => name.includes(w));
    
    return hasLocMatch || hasNameLocMatch;
  });
}

// ─── Dedup helper ─────────────────────────────────────────────────────────────

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
    const { query, industry = "", location: providedLocation = "", limit = 10, model = "" } = await req.json();

    if (!query?.trim()) {
      return NextResponse.json({ success: false, error: "Query is required" }, { status: 400 });
    }

    const location = detectLocation(query, industry, providedLocation);
    const cap      = Math.min(Number(limit), 50);
    // Try to get Groq key for fallback — non-fatal if missing
    let groqKey: string | undefined;
    try { groqKey = await getGroqKey(); } catch { /* Ollama will be used */ }
    let allLeads: ScrapedLead[] = [];

    // ── Loop 1 ───────────────────────────────────────────────────────────────
    console.log("[Agentic] Loop 1 — AI planning scrape...");
    const plan1   = await aiPlanScraping(groqKey ?? "", query, industry, location, cap, model);
    console.log(`[Agentic] Plan: ${plan1.scrape_targets.length} targets. Reasoning: ${plan1.reasoning}`);

    const raw1    = await executeScrapePlan(plan1.scrape_targets, industry, cap);
    console.log(`[Agentic] Playwright found ${raw1.length} leads from targets`);

    const filteredRaw1 = filterByLocation(raw1, location);
    const structuredText1 = filteredRaw1.map(l => ({
      source: l.source ?? "unknown",
      text: `Company: ${l.company_name} | Phone: ${l.contact_number} | Email: ${l.email_address} | Address: ${l.address} | Website: ${l.website}`,
    }));

    const extracted1 = await aiExtractLeads(groqKey ?? "", structuredText1, industry, location, cap, [], model);
    allLeads = dedup([...filteredRaw1, ...extracted1]);
    console.log(`[Agentic] After loop 1 extraction: ${allLeads.length} leads`);

    // ── Loop 2 (if needed) ───────────────────────────────────────────────────
    if (allLeads.length < cap) {
      const stillNeed = cap - allLeads.length;
      console.log(`[Agentic] Loop 2 — need ${stillNeed} more leads, refining plan...`);

      const plan2   = await aiRefinePlan(groqKey ?? "", query, industry, location, allLeads, stillNeed, model);
      console.log(`[Agentic] Refined plan: ${plan2.additional_targets.length} new targets. Reasoning: ${plan2.reasoning}`);

      if (plan2.additional_targets.length > 0) {
        const raw2 = await executeScrapePlan(plan2.additional_targets, industry, stillNeed);
        console.log(`[Agentic] Playwright loop 2 found ${raw2.length} new leads`);

        const existingNames = new Set(allLeads.map(l => l.company_name.toLowerCase().trim()));
        const filteredRaw2  = filterByLocation(raw2, location)
          .filter(l => !existingNames.has(l.company_name.toLowerCase().trim()));

        const structuredText2 = filteredRaw2.map(l => ({
          source: l.source ?? "unknown",
          text: `Company: ${l.company_name} | Phone: ${l.contact_number} | Email: ${l.email_address} | Address: ${l.address} | Website: ${l.website}`,
        }));

        const extracted2 = await aiExtractLeads(groqKey ?? "", structuredText2, industry, location, stillNeed, allLeads, model);
        allLeads = dedup([...allLeads, ...filteredRaw2, ...extracted2]);
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