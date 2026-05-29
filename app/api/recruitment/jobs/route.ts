import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export interface JobPosting {
  id:             string;
  title:          string;
  category:       string;
  jobType:        string;
  location:       string;
  qualifications: string[];
  status:         string;
  createdAt:      string | null;
  updatedAt:      string | null;
}

function toISO(val: any): string | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val?.seconds)             return new Date(val.seconds * 1000).toISOString();
  if (typeof val === "string")  return val;
  return null;
}

// ── Get dynamic Firebase instance from Supabase credentials ──────────────────
async function getFirebaseDB() {
  // Fetch active credentials from Supabase
  const { data: creds, error } = await supabase
    .from("recruitment_credentials")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  // Fall back to hardcoded config if no credentials saved yet
  const config = (!creds || error) ? {
    apiKey:            "AIzaSyCNonSOohWCFdgL052XUFFZTH1orbP2dH4",
    authDomain:        "taskflow-4605f.firebaseapp.com",
    projectId:         "taskflow-4605f",
    storageBucket:     "taskflow-4605f.firebasestorage.app",
    messagingSenderId: "558742255762",
    appId:             "1:558742255762:web:5725b5c26f1c6fae9e8e4b",
  } : {
    apiKey:            creds.api_key,
    authDomain:        creds.auth_domain,
    projectId:         creds.project_id,
    storageBucket:     creds.storage_bucket     || "",
    messagingSenderId: creds.messaging_sender_id || "",
    appId:             creds.app_id              || "",
    measurementId:     creds.measurement_id      || "",
  };

  const collectionName = creds?.collection_name || "careers";

  // Use a named app so we don't conflict with the default Firebase instance
  const appName = `recruitment-${config.projectId}`;
  const existing = getApps().find(a => a.name === appName);
  const app = existing ?? initializeApp(config, appName);
  const db  = getFirestore(app);

  return { db, collectionName };
}

// GET /api/recruitment/jobs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const statusFilter = searchParams.get("status")?.trim() ?? "";
    const search       = searchParams.get("search")?.trim().toLowerCase() ?? "";

    const { db, collectionName } = await getFirebaseDB();

    let q = statusFilter
      ? query(collection(db, collectionName), where("status", "==", statusFilter), orderBy("createdAt", "desc"))
      : query(collection(db, collectionName), orderBy("createdAt", "desc"));

    const snapshot = await getDocs(q);

    let jobs: JobPosting[] = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id:             doc.id,
        title:          d.title          ?? "",
        category:       d.category       ?? "",
        jobType:        d.jobType        ?? "",
        location:       d.location       ?? "",
        qualifications: Array.isArray(d.qualifications) ? d.qualifications : [],
        status:         d.status         ?? "",
        createdAt:      toISO(d.createdAt),
        updatedAt:      toISO(d.updatedAt),
      };
    });

    if (search) {
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(search) ||
        j.category.toLowerCase().includes(search) ||
        j.location.toLowerCase().includes(search) ||
        j.jobType.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, data: jobs, total: jobs.length });
  } catch (err: any) {
    console.error("[Recruitment Jobs]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
