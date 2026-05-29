import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const FALLBACK_CONFIG = {
  apiKey:            "AIzaSyCNonSOohWCFdgL052XUFFZTH1orbP2dH4",
  authDomain:        "taskflow-4605f.firebaseapp.com",
  projectId:         "taskflow-4605f",
  storageBucket:     "taskflow-4605f.firebasestorage.app",
  messagingSenderId: "558742255762",
  appId:             "1:558742255762:web:5725b5c26f1c6fae9e8e4b",
};

async function getFirebaseDB() {
  const { data: creds } = await supabase
    .from("recruitment_credentials")
    .select("*").eq("is_active", true)
    .order("updated_at", { ascending: false }).limit(1).single();
  const config = !creds ? FALLBACK_CONFIG : {
    apiKey: creds.api_key, authDomain: creds.auth_domain,
    projectId: creds.project_id, storageBucket: creds.storage_bucket || "",
    messagingSenderId: creds.messaging_sender_id || "", appId: creds.app_id || "",
  };
  const appName = `recruitment-${config.projectId}`;
  const app = getApps().find(a => a.name === appName) ?? initializeApp(config, appName);
  return { db: getFirestore(app) };
}

export interface ExamQuestion {
  id:       number;
  type:     "multiple_choice" | "true_false" | "short_answer";
  question: string;
  choices?: string[];   // for multiple_choice
  answer:   string;     // correct answer (hidden from applicant)
  points:   number;
}

async function generateQuestions(jobTitle: string, qualifications: string[]): Promise<ExamQuestion[]> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY not set");

  const qualText = qualifications.length > 0
    ? `\nJob qualifications: ${qualifications.join(", ")}`
    : "";

  const prompt = `You are an HR exam specialist. Generate a 15-question pre-employment exam for the position: "${jobTitle}".${qualText}

Create a mix of:
- 8 multiple choice questions (4 options each, label A/B/C/D)
- 4 true/false questions
- 3 short answer questions

Questions should test:
- Relevant knowledge and skills for the role
- Situational judgment
- Basic aptitude (math, logic, communication)
- Work ethics and professionalism

Return ONLY a valid JSON array with this exact structure:
[
  {
    "id": 1,
    "type": "multiple_choice",
    "question": "Question text here?",
    "choices": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
    "answer": "A",
    "points": 5
  },
  {
    "id": 2,
    "type": "true_false",
    "question": "Statement here.",
    "choices": ["True", "False"],
    "answer": "True",
    "points": 3
  },
  {
    "id": 3,
    "type": "short_answer",
    "question": "Describe how you would handle...",
    "answer": "Expected key points: ...",
    "points": 10
  }
]

No markdown, no explanation. Only the JSON array.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
    body: JSON.stringify({
      model:       "llama-3.3-70b-versatile",
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens:  4096,
    }),
  });

  if (!res.ok) throw new Error(`Groq failed: ${res.status}`);
  const data    = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "[]";

  // Parse JSON safely
  const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr : [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) { try { return JSON.parse(match[0]); } catch {} }
    return [];
  }
}

// POST /api/recruitment/exam/generate
// Called during interview creation — generates questions and saves to Firebase
export async function POST(req: NextRequest) {
  try {
    const { examToken, jobTitle, qualifications = [] } = await req.json();

    if (!examToken || !jobTitle) {
      return NextResponse.json({ success: false, error: "examToken and jobTitle required" }, { status: 400 });
    }

    // Generate questions via Groq
    const questions = await generateQuestions(jobTitle, qualifications);

    if (questions.length === 0) {
      return NextResponse.json({ success: false, error: "Failed to generate questions" }, { status: 500 });
    }

    // Save to Firebase — keyed by examToken
    const { db } = await getFirebaseDB();
    await setDoc(doc(db, "examQuestions", examToken), {
      examToken,
      jobTitle,
      questions,
      totalPoints: questions.reduce((sum, q) => sum + (q.points ?? 0), 0),
      createdAt:   serverTimestamp(),
    });

    return NextResponse.json({ success: true, count: questions.length });
  } catch (err: any) {
    console.error("[Exam Generate]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
