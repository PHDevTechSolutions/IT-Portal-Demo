import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
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

// GET /api/recruitment/exam/fetch?token=xxx
// Returns exam questions WITHOUT the correct answers (for the applicant)
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ success: false, error: "Token required" }, { status: 400 });

    const { db } = await getFirebaseDB();
    const snap   = await getDoc(doc(db, "examQuestions", token));

    if (!snap.exists()) {
      return NextResponse.json({ success: false, error: "Exam not found" }, { status: 404 });
    }

    const data = snap.data();

    // Strip correct answers before sending to applicant
    const safeQuestions = (data.questions ?? []).map((q: any) => ({
      id:       q.id,
      type:     q.type,
      question: q.question,
      choices:  q.choices ?? [],
      points:   q.points,
      // answer is intentionally omitted
    }));

    return NextResponse.json({
      success:     true,
      jobTitle:    data.jobTitle,
      totalPoints: data.totalPoints,
      questions:   safeQuestions,
    });
  } catch (err: any) {
    console.error("[Exam Fetch]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
