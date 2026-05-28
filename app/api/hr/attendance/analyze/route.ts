import { NextRequest, NextResponse } from "next/server";
import { getGroqKey } from "@/lib/ai/getGroqKey";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const GROQ_API_KEY = await getGroqKey();
    const { records } = await req.json();
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ success: false, error: "No records provided" }, { status: 400 });
    }

    const summary = {
      total: records.length,
      byType: records.reduce<Record<string,number>>((a,r) => {
        const t = (r.Type ?? "unknown").toLowerCase(); a[t] = (a[t]??0)+1; return a;
      }, {}),
      byStatus: records.reduce<Record<string,number>>((a,r) => {
        const s = (r.Status ?? "unknown").toLowerCase(); a[s] = (a[s]??0)+1; return a;
      }, {}),
      byEmployee: (() => {
        const m: Record<string,number> = {};
        records.forEach(r => { const k = r.ReferenceID ?? "unknown"; m[k] = (m[k]??0)+1; });
        return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id,count])=>({id,count}));
      })(),
      byLocation: records.reduce<Record<string,number>>((a,r) => {
        const l = r.Location ?? "unknown"; a[l] = (a[l]??0)+1; return a;
      }, {}),
      failedCount: records.filter(r => ["failed","inactive"].includes((r.Status??"").toLowerCase())).length,
      siteVisits:  records.filter(r => (r.Type??"").toLowerCase() === "site-visit").length,
      clientVisits:records.filter(r => (r.Type??"").toLowerCase() === "client-visit").length,
      // Date range of the data
      dateRange: (() => {
        const dates = records.map(r => r.date_created).filter(Boolean).sort();
        return { from: dates[0] ?? null, to: dates[dates.length-1] ?? null };
      })(),
    };

    const prompt = `You are an HR operations analyst. Analyze the following employee attendance/activity log data and provide actionable insights.

Data Summary:
${JSON.stringify(summary, null, 2)}

Provide a structured analysis in this exact JSON format:
{
  "overview": "2-3 sentence executive summary of attendance patterns",
  "problems": [
    { "title": "Problem title", "description": "Detailed description with numbers", "severity": "critical|high|medium|low", "count": number }
  ],
  "patterns": [
    { "title": "Pattern title", "description": "What pattern was observed and what it means for HR" }
  ],
  "recommendations": [
    { "title": "Action title", "description": "Specific actionable recommendation for HR management", "priority": "immediate|short-term|long-term" }
  ],
  "metrics": {
    "attendanceRate": "percentage of active/success records",
    "failureRate": "percentage of failed/inactive records",
    "topEmployee": "employee ID with most activity",
    "topLocation": "most common location",
    "mostCommonActivity": "most frequent activity type"
  }
}

Rules:
- Reference actual numbers from the data
- Problems: high failure rate, employees with no time-out, unusual patterns
- Patterns: peak activity times, location clusters, employee behavior trends
- Recommendations: actionable for HR (e.g. follow up on failed check-ins, investigate locations)
- Return ONLY valid JSON, no markdown`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2, max_tokens: 2048,
      }),
    });

    if (!res.ok) throw new Error(`Groq failed (${res.status})`);

    const data    = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();

    let analysis;
    try { analysis = JSON.parse(cleaned); }
    catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      analysis = m ? JSON.parse(m[0]) : { overview:"Analysis unavailable", problems:[], patterns:[], recommendations:[], metrics:{} };
    }

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error("[Attendance Analyze]", err.message);
    return NextResponse.json({ success: false, error: err.message ?? "Analysis failed" }, { status: 500 });
  }
}
