import { NextRequest, NextResponse } from "next/server";
import { getGroqKey } from "@/lib/ai/getGroqKey";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const GROQ_API_KEY = await getGroqKey();
    const body = await req.json();

    // Accept either a pre-computed summary object OR a raw customers array
    let summary: any;
    if (Array.isArray(body.customers)) {
      // Legacy: raw array — compute summary server-side
      const customers = body.customers;
      if (customers.length === 0) {
        return NextResponse.json({ success: false, error: "No customers provided" }, { status: 400 });
      }
      summary = {
        total: customers.length,
        byStatus:     customers.reduce((a: Record<string,number>, c: any) => { const s=(c.status??"unknown").toLowerCase(); a[s]=(a[s]??0)+1; return a; }, {} as Record<string,number>),
        byTypeClient: customers.reduce((a: Record<string,number>, c: any) => { const t=c.type_client??"unknown"; a[t]=(a[t]??0)+1; return a; }, {} as Record<string,number>),
        byRegion:     customers.reduce((a: Record<string,number>, c: any) => { const r=c.region??"unknown"; a[r]=(a[r]??0)+1; return a; }, {} as Record<string,number>),
        byIndustry:   customers.reduce((a: Record<string,number>, c: any) => { const i=c.industry??"unknown"; a[i]=(a[i]??0)+1; return a; }, {} as Record<string,number>),
        topTSAs: (() => { const m: Record<string,number>={}; customers.forEach((c:any)=>{ const k=c.referenceid??"unassigned"; m[k]=(m[k]??0)+1; }); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id,count])=>({id,count})); })(),
        missingEmail:   customers.filter((c:any)=>!c.email_address?.trim()).length,
        missingContact: customers.filter((c:any)=>!c.contact_number?.trim()).length,
        missingType:    customers.filter((c:any)=>!c.type_client?.trim()).length,
        missingStatus:  customers.filter((c:any)=>!c.status?.trim()).length,
        unassigned:     customers.filter((c:any)=>!c.referenceid?.trim()).length,
        duplicateCompanies: (() => { const m: Record<string,number>={}; customers.forEach((c:any)=>{ const k=(c.company_name??"").toLowerCase().trim(); if(k) m[k]=(m[k]??0)+1; }); return Object.values(m).filter(v=>v>1).length; })(),
        parkedCount:    customers.filter((c:any)=>(c.status??"").toLowerCase()==="park").length,
        activeCount:    customers.filter((c:any)=>(c.status??"").toLowerCase()==="active").length,
        forDeletion:    customers.filter((c:any)=>["for deletion","remove"].includes((c.status??"").toLowerCase())).length,
      };
    } else if (body.customers && typeof body.customers === "object") {
      // Pre-computed summary from client
      summary = body.customers;
      if (!summary.total) {
        return NextResponse.json({ success: false, error: "No customers provided" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    const prompt = `You are a CRM and sales operations analyst. Analyze the following customer database data and provide actionable insights for a Philippine sales team.

Data Summary:
${JSON.stringify(summary, null, 2)}

Provide a structured analysis in this exact JSON format:
{
  "overview": "2-3 sentence executive summary of the customer database health and key findings",
  "problems": [
    { "title": "Problem title", "description": "Detailed description with specific numbers", "severity": "critical|high|medium|low", "count": number }
  ],
  "patterns": [
    { "title": "Pattern title", "description": "What pattern was observed and what it means for sales" }
  ],
  "recommendations": [
    { "title": "Action title", "description": "Specific actionable recommendation for the sales/CRM team", "priority": "immediate|short-term|long-term" }
  ],
  "metrics": {
    "dataQualityScore": "percentage of complete records",
    "activeRate": "percentage of active customers",
    "topRegion": "region with most customers",
    "topIndustry": "most common industry",
    "topClientType": "most common client type",
    "duplicateRisk": "number of potential duplicate companies"
  }
}

Rules:
- Reference actual numbers from the data
- Problems: missing data fields, duplicates, unassigned customers, high park/deletion rates
- Patterns: regional concentration, industry trends, TSA workload distribution
- Recommendations: data cleanup actions, sales focus areas, assignment optimization
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
      // Try to extract the largest valid JSON object from the response
      let best: any = null;
      const matches = cleaned.match(/\{[\s\S]*?\}/g) ?? [];
      for (const m of matches) {
        try {
          const parsed = JSON.parse(m);
          if (parsed.overview || parsed.problems) { best = parsed; break; }
        } catch {}
      }
      // Last resort: find outermost { ... }
      if (!best) {
        const start = cleaned.indexOf("{");
        const end   = cleaned.lastIndexOf("}");
        if (start !== -1 && end > start) {
          try { best = JSON.parse(cleaned.slice(start, end + 1)); } catch {}
        }
      }
      analysis = best ?? { overview:"Analysis unavailable — response was malformed.", problems:[], patterns:[], recommendations:[], metrics:{} };
    }

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error("[Customer DB Analyze]", err.message);
    return NextResponse.json({ success: false, error: err.message ?? "Analysis failed" }, { status: 500 });
  }
}
