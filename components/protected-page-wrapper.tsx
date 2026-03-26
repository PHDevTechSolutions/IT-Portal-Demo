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
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const LOGIN_PATH = "/Login";
const CHECK_SESSION_PATH = "/api/check-session";

interface ProtectedPageWrapperProps {
  children: React.ReactNode;
}

export default function ProtectedPageWrapper({
  children,
}: ProtectedPageWrapperProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    let cancelled = false;

    async function validateSession() {
      try {
        const res = await fetch(CHECK_SESSION_PATH, { cache: "no-store" });

        if (!cancelled && res.status === 200) {
          setLoading(false);
          return;
        }
      } catch {
        // Network error — fall through to redirect
      }

      if (cancelled) return;

      router.replace(LOGIN_PATH);
    }

    validateSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    // Invisible placeholder — keeps layout stable while auth resolves
    return (
      <div
        aria-hidden="true"
        className="flex h-screen w-full items-center justify-center"
      />
    );
  }

  return <>{children}</>;
}