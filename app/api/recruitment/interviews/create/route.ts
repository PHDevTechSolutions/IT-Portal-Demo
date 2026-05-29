import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
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
  const app     = getApps().find(a => a.name === appName) ?? initializeApp(config, appName);
  return { db: getFirestore(app) };
}

function generateToken(): string {
  return `exam_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildEmailHtml(data: {
  applicantName:   string;
  jobTitle:        string;
  scheduledDate:   string;
  scheduledTime:   string;
  interviewType:   string;
  interviewerName: string;
  location:        string;
  notes:           string;
  examEnabled:     boolean;
  examLink:        string;
  emailSubject:    string;
  emailBody:       string;
}): string {
  const typeLabel = data.interviewType === "online" ? "Online" : data.interviewType === "phone" ? "Phone" : "On-site";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#e8630a;padding:28px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Interview Invitation</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${data.jobTitle}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
            ${data.emailBody.replace(/\n/g, "<br/>")}
          </p>

          <!-- Interview details card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin:24px 0;">
            <tr><td style="padding:20px;">
              <h3 style="margin:0 0 16px;color:#111827;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Interview Details</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px;">📅 Date &amp; Time</td>
                  <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${data.scheduledDate}${data.scheduledTime ? " at " + data.scheduledTime : ""}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">💼 Position</td>
                  <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${data.jobTitle}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">🎯 Format</td>
                  <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${typeLabel}</td>
                </tr>
                ${data.interviewerName ? `<tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">👤 Interviewer</td>
                  <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${data.interviewerName}</td>
                </tr>` : ""}
                ${data.location ? `<tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">📍 Location</td>
                  <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${data.location}</td>
                </tr>` : ""}
              </table>
            </td></tr>
          </table>

          ${data.notes ? `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 16px;margin:16px 0;border-radius:0 4px 4px 0;">
            <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;"><strong>Note:</strong> ${data.notes}</p>
          </div>` : ""}

          ${data.examEnabled && data.examLink ? `
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:20px;margin:20px 0;">
            <h3 style="margin:0 0 8px;color:#1e40af;font-size:14px;font-weight:700;">📝 Pre-Interview Exam</h3>
            <p style="margin:0 0 14px;color:#1e3a8a;font-size:13px;line-height:1.6;">
              Please complete the online exam before your interview. Click the button below to start.
            </p>
            <a href="${data.examLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:600;">
              Take Exam →
            </a>
            <p style="margin:12px 0 0;color:#6b7280;font-size:11px;word-break:break-all;">
              Or copy this link: ${data.examLink}
            </p>
          </div>` : ""}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
            This email was sent by Ecoshift Corporation HR Team via <strong>crm@elev8solutions.cloud</strong>.<br/>
            If you have questions, please reply to this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const {
      applicantId, applicantName, applicantEmail,
      jobId, jobTitle,
      scheduledDate, scheduledTime,
      interviewType, interviewerName, location, notes,
      examEnabled,
      qualifications,
      // Email compose fields
      emailSubject, emailBody,
    } = await req.json();

    if (!applicantId || !scheduledDate) {
      return NextResponse.json(
        { success: false, error: "Applicant ID and scheduled date are required" },
        { status: 400 }
      );
    }

    const { db } = await getFirebaseDB();

    // Generate exam token & link
    const examToken = examEnabled ? generateToken() : "";
    const baseUrl   = process.env.NEXT_PUBLIC_APP_URL || "https://it-portal.devtech-erp-solutions.cloud";
    const examLink  = examEnabled ? `${baseUrl}/exam/${examToken}` : "";

    // ── 1. Save interview to Firebase ────────────────────────────────────
    const docRef = await addDoc(collection(db, "interviews"), {
      applicantId, applicantName: applicantName ?? "",
      applicantEmail: applicantEmail ?? "", jobId: jobId ?? "",
      jobTitle: jobTitle ?? "", scheduledDate, scheduledTime: scheduledTime ?? "",
      interviewType: interviewType ?? "onsite", interviewerName: interviewerName ?? "",
      location: location ?? "", notes: notes ?? "",
      status: "scheduled", examEnabled: examEnabled ?? false,
      examLink, examToken,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });

    // ── 2. Generate exam questions via Groq (non-blocking) ────────────────
    if (examEnabled && examToken) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://it-portal.devtech-erp-solutions.cloud";
        await fetch(`${baseUrl}/api/recruitment/exam/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examToken,
            jobTitle:       jobTitle ?? "",
            qualifications: qualifications ?? [],
          }),
        });
      } catch (e: any) {
        console.warn("[Interview] Exam generation failed:", e.message);
      }
    }

    // ── 3. Update applicant status ────────────────────────────────────────
    try {
      await updateDoc(doc(db, "applications", applicantId), {
        status: "Interview", updatedAt: serverTimestamp(),
      });
    } catch { /* non-fatal */ }

    // ── 3. Send email via Resend ──────────────────────────────────────────
    let emailSent = false;
    let emailError = "";

    if (applicantEmail && emailSubject && emailBody) {
      try {
        const html = buildEmailHtml({
          applicantName: applicantName ?? "",
          jobTitle:      jobTitle      ?? "",
          scheduledDate, scheduledTime: scheduledTime ?? "",
          interviewType: interviewType ?? "onsite",
          interviewerName: interviewerName ?? "",
          location:      location      ?? "",
          notes:         notes         ?? "",
          examEnabled:   examEnabled   ?? false,
          examLink,
          emailSubject,
          emailBody,
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
      } catch (e: any) {
        emailError = e.message;
        console.warn("[Interview Email]", e.message);
      }
    }

    return NextResponse.json({
      success: true,
      id:      docRef.id,
      examLink,
      examToken,
      emailSent,
      emailError: emailError || undefined,
    });
  } catch (err: any) {
    console.error("[Interviews Create]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
