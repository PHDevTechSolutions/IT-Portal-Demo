import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export interface Candidate {
  id:              string;
  applicantName:   string;
  applicantEmail:  string;
  jobTitle:        string;
  examToken:       string;
  examScore:       number;       // percentage
  examPoints:      number;
  examTotal:       number;
  rating:          "high" | "medium" | "low";
  aiRemarks:       string;
  manualRemarks:   string;
  status:          string;       // "queued" | "final_interview" | "hired" | "rejected"
  emailSent:       boolean;
  createdAt:       string | null;
  updatedAt:       string | null;
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const statusFilter = searchParams.get("status")?.trim() ?? "";
    const ratingFilter = searchParams.get("rating")?.trim() ?? "";
    const search       = searchParams.get("search")?.trim().toLowerCase() ?? "";

    const { db } = await getFirebaseDB();

    const q = statusFilter
      ? query(collection(db, "candidates"), where("status", "==", statusFilter), orderBy("createdAt", "desc"))
      : query(collection(db, "candidates"), orderBy("createdAt", "desc"));

    const snapshot = await getDocs(q);

    let candidates: Candidate[] = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id:             doc.id,
        applicantName:  d.applicantName  ?? "",
        applicantEmail: d.applicantEmail ?? "",
        jobTitle:       d.jobTitle       ?? "",
        examToken:      d.examToken      ?? "",
        examScore:      d.examScore      ?? 0,
        examPoints:     d.examPoints     ?? 0,
        examTotal:      d.examTotal      ?? 0,
        rating:         d.rating         ?? "low",
        aiRemarks:      d.aiRemarks      ?? "",
        manualRemarks:  d.manualRemarks  ?? "",
        status:         d.status         ?? "queued",
        emailSent:      d.emailSent      ?? false,
        createdAt:      toISO(d.createdAt),
        updatedAt:      toISO(d.updatedAt),
      };
    });

    if (ratingFilter) candidates = candidates.filter(c => c.rating === ratingFilter);
    if (search) {
      candidates = candidates.filter(c =>
        c.applicantName.toLowerCase().includes(search) ||
        c.jobTitle.toLowerCase().includes(search) ||
        c.applicantEmail.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, data: candidates, total: candidates.length });
  } catch (err: any) {
    console.error("[Candidates GET]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
