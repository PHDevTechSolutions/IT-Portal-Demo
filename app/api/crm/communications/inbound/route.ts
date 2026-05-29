import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// ── Resend Inbound Webhook ────────────────────────────────────────────────────
// Resend POSTs here when someone replies to crm@elev8solutions.cloud
// Payload docs: https://resend.com/docs/dashboard/emails/inbound-emails
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // ── Extract fields from Resend inbound payload ────────────────────────────
    const from      = payload.from        ?? "";   // "John Doe <john@company.com>"
    const to        = payload.to          ?? "";   // "crm@elev8solutions.cloud"
    const subject   = payload.subject     ?? "(no subject)";
    const body_html = payload.html        ?? null;
    const body_text = payload.text        ?? null;
    const headers   = payload.headers     ?? {};

    // Parse sender email and name from "Name <email>" format
    const fromMatch   = from.match(/^(.*?)\s*<(.+?)>$/);
    const senderName  = fromMatch ? fromMatch[1].trim() : from;
    const senderEmail = fromMatch ? fromMatch[2].trim() : from;

    // ── Try to match to an existing thread via X-Thread-Id header ────────────
    // When we send, we set headers["X-Thread-Id"] = emailThreadId
    // Resend passes custom headers back in the inbound payload
    const xThreadId = headers["x-thread-id"] || headers["X-Thread-Id"] || null;

    // Fallback: match by sender email — find the most recent outbound to this address
    let thread_id = xThreadId;
    let company_name   = "";
    let contact_person = "";

    if (!thread_id) {
      const { data: existing } = await supabase
        .from("communications")
        .select("thread_id, company_name, contact_person")
        .eq("email_address", senderEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        thread_id      = existing.thread_id;
        company_name   = existing.company_name   ?? "";
        contact_person = existing.contact_person ?? "";
      }
    } else {
      // Get company info from the thread
      const { data: existing } = await supabase
        .from("communications")
        .select("company_name, contact_person")
        .eq("thread_id", thread_id)
        .limit(1)
        .single();

      if (existing) {
        company_name   = existing.company_name   ?? "";
        contact_person = existing.contact_person ?? "";
      }
    }

    // If still no thread, create a new one (unsolicited inbound)
    if (!thread_id) {
      thread_id = `thread_inbound_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    // ── Save to Supabase ──────────────────────────────────────────────────────
    const { error: dbError } = await supabase
      .from("communications")
      .insert({
        company_name,
        contact_person,
        email_address:  senderEmail,
        thread_id,
        direction:      "inbound",
        subject,
        body_html,
        body_text,
        resend_email_id: payload.email_id ?? null,
        from_address:   senderEmail,
        reply_to:       senderEmail,
        status:         "received",
        sent_by_name:   senderName  || null,
        sent_by_email:  senderEmail || null,
      });

    if (dbError) throw new Error(dbError.message);

    console.log(`[Inbound] Received reply from ${senderEmail} → thread ${thread_id}`);

    // Resend expects a 200 response to confirm receipt
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Inbound Webhook]", err.message);
    // Still return 200 so Resend doesn't retry endlessly
    return NextResponse.json({ success: false, error: err.message }, { status: 200 });
  }
}
