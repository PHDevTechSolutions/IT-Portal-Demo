/**
 * lib/auth/tempToken.ts
 *
 * Short-lived signed JWT issued after password verification,
 * before TOTP is confirmed. Expires in 5 minutes.
 *
 * Using JWT instead of in-memory Map so it works correctly on
 * Vercel serverless (each invocation is a fresh process).
 */

import jwt from "jsonwebtoken";

const SECRET = process.env.SECRET_KEY ?? process.env.API_KEY ?? "totp-fallback-secret";

interface TempPayload {
  userId: string;
  email:  string;
  totp:   true; // marks this as a totp-pending token
}

/** Issue a signed temp token valid for 5 minutes */
export function issueTempToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email, totp: true } as TempPayload,
    SECRET,
    { expiresIn: "5m" },
  );
}

/** Verify and consume a temp token — returns payload or null if invalid/expired */
export function consumeTempToken(token: string): { userId: string; email: string } | null {
  try {
    const payload = jwt.verify(token, SECRET) as TempPayload;
    if (!payload.totp) return null;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null; // expired or tampered
  }
}

/** @deprecated no-op — kept for compatibility */
export function pruneExpiredTokens() {}
