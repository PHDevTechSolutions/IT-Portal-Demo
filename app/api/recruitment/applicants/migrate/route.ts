import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, query, orderBy, serverTimestamp, Timestamp } from "firebase/firestore";
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

export async function POST(req: NextRequest) {
  try {
    // ── Fetch active credentials ──────────────────────────────────────────
    const { data: creds, error: credsError } = await supabase
      .from("recruitment_credentials")
      .select("*").eq("is_active", true)
      .order("updated_at", { ascending: false }).limit(1).single();

    if (credsError || !creds) {
      return NextResponse.json(
        { success: false, error: "No active credentials found. Save credentials first." },
        { status: 400 }
      );
    }

    if (creds.project_id === FALLBACK_CONFIG.projectId) {
      return NextResponse.json(
        { success: false, error: "Source and destination are the same Firebase project." },
        { status: 400 }
      );
    }

    // ── Source (fallback) ─────────────────────────────────────────────────
    const srcAppName = "recruitment-migrate-applicants-src";
    const srcApp     = getApps().find(a => a.name === srcAppName) ?? initializeApp(FALLBACK_CONFIG, srcAppName);
    const srcDb      = getFirestore(srcApp);

    // ── Destination (from Supabase credentials) ───────────────────────────
    const dstConfig = {
      apiKey:            creds.api_key,
      authDomain:        creds.auth_domain,
      projectId:         creds.project_id,
      storageBucket:     creds.storage_bucket      || "",
      messagingSenderId: creds.messaging_sender_id || "",
      appId:             creds.app_id              || "",
    };
    const dstAppName = `recruitment-migrate-applicants-dst-${creds.project_id}`;
    const dstApp     = getApps().find(a => a.name === dstAppName) ?? initializeApp(dstConfig, dstAppName);
    const dstDb      = getFirestore(dstApp);

    // ── Read source ───────────────────────────────────────────────────────
    const srcSnap = await getDocs(
      query(collection(srcDb, "applications"), orderBy("appliedAt", "desc"))
    );

    if (srcSnap.empty) {
      return NextResponse.json({ success: true, migrated: 0, message: "No applicants found in source." });
    }

    // ── Write to destination ──────────────────────────────────────────────
    let migrated = 0;
    const errors: string[] = [];

    for (const docSnap of srcSnap.docs) {
      const d = docSnap.data();
      try {
        await addDoc(collection(dstDb, "applications"), {
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
          appliedAt:   d.appliedAt   ?? serverTimestamp(),
          createdAt:   d.createdAt   ?? serverTimestamp(),
          updatedAt:   serverTimestamp(),
          migratedFrom: FALLBACK_CONFIG.projectId,
          migratedAt:   serverTimestamp(),
        });
        migrated++;
      } catch (e: any) {
        errors.push(`${d.fullName ?? docSnap.id}: ${e.message}`);
      }
    }

    return NextResponse.json({
      success:  true,
      migrated,
      total:    srcSnap.size,
      errors:   errors.length > 0 ? errors : undefined,
      message:  `Migrated ${migrated} of ${srcSnap.size} applicant(s) to ${creds.project_id}`,
    });
  } catch (err: any) {
    console.error("[Applicants Migrate]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
