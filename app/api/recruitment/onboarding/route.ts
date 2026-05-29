import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, getDocs, doc, updateDoc,
  query, orderBy, Timestamp, serverTimestamp,
} from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export interface ChecklistItem { item: string; completed: boolean; }
export interface DocumentAttachment { item: string; url: string; publicId: string; fileName: string; uploadedAt: string; }
export interface OnboardingRecord {
  id:             string;
  candidateId:    string;
  applicantName:  string;
  applicantEmail: string;
  jobTitle:       string;
  checklist:      ChecklistItem[];
  documents:      DocumentAttachment[];
  status:         string;   // "pending" | "in_progress" | "completed"
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
    .from("recruitment_credentials").select("*").eq("is_active", true)
    .order("updated_at", { ascending: false }).limit(1).single();
  const config = !creds ? FALLBACK_CONFIG : {
    apiKey: creds.api_key, authDomain: creds.auth_domain, projectId: creds.project_id,
    storageBucket: creds.storage_bucket || "", messagingSenderId: creds.messaging_sender_id || "", appId: creds.app_id || "",
  };
  const appName = `recruitment-${config.projectId}`;
  const app = getApps().find(a => a.name === appName) ?? initializeApp(config, appName);
  return { db: getFirestore(app) };
}

// GET — fetch all onboarding checklists
export async function GET() {
  try {
    const { db } = await getFirebaseDB();
    const snap   = await getDocs(query(collection(db, "onboardingChecklists"), orderBy("createdAt", "desc")));
    const data: OnboardingRecord[] = snap.docs.map(d => {
      const r = d.data();
      return {
        id:             d.id,
        candidateId:    r.candidateId    ?? "",
        applicantName:  r.applicantName  ?? "",
        applicantEmail: r.applicantEmail ?? "",
        jobTitle:       r.jobTitle       ?? "",
        checklist:      Array.isArray(r.checklist) ? r.checklist : [],
        documents:      Array.isArray(r.documents) ? r.documents : [],
        status:         r.status         ?? "pending",
        createdAt:      toISO(r.createdAt),
        updatedAt:      toISO(r.updatedAt),
      };
    });
    return NextResponse.json({ success: true, data, total: data.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH — update a checklist item's completed state
export async function PATCH(req: NextRequest) {
  try {
    const { id, checklist } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });

    const { db } = await getFirebaseDB();
    const allDone = checklist.every((c: ChecklistItem) => c.completed);
    const anyDone = checklist.some((c: ChecklistItem) => c.completed);

    await updateDoc(doc(db, "onboardingChecklists", id), {
      checklist,
      status:    allDone ? "completed" : anyDone ? "in_progress" : "pending",
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT — attach a document to a checklist item
export async function PUT(req: NextRequest) {
  try {
    const { id, document } = await req.json();
    // document: { item, url, publicId, fileName, uploadedAt }
    if (!id || !document) return NextResponse.json({ success: false, error: "ID and document required" }, { status: 400 });

    const { db } = await getFirebaseDB();

    // Get current documents array
    const { getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "onboardingChecklists", id));
    if (!snap.exists()) return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });

    const existing = snap.data().documents ?? [];
    const updated  = [...existing, document];

    await updateDoc(doc(db, "onboardingChecklists", id), {
      documents:  updated,
      updatedAt:  serverTimestamp(),
    });

    return NextResponse.json({ success: true, documents: updated });
  } catch (err: any) {
    console.error("[Onboarding PUT]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
