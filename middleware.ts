/**
 * middleware.ts  (project root)
 *
 * Edge middleware that guards every protected route.
 * The check is intentionally lightweight — it only verifies that the
 * session cookie is present.  Deep DB validation happens inside each
 * route / ProtectedPageWrapper via /api/check-session or /api/me.
 */

import { NextRequest, NextResponse } from "next/server";

// ─── Route config ──────────────────────────────────────────────────────────────

/** Prefixes that require an authenticated session. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/taskflow",
  "/admin",
  "/settings",
  "/account",
  "/cloudflare",
  "/acculog",
  "/stash",
  "/ticketing",
  "/application",
];

/** Paths that are always public (no redirect even without a cookie). */
const PUBLIC_PREFIXES = [
  "/Login",
  "/Register",
  "/_next",
  "/api/login",
  "/api/logout",
  "/api/register",
  "/api/auto-login",
  "/api/check-session",
];

// ─── Middleware ────────────────────────────────────────────────────────────────

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public paths
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow all other API routes — they enforce auth themselves via
  // requireSession() inside each handler
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow static assets
  if (
    pathname.startsWith("/_next/") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // Only enforce session on explicitly protected paths
  const needsProtection = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!needsProtection) {
    return NextResponse.next();
  }

  // Cookie presence check (lightweight — no DB round-trip at edge)
  const sessionCookie = req.cookies.get("session");

  if (!sessionCookie?.value) {
    const loginUrl = new URL("/Login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};