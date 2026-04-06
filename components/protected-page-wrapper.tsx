"use client";

/**
 * ProtectedPageWrapper
 *
 * Guards every protected page by verifying the HTTP-only session cookie
 * via /api/check-session.  No deviceId, no localStorage userId — the
 * cookie is the single source of truth.
 *
 * On success: renders children.
 * On failure: redirects to /Login.
 * While checking: renders a skeleton layout to eliminate white screen.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const LOGIN_PATH = "/login";
const CHECK_SESSION_PATH = "/api/check-session";

interface ProtectedPageWrapperProps {
  children: React.ReactNode;
}

function AuthSkeleton() {
  return (
    <div className="flex h-screen w-full bg-background" aria-hidden="true">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar-background shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col gap-1 p-3 flex-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2 rounded-md"
            >
              <div className="h-4 w-4 rounded bg-muted animate-pulse" />
              <div
                className="h-3 rounded bg-muted animate-pulse"
                style={{ width: `${55 + (i % 4) * 15}px` }}
              />
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex flex-col gap-1 flex-1">
              <div className="h-3 w-28 rounded bg-muted animate-pulse" />
              <div className="h-2 w-36 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex h-16 items-center gap-3 border-b border-border px-4 shrink-0">
          <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-4 w-px bg-border mx-1" />
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        </header>
        <div className="flex flex-col gap-4 p-6 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="h-9 w-64 rounded-md bg-muted animate-pulse" />
            <div className="flex gap-2">
              <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
              <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
            </div>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex gap-4 px-4 py-3 bg-muted/50 border-b border-border">
              {[10, 25, 22, 18, 15, 10].map((w, i) => (
                <div
                  key={i}
                  className="h-3 rounded bg-muted animate-pulse"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, row) => (
              <div
                key={row}
                className="flex gap-4 px-4 py-3 border-b border-border/50 last:border-0"
              >
                {[10, 25, 22, 18, 15, 10].map((w, col) => (
                  <div
                    key={col}
                    className="h-3 rounded bg-muted/60 animate-pulse"
                    style={{
                      width: `${w - (row % 3)}%`,
                      animationDelay: `${(row * 6 + col) * 40}ms`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProtectedPageWrapper({
  children,
}: ProtectedPageWrapperProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ok" | "redirect">(
    "checking",
  );
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    let cancelled = false;

    async function validateSession() {
      try {
        const res = await fetch(CHECK_SESSION_PATH, { cache: "no-store" });
        if (!cancelled && res.status === 200) {
          setStatus("ok");
          return;
        }
      } catch {
        // Network error — redirect to login
      }

      if (cancelled) return;
      setStatus("redirect");
      router.replace(LOGIN_PATH);
    }

    validateSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "checking") return <AuthSkeleton />;
  if (status === "redirect") return <AuthSkeleton />; // keep skeleton visible during redirect animation
  return <>{children}</>;
}
