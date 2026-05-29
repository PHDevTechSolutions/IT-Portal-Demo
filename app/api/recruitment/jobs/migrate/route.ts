import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, getDocs, addDoc,
  query, orderBy, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// ── Hardcoded fallback config ─────────────────────────────────────────────────
const FALLBACK_CONFIG = {
  apiKey:            "AIzaSyCNonSOohWCFdgL052XUFFZTH1orbP2dH4",
  authDomain:        "taskflow-4605f.firebaseapp.com",
  projectId:         "taskflow-4605f",
  storageBucket:     "taskflow-4605f.firebasestorage.app",
  messagingSenderId: "558742255762",
  appId:             "1:558742255762:web:5725b5c26f1c6fae9e8e4b",
};
const FALLBACK_COLLECTION = "careers";

function toISO(val: any): string | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val?.seconds)             return new Date(val.seconds * 1000).toISOString();
  return null;
}

// POST /api/recruitment/jobs/migrate
// Reads all docs from the FALLBACK Firebase project
// and writes them to the ACTIVE (new) Firebase project saved in Supabase.
// Skips if source === destination (same project ID).
export async function POST(req: NextRequest) {
  try {
    // ── 1. Fetch active credentials from Supabase ─────────────────────────
    const { data: creds, error: credsError } = await supabase
      .from("recruitment_credentials")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (credsError || !creds) {
      return NextResponse.json(
        { success: false, error: "No active credentials found. Save credentials first." },
        { status: 400 }
      );
    }

    // ── 2. Guard: don't migrate if source === destination ─────────────────
    if (creds.project_id === FALLBACK_CONFIG.projectId) {
      return NextResponse.json(
        { success: false, error: "Source and destination are the same Firebase project. Change the credentials first." },
        { status: 400 }
      );
    }

    // ── 3. Init SOURCE Firebase (fallback / hardcoded) ────────────────────
    const srcAppName = "recruitment-migrate-source";
    const srcApp     = getApps().find(a => a.name === srcAppName)
      ?? initializeApp(FALLBACK_CONFIG, srcAppName);
    const srcDb      = getFirestore(srcApp);

    // ── 4. Init DESTINATION Firebase (from Supabase credentials) ─────────
    const dstConfig = {
      apiKey:            creds.api_key,
      authDomain:        creds.auth_domain,
      projectId:         creds.project_id,
      storageBucket:     creds.storage_bucket      || "",
      messagingSenderId: creds.messaging_sender_id || "",
      appId:             creds.app_id              || "",
    };
    const dstAppName = `recruitment-migrate-dest-${creds.project_id}`;
    const dstApp     = getApps().find(a => a.name === dstAppName)
      ?? initializeApp(dstConfig, dstAppName);
    const dstDb      = getFirestore(dstApp);

    const dstCollection = creds.collection_name || "careers";

    // ── 5. Read all docs from source ─────────────────────────────────────
    const srcSnap = await getDocs(
      query(collection(srcDb, FALLBACK_COLLECTION), orderBy("createdAt", "desc"))
    );

    if (srcSnap.empty) {
      return NextResponse.json({ success: true, migrated: 0, message: "No documents found in source." });
    }

    // ── 6. Write each doc to destination ─────────────────────────────────
    let migrated = 0;
    const errors: string[] = [];

    for (const docSnap of srcSnap.docs) {
      const d = docSnap.data();
      try {
        await addDoc(collection(dstDb, dstCollection), {
          title:          d.title          ?? "",
          category:       d.category       ?? "",
          jobType:        d.jobType        ?? "",
          location:       d.location       ?? "",
          qualifications: Array.isArray(d.qualifications) ? d.qualifications : [],
          status:         d.status         ?? "Draft",
          // Preserve original timestamps if available, else use server time
          createdAt:      d.createdAt ?? serverTimestamp(),
          updatedAt:      serverTimestamp(),
          migratedFrom:   FALLBACK_CONFIG.projectId,
          migratedAt:     serverTimestamp(),
        });
        migrated++;
      } catch (e: any) {
        errors.push(`${d.title ?? docSnap.id}: ${e.message}`);
      }
    }

    return NextResponse.json({
      success:  true,
      migrated,
      total:    srcSnap.size,
      errors:   errors.length > 0 ? errors : undefined,
      message:  `Migrated ${migrated} of ${srcSnap.size} job(s) to ${creds.project_id} → ${dstCollection}`,
    });
  } catch (err: any) {
    console.error("[Jobs Migrate]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
