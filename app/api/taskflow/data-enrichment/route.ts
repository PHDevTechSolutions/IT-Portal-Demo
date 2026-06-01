/**
 * POST /api/taskflow/data-enrichment
 *
 * Scrapes BusinessList.ph → Yellow Pages PH → Google for each company.
 * Streams NDJSON progress back to the client.
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrichedFields {
  contact_person: string;
  contact_number: string;
  email_address:  string;
  address:        string;
  website:        string;
  source_url:     string;
}

interface CustomerInput {
  id:           number;
  company_name: string;
  address?:     string;
}

// ─── DB ───────────────────────────────────────────────────────────────────────

function getNeon() {
  const url = process.env.TASKFLOW_DB_URL;
  if (!url) throw new Error("TASKFLOW_DB_URL is not set.");
  return neon(url);
}

async function saveEnriched(id: number, e: EnrichedFields) {
  const sql = getNeon();
  await sql`
    UPDATE accounts SET
      contact_person = CASE WHEN ${e.contact_person} <> '' THEN ${e.contact_person} ELSE contact_person END,
      contact_number = CASE WHEN ${e.contact_number} <> '' THEN ${e.contact_number} ELSE contact_number END,
      email_address  = CASE WHEN ${e.email_address}  <> '' THEN ${e.email_address}  ELSE email_address  END,
      address        = CASE WHEN ${e.address}        <> '' THEN ${e.address}        ELSE address        END,
      date_updated   = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE id = ${id}
  `;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert company name to a URL-friendly slug */
function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Extract contact data from the current page */
async function extractFromPage(page: any) {
  return page.evaluate(() => {
    const text = (document.body?.innerText ?? "").slice(0, 8000);

    // Email — prefer mailto links
    const emailEl = document.querySelector("a[href^='mailto:']") as HTMLAnchorElement | null;
    const email   = emailEl?.href?.replace("mailto:", "").split("?")[0].trim()
      ?? (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [])
           .find(e => !/(example|noreply|test|no-reply|donotreply|@gmail\.com$|@yahoo\.com$)/i.test(e))
      ?? "";

    // Phone — prefer tel links
    const telEl = document.querySelector("a[href^='tel:']") as HTMLAnchorElement | null;
    const phone  = telEl?.href?.replace("tel:", "").replace(/\s/g, "").trim()
      ?? text.match(/(\+63[\d\s\-]{9,12}|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10}|[\d]{3,4}[-\s][\d]{4})/)?.[0]?.trim()
      ?? "";

    // Contact person
    const cpMatch = text.match(
      /(?:Manager|Owner|Contact Person|Director|President|CEO|COO|VP|Head)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/
    );
    const contactPerson = cpMatch?.[1]?.trim() ?? "";

    // Address
    const addrMatch = text.match(
      /\d+\s+[A-Z][a-z]+.*?(?:Street|St\.|Avenue|Ave\.|Road|Rd\.|Blvd|Drive|Dr\.|Building|Bldg\.)[^,\n]*/i
    );
    const address = addrMatch?.[0]?.trim() ?? "";

    // Website (exclude directory sites)
    const websiteEl = document.querySelector(
      "a[href^='http']:not([href*='businesslist']):not([href*='yellowpages']):not([href*='google']):not([href*='facebook'])"
    ) as HTMLAnchorElement | null;
    const website = websiteEl?.href ?? "";

    return { email, phone, contactPerson, address, website };
  });
}

// ─── Main scraper ─────────────────────────────────────────────────────────────

async function scrapeCompany(
  companyName: string,
  existingAddress: string,
): Promise<EnrichedFields & { log: string[] }> {
  const { chromium } = await import("playwright");

  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(`[Enrich] ${msg}`); };

  const result: EnrichedFields & { log: string[] } = {
    contact_person: "",
    contact_number: "",
    email_address:  "",
    address:        existingAddress ?? "",
    website:        "",
    source_url:     "",
    log:            logs,
  };

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale:    "en-PH",
    extraHTTPHeaders: { "Accept-Language": "en-PH,en;q=0.9" },
  });
  const page = await ctx.newPage();

  const filled = () => !!(result.email_address || result.contact_number);

  try {
    // ── 1. BusinessList.ph — try slug URL first, then search ─────────────────
    const slug   = toSlug(companyName);
    const blUrls = [
      `https://www.businesslist.ph/company/${slug}`,
      `https://www.businesslist.ph/search?q=${encodeURIComponent(companyName)}`,
    ];

    for (const blUrl of blUrls) {
      if (filled()) break;
      log(`Trying BusinessList.ph → ${blUrl}`);
      try {
        await page.goto(blUrl, { waitUntil: "domcontentloaded", timeout: 18000 });

        // If it's the search page, find the first profile link and navigate to it
        const isSearch = blUrl.includes("/search");
        if (isSearch) {
          const profileHref = await page.evaluate(() => {
            const a = document.querySelector(
              "h3 a[href*='/company/'], .company-name a, a[href*='/company/']"
            ) as HTMLAnchorElement | null;
            return a?.getAttribute("href") ?? "";
          });
          if (!profileHref) { log("  ✗ No profile link found in search results"); continue; }
          const profileUrl = profileHref.startsWith("http")
            ? profileHref
            : `https://www.businesslist.ph${profileHref}`;
          log(`  → Profile: ${profileUrl}`);
          await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
          result.source_url = profileUrl;
        } else {
          result.source_url = blUrl;
        }

        const data = await extractFromPage(page);
        if (data.email || data.phone) {
          result.contact_person = data.contactPerson;
          result.contact_number = data.phone;
          result.email_address  = data.email;
          result.address        = data.address || result.address;
          result.website        = data.website;
          log(`  ✓ Found: email=${data.email || "—"} phone=${data.phone || "—"}`);
        } else {
          log("  ✗ No contact data on this page");
        }
      } catch (e: any) {
        log(`  ✗ BusinessList failed: ${e.message.split("\n")[0]}`);
      }
    }

    // ── 2. Yellow Pages PH ───────────────────────────────────────────────────
    if (!filled()) {
      const ypUrl = `https://www.yellowpages.com.ph/search?q=${encodeURIComponent(companyName)}`;
      log(`Trying Yellow Pages PH → ${ypUrl}`);
      try {
        // Use domcontentloaded + short wait — networkidle times out too often
        await page.goto(ypUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(2000);

        const ypData = await page.evaluate(() => {
          const selectors = [
            ".listing", ".business-listing",
            "[class*='listing-item']", "[class*='business-card']",
            "article", ".result-item",
          ];
          for (const sel of selectors) {
            const items = Array.from(document.querySelectorAll(sel));
            for (const item of items) {
              const el   = item as HTMLElement;
              const text = el.innerText ?? "";
              const emailEl = el.querySelector("a[href^='mailto:']") as HTMLAnchorElement | null;
              const email   = emailEl?.href?.replace("mailto:", "").split("?")[0].trim()
                ?? text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0]
                ?? "";
              const phone = text.match(
                /(\+63[\d\s\-]{9,12}|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10})/
              )?.[0]?.trim() ?? "";
              const address = el.querySelector(
                ".address, [class*='address'], [class*='location']"
              )?.textContent?.trim() ?? "";
              if (email || phone) return { email, phone, address };
            }
          }
          // Fallback: scan full page text
          const bodyText = document.body?.innerText ?? "";
          const phone = bodyText.match(
            /(\+63[\d\s\-]{9,12}|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10})/
          )?.[0]?.trim() ?? "";
          const emailMatch = bodyText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
          const email = (emailMatch ?? []).find(
            e => !/(example|noreply|test|@gmail\.com$|@yahoo\.com$)/i.test(e)
          ) ?? "";
          return phone || email ? { email, phone, address: "" } : null;
        });

        if (ypData?.email || ypData?.phone) {
          result.contact_number = ypData.phone  || result.contact_number;
          result.email_address  = ypData.email  || result.email_address;
          result.address        = ypData.address || result.address;
          result.source_url     = ypUrl;
          log(`  ✓ Found: email=${ypData.email || "—"} phone=${ypData.phone || "—"}`);
        } else {
          log("  ✗ No data from Yellow Pages");
        }
      } catch (e: any) {
        log(`  ✗ Yellow Pages failed: ${e.message.split("\n")[0]}`);
      }
    }

    // ── 3. Serper (Google Search API) + visit top result ────────────────────
    if (!filled()) {
      const serperKey = process.env.SERPER_API_KEY;
      if (!serperKey) {
        log("  ✗ SERPER_API_KEY not set — skipping Google");
      } else {
        const gQuery = `"${companyName}" Philippines contact`;
        log(`Trying Serper → "${gQuery}"`);
        try {
          // ── 3a. Call Serper API ──────────────────────────────────────────
          const serperRes = await fetch("https://google.serper.dev/search", {
            method:  "POST",
            headers: {
              "X-API-KEY":    serperKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: gQuery, gl: "ph", hl: "en", num: 10 }),
          });

          if (!serperRes.ok) throw new Error(`Serper HTTP ${serperRes.status}`);
          const serperData = await serperRes.json();

          // ── 3b. Extract from Knowledge Graph (instant — no page visit) ──
          const kg = serperData.knowledgeGraph;
          if (kg) {
            const phone   = kg.attributes?.Phone ?? kg.attributes?.["Phone number"] ?? "";
            const address = kg.attributes?.Address ?? "";
            const website = kg.website ?? "";
            if (phone || address || website) {
              result.contact_number = phone   || result.contact_number;
              result.address        = address || result.address;
              result.website        = website || result.website;
              result.source_url     = website || "google-knowledge-graph";
              log(`  ✓ Knowledge Graph: phone=${phone || "—"} addr=${address ? "yes" : "—"} site=${website || "—"}`);
            }
          }

          // ── 3c. Extract from answerBox if present ────────────────────────
          const ab = serperData.answerBox;
          if (ab && !filled()) {
            const abText  = ab.answer ?? ab.snippet ?? "";
            const abPhone = abText.match(
              /(\+63[\d\s\-]{9,12}|0[89]\d{9}|\(\d{2,3}\)\s*[\d\s\-]{7,10})/
            )?.[0]?.trim() ?? "";
            if (abPhone) {
              result.contact_number = result.contact_number || abPhone;
              log(`  ✓ Answer Box phone: ${abPhone}`);
            }
          }

          // ── 3d. Collect organic result URLs ─────────────────────────────
          const organicUrls: string[] = (serperData.organic ?? [])
            .map((r: any) => r.link as string)
            .filter((url: string) =>
              url?.startsWith("http") &&
              !url.includes("facebook.com") &&
              !url.includes("wikipedia.org") &&
              !url.includes("twitter.com") &&
              !url.includes("instagram.com") &&
              !url.includes("linkedin.com")
            )
            .slice(0, 5);

          // Use the official website from Knowledge Graph as first priority
          if (result.website && !organicUrls.includes(result.website)) {
            organicUrls.unshift(result.website);
          }

          // ── 3e. Visit each URL with Playwright to extract contact info ───
          for (const url of organicUrls) {
            if (filled()) break;
            try {
              log(`  → Visiting: ${url}`);
              await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
              const data = await extractFromPage(page);
              if (data.email || data.phone) {
                result.contact_person = result.contact_person || data.contactPerson;
                result.contact_number = result.contact_number || data.phone;
                result.email_address  = result.email_address  || data.email;
                result.address        = result.address        || data.address;
                result.website        = result.website        || data.website || url;
                result.source_url     = url;
                log(`  ✓ Found: email=${data.email || "—"} phone=${data.phone || "—"}`);
              }

              // Also try /contact subpage if no email yet
              if (!result.email_address) {
                const contactUrl = url.replace(/\/$/, "") + "/contact";
                try {
                  await page.goto(contactUrl, { waitUntil: "domcontentloaded", timeout: 8000 });
                  const cd = await extractFromPage(page);
                  if (cd.email || cd.phone) {
                    result.contact_person = result.contact_person || cd.contactPerson;
                    result.contact_number = result.contact_number || cd.phone;
                    result.email_address  = result.email_address  || cd.email;
                    result.address        = result.address        || cd.address;
                    result.source_url     = contactUrl;
                    log(`  ✓ Found on /contact: email=${cd.email || "—"} phone=${cd.phone || "—"}`);
                  }
                } catch { /* /contact may not exist */ }
              }
            } catch { /* skip unreachable */ }
          }

          if (!filled()) log("  ✗ Nothing found via Serper + page visits");
        } catch (e: any) {
          log(`  ✗ Serper failed: ${e.message.split("\n")[0]}`);
        }
      }
    }

    // ── 4. Visit company website if found but no email yet ───────────────────
    if (result.website && !result.email_address) {
      log(`Visiting website → ${result.website}`);
      try {
        await page.goto(result.website, { waitUntil: "domcontentloaded", timeout: 12000 });
        const data = await extractFromPage(page);
        result.contact_person = result.contact_person || data.contactPerson;
        result.contact_number = result.contact_number || data.phone;
        result.email_address  = result.email_address  || data.email;
        result.address        = result.address        || data.address;
        if (data.email || data.phone) {
          log(`  ✓ Found on website: email=${data.email || "—"} phone=${data.phone || "—"}`);
        }
      } catch (e: any) {
        log(`  ✗ Website failed: ${e.message.split("\n")[0]}`);
      }
    }

  } finally {
    await browser.close();
  }

  result.log = logs;
  return result;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { customers } = (await req.json()) as { customers: CustomerInput[] };

  if (!Array.isArray(customers) || customers.length === 0) {
    return new Response(
      JSON.stringify({ error: "customers array is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream  = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      for (const customer of customers) {
        const { id, company_name, address } = customer;
        send({ id, status: "scraping", log: `Scraping: ${company_name}` });

        try {
          const enriched = await scrapeCompany(company_name, address ?? "");
          const hasData  = !!(enriched.contact_person || enriched.contact_number || enriched.email_address);

          if (hasData) await saveEnriched(id, enriched);

          send({
            id,
            status:   hasData ? "done" : "empty",
            enriched: {
              contact_person: enriched.contact_person,
              contact_number: enriched.contact_number,
              email_address:  enriched.email_address,
              address:        enriched.address,
              website:        enriched.website,
              source_url:     enriched.source_url,
            },
            log:   enriched.log,
            saved: hasData,
          });
        } catch (err: any) {
          console.error(`[Enrich] ${company_name}:`, err.message);
          send({ id, status: "error", error: err.message });
        }
      }

      send({ id: null, status: "complete" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "application/x-ndjson",
      "Cache-Control":     "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
