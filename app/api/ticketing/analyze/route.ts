import { NextRequest, NextResponse } from "next/server";
import { getGroqKey } from "@/lib/ai/getGroqKey";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const GROQ_API_KEY = await getGroqKey();
    const { tickets } = await req.json();

    if (!Array.isArray(tickets) || tickets.length === 0) {
      return NextResponse.json({ success: false, error: "No tickets provided" }, { status: 400 });
    }

    // Build a compact summary for Groq (avoid sending full raw data)
    const summary = {
      total: tickets.length,
      byStatus: tickets.reduce<Record<string, number>>((acc, t) => {
        const s = (t.status ?? "unknown").toLowerCase();
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, {}),
      byPriority: tickets.reduce<Record<string, number>>((acc, t) => {
        const p = (t.priority ?? "unknown").toLowerCase();
        acc[p] = (acc[p] ?? 0) + 1;
        return acc;
      }, {}),
      byDepartment: tickets.reduce<Record<string, number>>((acc, t) => {
        const d = t.department ?? "unknown";
        acc[d] = (acc[d] ?? 0) + 1;
        return acc;
      }, {}),
      byRequestType: tickets.reduce<Record<string, number>>((acc, t) => {
        const r = t.request_type ?? "unknown";
        acc[r] = (acc[r] ?? 0) + 1;
        return acc;
      }, {}),
      byTechnician: tickets.reduce<Record<string, number>>((acc, t) => {
        const tech = t.technician_name ?? "unassigned";
        acc[tech] = (acc[tech] ?? 0) + 1;
        return acc;
      }, {}),
      // Sample of recent ticket subjects for context
      recentSubjects: tickets
        .slice(0, 20)
        .map(t => t.ticket_subject)
        .filter(Boolean),
      // Unresolved critical/high tickets
      urgentOpen: tickets.filter(t =>
        ["open","in-progress","pending"].includes((t.status ?? "").toLowerCase()) &&
        ["critical","high"].includes((t.priority ?? "").toLowerCase())
      ).length,
    };

    const prompt = `You are an IT support operations analyst. Analyze the following IT helpdesk ticket data and provide actionable insights.

Ticket Data Summary:
${JSON.stringify(summary, null, 2)}

Provide a structured analysis in the following JSON format:
{
  "overview": "2-3 sentence executive summary of the current ticket situation",
  "problems": [
    { "title": "Problem title", "description": "Detailed description", "severity": "critical|high|medium|low", "count": number }
  ],
  "patterns": [
    { "title": "Pattern title", "description": "What pattern was observed and what it means" }
  ],
  "recommendations": [
    { "title": "Action title", "description": "Specific actionable recommendation", "priority": "immediate|short-term|long-term" }
  ],
  "metrics": {
    "resolutionRate": "percentage of resolved+closed tickets",
    "criticalBacklog": "number of critical/high open tickets",
    "topDepartment": "department with most tickets",
    "topRequestType": "most common request type",
    "busiestTechnician": "technician with most assigned tickets"
  }
}

Rules:
- Be specific and data-driven, reference actual numbers from the data
- Problems should be real issues visible in the data (e.g. high backlog, unassigned tickets, critical tickets open too long)
- Patterns should identify trends (e.g. one department generates 40% of tickets)
- Recommendations should be actionable for an IT manager
- Return ONLY valid JSON, no markdown, no explanation`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq failed (${res.status}): ${err.slice(0, 200)}`);
    }

    const data    = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      analysis = match ? JSON.parse(match[0]) : { overview: "Analysis unavailable", problems: [], patterns: [], recommendations: [], metrics: {} };
    }

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error("[Ticket Analyze]", err.message);
    return NextResponse.json({ success: false, error: err.message ?? "Analysis failed" }, { status: 500 });
  }
}
