import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { applicantName, jobTitle, examScore, examPoints, examTotal, answers } = await req.json();

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error("GROQ_API_KEY not set");

    const correctCount = answers?.filter((a: any) => a.isCorrect === true).length ?? 0;
    const wrongCount   = answers?.filter((a: any) => a.isCorrect === false).length ?? 0;
    const reviewCount  = answers?.filter((a: any) => a.isCorrect === null).length ?? 0;
    const rating       = examScore >= 80 ? "High Potential" : examScore >= 60 ? "Medium Potential" : "Needs Improvement";

    const prompt = `You are an HR specialist writing a professional performance remark for a job applicant.

Applicant: ${applicantName}
Position applied: ${jobTitle}
Exam score: ${examScore}% (${examPoints}/${examTotal} points)
Correct answers: ${correctCount}
Wrong answers: ${wrongCount}
Short answers pending review: ${reviewCount}
Overall rating: ${rating}

Write a 2-3 sentence professional performance remark that:
1. Acknowledges their exam performance honestly
2. Highlights their potential based on the score
3. Mentions they are being considered for the final interview

Keep it professional, encouraging, and specific to the score. Do not use generic phrases.
Return ONLY the remark text, no labels or formatting.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        messages:    [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens:  256,
      }),
    });

    if (!res.ok) throw new Error(`Groq failed: ${res.status}`);
    const data    = await res.json();
    const remarks = data.choices?.[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ success: true, remarks });
  } catch (err: any) {
    console.error("[Candidate Remarks]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
