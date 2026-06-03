/**
 * /api/ai/search
 *
 * Uses Playwright (headless Chromium) to search the web and return
 * structured results for AI context injection.
 *
 * POST { query: string, mode: "research" | "deep_research", maxPages?: number }
 *
 * Returns:
 *   { results: { url, title, snippet, content }[], query, mode }
 *
 * SETUP: npm install playwright && npx playwright install chromium
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic     = "force-dynamic";
export const maxDuration = 60; // Playwright can take time

type SearchResult = {
  url:     string;
  title:   string;
  snippet: string;
  content: string;
};

/** DuckDuckGo HTML search — no API key needed */
async function duckDuckGoSearch(query: string): Promise<{ url: string; title: string; snippet: string }[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res  = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(8000),
  });
  const html = await res.text();

  // Parse results from DuckDuckGo HTML
  const results: { url: string; title: string; snippet: string }[] = [];
  const linkRe    = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([^<]+)<\/a>/g;

  const links:    string[] = [];
  const titles:   string[] = [];
  const snippets: string[] = [];

  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null)    { links.push(m[1]); titles.push(m[2]); }
  while ((m = snippetRe.exec(html)) !== null) { snippets.push(m[1]); }

  for (let i = 0; i < Math.min(links.length, 8); i++) {
    results.push({
      url:     links[i],
      title:   titles[i]?.replace(/&amp;/g, "&").replace(/&lt;/g, "<") ?? "",
      snippet: snippets[i]?.replace(/&amp;/g, "&").replace(/&lt;/g, "<") ?? "",
    });
  }
  return results;
}

/** Fetch and extract readable text from a URL using Playwright */
async function fetchPageWithPlaywright(url: string): Promise<string> {
  let browser: any;
  try {
    // Dynamic import so the app still works without Playwright installed
    const { chromium } = await import("playwright").catch(() => {
      throw new Error("Playwright not installed. Run: npm install playwright && npx playwright install chromium");
    });

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)" });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Extract main content — try common content selectors first
    const content = await page.evaluate(() => {
      // Remove noise
      ["script", "style", "nav", "footer", "header", "aside", ".ad", "#cookie"].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });

      // Try main content areas
      const selectors = ["article", "main", ".content", ".post", "#content", "body"];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = (el as HTMLElement).innerText;
          if (text && text.length > 200) return text.slice(0, 4000);
        }
      }
      return document.body.innerText.slice(0, 4000);
    });

    return content ?? "";
  } catch (e: any) {
    return `[Failed to load: ${e.message}]`;
  } finally {
    await browser?.close();
  }
}

/** Fallback: simple fetch + regex text extraction (no Playwright) */
async function fetchPageSimple(url: string): Promise<string> {
  try {
    const res  = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    // Strip tags and get text
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 4000);
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const query:    string = String(body.query ?? "").trim();
  const mode:     string = String(body.mode  ?? "research");
  const maxPages: number = Math.min(Number(body.maxPages ?? (mode === "deep_research" ? 5 : 2)), 8);

  if (!query) return NextResponse.json({ error: "query is required." }, { status: 400 });

  try {
    // Step 1: Get search results
    const searchResults = await duckDuckGoSearch(query);
    if (searchResults.length === 0) {
      return NextResponse.json({ results: [], query, mode, message: "No search results found." });
    }

    // Step 2: Fetch page content
    const usePlaywright = mode === "research" || mode === "deep_research";
    const toFetch = searchResults.slice(0, maxPages);

    const results: SearchResult[] = await Promise.all(
      toFetch.map(async (r) => {
        let content = "";
        if (usePlaywright) {
          try {
            content = await fetchPageWithPlaywright(r.url);
          } catch {
            content = await fetchPageSimple(r.url);
          }
        }
        return { ...r, content };
      }),
    );

    // Step 3: For deep_research, also search for related queries
    if (mode === "deep_research") {
      const relatedQueries = [
        `${query} tutorial`,
        `${query} best practices`,
        `${query} examples`,
      ];
      for (const rq of relatedQueries.slice(0, 2)) {
        try {
          const extra = await duckDuckGoSearch(rq);
          const top   = extra[0];
          if (top && !results.find(r => r.url === top.url)) {
            const content = await fetchPageWithPlaywright(top.url).catch(() => fetchPageSimple(top.url));
            results.push({ ...top, content });
          }
        } catch { /* skip */ }
      }
    }

    return NextResponse.json({ results, query, mode, totalPages: results.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
