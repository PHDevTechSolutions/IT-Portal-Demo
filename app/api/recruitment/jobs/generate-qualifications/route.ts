import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { title, category, jobType } = await req.json();

    if (!title?.trim()) {
      return NextResponse.json({ success: false, error: "Job title is required" }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error("GROQ_API_KEY not set");

    const prompt = `You are an HR specialist for a Philippine company. Generate a list of 8-12 realistic job qualifications for the following position:

Job Title: ${title}
${category ? `Category: ${category}` : ""}
${jobType ? `Employment Type: ${jobType}` : ""}

Requirements:
- Each qualification should be specific and relevant to the role
- Include a mix of: education, experience, skills, and personal attributes
- Use Philippine context where relevant (e.g., PRC license for licensed professions)
- Keep each item concise (1-2 sentences max)
- Do NOT number them

Return ONLY a valid JSON array of strings. No markdown, no explanation.
Example: ["Bachelor's degree in...", "At least 2 years of experience in...", "Proficient in..."]`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        messages:    [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens:  1024,
      }),
    });

    if (!res.ok) throw new Error(`Groq failed: ${res.status}`);
    const data    = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() ?? "[]";

    // Parse safely
    const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    let qualifications: string[] = [];
    try {
      const arr = JSON.parse(cleaned);
      qualifications = Array.isArray(arr) ? arr.filter((q: any) => typeof q === "string" && q.trim()) : [];
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const arr = JSON.parse(match[0]);
          qualifications = Array.isArray(arr) ? arr.filter((q: any) => typeof q === "string") : [];
        } catch {}
      }
    }

    if (qualifications.length === 0) throw new Error("Failed to generate qualifications");

    return NextResponse.json({ success: true, qualifications });
  } catch (err: any) {
    console.error("[Generate Qualifications]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
