import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export interface TestResult {
  id:               string;
  examToken:        string;
  jobTitle:         string;
  applicantName:    string;
  applicantEmail:   string;
  earnedPoints:     number;
  autoScoredTotal:  number;
  totalPoints:      number;
  percentage:       number;
  shortAnswerCount: number;
  status:           string;
  submittedAt:      string | null;
  answers:          GradedAnswer[];
}

export interface GradedAnswer {
  questionId:      number;
  question:        string;
  type:            string;
  applicantAnswer: string;
  correctAnswer:   string;
  isCorrect:       boolean | null;
  pointsEarned:    number;
  maxPoints:       number;
}

function toISO(val: any): string | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val?.seconds)             return new Date(val.seconds * 1000).toISOString();
  if (typeof val === "string")  return val;
  return null;
}

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

// GET /api/recruitment/test-results
// ?status=pending_review|completed
// ?search=applicant name or job title
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const statusFilter = searchParams.get("status")?.trim() ?? "";
    const search       = searchParams.get("search")?.trim().toLowerCase() ?? "";

    const { db } = await getFirebaseDB();

    const q = statusFilter
      ? query(collection(db, "testResults"), where("status", "==", statusFilter), orderBy("submittedAt", "desc"))
      : query(collection(db, "testResults"), orderBy("submittedAt", "desc"));

    const snapshot = await getDocs(q);

    let results: TestResult[] = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id:               doc.id,
        examToken:        d.examToken        ?? "",
        jobTitle:         d.jobTitle         ?? "",
        applicantName:    d.applicantName    ?? "",
        applicantEmail:   d.applicantEmail   ?? "",
        earnedPoints:     d.earnedPoints     ?? 0,
        autoScoredTotal:  d.autoScoredTotal  ?? 0,
        totalPoints:      d.totalPoints      ?? 0,
        percentage:       d.percentage       ?? 0,
        shortAnswerCount: d.shortAnswerCount ?? 0,
        status:           d.status           ?? "completed",
        submittedAt:      toISO(d.submittedAt),
        answers:          Array.isArray(d.answers) ? d.answers : [],
      };
    });

    if (search) {
      results = results.filter(r =>
        r.applicantName.toLowerCase().includes(search) ||
        r.jobTitle.toLowerCase().includes(search) ||
        r.applicantEmail.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, data: results, total: results.length });
  } catch (err: any) {
    console.error("[Test Results]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
