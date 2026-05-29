import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

async function getFirebaseDB() {
  const { data: creds } = await supabase
    .from("recruitment_credentials")
    .select("*").eq("is_active", true)
    .order("updated_at", { ascending: false }).limit(1).single();

  const config = !creds ? {
    apiKey: "AIzaSyCNonSOohWCFdgL052XUFFZTH1orbP2dH4",
    authDomain: "taskflow-4605f.firebaseapp.com",
    projectId: "taskflow-4605f",
    storageBucket: "taskflow-4605f.firebasestorage.app",
    messagingSenderId: "558742255762",
    appId: "1:558742255762:web:5725b5c26f1c6fae9e8e4b",
  } : {
    apiKey: creds.api_key, authDomain: creds.auth_domain,
    projectId: creds.project_id, storageBucket: creds.storage_bucket || "",
    messagingSenderId: creds.messaging_sender_id || "", appId: creds.app_id || "",
  };

  const appName = `recruitment-${config.projectId}`;
  const app = getApps().find(a => a.name === appName) ?? initializeApp(config, appName);
  return { db: getFirestore(app), collectionName: creds?.collection_name || "careers" };
}

export async function POST(req: NextRequest) {
  try {
    const { title, category, jobType, location, qualifications, status } = await req.json();
    if (!title?.trim()) return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });

    const { db, collectionName } = await getFirebaseDB();
    const docRef = await addDoc(collection(db, collectionName), {
      title: title.trim(), category: category?.trim() ?? "",
      jobType: jobType?.trim() ?? "", location: location?.trim() ?? "",
      qualifications: Array.isArray(qualifications) ? qualifications.filter(Boolean) : [],
      status: status?.trim() ?? "Draft",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (err: any) {
    console.error("[Jobs Create]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
