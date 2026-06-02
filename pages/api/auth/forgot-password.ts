/**
 * POST /api/auth/forgot-password
 *
 * Body: { email: string }
 *
 * If the email belongs to an active IT user, sends a password-reset link
 * via Resend. The link contains a signed JWT (valid 30 min) pointing to
 * /auth/reset-password?token=<jwt>
 *
 * Always returns 200 regardless of whether the email was found —
 * prevents user enumeration.
 */

import { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/MongoDB";
import jwt from "jsonwebtoken";
import { Resend } from "resend";

const SECRET   = process.env.SECRET_KEY ?? process.env.API_KEY ?? "reset-secret";
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const resend   = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { email } = req.body as { email?: string };

  // Always respond 200 to avoid user enumeration
  const ok = () => res.status(200).json({
    message: "If that email is registered, a reset link has been sent.",
  });

  if (!email?.trim()) return ok();

  try {
    const db   = await connectToDatabase();
    const user = await db.collection("users").findOne({
      Email: { $regex: new RegExp(`^${email.trim()}$`, "i") },
    });

    // Only send if user exists and is not terminated/resigned
    if (!user || ["Resigned", "Terminated"].includes(user.Status ?? "")) {
      return ok();
    }

    // Issue a signed JWT reset token (30 min)
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.Email, purpose: "password-reset" },
      SECRET,
      { expiresIn: "30m" },
    );

    const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;
    const name     = `${user.Firstname ?? ""} ${user.Lastname ?? ""}`.trim() || user.Email;

    await resend.emails.send({
      from:    "IT Portal <noreply@devtech-erp-solutions.cloud>",
      to:      user.Email,
      subject: "Reset Your IT Portal Password",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#080d12;font-family:'Courier New',monospace;">
  <div style="max-width:480px;margin:40px auto;background:#0d1117;border:1px solid #1a2535;">

    <!-- Top accent -->
    <div style="height:3px;background:linear-gradient(90deg,transparent,#e8630a,transparent);"></div>

    <!-- Header -->
    <div style="padding:28px 32px 20px;border-bottom:1px solid #1a2535;background:#080d12;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;border:2px solid #e8630a;background:rgba(232,99,10,0.1);display:flex;align-items:center;justify-content:center;">
          <span style="color:#e8630a;font-size:13px;font-weight:900;">IT</span>
        </div>
        <div>
          <div style="color:#fff;font-size:13px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;">IT Portal</div>
          <div style="color:#4a6070;font-size:10px;letter-spacing:0.15em;">Ecoshift ERP · Password Reset</div>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#c8d8e8;font-size:13px;margin:0 0 8px;">Hi ${name},</p>
      <p style="color:#4a6070;font-size:12px;margin:0 0 24px;line-height:1.6;">
        We received a request to reset your password. Click the button below to set a new one.
        This link expires in <strong style="color:#e8630a;">30 minutes</strong>.
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}"
          style="display:inline-block;padding:13px 36px;background:linear-gradient(135deg,#e8630a,#ff8c42);color:#fff;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;">
          Reset Password →
        </a>
      </div>

      <p style="color:#253040;font-size:11px;margin:24px 0 0;line-height:1.5;">
        If you didn't request this, ignore this email — your password won't change.<br>
        Link expires: <span style="color:#4a6070;">${new Date(Date.now() + 30 * 60 * 1000).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</span>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #1a2535;background:#080d12;display:flex;justify-content:space-between;align-items:center;">
      <span style="color:#253040;font-size:10px;">Ecoshift ERP · IT Portal</span>
      <span style="color:#1a2535;font-size:10px;">Leroux & Xchire</span>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });

    return ok();
  } catch (err: any) {
    console.error("[forgot-password]", err.message);
    return ok(); // still 200 — don't expose errors
  }
}
