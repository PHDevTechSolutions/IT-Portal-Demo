import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

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

function ratingFromScore(pct: number): "high" | "medium" | "low" {
  if (pct >= 80) return "high";
  if (pct >= 60) return "medium";
  return "low";
}

function buildCandidateEmail(data: {
  applicantName:  string;
  jobTitle:       string;
  examScore:      number;
  examPoints:     number;
  examTotal:      number;
  rating:         string;
  aiRemarks:      string;
  manualRemarks:  string;
  emailSubject:   string;
  emailBody:      string;
}): string {
  const ratingColor = data.rating === "high" ? "#16a34a" : data.rating === "medium" ? "#d97706" : "#dc2626";
  const ratingLabel = data.rating === "high" ? "High Potential" : data.rating === "medium" ? "Medium Potential" : "Needs Improvement";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <tr><td style="background:#e8630a;padding:28px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Final Interview Invitation</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${data.jobTitle}</p>
        </td></tr>

        <tr><td style="padding:32px;">
          <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
            ${data.emailBody.replace(/\n/g, "<br/>")}
          </p>

          <!-- Exam result card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin:24px 0;">
            <tr><td style="padding:20px;">
              <h3 style="margin:0 0 16px;color:#111827;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Exam Performance Summary</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;width:160px;">📊 Score</td>
                  <td style="padding:6px 0;color:#111827;font-size:16px;font-weight:700;">${data.examScore}%</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">📝 Points</td>
                  <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${data.examPoints} / ${data.examTotal}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">⭐ Rating</td>
                  <td style="padding:6px 0;font-size:13px;font-weight:700;color:${ratingColor};">${ratingLabel}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- AI Remarks -->
          <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 16px;margin:16px 0;border-radius:0 4px 4px 0;">
            <p style="margin:0 0 6px;color:#1e40af;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Performance Remarks</p>
            <p style="margin:0;color:#1e3a8a;font-size:13px;line-height:1.6;">${data.aiRemarks}</p>
          </div>

          ${data.manualRemarks ? `
          <div style="background:#fefce8;border-left:4px solid #eab308;padding:14px 16px;margin:16px 0;border-radius:0 4px 4px 0;">
            <p style="margin:0 0 6px;color:#854d0e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Additional Notes</p>
            <p style="margin:0;color:#713f12;font-size:13px;line-height:1.6;">${data.manualRemarks}</p>
          </div>` : ""}
        </td></tr>

        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
            Sent by Ecoshift Corporation HR Team · <strong>crm@elev8solutions.cloud</strong>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// POST /api/recruitment/candidates/add
export async function POST(req: NextRequest) {
  try {
    const {
      applicantName, applicantEmail, jobTitle, examToken,
      examScore, examPoints, examTotal,
      aiRemarks, manualRemarks,
      emailSubject, emailBody,
    } = await req.json();

    if (!applicantName || !examScore === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const rating = ratingFromScore(examScore);
    const { db } = await getFirebaseDB();

    // ── 1. Save to candidates collection ─────────────────────────────────
    const docRef = await addDoc(collection(db, "candidates"), {
      applicantName:  applicantName  ?? "",
      applicantEmail: applicantEmail ?? "",
      jobTitle:       jobTitle       ?? "",
      examToken:      examToken      ?? "",
      examScore,
      examPoints:     examPoints     ?? 0,
      examTotal:      examTotal      ?? 0,
      rating,
      aiRemarks:      aiRemarks      ?? "",
      manualRemarks:  manualRemarks  ?? "",
      status:         "queued",
      emailSent:      false,
      createdAt:      serverTimestamp(),
      updatedAt:      serverTimestamp(),
    });

    // ── 2. Send email via Resend ──────────────────────────────────────────
    let emailSent  = false;
    let emailError = "";

    if (applicantEmail && emailSubject && emailBody) {
      try {
        const html = buildCandidateEmail({
          applicantName, jobTitle, examScore,
          examPoints: examPoints ?? 0, examTotal: examTotal ?? 0,
          rating, aiRemarks: aiRemarks ?? "",
          manualRemarks: manualRemarks ?? "",
          emailSubject, emailBody,
        });

        await resend.emails.send({
          from:    "Ecoshift HR <crm@elev8solutions.cloud>",
          to:      [applicantEmail],
          subject: emailSubject,
          html,
          text:    emailBody,
          replyTo: "crm@elev8solutions.cloud",
        });
        emailSent = true;

        // Update emailSent flag in Firebase
        const { getFirestore: gfs, doc, updateDoc, serverTimestamp: sts } = await import("firebase/firestore");
        const { initializeApp: ia, getApps: ga } = await import("firebase/app");
        const { data: creds2 } = await supabase
          .from("recruitment_credentials").select("*").eq("is_active", true)
          .order("updated_at", { ascending: false }).limit(1).single();
        const cfg2 = !creds2 ? FALLBACK_CONFIG : { apiKey: creds2.api_key, authDomain: creds2.auth_domain, projectId: creds2.project_id, storageBucket: creds2.storage_bucket || "", messagingSenderId: creds2.messaging_sender_id || "", appId: creds2.app_id || "" };
        const an2  = `recruitment-${cfg2.projectId}`;
        const app2 = ga().find((a: any) => a.name === an2) ?? ia(cfg2, an2);
        await updateDoc(doc(gfs(app2), "candidates", docRef.id), { emailSent: true, updatedAt: sts() });
      } catch (e: any) {
        emailError = e.message;
        console.warn("[Candidate Email]", e.message);
      }
    }

    return NextResponse.json({
      success: true, id: docRef.id,
      rating, emailSent,
      emailError: emailError || undefined,
    });
  } catch (err: any) {
    console.error("[Candidates Add]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
