/**
 * middleware.ts
 *
 * Two-layer guard:
 *   1. IP Whitelist — if enabled, only whitelisted IPs can access any page
 *      (enforced via the `ip-allowed` cookie set at login time)
 *   2. Session — cookie presence check for protected routes
 */

import { NextRequest, NextResponse } from "next/server";

// ─── Config ───────────────────────────────────────────────────────────────────

const PROTECTED_PREFIXES = [
  "/dashboard", "/taskflow", "/admin", "/settings",
  "/account", "/cloudflare", "/acculog", "/stash",
  "/ticketing", "/application",
];

const PUBLIC_PREFIXES = [
  "/login", "/Login", "/Register", "/_next",
  "/api/login", "/api/logout", "/api/register",
  "/api/auto-login", "/api/check-session",
  "/api/auth/totp/verify", "/api/auth/biometric",
  "/api/auth/forgot-password", "/api/auth/reset-password",
  "/auth/forgot-password", "/auth/reset-password",
  // whitelist check API must be reachable without the cookie
  "/api/settings/ip-whitelist",
  // blocked page itself must be reachable
  "/blocked",
];

// ─── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always pass static assets and Next internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // Always pass explicitly public paths
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Pass other API routes (they self-enforce auth)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // ── Layer 1: IP Whitelist check ───────────────────────────────────────────
  // We check whether the `ip-allowed` cookie is present.
  // This cookie is set by /api/login ONLY after the IP passes the whitelist check.
  // If the user has no cookie at all and tries to access any page (including /login),
  // we need to perform a live IP check so they can't even see the login page.

  const ipAllowedCookie = req.cookies.get("ip-allowed");
  const sessionCookie   = req.cookies.get("session");

  // If they have ip-allowed cookie → they already passed the check at login time
  // If they have NO ip-allowed cookie, do a live check against the whitelist API
  if (!ipAllowedCookie?.value) {
    try {
      const clientIp = (
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("x-real-ip") ||
        "unknown"
      ).trim();

      const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const checkUrl = `${appUrl}/api/settings/ip-whitelist/check?ip=${encodeURIComponent(clientIp)}`;

      const checkRes  = await fetch(checkUrl, { cache: "no-store" });
      const checkData = await checkRes.json();

      if (!checkData.allowed) {
        // Redirect to the blocked page
        return NextResponse.redirect(new URL("/blocked", req.url));
      }
    } catch {
      // On check error → fail open (don't lock out everyone if DB is down)
    }
  }

  // ── Layer 2: Session check ────────────────────────────────────────────────
  const needsProtection = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));

  if (!needsProtection) return NextResponse.next();

  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL("/Login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
