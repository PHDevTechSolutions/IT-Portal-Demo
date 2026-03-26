/**
 * lib/hooks/useCurrentUser.ts
 *
 * Reusable hook that resolves the currently logged-in user by calling
 * /api/me — which reads the HTTP-only session cookie server-side.
 *
 * No localStorage reads.  No URL param parsing.  Identity comes entirely
 * from the session.
 */

"use client";

import { useState, useEffect } from "react";

export interface CurrentUser {
  uid: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
  referenceId: string | null;
}

const EMPTY: CurrentUser = {
  uid: null,
  name: null,
  email: null,
  role: null,
  referenceId: null,
};

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>(EMPTY);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setUser({
          uid: data.userId ?? null,
          name:
            `${data.firstname ?? ""} ${data.lastname ?? ""}`.trim() || null,
          email: data.email ?? null,
          role: data.role ?? null,
          referenceId: data.referenceId ?? null,
        });
      })
      .catch(() => {
        // Silently fail — actor info is optional for audit purposes
      });
  }, []);

  return user;
}