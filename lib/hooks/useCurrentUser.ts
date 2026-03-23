/**
 * lib/hooks/useCurrentUser.ts
 *
 * Reusable hook that resolves the currently logged-in user by reading
 * `localStorage.getItem("userId")` (set during login) and fetching
 * the full user record from /api/user.
 *
 * Replaces the broken pattern of reading a "currentUser" key that was
 * never actually written anywhere in the codebase.
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
    const storedId =
      typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    if (!storedId) return;

    fetch(`/api/user?id=${encodeURIComponent(storedId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setUser({
          uid: data._id ?? storedId,
          name: `${data.Firstname ?? ""} ${data.Lastname ?? ""}`.trim() || null,
          email: data.Email ?? null,
          role: data.Role ?? null,
          referenceId: data.ReferenceID ?? null,
        });
      })
      .catch(() => {
        // Silently fail — actor info is optional for audit purposes
      });
  }, []);

  return user;
}
