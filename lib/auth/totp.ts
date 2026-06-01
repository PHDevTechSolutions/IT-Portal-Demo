/**
 * lib/auth/totp.ts
 *
 * TOTP utilities for Google Authenticator using otplib v12.
 * RFC 6238 compliant — compatible with Google Authenticator, Authy, etc.
 */

import { authenticator } from "otplib";

const APP_NAME = "IT Portal · Ecoshift ERP";

// Allow ±1 time step to account for clock drift
authenticator.options = { window: 1 };

/** Generate a new random TOTP secret for a user */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate the otpauth:// URI used to create the QR code.
 * The user scans this with Google Authenticator.
 */
export function generateTOTPUri(email: string, secret: string): string {
  return authenticator.keyuri(email, APP_NAME, secret);
}

/** Verify a 6-digit TOTP code against a stored secret */
export function verifyTOTPCode(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ""), secret });
  } catch {
    return false;
  }
}
