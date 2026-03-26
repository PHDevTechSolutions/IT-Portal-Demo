"use client";

/**
 * UserContext
 *
 * Loads the current user from /api/me on first mount so that every
 * consumer (dashboard, forms, etc.) has access to userId and referenceId
 * without relying on URL params or localStorage.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface UserContextType {
  userId: string | null;
  referenceId: string | null;
  setUserId: (id: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);

  // Hydrate from session on mount
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.userId) setUserId(data.userId);
        if (data.referenceId) setReferenceId(data.referenceId);
      })
      .catch(() => {
        // Silently ignore — unauthenticated pages will redirect via middleware
      });
  }, []);

  return (
    <UserContext.Provider value={{ userId, referenceId, setUserId }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}
