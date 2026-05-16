import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL_IT;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_IT;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

// GET — fetch the single customize row (always id = 1)
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("customize")
      .select("*")
      .eq("id", 1)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: data ?? null });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT — update the single settings row (id = 1)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      outbound_quota,
      table_styles,
      table_preset,
      // Maintenance fields
      maintenance_enabled,
      maintenance_title,
      maintenance_message,
      maintenance_banner_preset,
      maintenance_styles,
      // Login form fields
      login_form_preset,
      login_form_styles,
      // Reminder fields
      logout_reminder_hour,
      logout_reminder_minute,
      logout_window_end,
      snooze_duration,
      logout_reminder_title,
      logout_reminder_message,
      logout_snooze_label,
      logout_dismiss_label,
    } = body;

    if (outbound_quota === undefined || outbound_quota === null || outbound_quota === "") {
      return NextResponse.json(
        { success: false, error: "outbound_quota is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const updatePayload: Record<string, any> = {
      outbound_quota: String(outbound_quota),
    };

    // Table layout
    if (table_styles !== undefined)  updatePayload.table_styles  = table_styles;
    if (table_preset !== undefined)  updatePayload.table_preset  = table_preset;

    // Maintenance
    if (maintenance_enabled       !== undefined) updatePayload.maintenance_enabled        = maintenance_enabled;
    if (maintenance_title         !== undefined) updatePayload.maintenance_title          = maintenance_title;
    if (maintenance_message       !== undefined) updatePayload.maintenance_message        = maintenance_message;
    if (maintenance_banner_preset !== undefined) updatePayload.maintenance_banner_preset  = maintenance_banner_preset;
    if (maintenance_styles        !== undefined) updatePayload.maintenance_styles         = maintenance_styles;

    // Login form
    if (login_form_preset !== undefined) updatePayload.login_form_preset = login_form_preset;
    if (login_form_styles !== undefined) updatePayload.login_form_styles = login_form_styles;

    // Reminder
    if (logout_reminder_hour    !== undefined) updatePayload.logout_reminder_hour    = logout_reminder_hour;
    if (logout_reminder_minute  !== undefined) updatePayload.logout_reminder_minute  = logout_reminder_minute;
    if (logout_window_end       !== undefined) updatePayload.logout_window_end       = logout_window_end;
    if (snooze_duration         !== undefined) updatePayload.snooze_duration         = snooze_duration;
    if (logout_reminder_title   !== undefined) updatePayload.logout_reminder_title   = logout_reminder_title;
    if (logout_reminder_message !== undefined) updatePayload.logout_reminder_message = logout_reminder_message;
    if (logout_snooze_label     !== undefined) updatePayload.logout_snooze_label     = logout_snooze_label;
    if (logout_dismiss_label    !== undefined) updatePayload.logout_dismiss_label    = logout_dismiss_label;

    const { data, error } = await supabase
      .from("customize")
      .update(updatePayload)
      .eq("id", 1)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}