import { NextRequest, NextResponse } from "next/server";
import { getGroqKey } from "@/lib/ai/getGroqKey";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

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
    headers: { "Content-Type": "application/json", "X-API-KEY": SERPER_API_KEY },
    body: JSON.stringify({ q: query, num, gl: "ph", hl: "en" }),
  });
  if (!res.ok) throw new Error(`Serper search failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const parts: string[] = [];
  if (data.knowledgeGraph) {
    const kg = data.knowledgeGraph;
    parts.push(`[Knowledge Graph] ${kg.title ?? ""} — ${kg.description ?? ""}`);
    if (kg.attributes) Object.entries(kg.attributes).forEach(([k, v]) => parts.push(`  ${k}: ${v}`));
  }
  (data.organic ?? []).forEach((r: any, i: number) => {
    parts.push(`\n[Result ${i + 1}] ${r.title}`);
    parts.push(`URL: ${r.link}`);
    parts.push(`Snippet: ${r.snippet ?? ""}`);
    if (r.sitelinks) r.sitelinks.forEach((s: any) => parts.push(`  - ${s.title}: ${s.link}`));
  });
  (data.peopleAlsoAsk ?? []).forEach((q: any) => parts.push(`\n[Q&A] ${q.question}: ${q.snippet ?? ""}`));
  return parts.join("\n") || "No results found.";
}

// ── Playwright: real browser scraping ────────────────────────────────────────
// Sources (in order):
//   1. BusinessList.ph  — /companies/{keyword} or /companies/{keyword}/location/{city}
//      Confirmed live structure: each listing has <h3> name, plain-text phone, address paragraph
//   2. Google Search    — organic snippets + local pack cards
//   3. Yellow Pages PH  — JS-gated, wait for networkidle then scrape
//   4. companyhouse.ph  — SEC-verified names (returns 403 on bots → skip gracefully)
//   5. Direct page visits — regex email/phone fallback on top Google result URLs
async function playwrightScrape(
  query: string, industry: string, location: string, limit: number
): Promise<ScrapedLead[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-PH",
  });
  const page  = await context.newPage();
  const leads: ScrapedLead[] = [];
  const seen  = new Set<string>();

  const addLead = (lead: ScrapedLead) => {
    const key = lead.company_name.toLowerCase().trim();
    if (key.length > 2 && !seen.has(key) && leads.length < limit) {
      seen.add(key);
      leads.push(lead);
    }
  };

  const toSlug = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ── 1. BusinessList.ph ──────────────────────────────────────────────────────
  // Confirmed URL: /companies/{keyword}  or  /companies/{keyword}/location/{city}
  // Live HTML shows: <h3> = company name, plain text phone near it, address as paragraph
  // Emails are hidden behind login — we get name + phone + address + website
  try {
    const keyword = toSlug(industry || query);
    const locSlug = location ? toSlug(location.replace(/^metro\s+/i, "")) : "";
    const blUrl   = locSlug
      ? `https://www.businesslist.ph/companies/${keyword}/location/${locSlug}`
      : `https://www.businesslist.ph/companies/${keyword}`;

    await page.goto(blUrl, { waitUntil: "domcontentloaded", timeout: 25000 });

    const blLeads = await page.evaluate(() => {
      const results: any[] = [];
      document.querySelectorAll("h3").forEach(h3 => {
        const name = h3.textContent?.trim() ?? "";
        if (!name || name.length < 3) return;

        // Walk up to find the containing block for this listing
        const block = (
          h3.closest("article") ??
          h3.closest("[class*='company']") ??
          h3.closest("[class*='listing']") ??
          h3.parentElement?.parentElement
        ) as HTMLElement | null;
        if (!block) return;

        const allText = block.innerText ?? "";
        const lines   = allText.split("\n").map((l: string) => l.trim()).filter(Boolean);

        // Phone: PH number patterns
        const phoneLine = lines.find((l: string) =>
          /(\+63|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10}|\d{3,4}[-\s]\d{4})/.test(l)
        ) ?? "";
        const phone = phoneLine.match(
          /(\+63[\d\s\-]{9,12}|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10}|[\d]{3,4}[-\s][\d]{4})/
        )?.[0]?.trim() ?? "";

        // Address: line with PH city/street keywords
        const addrLine = lines.find((l: string) =>
          /philippines|manila|cebu|davao|quezon|makati|pasig|taguig|iloilo|antipolo|valenzuela|street|st\.|avenue|ave\.|road|rd\.|blvd|highway|hi-way/i.test(l) &&
          l !== name
        ) ?? "";

        // External website link
        const websiteEl = block.querySelector(
          "a[href^='http']:not([href*='businesslist'])"
        ) as HTMLAnchorElement | null;
        const website = websiteEl?.href ?? "";

        // Profile link for source
        const profileEl = block.querySelector("a[href*='/company/']") as HTMLAnchorElement | null;
        const profileHref = profileEl?.getAttribute("href") ?? "";
        const source = profileHref
          ? `https://www.businesslist.ph${profileHref}`
          : "businesslist.ph";

        results.push({ name, phone, address: addrLine, website, source });
      });
      return results;
    });

    blLeads.forEach(r => {
      if (r.name) addLead({
        company_name:   r.name,
        contact_person: "",
        contact_number: r.phone ?? "",
        email_address:  "",
        address:        r.address ?? "",
        website:        r.website ?? "",
        industry:       industry || "",
        source:         r.source,
        confidence:     r.phone ? "medium" : "low",
      });
    });
  } catch (e: any) {
    console.warn("[Playwright] BusinessList.ph:", e.message);
  }

  // ── 2. Google Search ────────────────────────────────────────────────────────
  if (leads.length < limit) {
    try {
      const gq = encodeURIComponent(
        `${industry || query} ${location || "Philippines"} contact email phone`
      );
      await page.goto(`https://www.google.com/search?q=${gq}&num=20`, {
        waitUntil: "domcontentloaded", timeout: 20000,
      });

      const gLeads = await page.evaluate(() => {
        const results: any[] = [];

        // Local pack cards
        document.querySelectorAll(".VkpGBb, .rllt__details, [data-cid]").forEach(card => {
          const el   = card as HTMLElement;
          const text = el.innerText ?? "";
          const name = el.querySelector(".dbg0pd, [class*='title'], h3")?.textContent?.trim() ?? "";
          const phone = text.match(/(\+63|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10})/)?.[0] ?? "";
          const addr  = el.querySelector("[data-dtype='d3adr'], .rllt__wrapped-text")?.textContent?.trim() ?? "";
          if (name) results.push({ name, phone, address: addr, email: "", source: "google.com/maps" });
        });

        // Organic results — h3 + snippet
        document.querySelectorAll(".g").forEach(g => {
          const name  = g.querySelector("h3")?.textContent?.trim() ?? "";
          const snip  = (g.querySelector(".VwiC3b, .s3v9rd") as HTMLElement)?.innerText ?? "";
          const phone = snip.match(/(\+63|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10})/)?.[0] ?? "";
          const email = snip.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0] ?? "";
          if (name && name.length > 3) results.push({ name, phone, email, address: "", source: "google.com" });
        });

        return results;
      });

      gLeads.forEach(r => {
        if (r.name) addLead({
          company_name:   r.name.replace(/ [-|–].*$/, "").trim(),
          contact_person: "",
          contact_number: r.phone ?? "",
          email_address:  r.email ?? "",
          address:        r.address ?? "",
          website:        "",
          industry:       industry || "",
          source:         r.source,
          confidence:     (r.email && r.phone) ? "high" : (r.email || r.phone) ? "medium" : "low",
        });
      });
    } catch (e: any) {
      console.warn("[Playwright] Google:", e.message);
    }
  }

  // ── 3. Yellow Pages PH ──────────────────────────────────────────────────────
  // Site uses a JWT JS challenge on first visit — wait for networkidle after redirect
  if (leads.length < limit) {
    try {
      const ypQ = encodeURIComponent(`${industry || query} ${location || ""}`);
      await page.goto(`https://www.yellowpages.com.ph/search?q=${ypQ}`, {
        waitUntil: "networkidle", timeout: 30000,
      });
      // Extra wait for JS challenge to fully resolve
      await page.waitForTimeout(3000);

      const ypLeads = await page.evaluate(() => {
        const results: any[] = [];
        // Try multiple selectors — YP changes markup periodically
        const candidates = [
          ...Array.from(document.querySelectorAll(".listing")),
          ...Array.from(document.querySelectorAll(".business-listing")),
          ...Array.from(document.querySelectorAll("[class*='listing-item']")),
          ...Array.from(document.querySelectorAll("[class*='business-card']")),
          ...Array.from(document.querySelectorAll("article")),
        ];
        // Deduplicate by element reference
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
          const cat     = el.querySelector(".category, [class*='category'], [class*='type']")?.textContent?.trim() ?? "";
          const website = (el.querySelector("a[href^='http']:not([href*='yellowpages'])") as HTMLAnchorElement)?.href ?? "";

          results.push({ name, phone, email, address, category: cat, website, source: "yellowpages.com.ph" });
        });
        return results;
      });

      ypLeads.forEach(r => {
        if (r.name) addLead({
          company_name:   r.name,
          contact_person: "",
          contact_number: r.phone ?? "",
          email_address:  r.email ?? "",
          address:        r.address ?? "",
          website:        r.website ?? "",
          industry:       r.category || industry || "",
          source:         r.source,
          confidence:     (r.email && r.phone) ? "high" : (r.email || r.phone) ? "medium" : "low",
        });
      });
    } catch (e: any) {
      console.warn("[Playwright] Yellow Pages:", e.message);
    }
  }

  // ── 4. companyhouse.ph (SEC-verified names) ──────────────────────────────────
  // Returns SEC-registered company names — no contact info but confirms legitimacy
  // May return 403 for bots; handled gracefully
  if (leads.length < limit) {
    try {
      const chQ = encodeURIComponent(`${industry || query} ${location || ""}`);
      await page.goto(`https://companyhouse.ph/search?q=${chQ}`, {
        waitUntil: "domcontentloaded", timeout: 20000,
      });

      const chLeads = await page.evaluate(() => {
        const results: any[] = [];
        document.querySelectorAll("a[href*='/company/'], a[href*='/search/']").forEach(a => {
          const name = a.textContent?.trim() ?? "";
          if (
            name.length > 3 &&
            !name.toLowerCase().includes("search") &&
            !name.toLowerCase().includes("order") &&
            !name.toLowerCase().includes("report")
          ) {
            results.push({ name, source: "companyhouse.ph (SEC-verified)" });
          }
        });
        return results;
      });

      chLeads.forEach(r => {
        if (r.name) addLead({
          company_name:   r.name,
          contact_person: "",
          contact_number: "",
          email_address:  "",
          address:        "",
          website:        "",
          industry:       industry || "",
          source:         r.source,
          confidence:     "low",
        });
      });
    } catch (e: any) {
      console.warn("[Playwright] companyhouse.ph (may block bots):", e.message);
    }
  }

  // ── 5. Direct page visits (fallback) ────────────────────────────────────────
  // Visit top Google result URLs and extract email/phone via regex
  if (leads.length < Math.min(3, limit)) {
    try {
      const fbQ = encodeURIComponent(
        `${industry || query} ${location || "Philippines"} contact email phone`
      );
      await page.goto(`https://www.google.com/search?q=${fbQ}&num=10`, {
        waitUntil: "domcontentloaded", timeout: 20000,
      });

      const urls = await page.$$eval("a[href]", (anchors: any[]) =>
        anchors
          .map((a: any) => a.href as string)
          .filter(href =>
            href.startsWith("http") &&
            !href.includes("google.com") &&
            !href.includes("youtube.com") &&
            !href.includes("facebook.com") &&
            !href.includes("wikipedia.org") &&
            !href.includes("businesslist.ph") &&
            !href.includes("yellowpages.com.ph") &&
            !href.includes("companyhouse.ph")
          )
          .slice(0, 6)
      );

      for (const url of urls) {
        if (leads.length >= limit) break;
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
          const text  = await page.evaluate(() => document.body.innerText.slice(0, 4000));
          const title = await page.title();
          const emails = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
          const phones = text.match(/(\+63|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10})/g) ?? [];
          const email  = emails.find(e =>
            !e.includes("example") && !e.includes("test") && !e.includes("noreply")
          ) ?? "";
          const phone  = phones[0]?.replace(/\s/g, "") ?? "";
          if (title && (email || phone)) {
            addLead({
              company_name:   title.replace(/ [-|–].*$/, "").trim(),
              contact_person: "",
              contact_number: phone,
              email_address:  email,
              address:        "",
              website:        url,
              industry:       industry || "",
              source:         url,
              confidence:     (email && phone) ? "high" : "medium",
            });
          }
        } catch { /* skip pages that fail to load */ }
      }
    } catch (e: any) {
      console.warn("[Playwright] Direct visits:", e.message);
    }
  }

  await browser.close();
  return leads.slice(0, limit);
}

// ── Groq: extract structured leads from raw search text ──────────────────────
async function extractLeads(groqKey: string, rawText: string, industry: string, location: string, limit: number): Promise<ScrapedLead[]> {
  const prompt = `You are a business lead extraction specialist for the Philippine market.

From the Google search results below, extract up to ${limit} distinct business prospects.
Industry focus: ${industry || "any"}
Location focus: ${location || "Philippines"}

For each business found, extract:
- company_name   (required)
- contact_person (owner/manager name, or "")
- contact_number (Philippine phone: 09XX-XXX-XXXX, or "")
- email_address  (business email, or "")
- address        (full Philippine address, or "")
- website        (URL if available, or "")
- industry       (specific business type)
- source         (URL where info came from)
- confidence     "high" if 3+ fields filled, "medium" if 2, "low" if only company name

Rules: Only REAL businesses. Do NOT hallucinate. Return ONLY valid JSON array.

Search results:
${rawText.slice(0, 10000)}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.1, max_tokens: 4096 }),
  });
  if (!res.ok) throw new Error(`Groq extraction failed (${res.status})`);
  const data = await res.json();
  return parseJsonLeads(data.choices?.[0]?.message?.content ?? "[]", limit);
}

// ── Groq: generate leads from knowledge ──────────────────────────────────────
async function generateLeads(groqKey: string, query: string, industry: string, location: string, limit: number): Promise<ScrapedLead[]> {
  const prompt = `You are a business intelligence specialist with knowledge of Philippine businesses.

Generate ${limit} realistic business prospects based on:
Query: "${query}"
Industry: ${industry || "any"}
Location: ${location || "Philippines"}

For each prospect:
- company_name, contact_person, contact_number (09XX-XXX-XXXX), email_address, address, website, industry
- source: "AI Generated — verify before use"
- confidence: always "low"

Return ONLY a valid JSON array.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.4, max_tokens: 4096 }),
  });
  if (!res.ok) throw new Error("Groq generation failed");
  const data = await res.json();
  return parseJsonLeads(data.choices?.[0]?.message?.content ?? "[]", limit);
}

// ── Helper: safely parse JSON array from LLM output ──────────────────────────
function parseJsonLeads(content: string, limit: number): ScrapedLead[] {
  const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr.slice(0, limit) : [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) { try { return JSON.parse(match[0]).slice(0, limit); } catch {} }
    return [];
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
// mode: "web" = Serper + Groq | "ai" = Groq generate | "playwright" = real browser
export async function POST(req: NextRequest) {
  try {
    const { query, industry, location, limit = 10, mode = "web" } = await req.json();

    if (!query?.trim()) {
      return NextResponse.json({ success: false, error: "Query is required" }, { status: 400 });
    }

    const cap = Math.min(Number(limit), 50);
    let leads: ScrapedLead[] = [];

    if (mode === "playwright") {
      leads = await playwrightScrape(query, industry, location, cap);
      // Fill remaining slots with Groq if playwright found too little
      if (leads.length < cap) {
        try {
          const GROQ_API_KEY = await getGroqKey();
          const rawText = await serperSearch(
            [query, industry, location || "Philippines", "contact email phone"].filter(Boolean).join(" "), 10
          );
          const groqLeads = await extractLeads(GROQ_API_KEY, rawText, industry, location, cap - leads.length);
          // Deduplicate before merging
          const existingNames = new Set(leads.map(l => l.company_name.toLowerCase().trim()));
          const newLeads = groqLeads.filter(l => !existingNames.has(l.company_name.toLowerCase().trim()));
          leads = [...leads, ...newLeads];
        } catch { /* use what playwright found */ }
      }
      // Still short? Fill with AI generation
      if (leads.length < cap) {
        try {
          const GROQ_API_KEY = await getGroqKey();
          const existingNames = new Set(leads.map(l => l.company_name.toLowerCase().trim()));
          const aiLeads = await generateLeads(GROQ_API_KEY, query, industry, location, cap - leads.length);
          const newLeads = aiLeads
            .filter(l => !existingNames.has(l.company_name.toLowerCase().trim()))
            .map(l => ({ ...l, confidence: "low" as const, source: "AI fill — browser found fewer results" }));
          leads = [...leads, ...newLeads];
        } catch { /* best effort */ }
      }
    } else if (mode === "ai") {
      const GROQ_API_KEY = await getGroqKey();
      leads = await generateLeads(GROQ_API_KEY, query, industry, location, cap);
    } else {
      const GROQ_API_KEY = await getGroqKey();
      const searchQuery  = [
        query,
        industry ? `${industry} company` : "",
        location ? `in ${location}` : "Philippines",
        "contact email phone address",
      ].filter(Boolean).join(" ");
      const rawText = await serperSearch(searchQuery, Math.min(cap * 2, 20));
      leads = await extractLeads(GROQ_API_KEY, rawText, industry, location, cap);
      // Fill remaining slots with AI generation to meet the requested count
      if (leads.length < cap) {
        try {
          const existingNames = new Set(leads.map(l => l.company_name.toLowerCase().trim()));
          const aiLeads = await generateLeads(GROQ_API_KEY, query, industry, location, cap - leads.length);
          const newLeads = aiLeads
            .filter(l => !existingNames.has(l.company_name.toLowerCase().trim()))
            .map(l => ({ ...l, confidence: "low" as const, source: "AI fill — web found fewer results" }));
          leads = [...leads, ...newLeads];
        } catch { /* best effort */ }
      }
    }

    return NextResponse.json({ success: true, leads, count: leads.length, mode });
  } catch (err: any) {
    console.error("[Leads Generation API]", err.message);
    return NextResponse.json({ success: false, error: err.message ?? "Internal Server Error" }, { status: 500 });
  }
}
