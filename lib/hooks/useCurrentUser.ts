"use client";

/**
 * lib/hooks/useCurrentUser.ts
 *
 * Resolves the currently logged-in user by calling /api/me — which reads
 * the HTTP-only session cookie server-side.
 *
 * No localStorage reads. No URL param parsing.
 * Identity comes entirely from the session.
 */

import { useState, useEffect, useCallback } from "react";

export interface CurrentUser {
  uid: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
  referenceId: string | null;
  department: string | null;
  isLoading: boolean;
}

const EMPTY: CurrentUser = {
  uid: null,
  name: null,
  email: null,
  role: null,
  referenceId: null,
  department: null,
  isLoading: true,
};

let cachedUser: CurrentUser | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30_000; // re-fetch after 30s

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>(() => {
    // Return cached value immediately to avoid flicker
    if (cachedUser && Date.now() - cacheTime < CACHE_TTL_MS) {
      return { ...cachedUser, isLoading: false };
    }
    return EMPTY;
  });

  const fetchUser = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      if (!r.ok) {
        setUser({ ...EMPTY, isLoading: false });
        return;
      }
      const data = await r.json();
      const resolved: CurrentUser = {
        uid: data.userId ?? null,
        name: `${data.firstname ?? ""} ${data.lastname ?? ""}`.trim() || null,
        email: data.email ?? null,
        role: data.role ?? null,
        referenceId: data.referenceId ?? null,
        department: data.department ?? null,
        isLoading: false,
      };
      cachedUser = resolved;
      cacheTime = Date.now();
      setUser(resolved);
    } catch {
      setUser({ ...EMPTY, isLoading: false });
    }
  }, []);

  useEffect(() => {
    // Skip fetch if cache is fresh
    if (cachedUser && Date.now() - cacheTime < CACHE_TTL_MS) {
      setUser({ ...cachedUser, isLoading: false });
      return;
    }
    fetchUser();
  }, [fetchUser]);

  return user;
}

/** Invalidate the in-memory cache (call after login/logout). */
export function invalidateUserCache() {
  cachedUser = null;
  cacheTime = 0;
}
