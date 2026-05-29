import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// ── Status map: Resend event type → our DB status ─────────────────────────────
const STATUS_MAP: Record<string, string> = {
  "email.sent":             "sent",
  "email.delivered":        "delivered",
  "email.delivery_delayed": "delayed",
  "email.complained":       "complained",
  "email.bounced":          "bounced",
  "email.opened":           "opened",
  "email.clicked":          "clicked",
};

export async function POST(req: NextRequest) {
  try {
    // ── 1. Read raw body (needed for Svix signature verification) ─────────────
    const rawBody = await req.text();

    // ── 2. Verify Svix signature ──────────────────────────────────────────────
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Webhook] RESEND_WEBHOOK_SECRET not set");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    const svixId        = req.headers.get("svix-id")        ?? "";
    const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
    const svixSignature = req.headers.get("svix-signature") ?? "";

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
    }

    let payload: any;
    try {
      const wh = new Webhook(webhookSecret);
      payload  = wh.verify(rawBody, {
        "svix-id":        svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch (err) {
      console.error("[Webhook] Signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // ── 3. Process the verified event ─────────────────────────────────────────
    const eventType = payload.type        as string;
    const emailData = payload.data        ?? {};
    const resendId  = emailData.email_id  as string | undefined;
    const newStatus = STATUS_MAP[eventType];

    console.log(`[Webhook] Event: ${eventType} | email_id: ${resendId} | status: ${newStatus}`);

    if (!newStatus || !resendId) {
      // Unknown event — acknowledge and ignore
      return NextResponse.json({ success: true, ignored: true });
    }

    // ── 4. Update the matching record in Supabase ─────────────────────────────
    const { error } = await supabase
      .from("communications")
      .update({
        status:     newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("resend_email_id", resendId);

    if (error) {
      // Not fatal — record may not exist yet on email.sent race condition
      console.warn(`[Webhook] Supabase update failed for ${resendId}:`, error.message);
    } else {
      console.log(`[Webhook] ✓ Updated ${resendId} → ${newStatus}`);
    }

    // Always return 200 so Resend doesn't retry
    return NextResponse.json({ success: true, event: eventType, status: newStatus });

  } catch (err: any) {
    console.error("[Webhook] Unhandled error:", err.message);
    // Return 200 to prevent Resend from retrying on our own errors
    return NextResponse.json({ success: false, error: err.message }, { status: 200 });
  }
}
