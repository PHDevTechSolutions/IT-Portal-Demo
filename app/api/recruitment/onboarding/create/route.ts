import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
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

export async function POST(req: NextRequest) {
  try {
    const { candidateId, applicantName, applicantEmail, jobTitle, checklist } = await req.json();
    const { db } = await getFirebaseDB();

    await addDoc(collection(db, "onboardingChecklists"), {
      candidateId:    candidateId    ?? "",
      applicantName:  applicantName  ?? "",
      applicantEmail: applicantEmail ?? "",
      jobTitle:       jobTitle       ?? "",
      checklist:      (checklist ?? []).map((item: string) => ({ item, completed: false })),
      status:         "pending",
      documents:      [],
      createdAt:      serverTimestamp(),
      updatedAt:      serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Onboarding Create]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
