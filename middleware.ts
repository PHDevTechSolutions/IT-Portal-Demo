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
  // Skip entirely in development or when accessed via localhost
  const host = req.headers.get("host") ?? "";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");

  if (!isLocalhost) {
    const ipAllowedCookie = req.cookies.get("ip-allowed");

    if (!ipAllowedCookie?.value) {
      try {
        const clientIp = (
          req.headers.get("x-forwarded-for")?.split(",")[0] ||
          req.headers.get("x-real-ip") ||
          "unknown"
        ).trim();

        const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const sessionId = req.cookies.get("session")?.value ?? "";
        const checkUrl = `${appUrl}/api/settings/ip-whitelist/check?ip=${encodeURIComponent(clientIp)}&sessionId=${encodeURIComponent(sessionId)}`;

        const checkRes  = await fetch(checkUrl, { cache: "no-store" });
        const checkData = await checkRes.json();

        if (!checkData.allowed) {
          // Log the blocked attempt (fire-and-forget)
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
          fetch(`${appUrl}/api/settings/ip-blocklist`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ip:        clientIp,
              path:      pathname,
              userAgent: req.headers.get("user-agent") ?? "",
            }),
          }).catch(() => {});

          return NextResponse.redirect(new URL("/blocked", req.url));
        }
      } catch {
        // Fail open on check error
      }
    }
  }

  // ── Layer 2: Session check ────────────────────────────────────────────────
  const sessionCookie   = req.cookies.get("session");
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
