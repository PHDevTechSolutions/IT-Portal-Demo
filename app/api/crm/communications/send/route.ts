import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const resend  = new Resend(process.env.RESEND_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function POST(req: NextRequest) {
  try {
    const {
      to,               // recipient email
      subject,
      body_html,
      body_text,
      company_name,
      contact_person,
      thread_id,        // optional — pass existing thread_id to continue a thread
      account_ref,
      sent_by_name,
      sent_by_email,
    } = await req.json();

    if (!to || !subject || (!body_html && !body_text)) {
      return NextResponse.json(
        { success: false, error: "to, subject, and body are required" },
        { status: 400 }
      );
    }

    // Generate a thread_id if this is a new conversation
    const emailThreadId = thread_id || `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // ── Send via Resend ───────────────────────────────────────────────────────
    const { data: resendData, error: resendError } = await resend.emails.send({
      from:     "Ecoshift CRM <crm@elev8solutions.cloud>",
      to:       [to],
      subject,
      html:     body_html || `<p>${body_text}</p>`,
      text:     body_text || "",
      replyTo:  sent_by_email || "crm@elev8solutions.cloud",
      headers: {
        "X-Thread-Id": emailThreadId,
      },
    });

    if (resendError) throw new Error(resendError.message);

    // ── Save to Supabase ──────────────────────────────────────────────────────
    const { data: saved, error: dbError } = await supabase
      .from("communications")
      .insert({
        company_name,
        contact_person,
        email_address:  to,
        thread_id:      emailThreadId,
        direction:      "outbound",
        subject,
        body_html:      body_html || null,
        body_text:      body_text || null,
        resend_email_id: resendData?.id || null,
        from_address:   "crm@elev8solutions.cloud",
        reply_to:       sent_by_email || null,
        status:         "sent",
        account_ref:    account_ref || null,
        sent_by_name:   sent_by_name || null,
        sent_by_email:  sent_by_email || null,
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    return NextResponse.json({
      success:   true,
      thread_id: emailThreadId,
      email_id:  resendData?.id,
      record:    saved,
    });
  } catch (err: any) {
    console.error("[Communications Send]", err.message);
    return NextResponse.json(
      { success: false, error: err.message ?? "Failed to send email" },
      { status: 500 }
    );
  }
}
