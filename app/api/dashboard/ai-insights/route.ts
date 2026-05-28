import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { createClient } from "@supabase/supabase-js";
import { getTaskLogCollection } from "@/lib/mongo/Collections/PantsIn";
import { getGroqKey } from "@/lib/ai/getGroqKey";

export const dynamic    = "force-dynamic";
export const maxDuration = 60;

const taskflowSql = neon(process.env.TASKFLOW_DB_URL!);

const supabaseMain = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const supabaseIT = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL_IT!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_IT!
);

// Firebase project config (client-side values, safe to use in REST API)
const FIREBASE_PROJECT_ID = "taskflow-4605f";
const FIREBASE_API_KEY    = "AIzaSyCNonSOohWCFdgL052XUFFZTH1orbP2dH4";
const FIRESTORE_BASE      = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ── Firestore REST: query a collection with optional timestamp filter ──────────
async function firestoreQuery(
  collection: string,
  orderField: string,
  dateFrom: string,
  dateTo: string,
  limit = 500
): Promise<any[]> {
  const url = `${FIRESTORE_BASE}:runQuery?key=${FIREBASE_API_KEY}`;

  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: orderField },
                op: "GREATER_THAN_OR_EQUAL",
                value: { timestampValue: new Date(dateFrom).toISOString() },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: orderField },
                op: "LESS_THAN_OR_EQUAL",
                value: { timestampValue: new Date(dateTo).toISOString() },
              },
            },
          ],
        },
      },
      orderBy: [{ field: { fieldPath: orderField }, direction: "DESCENDING" }],
      limit,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore ${collection}: ${err.slice(0, 200)}`);
  }

  const data: any[] = await res.json();
  return data
    .filter((d: any) => d.document)
    .map((d: any) => {
      const fields = d.document.fields ?? {};
      // Convert Firestore field values to plain JS
      const plain: Record<string, any> = {};
      for (const [k, v] of Object.entries(fields)) {
        const fv = v as any;
        if (fv.stringValue  !== undefined) plain[k] = fv.stringValue;
        else if (fv.integerValue !== undefined) plain[k] = Number(fv.integerValue);
        else if (fv.doubleValue  !== undefined) plain[k] = fv.doubleValue;
        else if (fv.booleanValue !== undefined) plain[k] = fv.booleanValue;
        else if (fv.timestampValue !== undefined) plain[k] = fv.timestampValue;
        else if (fv.nullValue !== undefined) plain[k] = null;
        else plain[k] = JSON.stringify(fv);
      }
      return plain;
    });
}

// ── Batch-fetch ALL rows from Supabase (handles 500k+) ────────────────────────
async function supabaseFetchAll(
  client: any,
  table: string,
  columns: string,
  filters: { column: string; gte?: string; lte?: string }[] = [],
  batchSize = 1000
): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let q = client
      .from(table)
      .select(columns)
      .range(offset, offset + batchSize - 1)
      .order("date_created", { ascending: false });

    for (const f of filters) {
      if (f.gte) q = q.gte(f.column, f.gte);
      if (f.lte) q = q.lte(f.column, f.lte);
    }

    const { data, error } = await q;
    if (error) throw new Error(`Supabase ${table}: ${error.message}`);
    if (!data || data.length === 0) { hasMore = false; break; }

    all.push(...data);
    if (data.length < batchSize) hasMore = false;
    else offset += batchSize;
  }

  return all;
}

// ── Collect data with optional date range ─────────────────────────────────────
async function collectData(dateFrom: string, dateTo: string) {
  const dateFilters = [{ column: "date_created", gte: dateFrom, lte: dateTo }];
  // Full ISO range for Firebase and MongoDB
  const isoFrom = `${dateFrom}T00:00:00.000Z`;
  const isoTo   = `${dateTo}T23:59:59.999Z`;

  const results = await Promise.allSettled([

    // 1. IT Tickets (Supabase IT) — batch all
    (async () => {
      const tickets = await supabaseFetchAll(
        supabaseIT, "tickets",
        "status, priority, department, request_type, date_created",
        dateFilters
      );

      const byStatus:   Record<string,number> = {};
      const byPriority: Record<string,number> = {};
      const byDept:     Record<string,number> = {};
      const byType:     Record<string,number> = {};

      for (const t of tickets) {
        const s = (t.status    ?? "unknown").toLowerCase(); byStatus[s]   = (byStatus[s]??0)+1;
        const p = (t.priority  ?? "unknown").toLowerCase(); byPriority[p] = (byPriority[p]??0)+1;
        const d = t.department  ?? "unknown";               byDept[d]     = (byDept[d]??0)+1;
        const r = t.request_type ?? "unknown";              byType[r]     = (byType[r]??0)+1;
      }

      return {
        source: "IT Helpdesk Tickets",
        total: tickets.length,
        byStatus, byPriority,
        topDepartments:  Object.entries(byDept).sort((a,b)=>b[1]-a[1]).slice(0,5),
        topRequestTypes: Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,5),
        openCritical: tickets.filter((t: any) =>
          ["open","in-progress","pending"].includes((t.status??"").toLowerCase()) &&
          ["critical","high"].includes((t.priority??"").toLowerCase())
        ).length,
      };
    })(),

    // 2. Sales History (Main Supabase) — batch all
    (async () => {
      const rows = await supabaseFetchAll(
        supabaseMain, "history",
        "referenceid, company_name, actual_sales, quotation_amount, product_title, so_amount, date_created",
        dateFilters
      );

      const byRep: Record<string, { count:number; totalActual:number; totalSO:number }> = {};
      let totalActualSales = 0, totalSOAmount = 0, totalQuotation = 0;
      const productCounts: Record<string,number> = {};

      for (const r of rows) {
        const rep = (r as any).referenceid ?? "unknown";
        if (!byRep[rep]) byRep[rep] = { count:0, totalActual:0, totalSO:0 };
        byRep[rep].count++;
        byRep[rep].totalActual += Number((r as any).actual_sales    ?? 0);
        byRep[rep].totalSO     += Number((r as any).so_amount       ?? 0);
        totalActualSales += Number((r as any).actual_sales    ?? 0);
        totalSOAmount    += Number((r as any).so_amount        ?? 0);
        totalQuotation   += Number((r as any).quotation_amount ?? 0);
        const pt = (r as any).product_title;
        if (pt) productCounts[pt] = (productCounts[pt]??0)+1;
      }

      const fmt = (n: number) =>
        `₱${n.toLocaleString("en-PH", { minimumFractionDigits:0, maximumFractionDigits:0 })}`;

      return {
        source: "Sales Activity History",
        total: rows.length,
        uniqueReps: Object.keys(byRep).length,
        totalActualSales: fmt(totalActualSales),
        totalSOAmount:    fmt(totalSOAmount),
        totalQuotation:   fmt(totalQuotation),
        conversionRate:   totalQuotation > 0
          ? `${((totalActualSales/totalQuotation)*100).toFixed(1)}%`
          : "N/A",
        topReps: Object.entries(byRep)
          .sort((a,b) => b[1].totalActual - a[1].totalActual)
          .slice(0,5)
          .map(([id, d]) => ({ id, count:d.count, actualSales:fmt(d.totalActual), soAmount:fmt(d.totalSO) })),
        topProducts: Object.entries(productCounts)
          .sort((a,b) => b[1]-a[1]).slice(0,5)
          .map(([name, count]) => ({ name, count })),
      };
    })(),

    // 3. Customer Database (Taskflow Neon/Postgres) — date-filtered
    (async () => {
      const rows = await taskflowSql`
        SELECT status, type_client, region, referenceid, date_created
        FROM accounts
        WHERE date_created >= ${dateFrom}
          AND date_created <= ${dateTo}
        LIMIT 5000
      `;

      const byStatus: Record<string,number> = {};
      const byType:   Record<string,number> = {};
      const byRegion: Record<string,number> = {};

      for (const c of rows) {
        const s = (c.status     ?? "unknown").toLowerCase(); byStatus[s] = (byStatus[s]??0)+1;
        const t = c.type_client ?? "unknown";                byType[t]   = (byType[t]??0)+1;
        const r = c.region      ?? "unknown";                byRegion[r] = (byRegion[r]??0)+1;
      }

      return {
        source: "Customer Database (Taskflow)",
        total: rows.length,
        byStatus, byType,
        topRegions:  Object.entries(byRegion).sort((a,b)=>b[1]-a[1]).slice(0,5),
        activeCount: rows.filter(c => (c.status??"").toLowerCase() === "active").length,
        parkedCount: rows.filter(c => (c.status??"").toLowerCase() === "park").length,
        forDeletion: rows.filter(c => ["for deletion","remove"].includes((c.status??"").toLowerCase())).length,
      };
    })(),

    // 4. HR Attendance (MongoDB) — date-filtered
    (async () => {
      const col = await getTaskLogCollection();
      const filter: any = {
        archived: { $ne: true },
        date_created: { $gte: new Date(isoFrom), $lte: new Date(isoTo) },
      };
      const records = await col.find(filter).toArray();

      const byType:   Record<string,number> = {};
      const byStatus: Record<string,number> = {};
      const byEmp:    Record<string,number> = {};

      for (const r of records) {
        const t = (r.Type   ?? "unknown").toLowerCase(); byType[t]   = (byType[t]??0)+1;
        const s = (r.Status ?? "unknown").toLowerCase(); byStatus[s] = (byStatus[s]??0)+1;
        const e = r.ReferenceID ?? "unknown";            byEmp[e]    = (byEmp[e]??0)+1;
      }

      return {
        source: "HR Attendance & Activity",
        total: records.length,
        byType, byStatus,
        uniqueEmployees: Object.keys(byEmp).length,
        failedCheckins: records.filter(r => ["failed","inactive"].includes((r.Status??"").toLowerCase())).length,
        topEmployees: Object.entries(byEmp).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,count])=>({id,count})),
      };
    })(),

    // 5. System Audits (Firebase Firestore — systemAudits + taskflow_customer_audit_logs)
    (async () => {
      const [sysAudits, custAudits, actLogs] = await Promise.allSettled([
        firestoreQuery("systemAudits",                  "timestamp",    isoFrom, isoTo, 300),
        firestoreQuery("taskflow_customer_audit_logs",  "timestamp",    isoFrom, isoTo, 300),
        firestoreQuery("activity_logs",                 "date_created", isoFrom, isoTo, 300),
      ]);

      const sys  = sysAudits.status  === "fulfilled" ? sysAudits.value  : [];
      const cust = custAudits.status === "fulfilled" ? custAudits.value : [];
      const act  = actLogs.status    === "fulfilled" ? actLogs.value    : [];

      const byAction: Record<string,number> = {};
      for (const a of [...sys, ...cust]) {
        const k = a.action ?? "unknown"; byAction[k] = (byAction[k]??0)+1;
      }

      const loginCount  = act.filter(a => (a.action ?? a.status ?? "").toLowerCase() === "login").length;
      const logoutCount = act.filter(a => (a.action ?? a.status ?? "").toLowerCase() === "logout").length;
      const transferCount = [...cust, ...act].filter(a => (a.action ?? a.status ?? "").toLowerCase() === "transfer").length;

      return {
        source: "Audit Logs (Firebase)",
        systemAuditsTotal: sys.length,
        customerAuditsTotal: cust.length,
        activityLogsTotal: act.length,
        byAction,
        loginCount,
        logoutCount,
        transferCount,
        recentActions: sys.slice(0,5).map(a => ({
          action: a.action ?? "unknown",
          actor:  a.actorName ?? a.actorEmail ?? "unknown",
          module: a.module ?? "—",
        })),
      };
    })(),
  ]);

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    console.error(`[AI Dashboard] Source ${i} failed:`, (r as PromiseRejectedResult).reason?.message);
    return null;
  }).filter(Boolean);
}

// ── Groq analysis ─────────────────────────────────────────────────────────────
async function analyzeWithGroq(data: any[], dateFrom: string, dateTo: string): Promise<any> {
  const GROQ_API_KEY = await getGroqKey();
  const prompt = `You are an AI business intelligence analyst for Ecoshift Corporation (Philippine electrical supply and distribution company). Analyze the following multi-source ERP data for the period ${dateFrom} to ${dateTo} and generate a comprehensive executive dashboard report.

Data from all systems:
${JSON.stringify(data, null, 2)}

Generate a JSON report with this exact structure:
{
  "executiveSummary": "3-4 sentence high-level summary of the overall business/IT health for this period",
  "overallHealthScore": number between 0-100,
  "healthLabel": "Excellent|Good|Fair|Needs Attention|Critical",
  "kpis": [
    { "label": "KPI name", "value": "formatted value", "trend": "up|down|stable", "status": "good|warning|critical", "description": "brief context" }
  ],
  "insights": [
    { "category": "IT Operations|HR|Sales|Security|Performance", "title": "Insight title", "detail": "Detailed finding with numbers", "severity": "info|warning|critical" }
  ],
  "strategies": [
    { "title": "Strategy title", "description": "Actionable recommendation", "impact": "high|medium|low", "timeframe": "immediate|this-week|this-month|long-term", "department": "IT|HR|Sales|Management" }
  ],
  "auditFindings": [
    { "finding": "Audit finding description", "risk": "high|medium|low", "recommendation": "What to do about it" }
  ],
  "performanceMetrics": {
    "itSupport":      { "score": number, "label": "description" },
    "hrCompliance":   { "score": number, "label": "description" },
    "salesHealth":    { "score": number, "label": "description" },
    "systemSecurity": { "score": number, "label": "description" }
  },
  "alerts": [
    { "message": "Alert message", "severity": "critical|warning|info", "source": "system name" }
  ]
}

Rules:
- Reference actual numbers and peso amounts from the data
- KPIs: 5-7 items covering tickets, sales, attendance, customers
- Insights: 4-6 actionable findings
- Strategies: 3-5 prioritized recommendations
- Return ONLY valid JSON, no markdown`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 3000,
    }),
  });

  if (!res.ok) throw new Error(`Groq failed (${res.status})`);

  const groqData = await res.json();
  const content  = groqData.choices?.[0]?.message?.content ?? "{}";
  const cleaned  = content.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();

  try { return JSON.parse(cleaned); }
  catch {
    const start = cleaned.indexOf("{");
    const end   = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end+1)); } catch {}
    }
    throw new Error("Groq returned malformed JSON");
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    // Default: today (PH timezone)
    const todayPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const todayStr = todayPH.toISOString().split("T")[0];

    const dateFrom = searchParams.get("dateFrom") ?? todayStr;
    const dateTo   = searchParams.get("dateTo")   ?? todayStr;

    const data     = await collectData(dateFrom, dateTo);
    const analysis = await analyzeWithGroq(data, dateFrom, dateTo);

    return NextResponse.json({
      success: true,
      analysis,
      sources: data.length,
      dateFrom,
      dateTo,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[AI Dashboard]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
