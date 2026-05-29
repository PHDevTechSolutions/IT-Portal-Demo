import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
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

// POST /api/recruitment/exam/submit
// Scores the exam and saves results to Firebase testResults collection
export async function POST(req: NextRequest) {
  try {
    const { token, applicantName, applicantEmail, answers } = await req.json();
    // answers: { [questionId]: string }

    if (!token || !answers) {
      return NextResponse.json({ success: false, error: "Token and answers required" }, { status: 400 });
    }

    const { db } = await getFirebaseDB();

    // Fetch the exam with correct answers
    const examSnap = await getDoc(doc(db, "examQuestions", token));
    if (!examSnap.exists()) {
      return NextResponse.json({ success: false, error: "Exam not found" }, { status: 404 });
    }

    const examData  = examSnap.data();
    const questions = examData.questions ?? [];

    // Auto-score multiple choice and true/false
    let earnedPoints = 0;
    let totalPoints  = 0;
    const gradedAnswers: any[] = [];

    for (const q of questions) {
      totalPoints += q.points ?? 0;
      const applicantAnswer = answers[q.id] ?? "";

      let isCorrect: boolean | null = null;
      let pointsEarned = 0;

      if (q.type === "multiple_choice" || q.type === "true_false") {
        // Compare first letter/word (A, B, C, D or True/False)
        const normalize = (s: string) => s.trim().toLowerCase().split(/[\s.]/)[0];
        isCorrect    = normalize(applicantAnswer) === normalize(q.answer);
        pointsEarned = isCorrect ? (q.points ?? 0) : 0;
        earnedPoints += pointsEarned;
      } else {
        // short_answer — not auto-scored, mark for manual review
        isCorrect    = null;
        pointsEarned = 0;
      }

      gradedAnswers.push({
        questionId:      q.id,
        question:        q.question,
        type:            q.type,
        applicantAnswer,
        correctAnswer:   q.type !== "short_answer" ? q.answer : "(manual review)",
        isCorrect,
        pointsEarned,
        maxPoints:       q.points ?? 0,
      });
    }

    const shortAnswerCount = questions.filter((q: any) => q.type === "short_answer").length;
    const autoScoredTotal  = questions
      .filter((q: any) => q.type !== "short_answer")
      .reduce((s: number, q: any) => s + (q.points ?? 0), 0);

    const percentage = autoScoredTotal > 0
      ? Math.round((earnedPoints / autoScoredTotal) * 100)
      : 0;

    // Save to testResults collection
    const resultRef = await addDoc(collection(db, "testResults"), {
      examToken:        token,
      jobTitle:         examData.jobTitle,
      applicantName:    applicantName  ?? "",
      applicantEmail:   applicantEmail ?? "",
      answers:          gradedAnswers,
      earnedPoints,
      autoScoredTotal,
      totalPoints,
      percentage,
      shortAnswerCount,
      status:           shortAnswerCount > 0 ? "pending_review" : "completed",
      submittedAt:      serverTimestamp(),
      createdAt:        serverTimestamp(),
    });

    return NextResponse.json({
      success:        true,
      resultId:       resultRef.id,
      earnedPoints,
      autoScoredTotal,
      totalPoints,
      percentage,
      shortAnswerCount,
      status:         shortAnswerCount > 0 ? "pending_review" : "completed",
    });
  } catch (err: any) {
    console.error("[Exam Submit]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
