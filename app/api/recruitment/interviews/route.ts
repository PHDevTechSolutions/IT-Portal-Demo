import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, getDocs, query,
  orderBy, where, Timestamp,
} from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export interface Interview {
  id:              string;
  applicantId:     string;
  applicantName:   string;
  applicantEmail:  string;
  jobId:           string;
  jobTitle:        string;
  scheduledDate:   string | null;
  scheduledTime:   string;
  interviewType:   string;   // "online" | "onsite" | "phone"
  interviewerName: string;
  location:        string;
  notes:           string;
  status:          string;   // "scheduled" | "completed" | "cancelled" | "no-show"
  examEnabled:     boolean;
  examLink:        string;
  examToken:       string;
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
    apiKey:            creds.api_key,
    authDomain:        creds.auth_domain,
    projectId:         creds.project_id,
    storageBucket:     creds.storage_bucket      || "",
    messagingSenderId: creds.messaging_sender_id || "",
    appId:             creds.app_id              || "",
  };

  const appName = `recruitment-${config.projectId}`;
  const app     = getApps().find(a => a.name === appName) ?? initializeApp(config, appName);
  return { db: getFirestore(app) };
}

// GET /api/recruitment/interviews
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const statusFilter = searchParams.get("status")?.trim() ?? "";
    const search       = searchParams.get("search")?.trim().toLowerCase() ?? "";

    const { db } = await getFirebaseDB();

    const q = statusFilter
      ? query(collection(db, "interviews"), where("status", "==", statusFilter), orderBy("scheduledDate", "asc"))
      : query(collection(db, "interviews"), orderBy("scheduledDate", "asc"));

    const snapshot = await getDocs(q);

    let interviews: Interview[] = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id:              doc.id,
        applicantId:     d.applicantId     ?? "",
        applicantName:   d.applicantName   ?? "",
        applicantEmail:  d.applicantEmail  ?? "",
        jobId:           d.jobId           ?? "",
        jobTitle:        d.jobTitle        ?? "",
        scheduledDate:   toISO(d.scheduledDate),
        scheduledTime:   d.scheduledTime   ?? "",
        interviewType:   d.interviewType   ?? "onsite",
        interviewerName: d.interviewerName ?? "",
        location:        d.location        ?? "",
        notes:           d.notes           ?? "",
        status:          d.status          ?? "scheduled",
        examEnabled:     d.examEnabled     ?? false,
        examLink:        d.examLink        ?? "",
        examToken:       d.examToken       ?? "",
        createdAt:       toISO(d.createdAt),
        updatedAt:       toISO(d.updatedAt),
      };
    });

    if (search) {
      interviews = interviews.filter(i =>
        i.applicantName.toLowerCase().includes(search) ||
        i.jobTitle.toLowerCase().includes(search) ||
        i.applicantEmail.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, data: interviews, total: interviews.length });
  } catch (err: any) {
    console.error("[Interviews GET]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
