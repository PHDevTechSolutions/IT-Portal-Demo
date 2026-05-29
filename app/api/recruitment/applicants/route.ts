import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export interface Applicant {
  id:          string;
  fullName:    string;
  email:       string;
  phone:       string;
  jobId:       string;
  jobTitle:    string;
  title:       string;
  description: string;
  status:      string;
  isActive:    boolean;
  imageUrl:    string;
  resumeUrl:   string;
  website:     string;
  websites:    string[];
  appliedAt:   string | null;
  createdAt:   string | null;
  updatedAt:   string | null;
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

// GET /api/recruitment/applicants
// ?status=xxx   → filter by status
// ?jobId=xxx    → filter by job
// ?search=xxx   → search by name/email/jobTitle
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const statusFilter = searchParams.get("status")?.trim() ?? "";
    const jobIdFilter  = searchParams.get("jobId")?.trim()  ?? "";
    const search       = searchParams.get("search")?.trim().toLowerCase() ?? "";

    const { db } = await getFirebaseDB();

    let q = statusFilter
      ? query(collection(db, "applications"), where("status", "==", statusFilter), orderBy("appliedAt", "desc"))
      : jobIdFilter
        ? query(collection(db, "applications"), where("jobId", "==", jobIdFilter), orderBy("appliedAt", "desc"))
        : query(collection(db, "applications"), orderBy("appliedAt", "desc"));

    const snapshot = await getDocs(q);

    let applicants: Applicant[] = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id:          doc.id,
        fullName:    d.fullName    ?? "",
        email:       d.email       ?? "",
        phone:       d.phone       ?? "",
        jobId:       d.jobId       ?? "",
        jobTitle:    d.jobTitle    ?? "",
        title:       d.title       ?? "",
        description: d.description ?? "",
        status:      d.status      ?? "",
        isActive:    d.isActive    ?? true,
        imageUrl:    d.imageUrl    ?? "",
        resumeUrl:   d.resumeUrl   ?? "",
        website:     d.website     ?? "",
        websites:    Array.isArray(d.websites) ? d.websites : [],
        appliedAt:   toISO(d.appliedAt),
        createdAt:   toISO(d.createdAt),
        updatedAt:   toISO(d.updatedAt),
      };
    });

    if (search) {
      applicants = applicants.filter(a =>
        a.fullName.toLowerCase().includes(search) ||
        a.email.toLowerCase().includes(search) ||
        a.jobTitle.toLowerCase().includes(search) ||
        a.phone.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, data: applicants, total: applicants.length });
  } catch (err: any) {
    console.error("[Recruitment Applicants]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
